import fs from 'node:fs';
let harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0];
harness=harness.replaceAll('addEventListener(){}','addEventListener(name,fn){this.listeners??={};this.listeners[name]=fn;}');
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness+'\nexport {run};')+'#route-search');
await run(`(async()=>{
const reset=()=>{Route.cancelFeedback();state=initial();state.expansion=false;paused=true;FlightQueue.reset();Cosmology.sync(state);followShip=false;cameraGoal=null;$('infoDialog').close();closeCatalog();};
const forecast=MissionPlanner.preview,analysis=Route.analyze,focus=ExtendedCatalog.focus,show=Route.show;
MissionPlanner.preview=()=>MissionPlanner.invalid('Test forecast');
Route.analyze=()=>({valid:true,records:[],proper:1,earth:2});
let focused=0;ExtendedCatalog.focus=()=>focused++;
Route.show=()=>{throw Error('Search must return to the map');};
const choose=async(id,shiftKey=false)=>{catalogRows([object(id)],1);await $('catalogList').children[0].listeners.click({shiftKey});};
const contained=()=>{
 const next=cameraGoal||cam,previous=cam;cam=next;
 const v=routeViewport(true),objects=Route.nodes().flatMap(n=>[object(n.id),Route.endpoint(n)]);
 for(const o of [state.ship,...objects]){
  const p=screen(o);assert.ok(p.x>=v.left&&p.x<=v.right&&p.y>=v.top&&p.y<=v.bottom,JSON.stringify({id:o.id,p,v,next}));
  if(MapSlice.mode==='slice')assert.ok(MapSlice.includes(o),'route point must be inside the physical slice');
 }
 cam=previous;
};
for(const size of [{w:1440,h:1000,cardLeft:1114,cardTop:400},{w:390,h:844,cardLeft:16,cardTop:450}]){
 width=size.w;height=size.h;hudHeight=size.w<700?125:94;
 $('flightCard').getBoundingClientRect=()=>({left:size.cardLeft,top:size.cardTop});
 for(const mode of ['full','slice','radial']){
  reset();MapSlice.mode=mode;cam={x:1e11,y:-1e11,span:1e11};
  state.itinerary=[{id:'alpha',mode:'stop'},{id:'sgr',mode:'flyby'}];state.selected='sgr';
  show.call(Route);$('addRoutePoint').onclick();assert.equal(Route.picking,true);assert.equal($('catalog').hidden,false);
  await choose('m87');assert.equal(state.itinerary.map(n=>n.id).join(),'alpha,sgr,m87');
  assert.equal(Route.picking,false);assert.equal($('catalog').hidden,true);assert.equal($('infoDialog').open,false);
  assert.ok(cameraGoal.span<1e11,'route framing also zooms in from the Universe');contained();
  // An existing waypoint outside the new ship-to-target segment must stay in view.
  cam={x:0,y:0,span:.001};cameraGoal=null;state.itinerary=[{id:'m87',mode:'stop'},{id:'sgr',mode:'flyby'}];state.selected='sgr';
  show.call(Route);$('addRoutePoint').onclick();await choose('barnard',true);
  assert.equal(state.itinerary.map(n=>n.id).join(),'m87,sgr,barnard');contained();
 }
}
const query=document.querySelectorAll;
for(const w of [320,390,1440]){
 width=w;height=w===1440?1000:w===320?700:844;hudHeight=w===1440?94:282;
 const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height}),
  panels=w===1440?[rect(24,28,400,80),rect(1070,25,344,36),rect(24,157,170,424),rect(24,800,120,40),rect(1104,412,310,419)]:[rect(18,20,85,10),rect(w-276,45,260,29),rect(18,86,143,36),rect(169,99,w-187,23),rect(w-308,w===320?143:168,296,w===320?263:382)];
 document.querySelectorAll=s=>s.startsWith('.flight-card,')?panels.map(r=>({getBoundingClientRect:()=>r})):query(s);
 reset();MapSlice.mode='full';state.itinerary=[{id:'m87',mode:'flyby'},{id:'sgr',mode:'flyby'}];state.selected='sgr';
 show.call(Route);$('addRoutePoint').onclick();await choose('barnard');contained();
 const previous=cam;cam=cameraGoal;
 for(const o of [state.ship,...Route.nodes().map(n=>object(n.id))]){
  const p=screen(o);
  for(const r of panels)assert.ok(p.x+18<=r.left||p.x-18>=r.right||p.y+18<=r.top||p.y-18>=r.bottom,'waypoint rings must clear the card and controls');
 }
 cam=previous;
}
document.querySelectorAll=query;
console.log('PASS 320/390/1440px framing keeps whole waypoint rings clear of the card, heading and map controls');
assert.equal(focused,0,'adding through search never focuses only the chosen object');
reset();await choose('barnard');assert.equal(focused,1);assert.equal(state.itinerary.length,0,'ordinary search remains an object selection');
reset();await choose('barnard',true);assert.equal(state.itinerary.map(n=>n.id).join(),'alpha,barnard','Shift from search includes the initially selected Alpha');
const point=id=>{const pick=pickMapTarget;pickMapTarget=()=>({id});pointer={down:true,moved:false,id:1};canvas.listeners.pointerup({pointerId:1,shiftKey:false});pickMapTarget=pick;Route.flushFeedback();};
const label=()=>$('launchBtn').querySelector('span').textContent;
reset();state.itinerary=[{id:'sgr',mode:'flyby'}];select('sgr');
assert.equal(label(),'Добавить точку');assert.equal($('launchBtn').disabled,true);
launchSelectedTarget();assert.equal(state.itinerary.length,1);assert.equal(Route.picking,false);assert.equal($('catalog').hidden,true,'an unselected next-point action never opens search');
for(const id of ['sgr',OBJECTS.find(o=>!o.navigable).id]){point(id);assert.equal($('launchBtn').disabled,true,'same/unknown target cannot complete a flyby');}
point('barnard');assert.equal(label(),'Добавить точку');assert.equal($('launchBtn').disabled,false);assert.equal(state.itinerary.length,1,'ordinary map selection does not append');
$('launchBtn').onclick({});assert.equal(state.itinerary.map(n=>n.id).join(),'sgr,barnard');assert.equal(state.flight,null);assert.equal($('catalog').hidden,true);Route.flushFeedback();
assert.equal(label(),'Начать маршрут');assert.equal($('launchBtn').disabled,false);
const start=Route.start;let starts=0;Route.start=()=>starts++;$('launchBtn').onclick();assert.equal(starts,1);Route.start=start;
reset();state.itinerary=[{id:'sgr',mode:'flyby'}];select('sgr');openCatalog();await choose('barnard');
assert.equal(state.itinerary.length,1);assert.equal(label(),'Добавить точку');assert.equal($('launchBtn').disabled,false);
state=restore(JSON.parse(JSON.stringify(state)));renderUI();assert.equal($('launchBtn').disabled,false,'a saved selection still enables confirmation');
$('launchBtn').onclick();assert.equal(state.itinerary.map(n=>n.id).join(),'sgr,barnard');assert.equal(label(),'Начать маршрут');assert.equal(state.flight,null);
reset();state.itinerary=[{id:'sgr',mode:'flyby'}];select('sol');assert.equal($('launchBtn').disabled,false,'return to departure is a valid next point');
select('m87');$('launchBtn').onclick();assert.equal(state.itinerary.map(n=>n.id).join(),'sgr,m87');assert.equal(label(),'Добавить точку');assert.equal($('launchBtn').disabled,true,'another flyby waits for its own next selection');
state.itinerary=[...Array.from({length:Route.limit-1},()=>({id:'alpha',mode:'stop'})),{id:'sgr',mode:'flyby'}];select('barnard');assert.equal($('launchBtn').disabled,true,'no enabled confirmation beyond route capacity');
console.log('PASS pending flyby is disabled by default, ordinary map/search selects without appending, explicit confirmation adds once and changes to Start, with reload/return/capacity guards');
MissionPlanner.preview=forecast;Route.analyze=analysis;ExtendedCatalog.focus=focus;Route.show=show;
console.log('PASS actual next-point button and catalogue handlers append once without a dialog/object focus, fit every waypoint in desktop/mobile and full/slice/radial, and preserve ordinary search');
reset();MapSlice.mode='full';width=1440;height=1000;hudHeight=94;
select('alpha');launch();paused=true;
const physical=()=>JSON.stringify([state.flight.mission,state.flight.from,state.ship,state.beta,state.matter,state.proper,state.earth]),before=physical();
Route.show();$('addRoutePoint').onclick();await choose('sirius');
assert.equal(state.flight.route.map(n=>n.id).join(),'alpha,sirius');assert.equal(physical(),before);
assert.equal($('infoDialog').open,false);contained();
persist();const saved=JSON.parse(JSON.stringify(state));state=restore(saved);assert.equal(JSON.stringify(state.flight),JSON.stringify(saved.flight));
console.log('PASS the editor search action also returns to the complete route, appends after the executing leg, preserves flight physics and survives save/reload');
})()`);
