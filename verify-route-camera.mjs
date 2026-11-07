import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#route-camera');
run(`{
resize();
const reset=()=>{OrbitalArrival.enabled=true;state=initial();state.expansion=false;paused=true;Simulation.debt=Simulation.wallDebt=0;FlightQueue.reset();Cosmology.sync(state);followShip=false;cameraGoal=null;};
const view=()=>JSON.stringify([cam,cameraGoal,followShip,MapSlice.mode,MapSlice.centerZ]);
const explore=(mode,following=false)=>{
 MapSlice.mode=mode;MapSlice.centerZ=12345;
 cam={x:8e10,y:-6e10,span:3e10};cameraGoal={x:7e10,y:-5e10,span:1.15e11};
 followShip=following;
 return view();
};
for(const mode of ['full','slice','radial']){
 reset();launch();paused=true;
 select('sirius');Route.add('sirius');select('vega');Route.add('vega');
 assert.equal(Route.future().length,2);
 const before=explore(mode),goal=cameraGoal;
 for(const target of ['sirius','vega']){
  Simulation.tick(FlightEstimate.get().proper*1.00001);
  assert.equal(state.flight?.target,target,'route keeps flying while browsing');
  assert.equal(view(),before,'automatic routed start preserves pan, zoom, pending animation, follow state and slice');
  assert.equal(cameraGoal,goal,'the existing zoom animation is retained');
 }
 Simulation.tick(FlightEstimate.get().proper*1.00001);assert.equal(state.current,'vega');assert.equal(view(),before);
}
// Stops in an atlas route use a different continuation path from the route.
reset();state.itinerary=[{id:'alpha',mode:'stop'},{id:'sirius',mode:'stop'}];
explore('full');MissionPlanner.startRoute();assert.ok(state.flight);assert.notEqual(cameraGoal.x,7e10,'a manual first launch still fits its route');
const stoppedView=explore('radial');Simulation.tick(FlightEstimate.get().proper*1.00001);
assert.equal(state.flight?.target,'sirius');assert.equal(view(),stoppedView,'atlas stop continuation preserves the explored view');
// Passing a black hole also launches the next leg without stealing the camera.
reset();state.current='proxima';state.ship=Space.point(object('proxima').p3);
state.flightSetup=FlightSetup.normalize({engine:true,sail:false,collector:false,arrivalFuelPercent:0});
state.itinerary=[{id:'sgr',mode:'flyby'},{id:'m87',mode:'stop'}];MissionPlanner.startRoute();assert.ok(state.flight?.mission.passage);
const flybyView=explore('slice',true);Simulation.tick(state.flight.mission.proper*1.00001);
assert.equal(state.flight?.target,'m87');assert.equal(view(),flybyView,'flyby continuation preserves explicit follow/centre mode and view');
// Older saved routes retain the same camera policy at a real stopped arrival.
reset();OrbitalArrival.enabled=false;state.flightSetup=null;state.departureMode='beam';
state.itinerary=[{id:'alpha',mode:'stop'},{id:'sirius',mode:'stop'}];Route.start();assert.ok(state.flight&&!state.flight.mission,JSON.stringify(Route.analyze()));
const legacyView=explore('full');
for(let n=0;state.flight?.target==='alpha'&&n<8;n++)Simulation.tick(FlightEstimate.get().proper*1.00001);
assert.equal(state.flight?.target,'sirius');assert.equal(view(),legacyView,'legacy stopped continuation preserves the view');
// A manual route resume and a manual new flight still deliberately fit the route.
reset();state.itinerary=[{id:'alpha',mode:'stop',setup:FlightSetup.defaults()}];explore('full');Route.start();
assert.ok(state.flight);assert.notEqual(cameraGoal.x,7e10);
reset();explore('full');launch();assert.ok(state.flight);assert.notEqual(cameraGoal.x,7e10);
console.log('PASS routed stops in every map mode, atlas stops, real black-hole passage and legacy stops preserve camera/zoom animation/follow/slice; manual launch and route resume still frame the route');
}`);
