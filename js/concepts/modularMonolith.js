/* Modular Monolith — Area 5 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "modular-monolith",
    title: "Modular Monolith",
    tagline: "The best of both worlds: one deployable, but with strict internal module boundaries.",
    diagramNote: "Modules live in one process but only talk through published interfaces, not each other's internals.",
    gameNote: "Wire modules together. Legal calls go through public interfaces; reaching into another module's internals is a boundary violation — the game flags it.",

    explanation: `
      <p>A <strong>modular monolith</strong> is a single deployable application (so you keep the monolith's operational simplicity) that is <em>internally</em> organized into well-bounded modules with <strong>enforced boundaries</strong> (so you get much of the maintainability people chase with microservices).</p>
      <h3>The key discipline: boundaries</h3>
      <p>In a messy monolith, any class can call any other class and reach into any table. Over time everything depends on everything — a "big ball of mud" that's impossible to change safely. A modular monolith prevents this: each module exposes a small <strong>public interface</strong> and hides its internals. Other modules may only call the published interface — never reach into private classes or query another module's tables directly.</p>
      <h3>Why this is powerful</h3>
      <ul>
        <li><strong>Simple ops</strong> — still one build, one deploy, in-process calls, and (optionally) one database. None of the distributed-systems tax.</li>
        <li><strong>Clear ownership & changeability</strong> — a team can rework a module's internals freely as long as the interface holds.</li>
        <li><strong>An extraction path</strong> — because modules already talk through interfaces, if one truly needs to become its own service later, the seam is already there. You've done the hard domain work up front.</li>
      </ul>
      <div class="callout tip"><span class="c-ico">🧭</span><div><h5>Often the sweet spot</h5><p>Many teams that "need microservices" actually need a <em>modular monolith</em> — the real problem was tangled code, not deployment. Fix the boundaries first. You can enforce them with tooling (module systems, architecture tests like ArchUnit, separate schemas per module). Split into services only when a boundary demands independent scaling or deployment.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 700, height: 240,
        nodes: [
          { id: "box", x: 60, y: 30, w: 580, h: 180, label: "", kind: "accent" },
          { id: "u", x: 90, y: 70, w: 150, h: 60, label: "Users\n(public API)", kind: "teal" },
          { id: "o", x: 290, y: 70, w: 150, h: 60, label: "Orders\n(public API)", kind: "good" },
          { id: "b", x: 490, y: 70, w: 120, h: 60, label: "Billing\n(public API)", kind: "purple" },
        ],
        links: [
          { from: "o", to: "u", label: "via interface ✓", color: "#3ddc84" },
          { from: "b", to: "o", label: "via interface ✓", color: "#3ddc84" },
        ],
        labels: [
          { x: 350, y: 25, text: "One process · one deploy · enforced module boundaries", color: "#9aa6c2", size: 12, align: "middle" },
          { x: 350, y: 195, text: "✗ reaching into another module's internals is forbidden", color: "#ff6b6b", size: 12, align: "middle" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Keep the architecture clean. Draw dependencies between modules by clicking a source then a target. Calls to a module's <em>public interface</em> are legal (green). 'Reaching into internals' is a violation (red) — the thing that rots a monolith.",
        help: "Click a module, then click another to add a dependency through its public interface. Toggle 'reach into internals' to attempt an illegal call.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      const mods = [
        { name: "Users", x: 80, y: 110 }, { name: "Orders", x: 330, y: 110 },
        { name: "Billing", x: 580, y: 110 }, { name: "Notifications", x: 330, y: 230 },
      ];
      mods.forEach((m) => { m.w = 150; m.h = 70; });
      let deps = [];
      let selected = null;
      let illegalMode = false;
      let legal = 0, violations = 0;

      const illBtn = SDE.button(refs.controls, "Mode: public interface ✓", "active", () => {
        illegalMode = !illegalMode; illBtn.classList.toggle("active", !illegalMode);
        illBtn.textContent = illegalMode ? "Mode: reach into internals ✗" : "Mode: public interface ✓";
      });
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "Clear deps", "", () => { deps = []; legal = violations = 0; });

      const stLegal = SDE.stat(refs.stats, "Clean deps", "good");
      const stViol = SDE.stat(refs.stats, "Violations", "bad");
      const stHealth = SDE.stat(refs.stats, "Architecture");

      sim.on("mousedown", (e) => {
        const p = sim.pointer(e);
        const hit = mods.find((m) => D.pointInNode(p.x, p.y, m));
        if (!hit) { selected = null; return; }
        if (!selected) { selected = hit; }
        else if (selected !== hit) {
          const illegal = illegalMode;
          deps.push({ from: selected, to: hit, illegal });
          if (illegal) { violations++; SDE.toast("Boundary violation! " + selected.name + " reached into " + hit.name + "'s internals", "🚫"); }
          else { legal++; SDE.toast(selected.name + " → " + hit.name + " via public interface", "✅"); }
          selected = null;
        } else selected = null;
      });

      sim.onUpdate = () => {
        stLegal(legal); stViol(violations);
        stHealth(violations === 0 ? "clean ✓" : violations < 3 ? "eroding" : "ball of mud ✗");
      };

      sim.onDraw = (g) => {
        // container
        g.fillStyle = "rgba(110,168,254,0.04)"; D.roundRect(g, 40, 60, 740, 240, 16); g.fill();
        g.strokeStyle = C.accent; g.lineWidth = 2; g.stroke();
        D.text(g, "MODULAR MONOLITH (one process)", 410, 48, { color: C.accent, size: 13, align: "center" });

        for (const d of deps) {
          const col = d.illegal ? C.bad : C.good;
          D.arrow(g, D.cx(d.from), D.cy(d.from), D.cx(d.to), D.cy(d.to), col, d.illegal ? 2.5 : 1.8);
        }
        for (const m of mods) {
          const sel = selected === m;
          D.node(g, { x: m.x, y: m.y, w: m.w, h: m.h, label: m.name, sub: "public interface", fill: sel ? "#1a2a4a" : "#15223f", stroke: sel ? C.warn : C.teal, labelColor: C.text, subColor: C.dim, glow: sel ? 12 : 0 });
        }
        D.text(g, selected ? "Selected " + selected.name + " — now click a target module" : "Click a module, then another, to add a dependency", 410, 290, { color: C.dim, size: 12, align: "center" });
      };

      sim.start();
      return sim;
    },
  });
})(window);
