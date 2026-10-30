import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`{
function resetTask(){state=initial();state.expansion=false;paused=true;speed=1;Simulation.debt=Simulation.wallDebt=0;OrbitalArrival.enabled=true;Cosmology.sync(state);MissionPlanner.cache.clear();}
function nearTask(a,b,e=1e-7){assert.ok(Math.abs(a-b)<=e*Math.max(1,Math.abs(a),Math.abs(b)),a+' vs '+b);}
resetTask();const defaults=FlightSetup.read();assert.ok(defaults.engine&&defaults.sail&&defaults.collector);assert.equal(defaults.collectorDiameterM,.1*Stellar.r0);assert.equal(defaults.collectorMinAu,100);assert.equal(defaults.maxAccelerationG,10);assert.equal(defaults.maxBrakingG,10);assert.equal(FlightSetup.normalize({maxAccelerationG:100,maxBrakingG:100}).maxBrakingG,100);
for(const eff of [100,50,10,.1])ShipPhysics.run({engineEfficiencyPercent:eff},()=>{const q=Rocket.plan(.001),expected=Math.tanh(eff/100*Math.log(2));nearTask(q.beta,expected,1e-12);const stop=Rocket.retroPlan(.001,expected);assert.ok(stop.canStop);nearTask(stop.mf,.001,1e-12);});
const sol=object('sol'),target=object('proxima');
for(const options of [{dryMassKg:3,maxAccelerationG:2,maxBrakingG:3},{maxAccelerationG:25,maxBrakingG:40},{maxAccelerationG:1000,maxBrakingG:2000},{engineEfficiencyPercent:50},{engineEfficiencyPercent:10,collectGas:false},{engineEfficiencyPercent:.1},{enginePowerW:1e9}]){
 const c=FlightSetup.normalize({...defaults,...options,arrivalFuelPercent:0});const p=MissionPlanner.plan(c,sol,target,1,Space.point(sol.p3),0,false);assert.ok(p.valid,JSON.stringify(options)+': '+p.reason);assert.ok(p.acceleration.rows.every(q=>q.a<=c.maxAccelerationG*G0*(1+1e-8)));assert.ok(p.brake.plan.rows.every(q=>Math.abs(q.a)<=c.maxBrakingG*G0*(1+1e-8)));nearTask(c.dryMassKg+p.initialFuelKg+p.capturedKg-p.burnedKg,c.dryMassKg+p.arrivalFuelKg,3e-7);
 if(c.maxAccelerationG>10){assert.ok(p.acceleration.rows.some(q=>q.a>10*G0));assert.ok(p.brake.plan.rows.some(q=>Math.abs(q.a)>10*G0));assert.equal(p.setup.maxAccelerationG,c.maxAccelerationG);assert.equal(p.setup.maxBrakingG,c.maxBrakingG);}
 state.flightSetup=c;state.selected='proxima';MissionPlanner.launch(p);const expected={p:p.proper,e:p.earth,m:p.arrivalFuelKg};for(let i=0;state.flight&&i<12;i++)Simulation.tick(FlightEstimate.get().proper);assert.ok(!state.flight,'finish configurable mission');nearTask(state.proper,expected.p);nearTask(state.earth,expected.e);nearTask(state.matter*1000,expected.m);resetTask();
}
for(const watts of [1e9,1.5*10*G0*Rocket.c/.5])ShipPhysics.run({enginePowerW:watts,engineEfficiencyPercent:50},()=>{
 const p=Rocket.plan(.001);for(const f of [.1,.4,.8]){const t=p.burnProper*f,h=p.burnProper*1e-6,m=Rocket.massAfter(p.m0,t),n=Rocket.massAfter(p.m0,t+h),a=Rocket.segment(p.m0,p.m0,m),b=Rocket.segment(p.m0,p.m0,n),thrust=Math.min(10*G0,watts*.5/(Rocket.c*m*1000));nearTask(a.proper,t,1e-10);nearTask((Math.atanh(b.beta)-Math.atanh(a.beta))/(h*Rocket.year),thrust/Rocket.c,1e-9);nearTask((b.distance-a.distance)/(b.earth-a.earth),a.beta,1e-5);}
});
const pureGas=ShipPhysics.run({dustMassPercent:0},()=>Magnetic.rho(1e6)),dusty=ShipPhysics.run({dustMassPercent:1},()=>Magnetic.rho(1e6));nearTask(dusty/pureGas,1/.99,1e-12);
console.log('PASS editable masses, efficiencies including 0.1%, power and separate acceleration/braking caps; actual arrivals, clocks and fuel');
const lightBase=FlightSetup.normalize({...defaults,engine:false,sail:true,collector:false,massSolar:0});const full=MissionPlanner.acceleration(lightBase,sol,1,.00001,0,false,false),absorbed=MissionPlanner.acceleration({...lightBase,reflectivityPercent:0},sol,1,.00001,0,false,false);nearTask(full.rows[0].a,absorbed.rows[0].a*2,1e-12);
const spectrum={kind:'thermal',temperatureK:5772};assert.ok(BeamOptics.fraction(1e12,0,spectrum,100000,50,.01)<BeamOptics.fraction(1e12,0,spectrum,100000,50,0));
resetTask();state.current='proxima';state.ship=Space.point(target.p3);state.selected='alpha';
for(const burstDays of [.5,30]){const c=FlightSetup.normalize({...defaults,engine:false,burst:true,burstDays,arrivalFuelPercent:0}),p=MissionPlanner.preview(c);assert.ok(p.valid,p.reason);assert.ok(p.acceleration.rows.at(-1).source<=burstDays/365.25*(1+1e-9));}
console.log('PASS reflection/absorption, additional angular divergence and editable retarded source duration');
resetTask();state.selected='alpha';state.flightSetup=FlightSetup.normalize({...defaults,capacityKg:.5,arrivalFuelPercent:0});
const before=JSON.parse(JSON.stringify(state));MissionPlanner.launch();assert.ok(state.flight.rollback);const summary=JSON.stringify(state.flight.summary);Simulation.tick(state.flight.mission.proper*.3);renderUI();assert.equal(JSON.stringify(state.flight.summary),summary);assert.equal($('arrivalProper').textContent,durationText(state.flight.summary.proper));assert.ok($('progressRemaining').textContent.includes('Осталось на борту'));
state=restore(JSON.parse(JSON.stringify(state)));FlightHistory.cancel();for(const key of ['current','selected','matter','proper','earth','universeElapsed','cosmicTime','destroyed','visited','flightSetup','tankCapacityKg','totalDistance','spentEnergy','captured','heatRadiated','jettisoned','itinerary','flightHistory'])assert.equal(JSON.stringify(state[key]),JSON.stringify(before[key]),'rollback '+key);
assert.equal(state.flight,null);
MissionPlanner.launch();Simulation.tick(FlightEstimate.get().proper);assert.ok(!state.flight);assert.equal(state.flightHistory.length,1);const history=JSON.stringify(state.flightHistory);state=restore(JSON.parse(JSON.stringify(state)));assert.equal(JSON.stringify(state.flightHistory),history);state.selected='sol';const originalTrail=JSON.stringify(state.flightHistory);MissionPlanner.launch();assert.ok(state.flight);Simulation.tick(state.flight.mission.proper*.2);FlightHistory.cancel();assert.equal(JSON.stringify(state.flightHistory),originalTrail);assert.equal(state.current,'alpha');
console.log('PASS frozen summary, remaining proper time, reload/cancel restores clocks/fuel/settings and keeps previous completed tracks');
resetTask();state.current='proxima';state.ship=Space.point(target.p3);state.selected='alpha';state.flightSetup=FlightSetup.normalize({...defaults,burst:true,arrivalFuelPercent:0});MissionPlanner.launch();assert.ok(state.destroyed.includes('proxima'));Simulation.tick(.000001);FlightHistory.cancel();assert.ok(!state.destroyed.includes('proxima'));
resetTask();const arbitrary=object('sirius');state.ship=Space.point(object('alpha').p3);state.current='alpha';assert.equal(routeLabelDistance(arbitrary),distanceText(Cosmology.physicalDistance(state.ship,arbitrary)));assert.notEqual(routeLabelDistance(arbitrary),distanceText(arbitrary.d));
width=1200;height=900;MapLabels.begin();circleLabel('ship-reach','x','y',{x:350,y:450},100);const label=MapLabels.queue.find(q=>q.key==='ship-reach');assert.equal(label.candidates.length,1);assert.equal(label.candidates[0].y,340);
console.log('PASS burst rollback, source-relative distances and one circle-bound label anchor');
resetTask();cam.span=.00006;
for(const q of OrbitalMotion.planets){const E=OrbitalMotion.phase(q,2026.81);nearTask(OrbitalMotion.phase(q,2026.81+q.period),E,1e-11);nearTask(Math.hypot(...OrbitalMotion.vector(q,0)),q.a*OrbitalMotion.AU*(1-q.e),1e-12);nearTask(Math.hypot(...OrbitalMotion.vector(q,Math.PI)),q.a*OrbitalMotion.AU*(1+q.e),1e-12);}
const positions=OrbitalMotion.alphaPositions(),next=OrbitalMotion.alphaPositions(OrbitalMotion.epoch+1);assert.notEqual(JSON.stringify(positions.alpha),JSON.stringify(next.alpha));nearTask(1.1055*positions.alpha.x+.9373*positions['hyg-71453'].x+.1221*positions.proxima.x,(1.1055+.9373+.1221)*OrbitalMotion.alphaAnchor[0],1e-12);
for(const q of NuclearStars.rows.filter(q=>q.e<1)){const E=NuclearStars.phase(q),M=(((NuclearStars.epoch-q.peri)/NuclearStars.period(q)%1)*2*Math.PI+2*Math.PI)%(2*Math.PI);nearTask(E-q.e*Math.sin(E),M,1e-11);}
state.universeElapsed=2;state.proper=.01;assert.equal(OrbitalMotion.elapsed(),2);assert.equal(OrbitalMotion.position(object('s111')),null);const nuclearBefore=JSON.stringify(object('s2').p3),moving=MapLayout.project(object('s2'));state.universeElapsed+=1;assert.notEqual(JSON.stringify(MapLayout.project(object('s2'))),JSON.stringify(moving));assert.equal(JSON.stringify(object('s2').p3),nuclearBefore);const fixedYear=OrbitalMotion.elapsed();Simulation.advance(2);assert.equal(OrbitalMotion.elapsed(),fixedYear);
console.log('PASS Kepler periods/pericenter/apocenter, high-e roots, triple barycenter, observer clocks and pause; hyperbola and navigation reference retained');
resetTask();state.selected='proxima';FlightBuilder.open();
assert.equal(Number($('parameter-enginePowerW').value),3000);
const builderQuery=document.querySelectorAll,numericInputs=[];
document.querySelectorAll=selector=>selector==='#flightBuilder input[type="number"]'?numericInputs:builderQuery(selector);
function editParameterTask(key,value){
 const e=$('parameter-'+key),scale=FlightBuilder.parameterScale(key),[,min,max]=ShipPhysics.fields[key];
 e.type='number';e.dataset.setup=key;e.checkValidity=()=>e.value!==''&&Number.isFinite(Number(e.value))&&Number(e.value)>=min/scale&&Number(e.value)<=max/scale&&(!ShipPhysics.positiveFields.has(key)||Number(e.value)>0);
 if(!numericInputs.includes(e))numericInputs.push(e);e.value=String(value);FlightBuilder.changed(e);return e;
}
for(const key of ['maxAccelerationG','maxBrakingG'])for(const value of [11,25.5,100,100000]){
 const input=editParameterTask(key,value);assert.equal(Number(input.value),value);assert.equal(FlightBuilder.draft[key],value);assert.ok(input.checkValidity());assert.equal($('applyFlightSetup').disabled,false);assert.equal($('launchConfigured').disabled,false);assert.notEqual($('builderProper').textContent,'—');assert.ok($('builderRouteDiagram').innerHTML.includes('data-sampled="true"'));
}
for(const key of ['maxAccelerationG','maxBrakingG'])assert.equal(FlightSetup.normalize({[key]:.00001})[key],.00001);
editParameterTask('maxAccelerationG',2);assert.equal(FlightBuilder.draft.maxAccelerationG,2);
for(const terawatts of [.001,3.5,3000]){
 editParameterTask('enginePowerW',terawatts);assert.equal(FlightBuilder.draft.enginePowerW,terawatts*1e12);FlightBuilder.apply();assert.equal(FlightSetup.read().enginePowerW,terawatts*1e12);state=restore(JSON.parse(JSON.stringify(state)));FlightBuilder.open();assert.equal(Number($('parameter-enginePowerW').value),terawatts);
}
document.querySelectorAll=builderQuery;
console.log('PASS arbitrary positive acceleration/braking values survive normalization and builder input without clipping; buttons/forecast/curve active; terawatt power survives reload in SI');
assert.equal(FlightSetup.normalize({}).diffraction,true);
for(const id of ['proxima','sirius']){
 resetTask();state.selected=id;
 const normal=FlightSetup.normalize({...FlightSetup.defaults(),collectorDiameterM:100000,collectorMinAu:1,arrivalFuelPercent:0}),ideal={...normal,diffraction:false},on=MissionPlanner.preview(normal),off=MissionPlanner.preview(ideal);
 assert.ok(on.valid,on.reason);assert.ok(off.valid,off.reason);assert.ok(off.proper<on.proper,'ideal beam changes ETA');assert.equal(off.acceleration.diffraction.enabled,false);assert.notEqual(off.acceleration.lightEndReason,'negligible');
 assert.ok(off.acceleration.rows.every(q=>q.a<=10*G0*(1+1e-8)));
 state.flightSetup=ideal;MissionPlanner.launch(off);Simulation.tick(off.accelerationEnd.proper*.2);state=restore(JSON.parse(JSON.stringify(state)));assert.equal(FlightSetup.read().diffraction,false);FlightBuilder.open();assert.ok($('builderPhysicsNote').textContent.includes('Дифракция отключена'));assert.ok($('builderOpticsDiagram').innerHTML.includes('идеальный пучок'));
 for(let i=0;state.flight&&i<12;i++)Simulation.tick(FlightEstimate.get().proper);
 assert.ok(!state.flight);nearTask(state.proper,off.proper);nearTask(state.earth,off.earth);nearTask(state.matter*1000,off.arrivalFuelKg);
}
resetTask();state.current='alpha';state.ship=Space.point(object('alpha').p3);
let idealFlash=null;
for(const profile of ['iip','ia','ibc']){
 const c=FlightSetup.normalize({...FlightSetup.defaults(),engine:false,burst:true,burstSpectrum:profile,diffraction:false}),a=MissionPlanner.acceleration(c,object('alpha'),1,1e8,0,false,false);
 assert.equal(a.lightEndReason,'pulse');nearTask(a.rows.at(-1).source,c.burstDays/365.25,1e-12);assert.ok(a.rows.every(q=>q.a<=10*G0*(1+1e-8)));
 if(idealFlash)nearTask(a.rows.at(-1).beta,idealFlash.rows.at(-1).beta,1e-12);idealFlash=a;
}
console.log('PASS diffraction toggle changes full plans and actual flights, survives active reload and read-only UI; ideal flash retains source duration and 10g cap');
}`);
