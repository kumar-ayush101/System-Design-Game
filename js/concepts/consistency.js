/* Consistency & CAP — Area 3 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "consistency",
    title: "Consistency & CAP",
    tagline: "When the network splits, you must choose: stay consistent, or stay available.",
    diagramNote: "A network partition cuts the cluster in two. CP rejects to stay correct; AP answers to stay up.",
    gameNote: "Cause a network partition, then choose CP or AP. Write to one side and read from the other to feel the consistency trade-off.",

    explanation: `
      <p><strong>Consistency</strong> is about whether everyone sees the same data at the same time. In a distributed system this collides with the reality that networks fail — and that collision is the <strong>CAP theorem</strong>.</p>
      <h3>The CAP theorem</h3>
      <p>A distributed system can guarantee at most two of: <strong>C</strong>onsistency, <strong>A</strong>vailability, <strong>P</strong>artition tolerance. Since network partitions <em>will</em> happen (you can't opt out of them), P is mandatory. So the real choice, <em>during a partition</em>, is between C and A:</p>
      <ul>
        <li><strong>CP (consistency over availability)</strong> — if the system can't guarantee it's returning current data, it <em>refuses</em> the request (errors or waits). No wrong answers, but reduced availability.</li>
        <li><strong>AP (availability over consistency)</strong> — the system keeps answering from whatever node you reach, which may return <em>stale</em> data. Always up, sometimes wrong.</li>
      </ul>
      <h3>Strong vs eventual consistency</h3>
      <ul>
        <li><strong>Strong consistency</strong> — every read reflects the most recent write, no matter which node answers. Requires coordination on every write (latency). Right for bank balances, inventory, seat booking.</li>
        <li><strong>Eventual consistency</strong> — replicas converge over time; a read right after a write might be stale. Cheaper and more available. Right for like counts, follower counts, feeds.</li>
      </ul>
      <div class="callout tip"><span class="c-ico">🧠</span><div><h5>It's a per-data decision</h5><p>Real systems don't pick one globally. The same company runs CP for payments and AP for the "likes" counter. The skill is being deliberate about which data can tolerate staleness and which absolutely cannot.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 240,
        nodes: [
          { id: "n1", x: 80, y: 90, w: 130, h: 56, label: "Node 1", kind: "good" },
          { id: "n2", x: 80, y: 20, w: 130, h: 50, label: "Node 2", kind: "good" },
          { id: "n3", x: 530, y: 90, w: 130, h: 56, label: "Node 3", kind: "warn" },
          { id: "n4", x: 530, y: 20, w: 130, h: 50, label: "Node 4", kind: "warn" },
        ],
        links: [
          { from: "n1", to: "n2", color: "#3ddc84" }, { from: "n3", to: "n4", color: "#ffca3a" },
          { from: "n1", to: "n3", dashed: true, color: "#ff6b6b", label: "✗ partition" },
        ],
        labels: [{ x: 370, y: 200, text: "cut network → each side must choose C or A", color: "#ff6b6b", size: 12, align: "middle" }],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Live the CAP trade-off. Partition the network, then write <code>X=5</code> on the left side and read X on the right. CP mode refuses the read (correct but unavailable). AP mode returns the old value (available but stale).",
        help: "Click 'Partition network', pick CP or AP, then Write-left and Read-right to see what happens.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 300 });

      let mode = "cp";
      let partitioned = false;
      let left = { x: 10 }, right = { x: 20 }; // X value on each side (start different to be obvious? keep same)
      left.x = 1; right.x = 1;
      let lastRead = "—";
      let flash = 0;

      SDE.toolGroup(refs.toolbar, [
        { label: "CP (consistent)", value: "cp" }, { label: "AP (available)", value: "ap" },
      ], (v) => { mode = v; });

      const partBtn = SDE.button(refs.controls, "✂️ Partition network", "danger", () => {
        partitioned = !partitioned;
        partBtn.textContent = partitioned ? "🔗 Heal network" : "✂️ Partition network";
        partBtn.classList.toggle("active", partitioned);
        if (!partitioned) { right.x = left.x; SDE.toast("Network healed — replicas converge", "🔗"); }
      });
      SDE.button(refs.controls, "✍ Write X=" + 0 + " (left)", "primary", () => {}).style.display = "none";
      const writeBtn = SDE.button(refs.controls, "✍ Write X++ (left)", "primary", () => {
        left.x++;
        if (!partitioned) right.x = left.x; // replicates when connected
        else SDE.toast("Wrote X=" + left.x + " on left — can't reach right side!", "⚠️");
      });
      const readBtn = SDE.button(refs.controls, "👁 Read X (right)", "", () => {
        flash = 0.8;
        if (partitioned) {
          if (mode === "cp") { lastRead = "ERROR: can't guarantee fresh data (CP refuses)"; SDE.toast("CP: read refused to avoid stale data", "🛑"); }
          else { lastRead = "X=" + right.x + "  (STALE — real value is " + left.x + ")"; SDE.toast("AP: returned stale X=" + right.x, "⚠️"); }
        } else { lastRead = "X=" + right.x + "  (fresh ✓)"; SDE.toast("Consistent read X=" + right.x, "✅"); }
      });

      const stMode = SDE.stat(refs.stats, "Mode");
      const stLeft = SDE.stat(refs.stats, "Left X", "good");
      const stRight = SDE.stat(refs.stats, "Right X", "warn");

      sim.onUpdate = (dt) => {
        if (flash > 0) flash -= dt;
        stMode(mode.toUpperCase() + (partitioned ? " · split" : " · ok"));
        stLeft(left.x); stRight(right.x);
      };

      sim.onDraw = (g) => {
        // left side
        g.fillStyle = "rgba(61,220,132,0.05)"; D.roundRect(g, 30, 60, 320, 180, 14); g.fill();
        D.node(g, { x: 70, y: 90, w: 110, h: 50, label: "Node 1", fill: "#10261a", stroke: C.good, labelColor: C.good });
        D.node(g, { x: 200, y: 90, w: 110, h: 50, label: "Node 2", fill: "#10261a", stroke: C.good, labelColor: C.good });
        D.text(g, "LEFT PARTITION   X = " + left.x, 190, 80, { color: C.good, size: 13, align: "center" });
        D.text(g, "✍ writes go here", 190, 165, { color: C.dim, size: 12, align: "center" });

        // right side
        g.fillStyle = "rgba(255,202,58,0.05)"; D.roundRect(g, 470, 60, 320, 180, 14); g.fill();
        D.node(g, { x: 510, y: 90, w: 110, h: 50, label: "Node 3", fill: "#2a2410", stroke: C.warn, labelColor: C.warn });
        D.node(g, { x: 640, y: 90, w: 110, h: 50, label: "Node 4", fill: "#2a2410", stroke: C.warn, labelColor: C.warn });
        D.text(g, "RIGHT PARTITION   X = " + right.x, 630, 80, { color: C.warn, size: 13, align: "center" });
        D.text(g, "👁 reads come here", 630, 165, { color: C.dim, size: 12, align: "center" });

        // link between
        if (partitioned) { D.text(g, "✂️", 410, 130, { size: 26, align: "center" }); D.line(g, 350, 120, 390, 120, "rgba(255,107,107,0.5)", 2, [5, 5]); D.line(g, 430, 120, 470, 120, "rgba(255,107,107,0.5)", 2, [5, 5]); D.text(g, "PARTITIONED", 410, 165, { color: C.bad, size: 11, align: "center" }); }
        else { D.arrow(g, 350, 120, 470, 120, C.good, 2); D.arrow(g, 470, 135, 350, 135, C.good, 2); D.text(g, "replicating", 410, 110, { color: C.good, size: 11, align: "center" }); }

        // read result
        const col = lastRead.includes("ERROR") ? C.bad : lastRead.includes("STALE") ? C.warn : C.good;
        g.globalAlpha = 0.7 + (flash > 0 ? 0.3 : 0);
        D.text(g, "Last read (right side): " + lastRead, 410, 270, { color: col, size: 14, align: "center" });
        g.globalAlpha = 1;
      };

      sim.start();
      return sim;
    },
  });
})(window);
