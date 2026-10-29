import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`{
OrbitalArrival.enabled=true;state=initial();state.expansion=true;state.current='alpha';state.ship=Space.point(object('alpha').p3);state.selected='boss-wall';state.matter=.0004984;state.flightSetup=FlightSetup.normalize({engine:true,sail:true,collector:true,burst:true,arrivalFuelPercent:53.83});Cosmology.sync(state);
const p=MissionPlanner.preview(),q=p.accelerationEnd,a=p.acceleration,reception=MissionPlanner.lightReception(p);assert.ok(p.valid,p.reason);assert.equal(p.model,3);assert.ok(a.diffraction);assert.ok(q.proper>.5&&q.proper<.8);assert.ok(q.beta>.9&&q.beta<.99);assert.ok(Math.abs(reception.source*365.25-30)<1e-8);assert.equal(reception.proper,q.proper);assert.ok(p.proper>1e9,'diffraction must also change the total ETA');
const motorEnd=a.rows.find(row=>row.mass<=1+1e-11);assert.ok(motorEnd&&motorEnd.proper<q.proper);
for(const fraction of [.1,.3,.5,.8]){
 const t=q.proper*fraction,h=t*1e-4,mid=MissionPlanner.sampleAcceleration(a,t),lo=MissionPlanner.sampleAcceleration(a,t-h),hi=MissionPlanner.sampleAcceleration(a,t+h),rate=(hi.source-lo.source)/(2*h);
 assert.ok(Math.abs(rate/Math.exp(-mid.eta)-1)<2e-4,'du/dτ remains the inverse receding Doppler stretch');
 assert.ok(Math.abs(mid.source-(mid.earth-mid.distance))<1e-10,'retarded source clock closes independently');
}
FlightBuilder.source=object('alpha');FlightBuilder.starAvailable=true;FlightBuilder.light=Stellar.stellarLight(FlightBuilder.source);FlightBuilder.readOnly=false;FlightBuilder.explain(p.setup,p);assert.match($('builderFlashNote').textContent,/30,00/);assert.match($('builderPhysicsNote').textContent,/Дифракция учтена/);assert.ok(!$('builderFlashNote').textContent.includes('не учитывается'));
console.log('PASS previous screenshot scenario now has a <1 year diffracted flash acceleration, full 30 source days, finite Doppler stretch and recomputed billion-year ETA');
const speeds=[];
for(const profile of ['iip','ia','ibc']){
 const c=FlightSetup.normalize({sail:true,collector:true,burst:true,burstSpectrum:profile}),full=MissionPlanner.acceleration(c,object('alpha'),0,1e20,0,false,false),last=full.rows.at(-1),end=MissionPlanner.lightReception({setup:c,acceleration:full,accelerationEnd:last});
 assert.ok(Math.abs(last.source-Stellar.pulseYears)<1e-12);assert.equal(full.lightEndReason,'pulse');assert.equal(full.lightEndProper,full.proper);assert.ok(full.proper>Stellar.pulseYears&&full.proper<1);assert.ok(end.stretch>1);speeds.push(last.beta);
 for(const row of full.rows)assert.ok(row.a<=100*9.80665*(1+1e-12));
 // In the uncapped constant-mass tail, d exp(η)/du = 2P/(mc²).
 const t=full.proper*.7,h=t*1e-4,mid=MissionPlanner.sampleAcceleration(full,t),lo=MissionPlanner.sampleAcceleration(full,t-h),hi=MissionPlanner.sampleAcceleration(full,t+h),lhs=(Math.exp(hi.eta)-Math.exp(lo.eta))/(hi.source-lo.source),P=full.beamPower*BeamOptics.fraction(mid.distance*LY,mid.source,full.diffraction.spectrum),rhs=2*P/(mid.mass*Rocket.c**2)*Rocket.year;
 assert.ok(Math.abs(lhs/rhs-1)<3e-4,'diffracted force satisfies an independent reflected-photon identity');
}
assert.ok(Math.max(...speeds)-Math.min(...speeds)>.01,'different spectral types must affect propulsion');
console.log('PASS II-P/Ia/Ib-c evolution changes speed, exact last photons, total 100g cap and independent photon-momentum differential identity');
const c=FlightSetup.normalize({sail:true,collector:true}),continuous=MissionPlanner.acceleration(c,object('sol'),1,1e20,0,false,false),last=continuous.rows.at(-1),K=last.mass*Rocket.c**2*2*Math.sinh(last.eta/2)**2;
assert.equal(continuous.lightEndReason,'negligible');assert.ok(BeamOptics.remainingWork(continuous.beamPower,last.distance*LY,continuous.diffraction.spectrum)<1e-4*K);assert.ok(last.beta<.01);
const ideal=Stellar.sourcePlan(object('alpha'),'burst',1,1e20);assert.ok(ideal.proper>1000,'legacy ideal-beam integrator retained only for saved/legacy paths');
MissionPlanner.launch(p);Simulation.tick(q.proper*.4);const before=JSON.stringify({flight:state.flight,beta:state.beta,matter:state.matter,proper:state.proper,earth:state.earth,ship:state.ship});state=restore(JSON.parse(JSON.stringify(state)));assert.equal(JSON.stringify({flight:state.flight,beta:state.beta,matter:state.matter,proper:state.proper,earth:state.earth,ship:state.ship}),before);Simulation.tick(FlightEstimate.get().proper);assert.equal(state.flight,null);assert.equal(state.current,'boss-wall');assert.ok(Math.abs(state.proper-p.proper)<p.proper*1e-10);
console.log('PASS bounded continuous-light tail, conservative work cutoff, active diffracted plan reload and execution to BOSS');
}`);
