/* Kubernetes — Area 6 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "kubernetes",
    title: "Kubernetes",
    tagline: "An orchestrator that keeps your desired number of healthy containers running — automatically.",
    diagramNote: "You declare desired state; the control loop constantly reconciles the cluster to match it.",
    gameNote: "Set a desired replica count, then kill pods and spike traffic. Watch Kubernetes restart dead pods and autoscale to meet demand — with no human action.",

    explanation: `
      <p><strong>Kubernetes</strong> (K8s) is a container <strong>orchestrator</strong>: it runs and manages containers across a cluster of machines so you don't have to place, restart, scale, or network them by hand. It's the operational backbone most microservice systems run on.</p>
      <h3>The core idea: a reconciliation loop</h3>
      <p>Like IaC, Kubernetes is <strong>declarative</strong>. You tell it the <em>desired state</em> ("run 5 replicas of this container, expose it on this port") and its <strong>control loop</strong> continuously compares desired vs actual and acts to close the gap. This single idea powers almost everything it does.</p>
      <h3>What that buys you</h3>
      <ul>
        <li><strong>Self-healing</strong> — a container (pod) crashes or a whole node dies? K8s notices the gap and launches replacements to get back to the desired count. Nobody gets paged at 3am to restart a process.</li>
        <li><strong>Autoscaling</strong> — the Horizontal Pod Autoscaler adds/removes replicas based on CPU or custom metrics as traffic rises and falls.</li>
        <li><strong>Rolling updates & rollbacks</strong> — deploy a new version pod-by-pod with zero downtime; if it misbehaves, roll back automatically.</li>
        <li><strong>Service discovery & load balancing</strong> — built-in DNS and Services route traffic to healthy pods wherever they land (the discovery concept, for free).</li>
      </ul>
      <h3>Key objects</h3>
      <p><strong>Pod</strong> (one or more containers, the smallest unit) → <strong>Deployment</strong> (manages a replica set of identical pods) → <strong>Service</strong> (stable network endpoint in front of them). You describe these in YAML and <code>kubectl apply</code> them.</p>
      <div class="callout tradeoff"><span class="c-ico">⚖️</span><div><h5>Power vs complexity</h5><p>Kubernetes is extraordinarily capable but genuinely complex — networking, storage, RBAC, and YAML sprawl have a steep learning curve. For a small app it's often overkill; a managed platform (or plain containers) may serve better. Adopt it when you truly need multi-service orchestration at scale.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 240,
        nodes: [
          { id: "yaml", x: 30, y: 95, w: 130, h: 54, label: "deployment.yaml\n(desired: 3)", kind: "accent" },
          { id: "cp", x: 270, y: 90, w: 160, h: 64, label: "Control plane", kind: "warn", glow: true, caption: "reconcile loop" },
          { id: "p1", x: 560, y: 20, w: 150, h: 40, label: "Pod", kind: "good" },
          { id: "p2", x: 560, y: 90, w: 150, h: 40, label: "Pod", kind: "good" },
          { id: "p3", x: 560, y: 160, w: 150, h: 40, label: "Pod", kind: "good" },
        ],
        links: [
          { from: "yaml", to: "cp", accent: true }, { from: "cp", to: "p1", color: "#3ddc84" },
          { from: "cp", to: "p2", color: "#3ddc84" }, { from: "cp", to: "p3", color: "#3ddc84", label: "keep N alive" },
        ],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> Watch self-healing and autoscaling. Set desired replicas, then kill pods — K8s respawns them to the desired count. Flip on autoscaling and spike traffic — it adds pods to keep latency healthy, then scales back down.",
        help: "Set desired replicas with +/-. Click a pod to kill it. Toggle autoscaling and inject a traffic spike.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 320 });

      let desired = 3, pods = [], nextId = 0;
      let autoscale = false, load = 0.3, spikeT = 0;
      let healed = 0;

      function layout() { pods.forEach((p, i) => { p.x = 120 + (i % 6) * 110; p.y = 120 + Math.floor(i / 6) * 90; }); }
      function spawn() { pods.push({ id: nextId++, state: "starting", born: sim.time, w: 90, h: 60 }); layout(); }
      for (let i = 0; i < desired; i++) spawn();

      const wrap = document.createElement("div"); wrap.className = "flex center"; wrap.style.gap = "6px";
      const out = document.createElement("span"); out.className = "mono"; out.style.color = C.dim; out.style.minWidth = "90px";
      const minus = document.createElement("button"); minus.className = "gbtn"; minus.textContent = "−";
      const plus = document.createElement("button"); plus.className = "gbtn"; plus.textContent = "+";
      const upd = () => out.textContent = "replicas = " + desired;
      minus.onclick = () => { desired = Math.max(0, desired - 1); upd(); };
      plus.onclick = () => { desired = Math.min(10, desired + 1); upd(); };
      wrap.append(document.createTextNode("Desired"), minus, out, plus); refs.controls.appendChild(wrap); upd();

      const asBtn = SDE.button(refs.controls, "Autoscale: OFF", "", () => { autoscale = !autoscale; asBtn.classList.toggle("active", autoscale); asBtn.textContent = "Autoscale: " + (autoscale ? "ON" : "OFF"); });
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "📈 Traffic spike", "danger", () => { spikeT = 5; SDE.toast("Traffic spike!", "📈"); });

      const stDesired = SDE.stat(refs.stats, "Desired");
      const stRunning = SDE.stat(refs.stats, "Running", "good");
      const stHealed = SDE.stat(refs.stats, "Self-heals", "good");
      const stLoad = SDE.stat(refs.stats, "Load/pod", "warn");

      sim.on("mousedown", (e) => {
        const p = sim.pointer(e);
        const hit = pods.find((pd) => D.pointInNode(p.x, p.y, pd));
        if (hit) { pods = pods.filter((p) => p !== hit); layout(); SDE.toast("Pod killed — K8s will respawn it", "💥"); }
      });

      let acc = 0;
      sim.onUpdate = (dt) => {
        if (spikeT > 0) spikeT -= dt;
        const targetLoad = (spikeT > 0 ? 2.4 : 0.9);
        const running = pods.filter((p) => p.state === "running").length || 1;
        load = U.lerp(load, targetLoad / running, 0.1);

        // autoscaler adjusts desired to keep load/pod ~0.5
        if (autoscale) {
          acc += dt;
          if (acc > 0.8) { acc = 0; if (load > 0.7 && desired < 10) { desired++; upd(); } else if (load < 0.25 && desired > 1) { desired--; upd(); } }
        }
        // reconcile
        pods.forEach((p) => { if (p.state === "starting" && sim.time - p.born > 0.7) p.state = "running"; });
        if (pods.length < desired) { spawn(); if (pods.length <= desired) healed++; }
        else if (pods.length > desired) { pods.pop(); layout(); }

        stDesired(desired); stRunning(pods.filter((p) => p.state === "running").length);
        stHealed(healed); stLoad((load).toFixed(2));
      };

      sim.onDraw = (g) => {
        D.text(g, "CLUSTER — desired " + desired + " replicas · reconcile loop keeps them alive", 40, 34, { color: C.dim, size: 13 });
        if (spikeT > 0) { g.fillStyle = "rgba(255,107,107,0.06)"; g.fillRect(0, 0, 820, 320); D.text(g, "⚡ TRAFFIC SPIKE", 410, 70, { color: C.bad, size: 16, align: "center" }); }
        for (const p of pods) {
          const col = p.state === "starting" ? C.teal : load > 0.7 ? C.warn : C.good;
          D.node(g, { x: p.x, y: p.y, w: p.w, h: p.h, label: "pod-" + p.id, sub: p.state === "starting" ? "starting" : "running", fill: "#10261a", stroke: col, labelColor: C.text, subColor: col, fontSize: 12 });
          // load bar
          const bw = p.w - 20; g.fillStyle = "rgba(255,255,255,0.08)"; D.roundRect(g, p.x + 10, p.y + p.h - 12, bw, 5, 2); g.fill();
          g.fillStyle = col; D.roundRect(g, p.x + 10, p.y + p.h - 12, bw * U.clamp(load, 0, 1), 5, 2); g.fill();
        }
        D.text(g, "Click a pod to kill it — the control loop respawns to the desired count.", 40, 300, { color: C.faint, size: 12 });
      };

      sim.start();
      return sim;
    },
  });
})(window);
