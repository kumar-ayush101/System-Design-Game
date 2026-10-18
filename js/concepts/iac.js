/* Infrastructure as Code — Area 6 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "iac",
    title: "Infrastructure as Code",
    tagline: "Define your servers, networks, and databases in version-controlled files — not by clicking consoles.",
    diagramNote: "A declarative config describes desired state; a tool reconciles real infrastructure to match it.",
    gameNote: "Edit a desired-state config and 'apply' it. Watch the tool create, update, or destroy real resources to match — and drift back when you change things by hand.",

    explanation: `
      <p><strong>Infrastructure as Code</strong> (IaC) means defining your infrastructure — servers, load balancers, networks, databases, DNS — in <strong>declarative configuration files</strong> that live in version control, instead of manually clicking around a cloud console.</p>
      <h3>Declarative desired state</h3>
      <p>You don't write step-by-step instructions ("create a server, then attach a disk…"). You declare the <strong>desired end state</strong> ("there should be 3 web servers of this size behind this load balancer"). A tool (Terraform, CloudFormation, Pulumi) compares desired state to <em>actual</em> state and computes the minimal set of changes to <strong>reconcile</strong> them — creating what's missing, updating what differs, destroying what's no longer declared.</p>
      <h3>Why it's transformative</h3>
      <ul>
        <li><strong>Reproducible</strong> — spin up an identical staging environment from the same files. No "works on prod only" mysteries.</li>
        <li><strong>Reviewable & auditable</strong> — infra changes are pull requests: diffed, reviewed, and recorded in git history.</li>
        <li><strong>Versioned & rollback-able</strong> — infrastructure has the same safety net as application code.</li>
        <li><strong>No snowflakes</strong> — manually-tweaked, undocumented servers ("snowflakes") are the enemy; IaC makes servers disposable and consistent.</li>
      </ul>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>Drift is the enemy</h5><p>If someone changes a resource by hand in the console, real state <em>drifts</em> from the code. The next <code>apply</code> may undo their change (or fail). The discipline is: all changes go through the code. Treat manual console edits in managed infra as a bug.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 220,
        nodes: [
          { id: "code", x: 40, y: 85, w: 150, h: 54, label: "config.tf\n(desired state)", kind: "accent" },
          { id: "tool", x: 300, y: 80, w: 150, h: 64, label: "IaC tool", kind: "warn", glow: true, caption: "plan → apply" },
          { id: "cloud", x: 560, y: 80, w: 150, h: 64, label: "Real cloud\n(actual state)", kind: "good" },
        ],
        links: [
          { from: "code", to: "tool", accent: true, label: "declare" },
          { from: "tool", to: "cloud", color: "#3ddc84", label: "reconcile" },
          { from: "cloud", to: "tool", dashed: true, color: "#ffca3a", label: "detect drift" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Keep real infra matching the code. Set the desired server count and 'Apply' — the tool creates/destroys to match. Then click 'Manual console edit' to cause drift, and re-apply to see the tool correct it.",
        help: "Change desired count, press Apply. Cause drift manually and re-apply to watch reconciliation.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 300 });

      let desired = 3, actual = [];
      for (let i = 0; i < 3; i++) actual.push({ id: i, state: "running", born: 0 });
      let nextId = 3;
      let created = 0, destroyed = 0;

      const wrap = document.createElement("div"); wrap.className = "flex center"; wrap.style.gap = "6px";
      const out = document.createElement("span"); out.className = "mono"; out.style.color = C.dim; out.style.minWidth = "90px";
      const minus = document.createElement("button"); minus.className = "gbtn"; minus.textContent = "−";
      const plus = document.createElement("button"); plus.className = "gbtn"; plus.textContent = "+";
      const upd = () => out.textContent = "desired = " + desired;
      minus.onclick = () => { desired = Math.max(0, desired - 1); upd(); };
      plus.onclick = () => { desired = Math.min(8, desired + 1); upd(); };
      wrap.append(document.createTextNode("Config"), minus, out, plus); refs.controls.appendChild(wrap); upd();

      SDE.button(refs.controls, "⚙ terraform apply", "primary", apply);
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "🖐 Manual console edit (drift)", "danger", () => {
        if (Math.random() < 0.5 && actual.length > 0) { actual.pop(); SDE.toast("Someone deleted a server by hand — drift!", "⚠️"); }
        else { actual.push({ id: nextId++, state: "rogue", born: sim.time }); SDE.toast("Someone added a rogue server — drift!", "⚠️"); }
      });

      const stDesired = SDE.stat(refs.stats, "Desired");
      const stActual = SDE.stat(refs.stats, "Actual");
      const stDrift = SDE.stat(refs.stats, "Drift", "warn");

      function apply() {
        const diff = desired - actual.length;
        if (diff > 0) { for (let i = 0; i < diff; i++) { actual.push({ id: nextId++, state: "creating", born: sim.time }); created++; } SDE.toast("+ Creating " + diff + " server(s)", "🟢"); }
        else if (diff < 0) { for (let i = 0; i < -diff; i++) { const s = actual.pop(); destroyed++; } SDE.toast("− Destroying " + (-diff) + " server(s)", "🔴"); }
        else SDE.toast("No changes — infrastructure already matches code ✓", "✅");
        actual.forEach((s) => { if (s.state === "rogue") s.state = "running"; });
      }

      sim.onUpdate = (dt) => {
        actual.forEach((s) => { if (s.state === "creating" && sim.time - s.born > 0.8) s.state = "running"; });
        stDesired(desired); stActual(actual.length);
        const drift = Math.abs(desired - actual.length) + actual.filter((s) => s.state === "rogue").length;
        stDrift(drift === 0 ? "none ✓" : drift + " ✗");
      };

      sim.onDraw = (g) => {
        D.text(g, "DESIRED STATE (config.tf): " + desired + " servers", 40, 34, { color: C.accent, size: 13 });
        for (let i = 0; i < desired; i++) D.node(g, { x: 40 + i * 90, y: 48, w: 78, h: 44, label: "web-" + i, fill: "#15223f", stroke: C.accent, labelColor: "#dbe8ff", fontSize: 12, r: 7 });

        D.text(g, "ACTUAL INFRASTRUCTURE: " + actual.length + " servers", 40, 150, { color: C.good, size: 13 });
        actual.forEach((s, i) => {
          const col = s.state === "rogue" ? C.warn : s.state === "creating" ? C.teal : C.good;
          D.node(g, { x: 40 + i * 90, y: 164, w: 78, h: 44, label: s.state === "rogue" ? "rogue" : "srv-" + s.id, sub: s.state === "creating" ? "booting" : "", fill: s.state === "rogue" ? "#2a2410" : "#10261a", stroke: col, labelColor: col, fontSize: 11, r: 7 });
        });
        const match = desired === actual.length && !actual.some((s) => s.state === "rogue");
        D.text(g, match ? "✓ actual matches desired — no drift" : "✗ drift detected — run apply to reconcile", 40, 240, { color: match ? C.good : C.warn, size: 13 });
      };

      sim.start();
      return sim;
    },
  });
})(window);
