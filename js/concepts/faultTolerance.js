/* Fault Tolerance — Area 1 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "fault-tolerance",
    title: "Fault Tolerance",
    tagline: "Keep the system working — maybe degraded — even when parts of it fail.",
    diagramNote: "A circuit breaker wraps a flaky dependency and fails fast when it's unhealthy.",
    gameNote: "Toggle the database into a failing state and watch the circuit breaker trip OPEN to protect your service, then test recovery.",

    explanation: `
      <p><strong>Fault tolerance</strong> is the ability of a system to keep functioning when components fail. In a distributed system, failure isn't an edge case — it's a constant. Machines crash, networks drop, dependencies get slow. The question is never "will something fail?" but "what happens to the rest of the system when it does?"</p>
      <h3>Core techniques</h3>
      <ul>
        <li><strong>Redundancy</strong> — run multiple copies so one failure removes capacity, not the whole service (the load balancer + replicas you've already seen).</li>
        <li><strong>Timeouts</strong> — never wait forever on a dependency. A hung call ties up a thread/connection; enough of them exhaust the server.</li>
        <li><strong>Retries with backoff</strong> — transient blips often succeed on a second try, but retry too aggressively and you hammer an already-struggling service.</li>
        <li><strong>Graceful degradation</strong> — serve a reduced experience (cached data, a default) instead of an error.</li>
      </ul>
      <h3>The circuit breaker</h3>
      <p>A <strong>circuit breaker</strong> watches calls to a dependency and stops making them when the failure rate crosses a threshold. It has three states:</p>
      <ul>
        <li><strong>Closed</strong> — normal. Calls flow through. Failures are counted.</li>
        <li><strong>Open</strong> — too many failures. All calls are rejected <em>immediately</em> without even trying, giving the sick dependency room to recover and freeing your own resources.</li>
        <li><strong>Half-open</strong> — after a cooldown, let a few trial calls through. If they succeed, close the circuit; if not, open again.</li>
      </ul>
      <div class="callout"><span class="c-ico">🧠</span><div><h5>Why "fail fast" beats "wait and hope"</h5><p>Without a breaker, a slow database makes application servers pile up waiting requests until they exhaust threads and fall over too — the failure cascades. With a breaker, the app fails fast, stays healthy, and recovers automatically the moment the dependency does.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 230,
        nodes: [
          { id: "svc", x: 40, y: 85, w: 130, h: 54, label: "Service", kind: "accent" },
          { id: "cb", x: 300, y: 80, w: 150, h: 64, label: "Circuit\nBreaker", kind: "warn", glow: true, caption: "closed / open / half-open" },
          { id: "dep", x: 580, y: 85, w: 130, h: 54, label: "Dependency", kind: "bad" },
        ],
        links: [
          { from: "svc", to: "cb", accent: true },
          { from: "cb", to: "dep", dashed: true, color: "#ff6b6b", label: "monitored" },
        ],
        labels: [{ x: 375, y: 185, text: "trips OPEN → reject instantly, let it heal", color: "#ffca3a", size: 12, align: "middle" }],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Protect the service. Flip the dependency to FAILING and watch the breaker trip OPEN after enough errors — now calls fail instantly instead of hanging. Fix the dependency and watch HALF-OPEN probe, then CLOSE.",
        help: "Toggle the dependency health. Traffic flows automatically. Observe the breaker state machine on the right.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      let depHealthy = true;
      let state = "closed"; // closed | open | halfopen
      let failWindow = []; // recent results true=ok
      let openedAt = 0;
      const OPEN_MS = 3;
      const THRESH = 0.5; // 50% failures trips
      const WINDOW = 10;
      let calls = 0, served = 0, rejected = 0, failed = 0;
      let acc = 0; let results = [];

      const toggle = SDE.button(refs.controls, "💥 Break dependency", "danger", () => {
        depHealthy = !depHealthy;
        toggle.innerHTML = depHealthy ? "💥 Break dependency" : "💚 Fix dependency";
        toggle.classList.toggle("active", !depHealthy);
      });
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "Reset", "", () => { state = "closed"; failWindow = []; results = []; calls = served = rejected = failed = 0; });

      const stState = SDE.stat(refs.stats, "Breaker", "warn");
      const stServed = SDE.stat(refs.stats, "Succeeded", "good");
      const stRej = SDE.stat(refs.stats, "Rejected fast", "warn");
      const stFail = SDE.stat(refs.stats, "Failed slow", "bad");

      function doCall() {
        calls++;
        if (state === "open") {
          if (sim.time - openedAt > OPEN_MS) { state = "halfopen"; }
          else { rejected++; results.push("rej"); return; }
        }
        // closed or halfopen: actually try
        const ok = depHealthy;
        if (state === "halfopen") {
          if (ok) { state = "closed"; failWindow = []; served++; results.push("ok"); }
          else { state = "open"; openedAt = sim.time; failed++; results.push("fail"); }
          return;
        }
        // closed
        if (ok) { served++; results.push("ok"); } else { failed++; results.push("fail"); }
        failWindow.push(ok); if (failWindow.length > WINDOW) failWindow.shift();
        const fails = failWindow.filter((x) => !x).length;
        if (failWindow.length >= WINDOW && fails / failWindow.length >= THRESH) {
          state = "open"; openedAt = sim.time;
        }
      }

      sim.onUpdate = (dt) => {
        acc += dt; while (acc > 0.18) { acc -= 0.18; doCall(); }
        if (results.length > 60) results = results.slice(-60);
        stState(state.toUpperCase());
        stServed(served); stRej(rejected); stFail(failed);
      };

      sim.onDraw = (g) => {
        // service
        D.node(g, { x: 40, y: 120, w: 130, h: 60, label: "Service", fill: "#15223f", stroke: C.accent, labelColor: "#dbe8ff" });
        // breaker
        const bcol = state === "closed" ? C.good : state === "open" ? C.bad : C.warn;
        D.node(g, { x: 320, y: 110, w: 170, h: 80, label: "CIRCUIT BREAKER", sub: state.toUpperCase(), fill: "#1a1d2e", stroke: bcol, glow: 16, labelColor: bcol, subColor: bcol });
        // dependency
        D.node(g, { x: 640, y: 120, w: 140, h: 60, label: depHealthy ? "Dependency ✓" : "Dependency ✗", fill: depHealthy ? "#10261a" : "#2a1414", stroke: depHealthy ? C.good : C.bad, labelColor: depHealthy ? C.good : C.bad });

        D.arrow(g, 170, 150, 320, 150, C.accent, 2);
        if (state === "open") {
          D.text(g, "⛔ rejected", 555, 145, { color: C.bad, size: 12, align: "center" });
          D.line(g, 490, 150, 640, 150, "rgba(255,107,107,0.3)", 2, [6, 5]);
          // broken switch symbol
          D.text(g, "/ open circuit", 555, 170, { color: C.bad, size: 11, align: "center" });
        } else {
          D.arrow(g, 490, 150, 640, 150, state === "halfopen" ? C.warn : C.good, 2);
        }

        // state machine legend
        D.text(g, "States: CLOSED → (failures) → OPEN → (cooldown " + OPEN_MS + "s) → HALF-OPEN → CLOSED/OPEN", 40, 40, { color: C.dim, size: 12 });

        // recent results strip
        D.text(g, "Recent calls:", 40, 230, { color: C.dim, size: 12 });
        let x = 40;
        for (let i = Math.max(0, results.length - 40); i < results.length; i++) {
          const r = results[i];
          const col = r === "ok" ? C.good : r === "rej" ? C.warn : C.bad;
          g.fillStyle = col; D.roundRect(g, x, 244, 14, 20, 3); g.fill();
          x += 18;
        }
        D.text(g, "🟩 success   🟨 rejected-fast   🟥 failed-slow", 40, 290, { color: C.faint, size: 11 });
      };

      sim.start();
      return sim;
    },
  });
})(window);
