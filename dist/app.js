 'use strict';
const $=id=>document.getElementById(id);
const fmt=(n,d=2)=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:d,minimumFractionDigits:d});
const compact=n=>n<0?'−'+compact(-n):n>=1e9?fmt(n/1e9,n>=1e10?1:2)+' млрд':n>=1e6?fmt(n/1e6,n>=1e7?1:2)+' млн':n>=1e3?fmt(n/1e3,1)+' тыс.':fmt(n,n<100?2:0);
const distanceText=n=>compact(n)+' св. лет';
const object=id=>OBJECTS.find(o=>o.id===id);
const distance=(a,b)=>Space.distance(a,b);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const STORE='parus-expedition-v1';
const G0=9.80665;
const percentC=beta=>fmt(beta*100,2)+'% c';
let theme=document.documentElement.dataset.theme||'dark';
function applyTheme(value){theme=value;document.documentElement.dataset.theme=value;const label=value==='dark'?'Включить светлую тему':'Включить тёмную тему';$('themeBtn').setAttribute('aria-label',label);$('themeBtn').title=label;$('themeBtn').textContent=value==='dark'?'☼':'◐';const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=value==='dark'?'#000000':'#f6f6f6';try{localStorage.setItem('parus-theme',value);}catch{}}
// Map the existing engineering ink palette to a neutral dark drawing palette.
function paint(color){if(theme==='light')return color;if(color==='#f8f8f8')return '#000000';if(color.startsWith('rgba'))return color.replace('37,38,32','218,218,218');const h=color.slice(1);if(!/^[0-9a-f]{3,6}$/i.test(h))return color;const hex=h.length===3?[...h].map(c=>c+c).join(''):h;return '#'+[0,2,4].map(i=>(255-parseInt(hex.slice(i,i+2),16)).toString(16).padStart(2,'0')).join('');}
let state,paused=false,speed=1,filter='all',toastTimer,hover=null,hitObjects=[],lastUI=0,saveTick=0;
const initial=()=>({version:4,current:'sol',selected:'proxima',sail:1,beta:0,acceleration:0,matter:1000,captured:0,spentEnergy:0,heatRadiated:0,earth:0,proper:0,totalDistance:0,ship:Space.point([0,0,0]),itinerary:[],visited:['sol'],destroyed:[],phase:'idle',flight:null,auto:true,journal:[{t:0,text:'Ковчег — 01. Масса корабля: 1 т. Фотонный двигатель готов.'}]});
function restore(saved){
 if(![1,2,3,4].includes(saved?.version)||!object(saved.selected)||!saved.ship||!Array.isArray(saved.visited))return initial();
 const upgraded={...initial(),...saved,version:4,acceleration:0,spentEnergy:saved.spentEnergy||0,heatRadiated:saved.heatRadiated||0};
 if(saved.version<3&&upgraded.flight){const f=upgraded.flight;delete f.legacy;f.coastRate=f.rate||1;f.wind=null;f.magnetic=null;
  if(upgraded.phase==='launch'){f.wind=Stellar.plan((Rocket.dryMass+upgraded.matter)*1000,SAILS[upgraded.sail].areaM2,upgraded.beta,Stellar.r0+f.covered*LY);f.wind.baseCovered=f.covered;f.wind.elapsed=0;f.maxBeta=f.wind.beta;if(f.wind.distance===0)upgraded.phase='cruise';}
  if(upgraded.phase==='brake'){f.magnetic=Magnetic.plan((Rocket.dryMass+upgraded.matter)*1000,upgraded.beta);if(f.magnetic.distance===0){f.engine=Rocket.retroPlan(upgraded.matter,upgraded.beta);upgraded.phase='dock';}}
  if(upgraded.phase==='thrust'&&!f.engine)upgraded.phase='cruise';
  if(f.engine)f.engine.direction=f.engine.direction||1;
 }
 if(saved.version<4){
  if(upgraded.flight){const f=upgraded.flight,target=object(f.target),from=object(f.fromId)||object('sol'),fraction=f.distance?f.covered/f.distance:0;if(target?.p3&&from.p3){f.from=Space.point(from.p3);f.distance=distance(from,target);f.covered=f.distance*fraction;upgraded.ship=Space.mix(from,target,fraction);if(f.wind)f.wind.baseCovered=f.covered-(Stellar.sample(f.wind,f.wind.elapsed/f.wind.duration).distance||0);}else{upgraded.flight=null;upgraded.phase='idle';upgraded.beta=0;upgraded.current='sol';upgraded.ship=Space.point([0,0,0]);}}
  else upgraded.ship=Space.point((object(upgraded.current)||object('sol')).p3||[0,0,0]);
  upgraded.journal.push({t:upgraded.earth,text:'Атлас обновлён: направления переведены в Galactic 3D; исторические часы сохранены. Остаток полёта перестроен.'});
 }
 if(!Array.isArray(upgraded.itinerary))upgraded.itinerary=[];
 return upgraded;
}
try{state=restore(JSON.parse(localStorage.getItem(STORE)));}catch{state=initial();}
const canvas=$('map'),ctx=canvas.getContext('2d');
let width=0,height=0,dpr=1,cam={x:0,y:0,span:24},cameraGoal=null,effects=[];
let pointer={down:false,x:0,y:0,startX:0,startY:0,moved:false,id:null};
const bgPoints=Array.from({length:95},(_,i)=>({x:((Math.sin(i*127.1+31)*43758.5453)%1+1)%1,y:((Math.sin(i*311.7+17)*93758.2513)%1+1)%1}));
function persist(){try{localStorage.setItem(STORE,JSON.stringify(state));}catch{}}
function log(text){state.journal.push({t:state.earth,text});if(state.journal.length>100)state.journal.shift();persist();}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function screen(p){return{x:width*.43+(p.x-cam.x)*width/cam.span,y:height*(width<700?.39:.50)+(p.y-cam.y)*width/cam.span};}
function world(x,y){return{x:cam.x+(x-width*.43)*cam.span/width,y:cam.y+(y-height*(width<700?.39:.50))*cam.span/width};}
function goCamera(x,y,span,instant=false){cameraGoal={x,y,span:clamp(span,.00006,1.4e11)};if(instant){cam={...cameraGoal};cameraGoal=null;}updateMapHeading();}
function fitRoute(target){const a=state.ship,b=target;goCamera((a.x+b.x)/2,(a.y+b.y)/2,Math.max(distance(a,b)*2.7,20));}
function select(id,fit=false){const o=object(id);if(!o)return;state.selected=id;if(fit)fitRoute(o);renderUI();renderCatalog();persist();}
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
new ResizeObserver(resize).observe(canvas);
function updateMapHeading(){const view=cameraGoal||cam,span=view.span;let title,sub,sheet;const localGalaxy=GALAXIES.find(g=>g.id!=='milkyway'&&Math.hypot(view.x-g.x,view.y-g.y)<Math.max(g.diameterLy,span*.3)&&span<g.diameterLy*10);
 if(localGalaxy){title=localGalaxy.name;sub='Оптический контур в масштабе · '+distanceText(localGalaxy.diameterLy);sheet='Г';}
 else if(span<.01){title='Солнечная система';sub='Земля и Солнце. Нулевая точка экспедиции.';sheet='00';}
 else if(span<180){title='Солнечная окрестность';sub='Всё большое начинается с ближайшей звезды.';sheet='01';}
 else if(span<10000){title='Звёздный рукав';sub='Маяки, туманности и далёкие солнца.';sheet='02';}
 else if(span<800000){title='Млечный Путь';sub='Наша Галактика и её ближайшие спутники.';sheet='03';}
 else if(span<30000000){title='Местная группа';sub='За пределами одного звёздного острова.';sheet='04';}
 else if(span<1e9){title='Галактическое окружение';sub='Скопления и потоки космической паутины.';sheet='05';}
 else if(span<4e10){title='Космическая паутина';sub='Стены, пустоты и структуры предельных масштабов.';sheet='06';}
 else{title='Обозримая Вселенная';sub='Около 93 миллиардов световых лет в поперечнике.';sheet='∞';}
 $('mapTitle').textContent=title;$('mapSubtitle').textContent=sub;$('mapSheet').textContent='/ '+sheet;
 document.querySelectorAll('[data-scale]').forEach(b=>b.classList.toggle('active',Math.abs(Math.log10(span/Number(b.dataset.scale)))<.32));
}
function canBoost(){const current=object(state.current);return !!current&&['star','galaxy'].includes(current.kind)&&!state.destroyed.includes(current.id);}
const windCache=new Map();
function windPlan(index=state.sail){const mass=(Rocket.dryMass+state.matter)*1000,key=mass+':'+index;if(!windCache.has(key)){if(windCache.size>12)windCache.clear();windCache.set(key,Stellar.plan(mass,SAILS[index].areaM2));}return windCache.get(key);}
function quantity(n){const abs=Math.abs(n);if(abs!==0&&(abs>=1e3||abs<.01)){const e=Math.floor(Math.log10(abs));return fmt(n/10**e,1)+'·10<sup>'+e+'</sup>';}return fmt(n,2);}
function renderUI(){
 const f=state.flight,target=object(f?f.target:state.selected),current=object(state.current),active=!!f,boost=canBoost(),arrived=!active&&state.current===target.id;
 $('targetName').textContent=target.name;$('targetType').textContent=state.destroyed.includes(target.id)&&target.kind==='star'?'ОСТАТОК ЗВЕЗДЫ':target.type;$('targetVisited').hidden=!state.visited.includes(target.id);
 $('flightCard').classList.toggle('in-flight',active);
 const d=target.navigable?distance(state.ship,target):target.d;$('targetDistance').innerHTML=compact(d)+' <small>св. лет</small>';
 const planningBoost=!active&&boost&&!arrived&&target.navigable;$('sailSection').hidden=!planningBoost;
 const sail=SAILS[state.sail];document.querySelectorAll('[data-sail]').forEach(b=>{const i=+b.dataset.sail;b.classList.toggle('active',i===state.sail);b.disabled=!planningBoost;if(planningBoost)b.querySelector('span').textContent='≈'+fmt(windPlan(i).beta*100,1)+'% c';});
 if(planningBoost){const predicted=windPlan();$('sailArea').textContent=sail.area+' км²';$('sailGamma').textContent=fmt(1/Math.sqrt(1-predicted.beta**2));$('sailDiagram').querySelector('text').textContent='≈ '+percentC(predicted.beta)+' →';}
 const photon=(state.phase==='thrust'||state.phase==='dock')&&f?.engine,wind=state.phase==='launch'&&f?.wind,mag=state.phase==='brake'&&f?.magnetic;
 const planningEngine=!active&&!boost&&!arrived&&target.navigable;$('engineSection').hidden=!(planningEngine||photon||wind||mag||state.phase==='flyby');$('burnTrack').hidden=!photon;
 if(planningEngine){const e=Rocket.plan(state.matter,d);$('engineLabel').textContent='ФОТОННАЯ ТЯГА · 3 ПВт';$('engineReadout').innerHTML='Масса <b>1 + '+fmt(state.matter,1)+' т</b><br>Разгон <b>до '+fmt(e.budget,2)+' т → '+percentC(e.beta)+'</b>';}
 if(photon){const e=f.engine;$('engineLabel').textContent=e.direction<0?'ОБРАТНАЯ ФОТОННАЯ ТЯГА · 3 ПВт':'АННИГИЛЯЦИЯ ВЕЩЕСТВА · 3 ПВт';$('engineReadout').innerHTML='Расход <b>'+compact(e.burned)+' / '+compact(e.budget)+' т</b><br>Энергия <b>'+quantity(e.energy/1e15)+' ПДж</b>';$('burnBar').style.width=(e.budget?100*e.burned/e.budget:0)+'%';}
 if(wind){const r=f.wind.startR+(f.covered-f.wind.baseCovered)*LY,force=Stellar.force(f.wind.area,r,state.beta);$('engineLabel').textContent='ЗВЁЗДНЫЙ ПОТОК · F ∝ 1/r²';$('engineReadout').innerHTML='До звезды <b>'+compact(r/Stellar.r0)+' а.е.</b><br>Сила <b>'+quantity(force)+' Н</b>';}
 if(mag){const rates=Magnetic.rates((Rocket.dryMass+state.matter)*1000,state.beta);$('engineLabel').textContent='МАГНИТНЫЙ ЗАХВАТ ЧАСТИЦ';$('engineReadout').innerHTML='Поток <b>'+quantity(rates.particles)+' частиц/с</b><br>Сбор <b>'+quantity(rates.massRate*Rocket.year/1000)+' т/год</b>';}
 if(state.phase==='flyby'){const p=f.encounter.plan,local=Gravity.sample(p,p.elapsed/p.duration);$('engineLabel').textContent='ГРАВИТАЦИОННЫЙ ПРОЛЁТ · 0 g';$('engineReadout').innerHTML='Поворот <b>'+Route.angleText(p.angle)+'</b><br>Перицентр <b>'+Route.radiusText(p.rp)+'</b><br>Локальная скорость <b>'+percentC(local.localBeta)+'</b>';}
 $('routeCount').textContent=(f?.route?.length||state.itinerary.length)||'';
 let action,hint;
 if(active){action='';hint=f.missed?'Цель пройдена. Остановка потребует оставшегося тормозного пути.':state.phase==='thrust'?'Двигатель расходует массу. Скорость растёт по ракетному уравнению.':state.phase==='launch'?'Парус впереди корабля. Поток слабеет с квадратом расстояния и с ростом скорости.':state.phase==='brake'?'Частицы передают импульс ловушке. Их сбор увеличивает массу корабля.':state.phase==='dock'?'Магнитное торможение ослабло. Последнюю скорость гасит двигатель обратной тягой.':'Инерционный полёт. Тормозной путь рассчитывается по текущей скорости и массе.';}
 else if(arrived){action='Выбрать следующую цель';hint=boost?'Прибытие. Выберите цель — и подготовьте звёздный парус.':'Прибытие. Следующая точка ждёт в атласе.';}
 else if(!target.navigable){action='Ориентир атласа';hint='Для этой протяжённой области нет однозначных 3D-координат. Она не используется как точка физического маршрута.';}
 else if(boost){action=current.kind==='star'?'Взорвать звезду и отчалить':'Импульс местной звезды';hint='Скорость — прогноз свободного разгона. Раннее торможение уменьшит её.';}
 else{action=state.current==='sol'?'К звезде на тяге':'К цели на тяге';hint=state.matter>1e-9?'Автопилот выделяет до 10% запаса на разгон. Захват и обратная тяга остановят корабль у цели.':'Запас рабочего вещества исчерпан.';}
 $('launchBtn').hidden=active;$('launchBtn').querySelector('span').textContent=action;$('launchBtn').disabled=!target.navigable||!arrived&&!boost&&state.matter<1e-9;$('flightHint').textContent=hint;
 const phases={thrust:'ФОТОННАЯ ТЯГА',launch:'ЗВЁЗДНЫЙ ВЕТЕР',cruise:'ИНЕРЦИОННЫЙ ПОЛЁТ',brake:'МАГНИТНОЕ ТОРМОЖЕНИЕ',dock:'ТОЧНАЯ ОСТАНОВКА',flyby:'ГРАВИТАЦИОННЫЙ ПРОЛЁТ'};
 $('phaseTag').textContent=paused?'ПАУЗА':active?phases[state.phase]:arrived?'ПРИБЫТИЕ':current?'СТОЯНКА / '+(current.id==='sol'?'СОЛНЦЕ':current.name.toUpperCase()):'МЕЖЗВЁЗДНОЕ ПРОСТРАНСТВО';
 $('flightControls').hidden=!active;$('stopEngine').hidden=!(photon||wind);$('stopEngine').textContent=wind?'Сложить парус':'Выключить двигатель';$('brakeBtn').hidden=state.phase==='dock'||state.phase==='flyby';
 $('brakeBtn').disabled=!active||state.beta<=0;$('brakeBtn').classList.toggle('active',state.phase==='brake');$('brakeBtn').querySelector('span').textContent=state.phase==='brake'?'Свернуть магнитный парус':'Раскрыть магнитный парус';$('autoBrake').checked=Route.braking();$('autoBrake').disabled=!!f?.route?.length;
 $('velocity').innerHTML=fmt(state.beta*100,2)+'<small>% c</small>';$('acceleration').innerHTML=quantity((state.acceleration||0)/G0)+'<small>g</small>';
 $('matter').innerHTML=(state.matter<1e4?fmt(state.matter,state.matter<100?2:1):compact(state.matter))+'<small>т</small>';$('matter').title=fmt(state.matter,3)+' т';$('dryMass').innerHTML=fmt(Rocket.dryMass,0)+'<small>т</small>';$('matter').title+=' · Полная масса '+fmt(Rocket.dryMass+state.matter,3)+' т';
 $('earthClock').innerHTML=compact(state.earth)+'<small>лет</small>';$('shipClock').innerHTML=compact(state.proper)+'<small>лет</small>';
 const pct=f?Math.min(100,f.covered/f.distance*100):0;$('progressBar').style.width=pct+'%';$('progressValue').textContent=fmt(pct,1)+'%';$('progressLabel').textContent=f?.route?.length?'УЧАСТОК '+(f.legIndex+1)+' / '+f.route.length:f?.missed?'ПРОЛЁТ ЦЕЛИ':'ПРОЙДЕНО';$('pauseBtn').textContent=paused?'▷':'Ⅱ';$('pauseBtn').setAttribute('aria-label',paused?'Продолжить':'Пауза');$('speedBtn').textContent=speed+'×';
}
function coastSetup(){const f=state.flight;if(!f)return;const span=Math.max(f.distance-f.covered,f.distance*.1,1e-10);f.coastRate=span/(Math.max(state.beta,1e-100)*24);}
function launch(forceEngine=false){
 if(state.flight)return;const target=object(state.selected);if(!target||target.id===state.current||!target.navigable)return;
 const boost=!forceEngine&&canBoost();if(!boost&&state.matter<1e-9){toast('Нет рабочего вещества для тяги.');return;}
 const from={...state.ship},d=distance(from,target);if(d<1e-14)return;const engine=boost?null:Rocket.plan(state.matter,d),wind=boost?{...windPlan(),baseCovered:0,elapsed:0}:null;
 state.flight={from,target:target.id,fromId:state.current,distance:d,covered:0,coastRate:0,maxBeta:wind?wind.beta:engine.beta,engine,wind,magnetic:null,boost,missed:false,autoStopping:false};
 state.beta=0;state.acceleration=boost?Stellar.force(wind.area,wind.startR,0)/wind.massKg:Rocket.acceleration(Rocket.dryMass+state.matter);state.phase=boost?'launch':'thrust';paused=false;
 if(boost){const current=object(state.current);state.destroyed.push(current.id);effects.push({x:from.x,y:from.y,age:0});log('Звёздный взрыв: '+current.name+'. Парус '+SAILS[state.sail].name+'. Прогноз свободного разгона '+percentC(wind.beta)+'.');toast('Парус раскрыт. Разгон потоком взрыва.');}
 else log('Фотонный разгон. Курс: '+target.name+'. Начальная масса '+fmt(engine.m0,2)+' т; запас на разгон '+fmt(engine.budget,2)+' т.');
 state.current=null;fitRoute(target);renderUI();persist();
}
function cutEngine(manual=true){const f=state.flight;if(!f)return;if(manual)Route.abort();if(state.phase==='launch'){state.phase='cruise';state.acceleration=0;f.windFolded=true;coastSetup();if(manual)toast('Парус сложен. Скорость сохраняется.');}
 else if((state.phase==='thrust'||state.phase==='dock')&&f.engine){state.phase='cruise';state.acceleration=0;coastSetup();if(manual){log('Двигатель выключен. Скорость '+percentC(state.beta)+'.');toast('Тяга выключена. Неизрасходованное вещество сохранено.');}}
 renderUI();persist();
}
function beginDock(){
 const f=state.flight;if(!f)return;if(state.beta<=1e-12){state.beta=0;finishFlight(Math.abs(f.covered-f.distance)<=Math.max(1e-9,f.distance*1e-9));return;}
 f.engine=Rocket.retroPlan(state.matter,state.beta);if(!f.engine.canStop){toast('Недостаточно вещества для точной остановки. Продолжаем захват.');state.phase='brake';f.magnetic=Magnetic.plan((Rocket.dryMass+state.matter)*1000,state.beta);return;}
 state.phase='dock';state.acceleration=-Rocket.acceleration(Rocket.dryMass+state.matter);
}
function beginBrake(auto=false){
 const f=state.flight;if(!f||state.beta<=0)return;f.windFolded=true;f.autoStopping=auto;f.magnetic=Magnetic.plan((Rocket.dryMass+state.matter)*1000,state.beta);
 f.magnetic.lastDistance=0;f.magnetic.lastEarth=0;f.magnetic.lastProper=0;f.magnetic.lastHeat=0;
 if(f.magnetic.distance===0)beginDock();else{state.phase='brake';state.acceleration=Magnetic.rates((Rocket.dryMass+state.matter)*1000,state.beta).properAcceleration;}
}
function toggleBrake(){if(!state.flight||state.beta<=0)return;Route.abort();if(state.phase==='brake'){state.phase='cruise';state.acceleration=0;coastSetup();}else{beginBrake(false);log('Магнитная ловушка раскрыта. Торможение передачей импульса частиц и сбор вещества.');}renderUI();}
function advance(ds,earth,proper){
 const f=state.flight;f.covered+=ds;state.totalDistance+=ds;state.earth+=earth;state.proper+=proper;const p=f.covered/f.distance,target=f.aim||object(f.target);state.ship=Space.mix(f.from,target,p);
 if(f.covered>f.distance+Math.max(1e-10,f.distance*1e-10)&&!f.missed&&state.beta>1e-8){f.missed=true;toast('Цель пройдена. Физический тормозной путь ещё не исчерпан.');}
}
function finishFlight(arrived){const f=state.flight,target=object(f.target);
 if(arrived){state.ship=Space.point(target.p3);state.current=target.id;if(!state.visited.includes(target.id))state.visited.push(target.id);log('Прибытие: '+target.name+'. Борт: '+compact(state.proper)+' лет; Земля: '+compact(state.earth)+' лет.');toast('Прибытие: '+target.name+'. Выберите следующую цель.');}
 else{state.current=null;log('Остановка вне цели. До неё '+distanceText(distance(state.ship,target))+'.');toast('Корабль остановлен. До цели '+distanceText(distance(state.ship,target))+'.');}
 state.beta=0;state.acceleration=0;state.phase='idle';state.flight=null;renderUI();renderCatalog();persist();if(arrived)Route.afterStop(f);
}
function autoFraction(predict){
 const f=state.flight;if(!Route.braking())return 1;const remaining=f.distance-f.covered;
 const gap=p=>{const v=predict(p);return remaining-v.distance-Magnetic.stopping(v.fuel,v.beta).distance;};
 if(gap(1)>=0)return 1;let lo=0,hi=1;for(let i=0;i<38;i++){const mid=(lo+hi)/2;if(gap(mid)>=0)lo=mid;else hi=mid;}return (lo+hi)/2;
}
function tickPhysics(dt){
 const f=state.flight;if(!f||dt<=0)return;
 if(state.phase==='flyby'){Route.tick(dt);return;}
 if(Route.braking()&&['thrust','launch','cruise'].includes(state.phase)&&state.beta>0){const stop=Magnetic.stopping(state.matter,state.beta).distance;if(f.distance-f.covered<=stop+Math.max(1e-12,stop*1e-10)){beginBrake(true);return;}}
 if(state.phase==='thrust'||state.phase==='dock'){
  const e=f.engine;if(!e){state.phase='cruise';coastSetup();return;}const before=Rocket.dryMass+state.matter;
  const dm=Math.min(e.budget-e.burned,Rocket.massFlow()*e.properRate*dt,state.matter),retro=e.direction<0;
  const prediction=p=>{const after=Math.max(e.mf,before-dm*p),leg=retro?Rocket.retroSegment(e.m0,e.eta0,before,after):Rocket.segment(e.m0,before,after);return{...leg,fuel:after-Rocket.dryMass};};
  const fraction=retro?1:autoFraction(prediction),step=prediction(fraction),used=before-(Rocket.dryMass+step.fuel);
  state.matter=Math.max(0,step.fuel);e.burned+=used;e.energy+=step.energy;state.spentEnergy+=step.energy;state.beta=step.beta;state.acceleration=(retro?-1:1)*Rocket.acceleration(Rocket.dryMass+state.matter);advance(step.distance,step.earth,step.proper);
  if(!retro&&fraction<1-1e-10){beginBrake(true);return;}
  if(e.budget-e.burned<=Math.max(1e-10,e.budget*1e-10)){
   if(retro){state.beta=0;finishFlight(Math.abs(f.covered-f.distance)<=Math.max(1e-9,f.distance*1e-9));}
   else cutEngine(false);
  }return;
 }
 if(state.phase==='launch'&&f.wind){
  const w=f.wind,old=Stellar.sample(w,w.elapsed/w.duration),remainingTime=Math.min(dt,w.duration-w.elapsed);
  const predict=p=>{const now=Stellar.sample(w,(w.elapsed+remainingTime*p)/w.duration);return{...now,distance:now.distance-old.distance,fuel:state.matter};};
  const fraction=autoFraction(predict);w.elapsed+=remainingTime*fraction;const now=Stellar.sample(w,w.elapsed/w.duration);
  state.beta=now.beta;state.acceleration=now.force/w.massKg;advance(now.distance-old.distance,now.earth-old.earth,now.proper-old.proper);
  if(fraction<1-1e-10){beginBrake(true);return;}if(w.elapsed>=w.duration-1e-10)cutEngine(false);return;
 }
 if(state.phase==='cruise'){
  if(!f.coastRate)coastSetup();let years=f.coastRate*dt;const remaining=f.distance-f.covered;
  if(Route.isFlyby()){const encounter=Route.prepare();if(encounter){const toGate=Math.max(0,remaining-Route.gate()),reach=toGate/state.beta;if(years>=reach){years=reach;advance(state.beta*years,years,years*Math.sqrt(1-state.beta**2));Route.enter();return;}}}
  if(Route.braking()){const stop=Magnetic.stopping(state.matter,state.beta).distance,coast=Math.max(0,remaining-stop)/state.beta;if(years>=coast){years=coast;advance(state.beta*years,years,years*Math.sqrt(1-state.beta**2));state.acceleration=0;beginBrake(true);return;}}
  advance(state.beta*years,years,years*Math.sqrt(1-state.beta**2));state.acceleration=0;return;
 }
 if(state.phase==='brake'){
  if(!f.magnetic){beginBrake(f.autoStopping);return;}const m=f.magnetic;m.elapsed=Math.min(m.duration,m.elapsed+dt);const now=Magnetic.sample(m,m.elapsed/m.duration),massBefore=(Rocket.dryMass+state.matter)*1000,dm=Math.max(0,now.mass-massBefore);
  state.matter+=dm/1000;state.captured+=dm/1000;state.heatRadiated+=Math.max(0,now.heat-(m.lastHeat||0));state.beta=now.beta;state.acceleration=now.properAcceleration;
  advance(now.distance-(m.lastDistance||0),now.earth-(m.lastEarth||0),now.proper-(m.lastProper||0));m.lastDistance=now.distance;m.lastEarth=now.earth;m.lastProper=now.proper;m.lastHeat=now.heat;
  if(m.elapsed>=m.duration-1e-10)beginDock();return;
 }
}

function renderCatalog(){const term=$('search').value.trim().toLocaleLowerCase('ru');const items=OBJECTS.filter(o=>(filter==='all'||filter==='star'&&['star','home','pulsar','blackhole','nebula'].includes(o.kind)||filter==='galaxy'&&o.kind==='galaxy'||filter==='structure'&&['cluster','structure','wall','void','quasar','ring','arc','horizon'].includes(o.kind))&&(`${o.name} ${o.type} ${o.id} ${o.hip||''} ${o.hd||''} ${o.gliese||''}`).toLocaleLowerCase('ru').includes(term)).sort((a,b)=>a.d-b.d);
 $('catalogCount').textContent=items.length+' / '+OBJECTS.length;
 $('catalogList').replaceChildren();if(!items.length){const e=document.createElement('p');e.className='empty-state';e.textContent='Объекты не найдены.';$('catalogList').append(e);}
 items.forEach(o=>{const b=document.createElement('button');b.className='catalog-item';b.innerHTML='<span>'+String(o.index+1).padStart(2,'0')+'</span><span><strong>'+o.name+'</strong><small>'+distanceText(o.d)+(o.navigable?'':' · СХЕМА')+(state.visited.includes(o.id)?' · ИССЛЕДОВАНО':'')+'</small></span><span>↗</span>';b.addEventListener('click',()=>{select(o.id,true);const picking=Route.picking;closeCatalog();if(picking){Route.add(o.id);Route.show();}});$('catalogList').append(b);});
}
function closeMenu(){$('menu').hidden=true;$('menuBtn').setAttribute('aria-expanded','false');}
function openCatalog(){closeMenu();$('catalog').hidden=false;renderCatalog();$('search').focus();}
function closeCatalog(){$('catalog').hidden=true;Route.picking=false;}
function showDialog(html){closeMenu();$('dialogContent').innerHTML=html;$('infoDialog').showModal();}
function showHelp(){showDialog('<div class="modal-eyebrow">ПАРУС / ПОЛЁТ</div><h2>Поймать поток.<br>Рассчитать остановку.</h2><ol><li><b>Собственная тяга.</b> Фотонный двигатель постепенно расходует до 10% запаса. Масса уменьшается, ускорение растёт. Можно выключить двигатель раньше.</li><li><b>Звёздный парус.</b> После прибытия выберите следующую цель и площадь паруса. Показанная скорость — расчёт свободного разгона, а не заданный предел. Сила падает как 1/r² и дополнительно ослабевает из-за удаления от догоняющего потока. Корабль разгоняется постепенно.</li><li><b>Магнитный захват.</b> Поток встречных частиц пропорционален скорости, их импульс тоже растёт со скоростью. Ловушка тормозит и увеличивает массу корабля. Автопилот учитывает полный тормозной путь.</li><li><b>Точная остановка.</b> При малой скорости магнитное торможение ослабевает. Последнюю скорость гасит фотонный двигатель обратной тягой, расходуя вещество. Позднее включение захвата может привести к пролёту цели.</li></ol><p>Скорость и собственное ускорение показаны рядом внизу. Колесо меняет масштаб, перетаскивание двигает карту. Пробел — пауза; кнопка 1× меняет темп анимации. Физические часы считают годы отдельно от ускоренной анимации. Прогресс сохраняется в браузере.</p><button class="modal-start" id="startExploring">Продолжить →</button>');$('startExploring').onclick=()=>$('infoDialog').close();}
function showModel(){showDialog('<div class="modal-eyebrow">ФИЗИКА / МОДЕЛЬ</div><h2>Сила. Импульс.<br>Меняющаяся масса.</h2><p>v — скорость относительно неподвижной плазмы и Солнца; β = v/c; γ = 1/√(1 − β²). Сухая масса — 1 т, полная M = 1 т + рабочее вещество. В панели показано собственное ускорение a₀ в g (1 g = 9,80665 м/с²), ощущаемое на борту; координатное ускорение равно a₀/γ³.</p><h3>Собственная тяга</h3><div class="formula">P = 3 ПВт<br>dm/dτ = −P/c²<br>η = η₀ ± ln(M₀/M)<br>v = c · tanh η<br>a₀ = ±P/(Mc)</div><p>Вещество полностью превращается в направленное излучение. При разгоне берётся плюс, при обратной тяге — минус. Путь, скорость, расход и оба времени вычисляются совместно. Автопилот выделяет до 10% запаса на разгон; тормозной манёвр имеет отдельный расчётный расход.</p><h3>Поток взрыва и парус</h3><div class="formula">I(r) = L/(4πr²)<br>F₀(r,v) = 2AI(r)/c · (1−β)/(1+β)<br>a₀ = F₀/M<br>dv/dt = F₀/(Mγ³)</div><p>A — площадь отражающего паруса. При одинаковой скорости удвоение r уменьшает силу в четыре раза. Множитель (1−β)/(1+β) учитывает уменьшение потока и импульса при удалении от источника. Используется приближение идеального отражения излучения или ультрарелятивистского ветра с u ≈ c; это заданная модель энергии фантастического взрыва.</p><p>L = 1,2·10³⁵ Вт, начало разгона r₀ = 1 а.е. Импульс источника длится 30 суток; его окончание определяется запаздывающим временем t − (r−r₀)/c. Парус автоматически складывается также при r = 100 000 а.е., когда основная часть импульса уже получена. Координата на карте обозначает систему, а r₀ задаёт близкую стартовую орбиту. Характеристики потока одинаковы для звёзд в этой версии.</p><h3>Вывод магнитного торможения</h3><p>Плотность неподвижных ионов n, масса иона mₚ, ρ = nmₚ, эффективная площадь ловушки Aₘ. За секунду в системе плазмы встречается nAₘv частиц. В системе корабля их поток увеличен в γ раз, а импульс одной частицы равен γmₚv.</p><div class="formula">dN/dτ = γnAₘv<br>p<sub>частицы</sub> = γmₚv<br>F₀ = −ρAₘγ²v²<br>a₀ = −ρAₘγ²v²/M<br>dv/dt = −ρAₘv²/(Mγ)<br>dM/dt = ρAₘv</div><p>Здесь частицы полностью захватываются и остаются на борту. Их кинетическая энергия отводится изотропно в мгновенной системе корабля: Q̇₀ = γ(γ−1)ρAₘvc². Это явное допущение идеального охлаждения. Накопленное вещество учитывается в массе и пригодно для двигателя; оно не уничтожается при захвате.</p><p>Параметры однородной модельной плазмы: n = 0,1 см⁻³, mₚ = 1,6726·10⁻²⁷ кг, Aₘ = 10¹⁵ м². Aₘ обозначает область действия поля; она задаётся отдельно от материального паруса и в этой версии постоянна. Реальная площадь захвата зависит от поля, скорости и состава среды.</p><h3>Тормозной путь и доводка</h3><p>Для этой модели захвата сохраняется M·tanh(η/2). При малой скорости |a| ≈ ρAₘv²/M, поэтому магнитный захват сам по себе не достигает строго нулевой скорости за конечное время. Автопилот рассчитывает путь до 1% c и затем обратную фотонную тягу до нуля. Если вещества недостаточно, захват продолжается до нужного запаса. Масса собранного вещества, тормозной путь, тепло, расход доводки и времена вычисляются из этих уравнений. Слишком поздний захват приводит к остановке за целью.</p><h3>Часы и область применимости</h3><div class="formula">dτ = dt · √(1−v²/c²)</div><p>Физические времена интегрируются по траектории. Анимация сжимает время неодинаково на разгоне, инерционном полёте и остановке. Карта — проекция Galactic X/Y; длины и углы считаются в 3D. Локальные пролёты используют геодезические Шварцшильда. Расширение Вселенной, взаимодействие нескольких полей, эволюция объектов, прочность паруса и реальное оборудование ловушки не моделируются. Плотность плазмы здесь одинакова на всей карте.</p><p><a href="https://www.cambridge.org/core/journals/high-power-laser-science-and-engineering/article/theory-of-light-sail-acceleration-by-intense-lasers-an-overview/6DB5603675B01779B1B8345873FD33C5" target="_blank" rel="noopener">Релятивистская сила на парусе</a> · <a href="https://arxiv.org/abs/1707.02801" target="_blank" rel="noopener">Магнитные паруса и эффективная площадь</a> · <a href="https://kirkmcd.princeton.edu/examples/ph205set4.pdf" target="_blank" rel="noopener">Релятивистское ракетное уравнение</a></p>');}

function showObject(){
 const o=object(state.flight?state.flight.target:state.selected),f=o.facts,g=o.galaxy;
 const row=(label,value)=>'<div class="fact-row"><dt>'+label+'</dt><dd>'+value+'</dd></div>';
 let luminosity=f.lum!==undefined?'≈ '+quantity(f.lum)+' L☉<small>Болометрическая мощность: ≈ '+quantity(f.lum*Astro.solarLuminosity)+' Вт</small>':f.visual?'≈ '+quantity(f.visual.solarV)+' L☉,'+(f.band||'V')+'<small>Собственная светимость в полосе '+(f.band||'V')+'; абсолютная величина M'+(f.band||'V')+' ≈ '+fmt(f.visual.absoluteV,1)+' mag</small>':f.lumUnknown;
 const sizeButton=(g||o.id==='sgr')?'<button class="map-size-action" id="viewGalaxy">Показать галактику в масштабе <span>↗</span></button>':'';
 let html='<div class="modal-eyebrow">АТЛАС / '+String(o.index+1).padStart(3,'0')+'</div><h2>'+o.name+'</h2><p>'+o.desc+'</p>'+sizeButton+'<dl class="object-facts">'+row('Класс',f.class)+row('Масса',f.mass)+row('Светимость',luminosity);
 if(g)html+=row('Оптический размер',distanceText(g.diameterLy)+' × '+distanceText(g.diameterLy*g.axisRatio)+'<small>Большая × малая ось проекции; размеры контура в масштабе карты</small>');
 else if(f.radius)html+=row('Размер',f.radius);
 if(f.extra)html+=row(...f.extra);
 if(o.p3){html+=row('Глубина Zg',distanceText(o.p3[2])+'<small>Координата вне плоскости карты, относительно Солнца</small>');if(o.raDeg!==undefined)html+=row('Направление J2000',fmt(o.raDeg,4)+'° / '+fmt(o.decDeg,4)+'°<small>Прямое восхождение / склонение</small>');}
 if(o.gravity)html+=row('Модель пролёта',o.gravity.note);
 if(o.coordinateNote)html+=row('Координаты',o.coordinateNote);
 html+=row('От Солнца',distanceText(o.d))+'</dl>';
 html+='<p class="object-note">Оценки округлены. M☉ — масса Солнца; L☉ — его полная светимость, L☉,V и L☉,B — светимость Солнца в соответствующей полосе. Это собственное излучение, а не видимая яркость с Земли.</p>';
 if(f.visual)html+='<p class="object-note">Полосовая светимость рассчитана из каталожной фотометрии и расстояния атласа: M = m − 5 log₁₀(d/10 пк), L/L☉ = 10⁰·⁴⁽ᴹ☉⁻ᴹ⁾. Без поправки на поглощение пылью; это приблизительная оценка, не полная болометрическая мощность.</p>';
 if(f.note)html+='<p class="object-note">'+f.note+'</p>';
 html+='<p class="object-sources">'+f.refs.map(([url,label])=>'<a href="'+url+'" target="_blank" rel="noopener">'+label+' ↗</a>').join('')+'</p>';
 showDialog(html);if(g||o.id==='sgr')$('viewGalaxy').onclick=()=>{const shape=g||GALAXIES[0];$('infoDialog').close();focusGalaxy(shape);};
}
function focusGalaxy(g){const span=g.diameterLy*Math.max(2.5,width/Math.max(height*.58,1));goCamera(g.x,g.y,span);toast('Оптический контур · '+distanceText(g.diameterLy)+' · в масштабе карты');}
function showJournal(){showDialog('<div class="modal-eyebrow">КОВЧЕГ — 01 / ЖУРНАЛ</div><h2>След экспедиции.</h2><p>Исследовано '+state.visited.length+' из '+(OBJECTS.length-1)+' точек · пройдено '+distanceText(state.totalDistance)+' · собрано '+fmt(state.captured,1)+' т · аннигилировано на '+compact(state.spentEnergy/1e15)+' ПДж; отведено тепла '+compact(state.heatRadiated/1e15)+' ПДж.</p>'+[...state.journal].reverse().map(e=>'<div class="journal-entry"><time>'+compact(e.t)+' лет</time><p>'+e.text+'</p></div>').join(''));}
/* Monochrome, resolution-independent engineering chart. */
function line(x1,y1,x2,y2,color='#cecece',lw=1,dash=[]){ctx.beginPath();ctx.setLineDash(dash);ctx.strokeStyle=paint(color);ctx.lineWidth=lw;ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);}
function circle(x,y,r,color='#cccccc',lw=1,dash=[]){if(r<0||r>1e6)return;ctx.beginPath();ctx.setLineDash(dash);ctx.strokeStyle=paint(color);ctx.lineWidth=lw;ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
function text(s,x,y,size=9,color='#808080',align='left',font='mono'){ctx.fillStyle=paint(color);ctx.font=`${size}px ${font==='mono'?'"IBM Plex Mono",monospace':'"Golos Text",Arial,sans-serif'}`;ctx.textAlign=align;ctx.fillText(s,x,y);}
function nice(n){const pow=10**Math.floor(Math.log10(n)),a=n/pow;return(a<1.5?1:a<3.5?2:a<7.5?5:10)*pow;}
function drawGrid(){const unit=nice(cam.span/7),pixels=unit*width/cam.span;const origin=screen({x:0,y:0}),minor=pixels/5;
 ctx.fillStyle=paint('#f8f8f8');ctx.fillRect(0,0,width,height);
 ctx.beginPath();ctx.strokeStyle=paint('#e8e8e8');ctx.lineWidth=.5;
 for(let x=((origin.x%minor)+minor)%minor;x<width;x+=minor){ctx.moveTo(x,0);ctx.lineTo(x,height);}
 for(let y=((origin.y%minor)+minor)%minor;y<height;y+=minor){ctx.moveTo(0,y);ctx.lineTo(width,y);}ctx.stroke();
 ctx.beginPath();ctx.strokeStyle=paint('#dddddd');ctx.lineWidth=.6;
 for(let x=((origin.x%pixels)+pixels)%pixels;x<width;x+=pixels){ctx.moveTo(x,0);ctx.lineTo(x,height);}
 for(let y=((origin.y%pixels)+pixels)%pixels;y<height;y+=pixels){ctx.moveTo(0,y);ctx.lineTo(width,y);}ctx.stroke();
 if(origin.x>-20&&origin.x<width+20)line(origin.x,0,origin.x,height,'#c9c9c9',.7,[3,7]);
 if(origin.y>-20&&origin.y<height+20)line(0,origin.y,width,origin.y,'#c9c9c9',.7,[3,7]);
 for(let i=0;i<bgPoints.length;i++){const p=bgPoints[i],x=p.x*width,y=p.y*height;if(i%4===0){line(x-2,y,x+2,y,'#bbbbbb',.65);line(x,y-2,x,y+2,'#bbbbbb',.65);}else{ctx.fillStyle=paint('#cdcdcd');ctx.fillRect(x,y,.8,.8);}}
 if(width>500&&cam.span<200&&cam.span>.15){for(let r=unit;r<cam.span*1.1;r+=unit){let rp=r*width/cam.span;if(rp<12)continue;circle(origin.x,origin.y,rp,'#d1d1d1',.5,[2,5]);if(rp<Math.min(width,height)*.8)text(compact(r)+' св. л.',origin.x+rp*.707+5,origin.y-rp*.707-5,7,'#9f9f9f');}}
 $('scaleValue').textContent=distanceText(nice(110*cam.span/width));
}
function galaxyProjection(g){const center=screen(g);return{center,r:g.diameterLy*.5*width/cam.span};}
function drawGalaxyBackground(){
 for(const g of GALAXIES){const {center,r}=galaxyProjection(g);if(r<5||r>12000||center.x+r<0||center.x-r>width||center.y+r<0||center.y-r>height)continue;
  const selected=g.id===state.selected||(g.id==='milkyway'&&state.selected==='sgr');
  ctx.save();ctx.translate(center.x,center.y);ctx.rotate(g.rotation);ctx.scale(1,g.axisRatio);
  circle(0,0,r,selected?'#969696':'#b9b9b9',.75,[3,5]);
  if(g.shape==='spiral'){
   circle(0,0,r*.17,'#c3c3c3',.6);circle(0,0,r*.06,'#bababa',.65);
   for(let arm=0;arm<(g.id==='milkyway'?4:2);arm++){ctx.beginPath();ctx.strokeStyle=paint(selected?'#969696':'#b6b6b6');ctx.lineWidth=.85;
    for(let i=0;i<=200;i++){const t=i/200,rr=r*(.10+t*.90),a=t*5+arm*Math.PI*(g.id==='milkyway'?.5:1),x=Math.cos(a)*rr,y=Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
   }
  }else if(g.shape==='elliptical'){for(const f of [.10,.22,.40,.65,.84])circle(0,0,r*f,'#bcbcbc',.6);if(g.id==='centaurus'){line(-r*.8,-r*.08,r*.8,-r*.08,'#8d8d8d',1);line(-r*.8,r*.04,r*.8,r*.04,'#8d8d8d',1);}}
  else{for(let ring=0;ring<3;ring++){ctx.beginPath();ctx.strokeStyle=paint('#b3b3b3');ctx.lineWidth=.7;for(let i=0;i<=120;i++){const a=i/120*Math.PI*2,rr=r*(.35+ring*.2)*(1+.13*Math.sin(a*3+ring)+.09*Math.cos(a*5)),x=Math.cos(a)*rr,y=Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.stroke();}line(-r*.45,0,r*.35,0,'#9c9c9c',2);}
  ctx.restore();
  if(r>35&&r<Math.max(width,height)*1.5){const yy=center.y+Math.min(r*.65,height*.35);text(g.name.toUpperCase(),center.x,yy,8,'#8b8b8b','center');text('ОПТИЧЕСКИЙ КОНТУР · '+distanceText(g.diameterLy),center.x,yy+14,6,'#9b9b9b','center');}
 }
}
function drawCosmicWeb(){if(cam.span<1e8)return;const a=screen({x:0,y:0}),mult=clamp(3e9/cam.span,.2,8),points=bgPoints.slice(0,40).map(p=>({x:a.x+(p.x-.5)*width*1.8*mult,y:a.y+(p.y-.5)*height*1.8*mult}));for(let i=0;i<points.length;i++){const p=points[i];const closest=points.map((q,j)=>({q,j,d:Math.hypot(p.x-q.x,p.y-q.y)})).filter(o=>o.j>i).sort((a,b)=>a.d-b.d).slice(0,2);for(const n of closest)if(n.d<width*.27)line(p.x,p.y,n.q.x,n.q.y,'#dbdbdb',.7,[1,3]);circle(p.x,p.y,2,'#c5c5c5',.7);}if(cam.span>4e10){const r=465e8*width/cam.span;circle(a.x,a.y,r,'#a7a7a7',.8,[7,5]);}}
function drawSymbol(o,p,selected=false){const destroyed=state.destroyed.includes(o.id)&&o.kind==='star';const ink=selected?'#252525':'#646464';ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle=paint(ink);ctx.lineWidth=.9;
 if(destroyed){circle(0,0,9,ink,.7,[2,3]);line(-5,-5,5,5,ink,.8);line(-5,5,5,-5,ink,.8);}
 else if(o.kind==='home'){circle(0,0,14,ink,.8);circle(0,0,8,ink,1);ctx.fillStyle=paint(ink);ctx.beginPath();ctx.arc(0,0,2,0,Math.PI*2);ctx.fill();for(let i=0;i<8;i++){const a=i*Math.PI/4;line(Math.cos(a)*18,Math.sin(a)*18,Math.cos(a)*22,Math.sin(a)*22,ink,.7);}}
 else if(o.kind==='star'){const r=o.id==='sirius'?6:4;circle(0,0,r,ink,.8);ctx.fillStyle=paint(ink);ctx.beginPath();ctx.arc(0,0,1.5,0,Math.PI*2);ctx.fill();line(-r-5,0,-r-2,0,ink,.7);line(r+2,0,r+5,0,ink,.7);line(0,-r-5,0,-r-2,ink,.7);line(0,r+2,0,r+5,ink,.7);}
 else if(o.kind==='galaxy'&&o.galaxy&&galaxyProjection(o.galaxy).r>=5){line(-3,0,3,0,ink,.8);line(0,-3,0,3,ink,.8);}
 else if(o.kind==='galaxy'){ctx.rotate(-.5);for(let a=0;a<3;a++){ctx.beginPath();ctx.ellipse(0,0,7+a*4,3+a*1.5,0,0,Math.PI*2);ctx.stroke();}ctx.fillStyle=paint(ink);ctx.fillRect(-1,-1,2,2);}
 else if(o.kind==='pulsar'||o.kind==='quasar'){circle(0,0,5,ink);circle(0,0,10,ink,.5);line(-5,18,5,-18,ink,.9);line(-8,18,0,18,ink,.7);line(0,-18,8,-18,ink,.7);}
 else if(o.kind==='blackhole'){circle(0,0,8,ink,.8);ctx.fillStyle=paint(ink);ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(0,0,17,4,-.3,0,Math.PI*2);ctx.stroke();}
 else if(o.kind==='void'||o.kind==='ring'||o.kind==='horizon'){const r=o.kind==='void'?23:o.kind==='ring'?21:13;circle(0,0,r,ink,.8,o.kind==='void'?[2,4]:[]);if(o.kind==='ring'){circle(0,0,r+4,ink,.4,[1,5]);for(let i=0;i<12;i++){const a=i*.54;ctx.fillStyle=paint(ink);ctx.fillRect(Math.cos(a)*r-1,Math.sin(a)*r-1,2,2);}}else{line(-r-5,0,r+5,0,ink,.5,[2,4]);line(0,-r-5,0,r+5,ink,.5,[2,4]);}}
 else if(o.kind==='wall'||o.kind==='arc'){ctx.beginPath();for(let i=0;i<12;i++){const x=(i-5.5)*5,y=Math.sin(i*.5)*9;i?ctx.lineTo(x,y):ctx.moveTo(x,y);ctx.fillStyle=paint(ink);ctx.fillRect(x-1.2,y-1.2,2.4,2.4);}ctx.stroke();}
 else{for(let i=0;i<11;i++){const a=i*2.4,r=4+Math.sqrt(i)*3;circle(Math.cos(a)*r,Math.sin(a)*r,1.4,ink,.7);}circle(0,0,18,ink,.4,[2,4]);}
 if(selected){for(let a=0;a<4;a++){ctx.save();ctx.rotate(a*Math.PI/2);ctx.beginPath();ctx.moveTo(21,-16);ctx.lineTo(21,-21);ctx.lineTo(16,-21);ctx.stroke();ctx.restore();}}
 ctx.restore();}
function drawObjects(){hitObjects=[];const departure=state.flight?.fromId||state.current;const occupied=[],labelRects=[{x:0,y:0,w:Math.min(width-40,420),h:120},{x:0,y:height-35,w:width,h:35},{x:width-340,y:height-260,w:340,h:260}],visible=OBJECTS.filter(o=>o.kind!=='horizon'||cam.span>3e10).map(o=>({o,p:screen(o)})).filter(({p})=>p.x>-90&&p.x<width+90&&p.y>-50&&p.y<height+50).sort((a,b)=>(b.o.id===state.selected?4:b.o.id===departure?3:b.o.id==='sol'?2:0)-(a.o.id===state.selected?4:a.o.id===departure?3:a.o.id==='sol'?2:0)||b.o.d-a.o.d);
 for(const{o,p}of visible){const special=o.id===state.selected||o.id==='sol'||o.id===departure;if(!special&&occupied.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<27))continue;occupied.push(p);drawSymbol(o,p,o.id===state.selected);hitObjects.push({o,p});const selected=o.id===state.selected;let dx=selected?31:16,dy=selected?-29:-12;
 if(p.x>width-160){dx=-16;ctx.textAlign='right';}const align=dx<0?'right':'left';
 if(selected){line(p.x+Math.sign(dx)*19,p.y-17,p.x+dx,p.y+dy-3,'#767676',.7);line(p.x+dx,p.y+dy-3,p.x+dx+Math.sign(dx)*85,p.y+dy-3,'#767676',.7);text('ЦЕЛЬ / '+String(o.index+1).padStart(3,'0'),p.x+dx,p.y+dy-11,7,'#8a8a8a',align);}
 const name=o.id==='sol'?'СОЛНЦЕ / ЗЕМЛЯ':o.name+(o.navigable?'':' · схема');
 const fs=selected?12:o.id==='sol'?10:width<500?9:11;
 ctx.font=fs+'px \"Golos Text\",Arial,sans-serif';const tw=ctx.measureText(name).width;
 const box={x:align==='right'?p.x+dx-tw:p.x+dx,y:p.y+dy-2,w:tw+7,h:31};
 const overlaps=labelRects.some(r=>box.x<r.x+r.w&&box.x+box.w>r.x&&box.y<r.y+r.h&&box.y+box.h>r.y);
 if(special||(!overlaps&&box.x>3&&box.x+box.w<width-4)){text(name,p.x+dx,p.y+dy+10,fs,selected?'#252525':'#676767',align,'sans');text(o.id==='sol'?'НАЧАЛО КООРДИНАТ':distanceText(o.d),p.x+dx,p.y+dy+23,7,'#9a9a9a',align);labelRects.push(box);}
 if(state.visited.includes(o.id)&&o.id!=='sol')text('✓',p.x-17,p.y+19,9,'#565656');
 }
 /* At planetary zoom, Earth is separated from Sol at one astronomical unit. */
 if(cam.span<.001){const earth=screen({x:.00001581,y:0});circle(earth.x,earth.y,4,'#252525');text('ЗЕМЛЯ / 1 а.е.',earth.x+12,earth.y-8,9,'#434343');const sun=screen({x:0,y:0});circle(sun.x,sun.y,.00001581*width/cam.span,'#c3c3c3',.7,[3,5]);}
}
function drawRoute(){const f=state.flight,target=object(f?f.target:state.selected);if(!target||target.id===state.current||!target.navigable)return;const a=screen(f?f.from:state.ship),b=screen(target),dist=Math.hypot(b.x-a.x,b.y-a.y);if(dist<2)return;
 line(a.x,a.y,b.x,b.y,'#767676',.8,[5,6]);const angle=Math.atan2(b.y-a.y,b.x-a.x),m={x:a.x+(b.x-a.x)*.46,y:a.y+(b.y-a.y)*.46};
 ctx.save();ctx.translate(m.x,m.y);ctx.rotate(angle);ctx.fillStyle=paint('#f6f6f6');ctx.fillRect(-6,-7,12,14);ctx.beginPath();ctx.strokeStyle=paint('#707070');ctx.lineWidth=.8;ctx.moveTo(-5,-4);ctx.lineTo(0,0);ctx.lineTo(-5,4);ctx.moveTo(2,-4);ctx.lineTo(7,0);ctx.lineTo(2,4);ctx.stroke();ctx.restore();
 if(dist>140){text(f?'ТРАЕКТОРИЯ ПОЛЁТА':'ПЛАНИРУЕМЫЙ КУРС',m.x+12,m.y+19,7,'#848484');}
 if(f){const from=screen(f.from),d=f.distance;const stop=Magnetic.stopping(state.matter,state.beta).distance;const q=Math.max(0,1-stop/d);const bp={x:from.x+(b.x-from.x)*q,y:from.y+(b.y-from.y)*q};if(stop>0&&dist>140){circle(bp.x,bp.y,5,'#7c7c7c',.7);line(bp.x-4,bp.y+11,bp.x+4,bp.y+11,'#7c7c7c',.7);text('ТОЧКА ТОРМОЖЕНИЯ',bp.x+10,bp.y+29,6,'#989898');}}
}
function sailGeometry(radius,braking=false){const side=braking?-1:1;return{side,radius,rim:30*side,belly:54*side,tether:side*4};}
function drawShip(time){const p=screen(state.ship),f=state.flight,target=f?object(f.target):object(state.selected);const angle=f?Math.atan2(target.y-f.from.y,target.x-f.from.x):target?Math.atan2(target.y-state.ship.y,target.x-state.ship.x):-.5;
 const physicalPoint={...p};
 if(!f){p.x-=22;p.y+=27;}else{const source=screen(f.from);if(Math.hypot(p.x-source.x,p.y-source.y)<42){p.x=source.x+Math.cos(angle)*42;p.y=source.y+Math.sin(angle)*42;line(physicalPoint.x,physicalPoint.y,p.x,p.y,'#999',.5,[1,3]);circle(physicalPoint.x,physicalPoint.y,1.5,'#888',.5);}}
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle+(state.phase==='dock'?Math.PI:0));ctx.lineWidth=.9;ctx.strokeStyle=paint('#252525');
 const braking=state.phase==='brake',sailOpen=!!f&&(state.phase==='launch'||braking);
 if(sailOpen){const g=sailGeometry([15,21,27][state.sail],braking);let opening=1;if(state.phase==='launch')opening=clamp(state.beta/f.maxBeta*3,.15,1);const r=g.radius*opening;
  ctx.beginPath();ctx.moveTo(g.rim,-r);ctx.quadraticCurveTo(g.belly,0,g.rim,r);ctx.stroke();
  line(g.tether,0,g.rim,-r,'#555',.75);line(g.tether,0,g.rim,r,'#555',.75);line(g.tether,0,(g.rim+g.belly)/2,0,'#777',.6);
  for(let i=1;i<4;i++){const y=r*(i/4);const x=g.rim+(g.belly-g.rim)*.45*(1-(y/r)**2);line(g.tether,0,x,y,'#aaa',.4);line(g.tether,0,x,-y,'#aaa',.4);}
 }
 ctx.beginPath();ctx.fillStyle=paint('#252525');ctx.moveTo(11,0);ctx.lineTo(-3,-4);ctx.lineTo(0,0);ctx.lineTo(-3,4);ctx.closePath();ctx.fill();
 if(state.phase==='thrust'||state.phase==='dock'){const len=13+Math.sin(time*.025)*3;line(-5,-2,-len,0,'#555',.8);line(-5,2,-len,0,'#555',.8);line(-8,0,-len-6,0,'#999',.6);}
 if(braking){for(let i=0;i<15;i++){const t=((time/1000+i/15)%1),x=65-t*105,y=(i%5-2)*10;ctx.fillStyle=paint('#888');ctx.fillRect(x,y,1.4,1.4);}ctx.beginPath();ctx.ellipse(-24,0,28,35,0,1.5,4.8);ctx.setLineDash([3,5]);ctx.strokeStyle=paint('#aaa');ctx.stroke();ctx.setLineDash([]);}
 ctx.restore();if(!f||Math.hypot(p.x-screen(target).x,p.y-screen(target).y)>65){line(p.x-6,p.y+8,p.x-16,p.y+22,'#757575',.6);text('КОВЧЕГ — 01',p.x-19,p.y+33,7,'#646464','right');}
}
function drawEffects(dt){effects=effects.filter(e=>e.age<8);for(const e of effects){e.age+=paused?0:dt*speed;const p=screen(e);for(let k=0;k<3;k++){const r=(e.age*48+k*24)%370;circle(p.x,p.y,r,`rgba(37,38,32,${Math.max(0,.38-r/980)})`,.7,k===1?[2,6]:[]);}for(let i=0;i<40;i++){const a=i*2.399,r=e.age*25+(i%5)*9;ctx.fillStyle=paint('#8b8b8b');ctx.fillRect(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,1,1);}}}
function drawHover(){if(!hover)return;const p=screen(hover);circle(p.x,p.y,27,'#969696',.6,[2,4]);}

let lastFrame=performance.now();function frame(now){const realDt=Math.min((now-lastFrame)/1000,.1);lastFrame=now;if(!document.hidden){if(cameraGoal){const a=1-Math.exp(-realDt*8);cam.x+=(cameraGoal.x-cam.x)*a;cam.y+=(cameraGoal.y-cam.y)*a;cam.span=Math.exp(Math.log(cam.span)+(Math.log(cameraGoal.span)-Math.log(cam.span))*a);if(Math.abs(Math.log(cam.span/cameraGoal.span))<.0005&&Math.hypot(cam.x-cameraGoal.x,cam.y-cameraGoal.y)<cam.span*.0001){cam={...cameraGoal};cameraGoal=null;}}if(!paused&&state.flight){let rest=realDt*speed;while(rest>0&&state.flight){const step=Math.min(rest,1/60);tickPhysics(step);rest-=step;}}drawGrid();drawGalaxyBackground();drawCosmicWeb();Route.draw();drawRoute();drawEffects(realDt);drawObjects();drawShip(now);Route.drawEncounter();drawHover();if(now-lastUI>100){renderUI();lastUI=now;}if(now-saveTick>1500){if(state.flight)persist();saveTick=now;}}requestAnimationFrame(frame);}

canvas.addEventListener('wheel',e=>{e.preventDefault();cameraGoal=null;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,before=world(x,y),factor=Math.exp(clamp(e.deltaY,-220,220)*.006);cam.span=clamp(cam.span*factor,.00006,1.4e11);const after=world(x,y);cam.x+=before.x-after.x;cam.y+=before.y-after.y;updateMapHeading();},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer={down:true,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,id:e.pointerId};canvas.setPointerCapture(e.pointerId);cameraGoal=null;});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(pointer.down&&e.pointerId===pointer.id){const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>5)pointer.moved=true;if(pointer.moved){cam.x-=dx*cam.span/width;cam.y-=dy*cam.span/width;canvas.style.cursor='grabbing';}pointer.x=e.clientX;pointer.y=e.clientY;}else{hover=hitObjects.find(({p})=>Math.hypot(x-p.x,y-p.y)<23)?.o||null;canvas.style.cursor=hover?'pointer':'crosshair';}});
canvas.addEventListener('pointerup',e=>{if(!pointer.down||e.pointerId!==pointer.id)return;if(!pointer.moved){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const hit=hitObjects.map(h=>({...h,d:Math.hypot(x-h.p.x,y-h.p.y)})).filter(h=>h.d<28).sort((a,b)=>a.d-b.d)[0];if(hit)select(hit.o.id);}pointer.down=false;canvas.style.cursor='crosshair';});
canvas.addEventListener('pointercancel',()=>{pointer.down=false;canvas.style.cursor='crosshair';});canvas.addEventListener('pointerleave',()=>hover=null);

$('zoomIn').onclick=()=>goCamera(cam.x,cam.y,cam.span/2);$('zoomOut').onclick=()=>goCamera(cam.x,cam.y,cam.span*2);$('shipBtn').onclick=()=>goCamera(state.ship.x,state.ship.y,state.flight?Math.max(state.flight.distance*1.5,20):24);
$('catalogBtn').onclick=()=>{if($('catalog').hidden)openCatalog();else closeCatalog();};$('closeCatalog').onclick=closeCatalog;$('search').oninput=renderCatalog;
$('themeBtn').onclick=()=>applyTheme(theme==='dark'?'light':'dark');
$('menuBtn').onclick=()=>{const open=$('menu').hidden;$('menu').hidden=!open;$('menuBtn').setAttribute('aria-expanded',String(open));};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.menu-popover,.menu-button'))closeMenu();});
$('catalogTabs').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderCatalog();});
document.querySelectorAll('[data-sail]').forEach(b=>b.onclick=()=>{if(state.flight||!canBoost())return;state.sail=+b.dataset.sail;renderUI();persist();});
$('speedBtn').onclick=()=>{const speeds=[1,5,20];speed=speeds[(speeds.indexOf(speed)+1)%speeds.length];renderUI();};
document.querySelectorAll('[data-scale]').forEach(b=>b.onclick=()=>{closeCatalog();goCamera(0,0,+b.dataset.scale);});
$('launchBtn').onclick=()=>{if(state.current===state.selected)openCatalog();else launch();};$('stopEngine').onclick=()=>cutEngine();$('brakeBtn').onclick=toggleBrake;$('autoBrake').onchange=e=>{state.auto=e.target.checked;persist();};$('pauseBtn').onclick=()=>{paused=!paused;renderUI();};$('helpBtn').onclick=showHelp;$('modelBtn').onclick=showModel;$('journalBtn').onclick=showJournal;$('objectInfo').onclick=showObject;$('closeDialog').onclick=()=>$('infoDialog').close();
$('infoDialog').addEventListener('click',e=>{if(e.target===$('infoDialog')){const r=$('infoDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('infoDialog').close();}});
$('resetBtn').onclick=()=>{showDialog('<div class="modal-eyebrow">НОВАЯ ЭКСПЕДИЦИЯ</div><h2>Снова от Солнца?</h2><p>Текущий прогресс в этом браузере будет сброшен.</p><button class="modal-start" id="confirmReset">Начать заново →</button>');$('confirmReset').onclick=()=>{state=initial();paused=false;speed=1;effects=[];goCamera(0,0,24);renderUI();persist();$('infoDialog').close();toast('Новая экспедиция. Солнечная система, нулевой год.');};};
window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea')||$('infoDialog').open)return;if(e.code==='Space'){e.preventDefault();paused=!paused;renderUI();}if(e.key==='Escape'){closeCatalog();closeMenu();}if(e.key==='+'||e.key==='=')goCamera(cam.x,cam.y,cam.span/2);if(e.key==='-')goCamera(cam.x,cam.y,cam.span*2);});
document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();persist();});window.addEventListener('pagehide',persist);
if(state.flight)fitRoute(object(state.flight.target));else if(state.current&&state.current!=='sol')goCamera(state.ship.x,state.ship.y,Math.max(object(state.current).d*2,24),true);
Route.setup();applyTheme(theme);resize();renderUI();updateMapHeading();renderCatalog();requestAnimationFrame(frame);
