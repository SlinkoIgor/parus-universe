import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#orbit-paths');
context.orbitRadialManifest=JSON.parse(fs.readFileSync('dist/'+JSON.parse(fs.readFileSync('dist/map-radial/current.json')).dataRoot+'/manifest.json'));
run(`
resize();state=initial();state.expansion=false;paused=true;Cosmology.sync(state);MapRadial.manifest=orbitRadialManifest;
const paths=[],originalCanvas={};let cursor=null;
for(const name of ['beginPath','moveTo','lineTo','stroke'])originalCanvas[name]=ctx[name];
ctx.beginPath=()=>{cursor=null;};ctx.moveTo=(x,y)=>{cursor={x,y};};
ctx.lineTo=(x,y)=>{const end={x,y};if(cursor)paths.push([cursor,end]);cursor=end;};ctx.stroke=()=>{};
function renderOrbitPaths(fn){paths.length=0;fn();return paths.slice();}
function pointSegment(p,[a,b]){const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function covered(p,segments,tolerance=.26){return segments.some(s=>pointSegment(p,s)<=tolerance);}
function bounded(segments){assert.ok(segments.length,'visible orbit must have a stroke');for(const s of segments)for(const p of s)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-2.001&&p.x<=width+2.001&&p.y>=-2.001&&p.y<=height+2.001,'clip huge coordinates before canvas');}
const fixed=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3]));
let nuclearCases=0,alphaCases=0;
for(const years of [0,5,120])for(const mode of ['full','radial']){
 state.universeElapsed=years;MapSlice.setMode(mode);state.selected='sol';
 for(const span of [.08,.002,.00006])for(const q of NuclearStars.rows){
  const o=object(q.id),p=MapLayout.project(o);cam={...p,span};
  const cohort=NuclearStars.rows;NuclearStars.rows=[q];let segments;try{segments=renderOrbitPaths(()=>NuclearStars.draw());}finally{NuclearStars.rows=cohort;}bounded(segments);
  assert.ok(covered(screen(o),segments),q.id+' visible marker needs an orbit at '+span+' / '+mode+' / '+years);nuclearCases++;
 }
 for(const id of ['alpha','hyg-71453','proxima'])for(const span of [id==='proxima'?.5:.001,.00006]){
  const o=object(id),p=MapLayout.project(o);cam={...p,span};
  const segments=renderOrbitPaths(()=>OrbitalMotion.draw());bounded(segments);
  assert.ok(covered(screen(o),segments),id+' marker needs its orbit at '+span+' / '+mode+' / '+years);alphaCases++;
 }
}
// The common system frame must retain the wide orbit from every component.
for(const years of [0,40,200000])for(const mode of ['full','radial']){
 state.universeElapsed=years;MapSlice.setMode(mode);
 const ids=['alpha','hyg-71453','proxima'],members=ids.map(id=>object(id));
 focusRelatedSystem(members);cam={...cameraGoal};cameraGoal=null;
 const segments=renderOrbitPaths(()=>OrbitalMotion.draw());bounded(segments);
 assert.ok(covered(screen(object('proxima')),segments),'C has a visible orbit after the common system action');
}
// Render only this known orbit: the ordinary unselected path must survive
// both old upper bounds, and a focus far outside the viewport.
MapSlice.setMode('full');state.universeElapsed=0;state.selected='sol';
const s2=object('s2'),q=s2.orbit,phase=NuclearStars.phase(q,NuclearStars.epoch),marker=MapLayout.project(s2);
cam={...marker,span:.00006};const focus=screen(object('sgr'));
assert.ok(focus.x<-width||focus.x>2*width||focus.y<-height||focus.y>2*height,'exercise off-screen focus');
assert.ok(Math.abs(q.a)*NuclearStars.distancePc/63241.077*width/cam.span>20000,'exercise former 20000 px cutoff');
const allNuclearRows=NuclearStars.rows;NuclearStars.rows=[q];
const single=renderOrbitPaths(()=>NuclearStars.draw());NuclearStars.rows=allNuclearRows;bounded(single);
assert.ok(covered(screen(s2),single));
for(let n=-100;n<=100;n++){
 const p=screen(NuclearStars.map(q,phase+n*.0001));
 if(p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height)assert.ok(covered(p,single),'curved visible arc stays within subpixel error');
}
const wideNuclear=object('s85');cam={...MapLayout.project(wideNuclear),span:120};NuclearStars.rows=[wideNuclear.orbit];
const wideSegments=renderOrbitPaths(()=>NuclearStars.draw());NuclearStars.rows=allNuclearRows;
assert.ok(covered(screen(wideNuclear),wideSegments),'wide nuclear orbit remains drawable above an arbitrary world-span threshold');
// All coarse endpoints can be outside while the actual curved arc is inside.
// Use a near-tangent view of a huge circle, away from any uniform sample.
cam={x:0,y:0,span:width};const E0=.123456,radius=1e7;
const curve=E=>world(width*.5+radius*(Math.cos(E)-Math.cos(E0)),height*.5+radius*(Math.sin(E)-Math.sin(E0)));
let samples=0;const tangent=renderOrbitPaths(()=>OrbitalMotion.traceCurve(E=>{samples++;return curve(E);},{curvature:radius}));bounded(tangent);
assert.ok(covered(screen(curve(E0)),tangent),'arc between coarse samples cannot disappear');
for(let n=-40;n<=40;n++){
 const p=screen(curve(E0+n*.000001));
 if(p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height)assert.ok(covered(p,tangent),'adaptive error bound');
}
assert.ok(samples<1000,'offscreen portions must be culled before fine sampling: '+samples);
const invisible=renderOrbitPaths(()=>OrbitalMotion.traceCurve(E=>world(-1e8+100*Math.cos(E),-1e8+100*Math.sin(E)),{curvature:100}));assert.equal(invisible.length,0);
// Planet markers use the same path renderer and phase knots.
for(const planet of OrbitalMotion.planets){
 const p=OrbitalMotion.planetPoint(planet,OrbitalMotion.phase(planet));cam={...p,span:.00006};
 const segments=renderOrbitPaths(()=>OrbitalMotion.draw());assert.ok(covered(screen(p),segments),planet.name);
}
cam={x:0,y:0,span:200};assert.equal(renderOrbitPaths(()=>OrbitalMotion.draw()).length,0,'subpixel orbital systems remain hidden');
assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3])),fixed,'drawing never changes physical catalogue coordinates');
for(const [name,fn] of Object.entries(originalCanvas))ctx[name]=fn;
console.log('PASS '+nuclearCases+' nuclear-star and '+alphaCases+' binary/triple orbit views: all map modes, epochs, offscreen foci, deep zoom, clipped subpixel curves, hyperbola, planets and bounded sampling');
`);
