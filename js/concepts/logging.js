/* Logging — Area 4 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const C = SDE.COLORS, U = SDE.util;

  SDE.register({
    id: "logging",
    title: "Logging",
    tagline: "The detailed, timestamped record of what your system actually did.",
    diagramNote: "Services emit structured log lines; a pipeline ships them to a central, searchable store.",
    gameNote: "Watch a live log stream from several services. Filter by level and search — the core skill of debugging a distributed system.",

    explanation: `
      <p><strong>Logs</strong> are the append-only, timestamped record of discrete events your system emits: "request received", "payment failed", "cache miss". When something breaks at 3am, logs are usually the first place you look to reconstruct <em>what happened</em>.</p>
      <h3>Log levels</h3>
      <p>Every line has a <strong>severity</strong> so you can filter signal from noise:</p>
      <ul>
        <li><strong>DEBUG</strong> — fine-grained detail, usually off in production.</li>
        <li><strong>INFO</strong> — normal, noteworthy events ("user signed up").</li>
        <li><strong>WARN</strong> — something unexpected but recoverable ("retrying after timeout").</li>
        <li><strong>ERROR</strong> — a failure that needs attention ("payment gateway 500").</li>
      </ul>
      <h3>Structured logging</h3>
      <p>Instead of free-text (<code>"user 42 failed login"</code>), emit structured key-value or JSON logs: <code>{level:"warn", event:"login_failed", user_id:42, ip:"…"}</code>. Structured logs are <em>searchable and aggregatable</em> — you can query "all login_failed events for user 42 in the last hour" instead of grepping prose.</p>
      <h3>Centralization</h3>
      <p>In a distributed system, logs are scattered across dozens of servers. A <strong>log pipeline</strong> (e.g. Fluentd/Logstash → Elasticsearch/Loki) ships them to one searchable place, so you can trace a request across services. Attach a <strong>correlation/trace id</strong> to every line so you can stitch together one request's journey (ties into Tracing).</p>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>Logs cost money and can leak</h5><p>Logging everything is expensive to store and search, and noisy logs bury the important lines. And never log secrets or PII (passwords, tokens, card numbers) — logs are widely readable and long-lived. Log deliberately.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 230,
        nodes: [
          { id: "s1", x: 30, y: 30, w: 120, h: 40, label: "Service A", kind: "accent" },
          { id: "s2", x: 30, y: 95, w: 120, h: 40, label: "Service B", kind: "accent" },
          { id: "s3", x: 30, y: 160, w: 120, h: 40, label: "Service C", kind: "accent" },
          { id: "pipe", x: 290, y: 90, w: 150, h: 56, label: "Log pipeline", kind: "warn", glow: true, caption: "ship + parse" },
          { id: "store", x: 560, y: 90, w: 160, h: 56, label: "Searchable store", kind: "good", caption: "query across all" },
        ],
        links: [
          { from: "s1", to: "pipe", accent: true }, { from: "s2", to: "pipe", accent: true }, { from: "s3", to: "pipe", accent: true },
          { from: "pipe", to: "store", color: "#3ddc84" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Find the signal in the noise. A live stream of structured logs flows from several services. Filter by level and type a search term to isolate the events that matter — exactly what you'd do while debugging an incident.",
        help: "Toggle levels and type a search (e.g. 'payment', 'user_id=42'). The matched count shows how filtering cuts the noise.",
      });
      refs.canvas.parentElement.style.display = "none";
      const panel = document.createElement("div");
      refs.shell.appendChild(panel);

      const services = ["auth", "orders", "payments", "inventory"];
      const events = {
        info: ["request_received", "user_login", "order_created", "cache_hit"],
        warn: ["retry_attempt", "slow_query", "cache_miss", "rate_limit_near"],
        error: ["payment_failed", "db_timeout", "null_pointer", "gateway_500"],
        debug: ["entering_handler", "query_built", "serialized_response"],
      };
      let logs = [];
      let levelOn = { debug: false, info: true, warn: true, error: true };
      let search = "";
      let paused = false;

      const stTotal = SDE.stat(refs.stats, "Total logs");
      const stShown = SDE.stat(refs.stats, "Matching filter", "good");
      const stErr = SDE.stat(refs.stats, "Errors", "bad");

      panel.innerHTML = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
          <span style="color:var(--dim);font-size:13px">Levels:</span>
          <label class="lvl"><input type="checkbox" data-l="debug"/> DEBUG</label>
          <label class="lvl"><input type="checkbox" data-l="info" checked/> INFO</label>
          <label class="lvl"><input type="checkbox" data-l="warn" checked/> WARN</label>
          <label class="lvl"><input type="checkbox" data-l="error" checked/> ERROR</label>
          <input id="logSearch" class="gbtn" style="flex:1;min-width:160px;font-family:var(--mono)" placeholder="search… e.g. payment or user_id=42"/>
          <button id="logPause" class="gbtn">⏸ Pause</button>
        </div>
        <div id="logView" style="font-family:var(--mono);font-size:12.5px;background:#070a12;border:1px solid var(--border);border-radius:10px;padding:12px;height:300px;overflow-y:auto"></div>`;
      panel.querySelectorAll("label.lvl").forEach((lb) => lb.style.cssText = "font-family:var(--mono);font-size:12px;color:var(--dim);display:flex;gap:5px;align-items:center;cursor:pointer");
      panel.querySelectorAll("input[data-l]").forEach((cb) => cb.onchange = () => { levelOn[cb.dataset.l] = cb.checked; });
      panel.querySelector("#logSearch").oninput = (e) => { search = e.target.value.toLowerCase(); };
      const pauseBtn = panel.querySelector("#logPause");
      pauseBtn.onclick = () => { paused = !paused; pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause"; };

      const view = panel.querySelector("#logView");
      const levelColor = { debug: "#6b7691", info: "#8fb6ff", warn: "#ffca3a", error: "#ff6b6b" };
      let total = 0, errCount = 0;

      function emit() {
        const level = U.choice(["info", "info", "info", "warn", "error", "debug"]);
        const svc = U.choice(services);
        const ev = U.choice(events[level]);
        const uid = U.randInt(1, 99);
        const ms = U.randInt(2, 800);
        const line = { level, svc, ev, uid, ms, t: new Date().toISOString().slice(11, 23), trace: "tr-" + U.randInt(1000, 9999) };
        logs.unshift(line); if (logs.length > 200) logs.pop();
        total++; if (level === "error") errCount++;
      }

      let timer = setInterval(() => { if (!paused) { emit(); if (Math.random() < 0.4) emit(); renderView(); } }, 300);

      function renderView() {
        const filtered = logs.filter((l) => levelOn[l.level] && (!search || JSON.stringify(l).toLowerCase().includes(search)));
        view.innerHTML = filtered.slice(0, 60).map((l) =>
          `<div style="padding:2px 0"><span style="color:#5b647f">${l.t}</span> ` +
          `<span style="color:${levelColor[l.level]};font-weight:700">${l.level.toUpperCase().padEnd(5)}</span> ` +
          `<span style="color:#b58bff">[${l.svc}]</span> ` +
          `<span style="color:#c9d2e6">${l.ev}</span> ` +
          `<span style="color:#6b7691">user_id=${l.uid} latency_ms=${l.ms} ${l.trace}</span></div>`
        ).join("");
        stTotal(total); stShown(filtered.length); stErr(errCount);
      }

      return { destroy() { clearInterval(timer); } };
    },
  });
})(window);
