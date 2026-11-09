'use strict';
// Flight telemetry and previews. Physical calculations live in physics.js.
function canBoost(mode = state.departureMode) {
  const current = object(state.current);
  return (
    !!current &&
    ['star', 'home'].includes(current.kind) &&
    !state.destroyed.includes(current.id) &&
    !(mode === 'burst' && current.id === 'sol')
  );
}
function wantsBoost() {
  return canBoost() && state.departureMode !== 'engine';
}
const windCache = new Map();
function windPlan(index = 0) {
  const source = object(state.current) || object(state.flight?.fromId),
    goal = object(state.selected),
    mass = (Rocket.dryMass + state.matter) * 1000,
    g = Rocket.maxG,
    d = goal?.p3 ? distance(state.ship, goal) : 0,
    mode = state.departureMode === 'beam' ? 'beam' : 'burst',
    key = [
      source?.id,
      goal?.id,
      mass,
      d,
      mode,
      Math.floor((state.cosmicTime || 0) / 1000),
      state.expansion,
    ].join(':');
  if (!windCache.has(key)) {
    if (windCache.size > 12) windCache.clear();
    windCache.set(
      key,
      Stellar.sourcePlan(
        source,
        mode,
        mass,
        d,
        0,
        Stellar.r0,
        g,
        null,
        state.cosmicTime || 0,
        Cosmology.isCosmic(source || state.ship, goal),
        state.expansion !== false,
      ),
    );
  }
  return windCache.get(key);
}
function quantity(n) {
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e3 || abs < 0.01)) {
    const e = Math.floor(Math.log10(abs));
    return (
      fmt(n / 10 ** e, 1) +
      '·10' +
      String(e).replace(
        /[0-9-]/g,
        (c) =>
          ({
            0: '⁰',
            1: '¹',
            2: '²',
            3: '³',
            4: '⁴',
            5: '⁵',
            6: '⁶',
            7: '⁷',
            8: '⁸',
            9: '⁹',
            '-': '⁻',
          })[c],
      )
    );
  }
  return fmt(n, 2);
}
function renderAcceleration() {
  const c = FlightSetup.read(),
    actual = state.flight ? (state.acceleration || 0) / G0 : 0,
    g = Math.abs(actual) < 1e-8 ? 0 : actual,
    visible = clamp(g, -c.maxBrakingG, c.maxAccelerationG),
    fraction = visible / (visible < 0 ? c.maxBrakingG : c.maxAccelerationG),
    label = (g > 0 ? '+' : '') + fmt(g, 2) + ' g';
  UIContent.html($('acceleration'), (g > 0 ? '+' : '') + fmt(g, 2) + '<small>g</small>');
  $('accelerationFill').style.left = (fraction < 0 ? 50 + fraction * 50 : 50) + '%';
  $('accelerationFill').style.width = Math.abs(fraction) * 50 + '%';
  const limitText = (n) =>
    n >= 1e4 || n < 0.01 ? quantity(n) : fmt(n, Number.isInteger(n) ? 0 : 2);
  UIContent.text($('accelerationMin'), '−' + limitText(c.maxBrakingG) + ' g');
  UIContent.text($('accelerationMax'), '+' + limitText(c.maxAccelerationG) + ' g');
  $('accelerationBar').setAttribute('aria-valuemin', String(-c.maxBrakingG));
  $('accelerationBar').setAttribute('aria-valuemax', String(c.maxAccelerationG));
  $('accelerationBar').setAttribute('aria-valuenow', String(visible));
  $('accelerationBar').setAttribute('aria-valuetext', label);
  $('accelerationBar').title = 'Текущее собственное ускорение: ' + label;
}
function profileDistance(d) {
  return d < 0.01 ? fmt(d * 63241.077, d * 63241.077 < 10 ? 2 : 0) + ' а.е.' : distanceText(d);
}
function renderFlightProfile(eta) {
  const p = FlightProfile.get(eta);
  $('flightProfile').hidden = !p;
  if (!p) return;
  for (const [key, label] of [
    ['acceleration', 'Разгон'],
    ['braking', 'Торможение'],
  ]) {
    const q = p[key],
      prefix = key === 'acceleration' ? 'boost' : 'stop';
    UIContent.text($('' + prefix + 'Stage'), label + (q?.actual ? ' · факт' : q?.remainingOnly ? ' · осталось' : ' · ≈'));
    UIContent.text($('' + prefix + 'Distance'), q ? profileDistance(q.distance) : '—');
    UIContent.text($('' + prefix + 'Proper'), q
      ? durationText(q.proper)
      : p.flyby
        ? 'пролёт'
        : p.unreachable
          ? 'нет прибытия'
          : '—');
    UIContent.text($('' + prefix + 'Peak'), q ? fmt(q.maxG, 2) + ' g' : '—');
  }
}
function gammaText(beta) {
  if (!Number.isFinite(beta)) return '—';
  const gamma = 1 / Math.sqrt((1 - beta) * (1 + beta)),
    delta = 2 * Math.sinh(Math.atanh(beta) / 2) ** 2;
  if (beta > 0 && delta < 1e-8) {
    const e = Math.floor(Math.log10(delta));
    return '1 + ' + fmt(delta / 10 ** e, 2) + '·10^' + e;
  }
  return fmt(gamma, gamma < 1.01 ? 8 : gamma < 2 ? 5 : 2);
}
function renderDepartureDiagram(forecast, wind) {
  const mode = wind ? (wind.continuous ? 'beam' : 'burst') : 'engine',
    peak = forecast?.peakBeta;
  const known = Number.isFinite(peak),
    boost = forecast?.acceleration;
  UIContent.text($('departureDiagramTitle'), {
    engine: 'РАЗГОН · СОБСТВЕННАЯ ТЯГА',
    beam: 'РАЗГОН · СВЕТ ЗВЕЗДЫ',
    burst: 'РАЗГОН · ЗВЁЗДНАЯ ВСПЫШКА',
  }[mode]);
  UIContent.text($('sailGamma'), gammaText(peak));
  UIContent.text($('departureSpeed'), known ? '≈ ' + percentC(peak) : '—');
  $('departureGamma').title =
    'Лоренц-фактор при прогнозной скорости в конце разгона, относительно неподвижного наблюдателя. γ = 1 / √(1 − β²).';
  UIContent.text($('departureDistance'), boost
    ? 'Путь разгона ≈ ' +
      profileDistance(boost.distance) +
      ' · ' +
      durationText(boost.proper) +
      ' на борту'
    : 'Нет прогноза разгона');
  const ship = '<path d="m258 59 16 5-16 5 4-5Z"/><path d="M301 64h28m-5-4 5 4-5 4"/>';
  const sail =
    '<path d="M286 44q14 20 0 40m0-40-13 20 13 20"/><text x="289" y="102" text-anchor="middle">парус</text><text x="289" y="117" text-anchor="middle">Ø 100 м</text>';
  // A spherical wavefront with a compact core, drawn like the other chart symbols.
  const star =
    mode === 'burst'
      ? '<circle cx="35" cy="64" r="4"/><circle cx="35" cy="64" r="12"/><circle cx="35" cy="64" r="23" stroke-dasharray="2 3"/><path d="M35 32v7m0 50v7M3 64h7m50 0h7M12 41l5 5m36 36 5 5M12 87l5-5m36-36 5-5"/>'
      : '<circle cx="35" cy="64" r="12"/><path d="M35 42v-7m0 58v-7M13 64H6m58 0h-7"/>';
  const optical =
    star +
    '<text x="35" y="18" text-anchor="middle">' +
    (mode === 'burst' ? 'вспышка' : 'звезда') +
    '</text><path d="M68 56 107 48m-39 16h43m-43 8 39 8M112 43q14 21 0 42"/><text x="114" y="102" text-anchor="middle">коллектор</text><text x="114" y="117" text-anchor="middle">Ø 100 км</text><path d="M128 56h117m-117 8h117m-117 8h117" stroke-dasharray="4 4"/><text x="186" y="38" text-anchor="middle">пучок →</text><path d="M35 124v10m77-10v10M35 129h77m-72-3-5 3 5 3m67-6 5 3-5 3"/><text x="73" y="151" text-anchor="middle">' +
    fmt(wind?.collectorR / Stellar.r0, 2) +
    ' а.е.</text>';
  const engine =
    '<path d="m241 54-22 10 22 10m-9-20-28 10 28 10" stroke-dasharray="3 3"/><text x="216" y="36" text-anchor="middle">фотоны ←</text><text x="280" y="102" text-anchor="middle">двигатель</text><path d="M35 64h148" stroke-dasharray="2 5"/><circle cx="35" cy="64" r="3"/><text x="35" y="36" text-anchor="middle">старт</text><text x="170" y="137" text-anchor="middle">парус сложен · расход топлива</text>';
  UIContent.html($('sailDiagram'), (mode === 'engine' ? engine : optical) + ship + (mode === 'engine' ? '' : sail));
  $('sailDiagram').setAttribute(
    'aria-label',
    mode === 'engine'
      ? 'Фотонный двигатель выбрасывает свет назад и разгоняет корабль; парус сложен'
      : (mode === 'burst' ? 'Вспышка' : 'Свет звезды') +
          ' → зеркало-коллектор → направленный пучок → парус корабля. Расстояние от звезды до коллектора ' +
          fmt(wind.collectorR / Stellar.r0, 2) +
          ' а.е.',
  );
}
function renderUI() {
  if(state.flight?.routeIssue)paused=true;
  if(Route.feedbackPending){Route.renderFeedback();return;}
  globalThis.MapSlice?.renderSelection();
  FlightSetup.sync();
  Cosmology.sync(state);
  $('expansionToggle').checked = state.expansion !== false;
  UIContent.text($('expansionFactor'), (state.expansion !== false ? 'ВКЛ' : 'ВЫКЛ') +
    ' · a = ' +
    fmt(Cosmology.scale(), Cosmology.scale() < 10 ? 6 : 2));
  const f = state.flight,
    target = object(f ? f.target : state.selected),
    current = object(state.current),
    active = !!f,
    boost = wantsBoost(),
    arrived = !active && state.current === target.id;
  if (f && !f.summary) {
    const estimate = f.mission || FlightEstimate.get();
    f.summary = { distance: f.distance, proper: estimate?.proper, earth: estimate?.earth };
  }
  UIContent.text($('distanceCaption'), 'РАССТОЯНИЕ ДО ЦЕЛИ');
  UIContent.text($('targetName'), target.name);
  UIContent.text($('targetType'), objectTypeText(target));
  $('targetVisited').hidden = !state.visited.includes(target.id);
  $('flightCard').classList.toggle('in-flight', active);
  const locationFrom = active
    ? object(f.fromId)?.name || f.from?.name || 'Межзвёздное пространство'
    : current ? 'Стоянка · ' + current.name : 'Межзвёздное пространство';
  UIContent.text($('shipLocationFrom'), locationFrom);
  UIContent.text($('shipLocationTo'), active ? target.name : '');
  $('shipLocationArrow').hidden = !active;
  $('shipLocationTo').hidden = !active;
  $('shipLocationIcon').setAttribute('href', active ? '#ship-icon' : '#station-icon');
  UIContent.text($('shipLocationType'), objectTypeText(active ? null : current) +
    (state.orbit && current && !active
      ? ' · орбита ' + fmt(state.orbit.radius / Stellar.r0, 2) + ' а.е.'
      : ''));
  $('shipLocationType').hidden = active || !current;
  $('shipLocation').title = active
    ? locationFrom + ' → ' + target.name
    : current
      ? current.name + ' · ' + objectTypeText(current)
      : locationFrom;
  const d = target.navigable
    ? (f?.summary?.distance ?? f?.distance ?? Cosmology.physicalDistance(state.ship, target))
    : NaN;
  UIContent.html($('targetDistance'), Number.isFinite(d)
    ? compact(d) + ' <small>св. лет</small>'
    : '<small>Расстояние неизвестно</small>');
  $('departureSection').hidden = active || arrived || !target.navigable;
  document.querySelectorAll('[data-departure]').forEach((b) => {
    const on = (state.departureMode || 'burst') === b.dataset.departure;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
    b.hidden = b.dataset.departure === 'burst' && current?.id === 'sol';
    b.disabled = b.dataset.departure !== 'engine' && !canBoost(b.dataset.departure);
  });
  const planningBoost =
    !MissionPlanner.enabledIdle() &&
    !state.flightSetup &&
    !active &&
    boost &&
    !arrived &&
    target.navigable;
  $('sailSection').hidden = !planningBoost;
  const sail = SAILS[0];
  if (planningBoost) {
    const predicted = windPlan(),
      light = Stellar.stellarLight(current);
    UIContent.text($('sourceStarName'), 'Источник: ' + current.name);
    UIContent.text($('sailArea'), 'Парус Ø ' +
      fmt(SHIP.sailDiameterM, 0) +
      ' м · коллектор Ø ' +
      fmt(Stellar.collectorDiameterM / 1000, 2) +
      ' км');
    $('sailArea').title = 'Si₃N₄ · 0,1 г/м² · масса плёнки 0,785 кг';
    const sourceRow = (label, value) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>';
    UIContent.html($('sourceReadout'), '<p class="source-basis">' +
      (predicted.continuous
        ? light.estimated
          ? 'Оценка по типу звезды'
          : 'Каталожная болометрическая светимость'
        : 'Модельная вспышка · 30 суток у источника') +
      '</p><dl class="source-specs">' +
      sourceRow('Светимость', quantity(predicted.luminosityW) + ' Вт') +
      sourceRow('В единицах Солнца', quantity(predicted.luminosityW / 3.828e26) + ' L☉') +
      sourceRow('Звезда → коллектор', fmt(predicted.collectorR / Stellar.r0, 2) + ' а.е.') +
      sourceRow('Пучок к парусу', quantity(predicted.beamPower) + ' Вт') +
      '</dl>');
  }
  const departurePreview =
    !MissionPlanner.enabledIdle() && !state.flightSetup && !active && !arrived && target.navigable;
  $('departureDiagram').hidden = !departurePreview;
  if (departurePreview)
    renderDepartureDiagram(FlightEstimate.get(), planningBoost ? windPlan() : null);

  const photon = (state.phase === 'thrust' || state.phase === 'dock') && f?.engine,
    wind = state.phase === 'launch' && f?.wind,
    mag = state.phase === 'brake' && f?.magnetic;
  const planningEngine =
    !MissionPlanner.enabledIdle() &&
    !state.flightSetup &&
    !active &&
    !boost &&
    !arrived &&
    target.navigable;
  $('engineSection').hidden = !(planningEngine || photon || wind || mag || state.phase === 'flyby');
  $('burnTrack').hidden = !photon;
  if (planningEngine) {
    const e = Rocket.plan(state.matter, d);
    UIContent.text($('engineLabel'), 'ФОТОННАЯ ТЯГА · ДО ' + fmt(Rocket.maxG, 2) + ' g');
    UIContent.html($('engineReadout'), 'Масса <b>' +
      massText(Rocket.dryMass) +
      ' + ' +
      massText(state.matter) +
      '</b><br>Разгон <b>до ' +
      massText(e.budget) +
      ' → ' +
      percentC(e.beta) +
      '</b>');
  }
  if (photon) {
    const e = f.engine;
    UIContent.text($('engineLabel'), e.direction < 0 ? 'ОБРАТНАЯ ФОТОННАЯ ТЯГА' : 'АННИГИЛЯЦИЯ ВЕЩЕСТВА');
    UIContent.html($('engineReadout'), 'Расход <b>' +
      massText(e.burned) +
      ' / ' +
      massText(e.budget) +
      '</b><br>Энергия <b>' +
      quantity(e.energy / 1e15) +
      ' ПДж</b>');
    $('burnBar').style.width = (e.budget ? (100 * e.burned) / e.budget : 0) + '%';
  }
  if (wind) {
    const sample = f.wind.lastSample || Stellar.sampleProper(f.wind, f.wind.elapsedProper || 0),
      r = sample.r,
      force = sample.force;
    UIContent.text($('engineLabel'), (f.wind.continuous ? 'СВЕТ ЗВЕЗДЫ' : 'СВЕТ ВСПЫШКИ') +
      ' · РАСКРЫТИЕ ' +
      fmt(sample.opening * 100, 2) +
      '%');
    UIContent.html($('engineReadout'), 'До звезды <b>' +
      compact(r / Stellar.r0) +
      ' а.е.</b><br>Сила <b>' +
      quantity(force) +
      ' Н</b><br>Свет испущен на <b>' +
      fmt(((f.wind.sourceOffset || 0) + sample.source) * 365.25, 2) +
      (f.wind.continuous ? ' сут.</b> непрерывного излучения' : ' / 30 сут.</b> вспышки'));
  }
  if (mag) {
    const rates =
      f.magnetic.lastSample || ProperTime.at(f.magnetic, Magnetic, f.magnetic.elapsedProper || 0);
    UIContent.text($('engineLabel'), 'ПАРУС + ОБРАТНАЯ ТЯГА');
    UIContent.html($('engineReadout'), f.medium.label +
      '<br>В баке <b>' +
      massText(state.matter) +
      '</b><br>Мощность двигателя <b>' +
      quantity(rates.enginePower || 0) +
      ' Вт</b><br>Суммарное торможение <b>' +
      fmt(-rates.properAcceleration / G0, 2) +
      ' g</b>');
  }

  if (state.phase === 'flyby') {
    const p = f.encounter.plan,
      local = Gravity.atProper(p, p.elapsedProper || 0);
    UIContent.text($('engineLabel'), 'ГРАВИТАЦИОННЫЙ ПРОЛЁТ · 0 g');
    UIContent.html($('engineReadout'), 'Поворот <b>' +
      Route.angleText(p.angle) +
      '</b><br>Перицентр <b>' +
      Route.radiusText(p.rp) +
      '</b><br>Локальная скорость <b>' +
      percentC(local.localBeta) +
      '</b>');
  }
  let action, hint;
  if (active) {
    action = '';
    hint = f.missed
      ? 'Цель пройдена. Остановка потребует оставшегося тормозного пути.'
      : state.phase === 'thrust'
        ? 'Двигатель расходует массу. Скорость растёт по ракетному уравнению.'
        : state.phase === 'launch'
          ? f.wind?.beamPower
            ? 'Пучок не расходится. Доплеровское ослабление растёт со скоростью.'
            : 'Парус Ø 100 м. Поток слабеет как 1/r² и из-за эффекта Доплера.'
          : state.phase === 'brake'
            ? 'Парус собирает газ, двигатель расходует часть потока на обратную тягу. Остаток топлива зависит от траектории.'
            : state.phase === 'dock'
              ? 'Торможение парусом ослабло. Последнюю скорость гасит двигатель обратной тягой.'
              : 'Инерционный полёт. Тормозной путь рассчитывается по текущей скорости и массе.';
  } else if (arrived) {
    action = 'Выбрать следующую цель';
    hint = boost
      ? 'Прибытие. Выберите цель — и подготовьте звёздный парус.'
      : 'Прибытие. Следующую точку можно выбрать через поиск.';
  } else if (!target.navigable) {
    action = 'Объект каталога';
    hint = target.atlasOnly
      ? 'Положение недостаточно точное для карты и полёта. Объект доступен в поиске.'
      : 'Область атласа с условным положением; физический маршрут не назначается.';
  } else if (boost) {
    action = state.departureMode === 'beam' ? 'Лететь на парусе' : 'Взорвать и лететь';
    hint =
      state.departureMode === 'beam'
        ? 'Свет звезды · топливо сохраняется.'
        : 'Звезда будет уничтожена · топливо сохраняется.';
  } else {
    action = 'Лететь на тяге';
    hint =
      Rocket.usableFuel(state.matter) > 0
        ? 'Топливо расходуется · торможение автоматически.'
        : 'Запас рабочего вещества исчерпан.';
  }
  $('launchBtn').hidden = active;
  UIContent.text($('launchBtn').querySelector('span'), action);
  $('launchBtn').disabled =
    !target.navigable || (!arrived && !boost && !Rocket.usableFuel(state.matter));
  UIContent.text($('flightHint'), hint + (target.positionQuality === 'approximate' ? ' Позиция приблизительная.' : ''));
  const phases = {
    thrust: 'ФОТОННАЯ ТЯГА',
    launch: 'РАЗГОН СВЕТОМ',
    cruise: 'ИНЕРЦИОННЫЙ ПОЛЁТ',
    brake: 'ПАРУС + ОБРАТНАЯ ТЯГА',
    dock: 'ТОЧНАЯ ОСТАНОВКА',
    flyby: 'ГРАВИТАЦИОННЫЙ ПРОЛЁТ',
  };
  UIContent.text($('phaseTag'), paused
    ? 'ПАУЗА'
    : active
      ? phases[state.phase]
      : arrived
        ? 'ВЫ ЗДЕСЬ'
        : 'ЦЕЛЬ');
  $('flightControls').hidden = !active;
  const eta = FlightEstimate.get();
  $('horizonNotice').hidden = !eta?.unreachable;
  UIContent.text($('horizonNotice'), eta?.unreachable
    ? 'При включённом расширении прибытие недостижимо.'
    : '');
  $('arrivalEstimate').hidden = arrived || !target.navigable;
  $('arrivalFuelRow').hidden = Route.isFlyby();
  UIContent.text($('arrivalFuel'), Number.isFinite(eta?.arrivalFuelKg)
    ? fmt(eta.arrivalFuelKg, 3) + ' кг'
    : '—');
  UIContent.text($('arrivalLabel'), Route.isFlyby()
    ? 'ДЛИТЕЛЬНОСТЬ ДО ПРОЛЁТА'
    : 'ДЛИТЕЛЬНОСТЬ ПОЛЁТА');
  const summary = f?.summary || f?.mission || eta;
  UIContent.text($('arrivalProper'), summary ? durationText(summary.proper) : '—');
  UIContent.text($('arrivalEarth'), summary ? durationText(summary.earth) : '—');
  renderFlightProfile(eta);
  $('flightDetails').hidden = arrived || !target.navigable;
  $('arrivalFuel').title = Number.isFinite(eta?.arrivalFuelKg)
    ? fmt((eta.arrivalFuelKg / (Rocket.fuelCapacity * 1000)) * 100, 1) + '% бака'
    : '';
  renderVelocity();
  renderAcceleration();
  renderClockRatio();
  renderReachability();
  UIContent.html($('matter'), fmt(state.matter * 1000, 3) +
    ' / ' +
    fmt(Rocket.fuelCapacity * 1000, Rocket.fuelCapacity === 0.001 ? 0 : 2) +
    '<small>кг</small>');
  UIContent.html($('dryMass'), fmt(SHIP.dryMassKg, SHIP.dryMassKg === 1 ? 0 : 3) + '<small>кг</small>');
  const dryWidth = (Rocket.dryMass / (Rocket.dryMass + Rocket.fuelCapacity)) * 100,
    fuelWidth = (state.matter / (Rocket.dryMass + Rocket.fuelCapacity)) * 100;
  $('massDry').style.width = dryWidth + '%';
  $('massFuel').style.width = fuelWidth + '%';
  UIContent.text($('massTotal'), massText(Rocket.dryMass + state.matter));
  $('massBar').setAttribute(
    'aria-label',
    'Сухая масса ' +
      fmt(SHIP.dryMassKg, 3) +
      ' кг; топливо ' +
      fmt(state.matter * 1000, 3) +
      ' из ' +
      fmt(Rocket.fuelCapacity * 1000, 3) +
      ' кг; свободно ' +
      fmt((Rocket.fuelCapacity - state.matter) * 1000, 3) +
      ' кг',
  );
  $('massBar').title =
    'Сухая масса ' +
    fmt(SHIP.dryMassKg, 3) +
    ' кг | Топливо ' +
    massText(state.matter) +
    ' | Свободно ' +
    massText(Rocket.fuelCapacity - state.matter);
  const rate = Simulation.replayRate();
  UIContent.text($('timeRate'), paused
    ? 'Пауза'
    : rate < speed
      ? 'СЛОУМО ×' + compact(speed / rate)
      : '1 с = ' +
        fmt(speed, speed < 1 ? 1 : 0) +
        (speed === 1 ? ' год' : speed < 1 ? ' года' : ' лет') +
        ' на борту');
  $('timeRate').classList.toggle('replaying', rate < speed);

  const cosmicYears = Math.floor(state.universeElapsed ?? state.earth);
  UIContent.text($('universeClock'), fmt(13800000000 + cosmicYears, 0));
  UIContent.text($('earthClock'), fmt(Math.floor(state.earth), 0));
  UIContent.text($('shipClock'), fmt(Math.floor(state.proper), 0));
  const pct = f ? Math.min(100, (f.covered / f.distance) * 100) : 0;
  $('progressBar').style.width = pct + '%';
  UIContent.text($('progressValue'), fmt(pct, 1) + '%');
  UIContent.text($('progressRemaining'), f && eta ? 'Осталось на борту · ' + durationText(eta.proper) : '');
  $('cancelFlight').disabled = !f?.rollback;
  $('cancelFlight').title =
    f && !f.rollback ? 'В этом старом сохранении нет снимка состояния до старта' : '';
  UIContent.text($('progressLabel'), f
    ? 'УЧАСТОК ' + ((f.legIndex || 0) + 1) + ' / ' + (f.route?.length || 1)
    : f?.missed
      ? 'ПРОЛЁТ ЦЕЛИ'
      : 'ПРОЙДЕНО');
  updateTimeControl();
  FlightBuilder.renderCard(target, arrived, eta);
  globalThis.UniverseMap?.renderCard(target);
  FlightQueue.render();
  QuickFlight.render();
  Route.renderDraft();
  GalacticTraffic.renderControl();
  FlightTips.render(eta);
}
