/* Message Queues — Area 2 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "message-queues",
    title: "Message Queues",
    tagline: "A buffer between producers and consumers that absorbs spikes and decouples them in time.",
    diagramNote: "Producers enqueue messages; the queue holds them; consumers process at their own pace.",
    gameNote: "A producer emits a bursty workload. Watch the queue absorb spikes. Add consumers to drain faster — but watch the queue grow if producers outrun consumers.",

    explanation: `
      <p>A <strong>message queue</strong> sits between <strong>producers</strong> (which create work) and <strong>consumers</strong> (which process it). The producer drops a message in and moves on immediately; the consumer picks messages up and processes them at its own pace.</p>
      <h3>Why decoupling in time matters</h3>
      <ul>
        <li><strong>Spike absorption</strong> — a flash sale produces 10,000 orders in a second, but your payment service can only process 500/s. The queue buffers the backlog so nothing is lost; consumers work through it over the next 20 seconds.</li>
        <li><strong>Independent scaling</strong> — producers and consumers scale separately. Add more consumers to drain the queue faster without touching the producer.</li>
        <li><strong>Resilience</strong> — if consumers crash, messages wait safely in the queue instead of being dropped. When consumers come back, they resume.</li>
      </ul>
      <h3>Delivery and ordering</h3>
      <p>Each message typically goes to exactly one consumer (work distribution). Queues offer guarantees like <strong>at-least-once</strong> delivery (a message may be redelivered on failure — so consumers should be <em>idempotent</em>). A message that keeps failing is moved to a <strong>dead-letter queue</strong> so one poison message can't block the rest.</p>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>The cost: asynchrony</h5><p>Results aren't immediate — the producer doesn't get the answer, just an acknowledgement that the work is queued. And if producers persistently outrun consumers, the queue grows without bound (memory/disk pressure). That's where <strong>backpressure</strong> comes in: signal producers to slow down.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 760, height: 200,
        nodes: [
          { id: "p", x: 40, y: 75, w: 120, h: 50, label: "Producer", kind: "accent" },
          { id: "q", x: 290, y: 70, w: 190, h: 60, label: "Queue (buffer)", kind: "warn", glow: true, caption: "FIFO backlog" },
          { id: "c1", x: 610, y: 30, w: 120, h: 44, label: "Consumer", kind: "good" },
          { id: "c2", x: 610, y: 110, w: 120, h: 44, label: "Consumer", kind: "good" },
        ],
        links: [
          { from: "p", to: "q", accent: true, label: "enqueue" },
          { from: "q", to: "c1", color: "#3ddc84", label: "dequeue" },
          { from: "q", to: "c2", color: "#3ddc84" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Keep the queue from exploding. The producer is bursty. Add consumers so the drain rate keeps up with the fill rate. Too few consumers → backlog grows → latency climbs. Too many → idle, wasted capacity.",
        help: "Use +/- to change consumer count and the producer rate. Watch the queue depth and the oldest-message age (latency).",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      let queue = []; // {id, t}
      let nextId = 1;
      let consumers = 2;
      let prodRate = 8; // avg msgs/s
      let prodAcc = 0, burstPhase = 0;
      let processed = 0, dropped = 0;
      const MAX = 60;
      let consumerBusy = []; // time remaining per consumer

      function syncConsumers() { while (consumerBusy.length < consumers) consumerBusy.push(0); consumerBusy.length = consumers; }
      syncConsumers();

      function stepper(label, get, set, min, max) {
        const wrap = document.createElement("div"); wrap.className = "flex center"; wrap.style.gap = "6px";
        const out = document.createElement("span"); out.className = "mono"; out.style.color = C.dim; out.style.minWidth = "40px";
        const minus = document.createElement("button"); minus.className = "gbtn"; minus.textContent = "−";
        const plus = document.createElement("button"); plus.className = "gbtn"; plus.textContent = "+";
        const upd = () => out.textContent = get();
        minus.onclick = () => { set(Math.max(min, get() - 1)); upd(); }; plus.onclick = () => { set(Math.min(max, get() + 1)); upd(); };
        wrap.appendChild(document.createTextNode(label)); wrap.appendChild(minus); wrap.appendChild(out); wrap.appendChild(plus);
        refs.controls.appendChild(wrap); upd();
      }
      stepper("Consumers", () => consumers, (v) => { consumers = v; syncConsumers(); }, 1, 8);
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      stepper("Producer rate", () => prodRate, (v) => prodRate = v, 1, 30);

      const stDepth = SDE.stat(refs.stats, "Queue depth", "warn");
      const stAge = SDE.stat(refs.stats, "Oldest age", "bad");
      const stProc = SDE.stat(refs.stats, "Processed", "good");
      const stDrop = SDE.stat(refs.stats, "Dropped (full)", "bad");

      sim.onUpdate = (dt) => {
        // bursty producer: sine-modulated rate
        burstPhase += dt;
        const burstMult = 0.4 + Math.max(0, Math.sin(burstPhase * 0.8)) * 2.2;
        prodAcc += dt * prodRate * burstMult;
        while (prodAcc >= 1) {
          prodAcc -= 1;
          if (queue.length < MAX) queue.push({ id: nextId++, t: sim.time }); else dropped++;
        }
        // consumers each take ~0.35s per message
        for (let i = 0; i < consumerBusy.length; i++) {
          consumerBusy[i] -= dt;
          if (consumerBusy[i] <= 0 && queue.length) { queue.shift(); processed++; consumerBusy[i] = 0.35; }
        }
        stDepth(queue.length + "/" + MAX);
        stAge(queue.length ? (sim.time - queue[0].t).toFixed(1) + "s" : "0s");
        stProc(processed); stDrop(dropped);
      };

      sim.onDraw = (g) => {
        D.node(g, { x: 30, y: 130, w: 120, h: 56, label: "Producer", sub: "bursty", fill: "#15223f", stroke: C.accent, labelColor: "#dbe8ff" });

        // queue as stacked slots
        const qx = 210, qy = 60, slotW = 9, cols = MAX;
        D.text(g, "QUEUE", qx, qy - 14, { color: C.warn, size: 13 });
        g.strokeStyle = C.line; g.lineWidth = 1.5; D.roundRect(g, qx, qy, cols * slotW + 8, 180, 8); g.stroke();
        for (let i = 0; i < queue.length; i++) {
          const age = sim.time - queue[i].t;
          const col = age > 3 ? C.bad : age > 1.5 ? C.warn : C.good;
          const row = Math.floor(i / 30), c = i % 30;
          g.fillStyle = col; D.roundRect(g, qx + 6 + c * slotW, qy + 10 + row * 80, slotW - 2, 70, 2); g.fill();
        }
        const fillRatio = queue.length / MAX;
        if (fillRatio > 0.85) D.text(g, "⚠ nearly full — backpressure needed!", qx, qy + 200, { color: C.bad, size: 12 });

        // consumers
        const cx = qx + cols * slotW + 40;
        D.text(g, "CONSUMERS (" + consumers + ")", cx, 46, { color: C.good, size: 13 });
        for (let i = 0; i < consumers; i++) {
          const busy = consumerBusy[i] > 0;
          D.node(g, { x: cx, y: 60 + i * 34, w: 150, h: 28, label: "worker " + (i + 1) + (busy ? " ⚙" : " idle"), fill: busy ? "#10261a" : "#0b0f1a", stroke: busy ? C.good : C.line, labelColor: busy ? C.good : C.faint, fontSize: 12, r: 7 });
        }
      };

      sim.start();
      return sim;
    },
  });
})(window);
