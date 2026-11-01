import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {catalogPath} from './catalog-path.mjs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#uniform-slice');
const read=p=>JSON.parse(fs.readFileSync(p)),info=read('dist/map-slices/current.json'),slice=read('dist/'+info.dataRoot+'/manifest.json'),full=read(catalogPath('manifest.json'));
context.sliceManifest=slice;
run(`state=initial();state.expansion=false;Cosmology.sync(state);MapSlice.manifest=sliceManifest;MapSlice.setMode('slice');MapSlice.centerZ=0;`);
const digest=row=>crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex'),original=new Map(),leaves=new Map(),heights=new Map();
for(const n of full.nodes.filter(n=>!n.children.length)){
 const rows=read(catalogPath(n.file));leaves.set(n.file,rows);for(const r of rows)original.set(r[0],digest(r));
 context.auditRows=rows;for(const [id,z] of run('auditRows.map(r=>{const o=ExtendedCatalog.decode(r);return[o.id,o.p3?.every(Number.isFinite)&&!o.atlasOnly&&o.positionQuality!=="unknown"?Math.abs(o.p3[2]):Infinity]})'))heights.set(id,z);
}
assert.equal(slice.version,3);assert.equal(slice.catalogRevision,full.revision);
for(const n of slice.nodes){
 if(n.children.length){assert.equal(n.count,n.children.reduce((s,i)=>s+slice.nodes[i].count,0));const rows=read('dist/'+n.file);assert.ok(rows.length<=48);for(const r of rows){assert.equal(digest(r),original.get(r[0]));assert.ok(heights.get(r[0])<=n.zMaxLy+1e-5);}}
 else {const rows=leaves.get(n.file).filter(r=>heights.get(r[0])<=n.zMaxLy+Math.max(1e-5,n.zMaxLy*1e-12));assert.equal(rows.length,n.count);for(const r of rows)assert.ok(r[12]>=n.box[0]&&r[12]<=n.box[2]&&r[13]>=n.box[1]&&r[13]<=n.box[3]);}
}
let previous=0;
for(const b of slice.bands){const expected=[...heights.values()].filter(z=>z<=b.halfThicknessLy).length;assert.equal(b.mapRows,expected);assert.equal(b.roots.reduce((s,i)=>s+slice.nodes[i].count,0),expected);assert.ok(b.mapRows>=previous);previous=b.mapRows;for(const i of b.roots)assert.ok(slice.nodes[i].zMaxLy<=b.halfThicknessLy+1e-5);}
console.log('PASS all dynamic slab bands cover the full catalogue with unchanged rows, complete shared leaves and source-derived samples');
run(`{
 const saved=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.mapOffset]));
 MapSlice.centerZ=0;
 for(const span of [.00006,.002,24,130000,7e6,1e9,1.4e11]){
  cam={x:0,y:0,span};const half=span/4;
  for(const [x,y] of [[0,0],[1e9,-4e10],[-1e10,2e10]]){
   assert.equal(MapSlice.halfThicknessAt([x,y,0]),half,'thickness does not depend on position');
   for(const sign of [-1,1]){assert.equal(MapSlice.includes({p3:[x,y,sign*half]}),true);assert.equal(MapSlice.includes({p3:[x,y,sign*(half+1)]}),false);}
  }
  const tree=MapSlice.treeForView(cam);assert.ok(tree.band>=half&&tree.band<half*2.01);
  assert.ok(ExtendedCatalog.nodesForView(cam,900,620).length<=32);
 }
 cam={x:0,y:0,span:24};const o={id:'probe',kind:'star',p3:[1,0,5.9]};assert.equal(MapSlice.includes(o),true);assert.ok(MapSlice.opacity(o)>0&&MapSlice.opacity(o)<1);cam.span=20;assert.equal(MapSlice.includes(o),false);cam.span=24;assert.equal(MapSlice.includes(o),true);
 const outside={id:'outside',p3:[0,0,7],kind:'star'};assert.equal(MapSlice.includes(outside),false);
 for(const q of [{},{p3:[0,0,NaN]},{p3:[0,0,0],atlasOnly:true},{p3:[0,0,0],positionQuality:'unknown'},{p3:[0,0,0],arrivalAnchor:true}])assert.equal(MapSlice.includes(q),false);
 MapSlice.focus({p3:[3,4,200]});assert.equal(MapSlice.centerZ,200);assert.equal(MapSlice.includes({p3:[1e10,0,200]}),true);assert.equal(MapSlice.includes(object('sol')),false);
 const t=MapSlice.treeForView(cam);assert.ok(t.band>=206);cam.x=1e6;cam.y=-1e5;assert.equal(MapSlice.centerZ,200,'panning cannot move the slab');
 state=initial();state.selected='andromeda';launch(true);paused=true;const physical=()=>JSON.stringify({ship:state.ship,earth:state.earth,proper:state.proper,matter:state.matter,flight:state.flight&&Object.fromEntries(Object.entries(state.flight).filter(([k])=>k!=='view'))}),before=physical();
 for(const mode of ['full','slice','radial','slice','full']){MapSlice.setMode(mode);FlightView.ship();assert.equal(physical(),before);}
 assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.mapOffset])),saved);
 state=initial();MapSlice.setMode('slice');MapSlice.centerZ=0;cam={x:0,y:0,span:24};state.selected='coma';MapSlice.renderSelection();assert.equal($('mapSliceTargetNotice').hidden,false);state.selected='alpha';MapSlice.renderSelection();assert.equal($('mapSliceTargetNotice').hidden,true);
 // Explicit focus gives a narrow slice through the object, including AB at AU scales.
 ExtendedCatalog.focus(object('alpha'));cam={...MapLayout.project(object('alpha')),span:.002};assert.ok(MapSlice.includes(object('alpha')));assert.ok(MapSlice.includes(object('hyg-71453')));
 cameraGoal=null;MapSlice.centerZ=0;MapSlice.setMode('full');
}`);
console.log('PASS uniform continuous zoom thickness, both surfaces, soft edge, fixed altitude while panning, focused-object altitude and unchanged navigation');
context.slicePointer=info;
let release;context.delayedSlicePointer=new Promise(r=>release=r);
run(`globalThis.originalReadJSON=ExtendedCatalog.readJSON;MapSlice.manifest=null;ExtendedCatalog.readJSON=p=>p==='map-slices/current.json'?delayedSlicePointer:Promise.resolve(sliceManifest);MapSlice.setMode('slice')`);
const loading=run('MapSlice.loading');run("MapSlice.setMode('full')");release(info);await loading;assert.equal(run('MapSlice.mode'),'full');
run(`MapSlice.manifest=null;ExtendedCatalog.readJSON=()=>{throw Error('offline')};MapSlice.setMode('slice')`);await run('MapSlice.loading');assert.equal(run('MapSlice.error'),'offline');
run(`ExtendedCatalog.readJSON=p=>Promise.resolve(p==='map-slices/current.json'?slicePointer:sliceManifest);MapSlice.setMode('slice')`);await run('MapSlice.loading');assert.equal(run('MapSlice.error'),null);
for(const corrupt of ["catalogRevision:'stale'","version:2","profile:{type:'uniform-zoom',thicknessToSpan:2}"]){run(`MapSlice.manifest=null;ExtendedCatalog.readJSON=p=>Promise.resolve(p==='map-slices/current.json'?slicePointer:{...sliceManifest,${corrupt}});MapSlice.setMode('slice')`);await run('MapSlice.loading');assert.ok(run('MapSlice.error'));assert.equal(run('MapSlice.manifest'),null);}
run(`ExtendedCatalog.readJSON=originalReadJSON;MapSlice.manifest=sliceManifest;MapSlice.setMode('full')`);
console.log('PASS late responses, retry, stale catalogues and incompatible dynamic slab profiles');
