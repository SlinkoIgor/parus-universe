'use strict';
// Restore the expedition, bind controls and run the animation loop.
try {
  state = restore(JSON.parse(localStorage.getItem(STORE)));
} catch {
  state = initial();
}
FlightSetup.sync();
paused = !!state.paused;
speed = state.timeScale > 0 && TIME_RATES.includes(state.timeScale) ? state.timeScale : 1;
if (state.flight && state.phase !== 'flyby') Route.configure();
if (state.flight && !state.flight.markers?.length) FlightMarks.plan();
let lastFrame = performance.now();
function frame(now) {
  Cosmology.sync(state);
  const realDt = Math.max(0, (now - lastFrame) / 1000);
  lastFrame = now;
  Simulation.advance(realDt);
  if (!document.hidden) {
    if (cameraGoal) {
      const a = 1 - Math.exp(-Math.min(realDt, 0.1) * 8);
      cam.x += (cameraGoal.x - cam.x) * a;
      cam.y += (cameraGoal.y - cam.y) * a;
      cam.span = Math.exp(
        Math.log(cam.span) + (Math.log(cameraGoal.span) - Math.log(cam.span)) * a,
      );
      if (
        Math.abs(Math.log(cam.span / cameraGoal.span)) < 0.0005 &&
        Math.hypot(cam.x - cameraGoal.x, cam.y - cameraGoal.y) < cam.span * 0.0001
      ) {
        cam = { ...cameraGoal };
        cameraGoal = null;
      }
    }
    if (followShip || shipFocusArmed) {
      const c = shipCamera(cam.span);
      cam.x = c.x;
      cam.y = c.y;
    }
    updateZoomControl();
    MapLayers.update(now);
    ExtendedCatalog.update(now);
    drawGrid();
    MapLabels.begin();
    drawGalaxyBackground();
    RegionMap.draw();
    drawHorizonBoundary();
    drawReachability();
    Route.draw();
    drawRoute();
    drawEffects(Math.min(realDt, 0.1));
    ExtendedCatalog.drawSystems();
    OrbitalMotion.draw();
    NuclearStars.draw();
    drawObjects();
    ExtendedCatalog.draw();
    drawShip(now);
    MapLabels.draw();
    Route.drawEncounter();
    drawHover();
    if (now - lastUI > 100) {
      renderUI();
      lastUI = now;
    }
  }
  if (now - saveTick > 1500) {
    persist();
    saveTick = now;
  }
  requestAnimationFrame(frame);
}

function zoomAtPointer(e) {
  e.preventDefault();
  cameraGoal = null;
  const factor = Math.exp(clamp(e.deltaY, -220, 220) * 0.006),
    span = clamp(cam.span * factor, 0.00006, MAX_CAMERA_SPAN);
  if (followShip || shipFocusArmed) cam = shipCamera(span);
  else {
    const r = canvas.getBoundingClientRect(),
      x = e.clientX - r.left,
      y = e.clientY - r.top,
      before = world(x, y);
    cam.span = span;
    const after = world(x, y);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
  }
  updateMapHeading();
  updateZoomControl();
}
canvas.addEventListener('wheel', zoomAtPointer, { passive: false });
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  releaseShipCamera();
  pointer = {
    down: true,
    x: e.clientX,
    y: e.clientY,
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
    id: e.pointerId,
  };
  canvas.setPointerCapture(e.pointerId);
  cameraGoal = null;
});
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect(),
    x = e.clientX - r.left,
    y = e.clientY - r.top;
  if (pointer.down && e.pointerId === pointer.id) {
    const dx = e.clientX - pointer.x,
      dy = e.clientY - pointer.y;
    if (Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > 5)
      pointer.moved = true;
    if (pointer.moved) {
      cam.x -= (dx * cam.span) / width;
      cam.y -= (dy * cam.span) / width;
      canvas.style.cursor = 'grabbing';
      updateMapHeading();
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  } else {
    hover =
      (globalThis.MapAnnotations?.active && MapAnnotations.hit(x, y)) ||
      hitObjects.find(({ p, r = 23 }) => Math.hypot(x - p.x, y - p.y) < r)?.o ||
      RegionMap.hit(x, y) ||
      globalThis.UniverseMap?.hit(x, y);
    canvas.style.cursor = hover ? 'pointer' : 'crosshair';
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (!pointer.down || e.pointerId !== pointer.id) return;
  if (!pointer.moved) {
    const r = canvas.getBoundingClientRect(),
      x = e.clientX - r.left,
      y = e.clientY - r.top;
    const hit = hitObjects
      .map((h) => ({ ...h, d: Math.hypot(x - h.p.x, y - h.p.y) }))
      .filter((h) => h.d < (h.r || 28))
      .sort((a, b) => Number(!!a.background) - Number(!!b.background) || a.d - b.d)[0];
    const annotation = globalThis.MapAnnotations?.active && MapAnnotations.hit(x, y);
    if (annotation) select(annotation.id);
    else if (hit) select(hit.o.id);
    else {
      const region = RegionMap.hit(x, y) || globalThis.UniverseMap?.hit(x, y);
      if (region) select(region.id);
    }
  }
  pointer.down = false;
  canvas.style.cursor = 'crosshair';
});
canvas.addEventListener('pointercancel', () => {
  pointer.down = false;
  canvas.style.cursor = 'crosshair';
});
canvas.addEventListener('pointerleave', () => (hover = null));

$('shipBtn').onclick = focusShip;
document.querySelectorAll('[data-zoom]').forEach(
  (b) =>
    (b.onclick = () => {
      if (Number(b.dataset.zoom) >= 115e9 && globalThis.UniverseMap) {
        UniverseMap.focus();
        return;
      }
      goCamera(cam.x, cam.y, Number(b.dataset.zoom), false, true);
    }),
);
$('expansionToggle').addEventListener('change', (e) => {
  state.expansion = e.target.checked;
  Cosmology.sync(state);
  FlightEstimate.idleKey = null;
  FlightEstimate.active = new WeakMap();
  renderUI();
  persist();
});
$('zoomSlider').addEventListener('input', (e) => {
  cameraGoal = null;
  const span = zoomInterpolate(Number(e.target.value), 'value', 'span');
  if (followShip || shipFocusArmed) cam = shipCamera(span);
  else cam.span = span;
  updateMapHeading();
  updateZoomControl();
});
$('catalogBtn').onclick = () => {
  if ($('catalog').hidden) openCatalog();
  else closeCatalog();
};
$('closeCatalog').onclick = closeCatalog;
$('search').oninput = () => {
  ExtendedCatalog.searchLimit = 100;
  clearTimeout(catalogTimer);
  catalogTimer = setTimeout(renderCatalog, 160);
};
$('themeBtn').onclick = () => applyTheme(theme === 'dark' ? 'light' : 'dark');
$('menuBtn').onclick = () => {
  const open = $('menu').hidden;
  $('menu').hidden = !open;
  $('menuBtn').setAttribute('aria-expanded', String(open));
};
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.menu-popover,.menu-button')) closeMenu();
});
$('catalogFilter').addEventListener('change', (e) => {
  filter = e.target.value;
  hover = null;
  hitObjects = [];
  RegionMap.hits = [];
  ExtendedCatalog.searchLimit = 100;
  const name = e.target.selectedOptions?.[0]?.textContent || filter;
  $('catalogBtn').title =
    (filter === 'all' ? 'Атлас' : 'Атлас · на карте: ' + name) + ' · ⌘F / Ctrl+F';
  $('catalogBtn').setAttribute(
    'aria-label',
    filter === 'all' ? 'Атлас' : 'Атлас. На карте: ' + name,
  );
  renderCatalog();
});
$('flightDetails').addEventListener('toggle', () => {
  const reading = $('flightCard').querySelector('.card-scroll'),
    details = $('flightDetails');
  reading.scrollTop = details.open
    ? reading.scrollTop + details.getBoundingClientRect().top - reading.getBoundingClientRect().top
    : 0;
});
document.querySelectorAll('[data-departure]').forEach(
  (b) =>
    (b.onclick = () => {
      if (state.flight || (b.dataset.departure !== 'engine' && !canBoost(b.dataset.departure)))
        return;
      state.departureMode = b.dataset.departure;
      if (OrbitalArrival.enabled) {
        const mode = b.dataset.departure;
        state.flightSetup = FlightSetup.normalize({
          ...FlightSetup.preferred(),
          engine: mode === 'engine',
          sail: mode !== 'engine',
          collector: mode !== 'engine',
          burst: mode === 'burst',
        });
      }
      renderUI();
      persist();
    }),
);
document.querySelectorAll('[data-sail]').forEach(
  (b) =>
    (b.onclick = () => {
      if (state.flight || !canBoost()) return;
      state.sail = +b.dataset.sail;
      renderUI();
      persist();
    }),
);

$('timeSlider').addEventListener('input', (event) =>
  setTimeRate(TIME_RATES[Number(event.target.value)]),
);
document
  .querySelectorAll('[data-time]')
  .forEach((button) => (button.onclick = () => setTimeRate(button.dataset.time)));
$('launchBtn').onclick = () => {
  syncClock();
  if (state.current === state.selected) {
    openCatalog();
  } else launch();
};
$('helpBtn').onclick = showHelp;
$('modelBtn').onclick = showModel;
$('journalBtn').onclick = showJournal;
$('objectInfo').onclick = () => showObject(state.flight?.target || state.selected);
$('closeDialog').onclick = () => $('infoDialog').close();
$('infoDialog').addEventListener('click', (e) => {
  if (e.target === $('infoDialog')) {
    const r = $('infoDialog').getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      $('infoDialog').close();
  }
});
$('resetBtn').onclick = () => {
  showDialog(
    '<div class="modal-eyebrow">НОВАЯ ЭКСПЕДИЦИЯ</div><h2>Снова от Солнца?</h2><p>Текущий прогресс в этом браузере будет сброшен.</p><button class="modal-start" id="confirmReset">Начать заново →</button>',
  );
  $('confirmReset').onclick = () => {
    state = initial();
    paused = false;
    speed = 1;
    Simulation.debt = 0;
    Simulation.wallDebt = 0;
    delete Simulation.smoothedFactor;
    lastFrame = performance.now();
    effects = [];
    goCamera(0, 0, 24);
    renderUI();
    persist();
    $('infoDialog').close();
    toast('Новая экспедиция. Солнечная система, нулевой год.');
  };
};
window.addEventListener('keydown', (e) => {
  if ($('infoDialog').open || $('flightBuilder').open) return;
  if (
    (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey &&
    (e.code === 'KeyF' || e.key.toLowerCase() === 'f')
  ) {
    e.preventDefault();
    openCatalog();
    $('search').select();
    return;
  }
  if (e.key === 'Escape' && !$('catalog').hidden) {
    if (CSS.supports('selector(:open)') && $('catalogFilter').matches(':open')) return;
    e.preventDefault();
    closeCatalog();
    return;
  }
  if (e.target.closest('input,textarea,select,button,summary,[contenteditable]')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    syncClock();
    paused = !paused;
    renderUI();
    persist();
  }
  if (e.key === 'Escape') {
    closeCatalog();
    closeMenu();
  }
  if (e.key === '+' || e.key === '=') goCamera(cam.x, cam.y, cam.span / 2, false, true);
  if (e.key === '-') goCamera(cam.x, cam.y, cam.span * 2, false, true);
});
function syncClock() {
  const now = performance.now();
  Simulation.advance(Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
}
document.addEventListener('visibilitychange', () => {
  syncClock();
  persist();
});
window.addEventListener('pagehide', persist);
resize();
if (state.flight) fitRoute(object(state.flight.target));
else if (state.current && state.current !== 'sol')
  goCamera(
    FlightView.ship().x,
    FlightView.ship().y,
    Math.max(object(state.current).d * 2, 24),
    true,
  );
globalThis.MapSlice?.setup();
FlightBuilder.setup();
Route.setup();
applyTheme(theme);
updateShipButton();
resize();
renderUI();
updateMapHeading();
renderCatalog();
MapLayers.start();
ExtendedCatalog.start();
requestAnimationFrame(frame);
