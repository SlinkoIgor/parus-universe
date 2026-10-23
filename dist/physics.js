'use strict';
// SI for forces; rocket masses in tonnes, trajectories in Julian years/light-years.
const Rocket=Object.freeze({
 c:299792458,year:31557600,dryMass:1,power:3e15,burnFraction:.10,
 massFlow(){return this.power/(this.c*this.c)*this.year/1000;},
 beta(m0,m){return Math.tanh(Math.log(m0/m));},
 acceleration(m){return this.power/(this.c*m*1000);},
 energy(dm){return dm*1000*this.c*this.c;},
 segment(m0,ma,mb){
  if(!(m0>=ma&&ma>=mb&&mb>=this.dryMass))throw new RangeError('Invalid rocket mass');
  const q=this.massFlow(),dm=ma-mb,log=Math.log1p(dm/mb),term=dm*(ma+mb)/(2*m0);
  return{proper:dm/q,earth:(m0*log+term)/(2*q),distance:Math.max(0,(m0*log-term)/(2*q)),beta:this.beta(m0,mb),energy:this.energy(dm)};
 },
 plan(fuel,distance=Infinity){
  const m0=this.dryMass+Math.max(0,fuel);let budget=Math.max(0,fuel)*this.burnFraction;
  if(this.segment(m0,m0,m0-budget).distance>distance*.08){let lo=0,hi=budget;for(let i=0;i<55;i++){const mid=(lo+hi)/2;if(this.segment(m0,m0,m0-mid).distance>distance*.08)hi=mid;else lo=mid;}budget=lo;}
  const mf=m0-budget,leg=this.segment(m0,m0,mf);
  return{m0,mf,budget,burned:0,initialFuel:fuel,beta:leg.beta,burnDistance:leg.distance,burnProper:leg.proper,burnEarth:leg.earth,properRate:leg.proper/6,energy:0,direction:1};
 },
 retroSegment(m0,eta0,ma,mb){
  const q=this.massFlow(),dm=ma-mb,log=Math.log1p(dm/mb),a=Math.exp(eta0)*dm*(ma+mb)/(2*m0),b=Math.exp(-eta0)*m0*log;
  const eta=Math.max(0,eta0-Math.log(m0/mb));
  return{proper:dm/q,earth:(a+b)/(2*q),distance:Math.max(0,(a-b)/(2*q)),beta:eta<1e-12?0:Math.tanh(eta),energy:this.energy(dm)};
 },
 retroPlan(fuel,beta){
  const m0=this.dryMass+Math.max(0,fuel),eta0=Math.atanh(Math.max(0,Math.min(1-Number.EPSILON,beta))),mf=m0*Math.exp(-eta0),budget=m0-mf;
  const canStop=mf>=this.dryMass*(1-1e-10),leg=this.retroSegment(m0,eta0,m0,Math.max(this.dryMass,mf));
  return{m0,mf:Math.max(this.dryMass,mf),eta0,budget:Math.min(fuel,budget),burned:0,initialFuel:fuel,beta:0,burnDistance:leg.distance,burnProper:leg.proper,burnEarth:leg.earth,properRate:leg.proper/6,energy:0,direction:-1,canStop};
 }
});
const LY=Rocket.c*Rocket.year;
const QUAD_X=[-.9602898564975363,-.7966664774136267,-.525532409916329,-.1834346424956498,.1834346424956498,.525532409916329,.7966664774136267,.9602898564975363];
const QUAD_W=[.1012285362903763,.2223810344533745,.3137066458778873,.362683783378362,.362683783378362,.3137066458778873,.2223810344533745,.1012285362903763];
const Stellar=Object.freeze({
 luminosity:1.2e35,r0:149597870700,foldRatio:1e5,pulseYears:30/365.25,duration:8,
 // Ideal elastic reflection in the u≈c limit of an ultra-relativistic explosion wind.
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
 plan(massKg,area,startBeta=0,startR=this.r0){
  const plan={massKg,area,startR,h0:this.H(startBeta),K:this.work(area,massKg),duration:this.duration,elapsed:0,rows:[{z:0,x:0,beta:startBeta,earth:0,proper:0}],reason:'weak'};
  const maxX=Math.max(0,this.r0*this.foldRatio-startR),maxZ=Math.log1p(maxX/startR),N=320;
  if(maxX===0){plan.beta=startBeta;plan.distance=0;return plan;}
  for(let i=1;i<=N;i++){
   const prev=plan.rows.at(-1);let z=maxZ*(i/N)**4,x=startR*Math.expm1(z),leg=this.segment(plan,prev.x,x),earth=prev.earth+leg.earth,proper=prev.proper+leg.proper;
   if(earth-x/LY>this.pulseYears){let lo=prev.z,hi=z;for(let j=0;j<32;j++){const mz=(lo+hi)/2,mx=startR*Math.expm1(mz),mt=prev.earth+this.segment(plan,prev.x,mx).earth;if(mt-mx/LY>this.pulseYears)hi=mz;else lo=mz;}z=(lo+hi)/2;x=startR*Math.expm1(z);leg=this.segment(plan,prev.x,x);earth=prev.earth+leg.earth;proper=prev.proper+leg.proper;plan.reason='pulse';}
   plan.rows.push({z,x,beta:this.betaAt(plan,x),earth,proper});if(plan.reason==='pulse')break;
  }
  const last=plan.rows.at(-1);plan.beta=last.beta;plan.distance=last.x/LY;plan.earth=last.earth;plan.proper=last.proper;return plan;
 },
 sample(plan,p){
  p=Math.max(0,Math.min(1,p));const at=p*(plan.rows.length-1),i=Math.floor(at),a=plan.rows[i],b=plan.rows[Math.min(i+1,plan.rows.length-1)],z=a.z+(b.z-a.z)*(at-i),x=plan.startR*Math.expm1(z),leg=this.segment(plan,a.x,x),beta=this.betaAt(plan,x),r=plan.startR+x;
  return{distance:x/LY,earth:a.earth+leg.earth,proper:a.proper+leg.proper,beta,r,force:this.force(plan.area,r,beta)};
 }
});
const Magnetic=Object.freeze({
 n:1e5,protonMass:1.67262192369e-27,area:1e15,fineBeta:.01,duration:10,
 rho(){return this.n*this.protonMass;},k(){return this.rho()*this.area;},
 half(beta){return beta/(1+Math.sqrt(Math.max(0,1-beta*beta)));},
 rates(massKg,beta,k=this.k()){
  const gamma=1/Math.sqrt(1-beta*beta),v=beta*Rocket.c,dm=k*v,force=beta>0&&k>0?-k*gamma*gamma*v*v:0;
  return{massRate:dm,particles:dm/this.protonMass,properParticles:gamma*dm/this.protonMass,force,properAcceleration:force/massKg,coordinateAcceleration:force/(massKg*gamma**3),heatPower:gamma*(gamma-1)*dm*Rocket.c**2};
 },
 integrals(m0,m,K,k=this.k()){
  if(m<=m0||K<=0)return{earth:0,proper:0,distance:0,heat:0};const z=(m-m0)/m0,h=K/m0,base=m0/(k*Rocket.c*Rocket.year),a=z*(2+z)/(4*h),b=h*Math.log1p(z)/2;
  return{earth:base*(a+b),proper:base*(a-b),distance:(m-m0)/(k*LY),heat:K*Rocket.c**2*(2*Math.atanh(h)-2*Math.atanh(K/m))};
 },
 plan(massKg,beta,k=this.k()){
  const h=this.half(beta),K=massKg*h,dry=Rocket.dryMass*1000,root=(K+dry+Math.sqrt((K+dry)**2+4*dry*K))/2;
  const mFine=beta>this.fineBeta?K/this.half(this.fineBeta):massKg;
  const finalMass=beta<=0?massKg:Math.max(massKg,mFine,root*(1+1e-12));const finalHalf=K/finalMass,finalBeta=K?2*finalHalf/(1+finalHalf*finalHalf):0;
  const leg=this.integrals(massKg,finalMass,K,k);
  return{massKg,beta,K,k,finalMass,finalBeta,duration:this.duration,elapsed:0,logRatio:Math.log(finalMass/massKg),...leg};
 },
 sample(plan,p){
  p=Math.max(0,Math.min(1,p));const mass=p===1?plan.finalMass:plan.massKg*Math.exp(plan.logRatio*p*p),h=plan.K/mass,beta=h?2*h/(1+h*h):0;
  return{mass,beta,...this.integrals(plan.massKg,mass,plan.K,plan.k),...this.rates(mass,beta,plan.k)};
 },
 stopping(fuel,beta){
  if(beta<=0)return{distance:0,earth:0,proper:0};const magnetic=this.plan((Rocket.dryMass+fuel)*1000,beta),engine=Rocket.retroPlan(magnetic.finalMass/1000-Rocket.dryMass,magnetic.finalBeta);
  return{magnetic,engine,distance:magnetic.distance+engine.burnDistance,earth:magnetic.earth+engine.burnEarth,proper:magnetic.proper+engine.burnProper};
 }
});
