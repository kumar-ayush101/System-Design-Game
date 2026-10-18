/* API Gateway — Area 5 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "api-gateway",
    title: "API Gateway",
    tagline: "One front door that handles auth, rate limiting, routing, and more for all your services.",
    diagramNote: "Clients hit the gateway; it applies cross-cutting concerns, then routes to the right backend service.",
    gameNote: "Route requests through a gateway. Toggle its features (auth, rate limit, routing) and watch bad requests get stopped before they ever reach your services.",

    explanation: `
      <p>An <strong>API gateway</strong> is a single entry point that sits in front of your backend services. Every client request goes through it first, and it handles the <strong>cross-cutting concerns</strong> that every service would otherwise have to implement itself.</p>
      <h3>What it centralizes</h3>
      <ul>
        <li><strong>Authentication</strong> — verify the token once at the edge; services trust the gateway.</li>
        <li><strong>Rate limiting</strong> — throttle abusive clients before they load your services.</li>
        <li><strong>Routing</strong> — map <code>/orders/*</code> to the orders service, <code>/users/*</code> to users; clients see one API.</li>
        <li><strong>TLS termination</strong> — decrypt HTTPS at the edge so internal services talk plain HTTP.</li>
        <li><strong>Request shaping</strong> — aggregation, response caching, header injection, protocol translation (REST↔gRPC).</li>
      </ul>
      <h3>Why centralize</h3>
      <p>Without a gateway, every one of your dozen services must implement auth, rate limiting, and TLS correctly — a dozen chances to get security wrong, and a dozen things to update when policy changes. With a gateway, these live in <em>one</em> well-tested place, and every service behind it gets them for free. It also decouples clients from your internal topology: you can split or rename a service without clients noticing.</p>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>The gateway is a critical path</h5><p>Because every request flows through it, the gateway must be highly available and fast, or it becomes a single point of failure and a bottleneck (run it as a redundant, horizontally-scaled fleet). Overloading it with heavy business logic is an anti-pattern — keep it to edge concerns. Related: a <em>reverse proxy</em> is the general tool; a load balancer and an API gateway are specialized reverse proxies.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 760, height: 250,
        nodes: [
          { id: "c", x: 30, y: 100, w: 110, h: 48, label: "Clients", kind: "client" },
          { id: "gw", x: 250, y: 70, w: 170, h: 110, label: "API Gateway", kind: "warn", glow: true, caption: "auth · rate limit · route · TLS" },
          { id: "s1", x: 560, y: 20, w: 150, h: 40, label: "Users svc", kind: "teal" },
          { id: "s2", x: 560, y: 95, w: 150, h: 40, label: "Orders svc", kind: "teal" },
          { id: "s3", x: 560, y: 170, w: 150, h: 40, label: "Payments svc", kind: "teal" },
        ],
        links: [
          { from: "c", to: "gw", accent: true }, { from: "gw", to: "s1", color: "#39d0d8" },
          { from: "gw", to: "s2", color: "#39d0d8" }, { from: "gw", to: "s3", color: "#39d0d8" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Protect your services at the edge. Mixed traffic arrives — some unauthenticated, some abusive, some fine. Toggle the gateway's filters and watch bad requests get rejected <em>before</em> reaching any service.",
        help: "Toggle Auth and Rate-limit on the gateway. Watch which packets are stopped (red) vs routed (green).",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      let authOn = true, rlOn = true;
      let packets = [], acc = 0;
      let routed = 0, blockedAuth = 0, blockedRl = 0;
      let rlBucket = 8, rlMax = 8;

      const authBtn = SDE.button(refs.controls, "Auth: ON", "active", () => { authOn = !authOn; authBtn.classList.toggle("active", authOn); authBtn.textContent = "Auth: " + (authOn ? "ON" : "OFF"); });
      const rlBtn = SDE.button(refs.controls, "Rate limit: ON", "active", () => { rlOn = !rlOn; rlBtn.classList.toggle("active", rlOn); rlBtn.textContent = "Rate limit: " + (rlOn ? "ON" : "OFF"); });

      const stRouted = SDE.stat(refs.stats, "Routed", "good");
      const stAuth = SDE.stat(refs.stats, "Blocked: 401", "bad");
      const stRl = SDE.stat(refs.stats, "Blocked: 429", "warn");

      const services = ["Users", "Orders", "Payments"];
      sim.onUpdate = (dt) => {
        rlBucket = Math.min(rlMax, rlBucket + dt * 4);
        acc += dt;
        if (acc > 0.18) {
          acc = 0;
          const kind = U.choice(["ok", "ok", "ok", "noauth", "flood", "flood"]);
          packets.push({ t: 0, kind, svc: U.randInt(0, 2), phase: 0, verdict: null });
        }
        for (const p of packets) {
          p.t += dt;
          if (p.phase === 0 && p.t > 0.4) {
            // reached gateway — decide
            p.phase = 1; p.t = 0;
            if (authOn && p.kind === "noauth") { p.verdict = "401"; blockedAuth++; }
            else if (rlOn && (p.kind === "flood") && rlBucket < 1) { p.verdict = "429"; blockedRl++; }
            else { if (p.kind === "flood") rlBucket = Math.max(0, rlBucket - 1); p.verdict = "ok"; }
          } else if (p.phase === 1 && p.t > 0.4) { if (p.verdict === "ok" && !p.counted) { p.counted = true; routed++; } p.phase = 2; }
        }
        packets = packets.filter((p) => p.t < 1 || p.phase < 2);
        packets = packets.filter((p) => !(p.phase === 2 && p.t > 0.6));
        stRouted(routed); stAuth(blockedAuth); stRl(blockedRl);
      };

      sim.onDraw = (g) => {
        D.node(g, { x: 30, y: 130, w: 100, h: 50, label: "Clients", fill: "#161b2e", stroke: C.dim, labelColor: C.text });
        D.node(g, { x: 300, y: 100, w: 170, h: 110, label: "API GATEWAY", sub: "", fill: "#2a2410", stroke: C.warn, glow: 14, labelColor: C.warn });
        D.text(g, (authOn ? "🔐 auth ON" : "🔓 auth off"), 385, 150, { color: authOn ? C.good : C.faint, size: 12, align: "center" });
        D.text(g, (rlOn ? "🪣 rate-limit ON" : "rate-limit off"), 385, 170, { color: rlOn ? C.good : C.faint, size: 12, align: "center" });
        D.text(g, "bucket " + Math.floor(rlBucket) + "/" + rlMax, 385, 190, { color: C.dim, size: 11, align: "center" });

        services.forEach((s, i) => {
          D.node(g, { x: 620, y: 40 + i * 80, w: 150, h: 48, label: s + " svc", fill: "#0f2a2d", stroke: C.teal, labelColor: "#cdf7f9" });
          D.line(g, 470, 155, 620, 64 + i * 80, "rgba(57,208,216,0.25)", 1.4);
        });

        for (const p of packets) {
          let x, y = 155, col = C.accent;
          if (p.phase === 0) x = U.lerp(130, 300, Math.min(1, p.t / 0.4));
          else if (p.phase === 1) {
            if (p.verdict === "ok") { x = U.lerp(470, 620, Math.min(1, p.t / 0.4)); y = U.lerp(155, 64 + p.svc * 80, Math.min(1, p.t / 0.4)); col = C.good; }
            else { x = 385; y = 155 + p.t * 60; col = p.verdict === "401" ? C.bad : C.warn; }
          } else { x = p.verdict === "ok" ? 650 : 385; }
          if (p.kind === "noauth") col = p.phase >= 1 ? col : C.bad;
          g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 7;
          g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.shadowBlur = 0;
          if (p.phase >= 1 && p.verdict && p.verdict !== "ok") D.text(g, p.verdict, x + 12, y + 4, { color: col, size: 11, mono: true });
        }
        D.text(g, "🟢 authed/ok   🔴 unauthenticated → 401   🟡 flood → 429", 30, 300, { color: C.faint, size: 11 });
      };

      sim.start();
      return sim;
    },
  });
})(window);
