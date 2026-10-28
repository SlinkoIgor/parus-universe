import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`
state=initial();paused=true;speed=100;Simulation.debt=0;Simulation.wallDebt=0;
for(const rate of [1,10,100,1000]){
 setTimeRate(rate);assert.equal(speed,rate);assert.equal(paused,false);assert.equal($('timeSlider').value,String(TIME_RATES.indexOf(rate)));
 const start=state.proper;Simulation.advance(.1);assert.ok(Math.abs(state.proper-start-rate*.1)<1e-8);
 setTimeRate(0);assert.equal(paused,true);assert.equal(speed,rate);assert.equal($('timeSlider').value,'0');
 const stopped=state.proper;Simulation.advance(10);assert.equal(state.proper,stopped);assert.equal(state.paused,true);assert.equal(state.timeScale,rate);
}
const saved=JSON.parse(JSON.stringify(state));state=restore(saved);paused=!!state.paused;speed=state.timeScale;updateTimeControl();assert.equal(paused,true);assert.equal(speed,1000);assert.equal($('timeSlider').value,'0');
setTimeRate(10);assert.equal(paused,false);assert.equal(speed,10);assert.equal($('timeSlider').value,'2');
setTimeRate(123);assert.equal(speed,10);assert.equal(paused,false);
setTimeRate(0);assert.equal(paused,true);assert.equal(speed,10);
assert.equal(Simulation.slowMotionEnabled,false);
console.log('PASS time rail: 0 pauses, positive rates resume, clocks follow selected tempo, previous rate persists and invalid rates are ignored');
`);
