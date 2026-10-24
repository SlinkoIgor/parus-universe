import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';

// Reuse the DOM/canvas harness, without running the unrelated long physics suite.
let harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0];
harness+='\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
context.fetch=async path=>{path=path.split('?')[0];return{ok:fs.existsSync('dist/'+path),json:async()=>JSON.parse(fs.readFileSync('dist/'+path,'utf8'))};};
const manifest=JSON.parse(fs.readFileSync('dist/catalog-data/manifest.json','utf8'));
const search=JSON.parse(fs.readFileSync('dist/catalog-data/search.json','utf8'));
const ids=new Set(),leaves=new Map();
for(const node of manifest.nodes){
 const rows=JSON.parse(fs.readFileSync('dist/catalog-data/'+node.file,'utf8'));
 assert.ok(rows.length<257,'bounded tile');
 for(const r of rows){assert.ok(Number.isFinite(r[12])&&Number.isFinite(r[13]),r[0]+' must have a map point');assert.ok(r[3]==null||r[3]>0);}
 if(!node.children.length){leaves.set(node.file,new Set(rows.map(r=>r[0])));for(const r of rows){assert.ok(!ids.has(r[0]));ids.add(r[0]);}}
}
assert.equal(ids.size,137128);assert.equal(search.length,ids.size);
for(const r of search)assert.ok(leaves.get(r[5])?.has(r[0]),r[0]+' must resolve from search');
assert.equal(manifest.total,138194);assert.equal(manifest.sourceCoverage.HYG.represented,119626);assert.equal(manifest.sourceCoverage.OpenNGC.represented,13970);assert.equal(manifest.sourceCoverage.ATNF.represented,4503);
run(`assert.ok(EXTENDED_BOOT.foreground.length<=100);assert.equal(new Set(OBJECTS.flatMap(o=>o.iauNames||[])).size,652);for(const o of OBJECTS)assert.ok(Number.isFinite(MapLayout.project(o).x)&&Number.isFinite(MapLayout.project(o).y),o.id+' has map position');assert.ok(object('alpha').name.includes('Центавра A'));assert.ok(object('proxima').name.includes('Центавра C'));`);
console.log('PASS all 138194 records represented, every search entry resolves to a leaf, all tiles bounded, unknown points mapped');

run('ExtendedCatalog.manifest='+JSON.stringify(manifest));
context.testEntry=search.find(r=>r[0]==='hyg-100000');
await run(`(async()=>{const r=testEntry;var o=await ExtendedCatalog.resolve({id:r[0],tile:r[5]});assert.ok(o.p3.every(Number.isFinite));assert.ok(o.navigable);state=initial();state.selected=o.id;ExtendedCatalog.capture(state);var saved=JSON.parse(JSON.stringify(state));ExtendedCatalog.pinned.clear();state=restore(saved);assert.equal(state.selected,o.id);assert.ok(object(o.id).navigable);assert.ok(state.catalogObjects.length<10);})();`);
context.unknownEntry=search.find(r=>r[4]==='unknown');
await run(`(async()=>{const r=unknownEntry;var o=await ExtendedCatalog.resolve({id:r[0],tile:r[5]});assert.equal(o.navigable,false);assert.equal(o.p3,null);assert.ok(Number.isFinite(MapLayout.project(o).x));state.selected=o.id;ExtendedCatalog.capture(state);var saved=JSON.parse(JSON.stringify(state));ExtendedCatalog.pinned.clear();state=restore(saved);assert.equal(state.selected,o.id,'unknown selection also survives reload');})();`);
console.log('PASS lazy lookup, finite 3D coordinates, unknown-position display, bounded saved references and selection restore');

run(`
state=initial();var galaxy=object('andromeda'),star=ExtendedCatalog.ensureGalaxy(galaxy);assert.ok(star);assert.ok(star.kind==='star');assert.ok(star.synthetic);assert.ok(Space.distance(star,galaxy)<1);
state.current=galaxy.id;state.ship=Space.point(galaxy.p3);state.selected=star.id;state.paused=false;paused=false;speed=1;launch();assert.ok(state.flight);assert.equal(state.flight.boost,false);
var guard=0;while(state.flight&&guard++<100)Simulation.step(1e5);assert.equal(state.current,star.id);assert.ok(canBoost());
state.selected='triangulum';launch();assert.ok(state.flight.boost);assert.ok(state.destroyed.includes(star.id));
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
const query=(term,filter='all',limit=100)=>new Promise(resolve=>{receiver=resolve;workerContext.self.onmessage({data:{seq:1,term,filter,limit}});});
assert.equal((await query('HYG 100000')).items[0].id,'hyg-100000');
assert.equal((await query('HYG 13')).items[0].id,'hyg-13');
assert.equal((await query('NGC 1')).items[0].id,'opengc-ngc0001');
for(const m of ['M40','M45','M102'])assert.ok((await query(m)).items.some(o=>o.name.includes(m)),m);
assert.ok((await query('NGC 7001')).total>0);
assert.ok((await query('J0002+6216')).total>0);
assert.equal((await query('')).total,137128);assert.equal((await query('')).items.length,100);
console.log('PASS real worker search across HYG/OpenNGC/ATNF and bounded result pages');
