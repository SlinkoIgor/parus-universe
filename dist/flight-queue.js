'use strict';
// Forecast future legs without changing the route or the executing trajectory.
const FlightQueue = {
  drafts: new Map(), cache: null, arrivals: null, forecasts: new WeakMap(),
  reset() { this.drafts.clear(); this.cache = null; this.arrivals = null; },
  escape(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  browsing() { return !!state.flight && state.selected !== state.flight.target; },
  run(context, fn) {
    const live=state;state=context;
    try { return fn(); } finally { state=live; }
  },
  setupFor(id) { return this.drafts.get(id)||Route.future().findLast(n=>n.id===id)?.setup||FlightSetup.preferred(); },
  setSetup(id, setup) {
    const c=FlightSetup.normalize(setup),node=Route.future().findLast(n=>n.id===id);
    if(node)node.setup=c;
    this.drafts.set(id,c);
    if(this.drafts.size>24)this.drafts.delete(this.drafts.keys().next().value);
    this.cache=null;persist();
  },
  // Advance a disposable forecast to an endpoint, including fuel and epoch.
  arrive(s,target,p) {
    if(!p?.valid||!Number.isFinite(p.earth))return p?.reason||'Нет прогноза прибытия к текущей цели.';
    if(MissionPlanner.burstScheduled(p)&&p.sourceId&&!s.destroyed.includes(p.sourceId))s.destroyed.push(p.sourceId);
    const source=p.passage?target:p.arrivalStar||(p.arrival?target:ExtendedCatalog.arrivalStar(target,s.destroyed)||target);
    s.planningSource=source;s.current=source.id;
    const exit=p.passage&&p.encounter.plan?Gravity.atProper(p.encounter.plan,p.encounter.plan.proper).offset:[0,0,0];
    s.ship=Space.point(V3.add(source.p3,exit));s.beta=p.passage?p.coast.beta:0;
    s.matter=p.arrivalFuelKg/1000;s.cosmicTime+=s.expansion!==false?p.earth:0;s.earth+=p.earth;
    s.orbit=!p.passage&&p.arrival?{targetId:source.id,radius:p.arrival.radius,beta:p.arrival.beta}:null;
    return '';
  },
  plan(s,node,next) {
    return this.run(s,()=>{
      const setup=MissionPlanner.legSetup(node.setup||FlightSetup.preferred(s),s.planningSource,new Set(s.destroyed));
      return node.mode==='flyby'
        ?MissionPlanner.passage(setup,s.planningSource,object(node.id),next,s.matter*1000,s.ship,s.cosmicTime,s.expansion!==false,s.beta)
        :MissionPlanner.planPreferred(setup,s.planningSource,object(node.id),s.matter*1000,s.ship,s.cosmicTime,s.expansion!==false,s.beta,s.orbit);
    });
  },
  context(id=state.selected) {
    const f=state.flight,future=Route.future(),selectedIndex=future.findLastIndex(n=>n.id===id),nodes=selectedIndex<0?future:future.slice(0,selectedIndex);
    const key=JSON.stringify([id,f?.target,f?.legIndex,nodes,this.setupFor(id),FlightSetup.preferred(),state.expansion,state.destroyed,ArrivalStars.revision]);
    if(this.cache?.flight===f&&this.cache.key===key)return this.cache.value;
    let s={...state,flight:null,orbit:null,itinerary:[],nextTargets:[],selected:id,destroyed:[...state.destroyed],phase:'idle',beta:0};
    let issue='';
    const baseKey=JSON.stringify([f?.target,f?.legIndex,FlightSetup.preferred(),state.expansion,state.destroyed,ArrivalStars.revision]);
    if(this.arrivals?.flight!==f||this.arrivals?.mission!==f?.mission||this.arrivals?.key!==baseKey)this.arrivals={flight:f,mission:f?.mission,key:baseKey,stops:new Map()};
    const stops=f?.mission?this.arrivals.stops:null,copy=value=>({...value,destroyed:[...value.destroyed]});
    if(stops?.has(''))s=copy(stops.get(''));
    else if(f){
      let plan=f.mission;
      if(!plan){const eta=FlightEstimate.get();plan={...eta,valid:Number.isFinite(eta?.earth),sourceId:f.fromId,arrivalStar:f.arrivalStar};}
      plan={...plan,earth:FlightEstimate.get()?.earth??plan?.earth};
      issue=this.arrive(s,object(f.target),plan);
      if(!issue)stops?.set('',copy(s));
    }
    let prefix='';
    for(let i=0;i<nodes.length&&!issue;i++){
      const n=nodes[i],next=object(nodes[i+1]?.id||id);
      prefix+=JSON.stringify([n,n.mode==='flyby'?next?.id:null]);
      if(stops?.has(prefix)){s=copy(stops.get(prefix));continue;}
      s.selected=n.id;
      issue=this.arrive(s,object(n.id),this.plan(s,n,next));
      if(!issue)stops?.set(prefix,copy(s));
    }
    if(stops?.size>40)stops.clear();
    s.selected=id;s.flightSetup=this.setupFor(id);s.planningIssue=issue;
    this.cache={flight:f,key,value:s};return s;
  },
  forecast(context=this.context()) {
    if(context.planningIssue)return MissionPlanner.invalid(context.planningIssue);
    const nodes=Route.future(),index=nodes.findLastIndex(n=>n.id===context.selected),node=nodes[index];
    const key=JSON.stringify([node||null,nodes[index+1]?.id||null]),memo=this.forecasts.get(context);
    if(memo?.key===key)return memo.value;
    const value=this.computeForecast(context,nodes,index,node);
    this.forecasts.set(context,{key,value});return value;
  },
  computeForecast(context,nodes,index,node) {
    if(node?.mode==='flyby'){
      const next=object(nodes[index+1]?.id);
      if(!next)return MissionPlanner.invalid('Для гравитационного манёвра выберите следующую точку.');
      return this.plan(context,node,next);
    }
    return this.run(context,()=>context.beta>0
      ?MissionPlanner.planPreferred(context.flightSetup,context.planningSource,object(context.selected),context.matter*1000,context.ship,context.cosmicTime,context.expansion!==false,context.beta,context.orbit)
      :MissionPlanner.preview());
  },
  dismiss() { if(this.browsing())select(state.flight.target); },
  render() {
    if(!this.browsing())return;
    const target=object(state.selected),context=this.context(),p=this.forecast(context),nodes=Route.future(),index=nodes.findLastIndex(n=>n.id===target.id);
    UIPatch.toggle($('flightCard'), 'in-flight', false);
    UIContent.text($('distanceCaption'),'ОТ ПРЕДЫДУЩЕЙ ТОЧКИ');
    UIContent.text($('targetName'),target.name);UIContent.text($('targetType'),objectTypeText(target));
    UIPatch.set($('targetVisited'), 'hidden', !state.visited.includes(target.id));
    UIContent.text($('phaseTag'),index>=0?'УЧАСТОК '+((state.flight.legIndex||0)+index+2)+' / '+state.flight.route.length:'ДОБАВИТЬ УЧАСТОК');
    const d=target.navigable?this.run(context,()=>Cosmology.physicalDistance(context.ship,target)):NaN;
    UIContent.html($('targetDistance'),Number.isFinite(d)?compact(d)+' <small>св. лет</small>':'<small>Расстояние неизвестно</small>');
    UIContent.text($('arrivalLabel'),'ДЛИТЕЛЬНОСТЬ УЧАСТКА');
    UIPatch.set($('arrivalEstimate'), 'hidden', !target.navigable);
    UIContent.text($('arrivalProper'),p.valid?durationText(p.proper):'—');UIContent.text($('arrivalEarth'),p.valid?durationText(p.earth):'—');
    UIPatch.set($('flightControls'), 'hidden', true);UIPatch.set($('launchBtn'), 'hidden', false);
    UIPatch.set($('launchBtn'), 'disabled', index>=0||!target.navigable||nodes.length>=Route.limit);
    UIContent.text($('launchBtn').querySelector('span'),index>=0?'Участок добавлен':'Добавить участок');
    UIPatch.set($('configureFlight'), 'hidden', !target.navigable||!!context.planningIssue);
    UIContent.text($('configureFlightLabel'),'Подробный план ↗');
    const c=FlightSetup.resolve(context.flightSetup,context.planningSource);
    UIContent.text($('setupAccelerationSummary'),FlightSetup.acceleration(c));UIContent.text($('setupBrakingSummary'),FlightSetup.braking(c));
    for(const id of ['engineSection','flightDetails'])UIPatch.set($(id), 'hidden', true);
    UIPatch.set($('horizonNotice'), 'hidden', !p.unreachable);UIContent.text($('horizonNotice'),p.unreachable?'При включённом расширении прибытие недостижимо.':'');
    UIContent.text($('flightHint'),p.valid?FlightBuilder.reserveNote(p):p.reason);UIPatch.set($('flightHint'), 'hidden', !UIPatch.text($('flightHint')));
    globalThis.UniverseMap?.renderCard(target);
    if(!target.cosmicEpoch)UIContent.text($('distanceCaption'),'ОТ ПРЕДЫДУЩЕЙ ТОЧКИ');
  },
};

const QuickFlight = {
  options: ['engine', 'sail', 'collector', 'burst'],
  reserveNoticeKey: null,
  notifyReserve(p) {
    const note = FlightBuilder.reserveNote(p), key = note ? JSON.stringify([p.sourceId, p.targetId, note]) : null;
    if (key && key !== this.reserveNoticeKey) toast(note,14000,'warning');
    this.reserveNoticeKey = key;
  },
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
    UIPatch.set($('quickFlight'), 'hidden', !visible);
    UIPatch.toggle($('flightCard'), 'is-planning', visible);
    UIPatch.set($('quickResult'), 'hidden', !visible);
    UIPatch.set($('quickSpeedRow'), 'hidden', true);
    UIPatch.toggle($('configureFlight'), 'is-compact', visible);
    if (!visible) { this.reserveNoticeKey = null; return; }
    const {context, source, setup: c} = this.current(), used = new Set(context.destroyed), star = FlightSetup.available(source, used);
    const stellar = !!source && ['star', 'home'].includes(source.kind), burstIssue = FlightSetup.burstIssue(source, used);
    const sourceName = String(source?.name || 'Текущая позиция');
    UIContent.text($('quickSource'), sourceName);
    UIPatch.set($('quickSource'), 'title', 'Старт: ' + sourceName);
    document.querySelectorAll('[data-flight-option]').forEach(b => {
      const key = b.dataset.flightOption, enabled = key === 'engine' ? c.engine && !c.dump : c[key];
      UIPatch.set(b, 'hidden', false);
      UIPatch.set(b, 'disabled', key === 'engine' ? enabled && !c.sail : key === 'burst' ? !stellar : !star);
      UIPatch.attr(b, 'aria-pressed', String(enabled));
      UIPatch.set(b, 'title', key === 'engine'
        ? UIPatch.get(b, 'disabled') ? 'Для разгона нужна тяга или парус' : 'Фотонная тяга с расходом топлива'
        : key === 'burst' && burstIssue ? burstIssue
        : !star ? 'Для светового разгона нужна звезда в точке старта'
        : key === 'sail' ? 'Парус использует свет звезды'
        : key === 'collector' ? 'Направляет свет звезды на парус; включает парус'
        : 'Разгон светом вспышки; включает парус. Звезда будет уничтожена');
    });
    const p = browsing ? FlightQueue.forecast(context) : MissionPlanner.preview();
    this.notifyReserve(p);
    this.issueReason = p.valid ? '' : p.reason;
    UIPatch.set($('quickIssue'), 'hidden', !this.issueReason);
    UIPatch.set($('quickSpeedRow'), 'hidden', !!this.issueReason);
    UIContent.text($('quickSpeed'), p.valid ? percentC(p.peakBeta) : '—');
    UIContent.text($('quickIssueLabel'), this.issueReason ? this.issueLabel(p) : '');
    UIPatch.set($('quickIssue'), 'title', this.issueReason || '');
    UIPatch.attr($('quickIssue'), 'aria-label', this.issueReason || '');
    // Reserve adjustments use the arrival notification area; keep speed visible.
    // Unavailable plans still explain their cause from the fixed result row.
    UIPatch.set($('flightHint'), 'hidden', true);
    UIPatch.set($('horizonNotice'), 'hidden', true);
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
