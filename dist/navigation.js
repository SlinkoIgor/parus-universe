'use strict';
const Route={
 picking:false,preview:null,
 sanitize(saved){
  const normalize=nodes=>{for(const n of nodes||[])if(n.mode==='flyby'&&!Gravity.canFlyby(object(n.id)))n.mode='stop';};
  normalize(saved.itinerary);const f=saved.flight;
  if(f?.route?.length){const current=f.route[f.legIndex],changed=current?.mode==='flyby'&&!Gravity.canFlyby(object(current.id));normalize(f.route);
   if(changed){const covered=f.covered||0;f.from=Space.point(saved.ship.p3);f.distance=distance(f.from,object(f.target));f.covered=0;f.aim=null;f.encounter=null;f.coastRate=0;if(f.wind)f.wind.baseCovered-=covered;if(saved.phase==='flyby')saved.phase='cruise';}
  }
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
   records.push(r);if(o){from=o;departure=o;}
  }
  return{valid,records};
 },
 show(){
  const active=state.flight?.route?.length,nodes=active?state.flight.route:state.itinerary,analysis=active?null:this.analyze(nodes);this.preview=analysis;
  let html='<div class="modal-eyebrow">НАВИГАЦИЯ / 3D → 2D</div><h2>Маршрут.</h2><p>Звёзды — для разгона парусом, чёрные дыры — для поворотов без остановки. Последняя точка — остановка.</p>';
  if(!nodes.length)html+='<p class="route-empty">Добавьте первую точку из атласа. У промежуточной чёрной дыры можно выбрать гравитационный пролёт.</p>';
  html+='<ol class="route-list">'+nodes.map((n,i)=>{const o=object(n.id),r=analysis?.records[i];let detail=r?distanceText(r.d)+' · подлёт ≈ '+percentC(r.beta):i===state.flight.legIndex?'ТЕКУЩАЯ ТОЧКА':i<state.flight.legIndex?'ПРОЙДЕНА':'ВПЕРЕДИ';
   if(r&&i<nodes.length-1&&!Gravity.canFlyby(o))detail+=o.kind==='star'?'<br>После остановки — '+(state.departureMode==='engine'?'собственная тяга':'разгон парусом')+(state.departureMode!=='engine'&&state.destroyed.includes(o.id)?' недоступен: звезда уже использована; будет использован двигатель.':'.'):'<br>Гравитационный поворот — только у чёрных дыр.';
   if(r&&n.mode==='flyby'){detail+='<br>Поворот в 3D: '+(r.required!==undefined?this.angleText(r.required):'—')+' · максимум '+(r.maxAngle!==undefined?this.angleText(Math.min(Math.PI,r.maxAngle)):'—');if(r.ok&&!r.straight)detail+='<br>Сближение: '+this.radiusText(r.rp);if(o.gravity?.assumed)detail+='<br>Масса и радиус — типовая модель, не измерение.';}
   return'<li class="route-node '+(r?.issue?'invalid':'')+'"><div class="route-node-name"><span>'+String(i+1).padStart(2,'0')+'</span><b>'+o.name+'</b></div><p>'+detail+(r?.issue?'<br><strong>'+r.issue+'</strong>':'')+'</p>'+(active?'<small>'+(n.mode==='flyby'?'ГРАВИТАЦИОННЫЙ ПРОЛЁТ':'ОСТАНОВКА')+'</small>':'<div class="route-node-actions"><button data-mode="'+i+'" '+(!Gravity.canFlyby(o)||i===nodes.length-1?'disabled':'')+'>'+(n.mode==='flyby'?'Пролёт ↝':'Остановка ■')+'</button><button data-up="'+i+'" aria-label="Поднять точку '+(i+1)+'" '+(i===0?'disabled':'')+'>↑</button><button data-down="'+i+'" aria-label="Опустить точку '+(i+1)+'" '+(i===nodes.length-1?'disabled':'')+'>↓</button><button data-remove="'+i+'" aria-label="Удалить точку '+(i+1)+'">×</button></div>')+'</li>';
  }).join('')+'</ol>';
  if(!active)html+='<div class="route-actions"><button class="map-size-action" id="addRoutePoint" '+(nodes.length>=12?'disabled':'')+'>Добавить точку из атласа +</button><button class="modal-start" id="startRoute" '+(!analysis.valid||state.flight?'disabled':'')+'>Начать маршрут →</button></div>';
  else html+='<p>Точка '+(state.flight.legIndex+1)+' из '+nodes.length+'. '+(state.phase==='flyby'?'Проходит гравитационный пролёт.':'Автопилот выполняет маршрут.')+'</p><button class="map-size-action" id="cancelRoute" '+(state.phase==='flyby'?'disabled':'')+'>Завершить маршрут на текущей точке</button>';
  html+='<p class="object-note">Остановка гасит скорость. Выбранные средства разгона и торможения применяются ко всему маршруту. У промежуточной точки без доступной звезды световые компоненты не работают; для нового разгона после остановки нужна тяга с веществом. При пролёте скорость сохраняется. Для поворота у чёрной дыры учитывается граница захвата. Прогноз уточняется при подлёте по фактической скорости. Вращение, приливное разрушение, нагрев и магнитосфера не моделируются. Неподвижный объект не даёт бесплатного прироста скорости.</p><button class="text-action" id="routeTheory">Как считаются углы и проекция ↗</button>';
  showDialog(html);
  $('dialogContent').onclick=e=>{const b=e.target.closest('button');if(!b||active)return;const d=b.dataset;let i;if(d.mode!==undefined){i=+d.mode;if(!Gravity.canFlyby(object(nodes[i].id))||i===nodes.length-1)return;nodes[i].mode=nodes[i].mode==='stop'?'flyby':'stop';}else if(d.up!==undefined){i=+d.up;[nodes[i-1],nodes[i]]=[nodes[i],nodes[i-1]];}else if(d.down!==undefined){i=+d.down;[nodes[i],nodes[i+1]]=[nodes[i+1],nodes[i]];}else if(d.remove!==undefined)nodes.splice(+d.remove,1);else return;if(nodes.length)nodes.at(-1).mode='stop';persist();this.show();};
  if(!active){$('addRoutePoint').onclick=()=>{this.picking=true;$('infoDialog').close();$('search').value='';openCatalog();toast('Выберите следующую точку маршрута.');};$('startRoute').onclick=()=>this.start();}
  else $('cancelRoute').onclick=()=>{syncClock();if(this.abort()===false)return;$('infoDialog').close();toast('Оставшиеся точки отменены. Автопилот остановится у текущей цели.');renderUI();persist();};
  $('routeTheory').onclick=()=>showNavigationTheory();
 },
 add(id){if(state.itinerary.length>=12){toast('До 12 точек в одном маршруте.');return;}const o=object(id);if(!o?.navigable){toast('Для этого ориентира нет точных координат.');return;}if(state.itinerary.at(-1)?.id===id||(!state.itinerary.length&&state.current===id)){toast('Эта точка уже является началом текущего участка.');return;}state.itinerary.push({id,mode:'stop'});persist();},
 abort(){
  const f=state.flight;if(!f?.route?.length)return false;
  if(f.mission?.passage){
   // Cancelling a passage needs a physical stopping plan from the actual ship,
   // rather than leaving a passage with no route for Route.enter() to follow.
   const c={...f.mission.setup,engine:false,dump:false,sail:false,collector:false,burst:false},target=object(f.target),p=MissionPlanner.plan(c,null,target,state.matter*1000,state.ship,state.cosmicTime||0,state.expansion!==false,state.beta);
   if(!p.valid){toast('Маршрут сохранён: '+p.reason);return false;}
   const anchor=FlightView.ship(),offset=Cosmology.project(object(f.fromId)||f.from,{x:0,y:0});
   Object.assign(f,{mission:p,missionElapsed:{proper:0,earth:0},from:Space.point(state.ship.p3),distance:p.distance,covered:0,maxBeta:p.peakBeta,aim:null,encounter:null,coastRate:0,boost:false,markers:[],view:{a:{x:anchor.x-offset.x,y:anchor.y-offset.y},b:MapLayout.baseProject(target),referenceEpoch:true,geometryVersion:MapLayout.version}});
   delete f.profile;MissionPlanner.activateStage(f,0);state.acceleration=0;FlightMarks.plan(f);
  }else if(f.aim){const anchor=FlightView.ship();f.from={...state.ship,p3:[...state.ship.p3]};f.distance=distance(state.ship,object(f.target));f.covered=0;f.aim=null;f.encounter=null;f.view={a:anchor,b:MapLayout.project(object(f.target))};coastSetup();}
  f.route=null;state.auto=true;return true;
 },
 start(){if(MissionPlanner.enabledIdle()){MissionPlanner.startRoute();return;}syncClock();const check=this.analyze();if(!check.valid||state.flight)return;const nodes=state.itinerary.map(n=>({...n}));$('infoDialog').close();state.selected=nodes[0].id;launch();if(state.flight){state.flight.route=nodes;state.flight.legIndex=0;state.flight.encounter=null;this.configure();state.itinerary=[];log('Маршрут: '+nodes.map(n=>object(n.id).name+(n.mode==='flyby'?' [пролёт]':' [остановка]')).join(' → '));renderUI();persist();}},
 configure(){const f=state.flight;if(f?.mission)return;if(!this.isFlyby(f))return;const e=Gravity.encounter(f.from,object(f.target),object(f.route[f.legIndex+1].id),f.maxBeta);if(!e.ok)return;f.encounter={...e,beta:f.maxBeta};if(e.plan){delete f.view;f.aim=Space.point(V3.add(object(f.target).p3,e.plan.rows[0].offset));f.distance=distance(f.from,f.aim);}FlightMarks.plan(f);},
 prepare(f=state.flight){
  if(!this.isFlyby(f))return null;
  if(f.encounter&&Math.abs(f.encounter.beta-state.beta)<1e-12)return f.encounter;
  const body=object(f.target),next=object(f.route[f.legIndex+1].id),e=Gravity.encounter(f.from,body,next,state.beta);
  if(!e.ok){f.route[f.legIndex].mode='stop';f.encounter=null;f.aim=null;f.from=Space.point(state.ship.p3);f.distance=distance(f.from,body);f.covered=0;f.maxBeta=state.beta;delete f.view;FlightMarks.plan(f);toast('Пролёт недоступен на фактической скорости. Автопилот выполняет остановку.');log('Пролёт заменён остановкой: '+body.name+'. '+e.reason);return null;}
  f.encounter={...e,beta:state.beta};return f.encounter;
 },
 gate(f=state.flight){if(f.aim)return 0;const e=this.prepare(f);return e?.plan?Math.min(f.distance,e.plan.R/LY):0;},
 enter(){const f=state.flight,e=this.prepare(f);if(!e)return;if(e.straight){this.next(f,state.ship,state.beta);return;}state.phase='flyby';state.acceleration=0;f.encounter.plan.elapsedProper=0;f.encounter.lastEarth=0;f.encounter.lastProper=0;f.encounter.lastPath=0;log('Пролёт: '+object(f.target).name+'. Поворот '+this.angleText(e.angle)+', rₚ = '+this.radiusText(e.rp)+'.');},
 tick(dt){
  const f=state.flight,e=f.encounter,p=e.plan,body=object(f.target),old=p.elapsedProper||0,used=Math.min(dt,Math.max(0,p.proper-old));
  p.elapsedProper=old+used;const s=Gravity.atProper(p,p.elapsedProper);
  const cosmicStep=s.earth-e.lastEarth;state.earth+=cosmicStep;Cosmology.elapse(state,cosmicStep);state.proper+=s.proper-e.lastProper;if(f.missionElapsed){f.missionElapsed.proper+=s.proper-e.lastProper;f.missionElapsed.earth+=cosmicStep;}state.totalDistance+=s.path-e.lastPath;e.lastEarth=s.earth;e.lastProper=s.proper;e.lastPath=s.path;
  state.ship=Space.point(V3.add(body.p3,s.offset));state.acceleration=0;state.beta=p.beta;
  if(p.elapsedProper>=p.proper){if(!state.visited.includes(body.id))state.visited.push(body.id);this.next(f,state.ship,p.beta);}return used;
 },
 next(old,from,beta){if(old.mission){MissionPlanner.continueRoute(old,from,beta);return;}const nodes=old.route,index=old.legIndex+1,target=object(nodes[index]?.id);if(!target)return;state.selected=target.id;state.current=null;state.beta=beta;state.acceleration=0;state.phase='cruise';state.flight={cosmic:Cosmology.isCosmic(object(old.target),target),view:{a:MapLayout.baseProject(object(old.target)),b:MapLayout.baseProject(target),referenceEpoch:true},from:{...from,p3:[...from.p3]},target:target.id,fromId:old.target,distance:distance(from,target),covered:0,coastRate:0,maxBeta:beta,boost:false,engine:null,wind:null,magnetic:null,medium:GasMedium.forLeg(from,target,state.sail),missed:false,autoStopping:false,route:nodes,legIndex:index,encounter:null};this.configure();FlightMarks.plan();coastSetup();renderUI();fitRoute(target);persist();},
 afterStop(old){if(old.mission){MissionPlanner.continueRoute(old);return;}if(!old.route?.length||old.legIndex>=old.route.length-1)return;const index=old.legIndex+1;state.selected=old.route[index].id;launch();if(state.flight){state.flight.route=old.route;state.flight.legIndex=index;state.flight.encounter=null;this.configure();persist();}},
 draw(){
  const f=state.flight,nodes=f?.route||state.itinerary;if(!nodes.length)return;let a=f?screen(f.from):screen(state.ship);const start=f?f.legIndex:0;
  for(let i=start;i<nodes.length;i++){const o=object(nodes[i].id),b=screen(o);drawPhysicalSegment(i===start?(f?f.from:state.ship):object(nodes[i-1].id),o,'#919191',.9,[3,5]);circle(b.x,b.y,18,'#999999',.7);text(String(i+1),b.x,b.y+3,8,'#555555','center');a=b;}
 },
 drawEncounter(){
  if(state.phase!=='flyby')return;const p=state.flight.encounter.plan,s=Gravity.atProper(p,p.elapsedProper||0),cx=width<700?width*.72:width*.48,cy=height*.30,scale=62/p.rp;
  // Explicit local diagram, independent of the interstellar map scale.
  ctx.save();ctx.beginPath();ctx.rect(cx-86,cy-86,172,172);ctx.clip();
  for(let i=1;i<p.rows.length;i++){const a=p.rows[i-1],b=p.rows[i];line(cx+Math.cos(a.phi)*a.r*scale,cy-Math.sin(a.phi)*a.r*scale,cx+Math.cos(b.phi)*b.r*scale,cy-Math.sin(b.phi)*b.r*scale,'#666666',1);}
  const rs=Gravity.rs(p.profile.massSolar);circle(cx,cy,Math.max(3,rs*scale),'#252525',1);circle(cx+Math.cos(s.phi)*s.r*scale,cy-Math.sin(s.phi)*s.r*scale,3,'#252525',2);ctx.restore();
  text('ЛОКАЛЬНАЯ ГЕОДЕЗИЧЕСКАЯ',cx,cy-96,7,'#777777','center');text('ОТДЕЛЬНЫЙ МАСШТАБ · 0 g',cx,cy+101,6,'#777777','center');
 },
 setup(){ $('routeBtn').onclick=()=>this.show();$('sourcesBtn').onclick=()=>showCatalogSources();}
};
function showCatalogSources(){showDialog('<div class="modal-eyebrow">АТЛАС / ИСТОЧНИКИ</div><h2>'+ExtendedCatalog.total.toLocaleString('ru-RU')+' объектов.</h2><p>Полные локальные снимки: HYG 4.1 — 119 626 строк, OpenNGC — 13 970 строк, ATNF 2.9.0 — 4503 пульсара. Все 652 имени IAU WGSN сохранены. Каталоги пересекаются; исходные известные объекты объединены с их записями.</p><p>На карту подгружаются участки текущей области; на общем масштабе показаны реальные представители участков, при приближении доступны все точки. Поиск работает по полному каталогу в отдельном потоке. В пределах 50 световых лет выделены до 100 известных звёзд; остальные — серые точки без постоянных подписей.</p><p>Приблизительные расстояния по красному смещению, положительному параллаксу или моделям ATNF отмечены отдельно; по ним разрешён полёт. Если расстояние отсутствует, объект показан схематически по направлению, а радиус условной оболочки не является физическим расстоянием. Записи OpenNGC с пометкой NonEx/Dup сохраняют исторические обозначения; ошибочная идентификация не становится целью полёта.</p><p>Связи компонентов взяты из полей HYG и обозначений групп OpenNGC; для Альфы Центавра дополнена известная иерархия AB–C. Эллипсы схематические. Условные игровые звёзды в галактиках явно отделены от каталожных измерений и позволяют продолжить экспедицию.</p><p><a href="https://github.com/astronexus/HYG-Database" target="_blank" rel="noopener">HYG</a> · <a href="https://github.com/mattiaverga/OpenNGC" target="_blank" rel="noopener">OpenNGC</a> · <a href="https://www.atnf.csiro.au/research/pulsar/psrcat/" target="_blank" rel="noopener">ATNF</a> · <a href="https://exopla.net/star-names/modern-iau-star-names/" target="_blank" rel="noopener">IAU WGSN</a> · <a href="https://simbad.cds.unistra.fr/simbad/" target="_blank" rel="noopener">SIMBAD/CDS</a></p><p>HYG/OpenNGC: CC BY-SA 4.0. Имена IAU — общественное достояние. Выборки SIMBAD: ODbL. ATNF: Manchester et al. (2005), AJ 129, 1993. Контуры сверхструктур приблизительны.</p><p><a href="catalog-data/manifest.json" target="_blank">Полнота каталогов ↗</a> · <a href="catalog-sources.json" target="_blank">Происхождение и лицензии ↗</a></p><button class="map-size-action" id="projectionInfo">Как устроена 2D-карта ↗</button>');$('projectionInfo').onclick=()=>showNavigationTheory();}
