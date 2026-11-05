'use strict';
// Kinematic Kepler models in Galactic XY, driven by observer time. Catalog p3
// and frozen flight endpoints remain the navigation reference; no interception
// or N-body integration is claimed. Sources and precision: docs/physics.md.
const OrbitalMotion={
 sources:{planets:'https://ssd.jpl.nasa.gov/planets/approx_pos.html',alphaAB:'https://arxiv.org/abs/1610.06079',alphaC:'https://arxiv.org/abs/1611.03495'},
 epoch:2026.81,AU:1/63241.077,alphaAnchor:null,
 alphaAB:{a:17.592/.74717,e:.5208,i:79.320,node:205.064,omega:232.006,period:79.929,peri:1955.604,uncertainty:{aArcsec:.013,e:.0011,iDeg:.011,nodeDeg:.033,omegaDeg:.051,periodYears:.013,periYear:.013}},
 alphaC:{a:8700,e:.50,i:107.6,node:126,omega:72.3,period:547000,peri:2016+283000,uncertainty:{aAu:[-400,700],e:[-.09,.08],periodYears:[-40000,66000],iDeg:[-2,1.8],nodeDeg:[-5,5],omegaDeg:[-6.6,8.7],periYears:[-41000,59000]}},
 // Kervella et al. 2017, Table 2 (ICRS, epoch 1991.25) and Table B.1.
 // AB parallax/orbit: Kervella et al. 2016 Tables 1-2. Absolute errors
 // are shared by AB, not independently scattered component distances.
 referenceAstrometry(){
  const pc=3.2615637771674336,dt=this.epoch-1991.25,kmToLyYear=31557600/9460730472580.8;
  const entries={ab:{ra:(14+39/60+40.2068/3600)*15,dec:-(60+50/60+13.673/3600),parallaxMas:747.17,parallaxErrorMas:.61,velocity:[-29.291,1.710,13.589]},proxima:{ra:(14+29/60+47.7474/3600)*15,dec:-(62+40/60+52.868/3600),parallaxMas:768.77,parallaxErrorMas:.37,velocity:[-29.390,1.883,13.777]}};
  for(const q of Object.values(entries))q.p3=Space.fromSky(q.ra,q.dec,1000/q.parallaxMas*pc).map((x,i)=>x+dt*q.velocity[i]*kmToLyYear);
  const ab=this.vector(this.alphaAB,this.phase(this.alphaAB,this.epoch)),centre=entries.ab.p3;
  return{epoch:this.epoch,frame:'heliocentric Galactic Cartesian / ICRS axes',astrometryEpoch:1991.25,entries,positions:{alpha:centre.map((x,i)=>x-.9373/2.0428*ab[i]),'hyg-71453':centre.map((x,i)=>x+1.1055/2.0428*ab[i]),proxima:entries.proxima.p3}};
 },
 // JPL Table 1 elements at J2000; osculating ellipses held fixed. EM barycenter
 // represents Earth at this map resolution. Mutual perturbations are omitted.
 planets:[
  ['МЕРКУРИЙ',.38709927,.20563593,7.00497902,252.25032350,77.45779628,48.33076593],
  ['ВЕНЕРА',.72333566,.00677672,3.39467605,181.97909950,131.60246718,76.67984255],
  ['ЗЕМЛЯ',1.00000261,.01671123,-.00001531,100.46457166,102.93768193,0],
  ['МАРС',1.52371034,.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],
  ['ЮПИТЕР',5.20288700,.04838624,1.30439695,34.39644051,14.72847983,100.47390909],
  ['САТУРН',9.53667594,.05386179,2.48599187,49.95424423,92.59887831,113.66242448],
  ['УРАН',19.18916464,.04725744,.77263783,313.23810451,170.95427630,74.01692503],
  ['НЕПТУН',30.06992276,.00859048,1.77004347,-55.12002969,44.96476227,131.78422574]
 ].map(([name,a,e,i,L,peri,node])=>({name,a,e,i,node,omega:peri-node,period:Math.sqrt(a**3),peri:2000-(L-peri)/360*Math.sqrt(a**3),solar:true})),
 elapsed(){try{return state?.universeElapsed??state?.earth??0;}catch{return 0;}},
 phase(q,year=this.epoch+this.elapsed()){
  const M=(((year-q.peri)%q.period)/q.period*2*Math.PI+2*Math.PI)%(2*Math.PI);
  let lo=0,hi=2*Math.PI,E=M;for(let n=0;n<60;n++){const f=E-q.e*Math.sin(E)-M;if(Math.abs(f)<2e-14)break;if(f>0)hi=E;else lo=E;const next=E-f/(1-q.e*Math.cos(E));E=next>lo&&next<hi?next:(lo+hi)/2;}return E;
 },
 vector(q,E){
  const rad=Math.PI/180,w=q.omega*rad,O=q.node*rad,i=q.i*rad,x=q.a*(Math.cos(E)-q.e),y=q.a*Math.sqrt(1-q.e*q.e)*Math.sin(E),u=x*Math.cos(w)-y*Math.sin(w),v=x*Math.sin(w)+y*Math.cos(w);
  let icrs;
  if(q.solar){const e=23.4392911*rad,xx=u*Math.cos(O)-v*Math.sin(O)*Math.cos(i),yy=u*Math.sin(O)+v*Math.cos(O)*Math.cos(i),zz=v*Math.sin(i);icrs=[xx,yy*Math.cos(e)-zz*Math.sin(e),yy*Math.sin(e)+zz*Math.cos(e)];}
  else{const east=u*Math.sin(O)+v*Math.cos(O)*Math.cos(i),north=u*Math.cos(O)-v*Math.sin(O)*Math.cos(i),depth=v*Math.sin(i),ra=(q.raDeg??219.90258)*rad,dec=(q.decDeg??-60.833)*rad;icrs=[-Math.sin(ra)*east-Math.sin(dec)*Math.cos(ra)*north+Math.cos(dec)*Math.cos(ra)*depth,Math.cos(ra)*east-Math.sin(dec)*Math.sin(ra)*north+Math.cos(dec)*Math.sin(ra)*depth,Math.cos(dec)*north+Math.sin(dec)*depth];}
  return Space.matrix.map(row=>row.reduce((sum,n,j)=>sum+n*icrs[j],0)*this.AU);
 },
 init(){
  this.initStellar();
  const a=OBJECTS.find(o=>o.id==='alpha'),b=ExtendedCatalog.get('hyg-71453'),c=OBJECTS.find(o=>o.id==='proxima');if(!a||!b||!c)return;
  const mA=1.1055,mB=.9373,mC=.1221,total=mA+mB+mC;
  this.alphaReference={alpha:[...a.p3],'hyg-71453':[...b.p3],proxima:[...c.p3]};
  this.alphaAnchor=a.p3.map((n,j)=>(mA*n+mB*b.p3[j]+mC*c.p3[j])/total);
 },
 wideReferenceOrbit(){
  if(this.wideOrbit)return this.wideOrbit;
  const ref=this.referenceAstrometry(),q=ref.entries,dt=this.epoch-ref.astrometryEpoch,k=31557600/9460730472580.8;
  const v=q.proxima.velocity.map((x,i)=>(x-q.ab.velocity[i])*k);
  const r=q.proxima.p3.map((x,i)=>x-q.ab.p3[i]-v[i]*dt);
  const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const mu=4*Math.PI**2*(2.0428+.1221)*this.AU**3,R=Math.hypot(...r),h=cross(r,v),H=Math.hypot(...h),vxh=cross(v,h),ecc=r.map((x,i)=>vxh[i]/mu-x/R),e=Math.hypot(...ecc),a=1/(2/R-dot(v,v)/mu);
  const u=ecc.map(x=>x/e),w=cross(h.map(x=>x/H),u),E=Math.atan2(dot(r,w)/(a*Math.sqrt(1-e*e)),dot(r,u)/a+e),period=2*Math.PI*Math.sqrt(a**3/mu);
  return this.wideOrbit={a,e,u,w,period,peri:ref.astrometryEpoch-(E-e*Math.sin(E))*period/(2*Math.PI)};
 },
 wideAtPhase(E){const q=this.wideReferenceOrbit();return q.u.map((x,i)=>q.a*((Math.cos(E)-q.e)*x+Math.sqrt(1-q.e*q.e)*Math.sin(E)*q.w[i]));},
 wideVector(year){return this.wideAtPhase(this.phase(this.wideReferenceOrbit(),year));},
 alphaPositions3D(year=this.epoch+this.elapsed()){
  if(!this.alphaReference)return null;
  const ab=this.vector(this.alphaAB,this.phase(this.alphaAB,year)),ab0=this.vector(this.alphaAB,this.phase(this.alphaAB,this.epoch));
  const outer=this.wideVector(year),outer0=this.wideVector(this.epoch),fC=.1221/(2.0428+.1221);
  // Differential animation starts at the adopted physical snapshot exactly.
  // The wide orbit is a two-body fit to the cited measured relative XYZ/UVW;
  // no sky-plane interpretation of its rounded published angles is assumed.
  const point=(id,inner,wide)=>this.alphaReference[id].map((n,j)=>n+inner*(ab[j]-ab0[j])+wide*(outer[j]-outer0[j]));
  const result={alpha:point('alpha',-.9373/2.0428,-fC),'hyg-71453':point('hyg-71453',1.1055/2.0428,-fC),proxima:point('proxima',0,1-fC)};
  result.ab=result.alpha.map((n,j)=>(1.1055*n+.9373*result['hyg-71453'][j])/2.0428);return result;
 },
 alphaPositions(year=this.epoch+this.elapsed()){
  const points=this.alphaPositions3D(year);return points&&Object.fromEntries(Object.entries(points).map(([id,p])=>[id,MapLayout.base(p)]));
 },
 initStellar(){
  this.stellarYear=null;this.stellarPoints=null;
  this.stellarReferences=new Map();this.stellarFrames=new Map();this.stellarOrbits=[];
  for(const s of EXTENDED_BOOT.stellarCatalog?.systems||[]){
   const anchor=ExtendedCatalog.get(s.primary);if(!anchor?.p3)continue;
   this.stellarFrames.set(s.id,{id:'frame-'+s.id,kind:'star',p3:[...anchor.p3]});
   for(const id of s.members){const o=ExtendedCatalog.get(id);if(o?.p3)this.stellarReferences.set(id,[...o.p3]);}
   for(const pair of s.pairs){if(!pair.orbit)continue;const q=pair.orbit;
    this.stellarOrbits.push({system:s.id,q,atEpoch:this.vector(q,this.phase(q,this.epoch)),
     branches:[{ids:pair.primaryMembers,factor:-pair.massFraction},{ids:pair.secondaryMembers,factor:1-pair.massFraction}]});
   }
  }
 },
 stellarPositions(year=this.epoch+this.elapsed()){
  if(this.stellarYear===year)return this.stellarPoints;
  const points=new Map([...this.stellarReferences].map(([id,p])=>[id,[...p]]));
  for(const track of this.stellarOrbits){const v=this.vector(track.q,this.phase(track.q,year));
   for(const branch of track.branches)for(const id of branch.ids){const p=points.get(id);if(p)for(let j=0;j<3;j++)p[j]+=branch.factor*(v[j]-track.atEpoch[j]);}
  }
  this.stellarYear=year;this.stellarPoints=points;return points;
 },
 stellarCurve(track,id,factor,year=this.epoch+this.elapsed()){
  const o=ExtendedCatalog.get(id),centre=this.stellarPositions(year).get(id);if(!o||!centre||o.historicalStellarNavigation)return null;
  const q=track.q,current=this.phase(q,year),now=this.vector(q,current);
  const physicalAt=E=>{const v=this.vector(q,E);return centre.map((n,j)=>n+factor*(v[j]-now[j]));};
  return{current,radius:q.a*this.AU*Math.abs(factor),physicalAt,heightAt:E=>physicalAt(E)[2],pointAt:E=>Cosmology.project(o,this.projectSnapshot(o,physicalAt(E)))};
 },
 isOrbiting(o){return !o?.historicalStellarNavigation&&(['alpha','hyg-71453','proxima'].includes(o?.id)||!!o?.nuclearStar||this.stellarOrbits?.some(t=>t.branches.some(b=>b.ids.includes(o?.id)&&b.factor!==0)));},
 snapshot3D(o){
  if(o?.stellarSystem&&!o.historicalStellarNavigation)return this.stellarPositions().get(o.id)||o.p3;
  if(o?.nuclearStar){const bh=OBJECTS.find(q=>q.id==='sgr'),q=o.orbit,d=NuclearStars.offset(q,NuclearStars.phase(q,NuclearStars.epoch+(q.e<1?this.elapsed():0)));return bh.p3.map((v,i)=>v+d[i]);}
  return ['alpha','hyg-71453','proxima'].includes(o?.id)?this.alphaPositions3D()?.[o.id]:o?.p3;
 },
 projectSnapshot(o,p3){
  // Preserve an orbital system as one local XY frame. A nonlinear pointwise
  // projection turns ellipses into other curves and separates shared foci.
  if(globalThis.MapRadial?.active()){
   const anchor=o?.stellarSystem?this.stellarFrames.get(o.stellarSystem)?.p3:['alpha','hyg-71453','proxima'].includes(o?.id)?this.alphaAnchor:o?.kind==='planet'?[0,0,0]:null;
   if(anchor){const p=MapRadial.placement({id:'orbit-frame',kind:'star',p3:anchor}).position;return{x:p.x+p3[0]-anchor[0],y:p.y-p3[1]+anchor[1]};}
  }
  const snapshot={...o,p3,mapPosition:null,mapOffset:null};return globalThis.MapRadial?.active()?MapRadial.placement(snapshot).position:MapLayout.ordinaryProject(snapshot);
 },
 position(o){
  if(o?.stellarSystem&&!o.historicalStellarNavigation){const p3=this.stellarPositions().get(o.id);return p3?this.projectSnapshot(o,p3):null;}
  if(o?.nuclearStar&&o.orbit.e<1)return NuclearStars.map(o.orbit,NuclearStars.phase(o.orbit,NuclearStars.epoch+this.elapsed()));
  if(['alpha','hyg-71453','proxima'].includes(o?.id)){
   const p3=this.alphaPositions3D()?.[o.id];if(!p3)return null;
   return this.projectSnapshot(o,p3);
  }
  return null;
 },
 alphaCurve(id,year=this.epoch+this.elapsed()){
  const o=ExtendedCatalog.get(id),wide=id==='proxima',q=wide?this.wideReferenceOrbit():this.alphaAB;
  const current=this.phase(q,year),centre=this.alphaPositions3D(year)?.[id];if(!o||!centre)return null;
  const vector=E=>wide?this.wideAtPhase(E):this.vector(q,E),now=vector(current),scale=wide?1-.1221/(2.0428+.1221):id==='alpha'?-.9373/2.0428:1.1055/2.0428;
  const physicalAt=E=>{const v=vector(E);return centre.map((n,i)=>n+scale*(v[i]-now[i]));};
  return{current,radius:q.a*(wide?1:this.AU)*Math.abs(scale),physicalAt,heightAt:E=>physicalAt(E)[2],pointAt:E=>Cosmology.project(o,this.projectSnapshot(o,physicalAt(E)))};
 },
 alphaTrack(id,year=this.epoch+this.elapsed(),steps=360){
  const curve=this.alphaCurve(id,year);if(!curve)return{points:[],currentIndex:-1};
  const {current,pointAt}=curve;
  // Include the current phase explicitly: the moving marker lies on the same
  // projected physical curve, including radial mode and expansion.
  const phases=Array.from({length:steps+1},(_,n)=>n/steps*2*Math.PI);phases.push(current);phases.sort((a,b)=>a-b);
  const points=phases.map(E=>({...pointAt(E),phase:E}));
  return{points,currentIndex:phases.indexOf(current)};
 },
 planetPoint(q,E){
  const sun=OBJECTS.find(o=>o.id==='sol'),v=this.vector(q,E),o={id:'planet-'+q.name,kind:'planet',synthetic:true,parentObject:'sol'},p3=sun.p3.map((n,i)=>n+v[i]);
  return this.projectSnapshot(o,p3);
 },
 clipSegment(a,b,pad=2){
  const dx=b.x-a.x,dy=b.y-a.y;let lo=0,hi=1;
  for(const [p,q] of [[-dx,a.x+pad],[dx,width+pad-a.x],[-dy,a.y+pad],[dy,height+pad-a.y]]){
   if(p===0){if(q<0)return null;continue;}
   const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;
  }
  return[{x:a.x+lo*dx,y:a.y+lo*dy},{x:a.x+hi*dx,y:a.y+hi*dy}];
 },
 traceCurve(pointAt,{curvature,start=0,end=2*Math.PI,knots=[],heightAt,color='#999999',alpha=.55,lineWidth=.7,dash=[3,5]}={}){
  // curvature bounds |d²(screen position)/dE²|. The chord error is at most
  // curvature * dE² / 8, including portions whose endpoints are off screen.
  // Reject only those bounded arcs, then refine visible ones to 0.2 px.
  // Work therefore follows the visible arc, not the full orbit's pixel size.
  if(!(curvature>=0&&Number.isFinite(curvature))||!(end>start))return 0;
  const phases=Array.from({length:33},(_,n)=>start+(end-start)*n/32);
  phases.push(...knots.filter(E=>E>start&&E<end));phases.sort((a,b)=>a-b);
  let pen=null,segments=0;
  ctx.save();ctx.strokeStyle=paint(color);ctx.globalAlpha=alpha;ctx.lineWidth=lineWidth;ctx.setLineDash(dash);ctx.beginPath();
  const visit=(lo,a,hi,b)=>{
   const error=curvature*(hi-lo)**2/8;
   const slicing=heightAt&&MapSlice.mode==='slice',z1=slicing?heightAt(lo):0,z2=slicing?heightAt(hi):0,half=slicing?MapSlice.halfThicknessAt():Infinity,zmin=MapSlice.centerZ-half,zmax=MapSlice.centerZ+half,zerror=error*cam.span/width;
   if(slicing&&(Math.max(z1,z2)+zerror<zmin||Math.min(z1,z2)-zerror>zmax)){pen=null;return;}
   if(Math.max(a.x,b.x)+error < -2||Math.min(a.x,b.x)-error > width+2||Math.max(a.y,b.y)+error < -2||Math.min(a.y,b.y)-error > height+2){pen=null;return;}
   if(error>.2){const mid=(lo+hi)/2,p=screen(pointAt(mid));visit(lo,a,mid,p);visit(mid,p,hi,b);return;}
   let aa=a,bb=b;
   if(slicing){const dz=z2-z1;let l=0,h=1;if(dz===0){if(z1<zmin||z1>zmax){pen=null;return;}}else{l=Math.max(0,Math.min((zmin-z1)/dz,(zmax-z1)/dz));h=Math.min(1,Math.max((zmin-z1)/dz,(zmax-z1)/dz));if(l>h){pen=null;return;}}aa={x:a.x+(b.x-a.x)*l,y:a.y+(b.y-a.y)*l};bb={x:a.x+(b.x-a.x)*h,y:a.y+(b.y-a.y)*h};}
   const clipped=this.clipSegment(aa,bb);if(!clipped){pen=null;return;}
   const [p,q]=clipped;if(!pen||Math.hypot(p.x-pen.x,p.y-pen.y)>.001)ctx.moveTo(p.x,p.y);
   ctx.lineTo(q.x,q.y);pen=q;segments++;
  };
  let lo=phases[0],a=screen(pointAt(lo));
  for(let n=1;n<phases.length;n++){const hi=phases[n],b=screen(pointAt(hi));visit(lo,a,hi,b);lo=hi;a=b;}
  if(segments)ctx.stroke();ctx.restore();return segments;
 },
 draw(){
  const sun=OBJECTS.find(o=>o.id==='sol');
  if(cam.span<.01&&ExtendedCatalog.matchesMap(sun)&&!state.destroyed.includes('sol')){
   for(const q of this.planets){const r=q.a*this.AU*width/cam.span;if(r<2)continue;const phase=this.phase(q);this.traceCurve(E=>this.planetPoint(q,E),{curvature:r,knots:[phase],heightAt:E=>sun.p3[2]+this.vector(q,E)[2]});const v=this.vector(q,phase),p=screen(this.planetPoint(q,phase));if(!MapSlice.includes({p3:sun.p3.map((n,i)=>n+v[i])})||p.x<-20||p.x>width+20||p.y<-20||p.y>height+20)continue;circle(p.x,p.y,2.5,'#454545',1);MapLabels.point({key:'planet-'+q.name,name:q.name,detail:fmt(Math.hypot(...v)/this.AU,2)+' а.е. от Солнца',p,priority:65,opacity:1});}
  }
  if(this.alphaAnchor){
   for(const id of ['proxima','alpha','hyg-71453']){const o=ExtendedCatalog.get(id);if(!o||!ExtendedCatalog.matchesMap(o,true))continue;const curve=this.alphaCurve(id),r=curve?.radius*width/cam.span;if(!(r>=2))continue;this.traceCurve(curve.pointAt,{curvature:r,knots:[curve.current],heightAt:curve.heightAt});}
  }
  for(const track of this.stellarOrbits){
   for(const branch of track.branches){
    const id=branch.ids[0],o=ExtendedCatalog.get(id);if(!o||!ExtendedCatalog.matchesMap(o,true))continue;
    const curve=this.stellarCurve(track,id,branch.factor),r=curve?.radius*width/cam.span;
    if(!(r>=2))continue;
    this.traceCurve(curve.pointAt,{curvature:r,knots:[curve.current],heightAt:curve.heightAt,alpha:track.q.grade>=4?.35:.55});
   }
  }
 }
};
if(typeof ExtendedCatalog!=='undefined')OrbitalMotion.init();globalThis.OrbitalMotion=OrbitalMotion;
