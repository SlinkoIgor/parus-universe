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
function routeViewport() {
  const pad = Math.max(24, Math.min(54, width * 0.055)),
    card = $('flightCard').getBoundingClientRect(),
    viewportHeight = cameraViewportHeight();
  if (zenMode) return { left: pad, top: Math.max(72, pad), right: width - pad, bottom: height - pad };
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
function focusShip() {
  if (followShip) { releaseShipCamera(); cameraGoal=null; return; }
  followShip=true;
  globalThis.MapSlice?.focus(state.ship);
  const c = shipCamera();
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
  $('zoomSlider').setAttribute('aria-valuetext', 'Ширина карты: ' + distanceText(span));

  const measure = gridMetrics();
  UIContent.text($('zoomDivision'), scaleDistanceText(measure.unit));
  $('mapScaleLine').style.width = measure.majorPixels + 'px';
  $('mapScale').setAttribute(
    'aria-label',
    'Один крупный шаг сетки: ' + scaleDistanceText(measure.unit),
  );
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
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
}
function updateTimeControl() {
  const value = paused ? 0 : speed;
  $('timeSlider').value = String(TIME_RATES.indexOf(value));
  $('timeSlider').setAttribute(
    'aria-valuetext',
    value === 0 ? 'Пауза' : String(value).replace('.', ',') + '×',
  );
  document.querySelectorAll('[data-time]').forEach((button) => {
    const active = Number(button.dataset.time) === value;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
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
function fitRoute(target) {
  if (
    width <= 0 ||
    height <= 0 ||
    !target ||
    !Number.isFinite(target.x) ||
    !Number.isFinite(target.y)
  )
    return;
  const a = FlightView.ship(),
    b = MapLayout.project(target),
    v = routeViewport(),
    current = cameraGoal || cam;
  const sx = (p) => width * 0.43 + ((p.x - current.x) * width) / current.span,
    sy = (p) => mapOriginY() + ((p.y - current.y) * width) / current.span;
  if (
    [a, b].every((p) => sx(p) >= v.left && sx(p) <= v.right && sy(p) >= v.top && sy(p) <= v.bottom)
  )
    return;
  const span = Math.max(
    current.span,
    ((Math.abs(a.x - b.x) * width) / (v.right - v.left)) * 1.25,
    ((Math.abs(a.y - b.y) * width) / (v.bottom - v.top)) * 1.25,
  );
  goCamera(
    (a.x + b.x) / 2 - (((v.left + v.right) / 2 - width * 0.43) * span) / width,
    (a.y + b.y) / 2 -
      (((v.top + v.bottom) / 2 - mapOriginY()) * span) / width,
    span,
  );
}
function select(id, fit = false) {
  const o = object(id);
  if (!o) return;
  ExtendedCatalog.pin(o);
  if (ExtendedCatalog.systemView) {
    if (ExtendedCatalog.systemView.members.has(id)) ExtendedCatalog.systemView.selected = id;
    else ExtendedCatalog.systemView = null;
  }
  state.selected = id;
  renderUI();
  if (fit) fitRoute(o);
  renderCatalog();
  persist();
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
  for (const g of GALAXIES.filter(g => span < g.diameterLy * 4).sort((a,b) => a.diameterLy-b.diameterLy)) {
    const body=object(g.id);
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
