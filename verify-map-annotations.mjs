import fs from 'node:fs';
import assert from 'node:assert/strict';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#map-annotations');
run(['map-visibility-data','map-visibility','map-label-data','map-annotations'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
const boot=run('MAP_LABEL_BOOT');
assert.equal(boot.catalogRevision,JSON.parse(fs.readFileSync('dist/catalog-data/current.json')).revision);
assert.equal(boot.radialRevision,JSON.parse(fs.readFileSync('dist/map-radial/current.json')).revision);
assert.ok(boot.entries.length>900);
assert.equal(new Set(boot.entries.map(q=>q.id)).size,boot.entries.length);
for(const q of boot.entries){assert.ok(q.minPixel>=0&&Number.isFinite(q.minPixel));for(const p of q.limits)assert.ok(p>0&&Number.isFinite(p));}
run(`state=initial();paused=true;state.expansion=false;Cosmology.sync(state);cameraGoal=null;releaseShipCamera();filter='all';MapLayers.active=false;width=1440;height=1000;`);
const science=run('JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.region]))');
// The interval belongs to the name. Pan, target selection, menus and view
// history cannot create a second visible interval while zooming out.
for(const mode of ['full','radial']){
 context.mode=mode;run('MapSlice.mode=mode');
 for(const q of boot.entries){
  context.labelId=q.id;context.pixels=[...new Set([1e-9,q.minPixel,q.minPixel*1.15,q.minPixel*1.3,...q.limits.flatMap(p=>[p*.1,p*.5,p*.8,p*.9,p,p*2]),1e31])].sort((a,b)=>a-b);
  run(`{let seen=false,ended=false;for(const pixel of pixels){cam={x:0,y:0,span:pixel*width};const alpha=MapAnnotations.opacity({id:labelId});cam.x=1e20;cam.y=-1e20;state.selected=labelId;assert.equal(MapAnnotations.opacity({id:labelId}),alpha);if(alpha>.03){assert.ok(!ended,'label reappeared: '+labelId);seen=true;}else if(seen)ended=true;}}`);
 }
 run(`{
  for(const id of ['andromeda','triangulum']){const o=object(id);assert.equal(MapDetails.opacity(o,5e9),0);assert.ok(MapVisibility.limit(o)<=3e8/1440);}
  for(const [kind,end] of [['filament',1.8e9],['galaxy-cluster',1.2e9]])for(const w of [390,1440]){
   const o=MapLayers.sample(kind),limit=end*w/1440;
   assert.equal(MapDetails.opacity(o,limit*.7,w),1);assert.ok(MapDetails.opacity(o,limit*.9,w)>0&&MapDetails.opacity(o,limit*.9,w)<1);
   assert.equal(MapDetails.opacity(o,limit,w),0);assert.equal(MapDetails.opacity(o,1.15e11,w),0);assert.equal(MapLayers.enabled(kind,{span:limit},w),false,'hidden layers must not load tiles');
  }
  for(const id of ['hyperion','shapley','bootes','laniakea','boss-wall']){const o=object(id);for(const span of [5e9,1.15e11]){cam.span=span;assert.equal(RegionMap.asPoint(o),false,id+' must keep its sourced contour');}}
 }`);
}
// Panels may cover the same fixed text, including part of a name. They must
// never move its anchor, reject it, wrap it or add a leader line.
context.menuRects=[];
context.document.querySelectorAll=()=>context.menuRects.map(r=>({getBoundingClientRect:()=>r,classList:{contains:n=>n==='flight-card'&&r.card}}));
run('var annotationLines=0;line=()=>annotationLines++;');
const checks=[];
for(const mode of ['full','slice','radial'])for(const span of [24,1000,130000,3e7,1e8,5e9,1.15e11]){
 context.camera={x:0,y:0,span};context.mode=mode;
 run('MapSlice.mode=mode;MapSlice.centerZ=0;cam=camera;state.selected="alpha";MapLabels.begin();MapAnnotations.draw();');
 const before=run('JSON.stringify(MapAnnotations.admitted)');
 const boxes=run('JSON.stringify(MapLabels.placed)');
 context.menuRects=[{left:0,top:150,width:210,height:650},{left:1030,top:120,width:390,height:850,card:true}];
 run(`MapLabels.begin();MapAnnotations.draw();
 assert.equal(MapAnnotations.overflow.length,0,'panels cannot discard names');assert.equal(annotationLines,0,'no leader lines');
 for(const h of MapAnnotations.hits){assert.equal(MapAnnotations.hit(h.box.x+h.box.w/2,h.box.y+h.box.h/2).id,h.object.id);const p=screen(h.object);assert.ok(Math.abs(h.box.x-p.x-12)<1e-8);assert.ok(Math.abs(h.box.y-p.y+22)<1e-8);}`);
 assert.equal(run('JSON.stringify(MapAnnotations.admitted)'),before,'menu must not change label admission');
 assert.equal(run('JSON.stringify(MapLabels.placed)'),boxes,'menu must not change text coordinates or size');
 checks.push([mode,span,run('MapAnnotations.hits.length')]);context.menuRects=[];
}
run(`cam={x:0,y:0,span:24};MapSlice.mode='full';assert.ok(MapAnnotations.opacity(object('sol'))>.03,'nearby names are not suppressed by a distant region at the same anchor');assert.equal(MapAnnotations.opacity(object('laniakea')),0);`);
assert.equal(run('JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.region]))'),science);
// A real zero-coast mission places acceleration end and braking start at the
// same point. Both captions must remain readable without moving atlas names.
run(`
 state=initial();state.expansion=false;state.current='alpha';state.ship=Space.point(object('alpha').p3);state.selected='andromeda';Cosmology.sync(state);MissionPlanner.launch();paused=true;
 assert.ok(state.flight?.mission);assert.equal(state.flight.mission.coast.distance,0);
 const annotationFlight=state.flight;Simulation.tick(annotationFlight.mission.accelerationEnd.proper*.99);paused=true;
 function assertFlightCaptions(){
  const moving=MapLabels.placed.filter(q=>MapAnnotations.flightLabel(q));
  for(const a of moving)for(const b of MapLabels.placed)if(a!==b)assert.ok(!MapLabels.overlaps(a,b),'flight caption overlaps '+b.key);
  const ship=screen(state.ship),r=state.flight&&['launch','brake'].includes(state.phase)?65:18;
  for(const a of moving)assert.ok(!MapLabels.overlaps(a,{x:ship.x-r,y:ship.y-r,w:r*2,h:r*2}),'flight caption overlaps ship/sail');
  return moving;
 }
 for(const viewport of [390,1440])for(const mode of ['full','slice','radial']){
  width=viewport;height=viewport===390?844:1000;MapSlice.mode=mode;MapSlice.centerZ=0;const center=MapLayout.project(object('andromeda'));cam={...center,span:1.5e6};
  MapLabels.begin();drawObjects();MapAnnotations.draw();const fixed=JSON.stringify(MapLabels.placed);
  const physical=JSON.stringify(state);
  MapLabels.begin();drawObjects();FlightMarks.draw();MapAnnotations.draw();
  assert.equal(assertFlightCaptions().length,2,'both coincident mission events are labelled');
  assert.equal(JSON.stringify(MapLabels.placed.filter(q=>!MapAnnotations.flightLabel(q))),fixed,'flight events leave atlas names fixed');
  const placed=JSON.stringify(MapLabels.placed);MapLabels.begin();drawObjects();FlightMarks.draw();MapAnnotations.draw();assert.equal(JSON.stringify(MapLabels.placed),placed,'repeat frame stays fixed');
  assert.equal(JSON.stringify(state),physical,'layout preserves flight, clocks, fuel and markers');
 }
 // Closely packed legacy events, the ship name, and an existing name all
 // compete for readable rows, regardless of the order they were queued.
 width=1440;height=1000;MapSlice.mode='full';cam={x:0,y:0,span:24};
 function packedFlightCaptions(reverse=false){
  MapLabels.begin();const p={x:650,y:400},labels=[['flight-mark-acceleration','КОНЕЦ РАЗГОНА · ПРОГНОЗ'],['flight-mark-brake','ТОРМОЖЕНИЕ ПАРУСОМ · ПРОГНОЗ'],['flight-mark-fine','ТОЧНОЕ ТОРМОЖЕНИЕ · ПРОГНОЗ'],['ship',SHIP_NAME]];
  MapLabels.point({key:'fixed-neighbour',name:'Соседняя звезда',p:{x:650,y:426}});
  for(const [key,name] of reverse?labels.reverse():labels)MapLabels.point({key,name,p,size:key==='ship'?10:8});
  MapAnnotations.draw();return assertFlightCaptions();
 }
 assert.equal(packedFlightCaptions().length,4);const packed=JSON.stringify(MapLabels.placed);
 assert.equal(packedFlightCaptions(true).length,4);assert.equal(JSON.stringify(MapLabels.placed),packed,'queue order does not move captions');
 // Keep the chosen row when a forecast becomes an actual event, even though
 // its text becomes shorter. Clipped or crowded labels may be omitted.
 const retained=MapLabels.slots.get('flight-mark-brake');MapLabels.begin();MapLabels.point({key:'flight-mark-brake',name:'ТОРМОЖЕНИЕ ПАРУСОМ',p:{x:650,y:400},size:8});MapAnnotations.draw();assert.equal(MapLabels.slots.get('flight-mark-brake'),retained);assertFlightCaptions();
 for(const p of [{x:-1000,y:400},{x:width-10,y:400},{x:650,y:height-5}]){MapLabels.begin();MapLabels.point({key:'flight-mark-brake',name:'ТОРМОЖЕНИЕ · ПРОГНОЗ',p,size:8});MapAnnotations.draw();assert.equal(assertFlightCaptions().length,0);}
`);
console.log('PASS coincident mission and legacy flight captions avoid all names, retain rows across frames/status changes, preserve atlas anchors and physical state, and stay within both viewport sizes in all map modes');
console.log('PASS fixed name intervals and local anchors in all modes; panels do not move or reject names; no leaders; monotone coarse-layer cutoffs, no hidden tile loads, native areas and clickable labels');
console.log(JSON.stringify(checks));
