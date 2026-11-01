import fs from 'node:fs';
import assert from 'node:assert/strict';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#map-overview');
run(['map-visibility-data','map-visibility','map-label-data','map-annotations'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
run(`state=initial();paused=true;Cosmology.sync(state);cameraGoal=null;releaseShipCamera();filter='all';MapLayers.active=false;width=1440;height=1000;`);
const science=run('JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.redshift,o.cosmology,o.source,o.navigable,o.region]))');
assert.deepEqual(JSON.parse(run('JSON.stringify(OBJECTS.filter(o=>MapVisibility.overviewPoint(o)).map(o=>o.id).sort())')),['jades-z14','mom-z14']);
for(const mode of ['full','slice','radial']){
 context.mode=mode;
 run(`MapSlice.mode=mode;MapSlice.centerZ=0;cam={x:0,y:0,span:1.15e11};
  for(const o of OBJECTS.filter(o=>MapVisibility.overviewPoint(o))){
   assert.ok(o.cosmicLandmark&&o.source&&o.cosmology.distanceLy>Cosmology.horizon(0));
   assert.equal(MapVisibility.limit(o),MAP_VISIBILITY_BOOT.pixels[o.id][mode==='radial'?1:0],'preserve the fixed density threshold');
   assert.equal(MapDetails.opacity(o,cam.span),1);assert.equal(RegionMap.asPoint(o),true);
   assert.equal(MapAnnotations.entries.get(o.id).name,o.name,'keep published numeric designations');
   assert.ok(MapAnnotations.opacity(o)>.03,'desktop overview name: '+o.id);
  }
  for(const id of ['andromeda','triangulum','3c273']){
   state.selected=id;assert.equal(MapVisibility.overviewPoint(object(id)),false);assert.equal(MapDetails.opacity(object(id),cam.span),0,'ordinary galaxies and quasars keep their class cutoff');
  }
  for(const kind of ['galaxy-cluster','filament'])assert.equal(MapDetails.opacity(MapLayers.sample(kind),2e9),0);
  for(const id of ['hyperion','shapley','bootes'])assert.equal(RegionMap.asPoint(object(id)),false,'native region must not become an icon');
  drawObjects();MapLabels.begin();MapAnnotations.draw();
  for(const id of ['mom-z14','jades-z14']){
   assert.ok(hitObjects.some(h=>h.o.id===id),'clickable point: '+id);
   const hit=MapAnnotations.hits.find(h=>h.object.id===id);assert.ok(hit,'named point: '+id);
   assert.equal(MapAnnotations.hit(hit.box.x+hit.box.w/2,hit.box.y+hit.box.h/2).id,id);
  }
 `);
 // One interval per point and name, independent of selection, pan and menus.
 run(`for(const o of OBJECTS.filter(o=>MapVisibility.overviewPoint(o))){
  const entry=MapAnnotations.entries.get(o.id),limit=MapVisibility.limit(o),end=entry.limits[mode==='radial'?1:0];let ended=false,seen=false;
  for(const pixel of [1e-6,end*.5,end*.8,end*.9,end,end*2,limit,limit*2].sort((a,b)=>a-b)){
   cam={x:0,y:0,span:pixel*width};const alpha=MapAnnotations.opacity(o),point=MapDetails.opacity(o,cam.span);
   cam.x=1e20;cam.y=-1e20;state.selected=o.id;assert.equal(MapAnnotations.opacity(o),alpha);assert.equal(MapDetails.opacity(o,cam.span),point);
   if(alpha>.03){assert.ok(!ended,'name reappeared: '+o.id);seen=true;}else if(seen)ended=true;
  }
 }`);
 for(const width of [390,1440]){
  context.viewportWidth=width;
  run(`width=viewportWidth;cam={x:0,y:0,span:1.15e11};for(const o of OBJECTS.filter(o=>MapVisibility.overviewPoint(o)))assert.equal(MapDetails.opacity(o,cam.span),1,'point survives mobile overview');`);
 }
 run('width=1440');
}
run(`assert.equal(MapVisibility.overviewPoint({kind:'galaxy',cosmicLandmark:true,atlasOnly:true,cosmology:{distanceLy:3e10},p3:[3e10,0,0]}),false);`);
assert.equal(run('JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.redshift,o.cosmology,o.source,o.navigable,o.region]))'),science);
console.log('PASS two sourced cosmic point landmarks beyond the light horizon, published names, fixed visibility intervals in all modes/mobile, ordinary class cutoffs, clickable captions and unchanged science');
