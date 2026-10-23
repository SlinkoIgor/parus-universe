import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const els=new Map();
class Element{constructor(){this.style={};this.dataset={};this.classList={add(){},remove(){},toggle(){}};this.hidden=false;this.value='';this.checked=true;this.children=[];this.open=false;}querySelector(s){return this.child||(this.child=new Element)}querySelectorAll(){return []}setAttribute(){}addEventListener(){}getBoundingClientRect(){return{width:900,height:620,left:0,top:0}}getContext(){return new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{})})}append(e){this.children.push(e)}replaceChildren(){this.children=[]}focus(){}showModal(){this.open=true}close(){this.open=false}}
const el=id=>els.get(id)||(els.set(id,new Element),els.get(id));
const context=vm.createContext({console,performance,Math,JSON,Number,Array,String,Set,Map,Date,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},ResizeObserver:class{observe(){}},document:{documentElement:{dataset:{theme:'dark'}},querySelector:()=>null,getElementById:el,querySelectorAll:()=>[],addEventListener(){},createElement:()=>new Element,hidden:false},window:{devicePixelRatio:1,addEventListener(){},open(){}},localStorage:{getItem(){return null},setItem(){}},assert});


vm.runInContext(['dist/catalog.js','dist/astronomy.js','dist/catalog-import.js','dist/catalog-retired.js','dist/coordinates.js','dist/cosmic-catalog.js','dist/layout-data.js','dist/map-layout.js','dist/map-details.js','dist/regions.js','dist/flight-view.js','dist/flight-marks.js','dist/physics.js','dist/flyby.js','dist/navigation.js','dist/simulation.js','dist/app.js'].map(p=>fs.readFileSync(p,'utf8')).join('\n'),context);
context.CATALOG_AUDIT=JSON.parse(fs.readFileSync('data-tools/selection-audit.json','utf8'));
const run=s=>vm.runInContext(s,context);
run(`
function close(a,b,tol=1e-10){assert.ok(Math.abs(a-b)<=tol,a+' ≈ '+b)}
function rel(a,b,tol=1e-7){close(a/b,1,tol)}
function fresh(){state=initial();Simulation.debt=0;Simulation.wallDebt=0;paused=false;speed=1;}
function settle(step=.01){let i=0;while(state.flight&&i++<100000){tickPhysics(step);assert.ok(state.matter>=-1e-25&&state.matter<=Rocket.fuelCapacity*(1+1e-12));assert.ok(state.beta>=0&&state.beta<1);assert.ok(state.proper<=state.earth+1e-7);}assert.ok(!state.flight,'flight must terminate');assert.equal(Simulation.debt,0);}
rel(Rocket.dryMass,1e-9);rel(Rocket.fuelCapacity,1e-9);rel(initial().matter,1e-9);
fresh();renderUI();assert.equal($('massDry').style.width,'50%');assert.equal($('massFuel').style.width,'50%');assert.equal($('dryMass').innerHTML,'1<small>мг</small>');assert.ok($('massBar').title.includes('Свободно 0,000 мг'));
Simulation.advance(2.5);close(state.proper,2.5);close(state.earth,2.5);paused=true;Simulation.advance(10);close(state.proper,2.5);paused=false;for(const multiplier of [10,100,1000]){speed=multiplier;var old=state.proper;Simulation.advance(.25);close(state.proper-old,.25*multiplier);}
console.log('PASS mg masses, full initial tank, 50/50 strip, idle clock, pause and time multipliers');
var plan=Rocket.plan(Rocket.fuelCapacity,Infinity);close(plan.beta,.6,1e-12);rel(plan.budget,Rocket.fuelCapacity);rel(plan.mf,Rocket.dryMass);assert.ok(plan.burnProper>0);close(Rocket.acceleration(Rocket.dryMass)/G0,100);
assert.equal(Rocket.plan(Rocket.fuelCapacity,1e-6).budget,plan.budget);
fresh();state.selected='alpha';launch();var burn=state.flight.engine.burnProper;tickPhysics(burn/4);assert.equal(state.phase,'thrust');assert.ok(state.beta>0&&state.beta<.6);close(state.proper,burn/4,1e-15);var fuel=state.matter;tickPhysics(burn);assert.equal(state.phase,'cruise');close(state.beta,.6,1e-12);assert.ok(state.matter<1e-24);close(state.proper,burn*1.25,1e-15);
var t0=state.earth,p0=state.proper,d0=state.totalDistance;tickPhysics(1);close(state.proper-p0,1);rel(state.earth-t0,1/Math.sqrt(1-state.beta**2));
function trip(step,total=30){fresh();state.selected='alpha';launch();let passed=0;while(passed<total){const dt=Math.min(step,total-passed);tickPhysics(dt);passed+=dt;}assert.equal(state.current,'alpha');close(state.proper,total,1e-9);return[state.earth,state.matter,state.totalDistance,state.captured,state.spentEnergy];}
var one=trip(30),many=trip(.01);for(let i=0;i<one.length;i++)if(one[i]||many[i])rel(one[i],many[i],2e-6);close(state.totalDistance,distance(object('sol'),object('alpha')),1e-9);
console.log('PASS capped photon rocket, full-tank acceleration, complete physical stop, proper-time timestep independence');
for(const sail of SAILS){var w=Stellar.plan(1e-6,sail.areaM2,0,Stellar.r0,100,Stellar.pulseYears,sail.targetBeta);close(w.beta,sail.targetBeta,2e-15);assert.equal(w.reason,'target');assert.ok(w.rows.at(-1).source<Stellar.pulseYears);for(const p of [0,.1,.5,.9,1]){const q=Stellar.sample(w,p);assert.ok(q.force/w.massKg<=100*G0*(1+1e-12));assert.ok(q.opening>=0&&q.opening<=1);}assert.ok(Stellar.sample(w,0).opening<Stellar.sample(w,.5).opening);}
var w=Stellar.plan(1e-6,SAILS[1].areaM2,0,Stellar.r0,100,Stellar.pulseYears,SAILS[1].targetBeta);rel(w.proper*365.25,30.67064003,1e-6);rel(w.distance,26.97863465,1e-6);close(Stellar.force(1e10,Stellar.r0,.4)/Stellar.force(1e10,2*Stellar.r0,.4),4);
// A short flash cannot attain the nominal target at <=100g, regardless of mass.
var short=Stellar.plan(1e-12,SAILS[1].areaM2,0,Stellar.r0,100,1200/Rocket.year,SAILS[1].targetBeta);assert.equal(short.reason,'pulse');assert.ok(short.beta<.004);close(short.rows.at(-1).source,1200/Rocket.year,1e-15);
fresh();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='sgr';state.sail=1;var forecast=windPlan().beta;launch();assert.equal(state.matter,0);close(state.flight.wind.massKg,1e-6,1e-20);close(state.flight.maxBeta,forecast,1e-15);var totalWind=state.flight.wind.proper;tickPhysics(totalWind/4);assert.equal(state.phase,'launch');assert.ok(state.beta>0&&state.beta<forecast);tickPhysics(totalWind);assert.equal(state.phase,'cruise');close(state.beta,forecast,1e-15);assert.equal(state.flight.markers.length,3);assert.ok(state.flight.markers.find(m=>m.kind==='acceleration').actual);
console.log('PASS force-integrated S/M/L, 100g deployment, finite flash and empty-tank boost forecasts');
// Short stages are explicitly replayed slowly; physical dt and wall dt stay separate.
fresh();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='sgr';state.sail=1;launch();var rate=Simulation.replayRate();assert.ok(rate<1);Simulation.advance(1);assert.equal(state.phase,'launch');close(state.proper,rate,1e-12);paused=true;var before=state.proper;Simulation.advance(2);close(state.proper,before);paused=false;Simulation.advance(4.1);assert.equal(state.phase,'cruise');assert.ok(state.beta>.9999998);close(Simulation.wallDebt,0);
console.log('PASS explicit slow replay, pause, stage transitions and return to normal speed');
// All displayed intermediates use one affine map segment; physical xyz is independent.
var f=state.flight,aa=FlightView.at(f,0),bb=FlightView.at(f,1);for(let i=0;i<=100;i++){const t=i/100,p=FlightView.at(f,t);close(p.x,aa.x+(bb.x-aa.x)*t,1e-10);close(p.y,aa.y+(bb.y-aa.y)*t,1e-10);const xyz=Space.mix(f.from,f.aim||object(f.target),t);close(FlightView.fraction(f,xyz.p3),t,1e-12);}var xyzBefore=JSON.stringify(state.ship.p3),covered=f.covered;for(let i=0;i<20;i++)FlightView.ship();assert.equal(JSON.stringify(state.ship.p3),xyzBefore);close(f.covered,covered);
for(const mark of f.markers){const frac=FlightView.fraction(f,mark.p3),p=FlightView.at(f,frac);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}
assert.ok(OBJECTS.length>1000);assert.ok(GALAXIES.length>=40);
var audit=CATALOG_AUDIT;
assert.equal(new Set(OBJECTS.flatMap(o=>o.iauNames||[])).size,652);
for(const name of audit.iauNames)assert.ok(OBJECTS.some(o=>o.iauNames?.includes(name)),name);
for(const id of [...audit.nearestHygIds,...audit.brightestHygIds])assert.ok(OBJECTS.some(o=>o.hygId===id),'missing HYG '+id);
for(const o of OBJECTS.filter(o=>o.d==null)){assert.equal(o.navigable,false);assert.equal(o.p3,null);}
assert.ok(object('bootes').region.major===300e6);assert.ok(object('sloan').region.shape==='ribbon');
var before=JSON.stringify(object('proxima').p3);RegionMap.draw();assert.equal(JSON.stringify(object('proxima').p3),before);
assert.ok(LAYOUT_DATA.diagnostics.every(d=>d.finalKL<=d.initialKL));
console.log('PASS straight affine route, collinear ship/markers, catalog and isolated 3D physics');
// Full tank does not remove drag. Capture, heat and 100g limit remain consistent.
var cap=2e-6,full=Magnetic.plan(cap,.9999999),q0=Magnetic.sample(full,.4),q1=Magnetic.sample(full,.400001);rel(q0.mass,cap);assert.equal(q0.massRate,0);assert.ok(q0.processedMassRate>0);assert.ok(-q0.properAcceleration<=100*G0*(1+1e-12));rel((q1.beta-q0.beta)*Rocket.c/((q1.earth-q0.earth)*Rocket.year),q0.coordinateAcceleration,4e-4);rel((q1.heat-q0.heat)/((q1.proper-q0.proper)*Rocket.year),q0.heatPower,4e-4);
fresh();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='alpha';state.sail=1;launch();var realDistance=state.flight.distance;settle(.001);assert.equal(state.current,'alpha');close(state.totalDistance,realDistance,1e-9);assert.ok(state.captured>0);assert.ok(state.matter<=Rocket.fuelCapacity);
assert.equal(Magnetic.sample(Magnetic.plan(1e-6,.999999999),0).distance,0);
for(const frame of [1/60,.047]){fresh();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='sgr';launch();var n=0;while(state.flight&&n++<5000)Simulation.advance(frame);assert.equal(state.current,'sgr','wall-clock arrival '+frame);assert.equal(Simulation.wallDebt,0);}
console.log('PASS 100g magnetic capture, finite tank, heat derivative and high-gamma frame-boundary arrival');
// No manual force command: the autopilot always controls stopping.
fresh();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='alpha';launch();state.auto=false;state.flight.manualCoast=true;assert.equal(Route.braking(),true);settle(.001);assert.equal(state.current,'alpha');
for(const requested of [1,10,100,1000]){
 fresh();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='sgr';launch();speed=requested;let count=0;
 while(state.flight&&count++<5000){const before=state.proper,rate=Simulation.replayRate();assert.ok(rate>0&&rate<=requested);Simulation.advance(1/60);assert.ok(state.proper-before<=requested/60+1e-9);assert.equal(speed,requested);}
 assert.equal(state.current,'sgr');assert.ok(count<5000);
}
fresh();state.flight={replayRate:10};state.phase='launch';assert.equal(Simulation.replayRate(),1);state.flight.replayRate=.01;assert.equal(Simulation.replayRate(),.01);speed=100;assert.equal(Simulation.replayRate(),1);state.phase='cruise';assert.equal(Simulation.replayRate(),100);
fresh();state.flight={};for(const g of [-100,-35,0,20,100]){state.acceleration=g*G0;renderAcceleration();assert.equal($('accelerationFill').style.width,Math.abs(g)/2+'%');assert.equal($('accelerationFill').style.left,(g<0?50+g/2:50)+'%');}
console.log('PASS automatic stopping, passive signed g meter, manual-only speed increases and capped slow motion across boost transitions');
close(Gravity.deflection(.99,10)*180/Math.PI,12.84017946,1e-7);close(Gravity.deflection(.99,2)*180/Math.PI,126.51428075,1e-7);assert.equal(Gravity.deflection(.99,1.5),Infinity);
fresh();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.sail=1;state.itinerary=[{id:'sgr',mode:'flyby'},{id:'m87',mode:'stop'}];assert.ok(Route.analyze().valid);Route.start();var launchPlan=state.flight.wind,coast=(state.flight.distance-launchPlan.distance)/state.flight.maxBeta*Math.sqrt(1-state.flight.maxBeta**2);tickPhysics(launchPlan.proper+coast);if(state.phase!=='flyby')tickPhysics(1e-6);assert.equal(state.phase,'flyby');var curve=state.flight.encounter.plan,betaBefore=state.beta,fuelBefore=state.matter;tickPhysics(curve.proper*.25);close(state.beta,betaBefore);close(state.matter,fuelBefore);tickPhysics(30000);assert.equal(state.current,'m87');assert.ok(state.visited.includes('sgr'));
console.log('PASS black-hole-only route and proper-time Schwarzschild turn');
fresh();launch(true);tickPhysics(state.flight.engine.burnProper*.2);var saved=JSON.parse(JSON.stringify(state));saved.version=6;saved.matter=.0005;var oldV=saved.beta,oldT=saved.earth,oldXYZ=JSON.stringify(saved.ship.p3);state=restore(saved);close(state.beta,oldV);close(state.earth,oldT);assert.equal(JSON.stringify(state.ship.p3),oldXYZ);rel(state.matter,Rocket.fuelCapacity*.5);settle();var home=initial();home.version=6;home.matter=.0005;state=restore(home);rel(state.matter,Rocket.fuelCapacity);
var retired=RETIRED_OBJECTS.find(o=>!object(o.id));var oldSave=initial();oldSave.selected=retired.id;oldSave.earth=123;var migrated=restore(oldSave);assert.equal(migrated.selected,retired.id);assert.equal(migrated.earth,123);assert.ok(object(retired.id).retired);
var oldManual=initial();oldManual.auto=false;oldManual.controlG=-20;var migratedAuto=restore(oldManual);assert.equal(migratedAuto.auto,true);assert.equal(migratedAuto.controlG,100);
console.log('PASS migration preserves physical position, historical clocks and tank fraction');
`);
const html=fs.readFileSync('dist/index.html','utf8'),ids=new Set([...html.matchAll(/id="([^" ]+)"/g)].map(x=>x[1]));for(const [,id]of fs.readFileSync('dist/app.js','utf8').matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(id)||['startExploring','confirmReset','viewGalaxy','viewRegion'].includes(id),'missing '+id);console.log('PASS interface IDs');
run(`
function exactArrival(){let count=0;while(state.flight&&count++<40)Simulation.step(1e12);assert.ok(!state.flight,'exact arrival terminates');return{proper:state.proper,earth:state.earth};}
for(const spec of [
 {from:'sol',to:'alpha',engine:true},
 {from:'andromeda',to:'triangulum',engine:true},
 {from:'proxima',to:'alpha',sail:0},
 {from:'proxima',to:'sgr',sail:1},
 {from:'proxima',to:'andromeda',sail:2}
]){
 fresh();state.current=spec.from;state.ship=Space.point(object(spec.from).p3);state.selected=spec.to;state.sail=spec.sail??1;
 if(spec.engine&&object(spec.from).kind==='star')state.destroyed.push(spec.from);
 const estimate=FlightEstimate.get();assert.ok(estimate&&estimate.earth>=estimate.proper);
 const serialized=JSON.stringify(state);FlightEstimate.get();assert.equal(JSON.stringify(state),serialized,'forecast does not mutate expedition');
 launch(!!spec.engine);const f=state.flight,starting=FlightEstimate.get();rel(starting.proper,estimate.proper,1e-8);rel(starting.earth,estimate.earth,1e-8);
 if(spec.from==='andromeda'){tickPhysics(f.engine.burnProper*1.01);assert.ok(state.matter<1e-24,'intergalactic burn empties tank');close(state.beta,.6,1e-12);}
 else tickPhysics((f.wind?.proper||f.engine.burnProper)*.23);
 const now=FlightEstimate.get(),epoch={proper:state.proper,earth:state.earth},arrived=exactArrival();assert.equal(state.current,spec.to);
 rel(arrived.proper,estimate.proper,3e-6);rel(arrived.earth,estimate.earth,3e-6);
 rel(arrived.proper-epoch.proper,now.proper,3e-6);rel(arrived.earth-epoch.earth,now.earth,3e-6);
}
// Extremely short legs are stopped at the target, without the former 8% rule.
fresh();const real=object('alpha').p3;state.ship=Space.point(real.map((v,i)=>v+(i===0?1e-6:0)));state.current=null;state.selected='alpha';var eta=FlightEstimate.get();launch(true);exactArrival();assert.equal(state.current,'alpha');assert.ok(state.matter>0);rel(state.proper,eta.proper,3e-6);
// Old saves resume the remaining reserve continuously instead of keeping the old cap.
fresh();state.selected='andromeda';launch(true);tickPhysics(state.flight.engine.burnProper*.4);var old=JSON.parse(JSON.stringify(state));delete old.flight.engine.fullTank;old.phase='cruise';var oldPosition=JSON.stringify(old.ship),oldBeta=old.beta,oldEarth=old.earth;state=restore(old);assert.equal(state.phase,'thrust');assert.equal(JSON.stringify(state.ship),oldPosition);assert.equal(state.beta,oldBeta);assert.equal(state.earth,oldEarth);tickPhysics(state.flight.engine.burnProper*1.01);assert.ok(state.matter<1e-24);
assert.equal(speedNumber(.999999999),'99,999.999.9');assert.equal(speedNumber(.6),'60,00');
console.log('PASS full intergalactic burn, early short-leg stopping, both ETA clocks versus actual arrival, and reserve migration');
`);
