'use strict';
// Expedition state, legacy save migration, rollback and persistence.
let state,
  paused = false,
  speed = 1,
  filter = 'all', // Map object class; independent of the atlas search.
  searchFilter = 'all',
  toastTimer,
  hover = null,
  hitObjects = [],
  lastUI = 0,
  saveTick = 0;
const initial = () => ({
  version: 13,
  flightDefaultsVersion: 2,
  reserveDefaultsVersion: 1,
  orbit: null,
  tankCapacityKg: 1,
  flightSetup: null,
  flightHistory: [],
  jettisoned: 0,
  controlG: 10,
  current: 'sol',
  selected: 'alpha',
  sail: 0,
  lightModel: 5,
  departureMode: OrbitalArrival.enabled ? 'beam' : 'engine',
  expansion: true,
  cosmicTime: 0,
  universeElapsed: 0,
  beta: 0,
  acceleration: 0,
  matter: Rocket.initialFuel,
  captured: 0,
  spentEnergy: 0,
  heatRadiated: 0,
  earth: 0,
  proper: 0,
  totalDistance: 0,
  ship: Space.point([0, 0, 0]),
  itinerary: [],
  nextTargets: [],
  multiplayer: false,
  trafficSeed: Math.floor(Math.random() * 100),
  visited: ['sol'],
  destroyed: [],
  phase: 'idle',
  flight: null,
  auto: true,
  journal: [
    {
      t: 0,
      text:
        SHIP_NAME +
        '. Сухая масса: 1 кг, включая парус Si₃N₄ 0,785 кг. Топливо: 1 / 1 кг. Фотонный двигатель готов.',
    },
  ],
});
function restore(saved) {
  if (
    !saved ||
    ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].includes(saved.version) ||
    !saved.ship ||
    !Array.isArray(saved.visited)
  )
    return initial();
  saved = JSON.parse(JSON.stringify(saved));
  if (!Array.isArray(saved.nextTargets)) saved.nextTargets = [];
  ExtendedCatalog.restore(saved);
  for (const id of new Set([
    saved.current,
    saved.selected,
    saved.flight?.target,
    saved.flight?.fromId,
    ...(saved.flight?.route || []).map((n) => n.id),
    ...(saved.itinerary || []).map((n) => n.id),
    ...(saved.nextTargets || []).map((n) => n?.id),
  ]))
    if (id && !object(id)) {
      const old = RETIRED_OBJECTS.find((o) => o.id === id);
      if (old) OBJECTS.push({ ...old, index: OBJECTS.length, retired: true });
    }
  const upgraded = {
    ...initial(),
    ...saved,
    version: 13,
    flightDefaultsVersion: 2,
    reserveDefaultsVersion: 1,
    lightModel: 5,
    sail: 0,
    controlG: 10,
    auto: true,
  };
  if (!['engine', 'beam', 'burst'].includes(upgraded.departureMode))
    upgraded.departureMode = 'engine';
  upgraded.matter = Rocket.usableFuel(upgraded.matter);
  if (!object(upgraded.selected)) upgraded.selected = object(upgraded.current)?.id || 'proxima';
  upgraded.universeElapsed = Number.isFinite(saved.universeElapsed)
    ? saved.universeElapsed
    : Math.max(0, upgraded.earth);
  upgraded.destroyed = (upgraded.destroyed || []).filter((id) => id !== 'sol');
  if (upgraded.flight?.mission?.setup?.burst && upgraded.flight.fromId === 'sol') {
    const f = upgraded.flight;
    delete f.mission;
    f.wind = null;
    f.engine = null;
    f.magnetic = null;
    f.departureMode = 'beam';
    f.boost = false;
    upgraded.phase = 'cruise';
    upgraded.acceleration = 0;
  }
  if (upgraded.current === 'sol' && upgraded.departureMode === 'burst')
    upgraded.departureMode = 'beam';
  if (saved.version < 11) {
    if (saved.version < 10) {
      const oldCapacity =
        saved.version >= 7
          ? 1e-9
          : saved.version === 6
            ? 0.001
            : Math.max(0.001, saved.matter || 0.001);
      upgraded.matter =
        Rocket.fuelCapacity * Math.max(0, Math.min(1, (saved.matter || 0) / oldCapacity));
    }
    const f = upgraded.flight;
    if (f && upgraded.phase !== 'flyby') {
      const goal = object(f.target),
        source = object(f.fromId),
        remaining = f.distance - f.covered;
      f.medium = GasMedium.forLeg(f.from || upgraded.ship, goal, 0);
      f.markers = [];
      delete f.manualCoast;
      if (upgraded.phase === 'launch' && f.fromId === 'sol' && !f.wind?.continuous) {
        upgraded.phase = 'cruise';
        upgraded.acceleration = 0;
        f.departureMode = 'beam';
        f.windFolded = true;
        f.replayRate = 1;
      } else if (upgraded.phase === 'launch' && saved.version < 10) {
        const old = f.wind,
          q = old?.rows ? Stellar.sampleProper(old, old.elapsedProper || 0) : null,
          spent = (old?.sourceOffset || 0) + (q?.source || 0),
          mode = old?.continuous ? 'beam' : 'burst';
        if (f.profile?.actual?.acceleration == null && q) {
          f.profile ??= { actual: {} };
          f.profile.actual.acceleration = {
            distance: q.distance,
            proper: q.proper,
            maxG: FlightProfile.peakWind(old, q.proper),
          };
        }
        f.wind = Stellar.sourcePlan(
          source,
          mode,
          (Rocket.dryMass + upgraded.matter) * 1000,
          Math.max(0, remaining),
          upgraded.beta,
          q?.r || Stellar.r0,
          100,
          mode === 'beam' ? Infinity : Math.max(0, Stellar.pulseYears - spent),
          upgraded.cosmicTime || 0,
          f.cosmic,
          upgraded.expansion !== false,
        );
        Object.assign(f.wind, { sourceOffset: spent, baseCovered: f.covered, elapsedProper: 0 });
        f.maxBeta = f.wind.beta;
        f.replayRate = f.wind.proper / 5;
        f.departureMode = mode;
      } else if (upgraded.phase === 'thrust' && saved.version < 10) {
        f.engine = Rocket.plan(upgraded.matter, remaining, upgraded.beta);
        f.engine.baseCovered = f.covered;
        f.maxBeta = f.engine.beta;
        f.replayRate = f.engine.burnProper / 5;
      } else if (['brake', 'dock'].includes(upgraded.phase)) {
        f.engine = null;
        f.magnetic = HybridBrake.plan(
          (Rocket.dryMass + upgraded.matter) * 1000,
          upgraded.beta,
          Magnetic.rho(f.medium.n) * f.medium.area,
        );
        f.replayRate = f.magnetic.proper / 3;
        upgraded.phase = 'brake';
        if (
          remaining * Cosmology.factor(f, upgraded.cosmicTime || 0) >
          f.magnetic.distance * (1 + 1e-9)
        ) {
          upgraded.phase = 'cruise';
          upgraded.acceleration = 0;
          f.magnetic = null;
          f.autoStopping = false;
          f.replayRate = 1;
        }
      }
      if (f.profile) {
        f.profile.phase = null;
        f.profile.replan = true;
        f.profile.braking = null;
      }
    }
    upgraded.journal.push({
      t: upgraded.earth,
      text: 'Модель обновлена: сухая масса 1 кг, бак 1 кг, парус Si₃N₄ Ø 100 м, зеркало Ø 100 км. Доля топлива, скорость, координаты и исторические часы сохранены. Остаток топлива не ограничивает возможность миссии. Вспышка Солнца запрещена.',
    });
  }
  const gasFlight = upgraded.flight;
  if (gasFlight && !gasFlight.mission && gasFlight.medium?.model !== GasMedium.model) {
    gasFlight.medium = GasMedium.forLeg(gasFlight.from || upgraded.ship, object(gasFlight.target));
    gasFlight.markers = [];
    if (upgraded.phase === 'brake') {
      gasFlight.magnetic = HybridBrake.plan(
        (Rocket.dryMass + upgraded.matter) * 1000,
        upgraded.beta,
        Magnetic.rho(gasFlight.medium.n) * gasFlight.medium.area,
      );
      gasFlight.replayRate = gasFlight.magnetic.proper / 3;
      const remaining = gasFlight.distance - gasFlight.covered;
      if (
        remaining * Cosmology.factor(gasFlight, upgraded.cosmicTime || 0) >
        gasFlight.magnetic.distance * (1 + 1e-9)
      ) {
        upgraded.phase = 'cruise';
        upgraded.acceleration = 0;
        gasFlight.magnetic = null;
        gasFlight.autoStopping = false;
        gasFlight.replayRate = 1;
      }
    }
    if (gasFlight.profile) {
      gasFlight.profile.phase = null;
      gasFlight.profile.replan = true;
      gasFlight.profile.braking = null;
    }
  }
  if (
    upgraded.orbit &&
    (upgraded.flight ||
      upgraded.current !== upgraded.orbit.targetId ||
      !Number.isFinite(upgraded.orbit.radius) ||
      !(upgraded.orbit.radius > 0) ||
      !Number.isFinite(upgraded.orbit.beta) ||
      !(upgraded.orbit.beta > 0 && upgraded.orbit.beta < 1) ||
      !Array.isArray(upgraded.orbit.radial) ||
      !Array.isArray(upgraded.orbit.tangent))
  )
    upgraded.orbit = null;
  if (upgraded.transferSetup?.setup) {
    upgraded.flightSetup = FlightSetup.normalize(upgraded.transferSetup.setup);
    upgraded.transferSetup = null;
  }
  if ((saved.flightDefaultsVersion || 0) < 2) {
    if (upgraded.flightSetup) {
      const c = upgraded.flightSetup;
      if (c.divergenceDeg === undefined || c.divergenceDeg === 0)
        c.divergenceDeg = ShipPhysics.fields.divergenceDeg[0];
      c.burst = false;
    }
    if (!upgraded.flight && upgraded.departureMode === 'burst') upgraded.departureMode = 'beam';
  }
  // Retire the old quick-menu zero-reserve preset for future starts only.
  // Executing plans, queued stops, fuel and clocks keep their saved values.
  if ((saved.reserveDefaultsVersion || 0) < 1 && upgraded.flightSetup?.arrivalFuelPercent === 0) {
    upgraded.flightSetup.arrivalFuelPercent = 50;
    upgraded.flightSetup.fill = true;
  }
  if (!upgraded.flight) {
    const host = object(upgraded.current),
      star = ExtendedCatalog.arrivalStar(host, upgraded.destroyed);
    // Old stationary saves already occupy the arrival point. Reveal its star
    // without changing the position, fuel, clocks or an active trajectory.
    if (star && !upgraded.orbit && Space.distance(upgraded.ship, host) < 1e-10) {
      ExtendedCatalog.revealArrival(host, star);
      upgraded.current = star.id;
      if (upgraded.selected === host.id) upgraded.selected = star.id;
      for (const id of [host.id, star.id])
        if (!upgraded.visited.includes(id)) upgraded.visited.push(id);
    }
    upgraded.beta = upgraded.orbit?.beta || 0;
  }
  if (upgraded.orbit) {
    const o = upgraded.orbit,
      host = object(o.targetId);
    if (host?.p3) {
      const angle = o.angle || 0,
        radial = V3.add(V3.mul(o.radial, Math.cos(angle)), V3.mul(o.tangent, Math.sin(angle)));
      upgraded.ship = Space.point(V3.add(host.p3, V3.mul(radial, o.radius / LY)));
    }
  }
  if (upgraded.flight && !('cosmic' in upgraded.flight))
    upgraded.flight.cosmic = Cosmology.isCosmic(
      object(upgraded.flight.fromId) || upgraded.flight.from,
      object(upgraded.flight.target),
    );
  upgraded.nextTargets = (Array.isArray(saved.nextTargets) ? saved.nextTargets : [])
    .filter(n => n && object(n.id)?.navigable).slice(0, 10)
    .map(n => ({id: n.id, setup: FlightSetup.normalize(n.setup || upgraded.flightSetup || FlightSetup.defaults(upgraded))}));
  upgraded.multiplayer = saved.multiplayer === true;
  upgraded.trafficSeed = Number.isInteger(saved.trafficSeed) ? ((saved.trafficSeed % 100) + 100) % 100 : upgraded.trafficSeed;
  return Route.sanitize(upgraded);
}

const FlightHistory = {
  pending: null,
  snapshot() {
    ExtendedCatalog.capture(state);
    const saved = JSON.parse(JSON.stringify(state));
    saved.paused = paused;
    saved.timeScale = speed;
    return saved;
  },
  complete(f) {
    if (!f || f.historyRecorded) return;
    FlightView.at(f, 0);
    const fraction = Math.max(0, Math.min(1, f.covered / f.distance));
    if (fraction > 0) {
      state.flightHistory ??= [];
      state.flightHistory.push({
        fromId: f.fromId,
        target: f.target,
        from: JSON.parse(JSON.stringify(f.from)),
        end: Space.point(state.ship.p3),
        view: JSON.parse(JSON.stringify(f.view)),
        fraction,
        ...(f.detachedSource ? { detachedSource: true } : {}),
      });
    }
    f.historyRecorded = true;
  },
  draw() {
    for (const h of state.flightHistory || []) {
      const a = FlightView.at(h, 0),
        b = FlightView.at(h, h.fraction),
        segment = routeScreenSegment({ x: a.x, y: a.y }, { x: b.x, y: b.y });
      if (segment) line(segment.a.x, segment.a.y, segment.b.x, segment.b.y, '#858585', 1, []);
    }
  },
  cancel() {
    const saved = state.flight?.rollback;
    if (!saved) return;
    state = restore(saved);
    FlightQueue.reset();
    paused = !!saved.paused;
    speed = saved.timeScale || 1;
    Simulation.debt = Simulation.wallDebt = 0;
    delete Simulation.smoothedFactor;
    effects = [];
    Route.picking = false;
    Cosmology.sync(state);
    FlightEstimate.idleKey = null;
    FlightProfile.idleKey = null;
    FlightSetup.sync();
    lastFrame = performance.now();
    persist();
    renderUI();
    renderCatalog();
    const p = FlightView.ship();
    goCamera(p.x, p.y, cam.span, true);
    toast('Полёт отменён. Состояние до старта восстановлено.');
  },
};

function persist() {
  try {
    ExtendedCatalog.capture(state);
    state.paused = paused;
    state.timeScale = speed;
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {}
}
function log(text) {
  state.journal.push({ t: state.earth, text });
  if (state.journal.length > 100) state.journal.shift();
  persist();
}
