import fs from 'node:fs';
// Register actual application handlers in the shared VM browser harness.
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]
 .replace('addEventListener(){}','addEventListener(type,handler){(this.listeners??={})[type]=handler;}')
 .replace('const context=','el("starsPreset").dataset.zoom="24";\nconst context=')
 .replace('querySelectorAll:()=>[]',"querySelectorAll:s=>s==='[data-zoom]'?[el('starsPreset')]:[]")+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#ship-camera');
run(fs.readFileSync('dist/map-visibility-data.js','utf8'));
run(fs.readFileSync('dist/map-visibility.js','utf8'));
run(fs.readFileSync('dist/universe-map.js','utf8'));
run(`{
// Ten distinct symbols must fit from either end of the zoom range. Hidden
// records and coincident catalogue identities cannot satisfy the count.
state=initial();state.expansion=false;Cosmology.sync(state);paused=true;
width=900;height=620;hudHeight=0;MapLayers.active=false;
const originals=OBJECTS.slice(), pinned=ExtendedCatalog.pinned, points=ExtendedCatalog.visible,
 layers=MapLayers.visible, filters=MapFilters.objects, selection=MapFilters.selection, activeGroup=MapFilters.activeGroup;
const fixtures=Array.from({length:10},(_,i)=>({id:'focus-fixture-'+i,name:'Focus '+i,kind:'star',
 p3:[8*Math.cos(i*Math.PI/5),8*Math.sin(i*Math.PI/5),0],d:8,apparentV:i<7?1:5,massSolar:1}));
try{
 OBJECTS.splice(0,OBJECTS.length,...fixtures,
  {...fixtures[0],id:'focus-duplicate'},
  {...fixtures[1],id:'focus-unknown',atlasOnly:true},
  {...fixtures[2],id:'focus-retired',supersededBy:fixtures[2].id});
 ExtendedCatalog.pinned=new Map();ExtendedCatalog.visible=[];MapLayers.visible=[];MapFilters.objects=new Map();
 MapFilters.selection={classes:MapFilters.defaults('classes'),collections:[],catalogs:[]};
 const count=()=>{MapLabels.begin();drawObjects();ExtendedCatalog.draw();return hitObjects.filter(h=>
  h.p.x>40&&h.p.x<width-40&&h.p.y>40&&h.p.y<height-40&&!h.o.id.includes('duplicate')).length;};
 for(const span of [.00006,1e11]){
  cam={x:1000,y:-1000,span};followShip=false;cameraGoal=null;MapSlice.mode='full';
  const saved=JSON.stringify(state);focusShip();assert.equal(count(),10,'all ten distinct neighbours fit');
  assert.ok(cam.span>16&&cam.span<100,'focus chooses a local scale from either extreme');
  assert.equal(JSON.stringify(state),saved,'focus preserves the expedition');
  const centred=JSON.stringify(cam);focusShip();assert.equal(JSON.stringify(cam),centred,'turning off tracking preserves scale');
 }
 const query=document.querySelectorAll;
 try{
  document.querySelectorAll=s=>s.includes('.flight-card')?[{getBoundingClientRect:()=>
   ({left:600,top:0,width:250,height:620,right:850,bottom:620})}]:query(s);
  followShip=false;cam={x:0,y:0,span:1e11};focusShip();assert.equal(count(),10);
  assert.ok(hitObjects.filter(h=>h.o.id.startsWith('focus-fixture')).every(h=>h.p.x<592),
   'all ten neighbours fit outside the target panel, including points revealed after further zooming');
 }finally{document.querySelectorAll=query;}
 MapFilters.activeGroup='collections';MapFilters.selection.collections=['brightest-stars'];followShip=false;focusShip();
 assert.equal(count(),7,'small filters fit their available members without adding hidden classes');
 MapFilters.selection.collections=[];
 // A dense cluster of unresolved identities cannot replace the tenth neighbour.
 OBJECTS.splice(9,1);followShip=false;MapSlice.mode='full';cam.span=1e11;focusShip();assert.equal(count(),9);
 assert.ok(cam.span<100,'fewer available neighbours do not retain the Universe overview');
}finally{
 OBJECTS.splice(0,OBJECTS.length,...originals);ExtendedCatalog.pinned=pinned;ExtendedCatalog.visible=points;
 MapLayers.visible=layers;MapFilters.objects=filters;MapFilters.selection=selection;MapFilters.activeGroup=activeGroup;followShip=false;MapSlice.mode='full';
}
console.log('PASS ship focus fits ten distinct neighbours from microscopic and Universe zooms, honours filters and slice depth, and preserves expedition/toggle state');
}`);
run(`{
canvas.setPointerCapture=()=>{};
UniverseMap.renderCard=()=>{};
width=1440;height=855;state=initial();state.expansion=true;paused=true;Cosmology.sync(state);
cam=UniverseMap.overview();cameraGoal=null;frame(lastFrame+101);
assert.ok($('mapSubtitle').textContent.includes('46,1 млрд св. лет'));
Cosmology.elapse(state,15e9);frame(lastFrame+101);
const expandedHeading=$('mapSubtitle').textContent;
assert.ok(expandedHeading.includes(distanceText(UniverseMap.radius*Cosmology.scale())),'radius heading updates with the simulation without camera input');
state.expansion=false;Cosmology.elapse(state,15e9);frame(lastFrame+101);assert.equal($('mapSubtitle').textContent,expandedHeading);
for(const viewport of [[1440,855],[390,562]])for(const mode of ['full','radial']){
 [width,height]=viewport;MapSlice.mode=mode;MapLayers.active=false;
 state=initial();state.expansion=false;Cosmology.sync(state);FlightQueue.reset();
 followShip=false;cameraGoal=null;launch(true);paused=true;Simulation.tick(.2);
 cam=UniverseMap.overview();cameraGoal=null;focusShip();assert.equal(followShip,true,'first click centres and follows');assert.ok(cam.span<100,'first click also restores the local surroundings');
 MapLabels.begin();drawObjects();ExtendedCatalog.draw();
 assert.ok(hitObjects.filter(h=>h.p.x>0&&h.p.x<width&&h.p.y>0&&h.p.y<height&&Math.hypot(h.p.x-width/2,h.p.y-height/2)>=20).length>=10,'at least ten real catalogue objects surround the ship');
 const centred=JSON.stringify(cam);focusShip();assert.equal(followShip,false,'second click disables follow');assert.equal(JSON.stringify(cam),centred,'disabling follow does not move the camera');focusShip();assert.equal(followShip,true,'third click enables follow again');
 const physics=()=>JSON.stringify([state.flight.from,state.flight.aim,state.flight.covered,state.flight.target,state.ship.p3,state.proper,state.earth,state.matter,state.phase]);
 const saved=physics();
 const event={button:0,pointerId:1,clientX:width*.65,clientY:height*.2};
 canvas.listeners.pointerdown(event);canvas.listeners.pointerup(event);
 assert.ok(followShip,'ordinary map click retains the ship anchor');
 assert.equal(followShip,true);assert.equal(physics(),saved,'inspection preserves physical flight state');
 const inspected=JSON.stringify(state);$('starsPreset').onclick();assert.equal(cameraGoal.span,24);assert.equal(JSON.stringify(state),inspected,'zoom input does not edit the flight');
 let frames=0;
 do{
  Simulation.tick(.001);frame(lastFrame+100);frames++;
  const p=screen(state.ship);assert.ok(Math.hypot(p.x-width/2,p.y-height/2)<1e-5,'ship stays centred during the complete Universe-to-stars animation');
 }while(cameraGoal&&frames<60);
 assert.equal(cameraGoal,null,'zoom settles even while the ship moves');assert.equal(cam.span,24);
 canvas.listeners.pointerdown(event);
 canvas.listeners.pointermove({...event,clientX:event.clientX+2});assert.ok(followShip,'pointer jitter is not a map drag');
 canvas.listeners.pointermove({...event,clientX:event.clientX+20});assert.equal(followShip,false,'deliberate panning releases the ship');
 canvas.listeners.pointerup({...event,clientX:event.clientX+20});
}
console.log('PASS actual ship focus, map clicks and star-scale preset handlers: live animated flight stays centred and settles in all modes/widths, pointer jitter retains focus and actual dragging releases it');
}`);
