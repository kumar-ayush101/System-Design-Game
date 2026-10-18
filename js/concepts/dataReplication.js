/* Database Replication (sync/async + failover) — Area 3 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "data-replication",
    title: "Database Replication & Failover",
    tagline: "Synchronous vs asynchronous copies, and what happens when the primary dies.",
    diagramNote: "A primary replicates to replicas; on failure, a replica is promoted to take over.",
    gameNote: "Choose sync or async replication, then kill the primary. See the trade-off: async may lose the last writes; sync is safe but slower.",

    explanation: `
      <p>You met replication in Area 1 (copies for read-scale and redundancy). Here we zoom into the two choices that define a database's durability guarantees: <strong>how</strong> writes replicate, and what happens on <strong>failover</strong>.</p>
      <h3>Synchronous vs asynchronous</h3>
      <ul>
        <li><strong>Asynchronous</strong> — the primary acknowledges the write to the client <em>immediately</em>, then streams it to replicas in the background. Fast, but if the primary crashes before a write reaches any replica, that write is <strong>lost</strong>.</li>
        <li><strong>Synchronous</strong> — the primary waits for at least one replica to confirm before acknowledging. No acknowledged write is ever lost, but every write pays the round-trip latency, and if the replica is slow or down, writes stall.</li>
      </ul>
      <p>The common compromise is <strong>semi-synchronous</strong>: one synchronous replica (for safety) plus several asynchronous ones (for read-scale).</p>
      <h3>Failover</h3>
      <p>When the primary dies, a replica must be <strong>promoted</strong> to become the new primary. This window — detect the failure, elect/promote a replica, redirect clients — is a period of reduced availability. Automatic failover is fast but risks <strong>split-brain</strong> (two nodes think they're primary) if not coordinated by consensus. With async replication, failover can also lose the writes that hadn't yet replicated.</p>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>Durability vs latency vs availability</h5><p>You can't maximize all three. Sync buys durability at the cost of latency and write-availability (a down replica blocks writes). Async buys latency and availability at the risk of data loss on failover. The right call depends on whether losing the last few milliseconds of writes is acceptable — for a chat app, maybe; for payments, never.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 240,
        nodes: [
          { id: "cli", x: 30, y: 95, w: 110, h: 46, label: "Client", kind: "client" },
          { id: "pri", x: 270, y: 90, w: 150, h: 58, label: "Primary", kind: "purple", glow: true },
          { id: "sync", x: 560, y: 20, w: 150, h: 46, label: "Sync replica", kind: "good", caption: "confirms before ack" },
          { id: "async", x: 560, y: 100, w: 150, h: 46, label: "Async replica", kind: "warn", caption: "lags behind" },
          { id: "async2", x: 560, y: 170, w: 150, h: 46, label: "Async replica", kind: "warn" },
        ],
        links: [
          { from: "cli", to: "pri", accent: true, label: "write" },
          { from: "pri", to: "sync", color: "#3ddc84", bidir: true, label: "sync" },
          { from: "pri", to: "async", color: "#ffca3a", label: "async" },
          { from: "pri", to: "async2", color: "#ffca3a" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Experience the durability trade-off. Stream writes, then kill the primary. In ASYNC mode, any writes that hadn't replicated yet are lost after failover. In SYNC mode they're safe — but notice writes are slower.",
        help: "Pick sync/async, let writes flow, then click 'Kill primary'. Compare the promoted replica's value to what the client thought it wrote.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 300 });

      let mode = "async";
      let primaryVal = 0, clientAck = 0;
      let replicas = [{ val: 0, lag: 0.3, label: "Replica 1" }, { val: 0, lag: 0.9, label: "Replica 2" }];
      let primaryAlive = true;
      let pending = []; // async writes in flight
      let acc = 0, lost = 0, promoted = null;

      SDE.toolGroup(refs.toolbar, [
        { label: "Asynchronous (fast)", value: "async" }, { label: "Synchronous (safe)", value: "sync" },
      ], (v) => { mode = v; });

      const killBtn = SDE.button(refs.controls, "💥 Kill primary", "danger", () => {
        if (!primaryAlive) return;
        primaryAlive = false;
        // promote the most up-to-date replica
        promoted = replicas.reduce((a, b) => (b.val > a.val ? b : a));
        lost = clientAck - promoted.val;
        SDE.toast(lost > 0 ? "Failover! " + lost + " acknowledged write(s) LOST" : "Failover clean — no data lost", lost > 0 ? "⚠️" : "✅");
      });
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "Restart", "", () => { primaryVal = clientAck = 0; replicas.forEach(r => r.val = 0); primaryAlive = true; pending = []; lost = 0; promoted = null; });

      const stAck = SDE.stat(refs.stats, "Client acked", "good");
      const stPrimary = SDE.stat(refs.stats, "Primary");
      const stLost = SDE.stat(refs.stats, "Writes lost", "bad");

      sim.onUpdate = (dt) => {
        if (primaryAlive) {
          acc += dt;
          const interval = mode === "sync" ? 0.7 : 0.35; // sync is slower
          if (acc > interval) {
            acc = 0; primaryVal++;
            if (mode === "sync") { clientAck = primaryVal; replicas[0].val = primaryVal; pending.push({ v: primaryVal, r: replicas[1], at: sim.time + replicas[1].lag }); }
            else { clientAck = primaryVal; replicas.forEach((r) => pending.push({ v: primaryVal, r, at: sim.time + r.lag })); }
          }
        }
        pending = pending.filter((p) => { if (sim.time >= p.at) { if (p.v > p.r.val) p.r.val = p.v; return false; } return true; });
        stAck(clientAck);
        stPrimary(primaryAlive ? primaryVal : "DEAD → " + (promoted ? promoted.label : "?"));
        stLost(lost);
      };

      sim.onDraw = (g) => {
        D.node(g, { x: 30, y: 120, w: 110, h: 50, label: "Client", sub: "acked: " + clientAck, fill: "#161b2e", stroke: C.dim, labelColor: C.text });
        // primary
        const pcol = primaryAlive ? C.purple : C.bad;
        D.node(g, { x: 260, y: 110, w: 160, h: 70, label: primaryAlive ? "PRIMARY" : "PRIMARY ✗ dead", sub: primaryAlive ? "val " + primaryVal : "", fill: primaryAlive ? "#1d1838" : "#2a1414", stroke: pcol, glow: primaryAlive ? 12 : 0, labelColor: pcol });
        D.arrow(g, 140, 145, 260, 145, C.accent, 2);

        replicas.forEach((r, i) => {
          const isPromoted = promoted === r;
          const col = isPromoted ? C.good : C.warn;
          D.node(g, { x: 600, y: 40 + i * 100, w: 170, h: 60, label: r.label + (isPromoted ? " ★ NEW PRIMARY" : ""), sub: "val " + r.val, fill: isPromoted ? "#10261a" : "#2a2410", stroke: col, labelColor: col, subColor: C.text, fontSize: 13 });
          D.line(g, 420, 145, 600, 70 + i * 100, primaryAlive ? (mode === "sync" && i === 0 ? "rgba(61,220,132,0.4)" : "rgba(255,202,58,0.3)") : "rgba(90,100,127,0.2)", 1.6, primaryAlive ? null : [4, 4]);
        });
        D.text(g, "Mode: " + (mode === "sync" ? "🔒 SYNC — safe, slower" : "⚡ ASYNC — fast, can lose writes"), 410, 250, { color: mode === "sync" ? C.good : C.warn, size: 14, align: "center" });
        if (lost > 0) D.text(g, "💥 " + lost + " acknowledged write(s) lost on failover", 410, 275, { color: C.bad, size: 13, align: "center" });
      };

      sim.start();
      return sim;
    },
  });
})(window);
