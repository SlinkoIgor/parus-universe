'use strict';
// Future stops are forecasts, never edits to the trajectory being flown.
const FlightQueue = {
  limit: 10, drafts: new Map(), cache: null,
  reset() { this.drafts.clear(); this.cache = null; },
  escape(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  browsing() { return !!state.flight && state.selected !== state.flight.target; },
  run(context, fn) {
    const live = state;
    state = context;
    try { return fn(); } finally { state = live; }
  },
  setupFor(id) {
    return this.drafts.get(id) || state.nextTargets.find(n => n.id === id)?.setup || FlightSetup.preferred();
  },
  setSetup(id, setup) {
    const c = FlightSetup.normalize(setup), node = state.nextTargets.find(n => n.id === id);
    if (node) node.setup = c;
    this.drafts.set(id, c);
    if (this.drafts.size > 24) this.drafts.delete(this.drafts.keys().next().value);
    this.cache = null;
    persist();
  },
  // Advance a disposable forecast to a stopped endpoint, including fuel and epoch.
  arrive(s, target, p) {
    if (!p?.valid || !Number.isFinite(p.earth)) return p?.reason || 'Нет прогноза прибытия к текущей цели.';
    if (MissionPlanner.burstScheduled(p) && p.sourceId && !s.destroyed.includes(p.sourceId)) s.destroyed.push(p.sourceId);
    const source = p.passage ? target : p.arrivalStar || (p.arrival ? target : ExtendedCatalog.arrivalStar(target, s.destroyed) || target);
    s.planningSource = source;
    s.current = source.id;
    const exit = p.passage && p.encounter.plan ? Gravity.atProper(p.encounter.plan, p.encounter.plan.proper).offset : [0,0,0];
    s.ship = Space.point(V3.add(source.p3, exit));
    s.beta = p.passage ? p.coast.beta : 0;
    s.matter = p.arrivalFuelKg / 1000;
    s.cosmicTime += s.expansion !== false ? p.earth : 0;
    s.earth += p.earth;
    s.orbit = !p.passage && p.arrival ? {targetId: source.id, radius: p.arrival.radius, beta: p.arrival.beta} : null;
    return '';
  },
  context(id = state.selected) {
    const f = state.flight;
    // The executing plan has a fixed arrival forecast: no integration per frame.
    const key = JSON.stringify([id, f?.target, f?.legIndex, state.nextTargets, this.setupFor(id), state.expansion, state.destroyed]);
    if (this.cache?.flight === f && this.cache.key === key) return this.cache.value;
    const s = {...state, flight: null, orbit: null, nextTargets: [], selected: id, destroyed: [...state.destroyed], phase: 'idle', beta: 0};
    let issue = '';
    if (f) {
      let plan = f.mission;
      if (!plan) {
        const eta = FlightEstimate.get();
        plan = {...eta, valid: Number.isFinite(eta?.earth), sourceId: f.fromId, arrivalStar: f.arrivalStar};
      }
      const remaining = FlightEstimate.get();
      plan = {...plan, earth: remaining?.earth ?? plan?.earth};
      issue = this.arrive(s, object(f.target), plan);
      // An existing atlas route finishes before the appended queue starts.
      if (!issue && f.route?.length) {
        for (let i = f.legIndex + 1; !issue && i < f.route.length; i++) {
          const n = f.route[i];
          s.selected = n.id;
          const p = this.run(s, () => {
            const c = MissionPlanner.legSetup(FlightSetup.preferred(s), s.planningSource, new Set(s.destroyed));
            return n.mode === 'flyby'
              ? MissionPlanner.passage(c, s.planningSource, object(n.id), object(f.route[i+1]?.id), s.matter*1000, s.ship, s.cosmicTime, s.expansion !== false, s.beta)
              : MissionPlanner.planPreferred(c, s.planningSource, object(n.id), s.matter*1000, s.ship, s.cosmicTime, s.expansion !== false, s.beta, s.orbit);
          });
          issue = this.arrive(s, object(n.id), p);
        }
      }
    }
    for (const n of state.nextTargets) {
      if (issue || n.id === id) break;
      s.selected = n.id; s.flightSetup = n.setup;
      const p = this.run(s, () => MissionPlanner.preview());
      issue = this.arrive(s, object(n.id), p);
    }
    s.selected = id;
    s.flightSetup = this.setupFor(id);
    s.planningIssue = issue;
    this.cache = {flight: f, key, value: s};
    return s;
  },
  forecast(context = this.context()) {
    return context.planningIssue ? MissionPlanner.invalid(context.planningIssue) : this.run(context, () => MissionPlanner.preview());
  },
  add(id) {
    if (!state.flight || id === state.flight.target) return;
    if (state.nextTargets.some(n => n.id === id)) { toast('Эта цель уже в очереди.'); return; }
    if (state.nextTargets.length >= this.limit) { toast('В очереди уже 10 целей.'); return; }
    const o = object(id);
    if (!o?.navigable) return;
    const context = this.context(id), p = this.forecast(context);
    if (!p.valid) { toast(p.reason); return; }
    ExtendedCatalog.pin(o);
    state.nextTargets.push({id, setup: FlightSetup.normalize(context.flightSetup)});
    this.cache = null;
    persist(); renderUI();
    toast('В очереди: ' + o.name + '. Старт после предыдущей остановки.');
  },
  depart({focusRoute = true} = {}) {
    if (state.flight || !state.nextTargets.length) return;
    const n = state.nextTargets[0], previous = state.selected;
    state.selected = n.id;
    const setup = FlightSetup.resolve(n.setup, object(state.current));
    const p = MissionPlanner.planPreferred(setup, object(state.current), object(n.id), state.matter * 1000, state.ship, state.cosmicTime || 0, state.expansion !== false);
    if (!p.valid) { state.selected = n.id; renderUI(); persist(); toast('Очередь остановлена: ' + p.reason); return; }
    // Snapshot before removing the stop so cancellation restores it as well.
    FlightHistory.pending = FlightHistory.snapshot();
    state.nextTargets.shift(); state.flightSetup = n.setup;
    this.cache = null;
    MissionPlanner.launch(p, null, {focusRoute});
    if (previous !== n.id && state.nextTargets.some(q => q.id === previous)) select(previous);
  },
  dismiss() {
    if (state.flight && state.selected !== state.flight.target) select(state.flight.target);
  },
  render() {
    const f = state.flight, nodes = state.nextTargets;
    const visible = (!!f && this.browsing()) || nodes.length > 0;
    const rows = (f ? 1 : 0) + nodes.length + (!f && nodes.length ? 1 : 0);
    $('flightCard').style.setProperty?.('--queue-height', Math.min(rows, width < 700 ? 2 : 3) * 29 + 'px');
    $('targetQueue').hidden = !visible;
    $('flightCard').classList.toggle('has-queue', visible);
    const html = (f ? '<button class="queue-current" data-queue-select="' + this.escape(f.target) + '" aria-pressed="' + !this.browsing() + '"><small>В ПОЛЁТЕ</small><b>' + this.escape(object(f.target).name) + '</b><span>↗</span></button>' : '') +
      nodes.map((n, i) => '<div class="queue-stop"><button data-queue-select="' + this.escape(n.id) + '" aria-pressed="' + (state.selected === n.id) + '"><small>' + String(i + 1).padStart(2, '0') + '</small><b>' + this.escape(object(n.id).name) + '</b></button><button data-queue-remove="' + i + '" aria-label="Убрать ' + this.escape(object(n.id).name) + '">×</button></div>').join('') +
      (!f && nodes.length ? '<button data-queue-resume>Продолжить очередь →</button>' : '');
    UIContent.html($('targetQueue'), html);
    if (!this.browsing()) return;
    const target = object(state.selected), context = this.context(), p = this.forecast(context), queued = nodes.some(n => n.id === target.id);
    $('flightCard').classList.remove('in-flight');
    UIContent.text($('distanceCaption'), 'ОТ ПРЕДЫДУЩЕЙ ОСТАНОВКИ');
    UIContent.text($('targetName'), target.name);
    UIContent.text($('targetType'), objectTypeText(target));
    $('targetVisited').hidden = !state.visited.includes(target.id);
    UIContent.text($('phaseTag'), queued ? 'В ОЧЕРЕДИ' : 'СЛЕДУЮЩАЯ ЦЕЛЬ');
    const d = target.navigable ? this.run(context, () => Cosmology.physicalDistance(context.ship, target)) : NaN;
    UIContent.html($('targetDistance'), Number.isFinite(d) ? compact(d) + ' <small>св. лет</small>' : '<small>Расстояние неизвестно</small>');
    UIContent.text($('arrivalLabel'), 'ПОСЛЕ ПРЕДЫДУЩЕЙ ОСТАНОВКИ');
    $('arrivalEstimate').hidden = !target.navigable;
    UIContent.text($('arrivalProper'), p.valid ? durationText(p.proper) : '—');
    UIContent.text($('arrivalEarth'), p.valid ? durationText(p.earth) : '—');
    $('flightControls').hidden = true;
    $('launchBtn').hidden = false;
    $('launchBtn').disabled = queued || !target.navigable || !p.valid || nodes.length >= this.limit;
    UIContent.text($('launchBtn').querySelector('span'), queued ? 'В очереди · ' + (nodes.findIndex(n => n.id === target.id) + 1) : 'Выбрать следующую цель');
    $('configureFlight').hidden = !target.navigable || !!context.planningIssue;
    UIContent.text($('configureFlightLabel'), 'Подробный план ↗');
    const c = FlightSetup.resolve(context.flightSetup, context.planningSource);
    UIContent.text($('setupAccelerationSummary'), FlightSetup.acceleration(c));
    UIContent.text($('setupBrakingSummary'), FlightSetup.braking(c));
    for (const id of ['departureSection','departureDiagram','sailSection','engineSection','flightDetails']) $(id).hidden = true;
    $('horizonNotice').hidden = !p.unreachable;
    UIContent.text($('horizonNotice'), p.unreachable ? 'При включённом расширении прибытие недостижимо.' : '');
    UIContent.text($('flightHint'), p.valid ? FlightBuilder.reserveNote(p) : p.reason);
    $('flightHint').hidden = !$('flightHint').textContent;
    globalThis.UniverseMap?.renderCard(target);
    if (!target.cosmicEpoch) UIContent.text($('distanceCaption'), 'ОТ ПРЕДЫДУЩЕЙ ОСТАНОВКИ');
    $('mapSliceTargetNotice').hidden = !(globalThis.MapSlice?.mode === 'slice' && !MapSlice.includes(target));
  },
  show() {
    const f = state.flight;
    showDialog('<div class="modal-eyebrow">НАВИГАЦИЯ / СЛЕДУЮЩИЕ ОСТАНОВКИ</div><h2>Очередь целей.</h2>' +
      (f ? '<p>Текущий полёт: <b>'+this.escape(object(f.target).name)+'</b>. Очередь начнётся после завершения текущего маршрута.</p>' : '') +
      (f?.route?.length ? '<button class="text-action" id="activeAtlasRoute">Текущий маршрут ↗</button>' : '') +
      '<ol class="route-list">'+state.nextTargets.map((n,i)=>'<li class="route-node"><div class="route-node-name"><span>'+String(i+1).padStart(2,'0')+'</span><b>'+this.escape(object(n.id).name)+'</b></div><p>'+FlightSetup.acceleration(n.setup)+' · '+FlightSetup.braking(n.setup)+'</p><div class="route-node-actions"><button data-open-stop="'+i+'">Карточка ↗</button><button data-raise-stop="'+i+'" '+(i===0?'disabled':'')+' aria-label="Поднять цель '+(i+1)+'">↑</button><button data-delete-stop="'+i+'" aria-label="Удалить цель '+(i+1)+'">×</button></div></li>').join('')+'</ol><p>До 10 следующих остановок. План каждого участка уточняется по фактическим топливу, позиции и времени прибытия.</p>');
    $('dialogContent').onclick = e => {
      const b=e.target.closest('button'); if (!b) return;
      if (b.id === 'activeAtlasRoute') { Route.show(); return; }
      if (b.dataset.openStop !== undefined) { const n=state.nextTargets[+b.dataset.openStop]; $('infoDialog').close(); if(n) select(n.id); return; }
      if (b.dataset.deleteStop !== undefined) state.nextTargets.splice(+b.dataset.deleteStop,1);
      else if (b.dataset.raiseStop !== undefined) { const i=+b.dataset.raiseStop; if(i>0) [state.nextTargets[i-1],state.nextTargets[i]]=[state.nextTargets[i],state.nextTargets[i-1]]; }
      else return;
      this.cache=null;persist();renderUI();this.show();
    };
  },
  setup() {
    $('targetQueue').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.queueSelect !== undefined) select(b.dataset.queueSelect);
      else if (b.dataset.queueRemove !== undefined) { state.nextTargets.splice(+b.dataset.queueRemove, 1); this.cache = null; persist(); renderUI(); }
      else if (b.hasAttribute('data-queue-resume')) this.depart();
    };
  },
};

const QuickFlight = {
  options: ['engine', 'sail', 'collector', 'burst'],
  issueLabel(p) {
    if (p.valid) return 'Запас ' + fmt(p.arrivalFuelKg / p.setup.capacityKg * 100, 1) + '%';
    if (p.unreachable) return 'Недостижимо';
    return /тяги недостаточно|разгона недостаточно|света недостаточно|добавьте.*двигател/iu.test(p.reason || '') ? 'Не хватает тяги' : 'План недоступен';
  },
  current() {
    const context = FlightQueue.browsing() ? FlightQueue.context() : state;
    return {context, source: context.planningSource || object(context.current), setup: FlightSetup.read(context)};
  },
  render() {
    const target = object(state.selected), browsing = FlightQueue.browsing();
    const visible = !((!!state.flight && !browsing) || !target?.navigable || (!state.flight && target.id === state.current));
    $('quickFlight').hidden = !visible;
    $('flightCard').classList.toggle('is-planning', visible);
    $('quickResult').hidden = !visible;
    $('quickSpeedRow').hidden = true;
    $('configureFlight').classList.toggle('is-compact', visible);
    if (!visible) return;
    const {context, source, setup: c} = this.current(), used = new Set(context.destroyed), star = FlightSetup.available(source, used);
    const stellar = !!source && ['star', 'home'].includes(source.kind), burstIssue = FlightSetup.burstIssue(source, used);
    UIContent.text($('quickSource'), source?.name || 'Текущая позиция');
    $('quickSource').title = 'Старт: ' + $('quickSource').textContent;
    document.querySelectorAll('[data-flight-option]').forEach(b => {
      const key = b.dataset.flightOption, enabled = key === 'engine' ? c.engine && !c.dump : c[key];
      b.hidden = false;
      b.disabled = key === 'engine' ? enabled && !c.sail : key === 'burst' ? !stellar : !star;
      b.setAttribute('aria-pressed', String(enabled));
      b.title = key === 'engine'
        ? b.disabled ? 'Для разгона нужна тяга или парус' : 'Фотонная тяга с расходом топлива'
        : key === 'burst' && burstIssue ? burstIssue
        : !star ? 'Для светового разгона нужна звезда в точке старта'
        : key === 'sail' ? 'Парус использует свет звезды'
        : key === 'collector' ? 'Направляет свет звезды на парус; включает парус'
        : 'Разгон светом вспышки; включает парус. Звезда будет уничтожена';
    });
    const p = browsing ? FlightQueue.forecast(context) : MissionPlanner.preview();
    this.issueReason = p.valid ? FlightBuilder.reserveNote(p) : p.reason;
    $('quickIssue').hidden = !this.issueReason;
    $('quickSpeedRow').hidden = !!this.issueReason;
    UIContent.text($('quickSpeed'), p.valid ? percentC(p.peakBeta) : '—');
    UIContent.text($('quickIssueLabel'), this.issueReason ? this.issueLabel(p) : '');
    $('quickIssue').title = this.issueReason || '';
    $('quickIssue').setAttribute('aria-label', this.issueReason || '');
    // Keep diagnostics in the same fixed result row as speed. Full explanations
    // open on demand instead of inserting paragraphs above/below the controls.
    $('flightHint').hidden = true;
    $('horizonNotice').hidden = true;
    UIContent.text($('configureFlightLabel'), 'Подробный план ↗');
  },
  toggle(key) {
    if (!this.options.includes(key)) return;
    const {context, source, setup} = this.current(), preferred = FlightSetup.preferred(context);
    const star = FlightSetup.available(source, new Set(context.destroyed));
    if (key === 'burst') {
      const issue = FlightSetup.burstIssue(source, new Set(context.destroyed));
      if (issue) { showDialog('<h2>' + FlightQueue.escape(issue) + '</h2>'); return; }
    }
    if (key !== 'engine' && !star) return;
    const c = FlightSetup.normalize(preferred), enabled = key === 'engine' ? setup.engine && !setup.dump : setup[key];
    // Keep at least one source of acceleration, and keep optical dependencies coherent.
    if (key === 'engine' && enabled && !setup.sail) return;
    c[key] = !enabled;
    if (key === 'engine') c.dump = false;
    if (key === 'sail' && !c.sail) {
      c.collector = c.burst = false;
      if (!c.engine || c.dump) { c.engine = true; c.dump = false; }
    }
    if ((key === 'collector' || key === 'burst') && c[key]) c.sail = true;
    if (FlightQueue.browsing()) FlightQueue.setSetup(state.selected, c);
    else { state.flightSetup = c; FlightSetup.sync(); persist(); }
    renderUI();
  },
  setup() {
    $('quickIssue').onclick = () => {
      if (!this.issueReason) return;
      showDialog('<div class="modal-eyebrow">ПЛАН ПОЛЁТА</div><h2>' + FlightQueue.escape($('quickIssueLabel').textContent) + '</h2><p>' + FlightQueue.escape(this.issueReason) + '</p>');
    };
    $('quickFlight').onclick = e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      this.toggle(b.dataset.flightOption);
    };
  },
};
