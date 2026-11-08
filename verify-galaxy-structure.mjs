import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#galaxy-structure');
run(`{
state=initial();state.expansion=false;paused=true;Cosmology.sync(state);filter='all';resize();
const science=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.galaxy,o.region,o.navigable])),flight=JSON.stringify(state);
const examples=['milkyway','andromeda','triangulum','centaurus','lmc','smc'];
for(const id of examples){
 const o=object(id),full=GalaxyStructure.projected(o,{mode:'full',tolerance:1});
 assert.ok(full.length>=4,'restored internal structure: '+id);
 assert.equal(full.length,id==='milkyway'?6:o.galaxy.shape==='spiral'?4:o.galaxy.shape==='elliptical'?7:4);
 const bounds=MapGeometry.indexBounds(o);
 for(const path of full)for(const p of path.points){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=bounds[0]-1e-6&&p.x<=bounds[2]+1e-6&&p.y>=bounds[1]-1e-6&&p.y<=bounds[3]+1e-6,'decoration fits the current physical envelope: '+id);}
 assert.deepEqual(GalaxyStructure.projected(o,{mode:'radial',tolerance:1}),full,'radial mode translates the whole object without deforming its arms');
 const cut=GalaxyStructure.projected(o,{mode:'slice',centerZ:o.p3[2]+1e8,halfThickness:1,tolerance:1});assert.equal(cut.length,0,'no phantom arms outside the physical slice');
}
// M31 has a known tilted disk. Independently recover the local XYZ plane from
// every clipped stroke: neither edges nor the hidden far half may bridge it.
const o=object('andromeda'),m=MapGeometry.model(o),half=1000,centerZ=o.p3[2]+5000;
const clipped=GalaxyStructure.projected(o,{mode:'slice',centerZ,halfThickness:half,tolerance:1});assert.ok(clipped.length);
const determinant=m.a[0]*m.b[1]-m.a[1]*m.b[0];
for(const path of clipped){assert.equal(path.closed,false);for(const p of path.points){const u=(p.x*m.b[1]+p.y*m.b[0])/determinant,v=(-p.y*m.a[0]-p.x*m.a[1])/determinant,z=o.p3[2]+u*m.a[2]+v*m.b[2];assert.ok(z>=centerZ-half-1e-6&&z<=centerZ+half+1e-6,'stroke obeys the actual slab');}}
// Following a tiny section of an arm must not tessellate the entire galaxy
// to subpixel precision. Verify error against the analytic curve at this zoom.
for(const id of ['milkyway','andromeda']){
 const o=object(id),m=MapGeometry.model(o),at=t=>{const r=.1+t*.9,a=t*5,v=m.a.map((n,i)=>n*Math.cos(a)*r*m.radius+m.b[i]*Math.sin(a)*r*m.radius);return{x:v[0],y:-v[1]};},center=at(.42);
 for(const span of [1,.001]){
  const scale=1440/span,viewport=[center.x-span/2,center.y-span/2,center.x+span/2,center.y+span/2],paths=GalaxyStructure.projected(o,{mode:'full',tolerance:.2/scale,viewport});
  assert.ok(paths.reduce((n,p)=>n+p.points.length,0)<1000,'deep zoom work follows the visible arc');
  let distance=Infinity;
  for(const path of paths)for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((center.x-a.x)*dx+(center.y-a.y)*dy)/(dx*dx+dy*dy||1)));distance=Math.min(distance,Math.hypot(center.x-a.x-t*dx,center.y-a.y-t*dy));}
  assert.ok(distance*scale<.21,'a real arm remains curved and aligned at extreme magnification');
 }
}
// Exercise the actual canvas entry point and filtering, at desktop/mobile
// scales and in both themes. Decoration never joins the selectable outlines.
const original=GalaxyStructure.draw;let calls=[];GalaxyStructure.draw=function(body,...args){calls.push(body.id);return original.call(this,body,...args);};
for(const viewport of [390,1440])for(const palette of ['dark','light'])for(const mode of ['full','slice','radial'])for(const id of examples){
 width=viewport;height=viewport===390?844:1000;applyTheme(palette);MapSlice.mode=mode;const o=object(id);MapSlice.centerZ=o.p3[2];cam={...MapLayout.project(o),span:o.galaxy.diameterLy*2};MapLabels.begin();calls=[];drawGalaxyBackground();assert.ok(calls.includes(id),'real canvas draws restored structure: '+[id,viewport,palette,mode]);assert.equal(MapLabels.contours.filter(q=>q.id===id).length,1,'only the original envelope is selectable');
}
const matches=ExtendedCatalog.matchesMap;ExtendedCatalog.matchesMap=()=>false;MapLabels.begin();calls=[];drawGalaxyBackground();assert.equal(calls.length,0,'hidden galaxies cannot leave arms behind');ExtendedCatalog.matchesMap=matches;
GalaxyStructure.draw=original;
assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.galaxy,o.region,o.navigable])),science);assert.equal(JSON.stringify(state),flight,'rendering preserves flight and save data');
console.log('PASS restored spiral/elliptical/irregular galaxy structure, current XY frames, real tilted slices, radial translations, canvas in both themes and widths, filters, unchanged picking and physical data');
}`);
