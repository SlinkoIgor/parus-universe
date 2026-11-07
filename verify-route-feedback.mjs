import fs from 'node:fs';
let harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0];
harness=harness.replaceAll('addEventListener(){}','addEventListener(name,fn){this.listeners??={};this.listeners[name]=fn;}')
 .replace('requestAnimationFrame(){}','requestAnimationFrame(fn){context.raf.push(fn);}')
 .replace('vm.runInContext([','context.raf=[];\nvm.runInContext([');
const {run,context}=await import('data:text/javascript,'+encodeURIComponent(harness+'\nexport {run,context};')+'#route-feedback');
context.raf.length=0;
run(`{
state=initial();state.expansion=false;paused=true;FlightQueue.reset();Route.selection=null;Cosmology.sync(state);
let previews=0,analyses=0,saves=0;globalThis.feedbackCounts=()=>({previews,analyses,saves});
MissionPlanner.preview=()=>{previews++;return MissionPlanner.invalid('Прогноз теста');};
Route.analyze=()=>{analyses++;return{valid:true,records:state.itinerary.map(n=>({...n,issue:'',d:1,beta:0})),proper:1,earth:2};};
persist=()=>{saves++;};
const shift=id=>{pickMapTarget=()=>({id});pointer={down:true,moved:false,id:1};canvas.listeners.pointerup({pointerId:1,shiftKey:true});};
shift('barnard');shift('ross');
assert.equal(state.itinerary.map(n=>n.id).join(),'alpha,barnard,ross');
assert.equal($('targetName').textContent,object('ross').name);assert.equal($('phaseTag').textContent,'МАРШРУТ');
assert.equal(previews,0,'input never calculates a single-target preview');assert.equal(analyses,0,'input never integrates the route');assert.equal(saves,0,'input does not serialize the expedition before painting');
assert.equal(Route.feedbackPending,true);renderUI();assert.equal(previews,0,'normal UI tick respects immediate feedback');
assert.equal($('routeDraftIssue').hidden,true);assert.equal($('routeDraftIssue').textContent,'');assert.equal($('cancelRouteDraft').hidden,false);
console.log('PASS actual Shift handler mutates all three points and DOM immediately without forecasts, route integration or save serialization');
} `);
const paint=()=>{const queue=context.raf.splice(0);for(const cb of queue)cb(0);};
paint();
run(`assert.equal(Route.feedbackPending,true);assert.equal(feedbackCounts().previews,0);assert.equal(feedbackCounts().analyses,0);`);
paint();
run(`assert.equal(Route.feedbackPending,false);assert.equal($('targetName').textContent,object('ross').name);assert.equal(feedbackCounts().analyses,1);assert.equal(feedbackCounts().saves,1);`);
run(`{
globalThis.selectionCard=()=>JSON.stringify(['targetName','targetType','targetDistance','phaseTag','arrivalProper','arrivalEarth','routeDraftIssue','blackHoleArrival','launchBtn'].map(id=>{const e=$(id);return[id,e.textContent,e.innerHTML,e.hidden,e.disabled];}));
globalThis.selectionBefore=selectionCard();globalThis.selectionCounts=feedbackCounts();
const point=id=>{pickMapTarget=()=>({id});pointer={down:true,moved:false,id:1};canvas.listeners.pointerup({pointerId:1,shiftKey:false});};
point('ross');assert.equal(selectionCard(),selectionBefore,'reselecting the same object never shows route calculation placeholders');
point('alpha');assert.equal(state.selected,'alpha');assert.equal(selectionCard(),selectionBefore,'a new selection keeps the complete previous card until its forecast is ready');
renderUI();assert.equal(selectionCard(),selectionBefore,'the regular UI tick cannot flash a calculating-route row');assert.deepEqual(feedbackCounts(),selectionCounts);
}`);
paint();
run(`assert.equal(selectionCard(),selectionBefore);assert.deepEqual(feedbackCounts(),selectionCounts);`);
paint();
run(`assert.equal(Route.feedbackPending,false);assert.equal(Route.feedbackSelectionOnly,false);assert.equal($('targetName').textContent,object('alpha').name);assert.equal($('routeDraftIssue').hidden,true);console.log('PASS ordinary clicks preserve the complete card through the first frame and update it once, without route placeholders or stale deferred updates');`);
run(`{
const point=(id,shiftKey=false)=>{pickMapTarget=()=>({id});pointer={down:true,moved:false,id:1};canvas.listeners.pointerup({pointerId:1,shiftKey});};
state=initial();state.expansion=false;
point('barnard');assert.equal(state.itinerary.length,0,'ordinary selection remains a single target');
const before=feedbackCounts();point('alpha',true);
assert.equal(state.itinerary.map(n=>n.id).join(),'barnard,alpha','Shift continues after the explicitly selected first target');
assert.equal(feedbackCounts().analyses,before.analyses);assert.equal(feedbackCounts().saves,before.saves);
point('sirius');point('ross',true);assert.equal(state.itinerary.map(n=>n.id).join(),'barnard,alpha,ross','browsing never inserts extra stops in an existing route');
point('ross',true);assert.equal(state.itinerary.map(n=>n.id).join(),'barnard,alpha');
for(const first of ['sol','barnard',OBJECTS.find(o=>!o.navigable).id]){
 state=initial();point(first);point('barnard',true);assert.equal(state.itinerary.map(n=>n.id).join(),'barnard');
}
state=initial();point('barnard');state=initial();point('ross',true);assert.equal(state.itinerary.map(n=>n.id).join(),'alpha,ross','a reset uses the new visible selection, never an old expedition anchor');
state=initial();point('sgr');point('m87',true);assert.equal(state.itinerary.map(n=>n.id).join(),'sgr,m87');assert.equal(state.itinerary[0].mode,'flyby');
state=initial();point('barnard');point('sol',true);assert.equal(state.itinerary.map(n=>n.id).join(),'barnard,sol','the second point may be a return to the departure station');
Route.cancelFeedback();
console.log('PASS ordinary selection then Shift preserves the first target, appends in order and toggles only the tail, with the visible default and without stale/current/unlocated anchors');
}`);
const html=fs.readFileSync('dist/index.html','utf8');
if(/id="(?:routeDraft|routeDraftPoints|routeDraftCount|editRouteDraft|clearRouteDraft)"/.test(html))throw Error('The removed horizontal stop list must stay absent');
run(`{
assert.equal(Route.limit,10);
const original=Route.analyze;Route.analyze=()=>({valid:true,records:[],proper:0,earth:0});
state.itinerary=[];state.selected='sol';
const choices=OBJECTS.filter(o=>o.navigable&&o.kind==='star').slice(0,11);
for(const o of choices.slice(0,10))Route.add(o.id);
assert.equal(state.itinerary.length,10);Route.add(choices[10].id);assert.equal(state.itinerary.length,10);
assert.equal($('toast').dataset.icon,'warning');assert.equal($('toastText').textContent,'В маршруте уже 10 будущих участков.');
const old=JSON.parse(JSON.stringify(state));old.itinerary.push({id:choices[10].id,mode:'stop'});state=restore(old);assert.equal(state.itinerary.length,11,'existing longer routes survive the new limit');
Route.undo();assert.equal(state.itinerary.length,10);Route.undo();Route.add(choices[10].id);assert.equal(state.itinerary.length,10);
Route.analyze=original;
for(const icon of Object.keys(Notices.labels)){
 toast('<message>',4200,icon);assert.equal($('toast').dataset.icon,icon);assert.equal($('toast').dataset.kind,'notice');assert.equal($('toastText').textContent,'<message>');
}
Notices.render('Текст подсказки','tip','tip');assert.equal($('toast').textContent,'Текст подсказки');assert.equal($('toast').dataset.icon,'tip');
console.log('PASS 10-point limit, unchanged older routes, reusable capacity after undo and typed notification icons without text prefixes');
}`);
console.log('PASS deferred forecast completes after a paint and uses the latest route');
