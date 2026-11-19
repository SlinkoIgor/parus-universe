import assert from 'node:assert/strict';
import fs from 'node:fs';

const baseHarness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0];
let fixture = 0;
async function game({saved = [], hostname = 'parus.165.232.99.124.sslip.io', privacy = {}, brokenStorage = false} = {}) {
  let harness = `import {webcrypto} from 'node:crypto';\n` + baseHarness;
  harness = harness.replace('const context=vm.createContext({', `
const requests=[], store=new Map(${JSON.stringify(saved)}), intervals=[], documentEvents=new Map(), windowEvents=new Map();
let clock=Date.now();
class Clock extends Date {static now(){return clock;}}
const listen=(map,name,fn)=>{if(!map.has(name))map.set(name,[]);map.get(name).push(fn);};
const context=vm.createContext({
  crypto:webcrypto, setInterval(fn){intervals.push(fn);return intervals.length;},
  location:{protocol:'https:',hostname:${JSON.stringify(hostname)},origin:'https://${hostname}',href:'https://${hostname}/?private=SECRET#SECRET',pathname:'/'},
  navigator:{language:'ru',...${JSON.stringify(privacy)}},
  fetch(url,options){
    if(url!=='/analytics/api/send')return Promise.reject(Error('No external network in analytics tests'));
    requests.push({url,...options,body:JSON.parse(options.body)});
    return Promise.resolve({ok:true,json:async()=>({})});
  },`)
    .replace(',Date,setTimeout', ',Date:Clock,setTimeout')
    .replace('querySelectorAll:()=>[],addEventListener(){}', 'querySelectorAll:()=>[],addEventListener(name,fn){listen(documentEvents,name,fn);}')
    .replace('window:{devicePixelRatio:1,addEventListener(){}', 'window:{devicePixelRatio:1,addEventListener(name,fn){listen(windowEvents,name,fn);}')
    .replace('localStorage:{getItem(){return null},setItem(){}}', `localStorage:{
      getItem(key){if(${brokenStorage})throw Error('Storage disabled');return store.get(key)||null;},
      setItem(key,value){if(${brokenStorage})throw Error('Storage full');store.set(key,String(value));}
    }`);
  harness += `
context.advanceClock=ms=>{clock+=ms;};
context.fireDocument=name=>(documentEvents.get(name)||[]).forEach(fn=>fn({target:{closest(){return null;}}}));
context.fireWindow=(name,event={})=>(windowEvents.get(name)||[]).forEach(fn=>fn(event));
export {context,run,requests,store,intervals};`;
  return import('data:text/javascript,' + encodeURIComponent(harness) + '#analytics-' + fixture++);
}
const events = g => g.requests.map(r => r.body.payload).filter(p => p.name);
const named = (g, name) => events(g).filter(p => p.name === name);
const data = (g, name) => named(g, name).at(-1)?.data;

const g = await game();
assert.equal(named(g, 'game_opened').length, 1);
assert.equal(named(g, 'expedition_started').length, 1);
assert.equal(named(g, 'theme_changed').length, 0, 'loading saved/default palette is not a change');
const player = named(g, 'game_opened')[0].id;
const expedition = data(g, 'expedition_started').expedition_id;
g.run(`
assert.equal($('analyticsSetting').hidden,false);
assert.equal($('analyticsToggle').checked,true);
showObject('alpha');showObject('alpha');$('infoDialog').close();showObject('alpha');
applyTheme('light');applyTheme('light');applyTheme('radar');
state.journal.push({text:'SECRET'});
state.selected='sol';launch(true);
`);
assert.equal(named(g, 'object_card_opened').length, 2, 'rerender does not inflate card count');
assert.equal(named(g, 'theme_changed').length, 2);
assert.equal(data(g, 'theme_changed').from_theme, 'light');
assert.equal(data(g, 'theme_changed').to_theme, 'radar');
assert.equal(named(g, 'flight_started').length, 0, 'rejected launch is not a flight');
g.run(`state.selected='proxima';launch(true);persist();persist();`);
assert.equal(named(g, 'flight_started').length, 1);
assert.equal(named(g, 'play_started').length, 1);
assert.equal(data(g, 'flight_started').flight_number, 1);
const flight = data(g, 'flight_started').flight_id;
const savedFlight = [...g.store];
const reload = await game({saved: savedFlight});
assert.equal(named(reload, 'expedition_started').length, 0);
assert.equal(named(reload, 'expedition_resumed').length, 1);
assert.equal(named(reload, 'flight_started').length, 0);
assert.equal(data(reload, 'flight_resumed').flight_id, flight);
assert.equal(named(reload, 'game_opened')[0].id, player);
assert.equal(data(reload, 'game_opened').expedition_id, expedition);
assert.equal(data(reload, 'game_opened').returning, true);
reload.run(`state.flight.covered=state.flight.distance;finishFlight(true);persist();`);
assert.equal(named(reload, 'flight_finished').length, 1, 'completion is reported once across history and finish hooks');
assert.equal(data(reload, 'flight_finished').outcome, 'arrived');
assert.equal(data(reload, 'flight_finished').flight_id, flight);
reload.run(`
state.selected='sirius';launch(true);
FlightHistory.cancel();
state.selected='sirius';launch(true);
finishFlight(false);
`);
assert.equal(named(reload, 'flight_started').length, 2);
assert.equal(named(reload, 'flight_cancelled').length, 1);
assert.equal(data(reload, 'flight_cancelled').reason, 'cancel');
assert.equal(data(reload, 'flight_finished').outcome, 'stopped_short');
assert.equal(data(reload, 'flight_finished').flight_number, 3, 'rollback does not roll back real actions');

// Actual flyby continuation creates a new flight object and may call complete twice.
g.run(`
state.flight.target='sgr';
state.flight.route=[{id:'sgr',mode:'flyby'},{id:'sirius',mode:'stop'}];
state.flight.legIndex=0;
const completed=state.flight;
assert.equal(Route.isFlyby(completed),true);
Route.next(completed,Space.point(object('sgr').p3),0.01);
FlightHistory.complete(completed);
persist();
`);
assert.equal(named(g, 'flight_started').length, 2, 'automatic route leg is counted');
assert.equal(named(g, 'flight_finished').length, 1);
assert.equal(data(g, 'flight_finished').outcome, 'flyby');
assert.equal(data(g, 'flight_started').flight_number, 2);
assert.equal(data(g, 'flight_started').route_leg, 2);
assert.notEqual(data(g, 'flight_started').flight_id, flight);

// The reset handler ends the current expedition before creating its successor.
g.run(`$('resetBtn').onclick();$('confirmReset').onclick();`);
assert.equal(data(g, 'expedition_ended').flights_started, 2);
assert.equal(data(g, 'expedition_ended').cards_opened, 2);
assert.equal(data(g, 'expedition_ended').theme_changes, 2);
assert.equal(data(g, 'flight_cancelled').reason, 'reset');
assert.notEqual(data(g, 'expedition_started').expedition_id, expedition);
assert.equal(data(g, 'expedition_started').expedition_number, 2);
assert.equal(named(g, 'game_opened')[0].id, player);

g.run(`
const quest=QUESTS.find(q=>!q.requires);
globalThis.testQuest=quest;
assert.equal(Quests.start(quest.id),true);assert.equal(Quests.start(quest.id),false);
state.visited.push(...quest.steps.flatMap(step=>Quests.ids(step)));Quests.sync();Quests.sync();
`);
assert.equal(named(g, 'quest_started').length, 1);
assert.equal(named(g, 'quest_completed').length, 1);
assert.equal(data(g, 'quest_completed').steps_done, data(g, 'quest_completed').steps_total);

// Heartbeat counts real visible time, excludes idle and hidden time, and tolerates sleep.
const timed = await game();
timed.context.advanceClock(30000);timed.intervals[0]();
assert.equal(data(timed, 'active_time').seconds, 30);
timed.context.advanceClock(90000);timed.intervals[0]();
assert.equal(data(timed, 'active_time').seconds, 30, 'only the remainder of the idle allowance counts');
const pulses = named(timed, 'active_time').length;
timed.context.advanceClock(30000);timed.intervals[0]();
assert.equal(named(timed, 'active_time').length, pulses);
timed.context.fireDocument('pointerdown');
timed.context.document.hidden = true;timed.context.fireDocument('visibilitychange');
timed.context.advanceClock(300000);timed.intervals[0]();
assert.equal(named(timed, 'active_time').length, pulses);
timed.context.fireWindow('pagehide');timed.context.fireWindow('pagehide');
assert.equal(named(timed, 'session_summary').length, 1);
assert.equal(data(timed, 'session_summary').visit_active_seconds, 60);

// Privacy controls, unknown hosts and offline exports never contact collection.
for (const options of [
  {hostname:'127.0.0.1'}, {hostname:'localhost'}, {hostname:'preview.invalid'},
  {privacy:{doNotTrack:'1'}}, {privacy:{globalPrivacyControl:true}},
  {saved:[['parus-analytics-disabled','1']]}, {saved:[['umami.disabled','1']]},
]) {
  const disabled = await game(options);
  disabled.run(`applyTheme('light');showObject('alpha');state.selected='proxima';launch(true);`);
  assert.equal(disabled.requests.length, 0, JSON.stringify(options));
  assert.equal(disabled.store.has('parus-analytics-v1'), false, 'no tracking ID while disabled');
}
const before = g.requests.length;
g.run(`$('analyticsToggle').checked=false;$('analyticsToggle').onchange();applyTheme('amber');persist();`);
assert.equal(g.requests.length, before);
assert.equal(g.store.get('parus-analytics-disabled'), '1');

reload.run(`
state.selected='alpha';launch(true);
$('analyticsToggle').checked=false;$('analyticsToggle').onchange();
$('analyticsToggle').checked=true;$('analyticsToggle').onchange();
state.flight.covered=state.flight.distance;finishFlight(true);
showObject('alpha');
showDialog('<h2>Other dialog</h2>');showObject('alpha');
`);
const reenabled = JSON.parse(reload.store.get('parus-analytics-v1'));
assert.equal(reenabled.expedition.activeFlight.finished, true, 're-enabled tracking persists the live completion flag');
assert.equal(named(reload, 'object_card_opened').length, 2, 'replacing another dialog with the same card is a new open');

const noStorage = await game({brokenStorage:true});
noStorage.run(`state.selected='proxima';launch(true);applyTheme('light');`);
assert.equal(named(noStorage, 'flight_started').length, 1, 'memory-only analytics tolerate unavailable storage');
noStorage.context.fetch = () => Promise.reject(Error('offline'));
noStorage.run(`applyTheme('radar');persist();`);
noStorage.context.fetch = () => { throw Error('blocked'); };
noStorage.run(`applyTheme('amber');persist();`);
await new Promise(resolve => setImmediate(resolve));

for (const request of [...g.requests, ...reload.requests, ...timed.requests]) {
  assert.equal(request.url, '/analytics/api/send');
  assert.equal(request.keepalive, true);
  assert.equal(request.credentials, 'omit');
  assert.equal(request.body.type, 'event');
  assert.equal(request.body.payload.url, '/');
  assert.ok(!JSON.stringify(request.body).includes('SECRET'));
  assert.ok(!('referrer' in request.body.payload));
}
const config = fs.readFileSync('dist/analytics-config.js', 'utf8');
const setup = fs.readFileSync('deployment/analytics/setup.py', 'utf8');
assert.ok(setup.includes(config.match(/websiteId: '([^']+)'/)[1]), 'bootstrap registers the same public website ID');
assert.ok(setup.includes(config.match(/hosts: \['([^']+)'/)[1]), 'bootstrap registers the canonical allowed domain');
console.log('PASS analytics: persistent players/expeditions/flights, reload, automatic legs, cancellation, quests, cards, themes, visible time, privacy and offline/storage failures');
