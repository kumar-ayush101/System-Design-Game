/* Rate Limiting — Area 1 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "rate-limiting",
    title: "Rate Limiting",
    tagline: "Cap how many requests a client can make, protecting the system from overload and abuse.",
    diagramNote: "The token bucket: tokens drip in at a fixed rate; each request spends one.",
    gameNote: "Fire requests at the token bucket. Each costs a token. Empty bucket = rejected (429). Tune the refill rate and bucket size.",

    explanation: `
      <p><strong>Rate limiting</strong> caps how many requests a client can make in a given period. When a client exceeds the limit, further requests are rejected (classically with HTTP <code>429 Too Many Requests</code>) until the limit resets.</p>
      <h3>Why it exists</h3>
      <ul>
        <li><strong>Protect from overload</strong> — one buggy client in a retry loop shouldn't be able to take down the service for everyone.</li>
        <li><strong>Fair usage</strong> — no single tenant hogs capacity meant to be shared.</li>
        <li><strong>Abuse & cost control</strong> — stop credential-stuffing, scraping, and runaway bills on paid APIs.</li>
      </ul>
      <h3>The token bucket algorithm</h3>
      <p>The most common implementation. Picture a bucket that holds up to <strong>N tokens</strong>. Tokens are added at a steady <strong>refill rate</strong> (say 5 per second) up to the bucket's capacity. Every request must take one token:</p>
      <ul>
        <li>Token available → request allowed, token removed.</li>
        <li>Bucket empty → request rejected.</li>
      </ul>
      <p>The beauty is that it allows <strong>short bursts</strong> (you can spend a full bucket at once) while enforcing a <strong>long-term average</strong> rate (the refill rate). Capacity controls burst size; refill rate controls sustained throughput.</p>
      <div class="callout tip"><span class="c-ico">🪣</span><div><h5>Other algorithms</h5><p><strong>Leaky bucket</strong> smooths output to a constant rate. <strong>Fixed window</strong> counts per calendar window (simple but allows double bursts at the boundary). <strong>Sliding window</strong> fixes that boundary problem at higher cost. Token bucket is the usual default.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 720, height: 240,
        nodes: [
          { id: "client", x: 30, y: 90, w: 110, h: 48, label: "Client", kind: "client" },
          { id: "bucket", x: 290, y: 70, w: 150, h: 90, label: "Token Bucket", kind: "accent", glow: true, caption: "capacity N" },
          { id: "api", x: 580, y: 90, w: 110, h: 48, label: "API", kind: "good" },
        ],
        links: [
          { from: "client", to: "bucket", accent: true, label: "request" },
          { from: "bucket", to: "api", label: "allowed" },
        ],
        labels: [
          { x: 365, y: 50, text: "↓ tokens refill at R/sec", color: "#3ddc84", size: 12, align: "middle" },
          { x: 365, y: 195, text: "empty → 429 rejected", color: "#ff6b6b", size: 12, align: "middle" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Feel the burst-vs-sustained trade-off. Hold the burst button to drain the bucket fast — once it's empty you get 429s until tokens refill. A bigger bucket allows bigger bursts; a faster refill allows higher sustained rate.",
        help: "Click 'Send' or hold 'Burst'. Adjust capacity and refill rate. Green = allowed, red = rejected (429).",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      let capacity = 10;
      let refill = 4; // per sec
      let tokens = capacity;
      let allowed = 0, rejected = 0;
      let bursting = false, burstAcc = 0;
      let flashes = [];

      SDE.button(refs.controls, "Send 1", "primary", () => trySend());
      const burstBtn = SDE.button(refs.controls, "🔥 Burst (hold)", "", () => {});
      burstBtn.addEventListener("mousedown", () => { bursting = true; });
      burstBtn.addEventListener("mouseup", () => { bursting = false; });
      burstBtn.addEventListener("mouseleave", () => { bursting = false; });

      function mkSlider(labelText, min, max, val, onInput) {
        const wrap = document.createElement("div"); wrap.className = "flex center"; wrap.style.gap = "8px"; wrap.style.marginLeft = "auto";
        const s = document.createElement("input"); s.type = "range"; s.min = min; s.max = max; s.value = val;
        const out = document.createElement("span"); out.className = "mono"; out.style.color = C.dim; out.style.minWidth = "60px";
        const upd = () => out.textContent = onInput(+s.value);
        s.addEventListener("input", upd); upd();
        wrap.appendChild(document.createTextNode(labelText)); wrap.appendChild(s); wrap.appendChild(out);
        refs.controls.appendChild(wrap);
      }
      mkSlider("Capacity", 2, 25, capacity, (v) => { capacity = v; if (tokens > capacity) tokens = capacity; return v + " tok"; });
      mkSlider("Refill", 1, 20, refill, (v) => { refill = v; return v + "/s"; });

      const stTokens = SDE.stat(refs.stats, "Tokens", "good");
      const stAllowed = SDE.stat(refs.stats, "Allowed", "good");
      const stRejected = SDE.stat(refs.stats, "429s", "bad");

      function trySend() {
        if (tokens >= 1) { tokens -= 1; allowed++; flashes.push({ ok: true, t: 0.5 }); }
        else { rejected++; flashes.push({ ok: false, t: 0.5 }); }
      }

      sim.onUpdate = (dt) => {
        tokens = Math.min(capacity, tokens + refill * dt);
        if (bursting) { burstAcc += dt; while (burstAcc > 0.08) { burstAcc -= 0.08; trySend(); } }
        flashes.forEach((f) => (f.t -= dt));
        flashes = flashes.filter((f) => f.t > 0).slice(-40);
        stTokens(Math.floor(tokens) + "/" + capacity);
        stAllowed(allowed); stRejected(rejected);
      };

      sim.onDraw = (g) => {
        // bucket drawing
        const bx = 90, by = 60, bw = 150, bh = 200;
        D.text(g, "TOKEN BUCKET", bx + bw / 2, by - 16, { color: C.accent, size: 13, align: "center" });
        g.strokeStyle = C.accent; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by + bh); g.lineTo(bx + bw, by + bh); g.lineTo(bx + bw, by); g.stroke();
        // fill level
        const ratio = tokens / capacity;
        const fillH = bh * ratio;
        const grad = g.createLinearGradient(0, by + bh - fillH, 0, by + bh);
        grad.addColorStop(0, "#6ea8fe"); grad.addColorStop(1, "#39d0d8");
        g.fillStyle = grad; g.fillRect(bx + 3, by + bh - fillH + 1, bw - 6, fillH - 2);
        // token dots
        D.text(g, Math.floor(tokens) + " / " + capacity, bx + bw / 2, by + bh + 24, { color: C.text, size: 16, align: "center", mono: true });
        D.text(g, "refill " + refill + "/s", bx + bw / 2, by + bh + 44, { color: C.good, size: 12, align: "center" });

        // request stream on the right
        D.text(g, "Request results", 340, 50, { color: C.dim, size: 13 });
        let fx = 340, fy = 70;
        for (let i = flashes.length - 1; i >= 0; i--) {
          const f = flashes[i];
          g.globalAlpha = U.clamp(f.t / 0.5 + 0.3, 0, 1);
          const col = f.ok ? C.good : C.bad;
          D.roundRect(g, fx, fy, 70, 26, 6); g.fillStyle = f.ok ? "#10261a" : "#2a1414"; g.fill();
          g.strokeStyle = col; g.lineWidth = 1.3; g.stroke();
          D.text(g, f.ok ? "200 ✓" : "429 ✗", fx + 35, fy + 17, { color: col, size: 12, align: "center", mono: true });
          g.globalAlpha = 1;
          fx += 82; if (fx > 760) { fx = 340; fy += 34; if (fy > 280) break; }
        }
      };

      sim.start();
      return sim;
    },
  });
})(window);
