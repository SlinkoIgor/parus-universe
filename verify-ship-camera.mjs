import fs from 'node:fs';
// Register actual application handlers in the shared VM browser harness.
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]
 .replace('addEventListener(){}','addEventListener(type,handler){(this.listeners??={})[type]=handler;}')
 .replace('const context=','el("starsPreset").dataset.zoom="24";\nconst context=')
 .replace('querySelectorAll:()=>[]',"querySelectorAll:s=>s==='[data-zoom]'?[el('starsPreset')]:[]")+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#ship-camera');
run(fs.readFileSync('dist/universe-map.js','utf8'));
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
for(const viewport of [[1440,855],[390,562]])for(const mode of ['full','slice','radial']){
 [width,height]=viewport;MapSlice.mode=mode;MapLayers.active=false;
 state=initial();state.expansion=false;Cosmology.sync(state);FlightQueue.reset();
 followShip=false;cameraGoal=null;launch(true);paused=true;Simulation.tick(.2);
 cam=UniverseMap.overview();cameraGoal=null;focusShip();assert.equal(followShip,true,'first click centres and follows');const centred=JSON.stringify(cam);focusShip();assert.equal(followShip,false,'second click disables follow');assert.equal(JSON.stringify(cam),centred,'disabling follow does not move the camera');focusShip();assert.equal(followShip,true,'third click enables follow again');
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
