// Whole-class scientific geometry audit, independent of screenshots and PCA fits.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {catalogPath} from './catalog-path.mjs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#extended-geometry');
const manifest=JSON.parse(fs.readFileSync(catalogPath('manifest.json')));
const rows=(await Promise.all(manifest.nodes.filter(n=>!n.children.length).map(n=>fs.promises.readFile(catalogPath(n.file),'utf8').then(JSON.parse)))).flat();
context.geometryRows=rows;
const summary=run(`(()=>{
 state=initial();state.expansion=false;paused=true;Cosmology.sync(state);MapSlice.mode='full';
 const records=[...OBJECTS,...geometryRows.map(r=>ExtendedCatalog.decode(r))],all=[...new Map(records.map(o=>[o.id,o])).values()];
 const byId=new Map(all.map(o=>[o.id,o]));MapLayout.resolve=id=>byId.get(id);
 const counts={},families={},missing=[],unlocated=[],spines=[];let sourceVertices=0,sourcePA=0,rigidMembers=0;
 for(const o of all){
  if(o.atlasOnly||!o.p3?.every(Number.isFinite))continue;
  if(MapGeometry.unlocated(o)){unlocated.push(o.id);assert.equal(MapGeometry.model(o),null);assert.equal(ExtendedCatalog.matchesMap(o),false);continue;}
  if(Number.isFinite(o.positionAngleDeg))sourcePA++;
  const p=MapLayout.ordinaryProject(o),d=o.mapOffset||[0,0];
  assert.ok(Math.hypot(p.x-o.p3[0]-d[0],p.y+o.p3[1]-d[1])<1e-5,o.id+' uses physical Galactic XY');
  const m=MapGeometry.model(o);if(!m){if((o.region||o.galaxy)&&!o.region?.sizeUnknown)missing.push(o.id);continue;}
  counts[m.kind]=(counts[m.kind]||0)+1;const family=MapDetails.group(o);(families[family]??={})[m.kind]=((families[family]||{})[m.kind]||0)+1;
  if(m.kind==='footprint')assert.ok(Number.isFinite(o.positionAngleDeg),'never substitute PA=0 for an unknown angle');
  if(m.kind==='sphere')assert.match(m.note,/не восстановлен/,'a size model must disclose unknown shape');
  const b=MapGeometry.indexBounds(o);
  for(const mode of ['full','radial']){const g=MapGeometry.projected(o,{mode,tolerance:1000,steps:96});assert.ok(g.bounds[0]>=b[0]-1e-4&&g.bounds[1]>=b[1]-1e-4&&g.bounds[2]<=b[2]+1e-4&&g.bounds[3]<=b[3]+1e-4,'conservative local bounds contain source geometry in every projection: '+o.id+' '+mode);}
  assert.deepEqual(MapGeometry.projected(o,{mode:'radial',tolerance:1000,steps:96}).paths,MapGeometry.projected(o,{mode:'full',tolerance:1000,steps:96}).paths,'radial translation preserves every local shape: '+o.id);
  if(m.kind==='spine'){
   const r=o.region;assert.equal(r.offsets3.length,r.points.length);spines.push(o);sourceVertices+=r.offsets3.length;
   // Compare source XY vertices and edges directly: anchor placement must
   // neither bend straight source segments nor add nonlinear subdivisions.
   const radial=MapGeometry.projected(o,{mode:'radial',tolerance:1000});
   assert.equal(radial.paths.length,r.offsets3.length-1);
   for(let i=0;i<radial.paths.length;i++)assert.equal(JSON.stringify(radial.paths[i].points),JSON.stringify(r.offsets3.slice(i,i+2).map(v=>({x:v[0],y:-v[1]}))),o.id+' preserves each source edge in its local frame');
  }
  MapGeometry.cache.delete(o);
 }
 assert.equal(missing.length,0,'every displayed extended object has a declared geometry model: '+missing.slice(0,20));
 assert.equal(spines.length,15421);assert.equal(sourceVertices,275599,'complete source vertex coverage');assert.ok(sourcePA>10000,'measured PA coverage');
 // Independent ellipse invariants of the adopted M31 disk after rotating its
 // normal into Galactic axes: no use of the renderer's angle or axis fields.
 const galaxy=byId.get('andromeda'),R=galaxy.galaxy.diameterLy/2,angle=28.28427135000061*Math.PI/180,ratio=.5007099650625793;
 for(const mode of ['full','radial']){
  const g=MapGeometry.projected(galaxy,{mode});assert.equal(g.model.kind,'disk');
  for(const p of g.points){const a=(p.x*Math.cos(angle)+p.y*Math.sin(angle))/R,b=(-p.x*Math.sin(angle)+p.y*Math.cos(angle))/(R*ratio);assert.ok(Math.abs(a*a+b*b-1)<2e-5,'M31 contour follows its physical disk normal');}
 }
 // At an extreme zoom, refine the actual curved source boundary, not the
 // straight chords of a fixed polygon. Work must follow the visible arc.
 width=1440;height=1000;
 for(const mode of ['full','radial']){MapSlice.mode=mode;const m=MapGeometry.model(galaxy),a=1.23456789,d=m.a.map((v,i)=>v*m.radius*Math.cos(a)+m.b[i]*m.radius*Math.sin(a)),c=MapLayout.baseProject(galaxy),p={x:c.x+d[0],y:c.y-d[1]};cam={...p,span:1};const g=MapGeometry.view(galaxy),q={x:p.x-c.x,y:p.y-c.y};let closest=Infinity;for(const path of g.paths)for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy||1)));closest=Math.min(closest,Math.hypot(q.x-a.x-t*dx,q.y-a.y-t*dy));}assert.ok(closest*width<.3,'deep zoom follows the physical disk boundary: '+mode);assert.ok(g.points.length<5000,'offscreen contour does not consume unbounded work');}
 MapSlice.mode='full';
 let galaxyMembers=0;
 for(const o of all.filter(o=>o.galaxyMember&&!o.atlasOnly&&o.parentGalaxy&&byId.has(o.parentGalaxy))){
  const host=byId.get(o.parentGalaxy),a=MapLayout.ordinaryProject(o),b=MapLayout.ordinaryProject(host),v=o.p3.map((n,i)=>n-host.p3[i]);
  assert.ok(Math.hypot(a.x-b.x-v[0],a.y-b.y+v[1])<1e-5,'all galaxy members retain the physical XY orientation: '+o.id);
  const radial=MapRadial.placement(o),h=MapRadial.placement(host).position;
  if(radial.parent===host.id){assert.equal(radial.frame,'rigid-xy');assert.ok(Math.hypot(radial.position.x-h.x-v[0],radial.position.y-h.y+v[1])<1e-5,'member and disk share their local XY frame');}
  galaxyMembers++;
 }
 assert.ok(galaxyMembers>10000);
 for(const o of all){const p=MapRadial.placement(o);if(p.frame!=='rigid-xy')continue;const host=MapRadial.resolve(p.parent),h=MapRadial.placement(host).position,v=o.p3.map((n,i)=>n-host.p3[i]);assert.ok(Math.hypot(p.position.x-h.x-v[0],p.position.y-h.y+v[1])<1e-5,'every admitted host component preserves its local offset: '+o.id);assert.equal(p.distanceDomain,undefined,'individual radius correction must never deform a shared object');rigidMembers++;}
 assert.ok(rigidMembers>11000);
 // An unknown optical orientation is not a measured north-up ellipse. Zero
 // is a valid measured PA and is kept distinct from missing data.
 const test={id:'geometry-optical-zero',kind:'nebula',p3:Space.fromSky(0,0,100),raDeg:0,decDeg:0,d:100,angularMajorArcmin:10,positionAngleDeg:0,region:{shape:'ellipse',major:20,minor:4}};
 const north=Space.matrix.map(r=>r[2]),east=Space.matrix.map(r=>r[1]),m=MapGeometry.model(test);assert.equal(m.kind,'footprint');for(let j=0;j<3;j++){assert.ok(Math.abs(m.a[j]-north[j])<1e-14);assert.ok(Math.abs(m.b[j]+east[j])<1e-14);}
 delete test.positionAngleDeg;assert.equal(MapGeometry.model(test).kind,'sphere');
 // A measured angular extent uses the adopted distance even when the scalar
 // size came from an older distance estimate. Repeated preparation is stable.
 for(const [major,minor,d] of [[10,4,1e6],[0.8,0.2,2e8],[100,80,2e5]]){
  const o={id:'geometry-angular-'+major,kind:'galaxy',streamed:true,p3:Space.fromSky(10,40,d),raDeg:10,decDeg:40,d,angularMajorArcmin:major,angularMinorArcmin:minor,positionAngleDeg:0,diameterLy:123,sizeUnknown:true};
  const expected=2*d*Math.tan(major*Math.PI/21600);
  for(let n=0;n<3;n++){ExtendedCatalog.prepareGalaxy(o);assert.ok(Math.abs(MapGeometry.model(o).radius-expected/2)<1e-8,'measured angular size and adopted distance stay consistent after repeated loading');}
  // Old saves contain the earlier derived galaxy object without a provenance
  // flag. Restore through the actual pin path, retaining its physical anchor.
  const saved=JSON.parse(JSON.stringify(o));saved.galaxy={id:o.id,diameterLy:123,axisRatio:.5,rotation:-.5};
  const anchor=JSON.stringify(saved.p3);ExtendedCatalog.pin(saved);
  assert.ok(Math.abs(MapGeometry.model(saved).radius-expected/2)<1e-8,'an old saved contour cannot override measured angular extent');assert.equal(JSON.stringify(saved.p3),anchor);ExtendedCatalog.pinned.delete(saved.id);
  GALAXIES.splice(GALAXIES.indexOf(o.galaxy),1);
 }
 const unknown={id:'geometry-old-unknown-size',kind:'galaxy',streamed:true,p3:[1e7,0,0],d:1e7,diameterLy:30000,sizeEstimated:true,galaxy:{id:'geometry-old-unknown-size',diameterLy:30000,axisRatio:.4}};
 ExtendedCatalog.pin(unknown);assert.equal(unknown.galaxy,undefined);assert.equal(MapGeometry.model(unknown),null,'a historical guessed diameter stays a point');ExtendedCatalog.pinned.delete(unknown.id);
 const curatedSize=galaxy.galaxy.diameterLy;ExtendedCatalog.prepareGalaxy(galaxy);assert.equal(galaxy.galaxy.diameterLy,curatedSize,'curated disk scale survives preparation');
 const sphere={id:'geometry-sphere',kind:'cluster',p3:[100,200,300],region:{shape:'ellipse',major:100,minor:100}},outline=MapGeometry.projected(sphere,{steps:256});
 assert.ok(outline.points.length>=256);for(const p of outline.points)assert.ok(Math.abs(Math.hypot(p.x,p.y)-50)<1e-8);
 // The same spherical model stays a local circle at the radial pole,
 // near the pole and in the map plane. Anchor translation cannot create holes.
 for(const p3 of [[0,0,80],[5,3,80],[120,40,70],[0,0,0]]){
  const pole={id:'geometry-polar-sphere-'+p3,kind:'void',p3,region:{major:60,minor:60}},circle=MapGeometry.projected(pole,{mode:'radial',steps:512});
  assert.equal(circle.paths.length,1);assert.ok(!circle.paths[0].hole);
  for(const p of circle.points)assert.ok(Math.abs(Math.hypot(p.x,p.y)-30)<1e-10,'isotropic size model retains its circle at any anchor');
  MapSlice.mode='radial';cam={...MapRadial.placement(pole).position,span:120};assert.ok(MapGeometry.contains(pole,MapRadial.placement(pole).position),'sphere includes its translated centre');
 }
 MapSlice.mode='full';
 // Independently sample a physical ball. Its projected points must fit the
 // analytic envelope, including near-pole geometry.
 for(const position of [[120,40,70],[5,3,80],[0,0,0]]){
  const o={id:'geometry-ball-'+position,kind:'void',p3:position,region:{major:60,minor:60}},g=MapGeometry.projected(o,{steps:2048});
  for(let i=0;i<80;i++)for(let j=0;j<40;j++){const a=i/80*2*Math.PI,z=-30+j/39*60,r=Math.sqrt(Math.max(0,900-z*z)),v=[position[0]+r*Math.cos(a),position[1]+r*Math.sin(a),position[2]+z];const p={x:v[0]-position[0],y:position[1]-v[1]};assert.ok(p.x>=g.bounds[0]-.02&&p.x<=g.bounds[2]+.02&&p.y>=g.bounds[1]-.02&&p.y<=g.bounds[3]+.02,'local sphere bounds cover independently sampled physical points');}
 }
 // A known 3D spine keeps every source segment with its exact endpoints.
 const line={id:'geometry-spine-line',kind:'structure',p3:[1e9,0,0],region:{shape:'polyline',major:100,minor:100,points:[[0,0],[10,0],[20,0]],offsets3:[[0,0,-10],[10,0,10],[20,0,-10]]}};
 const segments=MapGeometry.projected(line);assert.equal(segments.paths.length,2);
 assert.deepEqual(segments.paths.map(p=>p.points.map(q=>q.x)),[[0,10],[10,20]]);
 // All 40 source orbits and all phases retain true 3D radii, source sky axes,
 // common physical foci and an unchanged navigation reference.
 let orbitSamples=0;
 const original=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3]));
 for(const q of NuclearStars.rows)for(const E of [0,.5,1.7]){
  const physical=NuclearStars.offset(q,E),local=NuclearStars.local(q,E);assert.ok(Math.abs(Math.hypot(...physical)-Math.hypot(...local))<1e-12);
  for(const mode of ['full','radial']){MapSlice.mode=mode;const c=mode==='radial'?MapRadial.placement(byId.get('sgr')).position:MapLayout.ordinaryProject(byId.get('sgr')),p=NuclearStars.map(q,E);assert.ok(Math.hypot(p.x-c.x-physical[0],p.y-c.y+physical[1])<1e-10,'nuclear orbit uses the documented local Galactic XY frame');orbitSamples++;}
 }
 for(const q of OrbitalMotion.planets)for(const E of [0,.5,2]){const v=OrbitalMotion.vector(q,E),expected=q.a*(1-q.e*Math.cos(E))*OrbitalMotion.AU;assert.ok(Math.abs(Math.hypot(...v)-expected)<1e-12,'JPL ecliptic to Galactic rotation preserves planet distance');orbitSamples++;}
 assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3])),original);
 // Catalog associations without orbital elements are links, never ellipses.
 let fakeEllipses=0;const ellipse=ctx.ellipse;ctx.ellipse=()=>fakeEllipses++;ExtendedCatalog.drawSystems();ctx.ellipse=ellipse;assert.equal(fakeEllipses,0);
 return{catalogRevision:EXTENDED_BOOT.revision,geometryVersion:MapLayout.version,shapeGeometryVersion:MapGeometry.version,radialProfile:MapRadial.key,mappedRows:geometryRows.length,models:counts,families,measuredPositionAngles:sourcePA,filaments:spines.length,sourceSpineVertices:sourceVertices,galaxyMembersChecked:galaxyMembers,rigidMembersChecked:rigidMembers,orbitalSamples:orbitSamples,unlocatedWithoutMeasuredContours:unlocated,missingGeometry:missing};
})()`);
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(summary,null,2)+'\n');
console.log('PASS source geometry and projection audit:',JSON.stringify(summary));
