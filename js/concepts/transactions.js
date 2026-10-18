/* Transactions — Area 3 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "transactions",
    title: "Transactions & ACID",
    tagline: "Group operations so they all succeed or all fail — never halfway.",
    diagramNote: "A transfer debits one account and credits another inside a single atomic transaction.",
    gameNote: "Run a money transfer, then inject a crash midway. With a transaction, the system rolls back cleanly. Without one, money vanishes.",

    explanation: `
      <p>A <strong>transaction</strong> groups several operations so they behave as one indivisible unit. The classic example: transferring $100 means <em>debit</em> account A and <em>credit</em> account B. Those two steps must happen together — if the system crashes between them, you must never end up with the money debited but not credited.</p>
      <h3>ACID — the four guarantees</h3>
      <ul>
        <li><strong>Atomicity</strong> — all operations succeed, or all are undone (rolled back). No partial state.</li>
        <li><strong>Consistency</strong> — the database moves from one valid state to another; invariants (like "balances never go negative") hold.</li>
        <li><strong>Isolation</strong> — concurrent transactions don't step on each other; the result is as if they ran one at a time.</li>
        <li><strong>Durability</strong> — once committed, the data survives crashes and power loss (it's safely on disk).</li>
      </ul>
      <h3>Why atomicity needs a commit/rollback</h3>
      <p>Work happens in a staging area. On <code>COMMIT</code> the changes become permanent and visible. On <code>ROLLBACK</code> — triggered by an error, a crash, or an explicit abort — <em>every</em> change in the transaction is discarded as if it never happened. This all-or-nothing property is exactly what makes money, inventory, and bookings safe.</p>
      <div class="callout tip"><span class="c-ico">🔐</span><div><h5>Isolation levels are a dial</h5><p>Full isolation (serializable) is correct but slow. Databases offer weaker levels (read committed, repeatable read) that permit anomalies like non-repeatable reads in exchange for concurrency. You trade a little correctness for a lot of throughput — deliberately.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 720, height: 230,
        nodes: [
          { id: "begin", x: 40, y: 95, w: 110, h: 44, label: "BEGIN", kind: "accent" },
          { id: "debit", x: 230, y: 40, w: 150, h: 44, label: "debit A −$100", kind: "warn" },
          { id: "credit", x: 230, y: 150, w: 150, h: 44, label: "credit B +$100", kind: "warn" },
          { id: "commit", x: 470, y: 40, w: 150, h: 44, label: "COMMIT ✓", kind: "good" },
          { id: "rollback", x: 470, y: 150, w: 150, h: 44, label: "ROLLBACK ✗", kind: "bad" },
        ],
        links: [
          { from: "begin", to: "debit", accent: true }, { from: "begin", to: "credit", accent: true },
          { from: "debit", to: "commit", color: "#3ddc84", label: "all ok" },
          { from: "credit", to: "rollback", color: "#ff6b6b", dashed: true, label: "error → undo all" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> See atomicity save you. Transfer money, then hit 'Crash mid-transfer'. In TRANSACTION mode the debit is rolled back and totals stay correct. In NO-TRANSACTION mode the money is debited but never credited — $100 destroyed.",
        help: "Pick a mode, set the amount, click Transfer, and optionally crash it mid-way. Watch the total.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 300 });

      let txMode = true;
      let A = 500, B = 300;
      let amount = 100;
      let anim = null; // {phase, crash}
      let crashNext = false;

      SDE.toolGroup(refs.toolbar, [
        { label: "With transaction (ACID)", value: true }, { label: "No transaction (naive)", value: false },
      ], (v) => { txMode = v; });

      SDE.button(refs.controls, "💸 Transfer A→B", "primary", () => { if (!anim) startTransfer(false); });
      SDE.button(refs.controls, "💥 Crash mid-transfer", "danger", () => { if (!anim) startTransfer(true); });
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "Reset balances", "", () => { A = 500; B = 300; anim = null; });

      const stA = SDE.stat(refs.stats, "Account A");
      const stB = SDE.stat(refs.stats, "Account B");
      const stTotal = SDE.stat(refs.stats, "Total (should be 800)", "good");
      const stStatus = SDE.stat(refs.stats, "Last txn");

      let savedA = 0, savedB = 0;
      function startTransfer(crash) {
        savedA = A; savedB = B;
        anim = { phase: 0, crash, t: 0, status: "running" };
      }

      sim.onUpdate = (dt) => {
        if (anim) {
          anim.t += dt;
          if (anim.phase === 0 && anim.t > 0.6) { // debit A
            A -= amount; anim.phase = 1; anim.t = 0;
          } else if (anim.phase === 1 && anim.t > 0.6) {
            if (anim.crash) {
              // crash before credit
              if (txMode) { A = savedA; B = savedB; anim.status = "ROLLED BACK ✓"; }
              else { anim.status = "CRASHED — $" + amount + " lost ✗"; }
              anim.phase = 3; anim.t = 0;
            } else {
              B += amount; anim.phase = 2; anim.t = 0; anim.status = "COMMITTED ✓";
            }
          } else if (anim.phase >= 2 && anim.t > 1.2) { anim = null; }
        }
        stA("$" + A); stB("$" + B);
        const total = A + B;
        stTotal("$" + total + (total === 800 ? " ✓" : " ✗ BROKEN"));
        stStatus(anim ? anim.status : (A + B === 800 ? "consistent" : "corrupted!"));
      };

      sim.onDraw = (g) => {
        // accounts
        D.node(g, { x: 100, y: 90, w: 180, h: 100, label: "Account A", sub: "$" + A, fill: "#15223f", stroke: C.accent, labelColor: "#dbe8ff", subColor: C.text, fontSize: 15 });
        D.text(g, "$" + A, 190, 155, { color: C.good, size: 26, align: "center", mono: true });
        D.node(g, { x: 540, y: 90, w: 180, h: 100, label: "Account B", sub: "", fill: "#1d1838", stroke: C.purple, labelColor: "#e2dcff", fontSize: 15 });
        D.text(g, "$" + B, 630, 155, { color: C.good, size: 26, align: "center", mono: true });

        // transfer animation
        if (anim) {
          let x = 290, label = "", col = C.warn;
          if (anim.phase === 0) { label = "preparing…"; x = 290; }
          else if (anim.phase === 1) { label = "−$" + amount + " debited A"; x = U.lerp(290, 540, Math.min(1, anim.t / 0.6)); }
          else if (anim.phase === 2) { label = "+$" + amount + " credited B"; x = 530; col = C.good; }
          else if (anim.phase === 3) { label = anim.crash && txMode ? "⟲ rolling back" : "💥 crash!"; col = txMode ? C.warn : C.bad; }
          D.text(g, label, 410, 70, { color: col, size: 14, align: "center" });
          if (anim.phase <= 1) { g.fillStyle = C.warn; g.shadowColor = C.warn; g.shadowBlur = 10; g.beginPath(); g.arc(x, 140, 10, 0, 7); g.fill(); g.shadowBlur = 0; D.text(g, "$" + amount, x, 145, { color: "#000", size: 10, align: "center" }); }
          if (anim.phase === 3 && anim.crash) D.text(g, "⚡", 415, 140, { size: 30, align: "center" });
        }
        D.text(g, "Mode: " + (txMode ? "🔐 TRANSACTION (atomic)" : "⚠️ NO TRANSACTION"), 410, 250, { color: txMode ? C.good : C.bad, size: 14, align: "center" });
      };

      sim.start();
      return sim;
    },
  });
})(window);
