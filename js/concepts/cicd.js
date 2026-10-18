/* CI/CD — Area 6 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "cicd",
    title: "CI / CD",
    tagline: "Automate the path from a code commit to running in production — safely and repeatably.",
    diagramNote: "A commit flows through build → test → deploy stages; a failure stops the pipeline.",
    gameNote: "Push commits through a pipeline. A failing test halts the pipeline before bad code reaches production — the whole point of CI.",

    explanation: `
      <p><strong>CI/CD</strong> automates the journey from a developer's commit to running software. It's two linked ideas:</p>
      <h3>Continuous Integration (CI)</h3>
      <p>Every commit is automatically <strong>built</strong> and <strong>tested</strong> on a shared pipeline, many times a day. The goal is to catch integration problems <em>immediately</em>, while the change is small and fresh in the author's mind, rather than at a painful "merge day" months later. If the build or tests fail, the pipeline goes red and the team fixes it before anything else moves.</p>
      <h3>Continuous Delivery / Deployment (CD)</h3>
      <ul>
        <li><strong>Continuous Delivery</strong> — every change that passes CI is automatically prepared and <em>deployable</em> to production at the click of a button (a human approves the release).</li>
        <li><strong>Continuous Deployment</strong> — goes one step further: every passing change deploys to production <em>automatically</em>, no human gate.</li>
      </ul>
      <h3>A typical pipeline</h3>
      <p><code>commit → build → unit tests → integration tests → security scan → deploy to staging → smoke tests → deploy to prod</code>. Each stage is a gate: a failure stops the pipeline so broken code can't advance. Deployments often use safe-rollout strategies — <strong>blue-green</strong> (switch traffic between two identical environments) or <strong>canary</strong> (send 1% of traffic to the new version first, watch metrics, then ramp).</p>
      <div class="callout tip"><span class="c-ico">🚀</span><div><h5>Why it matters</h5><p>Automation makes releases <em>small, frequent, and boring</em>. Small changes are easy to review and to roll back. Teams with mature CI/CD deploy dozens of times a day with lower failure rates than teams doing rare, giant, manual releases — because risk scales with batch size.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 780, height: 180,
        nodes: [
          { id: "commit", x: 20, y: 65, w: 110, h: 48, label: "Commit", kind: "accent" },
          { id: "build", x: 160, y: 65, w: 110, h: 48, label: "Build", kind: "teal" },
          { id: "test", x: 300, y: 65, w: 110, h: 48, label: "Test", kind: "warn" },
          { id: "stage", x: 440, y: 65, w: 110, h: 48, label: "Staging", kind: "purple" },
          { id: "prod", x: 600, y: 65, w: 140, h: 48, label: "Production", kind: "good" },
        ],
        links: [
          { from: "commit", to: "build", accent: true }, { from: "build", to: "test", accent: true },
          { from: "test", to: "stage", accent: true }, { from: "stage", to: "prod", accent: true },
        ],
        labels: [{ x: 390, y: 150, text: "any stage fails → pipeline stops, nothing ships", color: "#ff6b6b", size: 12, align: "middle" }],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Ship safely. Push commits down the pipeline. Toggle 'inject failing tests' and watch the pipeline go red at the Test stage — stopping broken code before it ever reaches production.",
        help: "Push commits. Toggle the failure switches to see a stage fail and halt the pipeline.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 300 });

      const stages = ["Build", "Test", "Scan", "Staging", "Prod"];
      let failBuild = false, failTest = false;
      let runs = [], acc = 0, shipped = 0, blocked = 0, auto = false, autoAcc = 0;

      const bBtn = SDE.button(refs.controls, "Build: pass", "active", () => { failBuild = !failBuild; bBtn.classList.toggle("active", !failBuild); bBtn.textContent = "Build: " + (failBuild ? "FAIL" : "pass"); });
      const tBtn = SDE.button(refs.controls, "Tests: pass", "active", () => { failTest = !failTest; tBtn.classList.toggle("active", !failTest); tBtn.textContent = "Tests: " + (failTest ? "FAIL" : "pass"); });
      SDE.button(refs.controls, "⬆ Push commit", "primary", push);
      const autoBtn = SDE.button(refs.controls, "▶ Auto", "", () => { auto = !auto; autoBtn.classList.toggle("active", auto); autoBtn.innerHTML = auto ? "⏸ Stop" : "▶ Auto"; });

      const stShipped = SDE.stat(refs.stats, "Shipped to prod", "good");
      const stBlocked = SDE.stat(refs.stats, "Blocked", "bad");

      function push() {
        const failAt = failBuild ? 0 : failTest ? 1 : -1;
        runs.push({ stage: 0, x: 40, progress: 0, failAt, state: "running", id: Math.random().toString(36).slice(2, 6) });
      }

      const stageX = [60, 200, 340, 480, 640];
      sim.onUpdate = (dt) => {
        if (auto) { autoAcc += dt; if (autoAcc > 1.3) { autoAcc = 0; push(); } }
        for (const r of runs) {
          if (r.state !== "running") continue;
          r.progress += dt * 1.3;
          if (r.progress >= 1) {
            r.progress = 0;
            if (r.stage === r.failAt) { r.state = "failed"; blocked++; }
            else if (r.stage >= stages.length - 1) { r.state = "shipped"; shipped++; }
            else r.stage++;
          }
        }
        runs = runs.filter((r) => r.state === "running" || (r._done = (r._done || sim.time)) && sim.time - r._done < 1.5);
        stShipped(shipped); stBlocked(blocked);
      };

      sim.onDraw = (g) => {
        // stages
        stages.forEach((s, i) => {
          const x = stageX[i];
          const isFailStage = (failBuild && i === 0) || (failTest && i === 1);
          D.node(g, { x, y: 60, w: 120, h: 56, label: s, fill: isFailStage ? "#2a1414" : "#121829", stroke: isFailStage ? C.bad : C.line, labelColor: isFailStage ? C.bad : C.text });
          if (i < stages.length - 1) D.arrow(g, x + 120, 88, stageX[i + 1], 88, C.faint, 1.5);
        });
        D.text(g, "PIPELINE", 40, 44, { color: C.dim, size: 13 });

        for (const r of runs) {
          const sx = stageX[r.stage];
          const col = r.state === "failed" ? C.bad : r.state === "shipped" ? C.good : C.accent;
          const x = r.state === "running" ? sx + 60 : (r.state === "shipped" ? 700 : sx + 60);
          const y = 150 + (r.state === "failed" ? r.progress * 0 : 0);
          g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 8;
          g.beginPath(); g.arc(x, r.state === "failed" ? 150 : 88, 7, 0, 7); g.fill(); g.shadowBlur = 0;
          if (r.state === "failed") D.text(g, "✗ blocked", x, 170, { color: C.bad, size: 11, align: "center" });
          if (r.state === "shipped") D.text(g, "✓ live", 700, 135, { color: C.good, size: 11, align: "center" });
        }
        D.text(g, "🟦 in-flight commit   🟩 shipped   🟥 blocked by a failing stage", 40, 240, { color: C.faint, size: 12 });
        D.text(g, "Toggle a stage to FAIL — commits halt there and never reach prod.", 40, 262, { color: C.dim, size: 12 });
      };

      sim.start();
      return sim;
    },
  });
})(window);
