'use strict';
// A camera only asks for spatial coverage. It never chooses representatives.
const MapVisibility={
 classSpans:{galaxy:3e8,quasar:3e8,'galaxy-cluster':1.2e9,filament:1.8e9},
 // Individually sourced cosmological landmarks remain useful on the overview.
 // Their scientific catalogue class and the fixed density hierarchy stay intact.
 overviewPoint(o){return !!(o.cosmicLandmark&&!o.atlasOnly&&['galaxy','quasar'].includes(o.kind)&&o.cosmology?.distanceLy>0&&o.p3?.every(Number.isFinite));},
 get active(){return typeof MAP_VISIBILITY_BOOT!=='undefined'&&MAP_VISIBILITY_BOOT.version===1&&MAP_VISIBILITY_BOOT.catalogRevision===EXTENDED_BOOT.revision&&MAP_VISIBILITY_BOOT.geometryVersion===MapLayout.version&&(!MapRadial.manifest||MAP_VISIBILITY_BOOT.radialRevision===MapRadial.manifest.revision);},
 limit(o){
  if(!this.active||o.synthetic||o.nuclearStar)return Infinity;
  const p=MAP_VISIBILITY_BOOT.pixels[o.id]?.[MapSlice.mode==='radial'?1:0];
  const density=p===undefined||p<0?Infinity:p,group=MapDetails.group(o),classSpan=this.overviewPoint(o)?Infinity:this.classSpans[group]??Infinity;
  return Math.min(density,classSpan/1440);
 },
 focusSpan(o,span,viewportWidth=width){return Math.min(span,this.limit(o)*Math.max(1,viewportWidth)*.7);},
 opacity(o,span,viewportWidth=width){
  const limit=this.limit(o);if(limit===Infinity)return 1;
  const pixel=span/Math.max(1,viewportWidth);if(pixel>=limit)return 0;if(pixel<=limit*.8)return 1;
  const t=(pixel/limit-.8)/.2;return 1-t*t*(3-2*t);
 },
 filesForView(view,w,h){
  const mode=MapSlice.mode==='radial'?'radial':'full',tree=MAP_VISIBILITY_BOOT.modes[mode];
  const v=Cosmology.referenceView(view),pixel=v.span/Math.max(1,w),cy=h*(w<700?.39:.5),pad=64*pixel;
  const box=[v.x-.43*w*pixel-pad,v.y-cy*pixel-pad,v.x+.57*w*pixel+pad,v.y+(h-cy)*pixel+pad],files=[];
  const visit=id=>{const n=tree.nodes[id],b=n.box;if(n.maxPixel<pixel||b[0]>box[2]||b[2]<box[0]||b[1]>box[3]||b[3]<box[1])return;
   if(n.children.length&&pixel<=n.splitPixel)n.children.forEach(visit);else files.push(n.file);
  };tree.roots.forEach(visit);return files;
 }
};
globalThis.MapVisibility=MapVisibility;
