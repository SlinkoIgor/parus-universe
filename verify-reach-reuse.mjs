import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#reach-reuse');
run(`{
 state=initial();state.current='alpha';state.ship=Space.point(object('alpha').p3);state.selected='huge-lqg';state.flightSetup={...FlightSetup.defaults(),burst:true};Cosmology.sync(state);
 const plan=MissionPlanner.preview();assert.ok(plan.valid,plan.reason);assert.ok(plan.coast.proper>100000);MissionPlanner.launch(plan);paused=true;speed=1000;Simulation.debt=Simulation.wallDebt=0;
 const original=MissionPlanner.plan;let probes=0;
 MissionPlanner.plan=function(c,source,target,...args){if(target?.rangeProbe)probes++;return original.call(this,c,source,target,...args);};
 const assertFeasible=q=>{
  const p=original.call(MissionPlanner,q.setup,null,{id:'reuse-certificate-check',kind:'structure',rangeProbe:true,navigable:true,p3:[q.comoving,0,0]},state.matter*1000,Space.point([0,0,0]),state.cosmicTime,true,state.beta,null,true);
  assert.ok(p.valid,p.reason);assert.ok(p.arrivalFuelKg>=q.setup.capacityKg*q.setup.arrivalFuelPercent/100-1e-8);
 };
 try{
  // The endpoint of scheduled acceleration is already known, so its one
  // certificate can also be carried across the transition into free flight.
  Simulation.tick(plan.accelerationEnd.proper*.5);const acceleration=MissionReach.active(),coldProbes=probes;
  assert.ok(coldProbes>0&&acceleration.remainingAcceleration>0);
  const f=state.flight,reference=MissionReach.coastCache.get(f),certificate=reference.plan;
  assert.ok(certificate?.valid&&certificate.brake.valid,'retain the actual feasible braking plan');
  const witnessBefore=JSON.stringify(certificate),physicalBefore=JSON.stringify(state);
  for(let i=0;i<20;i++)MissionReach.active();
  assert.equal(probes,coldProbes);assert.equal(JSON.stringify(state),physicalBefore);
  Simulation.tick(plan.accelerationEnd.proper*.5+plan.coast.proper*.4);assert.equal(state.phase,'cruise');
  const entered=shipReachability();assert.equal(probes,coldProbes,'acceleration and free flight share the certified endpoint');assertFeasible(entered);
  paused=false;
  for(let i=0;i<360;i++){
   Simulation.advance(1/60);const before=JSON.stringify(state),q=shipReachability(),sample=f.missionSample;
   assert.equal(probes,coldProbes,'1000x free flight must never repeat a range probe');
   assert.equal(q.comoving,reference.q.comoving-sample.comoving);
   assert.equal(q.upper,reference.q.upper-sample.comoving);
   assert.equal(q.radius,q.comoving*Cosmology.scale());assert.equal(q.epoch,state.cosmicTime);assert.equal(q.beta,state.beta);
   assert.ok(q.witness.proper>0&&q.witness.arrivalFuelKg>=.5-1e-8);
   assert.equal(JSON.stringify(state),before,'reading the envelope cannot edit the flight');
   if(i===179){state.selected='sol';cam={x:1e9,y:-1e9,span:1e100};speed=.5;}
   if(i===180)speed=1000;
  }
  paused=true;const later=shipReachability();assertFeasible(later);assert.equal(JSON.stringify(certificate),witnessBefore,'reusing a prefix must not alter its stop plan');
  const fixed=JSON.stringify(later);for(let i=0;i<30;i++)assert.equal(JSON.stringify(shipReachability()),fixed);
  assert.equal(probes,coldProbes,'pause, camera, selection and time rate cannot invalidate a feasible coast');
  // The cache is transient. An ordinary saved flight reconstructs its same
  // remaining feasible distance, with no change to clocks, fuel or trajectory.
  ExtendedCatalog.capture(state);const saved=JSON.stringify(state),range=later.comoving;
  state=restore(JSON.parse(saved));Cosmology.sync(state);assert.equal(shipReachability().comoving,range);assert.equal(JSON.stringify(state),saved);
  assert.notEqual(state.flight,f);assert.ok(!JSON.stringify(state).includes('coastCache'));
  // A changed braking requirement needs its own certificate; it must still
  // honour the requested reserve rather than preserve the old 50% envelope.
  state.flight.mission.setup.arrivalFuelPercent=75;const previousProbes=probes,changed=shipReachability();
  assert.ok(probes>previousProbes);assert.equal(changed.setup.arrivalFuelPercent,75);assertFeasible(changed);
  const stable=probes;for(let i=0;i<30;i++)MissionReach.active();assert.equal(probes,stable);
  // A fuel/momentum/epoch that no longer follows the recorded free trajectory
  // must not use that old certificate, even if the setup object is unchanged.
  const current=state.flight,matter=state.matter,beta=state.beta,time=state.cosmicTime;
  state.matter=matter>0?matter*.9:.00001;MissionReach.active();assert.equal(MissionReach.coastCache.has(current),false);state.matter=matter;
  MissionReach.active();state.beta*=.99;MissionReach.active();assert.equal(MissionReach.coastCache.has(current),false);state.beta=beta;
  MissionReach.active();state.cosmicTime+=1e6;Cosmology.sync(state);MissionReach.active();assert.equal(MissionReach.coastCache.has(current),false);state.cosmicTime=time;Cosmology.sync(state);
  MissionReach.active();state.expansion=false;assert.equal(shipReachability(),null);MissionReach.active();assert.equal(MissionReach.coastCache.has(current),false);state.expansion=true;Cosmology.sync(state);
  MissionReach.active();Simulation.tick(Math.max(0,current.mission.coast.proper-current.stageElapsed)+current.mission.brake.proper*.01);assert.equal(state.phase,'brake');
  MissionReach.active();assert.equal(MissionReach.coastCache.has(current),false,'braking cannot subtract a free-flight prefix');
  MissionReach.coastCache=new WeakMap();
  // A zero coast window is a real boundary: a future flight whose destination
  // is closer to the asymptotic horizon can outlive the first witness's coast.
  state=initial();state.cosmicTime=14e9;Cosmology.sync(state);
  const c=FlightSetup.normalize({engine:false,sail:false,brakeEngine:true,brakeSail:true,collectGas:true,arrivalFuelPercent:50}),origin=Space.point([0,0,0]),initialBeta=.99;
  const first=MissionReach.solve(c,null,origin,1,state.cosmicTime,initialBeta,null,true),target={id:'reuse-long-coast',name:'Проверка длинного свободного полёта',kind:'structure',rangeProbe:true,navigable:true,p3:[first.comoving+(first.upper-first.comoving)*.9,0,0]};
  ExtendedCatalog.pin(target);state.ship=origin;state.selected=target.id;
  const longer=original.call(MissionPlanner,c,null,target,1,origin,state.cosmicTime,true,initialBeta,null,true);assert.ok(longer.valid,longer.reason);MissionPlanner.launch(longer);Simulation.tick(1);
  MissionReach.active();const firstMemo=MissionReach.coastCache.get(state.flight);assert.ok(firstMemo.plan.coast.proper<longer.coast.proper);
  Simulation.tick(firstMemo.plan.coast.proper+1-state.flight.stageElapsed);assert.equal(state.phase,'cruise');
  const renewed=shipReachability(),secondMemo=MissionReach.coastCache.get(state.flight);
  assert.notEqual(secondMemo,firstMemo);assert.ok(secondMemo.proper>0,'renew a certificate only when its free prefix is actually exhausted');assertFeasible(renewed);
  const afterRenewal=probes;Simulation.tick(1);MissionReach.active();assert.equal(probes,afterRenewal);
  console.log('PASS one certified range solve across scheduled acceleration and 1000x coast; exact travelled-prefix subtraction, feasible 50/75% stops, unchanged state/plan, pause/camera/rate, reload, invalidation and renewal after a real witness coast expires');
 }finally{MissionPlanner.plan=original;}
}`);
