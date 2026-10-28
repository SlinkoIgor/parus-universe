'use strict';
// One unit of dt is one Julian year of SHIP proper time in every phase.
const Simulation={
 debt:0,
 slowMotionEnabled:false, // Keep replay machinery, but run at the player-selected rate.
 // Match advance(): each physical braking stage is converted at its midpoint
 // epoch. A 100 m sail can brake for millennia in intergalactic gas.
 stoppingDistance(stop,time=state.cosmicTime||0){
  const f=state.flight,dt=state.expansion!==false?1:0;if(!stop.magnetic)return 0;
  if(stop.magnetic.hybrid&&f?.cosmic)return FlightPath.distance(stop.magnetic,Magnetic,stop.magnetic.proper,time,state.expansion!==false);
  return stop.magnetic.distance/Cosmology.factor(f,time+dt*stop.magnetic.earth/2)+stop.engine.burnDistance/Cosmology.factor(f,time+dt*(stop.magnetic.earth+stop.engine.burnEarth/2));
 },
 tolerance(f){return Math.max(1e-13,Math.abs(f.distance)*64*Number.EPSILON);},
 // Automatic replay is a slowdown factor only. Only the player's speed button
 // can raise the requested proper-time rate, including during a stellar boost.
 slowMotionFactor(){
  if(!this.slowMotionEnabled)return 1;
  const f=state.flight;if(!f)return 1;
  // Coasting is never slowed in anticipation of a future braking phase.
  if(!['thrust','launch','brake','dock'].includes(state.phase))return 1;
  return Number.isFinite(f.replayRate)&&f.replayRate>0?Math.min(1,f.replayRate):1;
 },
 replayRate(){return speed*(this.slowMotionEnabled?(this.smoothedFactor??this.slowMotionFactor()):1);},
 wallDebt:0,
 advance(realSeconds){
  if(paused)return;let remaining=realSeconds+this.wallDebt;this.wallDebt=0;
  for(let i=0;remaining>1e-12&&i<8192;i++){
   const slice=Math.min(remaining,1/60),target=this.slowMotionFactor();
   // Ease the logarithm: a factor of 1000 should not jump in one frame.
   const previous=this.slowMotionEnabled?(this.smoothedFactor??target):1;
   this.smoothedFactor=Math.exp(Math.log(previous)+(Math.log(target)-Math.log(previous))*(-Math.expm1(-slice/.4)));
   if(Math.abs(Math.log(this.smoothedFactor/target))<1e-6)this.smoothedFactor=target;
   const rate=this.replayRate();let years=slice*rate;
   for(let transitions=0;years>1e-15&&transitions<64;transitions++){
    if(!state.flight){if(OrbitalArrival.idle(years)){years=0;break;}state.proper+=years;state.earth+=years;Cosmology.elapse(state,years);years=0;break;}
    const used=this.step(years);if(!(used>=0&&Number.isFinite(used)))throw new Error('Invalid replay step');years=Math.max(0,years-used);
   }
   if(years>1e-15)this.debt+=years;remaining=Math.max(0,remaining-slice);
  }
  this.wallDebt=remaining;
 },
 tick(years){
  let remaining=years+this.debt;this.debt=0;
  for(let transitions=0;remaining>0&&transitions<256;transitions++){
   if(!state.flight){if(OrbitalArrival.idle(remaining)){remaining=0;break;}state.proper+=remaining;state.earth+=remaining;Cosmology.elapse(state,remaining);remaining=0;break;}
   const used=this.step(remaining);if(!(used>=0&&Number.isFinite(used)))throw new Error('Invalid proper-time step');
   remaining=Math.max(0,remaining-used);
  }
  // Preserve time even if a very long multi-route update exceeds the work budget.
  this.debt=remaining;
 },
 step(dt){
  if(state.flight?.mission&&state.phase!=='flyby')return MissionPlanner.step(dt);
  const f=state.flight,tol=this.tolerance(f);
  if(state.phase==='flyby')return Route.tick(dt);
  if(Route.braking()&&['thrust','launch','cruise'].includes(state.phase)&&state.beta>0){const stop=Magnetic.stopping(state.matter,state.beta,Math.max(1,Math.abs(state.controlG)||100));if(f.distance-f.covered<=this.stoppingDistance(stop)+tol){beginBrake(true);return 0;}}
  if(state.phase==='thrust'||state.phase==='dock'){
   const e=f.engine;if(!e){state.phase='cruise';return 0;}
   const before=Rocket.dryMass+state.matter,unburned=Math.max(0,e.budget-e.burned),retro=e.direction<0;
   if(unburned<=Math.max(1e-30,e.budget*1e-12)){
    if(retro){state.beta=0;finishFlight(Math.abs(f.covered-f.distance)<=tol*4);}else cutEngine();return 0;
   }
   const dm=Math.min(unburned,Rocket.burnedIn(before,dt,e.maxG||100),state.matter);
   const predict=p=>{const after=Math.max(e.mf,before-dm*p),leg=retro?Rocket.retroSegment(e.m0,e.eta0,before,after,e.maxG||100):Rocket.segment(e.m0,before,after,e.eta0||0,e.maxG||100);return{...leg,fuel:Math.max(0,after-Rocket.dryMass)};};
   const fraction=retro?1:autoFraction(predict),step=predict(fraction),used=before-(Rocket.dryMass+step.fuel);
   state.matter=step.fuel;e.burned+=used;e.energy+=step.energy;state.spentEnergy+=step.energy;state.beta=step.beta;state.acceleration=(retro?-1:1)*Rocket.acceleration(Rocket.dryMass+state.matter,e.maxG||100);advance(step.distance,step.earth,step.proper);
   if(!retro&&fraction<1-1e-10){if(Route.isFlyby())cutEngine();else beginBrake(true);}
   else if(e.budget-e.burned<=Math.max(1e-30,e.budget*1e-12)){if(retro){state.beta=0;finishFlight(Math.abs(f.covered-f.distance)<=tol*4);}else cutEngine();}
   return step.proper;
  }
  if(state.phase==='launch'&&f.wind){
   const w=f.wind,old=w.lastSample||ProperTime.at(w,Stellar,w.elapsedProper||0),span=Math.min(dt,Math.max(0,w.proper-old.proper));
   if(span===0){cutEngine();return 0;}
   w.cosmicEpoch=(state.cosmicTime||0)-(state.expansion!==false?old.earth:0);const oldPath=f.cosmic?FlightPath.distance(w,Stellar,old.proper,w.cosmicEpoch,state.expansion!==false):0;
   const predict=p=>{const now=ProperTime.at(w,Stellar,old.proper+span*p);return{...now,distance:now.distance-old.distance,fuel:state.matter,...(f.cosmic?{comovingDistance:FlightPath.distance(w,Stellar,now.proper,w.cosmicEpoch??0,state.expansion!==false)-oldPath}:{})};};
   const fraction=autoFraction(predict),now=ProperTime.at(w,Stellar,old.proper+span*fraction),used=now.proper-old.proper;
   if(f.profile){const ledger=f.profile.actual.acceleration??={distance:0,proper:0,maxG:0};ledger.maxG=Math.max(ledger.maxG,old.force/w.massKg/9.80665,now.force/w.massKg/9.80665,old.proper<w.base.proper&&now.proper>old.proper?w.maxG:0);}
   w.elapsedProper=now.proper;w.progress=now.p;w.lastSample=now;state.beta=now.beta;state.acceleration=now.force/w.massKg;if(f.cosmic)advance(FlightPath.distance(w,Stellar,now.proper,w.cosmicEpoch??0,state.expansion!==false)-oldPath,now.earth-old.earth,used,true,now.distance-old.distance);else advance(now.distance-old.distance,now.earth-old.earth,used);
   if(fraction<1-1e-10){if(Route.isFlyby())cutEngine();else beginBrake(true);}else if(now.p===1)cutEngine();
   return used;
  }
  if(state.phase==='cruise'){
   if(state.beta<=0){finishFlight(false);return 0;}
   if(f.cosmic){
    const remaining=f.distance-f.covered,sample=proper=>Cosmology.coast(state.beta,proper,state.cosmicTime||0,state.expansion!==false),gap=q=>remaining-q.distance-(Route.braking()?this.stoppingDistance(Magnetic.stopping(state.matter,q.beta,Math.max(1,Math.abs(state.controlG)||100)),(state.cosmicTime||0)+(state.expansion!==false?q.earth:0)):Route.gate());
    let q=sample(dt),transition=gap(q)<=0;
    if(transition){let lo=0,hi=dt;for(let n=0;n<80;n++){const mid=(lo+hi)/2;if(mid===lo||mid===hi)break;if(gap(sample(mid))>0)lo=mid;else hi=mid;}q=sample((lo+hi)/2);}
    state.beta=q.beta;state.acceleration=0;advance(q.distance,q.earth,q.proper,true,q.path);
    if(transition){if(Route.isFlyby())Route.enter();else beginBrake(true);}return q.proper;
   }
   const inverseGamma=Math.sqrt((1-state.beta)*(1+state.beta)),rate=state.beta/inverseGamma,remaining=f.distance-f.covered;
   if(Route.isFlyby()){
    const encounter=Route.prepare();if(!encounter)return 0;
    const coast=Math.max(0,remaining-Route.gate())/rate;
    if(dt>=coast){advance(rate*coast,coast/inverseGamma,coast);Route.enter();return coast;}
   }
   if(Route.braking()){
    const stop=Magnetic.stopping(state.matter,state.beta,Math.max(1,Math.abs(state.controlG)||100)).distance,coast=Math.max(0,remaining-stop)/rate;
    if(dt>=coast){advance(rate*coast,coast/inverseGamma,coast);beginBrake(true);return coast;}
   }
   advance(rate*dt,dt/inverseGamma,dt);state.acceleration=0;return dt;
  }
  if(state.phase==='brake'){
   if(!f.magnetic){beginBrake(f.autoStopping);return 0;}
   const m=f.magnetic,old=m.lastSample||ProperTime.at(m,Magnetic,m.elapsedProper||0),span=Math.min(dt,Math.max(0,m.proper-old.proper));
   if(span===0){beginDock();return 0;}
   const now=ProperTime.at(m,Magnetic,old.proper+span),captured=Math.max(0,(now.captured||0)-(old.captured||0)),burned=Math.max(0,(now.burned||0)-(old.burned||0));
   state.matter=Math.max(0,Math.min(Rocket.fuelCapacity,now.mass/1000-Rocket.dryMass));state.captured+=captured/1000;state.spentEnergy+=burned*Rocket.c**2;state.heatRadiated+=Math.max(0,now.heat-old.heat);state.beta=now.beta;state.acceleration=now.properAcceleration;
   if(f.profile){const ledger=f.profile.actual.braking??={distance:0,proper:0,maxG:0};ledger.maxG=Math.max(ledger.maxG,Math.abs(old.properAcceleration)/9.80665,Math.abs(now.properAcceleration)/9.80665,now.proper>m.fill.proper+m.feed.proper&&now.proper>old.proper?m.maxG:0);}
   m.cosmicEpoch=(state.cosmicTime||0)-(state.expansion!==false?old.earth:0);m.elapsedProper=now.proper;m.progress=now.p;m.lastSample=now;if(f.cosmic)advance(FlightPath.distance(m,Magnetic,now.proper,m.cosmicEpoch,state.expansion!==false)-FlightPath.distance(m,Magnetic,old.proper,m.cosmicEpoch,state.expansion!==false),now.earth-old.earth,now.proper-old.proper,true,now.distance-old.distance);else advance(now.distance-old.distance,now.earth-old.earth,now.proper-old.proper);
   if(now.p===1){state.beta=0;finishFlight(Math.abs(f.covered-f.distance)<=tol*4);}return now.proper-old.proper;

  }
  throw new Error('Unknown flight phase: '+state.phase);
 }
};
