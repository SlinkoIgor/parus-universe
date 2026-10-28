import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`
// Exercise the pre-orbital/save-compatible branch; verify-orbits covers new captures.
OrbitalArrival.enabled=false;
function plannerReset(){state=initial();state.expansion=false;state.current='hyg-113008';state.ship=Space.point(object(state.current).p3);state.selected='hyg-69451';paused=false;Simulation.debt=0;Simulation.wallDebt=0;Cosmology.sync(state);}
function nearPlanner(a,b,tol=2e-7){assert.ok(Math.abs(a-b)<=tol*Math.max(1e-8,Math.abs(a),Math.abs(b)),a+' != '+b);}
plannerReset();
for(const beta of [.0001,.01,.2,.9,.9999999])for(const n of [.01,1,10000])for(const mass of [1.01,2,5]){
 const k=Magnetic.rho(n*1e6)*SHIP.sailAreaM2,p=ReleasingBrake.plan(mass,beta,k);
 assert.ok(p&&p.proper>0&&p.earth>=p.proper);assert.ok(p.finalMass>=1-1e-10&&p.finalMass<=mass);
 let previous=null;
 for(const fraction of [0,.01,.2,.5,.9,.999,1]){const q=ReleasingBrake.sampleProper(p,p.proper*fraction);assert.equal(q.captured,0);assert.ok(q.mass>=1-1e-9&&q.mass<=mass+1e-9);assert.ok(Math.abs(q.properAcceleration)<=100*G0*(1+1e-9));nearPlanner(mass,q.mass+q.burned);assert.ok(q.heat>=-1e-6);if(previous){assert.ok(q.beta<=previous.beta+1e-10);assert.ok(q.earth>=previous.earth);assert.ok(q.distance>=previous.distance);assert.ok(q.heat>=previous.heat-1);}previous=q;}
 const end=ReleasingBrake.sampleProper(p,p.proper);assert.equal(end.beta,0);nearPlanner(end.mass,p.finalMass);nearPlanner(end.proper,p.proper);
}
console.log('PASS gas release: no captured fuel, exact stop, both clocks, monotone mass/heat/path and shared 100g cap');
assert.equal(FlightSetup.normalize({}).collectGas,true,'old saves retain gas collection');
assert.equal(ReleasingBrake.plan(1,.5,Magnetic.rho()*SHIP.sailAreaM2),null,'empty tank cannot reach exact zero without collection');
for(const expansion of [false,true])for(const densityCm3 of [.1,1,100]){
 plannerReset();state.expansion=expansion;
 const c=FlightSetup.normalize({sail:true,collector:true,brakeEngine:true,brakeSail:true,collectGas:false,densityCm3});
 state.flightSetup=c;const forecast=MissionPlanner.preview();assert.ok(forecast.valid,forecast.reason);assert.equal(forecast.capturedKg,0);
 launch();let guard=0;
 while(state.flight&&guard++<1000){Simulation.step(1e12);if(state.flight?.missionStage===2){state=restore(JSON.parse(JSON.stringify(state)));}}
 assert.equal(state.current,'hyg-69451');nearPlanner(state.proper,forecast.proper);nearPlanner(state.earth,forecast.earth);assert.equal(state.captured,0);nearPlanner(state.matter*1000,forecast.arrivalFuelKg,2e-5);
 nearPlanner(1,state.matter*1000+state.spentEnergy/Rocket.c**2);
}
plannerReset();const c=FlightSetup.normalize({sail:true,collector:true,burst:true,dump:true,collectGas:false});const noFuel=MissionPlanner.preview(c);assert.equal(noFuel.valid,false);
// A cosmological gas-release trajectory uses the same cumulative path in forecasts and replay.
plannerReset();const passive=ReleasingBrake.plan(2,.9,Magnetic.rho()*SHIP.sailAreaM2);
for(const t of [0,.1,.5,1]){const q=ReleasingBrake.sampleProper(passive,passive.proper*t),staticPath=FlightPath.distance(passive,Magnetic,q.proper,0,false);nearPlanner(staticPath,q.distance);const expanding=FlightPath.distance(passive,Magnetic,q.proper,0,true);assert.ok(Number.isFinite(expanding)&&expanding>=0&&expanding<=staticPath*(1+1e-9));}
console.log('PASS collection switch: compatible defaults, preview/replay/reload, no free fuel and cosmological distances');
for(const target of ['andromeda','3c273']){
 plannerReset();state.selected=target;state.expansion=true;state.flightSetup=FlightSetup.normalize({sail:true,collector:true,burst:true,collectGas:false});
 const forecast=MissionPlanner.preview();assert.ok(forecast.valid,forecast.reason);if(target==='3c273')assert.ok(forecast.cosmic);launch();let count=0;
 while(state.flight&&count++<100)Simulation.step(1e12);
 assert.equal(state.current,target);nearPlanner(state.proper,forecast.proper);nearPlanner(state.earth,forecast.earth);assert.equal(state.captured,0);
}
console.log('PASS complete expanding intergalactic flights without gas collection');
assert.equal(quantity(7.3e-5),'7,3·10⁻⁵');assert.ok(!quantity(7.3e-5).includes('<'));
assert.equal(FlightSetup.normalize({fill:true,reservePercent:90}).arrivalFuelPercent,null,'legacy reserve semantics remain unchanged');
assert.equal(FlightSetup.normalize({arrivalFuelPercent:0,fill:true}).fill,false);
plannerReset();state.current='proxima';state.ship=Space.point(object('proxima').p3);state.selected='alpha';state.matter=0;
const shortSetup=FlightSetup.normalize({sail:true,collector:true,dump:true}),shortLimit=MissionPlanner.fuelLimit(shortSetup);
assert.ok(shortLimit.valid&&shortLimit.maxPercent>0&&shortLimit.maxPercent<10);
for(const fraction of [0,.25,.5,1]){
 const percent=Math.floor(shortLimit.maxPercent*fraction*100)/100,p=MissionPlanner.preview({...shortSetup,arrivalFuelPercent:percent});assert.ok(p.valid,p.reason);
 nearPlanner(p.arrivalFuelKg,percent/100,1e-6);nearPlanner(p.reserveKg,percent/100,1e-6);
}
const tooMuch=MissionPlanner.preview({...shortSetup,arrivalFuelPercent:shortLimit.maxPercent+.05});assert.ok(!tooMuch.valid||tooMuch.arrivalFuelKg<(shortLimit.maxPercent+.05)/100-1e-8,'unreachable tank fill must never be invented');
const noGas=MissionPlanner.fuelLimit({...shortSetup,densityCm3:0});assert.equal(noGas.valid,false);
plannerReset();const noCollection=FlightSetup.normalize({sail:true,collector:true,collectGas:false,capacityKg:5});const dryLimit=MissionPlanner.fuelLimit(noCollection);assert.ok(dryLimit.maxPercent<=20);
const fullSetup=FlightSetup.normalize({sail:true,collector:true,burst:true,arrivalFuelPercent:65});state.flightSetup=fullSetup;const fullForecast=MissionPlanner.preview();assert.ok(fullForecast.valid);nearPlanner(fullForecast.arrivalFuelKg,.65);
assert.equal(MissionPlanner.preview({...fullSetup,arrivalFuelPercent:100}).valid,false,'100% must be rejected rather than reported with a hidden 99% target');
launch();Simulation.step(state.flight.mission.accelerationEnd.proper/2);state=restore(JSON.parse(JSON.stringify(state)));assert.equal(state.flight.mission.setup.arrivalFuelPercent,65);
let tripGuard=0;while(state.flight&&tripGuard++<100)Simulation.step(1e12);assert.equal(state.current,'hyg-69451');nearPlanner(state.matter*1000,.65);nearPlanner(state.proper,fullForecast.proper);
console.log('PASS plain scientific notation, absolute tank targets, reachable short-route limit, no-gas/no-collection limits and saved-slider flight');
const synthetic={valid:true,accelerationEnd:{proper:1,distance:2},coast:{proper:3,distance:6},brake:{proper:6,distance:9},proper:10};
FlightBuilder.drawRoute(synthetic,true,synthetic,null);const chart=$('builderRouteDiagram').innerHTML;
const ranges=[...chart.matchAll(/data-stage="(\\d)" data-proper="([^"]+)" data-distance="([^"]+)" data-start="([^"]+)" data-end="([^"]+)"/g)];assert.equal(ranges.length,3);
for(const [i,r] of ranges.entries())nearPlanner(Number(r[5])-Number(r[4]),392*[2/17,6/17,9/17][i]);
for(const word of ['Разгон','Свободный полёт','Торможение','1,00 лет','3,00 лет','6,00 лет','2,00 св. лет','6,00 св. лет','9,00 св. лет'])assert.ok(chart.includes(word),word+' is part of the chart');
assert.equal(FlightBuilder.routeDistanceText(0),'0 св. лет');assert.ok(FlightBuilder.routeDistanceText(.000001).includes('св. лет'));assert.ok(!FlightBuilder.routeDistanceText(.000001).includes('а.е.'));assert.ok(chart.includes('Время на борту')&&chart.includes('Расстояние в системе внешнего наблюдателя'));
console.log('PASS distance-proportional diagram, explicit metric labels and light-years including zero/tiny values');
const noCoast={...synthetic,peakBeta:.9,coast:{proper:0,distance:0}};FlightBuilder.drawRoute(noCoast,true,noCoast,null);const noCoastChart=$('builderRouteDiagram').innerHTML;
assert.ok(!noCoastChart.includes('Свободный полёт'));assert.ok(!noCoastChart.includes('data-stage="1"'));assert.ok(noCoastChart.includes('data-stage="0"')&&noCoastChart.includes('data-stage="2"'));assert.ok(noCoastChart.includes('Макс. '+percentC(.9)));
assert.equal(Simulation.slowMotionEnabled,false);
for(const phase of ['launch','thrust','brake','dock','cruise'])for(const rate of [1,10,1000]){state.phase=phase;state.flight={replayRate:.000001};Simulation.smoothedFactor=.000001;speed=rate;assert.equal(Simulation.slowMotionFactor(),1);assert.equal(Simulation.replayRate(),rate);}
plannerReset();speed=1;state.flightSetup=FlightSetup.normalize({engine:true});launch();Simulation.smoothedFactor=.000001;const properStart=state.proper;Simulation.advance(.25);nearPlanner(state.proper-properStart,.25,1e-10);
plannerReset();const flashSetup=FlightSetup.normalize({sail:true,collector:true,burst:true});const fullFlash=MissionPlanner.acceleration(flashSetup,object(state.current),1,1e12,0,false,false),lastPhoton=fullFlash.rows.at(-1);nearPlanner(lastPhoton.source*365.25,30,1e-9);assert.ok(lastPhoton.proper>30/365.25);
for(const row of fullFlash.rows)assert.ok(row.source<=Stellar.pulseYears+1e-11);
console.log('PASS maximum-speed label, absent coast omitted, slowdown disabled at all rates/phases, normal clock progress and finite retarded flash');
`);
