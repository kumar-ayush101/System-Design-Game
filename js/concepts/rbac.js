/* RBAC — Area 4 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const C = SDE.COLORS;

  SDE.register({
    id: "rbac",
    title: "RBAC (Role-Based Access Control)",
    tagline: "Grant permissions to roles, assign roles to users — manage access at scale.",
    diagramNote: "Users → Roles → Permissions. The role layer in the middle is what makes it scale.",
    gameNote: "Build an access model: define what each role can do, assign roles to users, then test whether a user can perform an action.",

    explanation: `
      <p><strong>RBAC</strong> is the most widely used authorization model. Instead of granting permissions to each user individually, you grant permissions to <strong>roles</strong>, and assign <strong>roles</strong> to users. The role is an indirection layer in the middle: <em>User → Role → Permission</em>.</p>
      <h3>Why the role layer matters</h3>
      <p>Imagine 10,000 users and 50 permissions. Granting permissions per-user means managing up to 500,000 assignments, and onboarding a new engineer means remembering every individual grant. With RBAC you define a handful of roles once (<code>viewer</code>, <code>editor</code>, <code>admin</code>), and assign a user a role. Change what "editor" can do in one place and it applies to every editor instantly.</p>
      <h3>The pieces</h3>
      <ul>
        <li><strong>Permission</strong> — a specific allowed action, e.g. <code>invoices:write</code>.</li>
        <li><strong>Role</strong> — a named bundle of permissions, e.g. "Accountant" = {<code>invoices:read</code>, <code>invoices:write</code>}.</li>
        <li><strong>Assignment</strong> — linking a user to one or more roles.</li>
      </ul>
      <p>A user's effective permissions are the <em>union</em> of all their roles' permissions. Role hierarchies (admin inherits editor inherits viewer) reduce duplication further.</p>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>When RBAC isn't enough</h5><p>RBAC answers "can this <em>role</em> do this action?" but not context-dependent questions like "can this user edit <em>this specific</em> record because they own it?" For that you need <strong>ABAC</strong> (attribute-based) or ownership checks layered on top. Over-splitting into hundreds of micro-roles ("role explosion") is a common failure — keep roles coarse and meaningful.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 240,
        nodes: [
          { id: "u1", x: 30, y: 40, w: 110, h: 40, label: "Ada", kind: "client" },
          { id: "u2", x: 30, y: 110, w: 110, h: 40, label: "Bob", kind: "client" },
          { id: "u3", x: 30, y: 180, w: 110, h: 40, label: "Cleo", kind: "client" },
          { id: "r1", x: 300, y: 50, w: 130, h: 44, label: "Editor", kind: "accent" },
          { id: "r2", x: 300, y: 150, w: 130, h: 44, label: "Admin", kind: "purple" },
          { id: "p1", x: 580, y: 20, w: 150, h: 36, label: "docs:read", kind: "good" },
          { id: "p2", x: 580, y: 70, w: 150, h: 36, label: "docs:write", kind: "good" },
          { id: "p3", x: 580, y: 140, w: 150, h: 36, label: "users:manage", kind: "good" },
          { id: "p4", x: 580, y: 190, w: 150, h: 36, label: "billing:*", kind: "good" },
        ],
        links: [
          { from: "u1", to: "r1", accent: true }, { from: "u2", to: "r1", accent: true }, { from: "u3", to: "r2", accent: true },
          { from: "r1", to: "p1" }, { from: "r1", to: "p2" },
          { from: "r2", to: "p1" }, { from: "r2", to: "p2" }, { from: "r2", to: "p3" }, { from: "r2", to: "p4" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Build and test an access model. Toggle which permissions each role has, assign a role to the user, then run access checks. The result = union of the user's roles' permissions.",
        help: "Check boxes to grant permissions to roles. Set the user's role. Then click an action to test access.",
      });
      refs.canvas.parentElement.style.display = "none";
      const panel = document.createElement("div");
      refs.shell.appendChild(panel);

      const perms = ["docs:read", "docs:write", "docs:delete", "users:manage"];
      const roles = { Viewer: new Set(["docs:read"]), Editor: new Set(["docs:read", "docs:write"]), Admin: new Set(perms) };
      let userRole = "Viewer";
      let allowed = 0, denied = 0;

      const stRole = SDE.stat(refs.stats, "User role");
      const stEff = SDE.stat(refs.stats, "Effective perms", "good");

      function render() {
        panel.innerHTML = `
          <div class="kv-grid">
            ${Object.keys(roles).map((r) => `
              <div class="kv-card"><h5>Role: ${r}</h5>
                ${perms.map((p) => `<label style="display:flex;gap:8px;align-items:center;font-family:var(--mono);font-size:13px;margin:4px 0;cursor:pointer">
                  <input type="checkbox" data-role="${r}" data-perm="${p}" ${roles[r].has(p) ? "checked" : ""}/> ${p}</label>`).join("")}
              </div>`).join("")}
          </div>
          <div class="kv-card" style="margin-top:14px">
            <h5>Assign role to user "Ada"</h5>
            <div id="rbRoleBtns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"></div>
          </div>
          <div class="kv-card" style="margin-top:14px">
            <h5>Test access — can Ada do this?</h5>
            <div id="rbActions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"></div>
            <div id="rbLog" style="font-family:var(--mono);font-size:13px;margin-top:12px;min-height:40px"></div>
          </div>`;

        panel.querySelectorAll('input[type=checkbox]').forEach((cb) => {
          cb.onchange = () => { const r = cb.dataset.role, p = cb.dataset.perm; if (cb.checked) roles[r].add(p); else roles[r].delete(p); updateEff(); };
        });
        const rb = panel.querySelector("#rbRoleBtns");
        Object.keys(roles).forEach((r) => {
          const b = document.createElement("button"); b.className = "gbtn" + (r === userRole ? " primary" : ""); b.textContent = r;
          b.onclick = () => { userRole = r; render(); }; rb.appendChild(b);
        });
        const ra = panel.querySelector("#rbActions");
        perms.forEach((p) => { const b = document.createElement("button"); b.className = "gbtn"; b.textContent = p; b.onclick = () => test(p); ra.appendChild(b); });
        updateEff();
      }
      let logLines = [];
      function test(p) {
        const ok = roles[userRole].has(p);
        if (ok) allowed++; else denied++;
        logLines.unshift((ok ? '<span style="color:#8fe3b0">✓ allowed</span>' : '<span style="color:#ff9a9a">✗ denied</span>') + " · Ada(" + userRole + ") → " + p);
        logLines = logLines.slice(0, 5);
        panel.querySelector("#rbLog").innerHTML = logLines.join("<br>");
        SDE.toast(ok ? "Allowed" : "Denied", ok ? "✅" : "🚫");
      }
      function updateEff() { stRole(userRole); stEff([...roles[userRole]].length + " perms"); }
      render();
      return { destroy() {} };
    },
  });
})(window);
