import fs from 'node:fs';
const harness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {run};';
const {run} = await import('data:text/javascript,' + encodeURIComponent(harness) + '#flight-tips');
run(`{
const nativeRandom=Math.random,nativeEstimate=FlightEstimate.get,nativeEligible=FlightTips.eligible;
// Isolate presentation/receipts from topic prerequisites in these legacy scenarios.
// The real eligibility graph is exercised separately below.
FlightTips.eligible=function(t,p=state.flightTips){return !(t.learnable&&p.used[t.id])&&p.shown[t.id]<this.maximumShows;};
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
const beforeCancel=FlightTips.normalize(state.flightTips);FlightHistory.cancel();
assert.equal(state.flight,null);assert.deepEqual(state.flightTips,beforeCancel,'cancel cannot refund shows or forget learning');
assert.equal(state.proper,JSON.parse(rollback).proper);assert.equal(state.matter,JSON.parse(rollback).matter);
state=restore(JSON.parse(JSON.stringify(state)));assert.deepEqual(state.flightTips,beforeCancel);
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

for(const random of [()=>0,()=>1-Number.EPSILON,nativeRandom]) {
 reset();Math.random=random;const sequence=[];
 for(let i=0;i<2*FlightTips.entries.length;i++){
  brake(20);FlightTips.render();sequence.push(state.flight.flightTip.id);
  if(i===2){
   const receipt=JSON.stringify(state.flight.flightTip),progress=JSON.stringify(state.flightTips);
   for(let j=0;j<20;j++)FlightTips.render();
   assert.equal(JSON.stringify(state.flightTips),progress,'redraws do not reshuffle');
   state=restore(JSON.parse(JSON.stringify(state)));FlightTips.clear();FlightTips.render();
   assert.equal(JSON.stringify(state.flightTips),progress,'reload preserves the remaining shuffle and last tip');
   assert.equal(JSON.stringify(state.flight.flightTip),receipt);
  }
 }
 const n=FlightTips.entries.length;
 assert.equal(new Set(sequence.slice(0,n)).size,n,'every eligible tip appears before a second pass');
 assert.equal(new Set(sequence.slice(n)).size,n,'the second pass also has no repeats');
 assert.ok(sequence.every((id,i)=>i===0||id!==sequence[i-1]),'shuffle boundaries cannot repeat the last tip');
 assert.deepEqual(counts(),allCounts(2));brake(20);FlightTips.render();assert.equal($('toast').hidden,true);
}
reset();Math.random=()=>0;brake(20);FlightTips.render();
const last=state.flightTips.last;
for(const t of FlightTips.entries)if(t.id!==last)state.flightTips.shown[t.id]=2;
brake(20);FlightTips.render();assert.equal(state.flight.flightTip,undefined,'a lone remaining tip does not repeat immediately');
assert.equal(state.flightTips.shown[last],1,'skipping an immediate repeat spends no impression');
state=restore(JSON.parse(JSON.stringify(state)));brake(20);FlightTips.render();assert.equal(state.flight.flightTip,undefined);
console.log('PASS Fisher–Yates shuffle at both RNG bounds and native randomness, complete passes, boundary repeat avoidance, saved queue/last tip and lone-tip suppression');

Math.random=()=>0;
const actions=['double-click','shift-route','black-holes','supernova'];
const explanations=FlightTips.entries.filter(t=>!t.learnable).map(t=>t.id);
assert.deepEqual(FlightTips.entries.filter(t=>t.learnable).map(t=>t.id),actions);
for(const id of explanations) {
 reset();for(const t of FlightTips.entries)state.flightTips.shown[t.id]=2;
 state.flightTips.shown[id]=0;brake(20);FlightTips.render();assert.equal(state.flight.flightTip.id,id);
 FlightTips.use(id);assert.equal(state.flightTips.used[id],false);assert.equal($('toast').hidden,false,'explanations cannot be dismissed by a use event');
 state.flightTips.used[id]=true;FlightTips.render();assert.equal($('toast').hidden,false,'stale flags cannot suppress a visible explanation');
 state=restore(JSON.parse(JSON.stringify(state)));FlightTips.clear();FlightTips.render();
 assert.equal(state.flightTips.used[id],false);assert.equal(state.flightTips.shown[id],1);
 const between=id==='collector'?'gas-collection':'collector';state.flightTips.shown[between]=1;state.flightTips.queue=[between];
 brake(20);FlightTips.render();assert.equal(state.flight.flightTip.id,between,'another explanation separates repeated shows');
 state.flightTips.used[id]=true;brake(20);FlightTips.render();assert.equal(state.flight.flightTip.id,id,'stale flags cannot remove explanations from random selection');
 assert.equal(state.flightTips.shown[id],2);brake(20);FlightTips.render();assert.equal($('toast').hidden,true);
}
console.log('PASS every explanation cannot be learned, stale flags cannot hide it, reload restores it and two-show caps still apply');

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

FlightTips.eligible=nativeEligible;Math.random=()=>0;
assert.equal(FlightTips.entries.length,27,'nine existing tips plus eighteen approved physics tips');
assert.equal(new Set(FlightTips.entries.map(t=>t.id)).size,27);
assert.ok(FlightTips.entries.every(t=>[...t.text].length<=161),'all texts fit the previous maximum');
const visiting=new Set(),visited=new Set();
const visit=id=>{
 assert.ok(!visiting.has(id),'topic prerequisites must not cycle: '+id);
 if(visited.has(id))return;
 const tip=FlightTips.entries.find(t=>t.id===id);assert.ok(tip,'unknown prerequisite '+id);visiting.add(id);
 for(const parent of tip.after||[])visit(parent);
 visiting.delete(id);visited.add(id);
};
for(const t of FlightTips.entries)visit(t.id);
const eligible=()=>FlightTips.entries.filter(t=>FlightTips.eligible(t)).map(t=>t.id);
const show=id=>{brake(30);state.flightTips.queue=[id];FlightTips.render();assert.equal(state.flight.flightTip?.id,id);};
reset();brake(30);
assert.deepEqual(eligible(),['double-click','shift-route','time-dilation','light-speed-limit'],'a new pilot sees introductions before advanced subjects');
show('time-dilation');assert.ok(eligible().includes('time-dilation-99')&&eligible().includes('proper-time-distance'));
assert.ok(!eligible().includes('time-dilation-99995'));show('time-dilation-99');assert.ok(eligible().includes('time-dilation-99995'));
show('shift-route');assert.ok(eligible().includes('black-holes'));assert.ok(!eligible().includes('flyby-course'));
show('black-holes');assert.ok(eligible().includes('flyby-course'));assert.ok(!eligible().includes('flyby-angle'));
show('flyby-course');assert.ok(eligible().includes('flyby-angle')&&eligible().includes('flyby-stars'));
console.log('PASS independent introductions, staged relativity examples and route → black-hole → course → angle explanations');

reset();brake(30);state.expansion=true;
assert.ok(eligible().includes('expanding-flight'));
for(const id of ['bound-local-group','cosmic-chase','cosmic-horizon','ancient-light','superluminal-expansion'])assert.ok(!eligible().includes(id),id);
show('expanding-flight');assert.ok(eligible().includes('bound-local-group')&&eligible().includes('cosmic-chase'));
assert.ok(!eligible().includes('superluminal-expansion'));show('light-speed-limit');assert.ok(eligible().includes('superluminal-expansion'));
show('cosmic-chase');assert.ok(eligible().includes('cosmic-horizon'));assert.ok(!eligible().includes('ancient-light'));
show('cosmic-horizon');assert.ok(eligible().includes('ancient-light'));
state.expansion=false;assert.ok(!FlightTips.entries.some(t=>t.when==='expansion'&&FlightTips.eligible(t)),'disabled expansion suppresses the entire cosmology topic');
const beforeLocked=JSON.stringify(state.flightTips.shown);state.flightTips.queue=['ancient-light'];FlightTips.pick();
assert.equal(JSON.stringify(state.flightTips.shown),beforeLocked,'filtering locked queue entries cannot consume their quota');
console.log('PASS expansion → reach → horizon → ancient light, superluminal explanation after the light-speed limit and contextual freeze');

reset();brake(30);assert.ok(!eligible().includes('supernova')&&!eligible().includes('collector-survival')&&!eligible().includes('photons-in-flight'));
assert.ok(!eligible().includes('collector')&&!eligible().includes('gas-collection')&&!eligible().includes('photon-engine'));
state.flight.mission.setup={brakeSail:true,collectGas:false,densityCm3:1};assert.ok(!eligible().includes('gas-collection'),'discarded gas is not planned refuelling');
state.flight.mission.setup.collectGas=true;state.flight.mission.setup.densityCm3=0;assert.ok(!eligible().includes('gas-collection'),'vacuum is not planned refuelling');
state.flight.magnetic={k:1,noCapture:true};assert.ok(!eligible().includes('gas-collection'),'legacy releasing sails are not refuelling');
state.flight.magnetic.noCapture=false;assert.ok(eligible().includes('gas-collection'),'legacy collecting sails introduce refuelling');
reset();state.selected='andromeda';launch();
assert.ok(state.flightTips.experienced.collector&&state.flightTips.experienced['stellar-luminosity']&&state.flightTips.experienced['photon-engine'],'launch records relevant, actual equipment');
assert.equal(state.flightTips.used.collector,false);assert.equal(state.flightTips.used['stellar-luminosity'],false);
assert.ok(eligible().includes('collector')&&eligible().includes('stellar-luminosity')&&eligible().includes('photon-engine')&&eligible().includes('gas-collection'));
assert.ok(eligible().includes('supernova'),'using the collector introduces its topic without pretending its explanation was learned');
assert.ok(!eligible().includes('collector-survival')&&!eligible().includes('photons-in-flight'));
const actualPlan=state.flight.mission;Simulation.tick(actualPlan.accelerationEnd.proper+actualPlan.coast.proper+actualPlan.brake.proper*.01);FlightTips.render();
assert.ok(state.captured>0&&state.flightTips.experienced['gas-collection']);assert.ok(eligible().includes('braking-refill'));
show('supernova');assert.ok(eligible().includes('collector-survival'));assert.ok(!eligible().includes('photons-in-flight'));
show('collector-survival');assert.ok(eligible().includes('photons-in-flight'));
const explained=FlightTips.normalize(state.flightTips);state=restore(JSON.parse(JSON.stringify(state)));assert.deepEqual(state.flightTips,explained);
reset();brake(30);FlightTips.use('supernova');assert.ok(!eligible().includes('collector-survival'),'supernova experience alone cannot replace knowing the collector');
state.flightTips.experienced.collector=true;assert.ok(eligible().includes('collector-survival'));
console.log('PASS actual equipment and gas capture unlock topics without learning explanations; supernova AND collector precede destruction, then photons in flight');

reset();brake(30);for(const t of FlightTips.entries)state.flightTips.shown[t.id]=2;
state.flightTips.shown['gas-collection']=0;state.flightTips.shown['braking-refill']=0;
FlightTips.render();assert.equal(state.flight.flightTip,undefined);
const waitingFlight=state.flight;state.captured=.001;FlightTips.render();
assert.equal(state.flight,waitingFlight);assert.equal(state.flight.flightTip?.id,'gas-collection','actual gas capture can unlock the first tip later on the same flight');
assert.equal(state.flightTips.shown['gas-collection'],1);
console.log('PASS an empty topic pool is retried when an action unlocks knowledge on the same leg');

reset();state.expansion=true;
Object.assign(state.flightTips.experienced,{'shift-route':true,collector:true,'stellar-luminosity':true,'gas-collection':true,'photon-engine':true});
const sequence=[];
for(let i=0;i<2*FlightTips.entries.length;i++){
 const before=eligible(),unseen=before.filter(id=>state.flightTips.shown[id]===0);
 brake(30);FlightTips.render();const id=state.flight.flightTip?.id;
 assert.ok(id&&before.includes(id),'only currently unlocked explanations can appear');
 assert.ok(!unseen.length||unseen.includes(id),'newly unlocked introductions precede repeats');sequence.push(id);
}
assert.deepEqual(counts(),allCounts(2));assert.equal(new Set(sequence.slice(0,27)).size,27);assert.equal(new Set(sequence.slice(27)).size,27);
assert.ok(sequence.every((id,i)=>!i||id!==sequence[i-1]));
const lastShown=state.flightTips.last;state=restore(JSON.parse(JSON.stringify(state)));assert.equal(state.flightTips.last,lastShown);
brake(30);FlightTips.render();assert.equal(state.flight.flightTip,undefined);
state=initial();assert.equal(state.flightTips.last,null);assert.deepEqual(state.flightTips.queue,[]);assert.deepEqual(state.flightTips.experienced,{});
console.log('PASS all 27 topics unlock through the real prerequisite graph, unseen priority, two complete shuffled passes, exhaustion and a clean new expedition');

const corrupt=FlightTips.normalize({shown:{collector:2},used:{supernova:true},experienced:{collector:true,retired:true},queue:['collector','supernova','time-dilation','time-dilation','retired',null],last:'retired'});
assert.deepEqual(corrupt.queue,['time-dilation']);assert.equal(corrupt.last,null);assert.deepEqual(corrupt.experienced,{collector:true});
const oldProgress=FlightTips.normalize({shown:{collector:1,supernova:1}});assert.deepEqual(oldProgress.queue,[]);assert.equal(oldProgress.last,null);
const orderedProgress=FlightTips.normalize({experienced:{collector:true,'stellar-luminosity':true,'photon-engine':true,'expanding-flight':true}});
assert.equal(JSON.stringify(orderedProgress.experienced),JSON.stringify({collector:true,'stellar-luminosity':true,'photon-engine':true,'expanding-flight':true}),'saved experience order is retained');
assert.equal(JSON.stringify(FlightTips.normalize(JSON.parse(JSON.stringify(orderedProgress)))),JSON.stringify(orderedProgress),'unchanged normalized progress serializes identically after reload');
reset();state.captured=.001;const unobserved=JSON.stringify(state.flightTips);
state=restore(JSON.parse(JSON.stringify(state)));assert.equal(JSON.stringify(state.flightTips),unobserved,'modern saved familiarity is restored exactly, without inferring new UI observations');
FlightTips.observe(state);assert.ok(state.flightTips.experienced['gas-collection'],'the actual gas counter is observed when the interface resumes');
const merged=FlightTips.mergeProgress({...oldProgress,last:'collector',queue:['supernova']},{shown:{collector:2},experienced:{'gas-collection':true},last:'time-dilation',queue:['collector','time-dilation']});
assert.equal(merged.shown.collector,2);assert.equal(merged.shown.supernova,1);assert.equal(merged.last,'time-dilation');assert.deepEqual(merged.queue,['time-dilation']);assert.ok(merged.experienced['gas-collection']);
console.log('PASS malformed/retired/duplicate queues are repaired and rollback merges preserve the latest shuffle, familiarity and maximum impression counts');
} finally {Math.random=nativeRandom;FlightEstimate.get=nativeEstimate;FlightTips.eligible=nativeEligible;}
}`);

run(`{
const resetHorizon=()=>{
 FlightTips.learned=FlightTips.normalize().used;state=initial();paused=false;speed=1;
 Simulation.debt=Simulation.wallDebt=0;MapSlice.mode='full';FlightTips.clear();$('toast').hidden=true;Cosmology.sync(state);
};
const physical=()=>JSON.stringify([state.flight,state.ship,state.matter,state.beta,state.phase,state.proper,state.earth,state.cosmicTime,state.totalDistance]);
const schedule=setTimeout;let expired;
try {
 setTimeout=callback=>{expired=callback;return 0;};
 assert.ok([...FlightTips.solarHorizonText].length<=161);
 resetHorizon();state.current=null;state.cosmicTime=1e10;Cosmology.sync(state);
 const horizon=Cosmology.horizon();
 state.ship=Space.point([0,0,horizon*.99]);state.matter=0;
 FlightTips.render();assert.equal(state.flightTips.solarHorizonShown,false,'fuel limits do not trigger the photon-horizon warning');
 assert.equal($('toast').hidden,true);
 state.ship=Space.point([0,0,horizon*1.01]);
 assert.equal(Math.hypot(state.ship.x,state.ship.y),0,'the entire physical separation is along the depth axis');
 state.expansion=false;Cosmology.sync(state);FlightTips.render();
 assert.equal(state.flightTips.solarHorizonShown,false,'no finite light horizon with expansion disabled');
 state.expansion=true;Cosmology.sync(state);
 const outside=physical(),queue=JSON.stringify([state.flightTips.shown,state.flightTips.queue,state.flightTips.last]);
 FlightTips.render();assert.equal(physical(),outside,'the warning changes neither trajectory nor clocks or fuel');
 assert.equal($('toast').dataset.kind,'solar-horizon');assert.equal($('toast').dataset.icon,'warning');
 assert.equal($('toastText').textContent,FlightTips.solarHorizonText);
 assert.equal(state.flightTips.solarHorizonShown,true);
 assert.equal(JSON.stringify([state.flightTips.shown,state.flightTips.queue,state.flightTips.last]),queue,'event warnings never spend or reorder random tips');
 const warned=JSON.stringify(state.flightTips);for(let i=0;i<20;i++)FlightTips.render();
 assert.equal(JSON.stringify(state.flightTips),warned);assert.equal(state.journal.filter(e=>e.text===FlightTips.solarHorizonText).length,1);
 expired();assert.equal($('toast').hidden,true,'the event has a finite reading window even when parked');
 FlightTips.render();assert.equal($('toast').hidden,true);
 state=restore(JSON.parse(JSON.stringify(state)));Cosmology.sync(state);FlightTips.render();
 assert.equal($('toast').hidden,true,'reload never announces an already shown crossing again');
 assert.equal(state.journal.filter(e=>e.text===FlightTips.solarHorizonText).length,1);
 console.log('PASS current photon horizon in 3D, disabled expansion, no fuel-range confusion, unchanged physics/queue, journal, finite display, one-off accounting and reload');

 resetHorizon();state.selected='ring';launch();const plan=state.flight.mission;
 assert.ok(plan?.valid&&plan.cosmic,'a real planned flight to the Big Ring');
 Simulation.tick(4.01);$('toast').hidden=true;FlightTips.render();
 assert.equal(FlightTips.beyondSolarHorizon(),false);assert.equal(state.flightTips.solarHorizonShown,false);
 const ordinary=state.flight.flightTip?.id;
 Simulation.tick(plan.proper*.99-4.01);
 assert.equal(FlightTips.beyondSolarHorizon(),true,'the real flight crosses the shrinking event horizon');
 assert.ok(Math.hypot(...state.ship.p3)<Cosmology.horizon(0),'crossing occurs inside the initial 16.7-billion-light-year radius');
 const beforeWarning=physical();FlightTips.render();assert.equal(physical(),beforeWarning);
 assert.equal($('toast').dataset.kind,'solar-horizon','the crossing interrupts an ordinary tip on the same leg');
 assert.equal(state.flight.flightTip?.id,ordinary,'the ordinary receipt remains unchanged');
 FlightTips.render();assert.equal($('toast').dataset.kind,'solar-horizon');
 expired();assert.equal($('toast').dataset.kind,'tip','the previous tip resumes after the event');
 assert.equal(state.flight.flightTip?.id,ordinary);
 FlightHistory.cancel();assert.equal(state.flightTips.solarHorizonShown,true,'rollback cannot replay the milestone');
 assert.equal(FlightTips.beyondSolarHorizon(),false);assert.notEqual($('toast').dataset.kind,'solar-horizon');
 resetHorizon();assert.equal(state.flightTips.solarHorizonShown,false,'a new expedition resets the milestone');
 console.log('PASS real cosmological flight crosses before arrival, event interrupts/resumes the same random tip, rollback preserves one-off accounting and a new expedition resets it');

 state.current='ring';state.ship=Space.point(object('ring').p3);Cosmology.sync(state);
 assert.equal(FlightTips.beyondSolarHorizon(),false);Simulation.tick(2e10);
 assert.equal(FlightTips.beyondSolarHorizon(),true,'the horizon can overtake a parked ship as the Universe expands');
 toast('Важное сообщение');const finishNotice=expired;FlightTips.render();
 assert.equal(state.flightTips.solarHorizonShown,false,'an existing user notice retains its reading window');
 finishNotice();assert.equal($('toast').dataset.kind,'solar-horizon');
 assert.equal(state.flightTips.solarHorizonShown,true,'the deferred event is retried without an active flight');
 const legacy=JSON.parse(JSON.stringify(state));delete legacy.flightTips.solarHorizonShown;
 state=restore(legacy);Cosmology.sync(state);$('toast').hidden=true;FlightTips.render();
 assert.equal($('toast').dataset.kind,'solar-horizon','old saves already beyond the horizon receive the new explanation');
 state=restore(JSON.parse(JSON.stringify(state)));Cosmology.sync(state);$('toast').hidden=true;FlightTips.render();
 assert.equal($('toast').hidden,true);
 assert.equal(FlightTips.normalize({solarHorizonShown:'true'}).solarHorizonShown,false);
 assert.equal(FlightTips.mergeProgress({solarHorizonShown:true},{}).solarHorizonShown,true);
 console.log('PASS bound-host translation, stationary horizon crossing, notice priority/deferred delivery, legacy-save migration and strict milestone flags');
} finally {setTimeout=schedule;}
}`);
