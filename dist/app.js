'use strict';
// Restore the expedition, bind controls and run the animation loop.
try {
  state = restore(JSON.parse(localStorage.getItem(STORE)));
} catch {
  state = initial();
}
FlightSetup.sync();
ArrivalStars.primeRoutes();
paused = !!state.paused;
speed = state.timeScale > 0 && TIME_RATES.includes(state.timeScale) ? state.timeScale : 1;
Simulation.restoreClock(state);
if (state.flight && state.phase !== 'flyby') Route.configure();
if (state.flight && !state.flight.markers?.length) FlightMarks.plan();
let lastFrame = performance.now();
const RuntimeLoop = {
  lastInteraction: lastFrame, lastDraw: lastFrame, idleAfter: 30000, idleInterval: 100,
  wake() { this.lastInteraction = performance.now(); },
  advance(now) {
    const realDt = Math.max(0, (now - lastFrame) / 1000);
    lastFrame = now;
    try {
      Cosmology.sync(state);
      Simulation.advance(realDt, 6);
    } catch (error) {
      // A failed physical step must not be replayed automatically every frame.
      paused = true;
      Simulation.clearClock();
      toast('Ошибка расчёта. Полёт на паузе; можно повторить или отменить его.', 10000, 'warning');
      throw error;
    }
    return realDt;
  },
  shouldDraw(now) {
    return !document.hidden && (now - this.lastInteraction < this.idleAfter ||
      cameraGoal || pointer.down || Route.feedbackPending ||
      (!paused && (state.flight || effects.length)) || now - this.lastDraw >= this.idleInterval);
  },
};
// Observers only: normal controls keep their own handlers and scroll behaviour.
for (const name of ['pointerdown', 'pointermove', 'wheel', 'keydown'])
  document.addEventListener(name, () => RuntimeLoop.wake(), {capture:true, passive:true});
for (const name of ['focus', 'resize']) window.addEventListener(name, () => RuntimeLoop.wake());
function frame(now) {
  // Keep the next frame even if streaming, drawing or a UI forecast throws.
  requestAnimationFrame(frame);
  const realDt = RuntimeLoop.advance(now);
  if (RuntimeLoop.shouldDraw(now)) {
    const drawDt = Math.max(0, (now - RuntimeLoop.lastDraw) / 1000);
    RuntimeLoop.lastDraw = now;
    if (cameraGoal) {
      // The endpoint of a zoom follows the live ship too. A fixed world-space
      // endpoint can never settle once the ship has moved during the zoom.
      if (followShip) Object.assign(cameraGoal, shipCamera(cameraGoal.span));
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
    if (followShip) {
      const c = shipCamera(cam.span);
      cam.x = c.x;
      cam.y = c.y;
    }
    updateZoomControl();
    MapLayers.update(now);
    ExtendedCatalog.update(now);
    MapDetails.beginFrame();
    try {
      drawGrid();
      MapLabels.begin();
      drawGalaxyBackground();
      RegionMap.draw();
      drawHorizonBoundary();
      drawReachability();
      Route.draw();
      drawRoute();
      drawEffects(Math.min(drawDt, 0.1));
      ExtendedCatalog.drawSystems();
      OrbitalMotion.draw();
      NuclearStars.draw();
      drawObjects();
      ExtendedCatalog.draw();
      GalacticTraffic.draw();
      drawShip(now);
      MapLabels.draw();
      Route.drawEncounter();
      drawHover();
      // Paint the distance backing over objects and their names as well as the grid.
      drawRouteDistance();
    } catch (error) {
      // Discard any canvas save/clip left behind by the interrupted layer.
      canvas.width = canvas.width;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      throw error;
    } finally {
      MapDetails.endFrame();
    }
    if (now - lastUI > 100) {
      if (globalThis.UniverseMap?.active()) updateMapHeading();
      renderUI();
      lastUI = now;
    }
  }
  if (!Route.feedbackPending && now - saveTick > 1500) {
    persist();
    saveTick = now;
  }
}

function zoomAtPointer(e) {
  e.preventDefault();
  cameraGoal = null;
  const factor = Math.exp(clamp(e.deltaY, -220, 220) * 0.006),
    span = clamp(cam.span * factor, 0.00006, MAX_CAMERA_SPAN);
  if (followShip) cam = shipCamera(span);
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
let clickedMapTarget = null, doubleClickTarget = null;
function pickMapTarget(e) {
  const r = canvas.getBoundingClientRect(),
    x = e.clientX - r.left,
    y = e.clientY - r.top;
  const traffic = GalacticTraffic.hit(x, y);
  if (traffic) return { traffic };
  const annotation = globalThis.MapAnnotations?.active && MapAnnotations.hit(x, y);
  const hit = hitObjects
    .map((h) => ({ ...h, d: Math.hypot(x - h.p.x, y - h.p.y) }))
    .filter((h) => h.d < (h.r || 28))
    .sort((a, b) => Number(!!a.background) - Number(!!b.background) || a.d - b.d)[0];
  const target = annotation || hit?.o || RegionMap.hit(x, y) ||
    MapLabels.areaHit(x, y) || globalThis.UniverseMap?.hit(x, y);
  return { id: target?.navigationId || target?.id };
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
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
    if (!pointer.moved && Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > 5) {
      pointer.moved = true;
      clickedMapTarget = doubleClickTarget = null;
      // Inspecting or dismissing a card is still compatible with ship focus.
      // Only an actual map drag releases the anchor before changing the scale.
      releaseShipCamera();
    }
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
      GalacticTraffic.hit(x,y) ||
      (globalThis.MapAnnotations?.active && MapAnnotations.hit(x, y)) ||
      hitObjects.find(({ p, r = 23 }) => Math.hypot(x - p.x, y - p.y) < r)?.o ||
      RegionMap.hit(x, y) ||
      MapLabels.areaHit(x, y) ||
      globalThis.UniverseMap?.hit(x, y);
    canvas.style.cursor = hover ? 'pointer' : 'crosshair';
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (!pointer.down || e.pointerId !== pointer.id) return;
  if (!pointer.moved) {
    const { id, traffic } = pickMapTarget(e);
    doubleClickTarget = id && id === clickedMapTarget ? id : null;
    clickedMapTarget = id || null;
    if (traffic) { if (!zenMode) GalacticTraffic.show(traffic); }
    else if (id) {
      select(id,false,{deferPreview:true,routeAnchor:!e.shiftKey});
      if (e.shiftKey) {
        doubleClickTarget = clickedMapTarget = null;
        planRoutePoint(id,{deferPreview:true});
      }
    }
    else FlightQueue.dismiss();
  }
  pointer.down = false;
  canvas.style.cursor = 'crosshair';
});
canvas.addEventListener('pointercancel', () => {
  pointer.down = false;
  clickedMapTarget = doubleClickTarget = null;
  canvas.style.cursor = 'crosshair';
});
canvas.addEventListener('pointerleave', () => (hover = null));
canvas.addEventListener('dblclick', (e) => {
  if (e.button !== 0 || e.shiftKey || pointer.moved || !doubleClickTarget) return;
  const { id } = pickMapTarget(e), target = object(id);
  if (id !== doubleClickTarget || !target?.navigable) return;
  e.preventDefault();
  if(state.selected!==id)select(id,false,{deferPreview:true});
  if(state.flight){
    if(Route.add(id,{deferPreview:true}))FlightTips.use('double-click',{persistNow:false});
    return;
  }
  // Finish the draft before starting; a repeated final point only starts it.
  if(state.itinerary.length&&state.itinerary.at(-1).id!==id&&
     !Route.add(id,{mode:'stop',deferPreview:true}))return;
  Route.cancelFeedback();
  launchSelectedTarget();
  if(state.flight)FlightTips.use('double-click');
  else Route.flushFeedback();
});

$('shipBtn').onclick = focusShip;
$('zenBtn').onclick = () => setZenMode(!zenMode);
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
  if (followShip) cam = shipCamera(span);
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
$('themeBtn').onclick = () => {
  MapFilters.close();
  closeMenu();
  $('themePicker').hidden = !$('themePicker').hidden;
  $('themeBtn').setAttribute('aria-expanded', String(!$('themePicker').hidden));
};
$('themePicker').onclick = e => {
  const button = e.target.closest('[data-color-theme]');
  if (button) applyTheme(button.dataset.colorTheme);
};
$('multiplayerToggle').onchange = e => {
  state.multiplayer = e.target.checked;
  persist(); renderUI();
};
$('libraryBtn').onclick = () => toggleMenu('library');
$('settingsBtn').onclick = () => toggleMenu('settings');
$('menu').onkeydown = (event) => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  closeMenu();
};
for (const [id, page] of [['libraryBtn','library'],['settingsBtn','settings']]) {
  $(id).onkeydown = event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    if ($('menu').hidden || $(id).getAttribute('aria-expanded') !== 'true') toggleMenu(page);
    showMenuPage(page, true);
  };
}
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#mapFilters,#mapFilterBtn')) MapFilters.close();
  if (!e.target.closest('.menu-popover,.menu-button')) closeMenu();
  if (!e.target.closest('#themePicker,#themeBtn')) {
    $('themePicker').hidden = true;
    $('themeBtn').setAttribute('aria-expanded', 'false');
  }
});
$('catalogFilter').addEventListener('change', (e) => {
  searchFilter = e.target.value;
  ExtendedCatalog.searchLimit = 100;
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
function launchSelectedTarget(event) {
  syncClock();
  if (FlightQueue.browsing()) {
    Route.add(state.selected,{deferPreview:!!event});
  } else if (state.itinerary.length) {
    if (state.itinerary.at(-1).mode === 'flyby') {
      if(Route.canSelectNext()&&Route.add(state.selected,{deferPreview:!!event}))fitRoute(object(state.selected),{wholeRoute:true});
    }
    else Route.start();
  } else if (state.current === state.selected) {
    openCatalog();
  } else launch();
}
$('launchBtn').onclick = launchSelectedTarget;
$('helpBtn').onclick = showHelp;
$('routeBtn').onclick = () => Route.show();
$('modelBtn').onclick = showModel;
$('pulsarResearchBtn').onclick = () => PulsarResearch.show();
$('journalBtn').onclick = showJournal;
$('objectInfo').onclick = () => showObject(FlightQueue.browsing() ? state.selected : state.flight?.target || state.selected);
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
    FlightQueue.reset();
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
    toast('Новая экспедиция. Солнечная система, нулевой год.',4200,'reset');
  };
};
window.addEventListener('keydown', (e) => {
  if ($('infoDialog').open || $('flightBuilder').open) return;
  if (
    (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey &&
    (e.code === 'KeyF' || e.key.toLowerCase() === 'f')
  ) {
    e.preventDefault();
    setZenMode(false);
    openCatalog();
    $('search').select();
    return;
  }
  if (e.key === 'Escape' && !$('mapFilters').hidden) {
    if (MapFilters.pickerOpen()) return;
    e.preventDefault();
    MapFilters.close();
    return;
  }
  if (e.key === 'Escape' && !$('catalog').hidden) {
    if (CSS.supports('selector(:open)') && $('catalogFilter').matches(':open')) return;
    e.preventDefault();
    closeCatalog();
    return;
  }
  if (e.key === 'Escape' && !$('menu').hidden) {
    e.preventDefault();
    closeMenu();
    return;
  }
  if (e.key === 'Escape' && !document.querySelector('dialog[open]') && !e.target.closest('input,textarea,select,[contenteditable]') && Route.undo()) {
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape' && zenMode) {
    e.preventDefault();
    setZenMode(false);
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
    $('themePicker').hidden = true;
    FlightQueue.dismiss();
  }
  if (e.key === '+' || e.key === '=') goCamera(cam.x, cam.y, cam.span / 2, false, true);
  if (e.key === '-') goCamera(cam.x, cam.y, cam.span * 2, false, true);
});
function syncClock() {
  RuntimeLoop.advance(performance.now());
}
document.addEventListener('visibilitychange', () => {
  RuntimeLoop.wake();
  syncClock();
  persist();
});
document.addEventListener('selectionchange', () => UIContent.flush());
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
MapFilters.setup();
FlightBuilder.setup();
Route.setup();
QuickFlight.setup();
applyTheme(theme);
updateShipButton();
resize();
Route.recoverCompleted();
renderUI();
updateMapHeading();
renderCatalog();
MapLayers.start();
ExtendedCatalog.start();
requestAnimationFrame(frame);
