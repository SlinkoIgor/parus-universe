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
 const filament={kind:'structure',cosmicSubtype:'filament'},end=150e6*width/128;
 const fade=[.6,.7,.8,.9,.99,1].map(f=>MapDetails.opacity(filament,end*f));assert.equal(fade[0],1);assert.equal(fade.at(-1),0);for(let i=1;i<fade.length;i++)assert.ok(fade[i]<fade[i-1]);assert.ok(Math.abs(fade[2]-.5)<1e-12);
 // A first press centres the ship. Every zoom input must preserve that anchor.
 followShip=false;shipFocusArmed=false;cam={x:100,y:200,span:24};focusShip();assert.equal(shipFocusArmed,true);
 for(const deltaY of [-100,100,220,-220]){zoomAtPointer({preventDefault(){},deltaY,clientX:30,clientY:200});const p=screen(state.ship);assert.ok(Math.hypot(p.x-width/2,p.y-height/2)<1e-7);}
 const c=shipCamera(.01);goCamera(cam.x,cam.y,.01,true,true);assert.ok(Math.hypot(cam.x-c.x,cam.y-c.y)<1e-12);releaseShipCamera();
 // Every orbit in radial is exactly the ordinary XY ellipse plus one translation.
 MapRadial.manifest=radialManifest;
 for(const years of [0,40,200000]){
  state.universeElapsed=years;const tracks={};
  MapSlice.setMode('full');for(const id of ['alpha','hyg-71453','proxima'])tracks[id]=OrbitalMotion.alphaTrack(id);
  MapSlice.setMode('radial');for(const id of Object.keys(tracks)){const radial=OrbitalMotion.alphaTrack(id),plain=tracks[id],dx=radial.points[0].x-plain.points[0].x,dy=radial.points[0].y-plain.points[0].y;assert.equal(radial.points.length,plain.points.length);for(let i=0;i<plain.points.length;i++)assert.ok(Math.hypot(radial.points[i].x-plain.points[i].x-dx,radial.points[i].y-plain.points[i].y-dy)<1e-10,'ellipse shape preserved for '+id);}
 }
 state.universeElapsed=0;state.selected='alpha';const trace=OrbitalMotion.trace;
 for(const mode of ['full','slice','radial']){cam={...MapLayout.project(object('alpha')),span:.002};MapSlice.setMode(mode);let n=0;OrbitalMotion.trace=points=>{if(['alpha','hyg-71453'].some(id=>{const p=MapLayout.project(object(id));return points.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<1e-11)}))n++;};OrbitalMotion.draw();assert.equal(n,2,'both A/B tracks immediately drawn in '+mode);}
 OrbitalMotion.trace=trace;MapSlice.setMode('full');
}`);
console.log('PASS retained viewport detail, readiness during pan, smooth filament fade, first-click ship zoom anchoring and XY ellipses with immediate AB tracks in all modes');
