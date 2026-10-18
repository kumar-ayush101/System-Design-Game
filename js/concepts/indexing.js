/* Indexing — Area 3 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "indexing",
    title: "Indexing",
    tagline: "A side data structure that lets the database jump to matching rows instead of scanning every one.",
    diagramNote: "A B-tree index maps column values to row locations, turning a full scan into a quick seek.",
    gameNote: "Search a table of rows with and without an index. Race a full table scan against a B-tree seek — then see the write-cost trade-off.",

    explanation: `
      <p>An <strong>index</strong> is a separate data structure the database maintains to make certain queries fast. Without one, finding rows that match a condition means scanning <em>every</em> row — a <strong>full table scan</strong>, O(n). With an index, the database jumps straight to the matches.</p>
      <h3>How it works</h3>
      <p>Most indexes are <strong>B-trees</strong> (balanced trees): the column's values are kept sorted, so the database can binary-search to the right range in O(log n) and follow pointers to the actual rows. On a million-row table that's ~20 steps instead of a million. Hash indexes give O(1) exact-match lookups but can't do range queries.</p>
      <h3>The trade-off that catches people out</h3>
      <p>Indexes make <strong>reads</strong> faster but <strong>writes</strong> slower. Every <code>INSERT</code>, <code>UPDATE</code>, or <code>DELETE</code> must also update every index on that table to keep it sorted. A table with ten indexes pays roughly ten times the index-maintenance cost on every write. Indexes also consume storage.</p>
      <div class="callout tip"><span class="c-ico">🎯</span><div><h5>Index the queries you actually run</h5><p>Good indexing isn't "index every column" — it's indexing the columns your real <code>WHERE</code>, <code>JOIN</code>, and <code>ORDER BY</code> clauses use. A composite index on <code>(last_name, first_name)</code> serves queries filtering by last name, or both — but not first name alone. Unused indexes are pure write-cost tax.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 240,
        nodes: [
          { id: "q", x: 40, y: 95, w: 130, h: 50, label: "WHERE id=742", kind: "accent" },
          { id: "idx", x: 290, y: 30, w: 150, h: 50, label: "B-tree index", kind: "good", glow: true, caption: "O(log n) seek" },
          { id: "scan", x: 290, y: 150, w: 150, h: 50, label: "Full scan", kind: "bad", caption: "O(n) — reads all" },
          { id: "table", x: 560, y: 90, w: 140, h: 60, label: "Table\n(1M rows)", kind: "purple" },
        ],
        links: [
          { from: "q", to: "idx", accent: true }, { from: "idx", to: "table", color: "#3ddc84", label: "jump" },
          { from: "q", to: "scan", color: "#ff6b6b" }, { from: "scan", to: "table", color: "#ff6b6b", dashed: true, label: "every row" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Watch why indexes matter. Search for a random key. The unindexed scan checks rows one by one; the indexed seek binary-searches straight to it. Then toggle writes to feel the maintenance cost.",
        help: "Press 'Search' to race scan vs index. Press 'Insert 100 rows' with the index on/off to compare write cost.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      const N = 200;
      let rows = Array.from({ length: N }, (_, i) => i);
      let target = 150;
      let scan = null, seek = null;
      let indexOn = true;
      let writeCost = 0;

      SDE.button(refs.controls, "🔍 Search random key", "primary", () => {
        target = U.randInt(0, rows.length - 1);
        scan = { i: 0, done: false, steps: 0 };
        seek = { lo: 0, hi: rows.length - 1, mid: 0, done: false, steps: 0 };
      });
      const idxBtn = SDE.button(refs.controls, "Index: ON", "active", () => {
        indexOn = !indexOn; idxBtn.classList.toggle("active", indexOn); idxBtn.textContent = "Index: " + (indexOn ? "ON" : "OFF");
      });
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "➕ Insert 100 rows", "", () => {
        for (let i = 0; i < 100; i++) rows.push(rows.length);
        writeCost += indexOn ? 100 * 3 : 100 * 1; // index maintenance multiplier
        SDE.toast("Inserted 100 rows. Write cost +" + (indexOn ? "300" : "100") + (indexOn ? " (index upkeep)" : ""), indexOn ? "🐢" : "⚡");
      });

      const stScan = SDE.stat(refs.stats, "Scan steps", "bad");
      const stSeek = SDE.stat(refs.stats, "Index steps", "good");
      const stRows = SDE.stat(refs.stats, "Rows");
      const stWrite = SDE.stat(refs.stats, "Write cost", "warn");

      let acc = 0;
      sim.onUpdate = (dt) => {
        acc += dt;
        if (acc > 0.03) {
          acc = 0;
          if (scan && !scan.done) { scan.steps++; if (rows[scan.i] === target) scan.done = true; else scan.i++; if (scan.i >= rows.length) scan.done = true; }
          if (seek && !seek.done && indexOn) {
            seek.steps++; seek.mid = (seek.lo + seek.hi) >> 1;
            if (rows[seek.mid] === target) seek.done = true;
            else if (rows[seek.mid] < target) seek.lo = seek.mid + 1; else seek.hi = seek.mid - 1;
            if (seek.lo > seek.hi) seek.done = true;
          }
        }
        stScan(scan ? scan.steps : 0);
        stSeek(indexOn ? (seek ? seek.steps : 0) : "no index");
        stRows(rows.length);
        stWrite(writeCost);
      };

      sim.onDraw = (g) => {
        D.text(g, "Searching for key = " + target + "   (table has " + rows.length + " rows)", 30, 26, { color: C.dim, size: 13 });
        // visualize first 100 rows as a grid
        const cols = 25, cw = 30, ch = 18, ox = 30, oy = 50;
        const shown = Math.min(rows.length, 100);
        for (let i = 0; i < shown; i++) {
          const x = ox + (i % cols) * cw, y = oy + Math.floor(i / cols) * ch;
          let col = "#1a2133";
          if (rows[i] === target) col = C.accent;
          if (scan && scan.i === i && !scan.done) col = C.bad;
          if (indexOn && seek && seek.mid === i && !seek.done) col = C.good;
          g.fillStyle = col; D.roundRect(g, x, y, cw - 3, ch - 3, 3); g.fill();
        }
        D.text(g, "🔴 scan cursor (checks each)   🟢 index probe (binary search)   🔵 target", 30, oy + 4 * ch + 20, { color: C.faint, size: 11 });

        // bars comparing steps
        const by = 200;
        D.text(g, "Full scan: " + (scan ? scan.steps : 0) + " steps", 30, by, { color: C.bad, size: 13 });
        g.fillStyle = "rgba(255,107,107,0.25)"; D.roundRect(g, 30, by + 8, 740, 20, 5); g.fill();
        g.fillStyle = C.bad; D.roundRect(g, 30, by + 8, U.clamp((scan ? scan.steps : 0) / rows.length, 0, 1) * 740, 20, 5); g.fill();

        D.text(g, "Index seek: " + (indexOn ? (seek ? seek.steps : 0) : "— (disabled)") + " steps", 30, by + 50, { color: C.good, size: 13 });
        g.fillStyle = "rgba(61,220,132,0.2)"; D.roundRect(g, 30, by + 58, 740, 20, 5); g.fill();
        if (indexOn) { g.fillStyle = C.good; D.roundRect(g, 30, by + 58, U.clamp((seek ? seek.steps : 0) / Math.max(1, Math.log2(rows.length)) * 0.2, 0, 1) * 740 + 6, 20, 5); g.fill(); }
      };

      sim.start();
      return sim;
    },
  });
})(window);
