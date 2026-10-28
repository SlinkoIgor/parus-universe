import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`{
state=initial();state.expansion=true;state.current='alpha';state.ship=Space.point(object('alpha').p3);state.selected='boss-wall';state.matter=.0004984;state.flightSetup=FlightSetup.normalize({engine:true,sail:true,collector:true,burst:true,arrivalFuelPercent:53.83});Cosmology.sync(state);
const p=MissionPlanner.preview(),q=p.accelerationEnd,a=p.acceleration,reception=MissionPlanner.lightReception(p);assert.ok(p.valid,p.reason);assert.ok(q.proper>10000&&q.proper<10300);assert.ok(reception.source<Stellar.pulseYears);assert.ok(Math.abs(reception.source*365.25-6.9167)<.01);assert.equal(reception.proper,q.proper);assert.ok(reception.stretch>2e6);assert.ok(q.a>0&&q.a<.001);
const motorEnd=a.rows.find(row=>row.mass<=1+1e-11);assert.ok(motorEnd&&motorEnd.proper<.2,'the engine does not burn fuel for ten thousand years');
const u=MissionPlanner.sampleAcceleration(a,q.proper*.3),v=MissionPlanner.sampleAcceleration(a,q.proper*.8),K=2*a.beamPower/(Rocket.c**2),left=Math.exp(v.eta)-Math.exp(u.eta),right=K*(v.source-u.source)*Rocket.year;
assert.ok(Math.abs(left/right-1)<1e-5,'independent constant-mass reflected-beam identity exp(etaB)-exp(etaA)=2P Δu/(mc²)');
const step=1e-3,mid=MissionPlanner.sampleAcceleration(a,q.proper*.5),lo=MissionPlanner.sampleAcceleration(a,mid.proper-step),hi=MissionPlanner.sampleAcceleration(a,mid.proper+step),rate=(hi.source-lo.source)/(2*step);assert.ok(Math.abs(rate/Math.exp(-mid.eta)-1)<1e-4,'du/dτ is the inverse receding Doppler stretch');
FlightBuilder.source=object('alpha');FlightBuilder.starAvailable=true;FlightBuilder.light=Stellar.stellarLight(FlightBuilder.source);FlightBuilder.readOnly=false;FlightBuilder.explain(p.setup,p);assert.match($('builderFlashNote').textContent,/6,92/);assert.match($('builderFlashNote').textContent,/10,1 тыс/);assert.match($('builderFlashNote').textContent,/расходимость/);
console.log('PASS screenshot plan: ~10102 onboard acceleration years receive only ~6.92 source days; engine ends early, analytic beam law, Doppler timing and explicit UI assumptions');
const c=FlightSetup.normalize({sail:true,collector:true,burst:true}),full=MissionPlanner.acceleration(c,object('alpha'),0,1e20,0,false,false),last=full.rows.at(-1),end=MissionPlanner.lightReception({setup:c,acceleration:full,accelerationEnd:last});
assert.ok(Math.abs(last.source-Stellar.pulseYears)<1e-12);assert.ok(Math.abs(end.source-Stellar.pulseYears)<1e-12);assert.equal(full.lightEndProper,full.proper);assert.ok(full.proper>1000&&Number.isFinite(full.proper));
const direct=MissionPlanner.acceleration({...c,collector:false},object('alpha'),0,1e20,0,false,false);assert.ok(direct.proper<full.proper);assert.ok(direct.rows.at(-1).source<=Stellar.pulseYears+1e-12);
console.log('PASS the full flash really ends at 30 source days; the huge reception tail depends on the ideal collimated collector');
}`);
