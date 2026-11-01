import fs from 'node:fs';
import assert from 'node:assert/strict';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#fixed-visibility');
run(fs.readFileSync('dist/map-visibility-data.js','utf8')+'\n'+fs.readFileSync('dist/map-visibility.js','utf8'));
const boot=run('MAP_VISIBILITY_BOOT'),pointer=JSON.parse(fs.readFileSync('dist/catalog-data/current.json'));
assert.equal(boot.catalogRevision,pointer.revision);assert.equal(boot.version,1);
assert.ok(Object.keys(boot.pixels).length>200000);
for(const [id,limits] of Object.entries(boot.pixels))for(const p of limits)assert.ok(p===-1||p>0&&Number.isFinite(p),'finite eventual visibility: '+id);
const read=file=>JSON.parse(fs.readFileSync('dist/'+(/^(map-visibility|map-radial)\//.test(file)?file:pointer.dataRoot+'/'+file)));
const cache=new Map();const tile=file=>{if(!cache.has(file))cache.set(file,read(file));return cache.get(file);};
run(`state=initial();paused=true;state.expansion=false;Cosmology.sync(state);cameraGoal=null;releaseShipCamera();MapLayers.active=false;filter='all';width=1440;height=1000;`);
const science=run('JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition]))');
const spans=[3e10,3e9,1e9,3e8,1e8,1e7,1e6,300000,100000,20000,5000,2000,1000,300,100,24,5,1,.01,.0001];
function render(mode,span,x=0,y=0){
 context.camera={x,y,span};context.mode=mode;
 const files=run(`MapSlice.mode=mode;cam=camera;MapVisibility.filesForView(cam,width,height)`);
 context.catalogRows=files.flatMap(tile);
 return run(`ExtendedCatalog.adoptCut(catalogRows.map(r=>ExtendedCatalog.decode(r)),0);ExtendedCatalog.advanceVisibility(10000);MapLabels.begin();drawGalaxyBackground();RegionMap.draw();drawObjects();ExtendedCatalog.draw();MapLabels.draw();({points:hitObjects.map(h=>({id:h.o.id,x:h.p.x,y:h.p.y,wx:MapLayout.project(h.o).x,wy:MapLayout.project(h.o).y})),regions:RegionMap.hits.map(h=>h.o.id),files:ExtendedCatalog.nodesForView(cam,width,height).length})`);
}
const counts={};let focusRow;
for(const mode of ['full','radial']){
 let previous=null;counts[mode]=[];
 for(const span of spans){
  const a=render(mode,span);focusRow??=context.catalogRows.find(r=>r[2]==='star'&&boot.pixels[r[0]]?.[0]>0&&boot.pixels[r[0]][0]*1440<24);const b=render(mode,span,span*.02,span*.01),c=render(mode,span);
  assert.deepEqual(c.points,a.points,'same camera after a pan gives identical objects: '+mode+'/'+span);
  const panned=new Set([...b.points.map(p=>p.id),...b.regions]);
  for(const p of a.points)if(p.x>100&&p.x<1340&&p.y>100&&p.y<900)assert.ok(panned.has(p.id),'pan removed '+p.id+' at '+mode+'/'+span);
  const ids=new Set([...a.points.map(p=>p.id),...a.regions]);
  if(previous){context.oldPoints=previous.points;const remaining=run(`oldPoints.filter(p=>{const x=width*.43+(p.wx-cam.x)*width/cam.span,y=height*.5+(p.wy-cam.y)*width/cam.span;return x>50&&x<width-50&&y>50&&y<height-50;}).map(p=>p.id)`);for(const id of remaining)assert.ok(ids.has(id),'zoom-in removed '+id+' at '+mode+'/'+span);}
  previous=a;counts[mode].push([span,a.points.length,a.files]);
 }
}
// Host-scale members must survive when their generic complete class layer is off.
for(const mode of ['full','radial']){
 context.mode=mode;run('MapSlice.mode=mode');const center=run('MapLayout.project(object("andromeda"))');
 const chart=render(mode,500000,center.x,center.y),ids=run('ExtendedCatalog.visible.filter(o=>o.kind==="nebula"&&o.parentGalaxy==="andromeda"&&MapDetails.visible(o,cam.span)).map(o=>o.id)');
 assert.equal(ids.length,15,'all 15 M31 nebulae keep their host-scale range in '+mode);
 const shown=new Set(chart.points.map(p=>p.id));for(const id of ids)assert.ok(shown.has(id));
}
run('MapSlice.centerZ=0');const slab=render('slice',1000),slabPan=render('slice',1000,20,10),slabIds=new Set(slabPan.points.map(p=>p.id));
for(const p of slab.points)if(p.x>100&&p.x<1340&&p.y>100&&p.y<900)assert.ok(slabIds.has(p.id),'physical slice pan cannot remove '+p.id);
// Thresholds belong to the record, including pinned/saved targets. Pan, label
// collisions, selection, traversal direction and a cold tile cache cannot change them.
run(`{
 const ids=['sol','alpha','proxima','sirius','andromeda'];
 for(const mode of ['full','radial']){MapSlice.mode=mode;assert.ok(MapVisibility.limit(object('alpha'))>=MapVisibility.limit(object('hyg-71453')),'more massive Alpha A outlives B');for(const id of ids){const o=object(id),limit=MapVisibility.limit(o),op=[];for(const factor of [2,1,.95,.85,.75,.5,.1]){cam={x:0,y:0,span:limit*width*factor};const a=MapDetails.opacity(o,cam.span);cam.x=1e12;cam.y=-1e12;state.selected=id;assert.equal(MapDetails.opacity(o,cam.span),a);op.push(a);}for(let i=1;i<op.length;i++)assert.ok(op[i]>=op[i-1]);}}
}`);
assert.ok(focusRow,'a real low-priority star needs a closer focus');context.focusRow=focusRow;run(`{const o=ExtendedCatalog.decode(focusRow);ExtendedCatalog.pin(o);ExtendedCatalog.focus(o);assert.ok(cameraGoal.span<24);assert.ok(MapDetails.visible(o,cameraGoal.span),'atlas focus reaches the fixed visibility threshold');}`);
assert.equal(run('JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition]))'),science);
console.log('PASS fixed visibility: real catalogue, both projections, 20 scales, pan/revisit, monotone zoom, saved/selected targets and immutable scientific positions');
console.log(JSON.stringify(counts));
