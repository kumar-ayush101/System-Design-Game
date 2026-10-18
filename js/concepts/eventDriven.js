/* Event-Driven Systems — Area 2 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "event-driven",
    title: "Event-Driven Systems",
    tagline: "Services react to events they subscribe to, instead of calling each other directly.",
    diagramNote: "A producer publishes an event to a topic; every interested subscriber reacts independently.",
    gameNote: "Publish an 'OrderPlaced' event and watch it fan out to every subscriber at once. Add or remove subscribers live — the publisher never changes.",

    explanation: `
      <p>In an <strong>event-driven</strong> architecture, components communicate by emitting and reacting to <strong>events</strong> ("something happened") rather than by calling each other directly ("do this now"). The piece that produces an event doesn't know or care who consumes it.</p>
      <h3>Pub/Sub: the core pattern</h3>
      <p><strong>Publish-Subscribe</strong>: a producer <em>publishes</em> an event to a <strong>topic</strong>, and any number of <em>subscribers</em> receive a copy. Unlike a queue (where each message goes to exactly one consumer), pub/sub <strong>fans out</strong> each event to <em>all</em> subscribers.</p>
      <p>When an order is placed, an <code>OrderPlaced</code> event fans out to: the inventory service (reserve stock), the notification service (email the customer), the analytics service (record the sale), and the shipping service — all reacting in parallel. The order service just announces the fact and moves on.</p>
      <h3>Why it's powerful</h3>
      <ul>
        <li><strong>Loose coupling</strong> — add a new subscriber (say, a fraud-detection service) without touching the producer or any existing service. The producer never learns who's listening.</li>
        <li><strong>Scalability & resilience</strong> — subscribers process independently and asynchronously; one slow subscriber doesn't block the others.</li>
      </ul>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>The cost: harder to reason about</h5><p>Control flow is implicit — there's no single place that shows the whole sequence. Debugging "what happened after this event?" requires tracing across services (hence distributed tracing). Eventual consistency and duplicate/out-of-order events must be designed for. The flexibility is real, but so is the operational complexity.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 760, height: 280,
        nodes: [
          { id: "order", x: 40, y: 115, w: 130, h: 54, label: "Order Service", kind: "accent" },
          { id: "topic", x: 300, y: 110, w: 150, h: 60, label: "OrderPlaced\ntopic", kind: "warn", glow: true },
          { id: "inv", x: 580, y: 20, w: 150, h: 44, label: "Inventory", kind: "good" },
          { id: "notif", x: 580, y: 86, w: 150, h: 44, label: "Notifications", kind: "good" },
          { id: "an", x: 580, y: 152, w: 150, h: 44, label: "Analytics", kind: "good" },
          { id: "ship", x: 580, y: 218, w: 150, h: 44, label: "Shipping", kind: "good" },
        ],
        links: [
          { from: "order", to: "topic", accent: true, label: "publish" },
          { from: "topic", to: "inv", color: "#3ddc84" }, { from: "topic", to: "notif", color: "#3ddc84" },
          { from: "topic", to: "an", color: "#3ddc84" }, { from: "topic", to: "ship", color: "#3ddc84" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Feel loose coupling. One event fans out to every subscriber simultaneously. Toggle subscribers on/off and republish — the publisher's code never changes, yet behavior changes.",
        help: "Click a subscriber to toggle it. Press 'Publish OrderPlaced' and watch the fan-out ripple.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 340 });

      const topic = { x: 300, y: 150, w: 150, h: 60 };
      const subs = [
        { name: "Inventory", icon: "📦", on: true, y: 30 },
        { name: "Notifications", icon: "✉️", on: true, y: 100 },
        { name: "Analytics", icon: "📊", on: true, y: 170 },
        { name: "Shipping", icon: "🚚", on: true, y: 240 },
        { name: "Fraud Check", icon: "🕵️", on: false, y: 300 },
      ];
      subs.forEach((s) => { s.x = 620; s.w = 170; s.h = 46; s.flash = 0; });
      let packets = [], published = 0, auto = false, autoAcc = 0;

      SDE.button(refs.controls, "📣 Publish OrderPlaced", "primary", publish);
      const autoBtn = SDE.button(refs.controls, "▶ Auto", "", () => { auto = !auto; autoBtn.classList.toggle("active", auto); autoBtn.innerHTML = auto ? "⏸ Stop" : "▶ Auto"; });

      const stPub = SDE.stat(refs.stats, "Events published");
      const stSubs = SDE.stat(refs.stats, "Active subs", "good");
      const stDel = SDE.stat(refs.stats, "Deliveries", "good");
      let deliveries = 0;

      function publish() {
        published++;
        subs.filter((s) => s.on).forEach((s) => {
          packets.push({ sx: topic.x + topic.w, sy: D.cy(topic), tx: s.x, ty: D.cy(s), t: 0, sub: s });
        });
      }

      sim.on("mousedown", (e) => {
        const p = sim.pointer(e);
        for (const s of subs) if (D.pointInNode(p.x, p.y, s)) { s.on = !s.on; SDE.toast(s.name + (s.on ? " subscribed" : " unsubscribed"), s.icon); }
      });

      sim.onUpdate = (dt) => {
        if (auto) { autoAcc += dt; if (autoAcc > 1.6) { autoAcc = 0; publish(); } }
        for (const p of packets) {
          p.t += dt / 0.7;
          if (p.t >= 1 && !p.arrived) { p.arrived = true; p.sub.flash = 0.6; deliveries++; }
        }
        packets = packets.filter((p) => p.t < 1.2);
        subs.forEach((s) => { if (s.flash > 0) s.flash -= dt; });
        stPub(published); stSubs(subs.filter((s) => s.on).length + "/" + subs.length); stDel(deliveries);
      };

      sim.onDraw = (g) => {
        D.node(g, { x: 40, y: 160, w: 140, h: 54, label: "Order Service", sub: "publisher", fill: "#15223f", stroke: C.accent, labelColor: "#dbe8ff" });
        D.arrow(g, 180, 187, topic.x, D.cy(topic), C.accent, 2);
        D.node(g, { x: topic.x, y: topic.y, w: topic.w, h: topic.h, label: "OrderPlaced", sub: "topic", fill: "#2a2410", stroke: C.warn, glow: 14, labelColor: C.warn, subColor: C.warn });

        for (const s of subs) {
          const col = !s.on ? C.faint : s.flash > 0 ? C.good : C.teal;
          D.line(g, topic.x + topic.w, D.cy(topic), s.x, D.cy(s), s.on ? "rgba(57,208,216,0.3)" : "rgba(90,100,127,0.2)", 1.5, s.on ? null : [4, 4]);
          D.node(g, { x: s.x, y: s.y, w: s.w, h: s.h, label: s.icon + "  " + s.name, sub: s.on ? "subscribed" : "off (click to add)", fill: s.on ? (s.flash > 0 ? "#10261a" : "#0f2a2d") : "#0b0f1a", stroke: col, labelColor: s.on ? C.text : C.faint, subColor: s.on ? C.dim : C.faint, fontSize: 13, r: 9 });
        }

        for (const p of packets) {
          if (p.t > 1) continue;
          const e = U.easeOut(p.t);
          g.fillStyle = C.good; g.shadowColor = C.good; g.shadowBlur = 8;
          g.beginPath(); g.arc(U.lerp(p.sx, p.tx, e), U.lerp(p.sy, p.ty, e), 5, 0, 7); g.fill(); g.shadowBlur = 0;
        }
      };

      sim.start();
      return sim;
    },
  });
})(window);
