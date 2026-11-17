import fs from 'node:fs';
// Register actual application handlers in the shared VM browser harness.
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]
 .replace('addEventListener(){}','addEventListener(type,handler){(this.listeners??={})[type]=handler;}')
 .replace('const context=','el("starsPreset").dataset.zoom="24";\nconst context=')
 .replace('querySelectorAll:()=>[]',"querySelectorAll:s=>s==='[data-zoom]'?[el('starsPreset')]:[]")+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#selection-zoom');
run(fs.readFileSync('dist/universe-map.js','utf8'));
run(`{
UniverseMap.renderCard=()=>{};
state=initial();state.expansion=false;Cosmology.sync(state);paused=true;MapLayers.active=false;MapSlice.mode='full';
const kinds=new Set(),targets=OBJECTS.filter(o=>{
 if(!o.navigable||o.id==='sol'||kinds.has(o.kind))return false;
 const p=MapLayout.project(o);if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))return false;
 kinds.add(o.kind);return true;
}).slice(0,4);
assert.ok(targets.length>=3,'several kinds of selected objects are covered');
const centre=()=>({x:width/2,y:cameraViewportHeight()/2});
const offset=id=>{const p=screen(object(id)),c=centre();return Math.hypot(p.x-c.x,p.y-c.y);};
const onScreen=id=>{const p=screen(object(id));return p.x>=0&&p.x<=width&&p.y>=0&&p.y<=cameraViewportHeight();};
const placeAt=(id,x,y,span)=>{const p=MapLayout.project(object(id));cam={x:p.x-(x-width*.43)*span/width,y:p.y-(y-mapOriginY())*span/width,span};cameraGoal=null;};
const settle=id=>{let frames=0;do{frame(lastFrame+100);frames++;assert.ok(onScreen(id),id+' stays on screen during the zoom');}while(cameraGoal&&frames<200);assert.equal(cameraGoal,null,'zoom settles');};
for(const [w,h] of [[1440,900],[900,620]])for(const o of targets){
 width=w;height=h;hudHeight=0;followShip=false;state.selected=o.id;
 placeAt(o.id,width*.05,height*.95,130000);$('starsPreset').onclick();assert.equal(cameraGoal.span,24);settle(o.id);
 assert.ok(offset(o.id)<1e-6,'a large preset step centres '+o.id);assert.equal(cam.span,24);
 placeAt(o.id,width*.8,height*.8,130000);$('zoomSlider').listeners.input({target:{value:'1'}});
 assert.equal(cameraGoal,null);assert.ok(offset(o.id)<1e-6,'the slider centres '+o.id);assert.ok(Math.abs(cam.span/24-1)<1e-9);
 for(const deltaY of [-200,200]){
  placeAt(o.id,width*.8,height*.2,24);
  const cursor={preventDefault(){},deltaY,clientX:width*.3,clientY:height*.6},anchor=world(cursor.clientX,cursor.clientY),before=screen(o);
  zoomAtPointer(cursor);const at=screen(anchor);
  assert.equal(cameraGoal,null,'wheel zoom stays immediate');assert.ok(deltaY<0?cam.span<24:cam.span>24);
  assert.ok(Math.hypot(at.x-cursor.clientX,at.y-cursor.clientY)<1e-7,'wheel zoom keeps the cursor anchor');
  assert.ok(Math.hypot(screen(o).x-before.x,screen(o).y-before.y)>1,'wheel zoom does not recentre the selection');
 }
 placeAt(o.id,width*.8,height*.2,24);$('starsPreset').onclick();assert.equal(cameraGoal.focus,undefined,'a preset that does not zoom in keeps the ordinary camera');
 cameraGoal=null;
}
width=1440;height=900;state.selected=targets[0].id;followShip=false;focusShip();
$('zoomSlider').listeners.input({target:{value:'0.5'}});
const ship=screen(state.ship);assert.ok(Math.hypot(ship.x-width/2,ship.y-height/2)<1e-7,'ship following keeps its own anchor');
releaseShipCamera();
console.log('PASS scale-rail zoom-in centres the selected object for '+targets.map(o=>o.kind).join(', ')+' via large preset and slider without leaving the screen; wheel zoom, zoom-out and ship following are unchanged');
}`);
