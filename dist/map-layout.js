'use strict';
// Orthographic Galactic XY view. Physical p3 is never changed by the map.
const MapLayout={
 cache:new Map(),anchors:[],
 version:2,
 base(p3){return{x:p3[0],y:-p3[1]};},
 legacy(p3,id){const d=Math.hypot(...p3),a=Math.atan2(-p3[1],p3[0])+(LAYOUT_DATA.entries[id]?.offset||0);return{x:d*Math.cos(a),y:d*Math.sin(a)};},
 project(p){return typeof Cosmology==='undefined'?this.baseProject(p):Cosmology.project(p,this.baseProject(p));},
 baseProject(p){
  if(p.atlasOnly)return{x:NaN,y:NaN};
  if(p.mapPosition)return p.mapPosition;
  if(p.id&&this.cache.has(p.id))return this.cache.get(p.id);
  if(!p.p3)return{x:p.x,y:p.y};
  return this.base(p.p3);
 },
 init(){
  for(const o of OBJECTS)if(o.p3){const offset=LAYOUT_DATA.entries[o.id]?.offset||0;this.cache.set(o.id,this.base(o.p3,offset));if(o.d)this.anchors.push({p3:o.p3,offset});}
  this.cache.set('milkyway',this.cache.get('sgr'));
 }
};
MapLayout.init();
