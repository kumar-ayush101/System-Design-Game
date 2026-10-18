/* Sessions — Area 4 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "sessions",
    title: "Sessions & Tokens",
    tagline: "How a server remembers you across stateless HTTP requests — and the revocation trade-off.",
    diagramNote: "Server-side sessions store state centrally; stateless tokens carry it in the request.",
    gameNote: "Log a user in with server sessions vs stateless JWTs across a load-balanced fleet. Then revoke access and see which approach can log them out instantly.",

    explanation: `
      <p>HTTP is <strong>stateless</strong> — each request stands alone, with no memory of the last. But apps need to remember "this is still Ada, logged in." The two ways to do that:</p>
      <h3>Server-side sessions</h3>
      <p>On login, the server creates a <strong>session record</strong> (in memory, Redis, or a DB) and sends the client a <strong>session ID</strong> in a cookie. Each request sends the cookie; the server looks up the session to recover who you are and your state. The ID is an opaque random string — meaningless without the server's store.</p>
      <h3>Stateless tokens (JWT)</h3>
      <p>Instead of storing state server-side, the server issues a <strong>signed token</strong> containing the claims (user id, role, expiry). The client sends it on every request; the server just verifies the signature — no lookup, no shared store. State lives in the token itself.</p>
      <h3>The core trade-off: revocation vs scale</h3>
      <ul>
        <li><strong>Sessions</strong> are instantly <strong>revocable</strong> — delete the record and the next request fails. But they require a shared session store accessible by every server behind the load balancer (otherwise a request routed to a different server can't find the session).</li>
        <li><strong>Tokens</strong> scale beautifully (any server can verify without coordination) but are hard to revoke early — a stolen token stays valid until it expires. Mitigations: short expiry + refresh tokens, or a denylist (which reintroduces server state).</li>
      </ul>
      <div class="callout"><span class="c-ico">🍪</span><div><h5>Cookie security matters either way</h5><p>Mark auth cookies <code>HttpOnly</code> (JS can't read them → defends against XSS theft), <code>Secure</code> (HTTPS only), and <code>SameSite</code> (defends against CSRF).</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 760, height: 250,
        nodes: [
          { id: "c", x: 40, y: 100, w: 110, h: 50, label: "Client", kind: "client" },
          { id: "s1", x: 300, y: 30, w: 130, h: 44, label: "Server 1", kind: "accent" },
          { id: "s2", x: 300, y: 100, w: 130, h: 44, label: "Server 2", kind: "accent" },
          { id: "s3", x: 300, y: 170, w: 130, h: 44, label: "Server 3", kind: "accent" },
          { id: "store", x: 560, y: 100, w: 150, h: 50, label: "Session store", kind: "purple", glow: true, caption: "shared (Redis)" },
        ],
        links: [
          { from: "c", to: "s1", accent: true }, { from: "c", to: "s2", accent: true }, { from: "c", to: "s3", accent: true },
          { from: "s1", to: "store", color: "#8b7bff" }, { from: "s2", to: "store", color: "#8b7bff" }, { from: "s3", to: "store", color: "#8b7bff", label: "lookup" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Compare the two. In SESSION mode, requests hit a shared store (revoke = instant logout). In JWT mode, each server verifies locally with no store (fast, but revoke doesn't take effect until expiry). Hit 'Revoke' and keep sending requests.",
        help: "Pick a strategy, send requests (round-robined across 3 servers), then Revoke and watch which keeps letting the user in.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 300 });

      let mode = "session";
      let loggedIn = false, revoked = false;
      let rr = 0, flyers = [];
      let allowed = 0, denied = 0;

      SDE.toolGroup(refs.toolbar, [
        { label: "Server sessions", value: "session" }, { label: "Stateless JWT", value: "jwt" },
      ], (v) => { mode = v; revoked = false; });

      SDE.button(refs.controls, "🔑 Log in", "primary", () => { loggedIn = true; revoked = false; SDE.toast("Logged in", "🔑"); });
      SDE.button(refs.controls, "📨 Send request", "", () => sendReq());
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "🚫 Revoke access", "danger", () => {
        revoked = true;
        SDE.toast(mode === "session" ? "Session deleted — next request fails instantly" : "Revoked, but JWT stays valid until expiry!", mode === "session" ? "✅" : "⚠️");
      });

      const stMode = SDE.stat(refs.stats, "Strategy");
      const stAllow = SDE.stat(refs.stats, "Allowed", "good");
      const stDeny = SDE.stat(refs.stats, "Denied", "bad");

      function sendReq() {
        if (!loggedIn) { SDE.toast("Log in first", "👆"); return; }
        const server = rr % 3; rr++;
        let ok;
        if (mode === "session") ok = !revoked; // shared store sees revocation
        else ok = true, (revoked ? (ok = true) : ok); // JWT: still valid even if revoked (until expiry)
        if (mode === "jwt" && revoked) ok = true; // demonstrates the gap
        if (ok) allowed++; else denied++;
        flyers.push({ server, t: 0, ok });
        stAllow(allowed); stDeny(denied);
      }

      sim.onUpdate = (dt) => {
        flyers.forEach((f) => (f.t += dt)); flyers = flyers.filter((f) => f.t < 1.2);
        stMode(mode === "session" ? "sessions (stateful)" : "JWT (stateless)");
      };

      sim.onDraw = (g) => {
        D.node(g, { x: 40, y: 120, w: 110, h: 54, label: "Client", sub: loggedIn ? "has cookie/token" : "not logged in", fill: "#161b2e", stroke: loggedIn ? C.good : C.dim, labelColor: C.text });
        const servers = [{ y: 40 }, { y: 120 }, { y: 200 }];
        servers.forEach((s, i) => {
          D.node(g, { x: 330, y: s.y, w: 140, h: 50, label: "Server " + (i + 1), fill: "#15223f", stroke: C.accent, labelColor: "#dbe8ff" });
          D.line(g, 150, 147, 330, s.y + 25, C.line, 1.3);
        });
        if (mode === "session") {
          D.node(g, { x: 600, y: 110, w: 160, h: 64, label: "Session store", sub: revoked ? "session DELETED" : (loggedIn ? "1 active session" : "empty"), fill: "#1d1838", stroke: revoked ? C.bad : C.purple, glow: 12, labelColor: C.purple, subColor: revoked ? C.bad : C.dim });
          servers.forEach((s) => D.line(g, 470, s.y + 25, 600, 142, "rgba(139,123,255,0.3)", 1.3));
          D.text(g, "every server checks the shared store → revoke is instant", 400, 285, { color: C.good, size: 12, align: "center" });
        } else {
          D.node(g, { x: 600, y: 110, w: 160, h: 64, label: "No store", sub: "verify locally", fill: "#0b0f1a", stroke: C.line, labelColor: C.faint });
          D.text(g, revoked ? "⚠ revoked, but token still verifies until expiry" : "each server verifies the signature itself — no store, no coordination", 400, 285, { color: revoked ? C.warn : C.teal, size: 12, align: "center" });
        }
        for (const f of flyers) {
          if (f.t > 1) continue;
          const sy = [40, 120, 200][f.server] + 25;
          const x = U.lerp(150, 330, f.t), y = U.lerp(147, sy, f.t);
          g.fillStyle = f.ok ? C.good : C.bad; g.shadowColor = f.ok ? C.good : C.bad; g.shadowBlur = 8;
          g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.shadowBlur = 0;
        }
      };

      sim.start();
      return sim;
    },
  });
})(window);
