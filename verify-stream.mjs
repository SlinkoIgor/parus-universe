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
await run(`(async()=>{const r=testEntry,o=await ExtendedCatalog.resolve({id:r[0],tile:r[5]});state=initial();state.nextTargets=[{id:o.id,setup:FlightSetup.defaults()}];state.multiplayer=true;state.trafficSeed=73;ExtendedCatalog.capture(state);const saved=JSON.parse(JSON.stringify(state));assert.ok(saved.catalogObjects.some(q=>q.id===o.id),'queue keeps streamed catalogue references');ExtendedCatalog.pinned.clear();ExtendedCatalog.cache.clear();state=restore(saved);assert.equal(state.itinerary[0].id,o.id);assert.equal(state.nextTargets.length,0);assert.ok(object(o.id)?.navigable);assert.equal(state.multiplayer,true);assert.equal(state.trafficSeed,73);})();`);
console.log('PASS streamed legacy queued target migrates into the route and survives tile eviction/reload with its setup and fleet preference');

await run(`(async()=>{state=initial();for(const id of ['bode','triangulum','bootes','laniakea','ring','local-void','vela','sgr','3c273'])await ArrivalStars.prepare(object(id));})();`);

run(`
state=initial();var galaxy=object('bode');state.current=null;state.ship=Space.point(V3.add(galaxy.p3,[2,0,0]));state.selected=galaxy.id;state.expansion=false;state.flightSetup=FlightSetup.normalize({engine:true,sail:false,arrivalFuelPercent:0});state.paused=false;paused=false;speed=1;
var star=ExtendedCatalog.arrivalStar(galaxy);assert.ok(star.synthetic);assert.equal(object(star.id),undefined);launch();assert.ok(state.flight);assert.equal(state.flight.boost,false);
var guard=0;while(state.flight&&guard++<100)Simulation.step(1e5);assert.equal(state.current,star.id);state.flightSetup=FlightSetup.normalize({sail:true,collector:true,burst:true,arrivalFuelPercent:0});assert.ok(canBoost());
state.selected='triangulum';FlightSetup.sync();launch();assert.ok(state.flight.boost);Simulation.tick((state.flight.mission.acceleration.preboost?.preparationEnd.proper||0)+1e-7);assert.ok(state.destroyed.includes(star.id));
ExtendedCatalog.capture(state);var saved=JSON.parse(JSON.stringify(state));ExtendedCatalog.pinned.clear();state=restore(saved);assert.ok(object(star.id));assert.equal(state.flight.fromId,star.id);assert.ok(state.flight.boost);
state=initial();state.destroyed=[star.id];var next=ExtendedCatalog.arrivalStar(galaxy);assert.ok(next&&next.id!==star.id);assert.equal(object(next.id),undefined,'replacement stays undiscovered until another arrival');
`);
console.log('PASS direct galaxy arrival -> sail boost, reload during boost, undiscovered replacement after using a fictional star');

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

const searchKey=s=>s.normalize('NFKD').toLocaleLowerCase('ru').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]/gu,'').replace(/(ngc|ic)0+(?=\d)/g,'$1');
const kindMatches=(kind,filter)=>filter==='all'||filter==='star'&&['star','home'].includes(kind)||filter==='stellar-cluster'&&kind==='cluster'||filter==='structure'&&['structure','wall','ring','arc'].includes(kind)||filter===kind&&['pulsar','blackhole','quasar','nebula','galaxy','void','horizon','galaxy-cluster','stellar-cluster'].includes(kind);
const rowScan=(term,filter,limit)=>{
 const key=searchKey(term),rows=search.filter(r=>kindMatches(r[8]||r[2],filter)&&r[6].includes(key)).sort((a,b)=>(key?Number(b[6].includes('|'+key+'|'))-Number(a[6].includes('|'+key+'|')):0)||(a[3]??Infinity)-(b[3]??Infinity)||a[0].localeCompare(b[0]));
 return{seq:1,total:rows.length,items:rows.slice(0,limit).map(r=>({id:r[0],name:r[1],kind:r[2],d:r[3],positionQuality:r[4],tile:r[5],atlasOnly:!!r[7],catalogClass:r[8]||null,streamed:true,searchExact:!!key&&r[6].includes('|'+key+'|')}))};
};
let compared=0,exactHits=0;
const probes=['','a','1','HIP 1','hyg 13','NGC 1','ngc 0001','IC 10','M 31','m31','J0002+6216','андромед','туманность','скопление','α','psr','lggs','void','zz','|',' ','é','00'];
for(let i=0;i<24;i++){const row=search[(i*104729+17)%search.length],segments=row[6].split('|').filter(Boolean);probes.push(row[1],row[0].slice(0,5),segments[i%segments.length]);}
for(const [n,term] of probes.entries())for(const filter of n<23?['all','star','galaxy','stellar-cluster','structure']:['all']){
 const actual=await query(term,filter,n%4?100:400),expected=rowScan(term,filter,n%4?100:400);
 assert.equal(JSON.stringify(actual),JSON.stringify(expected),'compact index matches a row scan for '+JSON.stringify([term,filter]));
 compared++;if(actual.items.some(o=>o.searchExact))exactHits++;
}
assert.equal(JSON.stringify(await query('','all',search.length+1)),JSON.stringify(rowScan('','all',search.length+1)),'the complete ordered list is unchanged');
assert.ok(compared>150&&exactHits>40,[compared,exactHits].join());
const compact=await vm.runInContext('indexPromise',workerContext);
assert.ok(!Array.isArray(compact)&&compact.size===search.length,'parsed rows are replaced by packed columns');
assert.ok(compact.keys.reduce((n,side)=>n+side.text.length,0)<search.reduce((n,r)=>n+r[6].length,0)*.75,'repeated aliases are stored once per object');
console.log('PASS compact search index returns the same totals, order and records as a full row scan');

await run(`(async()=>{
  const timers=[],workers=[],realTimeout=setTimeout,realClear=clearTimeout,live=()=>timers.filter(t=>t.live);
  setTimeout=(fn,ms)=>{timers.push({fn,ms,live:true});return timers.length;};clearTimeout=id=>{if(timers[id-1])timers[id-1].live=false;};
  globalThis.Worker=class{constructor(url){this.url=url;this.terminated=false;this.held=[];workers.push(this);}postMessage(data){if(this.hold)this.held.push(data);else Promise.resolve().then(()=>this.onmessage({data:{seq:data.seq,total:0,items:[]}}));}terminate(){this.terminated=true;}};
  const fire=()=>{const t=live()[0];t.live=false;t.fn();};
  try{
    ExtendedCatalog.worker=null;$('catalog').hidden=false;
    await ExtendedCatalog.search('a','all',100);await ExtendedCatalog.search('b','all',100);
    assert.equal(workers.length,1,'consecutive searches share one loaded index');
    assert.deepEqual(live().map(t=>t.ms),[ExtendedCatalog.searchIdleMs],'each search restarts a single idle timer');
    closeCatalog();assert.equal($('catalog').hidden,true);
    assert.deepEqual(live().map(t=>t.ms),[ExtendedCatalog.searchClosedMs],'closing the search panel shortens the wait');
    workers[0].hold=true;const late=ExtendedCatalog.search('c','all',100);
    assert.equal(live().length,0,'a new search cancels the scheduled release');
    ExtendedCatalog.releaseSearchAfter(ExtendedCatalog.searchClosedMs);fire();
    assert.equal(workers[0].terminated,false,'an index with an unanswered search is kept');assert.equal(live().length,1);
    workers[0].onmessage({data:{seq:workers[0].held[0].seq,total:0,items:[]}});await late;
    fire();assert.equal(workers[0].terminated,true,'the idle index is released');assert.equal(ExtendedCatalog.worker,null);
    assert.equal(live().length,0);
    await ExtendedCatalog.search('d','all',100);assert.equal(workers.length,2,'the next search loads the index again');
  }finally{delete globalThis.Worker;setTimeout=realTimeout;clearTimeout=realClear;ExtendedCatalog.worker=null;$('catalog').hidden=false;}
})()`);
console.log('PASS idle search index is released and reloaded on demand');

run(`state=initial();for(const host of ['andromeda','lmc','smc']){const g=object(host),stars=OBJECTS.filter(o=>o.parentGalaxy===host&&o.galaxyMember&&!o.atlasOnly);assert.ok(stars.length>0);assert.ok(stars.every(o=>!o.synthetic&&o.navigable));for(const found of stars){assert.ok(MapDetails.maxSpan(found)>g.galaxy.diameterLy);assert.ok(MapDetails.visible(found,g.galaxy.diameterLy*2));assert.ok(MapDetails.visible(found,24));}}
for(const id of ['bootes','laniakea','ring','local-void']){const body=object(id),star=ExtendedCatalog.arrivalStar(body);assert.ok(star?.synthetic&&star.navigable);assert.equal(JSON.stringify(star.p3),JSON.stringify(body.p3));assert.equal(object(star.id),undefined);}
for(const id of ['vela','3c273']){const star=ExtendedCatalog.arrivalStar(object(id));assert.ok(star?.synthetic);assert.equal(star.parentObject,id);assert.equal(object(star.id),undefined);}
`);
run(`assert.ok(!ExtendedCatalog.arrivalStar(object('sgr')).synthetic);assert.ok(Space.distance(ExtendedCatalog.arrivalStar(object('sgr')),object('sgr'))<5);`);
console.log('PASS real galaxy stars retain visibility; fictional fallbacks stay hidden; the black-hole stopping target is an existing nearby star');
