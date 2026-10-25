import fs from 'node:fs';
const harness=fs.readFileSync('verify-map.mjs','utf8').split('\nrun(`')[0]+'\nexport {run};';
const {run}=await import('data:text/javascript,'+encodeURIComponent(harness));
run(`
resize();
for(const [kind,label] of Object.entries({star:'Звезда',pulsar:'Пульсар',blackhole:'Чёрная дыра',quasar:'Квазар',galaxy:'Галактика',nebula:'Туманность',cluster:'Звёздное скопление',wall:'Галактическая стена',void:'Космический войд'}))assert.ok(MapDetails.typeName({kind}).startsWith(label));
assert.equal(MapDetails.typeName({kind:'nebula',catalogType:'PN'}),'Планетарная туманность');
assert.ok(MapDetails.typeName({kind:'cluster',type:'СКОПЛЕНИЕ ГАЛАКТИК'}).includes('галактик'));
assert.ok(MapDetails.typeName({synthetic:true,kind:'star'}).includes('Искусственный'));
for(const id of ['alpha','hyg-71453','proxima','bootes','sgr','orion']){showObject(id);assert.ok($('dialogContent').innerHTML.includes('<div class="object-type">'+MapDetails.typeName(object(id))+'</div>'));}
assert.equal(MapDetails.component(object('alpha')),'A');assert.equal(MapDetails.component(object('hyg-71453')),'B');assert.equal(MapDetails.component(object('proxima')),'C');
assert.ok(MapDetails.componentNote(object('proxima')).includes('Бета Центавра — другая'));
assert.ok(!object('alpha').facts.mass.includes('+'));assert.equal(MapDetails.mass(object('alpha')),1.08);assert.ok(!object('alpha').type.includes('ДВОЙНАЯ'));
state=initial();state.selected='alpha';launch(true);renderUI();assert.ok($('targetType').textContent.includes('Звезда'));assert.ok($('targetType').textContent.includes('компонент A'));
const record=ExtendedCatalog.decode(['test','Test','nebula',100,10,20,'catalog','Дальность измерена.',[],null,'OpenNGC',{catalogType:'PN'},0,0]);
assert.ok(!/Реальн/.test(record.desc));assert.ok(record.facts.refs.some(r=>r[1]==='OpenNGC'));
for(const o of OBJECTS)assert.ok(!/^Реальный объект:|^Реальная каталожная запись/.test(MapDetails.description(o)));
// A label remains tied to one contour point across camera motion and zoom.
state=initial();state.selected='sloan';const region=object('sloan'),centre=RegionMap.center(region),anchor=RegionMap.labelAnchor(region.region);
for(const [dx,dy,zoom] of [[0,0,1],[1e7,-1e7,1],[-1e7,2e7,1.1],[0,0,.9]]){
 cam={x:centre.x+dx,y:centre.y+dy,span:region.region.major*3*zoom};MapLabels.begin();RegionMap.draw();
 const q=MapLabels.queue.find(q=>q.key==='region-sloan');assert.ok(q);assert.equal(q.candidates.length,1);
 const c=screen(centre),scale=width/cam.span*Cosmology.regionScale(region),p=q.candidates[0];
 assert.ok(Math.abs((p.x-c.x)/scale-anchor.x)<1e-5);assert.ok(Math.abs((p.y+9-c.y)/scale-anchor.y)<1e-5);
}
`);
console.log('PASS explicit object types, Alpha component facts, source wording and stable region anchors');
