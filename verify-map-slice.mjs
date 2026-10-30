import fs from 'node:fs';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {catalogPath} from './catalog-path.mjs';

// Load the production UI, including the new script, in the existing canvas VM.
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]
 .replace("'dist/map-layout.js',","'dist/map-layout.js','dist/map-slice.js',")+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
const info=JSON.parse(fs.readFileSync('dist/map-slices/current.json'));
const slice=JSON.parse(fs.readFileSync('dist/'+info.dataRoot+'/manifest.json'));
const full=JSON.parse(fs.readFileSync(catalogPath('manifest.json')));
context.sliceManifest=slice;
run(`MapSlice.manifest=sliceManifest;MapSlice.setMode('slice');`);
const digest=row=>crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex');
const fingerprints=new Map(),expected=new Set(),originalLeaves=new Map();
let rejected=0,newlyAdmitted=0;const newSamples=[];
const leafRows=await Promise.all(full.nodes.filter(n=>!n.children.length).map(async node=>({node,rows:JSON.parse(await fsp.readFile(catalogPath(node.file),'utf8'))})));
for(const {node,rows} of leafRows){
 originalLeaves.set(node.file,rows);
 context.auditRows=rows;
 const admitted=run('auditRows.flatMap(r=>{const o=ExtendedCatalog.decode(r);return MapSlice.includes(o)?[[o.id,o.p3[2]]]:[]})');
 for(const row of rows)fingerprints.set(row[0],digest(row));
 for(const [id,z] of admitted){expected.add(id);if(Math.abs(z)>50e6){newlyAdmitted++;if(newSamples.length<64){const row=rows.find(r=>r[0]===id);newSamples.push({id,tile:node.file,name:row[1],kind:row[2],z,x:row[12],y:row[13]});}}}
 rejected+=rows.length-admitted.length;
}
assert.ok(expected.size>100000&&rejected>10000,'exercise both sides of the plane across the complete catalog');
const reached=new Set();
function visit(id){
 const node=slice.nodes[id],ids=new Set();
 if(node.children.length){
  for(const child of node.children)for(const ident of visit(child))ids.add(ident);
  const rows=JSON.parse(fs.readFileSync('dist/'+node.file));
  assert.ok(rows.length<=48);
  for(const row of rows){assert.ok(ids.has(row[0]),'representative belongs to this slab subtree');assert.equal(digest(row),fingerprints.get(row[0]),'all data and display coordinates remain identical');}
 }else{
  for(const row of originalLeaves.get(node.file))if(expected.has(row[0])){
   assert.ok(!reached.has(row[0]));reached.add(row[0]);ids.add(row[0]);
   assert.ok(row[12]>=node.box[0]&&row[12]<=node.box[2]&&row[13]>=node.box[1]&&row[13]<=node.box[3],'filtered spatial bounds contain every point');
  }
 }
 assert.equal(node.count,ids.size);return ids;
}
for(const id of slice.roots)visit(id);
assert.deepEqual(reached,expected,'every eligible source row is reachable, including ones missing from full-map samples');
assert.equal(slice.mapRows,expected.size);assert.equal(slice.catalogRevision,full.revision);
assert.ok(newlyAdmitted>0,'the flared edges admit real objects beyond the old constant slab');
fs.writeFileSync('/tmp/parus-flared-slice-samples.json',JSON.stringify(newSamples));
console.log(`PASS full catalog: ${expected.size} admitted, ${rejected} excluded, ${newlyAdmitted} newly inside flared edges; complete tree, unchanged source rows and positions`);

run(`{
 const edgePoint=z=>({id:'edge',p3:[0,0,z],mapPosition:{x:9e12,y:-7e12}});
 for(const z of [0,50e6,-50e6])assert.equal(MapSlice.includes(edgePoint(z)),true);
 for(const z of [50e6+1,-50e6-1,NaN,Infinity])assert.equal(MapSlice.includes(edgePoint(z)),false);
 for(const r of [0,46.5e9/4,46.5e9/2,46.5e9,93e9])for(const a of [0,.7,Math.PI,4.2]){
  const p=[r*Math.cos(a),r*Math.sin(a),0],half=MapSlice.halfThicknessAt(p),expected=(1e8+(1e10-1e8)*Math.min(1,r/46.5e9))/2;
  assert.ok(Math.abs(half-expected)<1e-5,'linear thickness from 100 million at Sun to 10 billion at the observable rim');
  for(const z of [half,-half])assert.equal(MapSlice.includes({id:'edge',p3:[p[0],p[1],z]}),true,'both boundary surfaces included');
  for(const z of [half+1,-half-1])assert.equal(MapSlice.includes({id:'edge',p3:[p[0],p[1],z]}),false,'outside either conical surface excluded');
 }
 assert.equal(MapSlice.includes({id:'far-inside',p3:[46.5e9,0,4e9]}),true,'outer slice is wider than the old 100 million slab');
 assert.equal(MapSlice.includes({id:'near-outside',p3:[0,0,4e9]}),false,'the Sun end remains thin');
 MapSlice.render();assert.equal($('mapSliceStatus').hidden,true);assert.equal($('mapSliceStatus').textContent,'');
 assert.equal(MapSlice.includes({id:'unknown',x:0,y:0}),false);
 assert.equal(MapSlice.includes({...edgePoint(0),atlasOnly:true}),false);
 assert.equal(MapSlice.includes({...edgePoint(0),positionQuality:'unknown'}),false);
 assert.equal(MapSlice.includes({...edgePoint(0),arrivalAnchor:true}),false,'a 2D game anchor is not a known Galactic height');
 assert.equal(MapSlice.includes(object('sol')),true);
 assert.equal(MapSlice.includes(object('andromeda')),true);
 assert.equal(MapSlice.includes(object('coma')),false);
 const physical=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.mapOffset,o.parentGalaxy,o.galaxyMember]));
 state=initial();state.selected='andromeda';launch(true);paused=true;
 const expedition=JSON.stringify(state),ship=JSON.stringify(FlightView.ship());
 const fullPositions=OBJECTS.map(o=>MapLayout.project(o));
 for(let i=0;i<4;i++){
  MapSlice.setMode(i%2?'full':'slice');
  assert.equal(JSON.stringify(state),expedition,'view preferences preserve active flight, fuel, clocks and navigation');
  assert.equal(JSON.stringify(FlightView.ship()),ship);
  assert.deepEqual(OBJECTS.map(o=>MapLayout.project(o)),fullPositions,'the projection and Milky Way displacement are identical in both modes');
 }
 assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.mapOffset,o.parentGalaxy,o.galaxyMember])),physical);
 const realGet=localStorage.getItem;localStorage.getItem=key=>key==='parus-map-mode'?'slice':null;
 MapSlice.setup();assert.equal(MapSlice.mode,'slice');assert.equal(JSON.stringify(state),expedition);localStorage.getItem=realGet;
 state=initial();state.selected='coma';paused=true;MapLayers.active=false;
 const outside=object('coma'),inside=object('andromeda');
 ExtendedCatalog.pinned.set(outside.id,outside);ExtendedCatalog.visible=[outside,inside];
 MapLayers.visible=[outside,inside];
 for(const selectedFilter of ['all','galaxy','galaxy-cluster','structure']){
  filter=selectedFilter;
  assert.equal(ExtendedCatalog.matchesMap(outside),false,'pinned, selected and category filters cannot bypass the slab');
  for(const mode of ['full','slice','full','slice']){
   MapSlice.setMode(mode);const p=MapLayout.project(outside);cam={...p,span:1e8};cameraGoal=null;
   MapLabels.begin();drawGalaxyBackground();RegionMap.draw();drawObjects();ExtendedCatalog.draw();MapLabels.draw();
   if(mode==='slice'){
    assert.ok(hitObjects.every(h=>MapSlice.includes(h.o)),'foreground/background hit zones all respect the slice');
    assert.ok(RegionMap.hits.every(h=>MapSlice.includes(h.o)),'cached contours and their hit zones respect the slice');
    assert.ok(!MapLabels.contours.some(h=>h.id==='coma'),'no residual galaxy outline');
   }
  }
 }
 MapSlice.renderSelection();assert.equal($('mapSliceTargetNotice').hidden,false);
 state.selected='andromeda';MapSlice.renderSelection();assert.equal($('mapSliceTargetNotice').hidden,true);
 filter='all';ExtendedCatalog.manifest={nodes:[],roots:[]};
 for(const span of [24,130000,3e7,1e9,1.15e11]){
  const files=ExtendedCatalog.nodesForView({x:0,y:0,span},900,620);
  assert.ok(files.length<=32);assert.ok(files.length>0,'slab tree is used instead of the ordinary tree');
 }
 MapSlice.setMode('full');assert.deepEqual(ExtendedCatalog.nodesForView({x:0,y:0,span:1e9},900,620),[]);
 ExtendedCatalog.pinned.delete(outside.id);
}`);
console.log('PASS 100 million/10 billion thickness, linear profile in every azimuth, both surfaces, real objects, unknown 3D exclusion, rendering, mode persistence and unchanged active flight');

context.slicePointer=info;
let release;
context.delayedSlicePointer=new Promise(resolve=>{release=resolve;});
run(`globalThis.originalReadJSON=ExtendedCatalog.readJSON;MapSlice.manifest=null;ExtendedCatalog.readJSON=path=>path==='map-slices/current.json'?delayedSlicePointer:Promise.resolve(sliceManifest);MapSlice.setMode('slice');`);
const loading=run('MapSlice.loading');
run(`MapSlice.setMode('full')`);release(info);await loading;
assert.equal(run('MapSlice.mode'),'full','a late download never reverses a newer choice');
run(`MapSlice.manifest=null;ExtendedCatalog.readJSON=()=>{throw Error('offline')};MapSlice.setMode('slice');`);
await run('MapSlice.loading');
assert.equal(run('MapSlice.error'),'offline');assert.equal(run('MapSlice.loading'),null);
assert.equal(run('MapSlice.includes(object("coma"))'),false,'an unavailable index never admits objects outside the slab');
run(`ExtendedCatalog.readJSON=path=>Promise.resolve(path==='map-slices/current.json'?slicePointer:sliceManifest);MapSlice.setMode('slice');`);
await run('MapSlice.loading');assert.equal(run('MapSlice.error'),null);assert.equal(run('MapSlice.manifest.catalogRevision'),full.revision);
run(`MapSlice.manifest=null;ExtendedCatalog.readJSON=path=>Promise.resolve(path==='map-slices/current.json'?slicePointer:{...sliceManifest,catalogRevision:'stale'});MapSlice.setMode('slice');`);
await run('MapSlice.loading');assert.ok(run('MapSlice.error'));assert.equal(run('MapSlice.manifest'),null);
run(`ExtendedCatalog.readJSON=path=>Promise.resolve(path==='map-slices/current.json'?slicePointer:{...sliceManifest,profile:{...sliceManifest.profile,edgeThicknessLy:1e8}});MapSlice.setMode('slice');`);
await run('MapSlice.loading');assert.ok(run('MapSlice.error'));assert.equal(run('MapSlice.manifest'),null);
run(`ExtendedCatalog.readJSON=originalReadJSON;MapSlice.manifest=sliceManifest;MapSlice.setMode('full')`);
console.log('PASS late responses, failed index, explicit retry and stale catalog rejection');
