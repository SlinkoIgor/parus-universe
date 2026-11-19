import fs from 'node:fs';
import assert from 'node:assert/strict';
const harness=fs.readFileSync('tests/verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#map-overview');
run(['map-visibility-data','map-visibility','map-label-data','map-annotations'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
run(`state=initial();paused=true;Cosmology.sync(state);cameraGoal=null;releaseShipCamera();filter='all';MapLayers.active=false;width=1440;height=1000;`);
const science=run('JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.redshift,o.cosmology,o.source,o.navigable,o.region]))');
assert.deepEqual(JSON.parse(run('JSON.stringify(OBJECTS.filter(o=>MapVisibility.overviewPoint(o)).map(o=>o.id).sort())')),['jades-z14','mom-z14']);
for(const mode of ['full','radial']){
 context.mode=mode;
 run(`MapSlice.mode=mode;cam={x:0,y:0,span:1.15e11};
  for(const o of OBJECTS.filter(o=>MapVisibility.overviewPoint(o))){
   assert.ok(o.cosmicLandmark&&o.source&&o.cosmology.distanceLy>Cosmology.horizon(0));
   assert.equal(MapVisibility.limit(o),MAP_VISIBILITY_BOOT.pixels[o.id][mode==='radial'?1:0],'preserve the fixed density threshold');
   assert.equal(MapDetails.opacity(o,cam.span),1);assert.equal(RegionMap.asPoint(o),true);
   assert.equal(MapDetails.mapLabelName(o),null,'a published catalogue designation is not a proper name');
  }
  for(const id of ['andromeda','triangulum','3c273']){
   state.selected=id;assert.equal(MapVisibility.overviewPoint(object(id)),false);assert.equal(MapDetails.opacity(object(id),cam.span),0,'ordinary galaxies and quasars keep their class cutoff');
  }
  for(const kind of ['galaxy-cluster','filament'])assert.equal(MapDetails.opacity(MapLayers.sample(kind),3e9),0);
  for(const id of ['hyperion','shapley','bootes'])assert.equal(RegionMap.asPoint(object(id)),false,'native region must not become an icon');
  drawObjects();MapLabels.begin();MapAnnotations.draw();
  for(const id of ['mom-z14','jades-z14']){
   assert.ok(hitObjects.some(h=>h.o.id===id),'clickable point: '+id);
   const caption=MapAnnotations.hits.find(h=>h.object.id===id);
   if(caption){
    assert.ok(MapAnnotations.sparseView(),'numeric captions require at most 10 visible objects: '+id);
    for(const box of MapLabels.placed)if(box.key!=='object-'+id)assert.ok(!MapLabels.overlaps(caption.box,box),'sparse caption cannot cover another name');
   }
  }
 `);
 // One interval per point and name, independent of selection, pan and menus.
 run(`for(const o of OBJECTS.filter(o=>MapVisibility.overviewPoint(o))){
  const entry=MapAnnotations.entries.get(o.id),limit=MapVisibility.limit(o),end=entry?.limits[mode==='radial'?1:0]??limit;assert.equal(entry,undefined,'numeric points are absent from generated name metadata');let ended=false,seen=false;
  for(const pixel of [1e-6,end*.5,end*.8,end*.9,end,end*2,limit,limit*2].sort((a,b)=>a-b)){
   cam={x:0,y:0,span:pixel*width};const alpha=MapAnnotations.opacity(o),point=MapDetails.opacity(o,cam.span);
   cam.x=1e20;cam.y=-1e20;state.selected=o.id;assert.equal(MapAnnotations.opacity(o),alpha);assert.equal(MapDetails.opacity(o,cam.span),point);
   if(alpha>.03){assert.ok(!ended,'name reappeared: '+o.id);seen=true;}else if(seen)ended=true;
  }
 }`);
 for(const width of [390,1440]){
  context.viewportWidth=width;
  run(`width=viewportWidth;for(const o of OBJECTS.filter(o=>MapVisibility.overviewPoint(o))){cam={x:0,y:0,span:1.15e11};assert.equal(MapDetails.opacity(o,cam.span),MapVisibility.opacity(o,cam.span,width),'mobile overview obeys the common density threshold');cam.span=Math.min(cam.span,MapVisibility.limit(o)*width*.5);assert.equal(MapDetails.opacity(o,cam.span),1,'focusing reaches the ordinary visibility window');}`);
 }
 run('width=1440');
}
run(`assert.equal(MapVisibility.overviewPoint({kind:'galaxy',cosmicLandmark:true,atlasOnly:true,cosmology:{distanceLy:3e10},p3:[3e10,0,0]}),false);`);
assert.equal(run('JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.redshift,o.cosmology,o.source,o.navigable,o.region]))'),science);
console.log('PASS sourced cosmic points follow common density in all modes/mobile and remain discoverable by focus; numeric captions require a clear sparse view and remain outside static name metadata; class cutoffs and science are unchanged');

run(`{
state=initial();paused=true;width=1440;height=1000;cam={x:0,y:0,span:7e10};
const light={comoving:Cosmology.horizon(0),radius:Cosmology.horizon(0)},
 ship={comoving:light.comoving*(1-1e-4),radius:light.radius*(1-1e-4)};
// Hyperion and two quasars look inside the XY horizon despite being outside
// the 3D sphere. Also cover targets outside both the circle and the sphere.
for(const epoch of [0,14e9])for(const mode of ['full','radial']){
 MapSlice.mode=mode;Cosmology.cache.clear();state.cosmicTime=epoch;Cosmology.sync(state);
 const comoving=Cosmology.horizon(epoch),q={comoving,radius:comoving*Cosmology.scale()};
 for(const id of ['hyperion','qso-gb1428','qso-he1104','mom-z14','jades-z14']){
  const target=object(id),d=Space.distance(state.ship,target),from=screen(state.ship),to=screen(target),
   marks=ReachDisplay.route(target,q,q);
  assert.ok(d>q.comoving);assert.equal(marks.length,2);
  if(epoch===0&&(id==='hyperion'||id.startsWith('qso-')))assert.ok(Math.hypot(...target.p3.slice(0,2))<q.comoving);
  for(const mark of marks){
   assert.ok(mark.fraction>0&&mark.fraction<1);
   const fraction=Math.hypot(mark.x-from.x,mark.y-from.y)/Math.hypot(to.x-from.x,to.y-from.y);
   assert.ok(Math.abs(fraction*d-q.comoving)<q.comoving*1e-12,'full 3D distance sets the crossing: '+id+' / '+mode);
  }
  assert.deepEqual(ReachDisplay.route(target,{comoving:d*2},null),[],'no crossing before a reachable target');
 }
 assert.deepEqual(ReachDisplay.route(object('alpha'),q,q),[],'local targets need no cosmological mark');
}
state.cosmicTime=0;Cosmology.sync(state);MapSlice.mode='full';state.selected='hyperion';
assert.ok(Math.hypot(...object('hyperion').p3.slice(0,2))<light.comoving);
assert.equal(MissionPlanner.preview().unreachable,true,'the screenshot target really is beyond the photon horizon');
MapLabels.begin();drawRouteReachability(ship,light);
assert.equal(MapLabels.queue.filter(q=>q.key.startsWith('route-reach-')).length,1,'near-identical limits share one readable mark');
assert.ok(MapLabels.queue.some(q=>q.name.includes('СВЕТА И ПОЛЁТА')));
MapLabels.begin();drawRouteReachability({...ship,comoving:5e9,radius:5e9},light);
assert.equal(MapLabels.queue.filter(q=>q.key.startsWith('route-reach-')).length,2,'distinct flight and photon limits stay separate');
assert.deepEqual(ReachDisplay.route({navigable:true},ship,light),[]);
state.expansion=false;assert.deepEqual(ReachDisplay.route(object('hyperion'),ship,light),[]);
// After departure, use the remaining physical leg and its saved display
// endpoints, even when the player browses another object or changes modes.
state=initial();state.current=null;state.selected='alpha';
const from=object('boss-wall'),target=object('hyperion'),fraction=.25;
state.ship=Space.point(from.p3.map((x,i)=>x+(target.p3[i]-x)*fraction));
state.flight={cosmic:true,from:Space.point(from.p3),fromId:from.id,target:target.id,
 distance:Space.distance(from,target),covered:Space.distance(from,target)*fraction};
for(const mode of ['full','radial']){
 MapSlice.mode=mode;Cosmology.cache.clear();
 const remaining=Space.distance(state.ship,target),q={comoving:remaining*.4,radius:remaining*.4},
  mark=ReachDisplay.route(target,q,null)[0],p=routeScreenSegment(state.flight.from,target,.55,.55);
 assert.ok(mark&&p);assert.ok(Math.hypot(mark.x-p.a.x,mark.y-p.a.y)<1e-8,'active crossing shares the actual route in '+mode);
 assert.deepEqual(ReachDisplay.route(object('alpha'),q,null),[],'browsing never changes the active crossing');
}
console.log('PASS 3D horizon crossings precede distant targets in full/radial maps and later epochs; merged/separate marks, frozen expansion and active affine routes');
}`);
