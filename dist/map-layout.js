'use strict';
// Display-only embedding. p3 and physical x/y NEVER depend on this module.
const MapLayout={
 cache:new Map(),anchors:[],
 base(p3,offset=0){const d=Math.hypot(...p3);if(!d)return{x:0,y:0};const a=Math.atan2(-p3[1],p3[0])+offset;return{x:d*Math.cos(a),y:d*Math.sin(a)};},
 project(p){
  if(p.id&&this.cache.has(p.id))return this.cache.get(p.id);
  if(!p.p3)return{x:p.x,y:p.y};
  const d=Math.hypot(...p.p3);if(!d)return{x:0,y:0};
  // Exact identity on the Galactic plane, including uncatalogued trajectory points.
  if(Math.abs(p.p3[2])<d*1e-12)return{x:p.p3[0],y:-p.p3[1]};
  const near=this.anchors.map(a=>({a,d:Math.hypot(...p.p3.map((v,i)=>v-a.p3[i]))})).sort((a,b)=>a.d-b.d).slice(0,8);
  if(near[0]?.d<d*1e-12)return this.base(p.p3,near[0].a.offset);
  let s=0,w=0;for(const n of near){const weight=1/Math.max(1e-30,(n.d/d)**4);s+=n.a.offset*weight;w+=weight;}
  const limit=Math.PI/3*Math.abs(p.p3[2])/d,offset=Math.max(-limit,Math.min(limit,w?s/w:0));
  return this.base(p.p3,offset);
 },
 init(){
  for(const o of OBJECTS)if(o.p3){const offset=LAYOUT_DATA.entries[o.id]?.offset||0;this.cache.set(o.id,this.base(o.p3,offset));if(o.d)this.anchors.push({p3:o.p3,offset});}
  this.cache.set('milkyway',this.cache.get('sgr'));
 }
};
MapLayout.init();
