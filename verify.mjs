import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const els=new Map();
class Element{constructor(){this.style={};this.dataset={};this.classList={add(){},remove(){},toggle(){}};this.hidden=false;this.value='';this.checked=true;this.children=[];this.open=false;}querySelector(s){return this.child||(this.child=new Element)}querySelectorAll(){return []}setAttribute(){}addEventListener(){}getBoundingClientRect(){return{width:900,height:620,left:0,top:0}}getContext(){return new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{})})}append(e){this.children.push(e)}replaceChildren(){this.children=[]}focus(){}showModal(){this.open=true}close(){this.open=false}}
const el=id=>els.get(id)||(els.set(id,new Element),els.get(id));
const context=vm.createContext({console,performance,Math,JSON,Number,Array,String,Set,Map,Date,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},ResizeObserver:class{observe(){}},document:{documentElement:{dataset:{theme:'dark'}},querySelector:()=>null,getElementById:el,querySelectorAll:()=>[],addEventListener(){},createElement:()=>new Element,hidden:false},window:{devicePixelRatio:1,addEventListener(){},open(){}},localStorage:{getItem(){return null},setItem(){}},assert});


vm.runInContext(['dist/catalog.js','dist/astronomy.js','dist/catalog-import.js','dist/coordinates.js','dist/layout-data.js','dist/map-layout.js','dist/flight-marks.js','dist/physics.js','dist/flyby.js','dist/navigation.js','dist/simulation.js','dist/app.js'].map(p=>fs.readFileSync(p,'utf8')).join('\n'),context);
const run=s=>vm.runInContext(s,context);
run(`
function close(a,b,tol=1e-9){assert.ok(Math.abs(a-b)<=tol,a+' ≈ '+b)}
function rel(a,b,tol=1e-7){close(a/b,1,tol)}
function fresh(){state=initial();Simulation.debt=0;paused=false;speed=1;}
function settle(step=.01){let i=0;while(state.flight&&i++<100000){tickPhysics(step);assert.ok(state.matter>=-1e-15&&state.matter<=Rocket.fuelCapacity+1e-15);assert.ok(state.beta>=0&&state.beta<1);assert.ok(state.proper<=state.earth+1e-7);}assert.ok(!state.flight,'flight must terminate');assert.equal(Simulation.debt,0);}
close(Rocket.dryMass,.001);close(Rocket.fuelCapacity,.001);close(initial().matter,.0005);
fresh();renderUI();assert.equal($('massDry').style.width,'50%');assert.equal($('massFuel').style.width,'25%');assert.equal($('dryMass').innerHTML,'1<small>кг</small>');assert.ok($('massBar').title.includes('Свободно 0,500 кг'));
Simulation.advance(2.5);close(state.proper,2.5);close(state.earth,2.5);paused=true;Simulation.advance(10);close(state.proper,2.5);paused=false;
for(const multiplier of [10,100,1000]){speed=multiplier;var old=state.proper;Simulation.advance(.25);close(state.proper-old,.25*multiplier);}
fresh();for(const expected of [10,100,1000,1]){$('speedBtn').onclick();assert.equal(speed,expected);}console.log('PASS: 1 kg dry + 1 kg tank, half-filled start, 50/25/25 strip, idle clock, pause and all time multipliers');
// Relativistic photon engine and reserve for an independent reverse-thrust stop.
var plan=Rocket.plan(.0005,4.37);close(plan.beta,.2,1e-12);var reserve=.0005-plan.budget,retro=Rocket.retroPlan(reserve,plan.beta);assert.ok(retro.canStop);close(retro.mf,Rocket.dryMass,1e-12);
var start=Rocket.plan(.0005,Infinity,.05);assert.ok(start.beta>.05);var a=Rocket.plan(.000005,Infinity),b=Rocket.plan(.0005,Infinity);close(Rocket.beta(a.m0,a.mf),a.beta);
fresh();state.selected='alpha';launch();var burn=state.flight.engine.burnProper;tickPhysics(burn/4);assert.equal(state.phase,'thrust');assert.ok(state.beta>0&&state.beta<.2);close(state.proper,burn/4,1e-18);var fuel=state.matter;tickPhysics(burn);assert.equal(state.phase,'cruise');close(state.beta,.2,1e-12);assert.ok(state.matter<fuel);close(state.proper,burn*1.25,1e-16);
var t0=state.earth,p0=state.proper,d0=state.totalDistance;tickPhysics(1);close(state.proper-p0,1,1e-12);rel(state.earth-t0,1/Math.sqrt(1-.2**2));rel(state.totalDistance-d0,.2/Math.sqrt(1-.2**2));
console.log('PASS: physical photon burn seconds, symmetric fuel reserve, cruise proper/Earth conversion');
// Endpoints and clocks are independent of frame size, including leftover idle time.
function trip(step,total=30){fresh();state.selected='alpha';launch();let passed=0;while(passed<total){var dt=Math.min(step,total-passed);tickPhysics(dt);passed+=dt;}assert.equal(state.current,'alpha');close(state.proper,total,1e-9);return [state.earth,state.matter,state.totalDistance,state.captured,state.spentEnergy];}
var one=trip(30),many=trip(.01);for(let i=0;i<one.length;i++)if(one[i]||many[i])rel(one[i],many[i],2e-7);close(state.totalDistance,distance(object('sol'),object('alpha')),1e-10);
console.log('PASS: complete own-thrust arrival, strict proper clock across events, no dropped remainder, timestep independence');
// Sail calibration remains force-integrated, not a speed cap.
for(let i=0;i<SAILS.length;i++){var w=Stellar.plan(1.5,SAILS[i].areaM2);close(w.beta,SAILS[i].targetBeta,2e-13);close(Stellar.sample(w,0).beta,0);assert.ok(ProperTime.at(w,Stellar,w.proper*.3).beta<w.beta);assert.ok(Stellar.plan(2,SAILS[i].areaM2).beta<w.beta);}
close(Stellar.force(1e10,Stellar.r0,.4)/Stellar.force(1e10,2*Stellar.r0,.4),4);var best=Stellar.plan(1.5,SAILS[2].areaM2);close(best.beta,.9999999,2e-13);
fresh();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='sgr';state.sail=2;launch();var totalWind=state.flight.wind.proper;tickPhysics(totalWind/4);assert.equal(state.phase,'launch');assert.ok(state.beta>0&&state.beta<best.beta);var oldP=state.proper;tickPhysics(totalWind);close(state.proper-oldP,totalWind,1e-12);assert.equal(state.phase,'cruise');close(state.beta,best.beta,1e-13);assert.equal(state.flight.markers.length,3);assert.ok(state.flight.markers.find(m=>m.kind==='acceleration').actual);assert.ok(percentC(state.beta).includes('99,9999900'));
console.log('PASS: S/M/L calibrated from integrated inverse-square wind, 99.99999% L, physical wind proper-time inversion, persistent markers');
// A nearby wind trip may finish within one frame; its clocks and idle remainder remain exact.
fresh();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='sirius';state.sail=2;launch();tickPhysics(1);assert.equal(state.current,'sirius');close(state.proper,1,1e-10);assert.ok(state.earth>5);assert.ok(state.matter<=.001);assert.ok(state.destroyed.includes('proxima'));
// Finite-tank capture and constant-mass drag.
var cap=2,full=Magnetic.plan(cap,.9999999),s0=Magnetic.sample(full,.4),s1=Magnetic.sample(full,.400001);close(s0.mass,cap);assert.equal(s0.massRate,0);assert.ok(s0.processedMassRate>0);rel((s1.beta-s0.beta)*Rocket.c/((s1.earth-s0.earth)*Rocket.year),s0.coordinateAcceleration,3e-4);rel((s1.heat-s0.heat)/((s1.proper-s0.proper)*Rocket.year),s0.heatPower,3e-4);
var m=Magnetic.plan(1.5,.5),half=ProperTime.at(m,Magnetic,m.proper*.5);close(half.proper,m.proper*.5,1e-18);assert.ok(half.mass<=2&&half.beta<.5);
console.log('PASS: one-frame wind arrival with clock remainder, 1 kg fuel cap and capture/release force/heat ODE');
// Manual overrides do not teleport the ship or spend additional engine fuel.
fresh();launch();tickPhysics(state.flight.engine.burnProper*.2);var v=state.beta,fuel=state.matter;cutEngine();tickPhysics(.25);close(state.beta,v);close(state.matter,fuel);toggleBrake();tickPhysics(1);assert.equal(state.current,null);assert.ok(distance(state.ship,object('proxima'))>1);
console.log('PASS: engine cutoff, early braking outside target and manual override');
// 3D coordinates are independent of map embedding, plane and solar radii stay anchored.
assert.equal(OBJECTS.length,575);assert.equal(GALAXIES.length,90);for(const o of OBJECTS.filter(o=>o.p3)){const p=MapLayout.project(o);rel(Math.hypot(p.x,p.y)||1,Math.hypot(...o.p3)||1,1e-12);}
var plane=MapLayout.project(Space.point([20,-30,0]));close(plane.x,20);close(plane.y,30);var pole=MapLayout.project(Space.point([0,0,1e9]));rel(Math.hypot(pole.x,pole.y),1e9);close(distance(Space.point([0,0,0]),Space.point([0,0,10])),10);
assert.ok(LAYOUT_DATA.diagnostics.every(d=>d.finalKL<=d.initialKL));
console.log('PASS: catalog counts, 3D geometry, t-SNE constraints and physical isolation');
// Geodesic clocks use proper time and preserve speed/fuel through the turn.
close(Gravity.deflection(.99,10)*180/Math.PI,12.84017946,1e-7);close(Gravity.deflection(.99,2)*180/Math.PI,126.51428075,1e-7);assert.equal(Gravity.deflection(.99,1.5),Infinity);
fresh();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.sail=2;state.itinerary=[{id:'sgr',mode:'flyby'},{id:'m87',mode:'stop'}];assert.ok(Route.analyze().valid);Route.start();var launchPlan=state.flight.wind,coast=(state.flight.distance-launchPlan.distance)/state.flight.maxBeta*Math.sqrt(1-state.flight.maxBeta**2);tickPhysics(launchPlan.proper+coast);if(state.phase!=='flyby'){tickPhysics(1e-6);}assert.equal(state.phase,'flyby');var curve=state.flight.encounter.plan,betaBefore=state.beta,fuelBefore=state.matter,shipBefore=state.proper;tickPhysics(curve.proper*.25);close(state.proper-shipBefore,curve.proper*.25,1e-10);close(state.beta,betaBefore);close(state.matter,fuelBefore);assert.equal(state.acceleration,0);tickPhysics(30000);assert.equal(state.current,'m87');assert.ok(state.visited.includes('sgr'));
console.log('PASS: black-hole-only 3D route, Schwarzschild turn, proper-time flyby and final arrival');
// Old state is rebuilt without changing historical clocks, position or velocity.
fresh();launch();tickPhysics(state.flight.engine.burnProper*.2);var saved=JSON.parse(JSON.stringify(state));saved.version=5;saved.matter=100;var oldV=saved.beta,oldT=saved.earth,oldXYZ=JSON.stringify(saved.ship.p3);state=restore(saved);close(state.beta,oldV);close(state.earth,oldT);assert.equal(JSON.stringify(state.ship.p3),oldXYZ);assert.ok(state.matter<=.001);tickPhysics(.1);assert.ok(state.beta>=oldV);settle();
var home=initial();home.version=5;home.matter=100;state=restore(home);close(state.matter,.0005);
console.log('PASS: migration to kg masses and universal clock without resetting progress');
`);
const html=fs.readFileSync('dist/index.html','utf8');const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]));
for(const [,id]of fs.readFileSync('dist/app.js','utf8').matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(id)||['startExploring','confirmReset','viewGalaxy'].includes(id),'missing '+id);
console.log('PASS: interface IDs and single combined mass strip');
run(`
// Short route truncates the sail before its free-run endpoint, then physically stops.
fresh();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='alpha';state.sail=2;launch();var planned=state.flight.maxBeta,realDistance=state.flight.distance;tickPhysics(.01);assert.equal(state.current,'alpha');close(state.proper,.01,1e-10);close(state.totalDistance,realDistance,1e-9);assert.ok(state.matter<=Rocket.fuelCapacity);
// Zero propellant can still launch from a star, then collect a reserve during braking.
fresh();state.matter=0;state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='sirius';state.sail=2;launch();tickPhysics(1);assert.equal(state.current,'sirius');assert.ok(state.captured>0);assert.ok(state.matter>=0);
`);
console.log('PASS: early sail truncation, short-route clocks, empty-tank stellar launch and capture reserve');
