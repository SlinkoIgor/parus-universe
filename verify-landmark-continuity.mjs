import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#landmark-continuity');
run(['map-visibility-data','map-visibility','map-label-data','map-annotations'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
run(`{
 state=initial();state.current=ExtendedCatalog.revealArrival(object('huge-lqg')).id;state.visited.push('huge-lqg',state.current);state.ship=Space.point(object(state.current).p3);ExtendedCatalog.capture(state);state=restore(JSON.parse(JSON.stringify(state)));paused=true;filter='all';MapLayers.active=false;cameraGoal=null;releaseShipCamera();
 const catalogue=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.region])),entries=JSON.stringify(MAP_LABEL_BOOT);
 const regions=['local-void','bootes','laniakea','shapley','hyperion'],points=['mom-z14','jades-z14'];
 for(const mode of ['full','slice','radial'])for(const size of [[1440,1000],[390,844]])for(const epoch of [0,15e9,100e9,1e12])for(const expansion of [true,false]){
  MapSlice.mode=mode;[width,height]=size;state.cosmicTime=epoch;state.expansion=expansion;Cosmology.sync(state);
  const physical=JSON.stringify(state),a=Cosmology.scale();MapSlice.centerZ=0;
  for(const span of [.00006,24,130000,3e8,115e9*a,1e100]){
   cam={x:0,y:0,span};MapLabels.begin();drawObjects();MapAnnotations.draw();
   assert.ok(hitObjects.some(h=>h.o.id==='sol'),'home symbol remains at every scale after a distant arrival');
   const home=MapAnnotations.hits.find(h=>h.object.id==='sol');assert.ok(home,'home name remains at every scale');
   assert.equal(MapAnnotations.hit(home.box.x+home.box.w/2,home.box.y+home.box.h/2).id,'sol');
   if(span>130000)assert.equal(MapDetails.visible(object('alpha'),span),false,'other stars keep their physical size thresholds');
  }
  for(const id of [...regions,...points]){
   const o=object(id),q=MapAnnotations.entries.get(id),named=!!MapDetails.mapLabelName(o),limit=q?.limits[mode==='radial'?1:0]??MapVisibility.limit(o),start=q?.minPixel||limit*.1;
   if(!named)assert.equal(q,undefined,'numeric points are absent from generated name metadata');
   const pixel=Math.sqrt(start*1.3*limit*.7),referenceSpan=pixel*width;
   state.cosmicTime=0;Cosmology.sync(state);cam={...MapLayout.project(o),span:referenceSpan};
   const baseline={name:MapAnnotations.opacity(o),symbol:MapDetails.opacity(o,cam.span)};assert.ok(baseline.symbol>.03&&(!named||baseline.name>.03),id+' has a visible reference window');if(!named)assert.equal(baseline.name,0);
   state.cosmicTime=epoch;Cosmology.sync(state);cam={...MapLayout.project(o),span:referenceSpan*a};MapSlice.focus(o);
   assert.ok(Math.abs(MapAnnotations.opacity(o)-baseline.name)<1e-12,id+' name follows its expanding geometry');
   assert.ok(Math.abs(MapDetails.opacity(o,cam.span)-baseline.symbol)<1e-12,id+' visibility follows the same units');
   MapLabels.begin();MapAnnotations.draw();
   if(!MapSlice.includes(o)){assert.ok(!MapAnnotations.hits.some(h=>h.object.id===id),'unknown-depth legacy anchors still respect the physical slice');continue;}
   if(!MapDetails.mapLabelName(o)){assert.ok(!MapAnnotations.hits.some(h=>h.object.id===id),'numeric point remains unlabelled after expansion');continue;}
   assert.ok(MapAnnotations.hits.some(h=>h.object.id===id),'visible named region/point after expansion: '+id+'/'+mode+'/'+width+'/'+epoch+'/'+expansion);
   const p=screen(o),hit=MapAnnotations.hits.find(h=>h.object.id===id);assert.ok(Math.abs(hit.box.x-p.x-12)<1e-7,'catalogue anchor stays attached');
   if(o.region){RegionMap.render(ctx);assert.ok(RegionMap.hits.some(h=>h.o.id===id),'expanded region contour remains: '+id);}
  }
  const filament=MapLayers.sample('filament'),boundCluster=MapLayers.sample('galaxy-cluster');
  assert.equal(MapDetails.opacity(filament,1.8e9*a*width/1440,width),0);assert.equal(MapDetails.opacity(filament,1.8e9*a*width/1440*.7,width),1);
  assert.equal(MapDetails.opacity(boundCluster,1.2e9*width/1440,width),0,'bound clusters do not grow with expansion');
  assert.equal(JSON.stringify(state),physical,'landmark rendering never edits the expedition');
 }
 // Home wins caption collisions without moving nearby catalogue anchors.
 width=1440;height=1000;MapSlice.mode='full';MapSlice.centerZ=0;cam={x:0,y:0,span:1e9};MapLabels.begin();
 const p=screen(object('sol'));MapLabels.add({key:'neighbour-label',name:'Соседний ориентир',p});MapLabels.point({key:'ship',name:SHIP_NAME,p});MapAnnotations.draw();
 assert.ok(MapAnnotations.hits.some(h=>h.object.id==='sol'));const boxes=MapLabels.placed;
 const home=boxes.find(q=>q.key==='object-sol');assert.ok(!boxes.some(q=>q.key!=='object-sol'&&MapLabels.overlaps(q,home)),'persistent home caption stays readable');
 // Existing search can bring the camera home after a restored distant arrival.
 ExtendedCatalog.capture(state);const before=JSON.stringify(state);state=restore(JSON.parse(before));Cosmology.sync(state);ExtendedCatalog.focus(object('sol'));
 assert.equal(cameraGoal.x,0);assert.equal(cameraGoal.y,0);assert.equal(cameraGoal.span,24);assert.equal(JSON.stringify(state),before);
 assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.region])),catalogue);assert.equal(JSON.stringify(MAP_LABEL_BOOT),entries);
 console.log('PASS permanent clickable home, expanded voids/structures and unlabelled distant points, fixed bound sizes, original anchors, readable home caption and save/search return in all modes/widths/epochs');
}`);
