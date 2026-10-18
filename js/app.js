/* ============================================================
   app.js — router + UI shell + progress tracking.
   Hash routes:
     #/              landing
     #/areas         curriculum overview
     #/c/<conceptId> a concept page (Learn / Diagram / Play tabs)
   ============================================================ */
(function (global) {
  "use strict";
  const SDE = global.SDE;
  const appEl = document.getElementById("app");

  // ---- progress (localStorage) ----
  const PKEY = "sda.progress.v1";
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(PKEY)) || {}; } catch { return {}; }
  }
  function saveProgress(p) { localStorage.setItem(PKEY, JSON.stringify(p)); }
  let progress = loadProgress();

  function isDone(id) { return !!progress[id]; }
  function markDone(id, v) {
    if (v) progress[id] = true; else delete progress[id];
    saveProgress(progress);
    updateMiniRing();
  }
  function completedCount() { return SDE.ORDER.filter(isDone).length; }

  function updateMiniRing() {
    const total = SDE.totalConcepts();
    const done = completedCount();
    const pct = total ? Math.round((done / total) * 100) : 0;
    const fg = document.getElementById("miniRingFg");
    const txt = document.getElementById("miniRingText");
    if (fg) {
      const circ = 2 * Math.PI * 15.9;
      fg.style.strokeDasharray = circ;
      fg.style.strokeDashoffset = circ * (1 - pct / 100);
    }
    if (txt) txt.textContent = pct + "%";
  }

  // ---- active sim cleanup ----
  let activeSim = null;
  function teardownSim() {
    if (activeSim) {
      try { activeSim.destroy && activeSim.destroy(); } catch (e) {}
      activeSim = null;
    }
  }

  // ============================================================
  // LANDING
  // ============================================================
  function renderLanding() {
    const total = SDE.totalConcepts();
    const areasHtml = SDE.AREAS.map((a) => areaCard(a)).join("");
    appEl.innerHTML = `
      <section class="hero">
        <div class="eyebrow"><span class="pulse-dot"></span> Learn system design by playing, not memorizing</div>
        <h1>Master <span class="grad">System Design</span><br/>one playable concept at a time</h1>
        <p class="lede">Every hard concept — load balancing, consensus, sharding, Kubernetes — explained in plain language,
          drawn as an architecture diagram, then turned into an interactive simulation you can actually play with.</p>
        <div class="hero-cta">
          <a class="btn btn-primary" href="#/c/${SDE.ORDER[0]}" data-nav>▶ Start learning</a>
          <a class="btn btn-ghost" href="#/areas" data-nav>Browse curriculum</a>
        </div>
        <div class="hero-stats">
          <div class="hero-stat"><div class="num">6</div><div class="lbl">Areas</div></div>
          <div class="hero-stat"><div class="num">${total}</div><div class="lbl">Concepts</div></div>
          <div class="hero-stat"><div class="num">${total}</div><div class="lbl">Playable sims</div></div>
          <div class="hero-stat"><div class="num">100%</div><div class="lbl">In your browser</div></div>
        </div>
      </section>

      <div class="section-head">
        <h2>The curriculum</h2>
        <p>Six areas, built up from fundamentals to production infrastructure.</p>
      </div>
      <div class="areas-grid">${areasHtml}</div>
    `;
    updateMiniRing();
  }

  function areaCard(a) {
    const done = a.concepts.filter(isDone).length;
    const pct = Math.round((done / a.concepts.length) * 100);
    const chips = a.concepts
      .map((id) => {
        const c = SDE.getConcept(id);
        return `<span class="chip">${c ? c.title : id}</span>`;
      })
      .join("");
    return `
      <a class="area-card" style="--area-grad:${a.grad}" href="#/c/${a.concepts[0]}" data-nav>
        <div class="area-top">
          <div class="area-icon">${a.icon}</div>
          <div class="area-badge">${done}/${a.concepts.length} done</div>
        </div>
        <h3>Area ${a.num}: ${a.title}</h3>
        <p class="area-desc">${a.desc}</p>
        <div class="area-concepts">${chips}</div>
        <div class="area-progress"><span style="width:${pct}%"></span></div>
      </a>`;
  }

  // ============================================================
  // CURRICULUM OVERVIEW
  // ============================================================
  function renderAreas() {
    const areasHtml = SDE.AREAS.map((a) => areaCard(a)).join("");
    appEl.innerHTML = `
      <div class="section-head" style="margin-top:40px">
        <h2>Full curriculum</h2>
        <p>Pick any concept to jump in. Your progress is saved in this browser.</p>
      </div>
      <div class="areas-grid">${areasHtml}</div>`;
    updateMiniRing();
  }

  // ============================================================
  // CONCEPT PAGE
  // ============================================================
  function renderConcept(id) {
    const c = SDE.getConcept(id);
    if (!c) { appEl.innerHTML = `<div class="section-head"><h2>Concept not found</h2><p><a href="#/areas" data-nav>Back to curriculum</a></p></div>`; return; }
    const area = SDE.areaOf(id);
    const idx = SDE.ORDER.indexOf(id);
    const prev = idx > 0 ? SDE.ORDER[idx - 1] : null;
    const next = idx < SDE.ORDER.length - 1 ? SDE.ORDER[idx + 1] : null;

    appEl.innerHTML = `
      <div class="concept-layout">
        <aside class="sidebar">${sidebarHtml(id)}</aside>
        <div class="concept-main">
          <div class="breadcrumb"><a href="#/areas" data-nav>Curriculum</a> › <span>Area ${area.num}: ${area.title}</span></div>
          <div class="concept-header">
            <h1>${c.title}</h1>
            <p class="tagline">${c.tagline || ""}</p>
          </div>
          <div class="tabs">
            <button class="tab-btn active" data-tab="learn"><span class="tab-ico">📖</span> Learn</button>
            <button class="tab-btn" data-tab="diagram"><span class="tab-ico">🗺️</span> Diagram</button>
            <button class="tab-btn" data-tab="play"><span class="tab-ico">🎮</span> Play</button>
          </div>
          <div class="tab-panel active" data-panel="learn"><div class="prose">${c.explanation || ""}</div></div>
          <div class="tab-panel" data-panel="diagram">
            <div class="panel-card">
              <div class="panel-title">🗺️ Architecture diagram</div>
              <p class="panel-sub">${c.diagramNote || "How the pieces fit together."}</p>
              <div class="diagram-wrap">${c.diagram ? c.diagram() : ""}</div>
            </div>
          </div>
          <div class="tab-panel" data-panel="play">
            <div class="panel-card">
              <div class="panel-title">🎮 Interactive simulation</div>
              <p class="panel-sub">${c.gameNote || "Play with it to build intuition."}</p>
              <div id="gameRoot"></div>
            </div>
          </div>

          <div class="complete-bar">
            <button id="completeBtn" class="gbtn ${isDone(id) ? "" : "primary"}">
              ${isDone(id) ? '<span class="badge-done">✓ Completed</span>' : "✓ Mark concept complete"}
            </button>
            <div class="nav-prevnext">
              ${prev ? `<a class="gbtn" href="#/c/${prev}" data-nav>← Prev</a>` : ""}
              ${next ? `<a class="gbtn" href="#/c/${next}" data-nav>Next →</a>` : `<a class="gbtn" href="#/areas" data-nav>Finish ✓</a>`}
            </div>
          </div>
        </div>
      </div>`;

    // tab switching
    const tabBtns = appEl.querySelectorAll(".tab-btn");
    const panels = appEl.querySelectorAll(".tab-panel");
    let gameMounted = false;
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabBtns.forEach((b) => b.classList.remove("active"));
        panels.forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const t = btn.dataset.tab;
        appEl.querySelector(`[data-panel="${t}"]`).classList.add("active");
        if (t === "play" && !gameMounted) {
          mountGame(c);
          gameMounted = true;
        }
      });
    });

    // complete button
    const cbtn = document.getElementById("completeBtn");
    cbtn.addEventListener("click", () => {
      const nowDone = !isDone(id);
      markDone(id, nowDone);
      if (nowDone) {
        cbtn.innerHTML = '<span class="badge-done">✓ Completed</span>';
        cbtn.classList.remove("primary");
        SDE.toast("Concept completed! " + completedCount() + "/" + SDE.totalConcepts(), "🎉");
      } else {
        cbtn.innerHTML = "✓ Mark concept complete";
        cbtn.classList.add("primary");
      }
      // refresh sidebar checks
      appEl.querySelector(".sidebar").innerHTML = sidebarHtml(id);
      wireSidebar();
    });

    wireSidebar();
    updateMiniRing();
    window.scrollTo(0, 0);
  }

  function mountGame(c) {
    teardownSim();
    const root = document.getElementById("gameRoot");
    if (c.game) {
      try {
        activeSim = c.game(root) || null;
      } catch (e) {
        root.innerHTML = `<p style="color:var(--bad)">Game failed to load: ${e.message}</p>`;
        console.error(e);
      }
    } else {
      root.innerHTML = `<p style="color:var(--dim)">Interactive sim coming soon.</p>`;
    }
  }

  function sidebarHtml(activeId) {
    return SDE.AREAS.map((a) => {
      const links = a.concepts
        .map((id) => {
          const c = SDE.getConcept(id);
          const name = c ? c.title : id;
          return `<a class="concept-link ${id === activeId ? "active" : ""} ${isDone(id) ? "done" : ""}" href="#/c/${id}" data-nav>
            <span>${name}</span><span class="check">✓</span></a>`;
        })
        .join("");
      return `<div class="area-group" style="--area-grad:${a.grad}">
        <div class="area-title"><span class="area-dot"></span> Area ${a.num}: ${a.title}</div>
        ${links}
      </div>`;
    }).join("");
  }

  function wireSidebar() {
    // nav handled globally via delegation; nothing extra needed
  }

  // ============================================================
  // ROUTER
  // ============================================================
  function route() {
    teardownSim();
    const hash = location.hash || "#/";
    const parts = hash.slice(2).split("/"); // remove "#/"
    if (parts[0] === "" ) return renderLanding();
    if (parts[0] === "areas") return renderAreas();
    if (parts[0] === "c" && parts[1]) return renderConcept(parts[1]);
    renderLanding();
  }

  // intercept data-nav links for smooth hash routing
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-nav]");
    if (a) {
      // allow default hash navigation; just ensure scroll handled by route
    }
  });

  window.addEventListener("hashchange", route);
  window.addEventListener("DOMContentLoaded", route);

  // reset progress
  const resetBtn = document.getElementById("progressReset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset all learning progress on this browser?")) {
        progress = {};
        saveProgress(progress);
        updateMiniRing();
        route();
        SDE.toast("Progress reset", "↺");
      }
    });
  }

  // initial
  if (document.readyState !== "loading") route();
})(window);
