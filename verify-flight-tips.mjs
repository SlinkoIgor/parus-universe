import fs from 'node:fs';
const harness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {run};';
const {run} = await import('data:text/javascript,' + encodeURIComponent(harness) + '#flight-tips');
run(`{
const nativeRandom=Math.random,nativeEstimate=FlightEstimate.get;
FlightEstimate.get=function(...args){const f=state.flight;return f?.noticeTest?{proper:Math.max(0,f.mission.brake.proper-(f.stageElapsed||0))}:nativeEstimate.apply(this,args);};
try {
Math.random=()=>0;
const reset = () => {
 OrbitalArrival.enabled=true;FlightTips.learned=FlightTips.normalize().used;
 state=initial();state.expansion=false;paused=false;speed=1;FlightQueue.reset();
 Simulation.debt=Simulation.wallDebt=0;FlightTips.clear();
 $('toast').hidden=true;Cosmology.sync(state);
};
const allCounts = value => FlightTips.entries.map(() => value);
const firstCounts = () => FlightTips.entries.map((_, i) => i ? 0 : 1);
const learnedCounts = () => FlightTips.entries.map((_, i) => i ? 2 : 1);
const brake = (proper,elapsed=0,wall=4) => {state.flight={target:'alpha',noticeTest:true,noticeElapsed:wall,mission:{brake:{proper}},stageElapsed:elapsed};state.phase='brake';};
reset();brake(16);FlightTips.render();assert.equal($('toast').hidden,true,'exactly twenty total real seconds is a short flight');
state.flight.mission.brake.proper=16.01;
const physics = () => JSON.stringify([state.flight?Object.fromEntries(Object.entries(state.flight).filter(([k])=>k!=='flightTip')):null,state.ship,state.matter,state.beta,state.proper,state.earth,state.cosmicTime,state.universeElapsed,state.totalDistance,state.phase]);
const physical=physics();FlightTips.render();
assert.equal($('toast').hidden,false);assert.equal($('toast').dataset.kind,'tip');
assert.ok($('toast').textContent.includes('Двойной клик'));
assert.equal(physics(),physical,'rendering tips never changes physical state or its presentation clock');
assert.equal(state.flightTips.shown['double-click'],1);
const first=$('toast').textContent,firstProgress=JSON.stringify(state.flightTips);
for(let i=0;i<20;i++)FlightTips.render();
assert.equal($('toast').textContent,first);assert.equal(JSON.stringify(state.flightTips),firstProgress,'one tip per flight');
paused=true;FlightTips.render();assert.equal($('toast').textContent,first);
const schedule=setTimeout;let expired;
try {
 setTimeout=callback=>{expired=callback;return 0;};
 toast('Важное сообщение');FlightTips.render();assert.equal($('toast').textContent,'Важное сообщение');
 expired();assert.equal($('toast').textContent,first,'temporary notices yield back to the same tip');
} finally {setTimeout=schedule;}
for(const phase of ['launch','thrust','cruise','brake','dock']){state.phase=phase;FlightTips.render();assert.equal($('toast').textContent,first);}
assert.equal(JSON.stringify(state.flightTips),firstProgress,'phase changes neither reroll nor count again');
state.phase='idle';state.flight=null;FlightTips.render();assert.equal($('toast').hidden,true,'cancellation removes the tip');
reset();brake(30,0,3.999);FlightTips.render();assert.equal($('toast').hidden,true,'four-second startup delay');
state.flight.noticeElapsed=4;FlightTips.render();assert.equal($('toast').hidden,false);
reset();brake(30,0,4);paused=true;FlightTips.render();assert.equal($('toast').hidden,true,'paused flights do not choose a new tip');
paused=false;FlightTips.render();assert.equal($('toast').hidden,false);
reset();brake(30);speed=10;FlightTips.render();assert.equal($('toast').dataset.kind,'arrival','arrival follows the selected rate even on short flights');
speed=.5;FlightTips.render();assert.equal($('toast').dataset.kind,'tip');assert.equal($('toast').hidden,false);
reset();const seen=[];
for(let i=0;i<2*FlightTips.entries.length;i++){brake(20);FlightTips.render();seen.push($('toast').textContent);}
assert.equal(new Set(seen).size,FlightTips.entries.length);
assert.ok(seen.every(text=>FlightTips.entries.some(t=>t.text===text)));assert.equal($('toast').dataset.icon,'tip');
assert.deepEqual([...new Set(seen)].sort(),FlightTips.entries.map(t=>t.text).sort(),'all entries remain reachable in random order');
console.log('PASS >20-second flight boundary, four-second startup delay, pause, current tempo and one random tip across all flight phases');

reset();brake(30,0,0);toast('Сообщение от старта',14000,'warning');
state.flight.noticeElapsed=4;FlightTips.render();assert.equal($('toast').dataset.kind,'tip','startup messages yield when the four-second delay ends');
assert.deepEqual(FlightTips.entries.map(t=>state.flightTips.shown[t.id]),firstCounts());
state.flight.noticeElapsed=5;toast('Новое предупреждение в полёте',14000,'warning');FlightTips.render();
assert.equal($('toastText').textContent,'Новое предупреждение в полёте','fresh user messages retain priority');
state.flight.stageElapsed=29.99;$('toast').hidden=true;FlightTips.render();
assert.equal($('toast').dataset.kind,'arrival','arrival replaces tips and warnings in the final four seconds');
assert.deepEqual(FlightTips.entries.map(t=>state.flightTips.shown[t.id]),firstCounts());
reset();brake(30,0,4);toast('Новое предупреждение в полёте',14000,'warning');FlightTips.render();
assert.equal(state.flight.flightTip,undefined);
state.flight.stageElapsed=16;$('toast').hidden=true;FlightTips.render();
assert.equal($('toast').hidden,true,'a late new tip still needs ten seconds of reading before the arrival plaque');
assert.deepEqual(FlightTips.entries.map(t=>state.flightTips.shown[t.id]),allCounts(0));
reset();brake(4.001,0,16);FlightTips.render();assert.equal($('toast').hidden,true,'arrival is not shown before the four-second window');
state.flight.mission.brake.proper=4;FlightTips.render();assert.equal($('toast').dataset.kind,'arrival');
assert.equal($('toast').dataset.icon,'arrival');assert.equal(state.orbit,null,'arrival plaque does not park the ship early');
assert.equal(state.flight.flightTip,undefined);assert.deepEqual(FlightTips.entries.map(t=>state.flightTips.shown[t.id]),allCounts(0));
state.flight.mission.arrival={targetId:'alpha'};FlightTips.render();assert.equal($('toast').dataset.icon,'orbit');
const orbitalText=$('toastText').textContent;assert.ok(orbitalText.includes(object('alpha').name));
speed=.5;FlightTips.render();assert.equal($('toast').hidden,true,'slowing moves the arrival window away');
speed=1;FlightTips.render();assert.equal($('toastText').textContent,orbitalText);assert.equal($('toast').hidden,false);
paused=true;FlightTips.render();assert.equal($('toast').hidden,false,'pause preserves the current arrival plaque');
state.phase='idle';state.flight=null;FlightTips.render();assert.equal($('toast').hidden,true,'actual arrival removes the plaque without a post-arrival timer');
reset();brake(2,0,10);state.flight.mission.passage=true;FlightTips.render();assert.equal($('toast').hidden,true,'flybys do not announce a stopped arrival');
reset();brake(2,0,10);state.phase='flyby';FlightTips.render();assert.equal($('toast').hidden,true);
console.log('PASS startup/fresh notice priority, minimum reading window, four-second generic/orbital arrival, speed/pause changes, no early parking or flyby arrival and immediate cleanup');

reset();state.selected='andromeda';launch();
const p=state.flight.mission;assert.ok(p.brake.proper>10);
assert.equal(state.flight.noticeElapsed,0);Simulation.advance(3.9);renderUI();
assert.equal(state.flight.flightTip,undefined,'no tip before four active real seconds even on a long flight');
assert.ok(Math.abs(state.flight.noticeElapsed-3.9)<1e-10);
const pausedPhysics=JSON.stringify([state.flight,state.ship,state.proper,state.earth]);
paused=true;Simulation.advance(30);assert.equal(JSON.stringify([state.flight,state.ship,state.proper,state.earth]),pausedPhysics,'pause advances neither physics nor presentation time');
paused=false;speed=10;Simulation.advance(.11);renderUI();
assert.ok(Math.abs(state.flight.noticeElapsed-4.01)<1e-10,'a rate change preserves elapsed real seconds');
assert.equal($('toast').dataset.kind,'tip');assert.ok(['launch','thrust','cruise'].includes(state.phase),'tips are available before braking');
speed=1;
assert.equal(state.flightTips.used.collector,false,'using a collector does not teach its explanatory tip');
assert.equal(state.flightTips.used.supernova,false);assert.equal(state.flightTips.used['gas-collection'],false,'planned capture is not actual collection');
Simulation.tick(p.accelerationEnd.proper+p.coast.proper+p.brake.proper*.01);
assert.equal(state.phase,'brake');assert.ok(state.captured>0);assert.equal(state.flightTips.used['gas-collection'],false,'actual capture does not teach its explanatory tip');$('toast').hidden=true;renderUI();
assert.equal($('toast').dataset.kind,'tip');assert.equal($('toast').hidden,false);
const saved=JSON.stringify([state.flight,state.ship,state.matter,state.proper,state.earth]);
state=restore(JSON.parse(JSON.stringify(state)));
assert.equal(JSON.stringify([state.flight,state.ship,state.matter,state.proper,state.earth]),saved);
const progress=JSON.stringify(state.flightTips);
renderUI();assert.equal($('toast').dataset.kind,'tip');
assert.equal(JSON.stringify(state.flightTips),progress,'reload resumes the receipt without another impression');
Simulation.tick(FlightEstimate.get().proper-4);renderUI();
assert.equal($('toast').dataset.kind,'arrival');assert.equal(state.orbit,null,'the arrival plaque cannot finish the physical trip early');
const approachPhysical=JSON.stringify([state.flight,state.ship,state.matter,state.proper,state.earth]),approachProgress=JSON.stringify(state.flightTips);
state=restore(JSON.parse(JSON.stringify(state)));renderUI();
assert.equal(JSON.stringify([state.flight,state.ship,state.matter,state.proper,state.earth]),approachPhysical);
assert.equal(JSON.stringify(state.flightTips),approachProgress);assert.equal($('toast').dataset.kind,'arrival','arrival window survives reload without consuming a tip');
Simulation.tick(FlightEstimate.get().proper*1.00001);
assert.equal(state.flight,null);assert.ok(state.visited.includes('andromeda'));
assert.equal(state.current,p.arrivalStar?.id||p.targetId);
assert.equal($('toast').hidden,true,'actual arrival has no lingering plaque');renderUI();assert.equal($('toast').hidden,true);
console.log('PASS real long braking, exact save/reload and actual arrival clearing the bottom tip');

reset();state.selected='alpha';launch();const shortPlan=state.flight.mission;
assert.ok(shortPlan.arrival&&shortPlan.proper<20&&shortPlan.proper>4);
Simulation.tick(shortPlan.proper-4);renderUI();
assert.equal(state.flight.flightTip,undefined,'short flights never display a tip');assert.deepEqual(FlightTips.entries.map(t=>state.flightTips.shown[t.id]),allCounts(0));
assert.equal($('toast').dataset.kind,'arrival');assert.equal($('toast').dataset.icon,'orbit');assert.equal(state.orbit,null);
const arrivalRender=renderUI;
try {renderUI=()=>{};Simulation.tick(FlightEstimate.get().proper*1.00001);} finally {renderUI=arrivalRender;}
assert.equal(state.flight,null);assert.ok(state.orbit);assert.equal($('toast').hidden,true,'arrival clears its plaque even while a deferred UI render is blocked');
console.log('PASS actual short orbital flight has no tips, announces four seconds before arrival and hides the plaque exactly when parked');

reset();state.itinerary=[{id:'alpha',mode:'stop'},{id:'barnard',mode:'stop'}];Route.start();
const firstLeg=state.flight;Simulation.tick(firstLeg.mission.proper);
assert.ok(state.flight&&state.flight!==firstLeg&&state.flight.legIndex===1);
assert.ok(state.flight.noticeElapsed<1e-8,'automatic continuation starts a fresh four-second clock for the next leg');
assert.ok($('toast').hidden||$('toast').dataset.kind!=='arrival','the previous leg cannot leave an arrival plaque on the next one');
Simulation.advance(3.9);renderUI();assert.ok(Math.abs(state.flight.noticeElapsed-3.9)<1e-8);assert.equal(state.flight.flightTip,undefined);
const oldClockSave=JSON.parse(JSON.stringify(state));delete oldClockSave.flight.noticeElapsed;
state=restore(oldClockSave);const oldClockPhysics=JSON.stringify([state.flight,state.ship,state.matter,state.proper,state.earth]);
const inferred=FlightTips.elapsed(state.flight);assert.ok(Math.abs(inferred-state.flight.missionElapsed.proper/speed)<1e-8);
assert.equal(JSON.stringify([state.flight,state.ship,state.matter,state.proper,state.earth]),oldClockPhysics,'inferring an old presentation clock does not rewrite physical state');
Simulation.advance(.25);assert.ok(Math.abs(state.flight.noticeElapsed-inferred-.25)<1e-8);
console.log('PASS automatic route continuation resets the presentation clock, prior plaques do not leak and old version-13 flights acquire a compatible clock without changing their trajectory');

reset();state.flightSetup=FlightSetup.normalize({engine:true,sail:false,arrivalFuelPercent:50});planRoutePoint('proxima');planRoutePoint('alpha');
assert.equal(state.flightTips.used['shift-route'],true);
assert.equal(state.itinerary.map(n=>n.id).join(),'proxima,alpha');assert.equal(state.flight,null,'planning never starts a flight');
state.itinerary=[];state.selected='proxima';launch();
const active=JSON.stringify([state.flight,state.ship,state.matter,state.proper,state.earth]);
planRoutePoint('alpha');assert.equal(Route.future()[0].id,'alpha');
assert.equal(JSON.stringify([{...state.flight,route:undefined,legIndex:undefined},state.ship,state.matter,state.proper,state.earth]),active,'Shift planning leaves the executing trajectory intact');
console.log('PASS route planning before departure and appended route legs during flight');


reset();
const counts=()=>FlightTips.entries.map(t=>state.flightTips.shown[t.id]||0);
for(let i=0;i<2*FlightTips.entries.length;i++) {brake(20);FlightTips.render();assert.equal($('toast').hidden,false);}
assert.deepEqual(counts(),allCounts(2));
brake(20);FlightTips.render();assert.equal($('toast').hidden,true,'all tips are exhausted after two shows each');
assert.deepEqual(counts(),allCounts(2));
reset();brake(20);toast('Сначала уведомление');FlightTips.render();
assert.deepEqual(counts(),allCounts(0),'hidden tips never consume a show');
assert.equal(state.flight.flightTip,undefined);
$('toast').hidden=true;FlightTips.render();assert.deepEqual(counts(),firstCounts());
const receipt=JSON.stringify(state.flight.flightTip);
for(let i=0;i<4;i++) {
 state=restore(JSON.parse(JSON.stringify(state)));FlightTips.clear();FlightTips.render();
 assert.deepEqual(counts(),firstCounts());assert.equal(JSON.stringify(state.flight.flightTip),receipt);
}
FlightTips.use('double-click');assert.equal($('toast').hidden,true,'learning a currently visible tip dismisses it');
FlightTips.render();assert.equal($('toast').hidden,true,'one phase never swaps to a second tip');
for(let i=0;i<2*FlightTips.entries.length-1;i++){brake(20);FlightTips.render();assert.ok($('toast').hidden||!$('toast').textContent.includes('Двойной клик'));}
assert.deepEqual(counts(),learnedCounts());
FlightTips.use('black-holes');const learned=JSON.stringify(state.flightTips.used);
state=initial();FlightTips.clear();assert.deepEqual(counts(),allCounts(0),'a new expedition resets impressions');
assert.equal(JSON.stringify(state.flightTips.used),learned,'new expeditions remember learned functions');
brake(20);FlightTips.render();assert.ok($('toast').textContent.includes('Shift'),'only unknown functions remain eligible');
console.log('PASS twice-per-expedition cap, complete exhaustion, visible-only accounting, repeated reload, learned suppression and new expedition');

reset();state.selected='andromeda';launch();
const rollback=JSON.stringify(state.flight.rollback),p2=state.flight.mission;
Simulation.tick(p2.accelerationEnd.proper+p2.coast.proper+p2.brake.proper*.01);
$('toast').hidden=true;renderUI();FlightTips.use('black-holes');
const beforeCancel=JSON.stringify(state.flightTips);FlightHistory.cancel();
assert.equal(state.flight,null);assert.equal(JSON.stringify(state.flightTips),beforeCancel,'cancel cannot refund shows or forget learning');
assert.equal(state.proper,JSON.parse(rollback).proper);assert.equal(state.matter,JSON.parse(rollback).matter);
state=restore(JSON.parse(JSON.stringify(state)));assert.equal(JSON.stringify(state.flightTips),beforeCancel);
console.log('PASS cancellation restores physics while preserving impression limits and learned functions');

reset();state.flightSetup=FlightSetup.normalize({engine:true,sail:false,arrivalFuelPercent:0});planRoutePoint('sol');assert.equal(state.flightTips.used['shift-route'],false,'failed Shift action is not learned');
Route.add('proxima');assert.equal(state.flightTips.used['shift-route'],false,'one point in editor is not a multi-point route');
Route.add('alpha');assert.equal(state.flightTips.used['shift-route'],false,'building a route without Shift does not teach that shortcut');
reset();state.flightSetup=FlightSetup.normalize({engine:true,sail:false,arrivalFuelPercent:0});planRoutePoint('proxima');assert.equal(state.flightTips.used['shift-route'],true,'successful Shift action demonstrates the shortcut immediately');
reset();state.flightSetup=FlightSetup.normalize({engine:true,sail:false,arrivalFuelPercent:0});
state.current='proxima';state.ship=Space.point(object('proxima').p3);
state.itinerary=[{id:'sgr',mode:'flyby'},{id:'bode',mode:'stop'}];Route.start();
assert.ok(state.flight?.mission.passage);assert.ok(!state.flightTips.used['black-holes'],'planning a flyby is not executing it');
const passage=state.flight;Simulation.tick(passage.mission.accelerationEnd.proper+passage.mission.coast.proper);
assert.equal(state.phase,'flyby');assert.equal(state.flightTips.used['black-holes'],true);
state=restore(JSON.parse(JSON.stringify(state)));assert.equal(state.flightTips.used['black-holes'],true);
FlightHistory.cancel();assert.equal(state.flightTips.used['black-holes'],true);
console.log('PASS successful route/Shift actions and actual black-hole manoeuvre suppress their matching tips');

reset();state.selected='andromeda';launch();
const retiredPhysical=JSON.stringify([state.flight,state.ship,state.matter,state.proper,state.earth]);
const retired=JSON.parse(JSON.stringify(state));retired.flightTips.shown.pulsars=2;retired.flightTips.used.pulsars=true;
retired.flightTips.shown.collector=1;retired.flight.flightTip={id:'pulsars'};
state=restore(retired);assert.equal(state.flight.flightTip,undefined);
assert.equal(state.flightTips.shown.pulsars,undefined);assert.equal(state.flightTips.used.pulsars,undefined);
assert.equal(state.flightTips.shown.collector,1);assert.ok(!FlightTips.entries.some(t=>t.id==='pulsars'));
assert.equal(JSON.stringify([state.flight,state.ship,state.matter,state.proper,state.earth]),retiredPhysical,'retiring a saved tip preserves the physical flight');
console.log('PASS removed pulsar tip and its saved receipt/counters cannot return, while remaining counters and the physical flight stay intact');

reset();const old=JSON.parse(JSON.stringify(state));delete old.flightTips;
state=restore(old);assert.deepEqual(counts(),allCounts(0));assert.ok(!Object.values(state.flightTips.used).some(Boolean));
old.itinerary=[{id:'proxima',mode:'stop'},{id:'alpha',mode:'stop'}];old.journal.push({t:0,text:'Пролёт: Стрелец A*. Поворот 1°.'});
state=restore(old);assert.equal(state.flightTips.used['shift-route'],false,'an old route does not prove Shift use');assert.equal(state.flightTips.used['black-holes'],true);
assert.equal(state.flightTips.used['double-click'],false,'old saves do not invent unrecorded input history');
const malformed=FlightTips.normalize({shown:{'double-click':-1,'shift-route':99,'black-holes':NaN,supernova:1.9},used:{supernova:'true'},next:-10});
assert.deepEqual(Object.values(malformed.shown).slice(0,4),[0,2,0,1]);assert.ok(Object.values(malformed.shown).slice(4).every(n=>n===0));assert.equal(malformed.used.supernova,false);assert.equal('next' in malformed,false,'legacy rotation index is retired');
reset();const originalGet=localStorage.getItem,originalSet=localStorage.setItem;let stored;
try {
 localStorage.getItem=key=>key==='parus-flight-tip-used'?stored:null;
 localStorage.setItem=(key,value)=>{if(key==='parus-flight-tip-used')stored=value;};
 FlightTips.use('double-click');assert.equal(JSON.parse(stored)['double-click'],true);
 FlightTips.learned=null;state=initial();assert.equal(state.flightTips.used['double-click'],true,'profile learning survives browser restart');
} finally {localStorage.getItem=originalGet;localStorage.setItem=originalSet;}
console.log('PASS backward-compatible save migration, proven prior use, malformed counters and profile learning persistence');

reset();state.current='alpha';state.ship=Space.point(object('alpha').p3);state.selected='andromeda';
state.flightSetup={...FlightSetup.defaults(),burst:true};
const burstPlan=MissionPlanner.preview();assert.ok(burstPlan.valid,burstPlan.reason);
assert.ok(MissionPlanner.burstScheduled(burstPlan));
assert.ok(!state.flightTips.used.supernova&&!state.flightTips.used.collector,'preview never teaches acceleration features');
MissionPlanner.launch(burstPlan);assert.equal(state.flightTips.used.collector,false);
assert.equal(state.flightTips.used.supernova,false,'scheduled explosion is not a used supernova');
Simulation.tick(burstPlan.acceleration.preboost.preparationEnd.proper+1e-7);
assert.ok(state.destroyed.includes('alpha'));assert.equal(state.flightTips.used.supernova,true);assert.equal(state.flightTips.used['collector-survival'],false,'an actual explosion does not teach the collector survival explanation');
FlightHistory.cancel();assert.equal(state.flightTips.used.supernova,true,'cancellation remembers the actual explosion');
assert.equal(state.destroyed.length,0,'only knowledge survives rollback');
reset();state.flightSetup=FlightSetup.normalize({engine:true,sail:false,collectGas:false,arrivalFuelPercent:0});
state.selected='alpha';launch();assert.ok(state.flight);assert.equal(state.flightTips.used.collector,false);
Simulation.tick(state.flight.mission.proper*1.00001);
assert.equal(state.captured,0);assert.equal(state.flightTips.used['gas-collection'],false,'discarding gas is not refuelling');
console.log('PASS collector/gas explanations stay unlearned, executed supernova action is learned and cancellation preserves it');

reset();const prior=JSON.parse(JSON.stringify(state));
prior.flightTips={shown:{'double-click':2,'black-holes':1,'pulsars':1},used:{'shift-route':true},next:3};
prior.destroyed=['alpha'];prior.captured=.0001;
prior.journal.push({t:1,text:'Составной полёт: тяга + парус + коллектор; торможение: тяга + парус.'});
state=restore(prior);assert.equal(state.flightTips.shown['double-click'],2);assert.equal(state.flightTips.shown['black-holes'],1);assert.equal(state.flightTips.shown.pulsars,undefined);
for(const id of ['supernova','collector','gas-collection']) {
 assert.equal(state.flightTips.shown[id],0,'new entries start with no impressions');
 assert.equal(state.flightTips.used[id],id==='supernova','old actions teach only actionable tips');
}
const priorLearned=JSON.stringify(state.flightTips.used);state=initial();
assert.equal(JSON.stringify(state.flightTips.used),priorLearned);
assert.ok(Object.values(state.flightTips.shown).every(n=>n===0));
console.log('PASS saved counters are preserved and recorded physical use cannot teach explanatory tips');

reset();state.flightTips.shown['double-click']=2;state.flightTips.used['shift-route']=true;
state.flightTips.next=4; // An old save's index cannot determine the random result.
Math.random=()=>1-Number.EPSILON;brake(20);FlightTips.render();
assert.equal(state.flight.flightTip.id,'collector-survival','upper random bound reaches the last eligible tip');
const randomTip=$('toast').textContent,randomCounts=JSON.stringify(state.flightTips.shown);
Math.random=()=>0;
for(let i=0;i<20;i++)FlightTips.render();
assert.equal($('toast').textContent,randomTip);assert.equal(JSON.stringify(state.flightTips.shown),randomCounts,'redraws never reroll or count again');
state=restore(JSON.parse(JSON.stringify(state)));FlightTips.clear();FlightTips.render();
assert.equal($('toast').textContent,randomTip);assert.equal(JSON.stringify(state.flightTips.shown),randomCounts,'reload resumes the saved random choice');
brake(20);FlightTips.render();assert.equal(state.flight.flightTip.id,'black-holes','lower random bound skips learned and exhausted entries');
Math.random=()=>1-Number.EPSILON;brake(20);FlightTips.render();
assert.equal(state.flight.flightTip.id,'collector-survival');assert.equal(state.flightTips.shown['collector-survival'],2);
brake(20);FlightTips.render();assert.equal(state.flight.flightTip.id,'stellar-luminosity','a twice-shown random tip drops out of the pool');
for(const t of FlightTips.entries){state.flightTips.used[t.id]=true;state.flightTips.shown[t.id]=2;}
brake(20);FlightTips.render();assert.equal($('toast').hidden,true,'an empty eligible pool produces no tip');
console.log('PASS random choice at both bounds, learned/exhausted filtering, saved choice stability, two-show removal and empty pool');

Math.random=()=>0;
const actions=['double-click','shift-route','black-holes','supernova'];
const explanations=['collector','gas-collection','braking-refill','stellar-luminosity','collector-survival'];
assert.deepEqual(FlightTips.entries.filter(t=>t.learnable).map(t=>t.id),actions);
for(const id of explanations) {
 reset();for(const t of FlightTips.entries)state.flightTips.shown[t.id]=2;
 state.flightTips.shown[id]=0;brake(20);FlightTips.render();assert.equal(state.flight.flightTip.id,id);
 FlightTips.use(id);assert.equal(state.flightTips.used[id],false);assert.equal($('toast').hidden,false,'explanations cannot be dismissed by a use event');
 state.flightTips.used[id]=true;FlightTips.render();assert.equal($('toast').hidden,false,'stale flags cannot suppress a visible explanation');
 state=restore(JSON.parse(JSON.stringify(state)));FlightTips.clear();FlightTips.render();
 assert.equal(state.flightTips.used[id],false);assert.equal(state.flightTips.shown[id],1);
 state.flightTips.used[id]=true;brake(20);FlightTips.render();assert.equal(state.flight.flightTip.id,id,'stale flags cannot remove explanations from random selection');
 assert.equal(state.flightTips.shown[id],2);brake(20);FlightTips.render();assert.equal($('toast').hidden,true);
}
console.log('PASS all five explanations cannot be learned, stale flags cannot hide them, reload restores them and two-show caps still apply');

reset();const priorProfile=Object.fromEntries(FlightTips.entries.map(t=>[t.id,true]));
const migrationSave=JSON.parse(JSON.stringify(state));migrationSave.flightTips.used=priorProfile;
migrationSave.flightTips.shown.collector=1;migrationSave.flightTips.shown['gas-collection']=2;
let profileJson=JSON.stringify(priorProfile);
const savedGet=localStorage.getItem,savedSet=localStorage.setItem;
try {
 localStorage.getItem=key=>key==='parus-flight-tip-used'?profileJson:null;
 localStorage.setItem=(key,value)=>{if(key==='parus-flight-tip-used')profileJson=value;};
 FlightTips.learned=null;state=restore(migrationSave);
 for(const id of actions)assert.equal(state.flightTips.used[id],true);
 for(const id of explanations){assert.equal(state.flightTips.used[id],false);assert.equal(JSON.parse(profileJson)[id],false);}
 assert.equal(state.flightTips.shown.collector,1);assert.equal(state.flightTips.shown['gas-collection'],2,'actual impressions are never refunded');
 state=initial();for(const id of explanations)assert.equal(state.flightTips.used[id],false);
 assert.ok(Object.values(state.flightTips.shown).every(n=>n===0));
} finally {localStorage.getItem=savedGet;localStorage.setItem=savedSet;}
console.log('PASS legacy expedition/profile learning flags are corrected for every explanation, with action learning and impression counts preserved');
} finally {Math.random=nativeRandom;FlightEstimate.get=nativeEstimate;}
}`);
