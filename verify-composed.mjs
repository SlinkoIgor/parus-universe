import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`
function composedReset(fuel=1){OrbitalArrival.enabled=false;state=initial();state.expansion=false;state.current='hyg-113008';state.ship=Space.point(object(state.current).p3);state.selected='hyg-69451';state.matter=fuel/1000;paused=false;Simulation.debt=0;Simulation.wallDebt=0;Cosmology.sync(state);}
function nearComposed(a,b,tol=2e-7){assert.ok(Math.abs(a-b)<=tol*Math.max(1e-5,Math.abs(a),Math.abs(b)),a+' != '+b);}
resize();composedReset();
let checked=0;
for(let mask=0;mask<16;mask++)for(const dump of [false,true])for(const brake of ['both','engine','sail','none'])for(const fill of [false,true]){
 const c=FlightSetup.normalize({engine:!!(mask&1),sail:!!(mask&2),collector:!!(mask&4),burst:!!(mask&8),dump,brakeEngine:brake==='both'||brake==='engine',brakeSail:brake==='both'||brake==='sail',fill,capacityKg:1,densityCm3:1});
 const p=MissionPlanner.plan(c,object(state.current),object(state.selected),1);
 if(!p.valid){assert.ok(p.reason);continue;}
 checked++;assert.ok(Number.isFinite(p.proper)&&p.proper>0);assert.ok(p.earth>=p.proper);assert.ok(p.arrivalFuelKg>=-1e-10&&p.arrivalFuelKg<=c.capacityKg+1e-10);
 nearComposed(p.accelerationEnd.comoving+p.coast.distance+p.brake.comoving,p.distance,1e-10);
 nearComposed(p.initialFuelKg+p.capturedKg,p.arrivalFuelKg+p.burnedKg,1e-8);
 for(const row of p.acceleration.rows){assert.ok(row.a<=100*9.80665*(1+1e-10));assert.ok(row.mass>=1-1e-10);}
 for(const t of [.1,.5,.9]){const q=MissionPlanner.stageSample(p,2,p.brake.proper*t);assert.ok(q.mass>=1-1e-9&&q.mass<=2+1e-9);assert.ok(Math.abs(q.a)<=100*9.80665*(1+1e-8));}
 if(dump)assert.equal(p.initialFuelKg,0);
}
assert.ok(checked>40,'too few feasible combinations: '+checked);console.log('PASS '+checked+' feasible combinations, rejected zero-force/asymptotic cases, both clocks, shared 100g cap and exact fuel balance');

const base=FlightSetup.normalize({sail:true,collector:true,burst:true,capacityKg:1,densityCm3:1});
composedReset();const fast=MissionPlanner.plan(base,object(state.current),object(state.selected),1),filled=MissionPlanner.plan({...base,fill:true},object(state.current),object(state.selected),1);
assert.ok(filled.arrivalFuelKg>.98);assert.ok(filled.proper>fast.proper);nearComposed(filled.arrivalFuelKg,.99,1e-10);
const dense=MissionPlanner.plan({...base,densityCm3:10},object(state.current),object(state.selected),1);assert.ok(dense.proper<fast.proper);
composedReset(0);state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='alpha';const short=MissionPlanner.plan({...base,fill:true},object(state.current),object(state.selected),0);assert.ok(short.valid);assert.ok(short.arrivalFuelKg>0&&short.arrivalFuelKg<.1,'short route cannot refill 1 kg');
const large=MissionPlanner.plan({...base,capacityKg:5},object(state.current),object(state.selected),0);assert.equal(large.initialFuelKg,0);nearComposed(large.capturedKg,large.arrivalFuelKg+large.burnedKg,1e-8);
const solo=MissionPlanner.plan({...base,brakeEngine:false},object(state.current),object(state.selected),0);assert.equal(solo.valid,false);assert.equal(solo.proper,Infinity);assert.ok(solo.diagnostic>1e9);
composedReset();state.current='sol';state.ship=Space.point(object('sol').p3);state.selected='proxima';const sun=MissionPlanner.plan(base,object('sol'),object('proxima'),1);assert.equal(sun.valid,false);state.flightSetup=base;launch();assert.equal(state.flight,null);assert.ok(!state.destroyed.includes('sol'));
console.log('PASS fuel/time tradeoff, denser gas, short-route refill limit, capacity cannot create fuel, passive-sail asymptote and Solar-burst prohibition');

function composedTrip(c,step=1e12,reload=false){
 composedReset();state.flightSetup=c;const eta=FlightEstimate.get();const fuelBefore=state.matter;launch();assert.ok(state.flight?.mission);const capacity=c.capacityKg;
 if(c.dump)assert.equal(state.matter,0);assert.equal(Rocket.fuelCapacity,capacity/1000);
 if(reload){Simulation.step(state.flight.mission.accelerationEnd.proper/2);const before=JSON.stringify({ship:state.ship,beta:state.beta,proper:state.proper,earth:state.earth,matter:state.matter});state=restore(JSON.parse(JSON.stringify(state)));assert.equal(JSON.stringify({ship:state.ship,beta:state.beta,proper:state.proper,earth:state.earth,matter:state.matter}),before);}
 let n=0;while(state.flight&&n++<20000){MapLabels.begin();drawShip(n);drawRoute();Simulation.step(step);}assert.equal(state.current,'hyg-69451');assert.equal(state.beta,0);nearComposed(state.proper,eta.proper,3e-7);nearComposed(state.earth,eta.earth,3e-7);nearComposed(state.matter*1000,eta.arrivalFuelKg,1e-6);
 nearComposed(fuelBefore*1000-state.jettisoned*1000+state.captured*1000,state.matter*1000+state.spentEnergy/Rocket.c**2,2e-8);
 return[state.proper,state.earth,state.matter,state.captured,state.spentEnergy,state.totalDistance];
}
for(const opts of [{engine:true,brakeSail:false},{sail:true,collector:true},{sail:true,burst:true},{engine:true,sail:true,collector:true,burst:true},{...base,fill:true},{...base,fill:true,dump:true,capacityKg:2}])composedTrip(FlightSetup.normalize(opts),1e12,true);
const big=composedTrip({...base,fill:true}),small=composedTrip({...base,fill:true},.05);for(let i=0;i<big.length;i++)nearComposed(big[i],small[i],3e-7);
console.log('PASS composed-flight execution equals forecast, reload during acceleration, dump accounting, variable capacity and frame-independent complete trips');

// Numerical light/engine acceleration satisfies the continuous equations.
composedReset();const mixed=MissionPlanner.plan({...base,burst:false,engine:true},object(state.current),object(state.selected),1);
for(const part of [.2,.5,.8]){const t=mixed.accelerationEnd.proper*part,h=Math.max(1e-8,t*1e-5),a=MissionPlanner.sampleAcceleration(mixed.acceleration,t-h),b=MissionPlanner.sampleAcceleration(mixed.acceleration,t+h),q=MissionPlanner.sampleAcceleration(mixed.acceleration,t);nearComposed((b.earth-a.earth)/(2*h),Math.cosh(q.eta),2e-4);nearComposed((b.distance-a.distance)/(2*h),Math.sinh(q.eta),2e-4);}
console.log('PASS acceleration clock/distance derivatives');

// Stellar mass and luminosity are independent inputs; no catalogue data is mutated.
composedReset();state.current='sol';state.ship=Space.point(object('sol').p3);state.selected='proxima';
const stellarBefore=JSON.stringify(object('sol')),bare=FlightSetup.normalize({sail:true,collector:false,luminositySolar:1,massSolar:1});
const normalStar=MissionPlanner.plan(bare,object('sol'),object('proxima'),1),brightStar=MissionPlanner.plan({...bare,luminositySolar:10},object('sol'),object('proxima'),1),heavyStar=MissionPlanner.plan({...bare,massSolar:100},object('sol'),object('proxima'),1);
assert.ok(normalStar.valid&&brightStar.valid);assert.ok(brightStar.proper<normalStar.proper);assert.equal(heavyStar.valid,false);assert.ok(heavyStar.reason.includes('поля звезды'));assert.equal(JSON.stringify(object('sol')),stellarBefore);
console.log('PASS independent stellar mass/luminosity, gravity-limited launch and unchanged source catalogue');

// Reload from every stage, including captured fuel in the braking stage.
for(const stage of [0,1,2]){
 composedReset();state.flightSetup=FlightSetup.normalize({engine:true,fill:true,capacityKg:2});launch();
 while(state.flight.missionStage<stage)Simulation.step(1e12);
 Simulation.step(MissionPlanner.stages(state.flight.mission)[stage].proper/3);
 const snapshot=JSON.parse(JSON.stringify(state)),before=[state.proper,state.earth,state.beta,state.matter,JSON.stringify(state.ship.p3)];
 state=restore(snapshot);assert.deepEqual([state.proper,state.earth,state.beta,state.matter,JSON.stringify(state.ship.p3)],before);
 while(state.flight)Simulation.step(1e12);assert.equal(state.current,'hyg-69451');
}
console.log('PASS reload during every composed flight stage');

// A selectable intermediate reserve is respected without creating propellant.
composedReset();const ninety=MissionPlanner.plan({...base,fill:true,reservePercent:90},object(state.current),object(state.selected),1);
nearComposed(ninety.arrivalFuelKg,.9,1e-10);assert.ok(ninety.proper<filled.proper&&ninety.proper>fast.proper);
// Expanding-space forecasts and integration use the same powered/coasting path.
for(const target of ['m87','3c273']){
 composedReset();state.selected=target;state.expansion=true;Cosmology.sync(state);state.flightSetup={...base,fill:true,capacityKg:2,densityCm3:.5};const eta=FlightEstimate.get();assert.ok(Number.isFinite(eta.proper));launch();let steps=0;while(state.flight&&steps++<12)Simulation.step(1e12);assert.equal(state.current,target);nearComposed(state.proper,eta.proper,1e-7);nearComposed(state.earth,eta.earth,1e-7);nearComposed(state.matter*1000,eta.arrivalFuelKg,1e-7);
}
composedReset();state.selected='mom-z14';state.expansion=true;state.flightSetup=base;Cosmology.sync(state);assert.ok(FlightEstimate.get().unreachable);launch();assert.equal(state.flight,null);
// Both stopped routes and geodesic passages keep the configured braking policy.
for(const nodes of [[{id:'alpha',mode:'stop'},{id:'sirius',mode:'stop'}],[{id:'sgr',mode:'flyby'},{id:'m87',mode:'stop'}]]){
 composedReset();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.flightSetup={...base,fill:true};state.itinerary=nodes;assert.ok(Route.analyze().valid);Route.start();let n=0;while(state.flight&&n++<20){Simulation.step(1e12);if(state.phase==='flyby'){const saved=JSON.parse(JSON.stringify(state));state=restore(saved);}}
 assert.equal(state.current,nodes.at(-1).id);assert.ok(state.visited.includes(nodes[0].id));assert.ok(state.matter*1000>.98);
}
console.log('PASS intermediate reserves, expanding-space ETA/arrival, horizon, stopped routes and reload at a black-hole passage');

`);
