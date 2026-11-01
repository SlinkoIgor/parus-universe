import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`{
OrbitalArrival.enabled=true;state=initial();state.current='alpha';state.ship=Space.point(object('alpha').p3);state.selected='andromeda';Cosmology.sync(state);
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),a+' ≠ '+b);
const base=FlightSetup.normalize({...FlightSetup.defaults(),engine:false,burst:true,diffraction:false});
for(const id of ['alpha','proxima','betelgeuse']){
 const star=object(id),light=ShipPhysics.run(base,()=>Stellar.stellarLight(star)),s=CollectorSurvival.plan(light,30/365.25),a=MissionPlanner.accelerationSegment(base,star,0,1e8,0,false,false),last=a.rows.at(-1);
 const gap=light.collectorR-light.radiusM,window=gap*(1/30000000-1/Rocket.c)/Rocket.year;
 near(s.firstLightYears,gap/Rocket.c/Rocket.year,1e-14);near(s.destructionYears,gap/30000000/Rocket.year,1e-14);near(s.sourceWindowYears,window,1e-14);
 assert.equal(a.lightEndReason,'collector');near(a.lightEndSource,window,1e-12);near(last.source,window,1e-12);assert.equal(a.collectorSurvival.physicalPulseYears,30/365.25);
 const k=Rocket.c/(10*G0*Rocket.year),eta=-Math.log1p(-window/k);near(last.eta,eta,1e-8);near(last.proper,k*eta,1e-8);assert.ok(last.earth>window,'last photons arrive after collector destruction');assert.ok(a.rows.every(q=>q.a<=10*G0*(1+1e-10)));
 assert.equal(light.radiusEstimated,false);assert.ok(light.radiusBasis.includes('Каталожный'));
 if(id==='betelgeuse')near(window*365.25,4.952427037345809,1e-10);
}
const unknown=Stellar.stellarLight({id:'unknown',kind:'star',spectral:'G2V',facts:{lum:1}});assert.equal(unknown.radiusEstimated,true);assert.match(unknown.radiusBasis,/не индивидуальное измерение/);
const ranged=Stellar.stellarLight({kind:'star',facts:{lum:1,radius:'2–3 R☉'}});near(ranged.radiusSolar,3);assert.match(ranged.radiusBasis,/верхняя граница/);
const c={...base,collectorMinAu:1000},far=MissionPlanner.accelerationSegment(c,object('alpha'),0,1e8,0,false,false);assert.equal(far.lightEndReason,'pulse');near(far.lightEndSource,30/365.25,1e-12);assert.ok(far.collectorSurvival.sourceWindowYears>30/365.25);
for(const options of [{burst:false},{collector:false},{sail:false}]){
 const a=MissionPlanner.accelerationSegment({...base,...options,engine:true},object('alpha'),1,1e4,0,false,false);assert.equal(a.collectorSurvival,null);assert.notEqual(a.lightEndReason,'collector');
}
console.log('PASS ejecta/light travel from stellar surface across three stars, radius provenance/estimates/ranges, analytic 10g bound, full flash at distant collector and unaffected non-collector modes');
const activeSetup={...base,engine:true,diffraction:true,divergenceDeg:2e-13};
// Frozen model-4 fixture: new model-5 preboost lifecycle is in verify-preboost.
const combined=MissionPlanner.acceleration;let p;try{MissionPlanner.acceleration=MissionPlanner.accelerationSegment;p=MissionPlanner.plan(activeSetup,object('alpha'),object('andromeda'));p.model=4;}finally{MissionPlanner.acceleration=combined;}
const a=p.acceleration,r=MissionPlanner.lightReception(p),s=a.collectorSurvival;
assert.ok(p.valid,p.reason);assert.ok(a.proper>r.proper,'engine continues after last redirected photons');assert.equal(a.lightEndReason,'collector');near(r.source,s.usableSourceYears,1e-12);
let deathLo=0,deathHi=r.proper;for(let n=0;n<48;n++){const mid=(deathLo+deathHi)/2;if(MissionPlanner.sampleAcceleration(a,mid).earth<s.sourceWindowYears)deathLo=mid;else deathHi=mid;}const afterDeath=MissionPlanner.sampleAcceleration(a,(deathHi+r.proper)/2);assert.ok(afterDeath.earth>s.sourceWindowYears&&afterDeath.proper<r.proper,'ship still receives light after collector death in source frame');
state.phase='launch';const mock={mission:p,missionElapsed:{earth:afterDeath.earth},missionStage:0,stageElapsed:afterDeath.proper,missionSample:afterDeath};assert.deepEqual(CollectorSurvival.status(mock),{destroyed:true,receiving:true});assert.ok(MissionPlanner.sailOpening(mock)>0);
mock.stageElapsed=r.proper;mock.missionSample=MissionPlanner.sampleAcceleration(a,r.proper);assert.equal(MissionPlanner.sailOpening(mock),0);assert.deepEqual(CollectorSurvival.status(mock),{destroyed:true,receiving:false});
// The independently integrated null coordinate remains u = t - x/c through
// destruction, last reception, and the following engine-only acceleration.
for(const fraction of [.1,.5,.9]){
 const t=a.proper*fraction,h=t*1e-4,q=MissionPlanner.sampleAcceleration(a,t),lo=MissionPlanner.sampleAcceleration(a,t-h),hi=MissionPlanner.sampleAcceleration(a,t+h);near(q.source,q.earth-q.distance,1e-10);near((hi.source-lo.source)/(2*h)/Math.exp(-q.eta),1,3e-4);
}
state.flightSetup=activeSetup;MissionPlanner.launch(p);paused=true;Simulation.tick(afterDeath.proper);renderUI();assert.match($('flightHint').textContent,/Коллектор разрушен.*ещё разгоняет/);
FlightBuilder.open();assert.match($('builderFlashNote').textContent,/30,00/);assert.match($('builderFlashNote').textContent,/разрушится/);assert.match($('builderPhysicsNote').textContent,/2E[-−]13/);assert.equal(Number($('parameter-divergenceDeg').value),2e-13);
const frozen=JSON.stringify({flight:state.flight,ship:state.ship,beta:state.beta,matter:state.matter,proper:state.proper,earth:state.earth});state=restore(JSON.parse(JSON.stringify(state)));assert.equal(JSON.stringify({flight:state.flight,ship:state.ship,beta:state.beta,matter:state.matter,proper:state.proper,earth:state.earth}),frozen);renderUI();assert.match($('flightHint').textContent,/ещё разгоняет/);
Simulation.tick(r.proper-afterDeath.proper+1e-6);renderUI();assert.match($('flightHint').textContent,/Приём света завершён/);assert.equal(MissionPlanner.sailOpening(state.flight),0);
for(let i=0;state.flight&&i<12;i++)Simulation.tick(FlightEstimate.get().proper);assert.equal(state.flight,null);near(state.proper,p.proper,1e-10);near(state.earth,p.earth,1e-10);near(state.matter*1000,p.arrivalFuelKg,1e-9);
console.log('PASS photons after collector death, retarded cutoff/folding, engine continuation, UI status, tiny divergence, save/reload, arrival clocks and fuel');
state=initial();state.current='alpha';state.ship=Space.point(object('alpha').p3);state.selected='andromeda';const legacy=JSON.parse(JSON.stringify(p));delete legacy.acceleration.collectorSurvival;delete legacy.acceleration.lightEndReason;MissionPlanner.launch(legacy);paused=true;
const saved=JSON.stringify(state.flight.mission);Simulation.tick(.001);state=restore(JSON.parse(JSON.stringify(state)));assert.equal(JSON.stringify(state.flight.mission),saved);assert.equal(CollectorSurvival.status(state.flight),null);FlightBuilder.open();assert.match($('builderFlashNote').textContent,/без разрушения коллектора/);
console.log('PASS historical active plans stay frozen and explicitly identify the absence of collector destruction');
}`);
