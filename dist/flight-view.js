'use strict';
// Only endpoint positions use the atlas embedding. Every displayed leg is affine.
const FlightView={
 at(f,t){
  if(!f.view||!f.view.referenceEpoch){const source=object(f.fromId),a=source&&Space.distance(source,f.from)<1e-12?MapLayout.baseProject(source):MapLayout.baseProject(f.from),b=MapLayout.baseProject(f.aim||object(f.target));f.view={a:{...a},b:{...b},referenceEpoch:true};}
  const a=Cosmology.project(object(f.fromId)||f.from,f.view.a),b=Cosmology.project(f.aim||object(f.target),f.view.b);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
 },
 ship(){const f=state.flight;if(f)return this.at(f,state.phase==='flyby'?1:f.covered/f.distance);return MapLayout.project(object(state.current)||state.ship);},
 fraction(f,p3){const v=(f.aim||object(f.target)).p3.map((x,i)=>x-f.from.p3[i]);return v.reduce((sum,x,i)=>sum+x*(p3[i]-f.from.p3[i]),0)/v.reduce((sum,x)=>sum+x*x,0);}
};
