/* Authorization — Area 4 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "authorization",
    title: "Authorization",
    tagline: "Deciding what an authenticated identity is allowed to do.",
    diagramNote: "After authentication, a policy check gates each action against the user's permissions.",
    gameNote: "Pick an identity, then try actions. The authorization layer allows or denies each based on policy — see least privilege in action.",

    explanation: `
      <p><strong>Authorization</strong> (authZ) answers "<em>what are you allowed to do?</em>" It happens <em>after</em> authentication: first the system knows <em>who</em> you are, then it decides <em>whether</em> you may perform a given action on a given resource.</p>
      <h3>Authentication vs authorization</h3>
      <p>They're constantly confused. Authentication is showing your ID at the door; authorization is whether that ID gets you into the VIP room. A valid login does <strong>not</strong> mean you can do everything — a logged-in user still can't delete another user's account.</p>
      <h3>Models of authorization</h3>
      <ul>
        <li><strong>ACL (access control list)</strong> — each resource lists who can do what. Fine-grained but hard to manage at scale.</li>
        <li><strong>RBAC (role-based)</strong> — users get roles; roles carry permissions. The dominant model (its own concept here).</li>
        <li><strong>ABAC (attribute-based)</strong> — decisions use attributes/context: "a manager may approve expenses <em>in their own department under $5k</em>." Most flexible, most complex.</li>
      </ul>
      <h3>Principle of least privilege</h3>
      <p>Grant each identity the <em>minimum</em> permissions it needs — nothing more. If the analytics service only reads data, it should have no write or delete rights. This caps the blast radius if that identity is ever compromised.</p>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>Enforce on the server, always</h5><p>Hiding a button in the UI is not authorization — it's a hint. The real check must happen on the server for every request, because a malicious client can call the API directly. "Deny by default" (reject anything not explicitly allowed) is the safe posture.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 220,
        nodes: [
          { id: "req", x: 40, y: 85, w: 150, h: 54, label: "Request\n(authenticated)", kind: "accent" },
          { id: "policy", x: 300, y: 80, w: 150, h: 64, label: "Policy check", kind: "warn", glow: true, caption: "deny by default" },
          { id: "allow", x: 560, y: 30, w: 150, h: 44, label: "✓ Allowed", kind: "good" },
          { id: "deny", x: 560, y: 140, w: 150, h: 44, label: "✗ 403 Forbidden", kind: "bad" },
        ],
        links: [
          { from: "req", to: "policy", accent: true },
          { from: "policy", to: "allow", color: "#3ddc84" }, { from: "policy", to: "deny", color: "#ff6b6b" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> See least privilege enforced. Choose an identity, then attempt actions. The server checks each against policy and allows or returns 403. Notice how 'guest' and the read-only service are tightly scoped.",
        help: "Pick an identity above, then click actions below to see allow/deny decisions.",
      });
      refs.canvas.parentElement.style.display = "none";
      const panel = document.createElement("div");
      refs.shell.appendChild(panel);

      const policy = {
        admin: ["read", "write", "delete", "manage_users"],
        editor: ["read", "write"],
        guest: ["read"],
        analytics_svc: ["read"],
      };
      let identity = "guest";
      let allowed = 0, denied = 0;

      SDE.toolGroup(refs.toolbar, [
        { label: "👤 guest", value: "guest" }, { label: "✍️ editor", value: "editor" },
        { label: "🛡️ admin", value: "admin" }, { label: "🤖 analytics_svc", value: "analytics_svc" },
      ], (v) => { identity = v; renderPerms(); });

      const stId = SDE.stat(refs.stats, "Identity");
      const stAllow = SDE.stat(refs.stats, "Allowed", "good");
      const stDeny = SDE.stat(refs.stats, "Denied (403)", "bad");

      const actions = [
        { k: "read", l: "📖 Read a document" },
        { k: "write", l: "✏️ Edit a document" },
        { k: "delete", l: "🗑️ Delete a document" },
        { k: "manage_users", l: "👥 Manage users" },
      ];

      panel.innerHTML = `
        <div class="kv-card" style="margin-bottom:14px"><h5>Permissions for this identity</h5><div id="azPerms" style="font-family:var(--mono);font-size:13px;color:#9ec3ff"></div></div>
        <div id="azActions" style="display:flex;gap:10px;flex-wrap:wrap"></div>
        <div id="azLog" style="margin-top:16px;font-family:var(--mono);font-size:13px;min-height:60px"></div>`;

      actions.forEach((a) => {
        const b = document.createElement("button"); b.className = "gbtn"; b.textContent = a.l;
        b.onclick = () => attempt(a.k, a.l); panel.querySelector("#azActions").appendChild(b);
      });

      let logLines = [];
      function attempt(action, label) {
        const ok = policy[identity].includes(action);
        if (ok) allowed++; else denied++;
        logLines.unshift((ok ? '<span style="color:#8fe3b0">✓ 200</span> ' : '<span style="color:#ff9a9a">✗ 403 Forbidden</span> ') + identity + " → " + label);
        logLines = logLines.slice(0, 6);
        panel.querySelector("#azLog").innerHTML = logLines.join("<br>");
        stAllow(allowed); stDeny(denied);
        SDE.toast(ok ? "Allowed" : "Denied — least privilege", ok ? "✅" : "🚫");
      }
      function renderPerms() {
        panel.querySelector("#azPerms").textContent = policy[identity].join("  ·  ") || "(none)";
        stId(identity);
      }
      renderPerms(); stAllow(0); stDeny(0);
      return { destroy() {} };
    },
  });
})(window);
