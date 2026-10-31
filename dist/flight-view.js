'use strict';
// Only endpoint positions use the atlas embedding and orbital display motion.
// Every displayed leg, including its ship and marks, remains affine.
const FlightView={
 endpoint(o,base,moving=o){
  const motion=globalThis.OrbitalMotion?.position(moving);
  if(motion&&!moving.atlasOnly){const reference=MapLayout.baseProject(moving);base={x:base.x+(motion.x-reference.x),y:base.y+(motion.y-reference.y)};}
  return Cosmology.project(o,base);
 },
 geometryKey(){return globalThis.MapRadial?.active()?MapLayout.version+':'+MapRadial.key:MapLayout.version;},
 views:new WeakMap(),
 reference(f){
  const key=this.geometryKey(),accept=v=>v?.geometryVersion===MapLayout.version&&(v.modeKey||MapLayout.version)===key;
  if(accept(f.view))return f.view;
  const cached=this.views.get(f);
  if(cached?.key===key&&cached.original===f.view&&cached.from===f.from&&cached.aim===f.aim&&cached.target===f.target)return cached.view;
  const source=object(f.fromId),target=object(f.target),a=source&&!source.atlasOnly&&!f.detachedSource&&(f.mission?.departureOrbit||Space.distance(source,f.from)<1e-12)?MapLayout.baseProject(source):MapLayout.baseProject(f.from);
  let b=target?.atlasOnly?MapLayout.base(target.p3):MapLayout.baseProject(target);
  if(f.aim?.p3&&target?.p3)b={x:b.x+f.aim.p3[0]-target.p3[0],y:b.y-f.aim.p3[1]+target.p3[1]};
  const view={a:{...a},b:{...b},referenceEpoch:true,geometryVersion:MapLayout.version,modeKey:key};
  // Keep a saved, possibly detached endpoint in its original mode. Alternate
  // views are transient; switching back recovers its exact display position.
  if(!f.view||f.view.geometryVersion!==MapLayout.version)f.view=view;
  this.views.set(f,{key,original:f.view,from:f.from,aim:f.aim,target:f.target,view});return view;
 },
 at(f,t){
  const view=this.reference(f),source=object(f.fromId)||f.from,target=object(f.target),a=this.endpoint(source,view.a,f.detachedSource?null:source),b=this.endpoint(f.aim||target,view.b,target);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
 },
 ship(){const f=state.flight;if(f)return this.at(f,state.phase==='flyby'?1:f.covered/f.distance);const current=object(state.current);return current&&!current.atlasOnly?MapLayout.project(current):MapLayout.baseProject(state.ship);},
 fraction(f,p3){const v=(f.aim||object(f.target)).p3.map((x,i)=>x-f.from.p3[i]);return v.reduce((sum,x,i)=>sum+x*(p3[i]-f.from.p3[i]),0)/v.reduce((sum,x)=>sum+x*x,0);}
};
