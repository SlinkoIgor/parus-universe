import fs from 'node:fs';
// A distinct module URL gives this suite a fresh VM when verify.mjs imports
// other map suites that also export the common harness through a data URL.
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};\n// Isolated flight-track regression context.\n';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`
resize();
const nearTrack=(a,b,message)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-5,message+' '+JSON.stringify({a,b}));
// Reproduce a pre-fix save: the completed line uses the catalogue position,
// while the parked ship is already drawn at the moving star.
for(const id of ['proxima','alpha','hyg-71453','s2']){
 state=initial();state.expansion=false;state.current=id;state.selected=id;state.ship=Space.point(object(id).p3);
 const h={fromId:'sol',target:id,from:Space.point(object('sol').p3),end:Space.point(object(id).p3),fraction:1,view:{a:{...MapLayout.baseProject(object('sol'))},b:{...MapLayout.baseProject(object(id))},referenceEpoch:true,geometryVersion:MapLayout.version}};
 state.flightHistory=[h];Cosmology.sync(state);
 for(const elapsed of [0,10,100000]){
  state.universeElapsed=elapsed;state.earth=elapsed;state.proper=elapsed/2;
  const saved=JSON.parse(JSON.stringify(state));state=restore(saved);Cosmology.sync(state);
  const ship=FlightView.ship();cam={x:ship.x,y:ship.y,span:id==='s2'?.02:.4};
  const physical=JSON.stringify(state),lines=[],original=line;
  line=(x1,y1,x2,y2)=>lines.push({a:{x:x1,y:y1},b:{x:x2,y:y2}});
  try{FlightHistory.draw();}finally{line=original;}
  assert.equal(lines.length,1,'one visible completed track for '+id);
  nearTrack(lines[0].b,screen(state.ship),'completed track reaches parked ship '+id+' at '+elapsed);
  nearTrack(lines[0].b,screen(object(id)),'completed track reaches its moving destination '+id);
  assert.equal(JSON.stringify(state),physical,'rendering preserves saved coordinates, clocks, fuel and track');
 }
}
console.log('PASS legacy completed tracks reach the parked ship at all moving Alpha components and S2, across time and reload');

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
`);
