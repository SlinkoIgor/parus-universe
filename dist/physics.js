'use strict';
// SI for forces; rocket masses in tonnes, trajectories in Julian years/light-years.
// All numeric assumptions belong to a setup. The temporary context is synchronous
// and restored in finally, so previewing a draft cannot change the active ship.
const ShipPhysics={
 fields:{
  dryMassKg:[1,.001,1e6,'Сухая масса корабля','кг'],
  sailDiameterM:[100,.01,1e6,'Диаметр паруса','м'],
  reflectivityPercent:[100,0,100,'Отражение паруса','% · остальная энергия поглощается'],
  collectorDiameterM:[.1*149597870700,1,Infinity,'Диаметр оптического коллектора','м'],
  divergenceDeg:[0,0,10,'Расходимость коллектора','градусы · полный угол сверх дифракции'],
  opticalEfficiencyPercent:[100,.01,100,'Передача света коллектором','%'],
  engineEfficiencyPercent:[100,.1,100,'Эффективность двигателя','% массы, превращаемой в направленный свет'],
  enginePowerW:[3e15,1,1e30,'Предельная мощность двигателя','Вт · до потерь'],
  maxAccelerationG:[10,0,Infinity,'Максимальное ускорение','g · больше нуля'],
  maxBrakingG:[10,0,Infinity,'Максимальное торможение','g · больше нуля'],
  burstDays:[30,.001,1e6,'Длительность светимости сверхновой','сутки у источника'],
  burstLuminosityW:[1.2e35,1,1e50,'Светимость сверхновой','Вт · модельная прямоугольная вспышка'],
  collectorMinAu:[100,.001,1e6,'Дистанция коллектора от центра звезды','а.е. · не ближе 1,2 радиуса звезды'],
  dustMassPercent:[1,0,99.9,'Доля пыли в среде','% массы смеси газа и пыли']
 },
 context:null,
 positiveFields:new Set(['maxAccelerationG','maxBrakingG']),
 number(k,v){const[d,lo,hi]=this.fields[k];return v!==null&&v!==undefined&&Number.isFinite(+v)&&(!this.positiveFields.has(k)||+v>0)?Math.max(lo,Math.min(hi,+v)):d;},
 normalize(c={}){return Object.fromEntries(Object.keys(this.fields).map(k=>[k,this.number(k,c[k])]));},
 current(){if(this.context)return this.context;try{return state?.flight?.mission?.setup||state?.flightSetup||{};}catch{return{};}},
 value(k){return this.number(k,this.current()[k]);},
 run(c,fn){const previous=this.context;this.context=this.normalize(c);try{return fn();}finally{this.context=previous;}},
 get efficiency(){return this.value('engineEfficiencyPercent')/100;},
 get reflection(){return 1+this.value('reflectivityPercent')/100;}
};
const SHIP=Object.freeze({get dryMassKg(){return ShipPhysics.value('dryMassKg');},fuelCapacityKg:1,get sailDiameterM(){return ShipPhysics.value('sailDiameterM');},get sailAreaM2(){return Math.PI*(this.sailDiameterM/2)**2;},sailArealDensityKgM2:.0001,get sailMassKg(){return this.sailAreaM2*this.sailArealDensityKgM2;}});
const Rocket=Object.freeze({
 c:299792458,year:31557600,get dryMass(){return SHIP.dryMassKg/1000;},get fuelCapacity(){return (typeof state==='object'&&state?state.tankCapacityKg||1:1)/1000;},initialFuel:.001,get power(){return ShipPhysics.value('enginePowerW');},
 get maxG(){return ShipPhysics.value('maxAccelerationG');},
 usableFuel(fuel){return Number.isFinite(fuel)&&fuel>this.dryMass*64*Number.EPSILON?fuel:0;},
 massFlow(){return this.power/(this.c*this.c)*this.year/1000;},
 beta(m0,m){return Math.tanh(ShipPhysics.efficiency*Math.log(m0/m));},
 acceleration(m,maxG=this.maxG){return Math.min(maxG*9.80665,this.power*ShipPhysics.efficiency/(this.c*m*1000));},
 massAfter(m,years,maxG=this.maxG){
  const eff=ShipPhysics.efficiency,threshold=this.power*eff/(this.c*maxG*9.80665)/1000,flow=this.massFlow(),powerTime=Math.max(0,m-threshold)/flow;
  if(years<=powerTime)return Math.max(0,m-flow*years);
  return Math.min(m,threshold)*Math.exp(-maxG*9.80665*this.year*(years-powerTime)/(this.c*eff));
 },
 burnedIn(m,years,maxG=this.maxG){return Math.max(0,m-this.massAfter(m,years,maxG));},
 energy(dm){return dm*1000*this.c*this.c;},
 leg(ma,mb,etaA,direction,maxG){
  const eff=ShipPhysics.efficiency,threshold=this.power*eff/(this.c*maxG*9.80665)/1000;
  if(ma>threshold&&mb<threshold){const first=this.leg(ma,threshold,etaA,direction,maxG),second=this.leg(threshold,mb,Math.atanh(first.beta),direction,maxG);return{proper:first.proper+second.proper,earth:first.earth+second.earth,distance:first.distance+second.distance,beta:second.beta,energy:first.energy+second.energy};}
  const log=Math.log1p((ma-mb)/mb),delta=eff*log,etaB=Math.max(0,etaA+direction*delta),k=this.c/(maxG*9.80665*this.year);
  if(ma<=threshold*(1+1e-12))return{proper:k*delta,earth:direction*k*(Math.sinh(etaB)-Math.sinh(etaA)),distance:direction*k*2*Math.sinh((etaB+etaA)/2)*Math.sinh((etaB-etaA)/2),beta:Math.tanh(etaB),energy:this.energy(ma-mb)};
  const integral=z=>Math.abs(z)<1e-12?log:-Math.expm1(-z*log)/z,factor=1000*this.c**2/(this.power*this.year),plus=Math.exp(etaA)*integral(1-direction*eff),minus=Math.exp(-etaA)*integral(1+direction*eff);
  let path=ma*(plus-minus)/2;
  if(Math.abs(plus-minus)<1e-7*(plus+minus)){path=0;for(let i=0;i<8;i++){const m=(ma+mb)/2+(ma-mb)*QUAD_X[i]/2;path+=QUAD_W[i]*Math.sinh(etaA+direction*eff*Math.log(ma/m))*(ma-mb)/2;}}
  return{proper:factor*(ma-mb),earth:factor*ma*(plus+minus)/2,distance:factor*Math.max(0,path),beta:Math.tanh(etaB),energy:this.energy(ma-mb)};
 },
 segment(m0,ma,mb,eta0=0,maxG=this.maxG){
  if(!(m0>=ma&&ma>=mb&&mb>=this.dryMass*(1-1e-12)))throw new RangeError('Invalid rocket mass');
  return this.leg(ma,mb,eta0+ShipPhysics.efficiency*Math.log(m0/ma),1,maxG);
 },
 plan(fuel,distance=Infinity,startBeta=0,maxG=this.maxG){
  // Use all available propellant. Magnetic capture supplies the final reverse burn.
  // The flight integrator ends acceleration early only when stopping at the target requires it.
  const eta0=Math.atanh(startBeta),budget=this.usableFuel(fuel),m0=this.dryMass+budget;
  const mf=this.dryMass,leg=this.segment(m0,m0,mf,eta0,maxG);
  return{fullTank:true,m0,mf,eta0,maxG,budget,burned:0,initialFuel:fuel,beta:leg.beta,burnDistance:leg.distance,burnProper:leg.proper,burnEarth:leg.earth,energy:0,direction:1};
 },
 retroSegment(m0,eta0,ma,mb,maxG=this.maxG){return this.leg(ma,mb,Math.max(0,eta0-ShipPhysics.efficiency*Math.log(m0/ma)),-1,maxG);},
 retroPlan(fuel,beta,maxG=this.maxG){
  const m0=this.dryMass+Math.max(0,fuel),eta0=Math.atanh(Math.max(0,Math.min(1-Number.EPSILON,beta))),mf=m0*Math.exp(-eta0/ShipPhysics.efficiency),budget=m0-mf;
  const canStop=mf>=this.dryMass*(1-1e-10),leg=this.retroSegment(m0,eta0,m0,Math.max(this.dryMass,mf),maxG);
  return{m0,mf:Math.max(this.dryMass,mf),eta0,maxG,budget:Math.min(fuel,budget),burned:0,initialFuel:fuel,beta:0,burnDistance:leg.distance,burnProper:leg.proper,burnEarth:leg.earth,energy:0,direction:-1,canStop};
 }
});
const LY=Rocket.c*Rocket.year;
const QUAD_X=[-.9602898564975363,-.7966664774136267,-.525532409916329,-.1834346424956498,.1834346424956498,.525532409916329,.7966664774136267,.9602898564975363];
const QUAD_W=[.1012285362903763,.2223810344533745,.3137066458778873,.362683783378362,.362683783378362,.3137066458778873,.2223810344533745,.1012285362903763];
const Stellar=Object.freeze({
 get luminosity(){return ShipPhysics.value('burstLuminosityW');},r0:149597870700,foldRatio:1e10,get pulseYears(){return ShipPhysics.value('burstDays')/365.25;},duration:8,
 get collectorDiameterM(){return ShipPhysics.value('collectorDiameterM');},
 stellarLight(star){
  const facts=star?.facts||{},spectral=String(star?.spectral||facts.class||star?.type||'G2V'),letter=(spectral.match(/(?:^|\s|·)([OBAFGKM])\s*\d/i)||spectral.match(/([OBAFGKM])\d/i))?.[1]?.toUpperCase()||(/красн/i.test(spectral)?'M':/оранж/i.test(spectral)?'K':'G');
  let solar=star?.bolometricLuminositySolar??facts.lum??(typeof STAR_FACTS==='object'?STAR_FACTS[star?.id]?.lum:null),estimated=!(solar>0),basis='Каталожная болометрическая светимость';
  if(estimated){const base={O:1e5,B:1e3,A:20,F:3,G:1,K:.3,M:.01};solar=base[letter];const luminosityClass=spectral.match(/[OBAFGKM]\s*\d(?:\.\d)?\s*(Iab|Ia|Ib|III|II|IV|VI|V|I)(?=\b|e|n|p|$)/i)?.[1]?.toUpperCase();if(luminosityClass==='III'||/гигант/i.test(spectral))solar=100;if(luminosityClass==='II')solar=1000;if(luminosityClass==='IV')solar*=5;if(['I','IA','IB','IAB'].includes(luminosityClass)||/сверхгигант|\bW[NCOR]\d|\bWR\b|\bLBV\b|\bRSG\b|\bBSG\b/i.test(spectral))solar=1e5;if(/белый карлик|^D[A-Z0-9]/i.test(spectral))solar=.001;if(/коричнев/i.test(spectral))solar=.0001;basis='Оценка по классу '+spectral+'; не индивидуальное измерение';}
  const radiusText=String(facts.radius||'').replace(/\s/g,''),match=radiusText.match(/([\d.,]+)(?:[–−-]([\d.,]+))?R☉/),temperature={O:35000,B:18000,A:8500,F:6500,G:5600,K:4500,M:3200}[letter];
  const radiusSolar=star?.radiusSolar>0?star.radiusSolar:match?Number((match[2]||match[1]).replace(',','.')):Math.sqrt(solar)*(5772/temperature)**2;
  const temperatureK=star?.temperatureK>0?star.temperatureK:5772*(solar/(radiusSolar*radiusSolar))**.25;
  return{watts:solar*3.828e26,solar,estimated,basis,temperatureK,collectorR:Math.max(this.r0*ShipPhysics.value('collectorMinAu'),1.2*radiusSolar*6.957e8)};
 },
 // Frozen ideal-beam API for legacy flights; new plans use BeamOptics below.
 sourcePlan(star,mode,massKg,distanceLy,startBeta=0,startR=this.r0,maxG=Rocket.maxG,pulseYears=null,epoch=0,cosmic=false,expansion=true){
  if(mode==='burst'&&star?.id==='sol')throw new RangeError('Solar bursts are forbidden');
  const light=this.stellarLight(star),luminosity=mode==='burst'?this.luminosity:light.watts,collectorR=light.collectorR,power=luminosity*Math.min(1,this.collectorDiameterM**2/(16*collectorR**2)),a=maxG*9.80665,eta0=Math.atanh(startBeta),switchEta=Math.max(eta0,.5*Math.log(2*power/(massKg*Rocket.c*a))),scale=Rocket.c/(a*Rocket.year);
  const distanceAt=e=>{const cap=Math.min(e,switchEta),base=scale*(Math.cosh(cap)-Math.cosh(eta0));return base+(e>switchEta?this.beamLeg(power,massKg,switchEta,e).distance:0);};
  let lo=eta0,hi=Math.atanh(1-Number.EPSILON);for(let i=0;i<64;i++){const e=(lo+hi)/2;if(distanceAt(e)>Math.max(0,distanceLy))hi=e;else lo=e;}let eta=(lo+hi)/2;
  const pulse=pulseYears??(mode==='burst'?this.pulseYears:Infinity);
  if(cosmic){lo=eta0;hi=Math.atanh(1-Number.EPSILON);for(let i=0;i<55;i++){const e=(lo+hi)/2,test=this.beamPlan(massKg,Math.PI*50**2,startBeta,startR,maxG,pulse,Math.tanh(e),power,e);if(FlightPath.distance(test,Stellar,test.proper,epoch,expansion)>distanceLy)hi=e;else lo=e;}eta=(lo+hi)/2;}
  const p=this.beamPlan(massKg,Math.PI*50**2,startBeta,Math.max(startR,collectorR),maxG,pulse,Math.tanh(eta),power,eta);
  Object.assign(p,{cosmicEpoch:epoch,mode,continuous:mode==='beam',sourceStar:star?.id,luminosityW:luminosity,luminosityEstimated:mode==='beam'&&light.estimated,luminosityBasis:mode==='burst'?'Идеализированная 30-дневная вспышка':light.basis,collectorDiameterM:this.collectorDiameterM,collectorR});return p;
 },
 // Power crossing a stationary 100 m sail in an ideal parallel beam. Collection
 // is fixed at the source; no inverse-square dilution along the flight path.
 collectedPower(diameter,collectorR=this.r0){return this.luminosity*Math.min(1,diameter**2/(16*collectorR**2));},
 beamForce(power,beta){return 2*power/Rocket.c*(1-beta)/(1+beta);},
 forSail(sail,massKg=Rocket.dryMass*1000,startBeta=0,startR=this.r0,maxG=Rocket.maxG,pulseYears=this.pulseYears){
  return this.plan(massKg,sail.areaM2,startBeta,startR,maxG,pulseYears,sail.targetBeta,sail.collectorDiameterM?this.collectedPower(sail.collectorDiameterM,sail.collectorR):0);
 },
 beamLeg(power,massKg,etaA,etaB){
  const k=massKg*Rocket.c**2/(2*power*Rocket.year),delta=etaB-etaA;
  const e1=Math.exp(etaA)*Math.expm1(delta),e2=Math.exp(2*etaA)*Math.expm1(2*delta),e3=Math.exp(3*etaA)*Math.expm1(3*delta);
  return{proper:k*e2/2,earth:k*(e3/3+e1)/2,distance:k*(e3/3-e1)/2,source:k*e1};
 },
 beamPlan(massKg,area,startBeta,startR,maxG,pulseYears,targetBeta,beamPower,targetEta=null){
  const eta0=Math.atanh(startBeta),a=maxG*9.80665,k=Rocket.c/(a*Rocket.year),target=targetEta??Math.max(eta0,Math.atanh(Math.min(1-Number.EPSILON,targetBeta)));
  const cap=e=>({proper:k*(e-eta0),earth:k*(Math.sinh(e)-Math.sinh(eta0)),distance:k*(Math.cosh(e)-Math.cosh(eta0)),source:k*Math.exp(-eta0)*(-Math.expm1(-(e-eta0)))});
  let etaSwitch=Math.max(eta0,Math.min(target,.5*Math.log(2*beamPower/(massKg*Rocket.c*a))));
  let base=cap(etaSwitch),reason='target',etaEnd=target;
  if(base.source>=pulseYears){etaSwitch=eta0-Math.log1p(-pulseYears/(k*Math.exp(-eta0)));etaEnd=etaSwitch;base=cap(etaSwitch);reason='pulse';}
  else if(base.source+this.beamLeg(beamPower,massKg,etaSwitch,target).source>pulseYears){
   etaEnd=etaSwitch+Math.log1p((pulseYears-base.source)*Rocket.year*2*beamPower/(massKg*Rocket.c**2*Math.exp(etaSwitch)));reason='pulse';
  }
  const plan={massKg,area,startBeta,startR,maxG,pulseYears,beamPower,eta0,etaSwitch,etaEnd,base,rows:[],reason};
  const row=(e,capped)=>{const q=capped?cap(e):this.beamLeg(beamPower,massKg,etaSwitch,e);if(!capped)for(const key of ['proper','earth','distance','source'])q[key]+=base[key];return{x:q.distance*LY,beta:Math.tanh(e),earth:q.earth,proper:q.proper,source:q.source};};
  plan.rows.push(row(eta0,true));
  if(etaSwitch>eta0)for(let i=1;i<=160;i++)plan.rows.push(row(eta0+(etaSwitch-eta0)*i/160,true));
  if(etaEnd>etaSwitch)for(let i=1;i<=160;i++)plan.rows.push(row(etaSwitch+(etaEnd-etaSwitch)*i/160,false));
  const last=plan.rows.at(-1);Object.assign(plan,{beta:last.beta,distance:last.x/LY,earth:last.earth,proper:last.proper});return plan;
 },
 sampleBeam(plan,years){
  const proper=Math.max(0,Math.min(plan.proper,years)),a=plan.maxG*9.80665,k=Rocket.c/(a*Rocket.year);let eta,earth,distance,source;
  if(proper<=plan.base.proper){eta=plan.eta0+proper/k;earth=k*(Math.sinh(eta)-Math.sinh(plan.eta0));distance=k*(Math.cosh(eta)-Math.cosh(plan.eta0));source=k*Math.exp(-plan.eta0)*(-Math.expm1(-(eta-plan.eta0)));}
  else{eta=plan.etaSwitch+.5*Math.log1p((proper-plan.base.proper)*Rocket.year*4*plan.beamPower/(plan.massKg*Rocket.c**2*Math.exp(2*plan.etaSwitch)));const q=this.beamLeg(plan.beamPower,plan.massKg,plan.etaSwitch,eta);earth=plan.base.earth+q.earth;distance=plan.base.distance+q.distance;source=plan.base.source+q.source;}
  let beta=Math.tanh(eta);if(proper===plan.proper){beta=plan.beta;earth=plan.earth;distance=plan.distance;source=plan.rows.at(-1).source;}
  const full=this.beamForce(plan.beamPower,beta),force=Math.min(plan.massKg*a,full);
  return{proper,earth,distance,source,beta,eta,r:plan.startR+distance*LY,force,opening:full>0?force/full:0,p:plan.proper?proper/plan.proper:1};
 },
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
 plan(massKg,area,startBeta=0,startR=this.r0,maxG=Rocket.maxG,pulseYears=this.pulseYears,targetBeta=1,beamPower=0){
  if(beamPower>0)return this.beamPlan(massKg,area,startBeta,startR,maxG,pulseYears,targetBeta,beamPower);
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
  if(plan.beamPower>0)return this.sampleBeam(plan,years);
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
// Coarse environment model, not a measured gas map. A conservative uniform
// A uniform game medium: the mean Milky Way density is used everywhere.
const GasMedium={
 source:'https://cosmicopia.gsfc.nasa.gov/qa_sp_ms.html',
 n:1e6,model:4,label:'Однородная среда · 1 атом/см³',
 at(p){return{n:this.n,label:this.label};},
 forLeg(from,target,sail=0){return{...this.at(),area:SAILS[0].areaM2,model:this.model};}
};
const Magnetic=Object.freeze({
 n:1e6,protonMass:1.67262192369e-27,get area(){return SHIP.sailAreaM2;},fineBeta:.01,duration:10,get maxG(){return ShipPhysics.value('maxBrakingG');},get dustToGas(){const fraction=ShipPhysics.value('dustMassPercent')/100;return fraction/(1-fraction);},
 context(){return typeof state==='object'&&state?(state.flight?.medium||GasMedium.forLeg(state.ship,object(state.selected)||state.ship,state.sail)):{n:this.n,area:this.area};},
 gasDensity(n=this.n){return n*this.protonMass;},dustDensity(n=this.n){return this.gasDensity(n)*this.dustToGas;},rho(n=this.n){return this.gasDensity(n)+this.dustDensity(n);},k(){const m=this.context();return this.rho(m.n)*m.area;},
 half(beta){return beta/(1+Math.sqrt(Math.max(0,1-beta*beta)));},
 rates(massKg,beta,k=this.k(),capacityKg=(Rocket.dryMass+Rocket.fuelCapacity)*1000){
  const gamma=1/Math.sqrt(1-beta*beta),v=beta*Rocket.c,dm=k*v,force=beta>0&&k>0?-k*gamma*gamma*v*v:0;
  return{massRate:massKg<capacityKg*(1-1e-12)?dm:0,processedMassRate:dm,particles:dm/(1+this.dustToGas)/this.protonMass,properParticles:gamma*dm/(1+this.dustToGas)/this.protonMass,force,properAcceleration:force/massKg,coordinateAcceleration:force/(massKg*gamma**3),heatPower:gamma*(gamma-1)*dm*Rocket.c**2};
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
 plan(massKg,beta,k=this.k(),capacityKg=(Rocket.dryMass+Rocket.fuelCapacity)*1000,maxG=Rocket.maxG){
  massKg=Math.min(massKg,capacityKg);maxG=Math.min(this.maxG,maxG);
  const h=this.half(beta),K=massKg*h,dry=Rocket.dryMass*1000,root=(K+dry+Math.sqrt((K+dry)**2+4*dry*K))/2;
  const mFine=beta>this.fineBeta?K/this.half(this.fineBeta):massKg;
  const wanted=beta<=0?massKg:Math.max(massKg,mFine,root*(1+1e-12)),finalMass=Math.min(capacityKg,wanted),capHalf=K/finalMass,capBeta=K?2*capHalf/(1+capHalf*capHalf):0;
  const finalBeta=wanted>capacityKg?Math.min(this.fineBeta,capBeta):capBeta,finalHalf=this.half(finalBeta);
  const capture=this.integrals(massKg,finalMass,K,k),fixed=this.fixedIntegrals(finalMass,capBeta,finalBeta,k),leg={};
  for(const key of ['earth','proper','distance','heat'])leg[key]=capture[key]+fixed[key];
  const plan={massKg,beta,K,k,capacityKg,maxG,finalMass,capBeta,finalBeta,capture,unthrottled:{...leg},duration:this.duration,elapsed:0,logRatio:h>0?Math.log(h/finalHalf):0,...leg};Object.assign(plan,this.cappedLeg(plan,finalBeta));return plan;
 },
 cappedLeg(plan,beta){
  const eta0=Math.atanh(plan.beta),eta=Math.atanh(beta),cap=plan.maxG*9.80665,finalMass=plan.K?Math.min(plan.finalMass,plan.K/this.half(beta)):plan.massKg;
  if(this.rates(finalMass,beta,plan.k,plan.capacityKg).properAcceleration<=-cap){const base=Rocket.c/(cap*Rocket.year);return{proper:base*(eta0-eta),earth:base*(Math.sinh(eta0)-Math.sinh(eta)),distance:base*(Math.cosh(eta0)-Math.cosh(eta))};}
  const rawLeg=b=>{const mass=plan.K?Math.min(plan.finalMass,plan.K/this.half(b)):plan.massKg,leg=this.integrals(plan.massKg,mass,plan.K,plan.k);if(mass>=plan.finalMass&&b<plan.capBeta){const tail=this.fixedIntegrals(mass,plan.capBeta,b,plan.k);for(const key of ['earth','proper','distance','heat'])leg[key]+=tail[key];}return leg;};
  const acceleration=e=>{const b=Math.tanh(e),mass=Math.min(plan.finalMass,plan.K/this.half(b));return -this.rates(mass,b,plan.k,plan.capacityKg).properAcceleration;};
  const result=rawLeg(beta);if(acceleration(eta0)<=cap)return result;
  let low=eta,high=eta0;for(let i=0;i<56;i++){const mid=(low+high)/2;if(acceleration(mid)<cap)low=mid;else high=mid;}
  const crossing=(low+high)/2,cut=rawLeg(Math.tanh(crossing)),base=Rocket.c/(cap*Rocket.year);
  return{proper:result.proper-cut.proper+base*(eta0-crossing),earth:result.earth-cut.earth+base*(Math.sinh(eta0)-Math.sinh(crossing)),distance:result.distance-cut.distance+base*(Math.cosh(eta0)-Math.cosh(crossing))};
 },
 sample(plan,p){
  if(plan.hybrid)return HybridBrake.sampleProper(plan,Math.max(0,Math.min(1,p))*plan.proper);
  p=Math.max(0,Math.min(1,p));const h=this.half(plan.beta)*Math.exp(-plan.logRatio*p*p),beta=p===0?plan.beta:p===1?plan.finalBeta:h?2*h/(1+h*h):0,mass=p===0?plan.massKg:plan.K?Math.min(plan.finalMass,plan.K/h):plan.massKg;
  let leg=this.integrals(plan.massKg,mass,plan.K,plan.k);
  if(mass>=plan.finalMass&&beta<plan.capBeta){const fixed=this.fixedIntegrals(mass,plan.capBeta,beta,plan.k);for(const key of ['earth','proper','distance','heat'])leg[key]+=fixed[key];}
  const raw=this.rates(mass,beta,plan.k,plan.capacityKg),factor=raw.properAcceleration?Math.min(1,plan.maxG*9.80665/-raw.properAcceleration):1;
  for(const key of ["massRate","processedMassRate","particles","properParticles","force","properAcceleration","coordinateAcceleration","heatPower"])raw[key]*=factor;return{mass,beta,...leg,...this.cappedLeg(plan,beta),...raw};
 },
 stopping(fuel,beta,maxG=Rocket.maxG,medium=this.context()){
  return HybridBrake.stopping(fuel,beta,maxG,medium);
 }
});

// Time-minimising active-constraint policy for the ideal gas/photon model:
// collect at full permitted area, feed the engine at a full tank, then use the
// terminal fuel allowance at maximum total proper deceleration. No fuel is created.
const HybridBrake={
 reserve:0,
 integral(fn,lo,hi){
  if(!(hi>lo))return 0;let total=0;
  const logarithmic=lo>0,z0=logarithmic?Math.log(lo):lo,z1=logarithmic?Math.log(hi):hi,N=12;
  for(let n=0;n<N;n++){const mid=z0+(z1-z0)*(n+.5)/N,half=(z1-z0)/(2*N);for(let i=0;i<8;i++){const z=mid+half*QUAD_X[i],e=logarithmic?Math.exp(z):z;total+=half*QUAD_W[i]*fn(e)*(logarithmic?e:1);}}return total;
 },
 terminalI(e){if(!(e>0))return 0;let sum=0;for(let i=0;i<8;i++){const x=e*(1+QUAD_X[i])/2,t=Math.sinh(x);sum+=QUAD_W[i]*Math.exp(-x)*t*(t+1);}return sum*e/2;},
 terminalMass(p,e){const eff=ShipPhysics.efficiency;if(eff===1)return Math.exp(e-p.etaTerminal)*p.terminalMass+p.B*Math.exp(e)*(this.terminalI(p.etaTerminal)-this.terminalI(e));const z=Math.min(45,(p.etaTerminal-e)/eff);return Math.exp((e-p.etaTerminal)/eff)*p.terminalMass+p.B*this.integral(u=>{const x=e+eff*u,t=Math.sinh(x);return Math.exp(-u)*t*(t+eff);},0,z);},
 plan(massKg,beta,k,capacityKg=(Rocket.dryMass+Rocket.fuelCapacity)*1000,maxG=Rocket.maxG,reserveFraction=this.reserve){
  const dry=Rocket.dryMass*1000,reserve=dry+reserveFraction*(capacityKg-dry),m0=Math.max(dry,Math.min(capacityKg,massKg)),eta0=Math.atanh(Math.max(0,Math.min(1-Number.EPSILON,beta))),a=Math.min(ShipPhysics.value('maxBrakingG')*9.80665,maxG*9.80665,Rocket.power*ShipPhysics.efficiency/(Rocket.c*capacityKg)),q=k*Rocket.c;
  const p={hybrid:true,massKg:m0,beta:Math.tanh(eta0),k,capacityKg,maxG:a/9.80665,reserveMass:reserve,eta0,q,a,B:q*Rocket.c/a,K:m0*Math.tanh(eta0/2),elapsedProper:0};
  if(!(eta0>0)){Object.assign(p,{etaTerminal:0,etaFill:0,terminalMass:m0,finalMass:m0,finalBeta:0,proper:0,earth:0,distance:0,heat:0,captured:0,burned:0,fill:{proper:0,earth:0,distance:0,captured:0,burned:0,heat:0},feed:{proper:0,earth:0,distance:0,captured:0,burned:0,heat:0}});return p;}
  if(!(q>0))throw new RangeError('A positive gas density is required to replenish fuel');
  const forward=e=>Math.min(capacityKg,p.K/Math.tanh(e/2)),final=(m,e)=>this.terminalMass({...p,terminalMass:m,etaTerminal:e},0);
  if(final(m0,eta0)>=reserve&&q*Rocket.c*Math.sinh(eta0)**2/m0<a){p.etaTerminal=eta0;p.terminalMass=m0;p.etaFill=eta0;}
  else{
   let lo=0,hi=Math.min(eta0,ShipPhysics.efficiency*Math.log(capacityKg/reserve)+.01);
   while(hi<eta0&&final(forward(hi),hi)>=reserve)hi=Math.min(eta0,hi*1.5+.01);
   for(let i=0;i<64;i++){const mid=(lo+hi)/2;if(final(forward(mid),mid)>reserve)lo=mid;else hi=mid;}
   p.etaTerminal=(lo+hi)/2;p.terminalMass=forward(p.etaTerminal);p.etaFill=Math.max(p.etaTerminal,2*Math.atanh(Math.min(1-Number.EPSILON,p.K/capacityKg)));
  }
  p.legacy={massKg:m0,beta:p.beta,K:p.K,k,capacityKg,maxG:p.maxG,finalMass:capacityKg,capBeta:2*(p.K/capacityKg)/(1+(p.K/capacityKg)**2)};
  p.etaFeedCap=Math.asinh((Math.sqrt(ShipPhysics.efficiency**2+4*capacityKg*a/(q*Rocket.c))-ShipPhysics.efficiency)/2);
  let loCap=p.etaFill,hiCap=eta0;for(let i=0;i<56;i++){const e=(loCap+hiCap)/2,m=Math.min(capacityKg,p.K/Math.tanh(e/2));if(q*Rocket.c*Math.sinh(e)**2/m>a)hiCap=e;else loCap=e;}p.etaGasCap=(loCap+hiCap)/2;
  p.fill=this.fillAt(p,p.etaFill);p.feed=this.feedLeg(p,p.etaTerminal);const end=this.atEta(p,0);
  Object.assign(p,{finalBeta:0,finalMass:end.mass,proper:end.proper,earth:end.earth,distance:end.distance,heat:end.heat,captured:end.captured,burned:end.burned});return p;
 },
 peakMass(p){
  // A dense cloud can make the terminal branch gain mass before it slows.
  // Check its interior maximum as well as its endpoints; clipping the UI tank
  // afterwards would silently discard captured matter and break the ledger.
  let lo=0,hi=p.etaTerminal;
  for(let n=0;n<56;n++){const e=(lo+hi)/2,s=Math.sinh(e);if(this.terminalMass(p,e)-p.B*s*(s+ShipPhysics.efficiency)>0)lo=e;else hi=e;}
  return Math.max(p.massKg,p.terminalMass,p.finalMass,this.terminalMass(p,(lo+hi)/2),p.etaFill>p.etaTerminal?p.capacityKg:0);
 },
 fillAt(p,e){
  if(e>=p.eta0)return{proper:0,earth:0,distance:0,captured:0,burned:0,heat:0,mass:p.massKg};
  const mass=Math.min(p.capacityKg,p.K/Math.tanh(e/2)),leg=Magnetic.cappedLeg(p.legacy,Math.tanh(e));
  return{...leg,mass,captured:mass-p.massKg,burned:0,heat:p.K*Rocket.c**2*(p.eta0-e)};
 },
 feedLeg(p,e){
  if(e>=p.etaFill||p.etaFill<=p.etaTerminal&&p.etaFill===p.eta0)return{proper:0,earth:0,distance:0,captured:0,burned:0,heat:0};
  const m=p.capacityKg,C=x=>m/(Math.sinh(x)+ShipPhysics.efficiency),cut=Math.max(e,Math.min(p.etaFill,p.etaFeedCap)),raw=x=>m/(p.q*Math.sinh(x)*(Math.sinh(x)+ShipPhysics.efficiency)),k=Rocket.c/(p.a*Rocket.year),captured=this.integral(C,e,p.etaFill);
  const capped=key=>{if(cut>=p.etaFill)return 0;if(key==='proper')return k*(p.etaFill-cut);if(key==='earth')return k*(Math.sinh(p.etaFill)-Math.sinh(cut));return k*2*Math.sinh((p.etaFill+cut)/2)*Math.sinh((p.etaFill-cut)/2);};
  return{proper:this.integral(raw,e,cut)/Rocket.year+capped('proper'),earth:this.integral(x=>raw(x)*Math.cosh(x),e,cut)/Rocket.year+capped('earth'),distance:this.integral(x=>raw(x)*Math.sinh(x),e,cut)/Rocket.year+capped('distance'),captured,burned:captured,heat:Rocket.c**2*this.integral(x=>C(x)*(Math.cosh(x)-1),e,p.etaFill)};
 },
 atEta(p,e){
  if(p.noCapture)return ReleasingBrake.atEta(p,e);
  let out,mass;
  if(e>=p.etaFill){out=this.fillAt(p,e);mass=out.mass;}
  else if(e>=p.etaTerminal){const q=this.feedLeg(p,e);out={};for(const key of ['proper','earth','distance','captured','burned','heat'])out[key]=p.fill[key]+q[key];mass=p.capacityKg;}
  else{
   const k=Rocket.c/(p.a*Rocket.year),ch=2*Math.sinh((p.etaTerminal+e)/2)*Math.sinh((p.etaTerminal-e)/2),captured=p.B*ch;mass=this.terminalMass(p,e);
   const q={proper:k*(p.etaTerminal-e),earth:k*(Math.sinh(p.etaTerminal)-Math.sinh(e)),distance:k*ch,captured,burned:p.terminalMass+captured-mass,heat:.5*p.B*Rocket.c**2*((Math.cosh(p.etaTerminal)-1)**2-(Math.cosh(e)-1)**2)};
   out={};for(const key of ['proper','earth','distance','captured','burned','heat'])out[key]=p.fill[key]+p.feed[key]+q[key];
  }
  return{...out,heat:out.heat+(1-ShipPhysics.efficiency)*out.burned*Rocket.c**2,mass,beta:Math.tanh(e)};
 },
 sampleProper(p,years){
  if(p.noCapture)return ReleasingBrake.sampleProper(p,years);
  const proper=Math.max(0,Math.min(p.proper,years));let e;
  if(proper===0)e=p.eta0;else if(proper===p.proper)e=0;
  else if(proper>=p.fill.proper+p.feed.proper)e=p.etaTerminal-(proper-p.fill.proper-p.feed.proper)*p.a*Rocket.year/Rocket.c;
  else{let lo=proper<p.fill.proper?p.etaFill:p.etaTerminal,hi=proper<p.fill.proper?p.eta0:p.etaFill;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(this.atEta(p,mid).proper>proper)lo=mid;else hi=mid;}e=(lo+hi)/2;}
  const out=this.atEta(p,e),s=Math.sinh(e),gamma=Math.cosh(e),fullGas=p.q*Rocket.c*s*s;let opening=1,burnRate=0,acceleration=0;
  if(e>=p.etaFill){opening=fullGas>0?Math.min(1,out.mass*p.a/fullGas):1;acceleration=fullGas*opening/out.mass;}
  else if(e>=p.etaTerminal){opening=Math.min(1,out.mass*p.a/(p.q*Rocket.c*s*(s+ShipPhysics.efficiency)));burnRate=p.q*s*opening;acceleration=p.q*Rocket.c*s*(s+ShipPhysics.efficiency)*opening/out.mass;}
  else{burnRate=Math.max(0,(out.mass*p.a/Rocket.c-p.q*s*s)/ShipPhysics.efficiency);acceleration=p.a;}
  if(proper===p.proper){out.mass=p.finalMass??out.mass;out.beta=0;acceleration=0;burnRate=0;}
  const incoming=p.q*s*opening;
  return{...out,proper,eta:e,p:p.proper?proper/p.proper:1,opening,force:-out.mass*acceleration,properAcceleration:-acceleration,coordinateAcceleration:-acceleration/gamma**3,massRate:incoming-burnRate,processedMassRate:incoming,particles:incoming/gamma/Magnetic.protonMass,properParticles:incoming/Magnetic.protonMass,burnRate,enginePower:burnRate*Rocket.c**2,heatPower:(gamma-1)*incoming*Rocket.c**2};
 },
 stopping(fuel,beta,maxG=Rocket.maxG,medium=Magnetic.context()){
  const magnetic=this.plan((Rocket.dryMass+Math.max(0,fuel))*1000,beta,Magnetic.rho(medium.n)*medium.area,(Rocket.dryMass+Rocket.fuelCapacity)*1000,maxG),engine=Rocket.retroPlan(Math.max(0,magnetic.finalMass/1000-Rocket.dryMass),0,maxG);
  return{magnetic,engine,distance:magnetic.distance,earth:magnetic.earth,proper:magnetic.proper};
 }
};

// Released gas transfers momentum without supplying fuel. The gas sail and
// engine share the 100 g limit; the last part reaches exact zero speed.
const ReleasingBrake={
 integral(e){if(e<.02){let sum=0;for(let i=0;i<8;i++){const x=e*(1+QUAD_X[i])/2;sum+=QUAD_W[i]*Math.exp(-x)*Math.sinh(x)**2;}return sum*e/2;}return Math.expm1(e)/4-Math.expm1(-3*e)/12+Math.expm1(-e)/2;},
 terminalMass(p,e){const eff=ShipPhysics.efficiency;if(eff===1)return Math.exp(e-p.etaTerminal)*p.massKg+p.B*Math.exp(e)*(this.integral(p.etaTerminal)-this.integral(e));const z=Math.min(45,(p.etaTerminal-e)/eff);return Math.exp((e-p.etaTerminal)/eff)*p.massKg+p.B*HybridBrake.integral(u=>Math.exp(-u)*Math.sinh(e+eff*u)**2,0,z);},
 gasLeg(p,e){
  const cut=Math.min(p.eta0,Math.max(e,p.etaGasCap)),base=Rocket.c/(p.a*Rocket.year),out={proper:base*(p.eta0-cut),earth:base*(Math.sinh(p.eta0)-Math.sinh(cut)),distance:base*2*Math.sinh((p.eta0+cut)/2)*Math.sinh((p.eta0-cut)/2)};
  if(e<cut){const tail=Magnetic.fixedIntegrals(p.massKg,Math.tanh(cut),Math.tanh(e),p.k);for(const key of ['proper','earth','distance'])out[key]+=tail[key];}
  return out;
 },
 plan(mass,beta,k,reserve=Rocket.dryMass*1000){
  const a=Math.min(ShipPhysics.value('maxBrakingG')*9.80665,Rocket.power*ShipPhysics.efficiency/(Rocket.c*mass)),eta0=Math.atanh(Math.min(1-Number.EPSILON,beta)),B=k*Rocket.c**2/a;
  if(!(mass>reserve+1e-12)||!(k>0))return null;
  const p={hybrid:true,noCapture:true,massKg:mass,beta,eta0,k,q:k*Rocket.c,a,B,maxG:a/9.80665,etaGasCap:Math.asinh(Math.sqrt(mass/B))};
  p.etaTerminal=Math.min(eta0,p.etaGasCap);
  if(this.terminalMass(p,0)<reserve){let lo=0,hi=p.etaTerminal;for(let i=0;i<56;i++){p.etaTerminal=(lo+hi)/2;if(this.terminalMass(p,0)>=reserve)lo=p.etaTerminal;else hi=p.etaTerminal;}p.etaTerminal=(lo+hi)/2;}
  p.gas=this.gasLeg(p,p.etaTerminal);p.terminalMass=mass;p.finalMass=this.terminalMass(p,0);p.captured=0;p.burned=mass-p.finalMass;p.finalBeta=0;
  const base=Rocket.c/(a*Rocket.year);p.proper=p.gas.proper+base*p.etaTerminal;p.earth=p.gas.earth+base*Math.sinh(p.etaTerminal);p.distance=p.gas.distance+base*2*Math.sinh(p.etaTerminal/2)**2;p.heat=this.atEta(p,0).heat;
  return p;
 },
 atEta(p,e){
  e=Math.max(0,Math.min(p.eta0,e));
  if(e>=p.etaTerminal)return{...this.gasLeg(p,e),mass:p.massKg,beta:Math.tanh(e),captured:0,burned:0,heat:2*p.massKg*Rocket.c**2*(Math.log(Math.cosh(p.eta0/2))-Math.log(Math.cosh(e/2)))};
  const base=Rocket.c/(p.a*Rocket.year),mass=this.terminalMass(p,e),gasHeat=2*p.massKg*Rocket.c**2*(Math.log(Math.cosh(p.eta0/2))-Math.log(Math.cosh(p.etaTerminal/2)));
  return{proper:p.gas.proper+base*(p.etaTerminal-e),earth:p.gas.earth+base*(Math.sinh(p.etaTerminal)-Math.sinh(e)),distance:p.gas.distance+base*2*Math.sinh((p.etaTerminal+e)/2)*Math.sinh((p.etaTerminal-e)/2),mass,beta:Math.tanh(e),captured:0,burned:p.massKg-mass,heat:gasHeat+.5*p.B*Rocket.c**2*((Math.cosh(p.etaTerminal)-1)**2-(Math.cosh(e)-1)**2)};
 },
 sampleProper(p,years){
  const proper=Math.max(0,Math.min(p.proper,years));let eta;
  if(proper===0)eta=p.eta0;else if(proper===p.proper)eta=0;
  else if(proper>=p.gas.proper)eta=p.etaTerminal-(proper-p.gas.proper)*p.a*Rocket.year/Rocket.c;
  else{let lo=p.etaTerminal,hi=p.eta0;for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(this.gasLeg(p,mid).proper>proper)lo=mid;else hi=mid;}eta=(lo+hi)/2;}
  const out=this.atEta(p,eta),gas=p.q*Rocket.c*Math.sinh(eta)**2,opening=gas>0?Math.min(1,out.mass*p.a/gas):0,acceleration=eta>=p.etaTerminal?gas*opening/out.mass:p.a,burnRate=eta<p.etaTerminal?Math.max(0,(out.mass*p.a-gas)/(Rocket.c*ShipPhysics.efficiency)):0;
  return{...out,heat:out.heat+(1-ShipPhysics.efficiency)*out.burned*Rocket.c**2,proper,eta,opening,properAcceleration:proper===p.proper?0:-acceleration,enginePower:proper===p.proper?0:burnRate*Rocket.c**2,processedMassRate:p.q*Math.sinh(eta)*opening,massRate:-burnRate};
 }
};

// Invert physical proper time, never an animation duration.
const ProperTime={
 at(plan,model,years){
  if(model===Stellar)return model.sampleProper(plan,years);
  if(plan.hybrid)return HybridBrake.sampleProper(plan,years);
  const total=plan.proper||0;if(years<=0)return{...model.sample(plan,0),p:0};if(years>=total)return{...model.sample(plan,1),p:1};
  let lo=0,hi=1;for(let i=0;i<58;i++){const p=(lo+hi)/2;if(model.sample(plan,p).proper<years)lo=p;else hi=p;}
  const p=(lo+hi)/2;return{...model.sample(plan,p),p};
 }
};

// Cumulative comoving powered-flight distance. Integrating from a fixed epoch
// makes long stellar acceleration and void braking independent of frame size.
const FlightPath={
 distance(plan,model,proper,epoch,enabled=true){
  const end=model===Stellar?Stellar.sampleProper(plan,proper):HybridBrake.sampleProper(plan,proper);
  if(!enabled)return end.distance/Cosmology.scale(epoch);
  const upper=model===Stellar?end.eta:plan.eta0,lower=model===Stellar?plan.eta0:end.eta;
  if(!(upper>lower))return 0;
  const cuts=[lower,upper,...(model===Stellar?[plan.etaSwitch]:[plan.etaFill,plan.etaTerminal,plan.etaFeedCap,plan.etaGasCap]).filter(e=>e>lower&&e<upper)].sort((a,b)=>a-b);
  const integrand=e=>{
   let earth,dt;
   if(model===Stellar){
    if(e<=plan.etaSwitch){dt=Rocket.c/(plan.maxG*9.80665);earth=dt*(Math.sinh(e)-Math.sinh(plan.eta0))/Rocket.year;}
    else{dt=plan.massKg*Rocket.c**2/(2*plan.beamPower)*Math.exp(2*e);earth=plan.base.earth+Stellar.beamLeg(plan.beamPower,plan.massKg,plan.etaSwitch,e).earth;}
   }else{
    earth=HybridBrake.atEta(plan,e).earth;const s=Math.sinh(e);
    if(plan.noCapture){dt=e>=plan.etaTerminal?Math.max(Rocket.c/plan.a,plan.massKg/(plan.q*s*s)):Rocket.c/plan.a;return Math.sinh(e)*dt/(Rocket.year*Cosmology.scale(epoch+earth));}
    if(e>=plan.etaFill){const mass=Math.min(plan.capacityKg,plan.K/Math.tanh(e/2));dt=Math.max(Rocket.c/plan.a,mass/(plan.q*s*s));}
    else if(e>=plan.etaTerminal)dt=Math.max(Rocket.c/plan.a,plan.capacityKg/(plan.q*s*(s+ShipPhysics.efficiency)));
    else dt=Rocket.c/plan.a;
   }
   return Math.sinh(e)*dt/(Rocket.year*Cosmology.scale(epoch+earth));
  };
  let distance=0;for(let i=1;i<cuts.length;i++)distance+=HybridBrake.integral(integrand,cuts[i-1],cuts[i]);return distance;
 }
};

// ETA uses the same acceleration samples, coast and stopping plans as Simulation.
// Cache arrival epochs, then subtract the clocks; never rerun an integral per frame.
const FlightEstimate={
 idleKey:null,idleValue:null,active:new WeakMap(),
 cosmicLeg(remaining,fuel,beta,engine=null,wind=null,windProper=0,epoch=0,flyby=false,gate=0,encounter=null){
  const enabled=state.expansion!==false,oldWind=wind?Stellar.sampleProper(wind,windProper):null,windEpoch=epoch-(enabled?(oldWind?.earth||0):0),oldPath=wind?FlightPath.distance(wind,Stellar,windProper,windEpoch,enabled):0,ma=Rocket.dryMass+(engine?Rocket.usableFuel(fuel):fuel);
  const sample=p=>{
   if(wind){const q=Stellar.sampleProper(wind,windProper+(wind.proper-windProper)*p);return{proper:q.proper-oldWind.proper,earth:q.earth-oldWind.earth,distance:q.distance-oldWind.distance,comoving:FlightPath.distance(wind,Stellar,q.proper,windEpoch,enabled)-oldPath,beta:q.beta,fuel};}
   if(engine){const mb=p===1?engine.mf:ma*Math.exp(-Math.log(ma/engine.mf)*p),q=Rocket.segment(engine.m0,ma,mb,engine.eta0||0,engine.maxG);return{...q,comoving:q.distance/Cosmology.scale(epoch+(enabled?q.earth/2:0)),fuel:Math.max(0,mb-Rocket.dryMass)};}
   return{proper:0,earth:0,distance:0,comoving:0,beta,fuel};
  };
  const stopAt=(b,f,t)=>flyby?{proper:encounter?.proper||0,earth:encounter?.earth||0,distance:gate,comoving:gate/Cosmology.scale(t)}:(()=>{const s=Magnetic.stopping(f,b,100);return{...s,comoving:FlightPath.distance(s.magnetic,Magnetic,s.proper,t,enabled)};})();
  const gap=q=>remaining-q.comoving-stopAt(q.beta,q.fuel,epoch+(enabled?q.earth:0)).comoving;
  let q=sample(1),stop,coast={proper:0,earth:0,distance:0,path:0,beta:q.beta};
  if(gap(q)<=0){let lo=0,hi=1;for(let i=0;i<58;i++){const p=(lo+hi)/2;if(gap(sample(p))>0)lo=p;else hi=p;}q=sample((lo+hi)/2);}
  else{
   if(!(q.beta>0))return null;const startTime=epoch+(enabled?q.earth:0),d=remaining-q.comoving,coastGap=c=>d-c.distance-stopAt(c.beta,q.fuel,startTime+(enabled?c.earth:0)).comoving;
   let lo=0,hi=Math.max(1,d*Math.sqrt((1-q.beta)*(1+q.beta))/q.beta),c=Cosmology.coast(q.beta,hi,startTime,enabled),found=coastGap(c)<=0;
   for(let i=0;!found&&i<40;i++){hi*=2;c=Cosmology.coast(q.beta,hi,startTime,enabled);found=coastGap(c)<=0;if(hi>2e12)break;}
   if(!found)return{proper:Infinity,earth:Infinity,unreachable:true};
   for(let i=0;i<55;i++){const mid=(lo+hi)/2,c=Cosmology.coast(q.beta,mid,startTime,enabled);if(coastGap(c)>0)lo=mid;else hi=mid;}coast=Cosmology.coast(q.beta,(lo+hi)/2,startTime,enabled);
  }
  stop=stopAt(coast.proper>0?coast.beta:q.beta,q.fuel,epoch+(enabled?q.earth+coast.earth:0));
  return{proper:q.proper+coast.proper+stop.proper,earth:q.earth+coast.earth+stop.earth,acceleration:{distance:q.distance,proper:q.proper},terminalBeta:coast.proper>0?coast.beta:q.beta,peakBeta:q.beta,arrivalFuelKg:flyby?null:Math.max(0,stop.magnetic.finalMass-Rocket.dryMass*1000),stop,braking:flyby?null:{distance:stop.distance,proper:stop.proper}};
 },

 leg(remaining,fuel,beta,engine=null,wind=null,windProper=0,flyby=false,gate=0,encounter=null){
  const g=engine?.maxG||wind?.maxG||100,ma=Rocket.dryMass+(engine?Rocket.usableFuel(fuel):fuel);
  const oldWind=wind?Stellar.sampleProper(wind,windProper):null;
  const sample=p=>{
   if(wind){const q=Stellar.sampleProper(wind,windProper+(wind.proper-windProper)*p);return{proper:q.proper-oldWind.proper,earth:q.earth-oldWind.earth,distance:q.distance-oldWind.distance,beta:q.beta,fuel};}
   if(engine){const mb=p===1?engine.mf:ma*Math.exp(-Math.log(ma/engine.mf)*p),q=Rocket.segment(engine.m0,ma,mb,engine.eta0||0,g);return{...q,fuel:Math.max(0,mb-Rocket.dryMass)};}
   return{proper:0,earth:0,distance:0,beta,fuel};
  };
  const stopping=q=>flyby?{proper:encounter?.proper||0,earth:encounter?.earth||0,distance:gate}:Magnetic.stopping(q.fuel,q.beta,g);
  let q=sample(1),stop=stopping(q);
  if(q.distance+stop.distance>remaining){let lo=0,hi=1;for(let i=0;i<60;i++){const m=(lo+hi)/2,s=sample(m);if(s.distance+stopping(s).distance>remaining)hi=m;else lo=m;}q=sample((lo+hi)/2);stop=stopping(q);}
  if(!(q.beta>0))return null;
  const coast=Math.max(0,remaining-q.distance-stop.distance),earth=coast/q.beta,proper=earth*Math.sqrt((1-q.beta)*(1+q.beta));
  return{proper:q.proper+proper+stop.proper,earth:q.earth+earth+stop.earth,acceleration:{distance:q.distance,proper:q.proper},braking:flyby?null:{distance:stop.distance,proper:stop.proper},terminalBeta:q.beta,peakBeta:q.beta,arrivalFuelKg:flyby?null:Math.max(0,stop.magnetic.finalMass-Rocket.dryMass*1000),stop};
 },
 remaining(){
  const f=state.flight;
  if(state.phase==='dock'){const e=f.engine,q=Rocket.retroSegment(e.m0,e.eta0,Rocket.dryMass+state.matter,e.mf,e.maxG);return{proper:q.proper,earth:q.earth};}
  if(state.phase==='brake'){const m=f.magnetic,q=m.lastSample||ProperTime.at(m,Magnetic,m.elapsedProper||0),e=Rocket.retroPlan(m.finalMass/1000-Rocket.dryMass,m.finalBeta,m.maxG);return{proper:Math.max(0,m.proper-q.proper)+e.burnProper,earth:Math.max(0,m.earth-q.earth)+e.burnEarth,arrivalFuelKg:Math.max(0,e.mf-Rocket.dryMass)*1000};}
  if(state.phase==='flyby'){const p=f.encounter.plan,q=Gravity.atProper(p,p.elapsedProper||0);return{proper:Math.max(0,p.proper-q.proper),earth:Math.max(0,p.earth-q.earth)};}
  return this.leg(f.distance-f.covered,state.matter,state.beta,state.phase==='thrust'?f.engine:null,state.phase==='launch'?f.wind:null,f.wind?.elapsedProper||0,Route.isFlyby(),f.aim?0:(f.encounter?.plan?.R||0)/LY,f.encounter?.plan);
 },
 get(){
  if(state.flight?.mission||!state.flight&&MissionPlanner.enabledIdle())return MissionPlanner.estimate();
  const f=state.flight,goal=object(f?.target||state.selected),remaining=f?Math.max(0,f.distance-f.covered):goal?.p3?distance(state.ship,goal):0;
  if((f?f.cosmic:Cosmology.isCosmic(object(state.current)||state.ship,goal))&&Cosmology.beyondHorizon(remaining,state.cosmicTime||0))return{proper:Infinity,earth:Infinity,unreachable:true};
  if(f?.cosmic&&['cruise','launch','thrust'].includes(state.phase)){
   const key=['cosmic',state.phase,state.expansion].join(':');let cache=this.active.get(f);
   if(!cache||cache.key!==key){const q=this.cosmicLeg(remaining,state.matter,state.beta,state.phase==='thrust'?f.engine:null,state.phase==='launch'?f.wind:null,f.wind?.elapsedProper||0,state.cosmicTime||0,Route.isFlyby(),f.aim?0:(f.encounter?.plan?.R||0)/LY,f.encounter?.plan);cache={key,value:q?{...q,proper:state.proper+q.proper,earth:state.earth+q.earth}:null};this.active.set(f,cache);}
   return cache.value?{...cache.value,proper:Math.max(0,cache.value.proper-state.proper),earth:Math.max(0,cache.value.earth-state.earth)}:null;
  }

  if(f){const key=[state.phase,f.distance,f.target,Route.isFlyby(),f.encounter?.beta].join(':');let cache=this.active.get(f);if(!cache||cache.key!==key){const q=this.remaining();cache={key,value:q?{proper:state.proper+q.proper,earth:state.earth+q.earth,terminalBeta:q.beta??q.terminalBeta,arrivalFuelKg:q.arrivalFuelKg}:null};this.active.set(f,cache);}return cache.value?{proper:Math.max(0,cache.value.proper-state.proper),earth:Math.max(0,cache.value.earth-state.earth),terminalBeta:cache.value.terminalBeta,arrivalFuelKg:cache.value.arrivalFuelKg}:null;}
  const target=object(state.selected);if(!target?.navigable||state.current===target.id)return null;
  const d=distance(state.ship,target),boost=wantsBoost(),key=[state.current,state.selected,d,state.matter,boost,state.departureMode,state.sail,state.expansion,Math.floor((state.cosmicTime||0)/1e5)].join(':');
  if(this.idleKey!==key){this.idleKey=key;this.idleValue=this.leg(d,state.matter,0,boost?null:Rocket.plan(state.matter,d),boost?windPlan():null);if(Cosmology.isCosmic(object(state.current)||state.ship,target))this.idleValue=this.cosmicLeg(d,state.matter,0,boost?null:Rocket.plan(state.matter,d),boost?windPlan():null,0,state.cosmicTime||0);}
  return this.idleValue;
 }
};

// Card-only summary: full physical stages, with measured totals once acceleration ends.
const FlightProfile={
 idleKey:null,idleValue:null,
 peakWind(w,proper){let peak=0;for(let n=0;n<=24;n++){const q=Stellar.sampleProper(w,proper*n/24);peak=Math.max(peak,q.force/w.massKg/9.80665);}return peak;},
 brake(stop){if(!stop?.magnetic)return null;const m=stop.magnetic,e=stop.engine;return{distance:stop.distance,proper:stop.proper,maxG:Math.max(m.hybrid&&m.proper>0?m.maxG:0,Math.abs(Magnetic.sample(m,0).properAcceleration)/9.80665,e.burnProper>0?Rocket.acceleration(e.mf,e.maxG)/9.80665:0)};},
 predict(d,fuel,engine,wind,flyby=false,eta=null,cosmic=false){
  const q=cosmic&&eta?.acceleration?eta:FlightEstimate.leg(d,fuel,0,engine,wind,0,flyby);if(!q)return null;
  const acceleration={...q.acceleration,maxG:wind?this.peakWind(wind,q.acceleration.proper):q.acceleration.proper>0?Rocket.acceleration(engine.m0*Math.exp(-q.acceleration.proper*engine.maxG*9.80665*Rocket.year/Rocket.c),engine.maxG)/9.80665:0};
  let stop=q.stop;if(!flyby&&stop?.magnetic&&cosmic&&Number.isFinite(eta?.proper)&&Number.isFinite(eta?.terminalBeta??eta?.beta))stop=Magnetic.stopping(q.stop?.magnetic?.massKg/1000-Rocket.dryMass,eta.terminalBeta??eta.beta);
  return{acceleration,braking:flyby||eta?.proper===Infinity?null:this.brake(stop),flyby,unreachable:eta?.proper===Infinity};
 },
 record(f,ds,proper,g){if(!f.profile)return;const key=['launch','thrust'].includes(state.phase)?'acceleration':['brake','dock'].includes(state.phase)?'braking':null;if(!key)return;const a=f.profile.actual[key]??={distance:0,proper:0,maxG:0};a.distance+=ds;a.proper+=proper;a.maxG=Math.max(a.maxG,g);},
 get(eta){
  if(state.flight?.mission||!state.flight&&MissionPlanner.enabledIdle())return MissionPlanner.profile();
  const f=state.flight;
  if(!f){const target=object(state.selected);if(!target?.navigable||target.id===state.current)return null;const d=distance(state.ship,target),boost=wantsBoost(),key=[state.current,state.selected,d,state.matter,boost,state.departureMode,state.sail,state.expansion,Math.floor((state.cosmicTime||0)/1e5)].join(':');if(this.idleKey!==key){this.idleKey=key;this.idleValue=this.predict(d,state.matter,boost?null:Rocket.plan(state.matter,d),boost?windPlan():null,false,eta,Cosmology.isCosmic(object(state.current)||state.ship,target));}return this.idleValue;}
  if(!f.profile){
   const wind=f.wind,engine=f.engine?.direction>0?f.engine:null,fuel=wind?state.matter:engine?(engine.initialFuel??engine.m0-Rocket.dryMass):state.matter;
   let predicted=wind||engine?this.predict(f.distance*Cosmology.factor(f),fuel,engine,wind,Route.isFlyby(),eta,f.cosmic):null;
   const actual={acceleration:null,braking:null};
   if(wind){const q=wind.lastSample||Stellar.sampleProper(wind,wind.elapsedProper||0);actual.acceleration={distance:q.distance,proper:q.proper,maxG:this.peakWind(wind,q.proper)};}
   else if(engine){const q=Rocket.segment(engine.m0,engine.m0,engine.m0-engine.burned,engine.eta0||0,engine.maxG);actual.acceleration={distance:q.distance,proper:q.proper,maxG:q.proper>0?Rocket.acceleration(engine.m0-engine.burned,engine.maxG)/9.80665:0};}
   f.profile={...(predicted||{acceleration:state.phase==='dock'?null:{distance:0,proper:0,maxG:0,actual:true},braking:null,flyby:Route.isFlyby()}),actual,phase:null};
  }
  const p=f.profile;
  if(p.replan){
   if(['launch','thrust'].includes(state.phase)){
    const q=this.predict((f.distance-f.covered)*Cosmology.factor(f),state.matter,state.phase==='thrust'?f.engine:null,state.phase==='launch'?f.wind:null,Route.isFlyby(),eta,f.cosmic),actual=p.actual.acceleration;
    if(q){p.acceleration={distance:(actual?.distance||0)+q.acceleration.distance,proper:(actual?.proper||0)+q.acceleration.proper,maxG:Math.max(actual?.maxG||0,q.acceleration.maxG)};p.braking=q.braking;}
   }
   delete p.replan;
  }
  if(!['launch','thrust'].includes(state.phase)&&p.actual.acceleration){p.acceleration={...p.actual.acceleration,actual:true};}
  if(p.phase!==state.phase){
   if(state.phase==='cruise'&&!Route.isFlyby()){
    const beta=f.cosmic?(eta?.terminalBeta??state.beta):state.beta;
    p.braking=eta?.proper===Infinity?null:this.brake(Magnetic.stopping(state.matter,beta));p.unreachable=eta?.proper===Infinity;
   }
   if(state.phase==='brake'){
    const m=f.magnetic,q=m.lastSample||ProperTime.at(m,Magnetic,m.elapsedProper||0),engine=Rocket.retroPlan(m.finalMass/1000-Rocket.dryMass,m.finalBeta,m.maxG);
    p.actual.braking??={distance:q.distance,proper:q.proper,maxG:Math.abs(q.properAcceleration)/9.80665};
    p.braking={distance:p.actual.braking.distance+Math.max(0,m.distance-q.distance)+engine.burnDistance,proper:p.actual.braking.proper+Math.max(0,m.proper-q.proper)+engine.burnProper,maxG:Math.max(m.hybrid&&m.proper>0?m.maxG:0,p.actual.braking.maxG,Math.abs(q.properAcceleration)/9.80665,engine.burnProper>0?Rocket.acceleration(engine.mf,engine.maxG)/9.80665:0)};
   }
   if(state.phase==='dock'){
    const e=f.engine,q=Rocket.retroSegment(e.m0,e.eta0,Rocket.dryMass+state.matter,e.mf,e.maxG),a=p.actual.braking;
    p.braking=a?{distance:a.distance+q.distance,proper:a.proper+q.proper,maxG:Math.max(a.maxG,Rocket.acceleration(e.mf,e.maxG)/9.80665)}:{distance:q.distance,proper:q.proper,maxG:Rocket.acceleration(e.mf,e.maxG)/9.80665,remainingOnly:true};
   }
   p.phase=state.phase;
  }
  return p;
 }
};

// Composable mission settings are additive to v11 saves. Legacy flights keep
// their original integrators; a composed flight stores its complete trajectory.
// Weak-field point-mass capture. Integrate backwards from an actual circular
// state, rather than declaring arrival when a scalar speed crosses a threshold.
// Rapidity is monotone on this controlled capture branch. An unsupported passive
// spiralling branch is rejected explicitly; it is never turned into a free orbit.
const OrbitalArrival={
 enabled:true,G:6.67430e-11,solarMass:1.98847e30,AU:149597870700,cache:new Map(),
 target(o){
  if(!this.enabled||!o||!['home','star','pulsar','blackhole','quasar'].includes(o.kind)||state.destroyed.includes(o.id))return null;
  const mass=MapDetails.massInfo(o);if(!mass||mass.system)return null;
  const text=String(o.facts?.class||o.type||'');if(/двойная система|тройная система/i.test(text)&&!MapDetails.component(o))return null;
  const mu=this.G*this.solarMass*mass.solar,rs=2*mu/Rocket.c**2;
  const radiusText=String(o.facts?.radius||'').replace(/(?<=\d)\s+(?=\d)/g,''),radiusMatch=radiusText.match(/([\d.,]+)(?:[–−-]([\d.,]+))?\s*R☉/);
  const surface=o.kind==='blackhole'||o.kind==='quasar'?rs:o.kind==='pulsar'?15000:o.radiusSolar>0?o.radiusSolar*695700000:radiusMatch?Number((radiusMatch[2]||radiusMatch[1]).replace(',','.'))*695700000:Stellar.stellarLight(o).collectorR/1.2;
  // Keep the Newtonian field weak, including at supermassive black holes. This
  // deliberately avoids using a Newtonian circular speed near an ISCO/horizon.
  const radius=Math.max(this.AU,3*surface,10000*rs),speed=Math.sqrt(mu/radius);
  return{targetId:o.id,massSolar:mass.solar,massBasis:mass.basis,massSource:mass.source,mu,rs,surface,radius,speed,beta:speed/Rocket.c,radiusAdjusted:radius>this.AU*(1+1e-10),weakField:true};
 },
 integrate(body,c,initialMass,beta,finalMass,switchEta,keep=false,allowFeed=true){
  const endEta=Math.atanh(beta),etaFinal=Math.atanh(body.beta),cap=c.dryMassKg+c.capacityKg,k=c.brakeSail?Magnetic.rho(c.densityCm3*1e6)*SHIP.sailAreaM2:0,limit=c.maxBrakingG*9.80665;
  if(!(endEta>etaFinal))return null;
  let eta=etaFinal,y=[body.radius,0,Math.PI/2,Math.log(finalMass),0,0,0,0,0,0],h=Math.max(1e-9,etaFinal*.02),feed=false,rows=[];
  const rate=(e,v)=>{
   const mass=Math.exp(v[3]),r=Math.hypot(v[0],v[1]),cs=Math.cos(v[2]),sn=Math.sin(v[2]),s=Math.sinh(e),gamma=Math.cosh(e),gx=-body.mu*v[0]/r**3,gy=-body.mu*v[1]/r**3,gpar=gx*cs+gy*sn,gperp=-gx*sn+gy*cs;
   if(!Number.isFinite(mass)||mass<c.dryMassKg*.5||r<body.surface*1.01)return null;
   const fullGas=k*Rocket.c**2*s*s,gasMass=k*Rocket.c*s,motor=c.brakeEngine&&e<=switchEta+1e-14;
   let opening=fullGas>0?Math.min(1,mass*limit/fullGas):0,engine=0;
   if(motor&&feed&&c.collectGas){opening=Math.min(1,mass*limit/(fullGas+gasMass*Rocket.c*ShipPhysics.efficiency));engine=gasMass*Rocket.c*ShipPhysics.efficiency*opening/mass;}
   else if(motor)engine=Math.min(Rocket.power*ShipPhysics.efficiency/(Rocket.c*mass),Math.max(0,limit-fullGas*opening/mass));
   const gas=fullGas*opening/mass,a=gas+engine,denom=a-gpar;
   if(!(denom>0))return null;
   // At the dry-mass boundary the permitted collection can be deferred. Gas
   // still exchanges momentum and is released; no matter is created or clipped.
   const incoming=c.collectGas&&(motor||mass>Math.min(initialMass,c.dryMassKg)*(1+1e-9))?gasMass*opening:0,burn=mass*engine/(Rocket.c*ShipPhysics.efficiency),tau=Rocket.c/denom;
   return{dy:[-Rocket.c*s*cs*tau,-Rocket.c*s*sn*tau,-gamma*gperp/(Rocket.c*s)*tau,-(incoming-burn)/mass*tau,tau/Rocket.year,gamma*tau/Rocket.year,Rocket.c*s*tau/LY,incoming*tau,burn*tau,((gamma-1)*gasMass*opening+(1-ShipPhysics.efficiency)*burn)*Rocket.c**2*tau],a,engine,opening,gravity:Math.hypot(gx,gy),burnRate:burn};
  };
  const rk=(e,v,step)=>{const a=rate(e,v)?.dy;if(!a)return null;const add=(q,f)=>v.map((x,i)=>x+q[i]*f),b=rate(e+step/2,add(a,step/2))?.dy,d=b&&rate(e+step/2,add(b,step/2))?.dy,z=d&&rate(e+step,add(d,step))?.dy;return z?v.map((x,i)=>x+step*(a[i]+2*b[i]+2*d[i]+z[i])/6):null;};
  const twice=(e,v,step)=>{const a=rk(e,v,step/2);return a&&rk(e+step/2,a,step/2);};
  const row=()=>{const r=rate(eta,y);return{eta,beta:Math.tanh(eta),x:y[0],y:y[1],theta:y[2],mass:Math.exp(y[3]),proper:y[4],earth:y[5],distance:y[6],captured:y[7],burned:y[8],heat:y[9],a:-(r?.a||0),opening:r?.opening||0,gravity:r?.gravity||0,burnRate:r?.burnRate||0};};
  if(keep)rows.push(row());
  for(let n=0;n<6000&&eta<endEta;n++){
   if(eta>=switchEta-1e-13)feed=false;
   h=Math.min(h,endEta-eta,.06*Math.max(eta,etaFinal));if(switchEta>eta+1e-13)h=Math.min(h,switchEta-eta);
   let full=rk(eta,y,h),next=twice(eta,y,h);
   if(!full||!next||!next.every(Number.isFinite)){h*=.2;if(h<1e-14*Math.max(1,eta))return null;continue;}
   if(allowFeed&&k>0&&c.brakeEngine&&c.collectGas&&!feed&&eta<switchEta&&next[3]>Math.log(cap)){
    let lo=0,hi=h;for(let j=0;j<30;j++){const mid=(lo+hi)/2,q=twice(eta,y,mid);if(q&&q[3]>Math.log(cap))hi=mid;else lo=mid;}h=(lo+hi)/2;next=twice(eta,y,h);full=rk(eta,y,h);
   }
   let error=0;for(let i=0;i<y.length;i++){const floor=i<2?body.radius*1e-5:i===2?1:i===3?.1:i===6?body.radius/LY*1e-5:1e-10;error=Math.max(error,Math.abs(next[i]-full[i])/(Math.max(floor,Math.abs(next[i]),Math.abs(y[i]))*3e-8));}
   if(error>1){h*=Math.max(.15,.85*error**(-.2));if(h<1e-14*Math.max(1,eta))return null;continue;}
   if(eta+h===eta)return null;eta+=h;y=next;
   if(allowFeed&&k>0&&c.brakeEngine&&c.collectGas&&!feed&&eta<switchEta&&Math.exp(y[3])>=cap*(1-1e-10)){const delta=cap-Math.exp(y[3]);y[8]+=delta;y[3]=Math.log(cap);feed=true;}
   if(keep)rows.push(row());h*=Math.min(2,Math.max(.5,error>0?.85*error**(-.2):2));
  }
  if(eta<endEta-1e-12)return null;
  const start=row(),cs=Math.cos(start.theta),sn=Math.sin(start.theta),axis=-start.x*cs-start.y*sn,impact=-start.x*sn+start.y*cs;
  if(!(axis>=0))return null;
  return{startMass:start.mass,finalMass,proper:start.proper,earth:start.earth,distance:start.distance,captured:start.captured,burned:start.burned,heat:start.heat,axis,impact,startTheta:start.theta,rows,body,switchEta};
 },
 plan(c,mass,beta,reserve,body){
  const key=JSON.stringify([c,mass,beta,reserve,body]);if(this.cache.has(key))return this.cache.get(key);
  const minMass=c.dryMassKg+reserve,eta0=Math.atanh(beta),etaF=Math.atanh(body.beta),run=(m,e,keep=false,allowFeed=true)=>this.integrate(body,c,mass,beta,m,e,keep,allowFeed);let finalMass=minMass,switchEta=eta0,result;
  if(!(beta>body.beta*(1+1e-8)))return null;
  if(c.brakeEngine){
   let fast=run(finalMass,switchEta,false,false);
   if(!fast)return null;
   if(fast.startMass<mass*(1-2e-9)){
    // With enough initial propellant, retain the unused part instead of burning
    // it merely to hit the requested minimum reserve.
    for(let n=0;n<14;n++){
     finalMass=Math.min(c.dryMassKg+c.capacityKg-1e-10,finalMass*mass/fast.startMass);fast=run(finalMass,switchEta,false,false);if(!fast)return null;
     if(Math.abs(fast.startMass-mass)<mass*2e-9)break;
    }
    if(Math.abs(fast.startMass-mass)>mass*2e-7)return null;
   }else if(fast.startMass>mass*(1+2e-9)){
    if(!c.brakeSail||!(c.densityCm3>0))return null;
    const k=Magnetic.rho(c.densityCm3*1e6)*SHIP.sailAreaM2;
    const vacuum=c.collectGas?HybridBrake.plan(mass,beta,k,c.dryMassKg+c.capacityKg,c.maxBrakingG,reserve/c.capacityKg):ReleasingBrake.plan(mass,beta,k,minMass);
    let lo=etaF,hi=eta0,x=Math.min(hi,Math.max(lo,(vacuum?.etaTerminal||eta0/2)+etaF)),previous=null;
    for(let n=0;n<18;n++){
     const q=run(finalMass,x),f=q?Math.log(q.startMass/mass):-Infinity;
     if(q&&Math.abs(f)<3e-10){lo=hi=x;break;}
     if(!q||f<0)lo=x;else hi=x;
     let next=previous&&Number.isFinite(f)&&Number.isFinite(previous.f)&&f!==previous.f?x-f*(x-previous.x)/(f-previous.f):x-(Number.isFinite(f)?f:0);
     previous={x,f};x=next>lo&&next<hi?next:(lo+hi)/2;
    }
    switchEta=hi;
   }
   result=run(finalMass,switchEta,true,fast.startMass>mass*(1+2e-9));
  }else{
   // A passive, monotone capture is accepted only when the full gravitational
   // trajectory reaches the circular state. Weak-drag spiral branches require
   // another guidance law and are reported as unsupported, never as captured.
   let lo=minMass,hi=c.dryMassKg+c.capacityKg;
   for(let n=0;n<30;n++){const mid=(lo+hi)/2,q=run(mid,etaF-1);if(!q)return null;if(q.startMass<mass)lo=mid;else hi=mid;}
   finalMass=(lo+hi)/2;switchEta=etaF-1;result=run(finalMass,switchEta,true);
  }
  if(!result||Math.abs(result.startMass-mass)>Math.max(2e-7,mass*2e-7)||result.finalMass<minMass-1e-8)return null;
  // Reverse the cumulative backwards ledger. The terminal velocity is tangent
  // to r and its specific orbital energy is negative by construction.
  const p=result,last=p.rows.at(-1),total=p.proper;
  p.rows.reverse();for(const q of p.rows){q.proper=total-q.proper;q.earth=p.earth-q.earth;q.distance=p.distance-q.distance;q.captured=p.captured-q.captured;q.burned=p.burned-q.burned;q.heat=p.heat-q.heat;}
  p.rows[0].proper=0;p.rows.at(-1).proper=p.proper;
  const end=p.rows.at(-1);end.a=0;end.opening=0;end.burnRate=0;
  p.initialMass=mass;p.finalBeta=body.beta;p.maxG=Math.max(...p.rows.map(q=>Math.abs(q.a)/9.80665));
  if(this.cache.size>180)this.cache.clear();this.cache.set(key,p);return p;
 },
 sample(p,proper){
  const t=Math.max(0,Math.min(p.proper,proper)),rows=p.rows;let lo=0,hi=rows.length-1;if(t===0)return{...rows[0]};if(t===p.proper)return{...rows.at(-1)};
  while(hi-lo>1){const m=(lo+hi)>>1;if(rows[m].proper<=t)lo=m;else hi=m;}
  const a=rows[lo],b=rows[hi],f=(t-a.proper)/(b.proper-a.proper),out={proper:t};for(const key of Object.keys(a))if(key!=='proper')out[key]=a[key]+(b[key]-a[key])*f;out.beta=Math.tanh(out.eta);return out;
 }
};


Object.assign(OrbitalArrival,{
 stopping(c,mass,beta,reserve,body,epoch,cosmic,expansion,d){
  const raw=this.plan(c,mass,beta,reserve,body);if(!raw)return{valid:false,comoving:Infinity};
  const scale=cosmic?Cosmology.scale(epoch):1,D=d*scale*LY;
  if(!(D>Math.abs(raw.impact)))return{valid:false,comoving:Infinity};
  const correction=raw.impact**2/(D+Math.sqrt(D*D-raw.impact**2)),axisBudget=raw.axis+correction,cs=Math.cos(raw.startTheta),sn=Math.sin(raw.startTheta),first=raw.rows[0],last=raw.rows.at(-1),axisPath=(last.x-first.x)*cs+(last.y-first.y)*sn;
  if(!(axisPath>0))return{valid:false,comoving:Infinity};
  let comoving=0,previous=first,previousProjection=0;
  const rows=raw.rows.map((q,i)=>{const projection=(q.x-first.x)*cs+(q.y-first.y)*sn;if(projection<previousProjection-1e-5)return null;
   const a=cosmic?Cosmology.scale(epoch+(expansion?(q.earth+previous.earth)/2:0)):1;
   if(i)comoving+=(projection-previousProjection)/LY/a*axisBudget/axisPath;
   previous=q;previousProjection=projection;return{...q,comoving};
  });
  if(rows.some(q=>!q))return{valid:false,comoving:Infinity};
  const plan={...raw,rows,axisBudget,axisPath};
  return{valid:true,kind:'orbit',plan,body,proper:raw.proper,earth:raw.earth,distance:raw.distance,comoving,finalMass:raw.finalMass,captured:raw.captured,burned:raw.burned,epoch};
 },
 frame(p,origin,target){
  const incoming=V3.unit(V3.sub(target.p3,origin.p3)),side=V3.unit(V3.cross(Math.abs(incoming[2])<.9?[0,0,1]:[0,1,0],incoming)),D=Space.distance(origin,target)*LY,alpha=Math.asin(Math.max(-1,Math.min(1,p.impact/D))),ca=Math.cos(alpha),sa=Math.sin(alpha);
  return{e:V3.add(V3.mul(incoming,ca),V3.mul(side,sa)),n:V3.add(V3.mul(incoming,-sa),V3.mul(side,ca)),theta:p.startTheta};
 },
 vector(frame,x,y){const cs=Math.cos(frame.theta),sn=Math.sin(frame.theta);return V3.add(V3.mul(frame.e,x*cs+y*sn),V3.mul(frame.n,-x*sn+y*cs));},
 position(p,q,frame,epoch){return V3.mul(this.vector(frame,q.x,q.y),1/(LY*(p.cosmic?Cosmology.scale(epoch):1)));},
 park(f){
  const p=f.mission,b=p?.brake;if(b?.kind!=='orbit')return false;
  const q=b.plan.rows.at(-1),offset=this.vector(p.orbitFrame,q.x,q.y),velocity=this.vector(p.orbitFrame,Math.cos(q.theta)*b.body.speed,Math.sin(q.theta)*b.body.speed),radial=V3.unit(offset),tangent=V3.unit(velocity);
  state.orbit={model:1,targetId:f.target,body:b.body,radial,tangent,angle:0,radius:b.body.radius,speed:b.body.speed,beta:b.body.beta};
  state.ship=Space.point(V3.add(object(f.target).p3,V3.mul(radial,state.orbit.radius/LY)));state.beta=state.orbit.beta;return true;
 },
 idle(proper){
  const orbit=state.orbit;if(!orbit||state.current!==orbit.targetId||!object(orbit.targetId))return false;
  const earth=proper/Math.sqrt(1-orbit.beta**2);state.proper+=proper;state.earth+=earth;Cosmology.elapse(state,earth);
  orbit.angle=(orbit.angle+earth*Rocket.year*orbit.speed/orbit.radius)%(2*Math.PI);
  const radial=V3.add(V3.mul(orbit.radial,Math.cos(orbit.angle)),V3.mul(orbit.tangent,Math.sin(orbit.angle)));
  state.ship=Space.point(V3.add(object(orbit.targetId).p3,V3.mul(radial,orbit.radius/LY)));state.beta=orbit.beta;state.acceleration=0;return true;
 }
});

const FlightSetup={
 normalize(c={}){return{...ShipPhysics.normalize(c),engine:!!c.engine,dump:!!c.dump,sail:!!c.sail,collector:!!c.collector,diffraction:c.diffraction!==false,burst:!!c.burst,burstSpectrum:['iip','ia','ibc'].includes(c.burstSpectrum)?c.burstSpectrum:'iip',brakeEngine:c.brakeEngine!==false,brakeSail:c.brakeSail!==false,collectGas:c.collectGas!==false,fill:c.arrivalFuelPercent!==null&&c.arrivalFuelPercent!==undefined?Number(c.arrivalFuelPercent)>0:!!c.fill,arrivalFuelPercent:c.arrivalFuelPercent!==null&&c.arrivalFuelPercent!==undefined&&Number.isFinite(+c.arrivalFuelPercent)?Math.max(0,Math.min(100,+c.arrivalFuelPercent)):null,reservePercent:Number.isFinite(+c.reservePercent)?Math.max(1,Math.min(99,+c.reservePercent)):99,densityCm3:Number.isFinite(+c.densityCm3)?Math.max(0,Math.min(1e6,+c.densityCm3)):1,capacityKg:Number.isFinite(+c.capacityKg)?Math.max(.01,Math.min(100,+c.capacityKg)):1,massSolar:c.massSolar!==null&&c.massSolar!==undefined&&Number.isFinite(+c.massSolar)&&+c.massSolar>=0?Math.min(1e6,+c.massSolar):null,luminositySolar:c.luminositySolar>0?Math.min(1e12,+c.luminositySolar):null};},
 defaults(s=state){return this.normalize({sail:true,collector:true,burst:false,engine:true,brakeEngine:true,brakeSail:true,collectGas:true,arrivalFuelPercent:50,capacityKg:s.tankCapacityKg||1});},
 legacy(s){const mode=s.flight?.departureMode||s.departureMode,p=s.flight?.mission,c=this.normalize(p?.setup||(!s.flight?s.flightSetup:null)||{engine:mode==='engine',sail:mode!=='engine',collector:mode!=='engine',burst:mode==='burst',brakeEngine:true,brakeSail:true,densityCm3:1,capacityKg:s.tankCapacityKg||1});if(p&&c.collector&&c.sail)c.diffraction=!!p.acceleration?.diffraction&&p.acceleration.diffraction.enabled!==false;if(p&&(p.model||1)<4){c.collectorDiameterM=p.acceleration?.diffraction?.diameterM||1000;c.maxAccelerationG=100;c.maxBrakingG=p.brake?.plan?.maxG||100;}return c;},
 preferred(s=state){
  if(!s.flightSetup)return this.defaults(s);
  const c=this.normalize(s.flightSetup);
  // Numeric values, including an explicit zero, are user choices. Old unset
  // reserves acquire the new default; old relative fill targets retain meaning.
  if(c.arrivalFuelPercent===null&&!c.fill){c.arrivalFuelPercent=50;c.fill=true;}
  return c;
 },
 available(source,used=new Set(state.destroyed)){return !!source&&['star','home'].includes(source.kind)&&!used.has(source.id);},
 resolve(input,source,used=new Set(state.destroyed)){
  const c=this.normalize(input);if(!OrbitalArrival.enabled)return c;
  if(!this.available(source,used))return{...c,engine:true,dump:false,sail:false,collector:false,burst:false};
  return{...c,collector:c.sail&&c.collector,burst:c.sail&&c.burst&&source.id!=='sol'};
 },
 read(s=state){
  if(s.flight||!OrbitalArrival.enabled)return this.legacy(s);
  return this.resolve(this.preferred(s),object(s.current),new Set(s.destroyed));
 },
 sync(s=state){if(!s.flight&&OrbitalArrival.enabled){const c=this.read(s);s.departureMode=c.sail?(c.burst?'burst':'beam'):'engine';}},
 storeDraft(draft,preferred,source,changes=new Set()){
  const c=this.normalize(draft);if(!OrbitalArrival.enabled)return c;
  if(!this.available(source))for(const key of ['engine','dump','sail','collector','burst'])c[key]=preferred[key];
  if(!changes.has('arrivalFuelPercent'))for(const key of ['arrivalFuelPercent','fill','reservePercent'])c[key]=preferred[key];
  return c;
 },
 acceleration(c){return[c.engine&&!c.dump?'тяга':null,c.sail?'парус':null,c.sail&&c.collector?'коллектор':null,c.sail&&c.burst?'сверхновая':null].filter(Boolean).join(' + ')||'нет разгона';},
 braking(c){return[c.brakeEngine?'тяга':null,c.brakeSail?'парус':null].filter(Boolean).join(' + ')||'без торможения';}
};

const MissionPlanner={
 cache:new Map(),accelerationCache:new Map(),fuelLimitCache:new Map(),
 get dry(){return SHIP.dryMassKg;},get capG(){return ShipPhysics.value('maxAccelerationG');},model:4,
 enabledIdle(){return OrbitalArrival.enabled||!!state.flightSetup||!!state.orbit;},
 invalid(reason,extra={}){return{valid:false,reason,proper:Infinity,earth:Infinity,...extra};},
 // Independent variable is rapidity. Integrate both clocks, distance, retarded
 // source time, fuel mass and comoving distance together with adaptive RK4.
 acceleration(setup,source,fuelKg,d,epoch,cosmic,expansion,startBeta=0,departureOrbit=null){
  const startMass=this.dry+fuelKg,light=Stellar.stellarLight(source),available=!!source&&['star','home'].includes(source.kind)&&!state.destroyed.includes(source.id),L=setup.burst?Stellar.luminosity:(setup.luminositySolar?setup.luminositySolar*3.828e26:light.watts),collectorR=light.collectorR,r0=departureOrbit?.radius||collectorR,sourceMass=setup.massSolar??MapDetails.mass(source)??0;
  const optics=setup.sail&&available,beam=optics&&setup.collector,power=beam?L*cOptical(setup)*Math.min(1,Stellar.collectorDiameterM**2/(16*collectorR*collectorR)):0,pulse=setup.burst?Stellar.pulseYears:Infinity,spectrum=BeamOptics.spectrum(setup,light);
  const key=JSON.stringify([setup.engine,setup.sail,setup.collector,setup.burst,L,r0,sourceMass,available,fuelKg,d,cosmic,expansion,cosmic?epoch:0,startBeta,departureOrbit?.radius,collectorR,BeamOptics.model,spectrum,setup]);
  if(this.accelerationCache.has(key))return this.accelerationCache.get(key);
  let lightEndReason=null,motor=setup.engine&&fuelKg>0,photons=optics,lightEndProper=null,lightEndSource=null,eta=Math.atanh(startBeta),h=.02,y=[0,0,0,0,startMass,0],rows=[];
  const rate=(e,v)=>{
   const mass=Math.max(this.dry*.9,v[4]),x=Math.max(0,v[2])*LY,r=departureOrbit?Math.hypot(r0,x):r0+x,P=beam?power*BeamOptics.fraction(x,v[3],spectrum,Stellar.collectorDiameterM,SHIP.sailDiameterM/2,setup.divergenceDeg,setup.diffraction):L*SHIP.sailAreaM2/(4*Math.PI*r*r),full=photons?ShipPhysics.reflection*P/Rocket.c*Math.exp(-2*e):0,limit=mass*this.capG*9.80665;
   const lightForce=Math.min(limit,full),engineForce=motor?Math.min(Rocket.power*ShipPhysics.efficiency/Rocket.c,Math.max(0,limit-lightForce)):0,total=lightForce+engineForce,gravity=available&&!setup.burst?6.67430e-11*1.98847e30*sourceMass/(r*r)*(departureOrbit?x/r:1):0,net=total-mass*gravity;
   if(!(net>0))return null;
   const tau=mass*Rocket.c/(net*Rocket.year),dx=Math.sinh(e)*tau,scale=cosmic?Cosmology.scale(epoch+(expansion?v[1]:0)):1;
   return{dy:[tau,Math.cosh(e)*tau,dx,Math.exp(-e)*tau,-mass*engineForce/(ShipPhysics.efficiency*net),dx/scale],a:total/mass,netAcceleration:net/mass,engineForce,lightForce};
  };
  const rk=(e,v,step)=>{
   const a=rate(e,v)?.dy;if(!a)return null;
   const add=(k,s)=>v.map((n,i)=>n+k[i]*s),b=rate(e+step/2,add(a,step/2))?.dy,c=b&&rate(e+step/2,add(b,step/2))?.dy,z=c&&rate(e+step,add(c,step))?.dy;
   return z?v.map((n,i)=>n+step*(a[i]+2*b[i]+2*c[i]+z[i])/6):null;
  };
  const twice=(e,v,step)=>{const half=rk(e,v,step/2);return half&&rk(e+step/2,half,step/2);};
  const row=()=>{const r=rate(eta,y),g=Math.cosh(eta),v=Math.sinh(eta),speed=Math.min(1-Number.EPSILON,Math.tanh(eta));return{proper:y[0],earth:y[1],distance:y[2],source:y[3],mass:y[4],comoving:y[5],eta,beta:speed,burned:startMass-y[4],a:r?.a||0,slopes:[g,v,Math.exp(-eta),-(r?.engineForce||0)/Rocket.c*Rocket.year,(r?.netAcceleration||0)*Rocket.year/Rocket.c,v/(cosmic?Cosmology.scale(epoch+(expansion?y[1]:0)):1)]};};
  rows.push(row());
  for(let n=0;n<12000&&(motor||photons)&&eta<18.3;n++){
   h=Math.min(h,18.3-eta);let full=rk(eta,y,h),next=twice(eta,y,h);if(!next||!full){h*=.1;if(h<1e-18)break;continue;}
   const fuelEvent=motor&&next[4]<this.dry,pulseEvent=photons&&Number.isFinite(pulse)&&next[3]>pulse;
   if(fuelEvent||pulseEvent){let lo=0,hi=h;for(let j=0;j<42;j++){const mid=(lo+hi)/2,q=twice(eta,y,mid);if(q&&(q[4]<this.dry&&motor||q[3]>pulse&&photons))hi=mid;else lo=mid;}h=(lo+hi)/2;next=twice(eta,y,h);full=rk(eta,y,h);}
   if(!next||!full||!next.every(Number.isFinite)){h*=.1;if(h<1e-18)break;continue;}
   let error=0;for(let i=0;i<6;i++){const floor=i===4?.1:i===2||i===5?r0/LY*1e-3:1e-12;error=Math.max(error,Math.abs(next[i]-full[i])/(Math.max(floor,Math.abs(next[i]))*2e-8));}
   if(error>1&&h>1e-17){h*=Math.max(.1,.85*error**(-.2));continue;}
   if(eta+h===eta)break;eta+=h;y=next;
   if(motor&&y[4]-this.dry<1e-11){y[4]=this.dry;motor=false;}
   if(photons&&Number.isFinite(pulse)&&pulse-y[3]<1e-12){y[3]=pulse;lightEndProper=y[0];lightEndSource=pulse;lightEndReason='pulse';photons=false;}
   // Fold continuous illumination only after a rigorous upper bound on its
   // remaining work is <0.01% of the current kinetic energy. A finite flash
   // instead runs to the last arriving photons (retarded source time).
   if(beam&&photons&&!Number.isFinite(pulse)&&BeamOptics.remainingWork(power,y[2]*LY,spectrum,Stellar.collectorDiameterM,SHIP.sailDiameterM/2,setup.divergenceDeg,setup.diffraction)<BeamOptics.workTolerance*y[4]*Rocket.c**2*2*Math.sinh(eta/2)**2){lightEndProper=y[0];lightEndSource=y[3];lightEndReason='negligible';photons=false;}
   rows.push(row());
   if(y[5]>=d*1.002||y[0]>2e12||!beam&&photons&&r0+y[2]*LY>=r0*1e5){if(!motor)break;if(photons){lightEndProper=y[0];lightEndSource=y[3];}photons=false;}
   h=Math.min(.03,h*Math.min(2,Math.max(.5,error>0?.85*error**(-.2):2)));
  }
  const result={rows,proper:rows.at(-1).proper,lightEndProper:optics?(lightEndProper??rows.at(-1).proper):0,lightEndSource:optics?(lightEndSource??rows.at(-1).source):0,initialMass:startMass,luminosityW:L,luminosityEstimated:!setup.luminositySolar&&light.estimated,beamPower:power,diffraction:beam?{model:BeamOptics.model,enabled:setup.diffraction!==false,spectrum,diameterM:Stellar.collectorDiameterM,sailRadiusM:SHIP.sailDiameterM/2,workTolerance:BeamOptics.workTolerance,divergenceDeg:setup.divergenceDeg}:null,lightEndReason,collectorR,hasLight:optics,source:source?.id,gravityBlocked:rows.length===1&&sourceMass>0&&available&&!setup.burst&&(setup.engine&&fuelKg>0||optics)};
  if(this.accelerationCache.size>10)this.accelerationCache.clear();this.accelerationCache.set(key,result);return result;
 },
 sampleAcceleration(a,proper){
  const rows=a.rows,t=Math.max(0,Math.min(a.proper,proper));let lo=0,hi=rows.length-1;
  if(t===0)return{...rows[0]};if(t===a.proper)return{...rows.at(-1)};
  while(hi-lo>1){const m=(lo+hi)>>1;if(rows[m].proper<=t)lo=m;else hi=m;}
  const u=rows[lo],v=rows[hi],dt=v.proper-u.proper,f=dt>0?(t-u.proper)/dt:0,h00=(2*f-3)*f*f+1,h10=((f-2)*f+1)*f,h01=(-2*f+3)*f*f,h11=(f-1)*f*f;
  const mix=(key,i)=>Math.max(Math.min(u[key],v[key]),Math.min(Math.max(u[key],v[key]),h00*u[key]+h10*dt*u.slopes[i]+h01*v[key]+h11*dt*v.slopes[i]));
  const eta=mix('eta',4),mass=mix('mass',3);
  return{proper:t,earth:mix('earth',0),distance:mix('distance',1),source:mix('source',2),mass,comoving:mix('comoving',5),eta,beta:Math.min(1-Number.EPSILON,Math.tanh(eta)),burned:a.initialMass-mass,a:u.a+(v.a-u.a)*f};
 },
 lightReception(p){
  if(!p?.acceleration?.hasLight||!p.accelerationEnd)return null;
  const a=p.acceleration,limit=p.setup.burst?(p.setup.burstDays??30)/365.25:Infinity;let proper=Math.min(p.accelerationEnd.proper,a.lightEndProper??a.proper);
  // Older saved plans have no light-end metadata. Stop at their finite source
  // pulse even when an engine continued accelerating after the light ended.
  if(this.sampleAcceleration(a,proper).source>limit){let lo=0,hi=proper;for(let n=0;n<48;n++){const mid=(lo+hi)/2;if(this.sampleAcceleration(a,mid).source<limit)lo=mid;else hi=mid;}proper=(lo+hi)/2;}
  const q=this.sampleAcceleration(a,proper);return{proper,source:Math.min(limit,a.lightEndSource??Infinity,q.source),stretch:Math.exp(q.eta)};
 },
 engineAt(e,proper){
  const t=Math.min(e.burnProper,Math.max(0,proper)),mass=t===e.burnProper?e.mf:Math.max(e.mf,Rocket.massAfter(e.m0,t,e.maxG)),q=Rocket.retroSegment(e.m0,e.eta0,e.m0,mass,e.maxG);
  return{...q,proper:t,mass:mass*1000,burned:(e.m0-mass)*1000,captured:0,heat:(e.m0-mass)*1000*(1-ShipPhysics.efficiency)*Rocket.c**2,a:t===e.burnProper?0:-Rocket.acceleration(mass,e.maxG)};
 },
 enginePath(e,proper,epoch,cosmic,expansion){
  if(!cosmic)return this.engineAt(e,proper).distance;if(!expansion)return this.engineAt(e,proper).distance/Cosmology.scale(epoch);
  if(e.m0*1000>Rocket.power*ShipPhysics.efficiency/(Rocket.c*e.maxG*9.80665))return HybridBrake.integral(t=>{const q=this.engineAt(e,t);return Math.sinh(Math.atanh(q.beta))/Cosmology.scale(epoch+q.earth);},0,proper);
  const q=this.engineAt(e,proper),eta=Math.atanh(q.beta),scale=Rocket.c/(e.maxG*9.80665*Rocket.year);
  return HybridBrake.integral(x=>Math.sinh(x)*scale/Cosmology.scale(epoch+scale*(Math.sinh(e.eta0)-Math.sinh(x))),eta,e.eta0);
 },
 stopping(c,mass,beta,reserveKg,epoch,cosmic,expansion,body=null,d=Infinity){
  if(body)return OrbitalArrival.stopping(c,mass,beta,reserveKg,body,epoch,cosmic,expansion,d);
  const fuel=Math.max(0,mass-this.dry),capacity=this.dry+c.capacityKg,k=Magnetic.rho(c.densityCm3*1e6)*SHIP.sailAreaM2;
  if(c.brakeSail&&k>0&&c.brakeEngine){
   const p=c.collectGas===false?ReleasingBrake.plan(mass,beta,k,this.dry+reserveKg):HybridBrake.plan(mass,beta,k,capacity,c.maxBrakingG,reserveKg/c.capacityKg);
   if(!p)return{valid:false,comoving:Infinity};
   const comoving=cosmic?FlightPath.distance(p,Magnetic,p.proper,epoch,expansion):p.distance;
   return{valid:Number.isFinite(p.proper)&&(p.noCapture?p.massKg:HybridBrake.peakMass(p))<=capacity+1e-10&&(c.arrivalFuelPercent===null||p.finalMass>=this.dry+reserveKg-1e-10),kind:'hybrid',plan:p,proper:p.proper,earth:p.earth,distance:p.distance,comoving,finalMass:p.finalMass,captured:p.captured,burned:p.burned,epoch};
  }
  if(c.brakeEngine){const e=Rocket.retroPlan(fuel/1000,beta,c.maxBrakingG),valid=e.canStop&&(beta===0||fuel>0)&&e.mf*1000>=this.dry+reserveKg-1e-11;return{valid,kind:'engine',plan:e,proper:e.burnProper,earth:e.burnEarth,distance:e.burnDistance,comoving:valid?this.enginePath(e,e.burnProper,epoch,cosmic,expansion):Infinity,finalMass:e.mf*1000,captured:0,burned:e.budget*1000,epoch};}
  return{valid:false,comoving:Infinity};
 },
 plan(input,source,target,fuelKg=state.matter*1000,origin=state.ship,epoch=state.cosmicTime||0,expansion=state.expansion!==false,startBeta=0,startOrbit=null,coastOnly=false){
  const departure=startOrbit||(!startBeta&&source?.id===state.orbit?.targetId?state.orbit:null);
  if(departure)startBeta=departure.beta;
  const c=coastOnly?FlightSetup.normalize({...input,engine:false,sail:false,collector:false,burst:false,dump:false}):FlightSetup.resolve(input,source),d=target?.p3&&origin?.p3?Space.distance(origin,target):0,cosmic=target?.rangeProbe===true||Cosmology.isCosmic(source||origin,target),prepared=c.dump?0:Math.min(fuelKg,c.capacityKg);
  const arrival=OrbitalArrival.target(target),shared={setup:c,distance:d,cosmic,epoch,expansion,sourceId:source?.id,targetId:target?.id,initialFuelKg:prepared,jettisonKg:Math.max(0,fuelKg-prepared),arrival,departureOrbit:departure?{radius:departure.radius,beta:departure.beta}:null};
  if(c.arrivalFuelPercent!==null&&c.arrivalFuelPercent>99)return this.invalid('С таким наполнением топливного бака точная остановка в этой модели недостижима.',shared);
  if(!target?.navigable||!(d>1e-14))return this.invalid('Выберите другую цель с известным расстоянием.',shared);
  if(input.burst&&source?.id==='sol')return this.invalid('Вспышка Солнца запрещена.',shared);
  if(c.burst&&(!source||!['star','home'].includes(source.kind)||state.destroyed.includes(source.id)))return this.invalid('Для вспышки нужна доступная звезда в точке старта.',shared);
  if(cosmic&&expansion&&Cosmology.beyondHorizon(d,epoch))return this.invalid('Цель за пределом достижимого горизонта.',{...shared,unreachable:true});
  const a=this.acceleration(c,source,prepared,d,epoch,cosmic,expansion,startBeta,departure),last=a.rows.at(-1);
  if(departure&&!c.burst){const mu=OrbitalArrival.G*OrbitalArrival.solarMass*(c.massSolar??MapDetails.mass(source)??0),radius=Math.hypot(departure.radius,last.distance*LY),energy=Rocket.c**2*(Math.cosh(last.eta)-1)-mu/radius;if(!(energy>0))return this.invalid('Разгона недостаточно, чтобы покинуть орбиту. Добавьте тягу с топливом или световой разгон.',shared);}
  if(!(last.beta>1e-15)||!(a.proper>0)&&!(startBeta>0))return this.invalid(a.gravityBlocked?'Тяги недостаточно для выхода из поля звезды. Добавьте коллектор или двигатель.':'Нет разгона: включите тягу с топливом или парус у звезды.',shared);
  if(cosmic&&expansion&&d>last.comoving+Cosmology.reach(last.beta,epoch+last.earth))return this.invalid('Доступного разгона недостаточно: расширение уносит цель за предел полёта.',{...shared,unreachable:true,rangeBlocked:true});
  if(!c.brakeEngine&&!arrival){
   let diagnostic=null;if(c.brakeSail&&c.densityCm3>0&&last.beta>1/Rocket.c){const k=Magnetic.rho(c.densityCm3*1e6)*SHIP.sailAreaM2,p=Magnetic.plan(last.mass,last.beta,k,this.dry+c.capacityKg),tail=Magnetic.fixedIntegrals(p.finalMass,p.finalBeta,1/Rocket.c,k);diagnostic=p.proper+tail.proper;}
   return this.invalid(c.brakeSail?'Газовый парус не достигает точного нуля скорости за конечное время. Включите тягу для остановки.':'Торможение выключено: остановка у цели невозможна.',{...shared,diagnostic,peakBeta:last.beta});
  }
  const k=c.brakeSail?Magnetic.rho(c.densityCm3*1e6)*SHIP.sailAreaM2:0,physicalBudget=d*(cosmic?Cosmology.scale(epoch):1)*LY,reserveKg=c.fill?(c.arrivalFuelPercent!==null?c.capacityKg*Math.min(99,c.arrivalFuelPercent)/100:c.reservePercent/100*Math.min(c.capacityKg,prepared+(c.collectGas?k*physicalBudget:0))):0;
  const stopAt=(q,beta=q.beta,time=epoch+(expansion?q.earth:0))=>this.stopping(c,q.mass,beta,reserveKg,time,cosmic,expansion,arrival,d);
  const fits=q=>{const s=stopAt(q);return s.valid&&q.comoving+s.comoving<=d;};
  let end=last;
  if(!fits(end)){
   let lo=0,hi=a.proper;
   // Locate the small orbital correction with the analytic vacuum plan first.
   // Every accepted endpoint and the final coast are still checked against the
   // full vector capture; this seed avoids dozens of expensive shooting solves.
   const seedFits=q=>{const s=arrival&&c.brakeEngine?this.stopping(c,q.mass,q.beta,reserveKg,epoch+(expansion?q.earth:0),cosmic,expansion):stopAt(q);return s.valid&&q.comoving+s.comoving<=d;};
   for(let n=0;n<52;n++){const mid=(lo+hi)/2;if(seedFits(this.sampleAcceleration(a,mid)))lo=mid;else hi=mid;}
   if(arrival&&c.brakeEngine){
    const gap=t=>{const q=this.sampleAcceleration(a,t),s=stopAt(q);return s.valid?q.comoving+s.comoving-d:Infinity;};
    let fLo=gap(lo),step=Math.max(a.proper*1e-4,1e-10);
    if(fLo<=0){hi=Math.min(a.proper,lo+step);while(hi<a.proper&&gap(hi)<=0){lo=hi;fLo=gap(lo);step*=2;hi=Math.min(a.proper,hi+step);}}
    else{hi=lo;lo*=.99;for(let n=0;n<30&&gap(lo)>0;n++)lo*=.8;fLo=gap(lo);}
    if(fLo<=0){let fHi=gap(hi);for(let n=0;n<14;n++){const ratio=Number.isFinite(fHi)?Math.max(.05,Math.min(.95,-fLo/(fHi-fLo))):.5,mid=lo+(hi-lo)*ratio,f=gap(mid);if(f<=0){lo=mid;fLo=f;}else{hi=mid;fHi=f;}if(hi-lo<Math.max(1e-15,a.proper*1e-11))break;}}
   }
   end=this.sampleAcceleration(a,lo);
  }
  if(!(end.beta>1e-15))return this.invalid('Не хватает вещества для остановки с выбранным запасом. Добавьте торможение парусом или уменьшите запас.',shared);
  let coast={proper:0,earth:0,distance:0,path:0,beta:end.beta},stop=stopAt(end),coastEpoch=epoch+(expansion?end.earth:0);
  if(!stop.valid)return this.invalid(arrival?'Не найден выход на круговую орбиту с выбранной тягой и запасом. Добавьте тягу двигателя или уменьшите запас топлива.':c.collectGas?'Не хватает вещества для точной остановки.':'Не хватает топлива для остановки. Включите сбор газа или сохраните топливо на разгоне.',shared);
  if(end.comoving+stop.comoving>d+Math.max(1e-13,d*64*Number.EPSILON))return this.invalid('Оставшегося расстояния недостаточно для остановки с текущей скорости.',shared);
  const left=Math.max(0,d-end.comoving-stop.comoving);
  if(left>Math.max(1e-14,d*1e-13)){
   if(cosmic){
    const gap=t=>{const q=Cosmology.coast(end.beta,t,coastEpoch,expansion),s=stopAt(end,q.beta,coastEpoch+(expansion?q.earth:0));return{q,s,gap:d-end.comoving-q.distance-s.comoving};};
    let lo=0,hi=Math.max(1,left*Math.sqrt((1-end.beta)*(1+end.beta))/end.beta),test=gap(hi);
    for(let n=0;n<44&&test.gap>0&&hi<2e12;n++){hi*=2;test=gap(hi);}
    if(test.gap>0)return this.invalid('При выбранном разгоне расширение не позволяет достичь цели.',{...shared,unreachable:true});
    for(let n=0;n<58;n++){const mid=(lo+hi)/2;if(gap(mid).gap>0)lo=mid;else hi=mid;}const result=gap((lo+hi)/2);coast=result.q;stop=result.s;
   }else{const earth=left/end.beta;coast={proper:earth*Math.sqrt((1-end.beta)*(1+end.beta)),earth,distance:left,path:left,beta:end.beta};}
  }
  const covered=end.comoving+(cosmic?coast.distance:coast.path)+stop.comoving;
  if(!stop.valid||Math.abs(covered-d)>Math.max(1e-11,d*2e-9))return this.invalid('При выбранном разгоне не найден достижимый путь с остановкой у цели.',{...shared,unreachable:cosmic&&expansion});
  const vacuum=arrival&&c.brakeEngine?this.stopping(c,end.mass,coast.beta,reserveKg,stop.epoch,cosmic,expansion):null;
  const totalDistance=end.distance+(cosmic?coast.path:coast.distance)+stop.distance,proper=end.proper+coast.proper+stop.proper,earth=end.earth+coast.earth+stop.earth;
  return{...shared,valid:true,reason:'',model:this.model,acceleration:a,accelerationEnd:end,coast,coastEpoch,brake:stop,reserveKg,proper,earth,totalDistance,peakBeta:end.beta,arrivalFuelKg:Math.max(0,stop.finalMass-this.dry),capturedKg:stop.captured,burnedKg:end.burned+stop.burned,sourceLuminosityW:a.luminosityW,orbitFrame:arrival?OrbitalArrival.frame(stop.plan,origin,target):null,vacuumComparison:vacuum?.valid?{proper:vacuum.proper,burnedKg:vacuum.burned,arrivalFuelKg:vacuum.finalMass-this.dry}:null};
 },
 planPreferred(input,source,target,fuel,origin,epoch,expansion,startBeta=0,orbit=null){
  const c=FlightSetup.resolve(input,source),args=[source,target,fuel,origin,epoch,expansion,startBeta,orbit],requested=c.arrivalFuelPercent,p=this.plan(c,...args);
  if(p.valid||!(requested>0)||p.rangeBlocked||p.cosmic&&expansion&&Cosmology.beyondHorizon(p.distance,epoch))return p;
  let fast=this.plan({...c,arrivalFuelPercent:0,fill:false},...args),lo=0;
  // The orbital solver supports a monotone capture branch. A zero-reserve
  // trajectory can fall outside it even when another positive reserve works.
  if(!fast.valid)for(let n=1;n<=6;n++){const percent=requested/2**n,q=this.plan({...c,arrivalFuelPercent:percent,fill:true},...args);if(q.valid){fast=q;lo=percent;break;}}
  if(!fast.valid)return p;
  let hi=requested,best=fast;
  for(let n=0;n<14;n++){const mid=(lo+hi)/2,q=this.plan({...c,arrivalFuelPercent:mid,fill:true},...args);if(q.valid){lo=mid;best=q;}else hi=mid;}
  const percent=Math.floor(lo*100)/100,q=this.plan({...c,arrivalFuelPercent:percent,fill:percent>0},...args);
  return{...(q.valid?q:best),requestedArrivalFuelPercent:requested,reserveLimited:true};
 },
 preview(input=null){
  const automatic=input===null,c=automatic?FlightSetup.read():FlightSetup.resolve(input,object(state.current));
  const source=object(state.current),target=object(state.selected),cosmic=Cosmology.isCosmic(source||state.ship,target),epoch=cosmic?Math.floor((state.cosmicTime||0)/1000)*1000:0;
  const key=JSON.stringify([automatic,c,source?.id,target?.id,state.orbit?source?.p3:state.ship.p3,state.matter,epoch,state.expansion,state.destroyed,OrbitalArrival.enabled]);
  if(!this.cache.has(key)){if(this.cache.size>64)this.cache.clear();this.cache.set(key,(automatic&&OrbitalArrival.enabled?this.planPreferred(c,source,target,state.matter*1000,state.ship,epoch,state.expansion!==false):this.plan(c,source,target,state.matter*1000,state.ship,epoch,state.expansion!==false)));}return this.cache.get(key);
 },
 fuelLimit(input){
  // The slider specifies a fraction of the actual tank, rather than a fraction
  // of a route's gas budget. Search only plans which really attain that mass.
  const c=FlightSetup.normalize({...input,arrivalFuelPercent:0,fill:false,reservePercent:99});
  const source=object(state.current),target=object(state.selected),cosmic=Cosmology.isCosmic(source||state.ship,target),epoch=cosmic?Math.floor((state.cosmicTime||0)/1000)*1000:0;
  const key=JSON.stringify([c,source?.id,target?.id,state.orbit?source?.p3:state.ship.p3,state.matter,epoch,state.expansion,state.destroyed,OrbitalArrival.enabled]);
  if(this.fuelLimitCache.has(key))return this.fuelLimitCache.get(key);
  let fast=this.preview(c),minimum=0,maximum=0;
  if(!fast.valid&&!fast.rangeBlocked&&OrbitalArrival.enabled)for(const percent of [50,25,75,10,90,1]){const q=this.preview({...c,arrivalFuelPercent:percent});if(q.valid){fast=q;minimum=percent;break;}}
  if(fast.valid){
   const collects=c.brakeSail&&c.collectGas&&c.densityCm3>0;
   const gasBudget=collects?(cosmic?Infinity:Magnetic.rho(c.densityCm3*1e6)*SHIP.sailAreaM2*fast.distance*LY):0;
   const upper=Math.min(99,(fast.initialFuelKg+gasBudget)/c.capacityKg*100);
   const feasible=percent=>{const p=this.preview({...c,arrivalFuelPercent:percent});return p.valid&&p.arrivalFuelKg>=c.capacityKg*percent/100-1e-10;};
   if(upper>0&&feasible(upper))maximum=upper;
   else if(upper>0){let lo=minimum,hi=upper;for(let n=0;n<16;n++){const mid=(lo+hi)/2;if(feasible(mid))lo=mid;else hi=mid;}maximum=lo;}
  }
  const result={valid:fast.valid,maxPercent:Math.floor(Math.max(0,maximum)*100+1e-8)/100};
  if(this.fuelLimitCache.size>16)this.fuelLimitCache.clear();this.fuelLimitCache.set(key,result);return result;
 },
 estimate(){
  const f=state.flight,p=f?.mission||this.preview();if(!p.valid)return{proper:Infinity,earth:Infinity,unreachable:!!p.unreachable,invalid:true,reason:p.reason,arrivalFuelKg:null};
  let proper=p.proper,earth=p.earth;
  if(f){
   if(p.passage){const elapsed=f.missionElapsed||{proper:0,earth:0};proper=Math.max(0,proper-elapsed.proper);earth=Math.max(0,earth-elapsed.earth);}
   else{
    // Subtract within the current stage: a minute of final thrust can be below
    // one ULP of the hundred-billion-year total, but still consumes real fuel.
    const index=f.missionStage||0,stages=this.stages(p),sample=f.missionSample||this.stageSample(p,index,f.stageElapsed||0),times=[p.accelerationEnd.earth,p.coast.earth,p.brake.earth];
    proper=Math.max(0,stages[index].proper-(f.stageElapsed||0));earth=Math.max(0,times[index]-sample.earth);
    for(let i=index+1;i<3;i++){proper+=stages[i].proper;earth+=times[i];}
   }
  }
  return{proper,earth,arrivalFuelKg:p.arrivalFuelKg,peakBeta:p.peakBeta,terminalBeta:p.coast.beta,acceleration:{distance:p.accelerationEnd.distance,proper:p.accelerationEnd.proper},braking:{distance:p.brake.distance,proper:p.brake.proper}};
 },
 profile(){const p=state.flight?.mission||this.preview();if(!p.valid)return null;return{acceleration:{distance:p.accelerationEnd.distance,proper:p.accelerationEnd.proper,maxG:Math.max(...p.acceleration.rows.filter(q=>q.proper<=p.accelerationEnd.proper).map(q=>q.a/9.80665),p.accelerationEnd.a/9.80665)},braking:p.passage?null:{distance:p.brake.distance,proper:p.brake.proper,maxG:p.setup.maxBrakingG},flyby:!!p.passage};},
 stages(p){return[{phase:p.setup.sail&&p.acceleration.hasLight?'launch':'thrust',proper:p.accelerationEnd.proper},{phase:'cruise',proper:p.coast.proper},{phase:'brake',proper:p.brake.proper}];},
 stageSample(p,index,proper){
  if(index===0){const q=this.sampleAcceleration(p.acceleration,Math.min(proper,p.accelerationEnd.proper));return{...q,captured:0,heat:q.burned*(1-ShipPhysics.efficiency)*Rocket.c**2};}
  if(index===1){const q=p.cosmic?Cosmology.coast(p.accelerationEnd.beta,proper,p.coastEpoch,p.expansion):{proper,earth:proper*Math.cosh(p.accelerationEnd.eta),distance:proper*Math.sinh(p.accelerationEnd.eta),path:proper*Math.sinh(p.accelerationEnd.eta),beta:p.accelerationEnd.beta};return{...q,comoving:q.distance,distance:q.path,mass:p.accelerationEnd.mass,captured:0,burned:0,heat:0,a:0};}
  const b=p.brake;if(b.kind==='orbit')return OrbitalArrival.sample(b.plan,proper);
  const q=b.kind==='hybrid'?HybridBrake.sampleProper(b.plan,proper):this.engineAt(b.plan,proper),comoving=b.kind==='hybrid'?(p.cosmic?FlightPath.distance(b.plan,Magnetic,proper,b.epoch,p.expansion):q.distance):this.enginePath(b.plan,proper,b.epoch,p.cosmic,p.expansion);
  return{...q,comoving,a:q.properAcceleration??q.a??0};
 },
 activateStage(f,index){const stages=this.stages(f.mission);f.missionStage=index;f.stageElapsed=0;f.missionSample=null;state.phase=stages[index].phase;f.replayRate=index===1?1:stages[index].proper/(index===0?5:3);},
 launch(planned=null,routeInfo=null){
  if(state.flight)return;const p=planned||this.preview();if(!p.valid){toast(p.reason);return;}
  // Rebuild with the exact launch epoch; the cached preview may use an idle bucket.
  const plan=planned||this.plan(p.setup,object(state.current),object(state.selected),state.matter*1000,state.ship,state.cosmicTime||0,state.expansion!==false);if(!plan.valid){toast(plan.reason);return;}
  if(state.transferSetup&&state.transferSetup.starId!==plan.targetId)state.transferSetup=null;
  const rollback=FlightHistory.pending||FlightHistory.snapshot();FlightHistory.pending=null;
  const source=object(plan.sourceId),target=object(plan.targetId),from={...state.ship,p3:[...state.ship.p3]};
  state.tankCapacityKg=plan.setup.capacityKg;state.matter=plan.initialFuelKg/1000;state.jettisoned=(state.jettisoned||0)+plan.jettisonKg/1000;
  state.flight={rollback,summary:{distance:plan.distance,proper:plan.proper,earth:plan.earth},mission:plan,missionElapsed:{proper:0,earth:0},cosmic:plan.cosmic,from,fromId:plan.sourceId,target:target.id,distance:plan.distance,covered:0,maxBeta:plan.peakBeta,medium:{n:plan.setup.densityCm3*1e6,area:SHIP.sailAreaM2,model:GasMedium.model,label:'Газ на торможении · '+plan.setup.densityCm3+' атом/см³'},boost:plan.acceleration.hasLight,departureMode:plan.setup.burst?'burst':plan.setup.sail?'beam':'engine',engine:null,wind:null,magnetic:null,autoStopping:true,missed:false};
  if(plan.passage){state.flight.aim=plan.aim;state.flight.encounter=plan.encounter;}if(routeInfo){state.flight.route=routeInfo.nodes;state.flight.legIndex=routeInfo.index;}
  if(plan.setup.burst){state.destroyed.push(source.id);effects.push({x:from.x,y:from.y,p3:from.p3,age:0});}
  if(plan.jettisonKg>0)log('Перед стартом сброшено '+fmt(plan.jettisonKg,3)+' кг вещества; бак сохранён.');
  log('Составной полёт: '+FlightSetup.acceleration(plan.setup)+'; торможение: '+FlightSetup.braking(plan.setup)+'. '+(plan.setup.fill?'С сохранением вещества.':'Быстрое прибытие.'));
  state.current=null;state.orbit=null;state.beta=plan.acceleration.rows[0].beta;paused=false;this.activateStage(state.flight,0);Simulation.smoothedFactor=Math.min(1,state.flight.replayRate);state.acceleration=plan.acceleration.rows[0].a;FlightMarks.plan();renderUI();fitRoute(target);persist();
 },
 step(dt){
  const f=state.flight,p=f.mission,index=f.missionStage||0,stages=this.stages(p),stage=stages[index],oldTime=f.stageElapsed||0,left=Math.max(0,stage.proper-oldTime),used=dt>=left-Math.max(1e-14,p.proper*16*Number.EPSILON)?left:Math.min(dt,left);
  if(!(used>0)){if(index===1&&p.passage){Route.enter();return 0;}if(index<2){this.activateStage(f,index+1);return 0;}finishFlight(Math.abs(f.covered-f.distance)<=Math.max(Simulation.tolerance(f)*4,f.distance*2e-11));return 0;}
  const old=f.missionSample||this.stageSample(p,index,oldTime),now=this.stageSample(p,index,oldTime+used),dEarth=now.earth-old.earth;
  state.matter=Math.max(0,Math.min(p.setup.capacityKg,now.mass-this.dry))/1000;state.beta=now.beta;state.acceleration=now.a||0;state.captured+=Math.max(0,now.captured-old.captured)/1000;state.spentEnergy+=Math.max(0,now.burned-old.burned)*Rocket.c**2;state.heatRadiated+=Math.max(0,now.heat-old.heat);
  advance(now.comoving-old.comoving,dEarth,used,true,now.distance-old.distance);
  if(p.orbitFrame){const target=object(f.target);if(index===2)state.ship=Space.point(V3.add(target.p3,OrbitalArrival.position(p,now,p.orbitFrame,state.cosmicTime||0)));else state.ship=Space.point(V3.add(f.from.p3,V3.mul(p.orbitFrame.e,f.covered)));}
  f.stageElapsed=oldTime+used;f.missionSample=now;f.missionElapsed.proper+=used;f.missionElapsed.earth+=dEarth;
  if(f.stageElapsed>=stage.proper){if(index===0)FlightMarks.actual('acceleration');if(index===1)FlightMarks.actual('brake');if(index===1&&p.passage){Route.enter();return used;}if(index<2)this.activateStage(f,index+1);else finishFlight(Math.abs(f.covered-f.distance)<=Math.max(Simulation.tolerance(f)*4,f.distance*2e-11));}
  return used;
 }
};

// A certified lower bound for a new stopped flight to an unbound, massless
// landmark. The outer bound includes acceleration time and cosmological redshift;
// each displayed radius has a feasible witness using the real braking solver.
const MissionReach={
 cache:new Map(),
 solve(c,source,origin,fuel,epoch,startBeta=0,orbit=null,coastOnly=false){
  const key=JSON.stringify([source?.id,origin.p3,c,fuel,epoch,orbit?.radius,startBeta,state.destroyed,coastOnly]);
  if(this.cache.has(key))return this.cache.get(key);
  const prepared=c.dump?0:Math.min(fuel,c.capacityKg),a=MissionPlanner.acceleration(coastOnly?{...c,engine:false,sail:false}:c,source,prepared,1e20,epoch,true,true,startBeta,orbit),last=a.rows.at(-1);
  let upper=Math.min(Cosmology.horizon(epoch),last.comoving+Cosmology.reach(last.beta,epoch+last.earth));
  if(!(last.beta>1e-15)||!c.brakeEngine)upper=0;
  // Keep the complete chosen setup, including the requested fuel on arrival.
  // planPreferred may lower that reserve for an individual route; the envelope
  // must certify the stated reserve and must never use that fallback.
  const probe=d=>MissionPlanner.plan(c,source,{id:'range-probe',kind:'structure',navigable:true,rangeProbe:true,p3:V3.add(origin.p3,[d,0,0])},fuel,origin,epoch,true,startBeta,orbit,coastOnly);
  let lo=0,hi=upper,witness=null;
  if(upper>0){
   const d=upper*(1-1e-4),p=probe(d);
   if(p.valid){lo=d;witness=p;}
   else for(let n=0;n<28&&(hi-lo)>Math.max(1e-12,hi*1e-4);n++){const mid=(lo+hi)/2,q=probe(mid);if(q.valid){lo=mid;witness=q;}else hi=mid;}
  }
  const result={comoving:lo,upper:hi,beta:witness?.peakBeta||0,epoch,setup:c,witness:witness?{proper:witness.proper,earth:witness.earth,arrivalFuelKg:witness.arrivalFuelKg}:null};
  if(this.cache.size>24)this.cache.clear();this.cache.set(key,result);return result;
 },
 idle(){
  const source=object(state.current),c=FlightSetup.read(),epoch=Math.ceil((state.cosmicTime||0)/1000)*1000,orbit=state.orbit;
  return this.solve(c,source,Space.point(source?.p3||state.ship.p3),state.matter*1000,epoch,orbit?.beta||0,orbit);
 },
 active(){
  const f=state.flight,p=f?.mission,c=FlightSetup.normalize(p?.setup||FlightSetup.read());
  let beta=state.beta||0,fuel=state.matter*1000,epoch=state.cosmicTime||0,remaining=0;
  if(p&&(f.missionStage||0)===0){const end=p.accelerationEnd,sample=f.missionSample||MissionPlanner.stageSample(p,0,f.stageElapsed||0);beta=end.beta;fuel=Math.max(0,end.mass-MissionPlanner.dry);epoch=p.epoch+end.earth;remaining=Math.max(0,end.comoving-sample.comoving);}
  // Round down momentum/fuel and forward in time: caching must not invent extra
  // range. This affects only the displayed envelope, never the executing plan.
  const eta=Math.atanh(Math.min(1-Number.EPSILON,Math.max(0,beta))),unit=eta>0?10**(Math.floor(Math.log10(eta))-5):1;
  beta=Math.tanh(Math.floor(eta/unit)*unit);fuel=Math.floor((fuel+1e-12)*1e5)/1e5;epoch=Math.ceil(epoch/10000)*10000;
  const setup=FlightSetup.normalize({...c,engine:false,sail:false,collector:false,burst:false,dump:false}),q=this.solve(setup,null,Space.point([0,0,0]),fuel,epoch,beta,null,true);
  return{...q,comoving:q.witness?remaining+q.comoving:0,upper:remaining+q.upper,remainingAcceleration:remaining};
 }
};

// The same composable plan also feeds stopped routes and black-hole passages.
Object.assign(MissionPlanner,{
 legSetup(c,source,used=new Set(state.destroyed)){
  if(OrbitalArrival.enabled)return FlightSetup.resolve(c,source,used);
  const available=source&&['star','home'].includes(source.kind)&&!used.has(source.id);
  return FlightSetup.normalize({...c,sail:c.sail&&available,burst:c.burst&&available&&source.id!=='sol'});
 },
 coastFor(beta,d,epoch,cosmic,expansion){
  if(!(d>0))return{proper:0,earth:0,distance:0,path:0,beta};
  if(!cosmic){const earth=d/beta;return{proper:earth*Math.sqrt((1-beta)*(1+beta)),earth,distance:d,path:d,beta};}
  let lo=0,hi=Math.max(1,d*Math.sqrt((1-beta)*(1+beta))/beta),q=Cosmology.coast(beta,hi,epoch,expansion);
  for(let n=0;q.distance<d&&n<44&&hi<2e12;n++){hi*=2;q=Cosmology.coast(beta,hi,epoch,expansion);}
  if(q.distance<d)return null;
  for(let n=0;n<60;n++){const mid=(lo+hi)/2;if(Cosmology.coast(beta,mid,epoch,expansion).distance<d)lo=mid;else hi=mid;}return Cosmology.coast(beta,(lo+hi)/2,epoch,expansion);
 },
 passage(c,source,target,next,fuel,origin,epoch,expansion,beta=0){
  const d=Space.distance(origin,target),cosmic=Cosmology.isCosmic(source||origin,target),prepared=c.dump?0:Math.min(c.capacityKg,fuel),a=this.acceleration(c,source,prepared,d,epoch,cosmic,expansion,beta);
  let end=a.rows.at(-1),encounter,aim,legDistance=d,coast;
  if(!(end.beta>0))return this.invalid('Нет разгона для участка маршрута.');
  let arrivalBeta=end.beta;
  for(let iteration=0;iteration<5;iteration++){
   encounter=Gravity.encounter(origin,target,next,arrivalBeta);if(!encounter.ok)return this.invalid(encounter.reason||'Гравитационный пролёт недоступен.');
   aim=encounter.plan?Space.point(V3.add(target.p3,encounter.plan.rows[0].offset)):Space.point(target.p3);legDistance=Space.distance(origin,aim);
   if(a.rows.at(-1).comoving>legDistance){let lo=0,hi=a.proper;for(let n=0;n<58;n++){const mid=(lo+hi)/2;if(this.sampleAcceleration(a,mid).comoving>legDistance)hi=mid;else lo=mid;}end=this.sampleAcceleration(a,lo);}else end=a.rows.at(-1);
   const time=epoch+(expansion?end.earth:0);coast=this.coastFor(end.beta,Math.max(0,legDistance-end.comoving),time,cosmic,expansion);if(!coast)return this.invalid('Выбранного импульса недостаточно для достижения пролёта.');
   if(Math.abs(coast.beta-arrivalBeta)<1e-13)break;arrivalBeta=coast.beta;
  }
  const encounterTime=encounter.plan?.proper||0,encounterEarth=encounter.plan?.earth||0;
  return{valid:true,reason:'',model:this.model,setup:c,sourceId:source?.id,targetId:target.id,distance:legDistance,cosmic,epoch,expansion,initialFuelKg:prepared,jettisonKg:Math.max(0,fuel-prepared),acceleration:a,accelerationEnd:end,coast,coastEpoch:epoch+(expansion?end.earth:0),brake:{proper:0,earth:0,distance:0,comoving:0,finalMass:end.mass,captured:0,burned:0},proper:end.proper+coast.proper+encounterTime,earth:end.earth+coast.earth+encounterEarth,totalDistance:end.distance+coast.path,peakBeta:end.beta,arrivalFuelKg:end.mass-this.dry,capturedKg:0,burnedKg:end.burned,passage:true,aim,encounter:{...encounter,beta:coast.beta}};
 },
 analyzeRoute(nodes=state.itinerary){
  let origin=state.ship,source=object(state.current),fuel=state.matter*1000,beta=0,orbit=state.orbit,epoch=state.cosmicTime||0,valid=nodes.length>0;const records=[],used=new Set(state.destroyed),settings=OrbitalArrival.enabled?FlightSetup.preferred():FlightSetup.read();
  for(let i=0;i<nodes.length;i++){
   const n=nodes[i],target=object(n.id),next=object(nodes[i+1]?.id),c=this.legSetup(settings,source,used);let p;
   if(!target?.navigable||!origin?.p3)p=this.invalid('Нет физических координат.');
   else if(n.mode==='flyby'&&(!Gravity.canFlyby(target)||!next))p=this.invalid('Пролёт требует чёрной дыры и следующей точки.');
   else p=n.mode==='flyby'?this.passage(c,source,target,next,fuel,origin,epoch,state.expansion!==false,beta):(OrbitalArrival.enabled?this.planPreferred(c,source,target,fuel,origin,epoch,state.expansion!==false,beta,orbit):this.plan(c,source,target,fuel,origin,epoch,state.expansion!==false,beta,orbit));
   const r={id:n.id,mode:n.mode,d:target?.p3?Space.distance(origin,target):0,beta:p.peakBeta||beta,issue:p.valid?'':p.reason};
   if(!p.valid){valid=false;records.push(r);break;}
   if(n.mode==='flyby'){orbit=null;const angle=V3.angle(V3.sub(target.p3,origin.p3),V3.sub(next.p3,target.p3));Object.assign(r,Gravity.solve(target.gravity,p.coast.beta,angle),{required:angle});const exit=p.encounter.plan?Gravity.atProper(p.encounter.plan,p.encounter.plan.proper).offset:[0,0,0];origin=Space.point(V3.add(target.p3,exit));beta=p.coast.beta;}
   else{origin=Space.point(target.p3);beta=0;orbit=p.arrival?{targetId:target.id,radius:p.arrival.radius,beta:p.arrival.beta}:null;}
   if(c.burst&&source)used.add(source.id);fuel=p.arrivalFuelKg;source=target;epoch+=state.expansion!==false?p.earth:0;records.push(r);
  }
  return{valid,records};
 },
 routeLeg(nodes,index,source,origin,beta=0){
  const c=this.legSetup(OrbitalArrival.enabled?FlightSetup.preferred():FlightSetup.read(),source),target=object(nodes[index].id),epoch=state.cosmicTime||0;if(beta>0)c.dump=false;
  return nodes[index].mode==='flyby'?this.passage(c,source,target,object(nodes[index+1]?.id),state.matter*1000,origin,epoch,state.expansion!==false,beta):(OrbitalArrival.enabled?this.planPreferred(c,source,target,state.matter*1000,origin,epoch,state.expansion!==false,beta):this.plan(c,source,target,state.matter*1000,origin,epoch,state.expansion!==false,beta));
 },
 startRoute(){
  syncClock();const analysis=this.analyzeRoute();if(!analysis.valid||state.flight)return;const nodes=state.itinerary.map(n=>({...n})),source=object(state.current);const rollback=FlightHistory.snapshot();state.selected=nodes[0].id;
  const p=this.routeLeg(nodes,0,source,state.ship);if(!p.valid){toast(p.reason);return;}FlightHistory.pending=rollback;$('infoDialog').close();this.launch(p,{nodes,index:0});state.itinerary=[];log('Составной маршрут: '+nodes.map(n=>object(n.id).name).join(' → '));persist();
 },
 continueRoute(old,from=state.ship,beta=0){
  if(!old.route?.length||old.legIndex>=old.route.length-1)return;
  const index=old.legIndex+1,source=object(old.target),p=this.routeLeg(old.route,index,source,from,beta);if(!p.valid){toast('Следующий участок недоступен: '+p.reason);return;}
  state.selected=old.route[index].id;state.ship=Space.point(from.p3);FlightHistory.complete(old);state.flight=null;FlightHistory.pending=old.rollback;this.launch(p,{nodes:old.route,index});
 }
});

// Canvas uses the same light/capture limits as the composed trajectory.
MissionPlanner.sailOpening=function(f){
 const p=f.mission,c=FlightSetup.normalize(p.setup);
 if(state.phase==='brake')return c.brakeSail&&c.densityCm3>0?(f.missionSample?.opening??1):0;
 if(state.phase!=='launch'||!c.sail||!p.acceleration.hasLight)return 0;
 const q=f.missionSample||this.sampleAcceleration(p.acceleration,f.stageElapsed||0);
 if(c.burst&&q.source>=c.burstDays/365.25*(1-1e-10)||q.proper>=(p.acceleration.lightEndProper??Infinity)&&p.acceleration.lightEndReason==='negligible')return 0;
 const a=p.acceleration,r=a.collectorR+q.distance*LY,power=c.collector?a.beamPower*(a.diffraction?BeamOptics.fraction(q.distance*LY,q.source,a.diffraction.spectrum,a.diffraction.diameterM,a.diffraction.sailRadiusM,a.diffraction.divergenceDeg||0,a.diffraction.enabled!==false):1):a.luminosityW*SHIP.sailAreaM2/(4*Math.PI*r*r),full=ShipPhysics.reflection*power/Rocket.c*Math.exp(-2*q.eta);
 return full>0?Math.min(1,q.mass*c.maxAccelerationG*9.80665/full):0;
};

function cOptical(c){return c.opticalEfficiencyPercent/100;}
for(const name of ['plan','planPreferred','acceleration','stopping','passage','fuelLimit']){
 const calculate=MissionPlanner[name];MissionPlanner[name]=function(c,...args){return ShipPhysics.run(c,()=>calculate.call(this,c,...args));};
}
for(const name of ['stageSample','sailOpening']){
 const calculate=MissionPlanner[name];MissionPlanner[name]=function(p,...args){return ShipPhysics.run(p.setup||p.mission?.setup,()=>calculate.call(this,p,...args));};
}
for(const [name,index] of [['plan',0],['integrate',1]]){
 const calculate=OrbitalArrival[name];OrbitalArrival[name]=function(...args){return ShipPhysics.run(args[index],()=>calculate.apply(this,args));};
}
