'use strict';
// Display envelopes only. Physical routes never use these polygons.
const REGION_DATA={
 omega:{shape:'ellipse',major:150,minor:150,note:'Диаметр ≈150 св. лет.',url:'https://www.eso.org/public/news/eso0844/'},
 virgo:{shape:'ellipse',major:10.1e6,minor:10.1e6,note:'Вириальный диаметр ≈3,1 Мпк (10,1 млн св. лет).',url:'https://doi.org/10.1088/0067-0049/200/1/4'},
 coma:{shape:'ellipse',major:20.2e6,minor:20.2e6,note:'Вириальный диаметр ≈20,2 ±4,6 млн св. лет.',url:'https://doi.org/10.1093/mnras/stw305'},
 bootes:{shape:'ellipse',major:300e6,minor:300e6,note:'Приближённый диаметр ≈300 млн св. лет; граница разрежения условная.',url:'https://www.cambridge.org/core/journals/symposium-international-astronomical-union/article/survey-of-the-bootes-void/6F39377E63896D57AC817C29885A21D1'},
 laniakea:{shape:'basin',major:522e6,minor:522e6,note:'Масштаб бассейна ≈160 Мпк (522 млн св. лет). Область включает Млечный Путь; контур иллюстративный.',url:'https://www.nature.com/articles/nature13674'},
 attractor:{shape:'basin',major:150e6,minor:90e6,illustrative:true,sizeUnknown:true,note:'Единой измеренной границы нет. Показанная область иллюстративна, её размер не является измерением.',url:'https://arxiv.org/abs/astro-ph/0503647'},
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
 handles(o){const group=MapDetails.group(o);return group==='stellar-cluster'||group==='galaxy-cluster'||group==='nebula';},
 draw(o,p,ink='#424242'){
  const group=MapDetails.group(o);if(globalThis.MapVisibility?.active&&MapDetails.level(o)>=3){circle(p.x,p.y,1.2,ink,.7);return;}
  if(group==='stellar-cluster'){ctx.fillStyle=paint(ink);ctx.beginPath();ctx.arc(p.x,p.y,1.6,0,Math.PI*2);ctx.fill();return;}
  ctx.save();ctx.translate(p.x,p.y);ctx.strokeStyle=ctx.fillStyle=paint(ink);ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();
  if(group==='galaxy-cluster'){ctx.moveTo(0,-3.6);ctx.lineTo(3.6,0);ctx.lineTo(0,3.6);ctx.lineTo(-3.6,0);ctx.closePath();ctx.stroke();}
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
 hits:[],curves:new WeakMap(),anchors:new WeakMap(),spines:new WeakMap(),
 pixelRadius(o){return Math.max(o.region.major,o.region.minor)*Cosmology.regionScale(o)*.5*width/cam.span;},
 asPoint(o){
  if(globalThis.MapFilters?.promotes(o)&&o.region&&this.pixelRadius(o)<4)return true;
  const cache=MapDetails.framePoints;if(cache?.has(o))return cache.get(o);
  const point=this.pointGeometry(o);cache?.set(o,point);return point;
 },
 pointGeometry(o){if(globalThis.MapGeometry&&!MapGeometry.model(o))return true;if(globalThis.MapVisibility?.active&&(o.kind==='horizon'||o.region&&MapDetails.level(o)>=3))return false;if(globalThis.MapVisibility?.active&&MapSymbols.handles(o))return true;return StellarClusters.is(o)?StellarClusters.view(o).point>.03:o.kind==='nebula'?Nebulae.view(o).point>.03:!o.region||o.region.shape!=='polyline'&&this.pixelRadius(o)<4;},
 pointOpacity(o){if(globalThis.MapVisibility?.active&&MapSymbols.handles(o))return 1;return StellarClusters.is(o)?StellarClusters.view(o).point:o.kind==='nebula'?Nebulae.view(o).point:1;},
 center(o){return MapLayout.project(o);},
 referenceCenter(o){return MapLayout.baseProject(o);},
 focus(o){const r=o.region,p=this.center(o);goCamera(p.x,p.y,Math.max(r.major,r.minor)*Cosmology.regionScale(o)*Math.max(1.7,width/Math.max(height*.6,1)));toast(r.note);},
 outline(r){if(r.shape==='polyline')return r.points.map(([x,y])=>({x,y}));const p=[];for(let i=0;i<=96;i++){const t=i/96,a=t*Math.PI*2;let x,y;
  if(r.shape==='ribbon'){const u=t<=.5?t*2:2-t*2;x=(u-.5)*r.major;y=Math.sin(u*Math.PI*3)*r.minor*.18+(t<=.5?-1:1)*r.minor*.28;}
  else if(r.shape==='arc'){x=(t-.5)*r.major;y=(4*(t-.5)**2-.5)*r.minor;}
  else{const f=r.shape==='basin'?1+.09*Math.sin(3*a)+.045*Math.cos(5*a):1;x=Math.cos(a)*r.major*.5*f;y=Math.sin(a)*r.minor*.5*f;}p.push({x,y});}return p;},
 labelAnchor(r){if(!this.anchors.has(r))this.anchors.set(r,this.outline(r).reduce((a,p)=>p.y>a.y+1e-9||Math.abs(p.y-a.y)<1e-9&&Math.abs(p.x)<Math.abs(a.x)?p:a));return this.anchors.get(r);},
 nameAnchor(o){
  // Choose the least crowded contour point in reference world coordinates.
  // The result depends only on catalogue geometry and projection, never on
  // camera, viewport, panels, selection or neighbouring visible captions.
  const key=MapSlice.mode==='radial'?(globalThis.MapRadial?.key||'radial'):'full';
  this.nameAnchors??=new Map();if(!this.nameAnchors.has(key))this.nameAnchors.set(key,new Map());
  const cache=this.nameAnchors.get(key);if(cache.has(o.id))return cache.get(o.id);
  const center=this.referenceCenter(o),others=OBJECTS.filter(q=>q.id!==o.id&&!MapGeometry.unlocated(q)&&(MapDetails.origin(q)||q.region&&!q.cosmicCatalog&&['structure','wall','void','ring','arc'].includes(q.kind))).map(q=>this.referenceCenter(q));
  const outline=MapGeometry.projected(o).points;
  let best=outline[0]||{x:0,y:0},clearance=-Infinity;
  for(const p of outline){
   const distance=Math.min(...others.map(q=>Math.hypot(center.x+p.x-q.x,center.y+p.y-q.y)));
   if(distance>clearance+1e-6||Math.abs(distance-clearance)<1e-6&&p.y>best.y){clearance=distance;best=p;}
  }
  cache.set(o.id,best);return best;
 },
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
 clip(a,b,pad=10,pair=null){
  // Trivial rejection/acceptance avoids temporary clipping arrays for almost
  // every segment. Keep independent screen endpoints for the pan cache.
  if(a.x < -pad&&b.x < -pad||a.x>width+pad&&b.x>width+pad||a.y < -pad&&b.y < -pad||a.y>height+pad&&b.y>height+pad)return null;
  if(a.x>=-pad&&a.x<=width+pad&&a.y>=-pad&&a.y<=height+pad&&b.x>=-pad&&b.x<=width+pad&&b.y>=-pad&&b.y<=height+pad){pair??=[{},{}];pair[0].x=a.x;pair[0].y=a.y;pair[1].x=b.x;pair[1].y=b.y;return pair;}
  let lo=0,hi=1;const dx=b.x-a.x,dy=b.y-a.y;
  for(let i=0;i<4;i++){const p=i===0?-dx:i===1?dx:i===2?-dy:dy,q=i===0?a.x+pad:i===1?width+pad-a.x:i===2?a.y+pad:height+pad-a.y;if(p===0){if(q<0)return null;}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}}
  pair??=[{},{}];pair[0].x=a.x+lo*dx;pair[0].y=a.y+lo*dy;pair[1].x=a.x+hi*dx;pair[1].y=a.y+hi*dy;return pair;
 },
 spineScreen(o,geometry,c,scale,padding){
  // Keep one disposable screen buffer per loaded spine. Every original segment
  // remains a separate path (same joins/blending); only its coordinates change.
  // Clipped endpoints are separate so the pan raster can translate both once.
  let data=this.spines.get(o);
  if(data?.geometry!==geometry){
   const paths=geometry.paths.map(path=>({closed:false,points:path.points.map(()=>({x:0,y:0}))})),points=paths.flatMap(path=>path.points),pool=new Array(paths.length);
   const insideSegments=paths.map(p=>p.points),insideRuns=insideSegments.map(points=>({points,offset:0,closed:false}));
   this.spines.set(o,data={geometry,paths,points,pool,insideSegments,insideRuns,clippedSegments:[],clippedRuns:[],panPoints:[],box:{x:0,y:0,w:0,h:0}});
  }
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity,n=0;
  for(let i=0;i<geometry.points.length;i++){const p=data.points[i],v=geometry.points[i];p.x=c.x+v.x*scale;p.y=c.y+v.y*scale;x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
  Object.assign(data.box,{x,y,w:right-x,h:bottom-y});
  data.panPoints.length=0;
  if(x>=-padding&&y>=-padding&&right<=width+padding&&bottom<=height+padding){data.segments=data.insideSegments;data.runs=data.insideRuns;return data;}
  data.segments=data.clippedSegments;data.runs=data.clippedRuns;
  for(let i=0;i<data.paths.length;i++){const p=data.paths[i].points,pair=this.clip(p[0],p[1],padding,data.pool[i]?.pair);if(pair){const q=data.pool[i]??={pair,run:{points:pair,offset:0,closed:false}};data.segments[n]=pair;data.runs[n++]=q.run;data.panPoints.push(pair[0],pair[1]);}}
  data.segments.length=data.runs.length=n;return data;
 },
 clipPaths(paths,padding=10,phased=true){
  // Clip for bounded canvas coordinates, retaining continuous screen paths and
  // distance from their original start. Dashes are applied after projection.
  const segments=[],runs=[];
  for(const path of paths){
   let run=null,distance=0,whole=true;const first=runs.length,n=path.closed?path.points.length:path.points.length-1;
   for(let i=0;i<n;i++){
    const a=path.points[i],b=path.points[(i+1)%path.points.length],pair=this.clip(a,b,padding);
    if(pair){
     const [p,q]=pair,tail=run?.points.at(-1),entry=Math.hypot(p.x-a.x,p.y-a.y),exit=Math.hypot(q.x-b.x,q.y-b.y);
     segments.push(pair);
     if(!tail||Math.hypot(tail.x-p.x,tail.y-p.y)>1e-6){run={points:[p,q],offset:phased?distance+entry:0,closed:false};runs.push(run);}else run.points.push(q);
     if(entry>1e-6||exit>1e-6)whole=false;
     if(exit>1e-6)run=null;
    }else{run=null;whole=false;}
    if(phased)distance+=Math.hypot(b.x-a.x,b.y-a.y);
   }
   if(path.closed&&whole&&runs.length===first+1)runs[first].closed=true;
  }
  return{segments,runs};
 },
 strokePaths(ctx,runs){
  const dash=ctx.getLineDash()||[],period=dash.reduce((sum,n)=>sum+n,0),base=Number.isFinite(ctx.lineDashOffset)?ctx.lineDashOffset:0;
  const trace=run=>{const points=run.points;ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length-(run.closed?1:0);i++)ctx.lineTo(points[i].x,points[i].y);if(run.closed)ctx.closePath();};
  if(period){for(const run of runs){ctx.beginPath();ctx.lineDashOffset=base+run.offset%period;trace(run);ctx.stroke();}ctx.lineDashOffset=base;}
  else if(runs.length){ctx.beginPath();for(const run of runs)trace(run);ctx.stroke();}
 },
 draw(){
  const layers=globalThis.MapLayers,fade=[...ExtendedCatalog.transitions.values()].some(q=>q.o.region&&(!layers?.active||!layers.manages(q.o))&&q.alpha!==q.to),key=[cam.span,width,height,dpr,theme,state.selected,globalThis.MapFilters?.key,filter,globalThis.MapSlice?.mode,ExtendedCatalog.pinned.size,OBJECTS.length,fade?performance.now():0].join(':'),cache=this.renderCache,scale=Cosmology.scale(),pad=96;
  const cosmicShift=cache?Math.abs(scale/cache.scale-1)*(2+Math.hypot(cam.x,cam.y)/cam.span)*Math.max(width,height):Infinity,dx=cache?(cache.x-cam.x)*width/cam.span:0,dy=cache?(cache.y-cam.y)*width/cam.span:0;
  if(cache&&cache.key===key&&cache.points===ExtendedCatalog.visible&&cache.layers===layers?.visible&&cosmicShift<.15&&Math.abs(dx)<=pad&&Math.abs(dy)<=pad){
   // Reuse a padded raster while panning. Move only disposable screen geometry;
   // world vertices, catalogue positions and label anchors stay untouched.
   this.hits=cache.hits;const sx=dx-cache.shiftX,sy=dy-cache.shiftY;
   for(const h of this.hits){h.label=null;if(sx||sy){for(const p of h.points){p.x+=sx;p.y+=sy;}if(h.panPoints){for(const p of h.panPoints){p.x+=sx;p.y+=sy;}}else if(h.segments)for(const pair of h.segments)for(const p of pair){p.x+=sx;p.y+=sy;}}}
   if(sx||sy)for(const label of cache.labels)for(const p of label.candidates){p.x+=sx;p.y+=sy;}
   cache.shiftX=dx;cache.shiftY=dy;MapLabels.queue.push(...cache.labels);this.blit(cache);this.drawHighlight();return;
  }
  const surface=cache?.canvas||document.createElement('canvas'),w=Math.round((width+2*pad)*dpr),h=Math.round((height+2*pad)*dpr);if(surface.width!==w)surface.width=w;if(surface.height!==h)surface.height=h;const target=surface.getContext('2d');target.setTransform(dpr,0,0,dpr,pad*dpr,pad*dpr);target.clearRect(-pad,-pad,width+2*pad,height+2*pad);
  const first=MapLabels.queue.length;this.render(target,pad);this.renderCache={key,scale,x:cam.x,y:cam.y,shiftX:0,shiftY:0,pad,points:ExtendedCatalog.visible,layers:layers?.visible,canvas:surface,hits:this.hits,labels:MapLabels.queue.slice(first)};this.blit(this.renderCache);this.drawHighlight();
 },
 blit(cache){ctx.drawImage(cache.canvas,(cache.pad-cache.shiftX)*dpr,(cache.pad-cache.shiftY)*dpr,width*dpr,height*dpr,0,0,width,height);},
 render(target,padding=0){const ctx=target;this.hits=[];
  const objects=[...new Map([...ExtendedCatalog.visible,...(globalThis.MapLayers?.visible||[]),...ExtendedCatalog.pinned.values(),...(globalThis.MapFilters?.objects.values()||[]),...OBJECTS].map(o=>[o.id,o])).values()];
  ctx.save();try{for(const o of objects.filter(o=>o.region&&!o.atlasOnly&&ExtendedCatalog.matchesMap(o,true)&&(!MapLayers.active||MapLayers.admits(o))&&MapDetails.visible(o,cam.span)&&ExtendedCatalog.opacity(o,true,true)>.015).sort((a,b)=>b.region.major-a.region.major)){
   const r=o.region,c=screen(this.center(o)),scale=width/cam.span*Cosmology.regionScale(o),polyline=r.shape==='polyline';
   const stellar=StellarClusters.is(o),nebula=o.kind==='nebula',area=stellar?StellarClusters.view(o).area:nebula?Nebulae.view(o).area:1;
   if(area<=.03||!MapGeometry.intersectsView(o,padding,0,c,scale))continue;
   const geometry=MapGeometry.view(o);if(!geometry.points.length)continue;
   const spine=polyline?this.spineScreen(o,geometry,c,scale,padding+10):null,paths=spine?.paths||geometry.paths.map(path=>({...path,points:path.points.map(p=>({x:c.x+p.x*scale,y:c.y+p.y*scale}))})),points=spine?.points||paths.flatMap(path=>path.points),box=spine?.box||MapLandmarks.box(points),extent=Math.max(box.w,box.h)/2;
   if(extent<(polyline ? 0 : globalThis.MapVisibility?.active && MapDetails.level(o)>=3 ? .05 : stellar||nebula ? 2 : 4)||box.x+box.w < -padding||box.x>width+padding||box.y+box.h < -padding||box.y>height+padding)continue;
   const {segments,runs}=spine||this.clipPaths(paths,padding+10);
   if(!segments.length)continue;
   const selected=o.id===state.selected,opacity=ExtendedCatalog.opacity(o)*area;
   ctx.globalAlpha=opacity;ctx.strokeStyle=paint(selected?'#454545':'#777777');ctx.lineWidth=selected?1.25:.7;ctx.setLineDash(polyline?[]:MapSymbols.dash(o)||[3,6]);this.strokePaths(ctx,runs);
   const hit={o,points,paths,segments,runs,opacity,label:null,closed:paths.every(path=>path.closed),...(spine?{panPoints:spine.panPoints}:{})};this.hits.push(hit);
   if((stellar||nebula?area>=.5&&extent>=3:extent>=18)&&MapDetails.mapLabelName(o)!==null){
    const anchor=geometry.points.reduce((a,p)=>p.y>a.y?p:a,geometry.points[0]),label={x:c.x+anchor.x*scale,y:c.y+anchor.y*scale-9,align:'center'};
    MapLabels.add({key:'region-'+o.id,object:o,name:o.name.toUpperCase(),detail:polyline?'КАТАЛОЖНАЯ 3D-ОСЬ':r.sizeKind==='half-number'?'ОБЛАСТЬ 50% ЗВЁЗД · r₅₀':r.sizeKind==='half-light'?'ОБЛАСТЬ ПОЛОВИНЫ СВЕТА':geometry.model.kind==='footprint'?'ОПТИЧЕСКАЯ ОБЛАСТЬ · ГЛУБИНА НЕИЗВЕСТНА':'ОБЛАСТЬ ХАРАКТЕРНОГО РАЗМЕРА',mass:MapDetails.mass(o),level:MapDetails.level(o),priority:selected?100:30,size:9,opacity,color:selected?'#454545':'#757575',candidates:[label],onPlace:box=>{hit.label=box;}});
   }
  }}finally{ctx.restore();}
 },
 // Hover is a small overlay: it never invalidates cached contours, labels or
 // their collision grid. Selection still rebuilds the persistent selected style.
 drawHighlight(){
  if(!hover||hover.id===state.selected)return;const h=this.hits.find(h=>h.o.id===hover.id);if(!h)return;
  ctx.save();ctx.globalAlpha=h.opacity;ctx.strokeStyle=paint('#454545');ctx.lineWidth=1.25;ctx.setLineDash(h.segments?[]:MapSymbols.dash(h.o)||(h.o.region.shape==='ring'?[7,5]:[3,6]));ctx.beginPath();
  if(h.runs)this.strokePaths(ctx,h.runs);else{if(h.segments){for(const [a,b] of h.segments){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}}else{h.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(h.closed)ctx.closePath();}ctx.stroke();}ctx.restore();
 },
 hit(x,y){for(const h of [...this.hits].reverse()){if(h.label&&x>=h.label.x&&x<=h.label.x+h.label.w&&y>=h.label.y&&y<=h.label.y+h.label.h)return h.o;for(const [a,b] of h.segments||h.points.slice(1).map((p,i)=>[h.points[i],p])){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<9)return h.o;}}return null;}
};
