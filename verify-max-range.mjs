import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`{
OrbitalArrival.enabled=true;
const resetRange=(id,epoch,setup=null,expansion=true)=>{state=initial();state.current=id;state.ship=Space.point(object(id).p3);state.selected='boss-wall';state.flightSetup=setup&&FlightSetup.normalize(setup);state.cosmicTime=epoch;state.expansion=expansion;Cosmology.sync(state);paused=false;Simulation.debt=0;Simulation.wallDebt=0;};
const cases=[['sol',0,null],['alpha',0,{sail:true,collector:true,burst:true}],['boss-wall',0,{engine:true}],['sol',0,{engine:true,brakeSail:false}],['boss-wall',14e9,{engine:true}],['sol',30e9,null]];
for(const [id,epoch,setup] of cases){
 resetRange(id,epoch,setup);const r=MissionReach.idle();assert.ok(r.comoving>0);assert.ok(r.upper>=r.comoving);assert.ok((r.upper-r.comoving)/r.upper<1.1e-4);assert.ok(r.comoving<Cosmology.horizon());
 const c=FlightSetup.read(),target=d=>({id:'certified-probe',rangeProbe:true,kind:'structure',navigable:true,p3:V3.add(state.ship.p3,[d,0,0])});
 const p=MissionPlanner.plan(c,object(id),target(r.comoving),state.matter*1000,state.ship,r.epoch,true);assert.ok(p.valid,p.reason);assert.ok(Number.isFinite(p.proper)&&p.arrivalFuelKg>=0);assert.ok(Math.abs(p.accelerationEnd.comoving+p.coast.distance+p.brake.comoving-r.comoving)<Math.max(1e-8,r.comoving*2e-9));
 state.selected='proxima';assert.equal(MissionReach.idle(),r,'selection must not change range');state.selected='mom-z14';assert.equal(MissionReach.idle(),r);
 assert.equal(MissionPlanner.plan(c,object(id),target(Cosmology.horizon()*1.0001)).valid,false);
 const waypoint={...target(r.comoving),name:'Проверка максимальной дальности',d:r.comoving,mapPosition:MapLayout.base(target(r.comoving).p3),mapGeometry:MapLayout.version};ExtendedCatalog.pin(waypoint);state.selected=waypoint.id;
 MissionPlanner.launch(p);const beforeClock={earth:state.earth,proper:state.proper};Simulation.tick(p.proper*.41);assert.ok(state.flight&&state.flight.covered>0&&state.flight.covered<state.flight.distance);state=restore(JSON.parse(JSON.stringify(state)));for(let pass=0;state.flight&&pass<4;pass++){const remaining=FlightEstimate.get().proper;assert.ok(remaining>0&&Number.isFinite(remaining),'remaining stage time must survive total-clock rounding');Simulation.tick(remaining);}assert.equal(state.flight,null);assert.equal(state.current,waypoint.id);assert.ok(Math.abs(state.earth-beforeClock.earth-p.earth)<p.earth*2e-10);assert.ok(Math.abs(state.proper-beforeClock.proper-p.proper)<p.proper*2e-10);assert.ok(Math.abs(state.matter*1000-p.arrivalFuelKg)<1e-7);
 console.log('PASS executed maximum-range flight, reload, exact fuel/clocks, independent selection and outside-horizon rejection:',id,epoch,Math.round(r.comoving));
}
resetRange('boss-wall',0,{engine:true});state.matter=0;assert.equal(MissionReach.idle().comoving,0);state.matter=.000001;assert.ok(MissionReach.idle().comoving>0);
resetRange('boss-wall',0,{engine:true,brakeEngine:false});assert.equal(MissionReach.idle().comoving,0);
resetRange('alpha',0,{sail:true,collector:true,burst:true,arrivalFuelPercent:50});const first=MissionReach.idle();
// At trillion-year ETAs a final burn can be smaller than one total-clock ULP.
// Advance that real, separately timed stage too, rather than demand rounding up.
const fly=()=>{const p=MissionPlanner.preview();assert.ok(p.valid,p.reason);MissionPlanner.launch();assert.ok(state.flight);const exact=state.flight.mission,from={earth:state.earth,proper:state.proper};Simulation.tick(exact.proper*.37);assert.ok(state.flight&&state.flight.covered>0);state=restore(JSON.parse(JSON.stringify(state)));for(let rest=0;state.flight&&rest<4;rest++)Simulation.tick(FlightEstimate.get().proper);assert.equal(state.flight,null);assert.ok(Math.abs(state.earth-from.earth-exact.earth)<Math.max(.001,exact.earth*1e-10,4*Number.EPSILON*Math.abs(state.earth)));assert.ok(Math.abs(state.proper-from.proper-exact.proper)<Math.max(1e-6,exact.proper*1e-10,4*Number.EPSILON*Math.abs(state.proper)));assert.ok(Math.abs(state.matter*1000-exact.arrivalFuelKg)<1e-7);return exact;};
fly();assert.equal(state.current,'boss-wall');assert.ok(MissionReach.idle().comoving<first.comoving);findDepartureStar();fly();assert.ok(state.current.startsWith('game-star:boss-wall:'));state.selected='alpha';fly();assert.equal(state.current,'alpha');
const later=MissionReach.idle();assert.ok(later!==first&&later.comoving<first.comoving);state.selected='boss-wall';assert.ok(Space.distance(state.ship,object('boss-wall'))>Cosmology.horizon());assert.equal(MissionPlanner.preview().valid,false);
console.log('PASS BOSS outward → synthetic star → return, reload and exact fuel/clocks; late-universe horizon correctly rejects another BOSS trip');
// Repeated trips remain possible with a frozen expansion factor. No reservoir,
// source mode or preview may remain stuck on the previous leg after arrival.
resetRange('alpha',0,{sail:true,collector:true,arrivalFuelPercent:50},false);
for(let i=0;i<2;i++){state.selected='boss-wall';fly();findDepartureStar();fly();state.selected='alpha';fly();assert.equal(state.current,'alpha');assert.ok(FlightSetup.read().sail&&FlightSetup.read().collector&&!FlightSetup.read().burst);assert.equal(shipReachability(),null);assert.equal(state.cosmicTime,0);}
console.log('PASS two complete BOSS round trips with frozen expansion, retained optics/50% preference, real motion and no stale range');
// BOSS has significant depth: a sphere projects to a disk, not a 2D distance test.
const boss=object('boss-wall');assert.ok(Math.hypot(boss.p3[0],boss.p3[1])<Math.hypot(...boss.p3));
resetRange('alpha',0,{sail:true,collector:true,burst:true});state.selected='boss-wall';const outbound=MissionPlanner.preview();MissionPlanner.launch();Simulation.tick(outbound.proper*.2);const q=shipReachability();assert.ok(q.active);assert.ok(q.witness&&q.comoving>0&&q.comoving<Cosmology.horizon());assert.ok(q.witness.arrivalFuelKg+1e-8>=q.setup.capacityKg*(q.setup.arrivalFuelPercent||0)/100);assert.ok($('reachReadout').title.includes('Проекция'));
console.log('PASS 3D projection caveat and configured reserve and braking envelope while a flight is active');
resetRange('boss-wall',0,{sail:true,collector:true,burst:true,arrivalFuelPercent:50});state.selected='alpha';const failed=MissionPlanner.preview();assert.equal(failed.valid,false);assert.ok(failed.rangeBlocked);FlightBuilder.open();assert.equal($('launchConfigured').disabled,true);$('flightBuilder').close();console.log('PASS impossible long engine transfer is rejected before orbital shooting; no incomplete brake, false arrival or builder crash');
}`);
