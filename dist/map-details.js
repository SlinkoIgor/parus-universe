'use strict';
// Display hierarchy and one collision budget for every atlas label.
const MapDetails={
 massCache:new WeakMap(),
 typeName(o){
  if(o.catalogClass==='galaxy-cluster')return 'Скопление галактик';
  if(o.cosmicSubtype==='filament')return 'Галактический филамент';
  if(o.cosmicSubtype==='supercluster')return 'Сверхскопление галактик';
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
 massInfo(o){
  if(!o)return null;
  const key=[o.massSolar,o.massUncertaintySolar,o.massSource,o.massIsSystem,o.facts?.mass,o.facts?.ref,o.gravity?.massSolar,o.gravity?.source,o.source],cached=this.massCache.get(o);
  if(cached&&key.every((v,i)=>v===cached.key[i]))return cached.value;
  const value=this.computeMassInfo(o);this.massCache.set(o,{key,value});return value;
 },
 computeMassInfo(o){
  if(!o)return null;
  if(Number.isFinite(o.massSolar)&&o.massSolar>0)return{solar:o.massSolar,...(Number.isFinite(o.massUncertaintySolar)?{uncertainty:o.massUncertaintySolar}:{}),source:o.massSource||o.facts?.ref||o.source||'',basis:'Численная масса объекта',system:!!o.massIsSystem};
  const txt=String(o.facts?.mass||'');
  // A typical neutron-star mass is not an individual measurement. In particular,
  // never take the uncertainty after ± as the central value of a catalogue mass.
  if(!/не измерена|типичн|ориентир|неизвест|не установлена|нет индивидуальн/i.test(txt)){
   const compact=txt.replace(/(?<=\d)[\s\u00a0]+(?=\d)/g,''),sup={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-'},power='[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+',num='(?:[0-9]+(?:[.,][0-9]+)?(?:\\s*[·×]\\s*10'+power+')?|10'+power+')';
   const m=compact.match(new RegExp('('+num+')(?:\\s*(±|[–−-]|\\+)\\s*('+num+'))?(?:\\s*(тыс|млн|млрд))?\\s*M☉'));
   if(m){const parse=s=>{const a=s.replace(',','.').replace(/\s/g,'').split(/[·×]10/);return a.length>1?Number(a[0])*10**Number([...a[1]].map(c=>sup[c]??c).join('')):/^10[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+$/.test(s)?10**Number([...s.slice(2)].map(c=>sup[c]??c).join('')):Number(a[0]);},factor={тыс:1e3,млн:1e6,млрд:1e9}[m[4]]||1,a=parse(m[1])*factor,b=m[3]?parse(m[3])*factor:null,range=m[2]&&m[2]!=='±'&&m[2]!=='+';
    const solar=m[2]==='+'?a+b:range?(a+b)/2:a;
    if(solar>0&&Number.isFinite(solar))return{solar,uncertainty:m[2]==='±'?b:null,min:range?Math.min(a,b):null,max:range?Math.max(a,b):null,system:m[2]==='+',source:o.facts?.ref||o.source||'',basis:txt};
   }
  }
  return Number.isFinite(o.gravity?.massSolar)&&o.gravity.massSolar>0?{solar:o.gravity.massSolar,source:o.gravity.source||o.source||'',basis:'Гравитационная модель объекта',system:false}:null;
 },
 mass(o){return this.massInfo(o)?.solar??null;},
 massOrder(a,b){const ma=this.mass(a),mb=this.mass(b);return ma!==null&&mb!==null?mb-ma:ma!==null?-1:mb!==null?1:0;},
 group(o){if(o.cosmicSubtype)return o.cosmicSubtype;if(o.kind==='cluster'){if(o.catalogClass==='stellar-cluster'||o.catalogClass==='galaxy-cluster')return o.catalogClass;return /галактик/i.test([o.type,o.name,o.facts?.class].join(' '))?'galaxy-cluster':'stellar-cluster';}return o.kind;},
 mapLabelName(o){
  if(!['galaxy-cluster','filament'].includes(this.group(o)))return o.name;
  // Catalogue identifiers remain in the atlas/card, without crowding the map.
  const named=value=>/\p{L}/u.test(value||'')&&!/\d/.test(value);
  return [o.name,...(o.aliases||[])].find(named)||null;
 },
 level(o){return({home:0,star:0,pulsar:0,blackhole:0,nebula:1,'stellar-cluster':1,galaxy:2,quasar:2,'galaxy-cluster':3,filament:4,supercluster:4,structure:4,wall:4,ring:4,arc:4,void:4,horizon:4})[this.group(o)]??0;},
 maxSpan(o){
  // One cutoff per scale class. Compact landmarks use the same boundary,
  // then compete for empty screen space in the final label pass.
  if(o.synthetic)return 2000;
  // Every resolved population retains its host scale. Larger local objects
  // also keep their own class range; adding a host cannot shorten that range.
  const hostSpan=o.galaxyMember?(o.hostDiameterLy||30000)*5:o.bulkGalaxyMember&&o.positionEstimate?.referenceScaleLy>0?o.positionEstimate.referenceScaleLy*5:0;
  if(hostSpan)return Math.max(hostSpan,this.level(o)===1?300000:0);
  if(o.positionQuality==='unknown')return Infinity;
  if(o.cosmicLandmark&&this.level(o)>=4)return Infinity;
  if(o.galaxy&&!o.streamed)return 3e9;
  if(this.group(o)==='stellar-cluster'||o.kind==='nebula')return 300000;
  if(this.group(o)==='galaxy-cluster')return 2e9;
  if(o.kind==='home')return 600;
  if(o.kind==='star'||o.kind==='pulsar')return 2000;
  if(o.kind==='blackhole')return o.id==='sgr'?4e6:2000;
  if(o.kind==='galaxy'||o.kind==='quasar')return 3e8;
  return Infinity;
 },
 // Hide the complete filament class at the ruler's 200 million ly mark.
 opacity(o,span,viewportWidth){if(this.group(o)==='filament'&&gridMetrics({span},viewportWidth).unit>=2e8)return 0;const max=this.maxSpan(o);if(span>=max)return 0;if(span<=max*.8)return 1;const t=(span/max-.8)/.2;return 1-t*t*(3-2*t);},
 landmark(o){return !o.atlasOnly&&!o.synthetic&&!o.bulkGalaxyMember&&!o.nuclearStar&&o.p3?.every(Number.isFinite)&&Number.isFinite(this.maxSpan(o))&&!!(o.cosmicLandmark||o.messier||!o.streamed&&ExtendedCatalog.coreIndex?.has(o.id)&&!ExtendedCatalog.background(o));},
 discoverable(o){return !!(!o.atlasOnly&&!o.synthetic&&!o.nuclearStar&&o.positionQuality!=='unknown'&&o.navigable!==false&&o.p3?.length===3&&o.p3.every(Number.isFinite)&&Number.isFinite(this.maxSpan(o)));},
 sparse(o,span){return span>this.maxSpan(o)*.8&&this.discoverable(o);},
 visible(o,span,viewportWidth){if(o.atlasOnly)return false;return this.opacity(o,span,viewportWidth)>.03;}
};
for(const o of OBJECTS){const name=MapDetails.cleanName(o);if(name!==o.name){o.aliases=[...new Set([...(o.aliases||[]),o.name])];o.name=name;}if(o.galaxy)o.galaxy.name=o.name;}
// Real catalogue details fill gaps only after all ordinary glyphs and labels.
// Cache structural geometry with its render cache; index point glyphs per pass.
const MapLandmarks={
 cache:null,points:null,ui:null,prepared:false,
 box(points){const xs=points.map(p=>p.x),ys=points.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};},
 cells(box,visit){const x0=Math.max(-1,Math.floor(box.x/64)),x1=Math.min(Math.ceil(width/64),Math.floor((box.x+box.w)/64)),y0=Math.max(-1,Math.floor(box.y/64)),y1=Math.min(Math.ceil(height/64),Math.floor((box.y+box.h)/64));for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)visit(x+','+y);},
 insert(grid,item){this.cells(item.box,key=>{if(!grid.has(key))grid.set(key,[]);grid.get(key).push(item);});},
 query(grid,box){const found=new Set();this.cells(box,key=>{for(const item of grid.get(key)||[])found.add(item);});return found;},
 occupied(box){let found=false;this.cells(box,key=>{if(found)return;for(const item of this.points.get(key)||[])if(MapLabels.overlaps(box,item.box)){found=true;break;}});return found;},
 prepare(){
  if(this.prepared)return;this.prepared=true;
  if(!this.points){this.points=new Map();for(const h of hitObjects)this.reserve(h);}
  const scale=Cosmology.scale(),key=MapLabels.viewKey+':'+MapLabels.contours.map(q=>q.id).join(','),cache=this.cache;
  const shift=cache?Math.abs(scale/cache.scale-1)*(2+Math.hypot(cam.x,cam.y)/cam.span)*Math.max(width,height):Infinity;
  if(cache&&cache.key===key&&cache.hits===RegionMap.hits&&shift<.15)return;
  const grid=new Map();
  for(const h of [...RegionMap.hits,...MapLabels.contours]){
   // Galaxy outlines are background for compact contents. Their actual glyphs
   // and labels already reserve space when the contents cannot be resolved.
   const bounds=this.box(h.points),container=!!h.container;
   const segments=h.segments||h.points.slice(1).map((p,i)=>[h.points[i],p]);
   // Separate segment bounds avoid filling a large filament's empty bounding box.
   for(const pair of segments)this.insert(grid,{box:this.box(pair),pair,container});
   if(h.closed)this.insert(grid,{box:bounds,polygon:h.points,container});
  }
  this.cache={key,scale,hits:RegionMap.hits,grid};
 },
 reserve({p,r=23}){this.insert(this.points,{box:{x:p.x-r,y:p.y-r,w:2*r,h:2*r}});},
 contains(p,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;},
 crosses([a,b],box){let lo=0,hi=1;const dx=b.x-a.x,dy=b.y-a.y;for(const [p,q] of [[-dx,a.x-box.x],[dx,box.x+box.w-a.x],[-dy,a.y-box.y],[dy,box.y+box.h-a.y]]){if(p===0){if(q<0)return false;}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;}}return true;},
 clear(box,object){
  if(this.occupied(box))return false;
  for(const h of this.query(this.cache.grid,box)){
   if(h.container&&object&&MapDetails.level(object)<2)continue;
   if(h.pair?this.crosses(h.pair,box):this.contains({x:box.x+box.w/2,y:box.y+box.h/2},h.polygon))return false;
  }return true;
 },
 available(p,object){
  if(p.x<24||p.x>width-24||p.y<24||p.y>height-24)return false;
  const guard={x:p.x-48,y:p.y-48,w:96,h:96},symbol={x:p.x-24,y:p.y-24,w:48,h:48};
  // Labels reserve broad stable columns. Small glyphs can also use the visible
  // gaps beside a compact card or collapsed controls, without entering the UI.
  if(!this.ui){this.ui=[...document.querySelectorAll('.map-heading,.map-actions,.map-controls,.flight-card,.map-scale,.ship-location,.catalog-drawer,.menu-popover')].map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0).map(r=>({x:r.left-4,y:r.top-4,w:r.width+8,h:r.height+8}));if(!this.ui.length)this.ui=MapLabels.boxes.slice(0,MapLabels.uiCount);}
  if(this.ui.some(b=>MapLabels.overlaps(symbol,b)))return false;
  this.prepare();if(!this.clear(guard,object))return false;
  return !MapLabels.boxes.slice(MapLabels.uiCount).some(b=>MapLabels.overlaps(guard,b));
 },
 labelClear(box,object){return this.clear({x:box.x-8,y:box.y-8,w:box.w+16,h:box.h+16},object);}
};
const MapLabels={
 queue:[],boxes:[],placed:[],contours:[],slots:new Map(),viewKey:null,
 dynamic(key){return key==='ship'||key==='ship-reach'||key==='light-reach'||key.startsWith('flight-mark-');},
 overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;},
 begin(){const key=[cam.x,cam.y,cam.span,width,height,state.selected,state.flight?.fromId||state.current].join(':');if(this.viewKey!==key){this.slots.clear();this.viewKey=key;}this.queue=[];this.placed=[];this.contours=[];MapLandmarks.points=null;MapLandmarks.ui=null;MapLandmarks.prepared=false;this.boxes=[{x:0,y:0,w:Math.min(width-30,430),h:150},{x:width-300,y:0,w:300,h:80},{x:0,y:height-45,w:width,h:45},{x:0,y:height-200,w:80,h:200},{x:0,y:132,w:185,h:480}];
  // Reserve the card's column independently of its changing telemetry height.
  if(width>=700){const column=(width<=1050?300:310)+40;this.boxes.push({x:width-column,y:68,w:column,h:height-68});}
  else{const r=$('flightCard').getBoundingClientRect();this.boxes.push({x:r.left-12,y:Math.min(r.top-8,height*.45),w:r.width+24,h:height});}
  this.uiCount=this.boxes.length;
 },
 add(label){this.queue.push(label);},
 point({key,name,detail,p,object,mass=null,level=0,priority=20,selected=false,opacity=1,size,sparse=false,onPlace}){
  this.add({key,name,detail,object,mass,level,priority,size:size||(selected?12:10),opacity,sparse,p,onPlace,color:selected?'#171717':'#454545',candidates:[{x:p.x+19,y:p.y-18,align:'left'}]});
 },
 draw(){this.queue.sort((a,b)=>Number(this.dynamic(a.key))-Number(this.dynamic(b.key))||Number(!!a.sparse)-Number(!!b.sparse)||(b.level||0)-(a.level||0)||(a.sparse&&b.sparse?Number(MapDetails.landmark(b.object))-Number(MapDetails.landmark(a.object)):0)||((b.mass??-Infinity)-(a.mass??-Infinity)||0)||b.priority-a.priority||a.key.localeCompare(b.key));for(const q of this.queue){if(q.sparse&&!MapLandmarks.available(q.p,q.object))continue;const mapName=q.object?MapDetails.mapLabelName(q.object):q.name;if(mapName===null){if(q.sparse)q.onPlace?.();continue;}const name=q.object&&mapName!==q.object.name?(q.key.startsWith('region-')?mapName.toUpperCase():mapName):q.name,detail=typeof q.detail==='function'?q.detail():q.detail,size=q.size||9;ctx.font=size+'px "Golos Text",Arial,sans-serif';const mainWidth=ctx.measureText(name).width;ctx.font='7px "IBM Plex Mono",monospace';const detailWidth=detail?ctx.measureText(detail).width:0,w=Math.max(mainWidth,detailWidth)+12,h=detail?33:20;
  const candidates=q.key.startsWith('galaxy-')?q.candidates.slice(0,1):q.candidates;
  for(const p of candidates){const x=p.align==='right'?p.x-w:p.align==='center'?p.x-w/2:p.x,box={x:x-4,y:p.y-size-5,w:w+8,h};if(box.x<8||box.x+box.w>width-8||box.y<8||box.y+box.h>height-8||this.boxes.some(b=>this.overlaps(box,b))||q.sparse&&!MapLandmarks.labelClear(box,q.object))continue;
   if(!this.dynamic(q.key))this.slots.set(q.key,q.candidates.indexOf(p));
   this.boxes.push(box);this.placed.push({key:q.key,...box});ctx.save();ctx.globalAlpha=q.opacity??1;text(name,p.x,p.y,size,q.color||'#646464',p.align||'left','sans');if(detail)text(detail,p.x,p.y+14,7,'#999999',p.align||'left');ctx.restore();if(!q.sparse)q.onPlace?.(box);break;
  }
  if(q.sparse)q.onPlace?.();
 }}
};
