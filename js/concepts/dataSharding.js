/* Database Sharding & Consistent Hashing — Area 3 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "data-sharding",
    title: "Consistent Hashing",
    tagline: "Add or remove shards while moving as little data as possible.",
    diagramNote: "Keys and nodes are placed on a ring; each key belongs to the next node clockwise.",
    gameNote: "Place keys on a hash ring, then add/remove a node. Compare naive 'mod N' hashing (massive reshuffle) with consistent hashing (tiny reshuffle).",

    explanation: `
      <p>Sharding (Area 1) splits data across nodes using a shard key. The naive mapping is <code>hash(key) % N</code> where N is the number of nodes. It distributes well — until N changes.</p>
      <h3>The resharding catastrophe</h3>
      <p>Add one node to a 10-node cluster and N goes from 10 to 11. Now <code>hash(key) % 10</code> and <code>hash(key) % 11</code> disagree for almost every key — so <strong>~90% of your data has to move</strong> to a different node at once. On a live system that's a storm of data migration, cache misses, and downtime.</p>
      <h3>Consistent hashing</h3>
      <p>Instead, imagine a <strong>ring</strong> of hash values (0 → max → wraps back to 0). Each node is placed at one or more points on the ring. A key is hashed to a point on the ring, then stored on the <strong>first node clockwise</strong> from that point.</p>
      <p>Now when you add a node, it only steals the keys in the arc between it and the previous node — roughly <strong>1/N of the data</strong>, not 90%. Remove a node and only its keys move, to the next node clockwise. The rest of the cluster is undisturbed.</p>
      <div class="callout tip"><span class="c-ico">🧩</span><div><h5>Virtual nodes smooth it out</h5><p>With few nodes, placement is lumpy and load uneven. The fix: give each physical node <em>many</em> points on the ring (virtual nodes). This evens out distribution and lets you add capacity gradually. This is the technique behind Redis Cluster, Cassandra, DynamoDB, and distributed caches.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 600, height: 300,
        nodes: [
          { id: "a", x: 420, y: 40, w: 90, h: 40, label: "Node A", kind: "accent" },
          { id: "b", x: 440, y: 130, w: 90, h: 40, label: "Node B", kind: "teal" },
          { id: "c", x: 300, y: 230, w: 90, h: 40, label: "Node C", kind: "good" },
          { id: "d", x: 90, y: 130, w: 90, h: 40, label: "Node D", kind: "purple" },
        ],
        labels: [
          { x: 300, y: 150, text: "hash ring", color: "#9aa6c2", size: 13, align: "middle" },
          { x: 300, y: 170, text: "key → next node clockwise", color: "#6b7691", size: 11, align: "middle" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> See why consistent hashing wins. Add a node and watch how many keys have to move. 'Mod N' reshuffles almost everything; the ring moves only a slice.",
        help: "Toggle the strategy, then Add/Remove a node. The 'keys moved' stat is the cost of that change.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 360 });

      let strategy = "ring";
      let numNodes = 4;
      const NUMKEYS = 60;
      let keys = Array.from({ length: NUMKEYS }, (_, i) => (i * 97 + 13) % 360); // positions 0-360
      let keysMoved = 0;
      // node ring positions
      function nodePositions(n) { return Array.from({ length: n }, (_, i) => (i * 360 / n + 20) % 360); }
      let prevAssign = null;

      SDE.toolGroup(refs.toolbar, [
        { label: "Consistent hashing (ring)", value: "ring" }, { label: "Naive hash % N", value: "mod" },
      ], (v) => { strategy = v; prevAssign = null; keysMoved = 0; });

      const cx = 410, cy = 190, R = 130;
      function assign() {
        const n = numNodes;
        if (strategy === "mod") {
          return keys.map((k) => Math.floor(k / 360 * 1000) % n);
        } else {
          const pos = nodePositions(n);
          return keys.map((k) => {
            // first node clockwise
            let best = 0, bestD = Infinity;
            for (let i = 0; i < n; i++) { let d = (pos[i] - k + 360) % 360; if (d < bestD) { bestD = d; best = i; } }
            return best;
          });
        }
      }

      function change(delta) {
        const before = assign();
        numNodes = U.clamp(numNodes + delta, 2, 8);
        const after = assign();
        // Count keys whose owning node position changed between before/after.
        const posB = strategy === "ring" ? nodePositions(numNodes - delta) : null;
        let moved = 0;
        const posA = strategy === "ring" ? nodePositions(numNodes) : null;
        for (let i = 0; i < keys.length; i++) {
          let ownerAngleBefore, ownerAngleAfter;
          if (strategy === "ring") { ownerAngleBefore = posB[before[i]]; ownerAngleAfter = posA[after[i]]; }
          else { ownerAngleBefore = before[i]; ownerAngleAfter = after[i]; }
          if (ownerAngleBefore !== ownerAngleAfter) moved++;
        }
        keysMoved = moved;
        SDE.toast((delta > 0 ? "Added" : "Removed") + " node → " + moved + "/" + keys.length + " keys moved", moved > keys.length / 2 ? "😱" : "🙂");
      }

      SDE.button(refs.controls, "➕ Add node", "primary", () => change(1));
      SDE.button(refs.controls, "➖ Remove node", "", () => change(-1));

      const stNodes = SDE.stat(refs.stats, "Nodes");
      const stMoved = SDE.stat(refs.stats, "Keys moved (last change)", "warn");
      const stPct = SDE.stat(refs.stats, "% reshuffled", "bad");

      sim.onUpdate = () => {
        stNodes(numNodes);
        stMoved(keysMoved + "/" + keys.length);
        stPct(Math.round(keysMoved / keys.length * 100) + "%");
      };

      sim.onDraw = (g) => {
        if (strategy === "mod") {
          // bucket view
          D.text(g, "Naive hash % N — keys per node", 40, 30, { color: C.dim, size: 13 });
          const owners = assign();
          const counts = new Array(numNodes).fill(0); owners.forEach((o) => counts[o]++);
          const bw = 80, gap = 20;
          for (let i = 0; i < numNodes; i++) {
            const x = 60 + i * (bw + gap), h = counts[i] / keys.length * 240;
            g.fillStyle = C.accent; g.shadowColor = C.accent; g.shadowBlur = 8; D.roundRect(g, x, 300 - h, bw, h, 6); g.fill(); g.shadowBlur = 0;
            D.text(g, "Node " + i, x + bw / 2, 320, { color: C.dim, size: 12, align: "center" });
            D.text(g, counts[i], x + bw / 2, 300 - h - 8, { color: C.text, size: 12, align: "center", mono: true });
          }
          D.text(g, "Changing N remaps almost every key — expensive!", 40, 345, { color: C.bad, size: 12 });
        } else {
          // ring view
          const owners = assign();
          const pos = nodePositions(numNodes);
          g.strokeStyle = C.line; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
          D.text(g, "Consistent hashing ring", 40, 30, { color: C.dim, size: 13 });
          // keys
          const nodeColors = [C.accent, C.teal, C.good, C.purple, C.warn, C.pink, "#ff9a62", "#62ffd0"];
          keys.forEach((k, i) => {
            const a = k * Math.PI / 180;
            const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
            g.fillStyle = nodeColors[owners[i] % nodeColors.length]; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
          });
          // nodes
          pos.forEach((p, i) => {
            const a = p * Math.PI / 180;
            const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
            g.fillStyle = nodeColors[i % nodeColors.length]; g.shadowColor = nodeColors[i % nodeColors.length]; g.shadowBlur = 12;
            D.roundRect(g, x - 9, y - 9, 18, 18, 4); g.fill(); g.shadowBlur = 0;
            D.text(g, "N" + i, x + Math.cos(a) * 24, y + Math.sin(a) * 24 + 4, { color: nodeColors[i % nodeColors.length], size: 12, align: "center" });
          });
          D.text(g, "Each key → nearest node clockwise. Adding a node steals only one arc.", 40, 345, { color: C.good, size: 12 });
        }
      };

      sim.start();
      return sim;
    },
  });
})(window);
