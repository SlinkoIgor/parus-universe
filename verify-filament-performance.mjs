import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#filament-performance');

run(`{
 state=initial();state.expansion=false;Cosmology.sync(state);MapSlice.mode='full';width=1440;height=1000;cam={x:0,y:0,span:1440};
 const offsets=[[-1200,40,-300],[-400,100,-40],[-50,0,0],[20,-60,50],[800,10,300],[2200,-40,400]],
  o={id:'performance-spine',kind:'structure',cosmicSubtype:'filament',p3:[0,0,20],cosmicCatalog:true,region:{shape:'polyline',major:3400,minor:160,points:offsets.map(v=>[v[0],-v[1]]),offsets3:offsets}};
 const science=JSON.stringify(o),full=MapGeometry.view(o);
 for(const mode of ['full','radial','full']){
  MapSlice.mode=mode;
  for(let i=0;i<80;i++){
   cam.x=i*2;cam.span=1000+i*70;
   assert.equal(MapGeometry.view(o),full,'pan/zoom and anchor projection reuse exact local segments');
  }
 }
 for(const [center,half] of [[0,100],[80,40],[-200,200],[500,60],[0,20],[0,100]]){
  const clipped=MapGeometry.projected(o,{mode:'slice',centerZ:center,halfThickness:half});
  const expected=MapGeometry.clip3(offsets,center-half-o.p3[2],center+half-o.p3[2],false).map(vertices=>({closed:false,points:vertices.map(v=>({x:v[0],y:-v[1]}))}));
  assert.deepEqual(clipped.paths,expected,'slice retains every exact 3D slab intersection');
  assert.ok(MapGeometry.cache.get(o).entries.size<=4,'slab cache stays bounded');
 }
 MapSlice.mode='full';
 const geometry=MapGeometry.view(o);let buffer,pool,paths;
 for(let i=0;i<100;i++){
  const c={x:300-i*9,y:500+i*2},scale=.2+i*.013,padding=i%3?10:96;
  const expectedPaths=geometry.paths.map(path=>({...path,points:path.points.map(p=>({x:c.x+p.x*scale,y:c.y+p.y*scale}))})),expected=RegionMap.clipPaths(expectedPaths,padding,false),data=RegionMap.spineScreen(o,geometry,c,scale,padding);
  assert.deepEqual(data.paths,expectedPaths);
  assert.deepEqual(data.points,expectedPaths.flatMap(path=>path.points));
  assert.deepEqual(data.box,MapLandmarks.box(data.points));
  assert.deepEqual(data.segments,expected.segments,'clipping retains the same independent endpoints');
  assert.deepEqual(data.runs,expected.runs,'separate subpaths keep the same joins and alpha blending');
  if(i){assert.equal(data,buffer);assert.equal(data.pool,pool);assert.equal(data.paths,paths,'zoom reuses screen buffers');}
  buffer=data;pool=data.pool;paths=data.paths;
 }
 assert.equal(JSON.stringify(o),science,'source points and physical position remain untouched');
 offsets[0][0]-=80;offsets[1][2]+=90;
 const changed=MapGeometry.view(o);
 assert.notEqual(changed,geometry,'in-place source corrections invalidate paths');
 assert.equal(changed.paths[0].points[0].x,offsets[0][0]);
 assert.equal(MapGeometry.indexBounds(o)[0],offsets[0][0],'source corrections invalidate analytic bounds too');
 o.region.offsets3=offsets.map(v=>[...v]);
 assert.notEqual(MapGeometry.view(o),changed,'replaced source arrays invalidate paths');
 MapDetails.beginFrame();const model=MapGeometry.model(o);
 assert.equal(MapGeometry.model(o),model,'one resolved model per synchronous draw');
 MapDetails.endFrame();assert.equal(MapDetails.frameSpines,null);assert.equal(MapDetails.frameModels,null);
 o.region.offsets3[0][0]-=10;
 MapDetails.beginFrame();
 try{assert.notEqual(MapGeometry.model(o),model);assert.equal(MapGeometry.view(o).paths[0].points[0].x,o.region.offsets3[0][0],'next draw observes changed source');}
 finally{MapDetails.endFrame();}
 o.region.offsets3=[];assert.equal(MapGeometry.model(o),null,'missing 3D geometry never becomes an invented contour');
 console.log('PASS exact filament segments, pan/zoom/radial reuse, 3D slab intersections, bounded caches, reusable screen clipping, in-place source corrections, frame cleanup and unchanged scientific data');
}`);

run(`{
 state=initial();state.cosmicTime=100000;Cosmology.sync(state);
 const iterator=OBJECTS[Symbol.iterator];let scans=0;
 OBJECTS[Symbol.iterator]=function(){scans++;return iterator.call(this);};
 const a={id:'frame-group-a',kind:'quasar',p3:[9e17,8e17,7e17]},b={...a,id:'frame-group-b'};
 try{
  Cosmology.cache.clear();MapDetails.beginFrame();assert.equal(scans,1);
  assert.equal(Cosmology.group(a).id,a.id);assert.equal(Cosmology.group(b).id,b.id);
  assert.equal(scans,1,'cold grouping uses the actual draw snapshot, without rebuilding an index per target');
  MapDetails.endFrame();Cosmology.cache.clear();Cosmology.group(a);
  assert.equal(scans,2,'outside a draw the catalogue lookup is fresh');
 }finally{OBJECTS[Symbol.iterator]=iterator;MapDetails.endFrame();Cosmology.cache.clear();}
 console.log('PASS cold cosmological grouping shares the actual lexical frame index, with fresh lookup outside rendering');
}`);

run(`{
 const limit=Cosmology.cacheLimit;Cosmology.cache.clear();Cosmology.cacheLimit=4;
 try{
  const rows=Array.from({length:5},(_,i)=>({id:'group-budget-'+i,kind:'galaxy',p3:[9e17+i*1e7,0,0]})),groups=rows.map(o=>Cosmology.group(o));
  assert.equal(Cosmology.cache.size,4,'group memoization stays bounded');
  assert.equal(JSON.stringify([...Cosmology.cache.keys()]),JSON.stringify(rows.slice(1).map(o=>o.id)),'one new group cannot flush the whole view');
  assert.equal(Cosmology.group(rows[1]),groups[1],'unaffected groups retain their exact cached result');
  assert.deepEqual(Cosmology.group(rows[0]),groups[0],'an evicted group is recomputed without losing scientific objects');
  assert.equal(Cosmology.cache.size,4);
 }finally{Cosmology.cacheLimit=limit;Cosmology.cache.clear();}
 console.log('PASS bounded cosmological cache evicts one old memo, retains the hot view and recomputes evicted groups exactly');
}`);
