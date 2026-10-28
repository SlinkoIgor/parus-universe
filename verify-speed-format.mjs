import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`
assert.equal(speedNumber(.160004),'16,00');
assert.equal(percentC(.160004),'16,00 % c');
assert.equal(speedNumber(0),'0,00');
assert.equal(speedNumber(.0000001),'0,00');
assert.equal(speedNumber(.98123456),'98,12');
assert.equal(speedNumber(.99123456),'99,1235');
assert.equal(speedNumber(.999999999),'99,9999999');
for(const beta of [0,.0000001,.16,.160004,.99,.99999,.999999999,1-Number.EPSILON]){
 const text=speedNumber(beta);assert.ok(!text.includes('.'));assert.equal(text.split(',').length,2);
 const parsed=Number(text.replace(',','.'));assert.ok(parsed>=0&&parsed<100);if(beta>=.0001)assert.ok(parsed>0);
}
state.beta=.160004;renderVelocity();assert.equal($('velocity').innerHTML,'16,00<small>% c</small>');assert.ok($('velocity').title.includes('км/с'));
console.log('PASS conventional decimal speed formatting, precision near c, units and km/s tooltip');
`);
