import fs from 'node:fs';
import assert from 'node:assert/strict';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
const boot=run('MAP_LAYER_BOOT'),files=new Map();
context.loadLayers=file=>{if(!files.has(file))files.set(file,JSON.parse(fs.readFileSync('dist/'+boot.dataRoot+'/'+file)));return files.get(file);};
run(`{
state=initial();state.expansion=false;Cosmology.sync(state);filter='all';width=1440;height=1000;MapLayers.active=true;
const landmarkCoordinates=JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition]));
function settleLandmarkLayers(){MapLayers.lastUpdate=-Infinity;for(const files of MapLayers.filesForView(cam,width,height).values())for(const file of files)if(!MapLayers.cache.has(file))MapLayers.cache.set(file,loadLayers(file).map(r=>ExtendedCatalog.decode(r)));MapLayers.update(performance.now());}
function landmarkChart(){MapLabels.begin();drawGalaxyBackground();RegionMap.draw();drawHorizonBoundary();drawReachability();drawObjects();ExtendedCatalog.draw();drawShip(0);MapLabels.draw();return hitObjects.filter(h=>h.sparse).map(h=>h.o.id);}
for(const mode of ['dark','light']){
 theme=mode;
 for(const span of [1.14e11,1.15e11,1.16e11]){cam={x:0,y:0,span};settleLandmarkLayers();const ids=landmarkChart();for(const id of ['mom-z14','jades-z14'])assert.ok(ids.includes(id),id+' remains at universe scale '+span);assert.deepEqual(landmarkChart(),ids,'fixed view is deterministic');}
}
cam={x:0,y:0,span:2500};settleLandmarkLayers();const sparseStars=landmarkChart().filter(id=>object(id).kind==='star');assert.ok(sparseStars.length>0,'real named stars fill gaps after the stellar cutoff');
for(const id of sparseStars){assert.equal(MapDetails.visible(object(id),cam.span),false);assert.ok(MapDetails.landmark(object(id)));}
// Exceptions cannot displace any ordinary point, contour or label, even labels
// below their own class. Compare two complete render passes over real data.
const standard=()=>JSON.stringify({points:hitObjects.filter(h=>!h.sparse).map(h=>h.o.id),regions:RegionMap.hits.map(h=>h.o.id),labels:MapLabels.placed.filter(q=>!MapLabels.queue.find(l=>l.key===q.key)?.sparse)});
landmarkChart();const withLandmarks=standard(),originalLandmark=MapDetails.landmark;MapDetails.landmark=()=>false;landmarkChart();assert.equal(standard(),withLandmarks);MapDetails.landmark=originalLandmark;
for(const span of [129000,130000,131000]){cam={x:0,y:0,span};settleLandmarkLayers();landmarkChart();assert.equal(hitObjects.filter(h=>h.o.kind==='star'||h.o.kind==='home').length,0,'no stellar cloud returns on the Milky Way overview');}
filter='structure';cam={x:0,y:0,span:1.15e11};settleLandmarkLayers();landmarkChart();assert.ok(!hitObjects.some(h=>h.sparse),'class filters also apply to exceptions');
filter='galaxy';settleLandmarkLayers();landmarkChart();assert.ok(hitObjects.some(h=>h.o.id==='mom-z14'));assert.ok(hitObjects.every(h=>h.o.kind==='galaxy'));
filter='all';cam={x:0,y:0,span:2500};settleLandmarkLayers();MapLayers.ready.set('stellar-cluster',false);landmarkChart();assert.ok(!hitObjects.some(h=>h.sparse&&h.o.kind==='star'),'exceptions wait for the full coarser context');
MapLayers.ready.set('stellar-cluster',true);
cam={x:0,y:0,span:1e9};settleLandmarkLayers();MapLayers.ready.set('filament',false);assert.equal(MapLayers.admits(object('polaris')),false,'landmarks wait for visible filaments');assert.equal(MapLayers.admits(object('omega')),false,'curated managed clusters also wait for visible filaments');
width=390;assert.equal(MapLayers.admits(object('polaris')),true,'resize hides the filament class without blocking landmarks');width=1440;assert.equal(MapLayers.admits(object('polaris')),false,'resize restores visible context dependency');
cam.span=1.15e11;settleLandmarkLayers();MapLayers.ready.set('filament',false);assert.equal(MapLayers.admits(object('polaris')),true,'universe-scale landmarks do not wait for hidden filaments');assert.equal(MapLayers.admits(object('omega')),true);MapLayers.ready.set('filament',true);
for(const id of ['polaris','andromeda','orion','omega','cygnus','crab','mom-z14'])assert.ok(MapDetails.landmark(object(id)),id+' is curated across classes');
for(const o of [{...object('polaris'),synthetic:true},{...object('polaris'),bulkGalaxyMember:true},{...object('polaris'),atlasOnly:true},{...object('polaris'),nuclearStar:true},{...object('polaris'),streamed:true,messier:null,cosmicLandmark:false}])assert.equal(MapDetails.landmark(o),false,'bulk/unknown/game objects do not become landmarks');
assert.equal(JSON.stringify(OBJECTS.map(o=>[o.id,o.p3,o.mapPosition])),landmarkCoordinates,'rendering never changes source positions');
console.log('PASS distant galaxies at universe scale, sparse named stars, class filters, coarser loading, deterministic placement, both themes and unchanged source positions');

// Controlled screen obstacles around a real star exercise lines, filled areas,
// labels, foreground/background glyphs and the same cache used by normal frames.
const originals=[...OBJECTS],star=object('polaris'),p3=MapLayout.project(star);OBJECTS.splice(0,OBJECTS.length,star);ExtendedCatalog.visible=[];ExtendedCatalog.pinned.clear();MapLayers.active=false;MapLayers.visible=[];state.selected=null;state.current=null;cam={x:p3.x,y:p3.y,span:2500};const p=screen(star);
function isolated(obstacle){MapLabels.begin();RegionMap.hits=[];drawObjects();obstacle?.();MapLabels.draw();return hitObjects.some(h=>h.o.id===star.id);}
assert.ok(isolated(),'isolated important star survives its class boundary');
for(const background of [false,true])assert.equal(isolated(()=>hitObjects.push({o:{id:'occupied'},p:{...p},r:background?5:23,background})),false,'occupied glyph beats the exception');
const polygon=[{x:p.x-200,y:p.y-200},{x:p.x+200,y:p.y-200},{x:p.x+200,y:p.y+200},{x:p.x-200,y:p.y+200},{x:p.x-200,y:p.y-200}];
assert.equal(isolated(()=>RegionMap.hits=[{points:polygon,closed:true}]),false,'interior of a coarse region is occupied');
assert.equal(isolated(()=>MapLabels.contours.push({id:'galaxy-disk',points:polygon,closed:true})),false,'interior of a galaxy disk is occupied');
assert.equal(isolated(()=>{const pair=[{x:p.x-100,y:p.y},{x:p.x+100,y:p.y}];RegionMap.hits=[{points:pair,segments:[pair],closed:false}];}),false,'visible filament segment beats the exception');
assert.equal(isolated(()=>MapLabels.add({key:'coarse',name:'PRIMARY',level:4,priority:20,candidates:[{x:p.x+5,y:p.y}]})),false,'primary label beats the exception');
assert.ok(isolated(()=>MapLabels.add({key:'label-only',name:'PRIMARY',level:4,priority:20,candidates:[{x:p.x+120,y:p.y-18}]})),'a label conflict alone preserves the clickable marker');
assert.ok(!MapLabels.placed.some(q=>q.key==='object-'+star.id),'conflicting secondary caption remains hidden');
assert.ok(isolated(),'removing occupied content restores the exception');
assert.ok(isolated(()=>MapLabels.add({key:'ship',name:'MOVING SHIP',priority:100,candidates:[{x:p.x+5,y:p.y}]})),'moving flight captions cannot displace fixed atlas exceptions');
OBJECTS.splice(0,OBJECTS.length,...originals);
// A saved landmark retains its original navigation target and 3D position.
state=initial();state.selected='mom-z14';ExtendedCatalog.capture(state);const saved=JSON.parse(JSON.stringify(state)),before=JSON.stringify(object('mom-z14').p3);state=restore(saved);assert.equal(state.selected,'mom-z14');assert.equal(JSON.stringify(object('mom-z14').p3),before);
console.log('PASS sparse markers yield to actual glyphs, filament segments, region/galaxy interiors and primary labels; label-only collisions keep the marker; selection survives reload');
}`);
