'use strict';
// Timelike Schwarzschild geodesics. No spin, radiation pressure or moving bodies.
// Exact radial/angular equations: Tsupko, https://arxiv.org/html/1505.06481v2
const V3={
 add:(a,b)=>a.map((x,i)=>x+b[i]),sub:(a,b)=>a.map((x,i)=>x-b[i]),mul:(a,s)=>a.map(x=>x*s),
 dot:(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 norm:a=>Math.hypot(...a),unit(a){const n=this.norm(a);return n?this.mul(a,1/n):[1,0,0];},
 angle(a,b){const u=this.unit(a),v=this.unit(b);return Math.atan2(this.norm(this.cross(u,v)),Math.max(-1,Math.min(1,this.dot(u,v))));}
};
const Gravity={
 G:6.67430e-11,solarMass:1.98847e30,solarRadius:695700000,
 rs(massSolar){return 2*this.G*this.solarMass*massSolar/Rocket.c**2;},
 critical(beta){const y=Math.sqrt(1-8*(1-beta*beta)/9);return 3*(1+y)/(1+3*y);},
 integrate(fn,a,b,tol=2e-12){
  const mid=(a+b)/2,fa=fn(a),fm=fn(mid),fb=fn(b),whole=(b-a)*(fa+4*fm+fb)/6;
  function rec(a,b,fa,fm,fb,s,tol,depth){const m=(a+b)/2,l=(a+m)/2,r=(m+b)/2,fl=fn(l),fr=fn(r),left=(m-a)*(fa+4*fl+fm)/6,right=(b-m)*(fm+4*fr+fb)/6,err=left+right-s;if(depth<=0||Math.abs(err)<15*tol)return left+right+err/15;return rec(a,m,fa,fl,fm,left,tol/2,depth-1)+rec(m,b,fm,fr,fb,right,tol/2,depth-1);}
  return rec(a,b,fa,fm,fb,whole,tol,22);
 },
 D(q,beta,t){const u=1-t*t,A=beta*beta*(q-1)/(1+beta*beta*(q-1));return A+(1-1/q)*u-u*u/q;},
 deflection(beta,q){if(!(beta>0&&beta<1&&q>this.critical(beta)))return Infinity;return Math.max(0,4*this.integrate(t=>1/Math.sqrt(this.D(q,beta,t)),0,1)-Math.PI);},
 boundaryTurn(beta,q,rp,limit){const R=Math.max(rp*5,Math.min(rp*1000,limit)),u=rp/R,t=Math.sqrt(1-u);return Math.max(0,4*this.integrate(z=>1/Math.sqrt(this.D(q,beta,z)),0,t)+2*Math.atan2(u,t*Math.sqrt(this.D(q,beta,t)))-Math.PI);},
 minimum(profile,beta){return Math.max(this.critical(beta)*1.001,(profile.radiusMeters||0)*1.05/this.rs(profile.massSolar));},
 solve(profile,beta,angle,boundary=Infinity){
  if(!profile||!(beta>0&&beta<1))return{ok:false,reason:'Нет массы, радиуса или скорости для расчёта.'};
  const min=this.minimum(profile,beta),rs=this.rs(profile.massSolar),turn=q=>boundary===Infinity?this.deflection(beta,q):this.boundaryTurn(beta,q,q*rs,boundary),maxAngle=turn(min);
  if(angle>maxAngle+1e-10)return{ok:false,maxAngle,required:angle,reason:'Требуемый поворот больше доступного вне поверхности / области захвата.'};
  if(angle<1e-10)return{ok:true,straight:true,maxAngle,angle:0,rp:Infinity,q:Infinity};
  let lo=min,hi=Math.max(min*2,2*(1+1/(beta*beta))/angle);
  while(turn(hi)>angle)hi*=2;
  for(let i=0;i<65;i++){const mid=Math.sqrt(lo*hi);if(turn(mid)>angle)lo=mid;else hi=mid;}
  const q=(lo+hi)/2,rp=q*this.rs(profile.massSolar);
  return{ok:true,q,rp,angle,maxAngle,impact:rp*Math.sqrt(1+1/(beta*beta*(q-1)))};
 },
 // Radial parameter t=sqrt(1-rp/r) removes the turning-point singularity.
 // Local times integrate dτ/dr=1/(c sqrt(F)), dt/dτ=E/(1-rs/r).
 trajectory(profile,beta,solution,incoming,outgoing,matchRadius){
  const {q,rp}=solution,E=1/Math.sqrt(1-beta*beta),J=E*E/(1-1/q)-1;
  const R=Math.max(rp*5,Math.min(rp*1000,matchRadius)),tMax=Math.sqrt(1-rp/R);
  const n=V3.unit(V3.cross(incoming,outgoing)),side=V3.unit(V3.cross(n,incoming)),theta=(Math.PI-solution.angle)/2;
  const ex=V3.sub(V3.mul(incoming,Math.cos(theta)),V3.mul(side,Math.sin(theta))),ey=V3.add(V3.mul(incoming,Math.sin(theta)),V3.mul(side,Math.cos(theta)));
  const half=[{t:0,r:rp,phi:0,earth:0,proper:0,path:0}];let phi=0,earth=0,proper=0,path=0;
  const N=220,log=Math.log(R/rp);
  for(let i=1;i<=N;i++){
   const t=Math.sqrt(1-Math.exp(-log*i/N)),a=half.at(-1).t,mid=(a+t)/2,h=(t-a)/2;let dp=0,de=0,dtau=0,dl=0;
   for(let k=0;k<8;k++){const z=mid+h*QUAD_X[k],u=1-z*z,r=rp/u,f=1-u/q,D=this.D(q,beta,z),dphi=2/Math.sqrt(D),dproper=2*rp/(Rocket.c*u*u*Math.sqrt(J*D)),dr=2*rp*z/(u*u);dp+=QUAD_W[k]*dphi;dtau+=QUAD_W[k]*dproper;de+=QUAD_W[k]*dproper*E/f;dl+=QUAD_W[k]*Math.hypot(dr/Math.sqrt(f),r*dphi);}
   phi+=dp*h;proper+=dtau*h/Rocket.year;earth+=de*h/Rocket.year;path+=dl*h/LY;
   half.push({t,r:rp/(1-t*t),phi,earth,proper,path});
  }
  const point=(row,sign)=>{const a=row.phi*sign,u=rp/row.r,f=1-u/q;return{offset:V3.mul(V3.add(V3.mul(ex,Math.cos(a)),V3.mul(ey,Math.sin(a))),row.r/LY),earth:sign<0?earth-row.earth:earth+row.earth,proper:sign<0?proper-row.proper:proper+row.proper,path:sign<0?path-row.path:path+row.path,r:row.r,phi:a,localBeta:Math.sqrt(Math.max(0,1-f/(E*E)))};};
  const rows=[...half].reverse().map(r=>point(r,-1)).concat(half.slice(1).map(r=>point(r,1)));
  return{rows,beta,q,rp,R,angle:solution.angle,earth:2*earth,proper:2*proper,path:2*path,elapsed:0,duration:8,profile,ex,ey,tMax};
 },
 sample(plan,p){const at=Math.max(0,Math.min(1,p))*(plan.rows.length-1),i=Math.floor(at),a=plan.rows[i],b=plan.rows[Math.min(i+1,plan.rows.length-1)],t=at-i;return{offset:a.offset.map((v,k)=>v+(b.offset[k]-v)*t),earth:a.earth+(b.earth-a.earth)*t,proper:a.proper+(b.proper-a.proper)*t,path:a.path+(b.path-a.path)*t,r:a.r+(b.r-a.r)*t,phi:a.phi+(b.phi-a.phi)*t,localBeta:a.localBeta+(b.localBeta-a.localBeta)*t};},
 encounter(origin,body,next,beta){
  let incoming=V3.unit(V3.sub(body.p3,origin.p3)),outgoing=V3.unit(V3.sub(next.p3,body.p3));
  const neighbourhood=Math.min(V3.norm(V3.sub(body.p3,origin.p3)),V3.norm(V3.sub(next.p3,body.p3)))*LY*.001;
  let result;
  // Match finite-boundary tangents to the actual straight legs, including impact offsets.
  for(let pass=0;pass<5;pass++){
   const angle=V3.angle(incoming,outgoing),sol=this.solve(body.gravity,beta,angle,neighbourhood);
   if(!sol.ok||sol.straight)return{...sol,incoming,outgoing};
   if(sol.rp*5>neighbourhood)return{ok:false,reason:'Сфера пролёта перекрывает соседнюю точку; выберите более далёкие точки.',required:angle,maxAngle:sol.maxAngle};
   const plan=this.trajectory(body.gravity,beta,sol,incoming,outgoing,neighbourhood);result={...sol,incoming,outgoing,plan};
   incoming=V3.unit(V3.sub(V3.add(body.p3,plan.rows[0].offset),origin.p3));outgoing=V3.unit(V3.sub(next.p3,V3.add(body.p3,plan.rows.at(-1).offset)));
  }
  return result;
 }
};
