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

run(`{
  const plans=[];
  for(const [target,setup] of [['sirius',{}],['sgr',{}],['centaurus',{}],['sirius',{collectGas:false}],['centaurus',{collectGas:false}],['sirius',{engineEfficiencyPercent:50}]]){
    MissionPlanner.cache.clear();state=initial();state.flightSetup=FlightSetup.normalize({engine:true,sail:true,collector:true,arrivalFuelPercent:50,...setup});state.selected=target;Cosmology.sync(state);
    const p=MissionPlanner.preview();assert.equal(p.valid,true,target);assert.equal(p.brake.kind,'hybrid',target);plans.push([target,p]);
  }
  let checked=0,fullCalls=0;
  for(const [target,p] of plans)ShipPhysics.run(p.setup,()=>{
    const b=p.brake.plan,etas=[0,b.eta0,b.etaFill,b.etaTerminal,b.etaFeedCap].filter(Number.isFinite);
    for(let i=1;i<64;i++)etas.push(b.eta0*i/64);
    for(const e of etas){
      const full=HybridBrake.atEta(b,e);
      assert.ok(Object.is(HybridBrake.partAt(b,e,'proper'),full.proper),target+' proper time at rapidity '+e);
      assert.ok(Object.is(HybridBrake.partAt(b,e,'earth'),full.earth),target+' Earth time at rapidity '+e);
      checked++;
    }
    const atEta=HybridBrake.atEta,releasing=ReleasingBrake.atEta;
    for(let i=0;i<=24;i++){
      const proper=b.proper*i/24,epoch=p.brake.epoch;
      FlightPath.segments.delete(b);const fresh=FlightPath.distance(b,Magnetic,proper,epoch,p.expansion);
      const warm=FlightPath.distance(b,Magnetic,proper,epoch,p.expansion);
      assert.ok(Object.is(fresh,warm),target+' reused path segments keep the distance at '+proper);
      FlightPath.segments.delete(b);const sample=HybridBrake.sampleProper(b,proper);
      assert.ok(Object.is(FlightPath.distance(b,Magnetic,proper,epoch,p.expansion,sample),fresh),target+' shared sample keeps the distance at '+proper);
    }
    HybridBrake.atEta=function(...args){fullCalls++;return atEta.apply(this,args);};
    ReleasingBrake.atEta=function(...args){fullCalls++;return releasing.apply(this,args);};
    try{
      fullCalls=0;const sample=HybridBrake.sampleProper(b,b.proper*.37);
      assert.ok(fullCalls<=1,target+' time inversion evaluates the complete state once, not per bisection step: '+fullCalls);
      fullCalls=0;FlightPath.distance(b,Magnetic,b.proper*.37,p.brake.epoch,p.expansion,sample);
      assert.equal(fullCalls,0,target+' path quadrature needs Earth time only');
    }finally{HybridBrake.atEta=atEta;ReleasingBrake.atEta=releasing;}
  });
  assert.ok(checked>300);
  console.log('PASS hybrid braking steps reuse fixed path segments and single-clock evaluators without changing a bit');
}`);

run(`{
  MissionPlanner.cache.clear();state=initial();state.selected='sirius';Cosmology.sync(state);paused=true;renderUI();
  const watch=(node,name)=>{let value=node[name],writes=0;Object.defineProperty(node,name,{configurable:true,get(){return value;},set(v){writes++;value=v;}});return{node,name,count:()=>writes,reset(){writes=0;}};};
  const watched=[['flightDetails','hidden'],['flightHint','hidden'],['flightHint','textContent'],['configureFlightLabel','textContent'],['quickSpeedRow','hidden'],['launchBtn','disabled'],['launchBtn','hidden'],['massBar','title'],['targetName','textContent'],['phaseTag','textContent'],['horizonNotice','hidden'],['engineSection','hidden']].map(([id,name])=>watch($(id),name));
  watched.push(watch($('launchBtn').querySelector('span'),'textContent'));
  const styles=['velocityFill','massFuel','progressBar'].map(id=>{const node=$(id),style=node.style;let writes=0;node.style=new Proxy(style,{set(target,key,value){writes++;target[key]=value;return true;}});return{id,count:()=>writes};});
  renderUI();renderUI();
  for(const w of watched)assert.equal(w.count(),0,w.name+' stays untouched while the interface state is unchanged');
  for(const s of styles)assert.equal(s.count(),0,s.id+' style stays untouched while the interface state is unchanged');
  state.selected='barnard';renderUI();
  for(const w of watched)assert.ok(w.count()<=1,w.name+' receives only its final value in one pass: '+w.count());
  assert.equal($('targetName').textContent,object('barnard').name);
  assert.equal(UIPatch.queue,null,'the write batch is closed after the pass');
  const node=document.createElement('div');node.hidden=false;
  assert.equal(UIPatch.begin(),true);assert.equal(UIPatch.begin(),false,'nested passes share one batch');
  UIPatch.set(node,'hidden',true);UIContent.text(node,'первый');UIContent.text(node,'второй');UIPatch.set(node,'hidden',0);
  assert.equal(node.hidden,false);assert.equal(node.textContent,undefined,'batched writes wait for the end of the pass');
  assert.equal(UIPatch.get(node,'hidden'),false);assert.equal(UIPatch.text(node),'второй','later code in the pass reads the pending value');
  UIPatch.end();assert.equal(node.textContent,'второй');assert.equal(node.hidden,false);
  UIPatch.set(node,'hidden',1);assert.equal(node.hidden,true,'writes outside a pass apply immediately');
  const original=renderPanels;renderPanels=()=>{throw Error('render failure');};
  try{assert.throws(()=>renderUI(),/render failure/);assert.equal(UIPatch.queue,null,'a failed pass cannot leave later writes queued');}finally{renderPanels=original;}
  console.log('PASS unchanged interface passes write nothing; changed passes write each node once');
}`);

run(`{
  state=initial();Cosmology.sync(state);width=900;height=620;cam={x:0,y:0,span:24};cameraGoal=null;followShip=false;pointer={down:false};
  const sol=object('sol'),visitHit=MapVisits.hit,heading=updateMapHeading,bounds=canvas.getBoundingClientRect;
  let hits=0,headings=0,layouts=0;
  MapVisits.hit=function(...args){hits++;return visitHit.apply(this,args);};
  updateMapHeading=function(...args){headings++;return heading.apply(this,args);};
  canvas.getBoundingClientRect=function(){layouts++;return bounds.call(this);};
  try{
    MapPointer.flush();hits=headings=layouts=0;hover=null;
    hitObjects=[{o:sol,p:{x:124,y:200}}];
    for(let i=0;i<25;i++)MapPointer.move(100+i,200);
    assert.equal(hits,0,'pointer events only record the newest position');assert.equal(hover,null);
    MapPointer.flush();
    assert.equal(hits,1,'one hit test serves all pointer events of a frame');assert.equal(layouts,1);
    assert.equal(hover,sol);assert.equal(canvas.style.cursor,'pointer');
    MapPointer.flush();assert.equal(hits,1,'a frame without pointer movement repeats nothing');
    MapPointer.move(700,500);MapPointer.flush();assert.equal(hover||null,null);assert.equal(canvas.style.cursor,'crosshair');
    MapPointer.move(124,200);MapPointer.leave();MapPointer.flush();
    assert.equal(hover,null,'a pointer that left the map cannot restore its stale hover');assert.equal(hits,2);
    hits=headings=layouts=0;const before=cam.span;
    for(let i=0;i<12;i++)zoomAtPointer({preventDefault(){},deltaY:-40,clientX:300,clientY:200});
    assert.ok(Math.abs(cam.span/before-Math.exp(-40*.006*12))<1e-12,'every wheel event still changes the scale');
    assert.equal(headings,0,'wheel events leave the heading for the frame');assert.equal(layouts,1,'wheel events of one frame share the canvas bounds');
    MapPointer.flush();assert.equal(headings,1);MapPointer.flush();assert.equal(headings,1);
  }finally{MapVisits.hit=visitHit;updateMapHeading=heading;canvas.getBoundingClientRect=bounds;hitObjects=[];hover=null;}
  console.log('PASS pointer movement and wheel headings are processed once per frame');
}`);
