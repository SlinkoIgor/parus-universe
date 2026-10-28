import vm from 'node:vm';import fs from 'node:fs';import assert from 'node:assert/strict';
let harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`
// Exercise the pre-orbital/save-compatible branch; verify-orbits covers new captures.
OrbitalArrival.enabled=false;
function resetRefinement(){state=initial();state.expansion=false;paused=false;speed=1;Simulation.debt=0;Simulation.wallDebt=0;delete Simulation.smoothedFactor;}
resetRefinement();state.proper=12345.99;state.earth=999999.9;renderUI();assert.ok(!$('shipClock').innerHTML.includes(','));assert.ok(!$('earthClock').innerHTML.includes(','));assert.ok($('shipClock').innerHTML.replace(/[^0-9]/g,'').startsWith('12345'));
assert.equal(SAILS.length,1);assert.equal(SAILS[0].diameterM,100);assert.equal(SAILS[0].collectorDiameterM,1000);assert.ok(Math.abs(SHIP.sailMassKg-.7853981633974483)<1e-12);
const dense=HybridBrake.plan(1,.99,Magnetic.rho(1e6)*SAILS[0].areaM2),thin=HybridBrake.plan(1,.99,Magnetic.rho(1)*SAILS[0].areaM2);assert.ok(thin.proper>dense.proper);
for(const plan of [dense,thin])for(const fraction of [0,.1,.5,.9,1]){const q=Magnetic.sample(plan,fraction);assert.ok(-q.properAcceleration<=100*G0*(1+1e-12));assert.ok(q.mass<=2*(1+1e-12));}assert.ok(dense.finalMass>=1-1e-12);
assert.equal(GasMedium.forLeg(object('sol'),object('cygnus'),0).n,1e6);assert.equal(GasMedium.forLeg(object('sol'),object('local-void'),0).n,1e6);assert.equal(GasMedium.at([0,0,0]).n,1e6);assert.equal(GasMedium.at([100,0,0]).n,1e6);
resetRefinement();state.selected='sgr';launch(true);assert.equal(state.flight.medium.area,SAILS[state.sail].areaM2);const snapshot=JSON.parse(JSON.stringify(state));const migrated=restore({...snapshot,version:8});assert.equal(migrated.beta,snapshot.beta);assert.equal(migrated.proper,snapshot.proper);assert.equal(JSON.stringify(migrated.ship.p3),JSON.stringify(snapshot.ship.p3));assert.equal(migrated.flight.medium.area,SAILS[migrated.sail].areaM2);
Simulation.slowMotionEnabled=true;state=restore(snapshot);tickPhysics(state.flight.engine.burnProper);Simulation.smoothedFactor=.001;const before=Simulation.replayRate();Simulation.advance(.05);const after=Simulation.replayRate();assert.ok(after>before&&after<1,'slow motion must ease out');paused=true;const clock=state.proper;Simulation.advance(2);assert.equal(state.proper,clock);paused=false;
state.beta=.01;state.matter=Rocket.fuelCapacity;beginBrake(true);Simulation.smoothedFactor=.8;Simulation.advance(.01);assert.ok(Simulation.replayRate()<.8&&Simulation.replayRate()>.5,'braking replay must ease in');Simulation.slowMotionEnabled=false;
const bh=object('cygnus'),star=object('hyg-97987'),separation=Space.distance(bh,star)*63241.077;assert.ok(separation>.2&&separation<.3);assert.ok(star.navigable&&!star.atlasOnly);assert.ok(star.catalogDistanceLy<2000);const a=MapLayout.project(bh),b=MapLayout.project(star);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)*63241.077<.3);assert.ok(star.facts.visual.solarV>1000);
resetRefinement();for(let i=0;i<SPEED_TICKS.length;i++){assert.ok(Math.abs(speedScale(SPEED_TICKS[i])-i/(SPEED_TICKS.length-1))<1e-10);}
let previous=-1;for(let i=0;i<=1000;i++){const b=1-10**(-9*i/1000),x=speedScale(b);assert.ok(x>=previous);previous=x;}
state.beta=.99;state.flight={};renderVelocity();renderClockRatio();assert.equal($('timeDilation').textContent,'7,09 лет у неподвижного наблюдателя');assert.ok(Math.abs(clockRate()-Math.sqrt(1-.99**2))<1e-15);assert.ok(Math.abs(parseFloat($('velocityFill').style.width)-200/9)<1e-9);
assert.ok(Magnetic.dustDensity(1e6)>0);assert.ok(Math.abs(Magnetic.dustDensity(1e6)/Magnetic.rho(1e6)-.01)<1e-12);
for(const id of ['system-alpha-centauri','system-antennae','system-cygnus-x1','system-gl501','system-ngc3690','system-ngc7318']){const s=EXTENDED_BOOT.systems.find(s=>s.id===id);assert.ok(s.confirmed&&s.links.length>0,id+' confirmed links must survive conflicting catalog distances');}
for(const s of EXTENDED_BOOT.systems)if(s.associationOnly)assert.equal(s.links.length,0);
`);
console.log('PASS integer clocks, fixed 100 m sail, 1 kg dry mass, same-area gas braking, 100g physical limit, mixed-regime derivatives, density profile, v8 migration, smooth replay equal-interval logarithmic scale, relativistic clock percentages and confirmed system links');
const audit=JSON.parse(fs.readFileSync('data-tools/system-position-audit.json','utf8'));assert.ok(audit.some(q=>q.action==='published-system-distance'));assert.ok(audit.some(q=>q.action==='distance-conflict-no-orbit'));

const search=JSON.parse(fs.readFileSync('dist/catalog-data/search.json','utf8'));
for(const [prefix,distance] of [['opengc-ngc3690',140e6],['opengc-ngc7318',300e6]])for(const suffix of ['a','b']){const id=prefix+suffix,entry=search.find(r=>r[0]===id);assert.ok(entry,id);const row=JSON.parse(fs.readFileSync('dist/catalog-data/'+entry[5],'utf8')).find(r=>r[0]===id);assert.equal(row[3],distance);assert.equal(row[11].atlasOnly,false);}
run(`state.beta=.6;state.phase='flyby';state.flight={encounter:{plan:{rp:2,q:2,beta:.6,proper:1,elapsedProper:0,rows:[{offset:[0,0,0],earth:0,proper:0,path:0,r:4,phi:0,localBeta:.7},{offset:[0,0,0],earth:1,proper:1,path:0,r:4,phi:0,localBeta:.7}]}}};assert.ok(Math.abs(clockRate()-.6)<1e-12);`);
console.log('PASS confirmed interacting galaxies share sourced distances; time display includes Schwarzschild clock factor');

run(`
const classes=['star','pulsar','blackhole','quasar','nebula','galaxy','stellar-cluster','galaxy-cluster','structure','void','horizon'];
for(const o of OBJECTS)assert.equal(classes.filter(c=>ExtendedCatalog.matches(o.kind,c,o)).length,1,o.id+' belongs to exactly one atlas class');
assert.ok(ExtendedCatalog.matches(object('virgo').kind,'galaxy-cluster',object('virgo')));assert.ok(ExtendedCatalog.matches(object('omega').kind,'stellar-cluster',object('omega')));
assert.equal(mapContext({x:1e9,y:1e9,span:5000})[0],'Локальный масштаб');assert.equal(mapContext({x:1e9,y:1e9,span:130000})[0],'Галактический масштаб');
for(const id of ['andromeda','lmc','smc']){const g=object(id).galaxy,p=MapLayout.project(g);assert.ok(mapContext({...p,span:g.diameterLy})[0].includes(g.name));}
assert.ok(mapContext({x:0,y:0,span:5000})[0].includes('Млечный Путь'));
function finishClockLeg(){let n=0;while(state.flight&&n++<100)Simulation.step(1e12);assert.ok(!state.flight);assert.ok(state.earth>=state.proper);}
resetRefinement();state.departureMode='engine';launch();finishClockLeg();assert.equal(state.current,'proxima');const outbound={earth:state.earth,proper:state.proper};assert.ok(outbound.earth>outbound.proper);
state.selected='sol';state.matter=Rocket.initialFuel;const intact=state.destroyed.length;renderUI();assert.equal($('sailSection').hidden,true);assert.equal($('departureSection').hidden,true);assert.equal($('configureFlight').hidden,false);assert.equal($('engineSection').hidden,false);
const returnETA=FlightEstimate.get();assert.ok(returnETA.earth>returnETA.proper);launch();assert.equal(state.flight.boost,false);assert.equal(state.destroyed.length,intact);assert.ok(state.flight.engine);finishClockLeg();assert.equal(state.current,'sol');assert.ok(state.earth>outbound.earth&&state.proper>outbound.proper);assert.ok(state.earth-outbound.earth>state.proper-outbound.proper);
assert.ok(Math.abs((state.earth-outbound.earth)/returnETA.earth-1)<1e-5);assert.ok(Math.abs((state.proper-outbound.proper)/returnETA.proper-1)<1e-5);
state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='alpha';state.departureMode='burst';state.matter=Rocket.initialFuel;const burstETA=FlightEstimate.get();assert.ok(burstETA);launch();assert.ok(state.flight.boost&&state.flight.wind);assert.ok(state.destroyed.includes('proxima'));assert.equal(state.matter,Rocket.initialFuel);
`);
console.log('PASS atlas class partition, galaxy-aware headings, engine departure preserves star, burst choice, outbound/return Earth clocks and ETA');
