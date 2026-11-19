import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const ctx=vm.createContext({console,assert});vm.runInContext(fs.readFileSync('dist/physics.js','utf8'),ctx);
vm.runInContext(`const star={id:'solar-test',bolometricLuminositySolar:1,radiusSolar:1},normal=Stellar.sourcePlan(star,'beam',2,100),burst=Stellar.sourcePlan(star,'burst',2,100);
assert.equal(normal.continuous,true);assert.ok(normal.rows.at(-1).source>Stellar.pulseYears);assert.ok(burst.rows.at(-1).source<=Stellar.pulseYears);assert.ok(burst.beamPower>normal.beamPower*1e6);
assert.ok(Math.abs(normal.beamPower/1069057642.0100914-1)<1e-12);
for(const plan of [normal,burst])for(const phase of [0,.1,.5,.9,1]){const q=Stellar.sample(plan,phase);assert.ok(q.force/plan.massKg<=100*9.80665*(1+1e-12));assert.ok(q.opening>=0&&q.opening<=1);}
assert.ok(Math.abs(Stellar.beamForce(1e12,.99)/Stellar.beamForce(1e12,0)-1/199)<1e-15);
const weak=Stellar.sourcePlan({spectral:'M5V'},'beam',2,100);assert.ok(weak.luminosityEstimated);assert.ok(weak.beamPower<normal.beamPower);
` ,ctx);console.log('PASS fixed 1 km collector, ordinary/fallback stellar luminosity, unlimited source, finite flash, deployment and Doppler force');
