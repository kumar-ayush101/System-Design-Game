/* Loose Coupling — Area 5 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "loose-coupling",
    title: "Loose Coupling",
    tagline: "Minimize how much components need to know about each other, so change stays local.",
    diagramNote: "Tightly coupled components depend on each other's internals; loosely coupled ones depend on stable contracts.",
    gameNote: "Change a component and watch the ripple. In a tightly-coupled system the change cascades everywhere; with loose coupling it stays contained.",

    explanation: `
      <p><strong>Coupling</strong> measures how dependent components are on each other. <strong>Tight coupling</strong> means a change in one forces changes in many others. <strong>Loose coupling</strong> means components interact through stable, minimal <em>contracts</em>, so each can change internally without disturbing the rest. Loose coupling is the single biggest factor in whether a system stays changeable as it grows.</p>
      <h3>What causes tight coupling</h3>
      <ul>
        <li>Reaching into another component's internals (its database tables, private classes) instead of a published interface.</li>
        <li>Shared mutable state that many components read and write.</li>
        <li>Synchronous call chains where A must know about B must know about C.</li>
        <li>Leaky contracts that expose implementation details, so changing the implementation breaks callers.</li>
      </ul>
      <h3>How to loosen it</h3>
      <ul>
        <li><strong>Stable interfaces / contracts</strong> — depend on <em>what</em> a component does, not <em>how</em>. Hide internals.</li>
        <li><strong>Events / messaging</strong> — a publisher emits an event without knowing who consumes it (see Event-Driven). New consumers add zero coupling to the producer.</li>
        <li><strong>Dependency inversion</strong> — depend on abstractions you own, inject implementations. Swappable without touching callers.</li>
        <li><strong>Asynchrony</strong> — a queue between components decouples them in time and availability.</li>
      </ul>
      <div class="callout tip"><span class="c-ico">🎯</span><div><h5>The goal: localize change</h5><p>Well-designed systems aim for <em>high cohesion</em> (related things together) and <em>low coupling</em> (unrelated things independent). The payoff: a change touches one place, deploys independently, and fails in isolation. This principle underlies modular monoliths, microservices, event-driven design, and clean APIs alike — it's the "why" behind most of this area.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 240,
        nodes: [
          { id: "a", x: 70, y: 40, w: 110, h: 44, label: "A", kind: "accent" },
          { id: "b", x: 70, y: 150, w: 110, h: 44, label: "B", kind: "accent" },
          { id: "c", x: 230, y: 95, w: 110, h: 44, label: "C", kind: "accent" },
          { id: "x", x: 480, y: 95, w: 110, h: 44, label: "X", kind: "good" },
          { id: "y", x: 620, y: 40, w: 100, h: 44, label: "Y", kind: "good" },
          { id: "z", x: 620, y: 150, w: 100, h: 44, label: "Z", kind: "good" },
        ],
        links: [
          { from: "a", to: "b", color: "#ff6b6b" }, { from: "a", to: "c", color: "#ff6b6b" }, { from: "b", to: "c", color: "#ff6b6b" }, { from: "c", to: "a", color: "#ff6b6b" },
          { from: "x", to: "y", color: "#3ddc84", label: "contract" }, { from: "x", to: "z", color: "#3ddc84", label: "contract" },
        ],
        labels: [{ x: 125, y: 230, text: "tight: tangled", color: "#ff6b6b", size: 12, align: "middle" }, { x: 600, y: 230, text: "loose: via contracts", color: "#3ddc84", size: 12, align: "middle" }],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> See why coupling decides changeability. Click a component to 'change' it. In TIGHT mode the change ripples through everything it's entangled with. In LOOSE mode it stays contained behind contracts.",
        help: "Toggle tight/loose, then click any node to make a change and watch the ripple spread (or not).",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      let mode = "tight";
      const nodes = [];
      const cols = 4, rows = 2;
      for (let i = 0; i < 8; i++) {
        nodes.push({ id: i, x: 120 + (i % cols) * 170, y: 70 + Math.floor(i / cols) * 140, w: 110, h: 56, hot: 0 });
      }
      // tight: dense random graph; loose: sparse contract edges
      const tightEdges = [], looseEdges = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = 0; j < nodes.length; j++) {
          if (i !== j && Math.random() < 0.45) tightEdges.push([i, j]);
        }
      }
      for (let i = 0; i < nodes.length - 1; i++) if (Math.random() < 0.5) looseEdges.push([i, i + 1]);

      let changesLocal = 0, ripples = 0;

      SDE.toolGroup(refs.toolbar, [
        { label: "Tightly coupled", value: "tight" }, { label: "Loosely coupled", value: "loose" },
      ], (v) => { mode = v; nodes.forEach((n) => n.hot = 0); });

      const stMode = SDE.stat(refs.stats, "Coupling");
      const stRipple = SDE.stat(refs.stats, "Avg ripple size", "warn");

      let samples = [];
      sim.on("mousedown", (e) => {
        const p = sim.pointer(e);
        const hit = nodes.find((n) => D.pointInNode(p.x, p.y, n));
        if (!hit) return;
        // BFS the ripple
        const edges = mode === "tight" ? tightEdges : looseEdges;
        const adj = {}; nodes.forEach((n) => adj[n.id] = []);
        edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
        const visited = new Set([hit.id]); const q = [hit.id]; let depthGuard = mode === "tight" ? 99 : 1; let frontier = [hit.id];
        // tight ripples far; loose stops at direct contract neighbors
        let hops = mode === "tight" ? 99 : 1;
        for (let h = 0; h < hops; h++) {
          const next = [];
          for (const u of frontier) for (const v of adj[u]) if (!visited.has(v)) { visited.add(v); next.push(v); }
          frontier = next; if (!next.length) break;
        }
        nodes.forEach((n) => { if (visited.has(n.id)) n.hot = 1; });
        samples.push(visited.size); if (samples.length > 10) samples.shift();
        SDE.toast("Change in node " + hit.id + " affected " + visited.size + " component" + (visited.size > 1 ? "s" : ""), visited.size > 2 ? "🌊" : "🎯");
      });

      sim.onUpdate = (dt) => {
        nodes.forEach((n) => { if (n.hot > 0) n.hot = Math.max(0, n.hot - dt * 0.6); });
        stMode(mode === "tight" ? "TIGHT (bad)" : "LOOSE (good)");
        stRipple(samples.length ? (samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(1) + " nodes" : "—");
      };

      sim.onDraw = (g) => {
        const edges = mode === "tight" ? tightEdges : looseEdges;
        edges.forEach(([a, b]) => {
          const na = nodes[a], nb = nodes[b];
          D.line(g, D.cx(na), D.cy(na), D.cx(nb), D.cy(nb), mode === "tight" ? "rgba(255,107,107,0.35)" : "rgba(61,220,132,0.4)", mode === "tight" ? 1.3 : 2);
        });
        nodes.forEach((n) => {
          const hot = n.hot > 0;
          const base = mode === "tight" ? C.bad : C.good;
          D.node(g, { x: n.x, y: n.y, w: n.w, h: n.h, label: "Node " + n.id, sub: hot ? "⚡ changed" : "", fill: hot ? (mode === "tight" ? "#2a1414" : "#10261a") : "#121829", stroke: hot ? base : C.line, labelColor: C.text, subColor: base, glow: hot ? 14 * n.hot : 0 });
        });
        D.text(g, mode === "tight" ? "Tightly coupled — one change ripples across the tangle" : "Loosely coupled — change stays behind the contract", 410, 305, { color: mode === "tight" ? C.bad : C.good, size: 13, align: "center" });
      };

      sim.start();
      return sim;
    },
  });
})(window);
