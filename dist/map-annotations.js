'use strict';
// World-space thresholds choose names; each name stays beside its object.
// Panels and canvas edges naturally cover text without changing its anchor.
const MapAnnotations = {
  get active() {
    return (
      typeof MAP_LABEL_BOOT !== 'undefined' &&
      MAP_LABEL_BOOT.version === 1 &&
      MAP_LABEL_BOOT.catalogRevision === EXTENDED_BOOT.revision &&
      MAP_LABEL_BOOT.geometryVersion === MapLayout.version &&
      (!MapRadial.manifest || MAP_LABEL_BOOT.radialRevision === MapRadial.manifest.revision)
    );
  },
  get entries() {
    return (this.index ??= new Map(
      MAP_LABEL_BOOT.entries.map((q, i) => [q.id, { ...q, rank: i }]),
    ));
  },
  opacity(o) {
    const q = this.entries.get(o.id);
    if (!q) return 0;
    if (MapDetails.origin(o)) return 1;
    const pixel = cam.span / MapDetails.lodScale(o) / width,
      limit = q.limits[MapSlice.mode === 'radial' ? 1 : 0],
      t = Math.max(0, Math.min(1, (pixel / limit - 0.8) / 0.2)),
      start = q.minPixel || 0,
      u = start ? Math.max(0, Math.min(1, (pixel / start - 1) / 0.25)) : 1;
    return (1 - t * t * (3 - 2 * t)) * u * u * (3 - 2 * u);
  },
  hit(x, y) {
    return this.hits?.find(
      (q) => x >= q.box.x && x <= q.box.x + q.box.w && y >= q.box.y && y <= q.box.y + q.box.h,
    )?.object;
  },
  flightLabel(q) {
    return q.key === 'ship' || q.key.startsWith('flight-mark-');
  },
  structural(o) {
    return !!o?.region && !o.cosmicCatalog && ['structure','wall','void','ring','arc'].includes(o.kind);
  },
  structureAnchor(o) {
    const center=screen(RegionMap.center(o)),local=RegionMap.nameAnchor(o),scale=width/cam.span*Cosmology.regionScale(o);
    return {point:{x:center.x+local.x*scale,y:center.y+local.y*scale},extent:Math.max(o.region.major,o.region.minor)*scale/2,left:local.x<0};
  },
  place(q, obstacles) {
    const p = q.p || q.candidates?.[0];
    if (!p) return;
    const size = q.size || 10;
    const w = MapLabels.measure(q.name, size + 'px "Golos Text",Arial,sans-serif'),
      moving = this.flightLabel(q),
      stage = q.key.startsWith('flight-mark-'),
      y = q.p ? p.y + (q.labelBelow ? 22 : moving ? 18 : -8) : p.y;
    let x = q.p ? p.x + 16 : p.x - (p.align === 'center' ? w / 2 : p.align === 'right' ? w : 0);
    const boxAt = (offset) => ({ x: x - 4, y: y + offset - size - 4, w: w + 8, h: size + 10 });
    let offset = 0,
      box = boxAt(0);
    if (!moving && !q.object?.notableLandmark && (!q.object||MapDetails.level(q.object)<3) && this.notableBoxes?.some(b=>MapLabels.overlaps(box,b))) return;
    if (q.object?.notableLandmark && MapLabels.boxes.some(b=>MapLabels.overlaps(box,b))) return;
    const origin = q.object && MapDetails.origin(q.object);
    if (!moving && !origin && this.originBox && MapLabels.overlaps(box, this.originBox)) return;
    if (stage) {
      // Route events keep one anchor. Passing ships or crowded names may hide
      // the caption, but must never move it to another column or row.
      if (
        box.x < 8 || box.x + box.w > width - 8 || box.y < 8 || box.y + box.h > height - 8 ||
        [...MapLabels.boxes, ...obstacles].some(other => MapLabels.overlaps(box, other))
      ) return;
    } else if (moving) {
      // Prefer the right edge of a nearby sail before moving text far below it.
      for (const obstacle of obstacles)
        if (MapLabels.overlaps(box, obstacle)) {
          const right = obstacle.x + obstacle.w + 8;
          if (right + w + 4 <= width - 8) {
            x = Math.max(x, right);
            box = boxAt(0);
          }
        }
      // Keep the atlas fixed and retain the ship name's free row across frames.
      const previous = MapLabels.slots.get(q.key) ?? 0,
        rows = [...new Set([previous, 0, 1, 2, 3, 4, 5, 6, 7])];
      const row = rows.find((row) => {
        const b = boxAt(row * 24);
        return (
          b.x >= 8 &&
          b.x + b.w <= width - 8 &&
          b.y >= 8 &&
          b.y + b.h <= height - 8 &&
          ![...MapLabels.boxes, ...obstacles].some((other) => MapLabels.overlaps(b, other))
        );
      });
      if (row === undefined) return;
      MapLabels.slots.set(q.key, row);
      offset = row * 24;
      box = boxAt(offset);
    }
    if (origin) this.originBox = box;
    if (q.object) this.hits.push({ object: q.object, box });
    MapLabels.boxes.push(box);
    if(q.object?.notableLandmark)this.notableBoxes.push(box);
    MapLabels.placed.push({ key: q.key, ...box });
    const active = MapLabels.emphasized(q.object), alpha = active ? 1 : q.alpha;
    const leader=q.leaderAnchor?MapLabels.leader(box,q.leaderAnchor,alpha,active):null;
    if(q.structure)this.structureLabels.push({object:q.object,box,leader,anchor:q.leaderAnchor});
    ctx.save();
    ctx.globalAlpha = alpha;
    text(q.name, x, y + offset, size, active ? '#171717' : q.color || '#454545', 'left', 'sans');
    ctx.restore();
    q.onPlace?.(box);
  },
  draw() {
    const queued = MapLabels.queue
        .filter(
          (q) =>
            !q.object ||
            (q.key.startsWith('galaxy-') &&
              !this.entries.has(q.object.id) &&
              MapDetails.mapLabelName(q.object)),
        )
        .map((q) =>
          q.object
            ? { ...q, name: MapDetails.mapLabelName(q.object).toUpperCase() }
            : q,
        ),
      items = [];
    for (const [id, entry] of this.entries) {
      const o = ExtendedCatalog.get(id);
      if (!o || !MapDetails.visible(o, cam.span) || !ExtendedCatalog.matchesMap(o)) continue;
      if (o.notableLandmark) continue;
      const name = MapDetails.mapLabelName(o);
      if (!name) continue;
      const structure=this.structural(o)?this.structureAnchor(o):null;
      const alpha = Math.max(this.opacity(o),structure?clamp((structure.extent-18)/6,0,1):0) * ExtendedCatalog.opacity(o);
      if (alpha <= 0.03) continue;
      const p=structure?.point||screen(o);
      if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) continue;
      items.push({
        key: 'object-' + id,
        name: MapDetails.origin(o) ? entry.name : name,
        object: o,
        ...(structure?{candidates:[{x:p.x+(structure.left?-18:18),y:p.y+28,align:structure.left?'right':'left'}],structure:true,leaderAnchor:structure.extent>=24?p:null}:{p}),
        rank: entry.rank,
        alpha,
      });
    }
    for (const o of OBJECTS) {
      if (!o.notableLandmark || !MapDetails.visible(o,cam.span) || !ExtendedCatalog.matchesMap(o)) continue;
      const p=screen(o),name=MapDetails.mapLabelName(o, o.id === state.selected),alpha=ExtendedCatalog.opacity(o);
      if(!name||alpha<=.03||p.x<0||p.x>width||p.y<0||p.y>height)continue;
      items.push({key:'object-'+o.id,name,object:o,p,alpha,rank:0,labelBelow:true});
    }
    items.sort(
      (a, b) =>
        Number(MapDetails.origin(b.object)) - Number(MapDetails.origin(a.object)) ||
        Number(MapDetails.level(b.object)>=3) - Number(MapDetails.level(a.object)>=3) ||
        Number(!!b.object.notableLandmark) - Number(!!a.object.notableLandmark) ||
        (b.object.landmarkPriority||0) - (a.object.landmarkPriority||0) ||
        (a.object.notableLandmark&&b.object.notableLandmark?MapDetails.massOrder(a.object,b.object):0) ||
        a.rank - b.rank,
    );
    this.admitted = items.map((q) => q.object.id);
    this.structureLabels=[];
    this.overflow = [];
    this.hits = [];
    this.originBox = null;
    this.notableBoxes=[];
    MapLabels.boxes = [];
    MapLabels.uiCount = 0;
    MapLabels.placed = [];
    // Include the sail, braking field and thrust around the ship. This guard
    // affects only flight captions, never the fixed catalogue names.
    const ship = screen(state.ship),
      radius = state.flight && ['launch', 'brake'].includes(state.phase) ? 65 : 18,
      obstacles = [{ x: ship.x - radius, y: ship.y - radius, w: radius * 2, h: radius * 2 }];
    const fixed = queued.filter((q) => !this.flightLabel(q)),
      moving = queued
        .filter((q) => this.flightLabel(q))
        .sort(
          (a, b) =>
            Number(b.key === 'ship') - Number(a.key === 'ship') || a.key.localeCompare(b.key),
        );
    for (const q of [
      ...items,
      ...[...fixed, ...moving].map((q) => ({ ...q, alpha: q.opacity ?? 1 })),
    ])
      this.place(q, obstacles);
  },
};
globalThis.MapAnnotations = MapAnnotations;
MapLabels.legacyDraw = MapLabels.draw;
MapLabels.draw = function () {
  return MapAnnotations.active ? MapAnnotations.draw() : this.legacyDraw();
};
