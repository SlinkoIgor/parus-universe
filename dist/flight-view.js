'use strict';
// Only endpoint positions use the atlas embedding and orbital display motion.
// Every displayed leg, including its ship and marks, remains affine.
const FlightView={
 endpoint(o,base,moving=o){
  const motion=globalThis.OrbitalMotion?.position(moving);
  if(motion&&!moving.atlasOnly){const reference=MapLayout.baseProject(moving);base={x:base.x+(motion.x-reference.x),y:base.y+(motion.y-reference.y)};}
  return Cosmology.project(o,base);
 },
 at(f,t){
  if(!f.view||f.view.geometryVersion!==MapLayout.version){const source=object(f.fromId),target=object(f.target),a=source&&!source.atlasOnly&&!f.detachedSource&&(f.mission?.departureOrbit||Space.distance(source,f.from)<1e-12)?MapLayout.baseProject(source):MapLayout.baseProject(f.from);let b=target?.atlasOnly?MapLayout.base(target.p3):MapLayout.baseProject(target);if(f.aim?.p3&&target?.p3)b={x:b.x+f.aim.p3[0]-target.p3[0],y:b.y-f.aim.p3[1]+target.p3[1]};f.view={a:{...a},b:{...b},referenceEpoch:true,geometryVersion:MapLayout.version};}
  const source=object(f.fromId)||f.from,target=object(f.target),a=this.endpoint(source,f.view.a,f.detachedSource?null:source),b=this.endpoint(f.aim||target,f.view.b,target);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
 },
 ship(){const f=state.flight;if(f)return this.at(f,state.phase==='flyby'?1:f.covered/f.distance);const current=object(state.current);return current&&!current.atlasOnly?MapLayout.project(current):MapLayout.baseProject(state.ship);},
 fraction(f,p3){const v=(f.aim||object(f.target)).p3.map((x,i)=>x-f.from.p3[i]);return v.reduce((sum,x,i)=>sum+x*(p3[i]-f.from.p3[i]),0)/v.reduce((sum,x)=>sum+x*x,0);}
};
