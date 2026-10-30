import {catalogPath,catalogRoot} from './catalog-path.mjs';
import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';

// Reuse the DOM/canvas harness, without running the unrelated long physics suite.
let harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0];
harness+='\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
context.fetch=async path=>{path=path.split('?')[0];return{ok:fs.existsSync('dist/'+path),json:async()=>JSON.parse(fs.readFileSync('dist/'+path,'utf8'))};};
const manifest=JSON.parse(fs.readFileSync(catalogPath('manifest.json'),'utf8'));
const search=JSON.parse(fs.readFileSync(catalogPath('search.json'),'utf8'));
const ids=new Set(),leaves=new Map();
for(const node of manifest.nodes){
 const rows=JSON.parse(fs.readFileSync(catalogPath(node.file),'utf8'));
 assert.ok(rows.length<257,'bounded tile');
 for(const r of rows){assert.ok(Number.isFinite(r[12])&&Number.isFinite(r[13]),r[0]+' must have a map point');assert.ok(r[3]==null||r[3]>0);}
 if(!node.children.length){leaves.set(node.file,new Set(rows.map(r=>r[0])));for(const r of rows){assert.ok(!ids.has(r[0]));ids.add(r[0]);}}
}
const mapIds=new Set(ids);
for(const file of new Set(search.map(r=>r[5]))){if(leaves.has(file))continue;const rows=JSON.parse(fs.readFileSync(catalogPath(file),'utf8'));leaves.set(file,new Set(rows.map(r=>r[0])));for(const r of rows){assert.ok(r[11].atlasOnly);assert.equal(r[12],null);assert.equal(r[13],null);ids.add(r[0]);}}
assert.equal(ids.size,manifest.extra);assert.equal(search.length,ids.size);
for(const r of search){assert.ok(leaves.get(r[5])?.has(r[0]));assert.equal(mapIds.has(r[0]),!r[7]);}
assert.equal(manifest.sourceCoverage.HYG.represented,119626);assert.equal(manifest.sourceCoverage.OpenNGC.represented,13970);assert.equal(manifest.sourceCoverage.ATNF.represented,4503);
run(`assert.ok(EXTENDED_BOOT.foreground.length<=100);assert.equal(new Set(OBJECTS.flatMap(o=>o.iauNames||[])).size,652);for(const o of OBJECTS){if(o.atlasOnly){assert.equal(MapDetails.visible(o,24),false);continue;}assert.ok(o.navigable,o.id+' must allow arrival');assert.ok(o.p3?.every(Number.isFinite),o.id+' must have a travel anchor');}for(const id of ['laniakea','cfa','sloan','ring','arc','bootes','local-void']){assert.ok(object(id).region);assert.ok(!object(id).atlasOnly);assert.ok(object(id).navigable);}assert.equal(EXTENDED_BOOT.members.length,10);`);
console.log('PASS uncertain records stay searchable but out of spatial tiles; every mapped object has an arrival anchor; megastructures retained');

run('ExtendedCatalog.manifest='+JSON.stringify(manifest));
context.testEntry=search.find(r=>r[0]==='hyg-100000');
await run(`(async()=>{const r=testEntry;var o=await ExtendedCatalog.resolve({id:r[0],tile:r[5]});assert.ok(o.p3.every(Number.isFinite));assert.ok(o.navigable);state=initial();state.selected=o.id;ExtendedCatalog.capture(state);var saved=JSON.parse(JSON.stringify(state));ExtendedCatalog.pinned.clear();state=restore(saved);assert.equal(state.selected,o.id);assert.ok(object(o.id).navigable);assert.ok(state.catalogObjects.length<10);})();`);
context.unknownEntry=search.find(r=>r[4]==='unknown');
await run(`(async()=>{const r=unknownEntry;var o=await ExtendedCatalog.resolve({id:r[0],tile:r[5]});assert.equal(o.navigable,false);assert.equal(o.p3,null);assert.ok(o.atlasOnly);assert.equal(MapDetails.visible(o,24),false);assert.ok(!Number.isFinite(MapLayout.project(o).x));state.selected=o.id;ExtendedCatalog.capture(state);var saved=JSON.parse(JSON.stringify(state));ExtendedCatalog.pinned.clear();state=restore(saved);assert.equal(state.selected,o.id,'unknown selection also survives reload');})();`);
console.log('PASS lazy lookup, finite 3D coordinates, atlas-only unknown positions, bounded saved references and selection restore');

run(`
state=initial();var galaxy=object('bode'),star=ExtendedCatalog.ensureGalaxy(galaxy);assert.ok(star);assert.ok(star.kind==='star');assert.ok(star.synthetic);assert.ok(Space.distance(star,galaxy)<1);
state.current=galaxy.id;state.ship=Space.point(galaxy.p3);state.selected=star.id;state.paused=false;paused=false;speed=1;launch();assert.ok(state.flight);assert.equal(state.flight.boost,false);
var guard=0;while(state.flight&&guard++<100)Simulation.step(1e5);assert.equal(state.current,star.id);assert.ok(canBoost());
state.selected='triangulum';state.flightSetup=FlightSetup.normalize({...FlightSetup.preferred(),burst:true});FlightSetup.sync();launch();assert.ok(state.flight.boost);assert.ok(state.destroyed.includes(star.id));
ExtendedCatalog.capture(state);var saved=JSON.parse(JSON.stringify(state));ExtendedCatalog.pinned.clear();state=restore(saved);assert.ok(object(star.id));assert.equal(state.flight.fromId,star.id);assert.ok(state.flight.boost);
state=initial();state.destroyed=[star.id];var next=ExtendedCatalog.ensureGalaxy(galaxy);assert.ok(next&&next.id!==star.id,'a used fallback star cannot strand the expedition');
`);
console.log('PASS galaxy arrival -> local star -> sail boost, reload during boost, replacement after using a fictional star');

// A hundred background stars at the foreground position must never change labels.
run(`state=initial();resize();cam={x:0,y:0,span:24};MapLabels.begin();drawObjects();drawShip(0);MapLabels.draw();var originalLabels=MapLabels.placed.map(p=>p.key);var base=object('proxima');ExtendedCatalog.visible=Array.from({length:100},(_,i)=>({...base,id:'background-test-'+i,streamed:true,name:'BG '+i}));MapLabels.begin();drawObjects();ExtendedCatalog.draw();drawShip(0);MapLabels.draw();assert.deepEqual(MapLabels.placed.map(p=>p.key),originalLabels);assert.ok(!hitObjects.some(p=>p.background&&p.o.id.startsWith('background-test-')));`);
const leafFiles=[...leaves.keys()].slice(0,65);context.leafFiles=leafFiles;
await run(`(async()=>{ExtendedCatalog.wanted=[];for(const file of leafFiles)await ExtendedCatalog.tile(file);assert.ok(ExtendedCatalog.cache.size<=48);const selection=ExtendedCatalog.nodesForView({x:0,y:0,span:24},1280,720);assert.ok(selection.length<=32);assert.ok(selection.length>0);})();`);
console.log('PASS background cannot hide foreground labels, viewport requests and tile memory stay bounded');

await run(`(async()=>{for(const id of ['proxima','hyg-19799','cygnus','opengc-ngc4038']){const sys=ExtendedCatalog.systemByMember.get(id);assert.ok(sys,'system for '+id);for(const member of sys.members)assert.ok(await ExtendedCatalog.resolve({id:member}));}assert.equal(ExtendedCatalog.systemByMember.get('proxima').members.length,3);})();`);
console.log('PASS known hierarchy, generic multiples, star/black-hole binary and interacting galaxies resolve all components');

// Actual worker protocol: search full data without passing full rows to the UI.
let receiver;const workerContext=vm.createContext({fetch:context.fetch,self:{postMessage:v=>receiver(v)},console});
vm.runInContext(fs.readFileSync('dist/catalog-search-worker.js','utf8'),workerContext);
const query=(term,filter='all',limit=100)=>new Promise(resolve=>{receiver=resolve;workerContext.self.onmessage({data:{seq:1,term,filter,limit,dataRoot:catalogRoot}});});
assert.equal((await query('HYG 100000')).items[0].id,'hyg-100000');
assert.equal((await query('HYG 13')).items[0].id,'hyg-13');
assert.equal((await query('NGC 1')).items[0].id,'opengc-ngc0001');
for(const m of ['M40','M45','M102'])assert.ok((await query(m)).items.some(o=>o.name.includes(m)),m);
assert.ok((await query('NGC 7001')).total>0);
assert.ok((await query('J0002+6216')).total>0);
assert.equal((await query('')).total,manifest.extra);assert.equal((await query('')).items.length,100);
for(const [filter,kind] of [['star','star'],['pulsar','pulsar'],['nebula','nebula'],['galaxy','galaxy'],['stellar-cluster','cluster']]){const result=await query('',filter);assert.equal(result.total,search.filter(r=>(r[8]||r[2])===(filter==='stellar-cluster'?'stellar-cluster':kind)||filter==='stellar-cluster'&&!r[8]&&r[2]==='cluster').length);assert.ok(result.items.every(o=>o.kind===kind));context.filterCheck=filter;context.kindCheck=kind;assert.ok(run(`ExtendedCatalog.matches(kindCheck,filterCheck)`));}
for(const filter of ['blackhole','quasar','horizon'])assert.equal((await query('',filter)).total,0);
for(const filter of ['galaxy-cluster','structure','void'])assert.ok((await query('',filter)).total>500,filter+' has imported observed records');
console.log('PASS real worker search across HYG/OpenNGC/ATNF and bounded result pages');

run(`state=initial();for(const host of ['andromeda','lmc','smc']){const g=object(host),stars=OBJECTS.filter(o=>o.parentGalaxy===host&&o.galaxyMember&&!o.atlasOnly);assert.ok(stars.length>0);assert.ok(stars.every(o=>!o.synthetic&&o.navigable));const found=ExtendedCatalog.ensureGalaxy(g);assert.ok(found.galaxyMember&&!found.synthetic);assert.ok(MapDetails.maxSpan(found)>g.galaxy.diameterLy);assert.ok(MapDetails.visible(found,g.galaxy.diameterLy*2));assert.ok(MapDetails.visible(found,24));}
for(const id of ['vela','sgr','bootes','laniakea','ring','local-void']){const body=object(id),star=ExtendedCatalog.ensureGalaxy(body);assert.ok(star&&star.kind==='star');assert.ok(star.navigable);state.current=id;state.ship=Space.point(body.p3);state.selected=star.id;state.matter=Rocket.initialFuel;state.flight=null;state.beta=0;launch();assert.ok(state.flight,id+' must reach its departure star');var n=0;while(state.flight&&n++<100)Simulation.step(1e9);assert.equal(state.current,star.id);assert.ok(canBoost());}
`);
console.log('PASS actual stars in M31/LMC/SMC and departure stars after arrival at pulsars, black holes, voids and mega-regions');
