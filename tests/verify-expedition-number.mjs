import fs from 'node:fs';
const harness = fs.readFileSync('tests/verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {run,context};';
const {run} = await import('data:text/javascript,' + encodeURIComponent(harness) + '#expedition-number');
run(`
state=initial();assert.equal(state.expedition,1);
updateMapHeading();assert.equal($('expeditionNumber').textContent,'01');
for(const n of [2,3]){$('resetBtn').onclick();$('confirmReset').onclick();assert.equal(state.expedition,n,'each new expedition advances the counter');updateMapHeading();assert.equal($('expeditionNumber').textContent,'0'+n);}
assert.equal(restore(JSON.parse(JSON.stringify(state))).expedition,3,'save/reload keeps the counter');
const old=JSON.parse(JSON.stringify(state));delete old.expedition;assert.equal(restore(old).expedition,1,'saves without a counter start at 01');
old.expedition='x';assert.equal(restore(old).expedition,1);
state.expedition=12;updateMapHeading();assert.equal($('expeditionNumber').textContent,'12');
console.log('PASS expedition number starts at 01, advances on every new expedition, survives save/reload and is shown in the map heading');
`);
