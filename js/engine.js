/* ============================================================
   engine.js — a tiny reusable canvas framework for the
   interactive simulations. Provides:
     - Sim: requestAnimationFrame loop with dt, hi-dpi canvas
     - Packet: an animated moving dot that follows a path
     - draw helpers: rounded rects, nodes, arrows, text
     - easing + lerp + color utilities
   All concept games build on this.
   ============================================================ */
(function (global) {
  "use strict";

  const SDE = global.SDE || (global.SDE = {});

  // ---- math/util ----
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  SDE.util = { lerp, clamp, rand, randInt, choice, dist, easeInOut, easeOut };

  // ---- color ----
  const COLORS = {
    bg: "#0a0e1a",
    panel: "#121829",
    line: "#2a3350",
    text: "#e8ecf6",
    dim: "#9aa6c2",
    faint: "#5b647f",
    accent: "#6ea8fe",
    accent2: "#8b7bff",
    teal: "#39d0d8",
    good: "#3ddc84",
    warn: "#ffca3a",
    bad: "#ff6b6b",
    purple: "#b58bff",
    pink: "#ff7bc2",
  };
  COLORS.faint = "#5b647f";
  SDE.COLORS = COLORS;

  // ---- Sim: the animation loop + canvas management ----
  class Sim {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.w = opts.width || 800;
      this.h = opts.height || 420;
      this.onUpdate = opts.update || (() => {});
      this.onDraw = opts.draw || (() => {});
      this.running = false;
      this.last = 0;
      this.time = 0;
      this._raf = null;
      this._resize();
      this._loop = this._loop.bind(this);
      this._listeners = [];
    }

    _resize() {
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      this.canvas.width = this.w * dpr;
      this.canvas.height = this.h * dpr;
      this.canvas.style.aspectRatio = `${this.w} / ${this.h}`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Convert a mouse/touch event to canvas (logical) coordinates.
    pointer(e) {
      const r = this.canvas.getBoundingClientRect();
      const cx = e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX) ?? 0;
      const cy = e.clientY ?? (e.touches && e.touches[0] && e.touches[0].clientY) ?? 0;
      return { x: ((cx - r.left) / r.width) * this.w, y: ((cy - r.top) / r.height) * this.h };
    }

    on(type, fn) {
      this.canvas.addEventListener(type, fn);
      this._listeners.push([type, fn]);
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      this._raf = requestAnimationFrame(this._loop);
    }
    stop() {
      this.running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
    }
    destroy() {
      this.stop();
      for (const [t, fn] of this._listeners) this.canvas.removeEventListener(t, fn);
      this._listeners = [];
    }

    _loop(now) {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.1) dt = 0.1; // clamp after tab switches
      this.time += dt;
      this.onUpdate(dt, this.time);
      this.clear();
      this.onDraw(this.ctx, dt, this.time);
      this._raf = requestAnimationFrame(this._loop);
    }

    clear() {
      const g = this.ctx;
      g.fillStyle = COLORS.bg;
      g.fillRect(0, 0, this.w, this.h);
    }
  }
  SDE.Sim = Sim;

  // ---- Packet: a dot that travels from a to b over duration ----
  class Packet {
    constructor(opts) {
      this.x = opts.x;
      this.y = opts.y;
      this.sx = opts.x; this.sy = opts.y;
      this.tx = opts.tx; this.ty = opts.ty;
      this.t = 0;
      this.dur = opts.dur || 0.8;
      this.color = opts.color || COLORS.accent;
      this.r = opts.r || 5;
      this.ease = opts.ease || easeInOut;
      this.done = false;
      this.onArrive = opts.onArrive || null;
      this.data = opts.data || {};
      this.trail = [];
    }
    retarget(tx, ty, dur) {
      this.sx = this.x; this.sy = this.y;
      this.tx = tx; this.ty = ty; this.t = 0;
      if (dur) this.dur = dur;
      this.done = false;
    }
    update(dt) {
      if (this.done) return;
      this.t += dt / this.dur;
      if (this.t >= 1) {
        this.t = 1; this.done = true;
        this.x = this.tx; this.y = this.ty;
        if (this.onArrive) this.onArrive(this);
        return;
      }
      const e = this.ease(this.t);
      this.x = lerp(this.sx, this.tx, e);
      this.y = lerp(this.sy, this.ty, e);
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 8) this.trail.shift();
    }
    draw(g) {
      // trail
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i];
        g.globalAlpha = (i / this.trail.length) * 0.4;
        g.fillStyle = this.color;
        g.beginPath(); g.arc(p.x, p.y, this.r * (i / this.trail.length), 0, 7); g.fill();
      }
      g.globalAlpha = 1;
      g.fillStyle = this.color;
      g.shadowColor = this.color; g.shadowBlur = 10;
      g.beginPath(); g.arc(this.x, this.y, this.r, 0, 7); g.fill();
      g.shadowBlur = 0;
    }
  }
  SDE.Packet = Packet;

  // ---- draw helpers ----
  const D = {
    roundRect(g, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    },
    // A labeled box "node"
    node(g, n) {
      const { x, y, w, h } = n;
      g.save();
      if (n.glow) { g.shadowColor = n.color || COLORS.accent; g.shadowBlur = n.glow; }
      D.roundRect(g, x, y, w, h, n.r || 12);
      g.fillStyle = n.fill || COLORS.panel;
      g.fill();
      g.shadowBlur = 0;
      g.lineWidth = n.lw || 1.5;
      g.strokeStyle = n.stroke || COLORS.line;
      g.stroke();
      if (n.label) {
        g.fillStyle = n.labelColor || COLORS.text;
        g.font = (n.labelBold ? "700 " : "600 ") + (n.fontSize || 13) + "px Inter, sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle";
        const lines = String(n.label).split("\n");
        const lh = (n.fontSize || 13) + 3;
        const startY = y + h / 2 - ((lines.length - 1) * lh) / 2;
        lines.forEach((ln, i) => g.fillText(ln, x + w / 2, startY + i * lh));
      }
      if (n.sub) {
        g.fillStyle = n.subColor || COLORS.dim;
        g.font = "500 11px Inter, sans-serif";
        g.textAlign = "center"; g.textBaseline = "top";
        g.fillText(n.sub, x + w / 2, y + h + 6);
      }
      g.restore();
    },
    // center of a node
    cx(n) { return n.x + n.w / 2; },
    cy(n) { return n.y + n.h / 2; },
    line(g, x1, y1, x2, y2, color, lw, dash) {
      g.save();
      g.strokeStyle = color || COLORS.line;
      g.lineWidth = lw || 1.5;
      if (dash) g.setLineDash(dash);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      g.restore();
    },
    arrow(g, x1, y1, x2, y2, color, lw) {
      g.save();
      g.strokeStyle = color || COLORS.dim;
      g.fillStyle = color || COLORS.dim;
      g.lineWidth = lw || 1.5;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const a = Math.atan2(y2 - y1, x2 - x1), s = 7;
      g.beginPath();
      g.moveTo(x2, y2);
      g.lineTo(x2 - s * Math.cos(a - 0.4), y2 - s * Math.sin(a - 0.4));
      g.lineTo(x2 - s * Math.cos(a + 0.4), y2 - s * Math.sin(a + 0.4));
      g.closePath(); g.fill();
      g.restore();
    },
    text(g, str, x, y, opts = {}) {
      g.save();
      g.fillStyle = opts.color || COLORS.text;
      g.font = (opts.weight || 600) + " " + (opts.size || 13) + "px " + (opts.mono ? "'JetBrains Mono', monospace" : "Inter, sans-serif");
      g.textAlign = opts.align || "left";
      g.textBaseline = opts.baseline || "alphabetic";
      g.fillText(str, x, y);
      g.restore();
    },
    pointInNode(px, py, n) {
      return px >= n.x && px <= n.x + n.w && py >= n.y && py <= n.y + n.h;
    },
  };
  SDE.draw = D;

  // ---- A small helper to build the standard game shell DOM ----
  // Returns references so each module can wire up controls/stats.
  SDE.buildGameShell = function (root, cfg) {
    cfg = cfg || {};
    root.innerHTML = "";
    const shell = document.createElement("div");
    shell.className = "game-shell";

    if (cfg.objective) {
      const obj = document.createElement("div");
      obj.className = "game-objective";
      obj.innerHTML = cfg.objective;
      shell.appendChild(obj);
      const sp = document.createElement("div"); sp.style.height = "14px"; shell.appendChild(sp);
    }

    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    shell.appendChild(toolbar);

    const wrap = document.createElement("div");
    wrap.className = "game-canvas-wrap";
    const canvas = document.createElement("canvas");
    wrap.appendChild(canvas);
    shell.appendChild(wrap);

    const controls = document.createElement("div");
    controls.className = "game-controls";
    shell.appendChild(controls);

    const stats = document.createElement("div");
    stats.className = "game-stats";
    shell.appendChild(stats);

    if (cfg.help) {
      const help = document.createElement("div");
      help.className = "game-help";
      help.innerHTML = '<span>💡</span><span>' + cfg.help + "</span>";
      shell.appendChild(help);
    }

    root.appendChild(shell);
    return { shell, toolbar, canvas, controls, stats };
  };

  // Make a stat cell; returns an update(value) function.
  SDE.stat = function (container, label, tone) {
    const el = document.createElement("div");
    el.className = "gstat" + (tone ? " " + tone : "");
    el.innerHTML = `<div class="gstat-val">0</div><div class="gstat-lbl">${label}</div>`;
    container.appendChild(el);
    const val = el.querySelector(".gstat-val");
    return (v) => { val.textContent = v; };
  };

  // Make a button
  SDE.button = function (container, label, cls, onClick) {
    const b = document.createElement("button");
    b.className = "gbtn" + (cls ? " " + cls : "");
    b.innerHTML = label;
    b.addEventListener("click", onClick);
    container.appendChild(b);
    return b;
  };

  // Tool chips (for selecting materials/modes)
  SDE.toolGroup = function (container, items, onSelect) {
    const chips = [];
    items.forEach((it, i) => {
      const c = document.createElement("button");
      c.className = "tool-chip" + (i === 0 ? " active" : "");
      c.innerHTML = (it.color ? `<span class="dot" style="background:${it.color}"></span>` : "") + it.label;
      c.addEventListener("click", () => {
        chips.forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
        onSelect(it.value, it);
      });
      container.appendChild(c);
      chips.push(c);
    });
    return chips;
  };

  // Toast notification
  SDE.toast = function (msg, icon) {
    let t = document.getElementById("sde-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "sde-toast";
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.innerHTML = (icon ? `<span>${icon}</span>` : "") + `<span>${msg}</span>`;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2600);
  };

  // Registry of concept modules. Each module calls SDE.register(...)
  SDE._concepts = {};
  SDE.register = function (mod) {
    SDE._concepts[mod.id] = mod;
  };
})(window);
