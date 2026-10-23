import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const els=new Map();
class Element{constructor(){this.style={};this.dataset={};this.classList={add(){},remove(){},toggle(){}};this.hidden=false;this.value='';this.checked=true;this.children=[];this.open=false;}querySelector(s){return this.child||(this.child=new Element)}querySelectorAll(){return []}setAttribute(){}addEventListener(){}getBoundingClientRect(){return{width:900,height:620,left:0,top:0}}getContext(){return new Proxy({measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{})})}append(e){this.children.push(e)}replaceChildren(){this.children=[]}focus(){}showModal(){this.open=true}close(){this.open=false}}
const el=id=>els.get(id)||(els.set(id,new Element),els.get(id));
const context=vm.createContext({console,performance,Math,JSON,Number,Array,String,Set,Map,Date,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},ResizeObserver:class{observe(){}},document:{documentElement:{dataset:{theme:'dark'}},querySelector:()=>null,getElementById:el,querySelectorAll:()=>[],addEventListener(){},createElement:()=>new Element,hidden:false},window:{devicePixelRatio:1,addEventListener(){},open(){}},localStorage:{getItem(){return null},setItem(){}},assert});


vm.runInContext(['dist/catalog.js','dist/astronomy.js','dist/catalog-import.js','dist/coordinates.js','dist/physics.js','dist/flyby.js','dist/navigation.js','dist/app.js'].map(p=>fs.readFileSync(p,'utf8')).join('\n'),context);
const run=s=>vm.runInContext(s,context);
run(`function close(a,b,tol=1e-9){assert.ok(Math.abs(a-b)<tol,a+' ≈ '+b)}
function rel(a,b,tol=1e-7){close(a/b,1,tol)}
function settle(){let ticks=0;while(state.flight&&ticks<30000){tickPhysics(1/60);ticks++;assert.ok(state.matter>=0);assert.ok(state.beta>=0&&state.beta<1);assert.ok(state.proper<=state.earth+1e-6)}assert.ok(ticks<30000,'flight must terminate');assert.equal(state.beta,0);return ticks;}
close(Rocket.beta(2,1),.6);var leg=Rocket.segment(1001,1001,901);assert.ok(leg.earth>leg.proper);rel(leg.energy,Rocket.energy(100),1e-12);
var retro=Rocket.retroPlan(1000,.5),r=Rocket.retroSegment(retro.m0,retro.eta0,retro.m0,retro.mf);assert.equal(r.beta,0);assert.ok(r.distance>0);assert.ok(retro.canStop);assert.ok(r.earth>r.proper);
for(const beta of [1e-9,.01,.5,.9,.99,.9999])rel(Stellar.betaFromH(Stellar.H(beta)),beta,1e-9);
var f1=Stellar.force(1e10,Stellar.r0,.4),f2=Stellar.force(1e10,2*Stellar.r0,.4);rel(f1/f2,4,1e-12);assert.ok(Stellar.force(1e10,Stellar.r0,.9)<Stellar.force(1e10,Stellar.r0,.5));
var sw=Stellar.plan(1001000,1e10);assert.ok(sw.beta>.95&&sw.beta<.96);close(Stellar.sample(sw,0).beta,0);assert.ok(Stellar.sample(sw,.1).beta<Stellar.sample(sw,.5).beta);assert.ok(Stellar.sample(sw,.5).beta<sw.beta);assert.ok(Stellar.plan(2002000,1e10).beta<sw.beta);assert.ok(Stellar.plan(1001000,4e10).beta>sw.beta);
var ps=Stellar.plan(1001000,2.5e9);close(ps.earth-ps.distance,Stellar.pulseYears,1e-10);
var wa=Stellar.sample(sw,.4),wb=Stellar.sample(sw,.40001),q1=wa.beta/Math.sqrt(1-wa.beta**2),q2=wb.beta/Math.sqrt(1-wb.beta**2);rel((q2-q1)*sw.massKg*Rocket.c/((wb.earth-wa.earth)*Rocket.year),wa.force,2e-4);
`);
console.log('PASS: photon engine and reverse thrust; inverse-square stellar force, relativistic Doppler factor, pulse duration, area/mass dependence, force-integrated trajectory');
run(`var m=Magnetic.plan(1e6,.99),ma=Magnetic.sample(m,.2),mb=Magnetic.sample(m,.20001);rel(ma.mass*Magnetic.half(ma.beta),m.K,1e-12);rel(ma.mass-m.massKg,m.k*ma.distance*LY,1e-10);assert.ok(ma.earth>=ma.proper);assert.ok(ma.heat>0);rel((mb.beta-ma.beta)*Rocket.c/((mb.earth-ma.earth)*Rocket.year),ma.coordinateAcceleration,1e-4);rel((mb.mass-ma.mass)/((mb.earth-ma.earth)*Rocket.year),ma.massRate,1e-4);rel((mb.heat-ma.heat)/((mb.proper-ma.proper)*Rocket.year),ma.heatPower,2e-4);
var low=Magnetic.rates(1e6,.0001),twice=Magnetic.rates(1e6,.0002);rel(twice.massRate/low.massRate,2,1e-12);rel(twice.force/low.force,4,1e-6);assert.equal(Magnetic.rates(1e6,.5,0).force,0);assert.equal(Magnetic.rates(1e6,0).force,0);assert.equal(Magnetic.rates(1e6,0).massRate,0);close(Magnetic.sample(m,1).beta,Magnetic.fineBeta);assert.ok(m.finalMass>m.massKg);assert.ok(Magnetic.stopping(999,.99).distance>Magnetic.stopping(999,.5).distance);
var empty=Magnetic.plan(1000,.005);assert.ok(empty.finalMass>1000);assert.ok(Rocket.retroPlan(empty.finalMass/1000-1,empty.finalBeta).canStop);
`);
console.log('PASS: capture flux, relativistic drag ODE, accumulated mass, heat balance, low-speed v² law, empty plasma, final engine reserve');
run(`state=initial();renderUI();assert.ok(document.getElementById('sailSection').hidden);launch();assert.equal(state.matter,1000);tickPhysics(1);assert.ok(state.matter<1000&&state.matter>900);assert.ok(state.acceleration>Rocket.acceleration(1001));for(let i=0;i<360;i++)tickPhysics(1/60);assert.equal(state.phase,'cruise');close(state.matter,900,1e-7);close(state.beta,Rocket.beta(1001,901),1e-10);var route=state.flight.distance;settle();assert.equal(state.current,'proxima');close(state.totalDistance,route,1e-8);assert.ok(state.captured>0);assert.ok(state.heatRadiated>0);assert.ok(state.spentEnergy>Rocket.energy(100));assert.ok(canBoost());select('sirius');assert.equal(document.getElementById('sailSection').hidden,false);`);
console.log('PASS: gradual engine acceleration, physical capture + reverse-thrust stop, no arrival teleport, contextual sail UI');
for(const sail of [0,1,2])run(`state=initial();state.current='proxima';state.ship={x:object('proxima').x,y:object('proxima').y};state.selected='sirius';state.sail=${sail};launch();assert.equal(state.beta,0);var forecast=state.flight.maxBeta;tickPhysics(1/60);assert.ok(state.beta>0&&state.beta<.01);for(let i=0;i<500;i++)tickPhysics(1/60);close(state.beta,forecast,1e-10);assert.equal(state.phase,'cruise');var dist=state.flight.distance;settle();assert.equal(state.current,'sirius');close(state.totalDistance,dist,1e-8);assert.ok(state.destroyed.includes('proxima'));assert.ok(state.captured>1000);`);
console.log('PASS: all sail sizes accelerate continuously to computed forecasts, then capture and retro-engine docking');
run(`state=initial();launch();for(let i=0;i<120;i++)tickPhysics(1/60);var fuel=state.matter,v=state.beta;cutEngine();for(let i=0;i<50;i++)tickPhysics(1/60);close(state.matter,fuel);close(state.beta,v);toggleBrake();settle();assert.equal(state.current,null);assert.ok(distance(state.ship,object('proxima'))>1);launch();settle();assert.equal(state.current,'proxima');
state=initial();state.current='proxima';state.ship={...object('proxima')};state.selected='sirius';launch();for(let i=0;i<180;i++)tickPhysics(1/60);v=state.beta;cutEngine();tickPhysics(1);close(state.beta,v);assert.equal(state.phase,'cruise');`);
console.log('PASS: manual engine cutoff, folding the stellar sail, early capture stop, recovery');
run(`state=initial();state.auto=false;launch();for(let i=0;i<2300;i++)tickPhysics(1/60);assert.ok(state.flight.missed);toggleBrake();settle();assert.equal(state.current,null);state.auto=true;launch();settle();assert.equal(state.current,'proxima');`);
console.log('PASS: overshoot and physical stop beyond target, no forced snap, return voyage');
run(`state=initial();state.current='proxima';state.ship={...object('proxima')};state.selected='3c273';state.sail=2;launch();settle();assert.equal(state.current,'3c273');assert.ok(state.earth>2e9);assert.ok(Number.isFinite(state.proper));state.selected='horizon';launch();assert.equal(state.flight,null);
state=initial();state.matter=0;launch();assert.equal(state.flight,null);state.current='proxima';state.ship={...object('proxima')};state.selected='sirius';launch();settle();assert.equal(state.current,'sirius');
var saved=initial();saved.version=2;saved.current=null;saved.beta=.95;saved.phase='brake';saved.flight={from:{x:0,y:0},target:'proxima',distance:4.24,covered:1,rate:1,maxBeta:.95,boost:true};state=restore(saved);close(state.beta,.95);assert.equal(state.version,4);assert.ok(state.flight.magnetic);settle();assert.equal(state.current,null);
`);
console.log('PASS: cosmic-scale trip, unreachable horizon, no fuel, dry-ship wind launch, continuous migration of old velocity');
const html=fs.readFileSync('dist/index.html','utf8');const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]));for(const [,id]of fs.readFileSync('dist/app.js','utf8').matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(id)||['startExploring','confirmReset','viewGalaxy','addRoutePoint','startRoute','cancelRoute','routeTheory','projectionInfo'].includes(id),'missing '+id);assert.ok(!/<header|<footer|class="rail"/.test(html));
console.log('PASS: game controls match DOM, no site chrome');

run(`function snapshotAt(dt){state=initial();state.current='proxima';state.ship={...object('proxima')};state.selected='sirius';state.sail=2;launch();var ticks=0;while(state.flight&&ticks++<40000)tickPhysics(dt);assert.equal(state.current,'sirius');return [state.earth,state.proper,state.matter,state.captured,state.totalDistance];}var one=snapshotAt(.05),two=snapshotAt(.005);for(var i=0;i<one.length;i++)rel(one[i],two[i],1e-7);
state=initial();state.current='proxima';state.ship=Space.point([object('alpha').p3[0]-1e-5,object('alpha').p3[1],object('alpha').p3[2]]);state.selected='alpha';state.sail=2;launch();var full=state.flight.maxBeta;settle();assert.equal(state.current,'alpha');close(state.totalDistance,1e-5,1e-9);`);
console.log('PASS: timestep independence, early truncation of wind on a short route, physical arrival');

run(`
state=initial();state.beta=.99;state.acceleration=9.80665;renderUI();assert.equal($('velocity').innerHTML,'99,00<small>% c</small>');assert.equal($('acceleration').innerHTML,'1,00<small>g</small>');assert.equal($('dryMass').innerHTML,'1<small>т</small>');
state.acceleration=-9.80665;renderUI();assert.equal($('acceleration').innerHTML,'−1,00<small>g</small>'.replace('−','-'));assert.ok($('matter').innerHTML.includes('000'));
assert.equal(theme,'dark');assert.equal(paint('#f8f8f8'),'#000000');applyTheme('light');assert.equal(paint('#252525'),'#252525');applyTheme('dark');assert.equal(document.documentElement.dataset.theme,'dark');
assert.equal(GALAXIES.length,90);assert.equal(GALAXIES[0].name,'Млечный Путь');
for(const o of OBJECTS){assert.ok(o.facts?.mass,o.id);assert.ok(o.facts.lum!==undefined||o.facts.visual||o.facts.lumUnknown,o.id);state.flight=null;state.selected=o.id;showObject();assert.ok($('dialogContent').innerHTML.includes('Светимость'));}
for(const g of GALAXIES){assert.ok(g.diameterLy>1000);assert.ok(g.axisRatio>0&&g.axisRatio<=1);cam={x:g.x,y:g.y,span:g.diameterLy*3};width=900;height=620;close(galaxyProjection(g).r,150);drawGalaxyBackground();cam.span*=2;close(galaxyProjection(g).r,75);}
rel(object('andromeda').galaxy.diameterLy,145143,1e-4);rel(object('smc').galaxy.diameterLy,9200,0.001);assert.ok(object('m87').galaxy.shape==='elliptical');
assert.ok(Astro.visualLuminosity(32.6156,4.83).solarV===1);
` .replace(/^\+/gm,''));
assert.ok(html.indexOf('id="shipClock"')<html.indexOf('id="earthClock"'));
console.log('PASS: g and %c telemetry, separate masses, ship/Earth order, theme toggle, every object has facts, all catalog galaxies scale linearly');

run(`
assert.ok(OBJECTS.length>=420);assert.ok(OBJECTS.filter(o=>o.catalog==='HYG 4.1').length>=400);assert.equal(OBJECTS.filter(o=>o.catalog==='OpenNGC').length,80);assert.ok(OBJECTS.filter(o=>o.catalog?.startsWith('ATNF')).length>=18);
rel(V3.norm(Space.fromSky(35,-63,10)),10,1e-12);close(distance(Space.point([0,0,0]),Space.point([0,0,10])),10);close(V3.angle([1,0,0],[0,0,1]),Math.PI/2);
rel(Gravity.deflection(.99,695700000/Gravity.rs(1))*180/Math.PI,.000491397,1e-6);rel(Gravity.deflection(.99,10)*180/Math.PI,12.84017946,1e-8);rel(Gravity.deflection(.99,2)*180/Math.PI,126.51428075,1e-8);close(Gravity.critical(.99),1.503353811,1e-8);
assert.equal(Gravity.deflection(.99,1.5),Infinity);assert.equal(Gravity.solve({massSolar:1,radiusMeters:695700000},.99,Math.PI/2).ok,false);
var weak=Gravity.deflection(.01,1e8),newton=2*Math.asin(1/(1+2*1e8*.01**2));rel(weak,newton,0.001);
var body=object('sgr'),solution=Gravity.solve(body.gravity,.99,Math.PI/2);assert.ok(solution.q>Gravity.critical(.99));close(Gravity.deflection(.99,solution.q),Math.PI/2,1e-10);var curve=Gravity.trajectory(body.gravity,.99,solution,[1,0,0],[0,1,0],1e30);assert.ok(curve.earth>curve.proper);close(curve.rows[0].earth,0);close(curve.rows.at(-1).earth,curve.earth);assert.equal(curve.rows[220].r,curve.rp);var vIn=V3.unit(V3.sub(curve.rows[1].offset,curve.rows[0].offset)),vOut=V3.unit(V3.sub(curve.rows.at(-1).offset,curve.rows.at(-2).offset));assert.ok(V3.angle(vIn,[1,0,0])<.002);assert.ok(V3.angle(vOut,[0,1,0])<.002);
state=initial();state.itinerary=[{id:'proxima',mode:'flyby'},{id:'sirius',mode:'stop'}];assert.equal(Route.analyze().valid,false);assert.match(Route.analyze().records[0].issue,/только у чёрной дыры/);
state.itinerary=[{id:'sgr',mode:'flyby'},{id:'m87',mode:'stop'}];assert.equal(Route.analyze().valid,true);Route.start();assert.equal(Route.isFlyby(),true);assert.ok(state.flight.aim?.p3);var sawCurve=false,flyFuel,flyBeta,ticks=0;while(state.flight&&ticks++<30000){var beforePhase=state.phase;tickPhysics(1/60);if(state.phase==='flyby'){if(!sawCurve){sawCurve=true;flyFuel=state.matter;flyBeta=state.beta;var first=V3.add(object('sgr').p3,state.flight.encounter.plan.rows[0].offset);assert.ok(V3.norm(V3.sub(first,state.ship.p3))<1e-8);}close(state.matter,flyFuel,1e-8);close(state.beta,flyBeta);assert.equal(state.acceleration,0);}assert.ok(state.proper<=state.earth);}assert.ok(sawCurve);assert.ok(ticks<30000);assert.equal(state.current,'m87');assert.equal(state.beta,0);assert.ok(state.visited.includes('sgr'));assert.ok(!state.destroyed.includes('sgr'));
state=initial();state.itinerary=[{id:'proxima',mode:'stop'},{id:'sirius',mode:'stop'}];Route.start();settle();assert.equal(state.current,'sirius');assert.ok(state.visited.includes('proxima'));assert.ok(state.destroyed.includes('proxima'));
state=initial();state.itinerary=[{id:'sgr',mode:'flyby'},{id:'m87',mode:'stop'}];Route.start();tickPhysics(1);cutEngine();assert.equal(state.flight.route,null);assert.equal(state.flight.aim,null);assert.equal(state.phase,'cruise');settle();assert.equal(state.current,'sgr');
state=initial();state.selected='ring';launch();assert.equal(state.flight,null);assert.equal(object('ring').navigable,false);
` .replace(/^\+/gm,''));
console.log('PASS: catalog '+run('OBJECTS.length')+' real objects, 3D geometry, Schwarzschild scattering/capture/weak-field limits, geodesic clocks and 0g, impossible route rejection, continuous flyby + final docking, multistop and manual override');

run(`
assert.deepEqual(OBJECTS.filter(o=>Gravity.canFlyby(o)).map(o=>o.id),['cygnus','sgr','m87']);
for(const id of ['sol','proxima','vela','crab','andromeda']){var o=object(id);if(!o)continue;assert.equal(Gravity.canFlyby(o),false);assert.equal(Gravity.encounter(object('sol'),o,object('sirius'),.99).ok,false);}
state=initial();state.itinerary=[{id:'proxima',mode:'flyby'},{id:'sirius',mode:'stop'}];Route.show();assert.ok($('dialogContent').innerHTML.includes('data-mode="0" disabled'));assert.equal(Route.analyze().valid,false);
state.itinerary=[{id:'sgr',mode:'flyby'},{id:'m87',mode:'stop'}];Route.show();assert.ok(!$('dialogContent').innerHTML.includes('data-mode="0" disabled'));
var small=Gravity.solve(object('cygnus').gravity,.99,Math.PI/2),large=Gravity.solve(object('m87').gravity,.99,Math.PI/2);close(small.q,large.q);rel(large.rp/small.rp,6.5e9/21.2,1e-12);
var smallCurve=Gravity.trajectory(object('cygnus').gravity,.99,small,[1,0,0],[0,1,0],Infinity),largeCurve=Gravity.trajectory(object('m87').gravity,.99,large,[1,0,0],[0,1,0],Infinity);rel(largeCurve.earth/smallCurve.earth,6.5e9/21.2,1e-12);
state=initial();state.current='m87';assert.equal(canBoost(),false);state.current='proxima';assert.equal(canBoost(),true);
state=initial();launch();state.beta=.01;state.phase='flyby';state.ship=Space.mix(object('sol'),object('proxima'),.25);state.flight.covered=state.flight.distance*.25;state.flight.route=[{id:'proxima',mode:'flyby'},{id:'sirius',mode:'stop'}];state.flight.legIndex=0;state.flight.aim=Space.point([1,2,3]);state.flight.encounter={legacy:true};state.itinerary=[{id:'vela',mode:'flyby'},{id:'sgr',mode:'flyby'},{id:'m87',mode:'stop'}];var saved=JSON.parse(JSON.stringify(state)),previousPosition=[...state.ship.p3];state=restore(saved);assert.equal(state.phase,'cruise');close(state.beta,.01);state.ship.p3.forEach((x,i)=>close(x,previousPosition[i]));assert.equal(state.flight.route[0].mode,'stop');assert.equal(state.flight.aim,null);assert.equal(state.flight.encounter,null);assert.equal(state.itinerary[0].mode,'stop');assert.equal(state.itinerary[1].mode,'flyby');assert.equal(Route.braking(),true);
state=initial();state.itinerary=[{id:'proxima',mode:'stop'},{id:'sirius',mode:'stop'}];var forecast=Route.analyze().records[1].beta;Route.start();var gotWind=false;while(state.flight&&!gotWind){tickPhysics(1/60);if(state.flight?.legIndex===1){assert.equal(state.phase,'launch');close(state.flight.maxBeta,forecast,1e-9);gotWind=true;}}assert.ok(gotWind);settle();assert.equal(state.current,'sirius');assert.ok(state.destroyed.includes('proxima'));
`);
console.log('PASS: black-hole-only flybys, stellar sail route restart and forecast, supermassive mass scaling, old route migration without position/velocity jump');
