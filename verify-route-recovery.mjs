import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run,context};';
const {run,context}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#route-recovery');
context.fetch=async path=>({ok:fs.existsSync('dist/'+path.split('?')[0]),json:async()=>JSON.parse(fs.readFileSync('dist/'+path.split('?')[0],'utf8'))});
context.arrivalIndex=JSON.parse(fs.readFileSync('dist/arrival-stars-index.json'));
run(`
ArrivalStars.index=arrivalIndex;
const resetRecovery=()=>{state=initial();state.expansion=false;state.current='proxima';state.ship=Space.point(object('proxima').p3);state.flightSetup=FlightSetup.normalize({engine:true,sail:false,arrivalFuelPercent:0});paused=true;Simulation.debt=Simulation.wallDebt=0;Simulation.wallQueue=[];FlightQueue.reset();Cosmology.sync(state);};
const recoveryPhysics=()=>JSON.stringify([state.ship,state.beta,state.matter,state.proper,state.earth,state.totalDistance,state.captured,state.spentEnergy,state.heatRadiated]);
`);
await run(`ArrivalStars.prepare(object('bode'))`);
run(`{
resetRecovery();
const unknown=BlackHoleCatalog.objects.filter(o=>o.navigable&&!Gravity.canFlyby(o));
assert.ok(unknown.length>2);
// Missing/ambiguous catalogue masses and unconfirmed candidates are not lost
// import fields. They must remain unknown, with an explicit unavailable plan.
for(const target of unknown){
 const raw=BLACK_HOLE_CATALOG_DATA.objects.find(q=>q.id===target.id);
 assert.ok(!(raw.massSolar>0&&raw.confirmed),target.id+' source does not certify a point mass');
 assert.equal(target.gravity,null);
 const p=MissionPlanner.passage(FlightSetup.read(),object('proxima'),target,object('bode'),1,state.ship,0,false);
 assert.equal(p.valid,false);assert.ok(p.reason.includes('массе'),target.id+': '+p.reason);
}
assert.ok(Gravity.passageIssue(object('barnard'),object('bode')).includes('только у чёрной дыры'));
for(const next of [undefined,OBJECTS.find(o=>!o.navigable),object('sgr')]){
 const p=MissionPlanner.passage(FlightSetup.read(),object('proxima'),object('sgr'),next,1,state.ship,0,false);
 assert.equal(p.valid,false);assert.ok(p.reason.length>0);
}
console.log('PASS all '+unknown.length+' located black holes without a certified mass retain source uncertainty; non-black-hole, missing, unlocated and duplicate outgoing points return explicit errors');
globalThis.recoveryCases=[unknown[0].id,unknown[1].id,'barnard','bh-andromeda'];
}`);
run(`{
for(const id of recoveryCases){
 resetRecovery();state.itinerary=[{id:'sgr',mode:'flyby'},{id:'bode',mode:'stop'}];Route.start();
 const f=state.flight;assert.ok(f.mission.passage);const rollback=JSON.stringify(f.rollback);
 // Match the screenshot's fifth of six legs; prior nodes do not affect the
 // frozen active geodesic. Appended future nodes are editable during flight.
 f.route.unshift(...['barnard','alpha','ross','proxima'].map(id=>({id,mode:'stop'})));f.legIndex=4;
 f.route[5]={id,mode:'flyby'};state.selected='sgr';
 let attempts=0;const continueRoute=MissionPlanner.continueRoute;MissionPlanner.continueRoute=function(...args){attempts++;return continueRoute.apply(this,args);};
 Simulation.tick(f.mission.proper*1.00001);MissionPlanner.continueRoute=continueRoute;
 assert.equal(attempts,1,'no 256 retries at a zero-time completed passage');
 assert.equal(state.flight,f);assert.equal(state.phase,'flyby');assert.ok(Route.passageComplete());assert.ok(f.routeIssue?.reason);assert.equal(paused,true);
 assert.equal(Simulation.debt,0);assert.ok(state.beta>0);assert.equal(state.current,null);
 assert.equal(JSON.stringify(f.rollback),rollback);
 const physical=recoveryPhysics(),history=JSON.stringify(state.flightHistory),journal=JSON.stringify(state.journal);
 for(let i=0;i<20;i++){Simulation.tick(1e8);Simulation.advance(1000);}
 assert.equal(recoveryPhysics(),physical);assert.equal(JSON.stringify(state.flightHistory),history);assert.equal(JSON.stringify(state.journal),journal);assert.equal(Simulation.debt,0);
 renderUI();assert.equal($('repairRoute').hidden,false);assert.equal($('phaseTag').textContent,'МАРШРУТ ПРИОСТАНОВЛЕН');assert.ok($('routeDraftIssue').textContent.includes(f.routeIssue.reason));assert.ok($('routeDraftIssue').textContent.includes(object(id).name));
 Route.show();assert.ok($('dialogContent').innerHTML.includes('resumeRoute'));assert.ok($('dialogContent').innerHTML.includes('Маршрут приостановлен'));
 ExtendedCatalog.capture(state);const saved=JSON.parse(JSON.stringify(state));state=restore(saved);assert.equal(recoveryPhysics(),physical);assert.deepEqual(state.flight.routeIssue,saved.flight.routeIssue);assert.equal(JSON.stringify(state.flight.mission),JSON.stringify(saved.flight.mission));
 // A failed explicit retry is still inert; no history, time or fuel replay.
 Route.resume();if(id!=='barnard')assert.ok(state.flight.routeIssue);
 if(state.flight.target==='sgr'){
  assert.equal(recoveryPhysics(),physical);state.flight.route[5]={id:'bode',mode:'stop'};
  Route.changed();assert.equal(recoveryPhysics(),physical);$('resumeRoute').onclick();
 }
 const finalId=id==='barnard'?'barnard':'bode';
 assert.equal(state.flight.target,finalId);assert.equal(state.flight.legIndex,5);assert.equal(paused,false);assert.equal($('infoDialog').open,false);
 assert.equal(JSON.stringify(state.flight.rollback),rollback);assert.ok(state.beta>0);assert.equal(state.flight.routeIssue,undefined);assert.equal($('repairRoute').hidden,true);
 Simulation.tick(FlightEstimate.get().proper*1.00001);assert.equal(state.flight,null);assert.ok(state.visited.includes(finalId));
}
console.log('PASS fifth/sixth-leg failures for two catalogue black holes, a stale non-black-hole mode and a final passage without an outgoing point: pause once, exact physical reload, edit/retry, preserved rollback and real final arrival');
}`);
run(`{
// An old save has no error marker: its first step must recover the same way.
resetRecovery();state.itinerary=[{id:'sgr',mode:'flyby'},{id:'bode',mode:'stop'}];Route.start();
state.flight.route[1]={id:recoveryCases[0],mode:'flyby'};
Simulation.tick(state.flight.mission.proper*1.00001);delete state.flight.routeIssue;
ExtendedCatalog.capture(state);state=restore(JSON.parse(JSON.stringify(state)));paused=false;
const oldStuck=JSON.parse(JSON.stringify(state));
for(const savedPaused of [true,false]){state=restore(oldStuck);paused=savedPaused;const before=recoveryPhysics();Route.recoverCompleted();assert.ok(state.flight.routeIssue);assert.equal(paused,true);assert.equal(recoveryPhysics(),before);}
const physical=recoveryPhysics();Simulation.tick(1);assert.ok(state.flight.routeIssue);assert.equal(recoveryPhysics(),physical);
state.flight.route[1].mode='stop';assert.equal(recoveryPhysics(),physical);Route.resume();assert.notEqual(state.flight.target,'sgr');assert.ok(state.beta>0);
console.log('PASS pre-fix completed save recovers without replay; changing the next approach to a physical stop preserves the actual outbound trajectory and nonzero velocity');
state=restore(oldStuck);state.flight.route[1].mode='stop';paused=true;const pausedPhysical=recoveryPhysics();Route.recoverCompleted();assert.notEqual(state.flight.target,'sgr');assert.equal(paused,true);assert.equal(recoveryPhysics(),pausedPhysical);
console.log('PASS load-time recovery works for running and paused old saves, and a valid continuation retains the saved pause preference');
// The real-time frame loop also yields at the failed transition and discards
// time after the pause event, rather than saving a growing replay backlog.
resetRecovery();state.itinerary=[{id:'sgr',mode:'flyby'},{id:'bode',mode:'stop'}];Route.start();state.flight.route[1]={id:recoveryCases[0],mode:'flyby'};
Simulation.tick(state.flight.mission.proper*.999);speed=10000;paused=false;Simulation.advance(1);
assert.ok(state.flight.routeIssue);assert.equal(Simulation.debt,0);assert.equal(Simulation.wallDebt,0);assert.equal(Simulation.wallQueue.length,0);
const realTimePhysical=recoveryPhysics();paused=false;Simulation.advance(10000);assert.equal(recoveryPhysics(),realTimePhysical);
console.log('PASS actual frame loop pauses cleanly at an invalid continuation, with no pending time, repeated integrations or drift');
resetRecovery();
const straightTarget={id:'recovery-straight',name:'Прямая следующая точка',kind:'structure',navigable:true,...Space.point(V3.add(object('sgr').p3,V3.sub(object('sgr').p3,state.ship.p3)))};ExtendedCatalog.pin(straightTarget);
state.itinerary=[{id:'sgr',mode:'flyby'},{id:straightTarget.id,mode:'stop'}];Route.start();assert.ok(state.flight.encounter.straight);
state.flight.route[1].mode='flyby';Simulation.tick(state.flight.mission.proper*1.00001);assert.ok(state.flight.routeIssue);assert.ok(Route.passageComplete());
const straightPhysical=recoveryPhysics();state.flight.route[1].mode='stop';Route.resume();assert.ok(!state.flight.routeIssue);assert.notEqual(state.flight.target,'sgr');assert.equal(recoveryPhysics(),straightPhysical);
console.log('PASS a straight black-hole passage without a curved encounter also remains editable and resumable after a failed continuation');
resetRecovery();
const relativisticNext=object(recoveryCases[0]),nodes=[{id:'sgr',mode:'flyby'},{id:relativisticNext.id,mode:'flyby'}],coasting=FlightSetup.normalize({engine:false,sail:false,arrivalFuelPercent:0});
const relativistic=MissionPlanner.passage(coasting,null,object('sgr'),relativisticNext,1,state.ship,0,false,.9999998);assert.ok(relativistic.valid,relativistic.reason);
MissionPlanner.launch(relativistic,{nodes,index:0});Simulation.tick(relativistic.proper*1.00001);assert.ok(state.flight.routeIssue);assert.ok(state.beta>.999999);
const relativisticPhysical=recoveryPhysics();ExtendedCatalog.capture(state);state=restore(JSON.parse(JSON.stringify(state)));assert.equal(recoveryPhysics(),relativisticPhysical);
state.flight.route[1].mode='stop';Route.resume();assert.ok(!state.flight.routeIssue);assert.equal(recoveryPhysics(),relativisticPhysical);
const finalRelativistic=state.flight;Simulation.tick(FlightEstimate.get().proper*1.00001);assert.equal(state.flight,null);assert.ok(state.visited.includes(relativisticNext.id),JSON.stringify({current:state.current,phase:state.phase,visited:state.visited,covered:finalRelativistic.covered,distance:finalRelativistic.distance,target:finalRelativistic.target,requested:finalRelativistic.requestedTarget,arrivalStar:finalRelativistic.arrivalStar?.id}));
console.log('PASS near-light-speed passage failure, reload and physical stopped continuation preserve both relativistic clocks and reach the original outbound target');
}`);
run(`{
resetRecovery();state.itinerary=[{id:'sgr',mode:'flyby'},{id:'bode',mode:'stop'}];Route.start();state.flight.route[1].mode='flyby';
Simulation.tick(state.flight.mission.proper*1.00001);state.flight.route[1].mode='stop';delete state.flight.routeIssue;paused=true;
ArrivalStars.index=null;ArrivalStars.loading=null;ArrivalStars.results.clear();ArrivalStars.pending.clear();ArrivalStars.resolved.clear();
globalThis.coldRecoveryPhysics=recoveryPhysics();Route.recoverCompleted();assert.equal(state.flight.target,'sgr');assert.ok(MissionPlanner.routeWaits.has(state.flight));assert.equal(paused,true);
}`);
await run('Promise.all([...ArrivalStars.pending.values()])');
run(`{
assert.equal(state.flight.target,'bode');assert.equal(paused,true);assert.equal(recoveryPhysics(),coldRecoveryPhysics);
console.log('PASS load-time continuation after asynchronous catalogue loading preserves the saved pause, exact instantaneous physics and original outbound point');
}`);
