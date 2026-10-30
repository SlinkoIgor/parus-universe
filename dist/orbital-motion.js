'use strict';
// Kinematic Kepler models in Galactic XY, driven by observer time. Catalog p3
// and frozen flight endpoints remain the navigation reference; no interception
// or N-body integration is claimed. Sources and precision: docs/physics.md.
const OrbitalMotion={
 sources:{planets:'https://ssd.jpl.nasa.gov/planets/approx_pos.html',alphaAB:'https://arxiv.org/abs/1610.06079',alphaC:'https://arxiv.org/abs/1611.03495'},
 epoch:2026.81,AU:1/63241.077,alphaAnchor:null,
 alphaAB:{a:17.592/.74717,e:.5208,i:79.320,node:205.064,omega:232.006,period:79.929,peri:1955.604,uncertainty:{aArcsec:.013,e:.0011,iDeg:.011,nodeDeg:.033,omegaDeg:.051,periodYears:.013,periYear:.013}},
 alphaC:{a:8700,e:.50,i:107.6,node:126,omega:72.3,period:547000,peri:2016+283000,uncertainty:{aAu:[-400,700],e:[-.09,.08],periodYears:[-40000,66000],iDeg:[-2,1.8],nodeDeg:[-5,5],omegaDeg:[-6.6,8.7],periYears:[-41000,59000]}},
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
  else{const east=u*Math.sin(O)+v*Math.cos(O)*Math.cos(i),north=u*Math.cos(O)-v*Math.sin(O)*Math.cos(i),depth=v*Math.sin(i),ra=219.90258*rad,dec=-60.833*rad;icrs=[-Math.sin(ra)*east-Math.sin(dec)*Math.cos(ra)*north+Math.cos(dec)*Math.cos(ra)*depth,Math.cos(ra)*east-Math.sin(dec)*Math.sin(ra)*north+Math.cos(dec)*Math.sin(ra)*depth,Math.cos(dec)*north+Math.sin(dec)*depth];}
  return Space.matrix.map(row=>row.reduce((sum,n,j)=>sum+n*icrs[j],0)*this.AU);
 },
 init(){const a=OBJECTS.find(o=>o.id==='alpha'),b=ExtendedCatalog.get('hyg-71453'),c=OBJECTS.find(o=>o.id==='proxima');if(!a||!b||!c)return;const mA=1.1055,mB=.9373,mC=.1221,total=mA+mB+mC;this.alphaAnchor=a.p3.map((n,j)=>(mA*n+mB*b.p3[j]+mC*c.p3[j])/total);},
 alphaPositions(year=this.epoch+this.elapsed()){
  if(!this.alphaAnchor)return null;
  const ab=this.vector(this.alphaAB,this.phase(this.alphaAB,year)),outer=this.vector(this.alphaC,this.phase(this.alphaC,year)),fC=.1221/(2.0428+.1221),origin=this.alphaAnchor;
  const point=(inner,wide)=>MapLayout.base(origin.map((n,j)=>n+inner*ab[j]+wide*outer[j]));
  return{alpha:point(-.9373/2.0428,-fC),'hyg-71453':point(1.1055/2.0428,-fC),proxima:point(0,1-fC),ab:point(0,-fC)};
 },
 position(o){
  if(o?.nuclearStar&&o.orbit.e<1)return NuclearStars.map(o.orbit,NuclearStars.phase(o.orbit,NuclearStars.epoch+this.elapsed()));
  if(['alpha','hyg-71453','proxima'].includes(o?.id))return this.alphaPositions()?.[o.id]||null;
  return null;
 },
 path(q,anchor,scale=1){
  const radius=q.a*this.AU*width/cam.span*Math.abs(scale);if(radius<2||radius>20000)return;
  ctx.save();ctx.strokeStyle=paint('#999999');ctx.globalAlpha=.55;ctx.lineWidth=.7;ctx.setLineDash([3,5]);ctx.beginPath();
  for(let n=0;n<=240;n++){const v=this.vector(q,n/240*2*Math.PI),p=screen({x:anchor.x+v[0]*scale,y:anchor.y-v[1]*scale});n?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.stroke();ctx.restore();
 },
 draw(){
  const sun=OBJECTS.find(o=>o.id==='sol');
  if(cam.span<.01&&ExtendedCatalog.matchesMap(sun)&&!state.destroyed.includes('sol')){
   const anchor=MapLayout.baseProject(sun);for(const q of this.planets){const r=q.a*this.AU*width/cam.span;if(r<2||r>20000)continue;this.path(q,anchor);const v=this.vector(q,this.phase(q)),p=screen({x:anchor.x+v[0],y:anchor.y-v[1]});if(p.x<-20||p.x>width+20||p.y<-20||p.y>height+20)continue;circle(p.x,p.y,2.5,'#454545',1);MapLabels.point({key:'planet-'+q.name,name:q.name,detail:fmt(Math.hypot(...v)/this.AU,2)+' а.е. от Солнца',p,priority:65,opacity:1});}
  }
  if(cam.span<1&&this.alphaAnchor){const positions=this.alphaPositions(),a=OBJECTS.find(o=>o.id==='alpha');if(ExtendedCatalog.matchesMap(a)){const fC=.1221/(2.0428+.1221);this.path(this.alphaC,MapLayout.base(this.alphaAnchor),1-fC);this.path(this.alphaAB,positions.ab,-.9373/2.0428);this.path(this.alphaAB,positions.ab,1.1055/2.0428);}}
 }
};
OrbitalMotion.init();globalThis.OrbitalMotion=OrbitalMotion;
