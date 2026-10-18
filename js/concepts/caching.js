/* Caching — Area 1 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "caching",
    title: "Caching",
    tagline: "Keep a fast copy of frequently used data so you avoid repeating slow work.",
    diagramNote: "A cache sits between the app and the slow database, serving hot data from memory.",
    gameNote: "Requests pour in. Each one checks the cache first. Tune the cache size and eviction policy to raise your hit rate.",

    explanation: `
      <p>A <strong>cache</strong> is a fast storage layer that holds copies of frequently accessed data to avoid repeating a slow operation — usually a database query or an expensive computation.</p>
      <h3>The cache-aside pattern</h3>
      <p>The most common pattern. On every read, the application:</p>
      <ol>
        <li>Checks the cache first.</li>
        <li><strong>Hit</strong> — the value is there, return it immediately (microseconds).</li>
        <li><strong>Miss</strong> — not there, so read from the database (milliseconds), store the result in the cache, then return it.</li>
      </ol>
      <p>The cache fills <em>lazily</em> with exactly the data that is actually requested, and if the cache goes down the app simply falls back to the database. That graceful degradation is why cache-aside is the default choice.</p>
      <h3>Why a cache can't hold everything</h3>
      <p>Memory is small and expensive compared to disk. A cache holds a tiny fraction of the data, so when it fills up it must <strong>evict</strong> something to make room. The eviction policy decides what to throw out:</p>
      <ul>
        <li><strong>LRU (Least Recently Used)</strong> — evict whatever hasn't been touched for the longest. Great when recent data is likely to be requested again.</li>
        <li><strong>LFU (Least Frequently Used)</strong> — evict whatever is accessed least often. Good for stable "hot" sets.</li>
        <li><strong>FIFO</strong> — evict the oldest inserted item regardless of use. Simple but naive.</li>
      </ul>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>The real trade-off: staleness</h5><p>The cache holds a <em>copy</em>. When the source data changes, the copy is wrong until it expires or is invalidated. Caching is the art of deciding how stale data is allowed to be, which sets your expiry (TTL) and invalidation strategy.</p></div></div>
      <div class="callout tip"><span class="c-ico">📈</span><div><h5>Hit rate is everything</h5><p>A 95% hit rate means 19 of 20 reads never touch the database. Small hit-rate gains massively reduce database load — the whole point of a cache.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 240,
        nodes: [
          { id: "app", x: 40, y: 90, w: 120, h: 54, label: "App", kind: "accent" },
          { id: "cache", x: 300, y: 40, w: 150, h: 54, label: "Cache (RAM)", kind: "teal", glow: true, caption: "microseconds" },
          { id: "db", x: 300, y: 150, w: 150, h: 54, label: "Database (disk)", kind: "purple", caption: "milliseconds" },
        ],
        links: [
          { from: "app", to: "cache", accent: true, label: "1. check" },
          { from: "cache", to: "db", dashed: true, label: "2. miss → load" },
          { from: "db", to: "cache", dashed: true, color: "#39d0d8", label: "3. store" },
        ],
        labels: [{ x: 540, y: 70, text: "HIT → return instantly", color: "#3ddc84", size: 12 }, { x: 540, y: 180, text: "MISS → slow path", color: "#ffca3a", size: 12 }],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Get the hit rate as high as you can. Requests favor a few 'hot' keys (the Zipf reality of real traffic). More cache slots and a smarter policy = fewer trips to the slow database.",
        help: "Change cache size and eviction policy. Watch keys get stored (green = hot) and evicted. The DB meter shows load you're saving.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 340 });

      let capacity = 6;
      let policy = "lru";
      SDE.toolGroup(refs.toolbar, [
        { label: "LRU", value: "lru" }, { label: "LFU", value: "lfu" }, { label: "FIFO", value: "fifo" },
      ], (v) => { policy = v; reset(); });

      const slider = document.createElement("input");
      slider.type = "range"; slider.min = 2; slider.max = 12; slider.value = capacity;
      const sl = document.createElement("span"); sl.className = "mono"; sl.style.color = C.dim;
      sl.textContent = capacity + " slots";
      slider.addEventListener("input", () => { capacity = +slider.value; sl.textContent = capacity + " slots"; trim(); });
      const w = document.createElement("div"); w.className = "flex center"; w.style.gap = "10px";
      w.appendChild(document.createTextNode("Cache size")); w.appendChild(slider); w.appendChild(sl);
      refs.controls.appendChild(w);
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "Reset", "", reset);

      const stHit = SDE.stat(refs.stats, "Hit rate", "good");
      const stHits = SDE.stat(refs.stats, "Hits");
      const stMiss = SDE.stat(refs.stats, "Misses", "bad");
      const stDb = SDE.stat(refs.stats, "DB load saved", "warn");

      // Zipf-ish key popularity: key 0 hottest
      const KEYS = 20;
      const weights = [];
      for (let i = 0; i < KEYS; i++) weights.push(1 / (i + 1));
      const wsum = weights.reduce((a, b) => a + b, 0);
      function pickKey() {
        let r = Math.random() * wsum;
        for (let i = 0; i < KEYS; i++) { r -= weights[i]; if (r <= 0) return i; }
        return KEYS - 1;
      }

      let cache = []; // {key, lastUsed, freq, inserted}
      let hits = 0, miss = 0, tick = 0;
      let flash = null, flashT = 0;
      let packets = [];
      let acc = 0;

      function reset() { cache = []; hits = miss = 0; packets = []; }
      function trim() { while (cache.length > capacity) evict(); }
      function evict() {
        if (!cache.length) return;
        let victim = 0;
        if (policy === "lru") victim = cache.reduce((mi, c, i, a) => (c.lastUsed < a[mi].lastUsed ? i : mi), 0);
        else if (policy === "lfu") victim = cache.reduce((mi, c, i, a) => (c.freq < a[mi].freq ? i : mi), 0);
        else victim = cache.reduce((mi, c, i, a) => (c.inserted < a[mi].inserted ? i : mi), 0);
        cache.splice(victim, 1);
      }

      sim.onUpdate = (dt) => {
        acc += dt * 5;
        while (acc >= 1) {
          acc -= 1; tick++;
          const key = pickKey();
          const hitEntry = cache.find((c) => c.key === key);
          if (hitEntry) {
            hits++; hitEntry.lastUsed = tick; hitEntry.freq++;
            flash = { key, hit: true }; flashT = 0.4;
          } else {
            miss++;
            if (cache.length >= capacity) evict();
            cache.push({ key, lastUsed: tick, freq: 1, inserted: tick });
            flash = { key, hit: false }; flashT = 0.4;
          }
        }
        if (flashT > 0) flashT -= dt;
        const total = hits + miss;
        stHit(total ? Math.round((hits / total) * 100) + "%" : "0%");
        stHits(hits); stMiss(miss);
        stDb(total ? Math.round((hits / total) * 100) + "%" : "0%");
      };

      sim.onDraw = (g) => {
        D.text(g, "Incoming key requests (hot keys are small numbers)", 30, 28, { color: C.dim, size: 12 });
        // request indicator
        if (flash && flashT > 0) {
          const col = flash.hit ? C.good : C.bad;
          g.globalAlpha = U.clamp(flashT / 0.4, 0, 1);
          D.node(g, { x: 30, y: 44, w: 160, h: 40, label: "key #" + flash.key + "  →  " + (flash.hit ? "HIT" : "MISS"), fill: flash.hit ? "#10261a" : "#2a1414", stroke: col, labelColor: col });
          g.globalAlpha = 1;
        }

        // cache slots
        D.text(g, "CACHE (" + cache.length + "/" + capacity + " slots · " + policy.toUpperCase() + ")", 30, 120, { color: C.teal, size: 12 });
        const cols = 6, cw = 110, ch = 46, gap = 12;
        for (let i = 0; i < capacity; i++) {
          const cx = 30 + (i % cols) * (cw + gap);
          const cy = 136 + Math.floor(i / cols) * (ch + gap);
          const entry = cache[i];
          if (entry) {
            const heat = U.clamp(entry.freq / 10, 0, 1);
            const col = heat > 0.6 ? C.good : heat > 0.3 ? C.teal : C.accent;
            D.node(g, { x: cx, y: cy, w: cw, h: ch, label: "key #" + entry.key, sub: "f=" + entry.freq, fill: "#0f2a2d", stroke: col, labelColor: "#cdf7f9" });
          } else {
            D.node(g, { x: cx, y: cy, w: cw, h: ch, label: "empty", fill: "#0b0f1a", stroke: C.line, labelColor: C.faint });
          }
        }

        // db meter
        const total = hits + miss;
        const dbLoad = total ? miss / total : 0;
        D.text(g, "DATABASE (slow path — hit by misses)", 30, 300, { color: C.purple, size: 12 });
        const bx = 30, by = 314, bw = 400, bh = 12;
        g.fillStyle = "rgba(255,255,255,0.08)"; D.roundRect(g, bx, by, bw, bh, 6); g.fill();
        g.fillStyle = dbLoad > 0.5 ? C.bad : dbLoad > 0.25 ? C.warn : C.good;
        D.roundRect(g, bx, by, bw * dbLoad, bh, 6); g.fill();
        D.text(g, Math.round(dbLoad * 100) + "% of reads hit DB", bx + bw + 14, by + 10, { color: C.dim, size: 11, mono: true });
      };

      sim.start();
      return sim;
    },
  });
})(window);
