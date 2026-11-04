'use strict';
// Flight commands and compatibility with saved legacy trajectories.
function coastSetup() {
  /* Cruise speed now converts proper years directly in Simulation. */
}
function launch(forceEngine = false) {
  if (!forceEngine) FlightSetup.sync();
  if (!forceEngine && MissionPlanner.enabledIdle()) {
    MissionPlanner.launch();
    return;
  }
  if (state.flight) return;
  const target = object(state.selected);
  if (!target || target.id === state.current || !target.navigable) return;
  state.controlG = 10;
  state.auto = true;
  const boost = !forceEngine && wantsBoost();
  if (!forceEngine && state.current === 'sol' && state.departureMode === 'burst') {
    toast('Вспышка Солнца запрещена. Выберите собственную тягу или постоянный свет.');
    return;
  }
  if (!boost && !Rocket.usableFuel(state.matter)) {
    toast('Нет рабочего вещества для тяги.');
    return;
  }
  const from = { ...state.ship },
    d = distance(from, target),
    cosmic = Cosmology.isCosmic(object(state.current) || from, target);
  Cosmology.sync(state);
  if (d < 1e-14) return;
  const engine = boost
      ? null
      : Rocket.plan(
          state.matter,
          d * (cosmic ? Cosmology.scale() : 1),
          0,
          Math.max(1, state.controlG || 100),
        ),
    wind = boost ? { ...windPlan(), baseCovered: 0, elapsedProper: 0 } : null;
  const rollback = FlightHistory.snapshot(),
    summary = FlightEstimate.get();
  state.flight = {
    rollback,
    summary: { distance: d, proper: summary?.proper, earth: summary?.earth },
    cosmic,
    from,
    target: target.id,
    arrivalStar: ExtendedCatalog.arrivalStar(target),
    fromId: state.current,
    distance: d,
    covered: 0,
    coastRate: 0,
    maxBeta: wind ? wind.beta : engine.beta,
    engine,
    wind,
    magnetic: null,
    boost,
    departureMode: boost ? state.departureMode : 'engine',
    starEpochEarth: state.earth,
    starR0: Stellar.r0,
    medium: GasMedium.forLeg(from, target, state.sail),
    missed: false,
    autoStopping: false,
    replayRate: (wind ? wind.proper : engine.burnProper) / 5,
  };
  state.beta = 0;
  state.acceleration = boost
    ? Stellar.sample(wind, 0).force / wind.massKg
    : Rocket.acceleration(Rocket.dryMass + state.matter, engine.maxG);
  state.phase = boost ? 'launch' : 'thrust';
  Simulation.smoothedFactor = Math.min(1, state.flight.replayRate);
  paused = false;
  if (boost) {
    const current = object(state.current);
    if (state.departureMode === 'burst') {
      state.destroyed.push(current.id);
      effects.push({ x: from.x, y: from.y, p3: from.p3, age: 0 });
    }
    log(
      (state.departureMode === 'burst' ? 'Звёздная вспышка: ' : 'Постоянный свет: ') +
        current.name +
        '. Зеркало Ø 100 км. Прогноз ' +
        percentC(wind.beta) +
        '. Топливо сохранено.',
    );
    toast(
      state.departureMode === 'burst'
        ? 'Вспышка длится 30 суток у звезды.'
        : 'Постоянный пучок света: звезда сохраняется.',
    );
  } else
    log(
      'Фотонный разгон. Курс: ' +
        target.name +
        '. Начальная масса ' +
        massText(engine.m0) +
        '; запас на разгон ' +
        massText(engine.budget) +
        '.',
    );
  state.current = null;
  FlightMarks.plan();
  renderUI();
  fitRoute(target);
  persist();
}
function cutEngine() {
  const f = state.flight;
  if (!f) return;
  if (['launch', 'thrust'].includes(state.phase)) FlightMarks.actual('acceleration');
  if (state.phase === 'launch') f.windFolded = true;
  state.phase = 'cruise';
  state.acceleration = 0;
  coastSetup();
  renderUI();
  persist();
}
function beginDock() {
  const f = state.flight;
  if (!f) return;
  if (state.beta <= 1e-12) {
    state.beta = 0;
    finishFlight(Math.abs(f.covered - f.distance) <= Simulation.tolerance(f) * 4);
    return;
  }
  f.engine = Rocket.retroPlan(state.matter, state.beta, Magnetic.maxG);
  f.replayRate = f.engine.burnProper / 2;
  if (!f.engine.canStop) {
    toast('Недостаточно вещества для точной остановки. Продолжаем захват.');
    state.phase = 'brake';
    f.magnetic = Magnetic.plan((Rocket.dryMass + state.matter) * 1000, state.beta);
    return;
  }
  FlightMarks.actual('fine');
  state.phase = 'dock';
  state.acceleration = -Rocket.acceleration(Rocket.dryMass + state.matter, f.engine.maxG);
}
function beginBrake(auto = false) {
  const f = state.flight;
  if (!f || state.beta <= 0) return;
  if (['launch', 'thrust'].includes(state.phase)) FlightMarks.actual('acceleration');
  f.windFolded = true;
  f.autoStopping = auto;
  const stop = HybridBrake.stopping(state.matter, state.beta, 100, f.medium);
  // At high gamma, rounded beta makes the switch root slightly discontinuous.
  // Fly the remaining positive gap before braking instead of stopping short.
  const switchGap = f.distance - f.covered - Simulation.stoppingDistance(stop);
  if (auto && switchGap > Simulation.tolerance(f) && switchGap <= f.distance * 1e-8) {
    state.phase = 'cruise';
    state.acceleration = 0;
    f.magnetic = null;
    f.replayRate = 1;
    return;
  }
  FlightMarks.actual('brake');
  f.magnetic = stop.magnetic;
  f.replayRate = f.magnetic.proper / 3;
  f.magnetic.elapsedProper = 0;
  state.phase = 'brake';
  state.acceleration = Magnetic.sample(f.magnetic, 0).properAcceleration;
  FlightMarks.set(
    f,
    'fine',
    FlightMarks.at(f, f.covered + f.magnetic.distance / Cosmology.factor(f)),
  );
}

function advance(ds, earth, proper, comoving = false, path) {
  const f = state.flight,
    metric = Cosmology.factor(
      f,
      (state.cosmicTime || 0) + (state.expansion !== false ? earth / 2 : 0),
    );
  FlightProfile.record(
    f,
    comoving ? (path ?? ds * metric) : ds,
    proper,
    Math.abs(state.acceleration || 0) / G0,
  );
  f.covered += comoving ? ds : ds / metric;
  state.totalDistance += comoving ? (path ?? ds * metric) : ds;
  state.earth += earth;
  state.proper += proper;
  Cosmology.elapse(state, earth);
  const p = f.covered / f.distance,
    target = f.aim || object(f.target);
  state.ship = Space.mix(f.from, target, p);
  if (
    f.covered > f.distance + Math.max(1e-10, f.distance * 1e-10) &&
    !f.missed &&
    state.beta > 1e-8
  ) {
    f.missed = true;
    toast('Цель пройдена. Физический тормозной путь ещё не исчерпан.');
  }
}
function finishFlight(arrived) {
  const f = state.flight,
    target = object(f.target);
  FlightHistory.complete(f);
  state.orbit = null;
  if (arrived) {
    const stop = ExtendedCatalog.revealArrival(
      target,
      f.arrivalStar ||
        f.mission?.arrivalStar ||
        (f.mission?.arrival ? null : ExtendedCatalog.arrivalStar(target)),
    );
    state.ship = Space.point(stop.p3);
    state.current = stop.id;
    if (stop !== target) {
      state.selected = stop.id;
      if (!state.visited.includes(stop.id)) state.visited.push(stop.id);
    }
    if (state.transferSetup?.starId === target.id) {
      state.flightSetup = FlightSetup.normalize(state.transferSetup.setup);
      state.departureMode = state.flightSetup.sail
        ? state.flightSetup.burst
          ? 'burst'
          : 'beam'
        : 'engine';
      state.transferSetup = null;
    }
    if (!state.visited.includes(target.id)) state.visited.push(target.id);
    log(
      'Прибытие: ' +
        stop.name +
        '. Борт: ' +
        compact(state.proper) +
        ' лет; Неподвижный наблюдатель: ' +
        compact(state.earth) +
        ' лет.',
    );
    toast('Прибытие: ' + stop.name + '. Выберите следующую цель.');
  } else {
    state.current = null;
    log('Остановка вне цели. До неё ' + distanceText(distance(state.ship, target)) + '.');
    toast(SHIP_NAME + ' остановлен. До цели ' + distanceText(distance(state.ship, target)) + '.');
  }
  const orbital = arrived && OrbitalArrival.park(f);
  if (orbital) {
    log(
      'Круговая орбита: ' +
        fmt(state.orbit.radius / Stellar.r0, 2) +
        ' а.е.; ' +
        fmt(state.orbit.speed / 1000, 2) +
        ' км/с.',
    );
    toast('Выход на орбиту: ' + target.name + '.');
  }
  state.matter = Rocket.usableFuel(state.matter);
  if (!orbital) state.beta = 0;
  state.acceleration = 0;
  state.phase = 'idle';
  state.flight = null;
  renderUI();
  renderCatalog();
  persist();
  if (arrived) Route.afterStop(f);
}
function autoFraction(predict) {
  const f = state.flight,
    remaining = f.distance - f.covered;
  if (Route.isFlyby()) {
    if (predict(1).distance / Cosmology.factor(f) <= remaining) return 1;
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 60; i++) {
      const p = (lo + hi) / 2;
      if (predict(p).distance / Cosmology.factor(f) > remaining) hi = p;
      else lo = p;
    }
    return (lo + hi) / 2;
  }
  if (!Route.braking()) return 1;
  const gap = (p) => {
    const v = predict(p),
      epoch = state.cosmicTime || 0,
      dt = state.expansion !== false ? v.earth : 0;
    return (
      remaining -
      (v.comovingDistance ?? v.distance / Cosmology.factor(f, epoch + dt / 2)) -
      Simulation.stoppingDistance(
        Magnetic.stopping(v.fuel, v.beta, Math.max(1, Math.abs(state.controlG) || 100)),
        epoch + dt,
      )
    );
  };
  if (gap(1) >= 0) return 1;
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (gap(mid) >= 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
function tickPhysics(dt) {
  Simulation.tick(dt);
}
