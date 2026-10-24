import vm from 'node:vm';import fs from 'node:fs';import assert from 'node:assert/strict';
let harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {context,run};';const {context,run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`
function resetRefinement(){state=initial();paused=false;speed=1;Simulation.debt=0;Simulation.wallDebt=0;delete Simulation.smoothedFactor;}
resetRefinement();state.proper=12345.99;state.earth=999999.9;renderUI();assert.ok(!$('shipClock').innerHTML.includes(','));assert.ok(!$('earthClock').innerHTML.includes(','));assert.ok($('shipClock').innerHTML.replace(/[^0-9]/g,'').startsWith('12345'));
assert.equal(SAILS[0].targetBeta,.99);assert.equal(JSON.stringify(SAILS.map(s=>s.areaM2/1e6)),'[100,5000000,50000000000]');
for(const sail of SAILS){const w=Stellar.plan(1e-6,sail.areaM2,0,Stellar.r0,100,Stellar.pulseYears,sail.targetBeta);assert.ok(Math.abs(w.beta-sail.targetBeta)<2e-15);}
const dense=Magnetic.plan(1e-6,.99,1e6*Magnetic.protonMass*SAILS[0].areaM2),thin=Magnetic.plan(1e-6,.99,Magnetic.protonMass*SAILS[0].areaM2);
assert.ok(thin.proper>dense.proper);const dock=Rocket.retroPlan(dense.finalMass/1000-Rocket.dryMass,dense.finalBeta,1),constantG=Rocket.c/(G0*Rocket.year)*Math.atanh(.99);assert.ok(Math.abs(dense.proper+dock.burnProper-constantG)<1e-9);
for(const plan of [dense,thin])for(const p of [0,.1,.5,.9,1]){const q=Magnetic.sample(plan,p);assert.ok(-q.properAcceleration<=G0*(1+1e-12));assert.ok(q.mass<=2e-6*(1+1e-12));}
const q=Magnetic.sample(thin,.95),r=Magnetic.sample(thin,.9500001);assert.ok(Math.abs((r.beta-q.beta)*Rocket.c/((r.earth-q.earth)*Rocket.year)/q.coordinateAcceleration-1)<1e-3);
assert.equal(GasMedium.forLeg(object('sol'),object('cygnus'),0).n,1e3,'a thin Local Bubble interval must not be skipped on a long leg');assert.equal(GasMedium.at([0,0,0]).n,3e5);assert.equal(GasMedium.at([100,0,0]).n,1e3);assert.equal(GasMedium.at([1e8,0,0]).n,1);
resetRefinement();state.selected='alpha';launch(true);assert.equal(state.flight.medium.area,SAILS[state.sail].areaM2);const snapshot=JSON.parse(JSON.stringify(state));const migrated=restore({...snapshot,version:7});assert.equal(migrated.beta,snapshot.beta);assert.equal(migrated.proper,snapshot.proper);assert.equal(JSON.stringify(migrated.ship.p3),JSON.stringify(snapshot.ship.p3));assert.equal(migrated.flight.medium.area,SAILS[migrated.sail].areaM2);
state=restore(snapshot);tickPhysics(state.flight.engine.burnProper);Simulation.smoothedFactor=.001;const before=Simulation.replayRate();Simulation.advance(.05);const after=Simulation.replayRate();assert.ok(after>before&&after<1,'slow motion must ease out');paused=true;const clock=state.proper;Simulation.advance(2);assert.equal(state.proper,clock);paused=false;
beginBrake(true);Simulation.smoothedFactor=.8;Simulation.advance(.01);assert.ok(Simulation.replayRate()<.8&&Simulation.replayRate()>.5,'braking replay must ease in');
const bh=object('cygnus'),star=object('hyg-97987'),separation=Space.distance(bh,star)*63241.077;assert.ok(separation>.2&&separation<.3);assert.ok(star.navigable&&!star.atlasOnly);assert.ok(star.catalogDistanceLy<2000);const a=MapLayout.project(bh),b=MapLayout.project(star);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)*63241.077<.3);assert.ok(star.facts.visual.solarV>1000);
for(const s of EXTENDED_BOOT.systems)if(s.associationOnly)assert.equal(s.links.length,0);
`);
console.log('PASS integer clocks, rounded sail areas, 99% S, same-area gas braking, 1g analytic limit, mixed-regime derivatives, density profile, v7 migration, smooth replay and Cygnus X-1 physical/display separation');
const audit=JSON.parse(fs.readFileSync('data-tools/system-position-audit.json','utf8'));assert.ok(audit.some(q=>q.action==='published-system-distance'));assert.ok(audit.some(q=>q.action==='distance-conflict-no-orbit'));
