import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#area-labels');
run(['map-visibility-data','map-visibility','map-label-data','map-annotations','universe-map'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
run(`{
state=initial();state.expansion=false;paused=true;filter='all';Cosmology.sync(state);MapLayers.active=false;
const science=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.region,o.navigable])),physical=JSON.stringify([state.ship,state.earth,state.proper,state.matter,state.flight]);
const originalText=text;let ink=[];text=(name,x,y,size,color,align,font)=>{ink.push({name,x,y,size,color,alpha:ctx.globalAlpha});};
const originalLeader=MapLabels.leader;let leaderCalls=0;MapLabels.leader=function(...args){leaderCalls++;return originalLeader.apply(this,args);};
for(const viewport of [390,900,1440])for(const mode of ['full','radial'])for(const palette of ['dark','light','blueprint']){
 width=viewport;height=viewport===390?562:855;MapSlice.mode=mode;applyTheme(palette);cam=UniverseMap.overview();cameraGoal=null;hover=null;
 MapLabels.begin();ink=[];UniverseMap.draw();const geometry=UniverseMap.geometry(),boxes=JSON.stringify(UniverseMap.labels.map(l=>l.box)),base=ink.slice();
 assert.equal(UniverseMap.labels.length,4);
 for(const l of UniverseMap.labels){
  assert.ok(l.leader,'every epoch has a visible pointer: '+l.q.id+' / '+viewport);
  const radius=Math.hypot(l.leader.to.x-geometry.x,l.leader.to.y-geometry.y)/geometry.k;
  assert.ok(radius>l.q.r0&&(!l.q.r1||radius<l.q.r1),'pointer must end in its own band, including CMB');
  hover=l.q;ink=[];UniverseMap.draw();
  const name=l.q.name.toLocaleUpperCase('ru'),normal=base.find(q=>q.name===name)||base[6],active=ink.find(q=>q.name===normal.name);
  assert.equal(active.alpha,1);assert.equal(active.color,'#171717');assert.ok(active.alpha>normal.alpha);
  assert.equal(JSON.stringify(UniverseMap.labels.map(l=>l.box)),boxes,'hover cannot move labels');
 }
}
// The galaxy's interior can be hovered, and the admitted name stays fixed.
width=1440;height=1000;applyTheme('dark');const galaxy=object('andromeda');
for(const mode of ['full','radial']){
 MapSlice.mode=mode;cam={...MapLayout.project(galaxy),span:5e5};hover=null;
 const draw=()=>{leaderCalls=0;MapLabels.begin();drawGalaxyBackground();RegionMap.draw();MapAnnotations.draw();assert.equal(leaderCalls,0,'ordinary areas must not have label pointers');};
 ink=[];draw();const hit=MapAnnotations.hits.find(h=>h.object.id===galaxy.id);assert.ok(hit,'galaxy caption is admitted in '+mode);
 const before=JSON.stringify(MapLabels.placed),normal=ink.find(q=>q.name===MapDetails.mapLabelName(galaxy));assert.ok(normal);
 const shape=MapLabels.geometry().get(galaxy.id);assert.ok(shape?.closed);
 const center=screen(galaxy),inside=shape.points.map(p=>({x:(p.x+center.x)/2,y:(p.y+center.y)/2})).find(p=>MapLabels.areaHit(p.x,p.y)?.id===galaxy.id);
 assert.ok(inside,'galaxy interior has a target');hover=MapLabels.areaHit(inside.x,inside.y);ink=[];draw();
 const active=ink.find(q=>q.name===normal.name);assert.equal(active.alpha,1);assert.equal(active.color,'#171717');assert.equal(JSON.stringify(MapLabels.placed),before);
}
// Zoomed-in galaxies cannot turn an empty stellar view into a galaxy target.
// Exercise the real Alpha Cen/Milky Way geometry and two other host galaxies.
RegionMap.hits=[];
for(const viewport of [390,1440])for(const mode of ['full','radial'])for(const palette of ['dark','light'])for(const id of ['alpha','andromeda','triangulum'])for(const span of [.001,1,24]){
 width=viewport;height=viewport===390?562:1000;MapSlice.mode=mode;applyTheme(palette);cam={...MapLayout.project(object(id)),span};hover=null;
 MapLabels.begin();drawGalaxyBackground();
 assert.ok(MapLabels.contours.length,'real host outline surrounds the close view: '+id);
 for(const [x,y] of [[.25,.25],[.5,.5],[.75,.75]])assert.equal(MapLabels.areaHit(width*x,height*y),null,'invisible host cannot capture empty space: '+[id,span,mode,viewport,palette]);
}
// A visible edge still enables interior picking with the centre off screen.
// Padded region caches and galaxy contours must obey the same viewport rule.
width=900;height=620;
const square=(x0,y0,x1,y1)=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}],testArea={id:'area-picking-test',kind:'galaxy'};
for(const source of ['galaxy','region'])for(const right of [width+1,width+95,width-1]){
 const points=square(-2000,-2000,right,2000),h={id:testArea.id,object:testArea,o:testArea,points,paths:[{closed:true,points}],closed:true};
 MapLabels.begin();MapLabels.contours=source==='galaxy'?[h]:[];RegionMap.hits=source==='region'?[h]:[];
 assert.equal(MapLabels.areaHit(width/2,height/2)?.id||null,right<width?testArea.id:null,'only an on-screen boundary enables interior picking: '+source+'/'+right);
}
// Polygon closing edges count; disconnected paths must not acquire bridges.
MapLabels.begin();RegionMap.hits=[];
const closing=[{x:450,y:-20},{x:-20,y:-20},{x:-20,y:height+20},{x:450,y:height+20}];
MapLabels.contours=[{id:testArea.id,object:testArea,points:closing,closed:true}];
assert.equal(MapLabels.areaHit(200,height/2)?.id,testArea.id,'visible closing edge remains selectable');
MapLabels.begin();
const outer=square(-2000,-2000,2000,2000),separate=square(3000,3000,4000,4000);
MapLabels.contours=[{id:testArea.id,object:testArea,points:[...outer,...separate],paths:[{closed:true,points:outer},{closed:true,points:separate}],closed:true}];
assert.equal(MapLabels.areaHit(width*.4,height*.5),null,'separate off-screen paths do not create a visible bridge');
console.log('PASS empty Alpha Cen and galaxy close views in both modes/themes/widths, invisible padded boundaries excluded, visible off-screen-centred areas and closing edges preserved');
// The fallback label renderer must not restore pointers at other zoom levels.
width=1440;height=1000;
for(const id of ['andromeda','bootes','opengc-ngc6302','opengc-ngc6405','alpha']){
 hover=null;cam={x:0,y:0,span:24};leaderCalls=0;MapLabels.begin();
 const o=object(id);MapLabels.point({key:'object-'+id,object:o,name:o.name,p:{x:650,y:400}});MapLabels.legacyDraw();
 assert.ok(MapLabels.placed.length,'fallback caption was exercised: '+id);assert.equal(leaderCalls,0,'fallback cannot add ordinary label pointers: '+id);
}
hover=null;text=originalText;MapLabels.leader=originalLeader;assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.region,o.navigable])),science);assert.equal(JSON.stringify([state.ship,state.earth,state.proper,state.matter,state.flight]),physical);
console.log('PASS pointers only at cosmic-epoch bands, no ordinary galaxy/region/nebula/cluster/star pointers in either renderer, fixed hover emphasis and galaxy picking in all modes/themes/widths, unchanged scientific/flight state');
}`);
