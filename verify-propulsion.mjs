import fs from 'node:fs';import assert from 'node:assert/strict';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`
function resetDrive(){OrbitalArrival.enabled=false;state=initial();state.expansion=false;paused=false;speed=1;Simulation.debt=0;Simulation.wallDebt=0;delete Simulation.smoothedFactor;Cosmology.sync(state);FlightEstimate.idleKey=null;FlightEstimate.active=new WeakMap();FlightProfile.idleKey=null;}
function nearDrive(a,b,tol=1e-7){assert.ok(Math.abs(a-b)<=tol*Math.max(Math.abs(a),Math.abs(b),1e-20)+1e-12,a+' vs '+b);}
function completeDrive(){let n=0;while(state.flight&&n++<24)Simulation.step(1e12);assert.ok(!state.flight,'flight terminates');assert.ok(state.matter>=-1e-12&&state.matter<=.001+1e-12);assert.equal(state.beta,0);}
resetDrive();assert.equal(Rocket.dryMass,.001);assert.equal(Rocket.fuelCapacity,.001);assert.equal(state.matter,.001);nearDrive(SHIP.sailMassKg,.7853981633974483);assert.equal(Stellar.collectorDiameterM,1000);renderUI();assert.equal($('dryMass').innerHTML,'1<small>кг</small>');assert.equal($('massDry').style.width,'50%');assert.equal($('massFuel').style.width,'50%');
const normalSun=Stellar.stellarLight(object('sol')),normalProxima=Stellar.stellarLight(object('proxima'));assert.equal(normalSun.solar,1);nearDrive(normalProxima.solar,.00155);assert.equal(normalProxima.estimated,false);
const unknownLight=Stellar.stellarLight({id:'test-red',spectral:'M5V',visualLuminositySolar:1e20});assert.equal(unknownLight.estimated,true);assert.equal(unknownLight.solar,.01,'V luminosity must not masquerade as bolometric');assert.ok(Stellar.stellarLight(object('betelgeuse')).collectorR>Stellar.r0);
assert.equal(GasMedium.forLeg(object('sol'),object('m87')).n,1e6);assert.equal(GasMedium.forLeg(object('sol'),object('local-void')).n,1e6);assert.equal(GasMedium.forLeg(object('sol'),object('cygnus')).n,1e6);assert.equal(GasMedium.forLeg(object('m87'),object('sol')).n,1e6);
console.log('PASS 1 kg dry mass, 1 kg tank, Si3N4 mass, fixed collector, catalog/fallback luminosity and uniform gas');

for(const m of [1,1.5,1.9,2])for(const beta of [.0001,.01,.1,.6,.99999,.99999999])for(const n of [1,1e3,1e6]){
 const k=Magnetic.rho(n)*SHIP.sailAreaM2,p=HybridBrake.plan(m,beta,k);assert.ok(p.proper>0&&Number.isFinite(p.proper));assert.ok(p.finalMass>=1-1e-10&&p.finalMass<=2+1e-10);nearDrive(m+p.captured-p.burned,p.finalMass,1e-11);
 for(const phase of [0,.1,.5,.9,.999,1]){const q=HybridBrake.sampleProper(p,p.proper*phase);assert.ok(q.mass>=1-1e-10&&q.mass<=2+1e-10);assert.ok(q.properAcceleration>=-100*G0*(1+1e-10));assert.ok(q.enginePower<=Rocket.power);nearDrive(m+q.captured-q.burned,q.mass,1e-10);}
 const time=p.proper*.45,step=p.proper*1e-6,q=HybridBrake.sampleProper(p,time),r=HybridBrake.sampleProper(p,time+step),gamma=1/Math.sqrt((1-q.beta)*(1+q.beta));
 nearDrive((r.distance-q.distance)/(r.earth-q.earth),q.beta,3e-5);nearDrive((r.earth-q.earth)/(r.proper-q.proper),gamma,3e-5);
 const etaA=Math.atanh(q.beta),etaB=Math.atanh(r.beta),incoming=p.q*Math.sinh(etaA)*q.opening,burn=q.burnRate;
 nearDrive((r.mass-q.mass)/(step*Rocket.year),incoming-burn,3e-4);
 nearDrive((etaB-etaA)/(step*Rocket.year),q.properAcceleration/Rocket.c,3e-4);
}
const benchmark=HybridBrake.plan(1,.99999,Magnetic.rho(1e6)*SHIP.sailAreaM2);assert.ok(benchmark.proper>0&&benchmark.proper<39);assert.ok(benchmark.burned>0);const gasOnly=Magnetic.plan(1,.99999,Magnetic.rho(1e6)*SHIP.sailAreaM2);assert.ok(benchmark.proper<gasOnly.proper/20);const topped=HybridBrake.plan(2,.01,Magnetic.rho(1e6)*SHIP.sailAreaM2);assert.ok(topped.proper<.001&&topped.finalMass>1.98);
console.log('PASS differentiated hybrid trajectories, fuel balance, nonnegative terminal tank, thermal/engine limits and braking-policy comparisons');

for(const mode of ['engine','beam','burst']){
 resetDrive();state.departureMode=mode;if(mode==='burst'){state.current='proxima';state.ship=Space.point(object('proxima').p3);}state.selected='alpha';const eta=FlightEstimate.get(),fuel=state.matter;launch();if(mode!=='engine'){assert.equal(state.matter,fuel);assert.equal(state.flight.wind.massKg,2);assert.equal(state.destroyed.includes(mode==='burst'?'proxima':'sol'),mode==='burst');assert.equal(state.flight.wind.continuous,mode==='beam');}
 completeDrive();assert.equal(state.current,'alpha');nearDrive(state.proper,eta.proper,1e-7);nearDrive(state.earth,eta.earth,1e-7);assert.ok(state.earth>=state.proper);
}
resetDrive();state.departureMode='beam';state.selected='m87';const longBeam=windPlan();assert.ok(longBeam.rows.at(-1).source>Stellar.pulseYears);assert.equal(longBeam.continuous,true);
resetDrive();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.departureMode='burst';state.selected='m87';const flash=windPlan();assert.ok(flash.rows.at(-1).source<=Stellar.pulseYears*(1+1e-12));assert.ok(flash.beamPower>longBeam.beamPower*1e6);
// A different selected mode must invalidate both ETA and stage-profile caches.
resetDrive();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.departureMode='beam';state.selected='alpha';const beamETA=FlightEstimate.get();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.departureMode='burst';assert.notEqual(FlightEstimate.get().proper,beamETA.proper);
for(const mode of ['beam','burst']){
 resetDrive();state.departureMode=mode;if(mode==='burst'){state.current='proxima';state.ship=Space.point(object('proxima').p3);}state.selected='m87';state.expansion=true;Cosmology.sync(state);const eta=FlightEstimate.get();launch();completeDrive();assert.equal(state.current,'m87');nearDrive(state.proper,eta.proper,1e-6);nearDrive(state.earth,eta.earth,1e-6);
}
// Short routes and low fuel are valid; the ETA reports the actual remaining fuel.
resetDrive();state.departureMode='beam';state.matter=.00005;state.selected='proxima';const shortETA=FlightEstimate.get();assert.ok(Number.isFinite(shortETA.proper));assert.ok(!shortETA.unreachable);assert.ok(shortETA.arrivalFuelKg<.9);launch();assert.ok(state.flight);completeDrive();assert.equal(state.current,'proxima');nearDrive(state.matter*1000,shortETA.arrivalFuelKg,1e-6);
// Solar bursts are blocked even if a stale selection bypasses the button.
resetDrive();state.departureMode='burst';launch();assert.equal(state.flight,null);assert.ok(!state.destroyed.includes('sol'));assert.equal(canBoost('burst'),false);assert.equal(canBoost('beam'),true);assert.throws(()=>Stellar.sourcePlan(object('sol'),'burst',2,100));
const badSolarSave={...initial(),version:10,departureMode:'burst',destroyed:['sol','proxima']};state=restore(badSolarSave);assert.equal(state.departureMode,'beam');assert.ok(!state.destroyed.includes('sol'));assert.ok(state.destroyed.includes('proxima'));
console.log('PASS short low-fuel route and arrival-fuel prediction; Solar burst UI, launch, physical-plan and save guards');
console.log('PASS all three modes, retained light-flight fuel, continuous source versus finite flash, physical stops and both ETA clocks');

for(const mode of ['engine','beam','burst']){
 resetDrive();state.departureMode=mode;if(mode==='burst'){state.current='proxima';state.ship=Space.point(object('proxima').p3);}state.selected='alpha';launch();Simulation.step((state.flight.wind?.proper||state.flight.engine.burnProper)*.001);const snapshot=JSON.parse(JSON.stringify(state)),before={beta:state.beta,proper:state.proper,earth:state.earth,position:JSON.stringify(state.ship.p3),fuel:state.matter};state=restore(snapshot);assert.equal(state.beta,before.beta);assert.equal(state.proper,before.proper);assert.equal(state.earth,before.earth);assert.equal(JSON.stringify(state.ship.p3),before.position);assert.equal(state.matter,before.fuel);completeDrive();assert.equal(state.current,'alpha');
}
resetDrive();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.departureMode='burst';state.selected='m87';launch();Simulation.step(.0001);const oldSave=JSON.parse(JSON.stringify(state));oldSave.version=9;oldSave.matter=.42e-9;oldSave.sail=2;oldSave.lightModel=3;const position=JSON.stringify(oldSave.ship.p3),oldTime=oldSave.proper;state=restore(oldSave);assert.equal(state.version,13);assert.equal(state.sail,0);nearDrive(state.matter,.00042);assert.equal(state.proper,oldTime);assert.equal(JSON.stringify(state.ship.p3),position);assert.equal(state.flight.wind.massKg,1.42);
resetDrive();state.departureMode='beam';state.selected='alpha';launch();while(state.phase==='launch')Simulation.step(1e12);Simulation.step(state.flight.magnetic.proper/3);const braking=JSON.parse(JSON.stringify(state));state=restore(braking);completeDrive();assert.equal(state.current,'alpha');
// v10 braking resumes with new physics, without rescaling kilograms or teleporting.
resetDrive();state.departureMode='beam';state.selected='alpha';HybridBrake.reserve=.9;launch();while(state.phase==='launch')Simulation.step(1e12);Simulation.step(state.flight.magnetic.proper*.1);const reserveSave=JSON.parse(JSON.stringify(state));reserveSave.version=10;HybridBrake.reserve=0;state=restore(reserveSave);assert.equal(state.matter,reserveSave.matter);assert.equal(JSON.stringify(state.ship.p3),JSON.stringify(reserveSave.ship.p3));assert.equal(state.proper,reserveSave.proper);completeDrive();assert.equal(state.current,'alpha');
// An old solar flash is cut off, preserving existing speed and clocks.
resetDrive();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='alpha';state.departureMode='burst';launch();Simulation.step(.0001);const solarFlight=JSON.parse(JSON.stringify(state));solarFlight.version=10;solarFlight.flight.fromId='sol';solarFlight.destroyed=['sol'];state=restore(solarFlight);assert.equal(state.phase,'cruise');assert.equal(state.beta,solarFlight.beta);assert.equal(state.proper,solarFlight.proper);assert.ok(!state.destroyed.includes('sol'));
console.log('PASS v11 reload during every propulsion mode and braking; v9 migration preserves fuel fraction, position, velocity and clocks');

// Frame partitions must not change capture, consumption, time, or arrival.
function partitionTrip(step){resetDrive();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.departureMode='burst';state.selected='alpha';launch();let n=0;while(state.flight&&n++<5000)Simulation.step(step);assert.equal(state.current,'alpha');return[state.proper,state.earth,state.matter,state.captured,state.spentEnergy,state.totalDistance];}
const giantStep=partitionTrip(1e12),smallSteps=partitionTrip(.1);for(let i=0;i<giantStep.length;i++)nearDrive(giantStep[i],smallSteps[i],2e-6);
resetDrive();state.departureMode='engine';state.selected='m87';launch();Simulation.step(state.flight.engine.burnProper);assert.equal(state.phase,'cruise');assert.equal(Simulation.slowMotionFactor(),1);paused=true;const pausedClock=state.proper;Simulation.advance(1);assert.equal(state.proper,pausedClock);
nearDrive(Gravity.deflection(.99,10)*180/Math.PI,12.84017946,1e-7);assert.equal(Gravity.deflection(.99,1.5),Infinity);
resetDrive();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.current='proxima';state.ship=Space.point(object('proxima').p3);state.departureMode='burst';state.itinerary=[{id:'sgr',mode:'flyby'},{id:'m87',mode:'stop'}];assert.ok(Route.analyze().valid);Route.start();let turns=0;while(state.phase!=='flyby'&&state.flight&&turns++<12)Simulation.step(1e9);assert.equal(state.phase,'flyby');completeDrive();assert.equal(state.current,'m87');assert.ok(state.visited.includes('sgr'));
console.log('PASS frame-independent trajectories and accounting, pause/coast replay, and black-hole route continuation');
`);
const html=fs.readFileSync('dist/index.html','utf8'),ids=new Set([...html.matchAll(/id="([^" ]+)"/g)].map(m=>m[1]));for(const [,id]of fs.readFileSync('dist/app.js','utf8').matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(id)||['startExploring','confirmReset','viewGalaxy','viewRegion','viewSystem','viewLocalStar','viewUnknown','viewNuclearCluster'].includes(id),'missing '+id);
assert.deepEqual([...html.matchAll(/data-departure="([^"]+)"/g)].map(m=>m[1]),['engine','beam','burst']);assert.ok(!html.includes('data-sail='));
console.log('PASS three-mode UI and every application element ID');

run(`
for(const fuel of [0,Number.EPSILON*Rocket.dryMass,1e-18,1e-17]){
 resetDrive();state.current='hyg-104751';state.ship=Space.point(object(state.current).p3);state.selected='hyg-67711';state.matter=fuel;
 const p=Rocket.plan(fuel);assert.equal(p.beta,0);assert.equal(p.budget,0);assert.equal(p.burnProper,0);assert.equal(FlightEstimate.get(),null);
 renderUI();assert.equal($('launchBtn').disabled,true);launch();assert.equal(state.flight,null);
}
assert.ok(Rocket.plan(1e-12).beta>0,'small real fuel remains usable');
console.log('PASS numerical fuel residue cannot enable engine launch or create astronomical ETA');
`);
