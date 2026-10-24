'use strict';
// Flat matter + Lambda background, Planck 2018. Catalog coordinates remain the reference epoch.
// Bound groups translate as a whole: their internal separations do not scale with a(t).
const Cosmology={
 H0:67.4/3.0856775814913673e19*31557600,omegaM:.315,omegaL:.685,time:0,enabled:true,cache:new Map(),
 logA(t=this.time){const x=1.5*this.H0*Math.sqrt(this.omegaL)*Math.max(0,t),b=1/Math.sqrt(this.omegaL);return 2/3*(x<20?Math.log(Math.cosh(x)+b*Math.sinh(x)):x+Math.log((1+b)/2));},
 scale(t=this.time){return Math.exp(Math.min(80,this.logA(t)));},
 sync(s){this.time=Math.max(0,s.cosmicTime||0);this.enabled=s.expansion!==false;},
 elapse(s,years){if(s.expansion!==false)s.cosmicTime=(s.cosmicTime||0)+years;this.sync(s);},
 group(o){
  if(!o?.p3)return null;if(Math.hypot(...o.p3)<4e6)return{id:'local-group',p3:[0,0,0],map:{x:0,y:0}};
  if(o.parentGalaxy&&o.parentGalaxy!=='milkyway'){const g=OBJECTS.find(g=>g.id===o.parentGalaxy)||ExtendedCatalog.get(o.parentGalaxy);if(g&&g!==o)return this.group(g);}
  const saved=o.id&&this.cache.get(o.id);if(saved)return saved;
  let anchor=o;
  // Only individually identified virialised clusters are treated as bound, not superclusters/voids.
  for(const id of ['virgo','coma']){const c=OBJECTS.find(q=>q.id===id);if(c?.p3&&Space.distance(c,o)<(id==='virgo'?5.05e6:10.1e6)){anchor=c;break;}}
  if(anchor===o&&o.kind!=='galaxy')for(const g of GALAXIES){const c=OBJECTS.find(q=>q.id===g.id)||ExtendedCatalog.get(g.id);if(c?.p3&&Space.distance(c,o)<g.diameterLy*.6){anchor=c;break;}}
  const result={id:anchor.id||null,p3:anchor.p3,map:MapLayout.baseProject(anchor)};
  if(o.id){if(this.cache.size>16000)this.cache.clear();this.cache.set(o.id,result);}return result;
 },
 project(o,base){if(this.time===0)return base;if(!o?.p3&&o?.id)o=OBJECTS.find(q=>q.id===o.id)||o;if(!o?.p3)return base;const a=this.scale(),g=this.group(o);if(g?.id==='local-group')return base;const c=g?.map||base;return{x:base.x+c.x*(a-1),y:base.y+c.y*(a-1)};},
 isCosmic(from,to){if(!from?.p3||!to?.p3||Space.distance(from,to)<1e6)return false;const a=this.group(from),b=this.group(to);return !!(a&&b&&a.id!==b.id);},
 factor(f,t=this.time){return f?.cosmic?this.scale(t):1;},
 referenceView(view){const a=this.scale();if(a===1||Math.hypot(view.x,view.y)<4e6&&view.span<8e6)return view;
  for(const g of GALAXIES){if(view.span>g.diameterLy*4)continue;const q=MapLayout.project(g);if(Math.hypot(view.x-q.x,view.y-q.y)<g.diameterLy){const base=MapLayout.baseProject(g);return{...view,x:base.x+view.x-q.x,y:base.y+view.y-q.y};}}
  return{x:view.x/a,y:view.y/a,span:view.span/a};
 },
 physicalDistance(a,b){const pa=this.position(a),pb=this.position(b);return Math.hypot(...pa.map((v,i)=>v-pb[i]));},
 position(o){const a=this.scale(),g=this.group(o);if(!g||g.id==='local-group')return o.p3;return o.p3.map((v,i)=>v+g.p3[i]*(a-1));},
 regionScale(o){return ['structure','wall','void','ring','arc','horizon'].includes(o.kind)?this.scale():1;},
 // Integrate a freely moving massive particle: a*gamma*beta is conserved.
 coast(beta,proper,time=this.time,enabled=this.enabled){
  if(!(proper>0)||!(beta>0))return{distance:0,path:0,earth:0,proper:0,beta};
  const p0=beta/Math.sqrt((1-beta)*(1+beta)),g0=Math.hypot(1,p0),l0=this.logA(time),a0=this.scale(time);
  if(!enabled)return{distance:beta*g0*proper/a0,path:beta*g0*proper,earth:g0*proper,proper,beta};
  const rates=dt=>{const log=this.logA(time+dt),p=p0*Math.exp(l0-log),g=Math.hypot(1,p),b=p/g;return{tau:1/g,chi:b/Math.exp(Math.min(80,log)),path:b,beta:b};};
  if(this.H0*proper*g0<1e-5){let earth=proper*g0;for(let n=0;n<3;n++)earth=proper/rates(earth/2).tau;const r=rates(earth/2);return{distance:earth*r.chi,path:earth*r.path,earth,proper,beta:rates(earth).beta};}
  const integrate=earth=>{const N=128,zmax=Math.log1p(this.H0*earth),h=zmax/N;let tau=0,chi=0,path=0;for(let i=0;i<=N;i++){const z=h*i,t=Math.expm1(z)/this.H0,jac=Math.exp(z)/this.H0,r=rates(t),w=i===0||i===N?1:i%2?4:2;tau+=r.tau*w*jac;chi+=r.chi*w*jac;path+=r.path*w*jac;}return{proper:tau*h/3,distance:chi*h/3,path:path*h/3};};
  let lo=proper,hi=proper*g0;for(let n=0;n<42;n++){const mid=(lo+hi)/2;if(integrate(mid).proper<proper)lo=mid;else hi=mid;}const earth=(lo+hi)/2;return{...integrate(earth),earth,proper,beta:rates(earth).beta};
 },
 eta(d,beta,time=this.time){
  if(!(beta>0))return null;let lo=0,hi=Math.max(1,d*Math.sqrt((1-beta)*(1+beta))/beta*1.1),q;
  // Future travel has a finite comoving reach in a Lambda-dominated universe.
  for(let n=0;n<48;n++){q=this.coast(beta,hi,time);if(q.distance>=d)break;hi*=2;if(hi>2e12)return{proper:Infinity,earth:Infinity,unreachable:true};}
  for(let n=0;n<40;n++){const mid=(lo+hi)/2;if(this.coast(beta,mid,time).distance<d)lo=mid;else hi=mid;}return this.coast(beta,(lo+hi)/2,time);
 },
 toggle(s){s.expansion=s.expansion===false;this.sync(s);}
};
