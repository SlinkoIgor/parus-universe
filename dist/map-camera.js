'use strict';
// Canvas viewport, camera navigation, zoom and map context.
const canvas = $('map'),
  ctx = canvas.getContext('2d');
let width = 0,
  height = 0,
  dpr = 1,
  cam = { x: 0, y: 0, span: 24 },
  cameraGoal = null,
  effects = [];
let followShip = false;
let zenMode = false;
let hudHeight = 0;
let pointer = { down: false, x: 0, y: 0, startX: 0, startY: 0, moved: false, id: null };
function setZenMode(enabled) {
  enabled = !!enabled;
  if (zenMode === enabled) return;
  zenMode = enabled;
  if (enabled) {
    closeCatalog();
    MapFilters.close();
    closeMenu();
    $('themePicker').hidden = true;
    $('themeBtn').setAttribute('aria-expanded', 'false');
    $('infoDialog').close();
    $('flightBuilder').close();
  }
  document.documentElement.classList.toggle('zen-mode', enabled);
  $('zenBtn').setAttribute('aria-pressed', String(enabled));
  $('zenBtn').setAttribute('aria-label', enabled ? 'Показать интерфейс' : 'Режим дзен');
  $('zenBtn').title = enabled ? 'Показать интерфейс' : 'Режим дзен · скрыть интерфейс';
  $('zenIcon').setAttribute('href', enabled ? '#zen-exit-icon' : '#zen-icon');
  $('zenBtn').focus({ preventScroll: true });
}
// The canvas always covers the window; Zen only removes its clipping and the UI.
function cameraViewportHeight() {
  return height - hudHeight;
}
function mapOriginY() {
  return cameraViewportHeight() * (width < 700 ? 0.39 : 0.5);
}
function screen(p) {
  p = p === state.ship ? FlightView.ship() : MapLayout.project(p);
  return {
    x: width * 0.43 + ((p.x - cam.x) * width) / cam.span,
    y: mapOriginY() + ((p.y - cam.y) * width) / cam.span,
  };
}
function screenOf(o) {
  const cache = MapDetails.frameScreen;
  if (!cache || o === state.ship) return screen(o);
  let p = cache.get(o);
  if (!p) cache.set(o, (p = screen(o)));
  return p;
}
function world(x, y) {
  return {
    x: cam.x + ((x - width * 0.43) * cam.span) / width,
    y: cam.y + ((y - mapOriginY()) * cam.span) / width,
  };
}
function goCamera(x, y, span, instant = false, keepFollow = false) {
  if (!keepFollow && followShip) releaseShipCamera();
  cameraGoal =
    keepFollow && followShip
      ? shipCamera(clamp(span, 0.00006, MAX_CAMERA_SPAN))
      : { x, y, span: clamp(span, 0.00006, MAX_CAMERA_SPAN) };
  if (instant) {
    cam = { ...cameraGoal };
    cameraGoal = null;
  }
  updateMapHeading();
}
function routeViewport(avoidPanels = false) {
  const pad = Math.max(24, Math.min(54, width * 0.055)),
    card = $('flightCard').getBoundingClientRect(),
    viewportHeight = cameraViewportHeight();
  if (zenMode) return { left: pad, top: Math.max(72, pad), right: width - pad, bottom: height - pad };
  if (avoidPanels) {
    // Panel positions change with the screen size and the card contents.
    // Leave room for the 18px waypoint rings around every visible panel.
    let spaces = [{ left: 20, top: 20, right: width - 20, bottom: viewportHeight - 20 }];
    const panels = document.querySelectorAll('.flight-card,.map-heading>.eyebrow,.map-heading h1,.ship-location,.map-actions,.map-controls,.map-scale');
    for (const panel of panels) {
      const r = panel.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const box = { left: r.left - 20, top: r.top - 20, right: r.right + 20, bottom: r.bottom + 20 };
      spaces = spaces.flatMap(s => {
        if (s.right <= box.left || s.left >= box.right || s.bottom <= box.top || s.top >= box.bottom) return [s];
        return [
          { ...s, right: box.left }, { ...s, left: box.right },
          { ...s, bottom: box.top }, { ...s, top: box.bottom },
        ].filter(v => v.right > v.left && v.bottom > v.top);
      });
    }
    const area = v => (v.right - v.left) * (v.bottom - v.top);
    if (spaces.length) return spaces.sort((a, b) => area(b) - area(a))[0];
  }
  // Keep the route clear of the HUD, target card, heading and map buttons.
  const right =
    width >= 700
      ? Math.min(width - pad, card.left > width * 0.45 ? card.left - pad : width - 350)
      : width - pad;
  const bottom =
    width < 700
      ? Math.min(viewportHeight - pad, card.top > 100 ? card.top - pad : viewportHeight * 0.43)
      : viewportHeight - pad;
  return { left: pad, top: 112, right: Math.max(pad + 100, right), bottom: Math.max(180, bottom) };
}
function shipCamera(span = cam.span) {
  const p = FlightView.ship();
  return {
    x: p.x + ((width * 0.43 - width / 2) * span) / width,
    y: p.y + ((mapOriginY() - cameraViewportHeight() / 2) * span) / width,
    span,
  };
}
function shipSurroundingsSpan() {
  const viewportHeight = cameraViewportHeight();
  if (width <= 0 || viewportHeight <= 0) return cam.span;
  const ship = FlightView.ship(),
    halfWidth = Math.max(1, width / 2 - 48),
    halfHeight = Math.max(1, viewportHeight / 2 - 48),
    origin = canvas.getBoundingClientRect(),
    panels = [...document.querySelectorAll(
      '.map-heading,.map-actions,.map-controls,.flight-card,.map-scale,.ship-location,.catalog-drawer,.menu-popover',
    )].map(e => e.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0)
      .map(r => [r.left - origin.left - 8, r.top - origin.top - 8,
        r.left - origin.left + r.width + 8, r.top - origin.top + r.height + 8]),
    objects = new Map();
  for (const source of [OBJECTS, ExtendedCatalog.pinned.values(), ExtendedCatalog.visible,
    MapLayers.visible, MapFilters.objects.values()])
    for (const o of source) if (!objects.has(o.id)) objects.set(o.id, o);
  const candidates = [];
  for (const o of objects.values()) {
    if (o.atlasOnly || o.cosmicEpoch || o.kind === 'horizon' || !ExtendedCatalog.matchesMap(o, true)) continue;
    // Large structures draw an outline, often crossing the slice or a panel.
    // Their hidden centre cannot stand in for a visible neighbouring marker.
    if (globalThis.MapVisibility?.active && o.region && MapDetails.level(o) >= 3) continue;
    const p = MapLayout.project(o), dx = p.x - ship.x, dy = p.y - ship.y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
    let span = Math.max(0.00006, Math.abs(dx) * width / halfWidth * 1.03, Math.abs(dy) * width / halfHeight * 1.03);
    if (o.region && !(globalThis.MapVisibility?.active && MapSymbols.handles(o))) {
      if (o.region.shape === 'polyline') continue;
      span = Math.max(span, Math.max(o.region.major, o.region.minor) * Cosmology.regionScale(o) * width / 6 * 1.03);
    }
    if (!Number.isFinite(span) || span > MAX_CAMERA_SPAN) continue;
    // A point travels along a straight screen ray while zooming. Add the scale
    // where it leaves each panel so covered neighbours can be considered again.
    const uncovered = panels.map(box => {
      let lo = 0, hi = Infinity;
      for (const [center, delta, min, max] of [
        [width / 2, dx * width, box[0], box[2]],
        [viewportHeight / 2, dy * width, box[1], box[3]],
      ]) {
        if (delta === 0) { if (center < min || center > max) return 0; }
        else {
          const a = (min - center) / delta, b = (max - center) / delta;
          lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
        }
      }
      return lo > 0 && lo <= hi ? 1.03 / lo : 0;
    });
    for (const next of [span, ...uncovered.filter(s => s > span && s <= MAX_CAMERA_SPAN)])
      candidates.push({ o, dx, dy, span: next });
  }
  candidates.sort((a, b) => a.span - b.span || a.o.id.localeCompare(b.o.id));
  let neighbours = [], bestCount = 0, bestSpan = cam.span;
  for (const q of candidates) {
    const span = q.span,
      visible = p => {
        const x = width / 2 + p.dx * width / span, y = viewportHeight / 2 + p.dy * width / span;
        return MapDetails.visible(p.o, span) && Math.hypot(p.dx, p.dy) * width / span >= 20 &&
          !panels.some(b => x >= b[0] && y >= b[1] && x <= b[2] && y <= b[3]);
      };
    // At most nine earlier neighbours survive here. Scale cutoffs and unresolved
    // coincident components must not count as extra visible objects.
    const retained = [];
    for (const p of neighbours)
      if (visible(p) && retained.every(a => Math.hypot(p.dx - a.dx, p.dy - a.dy) * width / span >= 12))
        retained.push(p);
    neighbours = retained;
    if (visible(q) && neighbours.every(p => p.o.id !== q.o.id && Math.hypot(p.dx - q.dx, p.dy - q.dy) * width / span >= 12))
      neighbours.push(q);
    if (neighbours.length > bestCount) { bestCount = neighbours.length; bestSpan = span; }
    if (neighbours.length >= 10) return span;
  }
  // A small explicit filter can contain fewer than ten objects: fit what exists.
  return bestSpan;
}
function focusShip() {
  if (followShip) { releaseShipCamera(); cameraGoal=null; return; }
  followShip=true;
  const c = shipCamera(shipSurroundingsSpan());
  goCamera(c.x, c.y, c.span, true, true);
  updateShipButton();
}
function updateShipButton() {
  UIContent.html($('shipBtn'), followShip
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5M12 6l5 12-5-3-5 3Z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>');
  $('shipBtn').setAttribute(
    'aria-label',
    followShip ? 'Отключить слежение: ' + SHIP_NAME : 'Центрировать и следовать: ' + SHIP_NAME,
  );
  $('shipBtn').classList.toggle('active', followShip);
  $('shipBtn').setAttribute('aria-pressed', String(followShip));
  $('shipBtn').title =
    SHIP_NAME +
    (followShip
      ? ' · отключить слежение'
      : ' · центрировать и следовать');
}
function releaseShipCamera() {
  followShip = false;
  updateShipButton();
}
// Numerical guard only: far beyond the atlas even at Cosmology's maximum a(t).
// Wheel/keyboard zoom may continue past the unchanged preset rail.
const MAX_CAMERA_SPAN = 1e100;
// Presets and handle share the same piecewise logarithmic scale.
const zoomStops = [
  { value: 0, span: 0.00006 },
  { value: 1, span: 24 },
  { value: 2, span: 130000 },
  { value: 3, span: 3e7 },
  { value: 4, span: 5e9 },
  {
    value: 5,
    get span() {
      return globalThis.UniverseMap?.overview().span || 115e9;
    },
  },
  {
    value: 5.15,
    get span() {
      return globalThis.UniverseMap ? UniverseMap.overview().span * 1.3 : 1.4e11;
    },
  },
];
function zoomInterpolate(input, from, to) {
  const n = clamp(input, zoomStops[0][from], zoomStops.at(-1)[from]);
  const i = Math.max(
      1,
      zoomStops.findIndex((stop) => stop[from] >= n),
    ),
    a = zoomStops[i - 1],
    b = zoomStops[i];
  const fraction =
    from === 'span'
      ? Math.log(n / a.span) / Math.log(b.span / a.span)
      : (n - a.value) / (b.value - a.value);
  return to === 'span'
    ? a.span * (b.span / a.span) ** fraction
    : a.value + (b.value - a.value) * fraction;
}
function gridMetrics(view = cam, viewportWidth = width) {
  const unit = nice((view.span * 128) / Math.max(1, viewportWidth)),
    majorPixels = (unit * viewportWidth) / view.span;
  return { unit, majorPixels, minorUnit: unit / 5, minorPixels: majorPixels / 5 };
}
function gridUnit() {
  return gridMetrics().unit;
}
function updateZoomControl() {
  const span = cam.span;
  $('zoomSlider').value = String(zoomInterpolate(span, 'span', 'value'));
  UIPatch.attr($('zoomSlider'), 'aria-valuetext', 'Ширина карты: ' + distanceText(span));

  const measure = gridMetrics();
  UIContent.text($('zoomDivision'), scaleDistanceText(measure.unit));
  UIPatch.style($('mapScaleLine'), 'width', measure.majorPixels + 'px');
  UIPatch.attr($('mapScale'), 'aria-label', 'Один крупный шаг сетки: ' + scaleDistanceText(measure.unit));
  document.querySelectorAll('[data-zoom]').forEach((b) => {
    const active =
      Math.abs(
        Math.log(
          span /
            (Number(b.dataset.zoom) >= 115e9 && globalThis.UniverseMap
              ? UniverseMap.overview().span
              : Number(b.dataset.zoom)),
        ),
      ) < 0.04;
    UIPatch.toggle(b, 'active', active);
    UIPatch.attr(b, 'aria-pressed', String(active));
  });
}
function updateTimeControl() {
  const value = paused ? 0 : speed;
  $('timeSlider').value = String(TIME_RATES.indexOf(value));
  UIPatch.attr($('timeSlider'), 'aria-valuetext', value === 0 ? 'Пауза' : String(value).replace('.', ',') + '×');
  document.querySelectorAll('[data-time]').forEach((button) => {
    const active = Number(button.dataset.time) === value;
    UIPatch.toggle(button, 'active', active);
    UIPatch.attr(button, 'aria-pressed', String(active));
  });
}
function setTimeRate(value) {
  const rate = Number(value);
  if (!TIME_RATES.includes(rate)) return;
  syncClock();
  if (rate === 0) paused = true;
  else {
    speed = rate;
    paused = false;
  }
  renderUI();
  persist();
}
function fitRoute(target, {wholeRoute = false} = {}) {
  if (
    width <= 0 ||
    height <= 0 ||
    !target ||
    !Number.isFinite(target.x) ||
    !Number.isFinite(target.y)
  )
    return;
  const objects = wholeRoute
      ? Route.nodes().flatMap(n => [object(n.id), Route.endpoint(n)]).filter(o => o?.p3)
      : [],
    points = [FlightView.ship(), MapLayout.project(target), ...objects.map(o => MapLayout.project(o))],
    f = state.flight;
  if (wholeRoute && f) points.push(FlightView.at(f, 0), FlightView.at(f, 1));
  const v = routeViewport(wholeRoute),
    current = cameraGoal || cam;
  const sx = (p) => width * 0.43 + ((p.x - current.x) * width) / current.span,
    sy = (p) => mapOriginY() + ((p.y - current.y) * width) / current.span;
  if (
    !wholeRoute && points.every((p) => sx(p) >= v.left && sx(p) <= v.right && sy(p) >= v.top && sy(p) <= v.bottom)
  )
    return;
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x)),
    minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  let span = Math.max(
    wholeRoute ? 0.00006 : current.span,
    (((maxX - minX) * width) / (v.right - v.left)) * 1.25,
    (((maxY - minY) * width) / (v.bottom - v.top)) * 1.25,
  );
  goCamera(
    (minX + maxX) / 2 - (((v.left + v.right) / 2 - width * 0.43) * span) / width,
    (minY + maxY) / 2 -
      (((v.top + v.bottom) / 2 - mapOriginY()) * span) / width,
    span,
  );
}
function select(id, fit = false, {deferPreview = false, routeAnchor = true} = {}) {
  const o = object(id);
  if (!o) return;
  ExtendedCatalog.pin(o);
  if (ExtendedCatalog.systemView) {
    if (ExtendedCatalog.systemView.members.has(id)) ExtendedCatalog.systemView.selected = id;
    else ExtendedCatalog.systemView = null;
  }
  if(routeAnchor)Route.selection=!Route.future().length?{id,state}:null;
  else if(!Route.future().length)Route.selection={id:state.selected,state};
  state.selected = id;
  if(deferPreview)Route.deferFeedback({selectionOnly:true});
  else {Route.cancelFeedback();renderUI();}
  if (fit) fitRoute(o);
  renderCatalog();
  if(!deferPreview)persist();
}
let compactMapControls = null;
function resize() {
  const r = canvas.getBoundingClientRect();
  width = r.width;
  height = r.height;
  hudHeight = document.querySelector('.telemetry')?.getBoundingClientRect().height || 0;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Assigning either bitmap dimension clears the canvas, even when unchanged.
  if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
  if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const controls = document.querySelector('.map-controls'),
    compact = width < 700;
  if (controls && compact !== compactMapControls) {
    controls.open = !compact;
    compactMapControls = compact;
  }
}
new ResizeObserver(resize).observe(canvas);
function mapContext(view) {
  const span = view.span;
  const nearSun = Math.hypot(view.x, view.y);
  if (span < 0.01 && nearSun < 0.1)
    return ['Солнечная система', 'Земля и Солнце. Нулевая точка экспедиции.', '00'];
  if (span < 180 && nearSun < 100)
    return ['Солнечная окрестность', 'В галактике «Млечный Путь».', '01'];
  // The registry also retains metadata for evicted tiles. Such a helper is
  // neither a live outline nor a full galaxy identity for Cosmology.group.
  // Check smaller live galaxies first and tessellate only a containing bound.
  let localGalaxy;
  const index = MapDetails.frameObjects || MapDetails.objectsIndex();
  for (const g of GALAXIES.filter(g => span < g.diameterLy * 4).sort((a,b) => a.diameterLy-b.diameterLy)) {
    const body=objectIn(index, g.id);
    if(body&&MapGeometry.contains(body,view)){localGalaxy=g;break;}
  }
  if (localGalaxy)
    return [
      'Галактика «' + localGalaxy.name + '»',
      span < 10000
        ? 'Звёздный масштаб · проекция в галактических осях.'
        : 'Оптический контур · ' + distanceText(localGalaxy.diameterLy),
      'Г',
    ];
  if (span < 10000)
    return ['Локальный масштаб', 'Область вне известных оптических контуров галактик.', '02'];
  if (span < 800000)
    return ['Галактический масштаб', 'Галактики и межгалактическое пространство.', '03'];
  if (span < 30000000)
    return [
      nearSun < 5e6 ? 'Местная группа' : 'Группы галактик',
      'Галактики и их объединения.',
      '04',
    ];
  if (span < 1e9) return ['Скопления галактик', 'Скопления и потоки космической паутины.', '05'];
  if (span < 4e10)
    return ['Космическая паутина', 'Стены, войды и крупномасштабные структуры.', '06'];
  return [
    'Обозримая Вселенная',
    'Наблюдаемая область атласа · радиус ' +
      distanceText((globalThis.UniverseMap ? UniverseMap.radius : 46.5e9) * Cosmology.scale()),
    '∞',
  ];
}
function updateMapHeading() {
  const view = cameraGoal || cam,
    [title, sub, sheet] = mapContext(view);
  UIContent.text($('mapTitle'), title);
  UIContent.text($('mapSubtitle'), sub);
  UIContent.text($('mapSheet'), '/ ' + sheet);
}
