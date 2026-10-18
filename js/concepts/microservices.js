/* Microservices — Area 5 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "microservices",
    title: "Microservices",
    tagline: "Independent services, each owning one capability, deployable and scalable on their own.",
    diagramNote: "Each service is its own process with its own database, communicating over the network.",
    gameNote: "Run the same shop as separate services. Scale a hot service independently, and crash one — the others keep serving. See the cost: network hops.",

    explanation: `
      <p><strong>Microservices</strong> split an application into many small, independently deployable services, each owning a single business capability (users, orders, payments) with its <em>own</em> database. They communicate over the network — REST, gRPC, or async messages.</p>
      <h3>What you gain</h3>
      <ul>
        <li><strong>Independent scaling</strong> — scale only the hot service. If image-processing needs 20 instances but auth needs 2, you pay for exactly that.</li>
        <li><strong>Fault isolation</strong> — a crash in one service doesn't take down the others (if you design for it with timeouts and circuit breakers). The blast radius shrinks.</li>
        <li><strong>Independent deploys & teams</strong> — each team owns its service end-to-end and ships on its own schedule without coordinating a giant release.</li>
        <li><strong>Tech flexibility</strong> — one service can be Go, another Python, chosen per job.</li>
      </ul>
      <h3>What you pay</h3>
      <ul>
        <li><strong>Network everywhere</strong> — in-process function calls become network calls: slower, and they can fail, time out, or arrive out of order. You must design for partial failure.</li>
        <li><strong>Distributed data</strong> — no cross-service ACID transaction. You need sagas, eventual consistency, and idempotency.</li>
        <li><strong>Operational complexity</strong> — many deployables need service discovery, centralized logging, tracing, and orchestration (Kubernetes). The complexity doesn't vanish; it moves from the code into the infrastructure.</li>
      </ul>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>Not a free upgrade</h5><p>Microservices trade <em>code complexity</em> for <em>operational complexity</em>. They pay off when you have multiple teams, genuinely different scaling needs, and the platform maturity to run them. For a small team on a young product, they often slow you down. Earn your way into them.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 760, height: 260,
        nodes: [
          { id: "gw", x: 40, y: 105, w: 110, h: 48, label: "Gateway", kind: "accent" },
          { id: "u", x: 260, y: 20, w: 130, h: 42, label: "Users svc", kind: "teal" },
          { id: "ud", x: 440, y: 20, w: 90, h: 42, label: "DB", kind: "purple" },
          { id: "o", x: 260, y: 105, w: 130, h: 42, label: "Orders svc", kind: "teal" },
          { id: "od", x: 440, y: 105, w: 90, h: 42, label: "DB", kind: "purple" },
          { id: "p", x: 260, y: 190, w: 130, h: 42, label: "Payments svc", kind: "teal" },
          { id: "pd", x: 440, y: 190, w: 90, h: 42, label: "DB", kind: "purple" },
        ],
        links: [
          { from: "gw", to: "u", accent: true }, { from: "gw", to: "o", accent: true }, { from: "gw", to: "p", accent: true },
          { from: "u", to: "ud" }, { from: "o", to: "od" }, { from: "p", to: "pd" },
        ],
        labels: [{ x: 620, y: 130, text: "each service owns its data", color: "#9aa6c2", size: 12 }],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Compare with the monolith. Scale the hot 'Payments' service up independently, and crash 'Orders' — notice Users and Payments keep serving (fault isolation). The cost: every call is a network hop.",
        help: "Use +/- to scale each service. Click a service to crash/revive it. Watch which requests still succeed.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      const svcs = [
        { name: "Users", y: 40, instances: 1, ok: true, load: 0 },
        { name: "Orders", y: 130, instances: 1, ok: true, load: 0 },
        { name: "Payments", y: 220, instances: 1, ok: true, load: 0 },
      ];
      svcs.forEach((s) => { s.x = 420; s.w = 180; s.h = 56; });
      let packets = [], acc = 0, served = 0, failed = 0;

      svcs.forEach((s, i) => {
        const wrap = document.createElement("div"); wrap.className = "flex center"; wrap.style.gap = "4px";
        const out = document.createElement("span"); out.className = "mono"; out.style.color = C.dim; out.style.minWidth = "70px";
        const minus = document.createElement("button"); minus.className = "gbtn"; minus.textContent = "−";
        const plus = document.createElement("button"); plus.className = "gbtn"; plus.textContent = "+";
        const upd = () => out.textContent = s.name + " ×" + s.instances;
        minus.onclick = () => { s.instances = Math.max(1, s.instances - 1); upd(); };
        plus.onclick = () => { s.instances = Math.min(6, s.instances + 1); upd(); };
        wrap.appendChild(minus); wrap.appendChild(out); wrap.appendChild(plus);
        refs.controls.appendChild(wrap); upd();
      });

      const stServed = SDE.stat(refs.stats, "Served", "good");
      const stFailed = SDE.stat(refs.stats, "Failed", "bad");
      const stInst = SDE.stat(refs.stats, "Total instances");

      sim.on("mousedown", (e) => {
        const p = sim.pointer(e);
        for (const s of svcs) if (D.pointInNode(p.x, p.y, s)) { s.ok = !s.ok; SDE.toast(s.name + (s.ok ? " revived" : " crashed — others unaffected"), s.ok ? "💚" : "💥"); }
      });

      sim.onUpdate = (dt) => {
        acc += dt;
        if (acc > 0.2) { acc = 0; const idx = U.randInt(0, 2); packets.push({ t: 0, svc: svcs[idx] }); }
        for (const p of packets) {
          p.t += dt;
          if (p.t > 0.6 && !p.counted) { p.counted = true; if (p.svc.ok) { served++; p.svc.load = Math.min(1, p.svc.load + 0.15 / p.svc.instances); } else failed++; }
        }
        packets = packets.filter((p) => p.t < 1.2);
        svcs.forEach((s) => s.load = Math.max(0, s.load - dt * 0.3));
        stServed(served); stFailed(failed); stInst(svcs.reduce((a, s) => a + s.instances, 0));
      };

      sim.onDraw = (g) => {
        D.node(g, { x: 40, y: 130, w: 110, h: 54, label: "Gateway", fill: "#15223f", stroke: C.accent, labelColor: "#dbe8ff" });
        for (const s of svcs) {
          const col = !s.ok ? C.bad : s.load > 0.7 ? C.warn : C.teal;
          // draw instance stack
          for (let i = s.instances - 1; i >= 0; i--) {
            D.node(g, { x: s.x + i * 10, y: s.y - i * 6, w: s.w, h: s.h, label: i === 0 ? (s.name + (s.ok ? "" : " ✗")) : "", sub: i === 0 ? "×" + s.instances + " instances" : "", fill: s.ok ? "#0f2a2d" : "#2a1414", stroke: col, labelColor: s.ok ? "#cdf7f9" : C.bad, subColor: C.dim, fontSize: 13 });
          }
          D.line(g, 150, 157, s.x, s.y + s.h / 2, s.ok ? "rgba(57,208,216,0.3)" : "rgba(255,107,107,0.25)", 1.5, s.ok ? null : [4, 4]);
          // own DB
          D.node(g, { x: s.x + s.w + 30, y: s.y + 6, w: 70, h: 40, label: "DB", fill: "#1d1838", stroke: C.purple, labelColor: C.purple, fontSize: 12, r: 7 });
        }
        for (const p of packets) {
          if (p.t > 1) continue;
          const x = U.lerp(150, p.svc.x, Math.min(1, p.t / 0.6));
          g.fillStyle = p.svc.ok ? C.teal : C.bad; g.shadowColor = g.fillStyle; g.shadowBlur = 7;
          g.beginPath(); g.arc(x, 157, 5, 0, 7); g.fill(); g.shadowBlur = 0;
        }
        D.text(g, "click a service to crash it — the others keep running (fault isolation)", 40, 300, { color: C.faint, size: 12 });
      };

      sim.start();
      return sim;
    },
  });
})(window);
