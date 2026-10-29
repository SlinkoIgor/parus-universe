import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`{
state=initial();Cosmology.sync(state);resize();
const saved={beginPath:ctx.beginPath,moveTo:ctx.moveTo,lineTo:ctx.lineTo,stroke:ctx.stroke};let points=[],strokes=[];
ctx.beginPath=()=>{points=[]};ctx.moveTo=(x,y)=>points.push({x,y,move:true});ctx.lineTo=(x,y)=>points.push({x,y});ctx.stroke=()=>strokes.push({color:ctx.strokeStyle,points:[...points]});
for(const w of [390,701,924,1280,1920])for(const span of [.00006,24,130000,3e7,5e9,1.15e11]){
 width=w;height=620;cam={x:span*.193,y:-span*.123,span};strokes=[];updateZoomControl();drawGrid();
 const major=strokes.find(q=>q.color===paint('#dddddd')),minor=strokes.find(q=>q.color===paint('#e8e8e8'));
 const xs=major.points.filter((q,i)=>q.move&&major.points[i+1]?.x===q.x).map(q=>q.x),small=minor.points.filter((q,i)=>q.move&&minor.points[i+1]?.x===q.x).map(q=>q.x);
 assert.ok(xs.length>=2&&small.length>=2);const step=xs[1]-xs[0],substep=small[1]-small[0],ruler=parseFloat($('mapScaleLine').style.width);
 assert.ok(Math.abs(step-ruler)<1e-7,'ruler must match the drawn major grid spacing');assert.ok(Math.abs(step/substep-5)<1e-9);assert.ok(Math.abs(step*span/w-gridUnit())<gridUnit()*1e-12);
}
Object.assign(ctx,saved);resize();
let previous=-1;for(const ratio of [1,1.25,2,10,100,1000,1e5,1e8]){const x=dilationScale(ratio);assert.ok(x>=previous&&x>=0&&x<=1);previous=x;}assert.equal(dilationScale(1),0);assert.equal(dilationScale(1e4),.5);assert.equal(dilationScale(1e10),1);
for(const [beta,gamma] of [[0,1],[.6,1.25],[.8,5/3],[.99,1/Math.sqrt(.0199)],[1-Number.EPSILON,1/Math.sqrt(2*Number.EPSILON-Number.EPSILON**2)]]){
 state=initial();state.flight={};state.phase='cruise';state.beta=beta;renderClockRatio();assert.ok(Math.abs(1/clockRate()-gamma)<gamma*1e-12);assert.ok(Math.abs(parseFloat($('dilationFill').style.width)-Math.log10(gamma)/8*100)<1e-9);
}
state=initial();state.orbit={};state.beta=.6;assert.ok(Math.abs(clockRate()-.8)<1e-14);state.orbit=null;assert.equal(clockRate(),1);
const at=Gravity.atProper;Gravity.atProper=()=>({r:2});state.flight={encounter:{plan:{rp:1,q:2,beta:.6,elapsedProper:0}}};state.phase='flyby';assert.ok(Math.abs(1/clockRate()-5/3)<1e-14);renderClockRatio();Gravity.atProper=at;
console.log('PASS ruler equals actual drawn major grid at every tested scale/width, five subdivisions, logarithmic time dilation, cruise/idle-orbit/flyby ratios');
}`);
const html=fs.readFileSync('dist/index.html','utf8');assertOrder(html);
function assertOrder(s){const ship=s.indexOf('id="shipClock"'),earth=s.indexOf('id="earthClock"'),universe=s.indexOf('id="universeClock"');if(!(ship<earth&&earth<universe))throw Error('clock order');if(s.includes('class="age-formula"')||s.includes('id="universeElapsed"'))throw Error('age formula still visible');}
