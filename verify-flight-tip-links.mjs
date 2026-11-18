import fs from 'node:fs';
const harness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {run};';
const {run} = await import('data:text/javascript,' + encodeURIComponent(harness) + '#flight-tip-links');

run(`{
const estimate = FlightEstimate.get, story = Quests.flightStory;
let remaining = 100, scrolled;
const physics = () => JSON.stringify([state.flight,state.ship,state.beta,state.matter,state.proper,state.earth,state.cosmicTime,state.phase]);
const prepare = tip => {
 state=initial();state.expansion=false;paused=false;speed=1;FlightQueue.reset();
 state.flight={target:'sirius',cosmic:false,noticeElapsed:5,mission:{brake:{proper:100}},flightTip:{id:tip.id}};
 state.phase='brake';state.flightTips.shown[tip.id]=1;state.flightTips.last=tip.id;
 FlightTips.clear();$('toast').hidden=true;$('infoDialog').open=false;Cosmology.sync(state);
};
try {
 FlightEstimate.get=()=>({proper:remaining});Quests.flightStory=()=>null;
 $('toastAction').hidden=true; // The initial HTML button has the hidden attribute.
 const linked=FlightTips.entries.filter(t=>t.library);
 assert.deepEqual(FlightTips.entries.filter(t=>!t.library).map(t=>t.id),['double-click','shift-route']);
 for(const tip of FlightTips.entries){
  prepare(tip);const before=physics(),progress=JSON.stringify(state.flightTips);
  FlightTips.render();assert.equal($('toastText').textContent,tip.text);
  assert.equal($('toastAction').hidden,!tip.library,tip.id);
  if(!tip.library){assert.equal(Notices.action,null);continue;}
  const [chapter,section]=tip.library,id='lib-'+chapter+'-'+section;
  assert.ok(Library.chapters.some(c=>c.id===chapter),tip.id+' chapter');
  const target=$(id);target.scrollIntoView=options=>{scrolled={id,options};};
  const action=Notices.action;
  assert.equal(action.label,'В библиотеке');
  for(let i=0;i<5;i++){FlightTips.render();assert.equal(Notices.action,action,'frames reuse the same action');}
  $('toast').onclick();
  assert.equal($('toastAction').hidden,true,'consumed actions leave no stale button on a later plain tip');
  assert.equal(Library.current,chapter,tip.id);assert.ok($('infoDialog').open);
  assert.ok($('dialogContent').innerHTML.includes('id="'+id+'"'),tip.id+' section exists in the rendered chapter');
  assert.deepEqual(scrolled,{id,options:{block:'start'}});
  assert.equal(physics(),before,'reading changes no flight state');
  assert.equal(JSON.stringify(state.flightTips),progress,'reading neither learns nor spends another tip');
 }
 console.log('PASS all '+linked.length+' factual tips link to existing library sections, control tips stay plain, and reading preserves flight/progress');

 const tip=FlightTips.entries.find(t=>t.id==='time-dilation');
 prepare(tip);FlightTips.render();const action=Notices.action;
 const noticeAction={label:'Открыть',run(){}};
 toast('Важное сообщение',4200,'warning',noticeAction);FlightTips.render();
 assert.equal(Notices.action,noticeAction,'a new user notice keeps its own action');
 $('toast').hidden=true;FlightTips.render();assert.equal(Notices.action,action,'the same link resumes after the notice');
 remaining=2;FlightTips.render();assert.equal($('toast').dataset.kind,'arrival');
 assert.equal(Notices.action,null);assert.equal($('toastAction').hidden,true,'arrival cannot retain a stale library link');
 remaining=100;FlightTips.render();assert.equal(Notices.action,action);
 const beforeReload=physics(),progress=JSON.stringify(state.flightTips);
 state=restore(JSON.parse(JSON.stringify(state)));FlightTips.clear();FlightTips.render();
 assert.equal(physics(),beforeReload);assert.equal(JSON.stringify(state.flightTips),progress);
 assert.equal(Notices.action,action,'saved tip receipts regain their link without another impression');
 assert.equal(JSON.stringify(state.flight.flightTip),JSON.stringify({id:tip.id}),'only the original receipt is saved');
 $('toast').onclick();assert.equal(Library.current,'relativity');
 $('infoDialog').open=false;Library.open('gravity');assert.equal($('infoDialog').scrollTop,0,'ordinary chapter navigation still starts at the top');
 console.log('PASS notices and arrival replace links correctly, reload restores the same action/receipt, and regular library navigation starts at the chapter title');

 state=initial();state.current=null;state.ship=Space.point([0,0,Cosmology.horizon(0)*1.01]);
 Cosmology.sync(state);FlightTips.clear();$('toast').hidden=true;
 const beforeHorizon=physics();FlightTips.render();assert.equal($('toast').dataset.kind,'solar-horizon');
 assert.equal(Notices.action,FlightTips.libraryAction(['gravity','horizons']));
 $('toast').onclick();assert.equal(Library.current,'gravity');assert.equal(scrolled.id,'lib-gravity-horizons');
 assert.equal(physics(),beforeHorizon);FlightTips.render();assert.equal($('toast').hidden,true,'reading cannot repeat the one-off horizon warning');
 assert.equal(state.flightTips.solarHorizonShown,true);
 console.log('PASS the solar horizon warning opens its explanation and retains one-off accounting');
} finally {FlightEstimate.get=estimate;Quests.flightStory=story;}
}`);
