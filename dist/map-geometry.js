'use strict';
// Rigid local Galactic XY geometry in light years. Radial mode moves anchors
// only; sky position angles are transformed from their source axes below.
const MapGeometry={
 version:2,models:MAP_GEOMETRY_MODELS,cache:new WeakMap(),spines:new WeakMap(),
 resolve(o){return o?.id&&(globalThis.MapLayout?.resolve?.(o.id)||globalThis.OBJECTS?.find(q=>q.id===o.id))||o;},
 // Legacy diagrammatic stops lack coordinate provenance. Survey structures
 // and distant survey centres also have arrival anchors, but retain their
 // published source coordinates even when their extent is unknown.
 // Translated UI notes must not control scientific eligibility.
 unlocated(o){return !!(o?.arrivalAnchor&&!o.cosmicCatalog&&!o.distantCatalog&&!o.coordinateSource);},
 basis(o,pa=0){
  if(!Number.isFinite(o.raDeg)||!Number.isFinite(o.decDeg))return null;
  const a=o.raDeg*Math.PI/180,b=o.decDeg*Math.PI/180,p=pa*Math.PI/180;
  const east=[-Math.sin(a),Math.cos(a),0],north=[-Math.sin(b)*Math.cos(a),-Math.sin(b)*Math.sin(a),Math.cos(b)],line=[Math.cos(b)*Math.cos(a),Math.cos(b)*Math.sin(a),Math.sin(b)];
  const rotate=v=>Space.matrix.map(row=>row.reduce((s,n,i)=>s+n*v[i],0));
  return{line:rotate(line),major:rotate(east.map((n,i)=>n*Math.sin(p)+north[i]*Math.cos(p))),minor:rotate(east.map((n,i)=>-n*Math.cos(p)+north[i]*Math.sin(p)))};
 },
 model(input){
  const cache=typeof MapDetails==='undefined'?null:MapDetails.frameModels;
  if(input&&cache?.has(input))return cache.get(input);
  const o=this.resolve(input),m=o&&cache?.has(o)?cache.get(o):this.computeModel(o);
  if(input)cache?.set(input,m);if(o)cache?.set(o,m);return m;
 },
 computeModel(o){
  if(!o?.p3?.every(Number.isFinite)||o.atlasOnly||this.unlocated(o))return null;
  const r=o.region||o.regionData,g=o.galaxy,angular=o.kind==='galaxy'&&o.angularMajorArcmin>0&&o.d>0,diameter=g?.diameterLy||(angular?2*o.d*Math.tan(o.angularMajorArcmin*Math.PI/21600):o.diameterLy);
  if(r?.sizeUnknown||!r&&!g&&!angular&&(o.sizeEstimated||o.sizeUnknown))return null;
  if(r?.shape==='polyline')return r.offsets3?.length===r.points.length?{kind:'spine',offsets:r.offsets3,source:r.url,note:r.note}:null;
  if(o.id==='milkyway')return{kind:'disk',a:[1,0,0],b:[0,1,0],radius:diameter/2,source:o.coordinateSource,note:'Модель диска в галактической плоскости; диаметр — характерный оптический размер. Спиральные рукава не восстановлены.'};
  const disk=this.models[o.id];
  if(o.kind==='galaxy'&&disk&&diameter>0){const basis=this.basis(o,disk.positionAngleDeg),i=disk.inclinationDeg*Math.PI/180;
   if(basis)return{kind:'disk',a:basis.major,b:basis.minor.map((v,j)=>v*Math.cos(i)-basis.line[j]*Math.sin(i)),radius:diameter/2,source:disk.reference,note:disk.note+' Контур — круговая модель диска оптического масштаба, не измеренная граница.'};
  }
  const major=r?.major||diameter,minor=r?.minor||o.minorDiameterLy||(o.angularMinorArcmin>0&&o.angularMajorArcmin>0 ? major*o.angularMinorArcmin/o.angularMajorArcmin : g ? major*g.axisRatio : major)||major;
  if(!(major>0&&minor>0))return null;
  const optical=!['half-number','half-light'].includes(r?.sizeKind)&&(o.angularMajorArcmin>0||r?.sizeKind==='optical'||o.kind==='galaxy');
  if(optical&&Number.isFinite(o.positionAngleDeg)){
   const basis=this.basis(o,o.positionAngleDeg);
   if(basis)return{kind:'footprint',a:basis.major,b:basis.minor,radius:major/2,minorRadius:minor/2,source:o.angularSizeSource||o.source||r?.url,note:'Измеренные оптические оси и позиционный угол; область в касательной плоскости на принятом расстоянии. Глубина и физическая 3D-форма неизвестны.'};
  }
  // Only an isotropic size envelope is supported without measured orientation.
  // It is explicitly a scale model, never an invented elongated boundary.
  return{kind:'sphere',radius:Math.max(major,minor)/2,source:r?.url||o.source,note:(r?.note||'Каталожный оптический размер.')+' Показана сферическая область характерного размера; реальная форма и ориентация не восстановлены.'};
 },
 tessellate(at,start,end,steps,eps,viewport,bounds){
  const times=[start],outside=b=>viewport&&(b[0]>viewport[2]||b[2]<viewport[0]||b[1]>viewport[3]||b[3]<viewport[1]);
  const visit=(lo,a,hi,b,depth)=>{if(viewport&&outside(bounds(lo,hi))){times.push(hi);return;}const mid=(lo+hi)/2,p=at(mid),error=Math.hypot(p.x-(a.x+b.x)/2,p.y-(a.y+b.y)/2);if(depth<28&&error>eps){visit(lo,a,mid,p,depth+1);visit(mid,p,hi,b,depth+1);}else times.push(hi);};
  let lo=start,a=at(lo);for(let n=1;n<=steps;n++){const hi=start+(end-start)*n/steps,b=at(hi);if(viewport)visit(lo,a,hi,b,0);else times.push(hi);lo=hi;a=b;}return times;
 },
 arcVertices(m,lo,hi,steps,eps,viewport){
  const R=Math.max(m.radius,m.minorRadius||0),at=t=>m.a.map((v,j)=>v*m.radius*Math.cos(t)+m.b[j]*(m.minorRadius||m.radius)*Math.sin(t));
  const bounds=(l,h)=>{const c=at((l+h)/2),radius=R*(h-l)/2;return[c[0]-radius,-c[1]-radius,c[0]+radius,-c[1]+radius];};
  const times=this.tessellate(t=>{const v=at(t);return{x:v[0],y:-v[1]};},0,2*Math.PI,steps,eps,viewport,bounds),A=m.a[2]*m.radius,B=m.b[2]*(m.minorRadius||m.radius),amplitude=Math.hypot(A,B),phase=Math.atan2(B,A);
  if(amplitude>0)for(const z of [lo,hi])if(Number.isFinite(z)&&Math.abs(z)<=amplitude){const angle=Math.acos(z/amplitude);for(const t of [phase-angle,phase+angle])times.push((t%(2*Math.PI)+2*Math.PI)%(2*Math.PI));}
  times.sort((a,b)=>a-b);return times.filter((t,i)=>t<2*Math.PI&&(i===0||t-times[i-1]>1e-14)).map(t=>{const v=at(t);for(const z of [lo,hi])if(Number.isFinite(z)&&Math.abs(v[2]-z)<1e-10*Math.max(1,amplitude))v[2]=z;return v;});
 },
 spineData(offsets){
  // Source vertices are independent of zoom, pan and anchor projection. Check
  // their values once per draw, including in-place catalogue corrections.
  const frame=typeof MapDetails==='undefined'?null:MapDetails.frameSpines;if(frame?.has(offsets))return frame.get(offsets);
  let data=this.spines.get(offsets),same=data?.vertices.length===offsets.length*3;
  if(same)for(let i=0;i<offsets.length&&same;i++)for(let j=0;j<3;j++)if(data.vertices[i*3+j]!==offsets[i][j]){same=false;break;}
  if(!same){
   const vertices=new Float64Array(offsets.length*3),bounds=[Infinity,Infinity,-Infinity,-Infinity];
   for(let i=0;i<offsets.length;i++){const v=offsets[i];for(let j=0;j<3;j++)vertices[i*3+j]=v[j];bounds[0]=Math.min(bounds[0],v[0]);bounds[1]=Math.min(bounds[1],-v[1]);bounds[2]=Math.max(bounds[2],v[0]);bounds[3]=Math.max(bounds[3],-v[1]);}
   this.spines.set(offsets,data={vertices,bounds});
  }
  frame?.set(offsets,data);return data;
 },
 indexBounds(input,m=this.model(input)){
  // Translation changes the anchor, never these local bounds. Analytic ellipse
  // extrema also cover arcs missed by finite render tessellation or a Z slab.
  if(!m)return null;
  if(m.kind==='spine')return this.spineData(m.offsets).bounds;
  const R=m.radius,rx=m.kind==='sphere'?R:Math.hypot(m.a[0]*R,m.b[0]*(m.minorRadius||R)),ry=m.kind==='sphere'?R:Math.hypot(m.a[1]*R,m.b[1]*(m.minorRadius||R));return[-rx,-ry,rx,ry];
 },
 clip3(points,lo,hi,closed){
  if(!Number.isFinite(lo)&&!Number.isFinite(hi))return closed?[points]:points.slice(1).map((b,i)=>[points[i],b]);
  if(closed){let p=points;for(const [z,sign] of [[lo,1],[hi,-1]]){const next=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],insideA=sign*(a[2]-z)>=0,insideB=sign*(b[2]-z)>=0;if(insideA)next.push(a);if(insideA!==insideB){const t=(z-a[2])/(b[2]-a[2]);next.push(a.map((n,j)=>n+t*(b[j]-n)));}}p=next;}return p.length>2?[p]:[];}
  const paths=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dz=b[2]-a[2];let l=0,h=1;if(dz===0){if(a[2]<lo||a[2]>hi)continue;}else{const t1=(lo-a[2])/dz,t2=(hi-a[2])/dz;l=Math.max(l,Math.min(t1,t2));h=Math.min(h,Math.max(t1,t2));}if(l<=h)paths.push([a.map((n,j)=>n+l*(b[j]-n)),a.map((n,j)=>n+h*(b[j]-n))]);}return paths;
 },
 sphere(m,lo,hi,steps,eps,viewport){
  const R=m.radius,dz=Math.max(lo,Math.min(hi,0));if(Math.abs(dz)>R)return[];
  const xyRadius=Math.sqrt(Math.max(0,R*R-dz*dz));
  return[{closed:true,points:this.arcVertices({a:[1,0,0],b:[0,1,0],radius:xyRadius},-Infinity,Infinity,steps,eps,viewport).map(v=>({x:v[0],y:-v[1]}))}];
 },
 projected(input,{mode=globalThis.MapSlice?.mode||'full',slice=mode==='slice',centerZ=globalThis.MapSlice?.centerZ||0,halfThickness=Infinity,tolerance=1,steps=192,viewport=null}={}){
  const o=this.resolve(input),m=this.model(o);if(!m)return{paths:[],points:[],bounds:[0,0,0,0],model:null};
  const r=o.region||o.regionData,signature=[o.p3,r,o.galaxy?.diameterLy,o.positionAngleDeg,o.angularMajorArcmin,o.diameterLy,m.kind==='spine'?this.spineData(m.offsets):null,m.source,m.note];
  let cached=this.cache.get(o);if(!cached||signature.some((v,i)=>v!==cached.signature[i]))this.cache.set(o,cached={signature,entries:new Map()});
  const lo=slice?centerZ-halfThickness-o.p3[2]:-Infinity,hi=slice?centerZ+halfThickness-o.p3[2]:Infinity;
  // A sourced spine has no tessellation: only its Z slab can change its local
  // paths. Full and radial views translate the same exact segment endpoints.
  const level=Math.floor(Math.log2(Math.max(1e-20,tolerance))),key=m.kind==='spine'?['spine',lo,hi].join(':'):[mode,slice?centerZ:0,slice?halfThickness:Infinity,level,steps,viewport?.join(',')].join(':');
  if(cached.entries.has(key))return cached.entries.get(key);
  let paths;
  if(m.kind==='sphere')paths=this.sphere(m,lo,hi,steps,2**level,viewport);
  else{
   const closed=m.kind!=='spine',vertices=closed?this.arcVertices(m,lo,hi,steps,2**level,viewport):m.offsets;
   paths=this.clip3(vertices,lo,hi,closed).map(vertices=>({closed,points:vertices.map(v=>({x:v[0],y:-v[1]}))}));
  }
  paths=paths.filter(p=>p.points.length>1&&p.points.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)));
  const points=paths.flatMap(p=>p.points),bounds=points.length?[Infinity,Infinity,-Infinity,-Infinity]:[0,0,0,0];
  // Dense projected paths may exceed the engine's function-argument limit.
  for(const p of points){bounds[0]=Math.min(bounds[0],p.x);bounds[1]=Math.min(bounds[1],p.y);bounds[2]=Math.max(bounds[2],p.x);bounds[3]=Math.max(bounds[3],p.y);}
  const result={paths,points,bounds,model:m};cached.entries.set(key,result);while(cached.entries.size>4)cached.entries.delete(cached.entries.keys().next().value);return result;
 },
 view(o){const halfThickness=globalThis.MapSlice?.mode==='slice'?MapSlice.halfThicknessAt():Infinity;if((o.region||o.regionData)?.shape==='polyline')return this.projected(o,{halfThickness});const pixel=typeof cam==='object'?cam.span/Math.max(1,width):1,center=MapLayout.project(o),scale=Cosmology.regionScale(o),p=screen(center),pad=192,viewport=[(-pad-p.x)*pixel/scale,(-pad-p.y)*pixel/scale,(width+pad-p.x)*pixel/scale,(height+pad-p.y)*pixel/scale];return this.projected(o,{halfThickness,tolerance:pixel*.15/scale,steps:96,viewport});},
 intersectsView(o,padding=0,minSize=0,center=null,scale=null){
  // Analytic full-object bounds conservatively enclose every slab intersection.
  // Reject before tessellation, including subpixel galaxy outlines. A large
  // contour surrounding the viewport must still reach the exact path renderer.
  const b=this.indexBounds(o);if(!b)return false;
  const p=center||screen(o),s=scale??width/cam.span*Cosmology.regionScale(o),x0=p.x+b[0]*s,y0=p.y+b[1]*s,x1=p.x+b[2]*s,y1=p.y+b[3]*s;
  return x1>=-padding&&x0<=width+padding&&y1>=-padding&&y0<=height+padding&&(x1-x0>=minSize||y1-y0>=minSize);
 },
 contains(input,p){
  // Resolve render helpers to their catalogue identity before cosmological
  // projection. Test the query in local bounds before building any polygon.
  const o=this.resolve(input),b=this.indexBounds(o);if(!b)return false;
  const center=MapLayout.project(o),scale=typeof Cosmology==='undefined'?1:Cosmology.regionScale(o),x=(p.x-center.x)/scale,y=(p.y-center.y)/scale;
  if(x<b[0]||x>b[2]||y<b[1]||y>b[3])return false;
  const geometry=this.view(o);let inside=false;for(const path of geometry.paths){if(!path.closed)continue;let hit=false;for(let i=0,j=path.points.length-1;i<path.points.length;j=i++){const a=path.points[i],b=path.points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)hit=!hit;}if(hit)inside=!inside;}return inside;
 }
};
globalThis.MapGeometry=MapGeometry;
