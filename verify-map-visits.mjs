import fs from 'node:fs';
const harness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {run,context};';
const {run} = await import('data:text/javascript,' + encodeURIComponent(harness) + '#map-visits');
run(`
resize();width=1440;height=1000;hudHeight=140;cameraGoal=null;releaseShipCamera();paused=true;
state=initial();state.expansion=false;Cosmology.sync(state);
const visitsScience=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.region]));
state.visited=['sol','alpha','sirius','andromeda','sgr'];
for(const mode of ['full','radial','slice'])for(const span of [.00006,24,1000,130000,3e7,5e9,1.15e11]){
 MapSlice.mode=mode;MapSlice.centerZ=0;cam={x:0,y:0,span};
 const before=JSON.stringify(state);MapVisits.draw();
 const shown=MapVisits.groups.flatMap(g=>g.objects.map(o=>o.id));
 assert.ok(shown.includes('sol'),'home visit remains at '+mode+' '+span);
 for(const id of state.visited){
  const o=object(id),p=screen(o),inside=p.x>=0&&p.x<=width&&p.y>=0&&p.y<=cameraViewportHeight();
  if(inside&&MapSlice.includes(o))assert.ok(shown.includes(id),'visit survives LOD at '+mode+' '+span+': '+id);
 }
 assert.equal(new Set(shown).size,shown.length,'each visit appears once, including grouped points');
 for(const g of MapVisits.groups){
  assert.equal(g.box.h,20,'CSS-pixel height is independent of zoom');
  assert.equal(MapVisits.hit(g.box.x+g.box.w/2,g.box.y+g.box.h/2),g,'visible badge owns its click');
 }
 assert.equal(JSON.stringify(state),before,'map cannot change visits, physics or save state');
}
assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.region])),visitsScience);
MapSlice.mode='full';cam={x:0,y:0,span:1.15e11};MapVisits.draw();
assert.equal(MapVisits.groups.length,1);assert.equal(MapVisits.groups[0].objects.length,5,'coincident visits retain their exact count');
const group=MapVisits.groups[0],clickState=JSON.stringify(state);
MapVisits.focus(group);assert.ok(cameraGoal.span<cam.span);assert.equal(JSON.stringify(state),clickState,'group zoom cannot select, launch or change the expedition');
assert.ok(MapVisits.title(group).includes('5'));assert.ok(MapVisits.title(group).includes('приблизить'));
cam={...cameraGoal};cameraGoal=null;MapVisits.draw();assert.ok(MapVisits.groups.length>1,'zoom separates distant visits');
state.visited=['sol'];
for(const zen of [false,true])for(const [x,y] of [[0,0],[width,0],[0,zen?height:cameraViewportHeight()],[width,zen?height:cameraViewportHeight()]]){
 zenMode=zen;
 cam={x:(width*.43-x)*24/width,y:(mapOriginY()-y)*24/width,span:24};MapVisits.draw();
 const b=MapVisits.groups[0].box;
 assert.ok(b.x>=0&&b.x+b.w<=width&&b.y>=0&&b.y+b.h<=(zen?height:cameraViewportHeight()),'edge visits keep a complete clickable badge, including the expanded Zen viewport');
}
zenMode=false;
state.visited=['sol','alpha','sirius','andromeda','sgr'];

// Ordinary catalogue filters suppress glyphs, while the expedition overlay
// remains complete and does not change the filter or its scientific counts.
MapSlice.mode='full';cam={x:0,y:0,span:130000};
const filterMatch=ExtendedCatalog.matchesMap;ExtendedCatalog.matchesMap=()=>false;
try{drawObjects();assert.equal(hitObjects.length,0);MapVisits.draw();assert.ok(MapVisits.groups.flatMap(g=>g.objects).some(o=>o.id==='alpha'));}
finally{ExtendedCatalog.matchesMap=filterMatch;}
// A slice still represents the actual physical slab. History cannot invent
// an in-slice position or fade with the ordinary catalogue's zoom thresholds.
MapSlice.mode='slice';MapSlice.centerZ=1e8;MapVisits.draw();assert.equal(MapVisits.groups.length,0);
MapSlice.mode='full';MapVisits.draw();assert.ok(MapVisits.groups.length);

// Streamed/generated destinations remain accessible after their tiles have
// gone away and after an actual save/restore, just like ordinary catalogue IDs.
const host=object('andromeda'),remote={id:'visit-regression-remote',name:'Посещённая игровая звезда',kind:'star',synthetic:true,parentGalaxy:host.id,...Space.point(host.p3.map((v,i)=>v+(i===0?1:0)))};
ExtendedCatalog.pinned.set(remote.id,remote);state.visited.push(remote.id);state.visited.push(remote.id,'missing-visit-id');
ExtendedCatalog.capture(state);state=restore(JSON.parse(JSON.stringify(state)));Cosmology.sync(state);
const remotePoint=MapLayout.project(object(remote.id));cam={...remotePoint,span:24};MapVisits.draw();
assert.equal(MapVisits.groups.flatMap(g=>g.objects).filter(o=>o.id===remote.id).length,1,'pinned visit survives reload, deduplicated');
assert.ok(!MapVisits.groups.flatMap(g=>g.objects).some(o=>o.id==='missing-visit-id'),'missing records have no fabricated position');

// The real arrival code supplies the history, not selection or flight launch.
state=initial();state.expansion=false;state.selected='sirius';Cosmology.sync(state);paused=true;launch();
assert.ok(state.flight);assert.ok(!state.visited.includes('sirius'));
Simulation.tick(FlightEstimate.get().proper*1.00001);paused=true;
assert.equal(state.current,'sirius');assert.ok(!state.flight);assert.ok(state.visited.includes('sirius'));
cam={x:0,y:0,span:1.15e11};MapVisits.draw();assert.ok(MapVisits.groups.flatMap(g=>g.objects).some(o=>o.id==='sirius'));
const afterArrival=JSON.stringify(state.visited);state=restore(JSON.parse(JSON.stringify(state)));Cosmology.sync(state);MapVisits.draw();
assert.equal(JSON.stringify(state.visited),afterArrival);assert.ok(MapVisits.groups.flatMap(g=>g.objects).some(o=>o.id==='sirius'));
state=initial();Cosmology.sync(state);MapVisits.draw();assert.deepEqual(MapVisits.groups.flatMap(g=>g.objects.map(o=>o.id)),['sol'],'new expedition resets its map history');
console.log('PASS visits remain visible at every scale in full/radial, respect the physical slice, survive filters/pinned tile eviction/save/reload, group with exact counts and zoom without changing navigation; real arrivals and new expeditions drive the overlay');
`);
