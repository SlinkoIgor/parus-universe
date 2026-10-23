'use strict';
// One unit of dt is one Julian year of SHIP proper time in every phase.
const Simulation={
 debt:0,
 tolerance(f){return Math.max(1e-15,Math.abs(f.distance)*32*Number.EPSILON);},
 advance(realSeconds){if(!paused&&realSeconds>0)this.tick(realSeconds*speed);},
 tick(years){
  let remaining=years+this.debt;this.debt=0;
  for(let transitions=0;remaining>0&&transitions<256;transitions++){
   if(!state.flight){state.proper+=remaining;state.earth+=remaining;remaining=0;break;}
   const used=this.step(remaining);if(!(used>=0&&Number.isFinite(used)))throw new Error('Invalid proper-time step');
   remaining=Math.max(0,remaining-used);
  }
  // Preserve time even if a very long multi-route update exceeds the work budget.
  this.debt=remaining;
 },
 step(dt){
  const f=state.flight,tol=this.tolerance(f);
  if(state.phase==='flyby')return Route.tick(dt);
  if(Route.braking()&&['thrust','launch','cruise'].includes(state.phase)&&state.beta>0){const stop=Magnetic.stopping(state.matter,state.beta).distance;if(f.distance-f.covered<=stop+tol){beginBrake(true);return 0;}}
  if(state.phase==='thrust'||state.phase==='dock'){
   const e=f.engine;if(!e){state.phase='cruise';return 0;}
   const before=Rocket.dryMass+state.matter,unburned=Math.max(0,e.budget-e.burned),retro=e.direction<0;
   if(unburned<=Math.max(1e-18,e.budget*1e-12)){
    if(retro){state.beta=0;finishFlight(Math.abs(f.covered-f.distance)<=tol*4);}else cutEngine(false);return 0;
   }
   const dm=Math.min(unburned,Rocket.massFlow()*dt,state.matter);
   const predict=p=>{const after=Math.max(e.mf,before-dm*p),leg=retro?Rocket.retroSegment(e.m0,e.eta0,before,after):Rocket.segment(e.m0,before,after,e.eta0||0);return{...leg,fuel:Math.max(0,after-Rocket.dryMass)};};
   const fraction=retro?1:autoFraction(predict),step=predict(fraction),used=before-(Rocket.dryMass+step.fuel);
   state.matter=step.fuel;e.burned+=used;e.energy+=step.energy;state.spentEnergy+=step.energy;state.beta=step.beta;state.acceleration=(retro?-1:1)*Rocket.acceleration(Rocket.dryMass+state.matter);advance(step.distance,step.earth,step.proper);
   if(!retro&&fraction<1-1e-10)beginBrake(true);
   else if(e.budget-e.burned<=Math.max(1e-18,e.budget*1e-12)){if(retro){state.beta=0;finishFlight(Math.abs(f.covered-f.distance)<=tol*4);}else cutEngine(false);}
   return step.proper;
  }
  if(state.phase==='launch'&&f.wind){
   const w=f.wind,old=ProperTime.at(w,Stellar,w.elapsedProper||0),span=Math.min(dt,Math.max(0,w.proper-old.proper));
   if(span===0){cutEngine(false);return 0;}
   const predict=p=>{const now=ProperTime.at(w,Stellar,old.proper+span*p);return{...now,distance:now.distance-old.distance,fuel:state.matter};};
   const fraction=autoFraction(predict),now=ProperTime.at(w,Stellar,old.proper+span*fraction),used=now.proper-old.proper;
   w.elapsedProper=now.proper;w.progress=now.p;state.beta=now.beta;state.acceleration=now.force/w.massKg;advance(now.distance-old.distance,now.earth-old.earth,used);
   if(fraction<1-1e-10)beginBrake(true);else if(now.p===1)cutEngine(false);
   return used;
  }
  if(state.phase==='cruise'){
   if(state.beta<=0){finishFlight(false);return 0;}
   const inverseGamma=Math.sqrt((1-state.beta)*(1+state.beta)),rate=state.beta/inverseGamma,remaining=f.distance-f.covered;
   if(Route.isFlyby()){
    const encounter=Route.prepare();if(!encounter)return 0;
    const coast=Math.max(0,remaining-Route.gate())/rate;
    if(dt>=coast){advance(rate*coast,coast/inverseGamma,coast);Route.enter();return coast;}
   }
   if(Route.braking()){
    const stop=Magnetic.stopping(state.matter,state.beta).distance,coast=Math.max(0,remaining-stop)/rate;
    if(dt>=coast){advance(rate*coast,coast/inverseGamma,coast);beginBrake(true);return coast;}
   }
   advance(rate*dt,dt/inverseGamma,dt);state.acceleration=0;return dt;
  }
  if(state.phase==='brake'){
   if(!f.magnetic){beginBrake(f.autoStopping);return 0;}
   const m=f.magnetic,old=ProperTime.at(m,Magnetic,m.elapsedProper||0),span=Math.min(dt,Math.max(0,m.proper-old.proper));
   if(span===0){beginDock();return 0;}
   const now=ProperTime.at(m,Magnetic,old.proper+span),before=(Rocket.dryMass+state.matter)*1000,dm=Math.max(0,now.mass-before);
   state.matter=Math.min(Rocket.fuelCapacity,state.matter+dm/1000);state.captured+=dm/1000;state.heatRadiated+=Math.max(0,now.heat-old.heat);state.beta=now.beta;state.acceleration=now.properAcceleration;
   m.elapsedProper=now.proper;m.progress=now.p;advance(now.distance-old.distance,now.earth-old.earth,now.proper-old.proper);
   if(now.p===1)beginDock();return now.proper-old.proper;
  }
  throw new Error('Unknown flight phase: '+state.phase);
 }
};
