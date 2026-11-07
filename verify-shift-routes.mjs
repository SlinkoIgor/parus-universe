import fs from 'node:fs';
import assert from 'node:assert/strict';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run,context};';
const {run,context}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#shift-routes');
context.fetch=async path=>{path=path.split('?')[0];return {ok:fs.existsSync('dist/'+path),json:async()=>JSON.parse(fs.readFileSync('dist/'+path,'utf8'))};};
context.arrivalIndex=JSON.parse(fs.readFileSync('dist/arrival-stars-index.json'));
run(`
ArrivalStars.index=arrivalIndex;
const resetRoutes=()=>{state=initial();state.expansion=false;state.flightSetup=FlightSetup.normalize({engine:true,sail:false,arrivalFuelPercent:0});paused=true;Simulation.debt=Simulation.wallDebt=0;FlightQueue.reset();Cosmology.sync(state);};
resetRoutes();
assert.equal(ArrivalStars.index.catalogRevision,EXTENDED_BOOT.revision);
assert.equal(ArrivalStars.index.rows.length,ARRIVAL_STARS_BOOT.count);
assert.equal(new Set(ArrivalStars.index.rows.map(r=>r[0])).size,ARRIVAL_STARS_BOOT.count);
assert.ok(ArrivalStars.index.rows.every(r=>typeof r[4]==='string'&&r.slice(1,4).every(Number.isFinite)));
// Independent linear reference: exact 3D distances, all streamed stars and core.
const bruteStar=host=>{
 const radius=ArrivalStars.radius(host),used=new Set(state.destroyed),candidates=[];
 for(const row of ArrivalStars.index.rows){const d=Math.hypot(...row.slice(1,4).map((v,i)=>v-host.p3[i]));if(!used.has(row[0])&&(row[5]===host.id||(radius?d<=radius:d<5)))candidates.push([row[0],d]);}
 for(const star of OBJECTS)if(ArrivalStars.usable(star,used)){const d=Space.distance(star,host);if(star.parentGalaxy===host.id||star.parentObject===host.id||(radius?d<=radius:d<5))candidates.push([star.id,d]);}
 return candidates.sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0]))[0]?.[0]||null;
};
`);
for(const id of ['sgr','andromeda','triangulum','milkyway','opengc-ngc1432','opengc-ngc1981','vela','bode','omega']) {
 await run(`ArrivalStars.prepare(object(${JSON.stringify(id)}))`);
 run(`{const host=object(${JSON.stringify(id)});if(ArrivalStars.eligible(host)){const star=ExtendedCatalog.arrivalStar(host);assert.equal(star.synthetic?null:star.id,bruteStar(host),host.id+' full-catalog nearest star');}}`);
}
run(`{
const sgrStar=ExtendedCatalog.arrivalStar(object('sgr')),m31Star=ExtendedCatalog.arrivalStar(object('andromeda'));
assert.ok(!sgrStar.synthetic&&Space.distance(sgrStar,object('sgr'))<5);
assert.ok(!m31Star.synthetic&&m31Star.parentGalaxy==='andromeda');
assert.ok(Space.distance(m31Star,object('andromeda'))<ArrivalStars.radius(object('andromeda')));
assert.equal(object(m31Star.id),undefined,'resolving a preview never pins a streamed star');
const starBefore=JSON.stringify(m31Star);ExtendedCatalog.visible=[];ExtendedCatalog.visibleMap.clear();ExtendedCatalog.cache.clear();
filter='void';assert.equal(JSON.stringify(ExtendedCatalog.arrivalStar(object('andromeda'))),starBefore,'filters, viewport and tile eviction do not change destination');filter='all';
// Isolated fixtures prove strict 5 ly, real 3D, nearest and destroyed filtering.
const host={id:'arrival-fixture',name:'Тестовый пульсар',kind:'pulsar',navigable:true,...Space.point([1e10,1e10,1e10])};ExtendedCatalog.pin(host);
const make=(id,offset)=>ExtendedCatalog.pin({id,name:id,kind:'star',navigable:true,...Space.point(V3.add(host.p3,offset))});
make('arrival-five',[0,0,5]);assert.ok(ExtendedCatalog.arrivalStar(host).synthetic,'exactly 5 ly is excluded');
ArrivalStars.results.clear();make('arrival-foreground',[0,0,20]);make('arrival-near',[0,0,4]);make('arrival-nearest',[1,0,0]);
assert.equal(ExtendedCatalog.arrivalStar(host).id,'arrival-nearest');
state.cosmicTime=3e10;Cosmology.sync(state);state.destroyed=['arrival-nearest'];assert.equal(ExtendedCatalog.arrivalStar(host).id,'arrival-near','local five-light-year neighbourhood does not shrink with cosmic expansion');state.cosmicTime=0;Cosmology.sync(state);
state.destroyed.push('arrival-near');assert.ok(ExtendedCatalog.arrivalStar(host).synthetic);
const cluster={...host,id:'arrival-cluster',name:'Тестовое скопление',kind:'cluster',diameterLy:18};ExtendedCatalog.pin(cluster);
state.destroyed=[];assert.equal(ExtendedCatalog.arrivalStar(cluster).id,'arrival-nearest');
state.destroyed=['arrival-nearest','arrival-near'];assert.equal(ExtendedCatalog.arrivalStar(cluster).id,'arrival-five','extended radius permits stars beyond point threshold');
console.log('PASS full 107k-star index vs independent linear search, galaxy members, closest nuclear star, viewport independence, strict 5 ly, 3D and destroyed stars');
}`);
for(const id of ['sgr','andromeda','vela']) {
 await run(`ArrivalStars.prepare(object(${JSON.stringify(id)}),[])`);
 run(`{
resetRoutes();const host=object(${JSON.stringify(id)});state.current=null;state.ship=Space.point(V3.add(host.p3,[2,0,0]));state.selected=host.id;
const star=ExtendedCatalog.arrivalStar(host),p=MissionPlanner.preview();assert.ok(p.valid,p.reason);assert.equal(p.targetId,star.synthetic?host.id:star.id);
assert.ok(Math.abs(p.distance-Space.distance(state.ship,star))<1e-8,'physical plan ends at chosen star');
if(star.synthetic){assert.ok(star.name.startsWith('Игровая звезда возле «'+host.name));assert.equal(object(star.id),undefined);}
launch();assert.ok(state.flight);assert.equal(state.selected,state.flight.target,'arrival redirection is not queue browsing');assert.equal(FlightQueue.browsing(),false);
Simulation.tick(state.flight.mission.proper*.2);paused=true;ExtendedCatalog.capture(state);
const physical=JSON.stringify([state.flight,state.ship,state.matter,state.proper,state.earth]);state=restore(JSON.parse(JSON.stringify(state)));
assert.equal(JSON.stringify([state.flight,state.ship,state.matter,state.proper,state.earth]),physical,'exact reload');
for(let i=0;state.flight&&i<5;i++)Simulation.tick(FlightEstimate.get().proper);
assert.equal(state.flight,null);assert.equal(state.current,star.id);assert.ok(state.visited.includes(host.id));assert.ok(state.visited.includes(star.id));
assert.ok(Space.distance(state.ship,star)<Math.max(1e-7,(state.orbit?.radius||0)/LY*1.001));
assert.ok(Math.abs(state.matter*1000-p.arrivalFuelKg)<1e-7,JSON.stringify({host:host.id,fuel:state.matter*1000,expected:p.arrivalFuelKg}));assert.ok(Math.abs(state.proper-p.proper)<p.proper*1e-8,JSON.stringify({host:host.id,proper:state.proper,expected:p.proper}));
console.log('PASS real '+host.id+' flight to '+star.id+', precise reload, position, fuel, clocks, visited host and usable arrival');
}`);
}
await run(`ArrivalStars.prepare(object('bode'),[])`);
run(`{
resetRoutes();state.current='proxima';state.ship=Space.point(object('proxima').p3);
select('sgr');planRoutePoint('sgr');assert.equal(state.itinerary[0].mode,'flyby');
assert.equal(Route.analyze().valid,false);assert.equal($('blackHoleArrival').hidden,false);assert.ok($('routeDraftIssue').textContent.includes('Добавить точку'));
Route.show();assert.equal(state.itinerary.at(-1).mode,'flyby','opening route never coerces final black hole into stop');$('infoDialog').close();
select('bode');planRoutePoint('bode');assert.deepEqual(state.itinerary.map(n=>n.mode),['flyby','stop']);assert.ok(Route.analyze().valid,JSON.stringify(Route.analyze()));
launchSelectedTarget();assert.ok(state.flight.mission.passage);assert.equal(state.flight.mission.brake.proper,0);assert.equal(state.flight.arrivalStar,undefined);
const beta=state.flight.mission.coast.beta;Simulation.tick(state.flight.mission.proper*1.00001);assert.equal(state.flight.target,'bode');assert.ok(state.beta>0);assert.ok(![...ExtendedCatalog.pinned.values()].some(o=>o.arrivalHost==='sgr'));
console.log('PASS Shift draft and launch action, black hole waits for next point, no braking/star discovery during real gravity passage and moving continuation');
resetRoutes();select('sgr');Route.approach('flyby');assert.equal(state.itinerary[0].mode,'flyby');Route.approach('stop');assert.equal(state.itinerary[0].mode,'stop');assert.ok(Route.analyze().valid);Route.start();assert.equal(state.flight.target,ExtendedCatalog.arrivalStar(object('sgr')).id);assert.ok(!state.flight.mission.passage);
console.log('PASS bottom gravity-manoeuvre / braking control selects physically distinct plans');
resetRoutes();state.flightSetup=FlightSetup.normalize({engine:true,sail:true,collector:true,arrivalFuelPercent:50});launch();paused=true;select('sgr');planRoutePoint('sgr');assert.equal(Route.future()[0].mode,'flyby');select('bode');planRoutePoint('bode');assert.equal(Route.future().length,2,JSON.stringify({route:state.flight.route,reason:FlightQueue.forecast().reason,context:FlightQueue.context().planningIssue,notice:$('toast').textContent}));
assert.ok(FlightQueue.forecast().valid,FlightQueue.forecast().reason);ExtendedCatalog.capture(state);state=restore(JSON.parse(JSON.stringify(state)));assert.equal(Route.future()[0].mode,'flyby');
Simulation.tick(FlightEstimate.get().proper*1.00001);assert.equal(state.flight.target,'sgr');assert.ok(state.flight.mission.passage);assert.equal(state.nextTargets.length,0);
Simulation.tick(state.flight.mission.proper*1.00001);assert.equal(state.flight.target,'bode');assert.ok(state.beta>0);
console.log('PASS in-flight Shift route preserves flyby mode through save/reload and launches actual gravity passage with continuation');
}`);
run(`{
resetRoutes();const unknown={id:'bh-without-mass',name:'Чёрная дыра без массы',kind:'blackhole',navigable:true,...Space.point([100,100,100])};ExtendedCatalog.pin(unknown);
select(unknown.id);planRoutePoint(unknown.id);assert.equal(state.itinerary[0].mode,'flyby');ExtendedCatalog.capture(state);state=restore(JSON.parse(JSON.stringify(state)));assert.equal(state.itinerary[0].mode,'flyby');
select('bode');planRoutePoint('bode');assert.ok(!Route.analyze().valid);assert.ok(Route.analyze().records[0].issue.includes('массе'));select(unknown.id);Route.approach('stop');assert.equal(state.itinerary[0].mode,'stop');
console.log('PASS black holes with missing mass keep explicit flyby intent, reject an uncalculable manoeuvre and allow braking without fabricated mass');
}`);
// Restore a passage with a cold full-catalogue index: the automatic next leg
// must resume as soon as the index arrives, without replacing flyby with a stop.
run(`{
resetRoutes();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.itinerary=[{id:'sgr',mode:'flyby'},{id:'bode',mode:'stop'}];Route.start();
const original=state.flight;Simulation.tick(original.mission.proper*.2);ExtendedCatalog.capture(state);state=restore(JSON.parse(JSON.stringify(state)));
ArrivalStars.index=null;ArrivalStars.loading=null;ArrivalStars.results.clear();ArrivalStars.pending.clear();ArrivalStars.resolved.clear();
Simulation.tick(FlightEstimate.get().proper*1.00001);assert.ok(state.beta>0);assert.equal(state.flight.target,'sgr');
}`);
await run('Promise.all([...ArrivalStars.pending.values()])');
run(`{
assert.equal(state.flight.target,'bode');assert.ok(state.beta>0);assert.ok(!state.flight.mission.passage);
console.log('PASS cold-index reload retains moving passage and automatically resumes the next leg after catalogue loading');
resetRoutes();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.itinerary=[{id:'sgr',mode:'flyby'},{id:'bode',mode:'stop'}];Route.start();Simulation.tick(state.flight.mission.proper*.2);
const before=JSON.stringify([state.ship,state.matter,state.beta,state.proper,state.earth]);assert.notEqual(Route.abort(),false);
assert.equal(JSON.stringify([state.ship,state.matter,state.beta,state.proper,state.earth]),before);
assert.equal(state.flight.target,'s21');assert.equal(state.flight.requestedTarget,'sgr');assert.ok(!state.flight.mission.passage);
for(let i=0;state.flight&&i<6;i++)Simulation.tick(FlightEstimate.get().proper);
assert.equal(state.current,'s21');assert.ok(!object('arrival-star:sgr:1'));
console.log('PASS aborting a passage creates an actual braking trajectory toward the known star, preserving instantaneous position, speed, fuel and clocks');
resetRoutes();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.itinerary=[{id:'sgr',mode:'flyby'},{id:'bode',mode:'stop'}];Route.start();Simulation.tick(state.flight.mission.proper*.2);
const physicalBeforeUndo=JSON.stringify([state.ship,state.matter,state.beta,state.proper,state.earth]);
assert.ok(Route.undo());assert.equal(Route.future().length,0);assert.equal(state.flight.route.length,1);assert.equal(state.flight.route[0].mode,'stop');assert.equal(state.flight.target,'s21');assert.ok(!state.flight.mission.passage);assert.equal(JSON.stringify([state.ship,state.matter,state.beta,state.proper,state.earth]),physicalBeforeUndo);
for(let i=0;state.flight&&i<6;i++)Simulation.tick(FlightEstimate.get().proper);
assert.equal(state.current,'s21');
console.log('PASS undo of the destination defining an active passage creates safe physical braking, retains the single current leg and reaches the known star');
// A plan already saved with a fictional stop must keep its original endpoint.
resetRoutes();state.current=null;state.ship=Space.point(V3.add(object('sgr').p3,[2,0,0]));state.selected='sgr';
ArrivalStars.results.set(ArrivalStars.key(object('sgr'),state.destroyed),null);MissionPlanner.cache.clear();launch();assert.ok(state.flight.arrivalStar.synthetic);
const oldStar=state.flight.arrivalStar;Simulation.tick(state.flight.mission.proper*.2);ExtendedCatalog.capture(state);const saved=JSON.parse(JSON.stringify(state));
ArrivalStars.results.clear();state=restore(saved);assert.ok(!ExtendedCatalog.arrivalStar(object('sgr')).synthetic);
for(let i=0;state.flight&&i<6;i++)Simulation.tick(FlightEstimate.get().proper);
assert.equal(state.current,oldStar.id);assert.equal(Space.distance(state.ship,object('sgr')),0);
assert.equal(ExtendedCatalog.arrivalStar(object('sgr')).id,'s21','new plans use the known star even if an old fictional one exists');
console.log('PASS older fictional active plans retain their endpoint; future plans prefer the real star');
}`);
assert.ok(fs.readFileSync('data-tools/build-standalone.py','utf8').includes("files['arrival-stars-index.json']"));
