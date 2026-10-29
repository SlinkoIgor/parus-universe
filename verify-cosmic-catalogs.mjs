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
