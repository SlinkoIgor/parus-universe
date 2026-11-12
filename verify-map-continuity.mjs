import fs from 'node:fs';import assert from 'node:assert/strict';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#continuity');
context.radialManifest=JSON.parse(fs.readFileSync('dist/'+JSON.parse(fs.readFileSync('dist/map-radial/current.json')).dataRoot+'/manifest.json'));
run(`{
 state=initial();paused=true;state.expansion=false;Cosmology.sync(state);MapSlice.setMode('full');MapLayers.active=false;width=1440;height=1000;cam={x:0,y:0,span:24};cameraGoal=null;
 ExtendedCatalog.transitions.clear();
 const a={id:'continuity-a',kind:'star',p3:[1,1,0],mapPosition:{x:1,y:-1}},b={id:'continuity-b',kind:'star',p3:[2,1,0],mapPosition:{x:2,y:-1}};
 ExtendedCatalog.adoptCut([a,b],0);ExtendedCatalog.advanceVisibility(1000);assert.equal(ExtendedCatalog.transitions.get(a.id).alpha,1);
 for(const [x,span] of [[1,24],[1,24.1],[2,23.9]]){cam={x,y:0,span};ExtendedCatalog.adoptCut([b],1200);ExtendedCatalog.advanceVisibility(2200);assert.equal(ExtendedCatalog.transitions.get(a.id).alpha,1,'pan/zoom cannot replace already visible representatives');}
 cam.x=10000;ExtendedCatalog.adoptCut([b],3000);ExtendedCatalog.advanceVisibility(4500);assert.equal(ExtendedCatalog.transitions.has(a.id),false,'offscreen history is released');
 MapLayers.active=true;const enabled=MapLayers.enabled;MapLayers.enabled=()=>true;MapLayers.admitted.clear();MapLayers.ready.clear();
 const known={id:'known-detail',kind:'star'},fresh={id:'fresh-detail',kind:'star'};assert.equal(MapLayers.admits(known),false);MapLayers.ready.set('stellar-cluster',true);MapLayers.ready.set('nebula',true);assert.equal(MapLayers.admits(known),true);MapLayers.ready.clear();assert.equal(MapLayers.admits(known),true,'a pending pan cannot hide admitted detail');assert.equal(MapLayers.admits(fresh),false,'initial detail still waits for its context');MapLayers.enabled=enabled;MapLayers.active=false;
 const filament={kind:'structure',cosmicSubtype:'filament'},end=2.7e9*width/1440;
 const fade=[.6,.7,.8,.9,.99,1].map(f=>MapDetails.opacity(filament,end*f));assert.equal(fade[0],1);assert.equal(fade.at(-1),0);for(let i=1;i<fade.length;i++)assert.ok(fade[i]<fade[i-1]);assert.ok(Math.abs(fade[2]-.5)<1e-12);
 // A first press centres the ship. Every zoom input must preserve that anchor.
 followShip=false;cam={x:100,y:200,span:24};focusShip();assert.equal(followShip,true);
 for(const deltaY of [-100,100,220,-220]){zoomAtPointer({preventDefault(){},deltaY,clientX:30,clientY:200});const p=screen(state.ship);assert.ok(Math.hypot(p.x-width/2,p.y-height/2)<1e-7);}
 const c=shipCamera(.01);goCamera(cam.x,cam.y,.01,true,true);assert.ok(Math.hypot(cam.x-c.x,cam.y-c.y)<1e-12);releaseShipCamera();
 // Wheel zoom can fit the whole atlas after expansion, including a frozen late
 // epoch. The preset rail stays fixed; the camera and ship focus may go beyond it.
 const expedition=JSON.stringify(state),presets=JSON.stringify(zoomStops);
 for(const size of [[1440,1000],[390,844]])for(const epoch of [0,15e9,100e9,1e12])for(const expanding of [true,false]){
  [width,height]=size;state.cosmicTime=epoch;state.expansion=expanding;Cosmology.sync(state);
  const physics=JSON.stringify(state),radius=46.5e9*Cosmology.scale();
  cam={x:0,y:0,span:1.4e11};cameraGoal=null;
  const pointer={preventDefault(){},deltaY:220,clientX:width*.43,clientY:height*(width<700?.39:.50)};
  let steps=0;
  do{zoomAtPointer(pointer);steps++;}while(radius*width/cam.span>Math.min(width*.4,height*.35)&&steps<100);
  assert.ok(steps<100,'the expanded atlas fits without reaching the old zoom cap');
  assert.ok(Number.isFinite(cam.span)&&cam.span>1.4e11,'wheel can continue beyond the fixed preset rail');
  const centre=screen(object('sol')),r=radius*width/cam.span;
  assert.ok(centre.x-r>=0&&centre.x+r<=width&&centre.y-r>=0&&centre.y+r<=height,'the whole atlas boundary fits');
  for(const o of OBJECTS.filter(o=>o.p3&&!o.atlasOnly)){
   const p=screen(o);assert.ok(p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height,'catalogue position fits: '+o.id);
  }
  const span=cam.span;focusShip();assert.ok(cam.span<span,'centring restores the ship surroundings from the expanded overview');releaseShipCamera();
  goCamera(cam.x,cam.y,span*2,true);assert.equal(cam.span,span*2,'camera navigation can retain wide views');
  assert.ok(Number.isFinite(gridMetrics().majorPixels));updateZoomControl();
  assert.equal($('zoomSlider').value,'5.15','the unchanged slider rests at its upper endpoint');
  // Return to the solar neighbourhood with the existing atlas navigation.
  ExtendedCatalog.focus(object('sol'));assert.equal(cameraGoal.span,24);assert.equal(cameraGoal.x,0);assert.equal(cameraGoal.y,0);
  assert.equal(JSON.stringify(state),physics,'camera actions never advance or edit the expedition');
 }
 state=JSON.parse(expedition);Cosmology.sync(state);width=1440;height=1000;cameraGoal=null;cam={x:0,y:0,span:24};
 const cursor={preventDefault(){},deltaY:220,clientX:width*.71,clientY:height*.32},anchor=world(cursor.clientX,cursor.clientY);
 for(let i=0;i<30;i++)zoomAtPointer(cursor);
 const at=screen(anchor);assert.ok(Math.hypot(at.x-cursor.clientX,at.y-cursor.clientY)<1e-7,'wheel keeps its cursor anchor beyond the old cap');
 for(let i=0;i<30;i++)zoomAtPointer({...cursor,deltaY:-220});assert.ok(Math.abs(cam.span/24-1)<1e-12);
 assert.equal(JSON.stringify(zoomStops),presets);
 cam={x:0,y:0,span:24};cameraGoal=null;
 // Every orbit in radial is exactly the ordinary XY ellipse plus one translation.
 MapRadial.manifest=radialManifest;
 for(const years of [0,40,200000]){
  state.universeElapsed=years;const tracks={};
  MapSlice.setMode('full');for(const id of ['alpha','hyg-71453','proxima'])tracks[id]=OrbitalMotion.alphaTrack(id);
  MapSlice.setMode('radial');for(const id of Object.keys(tracks)){const radial=OrbitalMotion.alphaTrack(id),plain=tracks[id],dx=radial.points[0].x-plain.points[0].x,dy=radial.points[0].y-plain.points[0].y;assert.equal(radial.points.length,plain.points.length);for(let i=0;i<plain.points.length;i++)assert.ok(Math.hypot(radial.points[i].x-plain.points[i].x-dx,radial.points[i].y-plain.points[i].y-dy)<1e-10,'ellipse shape preserved for '+id);}
 }
 state.universeElapsed=0;state.selected='alpha';const trace=OrbitalMotion.traceCurve;
 for(const mode of ['full','radial']){cam={...MapLayout.project(object('alpha')),span:.002};MapSlice.setMode(mode);let n=0;OrbitalMotion.traceCurve=(pointAt,{knots})=>{if(['alpha','hyg-71453'].some(id=>{const p=MapLayout.project(object(id));return knots.some(E=>{const q=pointAt(E);return Math.hypot(p.x-q.x,p.y-q.y)<1e-11;})}))n++;};OrbitalMotion.draw();assert.equal(n,2,'both A/B tracks immediately drawn in '+mode);}
 OrbitalMotion.traceCurve=trace;MapSlice.setMode('full');
}`);
console.log('PASS retained viewport detail, readiness during pan, smooth filament fade, expanded-universe wheel zoom and solar return, ship/cursor anchoring and XY ellipses with immediate AB tracks in all modes');
