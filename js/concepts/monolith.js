/* Monolith — Area 5 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "monolith",
    title: "Monolith",
    tagline: "One codebase, one deployable unit — simple, fast to start, and the right default more often than people admit.",
    diagramNote: "All modules live in one process and deploy together, sharing one database.",
    gameNote: "Deploy a monolith and route traffic through it. See its strengths (simple, fast calls) and its weakness (one bug can take the whole thing down).",

    explanation: `
      <p>A <strong>monolith</strong> is an application built and deployed as a single unit. All the features — users, orders, billing, notifications — live in one codebase, run in one process, and ship together. This is how almost every system should start.</p>
      <h3>Why monoliths are great (especially early)</h3>
      <ul>
        <li><strong>Simplicity</strong> — one repo, one build, one deploy, one thing to run locally. No network between modules.</li>
        <li><strong>Fast internal calls</strong> — modules call each other as in-process function calls (nanoseconds), not network requests (milliseconds).</li>
        <li><strong>Easy transactions</strong> — one database means ACID transactions across features are trivial; no distributed-transaction headaches.</li>
        <li><strong>Easy to reason about</strong> — the whole system is in front of you; a stack trace spans the entire request.</li>
      </ul>
      <h3>Where monoliths strain</h3>
      <ul>
        <li><strong>Scaling is all-or-nothing</strong> — if only the image-processing feature is hot, you still have to scale the entire app.</li>
        <li><strong>Blast radius</strong> — a memory leak or crash in one module can take down the whole process, including unrelated features.</li>
        <li><strong>Deploy coupling</strong> — every team ships through the same pipeline; one risky change can block everyone's release.</li>
        <li><strong>Tech lock-in</strong> — the whole thing is one language/framework.</li>
      </ul>
      <div class="callout tip"><span class="c-ico">🧠</span><div><h5>Start here</h5><p>The common wisdom "<strong>monolith first</strong>" exists because premature microservices add enormous operational complexity before you understand your domain. Most teams should build a well-structured monolith and only extract services when a <em>specific</em> scaling or team-autonomy pain demands it. A messy monolith split into messy microservices just becomes a distributed mess.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 700, height: 250,
        nodes: [
          { id: "lb", x: 40, y: 100, w: 110, h: 48, label: "Clients", kind: "client" },
          { id: "mono", x: 260, y: 40, w: 200, h: 170, label: "Monolith (1 process)", kind: "accent", glow: true },
          { id: "m1", x: 285, y: 85, w: 150, h: 28, label: "Users module", kind: "plain", r: 6 },
          { id: "m2", x: 285, y: 120, w: 150, h: 28, label: "Orders module", kind: "plain", r: 6 },
          { id: "m3", x: 285, y: 155, w: 150, h: 28, label: "Billing module", kind: "plain", r: 6 },
          { id: "db", x: 540, y: 100, w: 120, h: 48, label: "One Database", kind: "purple" },
        ],
        links: [{ from: "lb", to: "mono", accent: true }, { from: "mono", to: "db", label: "ACID txns" }],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Feel the monolith trade-off. Traffic flows fast through in-process calls. Then inject a bug in one module and watch the <em>entire</em> app go down — that's blast radius. Compare with Microservices next.",
        help: "Traffic auto-flows. Click 'Crash a module' to inject a fault and see the whole monolith fail.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 300 });

      const mods = [
        { name: "Users", y: 70, ok: true }, { name: "Orders", y: 130, ok: true }, { name: "Billing", y: 190, ok: true },
      ];
      let packets = [], acc = 0, served = 0, failed = 0, crashed = false;

      SDE.button(refs.controls, "💥 Crash a module", "danger", () => {
        const m = U.choice(mods); m.ok = false; crashed = true;
        SDE.toast("Bug in " + m.name + " crashed the whole process!", "💥");
      });
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "🔄 Redeploy (fix all)", "", () => { mods.forEach(m => m.ok = true); crashed = false; SDE.toast("Redeployed the entire monolith", "🚀"); });

      const stServed = SDE.stat(refs.stats, "Served", "good");
      const stFailed = SDE.stat(refs.stats, "Failed", "bad");
      const stStatus = SDE.stat(refs.stats, "App status");

      sim.onUpdate = (dt) => {
        acc += dt;
        if (acc > 0.25) { acc = 0; packets.push({ t: 0, mod: U.randInt(0, 2) }); }
        for (const p of packets) { p.t += dt; if (p.t > 0.5 && !p.counted) { p.counted = true; if (crashed) failed++; else served++; } }
        packets = packets.filter((p) => p.t < 1.1);
        stServed(served); stFailed(failed); stStatus(crashed ? "DOWN ✗" : "healthy ✓");
      };

      sim.onDraw = (g) => {
        D.node(g, { x: 30, y: 120, w: 110, h: 50, label: "Clients", fill: "#161b2e", stroke: C.dim, labelColor: C.text });
        // monolith container
        const anyDown = mods.some((m) => !m.ok);
        g.fillStyle = anyDown ? "rgba(255,107,107,0.06)" : "rgba(110,168,254,0.05)";
        D.roundRect(g, 280, 40, 260, 220, 14); g.fill();
        g.strokeStyle = anyDown ? C.bad : C.accent; g.lineWidth = 2; g.stroke();
        D.text(g, anyDown ? "MONOLITH — CRASHED" : "MONOLITH (1 process)", 410, 30, { color: anyDown ? C.bad : C.accent, size: 13, align: "center" });
        mods.forEach((m) => {
          D.node(g, { x: 310, y: m.y, w: 200, h: 44, label: m.name + " module" + (m.ok ? "" : " ✗"), fill: m.ok && !anyDown ? "#15223f" : "#2a1414", stroke: m.ok && !anyDown ? C.line : C.bad, labelColor: m.ok && !anyDown ? C.text : C.bad });
        });
        D.node(g, { x: 600, y: 120, w: 120, h: 50, label: "Database", fill: "#1d1838", stroke: C.purple, labelColor: C.purple });
        D.line(g, 540, 145, 600, 145, C.line, 1.5);

        for (const p of packets) {
          if (p.t > 1) continue;
          const x = U.lerp(140, 310, Math.min(1, p.t / 0.5));
          g.fillStyle = crashed ? C.bad : C.accent; g.shadowColor = g.fillStyle; g.shadowBlur = 8;
          g.beginPath(); g.arc(x, 145, 5, 0, 7); g.fill(); g.shadowBlur = 0;
        }
      };

      sim.start();
      return sim;
    },
  });
})(window);
