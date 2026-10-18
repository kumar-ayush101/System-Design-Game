/* Load Balancing — Area 1 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "load-balancing",
    title: "Load Balancing",
    tagline: "Spread incoming traffic across many servers so no single one is overwhelmed.",
    diagramNote: "A load balancer fronts a pool of identical servers and routes each request to one of them.",
    gameNote: "You are the load balancer. Pick a strategy, watch requests flow, and kill servers to see how each strategy copes.",

    explanation: `
      <p>A <strong>load balancer</strong> sits in front of a group of servers and distributes incoming requests across them. From the outside it looks like one server; on the inside, many servers share the work.</p>
      <h3>Why it exists</h3>
      <p>A single server has a ceiling — a maximum number of requests per second before it slows down or falls over. Once you cross that ceiling, you have two options: get a bigger machine (<em>vertical scaling</em>, which has its own hard limit and is a single point of failure) or add more machines (<em>horizontal scaling</em>). Horizontal scaling only works if something decides which machine each request goes to. That something is the load balancer.</p>
      <h3>How requests get distributed</h3>
      <ul>
        <li><strong>Round robin</strong> — hand requests to servers in rotation: 1, 2, 3, 1, 2, 3… Simple and even, but ignores how busy each server actually is.</li>
        <li><strong>Least connections</strong> — send the next request to whichever server currently has the fewest active requests. Adapts to uneven request costs.</li>
        <li><strong>Random</strong> — pick a server at random. Surprisingly good at scale, with near-even distribution and no coordination.</li>
        <li><strong>IP hash / sticky</strong> — hash the client so the same client always lands on the same server. Needed when a server holds per-user state.</li>
      </ul>
      <h3>The health check — the real superpower</h3>
      <p>A load balancer continuously <strong>health-checks</strong> the servers behind it and stops routing traffic to any that fail. This automatic detection and rerouting is what makes a fleet resilient: one server dying reduces capacity slightly instead of causing an outage.</p>
      <div class="callout"><span class="c-ico">🧠</span><div><h5>Stateless servers make this work</h5><p>For round robin or random to be safe, servers must be <strong>stateless</strong> — they must not hold user-specific data between requests. If a server holds session state, requests must keep returning to the same server, which is why sticky sessions exist (and why they limit flexibility).</p></div></div>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>The trade-off</h5><p>The load balancer becomes a critical path — it must itself be highly available (usually run as a redundant pair) or it just moves your single point of failure.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 760, height: 300,
        nodes: [
          { id: "c1", x: 20, y: 40, w: 90, h: 40, label: "Client", kind: "client" },
          { id: "c2", x: 20, y: 110, w: 90, h: 40, label: "Client", kind: "client" },
          { id: "c3", x: 20, y: 180, w: 90, h: 40, label: "Client", kind: "client" },
          { id: "lb", x: 300, y: 108, w: 150, h: 56, label: "Load Balancer", kind: "accent", glow: true, caption: "health-checks the pool" },
          { id: "s1", x: 600, y: 20, w: 130, h: 44, label: "Server A", kind: "good" },
          { id: "s2", x: 600, y: 92, w: 130, h: 44, label: "Server B", kind: "good" },
          { id: "s3", x: 600, y: 164, w: 130, h: 44, label: "Server C", kind: "good" },
          { id: "s4", x: 600, y: 236, w: 130, h: 44, label: "Server D", kind: "bad" },
        ],
        links: [
          { from: "c1", to: "lb", accent: true }, { from: "c2", to: "lb", accent: true }, { from: "c3", to: "lb", accent: true },
          { from: "lb", to: "s1" }, { from: "lb", to: "s2" }, { from: "lb", to: "s3" },
          { from: "lb", to: "s4", dashed: true, color: "#ff6b6b", label: "down" },
        ],
        labels: [{ x: 665, y: 295, text: "✗ removed from rotation", color: "#ff6b6b", size: 11, align: "middle" }],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Keep all servers below their red line. Try each strategy, crank up the traffic, then <em>kill a server</em> and watch what happens to the rest.",
        help: "Click a server to kill/revive it. Pick a strategy above. Drag the traffic slider to change requests per second.",
      });

      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 360 });

      let strategy = "round";
      SDE.toolGroup(refs.toolbar, [
        { label: "Round Robin", value: "round" },
        { label: "Least Connections", value: "least" },
        { label: "Random", value: "random" },
        { label: "Sticky (IP hash)", value: "sticky" },
      ], (v) => { strategy = v; rr = 0; });

      // servers
      const N = 4;
      const servers = [];
      for (let i = 0; i < N; i++) {
        servers.push({
          x: 560, y: 40 + i * 78, w: 170, h: 56,
          load: 0, alive: true, cap: 10, handled: 0, label: "Server " + "ABCD"[i],
        });
      }
      const lb = { x: 250, y: 150, w: 150, h: 60 };
      const clientX = 40;

      let rr = 0;
      let packets = [];
      let rps = 6;
      let spawnAcc = 0;
      let dropped = 0, served = 0;

      // controls
      const slider = document.createElement("input");
      slider.type = "range"; slider.min = 1; slider.max = 30; slider.value = rps;
      slider.style.flex = "1"; slider.style.maxWidth = "220px";
      const lbl = document.createElement("span");
      lbl.className = "mono"; lbl.style.color = C.dim; lbl.textContent = rps + " req/s";
      slider.addEventListener("input", () => { rps = +slider.value; lbl.textContent = rps + " req/s"; });
      const wrapS = document.createElement("div"); wrapS.className = "flex center"; wrapS.style.gap = "10px";
      wrapS.appendChild(document.createTextNode("Traffic")); wrapS.appendChild(slider); wrapS.appendChild(lbl);
      refs.controls.appendChild(wrapS);
      const sp = document.createElement("div"); sp.className = "spacer"; refs.controls.appendChild(sp);
      SDE.button(refs.controls, "Reset", "", () => { packets = []; dropped = served = 0; servers.forEach(s => { s.load = 0; s.handled = 0; s.alive = true; }); });

      const stServed = SDE.stat(refs.stats, "Served", "good");
      const stDropped = SDE.stat(refs.stats, "Dropped", "bad");
      const stAlive = SDE.stat(refs.stats, "Servers up");
      const stBal = SDE.stat(refs.stats, "Max load", "warn");

      function aliveServers() { return servers.filter((s) => s.alive); }
      function pick(seed) {
        const up = aliveServers();
        if (!up.length) return null;
        if (strategy === "round") { const s = up[rr % up.length]; rr++; return s; }
        if (strategy === "least") { return up.reduce((a, b) => (b.load < a.load ? b : a)); }
        if (strategy === "random") { return U.choice(up); }
        if (strategy === "sticky") { return up[seed % up.length]; }
        return up[0];
      }

      sim.on("mousedown", (e) => {
        const p = sim.pointer(e);
        for (const s of servers) {
          if (D.pointInNode(p.x, p.y, s)) {
            s.alive = !s.alive;
            if (!s.alive) s.load = 0;
            SDE.toast(s.label + (s.alive ? " revived" : " killed"), s.alive ? "💚" : "💥");
          }
        }
      });

      sim.onUpdate = (dt) => {
        spawnAcc += dt * rps;
        while (spawnAcc >= 1) {
          spawnAcc -= 1;
          const seed = U.randInt(0, 999);
          const target = pick(seed);
          if (!target) { dropped++; continue; }
          const pk = new SDE.Packet({
            x: clientX, y: 180, tx: D.cx(lb), ty: D.cy(lb), dur: 0.5,
            color: C.accent, r: 4, data: { phase: 0, target, seed },
          });
          packets.push(pk);
        }

        for (const pk of packets) {
          pk.update(dt);
          if (pk.done && pk.data.phase === 0) {
            pk.data.phase = 1;
            const t = pk.data.target;
            if (!t.alive) { // server died mid-flight: reroute
              const nt = pick(pk.data.seed);
              if (!nt) { pk.data.phase = 99; dropped++; continue; }
              pk.data.target = nt;
            }
            pk.retarget(D.cx(pk.data.target), D.cy(pk.data.target), 0.5);
          } else if (pk.done && pk.data.phase === 1) {
            pk.data.phase = 2;
            const t = pk.data.target;
            if (t.load >= t.cap) { dropped++; }
            else { t.load++; t.handled++; served++; pk.data.servedBy = t; }
          }
        }
        packets = packets.filter((pk) => pk.data.phase < 2 || sim.time - (pk.data.doneAt || (pk.data.doneAt = sim.time)) < 0.1);

        // servers process their load over time
        for (const s of servers) {
          if (s.load > 0) {
            s._drain = (s._drain || 0) + dt * 5; // processing rate
            while (s._drain >= 1 && s.load > 0) { s._drain -= 1; s.load--; }
          }
        }

        stServed(served);
        stDropped(dropped);
        stAlive(aliveServers().length + "/" + N);
        const maxLoad = Math.max(0, ...aliveServers().map((s) => s.load));
        stBal(maxLoad);
      };

      sim.onDraw = (g) => {
        // client
        D.node(g, { x: clientX - 15, y: 150, w: 90, h: 60, label: "Clients", kind: "client", fill: "#161b2e", stroke: C.dim, color: C.dim });
        // lb
        D.node(g, { x: lb.x, y: lb.y, w: lb.w, h: lb.h, label: "Load\nBalancer", fill: "#15223f", stroke: C.accent, glow: 14, labelColor: "#dbe8ff" });
        D.text(g, strategy.toUpperCase(), lb.x + lb.w / 2, lb.y + lb.h + 16, { color: C.accent, size: 11, align: "center" });
        // links lb->servers
        for (const s of servers) {
          D.line(g, lb.x + lb.w, D.cy(lb), s.x, D.cy(s), s.alive ? C.line : "rgba(255,107,107,0.3)", 1.5, s.alive ? null : [5, 4]);
        }
        D.line(g, clientX + 75, 180, lb.x, D.cy(lb), C.line, 1.5);

        // servers with load bars
        for (const s of servers) {
          const ratio = s.load / s.cap;
          const col = !s.alive ? C.bad : ratio > 0.85 ? C.bad : ratio > 0.6 ? C.warn : C.good;
          D.node(g, { x: s.x, y: s.y, w: s.w, h: s.h, label: s.alive ? s.label : s.label + " ✗", fill: s.alive ? "#101522" : "#2a1414", stroke: col, labelColor: s.alive ? C.text : C.bad });
          // load bar
          const bx = s.x + 12, by = s.y + s.h - 14, bw = s.w - 24;
          g.fillStyle = "rgba(255,255,255,0.08)"; D.roundRect(g, bx, by, bw, 6, 3); g.fill();
          if (s.alive) {
            g.fillStyle = col; D.roundRect(g, bx, by, bw * U.clamp(ratio, 0, 1), 6, 3); g.fill();
          }
          // red line at capacity
          D.text(g, s.alive ? s.load + "/" + s.cap : "down", s.x + s.w - 12, s.y + 18, { color: C.dim, size: 11, align: "right", mono: true });
        }

        for (const pk of packets) if (pk.data.phase < 2) pk.draw(g);
      };

      sim.start();
      return sim;
    },
  });
})(window);
