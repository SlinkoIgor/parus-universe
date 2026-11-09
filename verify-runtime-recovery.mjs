import fs from 'node:fs';
let harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0];
harness=harness.replace('requestAnimationFrame(){}','requestAnimationFrame(fn){context.raf.push(fn);}')
  .replace('vm.runInContext([','context.raf=[];\nvm.runInContext([');
const {run,context}=await import('data:text/javascript,'+encodeURIComponent(harness+'\nexport {run,context};')+'#runtime-recovery');
context.raf.length=0;

run(`{
state=initial();state.expansion=false;paused=true;Route.cancelFeedback();Cosmology.sync(state);
for(const name of ['stream','map','ui']){
 const original=name==='stream'?MapLayers.update:name==='map'?drawObjects:renderUI;
 const fail=()=>{throw Error('transient '+name);};
 if(name==='stream')MapLayers.update=fail;else if(name==='map')drawObjects=fail;else renderUI=fail;
 assert.throws(()=>frame(lastFrame+2000),new RegExp('transient '+name));
 if(name==='stream')MapLayers.update=original;else if(name==='map')drawObjects=original;else renderUI=original;
 assert.equal(MapDetails.frameObjects,null,'failed drawing releases all frame-local catalogue caches');
}
console.log('PASS streaming, drawing and UI exceptions retain the next frame and release drawing caches');
}`);
if(context.raf.length!==3)throw Error('Every failed frame must have scheduled its successor');
const next=context.raf.shift();
next(run('lastFrame+2000'));
if(context.raf.length!==3)throw Error('Recovered frame must keep one successor');
context.raf.length=0;

run(`{
state=initial();state.expansion=false;state.selected='sirius';FlightQueue.reset();MissionPlanner.launch();
const original=Simulation.step,flight=state.flight,physical=JSON.stringify([state.ship,state.matter,state.proper,state.earth]);
let calls=0;
try{
 Simulation.step=()=>{calls++;throw Error('physical integration failure');};
 assert.throws(()=>frame(lastFrame+1000),/physical integration failure/);
 assert.equal(paused,true);assert.equal(Simulation.wallDebt,0);assert.equal(Simulation.wallQueue.length,0);assert.equal(Simulation.debt,0);
 assert.equal(JSON.stringify([state.ship,state.matter,state.proper,state.earth]),physical);
 frame(lastFrame+1000);assert.equal(calls,1,'failed physics is not replayed automatically');
 assert.equal(state.flight,flight);assert.ok(!$('cancelFlight').disabled);
 Simulation.step=()=>{calls++;return 0;};calls=0;paused=false;
 assert.throws(()=>frame(lastFrame+1000),/Flight made no progress/);
 assert.equal(calls,16,'zero-time transitions cannot spin through every slice');assert.equal(paused,true);assert.equal(Simulation.wallDebt,0);assert.equal(Simulation.debt,0);
 frame(lastFrame+1000);assert.equal(calls,16);
 // Event handlers use the same guard as the animation loop.
 paused=false;lastFrame=performance.now()-1000;Simulation.step=()=>{throw Error('event integration failure');};
 assert.throws(()=>syncClock(),/event integration failure/);assert.equal(paused,true);
}finally{Simulation.step=original;}
FlightHistory.cancel();assert.equal(state.flight,null);assert.equal(state.current,'sol');
assert.equal(state.proper,0);assert.equal(state.earth,0);assert.equal(state.matter,Rocket.initialFuel);
console.log('PASS physical exceptions and zero-time stalls pause once, clear replay debt, keep controls and allow exact flight rollback');
}`);

context.fetch=async path=>({ok:fs.existsSync('dist/'+path.split('?')[0]),json:async()=>JSON.parse(fs.readFileSync('dist/'+path.split('?')[0],'utf8'))});
context.arrivalIndex=JSON.parse(fs.readFileSync('dist/arrival-stars-index.json','utf8'));
run(`
globalThis.resetArrival=()=>{ArrivalStars.index=null;ArrivalStars.loading=null;ArrivalStars.error='';ArrivalStars.failedAt=-Infinity;ArrivalStars.results.clear();ArrivalStars.pending.clear();};
state=initial();state.expansion=false;state.current='proxima';state.ship=Space.point(object('proxima').p3);
state.flightSetup=FlightSetup.normalize({engine:true,sail:false,arrivalFuelPercent:0});
paused=true;Simulation.clearClock();FlightQueue.reset();Cosmology.sync(state);
const nodes=[{id:'sgr',mode:'flyby'},{id:'bode',mode:'stop'}];
const passage=MissionPlanner.passage(FlightSetup.read(),object('proxima'),object('sgr'),object('bode'),1,state.ship,0,false);
assert.ok(passage.valid,passage.reason);MissionPlanner.launch(passage,{nodes,index:0});
globalThis.coldPassage=JSON.parse(JSON.stringify(state));
globalThis.restorePassage=()=>{state=restore(coldPassage);paused=false;Simulation.clearClock();resetArrival();Cosmology.sync(state);};
globalThis.physical=()=>JSON.stringify([state.ship,state.beta,state.matter,state.proper,state.earth,state.totalDistance,state.captured,state.spentEnergy,state.heatRadiated]);
`);

const fetchFiles=context.fetch;
context.fetch=async()=>{throw Error('offline arrival catalogue');};
run(`{
restorePassage();Simulation.tick(state.flight.mission.proper*1.00001);
assert.equal(paused,true);assert.ok(state.flight.routeIssue);assert.ok(MissionPlanner.routeWaits.has(state.flight));
assert.equal(Simulation.debt,0);assert.equal(Simulation.wallDebt,0);
globalThis.heldPhysical=physical();globalThis.heldHistory=JSON.stringify(state.flightHistory);
let calls=0;const next=MissionPlanner.continueRoute;MissionPlanner.continueRoute=function(...args){calls++;return next.apply(this,args);};
try{for(let i=0;i<20;i++){Simulation.advance(1000);Simulation.tick(1e8);}}finally{MissionPlanner.continueRoute=next;}
assert.equal(calls,0,'waiting performs no further route calculations');assert.equal(physical(),heldPhysical);
}`);
await run('Promise.all([...ArrivalStars.pending.values()])');
run(`{
assert.ok(state.flight.routeIssue.reason.includes('offline arrival catalogue'));assert.equal(paused,true);
assert.ok(!MissionPlanner.routeWaits.has(state.flight));assert.equal(Simulation.debt,0);assert.equal(physical(),heldPhysical);
assert.equal(JSON.stringify(state.flightHistory),heldHistory);assert.equal($('repairRoute').hidden,false);
ExtendedCatalog.capture(state);state=restore(JSON.parse(JSON.stringify(state)));
assert.equal(physical(),heldPhysical);assert.ok(state.flight.routeIssue.reason.includes('offline arrival catalogue'));
console.log('PASS a failed catalogue request pauses the completed passage once, preserves exact physics/history/reload and exposes route recovery');
}`);
context.fetch=fetchFiles;
run('Route.resume()');
await run('Promise.all([...ArrivalStars.pending.values()])');
run(`{
assert.equal(state.flight.requestedTarget||state.flight.target,'bode');assert.equal(state.flight.legIndex,1);assert.equal(state.flight.routeIssue,undefined);assert.equal(paused,false);
assert.equal(physical(),heldPhysical,'retry continues from the exact outbound position and velocity');
Simulation.tick(FlightEstimate.get().proper*1.00001);assert.equal(state.flight,null);assert.ok(state.visited.includes('bode'));
console.log('PASS immediate explicit retry bypasses background cooldown, resumes the original next leg and really arrives');
}`);

// Hold the response open, then finish it. This covers both a slow successful
// connection and a route cancelled while its catalogue request is outstanding.
for(const variant of ['success','cancel','ui-error']){
 let deliver;
 context.fetch=()=>new Promise(resolve=>{deliver=resolve;});
 run('restorePassage();');
 if(variant==='ui-error')run(`{
  const ui=renderUI;renderUI=()=>{renderUI=ui;throw Error('interrupted wait card');};
  assert.throws(()=>Simulation.tick(state.flight.mission.proper*1.00001),/interrupted wait card/);
 }`);
 else run('Simulation.tick(state.flight.mission.proper*1.00001);');
 run('globalThis.waitPhysical=physical();');
 if(variant==='cancel')run('FlightHistory.cancel();globalThis.cancelledPhysics=physical();');
 deliver({ok:true,json:async()=>context.arrivalIndex});
 await run('Promise.all([...ArrivalStars.pending.values()])');
 run(variant==='cancel'?`assert.equal(state.flight,null);assert.equal(state.current,'proxima');assert.equal(physical(),cancelledPhysics);`:
   `assert.equal(state.flight.legIndex,1);assert.equal(paused,false);assert.equal(physical(),waitPhysical);`);
}
console.log('PASS delayed success and an interrupted wait card recover automatically; a stale response cannot restart a cancelled expedition');

// Use the browser AbortSignal contract without waiting fifteen real seconds.
let captured,timeoutSignal;
context.AbortSignal={timeout(ms){if(ms!==15000)throw Error('Unexpected request deadline');timeoutSignal=AbortSignal.timeout(1);return timeoutSignal;},any:AbortSignal.any.bind(AbortSignal)};
context.fetch=(path,options)=>{
 captured=options.signal;
 return new Promise((resolve,reject)=>{
  if(captured.aborted)reject(captured.reason);
  else captured.addEventListener('abort',()=>reject(captured.reason),{once:true});
 });
};
// Node's native timeout signal does not keep the process alive by itself.
const keepAlive=setTimeout(()=>{},1000);
try{
 await run(`ExtendedCatalog.readJSON('arrival-stars-index.json').then(()=>{throw Error('Expected timeout');},e=>{assert.ok(e.message.includes('Не удалось дождаться загрузки'));})`);
 if(captured!==timeoutSignal)throw Error('A request must receive its deadline signal');
 const cancelled=new AbortController();cancelled.abort();context.cancelledSignal=cancelled.signal;
 await run(`ExtendedCatalog.readJSON('catalog-data/cancelled.json',{signal:cancelledSignal}).then(()=>{throw Error('Expected cancellation');},e=>assert.equal(e.name,'AbortError'))`);
}finally{clearTimeout(keepAlive);}
console.log('PASS catalogue deadlines end stalled requests with a useful error and preserve explicit cancellation');
