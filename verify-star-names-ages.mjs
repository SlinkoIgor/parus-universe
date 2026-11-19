import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {catalogPath, catalogRoot} from './catalog-path.mjs';

const harness = fs.readFileSync('verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {context,run};';
const {context, run} = await import('data:text/javascript,' + encodeURIComponent(harness) + '#star-names-ages');
context.fetch = async url => {
  const file = 'dist/' + url.split('?')[0];
  return {ok: fs.existsSync(file), json: async () => JSON.parse(fs.readFileSync(file, 'utf8'))};
};
const search = JSON.parse(fs.readFileSync(catalogPath('search.json'), 'utf8'));
const frozen = JSON.parse(fs.readFileSync('data-tools/star-ages.json', 'utf8'));
const curated = JSON.parse(fs.readFileSync('data-tools/star-ages-curated.json', 'utf8'));
const audit = JSON.parse(fs.readFileSync('data-tools/star-ages-audit.json', 'utf8'));
const page = fs.readFileSync('dist/index.html', 'utf8');
const labelBoot = '(' + fs.readFileSync('dist/map-label-data.js', 'utf8').match(/MAP_LABEL_BOOT=(\{.*\});?\s*$/s)[1] + ').entries';

run(`
resize();state=initial();state.expansion=false;paused=true;Cosmology.sync(state);
const card=id=>{showObject(id);const html=$('dialogContent').innerHTML;$('infoDialog').close();return html;};
const parsed={
 '31Xi  Gem':[31,'Xi',0,'Gem'],'Tau Phe':[0,'Tau',0,'Phe'],'Kap1Scl':[0,'Kap',1,'Scl'],'29    Psc':[29,'',0,'Psc'],
 '1Pi 3Ori':[1,'Pi',3,'Ori'],'89Chi Peg':[89,'Chi',0,'Peg'],'Gam3Oct':[0,'Gam',3,'Oct'],'3Alp Lyr':[3,'Alp',0,'Lyr'],
 '9Alp CMa':[9,'Alp',0,'CMa'],'Alp1Cen':[0,'Alp',1,'Cen'],'61    Cyg':[61,'',0,'Cyg'],'Ome CMa':[0,'Ome',0,'CMa'],
};
for(const [text,[flamsteed,letter,index,constellation]] of Object.entries(parsed)){
 const d=MapDetails.designationParse(text);assert.ok(d,text);
 assert.deepEqual([Number(d.flamsteed||0),d.letter||'',Number(d.index||0),d.constellation],[flamsteed,letter,index,constellation],text);
}
for(const text of ['Вега','HIP 88','HD 224834','Gl 551','NGC 224','M 31','Sgr A*','S2','Tau','Phe','31','Proxima Cen','V645 Cen','Alp Xyz','1000Xi  Gem'])
 assert.equal(MapDetails.designationParse(text),null,text);
const named={'31Xi  Gem':'Кси Близнецов','Tau Phe':'Тау Феникса','Kap1Scl':'Каппа¹ Скульптора','29    Psc':'29 Рыб','1Pi 3Ori':'Пи³ Ориона','Gam3Oct':'Гамма³ Октанта','61    Cyg':'61 Лебедя'};
for(const [text,name] of Object.entries(named))assert.equal(MapDetails.designationName(MapDetails.designationParse(text)),name);
assert.deepEqual(MapDetails.designationNotation(MapDetails.designationParse('31Xi  Gem')),['ξ Близнецов','31 Близнецов']);
assert.deepEqual(MapDetails.designationNotation(MapDetails.designationParse('1Pi 3Ori')),['π³ Ориона','1 Ориона']);
assert.deepEqual(MapDetails.designationNotation(MapDetails.designationParse('29    Psc')),['29 Рыб']);
assert.deepEqual(MapDetails.designationNotation(MapDetails.designationParse('Tau Phe')),['τ Феникса']);
const tables=MapDetails.designationTables();
assert.equal(tables.letters.size,24,'the whole Greek alphabet');assert.equal(tables.constellations.size,88,'all 88 constellations');
const raw=/^\\d{0,3}\\s*[A-Z][a-z]{2}\\s*\\d?\\s*[A-Z][A-Za-z]{2}$/;
const stars=OBJECTS.filter(o=>o.kind==='star'&&!o.synthetic&&!o.nuclearStar);
assert.equal(stars.filter(o=>raw.test(o.name)&&MapDetails.designationParse(o.name)).length,0,'no core star keeps a raw catalogue designation as its name');
assert.equal(stars.filter(o=>/[А-Яа-яё]\\d /.test(o.name)).length,0,'component indexes are superscripts');
assert.ok(stars.filter(o=>/[¹²³⁴-⁹] /.test(o.name)).length>=3);
const designated=stars.filter(o=>MapDetails.designationOf(o));
assert.ok(designated.length>=600,'most bright stars carry a designation: '+designated.length);
for(const o of designated){
 const d=MapDetails.designationOf(o),notes=MapDetails.designationNotation(d),text=MapDetails.designationText(o);
 assert.ok(notes.length>=1&&notes.length<=2,o.id);
 assert.ok(notes.every(n=>/^(?:[α-ω][¹²³⁴-⁹]?|\\d{1,3}) [А-ЯЁ][А-Яа-яё ]+$/.test(n)),o.id+' '+notes.join('|'));
 assert.ok(!text.split(' · ').includes(o.name),'the line does not repeat the title: '+o.id);
 assert.ok(!text.split(' · ').some(n=>n&&o.name.startsWith(n+' ')),'nor its beginning: '+o.id);
 assert.ok(text.length<=50,o.id);
}
const alzirr=object('hyg-32276'),vega=object('vega');
assert.equal(alzirr.name,'Alzirr');assert.equal(MapDetails.designationText(alzirr),'ξ Близнецов · 31 Близнецов');
assert.equal(MapDetails.designationText(vega),'α Лиры · 3 Лиры');
assert.ok(card('hyg-32276').includes('<p class="object-designation">ξ Близнецов · 31 Близнецов</p>'));
assert.ok(card('vega').includes('<p class="object-designation">α Лиры · 3 Лиры</p>'));
for(const id of ['sol','andromeda','sgr','orion'])assert.ok(!card(id).includes('object-designation'),id);
const bare=stars.find(o=>!MapDetails.designationOf(o));assert.ok(bare);assert.ok(!card(bare.id).includes('object-designation'));
assert.ok(/dialog \\.object-designation\\{/.test(STYLE));
const queries={
 'кси близнецов':'hyg-32276','Кси Близнецов':'hyg-32276','ξ Gem':'hyg-32276','xi gem':'hyg-32276','Xi Geminorum':'hyg-32276','31 близнецов':'hyg-32276','31 Gem':'hyg-32276','31 Geminorum':'hyg-32276',
 'альфа лиры':'vega','α Лиры':'vega','alpha lyrae':'vega','alf Lyr':'vega','3 Лиры':'vega','3 Lyr':'vega',
};
for(const [text,id] of Object.entries(queries)){
 const q=MapDetails.designationQuery(text);assert.ok(q,text);
 assert.ok(MapDetails.designationMatches(object(id),q),text);
 assert.equal(stars.filter(o=>MapDetails.designationMatches(o,q)).length,1,'one star answers: '+text);
 $('catalog').hidden=false;searchFilter='all';$('search').value=text;renderCatalog();
 assert.equal($('catalogList').children[0].children[0].children[0].textContent,object(id).name,'catalogue search: '+text);
}
for(const text of ['','вега','галактика','gem','близнецов','31','HIP 32362','NGC 31','M 31','альфа','спиральная галактика'])
 assert.equal(MapDetails.designationQuery(text),null,text);
assert.ok(MapDetails.designationQuery('µ Cep'),'micro sign is read as mu');
assert.ok(MapDetails.designationQuery('π³ Ori')&&MapDetails.designationQuery('пи3 ориона')&&MapDetails.designationQuery('pi 3 orionis'));
assert.equal(MapDetails.designationQuery('π³ Ori').pattern,MapDetails.designationQuery('пи3 ориона').pattern);
$('search').value='';$('catalog').hidden=true;
for(const [text,label] of [['Tau Phe','Тау Феникса'],['Kap1Scl','Каппа¹ Скульптора'],['89Chi Peg','Хи Пегаса'],['29    Psc',null],['61    Cyg',null]]){
 const o={id:'probe-'+text,kind:'star',name:text,aliases:[]};ExtendedCatalog.stellarProperties(o);
 assert.equal(MapDetails.mapLabelName(o),label,'a lettered designation is a name on the map, a bare number is not: '+text);
}
const labels=LABELS.filter(e=>/^hyg-/.test(e.id));
assert.equal(labels.filter(e=>MapDetails.designationParse(e.name)).length,0,'no raw catalogue abbreviation is baked into the map labels');
assert.equal(labels.filter(e=>/[А-Яа-яё]\\d/.test(e.name)).length,0);
assert.ok(labels.filter(e=>/^(?:Альфа|Бета|Гамма|Дельта|Пи|Тау|Тета|Каппа)[¹²³]? /.test(e.name)).length>200);
`.replace('STYLE', JSON.stringify(fs.readFileSync('dist/style.css', 'utf8'))).replace('LABELS', labelBoot));
console.log('PASS designations: Bayer and Flamsteed forms are parsed, named in Russian, shown under the title and found by Russian, Latin, Greek and abbreviated queries');

const sample = ['hyg-88', 'hyg-759', 'hyg-145', 'hyg-812', 'hyg-1166'].map(id => search.find(row => row[0] === id));
assert.ok(sample.every(Boolean));
context.sampleEntries = sample;
await run(`(async()=>{
  const expected={'hyg-88':['Тау Феникса','Tau Phe','τ Феникса'],'hyg-759':['Каппа¹ Скульптора','Kap1Scl','κ¹ Скульптора'],'hyg-145':['29 Рыб','29    Psc',''],
   'hyg-812':['Гамма³ Октанта','Gam3Oct','γ³ Октанта'],'hyg-1166':['Хи Пегаса','89Chi Peg','χ Пегаса · 89 Пегаса']};
  for(const entry of sampleEntries){
    const o=await ExtendedCatalog.resolve({id:entry[0],tile:entry[5]}),[name,alias,line]=expected[o.id];
    assert.equal(o.name,name);assert.ok(o.aliases.includes(alias),'the catalogue form stays an alias: '+o.id);
    assert.equal(o.stellarNameBasis,'Bayer-Flamsteed');assert.equal(MapDetails.designationText(o),line);
    assert.equal(MapDetails.mapLabelName(o),/^\\d/.test(name)?null:name);
  }
  const cases={'тау феникса':'hyg-88','tau phe':'hyg-88','τ Phoenicis':'hyg-88','каппа1 скульптора':'hyg-759','κ¹ Scl':'hyg-759','29 рыб':'hyg-145','29 Piscium':'hyg-145','гамма3 октанта':'hyg-812','хи пегаса':'hyg-1166','89 пегаса':'hyg-1166'};
  for(const [text,id] of Object.entries(cases)){
    const q=MapDetails.designationQuery(text);assert.ok(q,text);
    const result=await ExtendedCatalog.search(MapDetails.searchKey(text),'all',5,q.pattern);
    assert.equal(result.items[0].id,id,text);assert.ok(result.items[0].searchExact,text);
    assert.ok(/^[А-ЯЁ\\d]/.test(result.items[0].name)&&!/[A-Za-z]/.test(result.items[0].name),'the list shows the Russian name: '+result.items[0].name);
  }
  const plain=await ExtendedCatalog.search('hyg100000','all',5);
  assert.equal(plain.items[0].id,'hyg-100000','search without a designation is unchanged');
})()`);

let receive;
const worker = vm.createContext({fetch: context.fetch, self: {postMessage: value => receive(value)}, console});
vm.runInContext(fs.readFileSync('dist/catalog-search-worker.js', 'utf8'), worker);
const query = (term, pattern = '', filter = 'all') =>
  new Promise(resolve => {
    receive = resolve;
    worker.self.onmessage({data: {seq: 1, term, filter, pattern, limit: 5, dataRoot: catalogRoot}});
  });
context.workerQuery = query;
await run(`(async()=>{
  const cases={'тау феникса':'hyg-88','κ¹ Scl':'hyg-759','29 рыб':'hyg-145','89 Peg':'hyg-1166','хи пегаса':'hyg-1166'};
  for(const [text,id] of Object.entries(cases)){
    const q=MapDetails.designationQuery(text),result=await workerQuery(MapDetails.searchKey(text),q.pattern);
    assert.equal(result.items[0].id,id,'worker: '+text);assert.ok(result.items[0].searchExact,'worker marks the designation as an exact match: '+text);
    assert.ok(result.total>=1&&result.total<50,text+' '+result.total);
  }
  const star=await workerQuery('tauphe','','star'),none=await workerQuery('tauphe','','galaxy');
  assert.equal(star.items[0].id,'hyg-88');assert.equal(none.total,0);
  const filtered=await workerQuery(MapDetails.searchKey('тау феникса'),MapDetails.designationQuery('тау феникса').pattern,'galaxy');
  assert.equal(filtered.total,0,'the designation respects the kind filter');
})()`);
assert.ok(/catalog-search-worker\.js\?v=\d+/.test(fs.readFileSync('dist/catalog-stream.js', 'utf8')));
console.log('PASS streamed designations: nameless catalogue stars get Russian names with the raw form as an alias, and both search paths find them by designation');

const adopted = new Map();
for (const r of frozen.casagrande2011.rows) adopted.set(r[0], [0, r[1], r[2], r[4], Number(r[8].length > 1)]);
for (const r of frozen.david2015.rows) if (!adopted.has(r[0])) adopted.set(r[0], [1, r[1], r[2], r[3], 0]);
const giants = new Map();
for (const r of frozen.luck2015.rows) giants.set(r[0], [...(giants.get(r[0]) || []), r]);
for (const [hip, rows] of giants) {
  if (rows.length > 1 || adopted.has(hip)) continue;
  const models = rows[0].slice(2).filter(v => v !== null);
  adopted.set(hip, [2, rows[0][1], models.length > 1 ? Math.min(...models) : 0, models.length > 1 ? Math.max(...models) : 0, models.length]);
}
const expectedRows = [...adopted.keys()].sort((a, b) => a - b).flatMap(hip => [hip, ...adopted.get(hip)]);
context.expectedRows = expectedRows;
context.curatedAges = curated.objects;
context.ageAudit = audit;
assert.ok(/^Ages in Myr/.test(frozen.units));
assert.equal(page.split('star-ages-data.js?v=').length, 2, 'one script tag for the age layer');
assert.ok(page.indexOf('star-ages-data.js?v=') < page.indexOf('atlas-ui.js?v='));
run(`{
assert.equal(STAR_AGES.units,'Myr');assert.deepEqual([...STAR_AGES.columns],['hip','source','age','lower','upper','flag']);
assert.equal(STAR_AGES.rows.length,expectedRows.length,'one determination per Hipparcos number');
assert.equal(JSON.stringify(STAR_AGES.rows),JSON.stringify(expectedRows),'the layer is exactly the frozen catalogues under the adoption rule');
assert.equal(STAR_AGES.revision,ageAudit.revision);
assert.equal(JSON.stringify(STAR_AGES.objects),JSON.stringify(curatedAges));
assert.deepEqual(STAR_AGES.sources.map(s=>s.key),['casagrande2011','david2015','luck2015']);
for(const s of STAR_AGES.sources){assert.ok(/^https:\\/\\//.test(s.url)&&s.label&&s.method.length>60&&s.catalog,s.key);assert.ok(ageAudit.adopted[s.key]>0);}
assert.equal(Object.values(ageAudit.adopted).reduce((a,b)=>a+b,0)*6,STAR_AGES.rows.length);
for(let i=0;i<STAR_AGES.rows.length;i+=6){
 const [hip,source,age,lower,upper,flag]=STAR_AGES.rows.slice(i,i+6);
 assert.ok(Number.isInteger(hip)&&hip>0&&source>=0&&source<3&&age>0&&lower>=0&&upper>=lower&&age<20000,'row '+hip);
 if(source<2)assert.ok(upper>0,'published interval: '+hip);
}
const card=id=>{showObject(id);const html=$('dialogContent').innerHTML;$('infoDialog').close();return html;};
const plain=html=>html.replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ');
const facts=html=>{const from=html.indexOf('>Данные</h3>');return html.slice(from,html.indexOf('</section>',from));};
const shown={
 'hyg-32276':['≈ 1,4 млрд лет (1,3–1,7) · на начало полёта','Casagrande и др., 2011'],
 'vega':['≈ 420 млн лет (370–500) · на начало полёта','David и Hillenbrand, 2015'],
 'sirius':['≈ 340 млн лет (290–390) · на начало полёта','David и Hillenbrand, 2015'],
 'hyg-69451':['от 1,4 до 7,5 млрд лет · на начало полёта','Luck, 2015'],
 'hyg-24549':['≈ 460 млн лет (450–470) · на начало полёта','Luck, 2015'],
 'sol':['≈ 4,57 млрд лет · на начало полёта','Connelly и др., 2012'],
};
for(const [id,[value,label]] of Object.entries(shown)){
 const a=ObjectCard.age(object(id)),html=card(id),block=facts(html);
 assert.equal(a.value,value,id);assert.equal(a.link[1],'Возраст · '+label);
 assert.ok(block.indexOf('<dt>Возраст<details')>0&&block.indexOf('<dt>Возраст<details')<block.indexOf('fact-row',block.indexOf('fact-row')+1),'age opens the data section: '+id);
 assert.ok(block.includes('<dd>'+value+'</dd>'),id);
 assert.ok(plain(block).includes('Возраст отнесён к началу полёта'),id);
 assert.ok(html.includes('>Возраст · '+label+' ↗</a>'),'the source is linked: '+id);
 assert.equal(html.split('на начало полёта').length,2,'the flight-start note appears once: '+id);
}
const stars=OBJECTS.filter(o=>o.kind==='star'&&!o.synthetic&&!o.nuclearStar),aged=stars.filter(o=>MapDetails.age(o));
assert.ok(aged.length>=300&&aged.length<stars.length,'ages for '+aged.length+' of '+stars.length+' core stars');
for(const o of aged){
 const a=MapDetails.age(o),view=ObjectCard.age(o),half=(a.upper-a.lower)/2;
 assert.ok(view.value.endsWith(' · на начало полёта'),o.id);
 assert.ok(/^(?:≈ [\\d,]+ мл(?:рд|н) лет(?: \\([\\d,]+(?: мл(?:рд|н))?(?:–| – )[\\d,]+(?: мл(?:рд|н))?\\))?|от [\\d,]+(?: мл(?:рд|н))? до [\\d,]+ мл(?:рд|н) лет) · на начало полёта$/.test(view.value),o.id+' '+view.value);
 const wide=a.upper>0&&((half>=1000&&half/a.age>=0.25)||a.age<a.lower||a.age>a.upper);
 assert.equal(view.value.startsWith('от '),wide,'an unresolved age is shown as bounds only: '+o.id);
 assert.equal(view.info.filter(Boolean)[0],a.source.method);
 if(a.models===1)assert.ok(view.info.some(t=>/одному набору изохрон/.test(t))&&!/\\(/.test(view.value),o.id);
 if(a.composite)assert.ok(view.info.some(t=>/несколько компонентов/.test(t)),o.id);
 assert.ok(!/[\\d,]{6,}/.test(view.value),'two significant digits: '+view.value);
}
assert.ok(aged.some(o=>ObjectCard.age(o).value.startsWith('от ')));
assert.ok(aged.some(o=>MapDetails.age(o).models===1)&&aged.some(o=>MapDetails.age(o).composite));
for(const id of ['alpha','proxima']){assert.equal(MapDetails.age(object(id)),null,id);assert.ok(!facts(card(id)).includes('<dt>Возраст'),'no invented age: '+id);}
for(const o of OBJECTS.filter(o=>o.kind!=='star'&&o.kind!=='home'))assert.equal(MapDetails.age(o),null,o.id);
for(const o of OBJECTS.filter(o=>o.synthetic||o.nuclearStar))assert.equal(MapDetails.age(o),null,o.id);
assert.equal(MapDetails.age({kind:'star',hip:'32362',synthetic:true}),null);
assert.equal(MapDetails.age({kind:'star',hip:''}),null);assert.equal(MapDetails.age({kind:'star'}),null);
assert.equal(MapDetails.age({kind:'star',hip:'32362'}).age,MapDetails.age(object('hyg-32276')).age,'streamed stars use the same lookup');
state.destroyed.push('vega');assert.equal(ObjectCard.age(object('vega')),null);assert.ok(!facts(card('vega')).includes('<dt>Возраст'),'a destroyed star has no age row');
state.destroyed=state.destroyed.filter(id=>id!=='vega');
const before=ObjectCard.age(object('vega')).value;state.earth+=5e9;state.proper+=1e3;assert.equal(ObjectCard.age(object('vega')).value,before,'the value is the catalogue age at launch and does not drift');
state=initial();
}`);
console.log('PASS stellar ages: the layer equals the frozen catalogues under one adoption rule, the card shows value, interval and flight-start note, and unresolved or missing ages are never made up');
