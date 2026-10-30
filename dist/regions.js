'use strict';
// Display envelopes only. Physical routes never use these polygons.
const REGION_DATA={
 omega:{shape:'ellipse',major:150,minor:150,note:'Диаметр ≈150 св. лет.',url:'https://www.eso.org/public/news/eso0844/'},
 virgo:{shape:'ellipse',major:10.1e6,minor:10.1e6,note:'Вириальный диаметр ≈3,1 Мпк (10,1 млн св. лет).',url:'https://doi.org/10.1088/0067-0049/200/1/4'},
 coma:{shape:'ellipse',major:20.2e6,minor:20.2e6,note:'Вириальный диаметр ≈20,2 ±4,6 млн св. лет.',url:'https://doi.org/10.1093/mnras/stw305'},
 bootes:{shape:'ellipse',major:300e6,minor:300e6,note:'Приближённый диаметр ≈300 млн св. лет; граница разрежения условная.',url:'https://www.cambridge.org/core/journals/symposium-international-astronomical-union/article/survey-of-the-bootes-void/6F39377E63896D57AC817C29885A21D1'},
 laniakea:{shape:'basin',major:522e6,minor:522e6,note:'Масштаб бассейна ≈160 Мпк (522 млн св. лет). Область включает Млечный Путь; контур иллюстративный.',url:'https://www.nature.com/articles/nature13674'},
 attractor:{shape:'basin',major:150e6,minor:90e6,illustrative:true,note:'Единой измеренной границы нет. Показанная область иллюстративна, её размер не является измерением.',url:'https://arxiv.org/abs/astro-ph/0503647'},
 cfa:{shape:'ribbon',major:792e6,minor:280e6,note:'Обследованная протяжённость ≈170 ×60 h⁻¹ Мпк; при h=0,7 это ≈792 ×280 млн св. лет. Ориентация и толщина условные.',url:'https://pubmed.ncbi.nlm.nih.gov/17812575/'},
 sloan:{shape:'ribbon',major:1.412e9,minor:1.412e9*.08,note:'Длина ≈433 Мпк (1,41 млрд св. лет). Ширина ленты и ориентация иллюстративны.',url:'https://doi.org/10.1088/0004-637X/736/1/51'},
 ring:{shape:'ring',major:1.305e9,minor:1.305e9,note:'Кандидат: диаметр ≈400 Мпк (1,3 млрд св. лет). Толщина кольца условная.',url:'https://arxiv.org/abs/2402.07591'},
 arc:{shape:'arc',major:3.262e9,minor:1.2e9,note:'Кандидат: размах ≈1 Гпк (3,26 млрд св. лет). Кривизна и ширина рисунка условные.',url:'https://arxiv.org/abs/2201.06875'}
};
// Individual display sizes already present in the imported records. r50 is a
// half-number radius, never a full cluster diameter or a measured boundary.
const StellarClusters={
 is(o){return MapDetails.group(o)==='stellar-cluster';},
 prepare(o){
  if(!this.is(o)||o.region||o.atlasOnly||!o.p3?.every(Number.isFinite))return;
  let major,minor,note,url,kind;
  if(Number.isFinite(o.diameterLy)&&o.diameterLy>0&&!o.sizeEstimated&&!o.sizeUnknown){
   major=o.diameterLy;minor=o.minorDiameterLy>0?o.minorDiameterLy:major;url=o.source;
   kind=o.catalog==='GlobularModels'?'half-light':'diameter';note=kind==='half-light'?'Диаметр области, содержащей половину света, ≈'+major.toPrecision(3)+' св. лет; не полный диаметр скопления.':'Каталожный диаметр ≈'+major.toPrecision(3)+' св. лет.';
  }else{
   const measurement=o.catalogMeasurements?.find(m=>Number.isFinite(m.data?.halfNumberRadiusPc)&&m.data.halfNumberRadiusPc>0),radius=o.catalogData?.halfNumberRadiusPc>0?o.catalogData.halfNumberRadiusPc:measurement?.data.halfNumberRadiusPc;
   if(Number.isFinite(radius)&&radius>0){major=minor=2*radius*3.261563777;kind='half-number';url=measurement?.source||o.source;note='Радиус r₅₀ ≈'+(major/2).toPrecision(3)+' св. лет: содержит 50% звёзд-членов по Hunt–Reffert 2024, не всё скопление. Погрешность r₅₀ в используемой таблице не приведена.';}
   else if(Number.isFinite(o.angularMajorArcmin)&&o.angularMajorArcmin>0&&o.d>0){major=2*o.d*Math.tan(o.angularMajorArcmin*Math.PI/21600);minor=o.angularMinorArcmin>0?2*o.d*Math.tan(o.angularMinorArcmin*Math.PI/21600):major;kind='optical';url='https://github.com/mattiaverga/OpenNGC';note='Оптические оси ≈'+major.toPrecision(3)+' × '+minor.toPrecision(3)+' св. лет по угловым размерам OpenNGC и принятому расстоянию; не радиус гало. Погрешность размера не приведена.';}
  }
  if(!(major>0&&minor>0&&Number.isFinite(major)&&Number.isFinite(minor)))return;
  o.region={shape:'ellipse',major,minor,sizeKind:kind,mapSizeDerived:true,illustrative:true,note:note+' Форма и ориентация контура условные.',url};
  if(url&&o.facts?.refs&&!o.facts.refs.some(r=>r[0]===url))o.facts.refs.push([url,'Размер звёздного скопления']);
 },
 view(o){
  const radius=o.region?Math.max(o.region.major,o.region.minor)*.5*width/cam.span:0;
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  const area=smooth((radius-2)/2)*(1-smooth((cam.span-20000)/10000));
  return{radius,area,point:1-area};
 }
};
globalThis.StellarClusters=StellarClusters;
// Every rendering path uses the same compact class glyph. Its pixel footprint
// is a cartographic marker, independent of the sourced area drawn below.
const MapSymbols={
 handles(o){return ['stellar-cluster','galaxy-cluster','nebula'].includes(MapDetails.group(o));},
 draw(o,p,ink='#424242'){
  const group=MapDetails.group(o);ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle=ctx.fillStyle=paint(ink);ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();
  if(group==='stellar-cluster'){ctx.arc(0,0,1.6,0,Math.PI*2);ctx.fill();}
  else if(group==='galaxy-cluster'){ctx.moveTo(0,-3.6);ctx.lineTo(3.6,0);ctx.lineTo(0,3.6);ctx.lineTo(-3.6,0);ctx.closePath();ctx.stroke();}
  else if(group==='nebula'){
   ctx.moveTo(-4.8,.6);ctx.bezierCurveTo(-5.3,-2,-2.8,-4,.2,-3.2);
   ctx.moveTo(2.7,-2.7);ctx.bezierCurveTo(5,-1.9,5.3,.8,3.4,2.2);
   ctx.moveTo(1.3,3.2);ctx.bezierCurveTo(-1.4,4.4,-4,2.9,-3.5,1.5);
   ctx.moveTo(-1.8,.5);ctx.bezierCurveTo(-1.1,-1.7,1.3,-1.3,1.7,.5);ctx.stroke();
  }
  ctx.restore();
 },
 dash(o){return MapDetails.group(o)==='stellar-cluster'?[1,4]:MapDetails.group(o)==='galaxy-cluster'?[7,3,1,3]:o.kind==='nebula'?[]:null;}
};
globalThis.MapSymbols=MapSymbols;
const Nebulae={
 prepare(o){
  if(o.kind!=='nebula'||o.atlasOnly||!o.p3?.every(Number.isFinite)||o.region&&!o.region.nebulaSizeDerived)return;
  let major,minor,note,url;
  const angular=Number.isFinite(o.angularMajorArcmin)&&o.angularMajorArcmin>0&&o.d>0;
  if(angular){
   major=2*o.d*Math.tan(o.angularMajorArcmin*Math.PI/21600);minor=o.angularMinorArcmin>0?2*o.d*Math.tan(o.angularMinorArcmin*Math.PI/21600):major;
   url=o.angularSizeSource||'https://github.com/mattiaverga/OpenNGC';
   note='Каталожная оптическая область ≈'+major.toPrecision(3)+' × '+minor.toPrecision(3)+' св. лет: угловые оси OpenNGC и принятое расстояние. Граница зависит от наблюдаемой области и может быть шире яркой части на фотографии.';
  }else if(Number.isFinite(o.diameterLy)&&o.diameterLy>0&&!o.sizeEstimated&&!o.sizeUnknown){
   major=o.diameterLy;minor=o.minorDiameterLy>0?o.minorDiameterLy:major;url=o.source;
   note='Каталожный диаметр ≈'+major.toPrecision(3)+' св. лет'+(o.minorDiameterLy>0?' × '+minor.toPrecision(3)+' св. лет':'')+'. Показана область опубликованного размера; точная форма не восстановлена.';
  }
  if(!(major>0&&minor>0&&Number.isFinite(major)&&Number.isFinite(minor)))return;
  if(angular&&!(o.angularMinorArcmin>0))note+=' Малая ось неизвестна; для схемы использована окружность.';
  note+=' Погрешность размера отдельно не приведена; пересчёт углового размера наследует неопределённость расстояния.';
  o.region={shape:'ellipse',major,minor,sizeKind:angular?'optical':'diameter',mapSizeDerived:true,nebulaSizeDerived:true,illustrative:true,note,url};
  if(url&&o.facts?.refs&&!o.facts.refs.some(r=>r[0]===url))o.facts.refs.push([url,'Размер туманности']);
 },
 view(o){const radius=o.region?Math.max(o.region.major,o.region.minor)*.5*width/cam.span:0,t=Math.max(0,Math.min(1,(radius-2)/2)),area=t*t*(3-2*t);return{radius,area,point:1-area};}
};
globalThis.Nebulae=Nebulae;
for(const o of OBJECTS){
 const r=o.regionData||REGION_DATA[o.id]||(o.p3&&o.kind==='cluster'&&o.diameterLy?{shape:'ellipse',major:o.diameterLy,minor:o.minorDiameterLy||o.diameterLy,note:'Оптические оси ≈'+o.diameterLy.toPrecision(3)+' × '+(o.minorDiameterLy||o.diameterLy).toPrecision(3)+' св. лет; угловые размеры OpenNGC.',url:o.source}:null);
 if(r){o.region=r;if(r.url&&!o.facts.refs.some(a=>a[0]===r.url))o.facts.refs.push([r.url,'Размер области']);}
 StellarClusters.prepare(o);Nebulae.prepare(o);
}
const RegionMap={
 hits:[],curves:new WeakMap(),anchors:new WeakMap(),
 pixelRadius(o){return Math.max(o.region.major,o.region.minor)*Cosmology.regionScale(o)*.5*width/cam.span;},
 asPoint(o){return StellarClusters.is(o)?StellarClusters.view(o).point>.03:o.kind==='nebula'?Nebulae.view(o).point>.03:!o.region||o.region.shape!=='polyline'&&this.pixelRadius(o)<4;},
 pointOpacity(o){return StellarClusters.is(o)?StellarClusters.view(o).point:o.kind==='nebula'?Nebulae.view(o).point:1;},
 center(o){return o.id==='laniakea'?{x:0,y:0}:MapLayout.project(o);},
 focus(o){const r=o.region,p=this.center(o);goCamera(p.x,p.y,Math.max(r.major,r.minor)*Cosmology.regionScale(o)*Math.max(1.7,width/Math.max(height*.6,1)));toast(r.note);},
 outline(r){if(r.shape==='polyline')return r.points.map(([x,y])=>({x,y}));const p=[];for(let i=0;i<=96;i++){const t=i/96,a=t*Math.PI*2;let x,y;
  if(r.shape==='ribbon'){const u=t<=.5?t*2:2-t*2;x=(u-.5)*r.major;y=Math.sin(u*Math.PI*3)*r.minor*.18+(t<=.5?-1:1)*r.minor*.28;}
  else if(r.shape==='arc'){x=(t-.5)*r.major;y=(4*(t-.5)**2-.5)*r.minor;}
  else{const f=r.shape==='basin'?1+.09*Math.sin(3*a)+.045*Math.cos(5*a):1;x=Math.cos(a)*r.major*.5*f;y=Math.sin(a)*r.minor*.5*f;}p.push({x,y});}return p;},
 labelAnchor(r){if(!this.anchors.has(r))this.anchors.set(r,this.outline(r).reduce((a,p)=>p.y>a.y+1e-9||Math.abs(p.y-a.y)<1e-9&&Math.abs(p.x)<Math.abs(a.x)?p:a));return this.anchors.get(r);},
 curve(r,scale){
  // Douglas-Peucker within 0.35 screen pixels. Entire spines and both endpoints
  // survive; only subpixel bends disappear. Never sample whole filaments.
  const level=Math.floor(Math.log2(.35/Math.max(scale,1e-30)));let cache=this.curves.get(r);if(!cache)this.curves.set(r,cache=new Map());if(cache.has(level))return cache.get(level);
  const p=r.points,tolerance=2**(2*level),keep=new Set([0,p.length-1]),stack=[[0,p.length-1]];
  while(stack.length){const [a,b]=stack.pop(),dx=p[b][0]-p[a][0],dy=p[b][1]-p[a][1],len=dx*dx+dy*dy;let far=-1,best=tolerance;
   for(let i=a+1;i<b;i++){const t=len?Math.max(0,Math.min(1,((p[i][0]-p[a][0])*dx+(p[i][1]-p[a][1])*dy)/len)):0,d=(p[i][0]-p[a][0]-t*dx)**2+(p[i][1]-p[a][1]-t*dy)**2;if(d>best){best=d;far=i;}}
   if(far>=0){keep.add(far);stack.push([a,far],[far,b]);}
  }
  const result=[...keep].sort((a,b)=>a-b).map(i=>({x:p[i][0],y:p[i][1]}));cache.set(level,result);while(cache.size>3)cache.delete(cache.keys().next().value);return result;
 },
 clip(a,b){let lo=0,hi=1;const dx=b.x-a.x,dy=b.y-a.y;for(const [p,q] of [[-dx,a.x+10],[dx,width+10-a.x],[-dy,a.y+10],[dy,height+10-a.y]]){if(p===0){if(q<0)return null;}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}}return[{x:a.x+lo*dx,y:a.y+lo*dy},{x:a.x+hi*dx,y:a.y+hi*dy}];},
 draw(){
  const layers=globalThis.MapLayers,fade=[...ExtendedCatalog.transitions.values()].some(q=>q.o.region&&(!layers?.active||!layers.manages(q.o))&&q.alpha!==q.to),key=[cam.x,cam.y,cam.span,width,height,dpr,theme,state.selected,hover?.id,filter,globalThis.MapSlice?.mode,ExtendedCatalog.pinned.size,OBJECTS.length,fade?performance.now():0].join(':'),cache=this.renderCache,scale=Cosmology.scale();
  const cosmicShift=cache?Math.abs(scale/cache.scale-1)*(2+Math.hypot(cam.x,cam.y)/cam.span)*Math.max(width,height):Infinity;
  if(cache&&cache.key===key&&cache.points===ExtendedCatalog.visible&&cache.layers===layers?.visible&&cosmicShift<.15){this.hits=cache.hits;for(const h of this.hits)h.label=null;MapLabels.queue.push(...cache.labels);ctx.drawImage(cache.canvas,0,0,width,height);return;}
  const surface=cache?.canvas||document.createElement('canvas');surface.width=Math.round(width*dpr);surface.height=Math.round(height*dpr);const target=surface.getContext('2d');target.setTransform(dpr,0,0,dpr,0,0);target.clearRect(0,0,width,height);
  const first=MapLabels.queue.length;this.render(target);this.renderCache={key,scale,points:ExtendedCatalog.visible,layers:layers?.visible,canvas:surface,hits:this.hits,labels:MapLabels.queue.slice(first)};ctx.drawImage(surface,0,0,width,height);
 },
 render(target){const ctx=target;this.hits=[];for(const o of [...new Map([...ExtendedCatalog.visible,...(globalThis.MapLayers?.visible||[]),...ExtendedCatalog.pinned.values(),...OBJECTS].map(o=>[o.id,o])).values()].filter(o=>o.region&&!o.atlasOnly&&ExtendedCatalog.matchesMap(o)&&MapDetails.visible(o,cam.span)&&ExtendedCatalog.opacity(o)>.015).sort((a,b)=>b.region.major-a.region.major)){const r=o.region,c=screen(this.center(o)),scale=width/cam.span*Cosmology.regionScale(o),rx=r.major*.5*scale,ry=r.minor*.5*scale,polyline=r.shape==='polyline';
  const stellar=StellarClusters.is(o),nebula=o.kind==='nebula',area=stellar?StellarClusters.view(o).area:nebula?Nebulae.view(o).area:1;
  if(area<=.03||!polyline&&(Math.max(rx,ry)<(stellar||nebula?2:4)||Math.max(rx,ry)>20000)||c.x+rx*1.2<0||c.x-rx*1.2>width||c.y+ry*1.2<0||c.y-ry*1.2>height)continue;
  const points=(polyline?this.curve(r,scale):this.outline(r)).map(p=>({x:c.x+p.x*scale,y:c.y+p.y*scale})),selected=o.id===state.selected,highlighted=selected||hover?.id===o.id,segments=polyline?points.slice(1).map((p,i)=>this.clip(points[i],p)).filter(Boolean):null;if(polyline&&!segments.length)continue;
  const opacity=ExtendedCatalog.opacity(o)*area;ctx.save();ctx.globalAlpha=opacity;ctx.beginPath();if(polyline){for(const [a,b] of segments){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}}else points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(!['arc','polyline'].includes(r.shape))ctx.closePath();ctx.strokeStyle=paint(highlighted?'#454545':'#777777');ctx.lineWidth=highlighted?1.25:.7;ctx.setLineDash(polyline?[]:MapSymbols.dash(o)||(r.shape==='ring'?[7,5]:[3,6]));ctx.stroke();ctx.restore();
  // One permanent contour anchor in world coordinates; panning never selects a new vertex.
  const anchor=this.labelAnchor(r),label={x:c.x+anchor.x*scale,y:c.y+anchor.y*scale-9,align:'center'};
  const hit={o,points,segments,label:null,closed:!['arc','polyline'].includes(r.shape)};this.hits.push(hit);
  if(stellar||nebula?area>=.5&&Math.max(rx,ry)>=3:Math.max(rx,ry)>=18)MapLabels.add({key:'region-'+o.id,object:o,name:o.name.toUpperCase(),detail:r.shape==='polyline'?'ОСЬ ПО КАТАЛОГУ SDSS':r.sizeKind==='half-number'?'ОБЛАСТЬ 50% ЗВЁЗД · r₅₀':r.sizeKind==='half-light'?'ОБЛАСТЬ ПОЛОВИНЫ СВЕТА':nebula?'КАТАЛОЖНЫЙ РАЗМЕР · ФОРМА УСЛОВНАЯ':r.illustrative?'ГРАНИЦА УСЛОВНАЯ':'ПРИБЛИЖЁННАЯ ОБЛАСТЬ',mass:MapDetails.mass(o),level:MapDetails.level(o),priority:selected?100:30,size:9,opacity,color:selected?'#454545':'#757575',candidates:[label],onPlace:box=>{hit.label=box;}});
 }},
 hit(x,y){for(const h of [...this.hits].reverse()){if(h.label&&x>=h.label.x&&x<=h.label.x+h.label.w&&y>=h.label.y&&y<=h.label.y+h.label.h)return h.o;for(const [a,b] of h.segments||h.points.slice(1).map((p,i)=>[h.points[i],p])){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<9)return h.o;}}return null;}
};
