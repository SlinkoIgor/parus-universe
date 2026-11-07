'use strict';
const Route={
 picking:false,preview:null,limit:10,selection:null,
 sanitize(saved){
  const normalize=(nodes,draft=false)=>{for(const n of nodes||[])if(n.mode==='flyby'&&!Gravity.canFlyby(object(n.id))&&!(draft&&object(n.id)?.kind==='blackhole'))n.mode='stop';};
  normalize(saved.itinerary,true);normalize(saved.nextTargets,true);const f=saved.flight;
  if(f?.route?.length){const current=f.route[f.legIndex],changed=current?.mode==='flyby'&&!Gravity.canFlyby(object(current.id));normalize(f.route.slice(0,f.legIndex+1));normalize(f.route.slice(f.legIndex+1),true);
   if(changed){const covered=f.covered||0;f.from=Space.point(saved.ship.p3);f.detachedSource=true;delete f.view;f.distance=distance(f.from,object(f.target));f.covered=0;f.aim=null;f.encounter=null;f.coastRate=0;if(f.wind)f.wind.baseCovered-=covered;if(saved.phase==='flyby')saved.phase='cruise';}
  }
  // Fold old saved queues into the same route without changing the active plan.
  const pending=saved.nextTargets||[];
  if(pending.length){
   if(f){if(!f.route?.length)f.route=[{id:f.requestedTarget||f.target,mode:f.mission?.passage?'flyby':'stop'}];f.legIndex??=0;f.route.push(...pending);}
   else (saved.itinerary??=[]).push(...pending);
  }
  saved.nextTargets=[];
  return saved;
 },
 angleText(radians){const d=radians*180/Math.PI;return d!==0&&d<.01?d.toExponential(2).replace('.',',')+'°':fmt(d,2)+'°';},
 radiusText(m){return m<1e10?compact(m/1000)+' км':fmt(m/149597870700,3)+' а.е.';},
 isFlyby(f=state.flight){return !!f?.route?.length&&Gravity.canFlyby(object(f.target))&&f.route[f.legIndex]?.mode==='flyby'&&f.legIndex<f.route.length-1;},
 braking(){return !this.isFlyby();},
 analyze(nodes=state.itinerary){
  if(MissionPlanner.enabledIdle())return MissionPlanner.analyzeRoute(nodes);
  let from=state.ship,fuel=state.matter,beta=0,valid=nodes.length>0,records=[],departure=object(state.current),usedStars=new Set(state.destroyed);
  for(let i=0;i<nodes.length;i++){
   const n=nodes[i],o=object(n.id),d=o?distance(from,o):0;let issue='';
   if(!o?.navigable||!from.p3||d<1e-12){issue='Нет физических координат или точка совпадает с предыдущей.';valid=false;}
   if(beta===0&&d>0){if(state.departureMode!=='engine'&&['star','home'].includes(departure?.kind)&&!usedStars.has(departure.id)&&!(state.departureMode==='burst'&&departure.id==='sol')){beta=Stellar.sourcePlan(departure,state.departureMode,(Rocket.dryMass+fuel)*1000,d).beta;if(state.departureMode==='burst')usedStars.add(departure.id);}else{const engine=Rocket.plan(fuel,d);beta=engine.beta;fuel=Math.max(0,fuel-engine.budget);if(beta===0){issue='Нет горючего для нового разгона.';valid=false;}}}
   const r={id:n.id,mode:n.mode,d,beta,issue};
   if(n.mode==='flyby'){
    const next=object(nodes[i+1]?.id);
    if(!Gravity.canFlyby(o)){r.issue='Гравитационный поворот доступен только у чёрной дыры.';valid=false;}
    else if(!next?.p3){r.issue='Пролёт требует следующей точки маршрута.';valid=false;}
    else{const angle=V3.angle(V3.sub(o.p3,from.p3),V3.sub(next.p3,o.p3)),sol=Gravity.solve(o.gravity,beta,angle);Object.assign(r,sol,{required:angle});if(!sol.ok){r.issue=sol.reason;valid=false;}else if(!sol.straight&&sol.rp*5>Math.min(d,distance(o,next))*.001*LY){r.issue='Область пролёта перекрывает соседнюю точку.';valid=false;}}
   }else if(beta>0){const stop=Magnetic.stopping(fuel,beta,100,GasMedium.forLeg(from,o,state.sail));fuel=Math.max(0,stop.magnetic.finalMass/1000-Rocket.dryMass-stop.engine.budget);beta=0;}
   records.push(r);if(o){from=o;departure=ExtendedCatalog.arrivalStar(o,[...usedStars])||o;}
  }
  return{valid,records};
 },
 show(){
  const active=!!state.flight,nodes=active?this.ensureActive():state.itinerary,first=active?state.flight.legIndex+1:0,analysis=active?null:this.analyze(nodes);this.preview=analysis;
  const esc=FlightQueue.escape;
  let html='<div class="modal-eyebrow">НАВИГАЦИЯ / 3D → 2D</div><h2>Маршрут.</h2><p>Shift + клик добавляет участок маршрута. Двойной клик добавляет последнюю точку и запускает полёт; во время полёта он добавляет следующий участок. Повторный Shift + клик по последней точке и Esc убирают один будущий участок.</p>';
  if(!nodes.length)html+='<p class="route-empty">Добавьте первую точку на карте или через поиск. Для пролёта у чёрной дыры укажите следующую точку.</p>';
  html+='<ol class="route-list">'+nodes.map((n,i)=>{
   const o=object(n.id),r=analysis?.records[i],editable=i>=first;
   let detail=r?distanceText(r.d)+' · подлёт ≈ '+percentC(r.beta):!active?'ПЛАНИРУЕТСЯ':i===state.flight.legIndex?'ТЕКУЩАЯ ТОЧКА':i<state.flight.legIndex?'ПРОЙДЕНА':'ВПЕРЕДИ';
   if(r&&i<nodes.length-1&&!Gravity.canFlyby(o))detail+=o.kind==='star'||ExtendedCatalog.arrivalStar(o)?'<br>После остановки — '+(state.departureMode==='engine'?'собственная тяга':'разгон парусом')+(state.departureMode!=='engine'&&state.destroyed.includes(o.id)?' недоступен: звезда уже использована; будет использован двигатель.':'.'):'<br>Гравитационный поворот — только у чёрных дыр.';
   if(r&&n.mode==='flyby'){detail+='<br>Поворот в 3D: '+(r.required!==undefined?this.angleText(r.required):'—')+' · максимум '+(r.maxAngle!==undefined?this.angleText(Math.min(Math.PI,r.maxAngle)):'—');if(r.ok&&!r.straight)detail+='<br>Сближение: '+this.radiusText(r.rp);if(o.gravity?.assumed)detail+='<br>Масса и радиус — типовая модель, не измерение.';}
   let actions='<small>'+(n.mode==='flyby'?'ГРАВИТАЦИОННЫЙ ПРОЛЁТ':'ОСТАНОВКА')+'</small>';
   if(editable)actions='<div class="route-node-actions"><button data-mode="'+i+'" '+(!Gravity.canFlyby(o)&&n.mode!=='flyby'?'disabled':'')+'>'+(n.mode==='flyby'?'Пролёт ↝':'Остановка ■')+'</button><button data-up="'+i+'" '+(i===first||(active&&state.flight.mission?.passage&&i===first+1)?'disabled':'')+'>↑</button><button data-down="'+i+'" '+(i===nodes.length-1||(active&&state.flight.mission?.passage&&i===first)?'disabled':'')+'>↓</button><button data-remove="'+i+'" aria-label="Удалить участок '+(i+1)+'">×</button></div>';
   return '<li class="route-node '+(r?.issue?'invalid':'')+'"><div class="route-node-name"><span>'+String(i+1).padStart(2,'0')+'</span><b>'+esc(o.name)+'</b></div><p>'+detail+(r?.issue?'<br><strong>'+esc(r.issue)+'</strong>':'')+'</p>'+actions+'</li>';
  }).join('')+'</ol><div class="route-actions"><button class="map-size-action" id="addRoutePoint" '+(nodes.length-first>=this.limit?'disabled':'')+'>Добавить точку через поиск +</button>';
  if(!active)html+='<button class="modal-start" id="startRoute" '+(!analysis.valid?'disabled':'')+'>Начать маршрут →</button>';
  html+='</div>';
  if(active)html+='<p>Участок '+(state.flight.legIndex+1)+' из '+nodes.length+'. Автопилот выполняет маршрут.</p><button class="map-size-action" id="cancelRoute" '+(!this.future().length?'disabled':'')+'>Убрать будущие участки</button>';
  html+='<p class="object-note">Остановка гасит скорость. Выбранные средства разгона и торможения применяются ко всему маршруту. Любая остановка происходит у звезды. Внутри протяжённой цели выбирается известная звезда, ближайшая к её опорной точке; у точечной цели — звезда ближе 5 св. лет. Если подходящей звезды нет, при прибытии открывается игровая. При пролёте скорость сохраняется. Для поворота у чёрной дыры учитывается граница захвата. Прогноз уточняется при подлёте по фактической скорости. Вращение, приливное разрушение, нагрев и магнитосфера не моделируются. Неподвижный объект не даёт бесплатного прироста скорости.</p><button class="text-action" id="routeTheory">Как считаются углы и проекция ↗</button>';
  showDialog(html);
  $('dialogContent').onclick=e=>{
   const b=e.target.closest('button');if(!b)return;const d=b.dataset;
   let i=Number(d.mode??d.up??d.down??d.remove);if(!Number.isInteger(i)||i<first||i>=nodes.length)return;
   if(d.remove!==undefined){if(!this.remove(i))return;}
   else if(d.mode!==undefined){if(!Gravity.canFlyby(object(nodes[i].id))&&nodes[i].mode!=='flyby')return;nodes[i].mode=nodes[i].mode==='stop'?'flyby':'stop';this.changed();}
   else if(d.up!==undefined&&i>first&&!(active&&state.flight.mission?.passage&&i===first+1)){[nodes[i-1],nodes[i]]=[nodes[i],nodes[i-1]];this.changed();}
   else if(d.down!==undefined&&i<nodes.length-1&&!(active&&state.flight.mission?.passage&&i===first)){[nodes[i],nodes[i+1]]=[nodes[i+1],nodes[i]];this.changed();}
   else return;
   this.show();
  };
  $('addRoutePoint').onclick=()=>{this.picking=true;$('infoDialog').close();$('search').value='';openCatalog();toast('Выберите следующую точку маршрута.',4200,'route');};
  if(!active)$('startRoute').onclick=()=>this.start();
  else $('cancelRoute').onclick=()=>{syncClock();this.clearFuture();this.show();};
  $('routeTheory').onclick=()=>showNavigationTheory();
 },
 nodes(){return state.flight?state.flight.route||[]:state.itinerary;},
 future(){const f=state.flight;return f?(f.route||[]).slice((f.legIndex||0)+1):state.itinerary;},
 ensureActive(){
  const f=state.flight;if(!f)return state.itinerary;
  if(!f.route?.length)f.route=[{id:f.requestedTarget||f.target,mode:f.mission?.passage?'flyby':'stop'}];f.legIndex??=0;
  return f.route;
 },
 changed(deferPreview=false){this.selection=null;FlightQueue.cache=null;this.draftCache=null;if(deferPreview)this.deferFeedback();else{this.cancelFeedback();persist();renderUI();}},
 add(id,{toggle=false,mode,deferPreview=false,afterSelection=false}={}){
  const o=object(id),f=state.flight,nodes=this.nodes(),start=f?(f.legIndex||0)+1:0;
  if(!o?.navigable){toast('Для этого ориентира нет точных координат.',4200,'warning');return false;}
  const first=afterSelection&&!this.future().length&&this.selection?.state===state?object(this.selection.id):null,
   anchor=first?.navigable&&first.id!==id&&(f?![f.target,f.requestedTarget,nodes[f.legIndex||0]?.id].includes(first.id):first.id!==state.current)?first:null;
  if(!anchor&&nodes.at(-1)?.id===id){if(toggle&&nodes.length>start)return this.undo(deferPreview);return false;}
  if(!anchor&&((!f&&!nodes.length&&state.current===id)||(f&&!f.route&&[f.target,f.requestedTarget].includes(id))))return false;
  if(Math.max(0,nodes.length-start)+1+(anchor?1:0)>this.limit){toast('В маршруте уже '+this.limit+' будущих участков.',4200,'warning');return false;}
  ExtendedCatalog.pin(o);
  const route=this.ensureActive(),node=(target,approach)=>({id:target.id,mode:approach||(target.kind==='blackhole'||Gravity.canFlyby(target)?'flyby':'stop'),...(f?{setup:FlightSetup.normalize(FlightQueue.setupFor(target.id))}:{})});
  if(anchor){ExtendedCatalog.pin(anchor);route.push(node(anchor));}
  route.push(node(o,mode));
  this.changed(deferPreview);return true;
 },
 remove(index,deferPreview=false){
  const f=state.flight,nodes=this.nodes(),start=f?(f.legIndex||0)+1:0;
  if(index<start||index>=nodes.length)return false;
  // The next point fixes the active gravitational trajectory. Removing it
  // requires a real braking plan, preserving position, velocity, fuel and clocks.
  if(f&&index===start&&(f.mission?.passage||this.isFlyby(f))){
   const keep=nodes.slice(0,start),leg=f.legIndex;
   if(this.abort()===false)return false;
   keep[leg]={...keep[leg],mode:'stop'};f.route=keep;f.legIndex=leg;
   // Other future points no longer define the encounter being cancelled.
   f.route.push(...nodes.slice(index+1));
  }else nodes.splice(index,1);
  if(!f){const last=nodes.at(-1);state.selected=last?.id||state.current||state.selected;}
  else if(!this.future().some(n=>n.id===state.selected))state.selected=f.target;
  this.changed(deferPreview);return true;
 },
 undo(deferPreview=false){return this.remove(this.nodes().length-1,deferPreview);},
 clearFuture(){while(this.future().length)if(!this.undo())break;},
 cancelDraft(){
  if(state.flight||!state.itinerary.length)return;
  state.itinerary=[];state.selected=state.current||state.selected;this.picking=false;closeCatalog();this.changed();$('launchBtn').focus();
 },
 abort(){
  const f=state.flight;if(!f?.route?.length)return false;
  if(f.mission?.passage||state.phase==='flyby'){
   // Cancelling a passage needs a physical stopping plan from the actual ship,
   // rather than leaving a passage with no route for Route.enter() to follow.
   const c={...(f.mission?.setup||FlightSetup.read()),engine:false,dump:false,sail:false,collector:false,burst:false},target=object(f.target),p=MissionPlanner.plan(c,null,target,state.matter*1000,state.ship,state.cosmicTime||0,state.expansion!==false,state.beta);
   if(!p.valid){toast('Маршрут сохранён: '+p.reason,4200,'warning');return false;}
   if(p.arrivalStar&&!p.arrivalStar.synthetic)ExtendedCatalog.pin(p.arrivalStar);
   const destination=object(p.targetId),selected=state.selected===f.target,anchor=FlightView.ship(),offset=Cosmology.project(object(f.fromId)||f.from,{x:0,y:0});
   if(selected)state.selected=destination.id;
   Object.assign(f,{target:destination.id,requestedTarget:p.requestedTargetId,arrivalStar:p.arrivalStar,summary:{distance:p.distance,proper:p.proper,earth:p.earth},mission:p,missionElapsed:{proper:0,earth:0},from:Space.point(state.ship.p3),detachedSource:true,distance:p.distance,covered:0,maxBeta:p.peakBeta,aim:null,encounter:null,coastRate:0,boost:false,markers:[],view:{a:{x:anchor.x-offset.x,y:anchor.y-offset.y},b:MapLayout.baseProject(destination),referenceEpoch:true,geometryVersion:MapLayout.version,modeKey:FlightView.geometryKey()}});
   delete f.profile;MissionPlanner.activateStage(f,0);state.acceleration=0;FlightMarks.plan(f);
  }else if(f.aim){const anchor=FlightView.ship(),offset=Cosmology.project(object(f.fromId)||f.from,{x:0,y:0});f.from={...state.ship,p3:[...state.ship.p3]};f.detachedSource=true;f.distance=distance(state.ship,object(f.target));f.covered=0;f.aim=null;f.encounter=null;f.view={a:{x:anchor.x-offset.x,y:anchor.y-offset.y},b:MapLayout.baseProject(object(f.target)),referenceEpoch:true,geometryVersion:MapLayout.version,modeKey:FlightView.geometryKey()};coastSetup();}
  f.route=null;state.auto=true;return true;
 },
 start(){if(MissionPlanner.enabledIdle()){MissionPlanner.startRoute();return;}syncClock();const check=this.analyze();if(!check.valid||state.flight)return;const nodes=state.itinerary.map(n=>({...n}));$('infoDialog').close();state.selected=nodes[0].id;launch();if(state.flight){state.flight.route=nodes;state.flight.legIndex=0;state.flight.encounter=null;this.configure();state.itinerary=[];log('Маршрут: '+nodes.map(n=>object(n.id).name+(n.mode==='flyby'?' [пролёт]':' [остановка]')).join(' → '));renderUI();persist();}},
 configure(){const f=state.flight;if(f?.mission)return;if(!this.isFlyby(f))return;const e=Gravity.encounter(f.from,object(f.target),object(f.route[f.legIndex+1].id),f.maxBeta);if(!e.ok)return;f.encounter={...e,beta:f.maxBeta};if(e.plan){delete f.view;f.aim=Space.point(V3.add(object(f.target).p3,e.plan.rows[0].offset));f.distance=distance(f.from,f.aim);}FlightMarks.plan(f);},
 prepare(f=state.flight){
  if(!this.isFlyby(f))return null;
  if(f.encounter&&Math.abs(f.encounter.beta-state.beta)<1e-12)return f.encounter;
  const body=object(f.target),next=object(f.route[f.legIndex+1].id),e=Gravity.encounter(f.from,body,next,state.beta);
  if(!e.ok){f.route[f.legIndex].mode='stop';f.encounter=null;f.aim=null;f.from=Space.point(state.ship.p3);f.detachedSource=true;f.distance=distance(f.from,body);f.covered=0;f.maxBeta=state.beta;delete f.view;FlightMarks.plan(f);toast('Пролёт недоступен на фактической скорости. Автопилот выполняет остановку.',4200,'warning');log('Пролёт заменён остановкой: '+body.name+'. '+e.reason);return null;}
  f.encounter={...e,beta:state.beta};return f.encounter;
 },
 gate(f=state.flight){if(f.aim)return 0;const e=this.prepare(f);return e?.plan?Math.min(f.distance,e.plan.R/LY):0;},
 enter(){const f=state.flight,e=this.prepare(f);if(!e)return;if(e.straight){this.next(f,state.ship,state.beta);return;}state.phase='flyby';state.acceleration=0;f.encounter.plan.elapsedProper=0;f.encounter.lastEarth=0;f.encounter.lastProper=0;f.encounter.lastPath=0;FlightTips.use('black-holes');log('Пролёт: '+object(f.target).name+'. Поворот '+this.angleText(e.angle)+', rₚ = '+this.radiusText(e.rp)+'.');},
 tick(dt){
  const f=state.flight,e=f.encounter,p=e.plan,body=object(f.target),old=p.elapsedProper||0,used=Math.min(dt,Math.max(0,p.proper-old));
  p.elapsedProper=old+used;const s=Gravity.atProper(p,p.elapsedProper);
  const cosmicStep=s.earth-e.lastEarth;state.earth+=cosmicStep;Cosmology.elapse(state,cosmicStep);state.proper+=s.proper-e.lastProper;if(f.missionElapsed){f.missionElapsed.proper+=s.proper-e.lastProper;f.missionElapsed.earth+=cosmicStep;}state.totalDistance+=s.path-e.lastPath;e.lastEarth=s.earth;e.lastProper=s.proper;e.lastPath=s.path;
  state.ship=Space.point(V3.add(body.p3,s.offset));state.acceleration=0;state.beta=p.beta;
  if(p.elapsedProper>=p.proper){if(!state.visited.includes(body.id))state.visited.push(body.id);this.next(f,state.ship,p.beta);}return used;
 },
 next(old,from,beta){FlightHistory.complete(old);if(old.mission){MissionPlanner.continueRoute(old,from,beta);return;}const nodes=old.route,index=old.legIndex+1,target=object(nodes[index]?.id);if(!target)return;state.selected=target.id;state.current=null;state.beta=beta;state.acceleration=0;state.phase='cruise';state.flight={noticeElapsed:0,rollback:old.rollback,cosmic:Cosmology.isCosmic(object(old.target),target),view:{a:MapLayout.baseProject(object(old.target)),b:MapLayout.baseProject(target),referenceEpoch:true},from:{...from,p3:[...from.p3]},target:target.id,fromId:old.target,distance:distance(from,target),covered:0,coastRate:0,maxBeta:beta,boost:false,engine:null,wind:null,magnetic:null,medium:GasMedium.forLeg(from,target,state.sail),missed:false,autoStopping:false,route:nodes,legIndex:index,encounter:null};this.configure();FlightMarks.plan();coastSetup();renderUI();persist();},
 afterStop(old){if(old.mission){MissionPlanner.continueRoute(old);return;}if(!old.route?.length||old.legIndex>=old.route.length-1)return;const index=old.legIndex+1;state.selected=old.route[index].id;launch(false,{focusRoute:false});if(state.flight){state.flight.route=old.route;state.flight.legIndex=index;state.flight.encounter=null;this.configure();persist();}},
 endpoint(node){const o=object(node?.id);return node?.mode==='stop'&&o?ExtendedCatalog.arrivalStar(o)||o:o;},
 legs(){
  const f=state.flight,nodes=f?(f.route?.length?f.route:[{id:f.target}]):state.itinerary,start=f?.route?.length?(f.legIndex||0):0,legs=[];
  let from=f?f.from:state.ship;
  for(let i=start;i<nodes.length;i++){
   const active=!!f&&i===start,to=active?object(f.target):this.endpoint(nodes[i]);
   if(!from?.p3||!to?.p3)continue;
   legs.push({from,to,id:nodes[i].id,index:i,active,distance:active?(f.summary?.distance??f.distance):Cosmology.physicalDistance(from,to)});from=to;
  }
  return legs;
 },
 selectedLeg(id=state.selected){
  const legs=this.legs(),existing=legs.findLast(leg=>!leg.active&&leg.id===id);
  if(existing)return existing;
  const from=legs.at(-1)?.to||(state.flight?object(state.flight.target):state.ship),to=this.endpoint({id,mode:'stop'});
  return from?.p3&&to?.p3?{from,to,id,distance:Cosmology.physicalDistance(from,to)}:null;
 },
 draw(){
  const f=state.flight,nodes=this.nodes();if(!nodes.length)return;
  const start=f?f.legIndex:0;
  let previous=f?object(f.target):state.ship;
  for(let i=start;i<nodes.length;i++){
   const o=f&&i===start?object(f.target):this.endpoint(nodes[i]);if(!o)continue;
   if(!f||i!==start)drawPhysicalSegment(previous,o,'#919191',.9,[3,5]);
   if(!globalThis.MapSlice||MapSlice.includes(o)){const b=screen(o);circle(b.x,b.y,18,'#999999',.7);text(String(i+1),b.x,b.y+3,8,'#555555','center');}
   previous=o;
  }
 },
 drawEncounter(){
  if(state.phase!=='flyby')return;const p=state.flight.encounter.plan,s=Gravity.atProper(p,p.elapsedProper||0),cx=width<700?width*.72:width*.48,cy=height*.30,scale=62/p.rp;
  // Explicit local diagram, independent of the interstellar map scale.
  ctx.save();ctx.beginPath();ctx.rect(cx-86,cy-86,172,172);ctx.clip();
  for(let i=1;i<p.rows.length;i++){const a=p.rows[i-1],b=p.rows[i];line(cx+Math.cos(a.phi)*a.r*scale,cy-Math.sin(a.phi)*a.r*scale,cx+Math.cos(b.phi)*b.r*scale,cy-Math.sin(b.phi)*b.r*scale,'#666666',1);}
  const rs=Gravity.rs(p.profile.massSolar);circle(cx,cy,Math.max(3,rs*scale),'#252525',1);circle(cx+Math.cos(s.phi)*s.r*scale,cy-Math.sin(s.phi)*s.r*scale,3,'#252525',2);ctx.restore();
  text('ЛОКАЛЬНАЯ ГЕОДЕЗИЧЕСКАЯ',cx,cy-96,7,'#777777','center');text('ОТДЕЛЬНЫЙ МАСШТАБ · 0 g',cx,cy+101,6,'#777777','center');
 },
 setup(){ $('sourcesBtn').onclick=()=>showCatalogSources();}
};
function showCatalogSources() {
  showDialog('<div class="modal-eyebrow">КАТАЛОГ / ИСТОЧНИКИ</div><h2>Источники карты.</h2>'+
    '<p>'+CatalogRegistry.total.toLocaleString('ru-RU')+' записей в активном атласе. Список совпадает с вкладкой «Каталоги» в фильтрах карты. Числа относятся к самостоятельным записям атласа. Один объект может входить в несколько источников, поэтому их числа не складываются.</p>'+
    '<p>«На карте» — записи, пригодные для отображения, а не число точек в текущем кадре. Выборки источников ограничены их покрытием; пустой участок карты не означает отсутствие объектов.</p>'+
    CatalogRegistry.libraryHTML()+
    '<h3>Поиск и положение</h3><p>Поиск охватывает весь атлас; карта подгружает нужные участки. Приблизительные расстояния по красному смещению, параллаксу или моделям отмечены в карточках. Записи без пригодного положения остаются в поиске. Неизвестные параметры не заменяются типичными измерениями.</p>'+
    '<p>Наблюдательные каталоги, отдельные публикации, космологическая модель и игровые звёзды подписаны отдельно. Источники измерений, единицы и ограничения сохраняются в карточках объектов.</p>'+
    '<p>HYG/OpenNGC: CC BY-SA 4.0. Имена IAU — общественное достояние. Выборки SIMBAD: ODbL. ATNF: Manchester et al. (2005), AJ 129, 1993. У остальных источников действуют права авторов и условия публикаций.</p>'+
    '<p><a href="'+CatalogRegistry.data.manifest+'" target="_blank" rel="noopener">Полнота активного снимка ↗</a> · <a href="catalog-sources.json" target="_blank" rel="noopener">Происхождение и лицензии ↗</a></p>'+
    '<button class="map-size-action" id="projectionInfo">Как устроена 2D-карта ↗</button>');
  $('projectionInfo').onclick=()=>showNavigationTheory();
}
