/* gRPC — Area 2 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "grpc",
    title: "gRPC",
    tagline: "A fast, contract-first RPC framework for service-to-service calls using Protobuf over HTTP/2.",
    diagramNote: "A .proto contract generates client + server stubs; calls travel as compact binary over one HTTP/2 connection.",
    gameNote: "Race REST+JSON against gRPC+Protobuf. Send a burst of calls and compare payload size and total time over a multiplexed connection.",

    explanation: `
      <p><strong>gRPC</strong> is a Remote Procedure Call framework: instead of thinking in resources and URLs, you call a method on a remote service as if it were a local function — <code>GetUser(id)</code> returns a <code>User</code>. It's designed for fast, strongly-typed <em>service-to-service</em> communication.</p>
      <h3>What makes it fast</h3>
      <ul>
        <li><strong>Protocol Buffers (Protobuf)</strong> — a compact <em>binary</em> serialization format. The same message that's ~120 bytes of JSON text might be ~30 bytes of Protobuf, and it parses faster.</li>
        <li><strong>HTTP/2 transport</strong> — one long-lived connection multiplexes many concurrent calls (no per-request handshake), with header compression and server push.</li>
        <li><strong>Contract-first</strong> — you define the service and messages in a <code>.proto</code> file, and gRPC generates type-safe client and server stubs in every language. The contract is the single source of truth.</li>
      </ul>
      <h3>Streaming built in</h3>
      <p>Unlike plain request/response, gRPC supports <strong>streaming</strong>: server-streaming (one request, many responses), client-streaming, and bidirectional streaming over the single connection.</p>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>REST vs gRPC</h5><p>gRPC wins for internal microservice calls where speed, typed contracts, and streaming matter. REST wins at the public edge: it's human-readable, debuggable in a browser, cache-friendly, and needs no special client. Binary Protobuf isn't natively callable from a browser without a proxy. Many systems use both — REST at the edge, gRPC between services.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 250,
        nodes: [
          { id: "proto", x: 300, y: 20, w: 150, h: 44, label: ".proto contract", kind: "warn", caption: "source of truth" },
          { id: "cstub", x: 60, y: 120, w: 150, h: 50, label: "Client stub", kind: "accent" },
          { id: "sstub", x: 540, y: 120, w: 150, h: 50, label: "Server stub", kind: "purple" },
        ],
        links: [
          { from: "proto", to: "cstub", dashed: true, label: "generates" },
          { from: "proto", to: "sstub", dashed: true, label: "generates" },
          { from: "cstub", to: "sstub", accent: true, bidir: true, label: "Protobuf / HTTP2" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> See why internal services often prefer gRPC. Fire the same batch of calls both ways. gRPC sends smaller binary payloads over one reused HTTP/2 connection; REST sends larger JSON and pays more per call.",
        help: "Click 'Send 20 calls'. Watch the two lanes race and compare total bytes + time.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      let race = null; // {rest:{done,bytes,t}, grpc:{...}}
      SDE.button(refs.controls, "Send 20 calls", "primary", start);
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "Reset", "", () => { race = null; });

      const stRestB = SDE.stat(refs.stats, "REST bytes", "warn");
      const stGrpcB = SDE.stat(refs.stats, "gRPC bytes", "good");
      const stWin = SDE.stat(refs.stats, "Winner");

      function start() {
        race = {
          rest: { lane: 0.7, speed: 180, x: 120, bytesPer: 140, handshake: 0.4, done: false, calls: 0 },
          grpc: { lane: 1.0, speed: 320, x: 120, bytesPer: 32, handshake: 0.05, done: false, calls: 0 },
          total: 20, t: 0,
        };
      }

      sim.onUpdate = (dt) => {
        if (!race) return;
        race.t += dt;
        for (const k of ["rest", "grpc"]) {
          const r = race[k];
          if (r.done) continue;
          if (race.t < r.handshake) continue; // connection setup cost
          r.x += r.speed * dt;
          r.calls = Math.min(race.total, Math.floor((r.x - 120) / 32));
          if (r.x >= 700) { r.done = true; r.finishT = race.t; r.calls = race.total; }
        }
        stRestB((race.rest.calls * race.rest.bytesPer) + " B");
        stGrpcB((race.grpc.calls * race.grpc.bytesPer) + " B");
        if (race.rest.done && race.grpc.done) {
          stWin("gRPC " + (race.rest.finishT / race.grpc.finishT).toFixed(1) + "× faster");
        } else stWin("racing…");
      };

      sim.onDraw = (g) => {
        if (!race) { D.text(g, "Press 'Send 20 calls' to race REST vs gRPC", 410, 160, { color: C.dim, size: 15, align: "center" }); return; }
        const lanes = [{ k: "rest", y: 110, col: C.warn, name: "REST + JSON" }, { k: "grpc", y: 220, col: C.good, name: "gRPC + Protobuf" }];
        for (const L of lanes) {
          const r = race[L.k];
          D.text(g, L.name, 40, L.y - 36, { color: L.col, size: 14 });
          // track
          g.strokeStyle = C.line; g.lineWidth = 2; g.setLineDash([6, 6]);
          g.beginPath(); g.moveTo(120, L.y); g.lineTo(700, L.y); g.stroke(); g.setLineDash([]);
          D.text(g, "📨", 90, L.y + 6, { size: 18, align: "center" });
          D.text(g, "🖥", 720, L.y + 6, { size: 18, align: "center" });
          // packet
          g.fillStyle = L.col; g.shadowColor = L.col; g.shadowBlur = 10;
          const w = L.k === "rest" ? 34 : 16;
          D.roundRect(g, r.x - w / 2, L.y - 9, w, 18, 4); g.fill(); g.shadowBlur = 0;
          D.text(g, L.k === "rest" ? "{json}" : "▪", r.x, L.y + 4, { color: "#0a0e1a", size: 10, align: "center", mono: true });
          D.text(g, r.calls + "/" + race.total + " calls · " + (r.calls * r.bytesPer) + " B", 40, L.y + 40, { color: C.dim, size: 12, mono: true });
          if (r.done) D.text(g, "✓ " + r.finishT.toFixed(2) + "s", 620, L.y - 36, { color: L.col, size: 13 });
        }
      };

      sim.start();
      return sim;
    },
  });
})(window);
