/* Sharding — Area 1 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "sharding",
    title: "Sharding",
    tagline: "Split data across many databases so each holds only a slice of the whole.",
    diagramNote: "A shard key decides which database stores each piece of data.",
    gameNote: "Choose a shard key. Watch 1000 records fall into shards. A good key spreads evenly; a bad one creates a hot shard.",

    explanation: `
      <p><strong>Sharding</strong> splits data across multiple databases (shards) so each one holds only a portion. A <strong>shard key</strong> determines which shard stores each record. Sharding scales both write throughput and storage, because the load is divided across many machines instead of piling onto one.</p>
      <h3>How a record finds its shard</h3>
      <p>You take the shard key of a record and run it through a function — often <code>hash(key) % numShards</code> — to get a shard number. Everything with that key lands on that shard.</p>
      <h3>The hardest part: choosing the shard key</h3>
      <ul>
        <li>A <strong>good shard key</strong> has high cardinality and even access — e.g. <code>user_id</code> hashed. Data and traffic spread uniformly across shards.</li>
        <li>A <strong>bad shard key</strong> clusters traffic — e.g. <code>country</code> when 60% of users are in one country, or <code>status</code> which only has a few values. One shard gets slammed (a <strong>hot partition</strong>) while others sit idle. You've added complexity for nothing.</li>
      </ul>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>Cross-shard queries are expensive</h5><p>A query that spans shards must run on each one and have its results merged. "Get all users in city X" is cheap if you shard by city, brutal if you shard by user id. Pick the key that matches your <em>dominant</em> query pattern — and accept the others get slower.</p></div></div>
      <div class="callout tradeoff"><span class="c-ico">⚠️</span><div><h5>Resharding hurts</h5><p>Adding a shard with naive <code>% N</code> hashing moves almost all keys. This is exactly the pain that <strong>consistent hashing</strong> solves — see the Data & Distributed Systems area.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 240,
        nodes: [
          { id: "router", x: 40, y: 90, w: 150, h: 56, label: "Shard Router", kind: "accent", glow: true, caption: "hash(key) % N" },
          { id: "s0", x: 320, y: 20, w: 120, h: 44, label: "Shard 0", kind: "teal", caption: "users a–g" },
          { id: "s1", x: 320, y: 90, w: 120, h: 44, label: "Shard 1", kind: "teal", caption: "users h–n" },
          { id: "s2", x: 320, y: 160, w: 120, h: 44, label: "Shard 2", kind: "teal", caption: "users o–z" },
        ],
        links: [
          { from: "router", to: "s0", accent: true }, { from: "router", to: "s1", accent: true }, { from: "router", to: "s2", accent: true },
        ],
        labels: [{ x: 520, y: 115, text: "Each shard = independent DB", color: "#9aa6c2", size: 12 }],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Spread the data evenly. Drop 1000 records and compare the shard heights. Even bars = good key. One giant bar = a hot shard that becomes your new bottleneck.",
        help: "Pick a shard key. 'user_id (hashed)' is well-distributed; 'country' and 'status' are skewed like real-world data.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 340 });

      const SHARDS = 6;
      let shards = new Array(SHARDS).fill(0);
      let key = "userhash";
      let total = 0;
      let spawning = false, toSpawn = 0, acc = 0;

      SDE.toolGroup(refs.toolbar, [
        { label: "user_id (hashed)", value: "userhash" },
        { label: "country", value: "country" },
        { label: "status", value: "status" },
        { label: "timestamp (sequential)", value: "time" },
      ], (v) => { key = v; });

      SDE.button(refs.controls, "Drop 1000 records", "primary", () => { toSpawn += 1000; spawning = true; });
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "Reset", "", () => { shards = new Array(SHARDS).fill(0); total = 0; toSpawn = 0; });

      const stTotal = SDE.stat(refs.stats, "Records");
      const stHot = SDE.stat(refs.stats, "Hottest shard", "bad");
      const stSkew = SDE.stat(refs.stats, "Skew", "warn");

      // Distributions
      function assign() {
        if (key === "userhash") return U.randInt(0, SHARDS - 1); // uniform
        if (key === "country") { // skewed: shard 0 heavy
          const r = Math.random();
          if (r < 0.55) return 0; if (r < 0.7) return 1; if (r < 0.82) return 2; if (r < 0.9) return 3; if (r < 0.96) return 4; return 5;
        }
        if (key === "status") { // only 3 values used
          return U.choice([0, 0, 0, 1, 1, 2]);
        }
        if (key === "time") { // sequential: everything to newest shard
          return SHARDS - 1;
        }
        return 0;
      }

      sim.onUpdate = (dt) => {
        if (spawning && toSpawn > 0) {
          acc += dt * 2500;
          while (acc >= 1 && toSpawn > 0) { acc -= 1; toSpawn--; shards[assign()]++; total++; }
          if (toSpawn <= 0) spawning = false;
        }
        stTotal(total);
        const max = Math.max(...shards), min = Math.min(...shards);
        stHot(total ? Math.round((max / total) * 100) + "%" : "0%");
        const avg = total / SHARDS;
        const skew = avg ? ((max - avg) / avg) : 0;
        stSkew(total ? skew.toFixed(1) + "×" : "0×");
      };

      sim.onDraw = (g) => {
        D.text(g, "Records per shard — key: " + key, 30, 28, { color: C.dim, size: 13 });
        const max = Math.max(1, ...shards);
        const baseY = 300, barW = 100, gap = 24, maxH = 220;
        for (let i = 0; i < SHARDS; i++) {
          const x = 40 + i * (barW + gap);
          const h = (shards[i] / max) * maxH;
          const ratio = total ? shards[i] / (total / SHARDS) : 0;
          const col = ratio > 1.8 ? C.bad : ratio > 1.25 ? C.warn : C.teal;
          g.fillStyle = "rgba(255,255,255,0.05)"; D.roundRect(g, x, baseY - maxH, barW, maxH, 8); g.fill();
          g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 12;
          D.roundRect(g, x, baseY - h, barW, h, 8); g.fill(); g.shadowBlur = 0;
          D.text(g, "Shard " + i, x + barW / 2, baseY + 20, { color: C.dim, size: 12, align: "center" });
          D.text(g, String(shards[i]), x + barW / 2, baseY - h - 10, { color: col, size: 13, align: "center", mono: true });
          if (ratio > 1.8) D.text(g, "🔥 HOT", x + barW / 2, baseY - h - 28, { color: C.bad, size: 12, align: "center" });
        }
      };

      sim.start();
      return sim;
    },
  });
})(window);
