import fs from 'node:fs';
const harness = fs.readFileSync('tests/verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {run};';
const {run} = await import('data:text/javascript,' + encodeURIComponent(harness) + '#engine-start');

run(`{
const story=Quests.flightStory,announce=Quests.announce;
const id='sail-collector',advice=FlightTips.entries.find(t=>t.id===id);
const reset=()=>{
 OrbitalArrival.enabled=true;FlightTips.learned=FlightTips.normalize().used;
 state=initial();state.expansion=false;paused=false;speed=1;FlightQueue.reset();
 Simulation.debt=Simulation.wallDebt=0;FlightTips.clear();$('toast').hidden=true;Cosmology.sync(state);
};
const prepare=(proper=61,remaining=proper,setup=FlightSetup.read())=>{
 FlightTips.clear();$('toast').hidden=true;
 state.flight={target:'alpha',fromId:'sol',cosmic:false,noticeElapsed:4,mission:{proper,setup,sourceId:'sol'}};
 state.phase='cruise';return {proper:remaining};
};
const physical=()=>JSON.stringify([state.flight,state.ship,state.matter,state.beta,state.phase,state.proper,state.earth,state.cosmicTime]);
try {
 reset();let c=FlightSetup.read();
 assert.deepEqual([c.engine,c.sail,c.collector,c.burst],[true,false,false,false]);
 assert.equal(state.departureMode,'engine');assert.equal(c.arrivalFuelPercent,50);
 const firstSetup=JSON.stringify(state.flightSetup);state=restore(JSON.parse(JSON.stringify(state)));
 assert.equal(JSON.stringify(state.flightSetup),firstSetup,'new engine preference survives reload');
 QuickFlight.toggle('collector');c=FlightSetup.read();assert.ok(c.sail&&c.collector&&c.engine);
 state=restore(JSON.parse(JSON.stringify(state)));assert.ok(FlightSetup.read().collector,'explicit optical choices survive reload');
 for(const missing of [false,true]){
  const old=JSON.parse(JSON.stringify(state));old.flightSetup=null;old.departureMode='beam';
  if(missing)delete old.flightSetup;
  state=restore(old);assert.ok(FlightSetup.read().sail&&FlightSetup.read().collector,'legacy unset setups keep their optical default');
 }
 console.log('PASS new expeditions start on engine thrust, optical options remain available, new/explicit/legacy preferences survive reload');

 Quests.flightStory=()=>({});Quests.announce=()=>Notices.render('История цели','quest','quest');
 for(const proper of [20,59.999,60]){
  reset();const eta=prepare(proper);FlightTips.render(eta);
  assert.equal(FlightTips.longEngineFlight(),false);assert.equal($('toast').dataset.kind,'quest');
  assert.equal(state.flightTips.shown[id],0,'the threshold is strictly greater than a minute');
 }
 for(const rate of [.5,1,10,1000]){
  reset();speed=rate;const eta=prepare(20000);
  FlightTips.render(eta);assert.equal(state.flight.flightTip.id,id,'tempo does not change the baseline threshold');
 }
 reset();speed=.5;let eta=prepare(60.001,8);
 FlightTips.render(eta);assert.equal(state.flight.flightTip.id,id,'use the whole planned flight, even if its remaining duration is short');
 reset();speed=10;eta=prepare(190,150);FlightTips.render(eta);
 assert.equal(state.flight.flightTip.id,id,'the recommendation does not require twenty real seconds at an accelerated tempo');
 reset();eta=prepare(70);state.flight.summary={proper:70};state.flight.departureMode='engine';delete state.flight.mission;
 FlightTips.render(eta);assert.equal(state.flight.flightTip.id,id,'legacy engine flights use their saved whole-leg forecast');
 for(const changes of [{sail:true},{sail:true,collector:true},{engine:false},{dump:true}]){
  reset();eta=prepare(1000,1000,{...FlightSetup.read(),...changes});FlightTips.render(eta);
  assert.equal(state.flightTips.shown[id],0);assert.equal($('toast').dataset.kind,'quest');
 }
 console.log('PASS strict >60-second threshold at tempo 1, whole-leg duration, tempo independence and exclusion of optical/dumped/no-engine plans');

 reset();eta=prepare();const previous='time-dilation';
 state.flight.flightTip={id:previous};state.flightTips.shown[previous]=1;state.flightTips.last=previous;
 FlightTips.render(eta);assert.equal(state.flight.flightTip.id,id,'existing flights with an ordinary receipt get the contextual recommendation');
 assert.equal(state.flightTips.shown[previous],1,'replacing a previously displayed card cannot refund it');
 reset();eta=prepare();state.flight.noticeElapsed=0;
 const startupAction={label:'Открыть',run(){}};toast('Действие при старте',14000,'warning',startupAction);
 state.flight.noticeElapsed=4;FlightTips.render(eta);
 assert.equal(Notices.action,startupAction);assert.equal(state.flightTips.shown[id],0,'actionable startup notices retain priority');

 reset();eta=prepare();state.flight.noticeElapsed=3.999;FlightTips.render(eta);
 assert.equal($('toast').dataset.kind,'quest');assert.equal(state.flightTips.shown[id],0);
 state.flight.noticeElapsed=4;paused=true;FlightTips.render(eta);assert.equal(state.flightTips.shown[id],0);
 paused=false;const action={label:'Открыть',run(){}};toast('Важное сообщение',4200,'warning',action);
 FlightTips.render(eta);assert.equal(Notices.action,action);assert.equal(state.flightTips.shown[id],0);
 $('toast').hidden=true;FlightTips.render(eta);
 assert.equal($('toastText').textContent,advice.text);assert.equal($('toast').dataset.kind,'tip');
 assert.equal(Notices.action,FlightTips.libraryAction(['flight']));assert.equal(state.flightTips.shown[id],1);
 const before=physical(),progress=JSON.stringify(state.flightTips);
 for(let i=0;i<10;i++)FlightTips.render(eta);
 assert.equal(physical(),before);assert.equal(JSON.stringify(state.flightTips),progress);
 state=restore(JSON.parse(JSON.stringify(state)));FlightTips.clear();FlightTips.render(eta);
 assert.equal(physical(),before);assert.equal(JSON.stringify(state.flightTips),progress,'reload resumes the receipt without spending another show');
 FlightTips.render({proper:2});assert.equal($('toast').dataset.kind,'arrival');
 FlightTips.render(eta);assert.equal($('toastText').textContent,advice.text);
 eta=prepare();FlightTips.render(eta);assert.equal(state.flightTips.shown[id],2);
 eta=prepare();FlightTips.render(eta);assert.equal($('toast').dataset.kind,'quest');assert.equal(state.flightTips.shown[id],2);
 console.log('PASS startup delay, pause, actionable notice priority, precedence over quests, library link, unchanged physics, receipt/reload, arrival and two-show cap');

 Quests.flightStory=story;Quests.announce=announce;
 reset();state.selected='sgr';launch();const plan=state.flight.mission;
 assert.ok(plan.valid&&plan.proper>60&&!plan.setup.sail&&plan.setup.engine);
 Simulation.advance(4.01);$('toast').hidden=true;renderUI();assert.equal(state.flight.flightTip.id,id);
 const active=state.flight,snapshot=physical(),ledger=JSON.stringify(state.flightTips);
 select('sirius');QuickFlight.toggle('collector');
 assert.equal(state.flight,active);assert.equal(physical(),snapshot,'future optical choices cannot change the active engine flight');
 state=restore(JSON.parse(JSON.stringify(state)));FlightTips.clear();renderUI();
 assert.equal(physical(),snapshot);assert.equal(JSON.stringify(state.flightTips),ledger);
 const rollback=state.flight.rollback;FlightHistory.cancel();
 assert.equal(state.flight,null);assert.equal(state.proper,rollback.proper);assert.equal(state.matter,rollback.matter);
 assert.equal(state.flightTips.shown[id],1,'cancellation keeps the displayed recommendation accounted for');
 reset();state.selected='proxima';launch();assert.ok(state.flight.mission.proper<60);
 Simulation.advance(4.01);renderUI();assert.equal(state.flightTips.shown[id],0);
 reset();state.flightSetup=FlightSetup.defaults();state.selected='sgr';launch();
 const optical=physical();state=restore(JSON.parse(JSON.stringify(state)));assert.equal(physical(),optical,'existing optical trajectories retain their plan, fuel and clocks');
 assert.equal(FlightTips.longEngineFlight(),false);
 console.log('PASS real engine and short flights, future optical planning, exact active-flight reload/cancellation and preservation of existing optical trajectories');
} finally {Quests.flightStory=story;Quests.announce=announce;}
}`);
