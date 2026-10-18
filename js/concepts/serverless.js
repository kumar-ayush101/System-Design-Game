/* Serverless — Area 6 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "serverless",
    title: "Serverless",
    tagline: "Run code on demand without managing servers — it scales to zero and bills per request.",
    diagramNote: "Requests trigger ephemeral function instances that the platform creates and destroys automatically.",
    gameNote: "Send traffic to a serverless function. Watch instances appear on demand (with cold starts), scale with load, then vanish to zero when idle.",

    explanation: `
      <p><strong>Serverless</strong> (specifically Functions-as-a-Service like AWS Lambda) lets you deploy individual functions and have the cloud provider run them <em>on demand</em>. There are still servers — you just never see, provision, or manage them. You hand over the code; the platform handles everything about running it.</p>
      <h3>The defining traits</h3>
      <ul>
        <li><strong>Scale to zero</strong> — when there's no traffic, there are no running instances and you pay <em>nothing</em>. Contrast with a server/container that costs money sitting idle.</li>
        <li><strong>Automatic, instant scaling</strong> — a burst of 1,000 concurrent requests spins up 1,000 function instances; the spike subsides and they disappear. No capacity planning.</li>
        <li><strong>Pay-per-use</strong> — billed per invocation and per millisecond of execution, not for reserved capacity.</li>
        <li><strong>Event-driven</strong> — functions are triggered by events: an HTTP request, a file upload, a queue message, a schedule.</li>
      </ul>
      <h3>The cold start trade-off</h3>
      <p>When a request arrives and no warm instance exists, the platform must initialize one — load the runtime and your code — before handling it. This <strong>cold start</strong> adds latency (tens to hundreds of ms, more for heavy runtimes). Subsequent requests reuse the warm instance and are fast. Scale-to-zero and cold starts are two sides of the same coin.</p>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>Where it shines, where it doesn't</h5><p>Great for spiky, event-driven, or low/irregular-traffic workloads where paying for idle servers is wasteful. Less suited to steady high-throughput workloads (a reserved server is cheaper at constant load), latency-critical paths sensitive to cold starts, long-running jobs (execution time limits), or anything needing persistent in-memory state (functions are stateless and ephemeral). You also accept vendor lock-in and less control.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 220,
        nodes: [
          { id: "ev", x: 40, y: 85, w: 130, h: 54, label: "Event\n(HTTP, queue…)", kind: "accent" },
          { id: "plat", x: 290, y: 80, w: 150, h: 64, label: "FaaS platform", kind: "warn", glow: true, caption: "spins up on demand" },
          { id: "f1", x: 560, y: 20, w: 150, h: 40, label: "fn instance", kind: "good" },
          { id: "f2", x: 560, y: 90, w: 150, h: 40, label: "fn instance", kind: "good" },
          { id: "f3", x: 560, y: 160, w: 150, h: 40, label: "fn instance", kind: "good" },
        ],
        links: [
          { from: "ev", to: "plat", accent: true }, { from: "plat", to: "f1", color: "#3ddc84" },
          { from: "plat", to: "f2", color: "#3ddc84" }, { from: "plat", to: "f3", color: "#3ddc84", label: "0 → N → 0" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Watch scale-to-zero in action. Send requests; the platform creates instances on demand (first ones pay a cold-start delay), scales up under load, and tears everything down to zero when traffic stops — so idle cost is $0.",
        help: "Click 'Send request' or 'Burst'. Watch cold starts (yellow) vs warm hits (green), and the instance count rise and fall to zero.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 300 });

      let instances = []; // {bornAt, warm, busyUntil, lastUsed}
      let requests = [], acc = 0;
      let served = 0, coldStarts = 0, cost = 0;
      let auto = false, autoAcc = 0;

      SDE.button(refs.controls, "📨 Send request", "primary", () => fire(1));
      SDE.button(refs.controls, "💥 Burst (20)", "", () => fire(20));
      const autoBtn = SDE.button(refs.controls, "▶ Steady traffic", "", () => { auto = !auto; autoBtn.classList.toggle("active", auto); autoBtn.innerHTML = auto ? "⏸ Stop" : "▶ Steady traffic"; });

      const stInst = SDE.stat(refs.stats, "Live instances", "good");
      const stCold = SDE.stat(refs.stats, "Cold starts", "warn");
      const stServed = SDE.stat(refs.stats, "Served", "good");
      const stCost = SDE.stat(refs.stats, "Cost (idle=$0)");

      function fire(n) { for (let i = 0; i < n; i++) requests.push({ bornAt: sim.time + i * 0.03, assigned: false, done: false }); }

      sim.onUpdate = (dt) => {
        if (auto) { autoAcc += dt; if (autoAcc > 0.4) { autoAcc = 0; fire(1); } }
        // assign pending requests to a warm free instance or cold-start a new one
        for (const r of requests) {
          if (r.assigned || sim.time < r.bornAt) continue;
          let inst = instances.find((i) => i.warm && i.busyUntil <= sim.time);
          if (inst) { inst.busyUntil = sim.time + 0.3; r.assigned = true; r.cold = false; r.finishAt = inst.busyUntil; r.inst = inst; }
          else {
            inst = { bornAt: sim.time, warm: false, busyUntil: sim.time + 0.9, lastUsed: sim.time };
            instances.push(inst); coldStarts++;
            r.assigned = true; r.cold = true; r.finishAt = inst.busyUntil; r.inst = inst;
          }
        }
        instances.forEach((i) => { if (!i.warm && sim.time - i.bornAt > 0.6) i.warm = true; });
        for (const r of requests) {
          if (r.assigned && !r.done && sim.time >= r.finishAt) { r.done = true; served++; cost += 0.0002; if (r.inst) r.inst.lastUsed = sim.time; }
        }
        requests = requests.filter((r) => !r.done || sim.time - r.finishAt < 0.5);
        // scale to zero: remove instances idle > 2.5s
        instances = instances.filter((i) => sim.time - i.lastUsed < 2.5 || i.busyUntil > sim.time);
        stInst(instances.length); stCold(coldStarts); stServed(served); stCost("$" + cost.toFixed(4));
      };

      sim.onDraw = (g) => {
        D.text(g, "Serverless function — instances exist only while needed", 40, 32, { color: C.dim, size: 13 });
        if (instances.length === 0) { D.text(g, "💤 scaled to zero — $0 idle cost", 410, 150, { color: C.teal, size: 18, align: "center" }); }
        instances.forEach((inst, i) => {
          const x = 80 + (i % 7) * 100, y = 70 + Math.floor(i / 7) * 90;
          const busy = inst.busyUntil > sim.time;
          const col = !inst.warm ? C.warn : busy ? C.accent : C.good;
          D.node(g, { x, y, w: 84, h: 60, label: !inst.warm ? "cold…" : "fn", sub: busy ? "running" : "warm/idle", fill: !inst.warm ? "#2a2410" : "#10261a", stroke: col, labelColor: col, subColor: C.dim, fontSize: 12 });
        });
        // request dots waiting
        const waiting = requests.filter((r) => r.assigned && !r.done).length;
        D.text(g, "In-flight requests: " + waiting, 40, 280, { color: C.faint, size: 12 });
        D.text(g, "🟡 cold start (first req pays init)   🟩 warm (fast)   💤 scales to zero when idle", 300, 280, { color: C.faint, size: 11 });
      };

      sim.start();
      return sim;
    },
  });
})(window);
