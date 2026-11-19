import fs from 'node:fs';
import assert from 'node:assert/strict';

const harness = fs.readFileSync('tests/verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {run,context};';
const {run, context} = await import('data:text/javascript,' + encodeURIComponent(harness) + '#library');
context.fetch = async (path) => {
  path = path.split('?')[0];
  return {ok: fs.existsSync('dist/' + path), json: async () => JSON.parse(fs.readFileSync('dist/' + path, 'utf8'))};
};
context.arrivalIndex = JSON.parse(fs.readFileSync('dist/arrival-stars-index.json'));
run('ArrivalStars.index=arrivalIndex');

const index = fs.readFileSync('dist/index.html', 'utf8');
for (const file of ['index.html', 'app.js', 'atlas-ui.js', 'navigation.js', 'library.js', 'style.css']) {
  const text = fs.readFileSync('dist/' + file, 'utf8');
  assert.ok(!/pulsar-?research|pulsar-inputs|showNavigationTheory|showCatalogSources|showHelp|showModel/i.test(text), 'stale library code in ' + file);
}
for (const file of ['dist/pulsar-research.js', 'dist/pulsar-research.md']) assert.ok(!fs.existsSync(file), file);
for (const id of ['pulsarResearchBtn', 'helpBtn', 'modelBtn', 'sourcesBtn']) assert.ok(!index.includes('id="' + id + '"'), id);
for (const id of ['libraryChapters', 'routeBtn', 'journalBtn']) assert.ok(index.includes('id="' + id + '"'), id);
assert.ok(index.indexOf('src="library.js') > 0 && index.indexOf('src="library.js') < index.indexOf('src="app.js'), 'library loads before app.js');
assert.ok(/<script src="library\.js\?v=[0-9a-f]{12}" data-app>/.test(index), 'library.js has a content cache key and is part of the app bundle');

run(`{
OrbitalArrival.enabled=true;
const fresh=()=>{state=initial();state.flightSetup=FlightSetup.defaults();paused=true;FlightQueue.reset();Cosmology.sync(state);};
const html=()=>$('dialogContent').innerHTML;
const near=(actual,expected,tolerance,label)=>assert.ok(Math.abs(actual/expected-1)<=tolerance,label+': '+actual+' vs '+expected);
fresh();

Library.setup();
const ids=Library.chapters.map(c=>c.id);
assert.deepEqual(ids,['controls','flight','relativity','gravity','map','catalogs','model']);
assert.deepEqual([...$('libraryChapters').innerHTML.matchAll(/data-library-chapter="([^"]+)"/g)].map(m=>m[1]),ids,'menu lists every chapter in order');
assert.ok(!/ульсар/.test($('libraryChapters').innerHTML),'no pulsar entry in the menu');

const pages={};
for(const c of Library.chapters){
 Library.open(c.id);
 const page=pages[c.id]=html();
 assert.equal(Library.current,c.id);
 assert.ok(page.includes('<h2>'+c.title+'</h2>'),c.id+' title');
 assert.ok(page.includes('БОРТОВАЯ БИБЛИОТЕКА · '+Library.number(c)+' / 07'),c.id+' numbering');
 assert.ok(!/undefined|NaN|Infinity|\\[object|недостижимо|расстояние неизвестно/.test(page),c.id+' has no broken values');
 assert.ok(!/джет|Разгон от пульсара/i.test(page),c.id+' has no pulsar boost');
 assert.equal((page.match(/<svg/g)||[]).length,(page.match(/<\\/svg>/g)||[]).length,c.id+' svg balance');
 for(const tag of ['p','h3','table','figure','section','aside','ul','li','dl','button'])
  assert.equal((page.match(new RegExp('<'+tag+'[ >]','g'))||[]).length,(page.match(new RegExp('</'+tag+'>','g'))||[]).length,c.id+' balanced <'+tag+'>');
 for(const m of page.matchAll(/data-library-chapter="([^"]+)"/g))assert.ok(ids.includes(m[1]),c.id+' links to unknown chapter '+m[1]);
 assert.ok(page.length>3500,c.id+' is a real article');
}
const figures=id=>(pages[id].match(/<figure class="lib-fig">/g)||[]).length;
assert.ok(figures('flight')>=2&&figures('relativity')>=2&&figures('gravity')>=2&&figures('map')>=1);
assert.ok(pages.controls.includes('data-library-chapter="flight"')&&pages.model.includes('data-library-close'));

for(const id of ['relativity','map'])assert.ok(/Карта[^<]*нарисована[^<]*неподвижного наблюдателя/.test(pages[id]),id+' states the map frame');
assert.ok(pages.relativity.includes('не меняются, как бы быстро ни летел')&&pages.map.includes('не зависят от скорости'));
assert.ok(pages.relativity.includes('Сейчас на борту')&&pages.gravity.includes('Вселенная сейчас')&&pages.model.includes('Корабль и среда сейчас'));
assert.ok(pages.flight.includes('Ваш план сейчас')&&pages.flight.includes(object(state.selected).name),'the default target is planned live');

const listed=[...CatalogRegistry.libraryHTML().matchAll(/data-catalog-source="([^"]+)"/g)].map(m=>m[1]);
assert.ok(listed.length>=20);
for(const id of listed)assert.ok(pages.catalogs.includes('data-catalog-source="'+id+'"'),'catalogue source '+id);
assert.ok(pages.catalogs.includes(CatalogRegistry.total.toLocaleString('ru-RU'))&&pages.map.includes(CatalogRegistry.total.toLocaleString('ru-RU')));
for(const id of ['hyg','cf4','glade','sdss-filaments','opengc','ogle','jades-dr4','atnf','gaia-clusters','phat-ap'])assert.notEqual(Library.sourceCount(id),'—',id);
assert.equal(CatalogRegistry.data.entries.find(e=>e.id==='phat-ap').mapped,0);

for(const h of Library.holes){
 const o=object(h.id);
 assert.ok(Gravity.canFlyby(o),h.id);
 near(o.gravity.massSolar,h.massSolar,1e-9,h.id+' mass');
}
assert.ok(OBJECTS.filter(o=>Gravity.canFlyby(o)).length>3,'flyby is described for every black hole with a measured mass');
near(Gravity.minimum({massSolar:1,radiusMeters:0},.99),Gravity.critical(.99)*1.001,1e-12,'capture margin');
near(Gravity.critical(.5),1.73,.005,'critical 0.5c');near(Gravity.critical(.9),1.535,.002,'critical 0.9c');near(Gravity.critical(.99),1.503,.001,'critical 0.99c');
near(Gravity.deflection(.99,100),.01*(1+1/.99**2),.02,'weak-field turn');
assert.ok(pages.gravity.includes(fmt(Gravity.deflection(.99,3)*180/Math.PI,1)+'°'));

const observable=Library.observable(),light=Cosmology.horizon(0)/1e9;
near(observable,46.1,.002,'observable radius');near(light,16.7,.003,'light limit');
assert.ok((light/observable)**3<.05);
near(Cosmology.scale(1e10),1.87,.003,'a(10 Gyr)');near(Cosmology.scale(5e10),18.5,.01,'a(50 Gyr)');near(Cosmology.horizon(1e10)/1e9,9.3,.005,'horizon in 10 Gyr');
near(1/Cosmology.H0/1e9,14.5,.005,'Hubble distance');

assert.equal(Route.limit,10);
const d=FlightSetup.defaults();
assert.deepEqual([d.dryMassKg,d.capacityKg,d.sailDiameterM,d.maxAccelerationG,d.maxBrakingG,d.enginePowerW,d.burstLuminosityW,d.burstDays,d.densityCm3,d.arrivalFuelPercent,d.collectorMinAu],[1,1,100,10,10,3e15,1.2e35,30,1,50,100]);
near(d.collectorDiameterM,.1*149597870700,1e-12,'collector');
assert.deepEqual([d.engine,d.sail,d.collector,d.burst,d.brakeEngine,d.brakeSail,d.collectGas],[true,true,true,false,true,true,true]);
near(Rocket.c/(10*G0)/86400,35.4,.002,'c/a at 10 g');
near(Stellar.stellarLight(object('sol')).watts*d.collectorDiameterM**2/(16*(100*149597870700)**2),2.4e19,.01,'collected sunlight');

const gamma=p=>1/Math.sqrt((1-p.peakBeta)*(1+p.peakBeta));
const plans={};
for(const e of Library.examples){
 fresh();state.selected=e.id;
 const p=plans[e.id]=MissionPlanner.preview();
 assert.ok(p.valid,e.id+': '+p.reason);
 near(p.distance,e.distance,.01,e.id+' distance');near(p.proper,e.proper,.005,e.id+' ship time');
 near(p.earth,e.earth,.005,e.id+' observer time');near(gamma(p),e.gamma,.005,e.id+' peak');
}
near(plans.proxima.accelerationEnd.proper*365.25,24,.03,'Proxima acceleration days');near(plans.proxima.brake.proper,9.1,.01,'Proxima braking');
near(plans.sgr.brake.distance,190,.01,'braking path');near(plans.sgr.brake.proper,16,.02,'braking time');
near(gamma(plans.sgr)/1800,1,.03,'cruise gamma');
const extra=plans.m87.accelerationEnd.distance+plans.m87.brake.distance-plans.m87.distance;
assert.ok(extra>8e4&&extra<1.3e5,'expansion adds about 100 kly on the way to M87: '+extra);
near(plans.lmc.proper,16+plans.lmc.distance/1800,.03,'rule of thumb');

fresh();state.selected='proxima';
const engineOnly={...FlightSetup.read(),sail:false,collector:false,engine:true,brakeSail:false,collectGas:false,arrivalFuelPercent:0};
let p=MissionPlanner.preview(engineOnly);assert.ok(p.valid,p.reason);near(p.peakBeta,1/3,.001,'engine-only peak');near(p.proper,12,.01,'engine-only Proxima');
state.selected='sgr';p=MissionPlanner.preview(engineOnly);assert.ok(p.valid,p.reason);near(p.proper,76000,.01,'engine-only Sgr A*');
state.selected='sirius';p=MissionPlanner.preview({...FlightSetup.read(),sail:true,collector:false,engine:false});assert.ok(p.valid,p.reason);
near(p.peakBeta*Rocket.c/1000,9,.1,'direct sunlight peak km/s');near(p.earth,270000,.03,'direct sunlight to Sirius');
fresh();const wide={...FlightSetup.read(),collectorDiameterM:d.collectorDiameterM*10};
state.selected='proxima';p=MissionPlanner.preview(wide);assert.ok(p.valid,p.reason);near(p.proper,plans.proxima.proper,1e-4,'a wider collector does not shorten the Proxima flight');
state.selected='sgr';p=MissionPlanner.preview(wide);assert.ok(p.valid,p.reason);near(p.proper,22,.03,'a wider collector shortens the Sgr A* flight');assert.ok(gamma(p)>3*gamma(plans.sgr));
p=MissionPlanner.preview({...FlightSetup.read(),collector:false});assert.ok(p.valid,p.reason);near(p.peakBeta,.6,.001,'engine ceiling');
assert.ok(pages.flight.includes('лоренц-фактор γ')&&pages.flight.includes('99,999985')&&pages.flight.includes('99,9999999974'),'γ is explained and paired with the speed');
assert.ok(!/главное правило|приближения малых|до него меньше/.test(Object.values(pages).join('')),'reviewed wording stays fixed');
for(const page of Object.values(pages)){const text=page.replaceAll(' ',' ');let at=-1;while((at=text.indexOf('γ ≈ ',at+1))>=0){const rest=text.slice(at+4).replace(/^[0-9 ,]+/,'');assert.ok(rest[0]==='('||rest[0]===':'||text.slice(at-6,at)==='% c · ','γ without a speed: '+text.slice(at-40,at+40));}}
fresh();state.current='alpha';state.ship=Space.point(object('alpha').p3);state.selected='sgr';
p=MissionPlanner.preview({...FlightSetup.read(),burst:true});assert.ok(p.valid,p.reason);near(gamma(p),139000,.02,'supernova peak');near(p.proper,20,.03,'supernova to Sgr A*');

fresh();state.selected='sgr';Route.add('sgr');Route.show();
assert.ok(html().includes('<h2>Маршрут.</h2>')&&html().includes('id="routeTheory"'));
$('routeTheory').onclick();
assert.equal(Library.current,'gravity');assert.ok(html().includes('<h2>Гравитация и расширение.</h2>'));
showDialog('<p>x</p>');assert.equal($('dialogContent').onclick,null,'a plain dialog does not inherit library navigation');
console.log('PASS library: '+ids.length+' chapters, '+Object.values(pages).reduce((n,t)=>n+(t.match(/<figure/g)||[]).length,0)+' figures, static-observer map note, live blocks, '+Library.examples.length+' planner-checked flights, no pulsar boost');
}`);
