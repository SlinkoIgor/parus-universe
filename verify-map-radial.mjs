import fs from 'node:fs';import crypto from 'node:crypto';import zlib from 'node:zlib';import assert from 'node:assert/strict';
import {catalogPath} from './catalog-path.mjs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#radial');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),pointer=read('dist/map-radial/current.json'),root='dist/'+pointer.dataRoot;
const manifest=read(root+'/manifest.json'),layers=read(root+'/layers.json'),full=read(catalogPath('manifest.json'));
const positions=JSON.parse(zlib.gunzipSync(fs.readFileSync(root+'/placements.json.gz')));
context.radialManifest=manifest;context.radialLayers=layers;context.auditPlacements=positions;
run(`MapRadial.manifest=radialManifest;MapRadial.layers=radialLayers;MapSlice.setMode('radial');`);
const digest=r=>crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex'),originals=new Map(),categories=new Map();
const source=(await Promise.all(full.nodes.filter(n=>!n.children.length).map(n=>fs.promises.readFile(catalogPath(n.file),'utf8').then(JSON.parse)))).flat();
for(const r of source){originals.set(r[0],digest(r));const c=r[11].cosmicSubtype||r[11].catalogClass||r[2];categories.set(r[0],c==='cluster'?'stellar-cluster':c);}
const reached=new Set();
function visit(id,nodes,structural=false){
 const n=nodes[id],ids=new Set();
 for(const child of n.children)for(const v of visit(child,nodes,structural))ids.add(v);
 if(n.file){
  const rows=read(structural?root+'/'+n.file:'dist/'+n.file);
  if(n.children.length)assert.ok(rows.length<=48);
  for(const r of rows){
   assert.equal(digest(r),originals.get(r[0]),'science, original map coordinates and geometry preserved');
   if(structural)for(const d of r[11].regionData?.offsets3||[]){const p=positions[r[0]].position,x=p.x+d[0],y=p.y-d[1];assert.ok(x>=n.box[0]-1e-4&&x<=n.box[2]+1e-4&&y>=n.box[1]-1e-4&&y<=n.box[3]+1e-4,'entire translated local filament, including offscreen anchor, fits index');}
   const p=positions[r[0]].position;assert.ok(p.x>=n.box[0]&&p.x<=n.box[2]&&p.y>=n.box[1]&&p.y<=n.box[3],'new anchor inside queried index');
   if(n.children.length)assert.ok(ids.has(r[0]));
   else{assert.ok(!reached.has(r[0]),'one occurrence per leaf');reached.add(r[0]);ids.add(r[0]);}
  }
 }
 assert.equal(n.count,ids.size);return ids;
}
for(const id of manifest.roots)visit(id,manifest.nodes);
assert.equal(reached.size,source.length);assert.equal(manifest.mapRows,source.length);assert.equal(manifest.catalogRevision,full.revision);
for(const [category,id] of Object.entries(layers.roots)){
 reached.clear();visit(id,layers.nodes,true);
 assert.deepEqual(reached,new Set(source.filter(r=>categories.get(r[0])===category&&(category!=='galaxy'||r[11].angularMajorArcmin>0&&r[3]>0||r[11].diameterLy>0&&!r[11].sizeEstimated&&!r[11].sizeUnknown)).map(r=>r[0])));
}
console.log('PASS all mapped rows and complete structural layers: alternate bounds, no missing geometry, unchanged original data');
// Offline and runtime (also original atlas rows) must agree for the whole class,
// not just handpicked examples or pre-tagged alternate tiles.
for(let i=0;i<source.length;i+=2000){context.batch=source.slice(i,i+2000);run(`for(const row of batch){const o=ExtendedCatalog.decode(row),a=MapLayout.baseProject(o),b=auditPlacements[o.id].position;assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-5,o.id);}`);}
run(`{
 assert.equal(MapRadial.key,radialManifest.profileKey);
 assert.deepEqual(MapLayout.baseProject({x:123,y:456}),{x:123,y:456},'already positioned contour vertices are not reprojected');
 const origin=[0,0,0],near=MapRadial.vector([1,0,100],'group'),far=MapRadial.vector([1,0,100000000]);
 assert.equal(MapRadial.vector(origin).x,0);assert.ok(Math.abs(Math.hypot(far.x,far.y)-Math.hypot(1,100000000))<1e-6);
 assert.ok(Math.abs(near.x-Math.hypot(1,100))<1e-12,'full radial at small scales too');assert.deepEqual(MapRadial.vector([0,0,100000000]),{x:0,y:-100000000});
 assert.deepEqual(MapRadial.vector([0,0,-100000000]),{x:0,y:100000000});
 assert.equal(MapRadial.decision({id:'unrelated',kind:'galaxy',p3:[1e9,2e9,3e9]}).parent,null);
 assert.deepEqual(MapLayout.baseProject(object('sol')),{x:0,y:0});{const o=object('sgr'),p=MapLayout.baseProject(o);assert.ok(Math.abs(Math.hypot(p.x,p.y)-Math.hypot(...o.p3))<1e-9,'Galactic centre uses full solar radius');}
 for(const id of ['andromeda','triangulum']){const o=object(id),h=object('sgr'),p=MapLayout.project(o),q=MapLayout.project(h);assert.ok(Math.abs(Math.hypot(p.x-q.x,p.y-q.y)-Space.distance(o,h))<1e-6);}
 const sat={id:'new-satellite',kind:'galaxy',p3:[27000,10000,500000]},s=MapRadial.placement(sat),host=MapRadial.resolve(s.parent),h=MapRadial.placement(host).position;
 assert.equal(s.rule,'distance-domain');assert.equal(s.parent,'sgr');
 assert.ok(Math.abs(Math.hypot(s.position.x-h.x,s.position.y-h.y)-Math.hypot(...sat.p3.map((v,i)=>v-host.p3[i])))<1e-6);
 // A declared child shares the moved parent and keeps its Galactic XY offset.
 const star={id:'new-population-star',kind:'star',synthetic:true,parentObject:sat.id,p3:sat.p3.map((v,i)=>v+[10,20,30][i]),galaxyMember:true,parentGalaxy:sat.id};
 const resolve=MapLayout.resolve;MapLayout.resolve=id=>id===sat.id?sat:resolve(id);
 const p=MapRadial.placement(star);assert.equal(p.parent,sat.id);assert.equal(p.frame,'rigid-xy');
 assert.deepEqual(p.position,{x:s.position.x+10,y:s.position.y-20});
 assert.equal(MapRadial.explain(star).chain.length,3);
 const before=JSON.stringify(OBJECTS.map(o=>MapRadial.project(o)));
 // Adding even a new dominant-galaxy record cannot refit the frozen group origin.
 const extra={id:'new-catalogue-galaxy',kind:'galaxy',p3:[1,0,1e9],catalogData:{PGC:99999999,groupPGC:99999999}};
 MapLayout.resolve=id=>id===extra.id?extra:id===sat.id?sat:resolve(id);
 assert.equal(MapRadial.placement(extra).warning,'cf4-anchor-not-in-profile');
 assert.equal(JSON.stringify(OBJECTS.map(o=>MapRadial.project(o))),before);
 assert.equal(MapRadial.placement(extra).parent,null);
 const absent={id:'old-missing-parent',kind:'star',p3:[1e9,2e9,3e9],distanceHost:extra.id};
 assert.equal(MapRadial.placement(absent).parent,null,'a newly available static host is not silently admitted');MapLayout.resolve=resolve;
 const close={id:'near-missing-parent',kind:'star',p3:[1,2,3],distanceHost:extra.id};assert.equal(MapRadial.placement(close).parent,'sol','solar domain has priority over hierarchy');
 assert.equal(MapRadial.profile.distanceDomains.find(d=>d.origin==='sol').radiusLy,1000);assert.equal(MapRadial.profile.distanceDomains.find(d=>d.origin==='sgr').radiusLy,15e6);
 for(const r of [999.999,1000,1000.001]){const o={id:'solar-boundary-'+r,kind:'star',p3:[0,0,r]},p=MapRadial.placement(o);if(r<=1000){assert.equal(p.parent,'sol');assert.ok(Math.abs(Math.hypot(p.position.x,p.position.y)-r)<1e-9);}else assert.ok(Math.hypot(p.position.x,p.position.y)>1000);}
 for(const delta of [[1,2,900],[0,0,1100]]){const host=MapRadial.resolve('alpha'),o={id:'rigid-near-component-'+delta,kind:'star',boundSystemPrimary:'alpha',p3:host.p3.map((n,i)=>n+delta[i])},p=MapRadial.placement(o),h=MapRadial.placement(host).position;assert.equal(p.parent,'alpha');assert.equal(p.frame,'rigid-xy');assert.deepEqual(p.position,{x:h.x+delta[0],y:h.y-delta[1]});assert.equal(p.distanceDomain,undefined);}
 const unknown=MapRadial.placement({id:'unknown',p3:null,atlasOnly:true});assert.ok(Number.isNaN(unknown.position.x));
 const physical=()=>JSON.stringify({ship:state.ship,proper:state.proper,earth:state.earth,matter:state.matter,beta:state.beta,phase:state.phase,flight:state.flight&&Object.fromEntries(Object.entries(state.flight).filter(([k])=>k!=='view'))});
 state=initial();state.selected='coma';launch(true);paused=true;const expedition=physical();
 const flight=state.flight,ordinary=(()=>{MapSlice.setMode('full');return FlightView.at(flight,.5);})();
 for(const mode of ['radial','full','radial','full']){
  MapSlice.setMode(mode);const a=FlightView.at(flight,0),b=FlightView.at(flight,1),middle=FlightView.at(flight,.5);
  assert.ok(Math.hypot(middle.x-(a.x+b.x)/2,middle.y-(a.y+b.y)/2)<1e-6);
  assert.equal(physical(),expedition,'physical expedition unchanged by geometry');
  if(mode!=='radial')assert.deepEqual(middle,ordinary);
 }
 // A flight saved with the previous radial profile must not reuse its old
 // screen endpoints; physical endpoints/progress and the saved old view survive.
 MapSlice.setMode('radial');const previousView=flight.view;
 flight.view={a:{x:1e20,y:2e20},b:{x:3e20,y:4e20},geometryVersion:MapLayout.version,modeKey:MapLayout.version+':recursive-radial-v2:old-profile'};
 const frozenOld=JSON.stringify(flight.view),fresh=FlightView.reference(flight);
 assert.equal(fresh.modeKey,FlightView.geometryKey());assert.ok(Math.abs(fresh.a.x)<1e15&&Math.abs(fresh.b.x)<1e15);assert.equal(JSON.stringify(flight.view),frozenOld);assert.equal(physical(),expedition);
 flight.view=previousView;
 const ordinaryFields=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.mapOffset]));
 MapSlice.setMode('radial');ExtendedCatalog.prepareGalaxy(object('andromeda'));
 MapSlice.setMode('full');assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition,o.mapOffset])),ordinaryFields);
 // Display repair always writes ordinary reference coordinates, even in radial mode.
 MapSlice.setMode('radial');const fake={id:'generated-test',synthetic:true,parentObject:'coma',p3:object('coma').p3.map((v,i)=>v+[1,2,3][i])};ExtendedCatalog.repairLocalStar(fake);
 assert.equal(fake.mapPosition.x,MapLayout.ordinaryProject(object('coma')).x+1);
 MapSlice.setMode('full');
}`);
console.log('PASS whole-catalog runtime/build agreement; recursive frames, fixed local landmarks, undefined poles, addition stability, preserved sizes and physical flight state');
// The whole catalogue, including unparented records, must not intrude before
// the nearest 100. Compare public rendered coordinates, not just base anchors.
run(`globalThis.distanceAuditRows=[];state=initial();paused=true;state.expansion=false;Cosmology.sync(state);MapSlice.setMode('radial');`);
for(let i=0;i<source.length;i+=2000){context.batch=source.slice(i,i+2000);run(`distanceAuditRows.push(...batch.map(r=>ExtendedCatalog.decode(r)));`);}
run(`{
 const all=[...new Map([...OBJECTS,...distanceAuditRows].map(o=>[o.id,o])).values()].filter(o=>!o.atlasOnly&&!o.synthetic&&o.positionQuality!=='unknown'&&o.p3?.every(Number.isFinite));
 const lookup=new Map(all.map(o=>[o.id,o])),resolve=MapLayout.resolve;MapLayout.resolve=id=>lookup.get(id)||resolve(id);
 for(const domain of MapRadial.profile.distanceDomains){
  const host=MapRadial.resolve(domain.origin),centre=MapLayout.project(host),records=all.filter(o=>o.kind===domain.countKind&&o.id!==domain.origin).map(o=>{const p=MapLayout.project(o);return{id:o.id,r:Space.distance(o,host),m:Math.hypot(p.x-centre.x,p.y-centre.y),localFrame:MapRadial.placement(o).frame==='rigid-xy'||OrbitalMotion.isOrbiting(o)};});
  // Catalogue distance ties must not reverse because hypot/projection differ
  // in their last floating-point bit. The tolerance is below the distance
  // invariant asserted for every independent record below.
  const order=key=>(a,b)=>Math.abs(a[key]-b[key])>1e-7?a[key]-b[key]:a.id.localeCompare(b.id);
  const physical=records.slice().sort(order('r')),mapped=records.slice().sort(order('m'));
  assert.ok(physical[99].r<domain.radiusLy);
  // Published local component frames preserve XY shapes, so their individual
  // radial offsets are deliberately exempt from the exact-distance invariant.
  // Keep the full exact ordering check for independent anchors; stellar-frame
  // geometry and all newly resolved components have a separate sourced test.
  assert.deepEqual(mapped.filter(o=>!o.localFrame).slice(0,100).map(o=>o.id),physical.filter(o=>!o.localFrame).slice(0,100).map(o=>o.id),'nearest 100 independent '+domain.countKind+' anchors match physical distance order');
  if(domain.coverageCatalog){const prefix=domain.coverageCatalog.prefix,individual=physical.filter(o=>o.id.startsWith(prefix)),screen=mapped.filter(o=>o.id.startsWith(prefix));assert.ok(individual[domain.coverageCatalog.minimumCount-1].r<domain.radiusLy);assert.deepEqual(screen.slice(0,100).map(o=>o.id),individual.slice(0,100).map(o=>o.id),'single-catalogue galaxy order avoids mixed-catalogue aliases');}
  for(const o of records)if(o.r<=domain.radiusLy){if(!OrbitalMotion.isOrbiting(lookup.get(o.id))&&MapRadial.placement(lookup.get(o.id)).frame!=='rigid-xy')assert.ok(Math.abs(o.r-o.m)<1e-6,o.id+' exact distance');}else if(MapRadial.placement(lookup.get(o.id)).frame!=='rigid-xy')assert.ok(o.m>=domain.radiusLy,o.id+' outside exact sphere');
  // A newly added pole object is placed independently; it cannot enter the
  // protected radius and cannot move any previously projected record.
  const before=JSON.stringify(physical.slice(0,100).map(o=>MapLayout.project(lookup.get(o.id))));
  for(const sign of [-1,1]){const p3=host.p3.map((n,i)=>n+(i===2?sign*domain.radiusLy*3:0)),o={id:'new-pole-'+domain.id+sign,kind:domain.countKind,p3},p=MapLayout.project(o);assert.ok(Math.hypot(p.x-centre.x,p.y-centre.y)>domain.radiusLy);}
  assert.equal(JSON.stringify(physical.slice(0,100).map(o=>MapLayout.project(lookup.get(o.id)))),before);
 }
 const mw=object('sgr'),q=MapLayout.project(mw),m31=object('andromeda'),p31=MapLayout.project(m31),limit=Math.hypot(p31.x-q.x,p31.y-q.y);
 assert.equal(all.filter(o=>o.kind==='galaxy'&&Space.distance(o,mw)>Space.distance(m31,mw)+1e-6).filter(o=>{const p=MapLayout.project(o);return Math.hypot(p.x-q.x,p.y-q.y)<limit;}).length,0,'no farther galaxy appears closer than M31');
 const shape=GALAXIES.find(g=>g.id==='milkyway'),foreign=all.filter(o=>['star','pulsar'].includes(o.kind)&&(o.galaxyMember&&o.parentGalaxy&&o.parentGalaxy!=='milkyway'||Space.distance(o,mw)>1e6));
 assert.equal(foreign.filter(o=>{const p=MapLayout.project(o),x=p.x-q.x,y=p.y-q.y,u=x*Math.cos(shape.rotation)+y*Math.sin(shape.rotation),v=-x*Math.sin(shape.rotation)+y*Math.cos(shape.rotation);return(u/(shape.diameterLy/2))**2+(v/(shape.diameterLy*shape.axisRatio/2))**2<=1;}).length,0,'foreign or beyond conservative 1 million ly halo boundary cannot overlap MW; Galactic halo itself is allowed');
 // Both projections now share the same adopted 3D orbital snapshot.
 const alpha=object('alpha'),catalogue=MapLayout.project(alpha);state.earth=40;state.universeElapsed=40;assert.notDeepEqual(MapLayout.project(alpha),catalogue);
 const current=OrbitalMotion.alphaPositions3D().alpha,radial=MapLayout.project(alpha);assert.deepEqual(radial,OrbitalMotion.projectSnapshot(alpha,current));
 MapSlice.setMode('full');assert.deepEqual(MapLayout.project(alpha),MapLayout.base(current));
 MapLayout.resolve=resolve;state=initial();MapSlice.setMode('full');
}`);
console.log('PASS exact local radii and nearest-100 rendered order for all stars/galaxies, no distant intruders, M31 order, halo membership policy and shared 3D orbital snapshots across modes');
// A late radial manifest cannot switch a newer choice. Bad profiles are rejected
// and retry works; failed loads must never silently display the ordinary index.
context.radialPointer=pointer;let release;context.delayedRadial=new Promise(r=>release=r);
run(`globalThis.originalReadJSON=ExtendedCatalog.readJSON;MapRadial.manifest=null;MapRadial.layers=null;ExtendedCatalog.readJSON=p=>p==='map-radial/current.json'?delayedRadial:Promise.resolve(p.endsWith('layers.json')?radialLayers:radialManifest);MapSlice.setMode('radial');`);
const pending=run('MapRadial.loading');run(`MapSlice.setMode('full')`);release(pointer);await pending;
assert.equal(run('MapSlice.mode'),'full');assert.equal(run('MapLayers.boot===MAP_LAYER_BOOT'),true);
run(`MapRadial.manifest=null;MapRadial.layers=null;ExtendedCatalog.readJSON=()=>Promise.reject(Error('offline'));MapSlice.setMode('radial');`);await run('MapRadial.loading');
assert.equal(run('MapRadial.error'),'offline');assert.equal(run('MapLayers.waitingGeometry'),true);
run(`ExtendedCatalog.readJSON=p=>Promise.resolve(p==='map-radial/current.json'?radialPointer:p.endsWith('layers.json')?radialLayers:{...radialManifest,profileKey:'stale'});MapSlice.setMode('radial');`);await run('MapRadial.loading');assert.equal(run('MapRadial.manifest'),null);
run(`ExtendedCatalog.readJSON=p=>Promise.resolve(p==='map-radial/current.json'?radialPointer:p.endsWith('layers.json')?{...radialLayers,geometryVersion:999}:radialManifest);MapSlice.setMode('radial');`);await run('MapRadial.loading');assert.equal(run('MapRadial.manifest'),null,'incompatible structural geometry is rejected');
run(`ExtendedCatalog.readJSON=p=>Promise.resolve(p==='map-radial/current.json'?radialPointer:p.endsWith('layers.json')?radialLayers:radialManifest);MapSlice.setMode('radial');`);await run('MapRadial.loading');assert.equal(run('MapRadial.error'),null);assert.equal(run('MapLayers.boot.profileKey'),manifest.profileKey);
// Layer files have the same short names in different snapshots: delayed old
// responses must neither populate the new cache nor delete its newer promise.
let oldRelease;context.delayedOldLayer=new Promise(r=>oldRelease=r);
run(`MapLayers.setGeometry(null);ExtendedCatalog.readJSON=()=>delayedOldLayer;globalThis.oldLayer=MapLayers.load('0.json');MapLayers.setGeometry(radialLayers);assert.equal(MapLayers.inflight.size,1,'old requests retain their concurrency budget');`);
run(`ExtendedCatalog.readJSON=()=>Promise.resolve([]);globalThis.newLayer=MapLayers.load('0.json');`);await run('newLayer');oldRelease([]);await run('oldLayer');assert.equal(run('MapLayers.cache.get("0.json").length'),0);
run(`ExtendedCatalog.readJSON=originalReadJSON;MapSlice.setMode('full');`);
console.log('PASS late replies, explicit retry, incompatible profiles, isolated layer caches and mode-specific loading');
