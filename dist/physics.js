'use strict';
// SI for forces; rocket masses in tonnes, trajectories in Julian years/light-years.
const Rocket=Object.freeze({
 c:299792458,year:31557600,dryMass:1e-9,fuelCapacity:1e-9,initialFuel:1e-9,power:3e15,
 maxG:100,
 massFlow(){return this.power/(this.c*this.c)*this.year/1000;},
 beta(m0,m){return Math.tanh(Math.log(m0/m));},
 acceleration(m,maxG=this.maxG){return Math.min(maxG*9.80665,this.power/(this.c*m*1000));},
 burnedIn(m,years,maxG=this.maxG){return Math.min(this.massFlow()*years,-m*Math.expm1(-maxG*9.80665*this.year*years/this.c));},
 energy(dm){return dm*1000*this.c*this.c;},
 segment(m0,ma,mb,eta0=0,maxG=this.maxG){
  if(!(m0>=ma&&ma>=mb&&mb>=this.dryMass*(1-1e-12)))throw new RangeError('Invalid rocket mass');
  const delta=Math.log1p((ma-mb)/mb),etaA=eta0+Math.log(m0/ma),etaB=etaA+delta,k=this.c/(maxG*9.80665*this.year);
  return{proper:k*delta,earth:k*(Math.sinh(etaB)-Math.sinh(etaA)),distance:k*(Math.cosh(etaB)-Math.cosh(etaA)),beta:Math.tanh(etaB),energy:this.energy(ma-mb)};
 },
 plan(fuel,distance=Infinity,startBeta=0,maxG=this.maxG){
  const eta0=Math.atanh(startBeta),m0=this.dryMass+Math.max(0,fuel);let budget=Math.max(0,m0-Math.sqrt(this.dryMass*m0*Math.exp(eta0)));
  if(this.segment(m0,m0,m0-budget,eta0,maxG).distance>distance*.08){let lo=0,hi=budget;for(let i=0;i<55;i++){const mid=(lo+hi)/2;if(this.segment(m0,m0,m0-mid,eta0,maxG).distance>distance*.08)hi=mid;else lo=mid;}budget=lo;}
  const mf=m0-budget,leg=this.segment(m0,m0,mf,eta0,maxG);
  return{m0,mf,eta0,maxG,budget,burned:0,initialFuel:fuel,beta:leg.beta,burnDistance:leg.distance,burnProper:leg.proper,burnEarth:leg.earth,energy:0,direction:1};
 },
 retroSegment(m0,eta0,ma,mb,maxG=this.maxG){
  const delta=Math.log1p((ma-mb)/mb),etaA=Math.max(0,eta0-Math.log(m0/ma)),etaB=Math.max(0,etaA-delta),k=this.c/(maxG*9.80665*this.year);
  return{proper:k*(etaA-etaB),earth:k*(Math.sinh(etaA)-Math.sinh(etaB)),distance:k*(Math.cosh(etaA)-Math.cosh(etaB)),beta:Math.tanh(etaB),energy:this.energy(ma-mb)};
 },
 retroPlan(fuel,beta,maxG=this.maxG){
  const m0=this.dryMass+Math.max(0,fuel),eta0=Math.atanh(Math.max(0,Math.min(1-Number.EPSILON,beta))),mf=m0*Math.exp(-eta0),budget=m0-mf;
  const canStop=mf>=this.dryMass*(1-1e-10),leg=this.retroSegment(m0,eta0,m0,Math.max(this.dryMass,mf),maxG);
  return{m0,mf:Math.max(this.dryMass,mf),eta0,maxG,budget:Math.min(fuel,budget),burned:0,initialFuel:fuel,beta:0,burnDistance:leg.distance,burnProper:leg.proper,burnEarth:leg.earth,energy:0,direction:-1,canStop};
 }
});
const LY=Rocket.c*Rocket.year;
const QUAD_X=[-.9602898564975363,-.7966664774136267,-.525532409916329,-.1834346424956498,.1834346424956498,.525532409916329,.7966664774136267,.9602898564975363];
const QUAD_W=[.1012285362903763,.2223810344533745,.3137066458778873,.362683783378362,.362683783378362,.3137066458778873,.2223810344533745,.1012285362903763];
const Stellar=Object.freeze({
 luminosity:1.2e35,r0:149597870700,foldRatio:1e10,pulseYears:30/365.25,duration:8,
 // Ideal photon reflection. Area is modulated to cap proper acceleration.
 force(area,r,beta){return 2*area*this.luminosity/(4*Math.PI*r*r*Rocket.c)*(1-beta)/(1+beta);},
 work(area,massKg){return 2*area*this.luminosity/(4*Math.PI*massKg*Rocket.c**3);},
 H(beta){const u=Math.expm1(Math.atanh(beta));return u*u*(u+3)/6;},
 betaFromH(h){
  if(h<=0)return 0;let lo=0,hi=Math.sqrt(2*h)+Math.cbrt(6*h),u=Math.min(Math.sqrt(2*h),Math.cbrt(6*h));
  for(let i=0;i<25;i++){const f=u*u*(u+3)/6-h;if(Math.abs(f)<1e-13*Math.max(h,1e-100))break;if(f>0)hi=u;else lo=u;const next=u-f/(u*(u+2)/2);u=next>lo&&next<hi?next:(lo+hi)/2;}
  const q=u*(u+2);return q/(q+2);
 },
 betaAt(plan,x){return this.betaFromH(plan.h0+plan.K/plan.startR*(x/(plan.startR+x)));},
 segment(plan,xa,xb){
  if(xb<=xa)return{earth:0,proper:0};const sa=Math.sqrt(xa/plan.startR),sb=Math.sqrt(xb/plan.startR),mid=(sa+sb)/2,half=(sb-sa)/2;let earth=0,proper=0;
  for(let i=0;i<8;i++){const s=mid+half*QUAD_X[i],x=plan.startR*s*s,beta=this.betaAt(plan,x),dt=2*plan.startR*s/(Rocket.c*Math.max(beta,1e-100));earth+=QUAD_W[i]*dt;proper+=QUAD_W[i]*dt*Math.sqrt(Math.max(0,1-beta*beta));}
  return{earth:earth*half/Rocket.year,proper:proper*half/Rocket.year};
 },
 plan(massKg,area,startBeta=0,startR=this.r0,maxG=100,pulseYears=this.pulseYears,targetBeta=1){
  const a=maxG*9.80665,eta0=Math.atanh(startBeta),ell=Rocket.c**2/a,needed=eta=>{const r=startR+ell*(Math.cosh(eta)-Math.cosh(eta0));return massKg*a*Rocket.c*4*Math.PI*r*r*Math.exp(2*eta)/(2*this.luminosity);};
  let lo=eta0,hi=Math.max(eta0+1,18);for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(needed(mid)<area)lo=mid;else hi=mid;}
  const eta=Math.min(needed(eta0)>=area?eta0:(lo+hi)/2,targetBeta<1?Math.max(eta0,Math.atanh(targetBeta)):Infinity),x=ell*(Math.cosh(eta)-Math.cosh(eta0)),base={distance:x/LY,earth:Rocket.c/a*(Math.sinh(eta)-Math.sinh(eta0))/Rocket.year,proper:Rocket.c/a*(eta-eta0)/Rocket.year};
  const plan={massKg,area,startR,startBeta,maxG,pulseYears,eta0,etaSwitch:eta,base,K:this.work(area,massKg),h0:this.H(Math.tanh(eta)),tailR:startR+x,rows:[],reason:targetBeta<1&&eta>=Math.atanh(targetBeta)?'target':'dilution'};
  // The finite flash is measured in source time, not ship or Earth elapsed time.
  const sourceAt=e=>Rocket.c/a*(Math.exp(-eta0)-Math.exp(-e))/Rocket.year;
  if(sourceAt(eta)>=pulseYears){const end=-Math.log(Math.max(1e-30,Math.exp(-eta0)-pulseYears*Rocket.year*a/Rocket.c));plan.etaSwitch=end;plan.base={distance:ell*(Math.cosh(end)-Math.cosh(eta0))/LY,earth:Rocket.c/a*(Math.sinh(end)-Math.sinh(eta0))/Rocket.year,proper:Rocket.c/a*(end-eta0)/Rocket.year};plan.tailR=startR+plan.base.distance*LY;plan.reason='pulse';}
  // Cap acceleration first, then integrate the full-area inverse-square tail.
  plan.rows.push({x:0,beta:startBeta,earth:0,proper:0,source:0});
  if(plan.base.proper>0)for(let i=1;i<=160;i++){const e=eta0+(plan.etaSwitch-eta0)*i/160;plan.rows.push({x:ell*(Math.cosh(e)-Math.cosh(eta0)),beta:Math.tanh(e),earth:Rocket.c/a*(Math.sinh(e)-Math.sinh(eta0))/Rocket.year,proper:Rocket.c/a*(e-eta0)/Rocket.year,source:sourceAt(e)});}
  if(plan.reason!=='pulse'&&plan.reason!=='target'){
   const tail={startR:plan.tailR,h0:plan.h0,K:plan.K};let prevX=0;
   // Past 10,000 switch radii the remaining work is <0.01%; fold automatically.
   for(let i=1;i<=640;i++){let x=plan.tailR*Math.expm1(Math.log(1e4)*i/640);if(targetBeta<1&&this.betaAt(tail,x)>=targetBeta){x=1/(1/plan.tailR-(this.H(targetBeta)-plan.h0)/plan.K)-plan.tailR;plan.reason='target';}let leg=this.segment(tail,prevX,x),prev=plan.rows.at(-1),source=prev.source+leg.earth-(x-prevX)/LY;
    if(source>pulseYears){let l=prevX,h=x;for(let j=0;j<55;j++){const m=(l+h)/2,q=this.segment(tail,prevX,m);if(prev.source+q.earth-(m-prevX)/LY>pulseYears)h=m;else l=m;}x=(l+h)/2;leg=this.segment(tail,prevX,x);source=pulseYears;plan.reason='pulse';}
    plan.rows.push({x:plan.base.distance*LY+x,beta:this.betaAt(tail,x),earth:prev.earth+leg.earth,proper:prev.proper+leg.proper,source});prevX=x;if(plan.reason==='pulse'||plan.reason==='target')break;
   }
  }
  const last=plan.rows.at(-1);plan.beta=last.beta;plan.distance=last.x/LY;plan.earth=last.earth;plan.proper=last.proper;return plan;
 },
 sampleProper(plan,years){
  years=Math.max(0,Math.min(plan.proper,years));if(years===0){const force=Math.min(plan.massKg*plan.maxG*9.80665,this.force(plan.area,plan.startR,plan.startBeta));return{distance:0,earth:0,proper:0,beta:plan.startBeta,r:plan.startR,force,opening:force/this.force(plan.area,plan.startR,plan.startBeta),source:0,p:0};}let lo=0,hi=plan.rows.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(plan.rows[mid].proper<=years)lo=mid;else hi=mid;}
  const a=plan.rows[lo],b=plan.rows[hi],t=b.proper>a.proper?(years-a.proper)/(b.proper-a.proper):0;
  let beta,r,earth,source;
  if(years<=plan.base.proper){const acceleration=plan.maxG*9.80665,e=plan.eta0+acceleration*years*Rocket.year/Rocket.c;beta=Math.tanh(e);r=plan.startR+Rocket.c**2/acceleration*(Math.cosh(e)-Math.cosh(plan.eta0));earth=Rocket.c/acceleration*(Math.sinh(e)-Math.sinh(plan.eta0))/Rocket.year;source=Rocket.c/acceleration*(Math.exp(-plan.eta0)-Math.exp(-e))/Rocket.year;}
  else{let l=a.x,h=b.x;const tail={startR:plan.tailR,h0:plan.h0,K:plan.K};for(let i=0;i<48;i++){const m=(l+h)/2,q=this.segment(tail,a.x-plan.base.distance*LY,m-plan.base.distance*LY);if(a.proper+q.proper<years)l=m;else h=m;}const x=(l+h)/2,q=this.segment(tail,a.x-plan.base.distance*LY,x-plan.base.distance*LY);beta=this.betaAt(tail,x-plan.base.distance*LY);r=plan.startR+x;earth=a.earth+q.earth;source=a.source+q.earth-(x-a.x)/LY;}
  if(years===plan.proper){r=plan.startR+plan.distance*LY;beta=plan.beta;earth=plan.earth;source=plan.rows.at(-1).source;}
  const force=Math.min(plan.massKg*plan.maxG*9.80665,this.force(plan.area,r,beta)),opening=this.force(plan.area,r,beta)>0?force/this.force(plan.area,r,beta):0;
  return{distance:(r-plan.startR)/LY,earth,proper:years,beta,r,force,opening,source,p:plan.proper?years/plan.proper:1};
 },
 sample(plan,p){return this.sampleProper(plan,Math.max(0,Math.min(1,p))*plan.proper);}

});
const Magnetic=Object.freeze({
 n:1e5,protonMass:1.67262192369e-27,area:1e15,fineBeta:.01,duration:10,
 rho(){return this.n*this.protonMass;},k(){return this.rho()*this.area;},
 half(beta){return beta/(1+Math.sqrt(Math.max(0,1-beta*beta)));},
 rates(massKg,beta,k=this.k(),capacityKg=(Rocket.dryMass+Rocket.fuelCapacity)*1000){
  const gamma=1/Math.sqrt(1-beta*beta),v=beta*Rocket.c,dm=k*v,force=beta>0&&k>0?-k*gamma*gamma*v*v:0;
  return{massRate:massKg<capacityKg*(1-1e-12)?dm:0,processedMassRate:dm,particles:dm/this.protonMass,properParticles:gamma*dm/this.protonMass,force,properAcceleration:force/massKg,coordinateAcceleration:force/(massKg*gamma**3),heatPower:gamma*(gamma-1)*dm*Rocket.c**2};
 },
 integrals(m0,m,K,k=this.k()){
  if(m<=m0||K<=0)return{earth:0,proper:0,distance:0,heat:0};const z=(m-m0)/m0,h=K/m0,base=m0/(k*Rocket.c*Rocket.year),a=z*(2+z)/(4*h),b=h*Math.log1p(z)/2;
  return{earth:base*(a+b),proper:base*(a-b),distance:(m-m0)/(k*LY),heat:K*Rocket.c**2*(2*Math.atanh(h)-2*Math.atanh(K/m))};
 },
 // Full tank: cool incoming ions and release them at rest in the ship frame.
 // The drag remains, retained mass rate becomes zero; all heat is radiated.
 fixedIntegrals(massKg,beta0,beta,k=this.k()){
  if(beta>=beta0||beta0<=0)return{earth:0,proper:0,distance:0,heat:0};
  const h0=this.half(beta0),h=this.half(beta),base=massKg/(k*Rocket.c*Rocket.year);
  return{earth:base*(Math.sqrt(1-beta*beta)/beta-Math.sqrt(1-beta0*beta0)/beta0),proper:base*(1/beta-1/beta0),distance:massKg/(k*LY)*Math.log(h0/h),heat:massKg*Rocket.c**2*Math.log1p((h0*h0-h*h)/(1-h0*h0))};
 },
 plan(massKg,beta,k=this.k(),capacityKg=(Rocket.dryMass+Rocket.fuelCapacity)*1000,maxG=100){
  massKg=Math.min(massKg,capacityKg);
  const h=this.half(beta),K=massKg*h,dry=Rocket.dryMass*1000,root=(K+dry+Math.sqrt((K+dry)**2+4*dry*K))/2;
  const mFine=beta>this.fineBeta?K/this.half(this.fineBeta):massKg;
  const wanted=beta<=0?massKg:Math.max(massKg,mFine,root*(1+1e-12)),finalMass=Math.min(capacityKg,wanted),capHalf=K/finalMass,capBeta=K?2*capHalf/(1+capHalf*capHalf):0;
  const finalBeta=wanted>capacityKg?Math.min(this.fineBeta,capBeta):capBeta,finalHalf=this.half(finalBeta);
  const capture=this.integrals(massKg,finalMass,K,k),fixed=this.fixedIntegrals(finalMass,capBeta,finalBeta,k),leg={};
  for(const key of ['earth','proper','distance','heat'])leg[key]=capture[key]+fixed[key];
  const plan={massKg,beta,K,k,capacityKg,maxG,finalMass,capBeta,finalBeta,capture,duration:this.duration,elapsed:0,logRatio:h>0?Math.log(h/finalHalf):0,...leg};Object.assign(plan,this.cappedLeg(plan,finalBeta));return plan;
 },
 cappedLeg(plan,beta){
  const eta0=Math.atanh(plan.beta),eta=Math.atanh(beta),cap=plan.maxG*9.80665,finalMass=plan.K?Math.min(plan.finalMass,plan.K/this.half(beta)):plan.massKg;
  if(this.rates(finalMass,beta,plan.k,plan.capacityKg).properAcceleration<=-cap){const base=Rocket.c/(cap*Rocket.year);return{proper:base*(eta0-eta),earth:base*(Math.sinh(eta0)-Math.sinh(eta)),distance:base*(Math.cosh(eta0)-Math.cosh(eta))};}
  let proper=0,earth=0,distance=0;const mid=(eta0+eta)/2,half=(eta0-eta)/2;
  for(let i=0;i<8;i++){const e=mid+half*QUAD_X[i],b=Math.tanh(e),mass=Math.min(plan.finalMass,plan.K/this.half(b)),a=Math.min(cap,-this.rates(mass,b,plan.k,plan.capacityKg).properAcceleration),dt=Rocket.c/a/Rocket.year*half*QUAD_W[i];proper+=dt;earth+=dt*Math.cosh(e);distance+=dt*Math.sinh(e);}return{proper,earth,distance};
 },
 sample(plan,p){
  p=Math.max(0,Math.min(1,p));const h=this.half(plan.beta)*Math.exp(-plan.logRatio*p*p),beta=p===0?plan.beta:p===1?plan.finalBeta:h?2*h/(1+h*h):0,mass=p===0?plan.massKg:plan.K?Math.min(plan.finalMass,plan.K/h):plan.massKg;
  let leg=this.integrals(plan.massKg,mass,plan.K,plan.k);
  if(mass>=plan.finalMass&&beta<plan.capBeta){const fixed=this.fixedIntegrals(mass,plan.capBeta,beta,plan.k);for(const key of ['earth','proper','distance','heat'])leg[key]+=fixed[key];}
  const raw=this.rates(mass,beta,plan.k,plan.capacityKg),factor=raw.properAcceleration?Math.min(1,plan.maxG*9.80665/-raw.properAcceleration):1;
  for(const key of ["massRate","processedMassRate","particles","properParticles","force","properAcceleration","coordinateAcceleration","heatPower"])raw[key]*=factor;return{mass,beta,...leg,...this.cappedLeg(plan,beta),...raw};
 },
 stopping(fuel,beta,maxG=100){
  if(beta<=0)return{distance:0,earth:0,proper:0};const magnetic=this.plan((Rocket.dryMass+fuel)*1000,beta,this.k(),(Rocket.dryMass+Rocket.fuelCapacity)*1000,maxG),engine=Rocket.retroPlan(magnetic.finalMass/1000-Rocket.dryMass,magnetic.finalBeta,maxG);
  return{magnetic,engine,distance:magnetic.distance+engine.burnDistance,earth:magnetic.earth+engine.burnEarth,proper:magnetic.proper+engine.burnProper};
 }
});

// Invert physical proper time, never an animation duration.
const ProperTime={
 at(plan,model,years){
  if(model===Stellar)return model.sampleProper(plan,years);
  const total=plan.proper||0;if(years<=0)return{...model.sample(plan,0),p:0};if(years>=total)return{...model.sample(plan,1),p:1};
  let lo=0,hi=1;for(let i=0;i<58;i++){const p=(lo+hi)/2;if(model.sample(plan,p).proper<years)lo=p;else hi=p;}
  const p=(lo+hi)/2;return{...model.sample(plan,p),p};
 }
};
