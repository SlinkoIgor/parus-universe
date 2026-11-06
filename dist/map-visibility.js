'use strict';
// A camera only asks for spatial coverage. It never chooses representatives.
const MapVisibility = {
  classSpans: { galaxy: 3e8, quasar: 3e8, 'galaxy-cluster': 1.8e9, filament: 2.7e9 },
  // Individually sourced cosmological landmarks remain useful on the overview.
  // Their scientific catalogue class and the fixed density hierarchy stay intact.
  overviewPoint(o) {
    return MapDetails.cosmologicalPoint(o);
  },
  get active() {
    return (
      typeof MAP_VISIBILITY_BOOT !== 'undefined' &&
      MAP_VISIBILITY_BOOT.version === 1 &&
      MAP_VISIBILITY_BOOT.catalogRevision === EXTENDED_BOOT.revision &&
      MAP_VISIBILITY_BOOT.geometryVersion === MapLayout.version &&
      (!MapRadial.manifest || MAP_VISIBILITY_BOOT.radialRevision === MapRadial.manifest.revision)
    );
  },
  limit(o) {
    if (!this.active || o.synthetic || o.nuclearStar) return Infinity;
    if (o.kind === 'blackhole') {
      const host = MapDetails.blackHoleHost(o), limit = MapDetails.maxSpan(o) / 1440;
      // Apply the host's fixed density cutoff too. The nucleus disappears while
      // its galaxy is still fully visible, independent of tile loading or pan.
      return host ? Math.min(limit, this.limit(host) * 0.7) : limit;
    }
    const p = MAP_VISIBILITY_BOOT.pixels[o.id]?.[MapSlice.mode === 'radial' ? 1 : 0];
    const density = p === undefined || p < 0 ? Infinity : p,
      group = MapDetails.group(o),
      classSpan = this.overviewPoint(o) ? Infinity : (this.classSpans[group] ?? Infinity);
    const limit = Math.min(density, classSpan / 1440);
    // A named extended structure must survive the point-density cutoff once
    // its outline is resolved. Use reference geometry, independent of camera.
    return o.region && !o.cosmicCatalog && ['structure', 'wall', 'void', 'ring', 'arc'].includes(o.kind)
      ? Math.max(limit, Math.max(o.region.major, o.region.minor) / 48)
      : limit;
  },
  focusSpan(o, span, viewportWidth = width) {
    return Math.min(span, this.limit(o) * Math.max(1, viewportWidth) * 0.7);
  },
  opacity(o, span, viewportWidth = width, limit = this.limit(o)) {
    if (MapDetails.origin(o)) return 1;
    if (limit === Infinity) return 1;
    const pixel = span / MapDetails.lodScale(o) / Math.max(1, viewportWidth);
    if (pixel >= limit) return 0;
    if (pixel <= limit * 0.8) return 1;
    const t = (pixel / limit - 0.8) / 0.2;
    return 1 - t * t * (3 - 2 * t);
  },
  filesForView(view, w, h) {
    const mode = MapSlice.mode === 'radial' ? 'radial' : 'full',
      tree = MAP_VISIBILITY_BOOT.modes[mode];
    const v = Cosmology.referenceView(view),
      pixel = v.span / Math.max(1, w),
      cy = h * (w < 700 ? 0.39 : 0.5),
      pad = 64 * pixel;
    const box = [
        v.x - 0.43 * w * pixel - pad,
        v.y - cy * pixel - pad,
        v.x + 0.57 * w * pixel + pad,
        v.y + (h - cy) * pixel + pad,
      ],
      files = [];
    const visit = (id) => {
      const n = tree.nodes[id],
        b = n.box;
      if (n.maxPixel < pixel || b[0] > box[2] || b[2] < box[0] || b[1] > box[3] || b[3] < box[1])
        return;
      if (n.children.length && pixel <= n.splitPixel) n.children.forEach(visit);
      else files.push(n.file);
    };
    tree.roots.forEach(visit);
    return files;
  },
};
globalThis.MapVisibility = MapVisibility;
