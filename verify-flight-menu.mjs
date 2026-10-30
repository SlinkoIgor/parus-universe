import fs from 'node:fs';
const h=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';const {run}=await import('data:text/javascript,'+encodeURIComponent(h));
run(`{
OrbitalArrival.enabled=true;
const menuReset=(setup)=>{state=initial();state.expansion=false;state.matter=.0005;state.flightSetup=FlightSetup.normalize(setup);};
menuReset({engine:true,sail:true,collector:false,arrivalFuelPercent:0});
const longTail=MissionPlanner.preview();assert.ok(longTail.valid,longTail.reason);assert.ok(longTail.accelerationEnd.proper>1);
const plot=FlightBuilder.routeSamples(longTail,FlightBuilder.routeStages(longTail));
const early=plot[0].find(q=>q.beta>=longTail.peakBeta*.95);assert.ok(early.distance/longTail.accelerationEnd.distance<.01,'95% of speed is reached in the first 1% of the long optical tail distance');
assert.ok(plot[0].filter(q=>q.beta>longTail.peakBeta*.99).length>3,'show the nearly flat remaining acceleration rather than a smoothed rise');
function nearPath(point,points){let error=Infinity;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,f=den?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/den)):0;error=Math.min(error,Math.hypot(point.x-a.x-f*dx,point.y-a.y-f*dy));}return error;}
const cases=[longTail];
for(const setup of [{engine:true,sail:true,collector:true,arrivalFuelPercent:50},{sail:true,collector:true,arrivalFuelPercent:50}]){menuReset(setup);cases.push(MissionPlanner.preview());}
menuReset({sail:true,collector:true,burst:true,arrivalFuelPercent:50});state.current='alpha';state.ship=Space.point(object('alpha').p3);state.selected='boss-wall';state.expansion=true;cases.push(MissionPlanner.preview());
for(const p of cases){
 assert.ok(p.valid,p.reason);const stages=FlightBuilder.routeStages(p),samples=FlightBuilder.routeSamples(p,stages),total=stages.reduce((n,s)=>n+s.distance,0),peak=Math.max(...samples.flat().map(q=>q.beta));assert.equal(FlightBuilder.routeSamples(p,stages),samples,'redrawing a fixed plan reuses the sampled curve');
 for(let stage=0;stage<3;stage++){
  const rows=samples[stage];if(!rows.length)continue;
  assert.ok(rows.every((q,i)=>Number.isFinite(q.beta)&&q.beta>=0&&q.beta<1&&q.distance>=0&&q.distance<=stages[stage].distance*(1+1e-10)&&(!i||q.distance>=rows[i-1].distance-1e-12)));
  const curve=rows.map(q=>({x:392*q.distance/total,y:65*q.beta/peak}));
  for(let k=1;k<60;k++){const q=MissionPlanner.stageSample(p,stage,stages[stage].proper*k/60),point={x:392*q.distance/total,y:65*q.beta/peak};assert.ok(nearPath(point,curve)<.3,'physical sample must lie on the drawn polyline within 0.3 SVG px: stage '+stage);}
 }
 FlightBuilder.drawRoute(p,true,p,null);const html=$('builderRouteDiagram').innerHTML;assert.ok(html.includes('data-sampled="true"'));assert.ok(!/class="diagram-(?:accel|brake)"[^>]*d="[^"]*C/.test(html),'never substitute a decorative Bezier for a trajectory');assert.ok(!html.includes('NaN'));
 const label=Number(html.match(/class="route-peak" data-beta="([^"]+)"/)[1]);assert.equal(label,peak,'label the actual peak including the arrival trajectory');
}
console.log('PASS actual speed/distance curves: immediate engine rise plus optical tail, coast redshift, orbital braking, exact peak, cached samples and independent point-to-polyline checks');
const synthetic={valid:true,peakBeta:.3,accelerationEnd:{proper:2,distance:1},coast:{proper:1e-7,distance:1e-8},brake:{proper:3,distance:4},proper:5.0000001};FlightBuilder.drawRoute(synthetic,true,synthetic,null);assert.ok(!$('builderRouteDiagram').innerHTML.includes('Свободный полёт'));assert.ok(!$('builderRouteDiagram').innerHTML.includes('data-stage="1"'));
assert.equal(FlightBuilder.visibleRouteStage({index:1,proper:.1,distance:1e-8},5,5,true),true,'retain a coast meaningful in time even if short in distance');
assert.equal(FlightBuilder.visibleRouteStage({index:1,proper:1e-8,distance:.1},5,5,true),true,'retain a coast meaningful in distance even if short onboard');
menuReset({engine:true,sail:true,collector:true,arrivalFuelPercent:50});FlightBuilder.open();assert.equal($('builderStartFuel').textContent,'50%');assert.equal($('builderFuel').textContent,'50%');assert.equal($('builderFuelMobile').textContent,'50%');assert.equal($('builderWarning').textContent,'');assert.equal($('builderStatus').hidden,true);assert.equal($('builderThrust').textContent,'10 g');assert.equal($('builderAccelerationNote').hidden,false);
menuReset({sail:true,collector:true,collectorDiameterM:1000,collectorMinAu:1,arrivalFuelPercent:50});FlightBuilder.open();assert.equal($('builderAccelerationNote').hidden,true);assert.ok(parseFloat($('builderThrust').textContent.replace(',','.'))<1);
menuReset({sail:true,collector:true,burst:true,arrivalFuelPercent:50});state.current='alpha';state.ship=Space.point(object('alpha').p3);state.selected='boss-wall';state.expansion=true;FlightBuilder.open();assert.equal($('builderWarning').textContent,'');assert.equal($('builderStatus').hidden,true);
console.log('PASS grouped forecast values, integer fuel percentages, no success/destruction messages and computed maximum acceleration with a conditional 10g note');
const star=object('hyg-113687'),mass=MapDetails.massInfo(star);assert.equal(mass.solar,.495);assert.equal(mass.uncertainty,.049);assert.ok(mass.source.includes('202554984'));assert.equal(star.bolometricLuminositySolar,.0368);assert.ok(star.facts.mass.includes('0,495'));assert.ok(star.facts.refs.some(r=>r[0]===mass.source));assert.ok(OrbitalArrival.target(star));
state=initial();state.current=star.id;state.ship=Space.point(star.p3);state.selected='alpha';state=restore(JSON.parse(JSON.stringify(state)));FlightBuilder.open();assert.ok(!$('builderGravity').textContent.includes('Нет данных'));assert.ok($('builderGravityNote').textContent.includes('Учтено'));assert.equal($('setupStarMass').value,.495);
const c=FlightSetup.normalize({sail:true,collector:true}),unknown={id:'unknown-mass-test',kind:'star',spectral:'G2V',bolometricLuminositySolar:1,radiusSolar:1,facts:{mass:'Масса неизвестна'}},zero=MissionPlanner.acceleration({...c,massSolar:0},unknown,1,1,0,false,false),omitted=MissionPlanner.acceleration(c,unknown,1,1,0,false,false),known=MissionPlanner.acceleration(c,{...unknown,massSolar:1},1,1,0,false,false);
assert.equal(MapDetails.mass(unknown),null);assert.equal(zero.rows[0].slopes[4],omitted.rows[0].slopes[4]);assert.ok(known.rows[0].slopes[4]<omitted.rows[0].slopes[4],'a known mass really opposes launch');FlightBuilder.source=unknown;FlightBuilder.light=Stellar.stellarLight(unknown);FlightBuilder.starAvailable=true;FlightBuilder.explain(c,null);assert.match($('builderGravityNote').textContent,/притяжение при разгоне не учитывается/);
console.log('PASS GJ887/Lacaille9352 literature parameters, uncertainty/source, orbit and reload; unknown masses remain explicit omissions rather than invented estimates');
}`);
const html=fs.readFileSync('dist/index.html','utf8');
for(const heading of ['Длительность полёта','Запас топлива'])if(!html.includes('>'+heading+'</h3>'))throw Error('Missing grouped heading '+heading);
if(html.includes('<span>Доступное ускорение</span>'))throw Error('Old acceleration label');
