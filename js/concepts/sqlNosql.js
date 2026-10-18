/* SQL / NoSQL — Area 3 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const C = SDE.COLORS;

  SDE.register({
    id: "sql-nosql",
    title: "SQL / NoSQL",
    tagline: "Relational tables with strong guarantees vs. flexible models built for scale and specific access patterns.",
    diagramNote: "SQL stores normalized rows across related tables; NoSQL comes in several non-relational shapes.",
    gameNote: "You're the architect. Read each workload and choose SQL or the right NoSQL type. The game explains why.",

    explanation: `
      <p>Databases split broadly into <strong>SQL</strong> (relational) and <strong>NoSQL</strong> (everything else). The choice is one of the most consequential in a system because it's hard to change later and everything depends on it.</p>
      <h3>SQL / relational</h3>
      <p>Data lives in <strong>tables</strong> of rows and columns, with relationships enforced by foreign keys, queried with SQL, and protected by <strong>ACID</strong> transactions. Pick SQL when data is structured and relational, you need transactions, or your query patterns are varied and not fully known in advance.</p>
      <p>Its main limit: scaling <em>writes</em> past one machine requires sharding, which adds real complexity.</p>
      <h3>NoSQL — a family, not one thing</h3>
      <ul>
        <li><strong>Key-value</strong> (Redis, DynamoDB) — a giant hash map. Blazing fast lookups by key; perfect for caches, sessions.</li>
        <li><strong>Document</strong> (MongoDB) — JSON-like documents. Flexible schema; great when each record is self-contained.</li>
        <li><strong>Wide-column</strong> (Cassandra) — massive write throughput over many nodes; time-series, event logs.</li>
        <li><strong>Graph</strong> (Neo4j) — nodes and edges; shines for relationship-heavy queries like social graphs and recommendations.</li>
      </ul>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>The most common mistake</h5><p>Choosing NoSQL because it "sounds modern" rather than because the data model fits. NoSQL trades SQL's query flexibility and strong consistency for scale/flexibility in a <em>specific</em> access pattern. If your access patterns are varied or you need multi-row transactions, a well-indexed SQL database often outperforms and outlasts the hype.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 760, height: 260,
        nodes: [
          { id: "sql", x: 40, y: 30, w: 160, h: 50, label: "SQL (relational)", kind: "accent", caption: "tables + joins + ACID" },
          { id: "u", x: 40, y: 120, w: 150, h: 40, label: "users", kind: "plain" },
          { id: "o", x: 40, y: 190, w: 150, h: 40, label: "orders (FK→users)", kind: "plain" },
          { id: "kv", x: 420, y: 20, w: 150, h: 40, label: "Key-Value", kind: "teal" },
          { id: "doc", x: 420, y: 80, w: 150, h: 40, label: "Document", kind: "teal" },
          { id: "wc", x: 420, y: 140, w: 150, h: 40, label: "Wide-Column", kind: "teal" },
          { id: "gr", x: 420, y: 200, w: 150, h: 40, label: "Graph", kind: "teal" },
        ],
        links: [{ from: "u", to: "o", label: "1→many" }],
        zones: [{ x: 400, y: 0, w: 350, h: 255, label: "NoSQL family", dashed: true }],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Match the workload to the best database. There's a 'most appropriate' answer each time — pick it and learn the reasoning.",
        help: "Read the scenario, click the database you'd choose.",
      });
      refs.canvas.parentElement.style.display = "none";

      const panel = document.createElement("div");
      refs.shell.appendChild(panel);
      const stScore = SDE.stat(refs.stats, "Correct", "good");
      const stQ = SDE.stat(refs.stats, "Question");

      const Q = [
        { s: "Bank account balances & money transfers — partial updates must never happen.", a: "sql", why: "You need multi-step ACID transactions. Money is the canonical case for SQL." },
        { s: "User session tokens looked up by session id, millions of reads/sec.", a: "kv", why: "Pure lookup by a single key at huge scale — a key-value store (Redis) is ideal." },
        { s: "Product catalog where each product has wildly different, nested attributes.", a: "doc", why: "Flexible, self-contained records with varying shape fit a document store." },
        { s: "Ingesting billions of IoT sensor readings per day, write-heavy.", a: "wc", why: "Massive write throughput across many nodes is wide-column's (Cassandra) sweet spot." },
        { s: "'People you may know' — friends-of-friends traversals.", a: "graph", why: "Relationship traversals are what graph databases are built for." },
        { s: "An admin panel with ad-hoc reports joining users, orders, and refunds.", a: "sql", why: "Varied, unpredictable queries with joins = relational SQL." },
      ];
      const opts = [
        { v: "sql", l: "SQL (relational)" }, { v: "kv", l: "Key-Value" }, { v: "doc", l: "Document" },
        { v: "wc", l: "Wide-Column" }, { v: "graph", l: "Graph" },
      ];
      let idx = 0, score = 0;

      function render() {
        if (idx >= Q.length) { panel.innerHTML = `<div style="padding:24px;text-align:center;font-size:18px">🎉 Done! You scored <strong>${score}/${Q.length}</strong>. You're thinking about data models the right way.</div>`; return; }
        stQ((idx + 1) + "/" + Q.length);
        panel.innerHTML = `
          <div style="padding:18px;border-radius:12px;background:rgba(110,168,254,0.08);border:1px solid var(--border-strong);margin-bottom:16px;font-size:16px">
            📋 <strong>Scenario ${idx + 1}:</strong> ${Q[idx].s}</div>
          <div id="opts" style="display:flex;gap:10px;flex-wrap:wrap"></div>
          <div id="why" style="margin-top:16px;font-size:14px;color:var(--text-dim);min-height:40px"></div>`;
        const o = panel.querySelector("#opts");
        opts.forEach((op) => {
          const b = document.createElement("button"); b.className = "gbtn"; b.textContent = op.l;
          b.onclick = () => choose(op.v, b); o.appendChild(b);
        });
      }
      function choose(v, btn) {
        const correct = Q[idx].a === v;
        if (correct) { score++; btn.classList.add("primary"); SDE.toast("Correct!", "✅"); }
        else { btn.style.borderColor = C.bad; SDE.toast("Not the best fit — see why", "💡"); }
        panel.querySelectorAll("#opts button").forEach((b) => b.disabled = true);
        const correctBtn = [...panel.querySelectorAll("#opts button")].find((b) => b.textContent === opts.find((o) => o.v === Q[idx].a).l);
        if (correctBtn) correctBtn.classList.add("primary");
        panel.querySelector("#why").innerHTML = (correct ? "✅ " : "➡️ Best answer: <strong>" + opts.find(o => o.v === Q[idx].a).l + "</strong>. ") + Q[idx].why +
          '<br><button class="gbtn" id="next" style="margin-top:12px">Next →</button>';
        panel.querySelector("#next").onclick = () => { idx++; render(); };
        stScore(score);
      }
      render(); stScore(0);
      return { destroy() {} };
    },
  });
})(window);
