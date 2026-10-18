/* ============================================================
   diagram.js — a tiny declarative SVG architecture-diagram
   builder. Concept modules describe nodes + links and we
   render crisp, styled SVG (with gradients, arrowheads).

   Usage:
     SDE.diagram({
       width: 760, height: 320,
       nodes: [{ id:'lb', x:300, y:40, w:120, h:46, label:'Load Balancer', kind:'accent' }],
       links: [{ from:'client', to:'lb', label:'HTTP', dashed:false }]
     }) -> returns an SVG string
   ============================================================ */
(function (global) {
  "use strict";
  const SDE = global.SDE || (global.SDE = {});

  const KIND = {
    accent: { fill: "#15223f", stroke: "#6ea8fe", text: "#dbe8ff" },
    purple: { fill: "#1d1838", stroke: "#8b7bff", text: "#e2dcff" },
    teal:   { fill: "#0f2a2d", stroke: "#39d0d8", text: "#cdf7f9" },
    good:   { fill: "#10261a", stroke: "#3ddc84", text: "#cdf7dd" },
    warn:   { fill: "#2a2410", stroke: "#ffca3a", text: "#fff2c8" },
    bad:    { fill: "#2a1414", stroke: "#ff6b6b", text: "#ffd6d6" },
    plain:  { fill: "#121829", stroke: "#2a3350", text: "#c9d2e6" },
    client: { fill: "#161b2e", stroke: "#9aa6c2", text: "#e8ecf6" },
  };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function nodeCenter(n) { return { x: n.x + n.w / 2, y: n.y + n.h / 2 }; }

  // Compute an edge point on the border of node toward a target point.
  function edgePoint(n, tx, ty) {
    const c = nodeCenter(n);
    const dx = tx - c.x, dy = ty - c.y;
    const hw = n.w / 2, hh = n.h / 2;
    if (dx === 0 && dy === 0) return c;
    const sx = dx === 0 ? Infinity : hw / Math.abs(dx);
    const sy = dy === 0 ? Infinity : hh / Math.abs(dy);
    const s = Math.min(sx, sy);
    return { x: c.x + dx * s, y: c.y + dy * s };
  }

  SDE.diagram = function (spec) {
    const W = spec.width || 760;
    const H = spec.height || 320;
    const nodes = spec.nodes || [];
    const links = spec.links || [];
    const byId = {};
    nodes.forEach((n) => (byId[n.id] = n));

    let defs = `
      <defs>
        <marker id="arw" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0 L8,4.5 L0,9 Z" fill="#6b7691" />
        </marker>
        <marker id="arwA" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0 L8,4.5 L0,9 Z" fill="#6ea8fe" />
        </marker>
        <linearGradient id="dgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#6ea8fe" /><stop offset="1" stop-color="#8b7bff" />
        </linearGradient>
      </defs>`;

    // links first (under nodes)
    let linkSvg = "";
    links.forEach((l) => {
      const a = byId[l.from], b = byId[l.to];
      if (!a || !b) return;
      const ca = nodeCenter(a), cb = nodeCenter(b);
      const pa = edgePoint(a, cb.x, cb.y);
      const pb = edgePoint(b, ca.x, ca.y);
      const color = l.color || (l.accent ? "#6ea8fe" : "#44506f");
      const marker = l.accent ? "arwA" : "arw";
      const dash = l.dashed ? ' stroke-dasharray="5 4"' : "";
      const lw = l.width || 1.8;
      if (l.bidir) {
        linkSvg += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="${color}" stroke-width="${lw}"${dash} marker-end="url(#${marker})" marker-start="url(#${marker})" />`;
      } else {
        linkSvg += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="${color}" stroke-width="${lw}"${dash} marker-end="url(#${marker})" />`;
      }
      if (l.label) {
        const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
        linkSvg += `<rect x="${mx - l.label.length * 3.6 - 6}" y="${my - 10}" width="${l.label.length * 7.2 + 12}" height="18" rx="5" fill="#0b1020" opacity="0.9" />`;
        linkSvg += `<text x="${mx}" y="${my + 3}" fill="#9aa6c2" font-size="11" font-family="Inter, sans-serif" font-weight="600" text-anchor="middle">${esc(l.label)}</text>`;
      }
    });

    // nodes
    let nodeSvg = "";
    nodes.forEach((n) => {
      const k = KIND[n.kind] || KIND.plain;
      const fill = n.fill || k.fill;
      const stroke = n.stroke || k.stroke;
      const tcol = n.text || k.text;
      const r = n.r != null ? n.r : 10;
      const glow = n.glow ? ` filter="drop-shadow(0 0 8px ${stroke})"` : "";
      nodeSvg += `<g${glow}>`;
      nodeSvg += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.6" />`;
      const lines = String(n.label).split("\n");
      const fs = n.fontSize || 13;
      const lh = fs + 3;
      const startY = n.y + n.h / 2 - ((lines.length - 1) * lh) / 2 + 1;
      lines.forEach((ln, i) => {
        nodeSvg += `<text x="${n.x + n.w / 2}" y="${startY + i * lh}" fill="${tcol}" font-size="${fs}" font-family="Inter, sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="middle">${esc(ln)}</text>`;
      });
      if (n.icon) {
        nodeSvg += `<text x="${n.x + 14}" y="${n.y + n.h / 2}" font-size="16" text-anchor="middle" dominant-baseline="middle">${n.icon}</text>`;
      }
      nodeSvg += `</g>`;
      if (n.caption) {
        nodeSvg += `<text x="${n.x + n.w / 2}" y="${n.y + n.h + 15}" fill="#6b7691" font-size="11" font-family="Inter, sans-serif" text-anchor="middle">${esc(n.caption)}</text>`;
      }
    });

    // optional free-floating labels/zones
    let extra = "";
    (spec.zones || []).forEach((z) => {
      extra += `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="14" fill="${z.fill || "rgba(110,168,254,0.04)"}" stroke="${z.stroke || "rgba(110,168,254,0.2)"}" stroke-width="1.4" stroke-dasharray="${z.dashed ? "6 5" : "0"}" />`;
      if (z.label) extra += `<text x="${z.x + 12}" y="${z.y + 20}" fill="#9aa6c2" font-size="12" font-family="Inter, sans-serif" font-weight="700">${esc(z.label)}</text>`;
    });
    (spec.labels || []).forEach((t) => {
      extra += `<text x="${t.x}" y="${t.y}" fill="${t.color || "#9aa6c2"}" font-size="${t.size || 12}" font-family="Inter, sans-serif" font-weight="${t.weight || 600}" text-anchor="${t.align || "start"}">${esc(t.text)}</text>`;
    });

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">${defs}${extra}${linkSvg}${nodeSvg}</svg>`;
  };
})(window);
