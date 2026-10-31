import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#system-coordinates');
context.radialManifest=JSON.parse(fs.readFileSync('dist/'+JSON.parse(fs.readFileSync('dist/map-radial/current.json')).dataRoot+'/manifest.json'));
run(`
state=initial();state.expansion=false;paused=true;Cosmology.sync(state);
MapRadial.manifest=radialManifest;
const ids=['alpha','hyg-71453','proxima'],fixed=ids.map(id=>JSON.stringify(object(id).p3));
const a=object('alpha'),b=object('hyg-71453'),c=object('proxima'),au=63241.077;
assert.ok(Space.distance(a,b)*au>11&&Space.distance(a,b)*au<36,'physical AB orbit, not 3104 AU mixed distances');
assert.ok(Space.distance(a,c)*au>12000&&Space.distance(a,c)*au<14000,'measured wide separation');
assert.equal(a.coordinateModel,'alpha-joint-v1');assert.equal(b.coordinateModel,a.coordinateModel);assert.equal(c.coordinateModel,a.coordinateModel);
assert.equal(a.coordinateEpoch,b.coordinateEpoch);assert.equal(b.coordinateEpoch,c.coordinateEpoch);
assert.ok(a.catalogAstrometry.hyg.distancePc&&b.catalogAstrometry.hyg.distancePc&&c.catalogAstrometry.hyg.distancePc);
for(const id of ['barnard','lalande','sirius','ross','epsilon','tau','procyon','vega']){
 const o=object(id);assert.equal(o.uncertaintyMatched,false,id+' must not borrow a different distance solution sigma');assert.equal(o.distanceRelativeError,null);
}
for(const years of [0,1,40]){
 state.universeElapsed=years;
 const physical=OrbitalMotion.alphaPositions3D();
 for(const mode of ['full','slice','radial']){
  MapSlice.setMode(mode);
  const p=ids.map(id=>MapLayout.project(object(id)));
  for(let i=0;i<ids.length;i++){
   assert.equal(JSON.stringify(object(ids[i]).p3),fixed[i],'projection preserves navigation reference');
   if(mode==='radial')assert.ok(Math.abs(Math.hypot(p[i].x,p[i].y)-Math.hypot(...physical[ids[i]]))<1e-11,'same 3D epoch in radial');
   else assert.deepEqual(p[i],MapLayout.base(physical[ids[i]]),'same 3D epoch in ordinary/slice');
  }
  const ab=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)*au,ac=Math.hypot(p[0].x-p[2].x,p[0].y-p[2].y)*au;
  assert.ok(ab<40&&ac>10000,'AB remains a close pair in '+mode);
 }
}
// Orbit strokes use exactly the same physical samples and projection as
// moving markers; cover C as well as AB, all modes and widely separated phases.
for(const years of [0,40,200000]){
 state.universeElapsed=years;
 for(const mode of ['full','slice','radial']){
  MapSlice.setMode(mode);
  for(const id of ids){const track=OrbitalMotion.alphaTrack(id),p=track.points[track.currentIndex],marker=MapLayout.project(object(id));assert.ok(Math.hypot(p.x-marker.x,p.y-marker.y)<1e-11,id+' marker on drawn orbit in '+mode);const first=track.points[0],last=track.points.at(-1);assert.ok(Math.hypot(first.x-last.x,first.y-last.y)<1e-11,'closed physical orbit');}
 }
}
state.universeElapsed=0;MapSlice.setMode('radial');globalThis.savedTrace=OrbitalMotion.trace;globalThis.drawnTracks=[];OrbitalMotion.trace=points=>drawnTracks.push(points);cam={...MapLayout.project(c),span:24};OrbitalMotion.draw();assert.equal(drawnTracks.length,1,'C orbit is drawn even at the standard system focus, not hidden by a zoom threshold');const cp=MapLayout.project(c);assert.ok(drawnTracks[0].some(p=>Math.hypot(p.x-cp.x,p.y-cp.y)<1e-11));OrbitalMotion.trace=savedTrace;
// The same radial rule applies to nuclear-star and planetary motion/paths.
const sgr=object('sgr'),centre=MapLayout.project(sgr),s2=object('s2'),np=MapLayout.project(s2),delta=NuclearStars.offset(s2.orbit,NuclearStars.phase(s2.orbit,NuclearStars.epoch));assert.ok(Math.abs(Math.hypot(np.x-centre.x,np.y-centre.y)-Math.hypot(...delta))<1e-9);
for(const planet of OrbitalMotion.planets){const E=OrbitalMotion.phase(planet),p=OrbitalMotion.planetPoint(planet,E);assert.ok(Math.abs(Math.hypot(p.x,p.y)-Math.hypot(...OrbitalMotion.vector(planet,E)))<1e-12);}
MapSlice.setMode('full');
// The outer state-vector orbit must reproduce the published measured relative
// XYZ and UVW, rather than interpreting its angles in an assumed sky plane.
const ref=OrbitalMotion.referenceAstrometry(),q=ref.entries,epoch=ref.astrometryEpoch,k=31557600/9460730472580.8;
const v=q.proxima.velocity.map((x,i)=>(x-q.ab.velocity[i])*k),r=q.proxima.p3.map((x,i)=>x-q.ab.p3[i]-v[i]*(ref.epoch-epoch));
const orbit=OrbitalMotion.wideVector(epoch),future=OrbitalMotion.wideVector(epoch+.01),past=OrbitalMotion.wideVector(epoch-.01);
assert.ok(Math.hypot(...orbit.map((x,i)=>x-r[i]))<1e-12);
assert.ok(Math.hypot(...future.map((x,i)=>(x-past[i])/.02-v[i]))<1e-11);
assert.ok(OrbitalMotion.wideReferenceOrbit().period>500000&&OrbitalMotion.wideReferenceOrbit().period<600000);
// Fresh authoritative rows override saved coordinates for streamed and core
// components; a parked ship follows its corrected object. Historical flight
// endpoints/progress remain frozen when catalogue measurements are revised.
state=initial();state.current='hyg-71453';state.selected='proxima';state.visited.push('hyg-71453');
const stale={...b,p3:[3,-3,.5],d:4.8,catalogRevision:'old',mapPosition:{x:3,y:3}};
state.catalogObjects=[stale];state.catalogRevision='old';state.catalogGeometry=MapLayout.version;state.ship=Space.point(stale.p3);
state=restore(JSON.parse(JSON.stringify(state)));
assert.deepEqual(object('hyg-71453').p3,b.p3);assert.deepEqual(state.ship.p3,b.p3);
state=initial();state.current='alpha';state.catalogRevision='old';state.catalogGeometry=MapLayout.version;state.ship=Space.point([9,9,9]);
state=restore(JSON.parse(JSON.stringify(state)));assert.deepEqual(state.ship.p3,a.p3);
state=initial();state.selected='alpha';MissionPlanner.launch();assert.ok(state.flight);
state.catalogRevision='old';const before=JSON.stringify({from:state.flight.from,aim:state.flight.aim,distance:state.flight.distance,covered:state.flight.covered,ship:state.ship,history:state.flightHistory});
state=restore(JSON.parse(JSON.stringify(state)));
assert.equal(JSON.stringify({from:state.flight.from,aim:state.flight.aim,distance:state.flight.distance,covered:state.flight.covered,ship:state.ship,history:state.flightHistory}),before);
`);
console.log('PASS sourced joint Alpha XYZ, close AB in all modes/epochs, visible projected C/AB orbits, nuclear/planet radial motion, measured outer state, uncertainty provenance and stale-save migration with frozen flights');
execFileSync(process.execPath,['data-tools/audit-system-coordinates.mjs','/tmp/parus-system-coordinates-regression','--check'],{stdio:['ignore','pipe','pipe']});
console.log('PASS full catalogue system audit: orbital bound and matching astrometric uncertainty solutions');
