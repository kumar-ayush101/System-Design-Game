/* Tracing — Area 4 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "tracing",
    title: "Distributed Tracing",
    tagline: "Follow one request as it hops across many services, and find the slow span.",
    diagramNote: "A trace id flows through every service; each hop records a timed span, forming a waterfall.",
    gameNote: "Fire a request and watch it fan out across services into a trace waterfall. Spot which span is the bottleneck — the whole point of tracing.",

    explanation: `
      <p>In a monolith, a slow request shows up in one stack trace. In a microservice system, a single user request might touch the API gateway, auth, the orders service, the inventory service, a database, and a payment provider. When it's slow, <em>which hop</em> caused it? <strong>Distributed tracing</strong> answers that.</p>
      <h3>Traces and spans</h3>
      <ul>
        <li>A <strong>trace</strong> represents one end-to-end request. It gets a unique <strong>trace id</strong>.</li>
        <li>Each unit of work within it (a service handling the request, a DB query) is a <strong>span</strong> with a start time, duration, and parent span.</li>
        <li>The trace id is <strong>propagated</strong> through every call (via headers like <code>traceparent</code>), so all the spans can be stitched back together.</li>
      </ul>
      <h3>The waterfall view</h3>
      <p>Visualized, a trace is a <strong>waterfall</strong>: time runs left-to-right, each span is a bar showing when it started and how long it took, nested under its parent. One glance shows you the critical path and the span that dominates the latency — maybe the payment provider took 800ms, or a database query had no index. Without tracing, you'd be guessing across six services' logs.</p>
      <div class="callout tip"><span class="c-ico">🔗</span><div><h5>It ties the three pillars together</h5><p>Click a slow span → jump to that service's <em>logs</em> for that trace id → check its <em>metrics</em> at that moment. Trace id is the thread that connects traces, logs, and metrics into true observability. OpenTelemetry is the common standard for emitting all three.</p></div></div>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>Sampling</h5><p>Tracing every request at high volume is expensive. Systems <strong>sample</strong> — keep a fraction of traces (e.g. 1%), plus all traces that errored or were slow. You lose some detail to keep the cost sane.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 760, height: 230,
        nodes: [
          { id: "gw", x: 40, y: 95, w: 120, h: 48, label: "Gateway", kind: "accent" },
          { id: "auth", x: 250, y: 25, w: 120, h: 42, label: "Auth", kind: "teal" },
          { id: "ord", x: 250, y: 95, w: 120, h: 42, label: "Orders", kind: "teal" },
          { id: "inv", x: 460, y: 60, w: 120, h: 42, label: "Inventory", kind: "good" },
          { id: "pay", x: 460, y: 130, w: 120, h: 42, label: "Payments", kind: "warn" },
          { id: "db", x: 650, y: 95, w: 90, h: 42, label: "DB", kind: "purple" },
        ],
        links: [
          { from: "gw", to: "auth", accent: true, label: "trace-id" }, { from: "gw", to: "ord", accent: true },
          { from: "ord", to: "inv" }, { from: "ord", to: "pay" }, { from: "inv", to: "db" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Find the bottleneck. Fire a request; it propagates a trace id across services, each adding a timed span. Read the waterfall and click the span you think is slowest — tracing makes it obvious.",
        help: "Press 'Trace a request'. Watch spans fill in. Click the longest bar to identify the bottleneck span.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 340 });

      // span definitions: name, depth, start fraction, duration (randomized each run)
      let spans = [];
      let traceId = "";
      let revealT = 0;
      let picked = null, bottleneck = null;

      SDE.button(refs.controls, "🚀 Trace a request", "primary", run);
      const stId = SDE.stat(refs.stats, "Trace id");
      const stTotal = SDE.stat(refs.stats, "Total time", "warn");
      const stBottle = SDE.stat(refs.stats, "Bottleneck");

      function run() {
        traceId = "trace-" + U.randInt(100000, 999999);
        picked = null;
        const payDur = U.rand(40, 900); // payments is the usual villain, sometimes
        const dbDur = U.rand(20, 300);
        spans = [
          { name: "gateway", depth: 0, start: 0, dur: 1000, color: C.accent },
          { name: "auth.verify", depth: 1, start: 20, dur: U.rand(10, 60), color: C.teal },
          { name: "orders.create", depth: 1, start: 90, dur: 0, color: C.teal },
          { name: "inventory.reserve", depth: 2, start: 120, dur: U.rand(20, 120), color: C.good },
          { name: "db.query", depth: 3, start: 140, dur: dbDur, color: C.purple },
          { name: "payments.charge", depth: 2, start: 300, dur: payDur, color: C.warn },
        ];
        // compute dependent durations
        spans[3].dur = spans[4].dur + 20; // inventory wraps db
        spans[2].dur = Math.max(spans[3].start + spans[3].dur, spans[5].start + spans[5].dur) - spans[2].start + 20;
        spans[0].dur = Math.max(...spans.map((s) => s.start + s.dur)) + 10;
        bottleneck = spans.slice(1).reduce((a, b) => (b.dur > a.dur ? b : a));
        revealT = 0;
      }

      sim.on("mousedown", (e) => {
        if (!spans.length) return;
        const p = sim.pointer(e);
        const total = spans[0].dur, x0 = 180, w = 600;
        spans.forEach((s, i) => {
          const y = 60 + i * 44;
          const bx = x0 + (s.start / total) * w, bw = Math.max(4, (s.dur / total) * w);
          if (p.x >= bx && p.x <= bx + bw && p.y >= y && p.y <= y + 28) {
            picked = s;
            const correct = s === bottleneck;
            SDE.toast(correct ? "✓ Correct — " + s.name + " is the bottleneck (" + Math.round(s.dur) + "ms)" : "Not the slowest — look again", correct ? "🎯" : "🤔");
          }
        });
      });

      sim.onUpdate = (dt) => {
        if (spans.length) revealT += dt * 1200; // reveal over time (ms units)
        stId(traceId || "—");
        stTotal(spans.length ? Math.round(spans[0].dur) + "ms" : "—");
        stBottle(picked ? (picked === bottleneck ? picked.name + " ✓" : picked.name + " ✗") : "click a span");
      };

      sim.onDraw = (g) => {
        if (!spans.length) { D.text(g, "Press 'Trace a request' to generate a trace waterfall", 410, 160, { color: C.dim, size: 15, align: "center" }); return; }
        D.text(g, "TRACE WATERFALL  ·  " + traceId + "  ·  time →", 40, 36, { color: C.dim, size: 13 });
        const total = spans[0].dur, x0 = 180, w = 600;
        spans.forEach((s, i) => {
          const y = 60 + i * 44;
          D.text(g, "  ".repeat(s.depth) + s.name, 40, y + 18, { color: s.color, size: 12, mono: true });
          const shownDur = Math.min(s.dur, Math.max(0, revealT - s.start));
          const bx = x0 + (s.start / total) * w, bw = Math.max(2, (shownDur / total) * w);
          const isB = s === bottleneck;
          g.fillStyle = s === picked ? "#ffffff22" : "transparent"; g.fillRect(x0, y - 4, w, 36);
          g.fillStyle = s.color; if (isB) { g.shadowColor = s.color; g.shadowBlur = 12; }
          D.roundRect(g, bx, y, bw, 28, 5); g.fill(); g.shadowBlur = 0;
          if (shownDur >= s.dur) D.text(g, Math.round(s.dur) + "ms" + (isB ? "  ⬅ slowest" : ""), bx + bw + 8, y + 18, { color: isB ? C.bad : C.dim, size: 11, mono: true });
        });
      };

      sim.start();
      return sim;
    },
  });
})(window);
