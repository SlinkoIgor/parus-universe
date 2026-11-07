import fs from 'node:fs';
// A distinct module URL gives this suite a fresh VM when verify.mjs imports
// other map suites that also export the common harness through a data URL.
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};\n// Isolated flight-track regression context.\n';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`
resize();
const nearTrack=(a,b,message)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-5,message+' '+JSON.stringify({a,b}));
// A fading completed line must still end at the moving parked ship.
for(const id of ['proxima','alpha','hyg-71453','s2']){
 state=initial();state.expansion=false;state.current=id;state.selected=id;state.ship=Space.point(object(id).p3);
 const h={fromId:'sol',target:id,from:Space.point(object('sol').p3),end:Space.point(object(id).p3),fraction:1,view:{a:{...MapLayout.baseProject(object('sol'))},b:{...MapLayout.baseProject(object(id))},referenceEpoch:true,geometryVersion:MapLayout.version}};
 state.flightHistory=[h];Cosmology.sync(state);
 for(const elapsed of [0,10,100000]){
  state.universeElapsed=elapsed;state.earth=elapsed;state.proper=elapsed/2;
  const saved=JSON.parse(JSON.stringify(state));state=restore(saved);Cosmology.sync(state);
  const ship=FlightView.ship();cam={x:ship.x,y:ship.y,span:id==='s2'?.02:.4};
  state.flightHistory[0].mapFadeAt=Date.now();
  const physical=JSON.stringify(state),lines=[],original=line;
  line=(x1,y1,x2,y2)=>lines.push({a:{x:x1,y:y1},b:{x:x2,y:y2}});
  try{FlightHistory.draw();}finally{line=original;}
  assert.equal(lines.length,1,'one visible completed track for '+id);
  nearTrack(lines[0].b,screen(state.ship),'completed track reaches parked ship '+id+' at '+elapsed);
  nearTrack(lines[0].b,screen(object(id)),'completed track reaches its moving destination '+id);
  assert.equal(JSON.stringify(state),physical,'rendering preserves saved coordinates, clocks, fuel and track');
 }
}
console.log('PASS fading completed tracks reach the parked ship at all moving Alpha components and S2, across time and reload');

// The same endpoint projection must be shared by ship, active line and marks.
for(const [fromId,target] of [['sol','proxima'],['proxima','alpha'],['alpha','s2']]){
 state=initial();state.expansion=false;state.current=fromId;state.ship=Space.point(object(fromId).p3);state.selected=target;Cosmology.sync(state);
 const f={fromId,target,from:Space.point(state.ship.p3),distance:Space.distance(state.ship,object(target)),covered:0};state.flight=f;
 for(const elapsed of [0,13,1000]){
  state.universeElapsed=elapsed;
  const a=MapLayout.project(object(fromId)),b=MapLayout.project(object(target));
  nearTrack(FlightView.at(f,0),a,'active departure follows its displayed object');
  nearTrack(FlightView.at(f,1),b,'active destination follows its displayed object');
  for(const t of [.1,.5,.9]){
   f.covered=f.distance*t;state.ship=Space.mix(f.from,object(target),t);
   nearTrack(FlightView.ship(),{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},'ship remains on one straight affine leg');
   nearTrack(FlightView.at(f,FlightView.fraction(f,state.ship.p3)),FlightView.ship(),'physical progress marks share the ship projection');
   cam={...FlightView.ship(),span:.4};
   const incoming=routeScreenSegment(f.from,object(target),0,t),outgoing=routeScreenSegment(f.from,object(target),t,1);
   nearTrack(incoming.b,screen(state.ship),'flown line ends at ship');nearTrack(outgoing.a,screen(state.ship),'remaining line starts at ship');
  }
 }
}
console.log('PASS active moving endpoints, affine ship/marks and both clipped route halves meet at the ship');

// A cancelled passage starts a new leg at the ship, not at the departed star.
state=initial();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.expansion=false;paused=false;Cosmology.sync(state);
state.flightSetup=FlightSetup.normalize({engine:true,sail:false,collector:false,brakeEngine:true,brakeSail:true,arrivalFuelPercent:0});
state.itinerary=[{id:'sgr',mode:'flyby'},{id:'m87',mode:'stop'}];Route.start();assert.ok(state.flight);Simulation.step(.000001);paused=true;
const position=FlightView.ship(),physical=JSON.stringify([state.ship.p3,state.matter,state.earth,state.proper]);assert.equal(Route.abort(),true);
nearTrack(FlightView.ship(),position,'passage cancellation preserves displayed ship');assert.equal(JSON.stringify([state.ship.p3,state.matter,state.earth,state.proper]),physical);
state=restore(JSON.parse(JSON.stringify(state)));Cosmology.sync(state);nearTrack(FlightView.ship(),position,'cancelled passage preserves display after reload');
const detached=FlightView.at(state.flight,0);state.universeElapsed+=10;assert.deepEqual(FlightView.at(state.flight,0),detached,'new start no longer follows the departed star');
const f=state.flight;f.covered=f.distance;state.ship=Space.point(object(f.target).p3);FlightHistory.complete(f);const historyStart=FlightView.at(state.flightHistory.at(-1),0);state.universeElapsed+=10;assert.deepEqual(FlightView.at(state.flightHistory.at(-1),0),historyStart,'completed history retains its detached start');
console.log('PASS real passage cancellation/reload preserves ship, clocks and fuel, and its new start stays fixed when the departed star moves');

// Real arrivals drive a three-second wall-clock fade of the entire mission.
{
 const clock=Date.now,stroke=line,save=ctx.save,restoreContext=ctx.restore;
 let wall=1700000000000,alpha=[],stack=[];Date.now=()=>wall;
 ctx.globalAlpha=1;ctx.save=()=>stack.push(ctx.globalAlpha);ctx.restore=()=>ctx.globalAlpha=stack.pop();
 line=()=>alpha.push(ctx.globalAlpha);
 const visible=()=>{alpha=[];FlightHistory.draw();assert.equal(ctx.globalAlpha,1,'fade cannot leak opacity to stars/ship/UI');return alpha;};
 const reset=()=>{state=initial();state.expansion=false;state.flightSetup=FlightSetup.normalize({engine:true,sail:true,collector:true,arrivalFuelPercent:50});paused=true;Simulation.debt=Simulation.wallDebt=0;FlightQueue.reset();Cosmology.sync(state);cam={x:0,y:0,span:100};};
 const arrive=()=>Simulation.tick(FlightEstimate.get().proper*1.00001);
 try{
  reset();select('alpha');launch();arrive();assert.equal(state.flight,null);assert.equal(state.current,'alpha');
  const end=JSON.stringify([state.ship,state.orbit,state.matter,state.proper,state.earth]),stamp=state.flightHistory[0].mapFadeAt;
  assert.equal(stamp,wall);assert.deepEqual(visible(),[1]);
  wall+=750;assert.deepEqual(visible(),[.75]);paused=true;wall+=750;assert.deepEqual(visible(),[.5]);
  state=restore(JSON.parse(JSON.stringify(state)));assert.equal(state.flightHistory[0].mapFadeAt,stamp);assert.deepEqual(visible(),[.5],'reload keeps the original fade deadline');
  wall+=1499;assert.ok(visible()[0]>0);wall++;assert.deepEqual(visible(),[],'fully gone exactly three seconds after arrival');
  assert.equal(JSON.stringify([state.ship,state.orbit,state.matter,state.proper,state.earth]),end,'fading preserves fuel, clocks, position and parking');
  state=restore(JSON.parse(JSON.stringify(state)));assert.deepEqual(visible(),[],'expired tracks never reappear after reload');
  console.log('PASS real single arrival fades continuously over 3 wall-clock seconds, including pause/reload, and preserves physics/history');

  reset();state.itinerary=['alpha','barnard','sol'].map(id=>({id,mode:'stop'}));Route.start();
  arrive();assert.equal(state.flight.target,'barnard');assert.equal(state.flightHistory[0].mapFadeAt,undefined);wall+=10000;assert.deepEqual(visible(),[1],'first leg remains until the entire route ends');
  arrive();assert.equal(state.flight.target,'sol');wall+=10000;assert.deepEqual(visible(),[1,1]);
  state=restore(JSON.parse(JSON.stringify(state)));assert.deepEqual(visible(),[1,1],'active route keeps previous legs on reload');
  arrive();assert.equal(state.flight,null);assert.equal(state.current,'sol');assert.equal(state.flightHistory.length,3);assert.ok(state.flightHistory.every(h=>h.mapFadeAt===wall));assert.deepEqual(visible(),[1,1,1]);
  wall+=1500;assert.deepEqual(visible(),[.5,.5,.5]);
  select('ross');launch();assert.deepEqual(visible(),[.5,.5,.5],'a new flight does not restart the old fade');
  wall+=1500;assert.deepEqual(visible(),[]);assert.ok(state.flight,'old route disappearance cannot stop a new flight');
  FlightHistory.cancel();assert.deepEqual(visible(),[],'rollback cannot resurrect an expired trace');
  select('ross');launch();arrive();assert.equal(state.flightHistory.length,4);assert.deepEqual(visible(),[1],'only the newly completed flight appears');
  wall+=3000;assert.deepEqual(visible(),[]);
  console.log('PASS all three route legs stay visible through intermediate stops, fade together only on final arrival, and never revive during new flight/cancel');

  delete state.flightHistory[0].mapFadeAt;state.flightHistory=state.flightHistory.slice(0,1);assert.deepEqual(visible(),[],'old idle saves have no permanent historical traces');
  select('alpha');launch();finishFlight(false);assert.deepEqual(visible(),[],'an immediate zero-distance stop cannot fade an older flight');
  console.log('PASS legacy idle history stays hidden and zero-progress stops cannot resurrect previous tracks');
 }finally{Date.now=clock;line=stroke;ctx.save=save;ctx.restore=restoreContext;ctx.globalAlpha=1;}
}
`);
