import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#black-hole-visibility');
run(['map-visibility-data','map-visibility','map-label-data','map-annotations'].map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'));
run(`{
state=initial();paused=true;filter='all';MapLayers.active=false;cameraGoal=null;
const science=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.region,o.massSolar,o.gravity]));
const holes=OBJECTS.filter(o=>o.kind==='blackhole'&&!o.atlasOnly),nuclei=holes.filter(o=>(o.blackHolePopulation||o.population)==='supermassive');
assert.equal(holes.length,90);assert.equal(nuclei.length,70);
assert.equal(MapDetails.blackHoleHost(object('sgr')).id,'milkyway','the original nucleus has the same host rule');
for(const o of nuclei){
 const host=MapDetails.blackHoleHost(o);assert.ok(host,o.id+' has its sourced galaxy context');
 assert.equal(MapDetails.maxSpan({...o,d:o.d*1000}),MapDetails.maxSpan(o),'Earth distance must not enlarge an interior detail');
}
for(const mode of ['full','radial'])for(const viewportWidth of [390,1440,2560])for(const epoch of [0,100e9]){
 MapSlice.mode=mode;width=viewportWidth;height=1000;state.cosmicTime=epoch;Cosmology.sync(state);
 assert.ok(MapVisibility.active);
 for(const o of nuclei){
  const host=MapDetails.blackHoleHost(o),limit=MapVisibility.limit(o)*width*MapDetails.lodScale(o),diameter=host.galaxy?.diameterLy||host.diameterLy;
  assert.equal(MapDetails.lodScale(o),MapDetails.lodScale(host));
  assert.equal(MapDetails.opacity(o,limit*1.01),0,o.id+' disappears before its host');
  assert.equal(MapDetails.opacity(host,limit*1.01),1,host.id+' is still fully visible');
  if(diameter>0)assert.ok(diameter*width*MapDetails.lodScale(host)/limit>=179,'host is resolved before revealing a nucleus');
  const opacities=[1.01,1,.97,.9,.8,.5,.1].map(f=>MapDetails.opacity(o,limit*f));
  assert.equal(opacities[0],0);assert.equal(opacities.at(-1),1);
  for(let i=1;i<opacities.length;i++)assert.ok(opacities[i]>=opacities[i-1],'continuous, monotone reveal');
  const baseline=MapDetails.opacity(o,limit*.9);state.selected=o.id;cam={x:1e12,y:-1e12,span:limit*.9};
  assert.equal(MapDetails.opacity(o,cam.span),baseline,'selection/pan do not override the scale');
 }
 for(const o of holes)assert.equal(MapDetails.visible(o,1e8*width/1440*MapDetails.lodScale(o)),false,'no black holes on an intergalactic overview: '+o.id);
}
// Exercise the host density boundary independently of the resolved host size.
const hostId='regression-density-host',host={...object('andromeda'),id:hostId};
BlackHoleCatalog.hosts.set(hostId,host);MAP_VISIBILITY_BOOT.pixels[hostId]=[.5,.25];
try{
 for(const mode of ['full','radial']){
  MapSlice.mode=mode;const o={...object('bh-andromeda'),id:'regression-nucleus',parentGalaxy:hostId};
  const span=MapVisibility.limit(host)*width*MapDetails.lodScale(host)*.75;
  assert.equal(MapDetails.opacity(o,span),0,'host density suppresses the nucleus first');
  assert.equal(MapDetails.opacity(host,span),1);
 }
}finally{BlackHoleCatalog.hosts.delete(hostId);delete MAP_VISIBILITY_BOOT.pixels[hostId];}
// Check the actual symbol, caption and still-visible galaxy contour, including
// selected/pinned nuclei. Close views retain both the black hole and its name.
state=initial();state.expansion=false;Cosmology.sync(state);width=1440;height=1000;
for(const mode of ['full','radial'])for(const id of ['sgr','bh-andromeda','bh-m87']){
 MapSlice.mode=mode;const o=object(id),host=MapDetails.blackHoleHost(o),limit=MapVisibility.limit(o)*width;
 ExtendedCatalog.pin(o);state.selected=id;cam={...MapLayout.project(o),span:limit*1.05};
 MapLabels.begin();drawGalaxyBackground();drawObjects();MapLabels.draw();
 assert.ok(!hitObjects.some(h=>h.o.id===id),'hidden black-hole symbol: '+mode+'/'+id);
 assert.ok(!MapLabels.placed.some(q=>q.key==='object-'+id),'hidden black-hole name: '+mode+'/'+id);
 assert.ok(MapLabels.contours.some(q=>q.id===host.id),'galaxy outline remains after nucleus fades: '+mode+'/'+id);
 const originalCircle=circle;let hoverRings=0;circle=()=>hoverRings++;hover=o;
 try{drawHover();assert.equal(hoverRings,0,'a stale hover cannot reveal a hidden black hole');}
 finally{circle=originalCircle;hover=null;}
 cam.span=limit*.5;MapLabels.begin();drawObjects();MapLabels.draw();
 assert.ok(hitObjects.some(h=>h.o.id===id),'resolved black-hole symbol: '+mode+'/'+id);
 assert.ok(MapLabels.placed.some(q=>q.key==='object-'+id),'resolved black-hole name: '+mode+'/'+id);
}
// Metadata fallback must not resurrect black holes as sparse overview points.
const active=Object.getOwnPropertyDescriptor(MapVisibility,'active');
Object.defineProperty(MapVisibility,'active',{get:()=>false,configurable:true});
try{
 for(const o of nuclei){
  const host=MapDetails.blackHoleHost(o),span=MapDetails.maxSpan(o)*1.05*MapDetails.lodScale(o);
  assert.equal(MapDetails.opacity(o,span),0);assert.equal(MapDetails.opacity(host,span),1);
  assert.equal(MapDetails.sparse(o,span*1e5),false);
 }
}finally{Object.defineProperty(MapVisibility,'active',active);}
assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.region,o.massSolar,o.gravity])),science);
console.log('PASS all 90 mapped BHs and 70 nuclei: resolved host before nucleus, earlier fade, density cap, smooth zoom, symbols/names, selection/pinning/pan, metadata fallback and immutable science; three modes, three widths, expansion epochs');
}`);
