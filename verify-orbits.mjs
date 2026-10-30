import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`{
function orbitReset(){OrbitalArrival.enabled=true;state=initial();state.expansion=false;paused=false;Simulation.debt=0;Simulation.wallDebt=0;state.flightSetup=FlightSetup.normalize({engine:true,brakeEngine:true,brakeSail:true,arrivalFuelPercent:0});}
function closeOrbit(a,b,tol=1e-7){assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),a+' != '+b);}
orbitReset();
closeOrbit(MapDetails.mass(object('cygnus')),21.2,1e-12);closeOrbit(MapDetails.massInfo(object('cygnus')).uncertainty,2.2,1e-12);closeOrbit(MapDetails.mass(object('betelgeuse')),17.5,1e-12);
assert.equal(MapDetails.mass(object('vela')),null);assert.equal(OrbitalArrival.target(object('sirius')),null);
for(const id of ['opengc-ngc6705','omega','andromeda','orion','horizon'])assert.equal(OrbitalArrival.target(object(id)),null,id);
assert.equal(OrbitalArrival.target({id:'unknown',kind:'star',facts:{mass:'Неизвестна'}}),null);
assert.equal(OrbitalArrival.target({id:'pulsar',kind:'pulsar',massSolar:1.6}).massSolar,1.6);
const sun=OrbitalArrival.target(object('sol'));closeOrbit(sun.speed,29785.142,1e-7);closeOrbit(sun.radius,Stellar.r0,1e-12);
for(const id of ['betelgeuse','sgr']){const p=OrbitalArrival.target(object(id));assert.ok(p.radius>=3*p.surface);assert.ok(p.radius>=1e4*p.rs);}
console.log('PASS individual masses, uncertainties/ranges, unknown/extended/binary fallback and weak-field radii');
// Independent continuous-equation checks on the numerical vector trajectory.
const vectorConfig=FlightSetup.normalize({engine:true,brakeSail:false,collectGas:false}),vectorPlan=OrbitalArrival.plan(vectorConfig,2,.1,0,sun),vacuumBody={...sun,mu:0},sameFinalWithoutGravity=OrbitalArrival.plan(vectorConfig,2,.1,0,vacuumBody);
assert.ok(vectorPlan&&sameFinalWithoutGravity);assert.ok(vectorPlan.burned>sameFinalWithoutGravity.burned,'falling into the potential must cost additional braking impulse at the same terminal speed');
const zero=Rocket.retroPlan(.001,.1);assert.ok(vectorPlan.burned<zero.budget*1000,'retaining orbital velocity can still save fuel compared with stopping at rest');
for(let i=2;i<vectorPlan.rows.length-2;i+=13){const a=vectorPlan.rows[i-1],q=vectorPlan.rows[i],b=vectorPlan.rows[i+1],dt=(b.proper-a.proper)*Rocket.year,r=Math.hypot(q.x,q.y),gx=-sun.mu*q.x/r**3,gy=-sun.mu*q.y/r**3,gpar=gx*Math.cos(q.theta)+gy*Math.sin(q.theta),gperp=-gx*Math.sin(q.theta)+gy*Math.cos(q.theta);
 closeOrbit((b.eta-a.eta)/dt,(q.a+gpar)/Rocket.c,1e-8);
 assert.ok(Math.abs((b.theta-a.theta)/dt-Math.cosh(q.eta)*gperp/(Rocket.c*Math.sinh(q.eta)))<1e-9);
 closeOrbit((b.earth-a.earth)/(b.proper-a.proper),Math.cosh(q.eta),.004);
}
console.log('PASS force/clock derivatives, extra work against target gravity and fuel saved by retaining circular velocity');

for(const id of ['proxima','alpha','cygnus','sgr']){
 orbitReset();state.selected=id;const p=MissionPlanner.preview();assert.ok(p.valid,p.reason);assert.equal(p.brake.kind,'orbit');
 const b=p.brake,rows=b.plan.rows,end=rows.at(-1),r=Math.hypot(end.x,end.y),vx=Math.cos(end.theta)*end.beta*Rocket.c,vy=Math.sin(end.theta)*end.beta*Rocket.c;
 closeOrbit(r,b.body.radius,1e-10);closeOrbit((vx*end.x+vy*end.y)/r,0,1e-8);closeOrbit((vx*vx+vy*vy)/2-b.body.mu/r,-b.body.mu/(2*r),1e-8);
 closeOrbit(Math.abs(end.x*vy-end.y*vx),Math.sqrt(b.body.mu*r),1e-8);
 assert.ok(rows.every(q=>q.mass>=1-2e-7&&q.mass<=2+2e-7));assert.ok(rows.every(q=>Math.abs(q.a)<=100*9.80665*(1+1e-8)));
 closeOrbit(p.initialFuelKg+p.capturedKg,p.arrivalFuelKg+p.burnedKg,2e-7);
 closeOrbit(p.accelerationEnd.comoving+p.coast.distance+b.comoving,p.distance,1e-10);
 const expected={proper:p.proper,earth:p.earth,fuel:p.arrivalFuelKg,beta:b.body.beta},startP=state.proper,startE=state.earth;
 MissionPlanner.launch();for(let n=0;state.flight&&n<100;n++)Simulation.tick(Math.min(.17,Math.max(1e-8,FlightEstimate.get().proper)));
 if(state.flight)Simulation.tick(FlightEstimate.get().proper);
 assert.ok(!state.flight,'flight remaining at stage '+state.flight?.missionStage+' t '+state.flight?.stageElapsed);assert.equal(state.current,id);assert.ok(state.orbit);closeOrbit(state.beta,expected.beta,1e-12);closeOrbit(state.matter*1000,expected.fuel,2e-7);
 closeOrbit(state.proper-startP,expected.proper,1e-8);closeOrbit(state.earth-startE,expected.earth,1e-8);
 const saved=JSON.parse(JSON.stringify(state));state=restore(saved);assert.equal(state.current,id);assert.ok(state.orbit);closeOrbit(state.beta,expected.beta,1e-12);
 const angle=state.orbit.angle;Simulation.tick(.1);assert.notEqual(state.orbit.angle,angle);assert.equal(state.matter,saved.matter);assert.equal(state.acceleration,0);
 console.log('PASS capture, fuel, both clocks, save and parked circular motion:',id);
}
orbitReset();state.selected='proxima';let p=MissionPlanner.preview();MissionPlanner.launch();Simulation.tick(p.accelerationEnd.proper+p.coast.proper+p.brake.proper*.42);const remaining=FlightEstimate.get(),save=JSON.parse(JSON.stringify(state));state=restore(save);closeOrbit(FlightEstimate.get().proper,remaining.proper,1e-12);Simulation.tick(remaining.proper);assert.equal(state.current,'proxima');assert.ok(state.orbit);
// No freely escaping a bound circular orbit with neither fuel nor light.
state.selected='alpha';state.matter=0;state.flightSetup=FlightSetup.normalize({engine:true,brakeEngine:true,brakeSail:true});MissionPlanner.cache.clear();p=MissionPlanner.preview();assert.equal(p.valid,false);assert.match(p.reason,/покинуть орбиту/);
state.matter=.0005;state.flightSetup=FlightSetup.normalize({sail:true,collector:true,burst:true,brakeEngine:true,brakeSail:true});MissionPlanner.cache.clear();p=MissionPlanner.preview();assert.ok(p.valid,p.reason);assert.ok(p.acceleration.rows[0].beta>0);assert.equal(p.departureOrbit.radius,state.orbit.radius);
console.log('PASS restoring a capture in progress and preserving bound orbital energy at the next departure');
orbitReset();state.selected='opengc-ngc6705';p=MissionPlanner.preview();assert.ok(p.valid);assert.notEqual(p.brake.kind,'orbit');MissionPlanner.launch();Simulation.tick(p.proper);assert.equal(state.current,'opengc-ngc6705');assert.equal(state.orbit,null);assert.equal(state.beta,0);
console.log('PASS extended/unknown target still comes to a complete stop');
}
`);
