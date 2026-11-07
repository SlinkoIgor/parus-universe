import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run,context};';
const {run,context}=await import('data:text/javascript,'+encodeURIComponent(harness));
context.fetch=async path=>{path=path.split('?')[0];return {ok:fs.existsSync('dist/'+path),json:async()=>JSON.parse(fs.readFileSync('dist/'+path,'utf8'))};};
context.arrivalIndex=JSON.parse(fs.readFileSync('dist/arrival-stars-index.json'));
run('ArrivalStars.index=arrivalIndex');
await run('ArrivalStars.prepare(object("andromeda"))');
run(`{
OrbitalArrival.enabled=true;
const reset=()=>{state=initial();state.expansion=false;state.trafficSeed=31;paused=true;Simulation.debt=Simulation.wallDebt=0;FlightQueue.reset();Cosmology.sync(state);};
reset();launch();paused=true;
const active=state.flight,physical=()=>JSON.stringify({flight:{...state.flight,route:undefined,legIndex:undefined},ship:state.ship,beta:state.beta,matter:state.matter,phase:state.phase,earth:state.earth,proper:state.proper});
const before=physical();
select('sirius');assert.equal(state.flight,active);assert.equal(physical(),before);assert.equal($('targetName').textContent,object('sirius').name);assert.equal($('phaseTag').textContent,'ДОБАВИТЬ УЧАСТОК');assert.equal($('flightControls').hidden,true);
const ctx=FlightQueue.context();assert.equal(ctx.current,'alpha');assert.equal(ctx.matter,active.mission.arrivalFuelKg/1000);assert.ok(FlightQueue.forecast(ctx).valid);assert.equal(physical(),before);
FlightBuilder.open(ctx);assert.equal(FlightBuilder.readOnly,false);assert.equal(FlightBuilder.source.id,'alpha');assert.equal(physical(),before);FlightBuilder.draft.arrivalFuelPercent=25;FlightBuilder.apply();assert.equal(physical(),before);assert.equal(FlightQueue.setupFor('sirius').arrivalFuelPercent,25);
Route.add('sirius');assert.deepEqual(Route.future().map(n=>n.id),['sirius']);assert.equal(physical(),before);
select('vega');Route.add('vega');assert.deepEqual(Route.future().map(n=>n.id),['sirius','vega']);assert.equal(FlightQueue.context('vega').current,'sirius');
FlightQueue.dismiss();assert.equal(state.selected,'alpha');assert.equal($('targetName').textContent,object('alpha').name);
const saved=JSON.parse(JSON.stringify(state)),restored=restore(saved);assert.equal(restored.flight.route.length,3);assert.equal(restored.flight.route[1].setup.arrivalFuelPercent,25);assert.equal(restored.trafficSeed,31);assert.equal(restored.multiplayer,false);
state=restored;Simulation.tick(state.flight.mission.proper*1.00001);assert.equal(state.flight.target,'sirius');assert.equal(Route.future().length,1);Simulation.tick(state.flight.mission.proper*1.00001);assert.equal(state.flight.target,'vega');assert.equal(Route.future().length,0);Simulation.tick(state.flight.mission.proper*1.00001);assert.equal(state.current,'vega');assert.equal(state.flight,null);assert.ok(state.flightHistory.length>=3);
// Cancelling the flight restores the pre-departure expedition.
state=restore(saved);FlightHistory.cancel();assert.equal(state.current,'sol');assert.equal(Route.future().length,0);
reset();launch();paused=true;const choices=[];for(const o of OBJECTS.filter(o=>o.navigable&&o.kind==='star'&&o.id!=='alpha').sort((a,b)=>a.d-b.d)){if(choices.every(q=>Space.distance(q,o)>.1)&&Space.distance(o,object('alpha'))>.1)choices.push(o);if(choices.length===10)break;}const ids=choices.map(o=>o.id);
assert.equal(ids.length,10);for(const id of ids){select(id);Route.add(id);}assert.equal(Route.future().length,10);select('proxima');Route.add('proxima');assert.equal(Route.future().length,10);
// Unknown/non-navigable records cannot enter the route.
const unknown=OBJECTS.find(o=>!o.navigable);Route.add(unknown.id);assert.equal(Route.future().length,10);
// A future nonstellar endpoint stays a preview; it is not registered as a discovered star.
reset();launch();paused=true;select('andromeda');Route.add('andromeda');select('sirius');const pinnedBefore=ExtendedCatalog.pinned.size,registered=OBJECTS.length,preview=FlightQueue.context();assert.ok(preview.planningSource?.gameArrivalStar||preview.planningSource?.parentObject==='andromeda'||preview.planningSource?.parentGalaxy==='andromeda');assert.equal(OBJECTS.length,registered);assert.equal(ExtendedCatalog.pinned.size,pinnedBefore);const optical=FlightQueue.run(preview,()=>MissionPlanner.preview({...preview.flightSetup,engine:false,sail:true,collector:true,arrivalFuelPercent:0}));assert.ok(optical.valid,optical.reason);assert.ok(optical.acceleration.hasLight,'future undiscovered star remains an optical departure source in detailed plans');
// Current epoch changes must not contaminate the fixed arrival forecast.
reset();launch();paused=true;Simulation.tick(state.flight.mission.proper*.2);select('sirius');const late=FlightQueue.context();assert.ok(Math.abs(late.earth-state.earth-FlightEstimate.get().earth)<1e-8);
// Reaching the first stop while editing must not discard the next launch.
reset();launch();paused=true;select('sirius');FlightBuilder.open(FlightQueue.context());FlightBuilder.draft.arrivalFuelPercent=25;Simulation.tick(state.flight.mission.proper*1.00001);assert.equal(state.flight,null);assert.equal(state.current,'alpha');FlightBuilder.apply(true);assert.equal(state.flight?.target,'sirius');assert.equal(state.flight.mission.setup.arrivalFuelPercent,25);
// Deterministic analytical fleets: bounded memory, no changes to player state/history.
reset();state.multiplayer=true;const trafficBefore=JSON.stringify(state);const fleet=GalacticTraffic.generation();assert.equal(fleet.length,40);assert.equal(GalacticTraffic.generation(),fleet);
for(const q of fleet){const p=q.plan,a=GalacticTraffic.sample(p,0),b=GalacticTraffic.sample(p,p.duration);assert.ok(Space.distance(a.point,p.from)<1e-9);assert.ok(Space.distance(b.point,p.to)<1e-8);assert.ok(b.beta<1e-10);assert.ok(Math.abs(b.proper-p.proper)<1e-7);for(const t of [p.ta/2,p.ta,p.ta+p.tc/2,p.duration-p.ta/2]){const sample=GalacticTraffic.sample(p,t),h=.00001,d=Space.distance(GalacticTraffic.sample(p,t-h).point,GalacticTraffic.sample(p,t+h).point)/(2*h);assert.ok(sample.beta>=0&&sample.beta<1);assert.ok(Math.abs(d-sample.beta)<5e-6);}}
assert.ok(Math.abs(GalacticTraffic.relativeGamma([.8,0,0],[.8,0,0])-1)<1e-12);assert.ok(Math.abs(GalacticTraffic.relativeGamma([.8,0,0],[-.8,0,0])-4.555555555555557)<1e-12);
let outside=0;for(let seed=0;seed<100;seed++)outside+=GalacticTraffic.generation(seed).filter(q=>q.outside).length;assert.ok(outside>150&&outside<250,outside);assert.equal(GalacticTraffic.generations.size,1);
cam={x:0,y:0,span:1.15e11};assert.equal(GalacticTraffic.visible(),false);cam.span=130000;assert.equal(GalacticTraffic.visible(),true);GalacticTraffic.draw();assert.equal(JSON.stringify(state),trafficBefore);state.multiplayer=false;GalacticTraffic.draw();assert.equal(GalacticTraffic.hits.length,0);
// Photon and kinetic-energy scenarios conserve their separate energy budgets.
const q=PulsarResearch.calculate({powerW:1e30}),far=PulsarResearch.calculate({powerW:1e30,radiusAu:10}),heavy=PulsarResearch.calculate({powerW:1e30,massKg:4});assert.ok(Math.abs(q.photonA/far.photonA-100)<1e-10);assert.ok(Math.abs(q.photonA/heavy.photonA-2)<1e-10);assert.ok(q.plasmaA>q.photonA);assert.ok(q.photonTerminalBeta>far.photonTerminalBeta);assert.ok(q.photonTerminalBeta<.2);
// Independently integrate the moving-sail pressure, rather than its closed form.
for(const sample of [q,far,heavy]){const eta=Math.atanh(sample.plasmaTerminalBeta),n=2048,h=eta/n;let sum=0;for(let i=0;i<=n;i++){const u=i*h,beta=Math.tanh(u),pressure=(1-beta/.7)**2/(1-beta*beta),v=Math.sinh(u)/pressure;sum+=(i===0||i===n?1:i%2?4:2)*v;}const radius=sample===far?10:1,budget=sample.plasmaA*radius*149597870700/Rocket.c**2;assert.ok(Math.abs(sum*h/3-budget)<budget*1e-8);assert.ok(sample.plasmaTerminalBeta<.7&&sample.plasmaTerminalBeta>sample.photonTerminalBeta);}
assert.ok(q.plasmaTerminalBeta>far.plasmaTerminalBeta&&q.plasmaTerminalBeta>heavy.plasmaTerminalBeta);
const weak=PulsarResearch.calculate({powerW:1e8}),strong=PulsarResearch.calculate({powerW:1e48});assert.ok(Math.abs(weak.plasmaTerminalBeta*Rocket.c/Math.sqrt(2*weak.plasmaA*149597870700)-1)<1e-6);assert.ok(strong.plasmaTerminalBeta<=.7&&strong.plasmaTerminalBeta>.69);
for(const key of Object.keys(COLOR_THEMES)){applyTheme(key);assert.equal(theme,key);assert.ok(/^#[0-9a-f]{6}$/.test(paint('#424242')));for(let n=0;n<200;n++)paint('#'+n.toString(16).padStart(6,'0'));assert.ok(darkInk.size<=128);}applyTheme('dark');assert.equal(paint('#424242'),'#bdbdbd');
console.log('PASS future target cards, independent plans, route limit, automatic multi-stop arrival, save/restore, rollback, unrevealed stars, exact fleet worldlines/relative clocks/5% exits, palettes and pulsar bounds');
}`);
