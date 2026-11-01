import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`{
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),a+' ≠ '+b);
const reset=()=>{OrbitalArrival.enabled=true;state=initial();state.current='alpha';state.ship=Space.point(object('alpha').p3);state.selected='andromeda';paused=true;Simulation.debt=Simulation.wallDebt=0;Cosmology.sync(state);};reset();
assert.equal(ShipPhysics.fields.divergenceDeg[0],2e-13);assert.equal(FlightSetup.read().divergenceDeg,2e-13);assert.equal(FlightSetup.read().burst,false);assert.equal(state.flightDefaultsVersion,2);
const oldPrefs={...initial(),flightDefaultsVersion:1,flightSetup:{...FlightSetup.defaults(),divergenceDeg:0,burst:true},departureMode:'burst'};state=restore(oldPrefs);assert.equal(FlightSetup.read().divergenceDeg,2e-13);assert.equal(FlightSetup.read().burst,false);
const customPrefs={...oldPrefs,flightSetup:{...oldPrefs.flightSetup,divergenceDeg:3e-12,capacityKg:2}};state=restore(customPrefs);assert.equal(FlightSetup.read().divergenceDeg,3e-12);assert.equal(FlightSetup.read().capacityKg,2);assert.equal(FlightSetup.read().burst,false);
state.current='alpha';state.ship=Space.point(object('alpha').p3);state.flightSetup={...FlightSetup.defaults(),divergenceDeg:0,burst:true};state=restore(JSON.parse(JSON.stringify(state)));assert.equal(FlightSetup.read().divergenceDeg,0,'new explicit choices survive reload');assert.equal(FlightSetup.read().burst,true);
console.log('PASS 2e-13 defaults, flash off, one-time preference migration, preserved custom geometry and explicit new choices');
reset();const setup={...FlightSetup.defaults(),burst:true},normal=MissionPlanner.preview({...setup,burst:false}),p=MissionPlanner.preview(setup),a=p.acceleration,b=a.preboost,r=MissionPlanner.lightReception(p);
assert.ok(p.valid,p.reason);assert.equal(p.model,5);assert.equal(b.model,1);near(b.preparationEnd.beta,.97,1e-12);near(b.preparationEnd.mass,2,1e-12);near(b.preparationEnd.burned,0,1e-12);near(b.waitingProper,2.456865207,1e-8);near(p.proper,30.45176159,1e-7);assert.ok(normal.proper>1200&&normal.proper<1300);assert.equal(p.setup.burstDays,30);assert.equal(p.setup.burstLuminosityW,1.2e35);assert.ok(a.rows.every(q=>q.a<=10*G0*(1+1e-10)));assert.ok(p.peakBeta>.97,'rendezvous speed is not a speed cap');
// The first flash catches the moving ship after the exact physical light path.
near(b.flashStart.earth-b.flashStart.distance,b.emissionOffsetYears,1e-12);near(b.emissionOffsetYears,b.explosionEarth+a.collectorSurvival.firstLightYears,1e-12);assert.ok(r.source<=a.collectorSurvival.usableSourceYears+1e-12);near(r.durationProper,r.proper-b.flashStart.proper,1e-12);
for(let i=0;i<a.rows.length;i++){
 const q=a.rows[i];near(q.source,q.earth-q.distance,3e-8);if(i)assert.ok(q.proper>a.rows[i-1].proper,'strictly increasing samples at phase boundaries');
}
const fAt=t=>({mission:p,missionElapsed:{proper:t,earth:MissionPlanner.sampleAcceleration(a,t).earth},missionStage:0,stageElapsed:t,missionSample:MissionPlanner.sampleAcceleration(a,t)});
state.phase='launch';assert.ok(MissionPlanner.sailOpening(fAt(b.preparationEnd.proper/2))>0);assert.equal(MissionPlanner.sailOpening(fAt((b.preparationEnd.proper+b.flashStart.proper)/2)),0);assert.ok(MissionPlanner.sailOpening(fAt(b.flashStart.proper+.01))>0);assert.equal(MissionPlanner.sailOpening(fAt(r.proper+.001)),0,'sail folds when acceleration is stopped');
for(const t of [b.preparationEnd.proper*.5,(b.preparationEnd.proper+b.flashStart.proper)/2,b.flashStart.proper+.2]){
 const h=1e-6,q=MissionPlanner.sampleAcceleration(a,t),lo=MissionPlanner.sampleAcceleration(a,t-h),hi=MissionPlanner.sampleAcceleration(a,t+h);near((hi.earth-lo.earth)/(2*h)/Math.cosh(q.eta),1,3e-4);near((hi.distance-lo.distance)/(2*h)/Math.sinh(q.eta),1,3e-4);near((hi.source-lo.source)/(2*h)/Math.exp(-q.eta),1,3e-3);
}
console.log('PASS continuous preboost/wait/flash clocks, fuel, independent null-coordinate and derivative identities, real beam distance, 10g and folding');
// Pause/reload each phase and cross the scheduled source explosion exactly.
MissionPlanner.launch(p);paused=true;Simulation.tick(b.preparationEnd.proper/2);assert.ok(!state.destroyed.includes('alpha'));assert.equal(CollectorSurvival.status(state.flight).phase,'preboost');
for(const t of [b.preparationEnd.proper/2,b.preparationEnd.proper+.01,(b.preparationEnd.proper+b.flashStart.proper)/2,b.flashStart.proper+.1]){
 Simulation.tick(Math.max(0,t-state.flight.missionElapsed.proper));paused=true;renderUI();
 if(t>b.preparationEnd.proper)assert.ok(state.destroyed.includes('alpha'),'source explodes after preparation');
 const snapshot=JSON.stringify({flight:state.flight,ship:state.ship,beta:state.beta,matter:state.matter,earth:state.earth,proper:state.proper});state=restore(JSON.parse(JSON.stringify(state)));assert.equal(JSON.stringify({flight:state.flight,ship:state.ship,beta:state.beta,matter:state.matter,earth:state.earth,proper:state.proper}),snapshot);
}
assert.match($('flightHint').textContent,/Отправленный ранее свет ещё разгоняет/);FlightBuilder.open();assert.match($('builderFlashNote').textContent,/Предразгон/);assert.equal($('builderMassBasis').textContent,'Поле учтено до вспышки');assert.match($('builderFlashNote').textContent,/включены в общее время/);assert.equal(Number($('parameter-divergenceDeg').value),2e-13);
for(let i=0;state.flight&&i<12;i++)Simulation.tick(FlightEstimate.get().proper);assert.equal(state.current,'andromeda');assert.equal(state.flight,null);near(state.proper,p.proper,1e-10);near(state.earth,p.earth,1e-10);near(state.matter*1000,p.arrivalFuelKg,1e-8);
console.log('PASS scheduled explosion, all phase reloads, live status and builder, executed arrival equals forecast and exact mass balance');
reset();state.selected='ring';const ring=MissionPlanner.preview(setup);assert.ok(ring.valid,ring.reason);assert.ok(ring.proper>88000&&ring.proper<90000);assert.ok(ring.acceleration.preboost.flashStart.beta<.97,'cosmological coasting redshifts momentum');
for(const [id,range] of [['sgr',[19,20]],['barnard',[11,12]]]){reset();state.selected=id;const q=MissionPlanner.preview(setup);assert.ok(q.valid,q.reason);assert.ok(q.proper>range[0]&&q.proper<range[1]);if(id==='barnard'){assert.equal(MissionPlanner.burstScheduled(q),false);MissionPlanner.launch(q);Simulation.tick(q.proper);for(let i=0;state.flight&&i<8;i++)Simulation.tick(FlightEstimate.get().proper);assert.ok(!state.destroyed.includes('alpha'));}}
reset();const weak=MissionPlanner.preview({...setup,collectorDiameterM:100000,collectorMinAu:1});assert.equal(weak.valid,false);assert.match(weak.reason,/предразгона/);assert.equal(MissionPlanner.preview({...setup,sail:false,collector:false}).valid,true);
// Cancel before and after the explosion restores the same complete snapshot.
for(const t of [b.preparationEnd.proper/2,b.flashStart.proper+.1]){reset();state.flightSetup=setup;const before=JSON.stringify([state.current,state.ship,state.proper,state.earth,state.matter,state.destroyed,state.flightSetup,state.flightHistory]);MissionPlanner.launch(p);Simulation.tick(t);FlightHistory.cancel();assert.equal(JSON.stringify([state.current,state.ship,state.proper,state.earth,state.matter,state.destroyed,state.flightSetup,state.flightHistory]),before);}
console.log('PASS Ring and Galactic-centre milestones, short trip keeps star, weak preboost rejected, no-collector branch and full cancellation before/after explosion');
// Generate an actual old model-4 fixture using the single-flash integrator.
reset();const combined=MissionPlanner.acceleration;let legacy;
try{MissionPlanner.acceleration=MissionPlanner.accelerationSegment;legacy=MissionPlanner.plan({...setup,divergenceDeg:0},object('alpha'),object('andromeda'));legacy.model=4;}finally{MissionPlanner.acceleration=combined;}
assert.ok(legacy.valid);assert.equal(legacy.acceleration.preboost,undefined);MissionPlanner.launch(legacy);Simulation.tick(.01);state.flightDefaultsVersion=1;const saved=JSON.stringify(state.flight.mission),clocks=JSON.stringify([state.proper,state.earth,state.beta,state.matter,state.ship]);state=restore(JSON.parse(JSON.stringify(state)));assert.equal(JSON.stringify(state.flight.mission),saved);assert.equal(JSON.stringify([state.proper,state.earth,state.beta,state.matter,state.ship]),clocks);assert.equal(FlightSetup.read().divergenceDeg,0);assert.ok(FlightSetup.read().burst);FlightBuilder.open();assert.ok(!$('builderFlashNote').textContent.includes('Предразгон'));assert.equal($('builderMassBasis').textContent,'В модели вспышки поле отключено');
console.log('PASS old active model-4 trajectories, angle, burst, clocks and mass stay frozen after preference migration');
}`);
