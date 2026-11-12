'use strict';
// Expedition history is an overlay: catalogue zoom limits and filters cannot
// erase it. Use the same projection as the object, including moving orbits.
const MapVisits = {
  groups: [],
  layout() {
    const groups = [], cells = new Map(), spacing = 44,
      viewHeight = zenMode ? height : cameraViewportHeight();
    for (const id of new Set(state.visited)) {
      const o = object(id);
      if (!o?.p3?.every(Number.isFinite) || o.atlasOnly || MapGeometry.unlocated(o)) continue;
      const p = screen(o);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > width || p.y < 0 || p.y > viewHeight) continue;
      const x = Math.floor(p.x / spacing), y = Math.floor(p.y / spacing);
      let group = null;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const q of cells.get((x + dx) + ',' + (y + dy)) || []) {
          if (Math.hypot(p.x - q.p.x, p.y - q.p.y) < spacing &&
              (!group || q.index < group.index)) group = q;
        }
      }
      if (group) group.objects.push(o);
      else {
        group = { p, objects: [o], index: groups.length };
        groups.push(group);
        const key = x + ',' + y;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(group);
      }
    }
    for (const g of groups) {
      const count = g.objects.length, w = count === 1 ? 20 : 29 + String(count).length * 7;
      // The short stem ends at the object's exact position. The badge stays
      // clear of its glyph and does not displace any catalogue name.
      g.box = {
        x: clamp(g.p.x - 12 - w, 3, width - w - 3),
        y: clamp(g.p.y - 30, 3, viewHeight - 23),
        w, h: 20,
      };
    }
    return groups;
  },
  draw() {
    this.groups = this.layout();
    const ink = paint('#171717'), paper = paint('#f8f8f8');
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.lineJoin = ctx.lineCap = 'round';
    for (const g of this.groups) {
      const b = g.box, r = b.h / 2;
      // An opaque backing keeps the check readable over contours and routes.
      line(g.p.x - 1, g.p.y - 1, b.x + b.w - 3, b.y + b.h - 3, '#f8f8f8', 4);
      line(g.p.x - 1, g.p.y - 1, b.x + b.w - 3, b.y + b.h - 3, '#171717', 1.5);
      ctx.beginPath();
      ctx.moveTo(b.x + r, b.y);
      ctx.lineTo(b.x + b.w - r, b.y);
      ctx.arc(b.x + b.w - r, b.y + r, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(b.x + r, b.y + b.h);
      ctx.arc(b.x + r, b.y + r, r, Math.PI / 2, Math.PI * 1.5);
      ctx.closePath();
      ctx.fillStyle = ink;
      ctx.fill();
      ctx.strokeStyle = paper;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.x + 6, b.y + 10);
      ctx.lineTo(b.x + 9, b.y + 13);
      ctx.lineTo(b.x + 14, b.y + 7);
      ctx.stroke();
      if (g.objects.length > 1) {
        ctx.fillStyle = paper;
        ctx.font = '11px "IBM Plex Mono",monospace';
        ctx.textAlign = 'left';
        ctx.fillText(String(g.objects.length), b.x + 21, b.y + 14);
      }
    }
    ctx.restore();
    UIContent.text($('mapVisitsCount'), String(new Set(state.visited).size));
  },
  hit(x, y) {
    return this.groups.find(({ box: b }) => x >= b.x - 2 && x <= b.x + b.w + 2 && y >= b.y - 2 && y <= b.y + b.h + 2);
  },
  title(g) {
    if (!g) return '';
    if (g.objects.length === 1) return 'Посещено · ' + g.objects[0].name;
    return 'Посещено объектов: ' + g.objects.length + ' · ' +
      g.objects.slice(0, 4).map(o => o.name).join(', ') +
      (g.objects.length > 4 ? '…' : '') + '. Нажмите, чтобы приблизить.';
  },
  focus(g) {
    const points = g.objects.map(o => MapLayout.project(o)),
      xs = points.map(p => p.x), ys = points.map(p => p.y),
      left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys),
      span = Math.max(right - left, (bottom - top) * width / Math.max(1, cameraViewportHeight())) * 4;
    goCamera((left + right) / 2, (top + bottom) / 2, Math.min(cam.span / 3, Math.max(0.00006, span)));
  },
};
globalThis.MapVisits = MapVisits;
