import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const policy=JSON.parse(fs.readFileSync('data-tools/deep-sky-identities.json'));
const repeated=JSON.parse(execFileSync('python3',['-c',`
import csv,json,collections
groups=collections.defaultdict(list)
for row in csv.DictReader(open('data-tools/raw/NGC.csv'),delimiter=';'):
 if row['Type'] not in ('G','GPair','GTrpl','GGroup'):continue
 for name in row['Common names'].split(','):
  if name:groups[name.casefold()].append('opengc-'+row['Name'].lower())
print(json.dumps({k:v for k,v in groups.items() if len(v)>1}))
`],{encoding:'utf8'}));
for(const [name,ids] of Object.entries(repeated))
  assert.ok(policy.galaxySystems.some(s=>ids.every(id=>s.members.includes(id))),'unreviewed named galaxy pair: '+name);
assert.deepEqual(Object.keys(repeated).sort(),['antennae galaxies','butterfly galaxies','eyes','siamese twins']);

const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#galaxy-pairs');
run(`{
state=initial();state.expansion=false;Cosmology.sync(state);paused=true;width=1440;height=1000;
assert.deepEqual(IMPORTED_CATALOG.identityPolicy,${JSON.stringify(policy)});
const ids=['opengc-ngc4567','opengc-ngc4568'],pair=ids.map(id=>ExtendedCatalog.coreIndex.get(id));
assert.notEqual(pair[0].name,pair[1].name);
assert.ok(Space.distance(...pair)>19000&&Space.distance(...pair)<21000,'nominal centre separation follows measured sky directions');
for(const o of pair){
 const original=IMPORTED_CATALOG.objects.find(q=>q.id===o.id);
 assert.ok(Math.abs(o.d-17.4*3261563.7771674336)<1e-7);
 assert.equal(o.raDeg,original.raDeg);assert.equal(o.decDeg,original.decDeg);
 assert.equal(o.sharedDistance.errorLy,null);assert.equal(o.sharedDistance.relativeDepthLy,null,'unknown depth is not a measured zero');
 assert.ok(o.distanceMethod.includes('неизвестна'));
 const measurement=o.catalogMeasurements.find(m=>m.distanceLy===original.d);
 assert.ok(measurement);assert.equal(measurement.source,original.source);
 assert.equal(o.angularMajorArcmin,original.angularMajorArcmin);assert.equal(o.positionAngleDeg,original.positionAngleDeg);
 assert.ok(Math.abs(o.diameterLy-o.d*o.angularMajorArcmin*Math.PI/10800)<1e-8,'optical size follows adopted distance');
 assert.ok(o.aliases.includes('Butterfly Galaxies'));assert.ok(o.aliases.includes(o.ngc));
}
const measured=pair[0].catalogMeasurements.find(m=>m.data?.errorPlusMpc===1.2);
assert.equal(measured.data.distanceMpc,16.7);assert.equal(measured.data.originalUnit,'Mpc');
for(const system of CatalogIdentities.galaxySystems){
 const members=system.members.map(id=>ExtendedCatalog.coreIndex.get(id));
 for(const o of members)assert.equal(o.d,system.distanceLy||IMPORTED_CATALOG.objects.find(q=>q.id===o.id).d,'reviewed policy applies to every component');
}
for(const mode of ['full','slice','radial']){
 MapSlice.setMode(mode);MapLabels.begin();
 const positions=pair.map(o=>MapLayout.project(o));cam={x:positions[0].x,y:positions[0].y,span:150000};
 const delta=positions[1].x-positions[0].x,dy=positions[1].y-positions[0].y;
 assert.ok(Math.abs(delta-(pair[1].p3[0]-pair[0].p3[0]))<1e-7);
 assert.ok(Math.abs(dy+(pair[1].p3[1]-pair[0].p3[1]))<1e-7,'radial mode preserves the same pair geometry');
 if(mode==='radial')assert.equal(MapRadial.placement(pair[0]).warning,undefined,'pair primary is an available root anchor');
 const contours=pair.map(o=>MapGeometry.projected(o).points.map(p=>({x:p.x+MapLayout.project(o).x,y:p.y+MapLayout.project(o).y})));
 assert.ok(contours[0].some(p=>MapGeometry.contains(pair[1],p))&&contours[1].some(p=>MapGeometry.contains(pair[0],p)),'sourced optical disks overlap in '+mode);
 drawGalaxyBackground();assert.ok(pair.every(o=>MapLabels.contours.some(c=>c.id===o.id)),'both optical contours are drawn');
}
// Old core records were usually absent from saves. A historical stop/flight
// keeps its original endpoint while the public map uses the revised catalogue.
MapSlice.setMode('full');
const raw=IMPORTED_CATALOG.objects.find(o=>o.id===ids[0]),old={...raw,...Space.point(Space.fromSky(raw.raDeg,raw.decDeg,raw.d)),navigable:true,mapGeometry:MapLayout.version};
old.mapPosition=MapLayout.place(old);
for(const records of [[],[old]]){
 ExtendedCatalog.pinned.clear();state=initial();state.current=old.id;state.selected=old.id;state.ship=Space.point(old.p3);state.catalogObjects=records;
 const ship=JSON.stringify(state.ship);state=restore(JSON.parse(JSON.stringify(state)));
 assert.equal(JSON.stringify(state.ship),ship,'old parking does not teleport');assert.ok(object(old.id).historicalCoordinateNavigation);
 assert.ok(Math.abs(object(old.id).d-raw.d)<1e-7,'recovered legacy distance matches its physical endpoint');
 assert.equal(ExtendedCatalog.matchesMap(object(old.id)),false,'historical stop does not add a map galaxy');
 assert.equal(MapGeometry.resolve(pair[0]),pair[0],'historical navigation does not replace the canonical outline');
 const saved=JSON.parse(JSON.stringify(state));ExtendedCatalog.capture(saved);ExtendedCatalog.pinned.clear();state=restore(saved);
 assert.equal(JSON.stringify(state.ship),ship,'second reload preserves old parking');
}
for(const field of ['flightHistory','itinerary','nextTargets']){
 ExtendedCatalog.pinned.clear();state=initial();state[field]=field==='flightHistory'?[{fromId:old.id,target:'alpha'}]:[{id:old.id}];
 state=restore(JSON.parse(JSON.stringify(state)));assert.ok(object(old.id).historicalCoordinateNavigation,'legacy endpoint in '+field);
}
ExtendedCatalog.pinned.clear();state=initial();
const local=ExtendedCatalog.arrivalStar(old);ExtendedCatalog.pin(local);state.current=local.id;state.selected=local.id;
state.ship=Space.point(local.p3);state.catalogObjects=[old,local];
const parkedLocal=JSON.stringify(state.ship),localP3=JSON.stringify(local.p3);state=restore(JSON.parse(JSON.stringify(state)));
assert.equal(JSON.stringify(state.ship),parkedLocal,'a saved arrival star does not move with the revised galaxy');
assert.equal(JSON.stringify(object(local.id).p3),localP3);assert.ok(object(old.id).historicalCoordinateNavigation,'preserve the old host of a saved arrival star');
ExtendedCatalog.pinned.clear();state=initial();state.catalogObjects=[old];state.selected=old.id;state=restore(JSON.parse(JSON.stringify(state)));
assert.equal(object(old.id),pair[0],'browsing an old selection uses the corrected galaxy');
state=initial();ExtendedCatalog.pin({...old,historicalCoordinateNavigation:true});state.selected=old.id;launch(true);paused=true;assert.ok(state.flight);
const frozen=JSON.stringify([state.flight,state.ship,state.proper,state.earth,state.matter]);
const saved=JSON.parse(JSON.stringify(state));saved.catalogObjects=[];state=restore(saved);
assert.equal(JSON.stringify([state.flight,state.ship,state.proper,state.earth,state.matter]),frozen,'active legacy flight physics remains frozen');
ExtendedCatalog.pinned.clear();state=initial();state.current=pair[0].id;state.selected=pair[0].id;state.ship=Space.point(pair[0].p3);
const fresh=JSON.parse(JSON.stringify(state));ExtendedCatalog.capture(fresh);state=restore(fresh);
assert.equal(object(pair[0].id),pair[0],'new shared-distance saves remain authoritative');
}`);
console.log('PASS all repeated galaxy names reviewed; sourced shared pair distance, original errors, overlapping disks in every map mode, rigid radial geometry and frozen legacy navigation');
