 'use strict';
const $=id=>document.getElementById(id);
const fmt=(n,d=2)=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:d,minimumFractionDigits:d});
const compact=n=>n<0?'−'+compact(-n):n>=1e9?fmt(n/1e9,n>=1e10?1:2)+' млрд':n>=1e6?fmt(n/1e6,n>=1e7?1:2)+' млн':n>=1e3?fmt(n/1e3,1)+' тыс.':fmt(n,n<100?2:0);
const sailAreaText=m2=>{const n=m2/1e6;return n>=1e9?fmt(n/1e9,0)+' млрд км²':n>=1e6?fmt(n/1e6,0)+' млн км²':fmt(n,0)+' км²';};
const distanceText=n=>Number.isFinite(n)?compact(n)+' св. лет':'расстояние неизвестно';
const object=id=>OBJECTS.find(o=>o.id===id)||ExtendedCatalog.get(id);
const distance=(a,b)=>Space.distance(a,b);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const SPEED_TICKS=[0,.09,.99,.999,.9999,.99999,.999999,.9999999,.99999999,.999999999];
function speedScale(beta){
 beta=clamp(beta,0,SPEED_TICKS.at(-1));const x=-Math.log1p(-beta)/Math.LN10;
 for(let i=1;i<SPEED_TICKS.length;i++)if(beta<=SPEED_TICKS[i]){const a=-Math.log1p(-SPEED_TICKS[i-1])/Math.LN10,b=-Math.log1p(-SPEED_TICKS[i])/Math.LN10;return(i-1+(x-a)/(b-a))/(SPEED_TICKS.length-1);}
 return 1;
}
function clockRate(){
 if(!state.flight)return 1;
 const beta=clamp(state.beta,0,1-Number.EPSILON);
 if(state.phase==='flyby'&&state.flight?.encounter?.plan){const p=state.flight.encounter.plan,q=Gravity.atProper(p,p.elapsedProper||0),lapse=1-p.rp/(p.q*q.r);return clamp(lapse*Math.sqrt((1-p.beta)*(1+p.beta)),0,1);}
 return Math.sqrt((1-beta)*(1+beta));
}
function renderVelocity(){
 $('velocity').innerHTML=speedNumber(state.beta)+'<small>% c</small>';
 $('velocityFill').style.width=(speedScale(state.beta)*100)+'%';
 $('velocityBar').setAttribute('aria-valuenow',String(state.beta*100));$('velocityBar').setAttribute('aria-valuetext',percentC(state.beta));
}
function renderClockRatio(){
 const ratio=1/Math.max(Number.EPSILON,clockRate());
 $('timeDilation').textContent=ratio===1?'1 год на Земле':fmt(ratio,ratio<100?2:0)+' лет на Земле';
 $('timeDilationRow').title='Мгновенное соотношение при сохранении текущей скорости'+(state.phase==='flyby'?' и гравитационного потенциала':'')+'. Земля неподвижна в принятой системе отсчёта; направление полёта не меняет соотношение. Это не задержка радиосигнала.';
}
const STORE='parus-expedition-v1';
const G0=9.80665;
const speedDigits=beta=>beta>=.99999999?9:beta>=.9999?7:beta>=.99?4:2;
const speedNumber=beta=>{let [whole,fraction]=fmt(beta*100,speedDigits(beta)).split(',');if(fraction)fraction=fraction.replace(/0+$/,'').padEnd(2,'0');return whole+(fraction?','+fraction.match(/.{1,3}/g).join('.'):'');};
const percentC=beta=>speedNumber(beta)+'% c';
const durationText=years=>!Number.isFinite(years)?'недостижимо':years>=1?compact(years)+' лет':years>=1/365.25?fmt(years*365.25,1)+' сут.':years>=1/(365.25*24)?fmt(years*365.25*24,1)+' ч':fmt(years*Rocket.year,0)+' с';
const massText=tonnes=>{const kg=tonnes*1000;return kg>=1?fmt(kg,3)+' кг':kg>=.001?fmt(kg*1e3,3)+' г':fmt(kg*1e6,3)+' мг';};
let theme=document.documentElement.dataset.theme||'dark';
function applyTheme(value){theme=value;document.documentElement.dataset.theme=value;const label=value==='dark'?'Включить светлую тему':'Включить тёмную тему';$('themeBtn').setAttribute('aria-label',label);$('themeBtn').title=label;$('themeBtn').textContent=value==='dark'?'☼':'◐';const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=value==='dark'?'#000000':'#f6f6f6';try{localStorage.setItem('parus-theme',value);}catch{}}
// Map the existing engineering ink palette to a neutral dark drawing palette.
function paint(color){if(theme==='light')return color;if(color==='#f8f8f8')return '#000000';if(color.startsWith('rgba'))return color.replace('37,38,32','218,218,218');const h=color.slice(1);if(!/^[0-9a-f]{3,6}$/i.test(h))return color;const hex=h.length===3?[...h].map(c=>c+c).join(''):h;return '#'+[0,2,4].map(i=>(255-parseInt(hex.slice(i,i+2),16)).toString(16).padStart(2,'0')).join('');}
let state,paused=false,speed=1,filter='all',toastTimer,hover=null,hitObjects=[],lastUI=0,saveTick=0;
const initial=()=>({version:9,controlG:100,current:'sol',selected:'proxima',sail:1,departureMode:'burst',expansion:true,cosmicTime:0,beta:0,acceleration:0,matter:Rocket.initialFuel,captured:0,spentEnergy:0,heatRadiated:0,earth:0,proper:0,totalDistance:0,ship:Space.point([0,0,0]),itinerary:[],visited:['sol'],destroyed:[],phase:'idle',flight:null,auto:true,journal:[{t:0,text:'Ковчег — 01. Корпус: 1 мг. Топливо: 1 / 1 мг. Фотонный двигатель готов.'}]});
function restore(saved){
 ExtendedCatalog.restore(saved);
 if(![1,2,3,4,5,6,7,8,9].includes(saved?.version)||!saved.ship||!Array.isArray(saved.visited))return initial();
 // Restore only old catalog objects still referenced by the player's expedition.
 for(const id of new Set([saved.current,saved.selected,saved.flight?.target,saved.flight?.fromId,...(saved.flight?.route||[]).map(n=>n.id),...(saved.itinerary||[]).map(n=>n.id)])){
  if(id&&!object(id)){const old=RETIRED_OBJECTS.find(o=>o.id===id);if(old)OBJECTS.push({...old,index:OBJECTS.length,retired:true});}
 }
 if(!object(saved.selected))saved.selected=object(saved.current)?.id||'proxima';
 const upgraded={...initial(),...saved,version:9,acceleration:0,spentEnergy:saved.spentEnergy||0,heatRadiated:saved.heatRadiated||0};
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
 if(saved.version<7){
  const oldCapacity=saved.version>=6?.001:Math.max(.001,saved.matter||.001);
  upgraded.matter=Rocket.fuelCapacity*Math.max(0,Math.min(1,(saved.matter||0)/oldCapacity));
  if(saved.current==='sol'&&!saved.flight&&!saved.totalDistance)upgraded.matter=Rocket.initialFuel;
  upgraded.controlG=100;const f=upgraded.flight;
  if(f&&upgraded.phase!=='flyby'){
   const oldWind=f.wind,oldCovered=f.covered;f.from=Space.point(upgraded.ship.p3);f.distance=distance(f.from,object(f.target));f.covered=0;f.aim=null;f.encounter=null;f.markers=[];delete f.view;
   if(upgraded.phase==='thrust'){f.engine=Rocket.plan(upgraded.matter,f.distance,upgraded.beta);f.maxBeta=f.engine.beta;f.replayRate=f.engine.burnProper/5;}
   if(upgraded.phase==='launch'){upgraded.matter=0;const r=oldWind?oldWind.startR+(oldCovered-(oldWind.baseCovered||0))*LY:Stellar.r0;f.wind=Stellar.plan(Rocket.dryMass*1000,SAILS[upgraded.sail].areaM2,upgraded.beta,r,100,Math.max(0,Stellar.pulseYears-(oldWind?.rows?.at(-1)?.source||0)),SAILS[upgraded.sail].targetBeta);f.wind.baseCovered=0;f.wind.elapsedProper=0;f.maxBeta=f.wind.beta;f.replayRate=f.wind.proper/5;}
   if(upgraded.phase==='brake'){f.magnetic=Magnetic.plan((Rocket.dryMass+upgraded.matter)*1000,upgraded.beta);f.replayRate=f.magnetic.proper/3;}
   if(upgraded.phase==='dock'){f.engine=Rocket.retroPlan(upgraded.matter,upgraded.beta);f.replayRate=f.engine.burnProper/2;}
  }
  if(f&&upgraded.phase==='flyby'&&f.encounter?.plan)f.encounter.plan.elapsedProper=f.encounter.lastProper||0;
  upgraded.journal.push({t:upgraded.earth,text:'Корпус и бак переведены на 1 мг; доля заправки, координаты, скорость и исторические часы сохранены. Предел тяги 100 g.'});
 }
 // Continue burning previously reserved fuel in existing photon flights.
 const f=upgraded.flight;
 if(f&&!f.wind&&f.engine?.direction>0&&!f.engine.fullTank&&['thrust','cruise'].includes(upgraded.phase)&&upgraded.matter>1e-24){
  f.engine=Rocket.plan(upgraded.matter,f.distance-f.covered,upgraded.beta,100);f.engine.baseCovered=f.covered;f.maxBeta=f.engine.beta;f.replayRate=f.engine.burnProper/5;
  f.markers=[];upgraded.phase='thrust';
 }
 if(saved.version<9&&upgraded.flight&&upgraded.phase!=='flyby'){
  const f=upgraded.flight,target=object(f.target),covered=f.covered;
  f.from=Space.point(upgraded.ship.p3);f.distance=distance(f.from,target);f.covered=0;f.aim=null;f.encounter=null;f.markers=[];delete f.view;
  f.medium=GasMedium.forLeg(f.from,target,upgraded.sail);
  if(upgraded.phase==='launch'&&f.wind){f.wind.baseCovered-=covered;}
  if(upgraded.phase==='thrust'){f.engine=Rocket.plan(upgraded.matter,f.distance,upgraded.beta);f.maxBeta=f.engine.beta;}
  if(upgraded.phase==='brake'){f.magnetic=Magnetic.plan((Rocket.dryMass+upgraded.matter)*1000,upgraded.beta,Magnetic.rho(f.medium.n)*f.medium.area);f.replayRate=f.magnetic.proper/3;}
  if(upgraded.phase==='dock'){f.engine=Rocket.retroPlan(upgraded.matter,upgraded.beta,Magnetic.maxG);f.replayRate=f.engine.burnProper/2;}
 }
 upgraded.controlG=100;upgraded.auto=true;if(upgraded.flight)delete upgraded.flight.manualCoast;
 if(!upgraded.flight)upgraded.beta=0;if(upgraded.flight&&!('cosmic' in upgraded.flight)){upgraded.flight.cosmic=Cosmology.isCosmic(object(upgraded.flight.fromId)||upgraded.flight.from,object(upgraded.flight.target));}
 return Route.sanitize(upgraded);
}
try{state=restore(JSON.parse(localStorage.getItem(STORE)));}catch{state=initial();}
paused=!!state.paused;speed=[1,10,100,1000].includes(state.timeScale)?state.timeScale:1;
if(state.flight&&state.phase!=='flyby')Route.configure();
if(state.flight&&!state.flight.markers?.length)FlightMarks.plan();
const canvas=$('map'),ctx=canvas.getContext('2d');
let width=0,height=0,dpr=1,cam={x:0,y:0,span:24},cameraGoal=null,effects=[];
let followShip=false,shipFocusArmed=false;
let pointer={down:false,x:0,y:0,startX:0,startY:0,moved:false,id:null};
function persist(){try{ExtendedCatalog.capture(state);state.paused=paused;state.timeScale=speed;localStorage.setItem(STORE,JSON.stringify(state));}catch{}}
function log(text){state.journal.push({t:state.earth,text});if(state.journal.length>100)state.journal.shift();persist();}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function screen(p){p=p===state.ship?FlightView.ship():MapLayout.project(p);return{x:width*.43+(p.x-cam.x)*width/cam.span,y:height*(width<700?.39:.50)+(p.y-cam.y)*width/cam.span};}
function world(x,y){return{x:cam.x+(x-width*.43)*cam.span/width,y:cam.y+(y-height*(width<700?.39:.50))*cam.span/width};}
function goCamera(x,y,span,instant=false,keepFollow=false){if(!keepFollow&&followShip)releaseShipCamera();cameraGoal={x,y,span:clamp(span,.00006,1.4e11)};if(instant){cam={...cameraGoal};cameraGoal=null;}updateMapHeading();}
function routeViewport(){
 const pad=Math.max(24,Math.min(54,width*.055)),card=$('flightCard').getBoundingClientRect();
 // Keep the route clear of the HUD, target card, heading and map buttons.
 const right=width>=700?Math.min(width-pad,card.left>width*.45?card.left-pad:width-350):width-pad;
 const bottom=width<700?Math.min(height-pad,card.top>100?card.top-pad:height*.43):height-pad;
 return{left:pad,top:112,right:Math.max(pad+100,right),bottom:Math.max(180,bottom)};
}
function shipCamera(span=cam.span){const p=FlightView.ship();return{x:p.x+(width*.43-width/2)*span/width,y:p.y+(height*(width<700?.39:.50)-height/2)*span/width,span};}
function focusShip(){if(followShip){followShip=false;shipFocusArmed=false;}else if(shipFocusArmed){followShip=true;}else shipFocusArmed=true;const c=shipCamera();goCamera(c.x,c.y,c.span,true,true);updateShipButton();}
function updateShipButton(){$('shipBtn').classList.toggle('active',followShip);$('shipBtn').setAttribute('aria-pressed',String(followShip));$('shipBtn').title=followShip?'Камера следует за кораблём · нажмите для отключения':shipFocusArmed?'Нажмите ещё раз, чтобы следовать за кораблём':'К кораблю';}
function releaseShipCamera(){followShip=false;shipFocusArmed=false;updateShipButton();}
function updateZoomControl(){$('zoomSlider').value=String(Math.log10((cameraGoal||cam).span));$('zoomDivision').textContent=distanceText(nice(cam.span/7))+' / дел.';}
function fitRoute(target){
 if(width<=0||height<=0||!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))return;const a=FlightView.ship(),b=MapLayout.project(target),v=routeViewport(),current=cameraGoal||cam;
 const sx=p=>width*.43+(p.x-current.x)*width/current.span,sy=p=>height*(width<700?.39:.50)+(p.y-current.y)*width/current.span;
 if([a,b].every(p=>sx(p)>=v.left&&sx(p)<=v.right&&sy(p)>=v.top&&sy(p)<=v.bottom))return;
 const span=Math.max(current.span,Math.abs(a.x-b.x)*width/(v.right-v.left)*1.25,Math.abs(a.y-b.y)*width/(v.bottom-v.top)*1.25);
 goCamera((a.x+b.x)/2-((v.left+v.right)/2-width*.43)*span/width,(a.y+b.y)/2-((v.top+v.bottom)/2-height*(width<700?.39:.50))*span/width,span);
}
function select(id,fit=false){const o=object(id);if(!o)return;ExtendedCatalog.pin(o);ExtendedCatalog.ensureGalaxy(o);state.selected=id;renderUI();if(fit)fitRoute(o);renderCatalog();persist();if(state.flight&&!Route.picking)showObject(id);}
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
new ResizeObserver(resize).observe(canvas);
function mapContext(view){
 const span=view.span;
 // Match the same projected optical ellipse that the map draws. Zoom never enlarges its boundary.
 const localGalaxy=GALAXIES.filter(g=>{const p=MapLayout.project(g),dx=view.x-p.x,dy=view.y-p.y,c=Math.cos(g.rotation),s=Math.sin(g.rotation),a=g.diameterLy/2;return span<g.diameterLy*4&&((dx*c+dy*s)/a)**2+((-dx*s+dy*c)/(a*g.axisRatio))**2<=1;}).sort((a,b)=>a.diameterLy-b.diameterLy)[0];
 const nearSun=Math.hypot(view.x,view.y);
 if(span<.01&&nearSun<.1)return ['Солнечная система','Земля и Солнце. Нулевая точка экспедиции.','00'];
 if(span<180&&nearSun<100)return ['Солнечная окрестность','В галактике «Млечный Путь».','01'];
 if(localGalaxy)return ['Галактика «'+localGalaxy.name+'»',span<10000?'Звёздный масштаб · область на схематической карте.':'Оптический контур · '+distanceText(localGalaxy.diameterLy),'Г'];
 if(span<10000)return ['Локальный масштаб','Область вне известных оптических контуров галактик.','02'];
 if(span<800000)return ['Галактический масштаб','Галактики и межгалактическое пространство.','03'];
 if(span<30000000)return [nearSun<5e6?'Местная группа':'Группы галактик','Галактики и их объединения.','04'];
 if(span<1e9)return ['Скопления галактик','Скопления и потоки космической паутины.','05'];
 if(span<4e10)return ['Космическая паутина','Стены, войды и крупномасштабные структуры.','06'];
 return ['Обозримая Вселенная','Исходная наблюдаемая область атласа · размер '+distanceText(93e9*Cosmology.scale()),'∞'];
}
function updateMapHeading(){const view=cameraGoal||cam,[title,sub,sheet]=mapContext(view);
 $('mapTitle').textContent=title;$('mapSubtitle').textContent=sub;$('mapSubtitle').hidden=!sub;$('mapSheet').textContent='/ '+sheet;
 document.querySelectorAll('[data-scale]').forEach(b=>b.classList.toggle('active',Math.abs(Math.log10(view.span/Number(b.dataset.scale)))<.32));
}
function canBoost(){const current=object(state.current);return !!current&&current.kind==='star'&&!state.destroyed.includes(current.id);}
function wantsBoost(){return canBoost()&&state.departureMode!=='engine';}
const windCache=new Map();
function windPlan(index=state.sail){const mass=Rocket.dryMass*1000,g=Math.max(1,state.controlG||100),key=mass+':'+index+':'+g;if(!windCache.has(key)){if(windCache.size>12)windCache.clear();windCache.set(key,Stellar.plan(mass,SAILS[index].areaM2,0,Stellar.r0,g,Stellar.pulseYears,SAILS[index].targetBeta));}return windCache.get(key);}
function quantity(n){const abs=Math.abs(n);if(abs!==0&&(abs>=1e3||abs<.01)){const e=Math.floor(Math.log10(abs));return fmt(n/10**e,1)+'·10<sup>'+e+'</sup>';}return fmt(n,2);}
function renderAcceleration(){
 const actual=state.flight?(state.acceleration||0)/G0:0,g=Math.abs(actual)<1e-8?0:actual,visible=clamp(g,-100,100),label=(g>0?'+':'')+fmt(g,2)+' g';
 $('acceleration').innerHTML=(g>0?'+':'')+fmt(g,2)+'<small>g</small>';
 $('accelerationFill').style.left=(visible<0?50+visible/2:50)+'%';$('accelerationFill').style.width=(Math.abs(visible)/2)+'%';
 $('accelerationBar').setAttribute('aria-valuenow',String(visible));$('accelerationBar').setAttribute('aria-valuetext',label);$('accelerationBar').title='Текущее собственное ускорение: '+label;
}
function renderUI(){
 Cosmology.sync(state);$('expansionToggle').checked=state.expansion!==false;$('expansionFactor').textContent='a = '+fmt(Cosmology.scale(),Cosmology.scale()<10?6:2);
 const f=state.flight,target=object(f?f.target:state.selected),current=object(state.current),active=!!f,boost=wantsBoost(),arrived=!active&&state.current===target.id;
 $('targetName').textContent=target.name;$('targetType').textContent=state.destroyed.includes(target.id)&&target.kind==='star'?'ОСТАТОК ЗВЕЗДЫ':target.type;$('targetVisited').hidden=!state.visited.includes(target.id);
 $('flightCard').classList.toggle('in-flight',active);
 const d=target.navigable?Cosmology.physicalDistance(state.ship,target):target.d;$('targetDistance').innerHTML=Number.isFinite(d)?compact(d)+' <small>св. лет</small>':'<small>Расстояние неизвестно</small>';
 $('departureSection').hidden=active||!canBoost()||arrived||!target.navigable;document.querySelectorAll('[data-departure]').forEach(b=>{const on=(state.departureMode||'burst')===b.dataset.departure;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 const planningBoost=!active&&boost&&!arrived&&target.navigable;$('sailSection').hidden=!planningBoost;
 const sail=SAILS[state.sail];document.querySelectorAll('[data-sail]').forEach(b=>{const i=+b.dataset.sail;b.classList.toggle('active',i===state.sail);b.disabled=!planningBoost;if(planningBoost)b.querySelector('span').textContent='≈'+percentC(windPlan(i).beta);});
 if(planningBoost){const predicted=windPlan();$('sailArea').textContent=sailAreaText(sail.areaM2);$('sailGamma').textContent=fmt(1/Math.sqrt(1-predicted.beta**2));$('sailDiagram').querySelector('text').textContent='≈ '+percentC(predicted.beta)+' →';}
 const photon=(state.phase==='thrust'||state.phase==='dock')&&f?.engine,wind=state.phase==='launch'&&f?.wind,mag=state.phase==='brake'&&f?.magnetic;
 const planningEngine=!active&&!boost&&!arrived&&target.navigable;$('engineSection').hidden=!(planningEngine||photon||wind||mag||state.phase==='flyby');$('burnTrack').hidden=!photon;
 if(planningEngine){const e=Rocket.plan(state.matter,d);$('engineLabel').textContent='ФОТОННАЯ ТЯГА · ДО 100 g';$('engineReadout').innerHTML='Масса <b>'+massText(Rocket.dryMass)+' + '+massText(state.matter)+'</b><br>Разгон <b>до '+massText(e.budget)+' → '+percentC(e.beta)+'</b>';}
 if(photon){const e=f.engine;$('engineLabel').textContent=e.direction<0?'ОБРАТНАЯ ФОТОННАЯ ТЯГА':'АННИГИЛЯЦИЯ ВЕЩЕСТВА';$('engineReadout').innerHTML='Расход <b>'+massText(e.burned)+' / '+massText(e.budget)+'</b><br>Энергия <b>'+quantity(e.energy/1e15)+' ПДж</b>';$('burnBar').style.width=(e.budget?100*e.burned/e.budget:0)+'%';}
 if(wind){const sample=f.wind.lastSample||Stellar.sampleProper(f.wind,f.wind.elapsedProper||0),r=sample.r,force=sample.force;$('engineLabel').textContent='СВЕТ ВЗРЫВА · РАСКРЫТИЕ '+fmt(sample.opening*100,2)+'%';$('engineReadout').innerHTML='До звезды <b>'+compact(r/Stellar.r0)+' а.е.</b><br>Сила <b>'+quantity(force)+' Н</b>';}
 if(mag){const rates=f.magnetic.lastSample||ProperTime.at(f.magnetic,Magnetic,f.magnetic.elapsedProper||0);$('engineLabel').textContent='ПАРУС · ГАЗ И ПЫЛЬ · ДО 100 g';$('engineReadout').innerHTML=f.medium.label+'<br>Площадь паруса <b>'+fmt(f.medium.area/1e6,0)+' км²</b><br>Поток <b>'+quantity(rates.particles)+' частиц/с</b><br>В бак <b>'+quantity(rates.massRate)+' кг/с</b>'+(state.matter>=Rocket.fuelCapacity*(1-1e-9)?'<br>Бак заполнен · частицы выпускаются':'');}
 if(state.phase==='flyby'){const p=f.encounter.plan,local=Gravity.atProper(p,p.elapsedProper||0);$('engineLabel').textContent='ГРАВИТАЦИОННЫЙ ПРОЛЁТ · 0 g';$('engineReadout').innerHTML='Поворот <b>'+Route.angleText(p.angle)+'</b><br>Перицентр <b>'+Route.radiusText(p.rp)+'</b><br>Локальная скорость <b>'+percentC(local.localBeta)+'</b>';}
 $('routeCount').textContent=(f?.route?.length||state.itinerary.length)||'';
 let action,hint;
 if(active){action='';hint=f.missed?'Цель пройдена. Остановка потребует оставшегося тормозного пути.':state.phase==='thrust'?'Двигатель расходует массу. Скорость растёт по ракетному уравнению.':state.phase==='launch'?'Парус впереди корабля. Поток слабеет с квадратом расстояния и с ростом скорости.':state.phase==='brake'?'Встречный газ передаёт импульс тому же парусу. Их сбор увеличивает массу корабля.':state.phase==='dock'?'Торможение парусом ослабло. Последнюю скорость гасит двигатель обратной тягой.':'Инерционный полёт. Тормозной путь рассчитывается по текущей скорости и массе.';}
 else if(arrived){action=target.departureStar?'Найти звезду для разгона':'Выбрать следующую цель';hint=boost?'Прибытие. Выберите цель — и подготовьте звёздный парус.':'Прибытие. Следующая точка ждёт в атласе.';}
 else if(!target.navigable){action='Ориентир атласа';hint=target.atlasOnly?'Положение недостаточно точное для карты и полёта. Объект сохранён в атласе.':'Область атласа с условным положением; физический маршрут не назначается.';}
 else if(boost){action=current.kind==='star'?'Взорвать звезду и отчалить':'Импульс местной звезды';hint='Перед взрывом бак опустошается. Раннее торможение уменьшит прогноз скорости.';}
 else{action=state.current==='sol'?'К звезде на тяге':'К цели на тяге';hint=state.matter>1e-24?'Разгон использует весь бак. Парус соберёт вещество в бак для точной остановки у цели.':'Запас рабочего вещества исчерпан.';}
 $('launchBtn').hidden=active;$('launchBtn').querySelector('span').textContent=action;$('launchBtn').disabled=!target.navigable||!arrived&&!boost&&state.matter<1e-24;$('flightHint').textContent=hint+(target.positionQuality==='approximate'?' Позиция приблизительная.':'');
 const phases={thrust:'ФОТОННАЯ ТЯГА',launch:'ЗВЁЗДНЫЙ ВЕТЕР',cruise:'ИНЕРЦИОННЫЙ ПОЛЁТ',brake:'ТОРМОЖЕНИЕ ПАРУСОМ',dock:'ТОЧНАЯ ОСТАНОВКА',flyby:'ГРАВИТАЦИОННЫЙ ПРОЛЁТ'};
 $('phaseTag').textContent=paused?'ПАУЗА':active?phases[state.phase]:arrived?'ПРИБЫТИЕ':current?'СТОЯНКА: '+(current.id==='sol'?'СОЛНЦЕ':current.name.toUpperCase()):'МЕЖЗВЁЗДНОЕ ПРОСТРАНСТВО';
 $('flightControls').hidden=!active;
 const eta=FlightEstimate.get();$('arrivalEstimate').hidden=arrived||!target.navigable;
 $('arrivalLabel').textContent=Route.isFlyby()?'ДО КОНЦА ПРОЛЁТА ≈':'ДО ПРИБЫТИЯ ≈';
 $('arrivalProper').textContent=eta?durationText(eta.proper):'—';$('arrivalEarth').textContent=eta?durationText(eta.earth):'—';
 renderVelocity();renderAcceleration();renderClockRatio();
 $('matter').innerHTML=fmt(state.matter*1e9,3)+' / 1<small>мг</small>';$('dryMass').innerHTML='1<small>мг</small>';
 const dryWidth=Rocket.dryMass/(Rocket.dryMass+Rocket.fuelCapacity)*100,fuelWidth=state.matter/(Rocket.dryMass+Rocket.fuelCapacity)*100;
 $('massDry').style.width=dryWidth+'%';$('massFuel').style.width=fuelWidth+'%';$('massTotal').textContent=massText(Rocket.dryMass+state.matter);
 $('massBar').setAttribute('aria-label','Корпус 1 мг; топливо '+fmt(state.matter*1e9,3)+' из 1 мг; свободно '+fmt((Rocket.fuelCapacity-state.matter)*1e9,3)+' мг');
 $('massBar').title='Корпус 1 мг | Топливо '+massText(state.matter)+' | Свободно '+massText(Rocket.fuelCapacity-state.matter);
 const rate=Simulation.replayRate();$('timeRate').textContent=rate<speed?'СЛОУМО ×'+compact(speed/rate):'1 с = '+fmt(speed,0)+(speed===1?' год':' лет')+' на борту';$('timeRate').classList.toggle('replaying',rate<speed);

 $('earthClock').innerHTML=fmt(Math.floor(state.earth),0)+'<small>лет</small>';$('shipClock').innerHTML=fmt(Math.floor(state.proper),0)+'<small>лет</small>';
 const pct=f?Math.min(100,f.covered/f.distance*100):0;$('progressBar').style.width=pct+'%';$('progressValue').textContent=fmt(pct,1)+'%';$('progressLabel').textContent=f?.route?.length?'УЧАСТОК '+(f.legIndex+1)+' / '+f.route.length:f?.missed?'ПРОЛЁТ ЦЕЛИ':'ПРОЙДЕНО';$('pauseBtn').textContent=paused?'▷':'Ⅱ';$('pauseBtn').setAttribute('aria-label',paused?'Продолжить':'Пауза');$('speedBtn').textContent=speed+'×';
}
function coastSetup(){/* Cruise speed now converts proper years directly in Simulation. */}
function launch(forceEngine=false){
 if(state.flight)return;const target=object(state.selected);if(!target||target.id===state.current||!target.navigable)return;
 state.controlG=100;state.auto=true;const boost=!forceEngine&&wantsBoost();if(!boost&&state.matter<1e-24){toast('Нет рабочего вещества для тяги.');return;}
 const from={...state.ship},d=distance(from,target),cosmic=Cosmology.isCosmic(object(state.current)||from,target);Cosmology.sync(state);if(d<1e-14)return;if(boost)state.matter=0;const engine=boost?null:Rocket.plan(state.matter,d*(cosmic?Cosmology.scale():1),0,Math.max(1,state.controlG||100)),wind=boost?{...windPlan(),baseCovered:0,elapsedProper:0}:null;
 state.flight={cosmic,from,target:target.id,fromId:state.current,distance:d,covered:0,coastRate:0,maxBeta:wind?wind.beta:engine.beta,engine,wind,magnetic:null,boost,starEpochEarth:state.earth,starR0:Stellar.r0,medium:GasMedium.forLeg(from,target,state.sail),missed:false,autoStopping:false,replayRate:(wind?wind.proper:engine.burnProper)/5};
 state.beta=0;state.acceleration=boost?Stellar.sample(wind,0).force/wind.massKg:Rocket.acceleration(Rocket.dryMass+state.matter,engine.maxG);state.phase=boost?'launch':'thrust';Simulation.smoothedFactor=Math.min(1,state.flight.replayRate);paused=false;
 if(boost){const current=object(state.current);state.destroyed.push(current.id);effects.push({x:from.x,y:from.y,p3:from.p3,age:0});log('Звёздный взрыв: '+current.name+'. Парус '+SAILS[state.sail].name+'. Прогноз свободного разгона '+percentC(wind.beta)+'.');toast('Бак опустошён. Разгон светом взрыва; короткий этап показан замедленно.');}
 else log('Фотонный разгон. Курс: '+target.name+'. Начальная масса '+massText(engine.m0)+'; запас на разгон '+massText(engine.budget)+'.');
 state.current=null;FlightMarks.plan();renderUI();fitRoute(target);persist();
}
function cutEngine(){const f=state.flight;if(!f)return;if(['launch','thrust'].includes(state.phase))FlightMarks.actual('acceleration');if(state.phase==='launch')f.windFolded=true;
 state.phase='cruise';state.acceleration=0;coastSetup();renderUI();persist();
}
function beginDock(){
 const f=state.flight;if(!f)return;if(state.beta<=1e-12){state.beta=0;finishFlight(Math.abs(f.covered-f.distance)<=Simulation.tolerance(f)*4);return;}
 f.engine=Rocket.retroPlan(state.matter,state.beta,Magnetic.maxG);f.replayRate=f.engine.burnProper/2;if(!f.engine.canStop){toast('Недостаточно вещества для точной остановки. Продолжаем захват.');state.phase='brake';f.magnetic=Magnetic.plan((Rocket.dryMass+state.matter)*1000,state.beta);return;}
 FlightMarks.actual('fine');state.phase='dock';state.acceleration=-Rocket.acceleration(Rocket.dryMass+state.matter,f.engine.maxG);
}
function beginBrake(auto=false){
 const f=state.flight;if(!f||state.beta<=0)return;if(['launch','thrust'].includes(state.phase))FlightMarks.actual('acceleration');FlightMarks.actual('brake');f.windFolded=true;f.autoStopping=auto;f.magnetic=Magnetic.plan((Rocket.dryMass+state.matter)*1000,state.beta);
  f.magnetic.maxG=Magnetic.maxG;Object.assign(f.magnetic,Magnetic.cappedLeg(f.magnetic,f.magnetic.finalBeta));f.replayRate=f.magnetic.proper/3;FlightMarks.set(f,'fine',FlightMarks.at(f,f.covered+f.magnetic.distance/Cosmology.factor(f)));f.magnetic.elapsedProper=0;f.magnetic.lastDistance=0;f.magnetic.lastEarth=0;f.magnetic.lastProper=0;f.magnetic.lastHeat=0;
 if(f.magnetic.distance===0)beginDock();else{state.phase='brake';state.acceleration=Magnetic.sample(f.magnetic,0).properAcceleration;}
}
function advance(ds,earth,proper,comoving=false,path){
 const f=state.flight,metric=Cosmology.factor(f,(state.cosmicTime||0)+(state.expansion!==false?earth/2:0));f.covered+=comoving?ds:ds/metric;state.totalDistance+=comoving?(path??ds*metric):ds;state.earth+=earth;state.proper+=proper;Cosmology.elapse(state,earth);const p=f.covered/f.distance,target=f.aim||object(f.target);state.ship=Space.mix(f.from,target,p);
 if(f.covered>f.distance+Math.max(1e-10,f.distance*1e-10)&&!f.missed&&state.beta>1e-8){f.missed=true;toast('Цель пройдена. Физический тормозной путь ещё не исчерпан.');}
}
function finishFlight(arrived){const f=state.flight,target=object(f.target);
 if(arrived){state.ship=Space.point(target.p3);state.current=target.id;if(!state.visited.includes(target.id))state.visited.push(target.id);ExtendedCatalog.ensureGalaxy(target);log('Прибытие: '+target.name+'. Борт: '+compact(state.proper)+' лет; Земля: '+compact(state.earth)+' лет.');toast('Прибытие: '+target.name+'. Выберите следующую цель.');}
 else{state.current=null;log('Остановка вне цели. До неё '+distanceText(distance(state.ship,target))+'.');toast('Корабль остановлен. До цели '+distanceText(distance(state.ship,target))+'.');}
 state.beta=0;state.acceleration=0;state.phase='idle';state.flight=null;renderUI();renderCatalog();persist();if(arrived)Route.afterStop(f);
}
function autoFraction(predict){
 const f=state.flight,remaining=f.distance-f.covered;if(Route.isFlyby()){if(predict(1).distance/Cosmology.factor(f)<=remaining)return 1;let lo=0,hi=1;for(let i=0;i<60;i++){const p=(lo+hi)/2;if(predict(p).distance/Cosmology.factor(f)>remaining)hi=p;else lo=p;}return(lo+hi)/2;}if(!Route.braking())return 1;
 const gap=p=>{const v=predict(p);return remaining-(v.distance+Magnetic.stopping(v.fuel,v.beta,Math.max(1,Math.abs(state.controlG)||100)).distance)/Cosmology.factor(f);};
 if(gap(1)>=0)return 1;let lo=0,hi=1;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(gap(mid)>=0)lo=mid;else hi=mid;}return (lo+hi)/2;
}
function tickPhysics(dt){Simulation.tick(dt);}

let catalogRevision=0,catalogTimer;
function catalogRows(items,total,loading=false,error=''){
 $('catalogCount').textContent=total.toLocaleString('ru-RU')+' / '+ExtendedCatalog.total.toLocaleString('ru-RU')+(loading?' · поиск…':'');
 $('catalogList').replaceChildren();
 if(!items.length){const e=document.createElement('p');e.className='empty-state';e.textContent=loading?'Поиск по полному каталогу…':error||'Объекты не найдены.';$('catalogList').append(e);}
 for(const entry of items){const b=document.createElement('button');b.className='catalog-item';const quality=entry.atlasOnly||entry.positionQuality==='unknown'?' · ТОЛЬКО АТЛАС':entry.positionQuality==='approximate'?' · ПРИБЛИЗИТЕЛЬНО':entry.synthetic?' · ИГРОВАЯ ЗВЕЗДА':'';
  const body=document.createElement('span');body.className='catalog-item-body';const name=document.createElement('strong');name.textContent=entry.name;const detail=document.createElement('small');detail.textContent=distanceText(entry.d)+quality+(state.visited.includes(entry.id)?' · ИССЛЕДОВАНО':'');body.append(name);body.append(detail);b.append(body);const arrow=document.createElement('span');arrow.textContent='↗';b.append(arrow);
  b.addEventListener('click',async()=>{b.disabled=true;try{const o=await ExtendedCatalog.resolve(entry);const picking=Route.picking;select(o.id);closeCatalog();ExtendedCatalog.focus(o);if(picking){Route.add(o.id);Route.show();}}catch(e){toast(e.message);b.disabled=false;}});$('catalogList').append(b);
 }
 if(error&&items.length){const e=document.createElement('p');e.className='empty-state';e.textContent=error+' · показана основная выборка';$('catalogList').append(e);}
 if(total>items.length&&!loading&&!error){const more=document.createElement('button');more.className='map-size-action';more.textContent='Ещё 100 объектов';more.onclick=()=>{ExtendedCatalog.searchLimit+=100;renderCatalog();};$('catalogList').append(more);}
}
function renderCatalog(){
 if($('catalog').hidden)return;
 const revision=++catalogRevision,term=MapDetails.searchKey($('search').value.trim()),limit=ExtendedCatalog.searchLimit;
 const exact=o=>!!term&&[o.name,o.id,...(o.aliases||[]),o.ngc||'','HIP '+(o.hip||''),'HD '+(o.hd||'')].some(v=>MapDetails.searchKey(v)===term);
 const core=[...OBJECTS,...ExtendedCatalog.pinned.values()].filter(o=>!o.streamed&&ExtendedCatalog.matches(o.kind,filter,o)&&MapDetails.searchKey(`${o.name} ${(o.aliases||[]).join(' ')} ${o.type} ${o.id} ${o.ngc||''} ${o.hip||''} ${o.hd||''} ${o.gliese||''}`).includes(term)).sort((a,b)=>Number(exact(b))-Number(exact(a))||(a.d??Infinity)-(b.d??Infinity));
 catalogRows(core.slice(0,limit),core.length,true);
 if(typeof fetch!=='function'&&!globalThis.PARUS_CATALOG_FILES){catalogRows(core.slice(0,limit),core.length);return;}
 ExtendedCatalog.search(term,filter,limit).then(result=>{if(revision!==catalogRevision||$('catalog').hidden)return;const ids=new Set(core.map(o=>o.id));const items=[...core,...result.items.filter(o=>!ids.has(o.id))].sort((a,b)=>Number(b.searchExact||exact(b))-Number(a.searchExact||exact(a))||(a.d??Infinity)-(b.d??Infinity)||a.id.localeCompare(b.id)).slice(0,limit);catalogRows(items,core.length+result.total);}).catch(e=>{if(revision===catalogRevision)catalogRows(core.slice(0,limit),core.length,false,e.message);});
}
function closeMenu(){$('menu').hidden=true;$('menuBtn').setAttribute('aria-expanded','false');}
function openCatalog(){closeMenu();$('catalog').hidden=false;renderCatalog();$('search').focus();}
function closeCatalog(){$('catalog').hidden=true;Route.picking=false;}
function showDialog(html){closeMenu();$('dialogContent').innerHTML=html;$('infoDialog').showModal();}
function showHelp(){showDialog('<div class="modal-eyebrow">ПАРУС / ПОЛЁТ</div><h2>Поймать поток.<br>Рассчитать остановку.</h2><ol><li><b>Собственная тяга.</b> Фотонный двигатель расходует весь доступный запас для разгона. Для точной остановки вещество собирает парус. Масса уменьшается; мощность регулируется по выбранной перегрузке. Выключение двигателя и переход к торможению выполняет автопилот.</li><li><b>Звёздный парус.</b> После прибытия выберите следующую цель и площадь паруса. Показанная скорость — прогноз до автоматического складывания; на коротком маршруте торможение начнётся раньше. Сила падает как 1/r² и дополнительно ослабевает из-за удаления от догоняющего потока. Корабль разгоняется постепенно. Парус складывается автоматически после импульса, при ослаблении потока или перед торможением; ловить момент вручную не нужно.</li><li><b>Торможение парусом.</b> Поток встречных частиц пропорционален скорости, их импульс тоже растёт со скоростью. Тот же парус тормозит и собирает вещество в бак. Автопилот учитывает полный тормозной путь.</li><li><b>Точная остановка.</b> При малой скорости сопротивление газа ослабевает. Последнюю скорость гасит фотонный двигатель обратной тягой, расходуя вещество. Позднее включение захвата может привести к пролёту цели.</li></ol><p>Скорость и собственное ускорение показаны рядом внизу. Колесо меняет масштаб, перетаскивание двигает карту. Пробел — пауза; В обычном режиме 1 секунда игрока равна 1 году на борту. Короткие разгоны и торможения показываются замедленно; коэффициент виден рядом с часами. Кнопка 1× переключает 10×, 100× и 1000×. Пауза останавливает оба часа. Прогресс сохраняется в браузере.</p><button class="modal-start" id="startExploring">Продолжить →</button>');$('startExploring').onclick=()=>$('infoDialog').close();}
function showModel(){
 const medium=state.flight?.medium||GasMedium.forLeg(state.ship,object(state.selected)||state.ship,state.sail);
 const beta=state.beta>0?state.beta:windPlan().beta,stop=Magnetic.stopping(state.matter,beta),raw=stop.magnetic.unthrottled;
 const mass=(Rocket.dryMass+state.matter)*1000,fullG=-Magnetic.rates(mass,beta,Magnetic.rho(medium.n)*medium.area).properAcceleration/G0;
 showDialog('<div class="modal-eyebrow">ФИЗИКА / МОДЕЛЬ</div><h2>Один парус.<br>Свет и встречный газ.</h2><p>Корпус 1 мг, бак 1 мг. Перед звёздным импульсом бак опустошается. Сухая масса включает идеализированный парус; его прочность и нагрев не рассчитываются.</p><h3>Разгон</h3><p>Идеальное отражение вспышки, поток 1/r² с релятивистской доплеровской поправкой. Раскрытие ограничивает разгон до 100 g. S: 100 км², 99% c; M: 1 млн км²; L: 1 млрд км². Скорости M/L вычисляются из доступного светового импульса и могут не достичь прежних номиналов. На коротком маршруте автоматика заканчивает разгон раньше.</p><h3>Торможение тем же парусом</h3><div class="formula">ρгаз = n mₚ; ρ = ρгаз / 0,99<br>Aэфф ≤ Aпаруса<br>F₀ = −ρAэффγ²v²<br>dM/dt = ρAэффv до заполнения бака</div><p>Парус принимает импульс газа и пыли, собирает рабочее вещество и излучает лишнюю энергию. При полном баке обработанные частицы выпускаются без скорости относительно корабля. Автоматика уменьшает встречную площадь и ограничивает торможение до 100 g; это предел прочности корабля. Дополнительного ограничения 1 g нет. После 0,01c остаток скорости гасится обратной фотонной тягой, тоже до 100 g.</p><p>Модель среды: 1 атом/см³ в галактическом диске, 0,3 в местном облаке, 0,001 в Местном пузыре, 1 атом/м³ вне галактик. Для участка используется наиболее разреженная из пересекаемых модельных областей; оценка сохраняется до прибытия. Это консервативная однородная оценка, не карта реального газа.</p><p><b>'+medium.label+'</b><br>Выбранный парус: '+fmt(medium.area/1e6,0)+' км². Торможение с '+percentC(beta)+': '+durationText(stop.proper)+' на борту; '+durationText(stop.earth)+' на Земле; путь '+distanceText(stop.distance)+'.</p><p>Плотность газа: '+quantity(Magnetic.gasDensity(medium.n))+' кг/м³; пыли: '+quantity(Magnetic.dustDensity(medium.n))+' кг/м³. Пыль принята равной 1% массы среды. Полный парус при этой скорости даёт около '+quantity(fullG)+' g. Без складывания участок захвата до '+percentC(stop.magnetic.finalBeta)+' занял бы '+durationText(raw.proper)+' на борту; фактически раскрытие ограничивается прочностью 100 g.</p><h3>Часы</h3><p>1 секунда = 1 бортовой год на 1×. Слоумо плавно меняет только темп воспроизведения; физические часы и траектория интегрируются независимо. Пауза останавливает время. На таймерах показаны целые годы.</p><p><a href="https://science.nasa.gov/learn/basics-of-space-flight/chapter1-1/" target="_blank" rel="noopener">NASA: плотность среды</a> · <a href="https://solarsystem.nasa.gov/genesismission/educate/kitchen/resource/factsheets/Interstellarclouds.pdf" target="_blank" rel="noopener">NASA: межзвёздные облака</a></p>');
}
function showObject(id=state.selected){
 const o=object(id);if(!o)return;ExtendedCatalog.ensureGalaxy(o);const f=o.facts,g=o.galaxy;
 const row=(label,value)=>'<div class="fact-row"><dt>'+label+'</dt><dd>'+value+'</dd></div>';
 let luminosity=f.lum!==undefined?'≈ '+quantity(f.lum)+' L☉<small>Болометрическая мощность: ≈ '+quantity(f.lum*Astro.solarLuminosity)+' Вт</small>':f.visual?'≈ '+quantity(f.visual.solarV)+' L☉,'+(f.band||'V')+'<small>Собственная светимость в полосе '+(f.band||'V')+'; абсолютная величина M'+(f.band||'V')+' ≈ '+fmt(f.visual.absoluteV,1)+' mag</small>':f.lumUnknown;
 const sizeButton=o.region?'<button class="map-size-action" id="viewRegion">Показать область ↗</button>':(g||o.id==='sgr')?'<button class="map-size-action" id="viewGalaxy">Показать галактику в масштабе <span>↗</span></button>':'';
 let html='<div class="modal-eyebrow">АТЛАС / ОБ ОБЪЕКТЕ</div><h2>'+o.name+'</h2><p>'+o.desc+'</p>'+sizeButton+'<dl class="object-facts">'+row('Класс',f.class)+row('Масса',f.mass)+row('Светимость',luminosity);
 if(o.region)html+=row('Область',o.region.note+'<small>Форма и ориентация приблизительны: t-SNE не сохраняет локальные углы и размеры между объектами.</small>');
 if(o.ngc)html+=row('Каталог NGC / IC',o.ngc.replace(/^(NGC|IC)0*(\d+)/,'$1 $2'));
 if(o.cosmology)html+=row('Красное смещение',fmt(o.redshift,4)+'<small>Расстояние на карте — современное сопутствующее, ≈ '+distanceText(o.d)+'. Свет шёл ≈ '+compact(o.cosmology.lookbackYears)+' лет; это разные величины.</small>');
 if(o.apparentV!=null)html+=row('Видимая величина V',fmt(o.apparentV,2)+' mag<small>Яркость с Земли: чем меньше число, тем ярче. Не абсолютная светимость.</small>');if(o.iauNames?.length)html+=row('Имена IAU',o.iauNames.join(', '));if(o.aliases?.length)html+=row('Другие обозначения',o.aliases.join(' · '));
 if(g)html+=row('Оптический размер',distanceText(g.diameterLy)+' × '+distanceText(g.diameterLy*g.axisRatio)+'<small>Большая × малая ось проекции; размеры контура в масштабе карты</small>');
 else if(f.radius)html+=row('Размер',f.radius);
 if(f.extra)html+=row(...f.extra);
 if(o.p3){html+=row(o.arrivalAnchor?'Игровая точка XYZ':'Galactic XYZ',o.p3.map(v=>compact(v)).join(' / ')+' св. лет<small>'+(o.arrivalAnchor?'Игровой ориентир для полёта; положение центра структуры не измерено':'Физические координаты относительно Солнца; не координаты схемы')+'</small>')+row('Глубина Zg',distanceText(o.p3[2])+'<small>Координата вне плоскости карты, относительно Солнца</small>');if(o.raDeg!==undefined)html+=row('Направление J2000',fmt(o.raDeg,4)+'° / '+fmt(o.decDeg,4)+'°<small>Прямое восхождение / склонение</small>');}
 if(!o.p3&&Number.isFinite(o.raDeg))html+=row('Направление J2000',fmt(o.raDeg,4)+'° / '+fmt(o.decDeg,4)+'°');
 if(o.catalogDistanceLy!=null)html+=row('Исходная каталожная дальность',distanceText(o.catalogDistanceLy)+'<small>До оценки по принадлежности к системе; не используется в текущем маршруте</small>');
 if(o.gravity)html+=row('Модель пролёта',o.gravity.note);
 if(o.coordinateNote)html+=row('Координаты',o.coordinateNote);
 const system=ExtendedCatalog.systemByMember.get(o.id);if(system)html+=row('Связанная система',system.name+'<small>'+system.note+'</small>');
 html+=row('От Солнца',distanceText(o.d))+'</dl>';
 if(ExtendedCatalog.systemByMember.has(o.id))html+='<button class="map-size-action" id="viewSystem">Показать связанную систему ↗</button>';
 if(o.id==='sgr'||o.nuclearStar)html+='<button class="map-size-action" id="viewNuclearCluster">Звёзды и орбиты у Стрельца A* ↗</button>';
 if(o.departureStar)html+='<button class="map-size-action" id="viewLocalStar">Найти звезду для разгона ↗</button>';
 if(o.atlasOnly)html+='<p class="object-note">Только атлас: положение недостаточно точное. На карте объект не размещён.</p>';
 html+='<p class="object-note">Оценки округлены. M☉ — масса Солнца; L☉ — его полная светимость, L☉,V и L☉,B — светимость Солнца в соответствующей полосе. Это собственное излучение, а не видимая яркость с Земли.</p>';
 if(f.visual)html+='<p class="object-note">Полосовая светимость рассчитана из каталожной фотометрии и расстояния атласа: M = m − 5 log₁₀(d/10 пк), L/L☉ = 10⁰·⁴⁽ᴹ☉⁻ᴹ⁾. Без поправки на поглощение пылью; это приблизительная оценка, не полная болометрическая мощность.</p>';
 if(f.note)html+='<p class="object-note">'+f.note+'</p>';
 html+='<p class="object-sources">'+f.refs.map(([url,label])=>'<a href="'+url+'" target="_blank" rel="noopener">'+label+' ↗</a>').join('')+'</p>';
 showDialog(html);if(o.id==='sgr'||o.nuclearStar)$('viewNuclearCluster').onclick=()=>{$('infoDialog').close();NuclearStars.focus();};if(ExtendedCatalog.systemByMember.has(o.id))$('viewSystem').onclick=()=>ExtendedCatalog.showSystem(o.id);if(o.departureStar)$('viewLocalStar').onclick=()=>{const star=ExtendedCatalog.ensureGalaxy(o);$('infoDialog').close();select(star.id);ExtendedCatalog.focus(star);};if(o.region)$('viewRegion').onclick=()=>{$('infoDialog').close();RegionMap.focus(o);};if(g||o.id==='sgr')$('viewGalaxy').onclick=()=>{const shape=g||GALAXIES[0];$('infoDialog').close();focusGalaxy(shape);};
}
function focusGalaxy(g){const span=g.diameterLy*Math.max(2.5,width/Math.max(height*.58,1));const p=MapLayout.project(g);goCamera(p.x,p.y,span);toast('Оптический контур · '+distanceText(g.diameterLy)+' · в масштабе карты');}
function showJournal(){showDialog('<div class="modal-eyebrow">КОВЧЕГ — 01 / ЖУРНАЛ</div><h2>След экспедиции.</h2><p>Исследовано '+state.visited.length+' из '+(OBJECTS.length-1)+' точек · пройдено '+distanceText(state.totalDistance)+' · собрано '+massText(state.captured)+' · аннигилировано на '+compact(state.spentEnergy/1e15)+' ПДж; отведено тепла '+compact(state.heatRadiated/1e15)+' ПДж.</p>'+[...state.journal].reverse().map(e=>'<div class="journal-entry"><time>'+compact(e.t)+' лет</time><p>'+e.text+'</p></div>').join(''));}
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
 if(width>500&&cam.span<200&&cam.span>.15){for(let r=unit;r<cam.span*1.1;r+=unit){let rp=r*width/cam.span;if(rp<12)continue;circle(origin.x,origin.y,rp,'#d1d1d1',.5,[2,5]);if(rp<Math.min(width,height)*.8)text(compact(r)+' св. л.',origin.x+rp*.707+5,origin.y-rp*.707-5,7,'#9f9f9f');}}
 $('scaleValue').textContent='СХЕМА · t-SNE / XYg';
}
function galaxyProjection(g){const center=screen(g);return{center,r:g.diameterLy*.5*width/cam.span};}
function drawGalaxyBackground(){
 for(const g of GALAXIES){const {center,r}=galaxyProjection(g);if(r<1.2||r>12000||center.x+r<0||center.x-r>width||center.y+r<0||center.y-r>height)continue;
  const body=object(g.id)||{...g,kind:'galaxy',d:0,galaxy:g};if(!MapDetails.visible(body,cam.span))continue;
  const selected=g.id===state.selected||(g.id==='milkyway'&&state.selected==='sgr');
  ctx.save();ctx.globalAlpha=MapDetails.opacity(body,cam.span);ctx.translate(center.x,center.y);ctx.rotate(g.rotation);ctx.scale(1,g.axisRatio);
  circle(0,0,r,selected?'#555555':'#777777',1.1,[3,5]);
  if(g.shape==='spiral'){
   circle(0,0,r*.17,'#c3c3c3',.6);circle(0,0,r*.06,'#bababa',.65);
   for(let arm=0;arm<(g.id==='milkyway'?4:2);arm++){ctx.beginPath();ctx.strokeStyle=paint(selected?'#969696':'#b6b6b6');ctx.lineWidth=.85;
    for(let i=0;i<=200;i++){const t=i/200,rr=r*(.10+t*.90),a=t*5+arm*Math.PI*(g.id==='milkyway'?.5:1),x=Math.cos(a)*rr,y=Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
   }
  }else if(g.shape==='elliptical'){for(const f of [.10,.22,.40,.65,.84])circle(0,0,r*f,'#bcbcbc',.6);if(g.id==='centaurus'){line(-r*.8,-r*.08,r*.8,-r*.08,'#8d8d8d',1);line(-r*.8,r*.04,r*.8,r*.04,'#8d8d8d',1);}}
  else{for(let ring=0;ring<3;ring++){ctx.beginPath();ctx.strokeStyle=paint('#b3b3b3');ctx.lineWidth=.7;for(let i=0;i<=120;i++){const a=i/120*Math.PI*2,rr=r*(.35+ring*.2)*(1+.13*Math.sin(a*3+ring)+.09*Math.cos(a*5)),x=Math.cos(a)*rr,y=Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.stroke();}line(-r*.45,0,r*.35,0,'#9c9c9c',2);}
  ctx.restore();
  if(r>18&&r<Math.max(width,height)*3){const yy=center.y+Math.min(r*g.axisRatio+22,height*.42);MapLabels.add({key:'galaxy-'+g.id,name:g.name.toUpperCase(),detail:'ОПТИЧЕСКИЙ ДИАМЕТР · '+distanceText(g.diameterLy),priority:selected?100:55,size:9,opacity:MapDetails.opacity(body,cam.span),color:selected?'#454545':'#747474',candidates:[{x:center.x,y:yy,align:'center'},{x:center.x,y:center.y-r*g.axisRatio-24,align:'center'},{x:center.x-r-18,y:center.y,align:'right'}]});}

 }
}
function drawHorizonBoundary(){if(cam.span>4e10){const a=screen({x:0,y:0}),r=465e8*Cosmology.scale()*width/cam.span;circle(a.x,a.y,r,'#a7a7a7',.8,[7,5]);}}
function drawSymbol(o,p,selected=false){const destroyed=state.destroyed.includes(o.id)&&o.kind==='star';const ink=selected?'#171717':'#424242';ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle=paint(ink);ctx.lineWidth=1.25;
 if(destroyed){circle(0,0,9,ink,.7,[2,3]);line(-5,-5,5,5,ink,.8);line(-5,5,5,-5,ink,.8);}
 else if(o.kind==='home'){circle(0,0,14,ink,.8);circle(0,0,8,ink,1);ctx.fillStyle=paint(ink);ctx.beginPath();ctx.arc(0,0,2,0,Math.PI*2);ctx.fill();for(let i=0;i<8;i++){const a=i*Math.PI/4;line(Math.cos(a)*18,Math.sin(a)*18,Math.cos(a)*22,Math.sin(a)*22,ink,.7);}}
 else if(o.nuclearStar){circle(0,0,2.8,ink,1.2);ctx.fillStyle=paint(ink);ctx.fillRect(-.8,-.8,1.6,1.6);}
 else if(o.kind==='star'){const r=o.id==='sirius'?6:4;circle(0,0,r,ink,.8);ctx.fillStyle=paint(ink);ctx.beginPath();ctx.arc(0,0,1.5,0,Math.PI*2);ctx.fill();line(-r-5,0,-r-2,0,ink,.7);line(r+2,0,r+5,0,ink,.7);line(0,-r-5,0,-r-2,ink,.7);line(0,r+2,0,r+5,ink,.7);}
 else if(o.kind==='galaxy'){const r=o.galaxy?galaxyProjection(o.galaxy).r:1.5;if(r>=5){line(-2,0,2,0,ink,.8);line(0,-2,0,2,ink,.8);}else{circle(0,0,Math.max(.8,r),ink,.9);}}
 else if(o.kind==='pulsar'||o.kind==='quasar'){circle(0,0,5,ink);circle(0,0,10,ink,.5);line(-5,18,5,-18,ink,.9);line(-8,18,0,18,ink,.7);line(0,-18,8,-18,ink,.7);}
 else if(o.kind==='blackhole'){circle(0,0,8,ink,.8);ctx.fillStyle=paint(ink);ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(0,0,17,4,-.3,0,Math.PI*2);ctx.stroke();}
 else if(o.kind==='void'||o.kind==='ring'||o.kind==='horizon'){const r=o.kind==='void'?23:o.kind==='ring'?21:13;circle(0,0,r,ink,.8,o.kind==='void'?[2,4]:[]);if(o.kind==='ring'){circle(0,0,r+4,ink,.4,[1,5]);for(let i=0;i<12;i++){const a=i*.54;ctx.fillStyle=paint(ink);ctx.fillRect(Math.cos(a)*r-1,Math.sin(a)*r-1,2,2);}}else{line(-r-5,0,r+5,0,ink,.5,[2,4]);line(0,-r-5,0,r+5,ink,.5,[2,4]);}}
 else if(o.kind==='wall'||o.kind==='arc'){ctx.beginPath();for(let i=0;i<12;i++){const x=(i-5.5)*5,y=Math.sin(i*.5)*9;i?ctx.lineTo(x,y):ctx.moveTo(x,y);ctx.fillStyle=paint(ink);ctx.fillRect(x-1.2,y-1.2,2.4,2.4);}ctx.stroke();}
 else{for(let i=0;i<11;i++){const a=i*2.4,r=4+Math.sqrt(i)*3;circle(Math.cos(a)*r,Math.sin(a)*r,1.4,ink,.7);}circle(0,0,18,ink,.4,[2,4]);}
 if(selected){for(let a=0;a<4;a++){ctx.save();ctx.rotate(a*Math.PI/2);ctx.beginPath();ctx.moveTo(21,-16);ctx.lineTo(21,-21);ctx.lineTo(16,-21);ctx.stroke();ctx.restore();}}
 ctx.restore();}
function drawObjects(){hitObjects=[];const departure=state.flight?.fromId||state.current,occupied=[];
 const priority=o=>o.id==='sgr'&&cam.span<2?90:ExtendedCatalog.background(o)?10:o.id===state.selected?100:o.id===departure?85:o.cosmicLandmark?70:o.galaxy?50:o.id==='sol'?40:20;
 const visible=[...new Map([...OBJECTS,...ExtendedCatalog.pinned.values(),...ExtendedCatalog.visible.filter(o=>!ExtendedCatalog.background(o))].map(o=>[o.id,o])).values()].filter(o=>(!o.region||o.region.major*Cosmology.regionScale(o)*.5*width/cam.span<4)&&(!ExtendedCatalog.background(o)||o.id===state.selected||o.id===state.current)&&MapDetails.visible(o,cam.span)&&(o.kind!=='horizon'||cam.span>3e10)).map(o=>({o,p:screen(o)})).filter(({p})=>p.x>-40&&p.x<width+40&&p.y>-40&&p.y<height+40).sort((a,b)=>priority(b.o)-priority(a.o)||(a.o.apparentV??20)-(b.o.apparentV??20)||a.o.id.localeCompare(b.o.id));
 for(const {o,p} of visible){const bg=ExtendedCatalog.background(o);if(!bg&&!o.nuclearStar&&occupied.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<24))continue;if(!bg)occupied.push(p);const selected=o.id===state.selected,opacity=MapDetails.opacity(o,cam.span);ctx.save();ctx.globalAlpha=opacity;if(bg){circle(p.x,p.y,3,'#969696',1);if(selected)circle(p.x,p.y,7,'#646464',.8,[2,3]);}else drawSymbol(o,p,selected);ctx.restore();hitObjects.push({o,p,r:bg?7:23,background:bg});
  // Large galaxy contours already queued their own label.
  if(!o.galaxy||galaxyProjection(o.galaxy).r<=18)MapLabels.point({key:'object-'+o.id,name:o.id==='sol'?'СОЛНЦЕ / ЗЕМЛЯ':o.name,detail:(o.id===(state.flight?.target||state.selected)?'ЦЕЛЬ · ':'')+(o.id==='sol'?'НАЧАЛО КООРДИНАТ':distanceText(o.d)),p,priority:priority(o),selected,opacity});
 }
 /* At planetary zoom, Earth is separated from Sol at one astronomical unit. */
 if(cam.span<.001){const earth=screen({x:.00001581,y:0});circle(earth.x,earth.y,4,'#252525');text('ЗЕМЛЯ / 1 а.е.',earth.x+12,earth.y-8,9,'#434343');const sun=screen({x:0,y:0});circle(sun.x,sun.y,.00001581*width/cam.span,'#c3c3c3',.7,[3,5]);}
}
function drawPhysicalSegment(from,to,color='#767676',lw=.8,dash=[5,6]){const f=state.flight,a=screen(f&&from===f.from?FlightView.at(f,0):from),b=screen(f&&from===f.from?FlightView.at(f,1):to);line(a.x,a.y,b.x,b.y,color,lw,dash);}
function drawRoute(){const f=state.flight,target=object(f?f.target:state.selected);if(!target||target.id===state.current||!target.navigable)return;
 const from=f?FlightView.at(f,0):state.ship,to=f?FlightView.at(f,1):target;drawPhysicalSegment(from,to);
 FlightMarks.draw(f);
}
function sailGeometry(radius,braking=false){const side=braking?-1:1;return{side,radius,rim:30*side,belly:54*side,tether:side*4};}
function drawShip(time){const p=screen(state.ship),f=state.flight,target=f?object(f.target):object(state.selected),ahead=f?screen(FlightView.at(f,f.covered/f.distance+1)):screen(target),angle=Number.isFinite(ahead.x)&&Number.isFinite(ahead.y)?Math.atan2(ahead.y-p.y,ahead.x-p.x):0;
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle+(state.phase==='dock'?Math.PI:0));ctx.lineWidth=.9;ctx.strokeStyle=paint('#252525');
 const braking=state.phase==='brake',sailOpen=!!f&&(state.phase==='launch'||braking);
 if(sailOpen){const g=sailGeometry([15,21,27][state.sail],braking);let opening=1;if(state.phase==='launch')opening=Math.max(.035,Math.sqrt(Stellar.sampleProper(f.wind,f.wind.elapsedProper||0).opening));const r=g.radius*opening;
  ctx.beginPath();ctx.moveTo(g.rim,-r);ctx.quadraticCurveTo(g.belly,0,g.rim,r);ctx.stroke();
  line(g.tether,0,g.rim,-r,'#555',.75);line(g.tether,0,g.rim,r,'#555',.75);line(g.tether,0,(g.rim+g.belly)/2,0,'#777',.6);
  for(let i=1;i<4;i++){const y=r*(i/4);const x=g.rim+(g.belly-g.rim)*.45*(1-(y/r)**2);line(g.tether,0,x,y,'#aaa',.4);line(g.tether,0,x,-y,'#aaa',.4);}
 }
 ctx.beginPath();ctx.fillStyle=paint('#252525');ctx.moveTo(11,0);ctx.lineTo(-3,-4);ctx.lineTo(0,0);ctx.lineTo(-3,4);ctx.closePath();ctx.fill();
 if(state.phase==='thrust'||state.phase==='dock'){const len=13+Math.sin(time*.025)*3;line(-5,-2,-len,0,'#555',.8);line(-5,2,-len,0,'#555',.8);line(-8,0,-len-6,0,'#999',.6);}
 if(braking){for(let i=0;i<15;i++){const t=((time/1000+i/15)%1),x=65-t*105,y=(i%5-2)*10;ctx.fillStyle=paint('#888');ctx.fillRect(x,y,1.4,1.4);}ctx.beginPath();ctx.ellipse(-24,0,28,35,0,1.5,4.8);ctx.setLineDash([3,5]);ctx.strokeStyle=paint('#aaa');ctx.stroke();ctx.setLineDash([]);}
 ctx.restore();if(cam.span<60000&&(!f||Math.hypot(p.x-screen(target).x,p.y-screen(target).y)>65))MapLabels.point({key:'ship',name:'КОРАБЛЬ',p,priority:35});
}
function drawEffects(dt){effects=effects.filter(e=>e.age<8);for(const e of effects){e.age+=paused?0:dt*speed;const p=screen(e);for(let k=0;k<3;k++){const r=(e.age*48+k*24)%370;circle(p.x,p.y,r,`rgba(37,38,32,${Math.max(0,.38-r/980)})`,.7,k===1?[2,6]:[]);}for(let i=0;i<40;i++){const a=i*2.399,r=e.age*25+(i%5)*9;ctx.fillStyle=paint('#8b8b8b');ctx.fillRect(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,1,1);}}}
function drawHover(){if(!hover||hover.region||['structure','wall','void','ring','arc','horizon'].includes(hover.kind))return;const p=screen(hover);circle(p.x,p.y,27,'#969696',.6,[2,4]);}

let lastFrame=performance.now();function frame(now){Cosmology.sync(state);const realDt=Math.max(0,(now-lastFrame)/1000);lastFrame=now;Simulation.advance(realDt);
 if(!document.hidden){if(cameraGoal){const a=1-Math.exp(-Math.min(realDt,.1)*8);cam.x+=(cameraGoal.x-cam.x)*a;cam.y+=(cameraGoal.y-cam.y)*a;cam.span=Math.exp(Math.log(cam.span)+(Math.log(cameraGoal.span)-Math.log(cam.span))*a);if(Math.abs(Math.log(cam.span/cameraGoal.span))<.0005&&Math.hypot(cam.x-cameraGoal.x,cam.y-cameraGoal.y)<cam.span*.0001){cam={...cameraGoal};cameraGoal=null;}}
 if(followShip){const c=shipCamera(cam.span);cam.x=c.x;cam.y=c.y;}updateZoomControl();
 ExtendedCatalog.update(now);drawGrid();MapLabels.begin();drawGalaxyBackground();RegionMap.draw();drawHorizonBoundary();Route.draw();drawRoute();drawEffects(Math.min(realDt,.1));ExtendedCatalog.drawSystems();NuclearStars.draw();drawObjects();ExtendedCatalog.draw();drawShip(now);MapLabels.draw();Route.drawEncounter();drawHover();if(now-lastUI>100){renderUI();lastUI=now;}}
 if(now-saveTick>1500){persist();saveTick=now;}requestAnimationFrame(frame);
}

canvas.addEventListener('wheel',e=>{e.preventDefault();releaseShipCamera();cameraGoal=null;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,before=world(x,y),factor=Math.exp(clamp(e.deltaY,-220,220)*.006);cam.span=clamp(cam.span*factor,.00006,1.4e11);const after=world(x,y);cam.x+=before.x-after.x;cam.y+=before.y-after.y;updateMapHeading();},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;releaseShipCamera();pointer={down:true,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,id:e.pointerId};canvas.setPointerCapture(e.pointerId);cameraGoal=null;});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(pointer.down&&e.pointerId===pointer.id){const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>5)pointer.moved=true;if(pointer.moved){cam.x-=dx*cam.span/width;cam.y-=dy*cam.span/width;canvas.style.cursor='grabbing';updateMapHeading();}pointer.x=e.clientX;pointer.y=e.clientY;}else{hover=hitObjects.find(({p,r=23})=>Math.hypot(x-p.x,y-p.y)<r)?.o||RegionMap.hit(x,y);canvas.style.cursor=hover?'pointer':'crosshair';}});
canvas.addEventListener('pointerup',e=>{if(!pointer.down||e.pointerId!==pointer.id)return;if(!pointer.moved){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const hit=hitObjects.map(h=>({...h,d:Math.hypot(x-h.p.x,y-h.p.y)})).filter(h=>h.d<(h.r||28)).sort((a,b)=>Number(!!a.background)-Number(!!b.background)||a.d-b.d)[0];if(hit)select(hit.o.id);else{const region=RegionMap.hit(x,y);if(region)select(region.id);}}pointer.down=false;canvas.style.cursor='crosshair';});
canvas.addEventListener('pointercancel',()=>{pointer.down=false;canvas.style.cursor='crosshair';});canvas.addEventListener('pointerleave',()=>hover=null);

$('zoomIn').onclick=()=>goCamera(cam.x,cam.y,cam.span/2,false,true);$('zoomOut').onclick=()=>goCamera(cam.x,cam.y,cam.span*2,false,true);$('shipBtn').onclick=focusShip;
document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{goCamera(cam.x,cam.y,Number(b.dataset.zoom),false,true);});
$('expansionToggle').addEventListener('change',e=>{state.expansion=e.target.checked;Cosmology.sync(state);FlightEstimate.idleKey=null;FlightEstimate.active=new WeakMap();renderUI();persist();});
$('zoomSlider').addEventListener('input',e=>{cameraGoal=null;const span=10**Number(e.target.value);if(followShip)cam=shipCamera(span);else cam.span=span;updateMapHeading();updateZoomControl();});
$('catalogBtn').onclick=()=>{if($('catalog').hidden)openCatalog();else closeCatalog();};$('closeCatalog').onclick=closeCatalog;$('search').oninput=()=>{ExtendedCatalog.searchLimit=100;clearTimeout(catalogTimer);catalogTimer=setTimeout(renderCatalog,160);};
$('themeBtn').onclick=()=>applyTheme(theme==='dark'?'light':'dark');
$('menuBtn').onclick=()=>{const open=$('menu').hidden;$('menu').hidden=!open;$('menuBtn').setAttribute('aria-expanded',String(open));};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.menu-popover,.menu-button'))closeMenu();});
$('catalogFilter').addEventListener('change',e=>{filter=e.target.value;ExtendedCatalog.searchLimit=100;renderCatalog();});
document.querySelectorAll('[data-departure]').forEach(b=>b.onclick=()=>{if(state.flight||!canBoost())return;state.departureMode=b.dataset.departure;renderUI();persist();});
document.querySelectorAll('[data-sail]').forEach(b=>b.onclick=()=>{if(state.flight||!canBoost())return;state.sail=+b.dataset.sail;renderUI();persist();});

$('speedBtn').onclick=()=>{syncClock();const speeds=[1,10,100,1000];speed=speeds[(speeds.indexOf(speed)+1)%speeds.length];renderUI();persist();};
document.querySelectorAll('[data-scale]').forEach(b=>b.onclick=()=>{closeCatalog();goCamera(0,0,+b.dataset.scale);});
$('launchBtn').onclick=()=>{syncClock();if(state.current===state.selected){const here=object(state.current),star=ExtendedCatalog.ensureGalaxy(here);if(star){select(star.id);ExtendedCatalog.focus(star);}else openCatalog();}else launch();};$('pauseBtn').onclick=()=>{syncClock();paused=!paused;renderUI();persist();};$('helpBtn').onclick=showHelp;$('modelBtn').onclick=showModel;$('journalBtn').onclick=showJournal;$('objectInfo').onclick=()=>showObject(state.flight?.target||state.selected);$('closeDialog').onclick=()=>$('infoDialog').close();
$('infoDialog').addEventListener('click',e=>{if(e.target===$('infoDialog')){const r=$('infoDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('infoDialog').close();}});
$('resetBtn').onclick=()=>{showDialog('<div class="modal-eyebrow">НОВАЯ ЭКСПЕДИЦИЯ</div><h2>Снова от Солнца?</h2><p>Текущий прогресс в этом браузере будет сброшен.</p><button class="modal-start" id="confirmReset">Начать заново →</button>');$('confirmReset').onclick=()=>{state=initial();paused=false;speed=1;Simulation.debt=0;Simulation.wallDebt=0;delete Simulation.smoothedFactor;lastFrame=performance.now();effects=[];goCamera(0,0,24);renderUI();persist();$('infoDialog').close();toast('Новая экспедиция. Солнечная система, нулевой год.');};};
window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea')||$('infoDialog').open)return;if(e.code==='Space'){e.preventDefault();syncClock();paused=!paused;renderUI();persist();}if(e.key==='Escape'){closeCatalog();closeMenu();}if(e.key==='+'||e.key==='=')goCamera(cam.x,cam.y,cam.span/2,false,true);if(e.key==='-')goCamera(cam.x,cam.y,cam.span*2,false,true);});
function syncClock(){const now=performance.now();Simulation.advance(Math.max(0,(now-lastFrame)/1000));lastFrame=now;}
document.addEventListener('visibilitychange',()=>{syncClock();persist();});window.addEventListener('pagehide',persist);
resize();
if(state.flight)fitRoute(object(state.flight.target));else if(state.current&&state.current!=='sol')goCamera(FlightView.ship().x,FlightView.ship().y,Math.max(object(state.current).d*2,24),true);
Route.setup();applyTheme(theme);resize();renderUI();updateMapHeading();renderCatalog();ExtendedCatalog.start();requestAnimationFrame(frame);
