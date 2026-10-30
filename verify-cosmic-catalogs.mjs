import fs from 'node:fs';
import assert from 'node:assert/strict';
import {catalogPath,catalogRoot} from './catalog-path.mjs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';
const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
context.fetch=async path=>({ok:fs.existsSync('dist/'+path.split('?')[0]),json:async()=>JSON.parse(fs.readFileSync('dist/'+path.split('?')[0]))});
const manifest=JSON.parse(fs.readFileSync(catalogPath('manifest.json')));
assert.match(catalogRoot,/^catalog-data\/[a-f\d]{12}$/);
assert.equal(manifest.total+40,260938);
const leaves=manifest.nodes.filter(n=>!n.children.length);
const rows=leaves.flatMap(n=>JSON.parse(fs.readFileSync(catalogPath(n.file))));
const hunt=rows.filter(r=>r[0].startsWith('hunt-reffert-')).sort((a,b)=>a[3]-b[3])[0];
const mcxc=rows.find(r=>r[0].startsWith('mcxcii-'));
const filament=rows.find(r=>r[0]==='sdss-filament-1');
const unknownSize=rows.find(r=>r[0].startsWith('cf4-')&&r[11].sizeUnknown);
context.testRows=[hunt,mcxc,filament,unknownSize];context.testManifest=manifest;
run(`
ExtendedCatalog.manifest=testManifest;state=initial();state.expansion=false;Cosmology.sync(state);
var imported=testRows.map(r=>ExtendedCatalog.pin(ExtendedCatalog.decode(r)));
assert.equal(ExtendedCatalog.total,260938);
for(const o of imported){assert.ok(o.navigable);assert.ok(o.p3.every(Number.isFinite));assert.ok(o.facts.refs.length);}
assert.equal(OrbitalArrival.target(imported[0]),null);assert.equal(OrbitalArrival.target(imported[1]),null);
assert.equal(ExtendedCatalog.matches('cluster','galaxy-cluster',imported[1]),true);
assert.equal(ExtendedCatalog.matches('cluster','stellar-cluster',imported[1]),false);
assert.equal(ExtendedCatalog.matches('cluster','stellar-cluster',imported[0]),true);
assert.equal(ExtendedCatalog.matches('cluster','galaxy-cluster',imported[0]),false);
assert.ok(!imported[3].galaxy&&!imported[3].region,'unknown size stays a point');
showObject(imported[2].id);assert.ok($('dialogContent').innerHTML.includes('Каталожный ориентир XYZ'));assert.ok(!$('dialogContent').innerHTML.includes('положение центра структуры не измерено'));assert.ok(!$('dialogContent').innerHTML.includes('Форма и ориентация приблизительны'));
assert.equal(imported[2].region.shape,'polyline');assert.equal(RegionMap.outline(imported[2].region).length,50);
var middle=imported[2].region.points[25];assert.ok(Math.hypot(...middle)<.01);
assert.ok(EXTENDED_BOOT.coordinateCorrections.length<15000,'new individual-distance catalogue must stay lazy');
assert.ok(JSON.stringify(EXTENDED_BOOT).length<5e6,'bounded eager boot');
`);
console.log('PASS immutable data root, source types, unknown sizes, aggregate mass and bounded eager boot');

// The overview omits bulk void/supercluster envelopes, but neither the atlas
// nor saved navigation loses any records. Exercise every affected survey row.
context.overviewRows=rows.filter(r=>r[11].cosmicCatalog&&(r[2]==='void'||r[11].cosmicSubtype==='supercluster'));
assert.equal(context.overviewRows.filter(r=>r[2]==='void').length,635);
assert.equal(context.overviewRows.filter(r=>r[11].cosmicSubtype==='supercluster').length,1313);
await run(`(async()=>{
state=initial();state.expansion=false;Cosmology.sync(state);filter='all';
var surveyObjects=overviewRows.map(r=>ExtendedCatalog.decode(r));
for(const o of surveyObjects){
 assert.equal(ExtendedCatalog.matchesMap(o),false,o.id+' hidden in overview');
 assert.equal(ExtendedCatalog.matches(o.kind,'all',o),true,o.id+' retained in atlas');
 filter=o.kind==='void'?'void':'structure';assert.equal(ExtendedCatalog.matchesMap(o),true,o.id+' visible in class filter');filter='all';
}
for(const id of ['bootes','local-void','eridanus-supervoid','laniakea','shapley','quipu','sloan','boss-wall'])assert.equal(ExtendedCatalog.matchesMap(object(id)),true,'named landmark '+id);
for(const o of imported.filter(o=>o.cosmicSubtype==='filament'))assert.equal(ExtendedCatalog.matchesMap(o),true,'filament retained');
var overviewVisible=ExtendedCatalog.visible,overviewPinned=new Map(ExtendedCatalog.pinned);
for(const o of [...surveyObjects.filter(o=>o.kind==='void').slice(0,2),...surveyObjects.filter(o=>o.cosmicSubtype==='supercluster').slice(0,2),imported[2]]){
 ExtendedCatalog.pin(o);ExtendedCatalog.visible=[o];state.selected=o.id;state.current=o.id;
 const p=MapLayout.project(o);cam={x:p.x,y:p.y,span:Math.max(o.region.major,o.region.minor)*3};
 for(const mode of ['all','void','structure','all']){
  filter=mode;MapLabels.begin();RegionMap.draw();drawObjects();ExtendedCatalog.draw();
  const expected=mode==='all'?o.cosmicSubtype==='filament':mode===(o.kind==='void'?'void':'structure');
  assert.equal(RegionMap.hits.some(h=>h.o.id===o.id),expected,'contour and hit area '+o.id+' '+mode);
  assert.equal(MapLabels.queue.some(q=>q.key==='region-'+o.id),expected,'label '+o.id+' '+mode);
  // The same object also has a point symbol when its envelope is too small.
  const region=o.region;delete o.region;MapLabels.begin();drawObjects();ExtendedCatalog.draw();
  assert.equal(hitObjects.some(h=>h.o.id===o.id),expected,'point symbol '+o.id+' '+mode);o.region=region;
 }
}
filter='all';state=initial();state.expansion=false;var hiddenTarget=surveyObjects[0];state.selected=hiddenTarget.id;
ExtendedCatalog.capture(state);var overviewSaved=JSON.parse(JSON.stringify(state));ExtendedCatalog.pinned.clear();state=restore(overviewSaved);
assert.equal(state.selected,hiddenTarget.id);assert.ok(object(hiddenTarget.id).navigable);assert.equal(ExtendedCatalog.matchesMap(object(hiddenTarget.id)),false,'reload cannot reveal hidden selected target');
filter='void';assert.equal(ExtendedCatalog.matchesMap(object(hiddenTarget.id)),true);filter='all';ExtendedCatalog.visible=overviewVisible;
for(const [mode,total] of [['void',635],['structure',16734]]){
 const found=await ExtendedCatalog.search('',mode,20000);
 assert.equal(found.total,total,'full atlas class '+mode);
}
const overviewSearch=await ExtendedCatalog.search(surveyObjects[0].name,'all',100);assert.ok(overviewSearch.items.some(o=>o.id===surveyObjects[0].id),'overview search retains hidden objects');
ExtendedCatalog.pinned=overviewPinned;
})()`);
console.log('PASS all 1948 survey envelopes hidden only in overview; named landmarks/filaments, class filters, points, contours, labels, hits, atlas search and saved navigation retained');

// A normal flight to an actual newly imported nearby group, including reload.
run(`
state=initial();state.expansion=false;paused=false;state.selected=imported[0].id;
state.flightSetup=FlightSetup.normalize({engine:true,sail:true,collector:true,burst:false,brakeEngine:true,brakeSail:true,arrivalFuelPercent:50});
MissionPlanner.cache.clear();var plan=MissionPlanner.preview();assert.ok(plan.valid,plan.reason);assert.notEqual(plan.brake.kind,'orbit');
MissionPlanner.launch();assert.ok(state.flight);Simulation.tick(plan.proper*.31);
ExtendedCatalog.capture(state);var saved=JSON.parse(JSON.stringify(state)),remaining=FlightEstimate.get().proper;
ExtendedCatalog.pinned.clear();state=restore(saved);assert.equal(state.selected,imported[0].id);assert.ok(object(imported[0].id).navigable);
assert.ok(state.catalogObjects.length<10);assert.ok(Math.abs(FlightEstimate.get().proper-remaining)<1e-10);
Simulation.tick(remaining);assert.ok(!state.flight);assert.equal(state.current,imported[0].id);assert.equal(state.beta,0);assert.equal(state.orbit,null);
assert.ok(Math.abs(state.matter*1000-plan.arrivalFuelKg)<1e-6);
`);
console.log('PASS imported target launch, full stop, fuel and in-flight save/restore');

// Large region envelopes must not starve the smallest stellar view.
const files=run(`ExtendedCatalog.nodesForView({x:0,y:0,span:24},1280,720)`);
const chosen=files.flatMap(f=>JSON.parse(fs.readFileSync(catalogPath(f))));
const inside=r=>r[2]==='star'&&Math.abs(r[12])<12&&Math.abs(r[13])<7.2;
const available=new Set(rows.filter(inside).map(r=>r[0]));
assert.equal(available.size,170);assert.deepEqual(new Set(chosen.filter(inside).map(r=>r[0])),available);
assert.ok(files.length<=32&&chosen.length<=8000);
// A drawable line outside the viewport by its anchor must still be requested.
run(`
var originalManifest=ExtendedCatalog.manifest;
ExtendedCatalog.manifest={roots:[0],nodes:[{file:'crossing.json',box:[100,0,100,0],count:1,children:[],geometryBoxes:[[128,-28,-1,228,1]]}]};
assert.deepEqual(ExtendedCatalog.nodesForView({x:0,y:0,span:24},1280,720),['crossing.json']);
ExtendedCatalog.manifest=originalManifest;
var vertical={id:'vertical-source-test',name:'VERTICAL',kind:'structure',d:1e8,p3:[0,0,1e8],mapPosition:{x:0,y:0},navigable:true,region:{shape:'polyline',major:1,minor:40,points:[[0,-20],[0,20]]}};
ExtendedCatalog.visible=[vertical];cam={x:0,y:0,span:100};state=initial();state.expansion=false;filter='all';MapLabels.begin();RegionMap.draw();
assert.ok(RegionMap.hits.some(h=>h.o.id===vertical.id),'vertical source spine remains drawable');
assert.equal(RegionMap.hit(screen({x:0,y:0}).x,screen({x:0,y:0}).y).id,vertical.id);
`);
console.log('PASS local stellar completeness, bounded LOD, crossing envelopes and vertical polyline hit-testing');
