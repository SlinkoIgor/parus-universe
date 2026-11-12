'use strict';
// Epochs on the reference observer's past light cone, not present-day materials.
// Flat H0=67.4, Om=.315, Or=.000092; log(a) quadrature, reproduced in docs.
const UniverseMap={
 radius:46.1332705258e9,patterns:new Map(),labels:[],ruler:null,
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
 drawRuler(g){
  // Two radius dimensions span the same expanding reference sphere as the map.
  if(g.r<80)return;
  const radius=this.radius*Cosmology.scale(),billions=radius/1e9,
   value=billions<1e6?fmt(billions,1):billions.toLocaleString('ru-RU',{notation:'scientific',maximumSignificantDigits:4}),
   label=value+' млрд св. лет',size=width<700?8:10,
   w=MapLabels.measure(label,size+'px "IBM Plex Mono",monospace'),y=g.y+g.r+12,
   box={x:g.x-g.r-5,y:y-6,w:2*g.r+10,h:28};
  if(w>g.r-8||!MapLabels.intersectsViewport(box))return;
  const from={x:g.x-g.r,y},center={x:g.x,y},to={x:g.x+g.r,y},
   labels=[{text:label,x:g.x-g.r/2,y:y+18},{text:label,x:g.x+g.r/2,y:y+18}];
  this.ruler={radius,diameter:2*radius,label,labels,box,from,center,to};
  ctx.save();ctx.globalAlpha=.9;line(from.x,y,to.x,y,'#646464',.9);
  for(const x of [from.x,center.x,to.x])line(x,y-5,x,y+5,'#646464',.9);
  // Arrowheads touch the end stops, as on an engineering dimension line.
  for(const [x,sign] of [[from.x,1],[to.x,-1]]){
   line(x,y,x+sign*6,y-3,'#646464',.9);line(x,y,x+sign*6,y+3,'#646464',.9);
  }
  for(const q of labels)text(q.text,q.x,q.y,size,'#454545','center');ctx.restore();
 },
 path(g,r0,r1){ctx.beginPath();ctx.arc(g.x,g.y,r1*g.k,0,2*Math.PI);ctx.arc(g.x,g.y,r0*g.k,0,2*Math.PI,true);ctx.closePath();},
 pattern(kind){
  const key=theme+kind;if(this.patterns.has(key))return this.patterns.get(key);
  const tile=document.createElement('canvas'),spacing=kind==='cmb'?4:kind==='dark'?8:16;tile.width=tile.height=spacing;const c=tile.getContext('2d');c.fillStyle=paint(kind==='cmb'?'#555555':'#777777');
  const dot=(x,y,r)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
  dot(2,2,.6);if(kind==='dawn'){dot(10,2,.75);dot(2,10,.75);dot(10,10,.5);}
  const p=ctx.createPattern(tile,'repeat');this.patterns.set(key,p);return p;
 },
 label(q,name,sub,x,y,anchor,align='left',alpha=.75,size=10){
  const active=MapLabels.emphasized(q);if(active)alpha=1;
  ctx.save();ctx.font=size+'px "Golos Text",Arial,sans-serif';const w=Math.max(ctx.measureText(name).width,MapLabels.measure(sub,(size<10?6:8)+'px "IBM Plex Mono",monospace')),left=align==='right'?x-w:align==='center'?x-w/2:x;
  const box={x:left-5,y:y-size-3,w:w+10,h:size<10?24:33};let leader=MapLabels.leader(box,anchor,alpha,active);
  if(!leader){
   // Wider fallback fonts must not swallow a short pointer. Slide its endpoint
   // along the same radius, so it remains in the same epoch at every width.
   const g=this.geometry(),r=Math.hypot(anchor.x-g.x,anchor.y-g.y),angle=Math.atan2(anchor.y-g.y,anchor.x-g.x);
   for(const turn of [-.15,.15,-.3,.3,-.5,.5]){const p={x:g.x+r*Math.cos(angle+turn),y:g.y+r*Math.sin(angle+turn)};if(Math.hypot(p.x-clamp(p.x,box.x,box.x+box.w),p.y-clamp(p.y,box.y,box.y+box.h))>=10){leader=MapLabels.leader(box,p,alpha,active);break;}}
  }
  ctx.globalAlpha=alpha;text(name,x,y,size,active?'#171717':'#454545',align,'sans');text(sub,x,y+(size<10?10:14),size<10?6:8,active?'#454545':'#808080',align);ctx.restore();return{q,box,leader};
 },
 draw(){
  this.labels=[];this.ruler=null;if(!this.active())return;const g=this.geometry();ctx.save();
  const selected=object(state.selected),hovered=hover?.cosmicEpoch?hover:null;
  for(const [i,q] of this.areas.slice(0,3).entries()){
   this.path(g,q.r0,q.r1);ctx.fillStyle=this.pattern(['dawn','dark','cmb'][i]);ctx.globalAlpha=i===2?.4:.35;ctx.fill();
   if(selected?.id===q.id||hovered?.id===q.id){ctx.globalAlpha=selected?.id===q.id?.07:.025;ctx.fillStyle=paint('#454545');ctx.fill();}
  }
  ctx.globalAlpha=.55;circle(g.x,g.y,g.r,'#808080',.8);circle(g.x,g.y,this.areas[2].r0*g.k,'#969696',.7);
  ctx.globalAlpha=.3;for(const q of this.areas.slice(0,2))circle(g.x,g.y,q.r0*g.k,'#969696',.6,[1,5]);ctx.globalAlpha=1;
  if(g.r>=120){
   const small=width<700,positions=small?[[g.x,g.y-g.r*.7,'center'],[g.x,g.y-g.r*.86,'center'],[g.x+g.r*.3,g.y+g.r*.95,'left']]:[[g.x+g.r*.39,g.y-g.r*.51,'left'],[g.x-g.r*.82,g.y-g.r*.37,'left'],[g.x+g.r*.28,g.y+g.r*.96,'left']];
   // Each endpoint lies within its own band, including the narrow CMB ring.
   const endpoints=small?[[-.45,-.64],[.35,-.84],[.09,.986]]:[[.43,-.62],[-.86,-.28],[.22,.966]];
   this.areas.slice(0,3).forEach((q,i)=>{const [x,y,a]=positions[i],[ax,ay]=endpoints[i],anchor={x:g.x+ax*g.r,y:g.y+ay*g.r};this.labels.push(this.label(q,q.name.toLocaleUpperCase('ru'),i===0?'Космический рассвет':i===1?'Нейтральный газ':'≈45,2 млрд св. лет',x,y,anchor,a,.75,small?7:10));});
   const q=this.areas[3],x=small?width-18:width>1100?g.x+g.r*.95:width-24,y=small?Math.max(84,g.y-g.r-21):width>1100?g.y-g.r*.68:g.y-g.r-18;
   const anchor={x:g.x+(small?.62:.91)*g.r,y:g.y-(small?.86:.53)*g.r};
   this.labels.push(this.label(q,width>1100?q.name.toLocaleUpperCase('ru'):'ЗА ПРЕДЕЛАМИ',width>1100?'Нет прямых наблюдений':'наблюдаемой Вселенной',x,y,anchor,small||width<=1100?'right':'left',.65,small?7:10));
  }
  this.drawRuler(g);ctx.restore();
 },
 hit(x,y){
  if(!this.active())return null;const named=this.labels.find(({box:b})=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(named)return named.q;
  const g=this.geometry(),r=Math.hypot(x-g.x,y-g.y)/g.k;
  return r>this.radius?this.areas[3]:this.areas.slice(0,3).find(q=>r>=q.r0&&r<=q.r1)||null;
 },
 overview(){
  if(!width||!height)return{x:0,y:0,span:115e9};
  const h=cameraViewportHeight(),small=width<=700,r=small?Math.min(width*.43,(h-80)*.45):Math.min(width*.247,(h-136)*.5),span=this.radius*Cosmology.scale()*width/Math.max(1,r),x=(.43-(small?.5:.465))*span,y=(mapOriginY()-(small?h*.43+30:h*.51+15))*span/width;return{x,y,span};
 },
 focus(){const c=this.overview();goCamera(c.x,c.y,c.span);},
 renderCard(target){
  const epoch=target.cosmicEpoch;
  UIContent.text($('targetDistance').parentElement.querySelector('.distance-caption'), epoch?'РАССТОЯНИЕ В ИСХОДНУЮ ЭПОХУ':'РАССТОЯНИЕ ДО ЦЕЛИ');
  UIContent.text($('arrivalEstimate').querySelector('.arrival-main span'), epoch?'в наблюдаемую эпоху':'На борту');
  $('arrivalEarth').parentElement.hidden=!!epoch;
  UIContent.text($('flightDetails').querySelector('summary span'), epoch?'Об области':'Расчёт и схема');
  let details=$('epochDetails');if(!details){details=document.createElement('div');details.id='epochDetails';details.className='object-note';$('flightDetails').append(details);}details.hidden=!epoch;
  if(!epoch)return;
  $('horizonNotice').hidden=false;UIContent.text($('horizonNotice'), target.desc);
  $('arrivalEstimate').hidden=false;UIContent.text($('arrivalLabel'), target.id==='epoch-beyond'?'ПРЯМЫЕ НАБЛЮДЕНИЯ':'ВОЗРАСТ ВСЕЛЕННОЙ');UIContent.text($('arrivalProper'), target.age);
  if(target.id==='epoch-beyond')UIContent.text($('arrivalEstimate').querySelector('.arrival-main span'), 'содержимого области');
  UIContent.text($('targetDistance'), target.r1?distanceText(target.r0)+' — '+distanceText(target.r1):target.r0?'Более '+distanceText(target.r0):'До прозрачности');
  $('flightDetails').hidden=false;UIContent.text($('flightHint'), target.note);
  if(details.dataset.epoch===target.id)return;details.dataset.epoch=target.id;
  details.textContent='Кольца показывают эпохи на прошлом световом конусе в исходную эпоху карты, а не современный состав оболочек. Точечная фактура условна; отдельные наблюдаемые объекты имеют собственные каталожные символы. Модель колец: H₀=67,4, Ωm=0,315, Ωr=0,000092. Полная дальность сохраняется в радиальном виде; в обычном виде и срезе глубина свёрнута.';
  if(['epoch-cmb','epoch-qgp','epoch-particles','epoch-plasma'].includes(target.id))for(const q of this.areas.slice(4)){const b=document.createElement('button');b.className='text-action';b.textContent=q.name+' ↗';b.onclick=()=>select(q.id);details.append(b);}
 }
};
globalThis.UniverseMap=UniverseMap;
UniverseMap.init();
