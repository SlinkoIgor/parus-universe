'use strict';
// Epochs on the reference observer's past light cone, not present-day materials.
// Flat H0=67.4, Om=.315, Or=.000092; log(a) quadrature, reproduced in docs.
const UniverseMap={
 radius:46.1332705258e9,patterns:new Map(),labels:[],angle:-.72,
 areas:[
  {id:'epoch-dawn',name:'Первые звёзды и галактики',type:'Космический рассвет',r0:27.4661e9,r1:37.6899e9,age:'≈0,1–0,9 млрд лет',desc:'Газ формирует первые звёзды и молодые галактики. Начинается реионизация; звёзды обогащают среду тяжёлыми элементами, появляется пыль.',note:'Условный диапазон z≈6–30. Переходы постепенны; граница первых звёзд модельна.'},
  {id:'epoch-dark',name:'Тёмные века',type:'Нейтральный газ до первых источников света',r0:37.6899e9,r1:45.2256916518e9,age:'≈0,38–100 млн лет',desc:'Вселенная уже прозрачна, но звёзд ещё нет. В основном это нейтральные водород и гелий. Неоднородности газа растут под действием гравитации.',note:'Это не эпоха пылевых облаков. Точки обозначают среду, а не обнаруженные объекты.'},
  {id:'epoch-cmb',name:'Реликтовый свет',type:'Поверхность последнего рассеяния · z≈1100',r0:45.2256916518e9,r1:46.1332705258e9,age:'≈380 тыс. лет',desc:'Электроны связываются с ядрами; фотоны начинают свободно распространяться. Реликтовое излучение — самый ранний прямо наблюдаемый электромагнитный свет.',note:'Не край пространства. Ещё более ранние стадии доступны здесь же, в сведениях об области.'},
  {id:'epoch-beyond',name:'За пределами наблюдаемой Вселенной',type:'За горизонтом наблюдений',r0:46.1332705258e9,age:'Нет',desc:'Свет из этой области не успел дойти до нас за время существования Вселенной. Прямых наблюдений её содержимого у нас нет.',note:'Это не край пространства. Пространство может продолжаться дальше; полный размер Вселенной неизвестен.'},
  {id:'epoch-qgp',name:'Кварк-глюонная плазма',type:'Ранняя Вселенная · модельная эпоха',age:'≲10 микросекунд',desc:'Кварки и глюоны ещё не связаны в обычные адроны. Это стадия космологической модели, не наблюдаемая далёкая область с оптическими координатами.',note:'Вся наблюдаемая область прошла эту стадию. Прямого изображения этой эпохи в фотонах нет.'},
  {id:'epoch-particles',name:'Адроны и лёгкие ядра',type:'Ранняя Вселенная · модельная эпоха',age:'Микросекунды → минуты',desc:'Кварки связываются в адроны. Позже первичный нуклеосинтез создаёт лёгкие ядра; электроны и излучение остаются частью среды.',note:'Стадии перекрываются. Вещество не состояло только из перечисленных частиц.'},
  {id:'epoch-plasma',name:'Ионизованная плазма',type:'Ранняя Вселенная · до прозрачности',age:'До ≈380 тыс. лет',desc:'Фотоны часто рассеиваются на свободных электронах. Вселенная непрозрачна для прямого электромагнитного наблюдения; постепенно формируются нейтральные атомы.',note:'Это эпоха всей наблюдаемой области, не современная оболочка плазмы за далёкими галактиками.'}
 ],
 init(){
  for(const q of this.areas){Object.assign(q,{kind:'horizon',cosmicEpoch:true,navigable:false,index:OBJECTS.length,aliases:[q.type],facts:{class:q.type,mass:'Не объект с измеренной массой.',lumUnknown:'Не отдельный источник света.',note:q.note,refs:[['https://lambda.gsfc.nasa.gov/education/graphic_history/univ_evol.html','NASA · история Вселенной']]}});OBJECTS.push(q);ExtendedCatalog.coreIndex.set(q.id,q);}
 },
 active(){return cam.span/Cosmology.scale()>=3e10;},
 geometry(){const p=screen({x:0,y:0});return{...p,k:Cosmology.scale()*width/cam.span,r:this.radius*Cosmology.scale()*width/cam.span};},
 path(g,r0,r1){ctx.beginPath();ctx.arc(g.x,g.y,r1*g.k,0,2*Math.PI);ctx.arc(g.x,g.y,r0*g.k,0,2*Math.PI,true);ctx.closePath();},
 pattern(kind){
  const key=theme+kind;if(this.patterns.has(key))return this.patterns.get(key);
  const tile=document.createElement('canvas'),spacing=kind==='cmb'?4:kind==='dark'?8:16;tile.width=tile.height=spacing;const c=tile.getContext('2d');c.fillStyle=paint(kind==='cmb'?'#555555':'#777777');
  const dot=(x,y,r)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
  dot(2,2,.6);if(kind==='dawn'){dot(10,2,.75);dot(2,10,.75);dot(10,10,.5);}
  const p=ctx.createPattern(tile,'repeat');this.patterns.set(key,p);return p;
 },
 label(name,sub,x,y,align='left',alpha=.75,size=10){
  ctx.save();ctx.globalAlpha=alpha;ctx.font=size+'px "Golos Text",sans-serif';const w=Math.max(ctx.measureText(name).width,sub.length*(size<10?3.6:4.8)),left=align==='right'?x-w:align==='center'?x-w/2:x;
  text(name,x,y,size,'#454545',align,'sans');text(sub,x,y+(size<10?10:14),size<10?6:8,'#808080',align);ctx.restore();return{x:left-5,y:y-size-3,w:w+10,h:size<10?24:33};
 },
 draw(){
  this.labels=[];if(!this.active())return;const g=this.geometry();ctx.save();
  const selected=hover?.cosmicEpoch?hover:object(state.selected);
  for(const [i,q] of this.areas.slice(0,3).entries()){
   this.path(g,q.r0,q.r1);ctx.fillStyle=this.pattern(['dawn','dark','cmb'][i]);ctx.globalAlpha=i===2?.4:.35;ctx.fill();
   if(selected?.id===q.id){ctx.globalAlpha=.035;ctx.fillStyle=paint('#454545');ctx.fill();ctx.globalAlpha=.1;ctx.beginPath();ctx.arc(g.x,g.y,q.r1*g.k,this.angle-.22,this.angle+.22);ctx.arc(g.x,g.y,q.r0*g.k,this.angle+.22,this.angle-.22,true);ctx.closePath();ctx.fill();}
  }
  ctx.globalAlpha=.55;circle(g.x,g.y,g.r,'#808080',.8);circle(g.x,g.y,this.areas[2].r0*g.k,'#969696',.7);
  ctx.globalAlpha=.3;for(const q of this.areas.slice(0,2))circle(g.x,g.y,q.r0*g.k,'#969696',.6,[1,5]);ctx.globalAlpha=1;
  if(g.r>=120){
   const small=width<700,positions=small?[[g.x,g.y-g.r*.7,'center'],[g.x,g.y-g.r*.86,'center'],[g.x+g.r*.3,g.y+g.r*.95,'left']]:[[g.x+g.r*.39,g.y-g.r*.51,'left'],[g.x-g.r*.82,g.y-g.r*.37,'left'],[g.x+g.r*.28,g.y+g.r*.96,'left']];
   this.areas.slice(0,3).forEach((q,i)=>{const [x,y,a]=positions[i];this.labels.push({q,box:this.label(q.name.toLocaleUpperCase('ru'),i===0?'Космический рассвет':i===1?'Нейтральный газ':'≈45,2 млрд св. лет',x,y,a,.75,small?7:10)});});
   const q=this.areas[3],x=small?width-18:width>1100?g.x+g.r*.95:width-24,y=small?Math.max(84,g.y-g.r-21):width>1100?g.y-g.r*.68:g.y-g.r-18;
   this.labels.push({q,box:this.label(width>1100?q.name.toLocaleUpperCase('ru'):'ЗА ПРЕДЕЛАМИ',width>1100?'Нет прямых наблюдений':'наблюдаемой Вселенной',x,y,small||width<=1100?'right':'left',selected?.id===q.id?.9:.65,small?7:10)});
  }
  ctx.restore();
 },
 hit(x,y){
  if(!this.active())return null;const named=this.labels.find(({box:b})=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(named)return named.q;
  const g=this.geometry(),r=Math.hypot(x-g.x,y-g.y)/g.k;this.angle=Math.atan2(y-g.y,x-g.x);
  return r>this.radius?this.areas[3]:this.areas.slice(0,3).find(q=>r>=q.r0&&r<=q.r1)||null;
 },
 overview(){
  if(!width||!height)return{x:0,y:0,span:115e9};
  const small=width<=700,r=small?Math.min(width*.43,(height-80)*.45):Math.min(width*.247,(height-136)*.5),span=this.radius*Cosmology.scale()*width/Math.max(1,r),x=(.43-(small?.5:.465))*span,y=(height*(width<700?.39:.5)-(small?height*.43+30:height*.51+15))*span/width;return{x,y,span};
 },
 focus(){const c=this.overview();goCamera(c.x,c.y,c.span);},
 renderCard(target){
  const epoch=target.cosmicEpoch;
  $('targetDistance').parentElement.querySelector('.distance-caption').textContent=epoch?'РАССТОЯНИЕ В ИСХОДНУЮ ЭПОХУ':'РАССТОЯНИЕ ДО ЦЕЛИ';
  $('arrivalEstimate').querySelector('.arrival-main span').textContent=epoch?'в наблюдаемую эпоху':'по бортовому времени';
  $('arrivalEarth').parentElement.hidden=!!epoch;
  $('flightDetails').querySelector('summary span').textContent=epoch?'Об области':'Расчёт и схема';
  let details=$('epochDetails');if(!details){details=document.createElement('div');details.id='epochDetails';details.className='object-note';$('flightDetails').append(details);}details.hidden=!epoch;
  if(!epoch)return;
  $('mapSliceTargetNotice').hidden=true;$('horizonNotice').hidden=false;$('horizonNotice').textContent=target.desc;
  $('arrivalEstimate').hidden=false;$('arrivalLabel').textContent=target.id==='epoch-beyond'?'ПРЯМЫЕ НАБЛЮДЕНИЯ':'ВОЗРАСТ ВСЕЛЕННОЙ';$('arrivalProper').textContent=target.age;
  if(target.id==='epoch-beyond')$('arrivalEstimate').querySelector('.arrival-main span').textContent='содержимого области';
  $('targetDistance').textContent=target.r1?distanceText(target.r0)+' — '+distanceText(target.r1):target.r0?'Более '+distanceText(target.r0):'До прозрачности';
  $('arrivalFuelRow').hidden=true;$('flightDetails').hidden=false;$('flightHint').textContent=target.note;
  if(details.dataset.epoch===target.id)return;details.dataset.epoch=target.id;
  details.textContent='Кольца показывают эпохи на прошлом световом конусе в исходную эпоху карты, а не современный состав оболочек. Точечная фактура условна; отдельные наблюдаемые объекты имеют собственные каталожные символы. Модель колец: H₀=67,4, Ωm=0,315, Ωr=0,000092. Полная дальность сохраняется в радиальном виде; в обычном виде и срезе глубина свёрнута.';
  if(['epoch-cmb','epoch-qgp','epoch-particles','epoch-plasma'].includes(target.id))for(const q of this.areas.slice(4)){const b=document.createElement('button');b.className='text-action';b.textContent=q.name+' ↗';b.onclick=()=>select(q.id);details.append(b);}
 }
};
globalThis.UniverseMap=UniverseMap;
UniverseMap.init();
