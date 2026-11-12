import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#structure-labels');
run(['map-visibility-data','map-visibility','map-label-data','map-annotations','universe-map'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
run(`{
state=initial();state.expansion=false;paused=true;filter='all';Cosmology.sync(state);MapLayers.active=false;
const structures=OBJECTS.filter(o=>MapAnnotations.structural(o));assert.equal(structures.length,17);
const science=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.region,o.massSolar]));
const draw=()=>{MapLabels.begin();UniverseMap.draw();RegionMap.draw();drawObjects();MapLabels.draw();};
for(const viewport of [390,900,1440])for(const mode of ['full','radial'])for(const palette of ['dark','light','amber']){
 width=viewport;height=viewport===390?562:855;MapSlice.mode=mode;applyTheme(palette);
 for(const o of structures){
  state.selected='alpha';hover=null;
  cam={...MapLayout.project(o),span:Math.max(o.region.major,o.region.minor)*3};cameraGoal=null;draw();
  const first=MapAnnotations.structureLabels.find(q=>q.object.id===o.id);
  if(!ExtendedCatalog.matchesMap(o)){
   assert.equal(first,undefined,'physical slice excludes a region with only a historical 2D arrival anchor');
   continue;
  }
  assert.ok(first?.leader,'resolved structure has its own pointer: '+o.id+'/'+mode+'/'+viewport);
  assert.ok(Math.hypot(first.leader.to.x-first.leader.from.x,first.leader.to.y-first.leader.from.y)<=40,'short local pointer');
  assert.equal(MapAnnotations.hits.filter(q=>q.object.id===o.id).length,1,'one caption per identity');
  assert.equal(MapAnnotations.hit(first.box.x+first.box.w/2,first.box.y+first.box.h/2).id,o.id);
  const box=JSON.stringify(first.box);hover=o;state.selected=o.id;draw();
  assert.equal(JSON.stringify(MapAnnotations.structureLabels.find(q=>q.object.id===o.id).box),box,'hover and selection do not relocate a name');
  const before=MapAnnotations.structureLabels.find(q=>q.object.id===o.id);cam.x+=cam.span*.03;cam.y-=cam.span*.02;draw();
  const after=MapAnnotations.structureLabels.find(q=>q.object.id===o.id);assert.ok(after);
  assert.ok(Math.abs(after.box.x-before.box.x+width*.03)<1e-6&&Math.abs(after.box.y-before.box.y-width*.02)<1e-6,'caption pans exactly with its contour');
  assert.ok(Math.abs(after.leader.to.x-before.leader.to.x+width*.03)<1e-6,'endpoint shares the world anchor');
  const offset={x:after.box.x-after.leader.to.x,y:after.box.y-after.leader.to.y};cam.span*=1.02;draw();
  const zoomed=MapAnnotations.structureLabels.find(q=>q.object.id===o.id);assert.ok(zoomed);
  assert.ok(Math.abs(zoomed.box.x-zoomed.leader.to.x-offset.x)<1e-6&&Math.abs(zoomed.box.y-zoomed.leader.to.y-offset.y)<1e-6,'zoom retains its local caption offset');
 }
 cam=UniverseMap.overview();hover=null;draw();
 for(const q of MapAnnotations.structureLabels)if(q.leader)assert.ok(Math.hypot(q.leader.to.x-q.leader.from.x,q.leader.to.y-q.leader.from.y)<=40,'no screen-spanning overview spokes');
}
assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.region,o.massSolar])),science);
console.log('PASS all 17 structure captions: fixed contour anchors through pan/zoom/hover/selection, short resolved pointers, no overview spokes, all modes/themes/widths and unchanged science');
}`);
