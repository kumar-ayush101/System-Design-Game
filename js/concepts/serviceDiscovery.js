/* Service Discovery — Area 5 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "service-discovery",
    title: "Service Discovery",
    tagline: "How services find each other's addresses when instances come and go constantly.",
    diagramNote: "Instances register with a registry; callers look up healthy instances instead of hardcoding addresses.",
    gameNote: "Instances scale up, crash, and restart with changing addresses. Watch the registry track them so callers always reach a healthy one.",

    explanation: `
      <p>In a dynamic system, service instances are created and destroyed constantly — autoscaling spins up new ones, deploys replace them, crashes remove them, and each may get a different IP address. So how does the orders service find the <em>current</em> address of a healthy payments instance? Hardcoding IPs is impossible. That's the problem <strong>service discovery</strong> solves.</p>
      <h3>The service registry</h3>
      <p>At the center is a <strong>registry</strong> (e.g. Consul, etcd, Eureka, or Kubernetes' built-in DNS) — a live directory mapping service names to the set of currently-available instance addresses.</p>
      <ul>
        <li>When an instance starts, it <strong>registers</strong> itself ("payments is at 10.0.3.7:8080").</li>
        <li>The registry <strong>health-checks</strong> instances and removes any that stop responding, so stale/dead addresses are purged.</li>
        <li>A caller asks the registry "where is payments?" and gets back the live, healthy instances.</li>
      </ul>
      <h3>Two styles of lookup</h3>
      <ul>
        <li><strong>Client-side discovery</strong> — the caller queries the registry and picks an instance itself (often load-balancing across them).</li>
        <li><strong>Server-side discovery</strong> — the caller hits a stable endpoint (a load balancer or the platform's DNS) that does the lookup and routing. Kubernetes Services work this way: you call <code>payments</code> and the platform resolves it to a healthy pod.</li>
      </ul>
      <div class="callout tip"><span class="c-ico">🧭</span><div><h5>It's what makes elastic systems possible</h5><p>Combined with health checks and load balancing, service discovery lets you add capacity, roll out new versions, and recover from crashes without any caller ever updating a config file. On Kubernetes you mostly get this for free via Services and DNS.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 250,
        nodes: [
          { id: "caller", x: 30, y: 100, w: 120, h: 50, label: "Caller svc", kind: "accent" },
          { id: "reg", x: 290, y: 95, w: 150, h: 60, label: "Registry", kind: "warn", glow: true, caption: "name → [addresses]" },
          { id: "i1", x: 560, y: 20, w: 150, h: 40, label: "payments :7", kind: "good" },
          { id: "i2", x: 560, y: 90, w: 150, h: 40, label: "payments :9", kind: "good" },
          { id: "i3", x: 560, y: 160, w: 150, h: 40, label: "payments :3 ✗", kind: "bad" },
        ],
        links: [
          { from: "caller", to: "reg", accent: true, label: "where is payments?" },
          { from: "i1", to: "reg", color: "#3ddc84", label: "register" }, { from: "i2", to: "reg", color: "#3ddc84" },
          { from: "i3", to: "reg", dashed: true, color: "#ff6b6b", label: "unhealthy→removed" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Keep calls flowing as instances churn. Add/kill payment instances (with changing addresses). The registry tracks only healthy ones, so the caller — looking up via the registry — always reaches a live instance.",
        help: "Add/kill instances. Caller requests auto-flow and are routed only to registered, healthy instances.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      let instances = [];
      let nextPort = 7001;
      let rr = 0, packets = [], acc = 0, routed = 0, dropped = 0;

      function addInstance() { if (instances.length >= 6) return; instances.push({ port: nextPort++, healthy: true, y: 0 }); layout(); SDE.toast("Instance :" + (nextPort - 1) + " registered", "💚"); }
      function layout() { instances.forEach((inst, i) => { inst.x = 600; inst.w = 150; inst.h = 40; inst.y = 40 + i * 45; }); }

      SDE.button(refs.controls, "➕ Add instance", "primary", addInstance);
      SDE.button(refs.controls, "💥 Kill random", "danger", () => {
        const alive = instances.filter((i) => i.healthy); if (!alive.length) return;
        const v = U.choice(alive); v.healthy = false;
        SDE.toast("Instance :" + v.port + " died — registry will drop it", "💥");
        setTimeout(() => { instances = instances.filter((i) => i !== v); layout(); }, 1200);
      });
      addInstance(); addInstance();

      const stReg = SDE.stat(refs.stats, "Registered", "good");
      const stRouted = SDE.stat(refs.stats, "Routed", "good");
      const stDropped = SDE.stat(refs.stats, "Dropped (none up)", "bad");

      sim.onUpdate = (dt) => {
        acc += dt;
        if (acc > 0.35) {
          acc = 0;
          const healthy = instances.filter((i) => i.healthy);
          if (healthy.length) { const target = healthy[rr % healthy.length]; rr++; packets.push({ t: 0, target }); }
          else { dropped++; packets.push({ t: 0, target: null }); }
        }
        for (const p of packets) { p.t += dt; if (p.t > 0.9 && !p.counted && p.target) { p.counted = true; routed++; } }
        packets = packets.filter((p) => p.t < 1.3);
        stReg(instances.filter((i) => i.healthy).length); stRouted(routed); stDropped(dropped);
      };

      sim.onDraw = (g) => {
        D.node(g, { x: 30, y: 130, w: 110, h: 50, label: "Caller", fill: "#15223f", stroke: C.accent, labelColor: "#dbe8ff" });
        // registry
        D.node(g, { x: 300, y: 90, w: 170, h: 130, label: "SERVICE REGISTRY", sub: "", fill: "#2a2410", stroke: C.warn, glow: 12, labelColor: C.warn });
        const healthy = instances.filter((i) => i.healthy);
        healthy.forEach((inst, i) => D.text(g, "payments → :" + inst.port, 385, 130 + i * 18, { color: C.good, size: 12, align: "center", mono: true }));
        if (!healthy.length) D.text(g, "(no healthy instances)", 385, 150, { color: C.bad, size: 12, align: "center" });
        D.arrow(g, 140, 155, 300, 155, C.accent, 2);

        for (const inst of instances) {
          const col = inst.healthy ? C.good : C.bad;
          D.node(g, { x: inst.x, y: inst.y, w: inst.w, h: inst.h, label: "payments :" + inst.port + (inst.healthy ? "" : " ✗"), fill: inst.healthy ? "#10261a" : "#2a1414", stroke: col, labelColor: col, fontSize: 12, r: 7 });
          D.line(g, 470, 155, inst.x, inst.y + 20, inst.healthy ? "rgba(61,220,132,0.3)" : "rgba(255,107,107,0.2)", 1.4, inst.healthy ? null : [4, 4]);
        }

        for (const p of packets) {
          if (p.t > 1.1) continue;
          let x, y = 155, col = p.target ? C.accent : C.bad;
          if (p.t < 0.4) x = U.lerp(140, 385, p.t / 0.4);
          else if (p.target) { const f = (p.t - 0.4) / 0.5; x = U.lerp(470, p.target.x, Math.min(1, f)); y = U.lerp(155, p.target.y + 20, Math.min(1, f)); col = C.good; }
          else { x = 385; y = 155 + (p.t - 0.4) * 50; }
          g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 7; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.shadowBlur = 0;
        }
      };

      sim.start();
      return sim;
    },
  });
})(window);
