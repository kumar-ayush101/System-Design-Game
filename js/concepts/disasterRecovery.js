/* Disaster Recovery — Area 6 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "disaster-recovery",
    title: "Disaster Recovery",
    tagline: "Planning to survive a whole region or data center going down — measured by RTO and RPO.",
    diagramNote: "A secondary region stands ready; on disaster, traffic fails over to it with some data/time loss.",
    gameNote: "Pick a DR strategy (from cheap backups to hot standby), trigger a region outage, and see your downtime (RTO) and data loss (RPO) — plus the cost.",

    explanation: `
      <p><strong>Disaster recovery</strong> (DR) is your plan for when something big fails — an entire data center, an availability zone, or a whole cloud region. It's distinct from everyday fault tolerance: DR is about surviving catastrophic, correlated failures and getting back online elsewhere.</p>
      <h3>The two numbers that define DR</h3>
      <ul>
        <li><strong>RTO (Recovery Time Objective)</strong> — how long can you be <em>down</em>? The max acceptable time to restore service. "We must be back within 1 hour."</li>
        <li><strong>RPO (Recovery Point Objective)</strong> — how much <em>data</em> can you afford to lose? The max acceptable gap between the last safe copy and the disaster. "We can lose at most 5 minutes of writes."</li>
      </ul>
      <p>Both drive cost. Near-zero RTO/RPO is expensive; generous targets are cheap. You choose per business need — a bank's ledger and a blog's comments have very different answers.</p>
      <h3>Strategies, cheap to expensive</h3>
      <ul>
        <li><strong>Backup & restore</strong> — periodic backups to another region. Cheapest. High RTO (hours to rebuild) and high RPO (lose up to one backup interval).</li>
        <li><strong>Pilot light</strong> — core systems (like the database) replicated and running small in a second region; scale them up on disaster. Moderate RTO/RPO.</li>
        <li><strong>Warm standby</strong> — a scaled-down but fully working copy always running; promote and scale it up. Low RTO.</li>
        <li><strong>Hot standby / multi-site active-active</strong> — a full copy serving (or ready to serve) traffic continuously. Near-zero RTO/RPO, highest cost.</li>
      </ul>
      <div class="callout tip"><span class="c-ico">🧪</span><div><h5>Untested DR is not DR</h5><p>A recovery plan you've never exercised will fail when you need it. Run <strong>game days</strong> — deliberately fail over to the secondary and measure your real RTO/RPO. Backups you can't restore are worthless; test the restore, not just the backup.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 230,
        nodes: [
          { id: "users", x: 320, y: 20, w: 110, h: 42, label: "Users", kind: "client" },
          { id: "primary", x: 60, y: 120, w: 250, h: 80, label: "Primary region", kind: "good", caption: "active" },
          { id: "dr", x: 440, y: 120, w: 250, h: 80, label: "DR region", kind: "warn", caption: "standby" },
        ],
        links: [
          { from: "users", to: "primary", accent: true, label: "normal" },
          { from: "primary", to: "dr", dashed: true, color: "#ffca3a", label: "replicate" },
          { from: "users", to: "dr", dashed: true, label: "on failover" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Balance resilience against cost. Choose a DR strategy, then trigger a regional disaster. Measure your real RTO (downtime) and RPO (data lost). Stronger strategies recover faster with less loss — but cost more.",
        help: "Pick a strategy, then click 'Trigger disaster'. Watch the failover unfold and read the resulting RTO/RPO/cost.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      const strategies = {
        backup: { label: "Backup & Restore", rto: 240, rpo: 60, cost: "$", warmth: 0.05 },
        pilot: { label: "Pilot Light", rto: 45, rpo: 15, cost: "$$", warmth: 0.25 },
        warm: { label: "Warm Standby", rto: 10, rpo: 2, cost: "$$$", warmth: 0.55 },
        hot: { label: "Hot / Active-Active", rto: 0.5, rpo: 0, cost: "$$$$", warmth: 1 },
      };
      let strat = "pilot";
      let phase = "healthy"; // healthy | disaster | recovering | recovered
      let phaseT = 0, elapsedRto = 0;

      SDE.toolGroup(refs.toolbar, Object.keys(strategies).map((k) => ({ label: strategies[k].label + " " + strategies[k].cost, value: k })), (v) => { strat = v; reset(); });

      SDE.button(refs.controls, "☄️ Trigger disaster", "danger", () => { if (phase === "healthy") { phase = "disaster"; phaseT = 0; } });
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "Reset", "", reset);
      function reset() { phase = "healthy"; phaseT = 0; elapsedRto = 0; }

      const stRto = SDE.stat(refs.stats, "RTO (downtime)", "warn");
      const stRpo = SDE.stat(refs.stats, "RPO (data lost)", "bad");
      const stCost = SDE.stat(refs.stats, "Cost");
      const stState = SDE.stat(refs.stats, "Status");

      sim.onUpdate = (dt) => {
        phaseT += dt;
        const s = strategies[strat];
        // simulate recovery time scaled down (RTO in "sim seconds" = rto/30)
        if (phase === "disaster") { if (phaseT > 0.8) { phase = "recovering"; phaseT = 0; } elapsedRto = 0; }
        else if (phase === "recovering") { elapsedRto = (phaseT) / (0.1 + s.warmth * 0.05); if (phaseT > (s.rto / 60)) { phase = "recovered"; } }
        stRto(phase === "healthy" ? "—" : s.rto >= 60 ? (s.rto / 60).toFixed(0) + " min" : s.rto + " s");
        stRpo(s.rpo === 0 ? "0 (none)" : s.rpo + " min");
        stCost(s.cost);
        stState(phase === "healthy" ? "normal ✓" : phase === "disaster" ? "REGION DOWN" : phase === "recovering" ? "failing over…" : "recovered on DR ✓");
      };

      sim.onDraw = (g) => {
        const s = strategies[strat];
        // users
        D.node(g, { x: 350, y: 20, w: 120, h: 44, label: "Users", fill: "#161b2e", stroke: C.dim, labelColor: C.text });
        // primary region
        const primDown = phase === "disaster" || phase === "recovering";
        D.node(g, { x: 60, y: 110, w: 280, h: 120, label: primDown ? "PRIMARY REGION ✗" : "PRIMARY REGION", sub: primDown ? "offline" : "active · serving", fill: primDown ? "#2a1414" : "#10261a", stroke: primDown ? C.bad : C.good, labelColor: primDown ? C.bad : C.good, subColor: C.dim, glow: primDown ? 0 : 10 });
        if (phase === "disaster") D.text(g, "☄️", 200, 175, { size: 40, align: "center" });

        // DR region
        const drActive = phase === "recovered";
        const drCol = drActive ? C.good : phase === "recovering" ? C.warn : C.warn;
        D.node(g, { x: 460, y: 110, w: 280, h: 120, label: drActive ? "DR REGION ✓ (now primary)" : "DR REGION", sub: drActive ? "serving traffic" : "standby · warmth " + Math.round(s.warmth * 100) + "%", fill: drActive ? "#10261a" : "#2a2410", stroke: drCol, labelColor: drCol, subColor: C.dim, glow: drActive ? 12 : 0 });

        // traffic arrow
        if (phase === "healthy") D.arrow(g, 410, 64, 200, 110, C.accent, 2);
        else if (phase === "recovered") D.arrow(g, 410, 64, 600, 110, C.good, 2);
        else { D.text(g, "⏳ failing over…", 410, 90, { color: C.warn, size: 13, align: "center" }); }

        // replication link
        D.line(g, 340, 170, 460, 170, phase === "healthy" ? "rgba(255,202,58,0.4)" : "rgba(90,100,127,0.2)", 1.6, [6, 5]);
        if (phase === "healthy") D.text(g, "replicating (RPO " + (s.rpo === 0 ? "~0" : s.rpo + "m") + ")", 400, 160, { color: C.warn, size: 10, align: "center" });

        D.text(g, "Strategy: " + s.label + "  ·  RTO " + (s.rto >= 60 ? (s.rto / 60) + "min" : s.rto + "s") + "  ·  RPO " + (s.rpo || 0) + "min  ·  cost " + s.cost, 410, 300, { color: C.dim, size: 13, align: "center" });
      };

      sim.start();
      return sim;
    },
  });
})(window);
