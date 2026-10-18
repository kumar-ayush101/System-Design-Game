/* Replication — Area 1 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "replication",
    title: "Replication",
    tagline: "Keep copies of your data on multiple machines for read scale and redundancy.",
    diagramNote: "Leader-follower: one primary takes writes; replicas copy it and serve reads.",
    gameNote: "Send writes to the leader and watch them propagate to followers. Speed up writes or slow the network to see replication lag — and stale reads.",

    explanation: `
      <p><strong>Replication</strong> keeps copies of data on multiple machines. The most common pattern is <strong>leader-follower</strong> (also called primary-replica): one node handles all writes, and follower nodes hold copies that serve reads.</p>
      <h3>Why it exists</h3>
      <ul>
        <li><strong>Read scaling</strong> — most systems read far more than they write. Followers absorb read traffic so the leader isn't the bottleneck.</li>
        <li><strong>Redundancy</strong> — if the leader dies, a follower can be promoted to take over (failover).</li>
        <li><strong>Geography</strong> — put replicas near users to cut read latency.</li>
      </ul>
      <h3>The subtlety: replication lag</h3>
      <p>When you write to the leader, the followers don't update instantly. There's a delay — <strong>replication lag</strong> — while the change travels across the network and is applied. During that window, a read from a follower returns <em>stale</em> data: the old value, as if your write never happened.</p>
      <p>This is usually fine (a like count being a second out of date hurts nobody) but must be handled deliberately when a read must reflect a recent write — for example, a user who just edited their profile and immediately reloads it. Common fixes: <strong>read-your-writes</strong> consistency (route that user's reads to the leader briefly) or waiting for the replica to catch up.</p>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>Sync vs async replication</h5><p><strong>Async</strong> (acknowledge the write before replicas confirm) is fast but can lose recently-written data if the leader dies before replicating. <strong>Sync</strong> (wait for replicas) is durable but slower and stalls if a replica is down. Most systems use async with one sync replica as a compromise.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 280,
        nodes: [
          { id: "w", x: 30, y: 40, w: 110, h: 44, label: "Writer", kind: "accent" },
          { id: "r1", x: 30, y: 140, w: 110, h: 44, label: "Reader", kind: "client" },
          { id: "r2", x: 30, y: 200, w: 110, h: 44, label: "Reader", kind: "client" },
          { id: "lead", x: 300, y: 110, w: 150, h: 60, label: "Leader\n(writes)", kind: "purple", glow: true },
          { id: "f1", x: 580, y: 30, w: 130, h: 48, label: "Follower", kind: "teal" },
          { id: "f2", x: 580, y: 116, w: 130, h: 48, label: "Follower", kind: "teal" },
          { id: "f3", x: 580, y: 202, w: 130, h: 48, label: "Follower", kind: "teal" },
        ],
        links: [
          { from: "w", to: "lead", accent: true, label: "write" },
          { from: "lead", to: "f1", color: "#39d0d8", label: "replicate" },
          { from: "lead", to: "f2", color: "#39d0d8" },
          { from: "lead", to: "f3", color: "#39d0d8" },
          { from: "r1", to: "f2", dashed: true, label: "read" },
          { from: "r2", to: "f3", dashed: true, label: "read" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> See replication lag with your own eyes. The leader's value is the truth. Followers chase it across the network — the gap between them is stale data a reader could see.",
        help: "Click 'Write' (or hold auto-write) to increment the leader. Adjust network delay. Watch followers lag behind, then catch up.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      const leader = { x: 320, y: 120, w: 160, h: 70, val: 0 };
      const followers = [
        { x: 640, y: 30, w: 150, h: 56, val: 0, label: "Follower 1" },
        { x: 640, y: 120, w: 150, h: 56, val: 0, label: "Follower 2" },
        { x: 640, y: 210, w: 150, h: 56, val: 0, label: "Follower 3" },
      ];
      let pending = []; // {toVal, follower, arriveAt, from}
      let lag = 1.2;
      let auto = false, autoAcc = 0;

      SDE.button(refs.controls, "✍ Write (+1)", "primary", doWrite);
      const autoBtn = SDE.button(refs.controls, "▶ Auto-write", "", () => {
        auto = !auto; autoBtn.classList.toggle("active", auto);
        autoBtn.innerHTML = auto ? "⏸ Stop auto" : "▶ Auto-write";
      });
      const slider = document.createElement("input");
      slider.type = "range"; slider.min = 2; slider.max = 40; slider.value = lag * 10;
      const sl = document.createElement("span"); sl.className = "mono"; sl.style.color = C.dim; sl.textContent = lag.toFixed(1) + "s delay";
      slider.addEventListener("input", () => { lag = +slider.value / 10; sl.textContent = lag.toFixed(1) + "s delay"; });
      const w = document.createElement("div"); w.className = "flex center"; w.style.gap = "10px"; w.style.marginLeft = "auto";
      w.appendChild(document.createTextNode("Network")); w.appendChild(slider); w.appendChild(sl);
      refs.controls.appendChild(w);

      const stLeader = SDE.stat(refs.stats, "Leader value", "good");
      const stLag = SDE.stat(refs.stats, "Max lag", "warn");
      const stInflight = SDE.stat(refs.stats, "In-flight");

      function doWrite() {
        leader.val++;
        for (const f of followers) {
          const jitter = lag * (0.8 + Math.random() * 0.6);
          pending.push({ toVal: leader.val, follower: f, arriveAt: sim.time + jitter, startAt: sim.time });
        }
      }

      sim.onUpdate = (dt) => {
        if (auto) { autoAcc += dt; if (autoAcc > 0.6) { autoAcc = 0; doWrite(); } }
        pending = pending.filter((p) => {
          if (sim.time >= p.arriveAt) { if (p.toVal > p.follower.val) p.follower.val = p.toVal; return false; }
          return true;
        });
        stLeader(leader.val);
        const maxLag = Math.max(0, ...followers.map((f) => leader.val - f.val));
        stLag(maxLag + (maxLag ? " behind" : ""));
        stInflight(pending.length);
      };

      sim.onDraw = (g) => {
        D.node(g, { x: leader.x, y: leader.y, w: leader.w, h: leader.h, label: "LEADER", sub: "handles all writes", fill: "#1d1838", stroke: C.purple, glow: 14, labelColor: "#e2dcff" });
        D.text(g, String(leader.val), leader.x + leader.w / 2, leader.y + leader.h - 20, { color: C.good, size: 24, align: "center", mono: true });

        for (const f of followers) {
          const stale = leader.val - f.val;
          const col = stale > 0 ? C.warn : C.teal;
          D.node(g, { x: f.x, y: f.y, w: f.w, h: f.h, label: f.label, fill: "#0f2a2d", stroke: col, labelColor: "#cdf7f9" });
          D.text(g, String(f.val), f.x + f.w / 2, f.y + f.h - 14, { color: stale > 0 ? C.warn : C.good, size: 20, align: "center", mono: true });
          if (stale > 0) D.text(g, "stale −" + stale, f.x + f.w - 8, f.y + 16, { color: C.warn, size: 11, align: "right" });
          D.line(g, leader.x + leader.w, D.cy(leader), f.x, D.cy(f), "rgba(57,208,216,0.3)", 1.5);
        }

        // in-flight replication packets
        for (const p of pending) {
          const t = U.clamp((sim.time - p.startAt) / (p.arriveAt - p.startAt), 0, 1);
          const x = U.lerp(leader.x + leader.w, p.follower.x, t);
          const y = U.lerp(D.cy(leader), D.cy(p.follower), t);
          g.fillStyle = C.teal; g.shadowColor = C.teal; g.shadowBlur = 8;
          g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.shadowBlur = 0;
        }
        D.text(g, "Writer", 60, 170, { color: C.dim, size: 13 });
        D.arrow(g, 110, 170, leader.x, D.cy(leader), C.accent, 2);
      };

      sim.start();
      return sim;
    },
  });
})(window);
