import fs from 'node:fs';
import assert from 'node:assert/strict';
import {catalogPath} from './catalog-path.mjs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\n// Milky Way cartography regression context.\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
const manifest=JSON.parse(fs.readFileSync(catalogPath('manifest.json'))),moved=[];
assert.equal(manifest.geometryVersion,run('MapLayout.version'));
// The loader must index final display coordinates, including every lifted point.
for(const n of manifest.nodes){
 const rows=JSON.parse(fs.readFileSync(catalogPath(n.file)));
 for(const r of rows){assert.ok(r[12]>=n.box[0]&&r[12]<=n.box[2]&&r[13]>=n.box[1]&&r[13]<=n.box[3],r[0]+' outside spatial node');if(!n.children.length&&r[11].mapOffset)moved.push(r);}
 for(const id of n.children){const b=manifest.nodes[id].box;assert.ok(b[0]>=n.box[0]&&b[1]>=n.box[1]&&b[2]<=n.box[2]&&b[3]<=n.box[3]);}
}
context.liftedRows=moved;
run(`{
state=initial();state.expansion=false;Cosmology.sync(state);
const moved=liftedRows.map(r=>ExtendedCatalog.decode(r)),byId=new Map(moved.map(o=>[o.id,o])),resolve=id=>object(id)||byId.get(id),c=MapLayout.center(),R=MapLayout.disk.radius;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7, a+' != '+b);
let exterior=0,interior=0;
for(const o of [...OBJECTS,...moved]){
 if(!o.p3||o.atlasOnly||o.nuclearStar)continue;
 const before=JSON.stringify(o.p3),raw=MapLayout.rawProject(o),p=MapLayout.baseProject(o),d=MapLayout.displacement(o,raw,resolve);
 close(p.x,raw.x+d.x);close(p.y,raw.y+d.y);assert.equal(JSON.stringify(o.p3),before);
 const anchor=resolve(MapLayout.anchorId(o))||o;
 if(!['structure','wall','void','ring','arc','horizon'].includes(o.kind)&&o.catalogClass!=='galaxy-cluster'&&(Math.abs(anchor.p3?.[2])>=MapLayout.disk.outerHeight||o.kind==='galaxy'&&Math.hypot(anchor.p3[0]-c.x,anchor.p3[1]+c.y,anchor.p3[2])>R)){
  assert.ok(Math.hypot(p.x-c.x,p.y-c.y)>R,o.id+' exterior object overlaps MW disk');exterior++;
 }
 if(!MapLayout.anchorId(o)&&Math.abs(o.p3[2])<=MapLayout.disk.innerHeight&&o.kind!=='galaxy'){
  close(d.x,0);close(d.y,0);interior++;
 }
}
assert.ok(exterior>500&&interior>500);
// Above/below objects may be INSIDE the 50k-ly spherical radius and still
// need to clear the projected disk. No assumption of extragalactic membership.
for(const z of [-4000,4000]){const o={id:'test-halo-'+z,kind:'cluster',p3:[c.x+10000,-c.y,z],diameterLy:200},p=MapLayout.baseProject(o);assert.ok(Math.hypot(10000,z)<R);assert.ok(Math.hypot(p.x-c.x,p.y-c.y)>R+100);assert.equal(o.p3[2],z);}
const pole={id:'pole',kind:'cluster',p3:[c.x,-c.y,5000]};assert.ok(Number.isFinite(MapLayout.baseProject(pole).y));assert.deepEqual(MapLayout.baseProject(pole),MapLayout.baseProject(pole));
// A catalogue entry describing our own central galaxy must not become an
// external satellite merely because its kind is "galaxy".
const central={id:'central-galaxy',kind:'galaxy',p3:[c.x+5000,-c.y,0]};assert.deepEqual(MapLayout.baseProject(central),MapLayout.base(central.p3));
// There is no height cutoff jump or common ring for high-Z objects.
for(const z of [1499.999,1500,2999.999,3000,40000,80000]){const a={id:'smooth',kind:'cluster',p3:[c.x+10000,-c.y,z]},b={...a,p3:[c.x+10000,-c.y,z+.001]};assert.ok(Math.hypot(MapLayout.baseProject(a).x-MapLayout.baseProject(b).x,MapLayout.baseProject(a).y-MapLayout.baseProject(b).y)<.1);}
const radii=[40000,80000,160000].map(z=>Math.hypot(MapLayout.baseProject({id:'height-'+z,kind:'cluster',p3:[c.x+10000,-c.y,z]}).x-c.x,0));assert.ok(radii[0]<radii[1]&&radii[1]<radii[2]);
// GC pulsars keep exactly the same local offsets as their measured host view.
const member=moved.find(o=>o.positionEstimate?.method==='bounded-compact-host'&&resolve(o.distanceHost)?.mapOffset);assert.ok(member);const host=resolve(member.distanceHost);assert.deepEqual(member.mapOffset,host.mapOffset);
const m=MapLayout.rawProject(member),h=MapLayout.rawProject(host),mp=MapLayout.baseProject(member),hp=MapLayout.baseProject(host);close(mp.x-hp.x,m.x-h.x);close(mp.y-hp.y,m.y-h.y);
// Camera, theme and zoom never re-layout an object.
const omega=object('omega'),p=MapLayout.project(omega),physical=JSON.stringify(omega.p3);
for(const themeName of ['dark','light'])for(const span of [100,1000,30000,130000,250000,5e9]){theme=themeName;cam={x:p.x+123,y:p.y-234,span};assert.deepEqual(MapLayout.project(omega),p);}
assert.equal(JSON.stringify(omega.p3),physical);
showObject('omega');assert.ok($('dialogContent').innerHTML.includes('На схеме'));assert.ok($('dialogContent').innerHTML.includes('не граница принадлежности'));
console.log('PASS all lifted classes, final spatial indexes, disk/halo separation inside spherical radius, continuous thresholds, no fixed height ring, shared host offsets and zoom-independent positions');
}`);

// A tiny viewport at the NEW location must load the moved structural object,
// even though its old position lies far outside that viewport.
const boot=run('MAP_LAYER_BOOT'),tiles=new Map();
for(const n of boot.nodes)if(n.file)tiles.set(n.file,JSON.parse(fs.readFileSync('dist/'+boot.dataRoot+'/'+n.file)));
context.readLayoutTile=file=>tiles.get(file);
run(`{
state=initial();state.expansion=false;Cosmology.sync(state);width=1440;height=1000;filter='stellar-cluster';MapLayers.active=true;
const row=liftedRows.find(r=>r[11].catalogClass==='stellar-cluster'),o=ExtendedCatalog.decode(row),p=MapLayout.project(o);cam={x:p.x,y:p.y,span:1000};
for(const files of MapLayers.filesForView(cam,width,height).values())for(const file of files)MapLayers.cache.set(file,readLayoutTile(file).map(r=>ExtendedCatalog.decode(r)));
MapLayers.lastUpdate=-Infinity;MapLayers.update(performance.now());assert.ok(MapLayers.visibleMap.has(o.id),'new-position structural loader');
MapLabels.begin();RegionMap.draw();drawObjects();ExtendedCatalog.draw();MapLabels.draw();assert.ok(hitObjects.some(h=>h.o.id===o.id)||RegionMap.hits.some(h=>h.o.id===o.id),'new-position glyph or footprint');
// A v2 saved local view retains its independent astrometry/uncertainty and
// host-local offset. Migrate children before parents, as old capture could do.
const member=liftedRows.map(r=>ExtendedCatalog.decode(r)).find(o=>o.positionEstimate?.method==='bounded-compact-host'),host=object(member.distanceHost)||ExtendedCatalog.decode(liftedRows.find(r=>r[0]===member.distanceHost));
function oldPoint(o){const old=JSON.parse(JSON.stringify(o));old.mapPosition=MapLayout.rawProject(o);old.mapGeometry=2;delete old.mapOffset;return old;}
const old=oldPoint(member),parent=oldPoint(host),before=JSON.stringify([old.p3,old.d,old.distanceRelativeError,old.uncertaintyMatched,old.positionEstimate]),expected=MapLayout.baseProject(member);
ExtendedCatalog.pinned.clear();ExtendedCatalog.restore({catalogGeometry:2,catalogRevision:'previous-display',catalogObjects:[old,parent]});
const fresh=object(member.id);assert.deepEqual(MapLayout.baseProject(fresh),expected);assert.equal(JSON.stringify([fresh.p3,fresh.d,fresh.distanceRelativeError,fresh.uncertaintyMatched,fresh.positionEstimate]),before);
// Old active/completed flights rebuild their SCREEN endpoints only. Clocks,
// physical coordinates, progress, distances, markers and mission stay exact.
state=initial();state.selected='omega';launch(true);const f=state.flight;assert.ok(f);f.covered=f.distance*.3;state.ship=Space.mix(f.from,object(f.target),.3);state.earth=1000;state.proper=12;
ExtendedCatalog.capture(state);const saved=JSON.parse(JSON.stringify(state));saved.catalogGeometry=2;saved.catalogRevision='previous-display';saved.flight.view={a:MapLayout.base(f.from.p3),b:MapLayout.base(object(f.target).p3),geometryVersion:2};
saved.flightHistory=[{fromId:f.fromId,target:f.target,from:f.from,end:state.ship,view:saved.flight.view,fraction:.2}];
const physics=s=>JSON.stringify({ship:s.ship,earth:s.earth,proper:s.proper,distance:s.flight.distance,covered:s.flight.covered,markers:s.flight.markers,mission:s.flight.mission});const original=physics(saved);
state=restore(saved);assert.equal(physics(state),original);assert.ok(!state.flight.view);
for(const q of [state.flight,...state.flightHistory]){const a=FlightView.at(q,0),b=FlightView.at(q,1);assert.deepEqual(b,MapLayout.baseProject(object('omega')));for(const t of [.1,.3,.7]){const p=FlightView.at(q,t);assert.ok(Math.abs(p.x-(a.x+(b.x-a.x)*t))<1e-8);assert.ok(Math.abs(p.y-(a.y+(b.y-a.y)*t))<1e-8);}}
const first=FlightView.ship();ExtendedCatalog.capture(state);state=restore(JSON.parse(JSON.stringify(state)));assert.deepEqual(FlightView.ship(),first);assert.equal(physics(state),original);
// Frozen flyby aims use the displaced target's local view, not a second lift.
const target=object('omega'),aim=Space.point(target.p3.map((v,i)=>v+(i===0?.01:0))),q={from:f.from,fromId:f.fromId,target:'omega',aim};const end=FlightView.at(q,1),p0=MapLayout.baseProject(target);assert.ok(Math.abs(end.x-p0.x-.01)<1e-7);assert.equal(end.y,p0.y);
// Generated departure stars remain local after capture/reload as well.
state=initial();const star=ExtendedCatalog.ensureGalaxy(target),offset=star.p3.map((v,i)=>v-target.p3[i]);state.current=target.id;state.selected=star.id;state.ship=Space.point(target.p3);ExtendedCatalog.capture(state);state=restore(JSON.parse(JSON.stringify(state)));const sp=MapLayout.baseProject(object(star.id)),tp=MapLayout.baseProject(target);assert.ok(Math.abs(sp.x-tp.x-offset[0])<1e-8);assert.ok(Math.abs(sp.y-tp.y+offset[1])<1e-8);
console.log('PASS moved-position loading/rendering, v2 host/uncertainty migration, unchanged active/completed flight physics, affine ship/marks, reload and local departure stars');
}`);
