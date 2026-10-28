import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`
for(const target of ['sol','ross','hyg-67711','local-void','m87'])assert.equal(GasMedium.forLeg(object('sol'),object(target)).n,1e6);
for(const p of [[0,0,0],[100,0,0],[1e12,0,0]])assert.equal(GasMedium.at(p).n,1e6);
for(const phase of ['launch','brake']){
 state=initial();state.current='hyg-104751';state.ship=Space.point(object(state.current).p3);state.selected='hyg-67711';state.departureMode='beam';state.matter=0;state.expansion=false;Cosmology.sync(state);FlightEstimate.idleKey=null;launch();
 state.flight.medium={n:1000,area:SHIP.sailAreaM2,model:3,label:'old bubble'};
 if(phase==='brake')Simulation.step(1e10);assert.equal(state.phase,phase);
 const old=JSON.parse(JSON.stringify(state));state=restore(old);assert.equal(state.flight.medium.model,4);assert.equal(state.flight.medium.n,1e6);
 for(const key of ['earth','proper','matter','totalDistance','beta'])assert.equal(state[key],old[key]);assert.deepEqual(state.ship,old.ship);assert.equal(state.flight.covered,old.flight.covered);
 if(phase==='brake')assert.equal(state.phase,'cruise','shorter braking distance leaves a coast before braking');
 let n=0;while(state.flight&&n++<40)Simulation.step(1e10);assert.ok(!state.flight);assert.equal(state.current,'hyg-67711');
}
console.log('PASS uniform gas at all coordinates/targets, legacy launch/brake migration preserves progress and reaches target');
`);

run(`
for(const fuel of [0,.00005,.001])for(const mode of ['beam','burst'])for(const target of ['hyg-67711','ross']){
 state=initial();state.expansion=false;state.current='hyg-104751';state.ship=Space.point(object(state.current).p3);state.matter=fuel;state.departureMode=mode;state.selected=target;paused=false;Simulation.debt=0;Cosmology.sync(state);FlightEstimate.idleKey=null;FlightEstimate.active=new WeakMap();FlightProfile.idleKey=null;
 const estimate=FlightEstimate.get();launch();const flight=state.flight;let steps=0;while(state.flight&&steps++<30)Simulation.step(1e10);
 assert.ok(!state.flight);assert.equal(state.current,target);const err=Math.abs(state.proper-estimate.proper)/estimate.proper;assert.ok(err<1e-7,mode+' '+target+' relative error '+err);
 console.log(JSON.stringify({fuelKg:fuel*1000,mode,target,forecast:estimate.proper,actual:state.proper,error:err,acceleration:flight.profile?.actual?.acceleration,braking:flight.profile?.actual?.braking}));
}
`);
