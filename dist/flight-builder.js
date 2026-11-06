'use strict';
// Flight configuration dialog and its diagrams.
const FlightBuilder = {
  routeSamplesCache: new WeakMap(),
  parameterGroups: {
    parametersShipMass: ['dryMassKg'],
    parametersShipLimits: ['maxAccelerationG', 'maxBrakingG'],
    parametersSail: ['sailDiameterM', 'reflectivityPercent'],
    parametersEngine: ['enginePowerW', 'engineEfficiencyPercent'],
    parametersCollector: [
      'collectorDiameterM',
      'collectorMinAu',
      'opticalEfficiencyPercent',
      'divergenceDeg',
    ],
    parametersMedium: ['dustMassPercent'],
    parametersSupernova: ['burstLuminosityW', 'burstDays'],
  },
  parameterUnits: {
    enginePowerW: { scale: 1e12, unit: 'ТВт · до потерь' },
    collectorDiameterM: { scale: Stellar.r0, unit: 'а.е. · диаметр' },
  },
  parameterScale(key) {
    return this.parameterUnits[key]?.scale || 1;
  },
  draft: null,
  readOnly: false,
  sanitizeDraft() {
    if (this.readOnly) return;
    if (OrbitalArrival.enabled) this.draft = FlightSetup.resolve(this.draft, this.source);
    else if (!this.starAvailable)
      Object.assign(this.draft, { sail: false, collector: false, burst: false });
  },
  context: null,
  run(fn) {
    if (!this.context) return fn();
    const live = state;
    state = this.context;
    try { return fn(); } finally { state = live; }
  },
  open(context = null) {
    this.context = context;
    return this.run(() => this.openInContext());
  },
  openInContext() {
    this.readOnly = !!state.flight;
    this.preferred = OrbitalArrival.enabled ? FlightSetup.preferred() : FlightSetup.read();
    this.changedKeys = new Set();
    this.draft = FlightSetup.read();
    this.fuelBounds = null;
    this.source = state.planningSource || object(state.current || state.flight?.fromId);
    this.light = Stellar.stellarLight(this.source);
    this.starAvailable =
      !!this.source &&
      ['star', 'home'].includes(this.source.kind) &&
      (!state.destroyed.includes(this.source.id) || (this.readOnly && this.draft.burst));
    this.sanitizeDraft();
    if (!this.readOnly && this.source?.id === 'sol') this.draft.burst = false;
    $('builderTitle').textContent = 'План полёта';
    $('builderRoute').textContent =
      (this.source?.name || 'Текущая позиция') +
      ' → ' +
      object(state.flight?.target || state.selected).name;
    $('builderSource').textContent = this.source?.name || 'В точке старта нет звезды';
    for (const [key] of Object.entries(ShipPhysics.fields)) {
      const input = $('parameter-' + key);
      input.value = this.draft[key] / this.parameterScale(key);
      input.setCustomValidity?.('');
    }
    $('setupStarMass').value = this.draft.massSolar ?? MapDetails.mass(this.source) ?? '';
    $('setupLuminosity').value = this.draft.luminositySolar ?? this.light.solar;
    for (const [id, key] of [
      ['setupDensity', 'densityCm3'],
      ['setupCapacity', 'capacityKg'],
    ])
      $(id).value = this.draft[key];
    $('applyFlightSetup').hidden = this.readOnly;
    $('launchConfigured').hidden = this.readOnly;
    $('launchConfigured').querySelector('span').textContent = this.context ? 'Сохранить цель' : 'Лететь';
    $('builderReadOnly').hidden = !this.readOnly;
    if (!this.readOnly && this.draft.arrivalFuelPercent === null) {
      const old = MissionPlanner.preview(this.draft);
      this.draft.arrivalFuelPercent =
        this.draft.fill && old.valid
          ? Math.floor((old.arrivalFuelKg / this.draft.capacityKg) * 10000) / 100
          : 0;
    }
    this.render();
    $('flightBuilder').showModal();
    $('flightBuilder').querySelector('.builder-grid').scrollTop = 0;
  },
  changed(e) {
    if (this.readOnly) return;
    const key = e.dataset.setup;
    this.changedKeys?.add(key);
    if (e.type === 'checkbox') {
      this.draft[key] = e.checked;
      if (key === 'sail' && !e.checked) {
        this.draft.collector = false;
        this.draft.burst = false;
      }
    } else if (key === 'burstSpectrum') {
      this.draft[key] = e.value;
    } else if (key === 'arrivalFuelPercent') {
      this.draft.arrivalFuelPercent = Math.max(
        0,
        Math.min(this.fuelBounds?.maxPercent || 0, Number(e.value) || 0),
      );
      this.draft.fill = this.draft.arrivalFuelPercent > 0;
    } else {
      if (e.value === '' && ['massSolar', 'luminositySolar'].includes(key)) {
        this.draft[key] = null;
        this.render();
        return;
      }
      const n = Number(e.value);
      if (ShipPhysics.positiveFields.has(key))
        e.setCustomValidity?.(e.value !== '' && n <= 0 ? 'Введите значение больше нуля.' : '');
      if (e.value === '' || !Number.isFinite(n) || !e.checkValidity()) {
        this.render();
        return;
      }
      this.draft[key] = n * this.parameterScale(key);
    }
    this.draft = FlightSetup.normalize(this.draft);
    this.render();
  },
  render() { return this.run(() => this.renderInContext()); },
  renderInContext() {
    this.sanitizeDraft();
    $('setupBurstSpectrum').value = this.draft.burstSpectrum;
    $('setupBurstSpectrum').disabled = this.readOnly || !this.draft.burst;
    $('burstSpectrumOption').hidden =
      !this.draft.burst || (this.readOnly && (state.flight?.mission?.model || 0) < 3);
    const c = this.draft,
      legacy = this.readOnly && !state.flight.mission;
    document.querySelectorAll('#flightBuilder input[type="checkbox"][data-setup]').forEach((e) => {
      e.checked = !!c[e.dataset.setup];
      e.disabled = this.readOnly;
    });
    $('setupEngine').disabled =
      this.readOnly || c.dump || (OrbitalArrival.enabled && !this.starAvailable);
    $('setupEngine').checked = c.engine && !c.dump;
    $('engineOption').classList.toggle('unavailable', c.dump);
    $('setupSail').disabled = this.readOnly || !this.starAvailable;
    $('setupSail').title = this.starAvailable
      ? ''
      : 'Для светового разгона нужна звезда в точке старта';
    $('collectorOption').classList.toggle('unavailable', !c.sail);
    $('burstOption').classList.toggle('unavailable', !c.sail);
    $('setupCollector').disabled = this.readOnly || !this.starAvailable || !c.sail;
    $('setupBurst').disabled =
      this.readOnly || !c.sail || !this.starAvailable || this.source.id === 'sol';
    $('setupDiffraction').disabled =
      this.readOnly || !this.starAvailable || !c.sail || !c.collector;
    $('diffractionOption').classList.toggle('unavailable', !c.sail || !c.collector);
    $('diffractionHelp').textContent = c.diffraction
      ? 'Расширение пучка из-за дифракции'
      : c.divergenceDeg > 0
        ? 'Только заданная расходимость · ' + angleText(c.divergenceDeg) + '°'
        : 'Идеальный пучок без расширения';
    $('burstHelp').textContent =
      !this.readOnly && FlightSetup.burstIssue(this.source)
        ? FlightSetup.burstIssue(this.source)
        : (c.burst && (!this.readOnly || (state.flight?.mission?.model || 0) >= 3)
            ? (BeamSpectra.profiles[c.burstSpectrum] || BeamSpectra.profiles.iip).label + ' · '
            : '') +
          fmt(c.burstDays, 2) +
          ' суток излучения у источника';
    $('setupCollectGas').disabled = this.readOnly || !c.brakeSail;
    for (const [key] of Object.entries(ShipPhysics.fields))
      $('parameter-' + key).disabled = this.readOnly;
    $('setupSailSize').textContent = 'Ø ' + fmt(c.sailDiameterM, 0) + ' м';
    $('setupCollectorSize').textContent =
      'Ø ' +
      (c.collectorDiameterM >= 0.001 * Stellar.r0
        ? fmt(c.collectorDiameterM / Stellar.r0, 3) + ' а.е.'
        : fmt(c.collectorDiameterM / 1000, 2) + ' км');
    for (const key of ['Density', 'Capacity']) $('setup' + key).disabled = this.readOnly;
    $('setupStarMass').disabled = this.readOnly || c.burst || !this.starAvailable;
    $('setupLuminosity').disabled = this.readOnly || c.burst || !this.starAvailable;
    $('resetLuminosity').disabled = this.readOnly || c.burst || !this.starAvailable;
    $('builderLightBasis').textContent = c.burst
      ? 'Модель сверхновой'
      : c.luminositySolar
        ? 'Ваш сценарий'
        : this.light.estimated
          ? 'Оценка по классу звезды'
          : 'По данным каталога';
    const invalid = [...document.querySelectorAll('#flightBuilder input[type="number"]')].some(
      (e) =>
        !e.disabled &&
        (!e.checkValidity() ||
          (e.value === '' && !['massSolar', 'luminositySolar'].includes(e.dataset.setup))),
    );
    if (!this.readOnly && !invalid) {
      this.fuelBounds = MissionPlanner.fuelLimit(c);
      c.arrivalFuelPercent = Math.min(
        this.fuelBounds.maxPercent,
        Math.max(0, c.arrivalFuelPercent || 0),
      );
      c.fill = c.arrivalFuelPercent > 0;
    }
    const p = legacy ? null : this.readOnly ? state.flight.mission : MissionPlanner.preview(c),
      eta = legacy ? FlightEstimate.get() : p,
      profile = legacy ? FlightProfile.get(eta) : null,
      valid = (legacy ? !!eta : p.valid) && !invalid;
    $('builderMassBasis').textContent = c.burst
      ? p?.acceleration?.preboost
        ? 'Поле учтено до вспышки'
        : 'В модели вспышки поле отключено'
      : c.massSolar !== null
        ? 'Ваш сценарий'
        : MapDetails.mass(this.source)
          ? this.source?.massSource
            ? 'Литературная оценка'
            : 'По данным каталога'
          : 'Масса неизвестна';
    const plannedPercent = Number.isFinite(eta?.arrivalFuelKg)
      ? (eta.arrivalFuelKg / c.capacityKg) * 100
      : 0;
    const selected = this.readOnly
        ? (c.arrivalFuelPercent ?? (c.fill ? plannedPercent : 0))
        : c.arrivalFuelPercent || 0,
      limit = this.fuelBounds?.maxPercent || 0;
    const percentText = (n) => fmt(n, Number.isInteger(n) ? 0 : 2) + '%';
    $('setupReserve').disabled = this.readOnly || invalid || !this.fuelBounds?.valid || limit <= 0;
    $('setupReserve').value = String(selected);
    $('setupReserve').setAttribute('aria-valuemax', String(this.readOnly ? 100 : limit));
    $('setupReserve').setAttribute('aria-valuetext', percentText(selected) + ' топливного бака');
    $('builderReserveValue').textContent = percentText(selected);
    $('builderReserveFill').style.width = selected + '%';
    $('builderReserveTick').hidden = this.readOnly;
    $('builderReserveTick').style.left =
      'calc(' + limit + '% + ' + (7 - (14 * limit) / 100) + 'px)';
    $('builderReserveBlocked').hidden = this.readOnly;
    $('builderReserveBlocked').style.left = limit + '%';
    $('builderReserveLimit').textContent = this.readOnly
      ? 'Наполнение в текущем плане'
      : invalid
        ? 'Проверьте параметры'
        : this.fuelBounds?.valid
          ? 'Максимум ' + percentText(limit)
          : 'Нет допустимого полёта';
    $('builderProper').textContent = valid ? durationText(eta.proper) : '—';
    $('builderEarth').textContent = valid ? durationText(eta.earth) : '—';
    const startFuel =
        p?.initialFuelKg ?? (c.dump ? 0 : Math.min(state.matter * 1000, c.capacityKg)),
      fuel = eta?.arrivalFuelKg;
    const fuelText = (kg) => fmt(Math.max(0, Math.min(100, (kg / c.capacityKg) * 100)), 0) + '%';
    $('builderStartFuel').textContent = fuelText(startFuel);
    $('builderFuel').textContent = valid && Number.isFinite(fuel) ? fuelText(fuel) : '—';
    $('builderProperMobile').textContent = valid ? durationText(eta.proper) : '—';
    $('builderFuelMobile').textContent = valid && Number.isFinite(fuel) ? fuelText(fuel) : '—';
    this.drawRoute(p, valid, eta, profile);
    let warning = invalid
      ? 'Проверьте числовые параметры.'
      : valid
        ? ''
        : p?.reason || 'Нет прогноза';
    if (valid && c.dump) warning = 'Перед стартом топливный бак будет опустошён.';
    if (valid && p?.jettisonKg > 0 && !c.dump)
      warning =
        'Топливный бак меньше текущего запаса: избыток ' +
        fmt(p.jettisonKg, 3) +
        ' кг будет сброшен.';
    $('builderWarning').textContent = warning;
    $('builderStatus').hidden = !warning;
    $('builderWarning').classList.toggle('attention', !!warning);
    $('builderPeak').textContent = Number.isFinite(p?.peakBeta) ? percentC(p.peakBeta) : '—';
    $('builderDiagnostic').textContent = p?.diagnostic
      ? 'Одним парусом до 1 м/с: ' +
        durationText(p.diagnostic) +
        '. Для полной остановки нужен двигатель.'
      : '';
    this.explain(c, p);
    $('launchConfigured').disabled = !valid;
    $('applyFlightSetup').disabled = invalid;
  },
  explain(c, p) {
    return ShipPhysics.run(c, () => this.explainConfigured(c, p));
  },
  explainConfigured(c, p) {
    const light = Stellar.stellarLight(this.source),
      solar = c.luminositySolar ?? light.solar,
      mass = c.massSolar ?? MapDetails.mass(this.source),
      fuel = p?.initialFuelKg ?? (c.dump ? 0 : Math.min(state.matter * 1000, c.capacityKg)),
      total = c.dryMassKg + fuel;
    const luminosity = c.burst ? Stellar.luminosity : solar * 3.828e26,
      r = p?.departureOrbit?.radius || light.collectorR;
    const power = c.collector
      ? (luminosity * cOptical(c) * Stellar.collectorDiameterM ** 2) / (16 * light.collectorR ** 2)
      : (luminosity * SHIP.sailAreaM2) / (4 * Math.PI * r * r);
    const lightG =
        c.sail && this.starAvailable ? (ShipPhysics.reflection * power) / Rocket.c / total / G0 : 0,
      engineG =
        c.engine && !c.dump && fuel > 0
          ? (Rocket.power * ShipPhysics.efficiency) / Rocket.c / total / G0
          : 0;
    const gravity =
        this.starAvailable && (!c.burst || p?.acceleration?.preboost) && mass !== null
          ? (6.6743e-11 * 1.98847e30 * mass) / (r * r) / G0
          : null,
      thrust = Math.min(c.maxAccelerationG, lightG + engineG);
    const gText = (n) =>
      n === 0
        ? '0 g'
        : n >= 0.01
          ? fmt(n, Math.abs(n - Math.round(n)) < 1e-6 ? 0 : 2) + ' g'
          : quantity(n) + ' g';
    $('builderGravity').textContent =
      c.burst && !p?.acceleration?.preboost
        ? 'Поле отключено'
        : gravity === null
          ? 'Нет данных'
          : gText(gravity);
    const maxG = p?.valid
      ? Math.max(
          p.accelerationEnd?.a || 0,
          ...(p.acceleration?.rows || [])
            .filter((q) => q.proper <= p.accelerationEnd.proper)
            .map((q) => q.a || 0),
        ) / G0
      : null;
    $('builderThrust').textContent = Number.isFinite(maxG) ? gText(maxG) : '—';
    $('builderAccelerationNote').hidden = !(maxG >= c.maxAccelerationG - 1e-6);
    $('builderAccelerationNote').textContent =
      maxG >= c.maxAccelerationG - 1e-6
        ? 'Достигнут предел ' + fmt(c.maxAccelerationG, 2) + ' g.'
        : '';
    $('builderGravityNote').textContent = p?.acceleration?.preboost
      ? 'При предразгоне учитывается поле звезды. После запуска вспышки оно отключено в принятой модели.'
      : c.burst
        ? this.readOnly && (state.flight?.mission?.model || 0) < 3
          ? 'Прежняя общая модель вспышки; поле звезды отключено.'
          : 'Спектральный сценарий ' +
            (BeamSpectra.profiles[c.burstSpectrum] || BeamSpectra.profiles.iip).label +
            '. Светимость и длительность вспышки заданы игровой моделью; поле звезды отключено.'
        : gravity === null
          ? this.starAvailable
            ? 'Масса звезды неизвестна; её притяжение при разгоне не учитывается.'
            : 'В точке старта нет звезды.'
          : thrust <= gravity
            ? 'Для старта нужно больше ' +
              gText(gravity) +
              '. Добавьте двигатель или оптический коллектор.'
            : 'Тяга преодолевает притяжение. Учтено радиальное поле звезды у точки старта ' +
              fmt(r / Stellar.r0, 2) +
              ' а.е.';
    const spectral =
      this.source?.spectral || this.source?.facts?.class || this.source?.type || 'Звезда';
    $('builderStarValue').textContent = !this.starAvailable
      ? 'Без звезды'
      : c.burst
        ? fmt(c.burstDays, 2) + ' суток у звезды'
        : (light.estimated && !c.luminositySolar ? '≈ ' : '') +
          fmt(solar, solar < 0.01 ? 6 : 2) +
          ' L☉';
    $('builderStarReason').textContent = !c.sail
      ? 'Разгоняет двигатель: расходуется топливо. Светимость звезды на этот план не влияет.'
      : !this.starAvailable
        ? 'Для светового разгона нужна звезда у точки старта.'
        : c.burst
          ? 'Свет вспышки разгоняет корабль через парус.'
          : spectral +
            '. ' +
            (c.collector
              ? 'Коллектор направляет свет на парус; ' +
                (c.diffraction
                  ? 'пучок расширяется из-за дифракции, а разгон ослабевает с расстоянием и скоростью.'
                  : c.divergenceDeg > 0
                    ? 'пучок расширяется с заданным углом расходимости.'
                    : 'идеальный пучок не расширяется; разгон ослабевает из-за доплеровского эффекта.')
              : 'Прямой свет слабеет с удалением от звезды.');
    $('builderFlashNote').hidden = !(c.sail && c.burst);
    const reception = MissionPlanner.lightReception(p);
    $('builderFlashNote').textContent = reception
      ? 'Вспышка у звезды длится ' +
        fmt(c.burstDays, 2) +
        ' суток. За этот разгон корабль принимает свет, испущенный в первые ' +
        fmt(reception.source * 365.25, 2) +
        ' суток; приём на борту занимает ' +
        durationText(reception.durationProper ?? reception.proper) +
        '; фотоны догоняют удаляющийся корабль с растянутыми интервалами. После вспышки звезда не продолжает светить.'
      : 'Фотоны догоняют удаляющийся корабль: ' +
        fmt(c.burstDays, 2) +
        ' суток излучения у звезды могут растянуться на годы приёма по бортовым часам. Постоянный свет после вспышки не добавляется.';
    if (c.sail && c.burst && c.collector) {
      const survival =
        p?.acceleration?.collectorSurvival ||
        (!this.readOnly ? CollectorSurvival.plan(light, c.burstDays / 365.25) : null);
      $('builderFlashNote').textContent += survival
        ? ' Коллектор на ' +
          fmt(survival.collectorR / Stellar.r0, 2) +
          ' а.е. разрушится через ' +
          fmt(survival.destructionYears * 365.25, 2) +
          ' суток после начала вспышки на поверхности звезды. Первые фотоны придут к нему через ' +
          fmt(survival.firstLightYears * 365.25, 2) +
          ' суток; он успеет направить не более ' +
          fmt(survival.usableSourceYears * 365.25, 2) +
          ' суток излучения. Уже отправленный свет продолжит догонять корабль после разрушения. Скорость выброса ' +
          fmt(survival.ejectaSpeedMS / 1000, 0) +
          ' км/с — принятый сценарий; тепловое разрушение не рассчитано. ' +
          (survival.radiusEstimated
            ? 'Радиус звезды оценён по светимости и спектральному классу.'
            : 'Радиус звезды взят из каталога.')
        : ' Сохранённый полёт рассчитан без разрушения коллектора; его траектория сохранена.';
    }
    const preparation = p?.acceleration?.preboost;
    if (preparation) {
      const end = preparation.preparationEnd;
      $('builderStarReason').textContent =
        'Обычный свет сначала разгоняет корабль до ' +
        percentC(end.beta) +
        '. Затем парус складывается на время ожидания; после встречи света вспышки световой разгон продолжается.';
      $('builderFlashNote').textContent =
        'Предразгон обычным светом: ' +
        durationText(end.proper) +
        ', без расхода топлива. Ожидание света: ' +
        durationText(preparation.waitingProper) +
        '. Первые фотоны вспышки встретят корабль в ' +
        scaleDistanceText(preparation.flashStart.distance) +
        ' от коллектора. Подготовка и ожидание включены в общее время. ' +
        $('builderFlashNote').textContent;
      if (!MissionPlanner.burstScheduled(p)) {
        $('builderStarReason').textContent =
          'На этом коротком маршруте разгон заканчивается до встречи вспышки. Используется обычный свет; звезда сохраняется.';
        $('builderFlashNote').textContent =
          'Вспышка для этого плана не запускается: корабль начинает торможение раньше встречи её света.';
      }
    }
    if (c.sail && !c.burst && gravity !== null && thrust <= gravity)
      $('builderStarReason').textContent += ' Тяги не хватает для старта.';
    $('builderGasValue').textContent = c.brakeSail
      ? fmt(c.densityCm3, c.densityCm3 < 0.01 ? 4 : 1) + ' атом/см³'
      : 'Парус сложен';
    $('builderGasReason').textContent = !c.brakeSail
      ? 'Останавливает двигатель, используя только запас топлива.'
      : !c.collectGas
        ? 'Газ замедляет корабль и выпускается наружу. Для остановки двигатель использует запас топлива.'
        : c.fill
          ? 'Парус тормозит и собирает топливо. Более раннее торможение оставляет больше газа в топливном баке.'
          : 'Парус тормозит и собирает газ; двигатель расходует часть потока для более быстрой остановки.';
    const diffraction = p?.acceleration?.diffraction,
      spectrum = diffraction?.spectrum || BeamOptics.spectrum(c, light),
      oldOptics = this.readOnly && c.collector && c.sail && !diffraction;
    const opticsNote = oldOptics
      ? 'Сохранённый полёт рассчитан по прежней модели без дифракции. '
      : c.diffraction
        ? 'Дифракция учтена: идеальная круглая апертура ' +
          fmt((diffraction?.diameterM || c.collectorDiameterM) / 1000, 2) +
          ' км, парус ' +
          fmt((diffraction?.sailRadiusM || c.sailDiameterM / 2) * 2, 0) +
          ' м. ' +
          BeamOptics.label(spectrum) +
          '. ' +
          (c.burst
            ? 'Шаблоны Nugent: 100–2500 нм, спектр меняется по времени у источника. '
            : 'Тепловое приближение спектра звезды. ')
        : 'Дифракция отключена. ' +
          (c.divergenceDeg > 0
            ? 'Пучок расширяется с заданным полным углом ' + angleText(c.divergenceDeg) + '°. '
            : 'Идеальный пучок без расширения: весь собранный свет достигает паруса. ');
    $('builderPhysicsNote').textContent =
      (c.collector && c.sail
        ? opticsNote +
          'Добавочная расходимость ' +
          angleText(c.divergenceDeg) +
          '°. Идеальное наведение и фокусировка; угловой размер источника не учтён. '
        : c.sail
          ? 'Прямой поток убывает как 1/r². '
          : '') +
      (c.sail ? 'Доплеровское ослабление и задержка света учтены. ' : '') +
      'Плотность газа при торможении — однородная модель, а не измерение у цели.' +
      (p?.arrival ? ' Гравитация цели — изолированная точечная масса в слабом поле.' : '') +
      (p?.departureOrbit
        ? ' При следующем старте учитывается орбитальная энергия; ориентация плоскости орбиты не рассчитывается.'
        : '');
    const arrival =
      p?.arrival ||
      (!this.readOnly && !p?.arrivalStar ? OrbitalArrival.target(object(state.selected)) : null);
    $('builderArrivalTitle').textContent = arrival
      ? 'Торможение и выход на орбиту'
      : 'Полная остановка';
    $('builderOrbitSpeed').textContent = arrival
      ? fmt(arrival.speed / 1000, 2) + ' км/с'
      : '0 км/с';
    $('builderOrbitReason').textContent = arrival
      ? 'Гравитация цели учтена. Полёт заканчивается на круговой орбите с касательной скоростью; тормозной парус складывается.'
      : p?.arrivalStar
        ? 'Прибытие к звезде у выбранной цели. Индивидуальная масса неизвестна; полёт заканчивается полной остановкой.'
        : 'Цель протяжённая либо индивидуальная масса неизвестна. Полёт заканчивается полной остановкой.';
    $('builderOrbitRadiusLabel').textContent = arrival ? 'Радиус орбиты' : 'Режим прибытия';
    $('builderOrbitRadius').textContent = arrival
      ? fmt(arrival.radius / Stellar.r0, arrival.radius / Stellar.r0 < 100 ? 2 : 0) + ' а.е.'
      : 'Стоянка';
    const comparison = p?.vacuumComparison,
      difference = comparison && p.valid ? comparison.burnedKg - p.brake.burned : null;
    $('builderOrbitComparison').textContent = arrival
      ? (arrival.radiusAdjusted ? 'Радиус увеличен: вне поверхности и в слабом поле. ' : '') +
        'Масса цели: ' +
        compact(arrival.massSolar) +
        ' M☉. ' +
        (difference !== null
          ? 'Торможение расходует на ' +
            quantity(Math.abs(difference)) +
            ' кг ' +
            (difference >= 0 ? 'меньше' : 'больше') +
            ' топлива, чем полная остановка в пустом пространстве при той же входной скорости.'
          : '')
      : 'Масса протяжённого объекта не используется как масса одной звезды.';
    this.drawOptics(c);
  },
  routeStages(p, eta, profile) {
    if (p?.valid) {
      const a = p.accelerationEnd,
        coast = p.coast,
        brake = p.brake;
      return [
        { name: 'Разгон', proper: a.proper, distance: a.distance },
        {
          name: 'Свободный полёт',
          proper: coast.proper,
          distance: p.cosmic ? coast.path : coast.distance,
        },
        {
          name: p.passage ? 'Пролёт' : p.arrival ? 'Торможение и выход на орбиту' : 'Торможение',
          proper: p.passage ? Math.max(0, p.proper - a.proper - coast.proper) : brake.proper,
          distance: p.passage ? null : brake.distance,
        },
      ];
    }
    if (profile && eta) {
      const a = profile.acceleration,
        b = profile.braking;
      return [
        { name: 'Разгон', proper: a?.proper || 0, distance: a?.distance || 0 },
        {
          name: 'Свободный полёт',
          proper: Math.max(0, eta.proper - (a?.proper || 0) - (b?.proper || 0)),
          distance: null,
        },
        { name: 'Торможение', proper: b?.proper || 0, distance: b?.distance || 0 },
      ];
    }
    return ['Разгон', 'Свободный полёт', 'Торможение'].map((name) => ({
      name,
      proper: 0,
      distance: 0,
    }));
  },
  routeDistanceText(d) {
    if (!Number.isFinite(d)) return '—';
    if (d === 0) return '0 св. лет';
    if (Math.abs(d) < 1e-5) return quantity(d) + ' св. лет';
    return (
      (d < 0.01 ? fmt(d, Math.max(2, 2 - Math.floor(Math.log10(d)))) : compact(d)) + ' св. лет'
    );
  },
  visibleRouteStage(s, totalDistance, totalProper, valid) {
    // Hide a coast below 0.1% in both measures, without redistributing its path.
    return (
      s.index !== 1 ||
      !valid ||
      s.proper > Math.max(1e-12, totalProper * 0.001) ||
      Math.abs(s.distance || 0) > Math.max(1e-12, totalDistance * 0.001)
    );
  },
  routeSamples(p, stages) {
    if (
      !p?.acceleration?.rows?.length ||
      !p.accelerationEnd ||
      !stages.every((s) => Number.isFinite(s.distance))
    )
      return null;
    if (this.routeSamplesCache.has(p)) return this.routeSamplesCache.get(p);
    const total = stages.reduce((sum, s) => sum + s.distance, 0),
      scaleX = total > 0 ? 392 / total : 0,
      scaleY = 65 / Math.max(p.peakBeta || 0, 1e-12),
      result = [];
    for (let index = 0; index < 3; index++) {
      const duration = stages[index].proper,
        length = stages[index].distance;
      if (index === 0) {
        const points = p.acceleration.rows
          .filter((q) => q.proper < p.accelerationEnd.proper)
          .map((q) => ({ proper: q.proper, distance: q.distance, beta: q.beta }));
        points.push({
          proper: p.accelerationEnd.proper,
          distance: p.accelerationEnd.distance,
          beta: p.accelerationEnd.beta,
        });
        result.push(points);
        continue;
      }
      if (p.passage || !(duration > 0) || !(length > 0)) {
        result.push([]);
        continue;
      }
      const sample = (t) => {
        const q = MissionPlanner.stageSample(p, index, t);
        return { proper: t, distance: Math.max(0, Math.min(length, q.distance)), beta: q.beta };
      };
      // Sampling is in proper time but the drawing uses physical distance. Log
      // endpoint seeds retain short final burns; refinement measures screen error.
      const times = new Set([0, duration]);
      for (let n = 1; n < 16; n++) times.add((duration * n) / 16);
      for (let n = 1; n <= 8; n++) {
        times.add(duration * 10 ** -n);
        times.add(duration * (1 - 10 ** -n));
      }
      if (index === 2) {
        const b = p.brake.plan;
        for (const t of [b?.fill?.proper, (b?.fill?.proper || 0) + (b?.feed?.proper || 0)])
          if (t > 0 && t < duration) times.add(t);
      }
      const points = [],
        refine = (a, b, depth) => {
          const mid = sample((a.proper + b.proper) / 2),
            dx = (b.distance - a.distance) * scaleX,
            dy = (b.beta - a.beta) * scaleY,
            mx = (mid.distance - a.distance) * scaleX,
            my = (mid.beta - a.beta) * scaleY,
            den = dx * dx + dy * dy,
            f = den > 0 ? Math.max(0, Math.min(1, (mx * dx + my * dy) / den)) : 0,
            error = Math.hypot(mx - f * dx, my - f * dy);
          if (depth < 12 && error > 0.15) {
            refine(a, mid, depth + 1);
            refine(mid, b, depth + 1);
          } else points.push(b);
        };
      const seeds = [...times].sort((a, b) => a - b).map(sample);
      points.push(seeds[0]);
      for (let i = 1; i < seeds.length; i++) refine(seeds[i - 1], seeds[i], 0);
      result.push(points);
    }
    this.routeSamplesCache.set(p, result);
    return result;
  },
  drawRoute(p, valid, eta, profile) {
    const stages = this.routeStages(valid ? p : null, valid ? eta : null, valid ? profile : null),
      known = stages.every((s) => Number.isFinite(s.distance)),
      total = known ? stages.reduce((sum, s) => sum + s.distance, 0) : 0,
      left = 24,
      span = 392;
    let traveled = 0;
    const segments = stages.map((s, i) => {
      const start = left + (total ? traveled / total : 0) * span;
      traveled += Number.isFinite(s.distance) ? s.distance : 0;
      const end = left + (total ? traveled / total : 0) * span;
      return { ...s, start, end, center: (start + end) / 2, index: i };
    });
    const x1 = segments[0].end,
      baseline = 214,
      peak = 149;
    const totalProper = stages.reduce((sum, s) => sum + s.proper, 0),
      visible = segments.filter((s) => this.visibleRouteStage(s, total, totalProper, valid));
    const rows = visible
      .map((s, i) => {
        const x = 8 + i * (440 / visible.length),
          labelCenter = x + (visible.length === 2 ? 90 : 64),
          turn = 106 + i * 7,
          time = valid ? durationText(s.proper) : '—',
          dist = valid ? this.routeDistanceText(s.distance) : '—';
        return (
          '<g class="route-stage" data-stage="' +
          s.index +
          '" data-proper="' +
          s.proper +
          '" data-distance="' +
          s.distance +
          '" data-start="' +
          s.start +
          '" data-end="' +
          s.end +
          '"><title>' +
          s.name +
          ': время на борту — ' +
          time +
          '; расстояние в системе внешнего наблюдателя — ' +
          dist +
          '</title><path class="stage-leader" d="M' +
          labelCenter +
          ' 98V' +
          turn +
          'H' +
          s.center +
          'V228"/><text class="stage-name" x="' +
          x +
          '" y="15">' +
          (s.name === 'Торможение и выход на орбиту'
            ? '<tspan x="' +
              x +
              '" y="10">Торможение</tspan><tspan x="' +
              x +
              '" y="23">и выход на орбиту</tspan>'
            : s.name) +
          '</text><text class="stage-metric-label" x="' +
          x +
          '" y="35">Время на борту</text><text class="stage-duration" x="' +
          x +
          '" y="51">' +
          time +
          '</text><text class="stage-metric-label" x="' +
          x +
          '" y="72">Расстояние</text><text class="stage-distance" x="' +
          x +
          '" y="88">' +
          dist +
          '</text><rect class="stage-span stage-span-' +
          s.index +
          '" x="' +
          s.start +
          '" y="224" width="' +
          (s.end - s.start) +
          '" height="6"/><circle class="stage-pin" cx="' +
          s.center +
          '" cy="227" r="1.8"/></g>'
        );
      })
      .join('');
    const samples = valid && known ? this.routeSamples(p, stages) : null;
    let offset = 0,
      maximum = { beta: p?.peakBeta ?? eta?.peakBeta ?? state.flight?.maxBeta, x: x1 };
    const series = samples?.map((points, index) => {
      const values = points.map((q) => ({
        ...q,
        x: left + (total ? (offset + q.distance) / total : 0) * span,
      }));
      offset += stages[index].distance;
      return values;
    });
    if (series) {
      maximum = { beta: -1, x: left };
      for (const points of series)
        for (const q of points) if (q.beta > maximum.beta) maximum = { beta: q.beta, x: q.x };
    }
    const beta = maximum.beta,
      height = baseline - peak,
      y = (b) => baseline - (height * Math.max(0, b)) / Math.max(beta || 0, 1e-20),
      startY = series?.[0]?.length ? y(series[0][0].beta) : baseline,
      lastSeries = series?.filter((q) => q.length).at(-1),
      arrivalY = lastSeries?.length ? y(lastSeries.at(-1).beta) : baseline;
    const paths =
      series
        ?.map((points, index) =>
          points.length && (index !== 1 || visible.some((s) => s.index === 1))
            ? '<path class="' +
              ['diagram-accel', 'diagram-coast', 'diagram-brake'][index] +
              '" data-sampled="true" data-samples="' +
              points.length +
              '" d="' +
              points
                .map((q, i) => (i ? 'L' : 'M') + q.x.toFixed(3) + ' ' + y(q.beta).toFixed(3))
                .join('') +
              '"/>'
            : '',
        )
        .join('') || '';
    const curve = '<path class="diagram-guide" d="M24 ' + baseline + 'H416"/>' + paths;
    const peakText = valid && Number.isFinite(beta) ? 'Макс. ' + percentC(beta) : '',
      labelWidth = Math.min(360, Math.max(150, peakText.length * 8 + 16)),
      labelX = clamp(maximum.x, 24 + labelWidth / 2, 416 - labelWidth / 2);
    const peakLabel = peakText
      ? '<g class="route-peak" data-beta="' +
        beta +
        '"><path class="peak-guide" d="M' +
        maximum.x +
        ' ' +
        peak +
        'V136H' +
        labelX +
        '"/><rect x="' +
        (labelX - labelWidth / 2) +
        '" y="123" width="' +
        labelWidth +
        '" height="20"/><text x="' +
        labelX +
        '" y="137" text-anchor="middle">' +
        peakText +
        '</text><circle cx="' +
        maximum.x +
        '" cy="' +
        peak +
        '" r="2.5"/></g>'
      : '';
    $('builderRouteDiagram').innerHTML =
      '<defs><pattern id="routeBrakeHatch" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M-1 1l2-2M0 4l4-4M3 5l2-2"/></pattern></defs>' +
      '<title>Скорость по расчётной траектории в зависимости от пройденного расстояния</title>' +
      rows +
      curve +
      peakLabel +
      '<circle cx="24" cy="' +
      startY +
      '" r="2.5"/><circle cx="416" cy="' +
      arrivalY +
      '" r="2.5"/><text class="route-endpoint" x="24" y="251">СТАРТ</text><text class="route-endpoint" x="416" y="251" text-anchor="end">' +
      (p?.passage ? 'ПРОЛЁТ' : p?.arrival ? 'ОРБИТА' : 'ОСТАНОВКА') +
      '</text><text class="route-axis-note" x="220" y="274" text-anchor="middle">Расстояние в системе внешнего наблюдателя →</text>';
    $('builderRouteDiagram').classList.toggle('uncomputed', !valid || !known || !samples);
  },
  drawOptics(c) {
    const svg = $('builderOpticsDiagram'),
      start =
        '<circle cx="30" cy="40" r="10"/>' +
        (c.burst ? '<circle cx="30" cy="40" r="20" stroke-dasharray="2 3"/>' : '') +
        '<text x="30" y="81" text-anchor="middle">' +
        (c.burst ? 'вспышка' : 'звезда') +
        '</text>';
    const sail =
      '<path d="M355 21q17 19 0 38M355 21l-14 19 14 19"/><text x="355" y="81" text-anchor="middle">парус</text>';
    const collector =
      '<path d="M145 21q15 19 0 38M55 33l86-10M55 47l86 10"/><text x="147" y="81" text-anchor="middle">коллектор</text><path d="' +
      (c.diffraction || c.divergenceDeg > 0
        ? 'M160 35l173-22M160 45l173 22'
        : 'M160 35h173M160 45h173') +
      '" stroke-dasharray="4 4"/><text x="250" y="99" text-anchor="middle">' +
      (c.diffraction
        ? 'дифракция пучка'
        : c.divergenceDeg > 0
          ? 'заданная расходимость'
          : 'идеальный пучок') +
      '</text>';
    const ship = '<path d="m320 34 17 6-17 6 4-6Z"/>';
    svg.innerHTML = c.sail
      ? start +
        (c.collector
          ? collector
          : '<path d="M55 35l275-14M55 45l275 14" stroke-dasharray="4 4"/>') +
        sail +
        ship
      : '<path d="M45 40h240" stroke-dasharray="2 5"/><circle cx="45" cy="40" r="3"/><path d="m295 28-29 12 29 12" stroke-dasharray="3 3"/>' +
        ship +
        '<text x="180" y="81" text-anchor="middle">топливо → фотоны → тяга</text>';
  },
  apply(fly = false) {
    if (this.readOnly) return;
    this.sanitizeDraft();
    if (this.context) {
      FlightQueue.setSetup(this.context.selected, this.draft);
      $('flightBuilder').close();
      // The live flight can arrive while a future plan's dialog is open.
      if (!state.flight && !state.nextTargets.some(n => n.id === this.context.selected)) {
        state.selected = this.context.selected;
        state.flightSetup = FlightSetup.normalize(this.draft);
        FlightSetup.sync();
        if (fly) launch();
        else { persist(); renderUI(); }
      } else if (fly) FlightQueue.add(this.context.selected);
      else renderUI();
      return;
    }
    state.flightSetup = FlightSetup.storeDraft(
      this.draft,
      this.preferred || FlightSetup.preferred(),
      this.source,
      this.changedKeys,
    );
    state.departureMode = this.draft.sail ? (this.draft.burst ? 'burst' : 'beam') : 'engine';
    FlightSetup.sync();
    FlightEstimate.idleKey = null;
    FlightProfile.idleKey = null;
    $('flightBuilder').close();
    renderUI();
    persist();
    if (fly) launch();
  },
  reserveNote(p) {
    if (!p?.valid || !p.reserveLimited) return '';
    const actual = p.arrivalFuelKg / p.setup.capacityKg * 100;
    return 'Для этого перелёта доступно ' + fmt(actual, 1) + '% бака вместо ' + fmt(p.requestedArrivalFuelPercent, 0) + '%.';
  },
  renderCard(target, arrived, eta) {
    const f = state.flight,
      c = FlightSetup.read();
    $('departureSection').hidden = true;
    $('configureFlight').hidden = arrived || !target.navigable;
    if (!OrbitalArrival.enabled && !f && !canBoost('beam'))
      Object.assign(c, { sail: false, collector: false, burst: false });
    UIContent.text($('setupAccelerationSummary'), FlightSetup.acceleration(c));
    UIContent.text($('setupBrakingSummary'), FlightSetup.braking(c));
    $('configureFlight').setAttribute(
      'aria-label',
      f ? 'Посмотреть план полёта' : 'Настроить разгон и торможение',
    );
    $('flightDetails').hidden = true;
    UIContent.text($('configureFlightLabel'), f ? 'План ↗' : 'Изменить ↗');
    $('arrivalFuelRow').hidden = true;
    if (!f && !arrived && target.navigable) {
      UIContent.text($('launchBtn').querySelector('span'), 'Лететь');
      if (MissionPlanner.enabledIdle()) {
        const p = MissionPlanner.preview();
        $('launchBtn').disabled = !p.valid;
        UIContent.text($('flightHint'), p.valid ? this.reserveNote(p) : p.reason);
        if (!p.valid) {
          UIContent.text($('arrivalProper'), '—');
          UIContent.text($('arrivalEarth'), '—');
        }
      } else UIContent.text($('flightHint'), '');
    }
    const collector = CollectorSurvival.status(f);
    if (collector?.phase === 'preboost')
      UIContent.text($('flightHint'), 'Предразгон обычным светом до 0,97 c. Топливо сохраняется.');
    else if (collector?.phase === 'waiting')
      UIContent.text($('flightHint'), collector.scheduled
        ? 'Парус сложен; корабль ожидает свет вспышки.' +
          (collector.destroyed
            ? ' Коллектор уже разрушен, отправленные фотоны продолжают путь.'
            : '')
        : 'Разгон обычным светом завершён; вспышка на этом маршруте не запускается.');
    else if (collector && !collector.scheduled && f?.mission?.acceleration.preboost)
      UIContent.text($('flightHint'), 'Полёт без вспышки; звезда сохранена.');
    else if (collector)
      UIContent.text($('flightHint'), collector.destroyed
        ? 'Коллектор разрушен.' +
          (collector.receiving
            ? ' Отправленный ранее свет ещё разгоняет корабль.'
            : ' Приём света завершён.')
        : collector.receiving
          ? 'Коллектор направляет свет вспышки.'
          : 'Приём света завершён; выброс ещё не достиг коллектора.');
    $('flightHint').hidden = !$('flightHint').textContent || (!!f && !collector);
    if (f?.mission) {
      UIContent.text($('phaseTag'), paused
        ? 'ПАУЗА'
        : state.phase === 'launch'
          ? 'РАЗГОН'
          : state.phase === 'brake'
            ? 'ТОРМОЖЕНИЕ'
            : state.phase === 'thrust'
              ? 'РАЗГОН'
              : state.phase === 'flyby'
                ? 'ПРОЛЁТ'
                : 'СВОБОДНЫЙ ПОЛЁТ');
      $('departureDiagram').hidden = true;
      $('sailSection').hidden = true;
      $('engineSection').hidden = true;
      if (!paused && collector?.phase === 'preboost') UIContent.text($('phaseTag'), 'ПРЕДРАЗГОН');
      if (!paused && collector?.phase === 'waiting') UIContent.text($('phaseTag'), 'ОЖИДАНИЕ СВЕТА');
    }
  },
  setup() {
    for (const [group, keys] of Object.entries(this.parameterGroups))
      for (const key of keys) {
        const [value, min, max, label, unit] = ShipPhysics.fields[key],
          row = document.createElement('label'),
          scale = this.parameterScale(key),
          displayUnit = this.parameterUnits[key]?.unit || unit;
        row.className = 'environment-input';
        row.innerHTML =
          '<span>' +
          label +
          '<small>' +
          displayUnit +
          '</small></span><input id="parameter-' +
          key +
          '" data-setup="' +
          key +
          '" type="number" min="' +
          min / scale +
          '"' +
          (Number.isFinite(max) ? ' max="' + max / scale + '"' : '') +
          ' step="any" value="' +
          value / scale +
          '" aria-label="' +
          label +
          ' · ' +
          displayUnit +
          '">';
        $(group).append(row);
      }
    $('cancelFlight').onclick = () => FlightHistory.cancel();
    $('configureFlight').onclick = () => this.open(FlightQueue.browsing() ? FlightQueue.context() : null);
    $('closeBuilder').onclick = () => $('flightBuilder').close();
    document.querySelectorAll('#flightBuilder [data-setup]').forEach((e) => {
      e.addEventListener('change', () => this.changed(e));
      if (e.type === 'number' || e.type === 'range')
        e.addEventListener('input', () => this.changed(e));
    });
    $('resetLuminosity').onclick = () => {
      this.draft.luminositySolar = null;
      this.draft.massSolar = null;
      $('setupLuminosity').value = this.light.solar;
      $('setupStarMass').value = MapDetails.mass(this.source) ?? '';
      this.render();
    };
    $('applyFlightSetup').onclick = () => this.apply();
    $('launchConfigured').onclick = () => {
      if (!this.run(() => MissionPlanner.preview(this.draft)).valid) return;
      this.apply(true);
    };
  },
};
