import fs from 'node:fs';
import assert from 'node:assert/strict';
import {catalogPath} from './catalog-path.mjs';

const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
const index=JSON.parse(fs.readFileSync(catalogPath('search.json'))),entries=new Map(index.map(r=>[r[0],r]));
const members=new Map(run('EXTENDED_BOOT.members').map(r=>[r[0],r])),files=new Map();
function read(id){
 const entry=entries.get(id);if(!entry)return members.get(id);
 if(!files.has(entry[5]))files.set(entry[5],JSON.parse(fs.readFileSync(catalogPath(entry[5]))));
 return files.get(entry[5]).find(r=>r[0]===id);
}
const cepheids=JSON.parse(fs.readFileSync('data-tools/magellanic-cepheids.json')).objects;
const disk=JSON.parse(fs.readFileSync('data-tools/galaxy-disk-objects.json')).objects;
const boot=run('MAP_LAYER_BOOT');
function structural(category){let n=boot.nodes[boot.roots[category]];while(!n.file)n=boot.nodes[n.children[0]];return JSON.parse(fs.readFileSync('dist/'+boot.dataRoot+'/'+n.file))[0];}
const rows=[...cepheids.filter(m=>m.host==='lmc').slice(0,2).map(m=>read(m.id)),read(cepheids.find(m=>m.host==='smc').id)];
for(const host of ['andromeda','triangulum'])for(const kind of ['star','nebula'])rows.push(read(disk.find(m=>m.host===host&&m.kind===kind).id));
rows.push(structural('stellar-cluster'),structural('galaxy-cluster'));
rows.push(read(index.find(r=>r[2]==='star'&&r[0].startsWith('hyg-')&&!r[7]).at(0)));
rows.push(read(index.find(r=>r[2]==='galaxy'&&!r[7]).at(0)));
assert.ok(rows.every(Boolean));
context.discoveryRows=rows;
context.unlocatedCluster=read(disk.find(m=>m.host==='andromeda'&&m.kind==='cluster').id);

run(`{
 const originals=[...OBJECTS],snapshot=JSON.stringify(discoveryRows),samples=discoveryRows.map(r=>ExtendedCatalog.decode(r));
 samples.push(object('vela'),object('cygnus'));
 state=initial();state.expansion=false;Cosmology.sync(state);state.selected=null;state.current=null;MapLayers.active=true;
 MapLayers.visible=[];MapLayers.visibleMap.clear();for(const c of MapLayers.categories)MapLayers.ready.set(c,true);
 ExtendedCatalog.pinned.clear();OBJECTS.splice(0,OBJECTS.length);
 function chart(objects,obstacle){
  ExtendedCatalog.visible=objects;ExtendedCatalog.visibleMap=new Map(objects.map(o=>[o.id,o]));
  MapLabels.begin();MapLandmarks.ui=[];RegionMap.hits=[];drawObjects();ExtendedCatalog.draw();obstacle?.();MapLabels.draw();
  return hitObjects.filter(h=>h.sparse);
 }
 for(const themeName of ['dark','light'])for(const w of [1440,390])for(const o of samples){
  theme=themeName;filter='all';width=w;height=1000;const p=MapLayout.project(o);cam={x:p.x,y:p.y,span:MapDetails.maxSpan(o)*2};
  assert.ok(MapDetails.discoverable(o),o.id+' has usable source coordinates');assert.equal(MapDetails.visible(o,cam.span),false);
  const hits=chart([o]);assert.equal(hits.length,1,o.id+' remains discoverable in a free area');assert.equal(hits[0].o.id,o.id);
  assert.equal(hitObjects.length,1,'no duplicate primary/background point');
  assert.ok(hits[0].r<=7||!ExtendedCatalog.background(o),'background objects retain compact click targets');
  const point=hits[0].p;
  assert.equal(chart([o],()=>hitObjects.push({o:{kind:'galaxy'},p:point,r:23})).length,0,'larger primary object wins');
  filter=o.kind==='star'?'nebula':'star';assert.equal(chart([o]).length,0,'category filter is respected');filter='all';
 }
 console.log('PASS real stars in LMC/SMC/M31/M33 and Milky Way, nebulae, both cluster classes, galaxies, pulsars and black holes fill free areas beyond class limits; both themes/viewport widths, filters and compact unique hit targets');

 width=1440;height=1000;filter='all';const star=samples.find(o=>o.bulkGalaxyMember&&o.kind==='star'),p=MapLayout.project(star);
 cam={x:p.x,y:p.y,span:MapDetails.maxSpan(star)*2};let point=chart([star])[0].p;
 const polygon=size=>[{x:point.x-size,y:point.y-size},{x:point.x+size,y:point.y-size},{x:point.x+size,y:point.y+size},{x:point.x-size,y:point.y+size},{x:point.x-size,y:point.y-size}];
 assert.equal(chart([star],()=>MapLabels.contours.push({id:'large-host',points:polygon(200),closed:true,container:true})).length,1,'a large galaxy is context for its small contents');
 assert.equal(chart([star],()=>{MapLabels.contours.push({id:'small-host',points:polygon(32),closed:true,container:true});hitObjects.push({o:{kind:'galaxy'},p:point,r:23});}).length,0,'a small galaxy glyph wins over unresolved contents without another zoom threshold');
 assert.equal(chart([star],()=>RegionMap.hits=[{points:polygon(200),closed:true}]).length,0,'cluster/nebula region interior remains occupied');
 assert.equal(chart([star],()=>{const pair=[{x:point.x-100,y:point.y},{x:point.x+100,y:point.y}];RegionMap.hits=[{points:pair,segments:[pair],closed:false}];}).length,0,'filament segments remain occupied');
 const galaxy=samples.find(o=>o.kind==='galaxy'),g=MapLayout.project(galaxy);cam={x:g.x,y:g.y,span:MapDetails.maxSpan(galaxy)*2};point=chart([galaxy])[0].p;
 assert.equal(chart([galaxy],()=>MapLabels.contours.push({id:'other-galaxy',points:polygon(200),closed:true,container:true})).length,0,'a competing galaxy cannot fill another galaxy contour');
 cam={x:p.x,y:p.y,span:1e9};MapLayers.ready.set('filament',false);
 assert.equal(chart([star]).length,0,'loading coarse context cannot look like free space');MapLayers.ready.set('filament',true);
 const pair=samples.filter(o=>o.parentGalaxy==='lmc'&&o.kind==='star'),first=chart(pair).map(h=>h.o.id);
 assert.equal(first.length,1,'coincident survey stars become one spaced representative');assert.deepEqual(chart([...pair].reverse()).map(h=>h.o.id),first,'source order cannot change the representative');
 for(const factor of [.99,1.01]){cam.span=1e9*factor;assert.deepEqual(chart(pair).map(h=>h.o.id),first,'small zoom changes retain the same representative');}
 const polaris=originals.find(o=>o.id==='polaris');cam={x:0,y:0,span:1e9};assert.deepEqual(chart([...pair,polaris]).map(h=>h.o.id),['polaris'],'curated object retains priority among sparse objects of the same class');
 console.log('PASS large galaxy background admits compact details, small galaxies/regions/spines/primary points keep priority, coarse loading blocks false gaps and sparse representatives are deterministic');

 const phat=ExtendedCatalog.decode(unlocatedCluster);assert.ok(phat.atlasOnly);assert.equal(MapDetails.discoverable(phat),false);
 for(const fields of [{synthetic:true},{atlasOnly:true},{positionQuality:'unknown'},{navigable:false},{p3:null},{p3:[]},{p3:[NaN,0,0]}])assert.equal(MapDetails.discoverable({...star,...fields}),false);
 assert.equal(MapDetails.sparse({kind:'structure',cosmicSubtype:'filament',p3:[0,0,0],navigable:true},1e11),false,'explicit filament cutoff is never bypassed');
 state.selected=star.id;ExtendedCatalog.pin(star);ExtendedCatalog.capture(state);const saved=JSON.parse(JSON.stringify(state)),position=JSON.stringify(star.p3);
 state=restore(saved);assert.equal(state.selected,star.id);assert.equal(JSON.stringify(object(star.id).p3),position);
 assert.equal(JSON.stringify(discoveryRows),snapshot,'display policy preserves source rows');OBJECTS.splice(0,OBJECTS.length,...originals);
 console.log('PASS catalogue-only/unknown/game safeguards and filament cutoff remain intact; a newly discoverable source object retains selection and physical position through save restoration');
}`);
