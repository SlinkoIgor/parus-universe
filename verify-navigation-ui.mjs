import fs from 'node:fs';import assert from 'node:assert/strict';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`
// Exercise the pre-orbital/save-compatible branch; verify-orbits covers new captures.
OrbitalArrival.enabled=false;
resize();state=initial();Cosmology.sync(state);cam={x:0,y:0,span:24};followShip=false;shipFocusArmed=false;
focusShip();const centreIcon=$('shipBtn').innerHTML;focusShip();assert.equal(followShip,true);assert.notEqual($('shipBtn').innerHTML,centreIcon);
zoomAtPointer({preventDefault(){},deltaY:100,clientX:120,clientY:150});assert.equal(followShip,true);assert.ok(cam.span>24);
let p=screen(state.ship);assert.ok(Math.abs(p.x-width/2)<1e-8&&Math.abs(p.y-height/2)<1e-8);
zoomAtPointer({preventDefault(){},deltaY:-100,clientX:800,clientY:500});assert.equal(followShip,true);assert.ok(Math.abs(cam.span-24)<1e-10);
// Galactic/intergalactic endpoints must be clipped to finite viewport pixels at stellar zoom.
state=initial();state.selected='mom-z14';launch(true);tickPhysics(state.flight.engine.burnProper);assert.equal(state.phase,'cruise');
for(const fraction of [0,.1,.5,.99])for(const span of [.00006,24,130000]){
 const f=state.flight;f.covered=f.distance*fraction;state.ship=Space.mix(f.from,object(f.target),fraction);cam=shipCamera(span);
 const segment=routeScreenSegment(f.from,object(f.target));assert.ok(segment);const {a,b}=segment;
 for(const q of [a,b])assert.ok(Number.isFinite(q.x)&&Number.isFinite(q.y)&&q.x>=-2.01&&q.x<=width+2.01&&q.y>=-2.01&&q.y<=height+2.01);
 assert.ok(Math.hypot(b.x-a.x,b.y-a.y)>100,'visible trajectory spans viewport');
}
// Full launch and coast cannot arrive beyond the cosmological photon horizon.
function reset(){state=initial();paused=false;Simulation.debt=0;Simulation.wallDebt=0;Cosmology.sync(state);FlightEstimate.active=new WeakMap();FlightEstimate.idleKey=null;}
reset();assert.ok(Cosmology.horizon()>16e9&&Cosmology.horizon()<17e9);assert.ok(Cosmology.horizon(1e10)<Cosmology.horizon());
state.selected='mom-z14';assert.ok(FlightEstimate.get().unreachable);launch(true);assert.ok(FlightEstimate.get().unreachable);renderUI();assert.equal($('horizonNotice').hidden,false);tickPhysics(state.flight.engine.burnProper);tickPhysics(1e12);assert.ok(state.flight);assert.notEqual(state.current,'mom-z14');assert.ok(state.flight.covered<17e9);assert.ok(FlightEstimate.get().unreachable);
reset();state.selected='mom-z14';state.expansion=false;Cosmology.sync(state);assert.ok(Number.isFinite(FlightEstimate.get().proper));launch(true);tickPhysics(state.flight.engine.burnProper);tickPhysics(1e12);assert.equal(state.current,'mom-z14');
reset();state.selected='3c273';assert.ok(Number.isFinite(FlightEstimate.get().proper),'3C273 is inside the travel horizon');
`);
const audit=JSON.parse(fs.readFileSync('data-tools/pulsar-distance-audit.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('dist/catalog-data/manifest.json','utf8'));
const search=JSON.parse(fs.readFileSync('dist/catalog-data/search.json','utf8'));
const byId=new Map(search.map(r=>[r[0],r]));
assert.equal(audit.rows.length,4503);assert.ok(audit.rows.filter(r=>r.atlasOnly).length>500);
for(const row of audit.rows.filter(r=>r.atlasOnly)){const r=byId.get(row.id);if(r)assert.ok(r[7],row.id+' atlas flag');}
const m13=byId.get('atnf-j1641+3627g');assert.ok(!m13[7]);assert.ok(m13[3]<30000&&m13[3]>20000);
run(`const old=ExtendedCatalog.decode(EXTENDED_BOOT.pulsarCorrections.find(r=>r[0]==='atnf-j1641+3627g'));old.d=81539;old.mapPosition={x:81539,y:0};ExtendedCatalog.restore({catalogObjects:[old]});assert.ok(ExtendedCatalog.get(old.id).d<30000,'saved model-boundary coordinates are refreshed');`);
for(const node of manifest.nodes){const rows=JSON.parse(fs.readFileSync('dist/catalog-data/'+node.file,'utf8'));for(const r of rows){assert.ok(!r[11].atlasOnly);if(r[10]==='ATNF'&&r[11].distanceModelKpc>=25)assert.ok(r[7].includes('DIST_A')||r[7].includes('параллакс')||r[11].distanceHost,'no capped model on map: '+r[0]);}}
console.log('PASS follow survives wheel zoom, distinct icons, clipped stellar-scale trajectories, full expanding/static flights, model boundaries and cluster pulsars');
