import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness)+'#route-presentation');
run(`{
state=initial();state.expansion=false;paused=true;FlightQueue.reset();Cosmology.sync(state);
state.itinerary=['barnard','alpha','ross','sol'].map(id=>({id,mode:'stop'}));state.selected='sol';
const legs=Route.legs();assert.equal(legs.map(l=>[l.from.id||'ship',l.to.id].join('>')).join(),'ship>barnard,barnard>alpha,alpha>ross,ross>sol');
for(const id of ['barnard','alpha','ross','sol']){
 const leg=legs.find(l=>l.id===id);state.selected=id;Route.renderDistance();
 assert.equal($('distanceCaption').textContent,'ОТ ПРЕДЫДУЩЕЙ ТОЧКИ');assert.equal($('targetDistance').innerHTML,compact(Cosmology.physicalDistance(leg.from,leg.to))+' <small>св. лет</small>');
}
assert.ok(Route.selectedLeg().distance>1,'return to the departure point is a future leg, not a zero-distance arrival');
for(const o of OBJECTS.filter(o=>!o.p3).slice(0,5))assert.equal(Route.selectedLeg(o.id),null,'unknown coordinates cannot produce a distance');
const preview=MissionPlanner.preview,analysis=Route.analyze;MissionPlanner.preview=()=>MissionPlanner.invalid('No single-target preview at current station');
Route.analyze=()=>({valid:true,records:[],proper:1,earth:2});renderUI();
assert.equal($('arrivalEstimate').hidden,false);assert.equal($('launchBtn').disabled,false);assert.equal($('launchBtn').hidden,false);assert.equal($('cancelRouteDraft').hidden,false);assert.equal($('flightHint').hidden,true);
assert.equal($('launchBtn').querySelector('span').textContent,'Начать маршрут');
const caption=drawSegmentDistance,labels=[];drawSegmentDistance=(from,to,d)=>labels.push([from.id||'ship',to.id,d]);
drawRouteDistance();assert.equal(labels.length,4);for(let i=0;i<legs.length;i++)assert.equal(labels[i][2],legs[i].distance);
assert.equal(labels.some(l=>l[0]==='ship'&&l[1]==='ross'),false,'no shortcut distance from the ship to the selected last point');
drawSegmentDistance=caption;
const originalText=text,captions=[];text=(label)=>captions.push(label);width=1440;height=1000;hudHeight=94;
for(const mode of ['full','slice','radial']){
 MapSlice.mode=mode;cam={x:0,y:0,span:50};captions.length=0;drawRouteDistance();
 assert.equal(captions.join('|'),legs.map(l=>distanceText(l.distance)).join('|'),'3D leg captions in '+mode);
}
text=originalText;MapSlice.mode='full';
const before=JSON.stringify([state.ship,state.matter,state.proper,state.earth]);
$('cancelRouteDraft').onclick();assert.equal(state.itinerary.length,0);assert.equal(state.selected,'sol');assert.equal(Route.feedbackPending,false);assert.equal($('cancelRouteDraft').hidden,true);assert.equal(JSON.stringify([state.ship,state.matter,state.proper,state.earth]),before);
MissionPlanner.preview=preview;Route.analyze=analysis;
console.log('PASS per-leg 3D card distances and dashed captions in all projections, visible nonzero return leg and icon cancellation without changing the expedition');

state=initial();state.expansion=false;state.flight={from:Space.point(object('sol').p3),target:'barnard',route:[{id:'barnard',mode:'stop'},{id:'alpha',mode:'stop'},{id:'sol',mode:'stop'},{id:'alpha',mode:'stop'}],legIndex:0,summary:{distance:6},distance:6};
state.selected='alpha';const active=Route.legs();assert.equal(active[0].active,true);assert.equal(active[0].distance,6);assert.equal(Route.selectedLeg().from.id,'sol','the latest occurrence uses its own preceding point');
const draw=drawSegmentDistance,calls=[];drawSegmentDistance=(a,b,d)=>calls.push([a.id||'ship',b.id,d]);drawRouteDistance();drawSegmentDistance=draw;
assert.equal(calls.length,4);assert.equal(calls[0][2],6);assert.equal(calls[3][0],'sol');
const preserved=JSON.stringify(state);Route.cancelDraft();assert.equal(JSON.stringify(state),preserved,'the draft cancel action cannot cancel an executing flight');
console.log('PASS active and future captions share the same adjacent endpoints, repeated targets use their own leg and draft cancellation cannot alter active flight');
}`);
