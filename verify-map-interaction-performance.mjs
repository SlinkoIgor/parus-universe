import fs from 'node:fs';
const harness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {context,run};';
const {context, run} = await import('data:text/javascript,' + encodeURIComponent(harness) + '#map-interaction-performance');
context.AbortController = AbortController;

run(`{
  state=initial();state.cosmicTime=100000;paused=true;Cosmology.sync(state);
  MapSlice.mode='full';width=1440;height=1000;cam={x:1e7,y:2e7,span:24};
  const size=GALAXIES.length,contains=MapGeometry.contains,group=Cosmology.group;
  let staleProjections=0,queries=0;
  // Render helpers outlive the full records of previously visited tiles. Their
  // missing kind used to trigger a nested galaxy search after a cache clear.
  for(let i=0;i<2000;i++)GALAXIES.push({id:'evicted-interaction-'+i,name:'Evicted',p3:[1e9+i,0,0],diameterLy:100000,mapPosition:{x:1e9+i,y:0}});
  Cosmology.group=function(o,...args){if(o?.id?.startsWith('evicted-interaction-')){staleProjections++;throw Error('Evicted helper reached cosmological grouping');}return group.call(this,o,...args);};
  MapGeometry.contains=function(...args){queries++;return contains.apply(this,args);};
  try{
    const science=JSON.stringify([state.ship,state.flight,state.matter,state.proper,state.earth,state.cosmicTime]);
    for(const mode of ['full','radial','full']){
      MapSlice.setMode(mode);mapContext(cam);
      assert.equal(staleProjections,0,'projection and heading never project evicted helpers');
    }
    queries=0;mapContext({x:0,y:0,span:24});mapContext({x:0,y:0,span:.001});
    assert.equal(queries,0,'solar contexts return before scanning galaxy geometry');
    assert.equal(JSON.stringify([state.ship,state.flight,state.matter,state.proper,state.earth,state.cosmicTime]),science);
  }finally{GALAXIES.length=size;MapGeometry.contains=contains;Cosmology.group=group;}
  console.log('PASS nonzero cosmic time, 2000 evicted galaxy helpers, repeated projections, local heading shortcut and unchanged expedition');
}`);

run(`{
  state=initial();state.expansion=false;Cosmology.sync(state);MapSlice.mode='full';cam={x:0,y:0,span:1440};
  const view=MapGeometry.view;let builds=0;MapGeometry.view=function(...args){builds++;return view.apply(this,args);};
  const make=(id,x,r)=>({id,kind:'galaxy',p3:[x,0,0],mapPosition:{x,y:0},diameterLy:r*2,positionQuality:'estimate'});
  const remote=make('bounds-remote',1e7,200),tiny=make('bounds-tiny',0,.1),surround=make('bounds-surround',0,1e7),edge=make('bounds-edge',width*.57+50,60);
  try{
    assert.deepEqual(MapGeometry.indexBounds(null,{kind:'spine',offsets:Array.from({length:200000},(_,i)=>[i,-i,0])}),[0,0,199999,199999],'dense filament bounds do not exceed the engine argument limit');
    assert.equal(MapGeometry.intersectsView(remote),false);
    assert.equal(MapGeometry.intersectsView(tiny,0,2),false,'subpixel outlines need no tessellation');
    assert.equal(MapGeometry.intersectsView(surround),true,'an enclosing contour must not be culled by its centre');
    assert.equal(MapGeometry.intersectsView(edge),true,'partially visible contours survive');
    assert.equal(MapGeometry.contains(remote,{x:0,y:0}),false);assert.equal(builds,0,'outside point is rejected by analytic bounds');
    assert.equal(MapGeometry.contains(tiny,{x:0,y:0}),true);assert.equal(builds,1);
    for(const mode of ['full','radial']){
      MapSlice.mode=mode;
      for(const id of ['andromeda','milkyway','virgo','omega','orion']){
        const o=object(id),b=MapGeometry.indexBounds(o),center=MapLayout.project(o);if(!b)continue;
        cam={...center,span:Math.max(b[2]-b[0],b[3]-b[1])*2};
        assert.ok(MapGeometry.intersectsView(o),'visible source envelope survives '+id+' '+mode);
        const geometry=view.call(MapGeometry,o),scale=Cosmology.regionScale(o);
        for(const [fx,fy] of [[0,0],[.2,.1],[1.5,1.5],[-1.5,-1.5]]){
          const x=fx*(b[2]-b[0]),y=fy*(b[3]-b[1]);
          const expected=geometry.paths.reduce((inside,path)=>path.closed&&MapLandmarks.contains({x,y},path.points)?!inside:inside,false);
          assert.equal(MapGeometry.contains(o,{x:center.x+x*scale,y:center.y+y*scale}),expected,'bounds preserve exact polygon membership');
        }
      }
    }
  }finally{MapGeometry.view=view;MapSlice.mode='full';}
  console.log('PASS conservative bounds: offscreen, subpixel, enclosing/edge contours, exact full/radial/slice membership');
}`);

run(`{
  state=initial();state.cosmicTime=100000;Cosmology.sync(state);MapSlice.mode='full';
  const count=OBJECTS.length,galaxies=GALAXIES.length,find=OBJECTS.find;
  const host={id:'interaction-host',kind:'galaxy',p3:[9e15,8e15,0]},duplicate={...host,p3:[1e16,0,0]},target={id:'interaction-bound',kind:'quasar',p3:[9e15+1,8e15,0]};
  OBJECTS.push(host,duplicate);GALAXIES.push({id:host.id,diameterLy:100});
  for(let i=0;i<2000;i++)GALAXIES.splice(galaxies,0,{id:'interaction-unloaded-'+i,diameterLy:100000});
  let scans=0;OBJECTS.find=function(...args){scans++;return find.apply(this,args);};
  try{
    const expected={id:host.id,p3:host.p3,map:MapLayout.baseProject(host)};
    for(const frame of [false,true]){
      Cosmology.cache.clear();scans=0;if(frame)MapDetails.beginFrame();
      try{assert.deepEqual(Cosmology.group(target),expected,'same first matching catalogue identity and bound frame');assert.ok(scans<=2,'one group lookup must not scan OBJECTS once per galaxy');}
      finally{if(frame)MapDetails.endFrame();}
    }
    OBJECTS[count]=duplicate;OBJECTS[count+1]=host;Cosmology.cache.clear();
    assert.equal(Cosmology.group(target).id,target.id,'a fresh call observes direct catalogue replacement and first-ID precedence');
  }finally{OBJECTS.find=find;OBJECTS.length=count;GALAXIES.length=galaxies;Cosmology.cache.clear();}
  console.log('PASS cold cosmological grouping: linear catalogue lookup, unchanged bound-frame result/order, frame scope and direct replacements');
}`);

await run('MapRadial.loading');
await run(`(async()=>{
  const read=ExtendedCatalog.readJSON,decode=ExtendedCatalog.decode,prepare=ExtendedCatalog.prepareGalaxy;
  const requests=[];
  ExtendedCatalog.readJSON=(path,options)=>new Promise(resolve=>requests.push({path,signal:options?.signal,resolve}));
  ExtendedCatalog.decode=o=>o;ExtendedCatalog.prepareGalaxy=()=>{};
  const oldWanted=ExtendedCatalog.wanted;
  ExtendedCatalog.wanted=[];
  const rows=[{id:'interaction-load',kind:'star'}];
  try{
    const old=ExtendedCatalog.tile('interaction-view.json',{view:true}).catch(e=>e);
    const first=requests.at(-1);
    ExtendedCatalog.cancelViewLoads([]);
    assert.ok(first.signal.aborted);assert.ok(!ExtendedCatalog.inflight.has('interaction-view.json'));
    const fresh=ExtendedCatalog.tile('interaction-view.json',{view:true}),freshPromise=ExtendedCatalog.inflight.get('interaction-view.json'),freshRequest=requests.at(-1);
    first.resolve(rows);assert.equal((await old).name,'AbortError');
    assert.equal(ExtendedCatalog.inflight.get('interaction-view.json'),freshPromise,'old finally cannot remove replacement');
    assert.ok(!ExtendedCatalog.cache.has('interaction-view.json'),'late cancelled response is never decoded/cached');
    freshRequest.resolve(rows);await fresh;
    assert.ok(!ExtendedCatalog.errors.has('interaction-view.json'),'cancellation does not suppress retry');
    const shared=ExtendedCatalog.tile('interaction-shared.json',{view:true}),sharedRequest=requests.at(-1);
    assert.equal(ExtendedCatalog.tile('interaction-shared.json'),shared);
    ExtendedCatalog.cancelViewLoads([]);assert.equal(sharedRequest.signal.aborted,false,'search/navigation retains a shared view request');
    sharedRequest.resolve(rows);await shared;
    const direct=ExtendedCatalog.tile('interaction-direct.json'),directRequest=requests.at(-1);
    ExtendedCatalog.cancelViewLoads([]);assert.equal(directRequest.signal,undefined,'explicit navigation does not become cancellable');directRequest.resolve(rows);await direct;
    const boot=MapLayers.boot;
    const layerOld=MapLayers.load('interaction-layer.json').catch(e=>e),layerRequest=requests.at(-1);
    MapLayers.setGeometry(boot);assert.ok(layerRequest.signal.aborted);assert.equal(MapLayers.inflight.size,0,'projection immediately releases old request slots');
    const layerFresh=MapLayers.load('interaction-layer.json'),layerFreshRequest=requests.at(-1);
    layerRequest.resolve(rows);assert.equal((await layerOld).name,'AbortError');
    assert.equal(MapLayers.inflight.size,1,'late old response cannot erase a new load');assert.ok(!MapLayers.cache.has('interaction-layer.json'));
    layerFreshRequest.resolve(rows);await layerFresh;
    assert.ok(!MapLayers.errors.has('interaction-layer.json'));
    const wanted=MapLayers.boot.dataRoot+'/interaction-keep.json',keep=MapLayers.load('interaction-keep.json'),keepRequest=requests.at(-1);
    MapLayers.cancelLoads([wanted]);assert.equal(keepRequest.signal.aborted,false);MapLayers.cancelLoads([]);assert.ok(keepRequest.signal.aborted);
    const caught=keep.catch(e=>e);keepRequest.resolve(rows);assert.equal((await caught).name,'AbortError');
    assert.equal(ExtendedCatalog.viewLoads.size,0);assert.equal(MapLayers.loads.size,0);
  }finally{
    ExtendedCatalog.readJSON=read;ExtendedCatalog.decode=decode;ExtendedCatalog.prepareGalaxy=prepare;ExtendedCatalog.wanted=oldWanted;
    for(const file of ['interaction-view.json','interaction-shared.json','interaction-direct.json'])ExtendedCatalog.cache.delete(file);
    MapLayers.cache.delete('interaction-layer.json');
  }
  console.log('PASS cancelled stale requests release slots; late-response races, same-file retries, shared search/navigation and explicit loads remain safe');
})()`);
