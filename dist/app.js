 'use strict';
const $=id=>document.getElementById(id);
const fmt=(n,d=2)=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:d,minimumFractionDigits:d});
const compact=n=>n<0?'−'+compact(-n):n>=1e9?fmt(n/1e9,n>=1e10?1:2)+' млрд':n>=1e6?fmt(n/1e6,n>=1e7?1:2)+' млн':n>=1e3?fmt(n/1e3,1)+' тыс.':fmt(n,n<100?2:0);
const sailAreaText=m2=>fmt(m2,0)+' м²';
const collectorDiameterText=sail=>'Ø '+fmt(sail.collectorDiameterM,0)+' м';
const distanceText=n=>Number.isFinite(n)?compact(n)+' св. лет':'расстояние неизвестно';
const scaleDistanceText=n=>n<.001?(n*63241.077>=.01?fmt(n*63241.077,2)+' а.е.':fmt(n*LY/1000,0)+' км'):n<1000?fmt(n,n<1?2:0)+' св. лет':distanceText(n);
const object=id=>OBJECTS.find(o=>o.id===id)||ExtendedCatalog.get(id);
function objectTypeText(o){return !o?'':(state.destroyed.includes(o.id)&&o.kind==='star'?'ОСТАТОК ЗВЕЗДЫ':MapDetails.typeName(o))+(MapDetails.component(o)?' · компонент '+MapDetails.component(o):'');}
const distance=(a,b)=>Space.distance(a,b);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const TIME_RATES=[0,1,10,100,1000];
const SPEED_TICKS=[0,.09,.99,.999,.9999,.99999,.999999,.9999999,.99999999,.999999999];
function speedScale(beta){
 beta=clamp(beta,0,SPEED_TICKS.at(-1));const x=-Math.log1p(-beta)/Math.LN10;
 for(let i=1;i<SPEED_TICKS.length;i++)if(beta<=SPEED_TICKS[i]){const a=-Math.log1p(-SPEED_TICKS[i-1])/Math.LN10,b=-Math.log1p(-SPEED_TICKS[i])/Math.LN10;return(i-1+(x-a)/(b-a))/(SPEED_TICKS.length-1);}
 return 1;
}
function clockRate(){
 if(!state.flight&&!state.orbit)return 1;
 const beta=clamp(state.beta,0,1-Number.EPSILON);
 if(state.phase==='flyby'&&state.flight?.encounter?.plan){const p=state.flight.encounter.plan,q=Gravity.atProper(p,p.elapsedProper||0),lapse=1-p.rp/(p.q*q.r);return clamp(lapse*Math.sqrt((1-p.beta)*(1+p.beta)),0,1);}
 return Math.sqrt((1-beta)*(1+beta));
}
function renderVelocity(){
 $('velocity').innerHTML=speedNumber(state.beta)+'<small>% c</small>';
 $('velocity').title=fmt(state.beta*Rocket.c/1000,state.beta<.01?3:1)+' км/с относительно неподвижного наблюдателя';
 $('velocityFill').style.width=(speedScale(state.beta)*100)+'%';
 $('velocityBar').setAttribute('aria-valuenow',String(state.beta*100));$('velocityBar').setAttribute('aria-valuetext',percentC(state.beta));
}
const DILATION_MAX=1e8;
function dilationScale(ratio){return Math.log10(clamp(ratio,1,DILATION_MAX))/Math.log10(DILATION_MAX);}
function renderClockRatio(){
 const ratio=1/Math.max(Number.EPSILON,clockRate()),value=ratio===1?'1':compact(ratio);
 $('timeDilation').textContent=value;$('dilationUnit').textContent=ratio===1?'год наблюдателя':'лет наблюдателя';
 const position=dilationScale(ratio)*100;$('dilationFill').style.width=position+'%';$('dilationMarker').style.left=position+'%';
 $('dilationBar').setAttribute('aria-valuenow',String(Math.min(DILATION_MAX,ratio)));
 $('dilationBar').setAttribute('aria-valuetext',fmt(ratio,ratio<100?2:0)+' лет неподвижного наблюдателя за 1 год на корабле');
 $('timeDilationRow').title='Мгновенное соотношение при сохранении текущей скорости'+(state.phase==='flyby'?' и гравитационного потенциала':'')+'. Наблюдатель неподвижен в принятой системе отсчёта; направление полёта не меняет соотношение. Это не задержка радиосигнала.';
}
const STORE='parus-expedition-v1';
const G0=9.80665;
const speedDigits=beta=>beta>=.99?Math.min(14,Math.max(4,Math.ceil(-Math.log10(100*(1-beta)))+1)):2;
const speedNumber=beta=>{const [whole,fraction='']=fmt(beta*100,speedDigits(beta)).split(',');return whole+','+fraction.replace(/0+$/,'').padEnd(2,'0');};
const percentC=beta=>speedNumber(beta)+' % c';
const durationText=years=>!Number.isFinite(years)?'недостижимо':years>=1?compact(years)+' лет':years>=1/365.25?fmt(years*365.25,1)+' сут.':years>=1/(365.25*24)?fmt(years*365.25*24,1)+' ч':fmt(years*Rocket.year,0)+' с';
const massText=tonnes=>{const kg=tonnes*1000;return kg>=1?fmt(kg,3)+' кг':kg>=.001?fmt(kg*1e3,3)+' г':fmt(kg*1e6,3)+' мг';};
let theme=document.documentElement.dataset.theme||'dark';
function applyTheme(value){theme=value;document.documentElement.dataset.theme=value;const label=value==='dark'?'Включить светлую тему':'Включить тёмную тему';$('themeBtn').setAttribute('aria-label',label);$('themeBtn').title=label;$('themeBtn').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#theme-'+(value==='dark'?'light':'dark')+'-icon"/></svg>';const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=value==='dark'?'#000000':'#f6f6f6';try{localStorage.setItem('parus-theme',value);}catch{}}
// Map the existing engineering ink palette to a neutral dark drawing palette.
function paint(color){if(theme==='light')return color;if(color==='#f8f8f8')return '#000000';if(color.startsWith('rgba'))return color.replace('37,38,32','218,218,218');const h=color.slice(1);if(!/^[0-9a-f]{3,6}$/i.test(h))return color;const hex=h.length===3?[...h].map(c=>c+c).join(''):h;return '#'+[0,2,4].map(i=>(255-parseInt(hex.slice(i,i+2),16)).toString(16).padStart(2,'0')).join('');}
let state,paused=false,speed=1,filter='all',toastTimer,hover=null,hitObjects=[],lastUI=0,saveTick=0;
const initial=()=>({version:13,flightDefaultsVersion:1,orbit:null,tankCapacityKg:1,flightSetup:null,jettisoned:0,controlG:100,current:'sol',selected:'alpha',sail:0,lightModel:5,departureMode:OrbitalArrival.enabled?'beam':'engine',expansion:true,cosmicTime:0,universeElapsed:0,beta:0,acceleration:0,matter:Rocket.initialFuel,captured:0,spentEnergy:0,heatRadiated:0,earth:0,proper:0,totalDistance:0,ship:Space.point([0,0,0]),itinerary:[],visited:['sol'],destroyed:[],phase:'idle',flight:null,auto:true,journal:[{t:0,text:'Ковчег — 01. Сухая масса: 1 кг, включая парус Si₃N₄ 0,785 кг. Топливо: 1 / 1 кг. Фотонный двигатель готов.'}]});
function restore(saved){
 if(!saved||![1,2,3,4,5,6,7,8,9,10,11,12,13].includes(saved.version)||!saved.ship||!Array.isArray(saved.visited))return initial();
 saved=JSON.parse(JSON.stringify(saved));ExtendedCatalog.restore(saved);
 for(const id of new Set([saved.current,saved.selected,saved.flight?.target,saved.flight?.fromId,...(saved.flight?.route||[]).map(n=>n.id),...(saved.itinerary||[]).map(n=>n.id)]))if(id&&!object(id)){const old=RETIRED_OBJECTS.find(o=>o.id===id);if(old)OBJECTS.push({...old,index:OBJECTS.length,retired:true});}
 const upgraded={...initial(),...saved,version:13,flightDefaultsVersion:1,lightModel:5,sail:0,controlG:100,auto:true};
 if(!['engine','beam','burst'].includes(upgraded.departureMode))upgraded.departureMode='engine';
 upgraded.matter=Rocket.usableFuel(upgraded.matter);
 if(!object(upgraded.selected))upgraded.selected=object(upgraded.current)?.id||'proxima';
 upgraded.universeElapsed=Number.isFinite(saved.universeElapsed)?saved.universeElapsed:Math.max(0,upgraded.earth);
 upgraded.destroyed=(upgraded.destroyed||[]).filter(id=>id!=='sol');
 if(upgraded.flight?.mission?.setup?.burst&&upgraded.flight.fromId==='sol'){const f=upgraded.flight;delete f.mission;f.wind=null;f.engine=null;f.magnetic=null;f.departureMode='beam';f.boost=false;upgraded.phase='cruise';upgraded.acceleration=0;}
 if(upgraded.current==='sol'&&upgraded.departureMode==='burst')upgraded.departureMode='beam';
 if(saved.version<11){
  if(saved.version<10){
  const oldCapacity=saved.version>=7?1e-9:saved.version===6?.001:Math.max(.001,saved.matter||.001);
  upgraded.matter=Rocket.fuelCapacity*Math.max(0,Math.min(1,(saved.matter||0)/oldCapacity));
  }
  const f=upgraded.flight;
  if(f&&upgraded.phase!=='flyby'){
   const goal=object(f.target),source=object(f.fromId),remaining=f.distance-f.covered;
   f.medium=GasMedium.forLeg(f.from||upgraded.ship,goal,0);f.markers=[];delete f.manualCoast;
   if(upgraded.phase==='launch'&&f.fromId==='sol'&&!f.wind?.continuous){
    upgraded.phase='cruise';upgraded.acceleration=0;f.departureMode='beam';f.windFolded=true;f.replayRate=1;
   }else if(upgraded.phase==='launch'&&saved.version<10){
    const old=f.wind,q=old?.rows?Stellar.sampleProper(old,old.elapsedProper||0):null,spent=(old?.sourceOffset||0)+(q?.source||0),mode=old?.continuous?'beam':'burst';
    if(f.profile?.actual?.acceleration==null&&q){f.profile??={actual:{}};f.profile.actual.acceleration={distance:q.distance,proper:q.proper,maxG:FlightProfile.peakWind(old,q.proper)};}
    f.wind=Stellar.sourcePlan(source,mode,(Rocket.dryMass+upgraded.matter)*1000,Math.max(0,remaining),upgraded.beta,q?.r||Stellar.r0,100,mode==='beam'?Infinity:Math.max(0,Stellar.pulseYears-spent),upgraded.cosmicTime||0,f.cosmic,upgraded.expansion!==false);
    Object.assign(f.wind,{sourceOffset:spent,baseCovered:f.covered,elapsedProper:0});f.maxBeta=f.wind.beta;f.replayRate=f.wind.proper/5;f.departureMode=mode;
   }else if(upgraded.phase==='thrust'&&saved.version<10){
    f.engine=Rocket.plan(upgraded.matter,remaining,upgraded.beta);f.engine.baseCovered=f.covered;f.maxBeta=f.engine.beta;f.replayRate=f.engine.burnProper/5;
   }else if(['brake','dock'].includes(upgraded.phase)){
    f.engine=null;f.magnetic=HybridBrake.plan((Rocket.dryMass+upgraded.matter)*1000,upgraded.beta,Magnetic.rho(f.medium.n)*f.medium.area);f.replayRate=f.magnetic.proper/3;upgraded.phase='brake';
    if(remaining*Cosmology.factor(f,upgraded.cosmicTime||0)>f.magnetic.distance*(1+1e-9)){upgraded.phase='cruise';upgraded.acceleration=0;f.magnetic=null;f.autoStopping=false;f.replayRate=1;}
   }
   if(f.profile){f.profile.phase=null;f.profile.replan=true;f.profile.braking=null;}
  }
  upgraded.journal.push({t:upgraded.earth,text:'Модель обновлена: сухая масса 1 кг, бак 1 кг, парус Si₃N₄ Ø 100 м, зеркало Ø 1 км. Доля топлива, скорость, координаты и исторические часы сохранены. Остаток топлива не ограничивает возможность миссии. Вспышка Солнца запрещена.'});
 }
 const gasFlight=upgraded.flight;
 if(gasFlight&&!gasFlight.mission&&gasFlight.medium?.model!==GasMedium.model){
  gasFlight.medium=GasMedium.forLeg(gasFlight.from||upgraded.ship,object(gasFlight.target));
  gasFlight.markers=[];
  if(upgraded.phase==='brake'){
   gasFlight.magnetic=HybridBrake.plan((Rocket.dryMass+upgraded.matter)*1000,upgraded.beta,Magnetic.rho(gasFlight.medium.n)*gasFlight.medium.area);
   gasFlight.replayRate=gasFlight.magnetic.proper/3;
   const remaining=gasFlight.distance-gasFlight.covered;
   if(remaining*Cosmology.factor(gasFlight,upgraded.cosmicTime||0)>gasFlight.magnetic.distance*(1+1e-9)){upgraded.phase='cruise';upgraded.acceleration=0;gasFlight.magnetic=null;gasFlight.autoStopping=false;gasFlight.replayRate=1;}
  }
  if(gasFlight.profile){gasFlight.profile.phase=null;gasFlight.profile.replan=true;gasFlight.profile.braking=null;}
 }
 if(upgraded.orbit&&(upgraded.flight||upgraded.current!==upgraded.orbit.targetId||!Number.isFinite(upgraded.orbit.radius)||!(upgraded.orbit.radius>0)||!Number.isFinite(upgraded.orbit.beta)||!(upgraded.orbit.beta>0&&upgraded.orbit.beta<1)||!Array.isArray(upgraded.orbit.radial)||!Array.isArray(upgraded.orbit.tangent)))upgraded.orbit=null;
 if(upgraded.transferSetup?.setup){upgraded.flightSetup=FlightSetup.normalize(upgraded.transferSetup.setup);upgraded.transferSetup=null;}
 if(!upgraded.flight)upgraded.beta=upgraded.orbit?.beta||0;
 if(upgraded.orbit){const o=upgraded.orbit,host=object(o.targetId);if(host?.p3){const angle=o.angle||0,radial=V3.add(V3.mul(o.radial,Math.cos(angle)),V3.mul(o.tangent,Math.sin(angle)));upgraded.ship=Space.point(V3.add(host.p3,V3.mul(radial,o.radius/LY)));}}
 if(upgraded.flight&&!('cosmic' in upgraded.flight))upgraded.flight.cosmic=Cosmology.isCosmic(object(upgraded.flight.fromId)||upgraded.flight.from,object(upgraded.flight.target));
 return Route.sanitize(upgraded);
}

try{state=restore(JSON.parse(localStorage.getItem(STORE)));}catch{state=initial();}
FlightSetup.sync();
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
function updateShipButton(){$('shipBtn').innerHTML=followShip?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5M12 6l5 12-5-3-5 3Z"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>';$('shipBtn').setAttribute('aria-label',followShip?'Отключить слежение за кораблём':'Центрировать на корабле');$('shipBtn').classList.toggle('active',followShip);$('shipBtn').setAttribute('aria-pressed',String(followShip));$('shipBtn').title=followShip?'Камера следует за кораблём · нажмите для отключения':shipFocusArmed?'Нажмите ещё раз, чтобы следовать за кораблём':'К кораблю';}
function releaseShipCamera(){followShip=false;shipFocusArmed=false;updateShipButton();}
// Presets and handle share the same piecewise logarithmic scale.
const zoomStops=[{value:0,span:.00006},{value:1,span:24},{value:2,span:130000},{value:3,span:3e7},{value:4,span:5e9},{value:5,span:115e9},{value:5.15,span:1.4e11}];
function zoomInterpolate(input,from,to){
 const n=clamp(input,zoomStops[0][from],zoomStops.at(-1)[from]);
 const i=Math.max(1,zoomStops.findIndex(stop=>stop[from]>=n)),a=zoomStops[i-1],b=zoomStops[i];
 const fraction=from==='span'?Math.log(n/a.span)/Math.log(b.span/a.span):(n-a.value)/(b.value-a.value);
 return to==='span'?a.span*(b.span/a.span)**fraction:a.value+(b.value-a.value)*fraction;
}
function gridMetrics(view=cam,viewportWidth=width){
 const unit=nice(view.span*128/Math.max(1,viewportWidth)),majorPixels=unit*viewportWidth/view.span;
 return{unit,majorPixels,minorUnit:unit/5,minorPixels:majorPixels/5};
}
function gridUnit(){return gridMetrics().unit;}
function updateZoomControl(){
 const span=cam.span;
 $('zoomSlider').value=String(zoomInterpolate(span,'span','value'));
 $('zoomSlider').setAttribute('aria-valuetext','Ширина карты: '+distanceText(span));

 $('mapLayersReadout').textContent=MapLayers.readout();
 const measure=gridMetrics();$('zoomDivision').textContent=scaleDistanceText(measure.unit);$('mapScaleLine').style.width=measure.majorPixels+'px';$('mapScale').setAttribute('aria-label','Один крупный шаг сетки: '+scaleDistanceText(measure.unit));
 document.querySelectorAll('[data-zoom]').forEach(b=>{const active=Math.abs(Math.log(span/Number(b.dataset.zoom)))<.04;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
}
function updateTimeControl(){
 const value=paused?0:speed;$('timeSlider').value=String(TIME_RATES.indexOf(value));
 $('timeSlider').setAttribute('aria-valuetext',value===0?'Пауза':value+'×');
 document.querySelectorAll('[data-time]').forEach(button=>{const active=Number(button.dataset.time)===value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
}
function setTimeRate(value){
 const rate=Number(value);if(!TIME_RATES.includes(rate))return;syncClock();
 if(rate===0)paused=true;else{speed=rate;paused=false;}
 renderUI();persist();
}
function fitRoute(target){
 if(width<=0||height<=0||!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))return;const a=FlightView.ship(),b=MapLayout.project(target),v=routeViewport(),current=cameraGoal||cam;
 const sx=p=>width*.43+(p.x-current.x)*width/current.span,sy=p=>height*(width<700?.39:.50)+(p.y-current.y)*width/current.span;
 if([a,b].every(p=>sx(p)>=v.left&&sx(p)<=v.right&&sy(p)>=v.top&&sy(p)<=v.bottom))return;
 const span=Math.max(current.span,Math.abs(a.x-b.x)*width/(v.right-v.left)*1.25,Math.abs(a.y-b.y)*width/(v.bottom-v.top)*1.25);
 goCamera((a.x+b.x)/2-((v.left+v.right)/2-width*.43)*span/width,(a.y+b.y)/2-((v.top+v.bottom)/2-height*(width<700?.39:.50))*span/width,span);
}
function select(id,fit=false){const o=object(id);if(!o)return;ExtendedCatalog.pin(o);ExtendedCatalog.ensureGalaxy(o);state.selected=id;renderUI();if(fit)fitRoute(o);renderCatalog();persist();if(state.flight&&!Route.picking)showObject(id);}
let compactMapControls=null;
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);const controls=document.querySelector('.map-controls'),compact=width<700;if(controls&&compact!==compactMapControls){controls.open=!compact;compactMapControls=compact;}}
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
}
function canBoost(mode=state.departureMode){const current=object(state.current);return !!current&&['star','home'].includes(current.kind)&&!state.destroyed.includes(current.id)&&!(mode==='burst'&&current.id==='sol');}
function wantsBoost(){return canBoost()&&state.departureMode!=='engine';}
const windCache=new Map();
function windPlan(index=0){
 const source=object(state.current)||object(state.flight?.fromId),goal=object(state.selected),mass=(Rocket.dryMass+state.matter)*1000,g=100,d=goal?.p3?distance(state.ship,goal):0,mode=state.departureMode==='beam'?'beam':'burst',key=[source?.id,goal?.id,mass,d,mode,Math.floor((state.cosmicTime||0)/1000),state.expansion].join(':');
 if(!windCache.has(key)){if(windCache.size>12)windCache.clear();windCache.set(key,Stellar.sourcePlan(source,mode,mass,d,0,Stellar.r0,g,null,state.cosmicTime||0,Cosmology.isCosmic(source||state.ship,goal),state.expansion!==false));}return windCache.get(key);
}
function quantity(n){const abs=Math.abs(n);if(abs!==0&&(abs>=1e3||abs<.01)){const e=Math.floor(Math.log10(abs));return fmt(n/10**e,1)+'·10'+String(e).replace(/[0-9-]/g,c=>({'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'}[c]));}return fmt(n,2);}
function renderAcceleration(){
 const actual=state.flight?(state.acceleration||0)/G0:0,g=Math.abs(actual)<1e-8?0:actual,visible=clamp(g,-100,100),label=(g>0?'+':'')+fmt(g,2)+' g';
 $('acceleration').innerHTML=(g>0?'+':'')+fmt(g,2)+'<small>g</small>';
 $('accelerationFill').style.left=(visible<0?50+visible/2:50)+'%';$('accelerationFill').style.width=(Math.abs(visible)/2)+'%';
 $('accelerationBar').setAttribute('aria-valuenow',String(visible));$('accelerationBar').setAttribute('aria-valuetext',label);$('accelerationBar').title='Текущее собственное ускорение: '+label;
}
function profileDistance(d){return d<.01?fmt(d*63241.077,d*63241.077<10?2:0)+' а.е.':distanceText(d);}
function renderFlightProfile(eta){
 const p=FlightProfile.get(eta);$('flightProfile').hidden=!p;if(!p)return;
 for(const [key,label] of [['acceleration','Разгон'],['braking','Торможение']]){const q=p[key],prefix=key==='acceleration'?'boost':'stop';$(''+prefix+'Stage').textContent=label+(q?.actual?' · факт':q?.remainingOnly?' · осталось':' · ≈');$(''+prefix+'Distance').textContent=q?profileDistance(q.distance):'—';$(''+prefix+'Proper').textContent=q?durationText(q.proper):p.flyby?'пролёт':p.unreachable?'нет прибытия':'—';$(''+prefix+'Peak').textContent=q?fmt(q.maxG,2)+' g':'—';}
}
function gammaText(beta){
 if(!Number.isFinite(beta))return '—';
 const gamma=1/Math.sqrt((1-beta)*(1+beta)),delta=2*Math.sinh(Math.atanh(beta)/2)**2;
 if(beta>0&&delta<1e-8){const e=Math.floor(Math.log10(delta));return '1 + '+fmt(delta/10**e,2)+'·10^'+e;}
 return fmt(gamma,gamma<1.01?8:gamma<2?5:2);
}
function renderDepartureDiagram(forecast,wind){
 const mode=wind?(wind.continuous?'beam':'burst'):'engine',peak=forecast?.peakBeta;
 const known=Number.isFinite(peak),boost=forecast?.acceleration;
 $('departureDiagramTitle').textContent={engine:'РАЗГОН · СОБСТВЕННАЯ ТЯГА',beam:'РАЗГОН · СВЕТ ЗВЕЗДЫ',burst:'РАЗГОН · ЗВЁЗДНАЯ ВСПЫШКА'}[mode];
 $('sailGamma').textContent=gammaText(peak);
 $('departureSpeed').textContent=known?'≈ '+percentC(peak):'—';
 $('departureGamma').title='Лоренц-фактор при прогнозной скорости в конце разгона, относительно неподвижного наблюдателя. γ = 1 / √(1 − β²).';
 $('departureDistance').textContent=boost?'Путь разгона ≈ '+profileDistance(boost.distance)+' · '+durationText(boost.proper)+' на борту':'Нет прогноза разгона';
 const ship='<path d="m258 59 16 5-16 5 4-5Z"/><path d="M301 64h28m-5-4 5 4-5 4"/>';
 const sail='<path d="M286 44q14 20 0 40m0-40-13 20 13 20"/><text x="289" y="102" text-anchor="middle">парус</text><text x="289" y="117" text-anchor="middle">Ø 100 м</text>';
 // A spherical wavefront with a compact core, drawn like the other chart symbols.
 const star=mode==='burst'?'<circle cx="35" cy="64" r="4"/><circle cx="35" cy="64" r="12"/><circle cx="35" cy="64" r="23" stroke-dasharray="2 3"/><path d="M35 32v7m0 50v7M3 64h7m50 0h7M12 41l5 5m36 36 5 5M12 87l5-5m36-36 5-5"/>':'<circle cx="35" cy="64" r="12"/><path d="M35 42v-7m0 58v-7M13 64H6m58 0h-7"/>';
 const optical=star+'<text x="35" y="18" text-anchor="middle">'+(mode==='burst'?'вспышка':'звезда')+'</text><path d="M68 56 107 48m-39 16h43m-43 8 39 8M112 43q14 21 0 42"/><text x="114" y="102" text-anchor="middle">коллектор</text><text x="114" y="117" text-anchor="middle">Ø 1 км</text><path d="M128 56h117m-117 8h117m-117 8h117" stroke-dasharray="4 4"/><text x="186" y="38" text-anchor="middle">пучок →</text><path d="M35 124v10m77-10v10M35 129h77m-72-3-5 3 5 3m67-6 5 3-5 3"/><text x="73" y="151" text-anchor="middle">'+fmt(wind?.collectorR/Stellar.r0,2)+' а.е.</text>';
 const engine='<path d="m241 54-22 10 22 10m-9-20-28 10 28 10" stroke-dasharray="3 3"/><text x="216" y="36" text-anchor="middle">фотоны ←</text><text x="280" y="102" text-anchor="middle">двигатель</text><path d="M35 64h148" stroke-dasharray="2 5"/><circle cx="35" cy="64" r="3"/><text x="35" y="36" text-anchor="middle">старт</text><text x="170" y="137" text-anchor="middle">парус сложен · расход топлива</text>';
 $('sailDiagram').innerHTML=(mode==='engine'?engine:optical)+ship+(mode==='engine'?'':sail);
 $('sailDiagram').setAttribute('aria-label',mode==='engine'?'Фотонный двигатель выбрасывает свет назад и разгоняет корабль; парус сложен':(mode==='burst'?'Вспышка':'Свет звезды')+' → зеркало-коллектор → направленный пучок → парус корабля. Расстояние от звезды до коллектора '+fmt(wind.collectorR/Stellar.r0,2)+' а.е.');
}
function renderUI(){
 FlightSetup.sync();Cosmology.sync(state);$('expansionToggle').checked=state.expansion!==false;$('expansionFactor').textContent=(state.expansion!==false?'ВКЛ':'ВЫКЛ')+' · a = '+fmt(Cosmology.scale(),Cosmology.scale()<10?6:2);
 const f=state.flight,target=object(f?f.target:state.selected),current=object(state.current),active=!!f,boost=wantsBoost(),arrived=!active&&state.current===target.id;
 $('targetName').textContent=target.name;$('targetType').textContent=objectTypeText(target);$('targetVisited').hidden=!state.visited.includes(target.id);
 $('flightCard').classList.toggle('in-flight',active);$('shipLocation').textContent=current?'Стоянка · '+current.name:active?'В пути · '+(object(f.fromId)?.name||'Межзвёздное пространство'):'Межзвёздное пространство';
 $('shipLocationType').textContent=objectTypeText(current)+(state.orbit&&current?' · орбита '+fmt(state.orbit.radius/Stellar.r0,2)+' а.е.':'');$('shipLocationType').hidden=!current;$('findDepartureStar').hidden=active||!current||canBoost('beam');$('findDepartureStarCard').hidden=$('findDepartureStar').hidden;$('shipLocation').title=current?current.name+' · '+objectTypeText(current):$('shipLocation').textContent;
 const d=target.navigable?Cosmology.physicalDistance(state.ship,target):NaN;$('targetDistance').innerHTML=Number.isFinite(d)?compact(d)+' <small>св. лет</small>':'<small>Расстояние неизвестно</small>';
 $('departureSection').hidden=active||arrived||!target.navigable;document.querySelectorAll('[data-departure]').forEach(b=>{const on=(state.departureMode||'burst')===b.dataset.departure;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));b.hidden=b.dataset.departure==='burst'&&current?.id==='sol';b.disabled=b.dataset.departure!=='engine'&&!canBoost(b.dataset.departure);});
 const planningBoost=!MissionPlanner.enabledIdle()&&!state.flightSetup&&!active&&boost&&!arrived&&target.navigable;$('sailSection').hidden=!planningBoost;
 const sail=SAILS[0];
 if(planningBoost){const predicted=windPlan(),light=Stellar.stellarLight(current);$('sourceStarName').textContent='Источник: '+current.name;$('sailArea').textContent='Парус Ø 100 м · коллектор Ø 1 км';$('sailArea').title='Si₃N₄ · 0,1 г/м² · масса плёнки 0,785 кг';
  const sourceRow=(label,value)=>'<div><dt>'+label+'</dt><dd>'+value+'</dd></div>';
  $('sourceReadout').innerHTML='<p class="source-basis">'+(predicted.continuous?(light.estimated?'Оценка по типу звезды':'Каталожная болометрическая светимость'):'Модельная вспышка · 30 суток у источника')+'</p><dl class="source-specs">'+sourceRow('Светимость',quantity(predicted.luminosityW)+' Вт')+sourceRow('В единицах Солнца',quantity(predicted.luminosityW/3.828e26)+' L☉')+sourceRow('Звезда → коллектор',fmt(predicted.collectorR/Stellar.r0,2)+' а.е.')+sourceRow('Пучок к парусу',quantity(predicted.beamPower)+' Вт')+'</dl>';
 }
 const departurePreview=!MissionPlanner.enabledIdle()&&!state.flightSetup&&!active&&!arrived&&target.navigable;
 $('departureDiagram').hidden=!departurePreview;
 if(departurePreview)renderDepartureDiagram(FlightEstimate.get(),planningBoost?windPlan():null);


 const photon=(state.phase==='thrust'||state.phase==='dock')&&f?.engine,wind=state.phase==='launch'&&f?.wind,mag=state.phase==='brake'&&f?.magnetic;
 const planningEngine=!MissionPlanner.enabledIdle()&&!state.flightSetup&&!active&&!boost&&!arrived&&target.navigable;$('engineSection').hidden=!(planningEngine||photon||wind||mag||state.phase==='flyby');$('burnTrack').hidden=!photon;
 if(planningEngine){const e=Rocket.plan(state.matter,d);$('engineLabel').textContent='ФОТОННАЯ ТЯГА · ДО 100 g';$('engineReadout').innerHTML='Масса <b>'+massText(Rocket.dryMass)+' + '+massText(state.matter)+'</b><br>Разгон <b>до '+massText(e.budget)+' → '+percentC(e.beta)+'</b>';}
 if(photon){const e=f.engine;$('engineLabel').textContent=e.direction<0?'ОБРАТНАЯ ФОТОННАЯ ТЯГА':'АННИГИЛЯЦИЯ ВЕЩЕСТВА';$('engineReadout').innerHTML='Расход <b>'+massText(e.burned)+' / '+massText(e.budget)+'</b><br>Энергия <b>'+quantity(e.energy/1e15)+' ПДж</b>';$('burnBar').style.width=(e.budget?100*e.burned/e.budget:0)+'%';}
 if(wind){const sample=f.wind.lastSample||Stellar.sampleProper(f.wind,f.wind.elapsedProper||0),r=sample.r,force=sample.force;$('engineLabel').textContent=(f.wind.continuous?'СВЕТ ЗВЕЗДЫ':'СВЕТ ВСПЫШКИ')+' · РАСКРЫТИЕ '+fmt(sample.opening*100,2)+'%';$('engineReadout').innerHTML='До звезды <b>'+compact(r/Stellar.r0)+' а.е.</b><br>Сила <b>'+quantity(force)+' Н</b><br>Свет испущен на <b>'+fmt(((f.wind.sourceOffset||0)+sample.source)*365.25,2)+(f.wind.continuous?' сут.</b> непрерывного излучения':' / 30 сут.</b> вспышки');}
 if(mag){const rates=f.magnetic.lastSample||ProperTime.at(f.magnetic,Magnetic,f.magnetic.elapsedProper||0);$('engineLabel').textContent='ПАРУС + ОБРАТНАЯ ТЯГА';$('engineReadout').innerHTML=f.medium.label+'<br>В баке <b>'+massText(state.matter)+'</b><br>Мощность двигателя <b>'+quantity(rates.enginePower||0)+' Вт</b><br>Суммарное торможение <b>'+fmt(-rates.properAcceleration/G0,2)+' g</b>';}

 if(state.phase==='flyby'){const p=f.encounter.plan,local=Gravity.atProper(p,p.elapsedProper||0);$('engineLabel').textContent='ГРАВИТАЦИОННЫЙ ПРОЛЁТ · 0 g';$('engineReadout').innerHTML='Поворот <b>'+Route.angleText(p.angle)+'</b><br>Перицентр <b>'+Route.radiusText(p.rp)+'</b><br>Локальная скорость <b>'+percentC(local.localBeta)+'</b>';}
 $('routeCount').textContent=(f?.route?.length||state.itinerary.length)||'';
 let action,hint;
 if(active){action='';hint=f.missed?'Цель пройдена. Остановка потребует оставшегося тормозного пути.':state.phase==='thrust'?'Двигатель расходует массу. Скорость растёт по ракетному уравнению.':state.phase==='launch'?(f.wind?.beamPower?'Пучок не расходится. Доплеровское ослабление растёт со скоростью.':'Парус Ø 100 м. Поток слабеет как 1/r² и из-за эффекта Доплера.'):state.phase==='brake'?'Парус собирает газ, двигатель расходует часть потока на обратную тягу. Остаток топлива зависит от траектории.':state.phase==='dock'?'Торможение парусом ослабло. Последнюю скорость гасит двигатель обратной тягой.':'Инерционный полёт. Тормозной путь рассчитывается по текущей скорости и массе.';}
 else if(arrived){action=target.departureStar?'Найти звезду для разгона':'Выбрать следующую цель';hint=boost?'Прибытие. Выберите цель — и подготовьте звёздный парус.':'Прибытие. Следующая точка ждёт в атласе.';}
 else if(!target.navigable){action='Ориентир атласа';hint=target.atlasOnly?'Положение недостаточно точное для карты и полёта. Объект сохранён в атласе.':'Область атласа с условным положением; физический маршрут не назначается.';}
 else if(boost){action=state.departureMode==='beam'?'Лететь на парусе':'Взорвать и лететь';hint=state.departureMode==='beam'?'Свет звезды · топливо сохраняется.':'Звезда будет уничтожена · топливо сохраняется.';}
 else{action='Лететь на тяге';hint=Rocket.usableFuel(state.matter)>0?'Топливо расходуется · торможение автоматически.':'Запас рабочего вещества исчерпан.';}
 $('launchBtn').hidden=active;$('launchBtn').querySelector('span').textContent=action;$('launchBtn').disabled=!target.navigable||!arrived&&!boost&&!Rocket.usableFuel(state.matter);$('flightHint').textContent=hint+(target.positionQuality==='approximate'?' Позиция приблизительная.':'');
 const phases={thrust:'ФОТОННАЯ ТЯГА',launch:'РАЗГОН СВЕТОМ',cruise:'ИНЕРЦИОННЫЙ ПОЛЁТ',brake:'ПАРУС + ОБРАТНАЯ ТЯГА',dock:'ТОЧНАЯ ОСТАНОВКА',flyby:'ГРАВИТАЦИОННЫЙ ПРОЛЁТ'};
 $('phaseTag').textContent=paused?'ПАУЗА':active?phases[state.phase]:arrived?'ВЫ ЗДЕСЬ':'ЦЕЛЬ';
 $('flightControls').hidden=!active;
 const eta=FlightEstimate.get();$('horizonNotice').hidden=!eta?.unreachable;$('horizonNotice').textContent=eta?.unreachable?'При включённом расширении прибытие недостижимо. Можно лететь в направлении цели.':'';$('arrivalEstimate').hidden=arrived||!target.navigable;
 $('arrivalFuelRow').hidden=Route.isFlyby();$('arrivalFuel').textContent=Number.isFinite(eta?.arrivalFuelKg)?fmt(eta.arrivalFuelKg,3)+' кг':'—';
 $('arrivalLabel').textContent=Route.isFlyby()?'ДЛИТЕЛЬНОСТЬ ДО ПРОЛЁТА':'ДЛИТЕЛЬНОСТЬ ПОЛЁТА';
 $('arrivalProper').textContent=eta?durationText(eta.proper):'—';$('arrivalEarth').textContent=eta?durationText(eta.earth):'—';
 renderFlightProfile(eta);
 $('flightDetails').hidden=arrived||!target.navigable;
 $('arrivalFuel').title=Number.isFinite(eta?.arrivalFuelKg)?fmt(eta.arrivalFuelKg/(Rocket.fuelCapacity*1000)*100,1)+'% бака':'';
 renderVelocity();renderAcceleration();renderClockRatio();renderReachability();
 $('matter').innerHTML=fmt(state.matter*1000,3)+' / '+fmt(Rocket.fuelCapacity*1000,Rocket.fuelCapacity===.001?0:2)+'<small>кг</small>';$('dryMass').innerHTML='1<small>кг</small>';
 const dryWidth=Rocket.dryMass/(Rocket.dryMass+Rocket.fuelCapacity)*100,fuelWidth=state.matter/(Rocket.dryMass+Rocket.fuelCapacity)*100;
 $('massDry').style.width=dryWidth+'%';$('massFuel').style.width=fuelWidth+'%';$('massTotal').textContent=massText(Rocket.dryMass+state.matter);
 $('massBar').setAttribute('aria-label','Сухая масса 1 кг; топливо '+fmt(state.matter*1000,3)+' из '+fmt(Rocket.fuelCapacity*1000,3)+' кг; свободно '+fmt((Rocket.fuelCapacity-state.matter)*1000,3)+' кг');
 $('massBar').title='Сухая масса 1 кг | Топливо '+massText(state.matter)+' | Свободно '+massText(Rocket.fuelCapacity-state.matter);
 const rate=Simulation.replayRate();$('timeRate').textContent=paused?'Пауза':rate<speed?'СЛОУМО ×'+compact(speed/rate):'1 с = '+fmt(speed,0)+(speed===1?' год':' лет')+' на борту';$('timeRate').classList.toggle('replaying',rate<speed);

 const cosmicYears=Math.floor(state.universeElapsed??state.earth);$('universeClock').textContent=fmt(13800000000+cosmicYears,0);
 $('earthClock').innerHTML=fmt(Math.floor(state.earth),0)+'<small>лет</small>';$('shipClock').innerHTML=fmt(Math.floor(state.proper),0)+'<small>лет</small>';
 const pct=f?Math.min(100,f.covered/f.distance*100):0;$('progressBar').style.width=pct+'%';$('progressValue').textContent=fmt(pct,1)+'%';$('progressLabel').textContent=f?.route?.length?'УЧАСТОК '+(f.legIndex+1)+' / '+f.route.length:f?.missed?'ПРОЛЁТ ЦЕЛИ':'ПРОЙДЕНО';updateTimeControl();
 FlightBuilder.renderCard(target,arrived,eta);
}

const FlightBuilder={
 routeSamplesCache:new WeakMap(),
 draft:null,readOnly:false,
 sanitizeDraft(){if(this.readOnly)return;if(OrbitalArrival.enabled)this.draft=FlightSetup.resolve(this.draft,this.source);else if(!this.starAvailable)Object.assign(this.draft,{sail:false,collector:false,burst:false});},
 open(){
  this.readOnly=!!state.flight;this.preferred=OrbitalArrival.enabled?FlightSetup.preferred():FlightSetup.read();this.changedKeys=new Set();this.draft=FlightSetup.read();this.fuelBounds=null;this.source=object(state.current||state.flight?.fromId);this.light=Stellar.stellarLight(this.source);
  this.starAvailable=!!this.source&&['star','home'].includes(this.source.kind)&&(!state.destroyed.includes(this.source.id)||this.readOnly&&this.draft.burst);
  this.sanitizeDraft();
  if(!this.readOnly&&this.source?.id==='sol')this.draft.burst=false;
  $('builderTitle').textContent='План полёта';$('builderRoute').textContent=(this.source?.name||'Текущая позиция')+' → '+object(state.flight?.target||state.selected).name;
  $('builderSource').textContent=this.source?.name||'В точке старта нет звезды';
  $('setupStarMass').value=this.draft.massSolar??MapDetails.mass(this.source)??'';$('setupLuminosity').value=this.draft.luminositySolar??this.light.solar;
  for(const [id,key] of [['setupDensity','densityCm3'],['setupCapacity','capacityKg']])$(id).value=this.draft[key];
  $('applyFlightSetup').hidden=this.readOnly;$('launchConfigured').hidden=this.readOnly;$('builderReadOnly').hidden=!this.readOnly;
  if(!this.readOnly&&this.draft.arrivalFuelPercent===null){const old=MissionPlanner.preview(this.draft);this.draft.arrivalFuelPercent=this.draft.fill&&old.valid?Math.floor(old.arrivalFuelKg/this.draft.capacityKg*10000)/100:0;}
  this.render();$('flightBuilder').showModal();
  $('flightBuilder').querySelector('.builder-grid').scrollTop=0;
 },
 changed(e){
  if(this.readOnly)return;const key=e.dataset.setup;this.changedKeys?.add(key);
  if(e.type==='checkbox'){
   this.draft[key]=e.checked;
   if(key==='sail'&&!e.checked){this.draft.collector=false;this.draft.burst=false;}

  }else if(key==='burstSpectrum'){this.draft[key]=e.value;
  }else if(key==='arrivalFuelPercent'){
   this.draft.arrivalFuelPercent=Math.max(0,Math.min(this.fuelBounds?.maxPercent||0,Number(e.value)||0));this.draft.fill=this.draft.arrivalFuelPercent>0;
  }else{
   if(e.value===''&&['massSolar','luminositySolar'].includes(key)){this.draft[key]=null;this.render();return;}
   const n=Number(e.value);if(e.value===''||!Number.isFinite(n)||!e.checkValidity()){this.render();return;}this.draft[key]=n;
  }
  this.draft=FlightSetup.normalize(this.draft);this.render();
 },
 render(){
  this.sanitizeDraft();
  $('setupBurstSpectrum').value=this.draft.burstSpectrum;$('setupBurstSpectrum').disabled=this.readOnly||!this.draft.burst;$('burstSpectrumOption').hidden=!this.draft.burst||this.readOnly&&(state.flight?.mission?.model||0)<3;
  const c=this.draft,legacy=this.readOnly&&!state.flight.mission;
  document.querySelectorAll('#flightBuilder input[type="checkbox"][data-setup]').forEach(e=>{e.checked=!!c[e.dataset.setup];e.disabled=this.readOnly;});
  $('setupEngine').disabled=this.readOnly||c.dump||OrbitalArrival.enabled&&!this.starAvailable;$('setupEngine').checked=c.engine&&!c.dump;$('engineOption').classList.toggle('unavailable',c.dump);
  $('setupSail').disabled=this.readOnly||!this.starAvailable;
  $('setupSail').title=this.starAvailable?'':'Для светового разгона нужна звезда в точке старта';
  $('collectorOption').classList.toggle('unavailable',!c.sail);$('burstOption').classList.toggle('unavailable',!c.sail);
  $('setupCollector').disabled=this.readOnly||!this.starAvailable||!c.sail;$('setupBurst').disabled=this.readOnly||!c.sail||!this.starAvailable||this.source.id==='sol';
  $('burstHelp').textContent=this.source?.id==='sol'?'Для Солнца недоступно':(c.burst&&(!this.readOnly||(state.flight?.mission?.model||0)>=3)?(BeamSpectra.profiles[c.burstSpectrum]||BeamSpectra.profiles.iip).label+' · ':'')+'30 суток излучения у источника';
  $('setupCollectGas').disabled=this.readOnly||!c.brakeSail;
  for(const key of ['Density','Capacity'])$('setup'+key).disabled=this.readOnly;
  $('setupStarMass').disabled=this.readOnly||c.burst||!this.starAvailable;$('setupLuminosity').disabled=this.readOnly||c.burst||!this.starAvailable;$('resetLuminosity').disabled=this.readOnly||c.burst||!this.starAvailable;
  $('builderMassBasis').textContent=c.burst?'В модели вспышки поле отключено':c.massSolar!==null?'Ваш сценарий':MapDetails.mass(this.source)?(this.source?.massSource?'Литературная оценка':'По данным каталога'):'Масса неизвестна';
  $('builderLightBasis').textContent=c.burst?'Модель сверхновой':c.luminositySolar?'Ваш сценарий':this.light.estimated?'Оценка по классу звезды':'По данным каталога';
  const invalid=[...document.querySelectorAll('#flightBuilder input[type="number"]')].some(e=>!e.disabled&&(!e.checkValidity()||e.value===''&&!['massSolar','luminositySolar'].includes(e.dataset.setup)));
  if(!this.readOnly&&!invalid){
   this.fuelBounds=MissionPlanner.fuelLimit(c);
   c.arrivalFuelPercent=Math.min(this.fuelBounds.maxPercent,Math.max(0,c.arrivalFuelPercent||0));c.fill=c.arrivalFuelPercent>0;
  }
  const p=legacy?null:this.readOnly?state.flight.mission:MissionPlanner.preview(c),eta=legacy?FlightEstimate.get():p,profile=legacy?FlightProfile.get(eta):null,valid=(legacy?!!eta:p.valid)&&!invalid;
  const plannedPercent=Number.isFinite(eta?.arrivalFuelKg)?eta.arrivalFuelKg/c.capacityKg*100:0;
  const selected=this.readOnly?(c.arrivalFuelPercent??(c.fill?plannedPercent:0)):(c.arrivalFuelPercent||0),limit=this.fuelBounds?.maxPercent||0;
  const percentText=n=>fmt(n,Number.isInteger(n)?0:2)+'%';
  $('setupReserve').disabled=this.readOnly||invalid||!this.fuelBounds?.valid||limit<=0;$('setupReserve').value=String(selected);
  $('setupReserve').setAttribute('aria-valuemax',String(this.readOnly?100:limit));$('setupReserve').setAttribute('aria-valuetext',percentText(selected)+' топливного бака');
  $('builderReserveValue').textContent=percentText(selected);$('builderReserveFill').style.width=selected+'%';
  $('builderReserveTick').hidden=this.readOnly;$('builderReserveTick').style.left='calc('+limit+'% + '+(7-14*limit/100)+'px)';
  $('builderReserveBlocked').hidden=this.readOnly;$('builderReserveBlocked').style.left=limit+'%';
  $('builderReserveLimit').textContent=this.readOnly?'Наполнение в текущем плане':invalid?'Проверьте параметры':this.fuelBounds?.valid?'Максимум '+percentText(limit):'Нет допустимого полёта';
  $('builderProper').textContent=valid?durationText(eta.proper):'—';$('builderEarth').textContent=valid?durationText(eta.earth):'—';
  const startFuel=p?.initialFuelKg??(c.dump?0:Math.min(state.matter*1000,c.capacityKg)),fuel=eta?.arrivalFuelKg;
  const fuelText=kg=>fmt(Math.max(0,Math.min(100,kg/c.capacityKg*100)),0)+'%';
  $('builderStartFuel').textContent=fuelText(startFuel);$('builderFuel').textContent=valid&&Number.isFinite(fuel)?fuelText(fuel):'—';
  $('builderProperMobile').textContent=valid?durationText(eta.proper):'—';$('builderFuelMobile').textContent=valid&&Number.isFinite(fuel)?fuelText(fuel):'—';
  this.drawRoute(p,valid,eta,profile);
  let warning=invalid?'Проверьте числовые параметры.':valid?'':p?.reason||'Нет прогноза';
  if(valid&&c.dump)warning='Перед стартом топливный бак будет опустошён.';
  if(valid&&p?.jettisonKg>0&&!c.dump)warning='Топливный бак меньше текущего запаса: избыток '+fmt(p.jettisonKg,3)+' кг будет сброшен.';
  $('builderWarning').textContent=warning;$('builderStatus').hidden=!warning;$('builderWarning').classList.toggle('attention',!!warning);
  $('builderPeak').textContent=Number.isFinite(p?.peakBeta)?percentC(p.peakBeta):'—';
  $('builderDiagnostic').textContent=p?.diagnostic?'Одним парусом до 1 м/с: '+durationText(p.diagnostic)+'. Для полной остановки нужен двигатель.':'';
  this.explain(c,p);$('launchConfigured').disabled=!valid;$('applyFlightSetup').disabled=invalid;
 },
 explain(c,p){
  const light=this.light,solar=c.luminositySolar??light.solar,mass=c.massSolar??MapDetails.mass(this.source),fuel=p?.initialFuelKg??(c.dump?0:Math.min(state.matter*1000,c.capacityKg)),total=1+fuel;
  const luminosity=c.burst?Stellar.luminosity:solar*3.828e26,r=p?.departureOrbit?.radius||light.collectorR;
  const power=c.collector?luminosity*Stellar.collectorDiameterM**2/(16*light.collectorR**2):luminosity*SHIP.sailAreaM2/(4*Math.PI*r*r);
  const lightG=c.sail&&this.starAvailable?2*power/Rocket.c/total/G0:0,engineG=c.engine&&!c.dump&&fuel>0?Rocket.power/Rocket.c/total/G0:0;
  const gravity=this.starAvailable&&!c.burst&&mass!==null?6.67430e-11*1.98847e30*mass/(r*r)/G0:null,thrust=Math.min(100,lightG+engineG);
  const gText=n=>n===0?'0 g':n>=.01?fmt(n,Math.abs(n-Math.round(n))<1e-6?0:2)+' g':quantity(n)+' g';
  $('builderGravity').textContent=c.burst?'Поле отключено':gravity===null?'Нет данных':gText(gravity);
  const maxG=p?.valid?Math.max(p.accelerationEnd?.a||0,...(p.acceleration?.rows||[]).filter(q=>q.proper<=p.accelerationEnd.proper).map(q=>q.a||0))/G0:null;
  $('builderThrust').textContent=Number.isFinite(maxG)?gText(maxG):'—';
  $('builderAccelerationNote').hidden=!(maxG>=100-1e-6);$('builderAccelerationNote').textContent=maxG>=100-1e-6?'Достигнут предел 100 g.':'';
  $('builderGravityNote').textContent=c.burst?(this.readOnly&&(state.flight?.mission?.model||0)<3?'Прежняя общая модель вспышки; поле звезды отключено.':'Спектральный сценарий '+(BeamSpectra.profiles[c.burstSpectrum]||BeamSpectra.profiles.iip).label+'. Светимость и длительность вспышки заданы игровой моделью; поле звезды отключено.'):gravity===null?(this.starAvailable?'Масса звезды неизвестна; её притяжение при разгоне не учитывается.':'В точке старта нет звезды.'):thrust<=gravity?'Для старта нужно больше '+gText(gravity)+'. Добавьте двигатель или оптический коллектор.':'Тяга преодолевает притяжение. Учтено радиальное поле звезды у точки старта '+fmt(r/Stellar.r0,2)+' а.е.';
  const spectral=this.source?.spectral||this.source?.facts?.class||this.source?.type||'Звезда';
  $('builderStarValue').textContent=!this.starAvailable?'Без звезды':c.burst?'30 суток у звезды':(light.estimated&&!c.luminositySolar?'≈ ':'')+fmt(solar,solar<.01?6:2)+' L☉';
  $('builderStarReason').textContent=!c.sail?'Разгоняет двигатель: расходуется топливо. Светимость звезды на этот план не влияет.':!this.starAvailable?'Для светового разгона нужна звезда у точки старта.':c.burst?'Свет вспышки разгоняет корабль через парус.':spectral+'. '+(c.collector?'Коллектор направляет свет на парус; пучок расширяется из-за дифракции, а разгон ослабевает с расстоянием и скоростью.':'Прямой свет слабеет с удалением от звезды.');
  $('builderFlashNote').hidden=!(c.sail&&c.burst);
  const reception=MissionPlanner.lightReception(p);
  $('builderFlashNote').textContent=reception?'Вспышка у звезды длится 30 суток. За этот разгон корабль принимает свет, испущенный в первые '+fmt(reception.source*365.25,2)+' суток; приём на борту занимает '+durationText(reception.proper)+'; фотоны догоняют удаляющийся корабль с растянутыми интервалами. После вспышки звезда не продолжает светить.':'Фотоны догоняют удаляющийся корабль: 30 суток излучения у звезды могут растянуться на годы приёма по бортовым часам. Постоянный свет после вспышки не добавляется.';
  if(c.sail&&!c.burst&&gravity!==null&&thrust<=gravity)$('builderStarReason').textContent+=' Тяги не хватает для старта.';
  $('builderGasValue').textContent=c.brakeSail?fmt(c.densityCm3,c.densityCm3<.01?4:1)+' атом/см³':'Парус сложен';
  $('builderGasReason').textContent=!c.brakeSail?'Останавливает двигатель, используя только запас топлива.':!c.collectGas?'Газ замедляет корабль и выпускается наружу. Для остановки двигатель использует запас топлива.':c.fill?'Парус тормозит и собирает топливо. Более раннее торможение оставляет больше газа в топливном баке.':'Парус тормозит и собирает газ; двигатель расходует часть потока для более быстрой остановки.';
  const diffraction=p?.acceleration?.diffraction,spectrum=diffraction?.spectrum||BeamOptics.spectrum(c,light),oldOptics=this.readOnly&&c.collector&&c.sail&&!diffraction;
  $('builderPhysicsNote').textContent=(c.collector&&c.sail?(oldOptics?'Сохранённый полёт рассчитан по прежней модели без дифракции. ':'Дифракция учтена: идеальная круглая апертура 1 км, парус 100 м. '+BeamOptics.label(spectrum)+'. '+(c.burst?'Шаблоны Nugent: 100–2500 нм, спектр меняется по времени у источника. ':'Тепловое приближение спектра звезды. ')+'Идеальное наведение и фокусировка; угловой размер источника не учтён. '):c.sail?'Прямой поток убывает как 1/r². ':'')+(c.sail?'Доплеровское ослабление и задержка света учтены. ':'')+'Плотность газа при торможении — однородная модель, а не измерение у цели.'+(p?.arrival?' Гравитация цели — изолированная точечная масса в слабом поле.':'')+(p?.departureOrbit?' При следующем старте учитывается орбитальная энергия; ориентация плоскости орбиты не рассчитывается.':'');
  const arrival=p?.arrival||(!this.readOnly?OrbitalArrival.target(object(state.selected)):null);
  $('builderArrivalTitle').textContent=arrival?'Торможение и выход на орбиту':'Полная остановка';
  $('builderOrbitSpeed').textContent=arrival?fmt(arrival.speed/1000,2)+' км/с':'0 км/с';
  $('builderOrbitReason').textContent=arrival?'Гравитация цели учтена. Полёт заканчивается на круговой орбите с касательной скоростью; тормозной парус складывается.':'Цель протяжённая либо индивидуальная масса неизвестна. Полёт заканчивается полной остановкой.';
  $('builderOrbitRadiusLabel').textContent=arrival?'Радиус орбиты':'Режим прибытия';
  $('builderOrbitRadius').textContent=arrival?fmt(arrival.radius/Stellar.r0,arrival.radius/Stellar.r0<100?2:0)+' а.е.':'Стоянка';
  const comparison=p?.vacuumComparison,difference=comparison&&p.valid?comparison.burnedKg-p.brake.burned:null;
  $('builderOrbitComparison').textContent=arrival?(arrival.radiusAdjusted?'Радиус увеличен: вне поверхности и в слабом поле. ':'')+'Масса цели: '+compact(arrival.massSolar)+' M☉. '+(difference!==null?'Торможение расходует на '+quantity(Math.abs(difference))+' кг '+(difference>=0?'меньше':'больше')+' топлива, чем полная остановка в пустом пространстве при той же входной скорости.':''):'Масса протяжённого объекта не используется как масса одной звезды.';
  this.drawOptics(c);
 },
 routeStages(p,eta,profile){
  if(p?.valid){
   const a=p.accelerationEnd,coast=p.coast,brake=p.brake;
   return[{name:'Разгон',proper:a.proper,distance:a.distance},{name:'Свободный полёт',proper:coast.proper,distance:p.cosmic?coast.path:coast.distance},{name:p.passage?'Пролёт':p.arrival?'Торможение и выход на орбиту':'Торможение',proper:p.passage?Math.max(0,p.proper-a.proper-coast.proper):brake.proper,distance:p.passage?null:brake.distance}];
  }
  if(profile&&eta){const a=profile.acceleration,b=profile.braking;return[{name:'Разгон',proper:a?.proper||0,distance:a?.distance||0},{name:'Свободный полёт',proper:Math.max(0,eta.proper-(a?.proper||0)-(b?.proper||0)),distance:null},{name:'Торможение',proper:b?.proper||0,distance:b?.distance||0}];}
  return['Разгон','Свободный полёт','Торможение'].map(name=>({name,proper:0,distance:0}));
 },
 routeDistanceText(d){
  if(!Number.isFinite(d))return'—';
  if(d===0)return'0 св. лет';
  if(Math.abs(d)<1e-5)return quantity(d)+' св. лет';
  return(d<.01?fmt(d,Math.max(2,2-Math.floor(Math.log10(d)))):compact(d))+' св. лет';
 },
 visibleRouteStage(s,totalDistance,totalProper,valid){
  // Hide a coast below 0.1% in both measures, without redistributing its path.
  return s.index!==1||!valid||s.proper>Math.max(1e-12,totalProper*.001)||Math.abs(s.distance||0)>Math.max(1e-12,totalDistance*.001);
 },
 routeSamples(p,stages){
  if(!p?.acceleration?.rows?.length||!p.accelerationEnd||!stages.every(s=>Number.isFinite(s.distance)))return null;
  if(this.routeSamplesCache.has(p))return this.routeSamplesCache.get(p);
  const total=stages.reduce((sum,s)=>sum+s.distance,0),scaleX=total>0?392/total:0,scaleY=65/Math.max(p.peakBeta||0,1e-12),result=[];
  for(let index=0;index<3;index++){
   const duration=stages[index].proper,length=stages[index].distance;
   if(index===0){
    const points=p.acceleration.rows.filter(q=>q.proper<p.accelerationEnd.proper).map(q=>({proper:q.proper,distance:q.distance,beta:q.beta}));
    points.push({proper:p.accelerationEnd.proper,distance:p.accelerationEnd.distance,beta:p.accelerationEnd.beta});result.push(points);continue;
   }
   if(p.passage||!(duration>0)||!(length>0)){result.push([]);continue;}
   const sample=t=>{const q=MissionPlanner.stageSample(p,index,t);return{proper:t,distance:Math.max(0,Math.min(length,q.distance)),beta:q.beta};};
   // Sampling is in proper time but the drawing uses physical distance. Log
   // endpoint seeds retain short final burns; refinement measures screen error.
   const times=new Set([0,duration]);for(let n=1;n<16;n++)times.add(duration*n/16);
   for(let n=1;n<=8;n++){times.add(duration*10**(-n));times.add(duration*(1-10**(-n)));}
   if(index===2){const b=p.brake.plan;for(const t of [b?.fill?.proper,(b?.fill?.proper||0)+(b?.feed?.proper||0)])if(t>0&&t<duration)times.add(t);}
   const points=[],refine=(a,b,depth)=>{
    const mid=sample((a.proper+b.proper)/2),dx=(b.distance-a.distance)*scaleX,dy=(b.beta-a.beta)*scaleY,mx=(mid.distance-a.distance)*scaleX,my=(mid.beta-a.beta)*scaleY,den=dx*dx+dy*dy,f=den>0?Math.max(0,Math.min(1,(mx*dx+my*dy)/den)):0,error=Math.hypot(mx-f*dx,my-f*dy);
    if(depth<12&&error>.15){refine(a,mid,depth+1);refine(mid,b,depth+1);}else points.push(b);
   };
   const seeds=[...times].sort((a,b)=>a-b).map(sample);points.push(seeds[0]);for(let i=1;i<seeds.length;i++)refine(seeds[i-1],seeds[i],0);result.push(points);
  }
  this.routeSamplesCache.set(p,result);return result;
 },
 drawRoute(p,valid,eta,profile){
  const stages=this.routeStages(valid?p:null,valid?eta:null,valid?profile:null),known=stages.every(s=>Number.isFinite(s.distance)),total=known?stages.reduce((sum,s)=>sum+s.distance,0):0,left=24,span=392;
  let traveled=0;
  const segments=stages.map((s,i)=>{const start=left+(total?traveled/total:0)*span;traveled+=Number.isFinite(s.distance)?s.distance:0;const end=left+(total?traveled/total:0)*span;return{...s,start,end,center:(start+end)/2,index:i};});
  const x1=segments[0].end,baseline=214,peak=149;
  const totalProper=stages.reduce((sum,s)=>sum+s.proper,0),visible=segments.filter(s=>this.visibleRouteStage(s,total,totalProper,valid));
  const rows=visible.map((s,i)=>{
   const x=8+i*(440/visible.length),labelCenter=x+(visible.length===2?90:64),turn=106+i*7,time=valid?durationText(s.proper):'—',dist=valid?this.routeDistanceText(s.distance):'—';
   return '<g class="route-stage" data-stage="'+s.index+'" data-proper="'+s.proper+'" data-distance="'+s.distance+'" data-start="'+s.start+'" data-end="'+s.end+'"><title>'+s.name+': время на борту — '+time+'; расстояние в системе внешнего наблюдателя — '+dist+'</title><path class="stage-leader" d="M'+labelCenter+' 98V'+turn+'H'+s.center+'V228"/><text class="stage-name" x="'+x+'" y="15">'+(s.name==='Торможение и выход на орбиту'?'<tspan x="'+x+'" y="10">Торможение</tspan><tspan x="'+x+'" y="23">и выход на орбиту</tspan>':s.name)+'</text><text class="stage-metric-label" x="'+x+'" y="35">Время на борту</text><text class="stage-duration" x="'+x+'" y="51">'+time+'</text><text class="stage-metric-label" x="'+x+'" y="72">Расстояние</text><text class="stage-distance" x="'+x+'" y="88">'+dist+'</text><rect class="stage-span stage-span-'+s.index+'" x="'+s.start+'" y="224" width="'+(s.end-s.start)+'" height="6"/><circle class="stage-pin" cx="'+s.center+'" cy="227" r="1.8"/></g>';
  }).join('');
  const samples=valid&&known?this.routeSamples(p,stages):null;
  let offset=0,maximum={beta:p?.peakBeta??eta?.peakBeta??state.flight?.maxBeta,x:x1};
  const series=samples?.map((points,index)=>{const values=points.map(q=>({...q,x:left+(total?(offset+q.distance)/total:0)*span}));offset+=stages[index].distance;return values;});
  if(series){maximum={beta:-1,x:left};for(const points of series)for(const q of points)if(q.beta>maximum.beta)maximum={beta:q.beta,x:q.x};}
  const beta=maximum.beta,height=baseline-peak,y=b=>baseline-height*Math.max(0,b)/Math.max(beta||0,1e-20),startY=series?.[0]?.length?y(series[0][0].beta):baseline,lastSeries=series?.filter(q=>q.length).at(-1),arrivalY=lastSeries?.length?y(lastSeries.at(-1).beta):baseline;
  const paths=series?.map((points,index)=>points.length&&(index!==1||visible.some(s=>s.index===1))?'<path class="'+['diagram-accel','diagram-coast','diagram-brake'][index]+'" data-sampled="true" data-samples="'+points.length+'" d="'+points.map((q,i)=>(i?'L':'M')+q.x.toFixed(3)+' '+y(q.beta).toFixed(3)).join('')+'"/>':'').join('')||'';
  const curve='<path class="diagram-guide" d="M24 '+baseline+'H416"/>'+paths;
  const peakText=valid&&Number.isFinite(beta)?'Макс. '+percentC(beta):'',labelWidth=Math.min(360,Math.max(150,peakText.length*8+16)),labelX=clamp(maximum.x,24+labelWidth/2,416-labelWidth/2);
  const peakLabel=peakText?'<g class="route-peak" data-beta="'+beta+'"><path class="peak-guide" d="M'+maximum.x+' '+peak+'V136H'+labelX+'"/><rect x="'+(labelX-labelWidth/2)+'" y="123" width="'+labelWidth+'" height="20"/><text x="'+labelX+'" y="137" text-anchor="middle">'+peakText+'</text><circle cx="'+maximum.x+'" cy="'+peak+'" r="2.5"/></g>':'';
  $('builderRouteDiagram').innerHTML='<defs><pattern id="routeBrakeHatch" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M-1 1l2-2M0 4l4-4M3 5l2-2"/></pattern></defs>'+'<title>Скорость по расчётной траектории в зависимости от пройденного расстояния</title>'+rows+curve+peakLabel+'<circle cx="24" cy="'+startY+'" r="2.5"/><circle cx="416" cy="'+arrivalY+'" r="2.5"/><text class="route-endpoint" x="24" y="251">СТАРТ</text><text class="route-endpoint" x="416" y="251" text-anchor="end">'+(p?.passage?'ПРОЛЁТ':p?.arrival?'ОРБИТА':'ОСТАНОВКА')+'</text><text class="route-axis-note" x="220" y="274" text-anchor="middle">Расстояние в системе внешнего наблюдателя →</text>';
  $('builderRouteDiagram').classList.toggle('uncomputed',!valid||!known||!samples);
 },
 drawOptics(c){
  const svg=$('builderOpticsDiagram'),start='<circle cx="30" cy="40" r="10"/>'+(c.burst?'<circle cx="30" cy="40" r="20" stroke-dasharray="2 3"/>':'')+'<text x="30" y="81" text-anchor="middle">'+(c.burst?'вспышка':'звезда')+'</text>';
  const sail='<path d="M355 21q17 19 0 38M355 21l-14 19 14 19"/><text x="355" y="81" text-anchor="middle">парус</text>';
  const collector='<path d="M145 21q15 19 0 38M55 33l86-10M55 47l86 10"/><text x="147" y="81" text-anchor="middle">коллектор</text><path d="M160 35l173-22M160 45l173 22" stroke-dasharray="4 4"/><text x="250" y="99" text-anchor="middle">дифракция пучка</text>';
  const ship='<path d="m320 34 17 6-17 6 4-6Z"/>';
  svg.innerHTML=c.sail?start+(c.collector?collector:'<path d="M55 35l275-14M55 45l275 14" stroke-dasharray="4 4"/>')+sail+ship:'<path d="M45 40h240" stroke-dasharray="2 5"/><circle cx="45" cy="40" r="3"/><path d="m295 28-29 12 29 12" stroke-dasharray="3 3"/>'+ship+'<text x="180" y="81" text-anchor="middle">топливо → фотоны → тяга</text>';
 },
 apply(fly=false){if(this.readOnly)return;this.sanitizeDraft();state.flightSetup=FlightSetup.storeDraft(this.draft,this.preferred||FlightSetup.preferred(),this.source,this.changedKeys);state.departureMode=this.draft.sail?(this.draft.burst?'burst':'beam'):'engine';FlightSetup.sync();FlightEstimate.idleKey=null;FlightProfile.idleKey=null;$('flightBuilder').close();renderUI();persist();if(fly)launch();},
 renderCard(target,arrived,eta){
  const f=state.flight,c=FlightSetup.read();$('departureSection').hidden=true;$('configureFlight').hidden=arrived||!target.navigable;
  if(!OrbitalArrival.enabled&&!f&&!canBoost('beam'))Object.assign(c,{sail:false,collector:false,burst:false});
  $('setupAccelerationSummary').textContent=FlightSetup.acceleration(c);$('setupBrakingSummary').textContent=FlightSetup.braking(c);
  $('configureFlight').setAttribute('aria-label',f?'Посмотреть план полёта':'Настроить разгон и торможение');
  $('flightDetails').hidden=true;$('configureFlightLabel').textContent=f?'План ↗':'Изменить ↗';$('arrivalFuelRow').hidden=true;
  if(!f&&!arrived&&target.navigable){
   $('launchBtn').querySelector('span').textContent='Лететь';
   if(MissionPlanner.enabledIdle()){const p=MissionPlanner.preview();$('launchBtn').disabled=!p.valid;$('flightHint').textContent=p.valid?(p.reserveLimited?'Для этого перелёта запас ограничен доступным топливом.':''):p.reason;if(!p.valid){$('arrivalProper').textContent='—';$('arrivalEarth').textContent='—';}}
   else $('flightHint').textContent='';
  }
  $('flightHint').hidden=!$('flightHint').textContent||!!f;
  if(f?.mission){$('phaseTag').textContent=paused?'ПАУЗА':state.phase==='launch'?'РАЗГОН':state.phase==='brake'?'ТОРМОЖЕНИЕ':state.phase==='thrust'?'РАЗГОН':state.phase==='flyby'?'ПРОЛЁТ':'СВОБОДНЫЙ ПОЛЁТ';$('departureDiagram').hidden=true;$('sailSection').hidden=true;$('engineSection').hidden=true;}
 },
 setup(){
  $('configureFlight').onclick=()=>this.open();$('closeBuilder').onclick=()=>$('flightBuilder').close();
  document.querySelectorAll('#flightBuilder [data-setup]').forEach(e=>{e.addEventListener('change',()=>this.changed(e));if(e.type==='number'||e.type==='range')e.addEventListener('input',()=>this.changed(e));});
  $('resetLuminosity').onclick=()=>{this.draft.luminositySolar=null;this.draft.massSolar=null;$('setupLuminosity').value=this.light.solar;$('setupStarMass').value=MapDetails.mass(this.source)??'';this.render();};
  $('applyFlightSetup').onclick=()=>this.apply();$('launchConfigured').onclick=()=>{if(!MissionPlanner.preview(this.draft).valid)return;this.apply(true);};
 }
};

function coastSetup(){/* Cruise speed now converts proper years directly in Simulation. */}
function launch(forceEngine=false){
 if(!forceEngine)FlightSetup.sync();
 if(!forceEngine&&MissionPlanner.enabledIdle()){MissionPlanner.launch();return;}
 if(state.flight)return;const target=object(state.selected);if(!target||target.id===state.current||!target.navigable)return;
 state.controlG=100;state.auto=true;const boost=!forceEngine&&wantsBoost();if(!forceEngine&&state.current==='sol'&&state.departureMode==='burst'){toast('Вспышка Солнца запрещена. Выберите собственную тягу или постоянный свет.');return;}if(!boost&&!Rocket.usableFuel(state.matter)){toast('Нет рабочего вещества для тяги.');return;}
 const from={...state.ship},d=distance(from,target),cosmic=Cosmology.isCosmic(object(state.current)||from,target);Cosmology.sync(state);if(d<1e-14)return;const engine=boost?null:Rocket.plan(state.matter,d*(cosmic?Cosmology.scale():1),0,Math.max(1,state.controlG||100)),wind=boost?{...windPlan(),baseCovered:0,elapsedProper:0}:null;
 state.flight={cosmic,from,target:target.id,fromId:state.current,distance:d,covered:0,coastRate:0,maxBeta:wind?wind.beta:engine.beta,engine,wind,magnetic:null,boost,departureMode:boost?state.departureMode:'engine',starEpochEarth:state.earth,starR0:Stellar.r0,medium:GasMedium.forLeg(from,target,state.sail),missed:false,autoStopping:false,replayRate:(wind?wind.proper:engine.burnProper)/5};
 state.beta=0;state.acceleration=boost?Stellar.sample(wind,0).force/wind.massKg:Rocket.acceleration(Rocket.dryMass+state.matter,engine.maxG);state.phase=boost?'launch':'thrust';Simulation.smoothedFactor=Math.min(1,state.flight.replayRate);paused=false;
 if(boost){const current=object(state.current);if(state.departureMode==='burst'){state.destroyed.push(current.id);effects.push({x:from.x,y:from.y,p3:from.p3,age:0});}log((state.departureMode==='burst'?'Звёздная вспышка: ':'Постоянный свет: ')+current.name+'. Зеркало Ø 1 км. Прогноз '+percentC(wind.beta)+'. Топливо сохранено.');toast(state.departureMode==='burst'?'Вспышка длится 30 суток у звезды.':'Постоянный пучок света: звезда сохраняется.');}

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
 const f=state.flight;if(!f||state.beta<=0)return;if(['launch','thrust'].includes(state.phase))FlightMarks.actual('acceleration');f.windFolded=true;f.autoStopping=auto;
 const stop=HybridBrake.stopping(state.matter,state.beta,100,f.medium);
 // At high gamma, rounded beta makes the switch root slightly discontinuous.
 // Fly the remaining positive gap before braking instead of stopping short.
 const switchGap=f.distance-f.covered-Simulation.stoppingDistance(stop);
 if(auto&&switchGap>Simulation.tolerance(f)&&switchGap<=f.distance*1e-8){
  state.phase='cruise';state.acceleration=0;f.magnetic=null;f.replayRate=1;return;
 }
 FlightMarks.actual('brake');f.magnetic=stop.magnetic;f.replayRate=f.magnetic.proper/3;f.magnetic.elapsedProper=0;state.phase='brake';state.acceleration=Magnetic.sample(f.magnetic,0).properAcceleration;
 FlightMarks.set(f,'fine',FlightMarks.at(f,f.covered+f.magnetic.distance/Cosmology.factor(f)));
}

function advance(ds,earth,proper,comoving=false,path){
 const f=state.flight,metric=Cosmology.factor(f,(state.cosmicTime||0)+(state.expansion!==false?earth/2:0));FlightProfile.record(f,comoving?(path??ds*metric):ds,proper,Math.abs(state.acceleration||0)/G0);f.covered+=comoving?ds:ds/metric;state.totalDistance+=comoving?(path??ds*metric):ds;state.earth+=earth;state.proper+=proper;Cosmology.elapse(state,earth);const p=f.covered/f.distance,target=f.aim||object(f.target);state.ship=Space.mix(f.from,target,p);
 if(f.covered>f.distance+Math.max(1e-10,f.distance*1e-10)&&!f.missed&&state.beta>1e-8){f.missed=true;toast('Цель пройдена. Физический тормозной путь ещё не исчерпан.');}
}
function finishFlight(arrived){const f=state.flight,target=object(f.target);state.orbit=null;
 if(arrived){state.ship=Space.point(target.p3);state.current=target.id;if(state.transferSetup?.starId===target.id){state.flightSetup=FlightSetup.normalize(state.transferSetup.setup);state.departureMode=state.flightSetup.sail?(state.flightSetup.burst?'burst':'beam'):'engine';state.transferSetup=null;}if(!state.visited.includes(target.id))state.visited.push(target.id);ExtendedCatalog.ensureGalaxy(target);log('Прибытие: '+target.name+'. Борт: '+compact(state.proper)+' лет; Неподвижный наблюдатель: '+compact(state.earth)+' лет.');toast('Прибытие: '+target.name+'. Выберите следующую цель.');}
 else{state.current=null;log('Остановка вне цели. До неё '+distanceText(distance(state.ship,target))+'.');toast('Корабль остановлен. До цели '+distanceText(distance(state.ship,target))+'.');}
 const orbital=arrived&&OrbitalArrival.park(f);if(orbital){log('Круговая орбита: '+fmt(state.orbit.radius/Stellar.r0,2)+' а.е.; '+fmt(state.orbit.speed/1000,2)+' км/с.');toast('Выход на орбиту: '+target.name+'.');}
 state.matter=Rocket.usableFuel(state.matter);if(!orbital)state.beta=0;state.acceleration=0;state.phase='idle';state.flight=null;renderUI();renderCatalog();persist();if(arrived)Route.afterStop(f);
}
function autoFraction(predict){
 const f=state.flight,remaining=f.distance-f.covered;if(Route.isFlyby()){if(predict(1).distance/Cosmology.factor(f)<=remaining)return 1;let lo=0,hi=1;for(let i=0;i<60;i++){const p=(lo+hi)/2;if(predict(p).distance/Cosmology.factor(f)>remaining)hi=p;else lo=p;}return(lo+hi)/2;}if(!Route.braking())return 1;
 const gap=p=>{const v=predict(p),epoch=state.cosmicTime||0,dt=state.expansion!==false?v.earth:0;return remaining-(v.comovingDistance??v.distance/Cosmology.factor(f,epoch+dt/2))-Simulation.stoppingDistance(Magnetic.stopping(v.fuel,v.beta,Math.max(1,Math.abs(state.controlG)||100)),epoch+dt);};
 if(gap(1)>=0)return 1;let lo=0,hi=1;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(gap(mid)>=0)lo=mid;else hi=mid;}return (lo+hi)/2;
}
function findDepartureStar(){
 if(state.flight)return;const here=object(state.current),star=ExtendedCatalog.ensureGalaxy(here);
 if(!star){toast('У текущей стоянки не найдена доступная звезда.');return;}
 // Find a transfer destination: no teleportation, free fuel or remote supernova.
 if(!OrbitalArrival.enabled){const c=FlightSetup.read();state.transferSetup={starId:star.id,setup:{...c}};state.flightSetup=FlightSetup.normalize({...c,engine:true,dump:false,sail:false,collector:false,burst:false,brakeEngine:true,arrivalFuelPercent:0,fill:false});}FlightSetup.sync();
 select(star.id);ExtendedCatalog.focus(star);toast(Rocket.usableFuel(state.matter)>0?'Выбрана звезда у стоянки. Перелёт к ней — на тяге двигателя.':'Звезда найдена. Для перелёта к ней нужно топливо в топливном баке.');
}
function tickPhysics(dt){Simulation.tick(dt);}

let catalogRevision=0,catalogTimer;
function catalogRows(items,total,loading=false,error=''){
 $('catalogCount').textContent=total.toLocaleString('ru-RU')+' / '+ExtendedCatalog.total.toLocaleString('ru-RU')+(loading?' · поиск…':'');
 $('catalogList').replaceChildren();
 if(!items.length){const e=document.createElement('p');e.className='empty-state';e.textContent=loading?'Поиск по полному каталогу…':error||'Объекты не найдены.';$('catalogList').append(e);}
 for(const entry of items){const b=document.createElement('button');b.className='catalog-item';const quality=entry.atlasOnly||entry.positionQuality==='unknown'?' · ТОЛЬКО АТЛАС':entry.positionQuality==='approximate'?' · ПРИБЛИЗИТЕЛЬНО':entry.synthetic?' · ИГРОВАЯ ЗВЕЗДА':'';
  const body=document.createElement('span');body.className='catalog-item-body';const name=document.createElement('strong');name.textContent=entry.name;const detail=document.createElement('small');detail.textContent=MapDetails.typeName(entry)+' · '+(entry.atlasOnly?'дальность не определена':distanceText(entry.d))+quality+(state.visited.includes(entry.id)?' · ИССЛЕДОВАНО':'');body.append(name);body.append(detail);b.append(body);const arrow=document.createElement('span');arrow.textContent='↗';b.append(arrow);
  b.addEventListener('click',async()=>{b.disabled=true;try{const o=await ExtendedCatalog.resolve(entry);const picking=Route.picking;select(o.id);closeCatalog();ExtendedCatalog.focus(o);if(picking){Route.add(o.id);Route.show();}}catch(e){toast(e.message);b.disabled=false;}});$('catalogList').append(b);
 }
 if(error&&items.length){const e=document.createElement('p');e.className='empty-state';e.textContent=error+' · показана основная выборка';$('catalogList').append(e);}
 if(total>items.length&&!loading&&!error){const more=document.createElement('button');more.className='map-size-action';more.textContent='Ещё 100 объектов';more.onclick=()=>{ExtendedCatalog.searchLimit+=100;renderCatalog();};$('catalogList').append(more);}
}
function catalogMatchRank(o,term,exact){if(!term)return 0;const name=MapDetails.searchKey(o.name||''),id=MapDetails.searchKey(o.id||'');return name===term||id===term?5:o.kind==='galaxy'&&exact(o)?4:name.startsWith(term)?3:o.searchExact||exact(o)?2:name.includes(term)?1:0;}
function renderCatalog(){
 if($('catalog').hidden)return;
 const revision=++catalogRevision,term=MapDetails.searchKey($('search').value.trim()),limit=ExtendedCatalog.searchLimit;
 const exact=o=>!!term&&[o.name,o.id,...(o.aliases||[]),o.ngc||'','HIP '+(o.hip||''),'HD '+(o.hd||'')].some(v=>MapDetails.searchKey(v)===term);
 const core=[...OBJECTS,...ExtendedCatalog.pinned.values()].filter(o=>!o.streamed&&ExtendedCatalog.matches(o.kind,filter,o)&&MapDetails.searchKey(`${o.name} ${(o.aliases||[]).join(' ')} ${o.type} ${o.id} ${o.ngc||''} ${o.hip||''} ${o.hd||''} ${o.gliese||''}`).includes(term)).sort((a,b)=>catalogMatchRank(b,term,exact)-catalogMatchRank(a,term,exact)||(a.d??Infinity)-(b.d??Infinity));
 catalogRows(core.slice(0,limit),core.length,true);
 if(typeof fetch!=='function'&&!globalThis.PARUS_CATALOG_FILES){catalogRows(core.slice(0,limit),core.length);return;}
 ExtendedCatalog.search(term,filter,limit).then(result=>{if(revision!==catalogRevision||$('catalog').hidden)return;const ids=new Set(core.map(o=>o.id));const items=[...core,...result.items.filter(o=>!ids.has(o.id))].sort((a,b)=>catalogMatchRank(b,term,exact)-catalogMatchRank(a,term,exact)||(a.d??Infinity)-(b.d??Infinity)||a.id.localeCompare(b.id)).slice(0,limit);catalogRows(items,core.length+result.total);}).catch(e=>{if(revision===catalogRevision)catalogRows(core.slice(0,limit),core.length,false,e.message);});
}
function closeMenu(){$('menu').hidden=true;$('menuBtn').setAttribute('aria-expanded','false');}
function openCatalog(){closeMenu();$('catalog').hidden=false;renderCatalog();$('search').focus();}
function closeCatalog(){$('catalog').hidden=true;Route.picking=false;}
function showDialog(html){closeMenu();$('dialogContent').innerHTML=html;$('infoDialog').showModal();}
function showHelp(){showDialog('<div class="modal-eyebrow">ПАРУС / ПОЛЁТ</div><h2>Свет, топливо и остановка.</h2><p>Выберите собственную тягу, постоянный свет звезды через зеркало Ø 1 км либо вспышку через то же зеркало. Вспышка длится 30 суток по часам звезды; постоянный свет действует на всём участке разгона. Звезда уничтожается только в режиме вспышки. Для Солнца этот режим запрещён.</p><p>Сухая масса — 1 кг, включая парус Si₃N₄ Ø 100 м массой 0,785 кг. Бак — 1 кг. Световой разгон сохраняет топливо, его масса учитывается. Парус и обратная тяга совместно тормозят корабль, собирая и расходуя вещество. Остаток бака не является условием миссии и показывается в прогнозе. Суммарное собственное ускорение ограничено 100 g.</p><p>На 1× секунда игрока равна году на борту. Вертикальная шкала темпа под масштабом: 0 — пауза, 1× / 10× / 100× / 1000× — скорость симуляции. Пробел — пауза; колесо — масштаб карты; перетаскивание — перемещение.</p><button class="modal-start" id="startExploring">Продолжить →</button>');$('startExploring').onclick=()=>$('infoDialog').close();}

function showModel(){
 const star=object(state.current)||object(state.flight?.fromId),light=Stellar.stellarLight(star);
 showDialog('<div class="modal-eyebrow">ФИЗИКА / МОДЕЛЬ</div><h2>Парус Ø 100 м.<br>Зеркало Ø 1 км.</h2><p>Сухая масса 1 кг; бак 1 кг. Плёнка Si₃N₄: 0,1 г/м² × 7853,98 м² = 0,7854 кг. Остаётся 0,2146 кг на прочее оборудование. Масса каркаса, нагрев и реальная спектральная отражательная способность отдельно не рассчитаны.</p><h3>Разгон</h3><p>Двигатель: релятивистское ракетное уравнение. Постоянный свет: каталожная болометрическая светимость звезды, при её отсутствии — помеченная оценка по классу. Светимость V не подставляется как болометрическая. Для выбранного источника: '+quantity(light.watts)+' Вт; '+light.basis+'. Коллектор располагается не ближе 1 а.е. и вне модельной фотосферы.</p><p>Зеркало идеально передаёт P=L D²/(16r²) в параллельный пучок. Поток вдоль пути не расходится; давление F=2P/c·(1−β)/(1+β) ослабевает из-за Доплера. Вспышка: 1,2·10³⁵ Вт, 30 суток у источника, с запаздыванием догоняющих фотонов. Постоянный свет действует на всём участке разгона. Скорость не присваивается мгновенно; разгон заканчивается по доступному свету или тормозному пути.</p><h3>Совместное торможение</h3><p>Газ собирается при максимальной допустимой площади паруса. У полного бака входящий поток направляется в фотонный двигатель. Финальный участок использует максимальное суммарное замедление, используя доступное топливо без обязательного остатка. Сбор, расход и тепловыделение интегрируются; тормозной путь включает все участки. Плотность газа везде одинакова: 1 атом/см³ (10⁶ атомов/м³), по средней оценке для Млечного Пути. Это единая игровая среда для всех маршрутов, включая войды; локальные облака и пузыри не учитываются.</p><p>Суммарный предел — 100 g. Идеальные преобразование вещества в свет, обработка газа, охлаждение и фокусировка сохранены. Слоумо меняет только воспроизведение.</p>');
}

function showObject(id=state.selected){
 const o=object(id);if(!o)return;ExtendedCatalog.ensureGalaxy(o);const f=o.facts,g=o.galaxy;
 const row=(label,value)=>'<div class="fact-row"><dt>'+label+'</dt><dd>'+value+'</dd></div>';
 let luminosity=f.lum!==undefined?'≈ '+quantity(f.lum)+' L☉<small>Болометрическая мощность: ≈ '+quantity(f.lum*Astro.solarLuminosity)+' Вт</small>':f.visual?'≈ '+quantity(f.visual.solarV)+' L☉,'+(f.band||'V')+'<small>Собственная светимость в полосе '+(f.band||'V')+'; абсолютная величина M'+(f.band||'V')+' ≈ '+fmt(f.visual.absoluteV,1)+' mag</small>':f.lumUnknown;
 const sizeButton=o.region?'<button class="map-size-action" id="viewRegion">Показать область ↗</button>':(g||o.id==='sgr')?'<button class="map-size-action" id="viewGalaxy">Показать галактику в масштабе <span>↗</span></button>':'';
 let html='<div class="modal-eyebrow">АТЛАС / ОБ ОБЪЕКТЕ</div><h2>'+o.name+'</h2><div class="object-type">'+MapDetails.typeName(o)+'</div><p>'+MapDetails.description(o)+'</p>'+(MapDetails.componentNote(o)?'<p>'+MapDetails.componentNote(o)+'</p>':'')+sizeButton+'<dl class="object-facts">'+row('Класс',f.class)+row('Масса',f.mass)+row('Светимость',luminosity);
 if(o.region)html+=row('Область',o.region.note+'<small>'+(o.region.shape==='polyline'?'Проекция опубликованной оси; не все расстояния в объёме сохраняются.':'Форма и ориентация приблизительны; проекция на плоскость не сохраняет все расстояния в объёме.')+'</small>');
 if(StellarClusters.is(o)&&!o.region)html+=row('Размер',o.atlasOnly?'Объект доступен только в атласе; масштабный контур на карте не строится.':'Индивидуальный физический размер неизвестен. Точка обозначает положение; её диаметр на экране условный.');
 if(o.kind==='nebula')html+=row('Значок туманности',o.region?'Условный знак из дуг обозначает положение и тип объекта; его размер на экране условный. Масштабный контур появляется при приближении.':o.atlasOnly?'Масштабный контур недоступен без пригодного расстояния.':'Индивидуальный размер в исходной выборке не приведён. Условный знак из дуг обозначает положение; его размер на экране условный.');
 if(o.ngc)html+=row('Каталог NGC / IC',o.ngc.replace(/^(NGC|IC)0*(\d+)/,'$1 $2'));
 if(o.cosmology)html+=row('Красное смещение',fmt(o.redshift,4)+'<small>Расстояние на карте — современное сопутствующее, ≈ '+distanceText(o.d)+'. Свет шёл ≈ '+compact(o.cosmology.lookbackYears)+' лет; это разные величины.</small>');
 if(o.apparentV!=null)html+=row('Видимая величина V',fmt(o.apparentV,2)+' mag<small>Яркость с Земли: чем меньше число, тем ярче. Не абсолютная светимость.</small>');if(o.iauNames?.length)html+=row('Имена IAU',o.iauNames.join(', '));if(o.aliases?.length)html+=row('Другие обозначения',o.aliases.join(' · '));
 if(g)html+=row('Оптический размер',distanceText(g.diameterLy)+' × '+distanceText(g.diameterLy*g.axisRatio)+'<small>Большая × малая ось проекции; размеры контура в масштабе карты</small>');
 else if(f.radius)html+=row('Размер',f.radius);
 if(f.extra)html+=row(...f.extra);
 if(o.p3){html+=row(o.arrivalAnchor?(o.cosmicCatalog?'Каталожный ориентир XYZ':'Игровая точка XYZ'):'Galactic XYZ',o.p3.map(v=>compact(v)).join(' / ')+' св. лет<small>'+(o.arrivalAnchor?(o.cosmicCatalog?'Ориентир по наблюдаемому каталогу; протяжённая область не является компактным телом':'Игровой ориентир для полёта; положение центра структуры не измерено'):'Физические координаты относительно Солнца; не координаты схемы')+'</small>')+row('Глубина Zg',distanceText(o.p3[2])+'<small>Координата вне плоскости карты, относительно Солнца</small>');if(o.raDeg!==undefined)html+=row('Направление J2000',fmt(o.raDeg,4)+'° / '+fmt(o.decDeg,4)+'°<small>Прямое восхождение / склонение</small>');}
 if(!o.p3&&Number.isFinite(o.raDeg))html+=row('Направление J2000',fmt(o.raDeg,4)+'° / '+fmt(o.decDeg,4)+'°');
 if(o.catalogDistanceLy!=null)html+=row('Исходная каталожная дальность',distanceText(o.catalogDistanceLy)+'<small>До оценки по принадлежности к системе; не используется в текущем маршруте</small>');
 if(o.gravity)html+=row('Модель пролёта',o.gravity.note);
 if(o.coordinateNote)html+=row('Координаты',o.coordinateNote);
 if(o.mapOffset?.some(v=>Math.abs(v)>1e-6))html+=row('На схеме','Положение условно смещено для отделения внеплоскостных объектов от оптического диска Млечного Пути. Это не граница принадлежности к Галактике; расстояния рассчитаны по физическим 3D-координатам.');
 if(o.positionEstimate){const e=o.positionEstimate,shared=Number.isFinite(e.sharedDistanceErrorLy)?' Общая погрешность дальности центра ≈ '+distanceText(e.sharedDistanceErrorLy)+'; она коррелирована для членов системы.':e.sharedDistanceNote||' Общая систематика расстояния отдельно не оценена.';html+=row('Локальный диапазон позиции','≈ '+distanceText(e.localEnvelopeLy)+'<small>'+e.envelopeMeaning+shared+'</small>');if(e.anchor)html+=row(e.method==='bounded-compact-host'?'Опорное скопление':'Опорная галактика',object(e.anchor)?.name||e.anchorName||e.anchor);}
 if(o.membershipNote)html+=row('Членство',o.membershipNote);
 const system=ExtendedCatalog.systemByMember.get(o.id);if(system)html+=row('Связанная система',system.name+'<small>'+system.note+'</small>');
 html+=row('От Солнца',o.atlasOnly?'Надёжная дальность неизвестна':distanceText(o.d))+'</dl>';
 if(ExtendedCatalog.systemByMember.has(o.id))html+='<button class="map-size-action" id="viewSystem">Показать связанную систему ↗</button>';
 if(o.id==='sgr'||o.nuclearStar)html+='<button class="map-size-action" id="viewNuclearCluster">Звёзды и орбиты у Стрельца A* ↗</button>';
 if(o.departureStar)html+='<button class="map-size-action" id="viewLocalStar">Найти звезду для разгона ↗</button>';
 if(o.atlasOnly)html+='<p class="object-note">Только атлас: положение недостаточно точное. На карте объект не размещён.</p>';
 html+='<p class="object-note">Оценки округлены. M☉ — масса Солнца; L☉ — его полная светимость, L☉,V и L☉,B — светимость Солнца в соответствующей полосе. Это собственное излучение, а не видимая яркость с Земли.</p>';
 if(f.visual)html+='<p class="object-note">Полосовая светимость рассчитана из каталожной фотометрии и расстояния атласа: M = m − 5 log₁₀(d/10 пк), L/L☉ = 10⁰·⁴⁽ᴹ☉⁻ᴹ⁾. Без поправки на поглощение пылью; это приблизительная оценка, не полная болометрическая мощность.</p>';
 if(MapDetails.component(o))html+='<p class="object-sources"><a href="https://www.nasa.gov/universe/chandra-scouts-nearest-star-system-for-possible-hazards/" target="_blank" rel="noopener">NASA · компоненты Альфы Центавра ↗</a></p>';
 if(f.note)html+='<p class="object-note">'+f.note+'</p>';
 html+='<p class="object-sources">'+f.refs.map(([url,label])=>'<a href="'+url+'" target="_blank" rel="noopener">'+label+' ↗</a>').join('')+'</p>';
 showDialog(html);if(o.id==='sgr'||o.nuclearStar)$('viewNuclearCluster').onclick=()=>{$('infoDialog').close();NuclearStars.focus();};if(ExtendedCatalog.systemByMember.has(o.id))$('viewSystem').onclick=()=>ExtendedCatalog.showSystem(o.id);if(o.departureStar)$('viewLocalStar').onclick=()=>{const star=ExtendedCatalog.ensureGalaxy(o);$('infoDialog').close();if(o.id===state.current)findDepartureStar();else if(star){select(star.id);ExtendedCatalog.focus(star);}};if(o.region)$('viewRegion').onclick=()=>{$('infoDialog').close();RegionMap.focus(o);};if(g||o.id==='sgr')$('viewGalaxy').onclick=()=>{const shape=g||GALAXIES[0];$('infoDialog').close();focusGalaxy(shape);};
}
function focusGalaxy(g){const span=g.diameterLy*Math.max(2.5,width/Math.max(height*.58,1));const p=MapLayout.project(g);goCamera(p.x,p.y,span);toast('Оптический контур · '+distanceText(g.diameterLy)+' · в масштабе карты');}
function showJournal(){showDialog('<div class="modal-eyebrow">КОВЧЕГ — 01 / ЖУРНАЛ</div><h2>След экспедиции.</h2><p>Исследовано '+state.visited.length+' из '+(OBJECTS.length-1)+' точек · пройдено '+distanceText(state.totalDistance)+' · собрано '+massText(state.captured)+' · аннигилировано на '+compact(state.spentEnergy/1e15)+' ПДж; отведено тепла '+compact(state.heatRadiated/1e15)+' ПДж.</p>'+[...state.journal].reverse().map(e=>'<div class="journal-entry"><time>'+compact(e.t)+' лет</time><p>'+e.text+'</p></div>').join(''));}
/* Monochrome, resolution-independent engineering chart. */
function line(x1,y1,x2,y2,color='#cecece',lw=1,dash=[]){ctx.beginPath();ctx.setLineDash(dash);ctx.strokeStyle=paint(color);ctx.lineWidth=lw;ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);}
function circle(x,y,r,color='#cccccc',lw=1,dash=[]){if(r<0||r>1e6)return;ctx.beginPath();ctx.setLineDash(dash);ctx.strokeStyle=paint(color);ctx.lineWidth=lw;ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
function text(s,x,y,size=9,color='#808080',align='left',font='mono'){ctx.fillStyle=paint(color);ctx.font=`${size}px ${font==='mono'?'"IBM Plex Mono",monospace':'"Golos Text",Arial,sans-serif'}`;ctx.textAlign=align;ctx.fillText(s,x,y);}
function nice(n){const pow=10**Math.floor(Math.log10(n)),a=n/pow;return(a<1.5?1:a<3.5?2:a<7.5?5:10)*pow;}
function drawGrid(){const {unit,majorPixels:pixels,minorPixels:minor}=gridMetrics();const origin=screen({x:0,y:0});
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

}
function galaxyProjection(g){const center=screen(g);return{center,r:g.diameterLy*.5*width/cam.span};}
function drawGalaxyBackground(){
 if(!ExtendedCatalog.matchesMap({kind:'galaxy'}))return;
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
  const points=Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2,x=Math.cos(a)*r,y=Math.sin(a)*r*g.axisRatio;return{x:center.x+x*Math.cos(g.rotation)-y*Math.sin(g.rotation),y:center.y+x*Math.sin(g.rotation)+y*Math.cos(g.rotation)};});MapLabels.contours.push({id:g.id,points,closed:true});
  if(r>18&&r<Math.max(width,height)*3){const yy=center.y+Math.min(r*g.axisRatio+22,height*.42);MapLabels.add({key:'galaxy-'+g.id,name:g.name.toUpperCase(),detail:'ОПТИЧЕСКИЙ ДИАМЕТР · '+distanceText(g.diameterLy),mass:MapDetails.mass(body),level:2,priority:selected?100:55,size:9,opacity:MapDetails.opacity(body,cam.span),color:selected?'#454545':'#747474',candidates:[{x:center.x,y:yy,align:'center'},{x:center.x,y:center.y-r*g.axisRatio-24,align:'center'},{x:center.x-r-18,y:center.y,align:'right'}]});}

 }
}
function shipReachability(){
 if(state.expansion===false)return null;
 const active=!!state.flight,q=active?MissionReach.active():MissionReach.idle();
 return{...q,radius:q.comoving*Cosmology.scale(),mode:active?'ОСТАВШИЙСЯ ПОЛЁТ С ТОРМОЖЕНИЕМ':'С РАЗГОНОМ И ТОРМОЖЕНИЕМ',active};
}
function lightReachability(){if(state.expansion===false)return null;const comoving=Cosmology.horizon();return{comoving,radius:comoving*Cosmology.scale()};}
function renderReachability(){
 const c=state.flight?.mission?.setup||FlightSetup.read(),out=$('reachReadout');out.hidden=!(width<700&&cam.span>=1e9&&state.expansion!==false);
 if(!out.hidden){const ship=shipReachability(),light=lightReachability();out.textContent='Полёт · '+(ship.radius>0?distanceText(ship.radius):'0 св. лет')+'\nСвет · '+distanceText(light.radius);}
 out.title=state.expansion!==false?'Текущие настройки и запас топлива на финише '+Math.round(c.arrivalFuelPercent||0)+'%. Разгон и полная остановка у протяжённой цели; для орбиты расчёт индивидуален. Проекция трёхмерной сферы: положение цели внутри круга не гарантирует достижимость; учитывается и глубина.':'';
}

function circleLabel(key,name,detail,p,r,priority=25){
 const candidates=[];for(let i=0;i<48;i++){const a=-Math.PI/2+i*Math.PI/24,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;if(x>20&&x<width-20&&y>30&&y<height-40)candidates.push({x,y:y-10,align:'center'});}
 // A small flight radius can sit entirely inside the dense local group. Keep
 // its numeric scale readable in a free map slot without enlarging the circle.
 if(key==='ship-reach'&&cam.span>=1e9)for(let y=height-65;y>160;y-=38)candidates.push({x:width*.48,y,align:'center'});
 if(candidates.length)MapLabels.add({key,name,detail,priority,size:9,candidates});
}
function drawReachability(){
 // Cosmological envelopes are a large-scale overlay. Do not run a range solve
 // on every braking frame while the player is looking at nearby stars.
 if(cam.span<1e6)return;
 const light=lightReachability(),p=screen(state.ship);
 if(light&&cam.span>=1e9){const r=light.radius*width/cam.span;if(r>0&&r<20000){ctx.save();ctx.globalAlpha=.7;circle(p.x,p.y,r,'#888888',1,[3,7]);ctx.restore();circleLabel('light-reach','ПРЕДЕЛ СВЕТА · '+distanceText(light.radius),'СВЕТ, ИСПУЩЕННЫЙ СЕЙЧАС · ПРОЕКЦИЯ СФЕРЫ В 3D',p,r,35);}}
 const q=shipReachability();if(!q||!(q.radius>0))return;const r=q.radius*width/cam.span;if(r>20000)return;
 ctx.save();ctx.globalAlpha=.85;circle(p.x,p.y,r,'#454545',1.2,[10,5,2,5]);ctx.restore();
 const name='ПРЕДЕЛ ПОЛЁТА · '+distanceText(q.radius),detail='ТОПЛИВНЫЙ БАК НА ФИНИШЕ ≥ '+Math.round(q.setup.arrivalFuelPercent||0)+'% · ПРОЕКЦИЯ СФЕРЫ В 3D';
 if(r>=5||cam.span>=1e9)circleLabel('ship-reach',name,detail,p,r,40);
}
function drawHorizonBoundary(){if(cam.span>4e10){const p=screen({x:0,y:0}),r=465e8*Cosmology.scale()*width/cam.span;circle(p.x,p.y,r,'#a7a7a7',.8,[7,5]);circleLabel('observable-boundary','НАБЛЮДАЕМАЯ ВСЕЛЕННАЯ','ГРАНИЦА В ИСХОДНУЮ ЭПОХУ · НЕ ДАЛЬНОСТЬ ПОЛЁТА',p,r,15);}}
function drawSymbol(o,p,selected=false){const destroyed=state.destroyed.includes(o.id)&&o.kind==='star';const ink=selected?'#171717':'#424242';ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle=paint(ink);ctx.lineWidth=1.25;
 if(destroyed){circle(0,0,9,ink,.7,[2,3]);line(-5,-5,5,5,ink,.8);line(-5,5,5,-5,ink,.8);}
 else if(o.kind==='home'){circle(0,0,14,ink,.8);circle(0,0,8,ink,1);ctx.fillStyle=paint(ink);ctx.beginPath();ctx.arc(0,0,2,0,Math.PI*2);ctx.fill();for(let i=0;i<8;i++){const a=i*Math.PI/4;line(Math.cos(a)*18,Math.sin(a)*18,Math.cos(a)*22,Math.sin(a)*22,ink,.7);}}
 else if(o.nuclearStar){circle(0,0,2.8,ink,1.2);ctx.fillStyle=paint(ink);ctx.fillRect(-.8,-.8,1.6,1.6);}
 else if(o.kind==='star'){const r=o.id==='sirius'?6:4;circle(0,0,r,ink,.8);ctx.fillStyle=paint(ink);ctx.beginPath();ctx.arc(0,0,1.5,0,Math.PI*2);ctx.fill();line(-r-5,0,-r-2,0,ink,.7);line(r+2,0,r+5,0,ink,.7);line(0,-r-5,0,-r-2,ink,.7);line(0,r+2,0,r+5,ink,.7);}
 else if(o.kind==='galaxy'){const r=o.galaxy?galaxyProjection(o.galaxy).r:1.5;if(r>=5){line(-2,0,2,0,ink,.8);line(0,-2,0,2,ink,.8);}else{circle(0,0,Math.max(.8,r),ink,.9);}}
 else if(o.kind==='pulsar'||o.kind==='quasar'){circle(0,0,5,ink);circle(0,0,10,ink,.5);line(-5,18,5,-18,ink,.9);line(-8,18,0,18,ink,.7);line(0,-18,8,-18,ink,.7);}
 else if(o.kind==='blackhole'){circle(0,0,8,ink,.8);ctx.fillStyle=paint(ink);ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(0,0,17,4,-.3,0,Math.PI*2);ctx.stroke();}
 else if(MapSymbols.handles(o))MapSymbols.draw(o,{x:0,y:0},ink);
 else if(o.kind==='void'||o.kind==='ring'||o.kind==='horizon'){const r=o.kind==='void'?23:o.kind==='ring'?21:13;circle(0,0,r,ink,.8,o.kind==='void'?[2,4]:[]);if(o.kind==='ring'){circle(0,0,r+4,ink,.4,[1,5]);for(let i=0;i<12;i++){const a=i*.54;ctx.fillStyle=paint(ink);ctx.fillRect(Math.cos(a)*r-1,Math.sin(a)*r-1,2,2);}}else{line(-r-5,0,r+5,0,ink,.5,[2,4]);line(0,-r-5,0,r+5,ink,.5,[2,4]);}}
 else if(o.kind==='wall'||o.kind==='arc'){ctx.beginPath();for(let i=0;i<12;i++){const x=(i-5.5)*5,y=Math.sin(i*.5)*9;i?ctx.lineTo(x,y):ctx.moveTo(x,y);ctx.fillStyle=paint(ink);ctx.fillRect(x-1.2,y-1.2,2.4,2.4);}ctx.stroke();}
 else{for(let i=0;i<11;i++){const a=i*2.4,r=4+Math.sqrt(i)*3;circle(Math.cos(a)*r,Math.sin(a)*r,1.4,ink,.7);}circle(0,0,18,ink,.4,[2,4]);}
 if(selected){for(let a=0;a<4;a++){ctx.save();ctx.rotate(a*Math.PI/2);ctx.beginPath();ctx.moveTo(21,-16);ctx.lineTo(21,-21);ctx.lineTo(16,-21);ctx.stroke();ctx.restore();}}
 ctx.restore();}
function routeLabelDistance(o){const start=state.flight?.from||state.ship;return o.p3?distanceText(Cosmology.physicalDistance(start,o)):'расстояние неизвестно';}
function drawObjects(){hitObjects=[];const departure=state.flight?.fromId||state.current,occupied=new Map();
 const nearby=p=>{const x=Math.floor(p.x/24),y=Math.floor(p.y/24);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if((occupied.get((x+dx)+','+(y+dy))||[]).some(q=>Math.hypot(p.x-q.x,p.y-q.y)<24))return true;return false;};
 const reserve=p=>{const key=Math.floor(p.x/24)+','+Math.floor(p.y/24);if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push(p);};
 const priority=o=>o.id==='sgr'&&cam.span<2?90:ExtendedCatalog.background(o)?10:o.id===state.selected?100:o.id===departure?85:o.cosmicLandmark?70:o.galaxy?50:o.id==='sol'?40:20;
 const eligible=o=>MapDetails.visible(o,cam.span)||MapDetails.sparse(o,cam.span);
 const visible=[...new Map([...OBJECTS,...ExtendedCatalog.pinned.values(),...ExtendedCatalog.visible.filter(o=>eligible(o)&&!ExtendedCatalog.background(o)),...MapLayers.visible.filter(o=>eligible(o)&&!ExtendedCatalog.background(o))].map(o=>[o.id,o])).values()].filter(o=>ExtendedCatalog.matchesMap(o)&&ExtendedCatalog.opacity(o,!MapDetails.sparse(o,cam.span))>.015&&RegionMap.asPoint(o)&&(!ExtendedCatalog.background(o)||o.id===state.selected||o.id===state.current)&&eligible(o)&&(o.kind!=='horizon'||cam.span>3e10)).map(o=>({o,p:screen(o)})).filter(({p})=>p.x>-40&&p.x<width+40&&p.y>-40&&p.y<height+40).sort((a,b)=>MapDetails.level(b.o)-MapDetails.level(a.o)||MapDetails.massOrder(a.o,b.o)||priority(b.o)-priority(a.o)||(a.o.apparentV??20)-(b.o.apparentV??20)||a.o.id.localeCompare(b.o.id));
 for(const {o,p} of visible){
  if(MapDetails.sparse(o,cam.span)){const selected=o.id===state.selected,opacity=(.7+.3*MapDetails.opacity(o,cam.span))*ExtendedCatalog.opacity(o,false)*RegionMap.pointOpacity(o);MapLabels.point({key:'object-'+o.id,object:o,name:o.id==='sol'?'СОЛНЦЕ / ЗЕМЛЯ':o.name,detail:()=>(o.id===(state.flight?.target||state.selected)?'ЦЕЛЬ · ':'')+routeLabelDistance(o),p,mass:MapDetails.mass(o),level:MapDetails.level(o),priority:priority(o),selected,opacity,sparse:true,onPlace:()=>{ctx.save();ctx.globalAlpha=opacity;drawSymbol(o,p,selected);ctx.restore();const hit={o,p,r:MapSymbols.handles(o)?7:23,background:false,sparse:true};hitObjects.push(hit);MapLandmarks.reserve(hit);}});continue;}
  const bg=ExtendedCatalog.background(o);if(!bg&&nearby(p)){if(!MapLayers.active||!MapLayers.manages(o))continue;reserve(p);ctx.save();ctx.globalAlpha=ExtendedCatalog.opacity(o)*RegionMap.pointOpacity(o);if(MapSymbols.handles(o))drawSymbol(o,p,o.id===state.selected);else circle(p.x,p.y,2.2,'#777777',.8);ctx.restore();hitObjects.push({o,p,r:5,background:false});continue;}if(!bg)reserve(p);const selected=o.id===state.selected,opacity=ExtendedCatalog.opacity(o)*RegionMap.pointOpacity(o);ctx.save();ctx.globalAlpha=opacity;if(bg&&!MapSymbols.handles(o)){circle(p.x,p.y,3,'#969696',1);if(selected)circle(p.x,p.y,7,'#646464',.8,[2,3]);}else drawSymbol(o,p,selected);ctx.restore();hitObjects.push({o,p,r:MapSymbols.handles(o)?7:bg?7:23,background:bg});
  // Large galaxy contours already queued their own label.
  if((StellarClusters.is(o)?StellarClusters.view(o).area<.5:o.kind==='nebula'?Nebulae.view(o).area<.5:true)&&(!o.galaxy||galaxyProjection(o.galaxy).r<=18))MapLabels.point({key:'object-'+o.id,object:o,name:o.id==='sol'?'СОЛНЦЕ / ЗЕМЛЯ':o.name,detail:(o.id===(state.flight?.target||state.selected)?'ЦЕЛЬ · ':'')+routeLabelDistance(o),p,mass:MapDetails.mass(o),level:MapDetails.level(o),priority:priority(o),selected,opacity});
 }
 /* At planetary zoom, Earth is separated from Sol at one astronomical unit. */
 if(cam.span<.001&&ExtendedCatalog.matchesMap({kind:'star'})){const earth=screen({x:.00001581,y:0});circle(earth.x,earth.y,4,'#252525');text('ЗЕМЛЯ / 1 а.е.',earth.x+12,earth.y-8,9,'#434343');const sun=screen({x:0,y:0});circle(sun.x,sun.y,.00001581*width/cam.span,'#c3c3c3',.7,[3,5]);}
}
// Clip around a nearby point before handing coordinates to Canvas. Extremely distant
// endpoints otherwise exceed the renderer's precision at stellar zoom while following.
function routeScreenSegment(from,to){
 const f=state.flight&&from===state.flight.from?state.flight:null,a=f?FlightView.at(f,0):from===state.ship?FlightView.ship():MapLayout.project(from),b=f?FlightView.at(f,1):MapLayout.project(to),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!(length>0))return null;
 const t=f?f.covered/f.distance:0,p=f?screen(state.ship):screen(from),ux=dx/length,uy=dy/length,scale=width/cam.span;
 let lo=-t*length*scale,hi=(1-t)*length*scale;
 for(const [origin,direction,min,max] of [[p.x,ux,-2,width+2],[p.y,uy,-2,height+2]]){
  if(Math.abs(direction)<1e-15){if(origin<min||origin>max)return null;continue;}
  const v=(min-origin)/direction,w=(max-origin)/direction;lo=Math.max(lo,Math.min(v,w));hi=Math.min(hi,Math.max(v,w));if(lo>hi)return null;
 }
 return {a:{x:p.x+ux*lo,y:p.y+uy*lo},b:{x:p.x+ux*hi,y:p.y+uy*hi}};
}
function drawPhysicalSegment(from,to,color='#767676',lw=.8,dash=[5,6]){const segment=routeScreenSegment(from,to);if(segment)line(segment.a.x,segment.a.y,segment.b.x,segment.b.y,color,lw,dash);}
function drawRoute(){const f=state.flight,target=object(f?f.target:state.selected);if(!target||target.id===state.current||!target.navigable)return;
 const from=f?f.from:state.ship;drawPhysicalSegment(from,target);
 FlightMarks.draw(f);
}
function sailGeometry(radius,braking=false){const side=braking?-1:1;return{side,radius,rim:30*side,belly:54*side,tether:side*4};}
function drawShip(time){const p=screen(state.ship),f=state.flight,target=f?object(f.target):object(state.selected),ahead=f?screen(FlightView.at(f,f.covered/f.distance+1)):screen(target),angle=Number.isFinite(ahead.x)&&Number.isFinite(ahead.y)?Math.atan2(ahead.y-p.y,ahead.x-p.x):0;
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle+(state.phase==='dock'?Math.PI:0));ctx.lineWidth=.9;ctx.strokeStyle=paint('#252525');
 const braking=state.phase==='brake'&&(!f?.mission||f.mission.setup.brakeSail&&f.mission.setup.densityCm3>0),composedOpening=f?.mission?MissionPlanner.sailOpening(f):1,sailOpen=!!f&&(state.phase==='launch'||braking)&&composedOpening>0;
 if(sailOpen){const g=sailGeometry(21,braking);let opening=1;if(state.phase==='launch')opening=Math.max(.035,Math.sqrt(f.mission?composedOpening:Stellar.sampleProper(f.wind,f.wind.elapsedProper||0).opening));const r=g.radius*opening;
  ctx.beginPath();ctx.moveTo(g.rim,-r);ctx.quadraticCurveTo(g.belly,0,g.rim,r);ctx.stroke();
  line(g.tether,0,g.rim,-r,'#555',.75);line(g.tether,0,g.rim,r,'#555',.75);line(g.tether,0,(g.rim+g.belly)/2,0,'#777',.6);
  for(let i=1;i<4;i++){const y=r*(i/4);const x=g.rim+(g.belly-g.rim)*.45*(1-(y/r)**2);line(g.tether,0,x,y,'#aaa',.4);line(g.tether,0,x,-y,'#aaa',.4);}
 }
 ctx.beginPath();ctx.fillStyle=paint('#252525');ctx.moveTo(11,0);ctx.lineTo(-3,-4);ctx.lineTo(0,0);ctx.lineTo(-3,4);ctx.closePath();ctx.fill();
 if(state.phase==='thrust'||state.phase==='dock'){const len=13+Math.sin(time*.025)*3;line(-5,-2,-len,0,'#555',.8);line(-5,2,-len,0,'#555',.8);line(-8,0,-len-6,0,'#999',.6);}
 if(state.phase==='brake'&&f?.mission?.setup.brakeEngine&&(f.mission.brake.kind==='engine'||f.missionSample?.burnRate>0)){const len=15+Math.sin(time*.025)*3;line(13,-2,len+8,0,'#555',.8);line(13,2,len+8,0,'#555',.8);}
 if(braking){for(let i=0;i<15;i++){const t=((time/1000+i/15)%1),x=65-t*105,y=(i%5-2)*10;ctx.fillStyle=paint('#888');ctx.fillRect(x,y,1.4,1.4);}ctx.beginPath();ctx.ellipse(-24,0,28,35,0,1.5,4.8);ctx.setLineDash([3,5]);ctx.strokeStyle=paint('#aaa');ctx.stroke();ctx.setLineDash([]);}
 ctx.restore();if(cam.span<60000&&(!f||Math.hypot(p.x-screen(target).x,p.y-screen(target).y)>65))MapLabels.point({key:'ship',name:'КОРАБЛЬ',p,priority:35});
}
function drawEffects(dt){effects=effects.filter(e=>e.age<8);for(const e of effects){e.age+=paused?0:dt*speed;const p=screen(e);for(let k=0;k<3;k++){const r=(e.age*48+k*24)%370;circle(p.x,p.y,r,`rgba(37,38,32,${Math.max(0,.38-r/980)})`,.7,k===1?[2,6]:[]);}for(let i=0;i<40;i++){const a=i*2.399,r=e.age*25+(i%5)*9;ctx.fillStyle=paint('#8b8b8b');ctx.fillRect(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,1,1);}}}
function drawHover(){if(!hover||!ExtendedCatalog.matchesMap(hover))return;const p=screen(hover);if(MapSymbols.handles(hover)&&RegionMap.asPoint(hover)){circle(p.x,p.y,7,'#969696',.6,[2,4]);return;}if(hover.region||['structure','wall','void','ring','arc','horizon'].includes(hover.kind))return;circle(p.x,p.y,27,'#969696',.6,[2,4]);}

let lastFrame=performance.now();function frame(now){Cosmology.sync(state);const realDt=Math.max(0,(now-lastFrame)/1000);lastFrame=now;Simulation.advance(realDt);
 if(!document.hidden){if(cameraGoal){const a=1-Math.exp(-Math.min(realDt,.1)*8);cam.x+=(cameraGoal.x-cam.x)*a;cam.y+=(cameraGoal.y-cam.y)*a;cam.span=Math.exp(Math.log(cam.span)+(Math.log(cameraGoal.span)-Math.log(cam.span))*a);if(Math.abs(Math.log(cam.span/cameraGoal.span))<.0005&&Math.hypot(cam.x-cameraGoal.x,cam.y-cameraGoal.y)<cam.span*.0001){cam={...cameraGoal};cameraGoal=null;}}
 if(followShip){const c=shipCamera(cam.span);cam.x=c.x;cam.y=c.y;}updateZoomControl();
 MapLayers.update(now);ExtendedCatalog.update(now);drawGrid();MapLabels.begin();drawGalaxyBackground();RegionMap.draw();drawHorizonBoundary();drawReachability();Route.draw();drawRoute();drawEffects(Math.min(realDt,.1));ExtendedCatalog.drawSystems();NuclearStars.draw();drawObjects();ExtendedCatalog.draw();drawShip(now);MapLabels.draw();Route.drawEncounter();drawHover();if(now-lastUI>100){renderUI();lastUI=now;}}
 if(now-saveTick>1500){persist();saveTick=now;}requestAnimationFrame(frame);
}

function zoomAtPointer(e){e.preventDefault();cameraGoal=null;const factor=Math.exp(clamp(e.deltaY,-220,220)*.006),span=clamp(cam.span*factor,.00006,1.4e11);
 if(followShip)cam=shipCamera(span);
 else{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,before=world(x,y);cam.span=span;const after=world(x,y);cam.x+=before.x-after.x;cam.y+=before.y-after.y;}
 updateMapHeading();updateZoomControl();}
canvas.addEventListener('wheel',zoomAtPointer,{passive:false});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;releaseShipCamera();pointer={down:true,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,id:e.pointerId};canvas.setPointerCapture(e.pointerId);cameraGoal=null;});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(pointer.down&&e.pointerId===pointer.id){const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>5)pointer.moved=true;if(pointer.moved){cam.x-=dx*cam.span/width;cam.y-=dy*cam.span/width;canvas.style.cursor='grabbing';updateMapHeading();}pointer.x=e.clientX;pointer.y=e.clientY;}else{hover=hitObjects.find(({p,r=23})=>Math.hypot(x-p.x,y-p.y)<r)?.o||RegionMap.hit(x,y);canvas.style.cursor=hover?'pointer':'crosshair';}});
canvas.addEventListener('pointerup',e=>{if(!pointer.down||e.pointerId!==pointer.id)return;if(!pointer.moved){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const hit=hitObjects.map(h=>({...h,d:Math.hypot(x-h.p.x,y-h.p.y)})).filter(h=>h.d<(h.r||28)).sort((a,b)=>Number(!!a.background)-Number(!!b.background)||a.d-b.d)[0];if(hit)select(hit.o.id);else{const region=RegionMap.hit(x,y);if(region)select(region.id);}}pointer.down=false;canvas.style.cursor='crosshair';});
canvas.addEventListener('pointercancel',()=>{pointer.down=false;canvas.style.cursor='crosshair';});canvas.addEventListener('pointerleave',()=>hover=null);

$('shipBtn').onclick=focusShip;
document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{goCamera(cam.x,cam.y,Number(b.dataset.zoom),false,true);});
$('expansionToggle').addEventListener('change',e=>{state.expansion=e.target.checked;Cosmology.sync(state);FlightEstimate.idleKey=null;FlightEstimate.active=new WeakMap();renderUI();persist();});
$('zoomSlider').addEventListener('input',e=>{cameraGoal=null;const span=zoomInterpolate(Number(e.target.value),'value','span');if(followShip)cam=shipCamera(span);else cam.span=span;updateMapHeading();updateZoomControl();});
$('catalogBtn').onclick=()=>{if($('catalog').hidden)openCatalog();else closeCatalog();};$('closeCatalog').onclick=closeCatalog;$('search').oninput=()=>{ExtendedCatalog.searchLimit=100;clearTimeout(catalogTimer);catalogTimer=setTimeout(renderCatalog,160);};
$('themeBtn').onclick=()=>applyTheme(theme==='dark'?'light':'dark');
$('menuBtn').onclick=()=>{const open=$('menu').hidden;$('menu').hidden=!open;$('menuBtn').setAttribute('aria-expanded',String(open));};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.menu-popover,.menu-button'))closeMenu();});
$('catalogFilter').addEventListener('change',e=>{filter=e.target.value;hover=null;hitObjects=[];RegionMap.hits=[];ExtendedCatalog.searchLimit=100;const name=e.target.selectedOptions?.[0]?.textContent||filter;$('catalogBtn').title=filter==='all'?'Атлас':'На карте: '+name;$('catalogBtn').setAttribute('aria-label',filter==='all'?'Атлас':'Атлас. На карте: '+name);renderCatalog();});
$('flightDetails').addEventListener('toggle',()=>{
 const reading=$('flightCard').querySelector('.card-scroll'),details=$('flightDetails');
 reading.scrollTop=details.open?reading.scrollTop+details.getBoundingClientRect().top-reading.getBoundingClientRect().top:0;
});
document.querySelectorAll('[data-departure]').forEach(b=>b.onclick=()=>{if(state.flight||b.dataset.departure!=='engine'&&!canBoost(b.dataset.departure))return;state.departureMode=b.dataset.departure;if(OrbitalArrival.enabled){const mode=b.dataset.departure;state.flightSetup=FlightSetup.normalize({...FlightSetup.preferred(),engine:mode==='engine',sail:mode!=='engine',collector:mode!=='engine',burst:mode==='burst'});}renderUI();persist();});
document.querySelectorAll('[data-sail]').forEach(b=>b.onclick=()=>{if(state.flight||!canBoost())return;state.sail=+b.dataset.sail;renderUI();persist();});

$('timeSlider').addEventListener('input',event=>setTimeRate(TIME_RATES[Number(event.target.value)]));
document.querySelectorAll('[data-time]').forEach(button=>button.onclick=()=>setTimeRate(button.dataset.time));
$('findDepartureStar').onclick=$('findDepartureStarCard').onclick=()=>{syncClock();findDepartureStar();};
$('launchBtn').onclick=()=>{syncClock();if(state.current===state.selected){const here=object(state.current),star=ExtendedCatalog.ensureGalaxy(here);if(star)findDepartureStar();else openCatalog();}else launch();};$('helpBtn').onclick=showHelp;$('modelBtn').onclick=showModel;$('journalBtn').onclick=showJournal;$('objectInfo').onclick=()=>showObject(state.flight?.target||state.selected);$('closeDialog').onclick=()=>$('infoDialog').close();
$('infoDialog').addEventListener('click',e=>{if(e.target===$('infoDialog')){const r=$('infoDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('infoDialog').close();}});
$('resetBtn').onclick=()=>{showDialog('<div class="modal-eyebrow">НОВАЯ ЭКСПЕДИЦИЯ</div><h2>Снова от Солнца?</h2><p>Текущий прогресс в этом браузере будет сброшен.</p><button class="modal-start" id="confirmReset">Начать заново →</button>');$('confirmReset').onclick=()=>{state=initial();paused=false;speed=1;Simulation.debt=0;Simulation.wallDebt=0;delete Simulation.smoothedFactor;lastFrame=performance.now();effects=[];goCamera(0,0,24);renderUI();persist();$('infoDialog').close();toast('Новая экспедиция. Солнечная система, нулевой год.');};};
window.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,button,summary')||$('infoDialog').open||$('flightBuilder').open)return;if(e.code==='Space'){e.preventDefault();syncClock();paused=!paused;renderUI();persist();}if(e.key==='Escape'){closeCatalog();closeMenu();}if(e.key==='+'||e.key==='=')goCamera(cam.x,cam.y,cam.span/2,false,true);if(e.key==='-')goCamera(cam.x,cam.y,cam.span*2,false,true);});
function syncClock(){const now=performance.now();Simulation.advance(Math.max(0,(now-lastFrame)/1000));lastFrame=now;}
document.addEventListener('visibilitychange',()=>{syncClock();persist();});window.addEventListener('pagehide',persist);
resize();
if(state.flight)fitRoute(object(state.flight.target));else if(state.current&&state.current!=='sol')goCamera(FlightView.ship().x,FlightView.ship().y,Math.max(object(state.current).d*2,24),true);
FlightBuilder.setup();Route.setup();applyTheme(theme);updateShipButton();resize();renderUI();updateMapHeading();renderCatalog();MapLayers.start();ExtendedCatalog.start();requestAnimationFrame(frame);
