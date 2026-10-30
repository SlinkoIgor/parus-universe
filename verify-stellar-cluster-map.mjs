import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\n// Stellar footprint regression context.\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
const boot=run('MAP_LAYER_BOOT'),files=new Map();
for(const n of boot.nodes)if(n.file)files.set(n.file,JSON.parse(fs.readFileSync('dist/'+boot.dataRoot+'/'+n.file)));
const source=new Map(JSON.parse(zlib.gunzipSync(fs.readFileSync('data-tools/cosmic-catalogs.json.gz'))).objects.map(o=>[o.id,o]));
context.readClusterFile=file=>files.get(file);
context.clusterRows=[...files.values()].flat().filter(r=>r[2]==='cluster'&&r[11].catalogClass!=='galaxy-cluster');
const decoded=run('clusterRows.map(r=>ExtendedCatalog.decode(r))');
assert.equal(decoded.length,4094);
let halfNumber=0,optical=0,halfLight=0;
for(let i=0;i<decoded.length;i++){
 const o=decoded[i],r=context.clusterRows[i];assert.ok(o.region,o.id+' has a sourced footprint');
 assert.equal(o.d,r[3]);assert.deepEqual(Array.from(o.p3),Array.from(r[11].p3||run(`Space.fromSky(${r[4]},${r[5]},${r[3]})`)));
 assert.ok(o.region.major>0&&o.region.minor>0&&o.region.url);
 if(o.region.sizeKind==='half-number'){
  const m=o.catalogMeasurements?.find(m=>m.data?.halfNumberRadiusPc>0),s=source.get(m?.sourceId||o.id);assert.ok(s,o.id+' has a source row');
  const expected=s.catalogData.halfNumberRadiusPc*2*3.261563777;assert.ok(Math.abs(o.region.major/expected-1)<1e-12);assert.match(o.region.note,/50%.*не всё/);assert.match(o.region.note,/Погрешность/);halfNumber++;
 }else if(o.region.sizeKind==='optical'){
  assert.ok(Math.abs(o.region.major/(2*o.d*Math.tan(o.angularMajorArcmin*Math.PI/21600))-1)<1e-12);optical++;
 }else if(o.region.sizeKind==='half-light'){assert.equal(o.region.major,o.diameterLy);assert.match(o.region.note,/половину света/);halfLight++;}
}
assert.ok(halfNumber>4000&&optical>10&&halfLight>0);
// All spatial leaves contain the complete displayed footprint, not only its
// center. This independently checks the Python index against runtime sizes.
for(const node of boot.nodes.filter(n=>n.category==='stellar-cluster'&&n.file))for(const row of files.get(node.file)){
 context.rowToCheck=row;const o=run('ExtendedCatalog.decode(rowToCheck)'),rx=o.region.major/2,ry=o.region.minor/2;
 assert.ok(node.box[0]<=row[12]-rx+1e-8&&node.box[2]>=row[12]+rx-1e-8&&node.box[1]<=row[13]-ry+1e-8&&node.box[3]>=row[13]+ry-1e-8,row[0]+' footprint outside its leaf');
}
console.log('PASS all 4094 structural cluster footprints from individual source sizes:',{halfNumber,optical,halfLight},'; 3D/IDs retained; every spatial leaf bounds actual extents');
run(`{
state=initial();state.expansion=false;Cosmology.sync(state);width=1440;height=1000;filter='stellar-cluster';MapLayers.active=true;
function settleClusterView(){for(const files of MapLayers.filesForView(cam,width,height).values())for(const file of files)if(!MapLayers.cache.has(file))MapLayers.cache.set(file,readClusterFile(file).map(r=>ExtendedCatalog.decode(r)));MapLayers.lastUpdate=-Infinity;MapLayers.update(performance.now());}
function clusterFrame(){MapLabels.begin();RegionMap.draw();drawObjects();ExtendedCatalog.draw();MapLabels.draw();}
const originalPositions=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition]));
// Large and small nearby clusters differ by physical size; zooming halves the
// on-screen footprint instead of leaving a fixed 36 px decoration.
for(const id of ['omega','opengc-ngc2632']){const o=object(id),p=MapLayout.project(o);let previous;
 for(const span of [1000,2000]){cam={x:p.x,y:p.y,span};settleClusterView();clusterFrame();const hit=RegionMap.hits.find(h=>h.o.id===id);assert.ok(hit,id+' contour');const xs=hit.points.map(p=>p.x),diameter=Math.max(...xs)-Math.min(...xs);assert.ok(Math.abs(diameter/(o.region.major*width/span)-1)<1e-12);if(previous)assert.ok(Math.abs(diameter/previous-.5)<1e-12);previous=diameter;}
}
// No gap between the contour and point during either transition.
const omega=object('omega'),center=MapLayout.project(omega);
for(const span of [20000,22000,25000,28000,30000]){cam={x:center.x,y:center.y,span};settleClusterView();clusterFrame();const v=StellarClusters.view(omega);assert.ok(Math.abs(v.area+v.point-1)<1e-12);assert.ok(hitObjects.some(h=>h.o.id==='omega')||RegionMap.hits.some(h=>h.o.id==='omega'));if(span===25000){assert.ok(v.area>0&&v.point>0);assert.ok(RegionMap.asPoint(omega));}if(span===30000)assert.equal(v.area,0);}
for(const mode of ['dark','light'])for(const span of [129000,130000,131000]){theme=mode;cam={x:0,y:0,span};settleClusterView();clusterFrame();assert.equal(RegionMap.hits.filter(h=>StellarClusters.is(h.o)).length,0,'every stellar cluster is a point on the Galactic overview');
 const seen=new Set(hitObjects.map(h=>h.o.id));for(const o of MapLayers.visible.filter(o=>StellarClusters.is(o))){const p=screen(o);if(p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height){assert.ok(seen.has(o.id),o.id+' survives compact rendering');assert.equal(StellarClusters.view(o).area,0);}}
 assert.ok(hitObjects.filter(h=>StellarClusters.is(h.o)).every(h=>h.r<=7),'point-sized click targets');
}
// An offscreen source center does not lose an intersecting displayed area.
const sample=MapLayers.visible.filter(o=>o.region?.sizeKind==='half-number').sort((a,b)=>b.region.major-a.region.major)[0],p=MapLayout.project(sample),radius=sample.region.major/2,span=radius*2;cam={x:p.x+radius*.5+span*.43,y:p.y,span};settleClusterView();clusterFrame();assert.ok(screen(sample).x<0);assert.ok(RegionMap.hits.some(h=>h.o.id===sample.id),'visible tail with offscreen cluster center');
// Inspect drawing output: foreground and crowded clusters no longer use the
// fixed swarm of eleven stars and its 18 px halo.
const oldArc=ctx.arc,oldCircle=circle,radii=[];let rings=0;ctx.arc=(x,y,r)=>radii.push(r);circle=()=>rings++;drawSymbol(omega,{x:400,y:300},false);ctx.arc=oldArc;circle=oldCircle;assert.deepEqual(radii,[1.6]);assert.equal(rings,0);
// Old saves have metadata but no derived footprint; restore rebuilds it while
// retaining exact navigation coordinates and source references.
ExtendedCatalog.pin(sample);state.selected=sample.id;ExtendedCatalog.capture(state);const saved=JSON.parse(JSON.stringify(state)),position=JSON.stringify(sample.p3);delete saved.catalogObjects.find(o=>o.id===sample.id).region;ExtendedCatalog.pinned.clear();state=restore(saved);assert.ok(object(sample.id).region);assert.equal(JSON.stringify(object(sample.id).p3),position);assert.equal(state.selected,sample.id);
const unknown={...omega,id:'unknown-size-cluster',region:null,diameterLy:null,minorDiameterLy:null,angularMajorArcmin:null,angularMinorArcmin:null,regionData:null,catalogData:null,catalogMeasurements:[]};StellarClusters.prepare(unknown);assert.equal(unknown.region,null,'unknown size never becomes a made-up average');assert.equal(StellarClusters.view(unknown).point,1);
assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition])),originalPositions);
console.log('PASS scaled cluster contours, continuous contour/point transitions, every Galactic cluster as a compact clickable dot, both themes, visible offscreen tails, old-save restore and explicit unknown sizes');
}`);
