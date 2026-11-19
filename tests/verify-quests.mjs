import fs from 'node:fs';
import assert from 'node:assert/strict';
const harness = fs.readFileSync('tests/verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {context,run};';
const {context,run} = await import('data:text/javascript,' + encodeURIComponent(harness) + '#quests');
const requests = [];
context.fetch = async path => {
 requests.push(path.split('?')[0]);
 return {ok:true,json:async()=>JSON.parse(fs.readFileSync('dist/'+path.split('?')[0],'utf8'))};
};
run(`{
state=initial();state.expansion=false;Cosmology.sync(state);Quests.reset();
assert.equal(QUEST_OBJECTS.catalogRevision,EXTENDED_BOOT.revision,'the quest object index is stale: node data-tools/build-quest-objects.mjs');
assert.equal(Quests.objects.size,0,'no quest object is requested before a quest is opened or started');
assert.equal(object('opengc-ic1101'),undefined,'streamed quest objects are not part of the start-up catalogue');
assert.equal(Quests.fly('opengc-ic1101','records'),false);assert.ok($('toast').textContent.includes('загружается'),'a stage that is still loading says so');
assert.deepEqual(state.quests.active,[],'a refused flight does not start the quest');
}`);
await run('Quests.ready');
run(`{
const giant=object('opengc-ic1101');
assert.ok(giant?.navigable&&giant.d>1e9&&Quests.objects.size===1,'the requested stage alone is kept from its catalogue tile');
Quests.start('records');renderUI();
}`);
await run('Quests.ready');
assert.equal(new Set(requests).size,requests.length,'each catalogue tile is requested once');
run(`{
for(const step of Quests.quest('records').steps)assert.ok(object(step.id)?.navigable,'an active quest loads its streamed stages: '+step.id);
assert.equal(object('opengc-ngc4993'),undefined,'other quests stay unloaded');
assert.equal(Quests.fly('opengc-ic1101','records'),false);assert.equal(state.flight,null);
assert.ok($('toast').textContent.includes('Подбираем звезду')&&Quests.retrying==='opengc-ic1101','a distant stage first waits for its arrival star');
}`);
await run("ArrivalStars.pending.get(ArrivalStars.key(object('opengc-ic1101'),state.destroyed))");
run(`{
assert.ok(state.flight&&Quests.flightIds().includes('opengc-ic1101')&&Quests.retrying===null,'the flight to a streamed stage starts by itself once the arrival star is known');
const saved=FlightHistory.snapshot(),restored=restore(JSON.parse(JSON.stringify(saved)));
assert.deepEqual(restored.quests.active,['records']);assert.ok([restored.flight.target,restored.flight.requestedTarget].includes('opengc-ic1101'),'the flight to a streamed stage survives a reload');
state=initial();state.expansion=false;Cosmology.sync(state);Quests.reset();
Quests.isOpen=true;Quests.view='ladder';Quests.renderPanel(true);
}`);
await run('Quests.ready');
run(`{
assert.ok(object('opengc-ngc4993')?.navigable&&$('questsBody').innerHTML.includes('data-quest-fly="opengc-ngc4993"'),'opening a quest loads its stages and redraws the list');
Quests.isOpen=false;Quests.reset();
Quests.load(QUESTS.flatMap(q=>q.steps.flatMap(step=>Quests.ids(step))));
}`);
await run('Quests.ready');
context.fetch = undefined;
context.questMedia = JSON.parse(fs.readFileSync('data-tools/sky-sources/media-quests.json','utf8'));
console.log('PASS streamed quest stages load on demand from the indexed catalogue tiles, once, for started and opened quests only, and remain flight targets across a reload');
run(`{
const reset = () => {
 OrbitalArrival.enabled=true;FlightTips.learned=FlightTips.normalize().used;
 state=initial();state.expansion=false;paused=false;speed=1;FlightQueue.reset();
 Simulation.debt=Simulation.wallDebt=0;FlightTips.clear();Quests.reset();Quests.isOpen=false;
 Notices.action=null;$('toast').hidden=true;$('toastAction').hidden=true;$('infoDialog').open=false;
 $('dialogContent').innerHTML='';Cosmology.sync(state);
};
const physics = () => JSON.stringify([state.flight?Object.fromEntries(Object.entries(state.flight).filter(([k])=>k!=='flightTip')):null,state.ship,state.matter,state.beta,state.proper,state.earth,state.totalDistance,state.phase]);
const click = dataset => Quests.panelClick({target:{closest:()=>({dataset,disabled:false})}});
const entries = text => state.journal.filter(e=>e.text.includes(text)).length;
const arrive = () => Simulation.tick(state.flight.mission.proper*1.00001);
const quest = Quests.quest('neighbours');

assert.equal(new Set(QUESTS.map(q=>q.id)).size,QUESTS.length);
assert.ok(quest,'the first excursion is present');assert.equal(quest.steps.length,10);
const dormant=['messier','messier-marathon'].filter(id=>!Quests.quest(id));
assert.deepEqual(dormant,QUEST_OBJECTS.unreachable.length?['messier','messier-marathon']:QUEST_OBJECTS.marathon.length===110?[]:['messier-marathon'],'only quests whose stages the installed catalogue cannot place are withheld');
assert.deepEqual(QUESTS.map(q=>[q.id,q.steps.length]),[['neighbours',10],['blackholes',10],['messier',15],['messier-marathon',110],['starlife',10],['localgroup',10],['address',9],['ladder',8],['records',11]].filter(([id])=>!dormant.includes(id)));
const stories=new Map();
for(const q of QUESTS){
 assert.ok(q.title&&q.summary&&q.intro.length&&q.outro,q.id);
 assert.ok(!/[<>]/.test([q.title,q.summary,...q.intro,q.outro].join('')),'texts are plain');
 if(q.requires)assert.ok(q.requires!==q.id&&Quests.quest(q.requires)&&!Quests.quest(q.requires).requires,q.id+' opens after an existing open quest');
 const claimed=new Set();
 for(const step of q.steps){
  for(const id of Quests.ids(step)){
   const o=object(id);
   assert.ok(o,q.id+': unknown catalogue object '+id);
   assert.ok(o.navigable&&!o.atlasOnly&&o.p3?.every(Number.isFinite),q.id+': '+id+' must be a reachable map object');
   assert.ok(!claimed.has(id),q.id+': '+id+' belongs to two stages');claimed.add(id);
  }
  assert.ok(step.name,q.id+'/'+step.id+' is named without a catalogue request');
  if(q.checklist){assert.ok(!step.title&&!step.lead&&!step.more&&!Quests.told(step),q.id+'/'+step.id+' is a plain checklist entry');continue;}
  for(const id of Quests.ids(step)){
   if(stories.has(id))assert.equal(stories.get(id),step.title+'|'+step.lead,'one object tells one story in every quest: '+id);
   stories.set(id,step.title+'|'+step.lead);
  }
  assert.ok(step.title&&step.lead&&step.more?.length,q.id+'/'+step.id+' has both text levels');
  assert.ok([...step.lead].length<=420,q.id+'/'+step.id+' short text stays short');
  assert.ok(step.refs?.length&&step.refs.every(([url,label])=>/^https:\\/\\//.test(url)&&label),q.id+'/'+step.id+' cites sources');
  assert.ok(!/[<>]/.test([step.title,step.lead,...step.more,Quests.name(step)].join('')),'texts are plain');
 }
}
const order=quest.steps.map(step=>object(step.id).d);
assert.deepEqual(order,[...order].sort((a,b)=>a-b),'the neighbours are ordered by distance from the Sun');
assert.ok(order.at(-1)<12,'all neighbours lie within twelve light years');
for(const id of ['blackholes','records']){
 const far=Quests.quest(id).steps.map(step=>object(step.id).d);
 assert.deepEqual(far,[...far].sort((a,b)=>a-b),id+' runs outwards from the Sun');
}
const marathon=Quests.quest('messier-marathon');
assert.equal(!!marathon,QUEST_OBJECTS.marathon.length===110,'the marathon is offered only when the catalogue holds all 110 Messier objects');
if(marathon){
assert.deepEqual(marathon.steps.map(step=>Number(object(step.id).messier)).sort((a,b)=>a-b),marathon.steps.map((_,i)=>i+1),'the marathon lists every Messier number once');
assert.equal(marathon.steps[0].id,Quests.quest('messier').steps.at(-1).id,'the marathon starts where the selection ends');
assert.ok(Quests.quest('messier').steps.every(step=>marathon.steps.some(m=>m.id===step.id)),'every selected stage counts for the marathon');
}
for(const step of Quests.quest('blackholes').steps){
 const o=object(step.id);
 assert.ok(SkyGuide.hasObservatoryPhoto(o),'the black hole excursion shows a photograph at '+step.id);
}
for(const p of questMedia)for(const id of p.objects){
 assert.ok(Quests.quest('blackholes').steps.some(step=>step.id===id),'curated quest photographs belong to quest stages: '+id);
 assert.ok(SkyGuide.media(object(id)).some(m=>m.id===p.id&&m.url===p.url&&m.credit&&m.description),'the card of '+id+' shows '+p.id);
}
for(const id of Object.keys(QUEST_OBJECTS.tiles))assert.ok(QUESTS.some(q=>q.steps.some(step=>Quests.ids(step).includes(id))),'the tile index lists quest stages only: '+id);
console.log('PASS every stage of every quest resolves to a reachable catalogue object, storied stages have two text levels and sources, shared objects tell one story, the marathon needs the complete M1–M110 list and black hole stages have photographs');

reset();
assert.deepEqual(state.quests,Quests.blank());
const old=JSON.parse(JSON.stringify(state));delete old.quests;
state=restore(old);assert.deepEqual(state.quests,Quests.blank(),'older saves acquire empty quest progress');assert.equal(state.version,13);
assert.deepEqual(Quests.normalize({active:['neighbours','retired','neighbours',null],seen:{'neighbours/proxima':true,'neighbours/gone':true,'neighbours/alpha':'yes'},credited:['x']}),
 {active:['neighbours'],seen:{'neighbours/proxima':true},credited:{}},'unknown quests, retired stages and malformed flags are dropped');
reset();Quests.start('neighbours');state.quests.seen['neighbours/tau']=true;state.quests.seen['neighbours/proxima']=true;
const savedQuests=JSON.stringify(state.quests);state=restore(JSON.parse(JSON.stringify(state)));
assert.equal(JSON.stringify(state.quests),savedQuests,'unchanged progress serializes identically after reload');
console.log('PASS empty progress for new and older expeditions, strict normalization and exact reload');

for (const visited of [false,true]) for (const id of ['alpha','procyon','andromeda','orion']) {
 reset();if(visited)state.visited.push(id);state.selected=id;renderUI();
 const membership=QUESTS.find(q=>q.steps.some(step=>Quests.ids(step).includes(id)&&Quests.told(step)));
 const step=membership.steps.find(step=>Quests.ids(step).includes(id));
 $('objectCardBtn').onclick();const direct=$('dialogContent').innerHTML;
 assert.ok(direct.includes('quest-story')&&direct.includes(Quests.esc(step.lead))&&direct.includes('data-quest-start="'+membership.id+'"'),'a story is available before and after a visit without a subscription: '+id);
 assert.ok(!direct.includes('is-locked')&&!direct.includes('Его история откроется'));
 assert.equal(state.quests.seen[Quests.key(membership,step)],true);
 $('infoDialog').open=false;Quests.dialogClosed();
 $('objectInfo').onclick();assert.equal($('dialogContent').innerHTML,direct,'both object card buttons show the same card: '+id);
 $('infoDialog').open=false;Quests.dialogClosed();
 assert.equal(Quests.read(id,membership.id),true);
 assert.equal($('dialogContent').innerHTML,direct,'History opens the same card: '+id);
 assert.deepEqual(state.quests.active,[],'reading a story does not subscribe to a quest');
 assert.deepEqual(state.quests.credited,{},'reading a story does not credit a quest');
 assert.equal(state.visited.includes(id),visited,'reading a story does not visit the object');
 assert.equal(Quests.pending,null);
}
reset();showObject('tau');
assert.ok($('dialogContent').innerHTML.includes(Quests.esc(quest.steps.at(-1).lead)),'an unvisited stage shows its story without a subscription');
assert.equal(state.quests.seen['neighbours/tau'],true);assert.deepEqual(state.quests.active,[]);
const ordinary=OBJECTS.find(o=>!QUESTS.some(q=>q.steps.some(step=>Quests.ids(step).includes(o.id))));
showObject(ordinary.id);assert.ok(!$('dialogContent').innerHTML.includes('quest-story'),'objects outside quests keep their ordinary cards');
console.log('PASS both object card buttons and History show stories before and after visits without a subscription, preserve visit progress and leave ordinary cards unchanged');

reset();state.selected='barnard';showObject('barnard');$('infoDialog').open=false;Quests.dialogClosed();
state=restore(JSON.parse(JSON.stringify(state)));Quests.reset();
assert.equal(state.quests.seen['neighbours/barnard'],true,'a story read before flight remains read after reload');
Quests.start('neighbours');launch();
assert.ok(state.flight);assert.equal(Quests.flightStory(),null,'a story read before launch is not announced in flight');
arrive();renderUI();
assert.equal(state.quests.credited['neighbours/barnard'],true,'the later visit is still credited');
assert.equal(Quests.pending,null);assert.equal($('infoDialog').open,false,'a previously read story is not forced open on arrival');
console.log('PASS reading before flight survives reload, suppresses repeated story prompts and keeps arrival credit');

reset();state.visited.push('alpha');
assert.equal(Quests.start('neighbours'),true);assert.equal(Quests.start('neighbours'),false);
assert.deepEqual(state.quests.active,['neighbours']);assert.equal(state.quests.credited['neighbours/alpha'],true,'earlier visits count when a quest starts');
renderUI();assert.equal(Quests.pending,null,'an earlier visit is not announced as a new arrival');assert.equal($('toast').hidden,true);
assert.deepEqual(Quests.progress(quest),{done:1,total:10,complete:false});
assert.equal($('questCount').textContent,'1');assert.equal($('questCount').hidden,false);
assert.equal(Quests.next(quest).id,'proxima','the next stage is the first unvisited one');
showObject('tau');let card=$('dialogContent').innerHTML;
assert.ok(!card.includes('is-locked')&&card.includes(Quests.esc(quest.steps.at(-1).lead)),'an unvisited stage shows its story in an active quest');
assert.ok(card.indexOf(Quests.esc(quest.steps.at(-1).lead))<card.indexOf('КВЕСТ · СОСЕДИ СОЛНЦА · 10 / 10')&&card.indexOf('КВЕСТ · СОСЕДИ СОЛНЦА · 10 / 10')<card.indexOf('data-quest-panel="neighbours"')&&card.includes('data-quest-fly='),'the story precedes the quest line and its actions');
assert.equal(state.quests.seen['neighbours/tau'],true);assert.deepEqual(Quests.progress(quest),{done:1,total:10,complete:false});$('infoDialog').open=false;
showObject('alpha');card=$('dialogContent').innerHTML;
assert.ok(card.includes('Двойник Солнца по соседству')&&card.includes('2 / 10'));
const alphaStep=quest.steps[1];
const paragraph=text=>'<p class="quest-lead">'+Quests.esc(text)+'</p>',more=card.slice(card.indexOf('<details class="quest-more"><summary>Подробнее</summary>'),card.indexOf('</details>',card.indexOf('<details class="quest-more">')));
assert.ok(card.includes('<details class="quest-more"><summary>Подробнее</summary>')&&card.includes(paragraph(alphaStep.lead))&&!more.includes(paragraph(alphaStep.lead))&&alphaStep.more.every(text=>more.includes(paragraph(text)))&&alphaStep.refs.every(([url])=>more.includes(Quests.esc(url))),'the lead is always visible; the rest sits under a closed disclosure in the same text style, with its sources');
const storyBlock=card.slice(card.indexOf('<section class="quest-story">'),card.indexOf('</section>',card.indexOf('<section class="quest-story">')));
assert.ok(storyBlock.includes(paragraph(alphaStep.lead))&&!/<img|<figure/.test(storyBlock),'the story carries text only; photographs stay in the card carousel');
const at=text=>storyBlock.indexOf(text);
assert.ok(storyBlock.startsWith('<section class="quest-story"><h3>')&&at('</details>')<at('<div class="quest-membership"><div class="modal-eyebrow">КВЕСТ · СОСЕДИ СОЛНЦА · 2 / 10</div>')&&at('КВЕСТ · СОСЕДИ СОЛНЦА')<at('data-quest-actions="neighbours"')&&at('</details>')>0,'the story opens the block; the quest line follows the whole text and heads the quest actions');
assert.equal(storyBlock.split('quest-membership').length-1,1);
const second={id:'twin',title:'Второй квест',summary:'',intro:[],outro:'Итог второго.',steps:[{id:'alpha',title:'Другой заголовок',lead:'Другой текст.',more:['Ещё.'],refs:[['https://example.org/','Источник']]}]};
QUESTS.push(second);state.quests.active.push('twin');
const stacked=Quests.storyHTML(object('alpha'));QUESTS.pop();state.quests.active.pop();
assert.equal(stacked.split('<h3>').length-1,1,'an object in several quests keeps one story');
assert.ok(stacked.includes(paragraph(alphaStep.lead))&&!stacked.includes('Другой текст.'));
assert.ok(stacked.indexOf('</details>')<stacked.indexOf('КВЕСТ · СОСЕДИ СОЛНЦА · 2 / 10')&&stacked.indexOf('КВЕСТ · СОСЕДИ СОЛНЦА · 2 / 10')<stacked.indexOf('КВЕСТ · ВТОРОЙ КВЕСТ · 1 / 1')&&stacked.indexOf('КВЕСТ · ВТОРОЙ КВЕСТ · 1 / 1')<stacked.indexOf('<b>Квест пройден.</b> Итог второго.')&&stacked.indexOf('<b>Квест пройден.</b> Итог второго.')<stacked.indexOf('data-quest-actions="twin"'),'quests stack under the story, each with its own line, conclusion and actions');
assert.ok(card.indexOf('quest-story')<card.indexOf('object-facts'),'the story precedes the catalogue facts');
assert.ok(card.includes('Лететь дальше: Проксима Центавра'));
assert.equal(state.quests.seen['neighbours/alpha'],true);$('infoDialog').open=false;
assert.equal(Quests.stop,undefined,'a started quest cannot be abandoned');
state.quests.active=[];state.quests.credited={};
renderUI();assert.equal($('questCount').hidden,true);
console.log('PASS subscription counts earlier visits silently, all cards show the story with its disclosure, and the badge follows active quests');

reset();Quests.start('neighbours');state.selected='barnard';launch();
assert.ok(state.flight,'the flight to the quest stage starts');
assert.equal($('toast').hidden,false);assert.equal($('toast').dataset.kind,'quest','the story is announced as soon as the flight starts');
Simulation.advance(4.1);const before=physics();renderUI();
assert.equal(physics(),before,'announcing a story never changes the flight');
assert.equal($('toast').hidden,false);assert.equal($('toast').dataset.kind,'quest');assert.equal($('toast').dataset.icon,'quest');
assert.equal($('toastText').textContent,'Квест «Соседи Солнца»\\nЗвезда Барнарда. Самая быстрая звезда неба.','the plaque names its quest on a separate line');
assert.equal($('toastAction').hidden,false);assert.equal($('toastAction').textContent,'Читать');
assert.equal(state.flight.flightTip,undefined,'a story does not spend an ordinary tip');
const action=Notices.action;for(let i=0;i<5;i++)renderUI();assert.equal(Notices.action,action,'redraws keep one stable action');
Notices.run();
assert.equal($('infoDialog').open,true);assert.ok($('dialogContent').innerHTML.includes('Самая быстрая звезда неба'),'the story is readable in flight');
assert.ok($('dialogContent').innerHTML.includes('Затем: '),'in flight the next stage is offered as a route leg');
assert.equal(state.quests.seen['neighbours/barnard'],true);assert.equal(physics(),before);
$('infoDialog').open=false;renderUI();
assert.ok($('toast').hidden||$('toast').dataset.kind!=='quest','a read story is not announced again');
arrive();assert.equal(state.flight,null);assert.equal(state.current,'barnard');
assert.equal(Quests.pending,null,'a story read in flight is not forced open again');assert.equal($('infoDialog').open,false);
assert.equal($('toast').hidden,false);assert.equal($('toast').dataset.kind,'notice');
assert.ok($('toastText').textContent.includes('Звезда Барнарда · 1 из 10'));assert.equal($('toastAction').textContent,'Открыть');
renderUI();assert.equal($('toast').hidden,false,'the credit notice outlives the arrival cleanup');
assert.equal(entries('Квест «Соседи Солнца»: Звезда Барнарда'),1);
for(let i=0;i<5;i++)renderUI();assert.equal(entries('Квест «Соседи Солнца»: Звезда Барнарда'),1,'a stage is credited once');
console.log('PASS the in-flight story plaque appears at launch with the quest name and a reading action, leaves physics and tips intact, and a read story yields a credit notice on arrival');

reset();Quests.start('neighbours');state.selected='barnard';launch();
Simulation.advance(4.1);renderUI();Notices.run();assert.equal($('infoDialog').open,true);
const slot={dataset:{questActions:'neighbours'},innerHTML:''},findAll=$('dialogContent').querySelectorAll;
$('dialogContent').querySelectorAll=selector=>selector==='[data-quest-actions]'?[slot]:[];
renderUI();assert.equal(slot.innerHTML,'','an unchanged flight leaves the open card alone');
arrive();renderUI();assert.equal(state.flight,null);assert.equal($('infoDialog').open,true);
assert.ok(slot.innerHTML.includes('Лететь дальше: ')&&!slot.innerHTML.includes('Затем: '),'arrival turns the route offer into a direct flight');
assert.ok(slot.innerHTML.includes('1 из 10'),'the open card shows the credited stage');
$('dialogContent').querySelectorAll=findAll;$('infoDialog').open=false;Quests.dialogClosed();assert.equal(Quests.story,null);
console.log('PASS a story left open through the arrival refreshes its actions and progress');

reset();Quests.start('neighbours');state.selected='proxima';launch();
const unreadTipLedger=JSON.stringify([state.flightTips.shown,state.flightTips.used,state.flightTips.queue,state.flightTips.last]);
Simulation.advance(4.1);renderUI();assert.equal($('toast').dataset.kind,'quest');
arrive();assert.equal(state.flight,null);
assert.equal(JSON.stringify([state.flightTips.shown,state.flightTips.used,state.flightTips.queue,state.flightTips.last]),unreadTipLedger,'an unread quest story lasting the whole flight spends no tip and preserves its future selection');
assert.equal(Quests.pending,'proxima','an unread story is queued for the arrival');
assert.ok($('toast').hidden||$('toast').dataset.kind!=='quest','the plaque is removed on arrival');
$('flightBuilder').open=true;assert.equal(Quests.present(),false);assert.equal(Quests.pending,'proxima','another dialog postpones the story');
$('flightBuilder').open=false;assert.equal(Quests.present(),true);
assert.equal($('infoDialog').open,true);assert.ok($('dialogContent').innerHTML.includes('Ближайшая звезда'));
assert.ok($('dialogContent').innerHTML.includes('Лететь дальше: Альфа Центавра'));
assert.equal(Quests.pending,null);assert.equal(state.quests.seen['neighbours/proxima'],true);assert.equal(paused,false);
assert.equal(Quests.present(),false,'the story opens once');
$('infoDialog').open=false;Quests.dialogClosed();
state.selected='tau';launch();state.visited.push('epsilon');renderUI();
assert.equal(Quests.pending,null,'a stage credited away from the ship is not forced open');
assert.equal($('toast').dataset.kind,'notice');assert.ok($('toastText').textContent.includes('Эпсилон Эридана · 2 из 10'));
console.log('PASS an unread story is opened on arrival exactly once, waits for other dialogs, and stages credited in passing only raise a notice');

reset();Quests.start('neighbours');
state.itinerary=[{id:'proxima',mode:'stop'},{id:'barnard',mode:'stop'}];Route.start();
const firstLeg=state.flight;Simulation.tick(firstLeg.mission.proper);
assert.ok(state.flight&&state.flight!==firstLeg&&state.flight.legIndex===1,'the route continues automatically');
assert.equal(Quests.pending,'proxima');assert.equal(Quests.present(),true);
assert.equal(paused,true,'the next leg waits while the arrival story is open');assert.equal(Quests.autoPaused,true);
assert.ok($('dialogContent').innerHTML.includes('Ближайшая звезда'));
$('infoDialog').open=false;Quests.dialogClosed();assert.equal(paused,false,'closing the story resumes the route');assert.equal(Quests.autoPaused,false);
paused=true;Quests.dialogClosed();assert.equal(paused,true,'a pause chosen by the player is never lifted');paused=false;
console.log('PASS on a multi-leg route the arrival story pauses the next leg and closing it resumes the flight');

reset();state.visited.push('hyg-71453','hyg-118441');Quests.start('neighbours');
assert.deepEqual(Quests.progress(quest),{done:2,total:10,complete:false},'companion stars count for their systems');
assert.equal(Quests.read('alpha','neighbours'),true);
assert.ok($('dialogContent').innerHTML.includes(object('hyg-71453').name),'the story opens on the visited component');
assert.ok($('dialogContent').innerHTML.includes('Двойник Солнца по соседству'));$('infoDialog').open=false;Quests.dialogClosed();
reset();Quests.start('neighbours');state.current='hyg-118441';state.ship=Space.point(object('hyg-118441').p3);state.visited.push('hyg-118441');renderUI();
assert.equal(Quests.pending,'hyg-118441','arrival at a companion opens the system story');
console.log('PASS companions of double stars are accepted for their stage');

reset();Quests.open();
assert.equal(Quests.isOpen,true);assert.equal($('quests').hidden,false);
assert.ok($('questsBody').innerHTML.includes('quest-card')&&$('questsBody').innerHTML.includes('НЕ НАЧАТ · 0 / 10'));
click({questOpen:'neighbours'});let panel=$('questsBody').innerHTML;
assert.ok(panel.includes('Начать квест')&&!panel.includes('Отказаться'));
assert.equal(panel.split('<li class="quest-step').length-1,10,'all ten stages are listed');
assert.ok(panel.includes(distanceText(Cosmology.physicalDistance(state.ship,object('wolf')))),'each stage shows its distance from the ship');
assert.equal(panel.split('data-quest-fly=').length-1,10,'every unvisited stage can start a flight');
click({questFly:'wolf'});
assert.deepEqual(state.quests.active,['neighbours'],'flying to a stage subscribes to its quest');
assert.ok(state.flight&&[state.flight.target,state.flight.requestedTarget].includes('wolf'),'the chosen stage becomes the flight target');
assert.equal(Quests.isOpen,false,'the list closes when the flight starts');
Quests.open('neighbours');panel=$('questsBody').innerHTML;
assert.ok(panel.includes('ЦЕЛЬ ПОЛЁТА')&&!panel.includes('Отказаться')&&!panel.includes('data-quest-stop')&&panel.includes('В маршрут'),'an active quest offers no way to abandon it');
const trajectory=()=>JSON.stringify([{...state.flight,route:undefined,legIndex:undefined,flightTip:undefined},state.ship,state.matter,state.proper,state.earth]);
const flying=trajectory();click({questFly:'sirius'});
assert.equal(Route.future().map(n=>n.id+':'+n.mode).join(),'sirius:stop','in flight a stage is appended as a stop');
assert.equal(trajectory(),flying,'appending a stage leaves the executing trajectory intact');
assert.ok($('questsBody').innerHTML.includes('В МАРШРУТЕ'));
assert.equal(Quests.next(quest).id,'proxima','targets already in flight or in the route are skipped by the next-stage action');
click({questBack:''});assert.ok($('questsBody').innerHTML.includes('АКТИВЕН · 0 / 10'));
Quests.close();assert.equal(Quests.isOpen,false);assert.equal($('quests').hidden,true);
console.log('PASS the quest list shows status and live distances, starts a flight to any stage, appends stages in flight and closes on launch');

reset();Quests.start('neighbours');state.selected='proxima';launch();
Simulation.advance(4.1);renderUI();Notices.run();$('infoDialog').open=false;Quests.dialogClosed();
FlightHistory.cancel();
assert.equal(state.flight,null);assert.deepEqual(state.quests.active,['neighbours'],'cancelling keeps the subscription');
assert.equal(state.quests.seen['neighbours/proxima'],true,'a story stays read after a cancelled flight');
assert.equal(state.quests.credited['neighbours/proxima'],undefined);assert.equal(Quests.progress(quest).done,0);
state.selected='proxima';launch();arrive();assert.equal(state.quests.credited['neighbours/proxima'],true);
state.selected='barnard';launch();Simulation.advance(1);FlightHistory.cancel();renderUI();
assert.equal(state.quests.credited['neighbours/proxima'],true,'a later cancellation keeps earlier stages');
assert.equal(entries('Квест «Соседи Солнца»: Проксима Центавра'),1,'rollback neither loses nor repeats the journal entry');
console.log('PASS flight cancellation keeps subscriptions and read stories, and credits follow the restored visit record');

reset();Quests.start('neighbours');
for(const step of quest.steps.slice(0,-1))state.visited.push(step.id);
state.current='tau';state.ship=Space.point(object('tau').p3);state.visited.push('tau');renderUI();
assert.equal(Quests.progress(quest).complete,true);assert.equal(entries('Квест пройден: Соседи Солнца'),1);
assert.equal($('questCount').hidden,true,'a completed quest leaves the badge');
assert.equal(Quests.pending,'tau');Quests.present();
assert.ok($('dialogContent').innerHTML.includes('Квест пройден.')&&$('dialogContent').innerHTML.includes('красные карлики'),'the last story carries the conclusion');
assert.ok($('dialogContent').innerHTML.indexOf('</details>')<$('dialogContent').innerHTML.indexOf('КВЕСТ · СОСЕДИ СОЛНЦА · 10 / 10</div><p class="quest-outro"><b>Квест пройден.</b>'),'the quest line sits right above the conclusion, after the story');
assert.ok(!$('dialogContent').innerHTML.includes('Лететь дальше'));$('infoDialog').open=false;Quests.dialogClosed();
Quests.open('neighbours');assert.ok($('questsBody').innerHTML.includes('ПРОЙДЕН · 10 / 10')&&!$('questsBody').innerHTML.includes('data-quest-fly='));
Quests.close();state=initial();Quests.reset();renderUI();
assert.deepEqual(state.quests,Quests.blank(),'a new expedition starts without quests');assert.equal(Quests.pending,null);
console.log('PASS completion is recorded once with the closing text, and a new expedition clears quest progress');

reset();assert.equal(state.selected,'proxima','a new expedition aims at the nearest star');
const label=()=>$('launchBtn').querySelector('span').textContent;
state.current='proxima';state.ship=Space.point(object('proxima').p3);state.visited.push('proxima');renderUI();
assert.equal($('launchBtn').hidden,true,'without an active quest a parked ship offers no next-target button');
assert.equal($('objectCardBtn').hidden,false,'a parked ship offers the object card instead');assert.equal($('distanceRow').hidden,true,'the zero distance is hidden at the object');assert.equal($('flightHint').hidden,true,'no arrival hint at the object');
$('objectCardBtn').onclick();assert.ok($('dialogContent').innerHTML.includes('<h2>'+object('proxima').name+'</h2>'),'the button opens the object card');$('infoDialog').open=false;
select('barnard');renderUI();assert.equal($('objectCardBtn').hidden,true);assert.equal($('distanceRow').hidden,false,'another target shows its distance again');select('proxima');renderUI();
Quests.start('neighbours');renderUI();
assert.equal($('launchBtn').hidden,false);assert.equal($('launchBtn').disabled,false);assert.equal(label(),'Лететь к следующей цели');assert.equal($('objectCardBtn').hidden,true,'the quest action takes the button row');
assert.ok($('flightHint').textContent.includes('Соседи Солнца')&&$('flightHint').textContent.includes('Альфа Центавра'),'the hint names the quest and its next stage');
assert.equal(Quests.nextTarget().step.id,'alpha');
select('barnard');renderUI();assert.equal(Quests.nextTarget(),null);assert.notEqual(label(),'Лететь к следующей цели','another selected target keeps its ordinary launch action');
select('proxima');renderUI();$('launchBtn').onclick({});
assert.ok(state.flight&&[state.flight.target,state.flight.requestedTarget].includes('alpha'),'the button flies to the next stage in quest order');
renderUI();assert.equal($('launchBtn').hidden,true);
arrive();renderUI();assert.equal(state.current,'alpha');assert.equal(Quests.nextTarget().step.id,'barnard');assert.equal(label(),'Лететь к следующей цели');
$('infoDialog').open=false;Quests.dialogClosed();Quests.pending=null;
for(const step of quest.steps)if(!state.visited.includes(step.id))state.visited.push(step.id);
renderUI();assert.equal(Quests.nextTarget(),null);assert.equal($('launchBtn').hidden,true,'a completed quest offers no further target');
console.log('PASS a new expedition aims at Proxima, a parked ship offers the next quest stage only while a quest is active, and the button flies there');

{
 const nativeRandom=Math.random;
 try {
  for(const subscribed of [false,true])for(const priorTips of [false,true]){
   reset();
   if(priorTips){
    state.flightTips.shown['double-click']=1;
    state.flightTips.last='double-click';
    state.flightTips.queue=['shift-route','time-dilation','light-speed-limit'];
   }
   if(subscribed)Quests.start('neighbours');
   const ledger=()=>JSON.stringify([state.flightTips.shown,state.flightTips.used,state.flightTips.queue,state.flightTips.last]);
   const beforeLaunch=ledger();
   state.selected=priorTips?'barnard':'procyon';launch();
   assert.equal(ledger(),beforeLaunch,'announcing a quest at launch changes no tip counts, learning, queue or last tip');
   speed=.1;Simulation.advance(6);renderUI();
   assert.ok(FlightEstimate.get().proper/speed>FlightTips.minimumFlightSeconds,'the flight is long enough to show a tip without the story');
   const progress=JSON.stringify(state.flightTips);
   // Compare future choices at several random values against the same flight
   // before further story renders/reload, including its existing shuffle queue.
   const choices=snapshot=>{
    const result=[];
    for(const random of [0,.25,.5,.75,.999999]){
     state.flightTips=JSON.parse(snapshot);Math.random=()=>random;
     const tip=FlightTips.pick();
     result.push({id:tip.id,progress:JSON.parse(JSON.stringify(state.flightTips))});
    }
    state.flightTips=JSON.parse(snapshot);
    return result;
   };
   const expected=choices(progress);
   for(let frame=0;frame<20;frame++){
    renderUI();assert.equal($('toast').dataset.kind,'quest');assert.equal($('toast').hidden,false);
    assert.equal(JSON.stringify(state.flightTips),progress,'a hidden tip consumes neither its quota nor its place in the shuffle');
    assert.equal(state.flight.flightTip,undefined);assert.equal(FlightTips.current.tip,null);
   }
   persist();state=restore(JSON.parse(JSON.stringify(state)));FlightTips.clear();Quests.reset();
   $('toast').hidden=true;Cosmology.sync(state);renderUI();
   assert.equal($('toast').dataset.kind,'quest');assert.equal($('toast').hidden,false);
   assert.equal(JSON.stringify(state.flightTips),progress,'reload cannot turn a suppressed tip into an impression');
   assert.equal(state.flight.flightTip,undefined);
   assert.deepEqual(choices(JSON.stringify(state.flightTips)),expected,'quest cards and reload leave future random choices and their probabilities unchanged');
   Math.random=()=>.5;Notices.run();$('infoDialog').open=false;Quests.dialogClosed();renderUI();
   const next=expected[2];next.progress.shown[next.id]++;
   assert.equal($('toast').dataset.kind,'tip');assert.equal($('toast').hidden,false);
   assert.equal(state.flight.flightTip.id,next.id,'after reading the story, the previously suppressed pool supplies the tip');
   assert.equal(JSON.stringify(state.flightTips),JSON.stringify(next.progress),'only the tip actually displayed spends one impression');
  }
 } finally {Math.random=nativeRandom;}
 console.log('PASS quest cards preserve all tip counts, learning and shuffle state with/without subscription and prior tips, across redraw/reload; future random choices stay identical until a tip is actually shown');
}

reset();state.selected='procyon';launch();renderUI();
assert.equal($('toast').hidden,false);assert.equal($('toast').dataset.kind,'quest','a quest star is announced even without a subscription');
assert.equal($('toastText').textContent,'Квест «Соседи Солнца»\\nПроцион. Звезда, которая начинает стареть.');
Simulation.advance(6);renderUI();assert.ok(state.flight,'the flight outlasts the startup window');
assert.equal($('toast').hidden,false);assert.equal($('toast').dataset.kind,'quest','no ordinary tip replaces the story plaque');assert.equal(state.flight.flightTip,undefined);
let flags=0;const stroke=ctx.stroke;ctx.stroke=function(){flags++;};
Quests.draw();assert.equal(flags,0,'stars are not flagged without an active quest');
Quests.start('neighbours');Quests.draw();ctx.stroke=stroke;assert.ok(flags>0,'an active quest flags its unvisited stars');
state.quests.active=[];state.quests.credited={};
Notices.run();assert.equal($('infoDialog').open,true);
assert.ok($('dialogContent').innerHTML.includes('Звезда, которая начинает стареть')&&$('dialogContent').innerHTML.includes('Начать квест'),'the story of an unsubscribed quest offers to start it');
assert.equal(state.quests.seen['neighbours/procyon'],true);$('infoDialog').open=false;Quests.dialogClosed();renderUI();
assert.ok($('toast').hidden||$('toast').dataset.kind!=='quest','a read story is not announced again');
arrive();renderUI();
assert.deepEqual(state.quests.active,[]);assert.equal(Quests.pending,null,'arrival forces no card without a subscription');assert.equal($('infoDialog').open,false);
assert.equal(entries('Квест «Соседи Солнца»'),0,'nothing is credited without a subscription');
reset();state.selected='sirius';launch();toast('Проверка',4200,'warning');renderUI();
assert.equal($('toast').dataset.kind,'notice','a launch warning is not hidden by the story');
Simulation.advance(4.1);renderUI();assert.equal($('toast').dataset.kind,'quest','the story follows the launch warning after the startup window');
console.log('PASS quest stars are announced at launch with the quest name even without a subscription, replace ordinary tips, are not flagged or credited, and yield to launch warnings');
}`);
if (!run("!!Quests.quest('messier-marathon')")) {
 run(`if(Quests.quest('messier')){
state=initial();state.expansion=false;Cosmology.sync(state);Quests.reset();Quests.start('messier');
for(const step of Quests.quest('messier').steps)state.visited.push(step.id);
renderUI();Quests.pending=null;
assert.equal(Quests.progress(Quests.quest('messier')).complete,true);
assert.equal(state.journal.filter(e=>e.text.includes('Открыт квест')).length,0,'without the marathon the selection opens nothing');
Quests.isOpen=true;Quests.view=null;Quests.renderPanel(true);Quests.isOpen=false;
assert.ok(!$('questsBody').innerHTML.includes('ЗАКРЫТ'),'no closed card is listed');
}`);
 console.log('SKIP the marathon and checklist stages: the installed catalogue cannot place every Messier stage ' + run("JSON.stringify({unreachable:QUEST_OBJECTS.unreachable,marathon:QUEST_OBJECTS.marathon.length})"));
} else run(`{
const reset = () => {
 OrbitalArrival.enabled=true;FlightTips.learned=FlightTips.normalize().used;
 state=initial();state.expansion=false;paused=false;speed=1;FlightQueue.reset();
 Simulation.debt=Simulation.wallDebt=0;FlightTips.clear();Quests.reset();Quests.isOpen=false;
 Notices.action=null;$('toast').hidden=true;$('toastAction').hidden=true;$('infoDialog').open=false;
 $('dialogContent').innerHTML='';Cosmology.sync(state);
};
const entries = text => state.journal.filter(e=>e.text.includes(text)).length;
const arrive = () => Simulation.tick(state.flight.mission.proper*1.00001);
const panel = view => {Quests.isOpen=true;Quests.view=view;Quests.renderPanel(true);Quests.isOpen=false;return $('questsBody').innerHTML;};
const messier=Quests.quest('messier'),marathon=Quests.quest('messier-marathon'),m2='opengc-ngc7089';

reset();
assert.equal(Quests.locked(marathon),true);assert.equal(Quests.start('messier-marathon'),false);assert.deepEqual(state.quests.active,[],'a closed quest cannot be started');
let html=panel(null);
assert.ok(html.includes('ЗАКРЫТ')&&html.includes('Откроется после квеста «Мессье: избранное».'),'the list explains how the closed quest opens');
html=panel('messier-marathon');
assert.ok(!html.includes('data-quest-start')&&!html.includes('quest-steps')&&html.includes('data-quest-open="messier"'),'a closed quest shows its condition instead of its stages');
select(m2);launch();renderUI();assert.ok(state.flight);
assert.equal(Quests.entries(m2).length,0);assert.equal(Quests.flightStory(),null);
assert.ok(!Quests.storyHTML(object(m2)),'a closed quest stays out of the object cards');
assert.ok($('toast').hidden||$('toast').dataset.kind!=='quest','a closed quest is not announced in flight');

reset();Quests.start('messier');
for(const step of messier.steps.slice(0,-1))state.visited.push(step.id);
renderUI();Quests.pending=null;assert.equal(Quests.locked(marathon),true,'an unfinished selection keeps the marathon closed');
state.visited.push(messier.steps.at(-1).id);renderUI();Quests.pending=null;
assert.equal(Quests.locked(marathon),false);assert.equal(entries('Открыт квест: Марафон Мессье'),1);
for(let i=0;i<3;i++)renderUI();assert.equal(entries('Открыт квест: Марафон Мессье'),1,'the opening is recorded once');
showObject('m87');html=$('dialogContent').innerHTML;$('infoDialog').open=false;Quests.dialogClosed();
assert.ok(html.includes('Квест пройден.')&&html.includes('data-quest-panel="messier-marathon">Открыт квест: Марафон Мессье'),'the closing card leads to the opened quest');
html=panel('messier');assert.ok(html.includes('data-quest-panel="messier-marathon"'));
Quests.isOpen=true;Quests.panelClick({target:{closest:()=>({dataset:{questPanel:'messier-marathon'},disabled:false})}});Quests.isOpen=false;
assert.equal(Quests.view,'messier-marathon');html=$('questsBody').innerHTML;
assert.ok(html.includes('data-quest-start="messier-marathon"')&&html.split('<li class="quest-step').length-1===110,'the opened marathon lists all 110 stages');
assert.equal(Quests.start('messier-marathon'),true);renderUI();
assert.deepEqual(Quests.progress(marathon),{done:15,total:110,complete:false},'stages of the selection already count');
assert.equal(Quests.pending,null);assert.ok(!panel('messier').includes('data-quest-panel="messier-marathon"'),'a started quest is no longer offered');
console.log('PASS the marathon stays closed, hidden from cards and unannounced until the selection is complete, opens once with a record and a link, and counts earlier visits');

select(m2);launch();renderUI();
assert.equal(Quests.flightStory(),null);assert.ok($('toast').hidden||$('toast').dataset.kind!=='quest','checklist stages have no story to announce');
arrive();renderUI();assert.equal(state.flight,null);assert.ok(state.visited.includes(m2));
assert.equal(Quests.pending,null,'a checklist stage never forces a card open');
assert.equal($('toast').hidden,false);assert.ok($('toastText').textContent.includes('Квест «Марафон Мессье»: M2 · 16 из 110'),'the arrival is credited with a notice');
html=Quests.storyHTML(object(m2));
assert.ok(html.startsWith('<section class="quest-story"><div class="quest-membership">')&&!html.includes('<h3>')&&!html.includes('Его история откроется'),'a checklist card carries the quest line only');
assert.ok(html.includes('КВЕСТ · МАРАФОН МЕССЬЕ · '+(marathon.steps.findIndex(step=>step.id===m2)+1)+' / 110'));
html=panel('messier-marathon');
assert.ok(html.includes('data-quest-read="'+m2+'">Карточка<')&&html.includes('data-quest-read="m87">Карточка<')&&!html.includes('>История<'),'visited checklist stages open the object card');
assert.ok(panel('messier').includes('>История<'));
Quests.start('starlife');html=Quests.storyHTML(object('orion'));
assert.equal(html.split('<h3>').length-1,1);assert.equal(html.split('quest-membership').length-1,3,'a shared object shows one story and a line for each of its quests');
console.log('PASS checklist stages are credited with a notice, have no story, plaque or forced card, and shared objects keep a single story');
}`);
