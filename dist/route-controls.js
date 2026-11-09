'use strict';
// One route panel serves both the draft and the executing route.
Object.assign(Route, {
  draftCache:null,feedbackPending:false,feedbackSelectionOnly:false,feedbackVersion:0,
  cancelFeedback(){this.feedbackPending=this.feedbackSelectionOnly=false;this.feedbackVersion++;},
  flushFeedback(){this.cancelFeedback();renderUI();persist();},
  deferFeedback({selectionOnly=false}={}){
    this.feedbackPending=true;this.feedbackSelectionOnly=selectionOnly;const version=++this.feedbackVersion;
    this.renderFeedback();
    // Paint the map first; ordinary selection replaces the whole card once ready.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(version===this.feedbackVersion)this.flushFeedback();}));
  },
  renderApproach(){
    const f=state.flight,target=object(state.selected),browsing=FlightQueue.browsing(),
      visible=(!f||browsing)&&(target?.kind==='blackhole'||Gravity.canFlyby(target))&&target.id!==state.current,
      node=this.future().findLast(n=>n.id===target?.id);
    $('blackHoleArrival').hidden=!visible;
    document.querySelectorAll('[data-approach]').forEach(b=>{b.setAttribute('aria-pressed',String((node?.mode||'stop')===b.dataset.approach));b.disabled=b.dataset.approach==='flyby'&&!Gravity.canFlyby(target);b.title=b.disabled?'Недостаточно данных о массе для расчёта манёвра':'';});
  },
  renderActions(){$('cancelRouteDraft').hidden=!!state.flight||!state.itinerary.length;},
  canSelectNext(id=state.selected){
    const future=this.future(),last=future.at(-1),target=object(id);
    return !!(last?.mode==='flyby'&&target?.navigable&&target.p3&&target.id!==last.id&&future.length<this.limit);
  },
  renderDistance(){
    const leg=this.selectedLeg();if(!leg)return;
    UIContent.text($('distanceCaption'),state.flight||state.itinerary.length?'ОТ ПРЕДЫДУЩЕЙ ТОЧКИ':'РАССТОЯНИЕ ДО ЦЕЛИ');
    UIContent.html($('targetDistance'),Number.isFinite(leg.distance)?compact(leg.distance)+' <small>св. лет</small>':'<small>Расстояние неизвестно</small>');
  },
  renderFeedback(){
    if(this.feedbackSelectionOnly)return;
    const f=state.flight,target=object(state.selected),nodes=this.nodes(),browsing=FlightQueue.browsing();
    if(!target)return;
    this.renderApproach();this.renderActions();
    UIContent.text($('targetName'),target.name);UIContent.text($('targetType'),objectTypeText(target));
    $('targetVisited').hidden=!state.visited.includes(target.id);
    UIContent.text($('phaseTag'),f?'УЧАСТОК '+((f.legIndex||0)+1)+' / '+(f.route?.length||1):'МАРШРУТ');
    UIContent.text($('progressLabel'),f?'УЧАСТОК '+((f.legIndex||0)+1)+' / '+(f.route?.length||1):'ПРОЙДЕНО');
    if(!f||browsing)this.renderDistance();
    UIContent.text($('arrivalProper'),'…');UIContent.text($('arrivalEarth'),'…');
    const pending=nodes.at(-1)?.mode==='flyby';
    $('routeDraftIssue').hidden=!pending;
    UIContent.text($('routeDraftIssue'),pending?'Для пролёта добавьте следующую точку маршрута.':'');
    $('launchBtn').hidden=!!f&&!browsing;$('launchBtn').disabled=!pending||!this.canSelectNext();
    UIContent.text($('launchBtn').querySelector('span'),pending?'Добавить точку':f?'Добавить участок':nodes.length?'Начать маршрут':'Лететь');
  },
  draftAnalysis() {
    const key=JSON.stringify([state.itinerary,FlightSetup.preferred(),state.current,state.orbit?object(state.current)?.p3:state.ship.p3,state.matter,state.destroyed,state.expansion,Math.floor((state.cosmicTime||0)/1000),ArrivalStars.revision]);
    if(this.draftCache?.key!==key)this.draftCache={key,value:this.analyze()};
    return this.draftCache.value;
  },
  approach(mode) {
    const target=object(state.selected);
    if(!(target?.kind==='blackhole'||Gravity.canFlyby(target))||!['stop','flyby'].includes(mode))return;
    if(mode==='flyby'&&!Gravity.canFlyby(target))return;
    const node=this.future().findLast(n=>n.id===target.id);
    if(node)node.mode=mode;
    else if(mode==='flyby'){this.add(target.id,{mode});return;}
    this.changed();
  },
  renderDraft() {
    const f=state.flight,target=object(state.selected),browsing=FlightQueue.browsing();
    $('repairRoute').hidden=!f?.routeIssue||browsing;
    this.renderApproach();this.renderActions();
    const nodes=this.nodes(),draft=!f&&nodes.length>0;
    if(draft||browsing)this.renderDistance();
    const p=(browsing?FlightQueue.forecast():f?.mission)||(!f&&target?.navigable?MissionPlanner.preview():null),star=p?.arrivalStar;
    $('routeDraftIssue').hidden=true;
    if(f?.routeIssue){
      const next=object(nodes[(f.legIndex||0)+1]?.id);
      $('routeDraftIssue').hidden=false;UIContent.text($('routeDraftIssue'),'Следующая точка'+(next?' «'+next.name+'»':'')+' недоступна: '+f.routeIssue.reason);
      if(!browsing){UIContent.text($('phaseTag'),'МАРШРУТ ПРИОСТАНОВЛЕН');UIContent.text($('progressRemaining'),'Измените маршрут, чтобы продолжить полёт.');}
      return;
    }
    if(!draft){
      if(f&&nodes.at(-1)?.mode==='flyby'){
        $('routeDraftIssue').hidden=false;UIContent.text($('routeDraftIssue'),'Для пролёта добавьте следующую точку маршрута.');
        if(browsing){$('launchBtn').disabled=!this.canSelectNext();UIContent.text($('launchBtn').querySelector('span'),'Добавить точку');}
      }
      if(!f&&p?.requestedTargetId&&star){UIContent.text($('distanceCaption'),'ДО ЗВЕЗДЫ ТОРМОЖЕНИЯ');UIContent.html($('targetDistance'),compact(Cosmology.physicalDistance(state.ship,star))+' <small>св. лет</small>');}
      return;
    }
    const analysis=this.draftAnalysis(),pending=nodes.at(-1).mode==='flyby',
      issue=pending?'Выберите объект на карте или через поиск и нажмите «Добавить точку».':analysis.records.find(r=>r.issue)?.issue||'';
    $('routeDraftIssue').hidden=!issue;UIContent.text($('routeDraftIssue'),issue);
    $('launchBtn').hidden=false;$('launchBtn').disabled=pending?!this.canSelectNext():!analysis.valid;
    UIContent.text($('launchBtn').querySelector('span'),pending?'Добавить точку':'Начать маршрут');
    UIContent.text($('arrivalLabel'),'ДЛИТЕЛЬНОСТЬ МАРШРУТА');
    $('arrivalEstimate').hidden=false;$('flightHint').hidden=true;
    if(target.id===state.current)UIContent.text($('phaseTag'),paused?'ПАУЗА':'МАРШРУТ');
    UIContent.text($('arrivalProper'),analysis.valid?durationText(analysis.proper):'—');UIContent.text($('arrivalEarth'),analysis.valid?durationText(analysis.earth):'—');
  },
});
$('blackHoleArrival').onclick=e=>{const b=e.target.closest('button[data-approach]');if(b)Route.approach(b.dataset.approach);};
$('cancelRouteDraft').onclick=()=>Route.cancelDraft();
$('repairRoute').onclick=()=>Route.show();
