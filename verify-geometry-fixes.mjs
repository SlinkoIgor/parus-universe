import fs from 'node:fs';import assert from 'node:assert/strict';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
const index=JSON.parse(fs.readFileSync('dist/catalog-data/search.json','utf8')),entries=new Map(index.map(r=>[r[0],r])),files=new Map();
function row(id){const e=entries.get(id);if(!e)return run('EXTENDED_BOOT.members').find(r=>r[0]===id);if(!files.has(e[5]))files.set(e[5],JSON.parse(fs.readFileSync('dist/catalog-data/'+e[5],'utf8')));return files.get(e[5]).find(r=>r[0]===id);}
const audit=JSON.parse(fs.readFileSync('data-tools/map-geometry-audit.json','utf8'));
assert.equal(audit.activeAstrometry.status,'fixed');assert.equal(audit.activeAstrometry.invalidMatchedIds.length,0);
assert.ok(audit.shells.filter(s=>s.source==='HYG').every(s=>s.radiusPreservedCount<8),'no HYG shell with eight radius-preserved points');
assert.ok(audit.clusterGroups.every(g=>g.status!=='radial-conflict-review'),'no contradictory GC distance chains');
context.hipOne=row('hyg-1');
run(`{const o=ExtendedCatalog.decode(hipOne);assert.equal(o.astrometrySource,'I/311 HIP2007');assert.equal(o.parallaxMas,4.55);assert.equal(o.parallaxErrorMas,1.33);assert.ok(Math.abs(o.distanceRelativeError-1.33/4.55)<1e-12);}`);
run(`{const a={p3:[100,0,0]},b={p3:[60,0,80]},before=JSON.stringify(b.p3);assert.equal(Math.hypot(...b.p3),100);assert.equal(Math.hypot(MapLayout.project(a).x,MapLayout.project(a).y),100);assert.equal(Math.hypot(MapLayout.project(b).x,MapLayout.project(b).y),60);assert.equal(JSON.stringify(b.p3),before);}`);
const gcAudit=JSON.parse(fs.readFileSync('data-tools/globular-host-audit.json','utf8'));
for(const association of ['NGC6517','Terzan5','NGC6522']){
 const host=gcAudit.rows.find(g=>g.association===association);assert.ok(host,association);
 const group=audit.clusterGroups.find(g=>g.host===association);assert.ok(group.radialRangeLy<1,association+' has no invented thousands-of-ly depth');
 for(const member of group.members){const r=row(member.id);assert.equal(r[11].positionEstimate.method,'bounded-compact-host');assert.equal(r[11].distanceHost,host.host);assert.ok(r[11].positionEstimate.localEnvelopeLy>0);assert.ok(r[11].positionEstimate.sharedDistanceErrorLy>0);}
}
context.mice=[row('opengc-ngc4676a'),row('opengc-ngc4676b')];
run(`{const [a,b]=mice.map(r=>ExtendedCatalog.decode(r));ExtendedCatalog.pin(a);ExtendedCatalog.pin(b);assert.equal(a.d,300e6);assert.equal(b.d,300e6);assert.ok(a.catalogDistanceLy>300e6);const d=Space.distance(a,b);assert.ok(d<200000&&d>10000);state=initial();state.cosmicTime=1e10;Cosmology.sync(state);assert.ok(Math.abs(Cosmology.physicalDistance(a,b)/d-1)<1e-6);Cosmology.time=0;}`);
context.m13=row('atnf-j1641+3627g');
run(`{const old=ExtendedCatalog.decode(m13);old.d=81539;old.p3=Space.fromSky(old.raDeg,old.decDeg,old.d);old.mapPosition={x:81539,y:0};delete old.mapGeometry;const saved={current:'sol',catalogObjects:[old],earth:1234,proper:234,totalDistance:100,ship:Space.point([100,0,0]),flight:{from:Space.point([0,0,0]),target:old.id,distance:81539,covered:100,view:{a:{x:0,y:0},b:{x:81539,y:0},referenceEpoch:true}}};ExtendedCatalog.restore(saved);const o=ExtendedCatalog.get(old.id);assert.ok(o.d>20000&&o.d<30000);assert.ok(!o.atlasOnly);assert.equal(saved.earth,1234);assert.equal(saved.proper,234);assert.equal(saved.totalDistance,100);assert.equal(saved.flight.covered,100);assert.ok(Math.abs(saved.flight.distance-o.d)<1e-7);assert.ok(!saved.flight.view);assert.equal(saved.catalogGeometry,MapLayout.version);}`);
context.galaxyRow=row(index.find(r=>r[0].startsWith('lggs-m31-')&&!r[7])[0]);
run(`{const o=ExtendedCatalog.decode(galaxyRow),host=object('andromeda'),before=MapLayout.legacy(host.p3,host.id),after=MapLayout.baseProject(host),expected={...o.mapPosition};o.id='old-local-member';o.mapPosition={x:expected.x+before.x-after.x,y:expected.y+before.y-after.y};delete o.mapGeometry;ExtendedCatalog.restore({catalogObjects:[o]});const migrated=ExtendedCatalog.get(o.id);assert.ok(Math.abs(migrated.mapPosition.x-expected.x)<1e-8);assert.ok(Math.abs(migrated.mapPosition.y-expected.y)<1e-8);}`);
run(`{showObject('atnf-j1641+3627g');assert.ok($('dialogContent').innerHTML.includes('Опорное скопление'));assert.ok($('dialogContent').innerHTML.includes('Общая погрешность дальности центра'));assert.ok(!$('dialogContent').innerHTML.includes('ошибка расстояния до галактики не задана'));}`);
run(`{const o={id:'historic-hidden-nav',p3:[30,40,50],mapPosition:{x:30,y:-40},kind:'pulsar'},saved={current:o.id};ExtendedCatalog.adopt(o,{atlasOnly:true,p3:null,navigable:false,coordinateNote:'Нет пригодного расстояния.'},saved);assert.deepEqual(o.p3,[30,40,50]);assert.ok(o.historicalNavigation);ExtendedCatalog.pin(o);state=initial();state.current=o.id;state.ship=Space.point(o.p3);assert.ok(Number.isFinite(FlightView.ship().x));const f={from:Space.point([0,0,0]),fromId:'sol',target:o.id,distance:Math.hypot(...o.p3),covered:10};assert.ok(Number.isFinite(FlightView.at(f,.5).x));const turn={catalogObjects:[],ship:Space.point([1,2,3]),phase:'flyby',flight:{from:Space.point([0,0,0]),target:'sgr',distance:100,covered:100,view:{referenceEpoch:true}}};ExtendedCatalog.restore(turn);assert.deepEqual(turn.ship.p3,[1,2,3]);assert.equal(turn.flight.distance,100);}`);
const lowz=JSON.parse(fs.readFileSync('data-tools/low-z-galaxy-distances.json','utf8'));
for(const [name,measurement] of Object.entries(lowz.objects)){
 const entry=entries.get('opengc-'+name.toLowerCase());
 if(!entry){context.ngcName=name;run(`{const o=OBJECTS.find(o=>o.ngc===ngcName);assert.ok(o);}`);continue;}
 if(measurement.status==='unresolved'){if(!entry[7]){const r=row(entry[0]);assert.ok(r[11].boundSystemPrimary&&r[11].catalogDistanceLy!=null,name+' needs an explicit documented system estimate');assert.ok(!r[11].positionReason);}}
 else{const r=row(entry[0]);assert.ok(r[11].redshiftIndependent);assert.ok(Math.abs(r[3]/(measurement.distanceMpc*1e6*3.2615637771674336)-1)<1e-10);assert.equal(r[11].distanceReference,measurement.reference);}
}
assert.equal(audit.nearbyRedshiftOnly.count,0);
console.log('PASS matching HIP2007 sigma, no forced rings, bounded GC groups, interacting-pair distance/binding and geometry/clock save migration');
