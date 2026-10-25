'use strict';
// Display hierarchy and one collision budget for every atlas label.
const MapDetails={
 typeName(o){
  if(o.synthetic)return 'Искусственный игровой объект · звезда';
  const code=o.catalogType||String(o.type||'').split(' · ')[1];
  const subtype={OCl:'Рассеянное звёздное скопление',GCl:'Шаровое звёздное скопление','*Ass':'Звёздная ассоциация','Cl+N':'Звёздное скопление с туманностью',PN:'Планетарная туманность',EmN:'Эмиссионная туманность',RfN:'Отражательная туманность',SNR:'Остаток сверхновой',HII:'Область ионизированного водорода · туманность',GGroup:'Группа галактик',GPair:'Пара галактик',GTrpl:'Тройка галактик',Dup:'Дублирующая каталожная запись',NonEx:'Историческая неподтверждённая запись'}[code];
  if(subtype)return subtype;
  if(o.kind==='cluster')return /галактик/i.test([o.type,o.facts?.class,o.name].join(' '))?'Скопление галактик':'Звёздное скопление';
  return {home:'Звезда · Солнце',star:'Звезда',pulsar:'Пульсар · нейтронная звезда',blackhole:'Чёрная дыра',quasar:'Квазар · активное ядро галактики',galaxy:'Галактика',nebula:'Туманность',structure:'Мегаструктура',wall:'Галактическая стена · мегаструктура',void:'Космический войд',ring:'Кольцевая мегаструктура · кандидат',arc:'Дуговая мегаструктура · кандидат',horizon:'Космологический горизонт'}[o.kind]||o.type||'Тип не определён';
 },
 description(o){return o.synthetic?o.desc:(o.desc||'').replace(/^Реальная каталожная запись [^.]+\.\s*/,'').replace(/^Реальный объект:\s*[^.]+\.\s*/,'');},
 component(o){return {alpha:'A','hyg-71453':'B',proxima:'C'}[o.id];},
 componentNote(o){const c=this.component(o);return c?'Компонент '+c+' тройной системы Альфа Центавра. A и B образуют тесную пару; C — Проксима Центавра, её далёкий компаньон. Буквы A, B, C обозначают компоненты одной системы; Бета Центавра — другая звёздная система.':'';},
 cleanName(o){let name=(o.name||'').replace(/\s*[·,]?\s*\b(?:NGC|IC)\s*\d+[A-Za-z]?\b/gi,'').replace(/\s*[·,]\s*$/,'').trim();
  const m=Number(o.messier);if(m&&!/\bM\s*\d+/.test(name))name+=' · M'+m;
  return name||o.name;
 },
 searchKey(s){return s.normalize('NFKD').toLocaleLowerCase('ru').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]/gu,'').replace(/(ngc|ic)0+(?=\d)/g,'$1');},
 mass(o){
  if(!o)return null;if(Number.isFinite(o.massSolar)&&o.massSolar>0)return o.massSolar;
  const txt=o.facts?.mass||'',sup={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-'};
  const m=txt.match(/([\d.,]+(?:\s*·\s*10[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)?(?:\s*\+\s*[\d.,]+)?)(?:\s*(тыс|млн|млрд))?\s*M☉/);
  if(m){const parts=m[1].split('+').map(v=>{const a=v.replace(/,/g,'.').replace(/\s/g,'').split('·10');return Number(a[0])*(a[1]?10**Number([...a[1]].map(c=>sup[c]??c).join('')):1);}),n=parts.reduce((a,b)=>a+b,0)*({тыс:1e3,млн:1e6,млрд:1e9}[m[2]]||1);if(n>0&&Number.isFinite(n))return n;}
  return Number.isFinite(o.gravity?.massSolar)&&o.gravity.massSolar>0?o.gravity.massSolar:null;
 },
 massOrder(a,b){const ma=this.mass(a),mb=this.mass(b);return ma!==null&&mb!==null?mb-ma:ma!==null?-1:mb!==null?1:0;},
 maxSpan(o){
  if(o.nuclearStar)return 60000;
  if(o.galaxyMember)return (o.hostDiameterLy||30000)*5;
  if(o.positionQuality==='unknown')return Infinity;
  if(o.synthetic)return 2500;
  if(o.cosmicLandmark)return Infinity;
  if(o.galaxy)return Math.max(1e8,o.d*30,o.galaxy.diameterLy*300);
  if(o.kind==='home')return 600;
  if(o.kind==='star')return 60000;
  if(o.kind==='blackhole')return o.id==='sgr'?4e6:Math.max(100000,(o.d||0)*15);
  if(o.kind==='nebula')return Math.max(1e7,(o.d||0)*80);
  if(o.kind==='pulsar')return Math.min(3e6,Math.max(1000,(o.d||0)*25));
  if(o.kind==='galaxy')return Math.max(1e8,(o.d||0)*30);
  if(o.kind==='quasar')return Math.max(1e7,(o.d||0)*15);
  return Infinity;
 },
 opacity(o,span){const max=this.maxSpan(o);if(span>=max)return 0;if(span<=max*.45)return 1;const t=(span/max-.45)/.55;return 1-t*t*(3-2*t);},
 visible(o,span){if(o.atlasOnly)return false;return this.opacity(o,span)>.03;}
};
for(const o of OBJECTS){const name=MapDetails.cleanName(o);if(name!==o.name){o.aliases=[...new Set([...(o.aliases||[]),o.name])];o.name=name;}if(o.galaxy)o.galaxy.name=o.name;}
const MapLabels={
 queue:[],boxes:[],placed:[],slots:new Map(),viewKey:null,
 dynamic(key){return key==='ship'||key==='ship-reach'||key.startsWith('flight-mark-');},
 overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;},
 begin(){const key=[cam.x,cam.y,cam.span,width,height,state.selected,state.flight?.fromId||state.current].join(':');if(this.viewKey!==key){this.slots.clear();this.viewKey=key;}this.queue=[];this.placed=[];this.boxes=[{x:0,y:0,w:Math.min(width-30,430),h:112},{x:width-300,y:0,w:300,h:80},{x:0,y:height-45,w:width,h:45},{x:0,y:height-200,w:80,h:200},{x:0,y:132,w:185,h:395}];
  // Reserve the card's column independently of its changing telemetry height.
  if(width>=700)this.boxes.push({x:width-340,y:90,w:340,h:height-90});
  else{const r=$('flightCard').getBoundingClientRect();this.boxes.push({x:r.left-12,y:Math.min(r.top-8,height*.45),w:r.width+24,h:height});}
 },
 add(label){this.queue.push(label);},
 point({key,name,detail,p,mass=null,priority=20,selected=false,opacity=1,size}){
  this.add({key,name,detail,mass,priority,size:size||(selected?12:10),opacity,color:selected?'#171717':'#454545',candidates:[{x:p.x+19,y:p.y-18,align:'left'}]});
 },
 draw(){this.queue.sort((a,b)=>Number(this.dynamic(a.key))-Number(this.dynamic(b.key))||((b.mass??-Infinity)-(a.mass??-Infinity)||0)||b.priority-a.priority||a.key.localeCompare(b.key));for(const q of this.queue){const size=q.size||9;ctx.font=size+'px "Golos Text",Arial,sans-serif';const mainWidth=ctx.measureText(q.name).width;ctx.font='7px "IBM Plex Mono",monospace';const detailWidth=q.detail?ctx.measureText(q.detail).width:0,w=Math.max(mainWidth,detailWidth)+12,h=q.detail?33:20;
  const candidates=q.key.startsWith('galaxy-')?q.candidates.slice(0,1):q.candidates;
  for(const p of candidates){const x=p.align==='right'?p.x-w:p.align==='center'?p.x-w/2:p.x,box={x:x-4,y:p.y-size-5,w:w+8,h};if(box.x<8||box.x+box.w>width-8||box.y<8||box.y+box.h>height-8||this.boxes.some(b=>this.overlaps(box,b)))continue;
   if(!this.dynamic(q.key))this.slots.set(q.key,q.candidates.indexOf(p));
   this.boxes.push(box);this.placed.push({key:q.key,...box});ctx.save();ctx.globalAlpha=q.opacity??1;text(q.name,p.x,p.y,size,q.color||'#646464',p.align||'left','sans');if(q.detail)text(q.detail,p.x,p.y+14,7,'#999999',p.align||'left');ctx.restore();q.onPlace?.(box);break;
  }
 }}
};
