'use strict';
// Galactic XY with a fixed cartographic lift around the Milky Way disk.
// These display thresholds are not measured membership/halo boundaries.
// Physical p3 is never changed by the map.
const MapLayout={
 cache:new Map(),anchors:[],fixedKinds:new Set(['structure','wall','void','ring','arc','horizon']),
 version:4,
 disk:{radius:50000,innerHeight:1500,outerHeight:3000,gap:4000},
 base(p3){return{x:p3[0],y:-p3[1]};},
 center(){return this.diskCenter||(this.diskCenter=this.base(OBJECTS.find(o=>o.id==='sgr').p3));},
 anchorId(o){return o.synthetic&&o.parentObject||o.positionEstimate?.anchor||o.distanceHost||o.boundSystemPrimary||o.galaxyMember&&o.parentGalaxy||null;},
 footprint(o){
  const area=o.regionData,diameter=o.galaxy?.diameterLy||o.diameterLy;
  if(area)return Math.max(area.major,area.minor)/2;
  if(diameter>0&&!o.sizeEstimated&&!o.sizeUnknown)return diameter/2;
  const m=o.catalogMeasurements?.find(m=>m.data?.halfNumberRadiusPc>0),r=o.catalogData?.halfNumberRadiusPc||m?.data.halfNumberRadiusPc;
  if(r>0)return r*3.261563777;
  if(o.angularMajorArcmin>0&&o.d>0)return o.d*Math.tan(o.angularMajorArcmin*Math.PI/21600);
  return 0;
 },
 offset(o,base){
  if(!o.p3?.every(Number.isFinite)||o.atlasOnly||o.id==='milkyway'||this.fixedKinds.has(o.kind)||o.catalogClass==='galaxy-cluster')return{x:0,y:0};
  const c=this.center(),dx=base.x-c.x,dy=base.y-c.y,r=Math.hypot(dx,dy),z=Math.abs(o.p3[2]),d=this.disk;
  const t=o.kind==='galaxy'&&Math.hypot(r,z)>d.radius?1:Math.max(0,Math.min(1,(z-d.innerHeight)/(d.outerHeight-d.innerHeight)));
  if(t===0)return{x:0,y:0};
  // Different heights keep different offsets instead of one artificial ring.
  const minimum=d.radius+d.gap+this.footprint(o)+d.radius*.2*Math.log1p(z/d.outerHeight);
  const shift=Math.max(0,minimum-r)*t*t*(3-2*t);
  if(!shift)return{x:0,y:0};
  // At the exact projected centre the sign of Z selects a stable pole.
  return r>1e-9?{x:dx/r*shift,y:dy/r*shift}:{x:0,y:(o.p3[2]<0?1:-1)*shift};
 },
 rawProject(o){return this.base(o.p3);},
 lookup(id){return (typeof MapDetails==='undefined'?OBJECTS.find(q=>q.id===id):(MapDetails.frameObjects||MapDetails.objectsIndex()).get(id))||this.resolve?.(id);},
 displacement(o,base,resolve,seen){
  if(seen?.has(o.id))return{x:0,y:0};
  const id=this.anchorId(o),host=id&&id!==o.id&&(resolve?resolve(id):this.lookup(id));
  if(host?.p3){
   if(host.mapOffset)return{x:host.mapOffset[0],y:host.mapOffset[1]};
   (seen||(seen=new Set())).add(o.id);
   return this.displacement(host,this.rawProject(host),resolve,seen);
  }
  return this.offset(o,base);
 },
 place(o,base=this.base(o.p3),resolve){const d=o.mapOffset?{x:o.mapOffset[0],y:o.mapOffset[1]}:this.displacement(o,base,resolve);return{x:base.x+d.x,y:base.y+d.y};},
 legacy(p3,id){const d=Math.hypot(...p3),a=Math.atan2(-p3[1],p3[0])+(LAYOUT_DATA.entries[id]?.offset||0);return{x:d*Math.cos(a),y:d*Math.sin(a)};},
 project(p){const base=globalThis.OrbitalMotion?.position(p)||this.baseProject(p);return typeof Cosmology==='undefined'?base:Cosmology.project(p,base);},
 baseProject(p){return globalThis.MapRadial?.active()?MapRadial.project(p):this.ordinaryProject(p);},
 ordinaryProject(p){
  if(p.atlasOnly)return{x:NaN,y:NaN};
  if(!p.p3)return this.cache.get(p.id)||{x:p.x,y:p.y};
  return this.place(p);
 },
 init(){
  this.cache.clear();this.anchors=[];
  const index=new Map();for(const o of OBJECTS)if(!index.has(o.id))index.set(o.id,o);
  const resolve=id=>index.get(id)||this.resolve?.(id);
  for(const o of OBJECTS)if(o.p3)this.cache.set(o.id,this.place(o,undefined,resolve));
  this.cache.set('milkyway',this.cache.get('sgr'));
 }
};
MapLayout.init();
globalThis.MapLayout=MapLayout;
