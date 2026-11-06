import fs from 'node:fs';
import vm from 'node:vm';
// Catalogue build/audit tools load map metadata without a browser.
vm.runInNewContext(fs.readFileSync('dist/map-details.js','utf8'),{OBJECTS:[]});
console.log('PASS map metadata loads in catalogue tools without a browser DOM');
// Isolate these mutations from the physics and map regressions.
const harness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0] +
  '\nexport {context,run};\n// Runtime performance regression context';
const { run } = await import('data:text/javascript,' + encodeURIComponent(harness));

run(`{
  for(const d of [0,1,2,3,6,14])for(const n of [0,-0,NaN,Infinity,-Infinity,-1234.56789,1e-12,.99999999999999,13.8e9]){
    assert.equal(fmt(n,d),Number(n).toLocaleString('ru-RU',{maximumFractionDigits:d,minimumFractionDigits:d}));
  }
  theme='dark';assert.equal(paint('#424242'),'#bdbdbd');assert.equal(paint('#aaa'),'#555555');
  assert.equal(paint('rgba(37,38,32,0.5)'),'rgba(218,218,218,0.5)');
  theme='light';assert.equal(paint('#424242'),'#424242');theme='dark';assert.equal(paint('#424242'),'#bdbdbd');
  for(let i=0;i<1000;i++)paint('#'+i.toString(16).padStart(6,'0'));
  assert.ok(darkInk.size<=128,'color cache stays bounded');
  const measure=ctx.measureText;let calls=0;
  ctx.measureText=value=>{calls++;return measure(value);};MapLabels.metrics.clear();
  const font='10px "Golos Text",Arial,sans-serif',value=MapLabels.measure('Ковчег',font);
  for(let i=0;i<100;i++)assert.equal(MapLabels.measure('Ковчег',font),value);
  assert.equal(calls,1,'fixed names do not remeasure every frame');
  MapLabels.measure('Ковчег','12px "Golos Text",Arial,sans-serif');assert.equal(calls,2,'font size has separate metrics');
  for(let i=0;i<10000;i++)MapLabels.measure('Полёт '+i,font);
  assert.ok(MapLabels.metrics.size<=2048,'changing flight captions cannot grow the text cache forever');
  ctx.measureText=measure;
  console.log('PASS unchanged number formatting, theme switching and bounded text/color caches');
}`);

run(`{
  const reference=id=>ExtendedCatalog.pinned.get(id)?.historicalStellarNavigation
    ? ExtendedCatalog.get(id) : OBJECTS.find(o=>o.id===id)||ExtendedCatalog.get(id);
  for(const id of [...OBJECTS.map(o=>o.id),...Object.keys(EXTENDED_BOOT.identityRedirects||{}),'missing-performance-record'])
    assert.equal(object(id),reference(id),'indexed lookup retains catalogue identity: '+id);
  const indexed=OBJECTS.find(o=>OBJECTS[o.index]===o),find=OBJECTS.find;
  MapDetails.beginFrame();
  let scans=0;OBJECTS.find=function(...args){scans++;return find.apply(this,args);};
  try{for(let i=0;i<1000;i++)assert.equal(object(indexed.id),indexed);assert.equal(scans,0,'draw-scoped indexed records need no array scans');}
  finally{OBJECTS.find=find;MapDetails.endFrame();}
  const replacement={...indexed,name:'Replacement regression'},oldPin=ExtendedCatalog.pinned.get(indexed.id);
  try{
    OBJECTS[indexed.index]=replacement;
    assert.equal(object(indexed.id),replacement,'replacement wins over a stale index');
    const historical={...indexed,historicalStellarNavigation:true,p3:[1,2,3]};ExtendedCatalog.pinned.set(indexed.id,historical);
    assert.equal(object(indexed.id),historical,'private historical flight endpoints retain precedence');
  }finally{OBJECTS[indexed.index]=indexed;if(oldPin)ExtendedCatalog.pinned.set(indexed.id,oldPin);else ExtendedCatalog.pinned.delete(indexed.id);}
  const legacy={id:'legacy-performance-restore',index:OBJECTS.length};OBJECTS.push(legacy);
  try{assert.equal(object(legacy.id),legacy,'unindexed legacy restores remain available');}finally{OBJECTS.pop();}
  console.log('PASS draw-scoped lookups avoid linear scans and preserve replacements, redirects, legacy restores and historical flight records');
}`);

run(`{
  state=initial();state.expansion=false;paused=true;Cosmology.sync(state);
  width=1440;height=1000;cam={x:0,y:0,span:24};MapSlice.mode='full';
  const o=object('alpha'),opacity=MapDetails.classOpacity,geometry=RegionMap.pointGeometry;
  let opacityCalls=0,geometryCalls=0;
  MapDetails.classOpacity=function(...args){opacityCalls++;return opacity.apply(this,args);};
  RegionMap.pointGeometry=function(...args){geometryCalls++;return geometry.apply(this,args);};
  try{
    MapDetails.beginFrame();
    const expected=MapDetails.opacity(o,24,1440),point=RegionMap.asPoint(o);
    for(let i=0;i<100;i++){assert.equal(MapDetails.opacity(o,24,1440),expected);assert.equal(RegionMap.asPoint(o),point);}
    assert.equal(opacityCalls,1);assert.equal(geometryCalls,1,'one point classification per object/draw');
    MapDetails.opacity(o,24,390);assert.equal(opacityCalls,2,'mobile width has its own visibility');
    assert.equal(MapDetails.opacity(o,4000,1440),0,'changed span never reuses a previous value');
    MapDetails.endFrame();MapDetails.beginFrame();MapDetails.opacity(o,24,1440);RegionMap.asPoint(o);
    assert.equal(geometryCalls,2,'next frame recomputes geometry');
  }finally{MapDetails.endFrame();MapDetails.classOpacity=opacity;RegionMap.pointGeometry=geometry;}
  const draw=drawGrid;drawGrid=()=>{throw new Error('intentional render failure');};
  try{assert.throws(()=>frame(performance.now()),/intentional render failure/);}finally{drawGrid=draw;}
  assert.equal(MapDetails.frameObjects,null);assert.equal(MapDetails.frameOpacity,null);assert.equal(MapDetails.framePoints,null);
  console.log('PASS draw-scoped visibility/geometry reuse respects span, mobile width and frame boundaries, and clears even on rendering failure');
}`);

run(`{
  state=initial();state.expansion=false;paused=true;Cosmology.sync(state);
  width=1440;height=1000;cam={x:0,y:0,span:24};MapSlice.mode='full';filter='all';
  const originals=[...OBJECTS],visible=ExtendedCatalog.visible,pinned=ExtendedCatalog.pinned,layers=MapLayers.visible,active=MapLayers.active,
    visibility=globalThis.MapVisibility,asPoint=RegionMap.asPoint,admitted=MapDetails.visible;
  const rows=['visible','hidden'].map((name,i)=>({id:'performance-pass-'+name,kind:'star',name:'HYG '+i,aliases:[],
    p3:[i+1,0,0],mapPosition:{x:i+1,y:0},streamed:true,bulkGalaxyMember:true,massSolar:null,gravity:null,facts:{mass:'Нет индивидуальной оценки.'}}));
  const scientific=JSON.stringify(rows),checks=new Map(),geometry=new Map();
  try{
    OBJECTS.splice(0,OBJECTS.length,object('sol'),...rows);ExtendedCatalog.visible=rows;ExtendedCatalog.pinned=new Map(rows.map(o=>[o.id,o]));
    MapLayers.visible=rows;MapLayers.active=false;
    globalThis.MapVisibility={active:true,limit(){return Infinity;},overviewPoint(){return false;}};
    MapDetails.visible=function(o,...args){if(rows.includes(o)){checks.set(o.id,(checks.get(o.id)||0)+1);if(o===rows[1])return false;}return admitted.call(this,o,...args);};
    RegionMap.asPoint=function(o){if(rows.includes(o))geometry.set(o.id,(geometry.get(o.id)||0)+1);return asPoint.call(this,o);};
    MapLabels.begin();drawObjects();assert.equal(checks.size,0,'ordinary background skips foreground visibility work');
    ExtendedCatalog.draw();assert.ok(hitObjects.some(h=>h.o===rows[0]));assert.ok(!hitObjects.some(h=>h.o===rows[1]));
    assert.equal(geometry.get(rows[1].id)||0,0,'invisible background never prepares point geometry');
    state.selected=rows[0].id;MapLabels.begin();drawObjects();assert.ok(hitObjects.some(h=>h.o===rows[0]),'selected background still uses foreground');
    state.selected='sol';state.current=rows[0].id;MapLabels.begin();drawObjects();assert.ok(hitObjects.some(h=>h.o===rows[0]),'parked background still uses foreground');
    assert.equal(JSON.stringify(rows),scientific,'passes preserve catalogue properties');
  }finally{
    OBJECTS.splice(0,OBJECTS.length,...originals);ExtendedCatalog.visible=visible;ExtendedCatalog.pinned=pinned;MapLayers.visible=layers;
    MapLayers.active=active;globalThis.MapVisibility=visibility;RegionMap.asPoint=asPoint;MapDetails.visible=admitted;
  }
  console.log('PASS foreground/background routing skips invisible geometry while preserving selection, station, hits and source data');
}`);

run(`{
  state=initial();state.expansion=false;paused=true;Cosmology.sync(state);
  width=1440;height=1000;cam={x:0,y:0,span:24};MapSlice.mode='full';filter='all';
  const sol=object('sol');
  const bg={id:'background-performance',kind:'star',name:'HYG 123456',aliases:[],p3:[0,0,0],mapPosition:{x:0,y:0},
    streamed:true,bulkGalaxyMember:true,galaxyMember:false,massSolar:null,gravity:null,facts:{mass:'Нет индивидуальной оценки.'}};
  const scientific=JSON.stringify(bg);
  OBJECTS.splice(0,OBJECTS.length,sol);ExtendedCatalog.visible=[bg,bg];ExtendedCatalog.pinned.clear();
  ExtendedCatalog.pinned.set(bg.id,bg);MapLayers.active=false;MapLayers.visible=[bg];
  const draw=()=>{hitObjects=[];MapLabels.begin();ExtendedCatalog.draw();return hitObjects.map(h=>h.o.id);};
  assert.deepEqual(draw(),[],'unnamed legacy background respects the foreground guard');
  bg.name='Надежда';assert.deepEqual(draw(),[bg.id],'named background survives overlap and is deduplicated');bg.name='HYG 123456';
  globalThis.MapVisibility={active:true,limit(){return Infinity;},overviewPoint(){return false;}};
  const visible=MapDetails.visible;let foregroundChecks=0;
  MapDetails.visible=function(o,...args){if(o===sol)foregroundChecks++;return visible.call(this,o,...args);};
  assert.deepEqual(draw(),[bg.id],'fixed hierarchy retains its already admitted background point');
  assert.equal(foregroundChecks,0,'fixed hierarchy skips the unused foreground grid');
  state.selected=bg.id;assert.deepEqual(draw(),[],'selection belongs to the foreground pass');state.selected='sol';
  state.current=bg.id;assert.deepEqual(draw(),[],'station belongs to the foreground pass');state.current='sol';
  ExtendedCatalog.pinned.clear();ExtendedCatalog.transitions.set(bg.id,{alpha:0});
  assert.deepEqual(draw(),[],'newly loaded invisible points cannot be picked');
  ExtendedCatalog.transitions.set(bg.id,{alpha:.5});assert.deepEqual(draw(),[bg.id],'fading points remain clickable once visible');
  filter='blackhole';assert.deepEqual(draw(),[],'class filtering removes background hits');
  assert.equal(JSON.stringify(bg),scientific,'rendering preserves source coordinates and properties');
  MapDetails.visible=visible;
  console.log('PASS legacy overlap, fixed visibility, foreground exclusion, deduplication, fade, filter and unchanged source data');
}`);
