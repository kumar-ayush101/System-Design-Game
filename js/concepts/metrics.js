/* Metrics — Area 4 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "metrics",
    title: "Metrics & Monitoring",
    tagline: "Numbers over time that tell you the health of your system at a glance.",
    diagramNote: "Services expose counters/gauges; a collector scrapes them; dashboards and alerts watch the trends.",
    gameNote: "Watch a live metrics dashboard. Inject a traffic spike and a failure, set an alert threshold, and catch the incident before users do.",

    explanation: `
      <p><strong>Metrics</strong> are numeric measurements sampled over time: requests per second, error rate, latency, CPU, queue depth. Where logs tell you about <em>individual events</em>, metrics tell you about <em>aggregate trends</em> — the vital signs of the system.</p>
      <h3>Types of metrics</h3>
      <ul>
        <li><strong>Counter</strong> — only goes up (total requests, total errors). You look at its <em>rate</em> of change.</li>
        <li><strong>Gauge</strong> — goes up and down (current memory, active connections, queue depth).</li>
        <li><strong>Histogram</strong> — distribution of values, used for <strong>percentiles</strong>.</li>
      </ul>
      <h3>Why percentiles beat averages</h3>
      <p>Average latency hides pain. If 99% of requests take 20ms but 1% take 5 seconds, the average looks fine while thousands of users suffer. <strong>p95/p99 latency</strong> ("95% of requests are faster than X") exposes the tail that averages smooth away. Always watch high percentiles.</p>
      <h3>The golden signals</h3>
      <p>Google's SRE book recommends watching four: <strong>latency</strong>, <strong>traffic</strong>, <strong>errors</strong>, and <strong>saturation</strong> (how full your resources are). Together they catch most problems.</p>
      <h3>From metrics to alerts</h3>
      <p>A collector (e.g. Prometheus) scrapes metrics; dashboards visualize them; <strong>alerts</strong> fire when a metric crosses a threshold ("error rate > 1% for 5 minutes → page the on-call engineer"). Good alerts are actionable and tied to user impact — alert on symptoms (users seeing errors), not every blip.</p>
      <div class="callout tip"><span class="c-ico">📊</span><div><h5>Metrics, logs, traces — the three pillars</h5><p>Metrics tell you <em>that</em> something is wrong (error rate spiked). Logs tell you <em>what</em> the errors were. Traces tell you <em>where</em> in the request path it happened. You need all three for observability.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 220,
        nodes: [
          { id: "s", x: 40, y: 85, w: 130, h: 54, label: "Services\n(expose /metrics)", kind: "accent" },
          { id: "coll", x: 300, y: 85, w: 150, h: 54, label: "Collector", kind: "warn", glow: true, caption: "scrapes periodically" },
          { id: "dash", x: 560, y: 25, w: 150, h: 44, label: "📊 Dashboards", kind: "good" },
          { id: "alert", x: 560, y: 150, w: 150, h: 44, label: "🚨 Alerts", kind: "bad" },
        ],
        links: [
          { from: "s", to: "coll", accent: true }, { from: "coll", to: "dash", color: "#3ddc84" }, { from: "coll", to: "alert", color: "#ff6b6b" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Be the on-call engineer. Watch RPS, error-rate, and p99 latency scroll live. Inject a spike or an outage and set the alert threshold so you catch real incidents without false alarms.",
        help: "Use the buttons to inject events. Drag the error-rate alert threshold. Alert fires (and toasts) when crossed.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 340 });

      const hist = { rps: [], err: [], p99: [] };
      const MAXH = 160;
      let baseRps = 40, errRate = 0.4, p99 = 60;
      let threshold = 3; // % error
      let spikeT = 0, outageT = 0;
      let alerting = false, alertCount = 0;

      SDE.button(refs.controls, "📈 Traffic spike", "", () => { spikeT = 4; SDE.toast("Traffic spike injected", "📈"); });
      SDE.button(refs.controls, "💥 Dependency outage", "danger", () => { outageT = 5; SDE.toast("Outage! errors climbing", "💥"); });
      const slider = document.createElement("input"); slider.type = "range"; slider.min = 1; slider.max = 20; slider.value = threshold;
      const sl = document.createElement("span"); sl.className = "mono"; sl.style.color = C.dim; sl.textContent = threshold + "% alert";
      slider.addEventListener("input", () => { threshold = +slider.value; sl.textContent = threshold + "% alert"; });
      const w = document.createElement("div"); w.className = "flex center"; w.style.gap = "8px"; w.style.marginLeft = "auto";
      w.appendChild(document.createTextNode("Alert at")); w.appendChild(slider); w.appendChild(sl);
      refs.controls.appendChild(w);

      const stRps = SDE.stat(refs.stats, "RPS");
      const stErr = SDE.stat(refs.stats, "Error rate", "warn");
      const stP99 = SDE.stat(refs.stats, "p99 latency", "warn");
      const stAlert = SDE.stat(refs.stats, "Alerts fired", "bad");

      let acc = 0;
      sim.onUpdate = (dt) => {
        acc += dt;
        if (spikeT > 0) spikeT -= dt;
        if (outageT > 0) outageT -= dt;
        if (acc > 0.1) {
          acc = 0;
          const spike = spikeT > 0 ? 90 : 0;
          baseRps = U.lerp(baseRps, 40 + spike + U.rand(-5, 5), 0.3);
          const outage = outageT > 0 ? 18 : 0;
          errRate = U.clamp(U.lerp(errRate, 0.4 + outage + (spikeT > 0 ? 2 : 0) + U.rand(-0.3, 0.3), 0.3), 0, 100);
          p99 = U.lerp(p99, 60 + (outageT > 0 ? 400 : 0) + (spikeT > 0 ? 120 : 0) + U.rand(-10, 10), 0.25);
          hist.rps.push(baseRps); hist.err.push(errRate); hist.p99.push(p99);
          for (const k in hist) if (hist[k].length > MAXH) hist[k].shift();
          const over = errRate > threshold;
          if (over && !alerting) { alerting = true; alertCount++; SDE.toast("🚨 ALERT: error rate " + errRate.toFixed(1) + "% > " + threshold + "%", "🚨"); }
          if (!over) alerting = false;
        }
        stRps(Math.round(baseRps)); stErr(errRate.toFixed(1) + "%"); stP99(Math.round(p99) + "ms"); stAlert(alertCount);
      };

      function graph(g, data, x, y, w, h, color, label, max, unit) {
        g.strokeStyle = C.line; g.lineWidth = 1; g.strokeRect(x, y, w, h);
        D.text(g, label, x, y - 6, { color, size: 12 });
        const n = data.length; if (!n) return;
        g.beginPath();
        for (let i = 0; i < n; i++) {
          const px = x + (i / MAXH) * w;
          const py = y + h - U.clamp(data[i] / max, 0, 1) * h;
          i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
        }
        g.strokeStyle = color; g.lineWidth = 2; g.stroke();
        // fill
        g.lineTo(x + ((n - 1) / MAXH) * w, y + h); g.lineTo(x, y + h); g.closePath();
        g.fillStyle = color + "22"; g.fill();
        D.text(g, (data[n - 1]).toFixed(unit === "%" ? 1 : 0) + unit, x + w - 6, y + 16, { color, size: 14, align: "right", mono: true });
      }

      sim.onDraw = (g) => {
        graph(g, hist.rps, 40, 30, 740, 80, C.accent, "Traffic (req/s)", 180, "");
        graph(g, hist.err, 40, 145, 740, 70, C.warn, "Error rate", 25, "%");
        // threshold line on error graph
        const ty = 145 + 70 - U.clamp(threshold / 25, 0, 1) * 70;
        g.strokeStyle = C.bad; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(40, ty); g.lineTo(780, ty); g.stroke(); g.setLineDash([]);
        D.text(g, "alert @ " + threshold + "%", 46, ty - 4, { color: C.bad, size: 10 });
        graph(g, hist.p99, 40, 250, 740, 70, C.pink, "p99 latency (ms)", 600, "ms");
        if (alerting) { g.fillStyle = "rgba(255,107,107,0.08)"; g.fillRect(0, 0, 820, 340); }
      };

      sim.start();
      return sim;
    },
  });
})(window);
