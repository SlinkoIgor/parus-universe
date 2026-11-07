import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#sparse-labels');
run(['map-visibility-data','map-visibility','map-label-data','map-annotations'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
context.labelRadial=JSON.parse(fs.readFileSync('dist/'+JSON.parse(fs.readFileSync('dist/map-radial/current.json')).dataRoot+'/manifest.json'));
run(`
resize();state=initial();state.expansion=false;paused=true;Cosmology.sync(state);
MapRadial.manifest=labelRadial;MapLayers.active=false;releaseShipCamera();cameraGoal=null;
const labelScience=JSON.stringify([state,OBJECTS.map(o=>[o.id,o.name,o.p3])]);
const numeric=['mom-z14','jades-z14','3c273'].map(id=>object(id));
for(const o of numeric)assert.equal(MapDetails.mapLabelName(o),null,'designation remains distinct from a proper name');
// Test actual catalogue designations at the inclusive 10-object boundary.
// Duplicate hits, offscreen cache padding and invisible enclosing areas must
// not alter the count. Resolved contours in the viewport do count.
for(const mode of ['full','slice','radial'])for(const w of [390,1440]){
 MapSlice.mode=mode;width=w;height=w===390?844:1000;cam={x:1e15,y:1e15,span:1};
 const p={x:Math.min(220,width/2),y:300};
 const target=numeric[0],others=Array.from({length:10},(_,i)=>({o:{id:'label-neighbour-'+i,kind:'star',name:'HIP '+i},p:{x:30+i*20,y:600},r:5}));
 MapSlice.centerZ=target.p3[2];
 const drawCount=n=>{MapLabels.begin();RegionMap.hits=[];hitObjects=[{o:target,p,r:5},...others.slice(0,n-1)];MapAnnotations.draw();return MapAnnotations.hits.find(h=>h.object.id===target.id);};
 assert.ok(drawCount(1));assert.ok(drawCount(9));const ten=drawCount(10);assert.ok(ten);
 assert.equal(drawCount(11),undefined,'11 visible objects suppress unpromoted numeric captions');
 drawCount(10);hitObjects.push(hitObjects[0],{o:{id:'offscreen'},p:{x:-1,y:300}});
 assert.equal(MapAnnotations.sparseView(),true,'unique visible IDs only');
 const outside={o:{id:'outside'},points:[{x:-100,y:-100},{x:width+100,y:-100},{x:width+100,y:height+100},{x:-100,y:height+100}],closed:true};
 RegionMap.hits=[outside];assert.equal(MapAnnotations.sparseView(),true,'enclosing offscreen outline is invisible');
 RegionMap.hits.push({o:{id:'visible-contour'},points:[{x:-20,y:100},{x:width+20,y:100}],closed:false});
 assert.equal(MapAnnotations.sparseView(),false,'a crossing contour is an 11th object even with its centre offscreen');
 // The same anchor must hide, rather than move, when a label, point, contour,
 // or ship conflicts. Clearing the conflict restores its anchor.
 for(const o of numeric){
  MapSlice.centerZ=o.p3[2];
  MapLabels.begin();RegionMap.hits=[];hitObjects=[{o,p,r:5}];MapAnnotations.draw();
  const box=MapAnnotations.hits.find(h=>h.object.id===o.id)?.box;assert.ok(box,o.id);
  const render=()=>{MapAnnotations.draw();return MapAnnotations.hits.find(h=>h.object.id===o.id);};
  hitObjects.push({o:{id:'blocking-point',name:'HIP 99',kind:'star'},p:{x:box.x+box.w/2,y:box.y+box.h/2},r:5});
  assert.equal(render(),undefined,'numeric caption cannot cover another glyph');hitObjects.pop();
  hitObjects.push({o:{id:'blocking-pulsar',name:'PSR J1234',kind:'pulsar'},p:{x:box.x+box.w/2,y:box.y+box.h+15},r:23});
  assert.equal(render(),undefined,'include the full extent of a pulsar glyph');hitObjects.pop();
  RegionMap.hits=[{o:{id:'blocking-contour'},points:[{x:box.x-10,y:box.y+5},{x:box.x+box.w+10,y:box.y+5}],closed:false}];
  assert.equal(render(),undefined,'numeric caption cannot cover a contour');RegionMap.hits=[];
  MapLabels.point({key:'fixed-caption',name:'Existing name',p:{x:p.x,y:p.y}});
  assert.equal(render(),undefined,'existing names have priority');MapLabels.queue=[];
  MapLabels.boxes=[];MapLabels.placed=[];MapAnnotations.hits=[];
  MapAnnotations.place({key:'object-'+o.id,name:o.name,object:o,p,alpha:1,local:true},[{...box}]);
  assert.equal(MapAnnotations.hits.length,0,'ship guard rejects the caption');
  assert.deepEqual(render().box,box,'clearing an obstacle restores the fixed anchor');
  for(const edge of [{x:width-40,y:300},{x:-40,y:300},{x:100,y:10},{x:100,y:height+12}]){
   hitObjects=[{o,p:edge,r:5}];const partial=render();assert.ok(partial,'partial designation remains visible');
   assert.equal(partial.box.x,edge.x+12);assert.equal(partial.box.y,edge.y-22,'edge does not move the anchor');
  }
  hitObjects=[{o,p:{x:width-10,y:300},r:5}];assert.equal(render(),undefined,'fully offscreen text is culled');
 }
}
assert.equal(JSON.stringify([state,OBJECTS.map(o=>[o.id,o.name,o.p3])]),labelScience);
for(const mode of ['full','radial']){
 MapSlice.mode=mode;width=1440;height=1000;const o=numeric[0],p=MapLayout.project(o);
 cam={x:p.x,y:p.y,span:1};const anchor=screen(o);MapLabels.begin();hitObjects=[];
 RegionMap.hits=[{o,points:[{x:anchor.x-20,y:anchor.y+40},{x:anchor.x+20,y:anchor.y+40}],closed:false}];
 MapAnnotations.draw();assert.ok(MapAnnotations.hits.some(h=>h.object.id===o.id),'resolved numeric contour can have a caption without a point glyph');
}
for(const mode of ['full','radial'])for(const w of [390,1440]){
 MapSlice.mode=mode;width=w;height=1000;const b=object('hyg-71453'),p=MapLayout.project(b);
 cam={x:p.x,y:p.y,span:width*2e-6};MapLabels.begin();RegionMap.hits=[];drawObjects();ExtendedCatalog.draw();
 assert.equal(MapAnnotations.opacity(b),0,'old static threshold hides Alpha Cen B at this resolved scale');
 MapAnnotations.draw();const label=MapAnnotations.hits.find(h=>h.object.id===b.id);assert.ok(label,'resolved B has room for its name beyond its old cutoff');
 const box=JSON.stringify(label.box);
 hitObjects.push(...Array.from({length:11},(_,i)=>({o:{id:'crowd-'+i,kind:'star',name:'HIP '+i},p:{x:10+i*20,y:100},r:5})));
 assert.equal(MapAnnotations.sparseView(),false);MapAnnotations.draw();
 assert.equal(JSON.stringify(MapAnnotations.hits.find(h=>h.object.id===b.id)?.box),box,'proper component names do not depend on the 10-object exception');
}
// The defect affects moving companions as a class. Test Alpha Cen B, Sirius B
// and Procyon B at three orbital epochs in every mode and viewport, using
// real rendering/visibility rather than assigning a name to one special ID.
let cases=0;
for(const years of [0,20,50])for(const mode of ['full','slice','radial'])for(const w of [390,1440]){
 state.universeElapsed=years;MapSlice.mode=mode;width=w;height=w===390?844:1000;
 for(const id of ['hyg-71453','hyg-118441','hyg-118493']){
  const o=object(id),point=MapLayout.project(o);MapSlice.centerZ=OrbitalMotion.snapshot3D(o)[2];
  // Resolve the companion locally, with all unrelated objects outside the view.
  cam={x:point.x,y:point.y,span:6e-5};state.selected='sol';
  MapLabels.begin();RegionMap.hits=[];drawObjects();ExtendedCatalog.draw();MapAnnotations.draw();
  assert.ok(hitObjects.some(h=>h.o.id===id),'companion glyph visible '+id);
  const label=MapAnnotations.hits.find(h=>h.object.id===id);assert.ok(label,'proper companion name visible '+id+'/'+mode+'/'+years+'/'+w);
  const anchor=screen(o);assert.ok(Math.abs(label.box.x-anchor.x-12)<1e-8&&Math.abs(label.box.y-anchor.y+22)<1e-8,'name follows current orbital position');
  const fixed=JSON.stringify(label.box);MapAnnotations.draw();assert.equal(JSON.stringify(MapAnnotations.hits.find(h=>h.object.id===id)?.box),fixed,'repeat frame is stable');cases++;
 }
}
for(const mode of ['full','slice','radial'])for(const w of [390,1440])for(const id of ['hyg-71453','3c273']){
 MapSlice.mode=mode;width=w;height=1000;const o=object(id),point=MapLayout.project(o),pixel=6e-5/width;
 MapSlice.centerZ=OrbitalMotion.snapshot3D(o)[2];
 cam={x:point.x+(.43*width+60)*pixel,y:point.y,span:6e-5};
 MapLabels.begin();RegionMap.hits=[];drawObjects();ExtendedCatalog.draw();
 assert.ok(!hitObjects.some(h=>h.o.id===id),'point has left the renderer padding');
 MapAnnotations.draw();assert.ok(MapAnnotations.hits.some(h=>h.object.id===id),'remaining text survives after its point leaves the canvas');
}
console.log('PASS sparse designations at 1/9/10 vs 11 objects; deduplication, offscreen padding, contours, glyph/name/ship/edge collisions, fixed anchors and unchanged catalogue/expedition');
console.log('PASS '+cases+' real companion views: Alpha Cen B, Sirius B and Procyon B at three epochs, all map modes and both widths');
`);
