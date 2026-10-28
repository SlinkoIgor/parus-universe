import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`
function nightReset(){state=initial();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='sgr';state.expansion=false;state.flightSetup=FlightSetup.normalize({sail:true,collector:true,burst:true,fill:true});paused=false;Cosmology.sync(state);Simulation.debt=0;Simulation.wallDebt=0;}
function completeNight(){let n=0;while(state.flight&&n++<16)Simulation.step(1e12);assert.ok(!state.flight,'flight must finish');}
resize();nightReset();state.itinerary=[{id:'sgr',mode:'flyby'},{id:'m87',mode:'stop'}];Route.start();Simulation.step(state.flight.mission.accelerationEnd.proper*.1);paused=true;
const before={p3:[...state.ship.p3],beta:state.beta,matter:state.matter,earth:state.earth,proper:state.proper,energy:state.spentEnergy},view=FlightView.ship();
assert.equal(Route.abort(),true);assert.equal(paused,true);assert.equal(state.flight.mission.passage,undefined);assert.equal(state.flight.route,null);
assert.deepEqual({p3:state.ship.p3,beta:state.beta,matter:state.matter,earth:state.earth,proper:state.proper,energy:state.spentEnergy},before);assert.ok(Math.hypot(FlightView.ship().x-view.x,FlightView.ship().y-view.y)<1e-9,'cancel preserves displayed ship');
const eta=MissionPlanner.estimate();state=restore(JSON.parse(JSON.stringify(state)));completeNight();assert.equal(state.current,'sgr');assert.ok(!state.visited.includes('m87'));assert.ok(Math.abs(state.proper-before.proper-eta.proper)<1e-6);assert.ok(Math.abs(state.matter*1000-eta.arrivalFuelKg)<1e-8);
console.log('PASS early passage cancellation, no teleport/free fuel/time change, pause, save/load, final stop and ETA');

nightReset();state.itinerary=[{id:'sgr',mode:'flyby'},{id:'m87',mode:'stop'}];Route.start();Simulation.step(state.flight.mission.accelerationEnd.proper*.9999999);const late=JSON.stringify(state);assert.equal(Route.abort(),false);assert.equal(JSON.stringify(state),late);completeNight();assert.equal(state.current,'m87');
console.log('PASS too-late cancellation leaves a working original route');

for(const id of ['s1','s2','s4','s8']){nightReset();state.itinerary=[{id:'sgr',mode:'flyby'},{id,mode:'stop'}];const analysis=Route.analyze();assert.equal(analysis.valid,false);assert.match(analysis.records.at(-1).issue,/расстояния.*остановки/);Route.start();assert.equal(state.flight,null);}
console.log('PASS impossible post-passage braking rejected before launch');

nightReset();state.itinerary=[{id:'alpha',mode:'stop'},{id:'sirius',mode:'stop'}];Route.start();Simulation.step(state.flight.mission.accelerationEnd.proper/2);assert.equal(Route.abort(),true);completeNight();assert.equal(state.current,'alpha');assert.ok(!state.visited.includes('sirius'));
console.log('PASS cancellation of an ordinary stopping route');
`);

run(`
resize();
function edgeReset(){state=initial();state.current='hyg-113008';state.ship=Space.point(object(state.current).p3);state.selected='hyg-69451';state.expansion=false;Cosmology.sync(state);Simulation.debt=0;Simulation.wallDebt=0;paused=false;}
let count=0,valid=0;
for(const density of [0,.000001,1,1000000])for(const capacity of [.01,1,100])for(const reserve of [1,50,99])for(const light of [false,true]){
 edgeReset();const c=FlightSetup.normalize({engine:true,sail:light,collector:light,burst:light,brakeSail:true,densityCm3:density,capacityKg:capacity,fill:true,reservePercent:reserve});const p=MissionPlanner.plan(c,object(state.current),object(state.selected),1);count++;
 if(!p.valid){assert.ok(p.reason);continue;}valid++;const info=JSON.stringify({c,proper:p.proper,fuel:p.arrivalFuelKg,initial:p.initialFuelKg,captured:p.capturedKg,burned:p.burnedKg});assert.ok(Number.isFinite(p.proper)&&p.proper>0,'time '+info);assert.ok(p.arrivalFuelKg>=0&&p.arrivalFuelKg<=capacity+1e-8,'fuel '+info);assert.ok(Math.abs(p.initialFuelKg+p.capturedKg-p.arrivalFuelKg-p.burnedKg)<1e-6,'balance '+info);
 for(let j=0;j<=48;j++){const q=MissionPlanner.stageSample(p,2,p.brake.proper*j/48);assert.ok(q.mass<=1+capacity+2e-10,'intermediate tank overflow '+info);assert.ok(q.mass>=1-1e-10);}
 state.flightSetup=c;MissionPlanner.launch(p);let n=0;while(state.flight&&n++<6){drawShip(n);Simulation.step(1e14);if(state.flight)state=restore(JSON.parse(JSON.stringify(state)));}assert.equal(state.current,'hyg-69451','bad arrival '+JSON.stringify(c));assert.ok(Math.abs(state.matter*1000-p.arrivalFuelKg)<1e-6);assert.ok(Math.abs(1-state.jettisoned*1000+state.captured*1000-state.matter*1000-state.spentEnergy/Rocket.c**2)<1e-6,'actual matter ledger '+info);
}
console.log('PASS edge parameters',count,'cases',valid,'valid complete flights with reload');
`);
