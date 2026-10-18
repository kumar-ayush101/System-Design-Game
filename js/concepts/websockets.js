/* WebSockets — Area 2 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "websockets",
    title: "WebSockets",
    tagline: "A persistent, two-way connection so the server can push data the instant it happens.",
    diagramNote: "After an HTTP upgrade handshake, one open connection carries messages both directions.",
    gameNote: "Compare HTTP polling against a WebSocket. New messages arrive on the server — see which client gets them instantly and how much wasted traffic polling creates.",

    explanation: `
      <p>A <strong>WebSocket</strong> is a protocol that establishes a persistent, <strong>bidirectional</strong> connection between client and server. Once open, either side can send data at any time — no new connection, no repeated handshake per message.</p>
      <h3>The problem it solves</h3>
      <p>Plain HTTP is client-initiated: the server can only speak when asked. To show "live" data over HTTP you have to <strong>poll</strong> — ask again and again ("any new messages? any new messages?"). Polling is wasteful (most responses are "nothing new") and laggy (updates wait until the next poll). WebSockets flip this: the server <em>pushes</em> the moment something happens.</p>
      <h3>How a connection starts</h3>
      <p>It begins as a normal HTTP request with an <code>Upgrade: websocket</code> header. The server agrees, and the same TCP connection is "upgraded" into a full-duplex WebSocket that stays open.</p>
      <h3>Where it's the right tool</h3>
      <ul>
        <li>Chat and live collaboration (Google Docs cursors).</li>
        <li>Multiplayer games.</li>
        <li>Live trading / dashboards where latency matters both ways.</li>
      </ul>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>The scaling challenge</h5><p>Each WebSocket is <em>stateful and long-lived</em> — the server holds the connection open. To scale across many servers you need a <strong>connection registry</strong> (which user is on which server) and a <strong>pub/sub backplane</strong> (e.g. Redis) to route a message to the server holding the target connection. If you only need one-way server→client push, <strong>Server-Sent Events</strong> are simpler.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 220,
        nodes: [
          { id: "a", x: 60, y: 85, w: 140, h: 50, label: "Client A", kind: "accent" },
          { id: "srv", x: 310, y: 80, w: 140, h: 60, label: "WS Server", kind: "good", glow: true },
          { id: "b", x: 560, y: 85, w: 140, h: 50, label: "Client B", kind: "accent" },
        ],
        links: [
          { from: "a", to: "srv", accent: true, bidir: true, label: "open socket" },
          { from: "srv", to: "b", accent: true, bidir: true, label: "open socket" },
        ],
        labels: [{ x: 375, y: 40, text: "server pushes to both the instant a message arrives", color: "#3ddc84", size: 12, align: "middle" }],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> See push vs poll. New events pop on the server randomly. The WebSocket client gets each one instantly with no wasted requests. The polling client only sees it on its next poll — and burns requests even when nothing's new.",
        help: "Click 'New event' (or auto). Adjust polling interval. Compare 'wasted polls' vs instant delivery.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      let events = []; // {id, bornAt, wsSeen, pollSeen}
      let nextId = 1;
      let pollInterval = 1.5, pollTimer = 0;
      let wastedPolls = 0, usefulPolls = 0;
      let auto = false, autoAcc = 0;
      let flyers = [];

      SDE.button(refs.controls, "⚡ New event", "primary", spawn);
      const autoBtn = SDE.button(refs.controls, "▶ Auto", "", () => { auto = !auto; autoBtn.classList.toggle("active", auto); autoBtn.innerHTML = auto ? "⏸ Stop" : "▶ Auto"; });
      const slider = document.createElement("input"); slider.type = "range"; slider.min = 5; slider.max = 40; slider.value = pollInterval * 10;
      const sl = document.createElement("span"); sl.className = "mono"; sl.style.color = C.dim; sl.textContent = pollInterval.toFixed(1) + "s poll";
      slider.addEventListener("input", () => { pollInterval = +slider.value / 10; sl.textContent = pollInterval.toFixed(1) + "s poll"; });
      const w = document.createElement("div"); w.className = "flex center"; w.style.gap = "8px"; w.style.marginLeft = "auto";
      w.appendChild(document.createTextNode("Poll every")); w.appendChild(slider); w.appendChild(sl);
      refs.controls.appendChild(w);

      const stWs = SDE.stat(refs.stats, "WS latency", "good");
      const stPoll = SDE.stat(refs.stats, "Poll latency", "warn");
      const stWaste = SDE.stat(refs.stats, "Wasted polls", "bad");

      function spawn() {
        const ev = { id: nextId++, bornAt: sim.time, wsSeen: false, pollSeen: false, wsLat: 0, pollLat: 0 };
        events.push(ev);
        // WS delivers instantly
        setTimeout(() => { ev.wsSeen = true; ev.wsLat = 0.03; flyers.push({ lane: "ws", t: 0 }); }, 30);
        if (events.length > 8) events.shift();
      }

      sim.onUpdate = (dt) => {
        if (auto) { autoAcc += dt; if (autoAcc > 2.2) { autoAcc = 0; spawn(); } }
        pollTimer += dt;
        if (pollTimer >= pollInterval) {
          pollTimer = 0;
          const unseen = events.filter((e) => !e.pollSeen);
          if (unseen.length) { unseen.forEach((e) => { e.pollSeen = true; e.pollLat = sim.time - e.bornAt; }); usefulPolls++; flyers.push({ lane: "poll", t: 0, useful: true }); }
          else { wastedPolls++; flyers.push({ lane: "poll", t: 0, useful: false }); }
        }
        flyers.forEach((f) => (f.t += dt));
        flyers = flyers.filter((f) => f.t < 0.8);
        const wsLats = events.filter((e) => e.wsSeen).map((e) => e.wsLat);
        const pollLats = events.filter((e) => e.pollSeen).map((e) => e.pollLat);
        stWs(wsLats.length ? "~0.03s" : "—");
        stPoll(pollLats.length ? (pollLats.reduce((a, b) => a + b, 0) / pollLats.length).toFixed(2) + "s" : "—");
        stWaste(wastedPolls + " / " + (wastedPolls + usefulPolls));
      };

      sim.onDraw = (g) => {
        const srvX = 400;
        D.node(g, { x: srvX - 70, y: 20, w: 140, h: 50, label: "Server", fill: "#10261a", stroke: C.good, labelColor: C.good });
        // pending events on server
        D.text(g, "Pending events: " + events.filter(e => !e.pollSeen || !e.wsSeen).length, srvX, 90, { color: C.dim, size: 12, align: "center" });

        // WS lane (left)
        D.node(g, { x: 40, y: 140, w: 150, h: 54, label: "WebSocket client", fill: "#15223f", stroke: C.accent, labelColor: "#dbe8ff" });
        D.line(g, 115, 140, srvX, 70, C.accent, 2);
        D.text(g, "persistent socket (push)", 115, 215, { color: C.accent, size: 11, align: "center" });

        // Poll lane (right)
        D.node(g, { x: 630, y: 140, w: 150, h: 54, label: "Polling client", fill: "#2a2410", stroke: C.warn, labelColor: C.warn });
        D.line(g, 705, 140, srvX, 70, C.warn, 2);
        D.text(g, "asks every " + pollInterval.toFixed(1) + "s", 705, 215, { color: C.warn, size: 11, align: "center" });

        // flyers
        for (const f of flyers) {
          if (f.lane === "ws") {
            const x = U.lerp(srvX, 115, f.t / 0.8), y = U.lerp(70, 160, f.t / 0.8);
            g.fillStyle = C.good; g.shadowColor = C.good; g.shadowBlur = 8; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.shadowBlur = 0;
          } else {
            const x = U.lerp(705, srvX, f.t / 0.8), y = U.lerp(160, 70, f.t / 0.8);
            g.fillStyle = f.useful ? C.good : C.bad; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
          }
        }
        D.text(g, "🟩 push / useful poll   🟥 wasted poll (nothing new)", 40, 300, { color: C.faint, size: 11 });
      };

      sim.start();
      return sim;
    },
  });
})(window);
