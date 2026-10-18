/* Docker / Containers — Area 6 */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const D = SDE.draw, U = SDE.util, C = SDE.COLORS;

  SDE.register({
    id: "docker",
    title: "Docker & Containers",
    tagline: "Package an app with its exact dependencies into a lightweight, portable, identical unit.",
    diagramNote: "Containers share the host OS kernel; VMs each ship a full guest OS, so containers are far lighter.",
    gameNote: "Pack apps onto one host as heavy VMs vs light containers. See how many more containers fit — and why startup is near-instant.",

    explanation: `
      <p>A <strong>container</strong> packages an application together with <em>everything it needs to run</em> — code, runtime, libraries, system tools — into a single image. That image runs identically on your laptop, in CI, and in production. This kills the oldest excuse in software: "but it works on my machine."</p>
      <h3>Containers vs virtual machines</h3>
      <p>A <strong>VM</strong> virtualizes hardware and runs a full <em>guest operating system</em> on top of a hypervisor — gigabytes in size, tens of seconds to boot. A <strong>container</strong> virtualizes the OS: all containers on a host <em>share the host's kernel</em> and are isolated using kernel features (namespaces, cgroups). A container is just your app plus its userland dependencies — megabytes, and it starts in milliseconds.</p>
      <p>So on the same machine you can pack far more containers than VMs, start them instantly, and get consistent environments. That density and speed is what made modern microservices and autoscaling practical.</p>
      <h3>Images and layers</h3>
      <p>A <strong>Dockerfile</strong> describes how to build the image, in cached <strong>layers</strong> (base OS → dependencies → your code). Shared base layers are stored once, so images are small to ship and fast to rebuild when only your code changed. Images are stored in a <strong>registry</strong> and pulled wherever they run.</p>
      <div class="callout tip"><span class="c-ico">📦</span><div><h5>Immutable and disposable</h5><p>You don't patch a running container — you rebuild the image and replace the container. This immutability is why containers pair perfectly with IaC and orchestration (Kubernetes): instances are cattle, not pets. Containers isolate processes but share the kernel, so they're not as strongly isolated as VMs — a consideration for hostile multi-tenant workloads.</p></div></div>
    `,

    diagram() {
      return SDE.diagram({
        width: 740, height: 250,
        nodes: [
          { id: "h1", x: 40, y: 190, w: 300, h: 44, label: "Host OS + Hypervisor", kind: "plain" },
          { id: "vm1", x: 50, y: 60, w: 90, h: 120, label: "VM\nguest OS\n+ app", kind: "warn" },
          { id: "vm2", x: 150, y: 60, w: 90, h: 120, label: "VM\nguest OS\n+ app", kind: "warn" },
          { id: "vm3", x: 250, y: 60, w: 80, h: 120, label: "VM\nguest OS\n+ app", kind: "warn" },
          { id: "h2", x: 400, y: 190, w: 320, h: 44, label: "Host OS (shared kernel)", kind: "plain" },
          { id: "c1", x: 410, y: 110, w: 70, h: 70, label: "cntr", kind: "good" },
          { id: "c2", x: 490, y: 110, w: 70, h: 70, label: "cntr", kind: "good" },
          { id: "c3", x: 570, y: 110, w: 70, h: 70, label: "cntr", kind: "good" },
          { id: "c4", x: 650, y: 110, w: 60, h: 70, label: "cntr", kind: "good" },
        ],
        labels: [{ x: 190, y: 45, text: "VMs: heavy", color: "#ffca3a", size: 12, align: "middle" }, { x: 560, y: 95, text: "Containers: light & dense", color: "#3ddc84", size: 12, align: "middle" }],
      });
    },

    game(root) {
      const refs = SDE.buildGameShell(root, {
        objective: "<strong>Objective:</strong> See container efficiency. One host has a fixed amount of RAM. Deploy apps as VMs (heavy) or containers (light) and watch how many more containers fit — and how much faster they start.",
        help: "Click 'Deploy VM' or 'Deploy container' to pack the host. The RAM bar fills; containers use a fraction of a VM.",
      });
      const sim = new SDE.Sim(refs.canvas, { width: 820, height: 300 });

      const HOST_RAM = 16000; // MB
      const VM_RAM = 2000, CT_RAM = 256;
      let units = []; // {type, ram, x, y, boot}

      SDE.button(refs.controls, "🖥 Deploy VM (2 GB, slow boot)", "", () => deploy("vm"));
      SDE.button(refs.controls, "📦 Deploy container (256 MB, instant)", "primary", () => deploy("ct"));
      const spc = document.createElement("div"); spc.className = "spacer"; refs.controls.appendChild(spc);
      SDE.button(refs.controls, "Clear", "", () => { units = []; });

      const stUsed = SDE.stat(refs.stats, "RAM used", "warn");
      const stVms = SDE.stat(refs.stats, "VMs");
      const stCts = SDE.stat(refs.stats, "Containers", "good");

      function used() { return units.reduce((a, u) => a + u.ram, 0); }
      function deploy(type) {
        const ram = type === "vm" ? VM_RAM : CT_RAM;
        if (used() + ram > HOST_RAM) { SDE.toast("Host full — not enough RAM!", "🛑"); return; }
        units.push({ type, ram, boot: sim.time, ready: false });
        SDE.toast(type === "vm" ? "Booting VM… (~15s in reality)" : "Container up instantly ✓", type === "vm" ? "⏳" : "⚡");
      }

      sim.onUpdate = (dt) => {
        units.forEach((u) => { const bt = u.type === "vm" ? 1.5 : 0.15; if (!u.ready && sim.time - u.boot > bt) u.ready = true; });
        stUsed(Math.round(used() / 1000) + "/" + (HOST_RAM / 1000) + " GB");
        stVms(units.filter((u) => u.type === "vm").length);
        stCts(units.filter((u) => u.type === "ct").length);
      };

      sim.onDraw = (g) => {
        // host RAM bar
        D.text(g, "HOST — 16 GB RAM", 40, 32, { color: C.dim, size: 13 });
        const bx = 40, by = 44, bw = 740, bh = 30;
        g.fillStyle = "rgba(255,255,255,0.06)"; D.roundRect(g, bx, by, bw, bh, 6); g.fill();
        let xoff = bx;
        for (const u of units) {
          const w = (u.ram / HOST_RAM) * bw;
          g.fillStyle = u.type === "vm" ? C.warn : C.good;
          g.globalAlpha = u.ready ? 1 : 0.5;
          D.roundRect(g, xoff + 1, by + 1, w - 2, bh - 2, 4); g.fill(); g.globalAlpha = 1;
          xoff += w;
        }
        // unit blocks
        D.text(g, "Deployed workloads", 40, 110, { color: C.dim, size: 13 });
        let cx = 40, cy = 130;
        for (const u of units) {
          const size = u.type === "vm" ? 70 : 34;
          if (cx + size > 780) { cx = 40; cy += 80; }
          const col = u.type === "vm" ? C.warn : C.good;
          D.node(g, { x: cx, y: cy, w: size, h: size, label: u.type === "vm" ? "VM" : "□", sub: u.ready ? "" : "boot", fill: u.type === "vm" ? "#2a2410" : "#10261a", stroke: col, labelColor: col, fontSize: u.type === "vm" ? 13 : 11, r: 6 });
          cx += size + 10;
        }
        D.text(g, "Containers share the kernel → ~8× denser and start ~100× faster than VMs.", 40, 285, { color: C.faint, size: 12 });
      };

      sim.start();
      return sim;
    },
  });
})(window);
