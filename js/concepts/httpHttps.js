/* HTTP / HTTPS — Area 2 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "http-https",
    title: "HTTP / HTTPS",
    tagline: "The request/response protocol of the web — and the TLS layer that makes it private.",
    diagramNote: "A client sends a request; the server returns a response. HTTPS wraps it in an encrypted TLS tunnel.",
    gameNote: "Send requests and watch the full round trip. Flip to HTTPS to see the TLS handshake happen first, then encrypted traffic that an eavesdropper can't read.",

    explanation: `
      <p><strong>HTTP</strong> (HyperText Transfer Protocol) is the request/response protocol the web runs on. A client sends a <strong>request</strong> (method + path + headers + optional body); the server returns a <strong>response</strong> (status code + headers + body). It is <em>stateless</em> — each request stands alone, carrying everything the server needs.</p>
      <h3>Anatomy of a request</h3>
      <ul>
        <li><strong>Method</strong> — <code>GET</code> (read), <code>POST</code> (create), <code>PUT</code>/<code>PATCH</code> (update), <code>DELETE</code>.</li>
        <li><strong>Status codes</strong> — <code>2xx</code> success, <code>3xx</code> redirect, <code>4xx</code> client error (e.g. 404, 429), <code>5xx</code> server error.</li>
        <li><strong>Headers</strong> — metadata like content type, caching rules, and auth tokens.</li>
      </ul>
      <h3>HTTPS = HTTP + TLS</h3>
      <p>Plain HTTP sends everything in the clear — anyone between the client and server (your ISP, a coffee-shop router) can read and tamper with it. <strong>HTTPS</strong> runs HTTP inside a <strong>TLS</strong> tunnel that provides three things:</p>
      <ul>
        <li><strong>Encryption</strong> — eavesdroppers see only ciphertext.</li>
        <li><strong>Integrity</strong> — tampering is detected.</li>
        <li><strong>Authentication</strong> — the server proves its identity with a certificate signed by a trusted authority, so you know you're really talking to the bank.</li>
      </ul>
      <p>Before any data flows, the two sides perform a <strong>TLS handshake</strong>: agree on a cipher, verify the certificate, and derive a shared session key. This costs a round trip or two up front, which is why connection reuse (keep-alive, HTTP/2 multiplexing) matters.</p>
      <div class="callout tip"><span class="c-ico">🔒</span><div><h5>Today, HTTPS is the default</h5><p>Modern browsers mark plain HTTP as "Not Secure." HTTP/2 and HTTP/3 (over QUIC/UDP) further cut latency with multiplexing and faster handshakes — but the request/response mental model stays the same.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 240,
        nodes: [
          { id: "client", x: 40, y: 95, w: 120, h: 54, label: "Browser", kind: "accent" },
          { id: "tls", x: 300, y: 60, w: 150, h: 120, label: "TLS tunnel", kind: "good", caption: "encrypted" },
          { id: "server", x: 580, y: 95, w: 120, h: 54, label: "Server", kind: "purple" },
        ],
        links: [
          { from: "client", to: "server", accent: true, label: "request" },
          { from: "server", to: "client", color: "#8b7bff", label: "response" },
        ],
        zones: [{ x: 280, y: 40, w: 190, h: 160, label: "HTTPS", dashed: true }],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Compare HTTP vs HTTPS. In HTTP, the eavesdropper reads your data in plaintext. In HTTPS, a one-time TLS handshake happens, then all traffic is ciphertext the eavesdropper can't read.",
        help: "Toggle HTTP/HTTPS, then click 'Send request'. Watch the packet travel and what the 👁 eavesdropper captures.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      let secure = false;
      let handshakeDone = false;
      let packets = [];
      let captured = [];
      let sent = 0;

      SDE.toolGroup(refs.toolbar, [
        { label: "HTTP (plaintext)", value: false }, { label: "HTTPS (TLS)", value: true },
      ], (v) => { secure = v; handshakeDone = false; captured = []; });

      SDE.button(refs.controls, "Send request", "primary", send);
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "Reset", "", () => { captured = []; packets = []; sent = 0; handshakeDone = false; });

      const stMode = SDE.stat(refs.stats, "Mode");
      const stSent = SDE.stat(refs.stats, "Requests");
      const stLeak = SDE.stat(refs.stats, "Eavesdropper sees", "bad");

      const SECRET = "password=hunter2";
      function send() {
        sent++;
        if (secure && !handshakeDone) {
          // handshake packets
          ["ClientHello", "ServerHello+cert", "key exchange ✓"].forEach((lbl, i) => {
            packets.push(mkPacket(i % 2 === 0, "#3ddc84", lbl, i * 0.5, true));
          });
          handshakeDone = true;
          setTimeout(() => doReq(), 1700);
        } else doReq();
      }
      function doReq() {
        packets.push(mkPacket(true, secure ? C.good : C.accent, secure ? "⬛⬛ encrypted" : SECRET, 0, false));
      }
      function mkPacket(forward, color, label, delay, hs) {
        return { forward, color, label, hs, t: -delay, dur: 1.1, done: false, captured: false };
      }

      sim.onUpdate = (dt) => {
        for (const p of packets) {
          p.t += dt;
          if (p.t > 0 && p.t <= p.dur) {
            const frac = p.t / p.dur;
            // when passing eavesdropper (middle), capture
            if (!p.captured && frac > 0.45 && frac < 0.55) {
              p.captured = true;
              if (p.forward && !p.hs) {
                captured.push(secure ? "⬛⬛⬛ (ciphertext)" : SECRET);
                if (captured.length > 5) captured.shift();
              }
            }
          }
          if (p.t > p.dur + 0.3) p.done = true;
        }
        packets = packets.filter((p) => !p.done);
        stMode(secure ? "🔒 HTTPS" : "🔓 HTTP");
        stSent(sent);
        stLeak(secure ? "nothing 🔒" : (captured.length ? "secrets!" : "—"));
      };

      sim.onDraw = (g) => {
        const cx = 70, sx = 700, mid = 400;
        D.node(g, { x: cx - 30, y: 120, w: 120, h: 56, label: "Browser", fill: "#15223f", stroke: C.accent, labelColor: "#dbe8ff" });
        D.node(g, { x: sx - 30, y: 120, w: 120, h: 56, label: "Server", fill: "#1d1838", stroke: C.purple, labelColor: "#e2dcff" });
        // eavesdropper
        D.text(g, "👁", mid, 90, { size: 26, align: "center" });
        D.text(g, "eavesdropper", mid, 112, { color: C.bad, size: 11, align: "center" });
        D.line(g, mid, 100, mid, 148, "rgba(255,107,107,0.25)", 1.5, [4, 4]);

        if (secure) {
          g.fillStyle = "rgba(61,220,132,0.05)"; D.roundRect(g, cx + 90, 108, sx - cx - 90, 80, 10); g.fill();
          g.strokeStyle = "rgba(61,220,132,0.35)"; g.setLineDash([6, 5]); g.lineWidth = 1.4; g.stroke(); g.setLineDash([]);
          D.text(g, "🔒 TLS tunnel", (cx + sx) / 2, 180, { color: C.good, size: 11, align: "center" });
        }
        D.line(g, cx + 90, 148, sx - 30, 148, C.line, 1.5);

        for (const p of packets) {
          if (p.t < 0 || p.t > p.dur) continue;
          const frac = p.t / p.dur;
          const x = p.forward ? U.lerp(cx + 90, sx - 30, frac) : U.lerp(sx - 30, cx + 90, frac);
          g.fillStyle = p.color; g.shadowColor = p.color; g.shadowBlur = 8;
          g.beginPath(); g.arc(x, 148, 6, 0, 7); g.fill(); g.shadowBlur = 0;
          D.text(g, p.label, x, p.forward ? 134 : 172, { color: p.color, size: 11, align: "center", mono: true });
        }

        // capture log
        D.text(g, "What the eavesdropper captured:", 40, 232, { color: C.dim, size: 12 });
        captured.slice().reverse().forEach((c, i) => {
          D.text(g, "• " + c, 50, 254 + i * 18, { color: secure ? C.good : C.bad, size: 12, mono: true });
        });
        if (!captured.length) D.text(g, "— nothing yet —", 50, 254, { color: C.faint, size: 12 });
      };

      sim.start();
      return sim;
    },
  });
})(window);
