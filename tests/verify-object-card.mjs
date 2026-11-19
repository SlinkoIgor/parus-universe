import fs from 'node:fs';
const harness = fs.readFileSync('tests/verify-map.mjs', 'utf8').split('\nrun(`')[0] + '\nexport {context,run};';
const { context, run } = await import('data:text/javascript,' + encodeURIComponent(harness) + '#object-card');
context.URL = URL;
context.pageHTML = fs.readFileSync('dist/index.html', 'utf8');
run(`
resize();state=initial();state.expansion=false;paused=true;Cosmology.sync(state);
const labels=['Расстояние','Размер','Масса','Светимость','Класс','Созвездие'];
const card=id=>{showObject(id);const html=$('dialogContent').innerHTML;$('infoDialog').close();return html;};
const tiles=html=>Object.fromEntries([...html.matchAll(/<div class="object-key( is-missing)?"><dt>([^<]+)(<details class="info-tip">.*?<\\/details>)?<\\/dt><dd>(.*?)<\\/dd><\\/div>/g)].map(m=>[m[2],{missing:!!m[1],tip:m[3]||'',value:m[4]}]));
const plain=html=>html.replace(/<[^>]+>/g,' ');
const details=html=>[...html.matchAll(/<section class="object-section">.*?<\\/section>/g)].map(m=>m[0]).join('');
const count=(html,text)=>html.split(text).length-1;
const sections=html=>[...html.matchAll(/<section class="object-section"[^>]*><h3[^>]*>([^<]+)<\\/h3>/g)].map(m=>m[1]);
const order=['Система','Система и орбиты','Состав группы','Данные','Источники','Источники и примечания'];

for(const o of OBJECTS){
 const keys=ObjectCard.keys(o);
 assert.equal(keys.map(k=>k[0]).join('|'),labels.join('|'),'uniform grid: '+o.id);
 for(const [label,fact] of keys){
  if(fact.value)assert.ok(String(fact.value).trim().length>0,label+' value: '+o.id);
  else if(ObjectCard.estimate(fact.reason))assert.equal(ObjectCard.missing(fact.reason),'нет измерения; ориентир — в справке','a typical or model value never enters the tile or its hint: '+o.id+' '+label);
  else assert.ok(ObjectCard.missing(fact.reason).length>0&&!/<[a-z]/i.test(ObjectCard.missing(fact.reason)),'a plain hint: '+o.id+' '+label);
 }
 if(!o.atlasOnly&&Number.isFinite(o.d))assert.ok(keys[0][1].value,'distance tile: '+o.id);
 assert.ok(keys[4][1].value,'class tile: '+o.id);
}
const kinds=new Map();for(const o of OBJECTS)if(!kinds.has(o.kind))kinds.set(o.kind,o.id);
const sample=[...new Set([...kinds.values(),'proxima','alpha','sirius','sol','orion','opengc-ngc6720','vela','andromeda','sgr','bh-m87','bootes','sloan','3c273','horizon','opengc-ngc6205','barnard','opengc-ngc6960'])];
for(const id of sample){
 const o=object(id),html=card(id),found=tiles(html);
 assert.equal(Object.keys(found).join('|'),labels.join('|'),'six tiles in the card: '+id);
 assert.ok(html.startsWith('<article class="object-card"><div class="modal-eyebrow">КАТАЛОГ / '+MapDetails.typeLabel(o).toLocaleUpperCase('ru')+'</div><h2>'+o.name+'</h2>'),'eyebrow and title: '+id);
 assert.ok(!html.includes('object-type')&&!html.includes('undefined')&&!html.includes('NaN'),'clean markup: '+id);
 const names=sections(html);
 assert.equal(new Set(names).size,names.length,'no repeated section: '+id);
 assert.equal(names.join('|'),order.filter(n=>names.includes(n)).join('|'),'fixed section order: '+id);
 for(const n of names)assert.ok(order.includes(n),'known section: '+n);
 assert.ok(!/<section class="object-section"><h3>[^<]+<\\/h3><\\/section>/.test(html),'no empty section: '+id);
 const at=s=>html.indexOf(s);
 assert.ok(at('</h2>')<at('object-key-facts'));
 if(html.includes('stellarMedia'))assert.ok(at('stellarMedia')<at('object-key-facts'),'tiles follow the carousel: '+id);
 if(html.includes('quest-story'))assert.ok(at('quest-story')<at('object-key-facts'),'tiles follow the quest story: '+id);
 if(names.length)assert.ok(at('object-key-facts')<at('<section class="object-section"'),'sections follow the tiles: '+id);
 assert.ok(!html.includes('viewRegion')&&!html.includes('Показать область'),'the map is centred from the small card, not from the object card: '+id);
 for(const button of ['viewGalaxy','viewSystem','viewNuclearCluster']){
  assert.ok(count(html,'id="'+button+'"')<=1,'one '+button+': '+id);
  if(html.includes('id="'+button+'"'))assert.ok(at('object-actions')<at('id="'+button+'"')&&at('id="'+button+'"')<(names.length?at('<section class="object-section"'):html.length),'actions stay in one row: '+id);
 }
 const lead=MapDetails.lead(o);
 assert.equal(html.includes('class="object-lead"'),!!lead&&!html.includes('quest-lead'),'the lead yields to the quest story: '+id);
 const scope=(/<dl class="object-key-facts">.*?<\\/dl>/.exec(html)||[''])[0]+details(html);
 if(!lead&&MapDetails.description(o)&&!found['Расстояние'].missing)assert.ok(found['Расстояние'].tip.includes('class="info-pop"'),'technical description moves behind the distance hint: '+id);
 for(const label of ['<dt>Геометрия карты','<dt>Значок туманности','<dt>На радиальной карте','<dt>На схеме','<dt>Модель пролёта','<dt>Область','<dt>Оценка расстояния','<dt>Координаты<','Опорная звезда карты и полёта','характерного размера','unspecified'])assert.ok(!html.includes(label),'the card speaks about the object, not about the map: '+id+' '+label);
 assert.ok(!/на карте|для схемы|иллюстратив|полёт разрешён|только атлас|пунктир/i.test(plain(scope.replace('На карте объект не размещён.',''))),'no staging remarks: '+id);
 assert.ok(!details(html).includes('<small>'),'explanations live behind the info hints: '+id);
 assert.ok(!/Оценки округлены|<p class="object-note">[^<]*[MLR]☉ — /.test(html),'no unit footnote: '+id);
 for(const tip of html.matchAll(/<details class="info-tip">(.*?)<\\/details>/g))assert.ok(/^<summary aria-label="Справка: [^"<>]+"><span aria-hidden="true">i<\\/span><\\/summary><div class="info-pop">(?:<p>.+?<\\/p>)+<\\/div>$/.test(tip[1]),'hint markup: '+id+' '+tip[1].slice(0,80));
 assert.ok(!html.includes('<dt>Обозначения<details'),'names need no hints: '+id);
 for(const [mark,text] of [['M☉','M☉ — масса Солнца'],['R☉','R☉ — радиус Солнца'],[' mag','mag — звёздная величина'],['а.е.','а.е. — астрономическая единица']])for(const m of scope.matchAll(/<dt>([^<]+)(<details class="info-tip">.*?<\\/details>)?<\\/dt><dd>(.*?)<\\/dd>/g))if(m[3].includes(mark)&&!/Имена|обозначения|Каталог/.test(m[1]))assert.ok((m[2]||'').includes(text),'notation is explained next to the value: '+id+' '+m[1]+' '+mark);
}

const methods=new Set(IMPORTED_CATALOG.objects.map(e=>e.distanceMethod).filter(Boolean));
const technical=OBJECTS.filter(o=>methods.has(o.desc));
assert.ok(technical.length>500,'imported method descriptions are a class, not single records');
for(const o of technical)assert.equal(MapDetails.lead(o),'','a distance method is not a lead: '+o.id);
for(const id of ['proxima','sirius','orion','andromeda','vela','bootes'])assert.equal(MapDetails.lead(object(id)),MapDetails.description(object(id)),'curated lead: '+id);
assert.equal(MapDetails.lead({streamed:true,desc:'Метод.',facts:{}}),'');

for(const [id,title] of [['vela','Что такое пульсар'],['crab','Что такое пульсар'],['opengc-ngc6720','Что такое планетарная туманность'],['opengc-ngc6960','Что такое остаток сверхновой'],['opengc-ngc6205','Что такое шаровое скопление'],['3c273','Что такое квазар'],['sgr','Что такое сверхмассивная чёрная дыра'],['cygnus','Что такое чёрная дыра'],['bootes','Что такое войд'],['horizon','Что такое космологический горизонт'],['proxima','Что такое красный карлик'],['sirius','Что такое белый карлик']]){
 const found=MapDetails.explainer(object(id));assert.equal(found?.title,title,id);
 assert.ok(found.text.length>60&&found.text.length<420,'short explanation: '+id);
 const html=card(id);assert.equal(count(html,'<section class="object-explainer"><h3>'+title+'</h3>'),1,id);
 assert.ok(html.indexOf('object-key-facts')<html.indexOf('object-explainer')&&html.indexOf('object-explainer')<html.indexOf('object-section'),'explanation sits right under the tiles: '+id);
}
for(const id of ['alpha','sol','andromeda'])assert.equal(MapDetails.explainer(object(id)),null,'familiar classes need no explanation: '+id);
assert.equal(MapDetails.explainer({synthetic:true,kind:'pulsar',facts:{}}),null);
for(const o of OBJECTS.filter(o=>o.kind==='cluster')){
 const title=MapDetails.explainer(o)?.title||'';
 if(/звёздн|рассеянн|шаров/.test(title))assert.ok(StellarClusters.is(o),'a stellar explanation only for stellar clusters: '+o.id);
 if(/протоскоплен/i.test(MapDetails.typeName(o)))assert.equal(title,'Что такое протоскопление',o.id);
}
assert.equal(MapDetails.explainer({kind:'cluster',catalogIdentityLabel:'Оптическая группа · астеризм',facts:{}}).title,'Что такое оптическая группа');
assert.equal(MapDetails.explainer({kind:'cluster',type:'КАНДИДАТ В ПРОТОСКОПЛЕНИЕ · CCPC-II',distantCatalog:true,facts:{}}).title,'Что такое протоскопление');
assert.equal(MapDetails.explainer({kind:'cluster',type:'ЗВЁЗДНОЕ ОБЛАКО',catalogIdentityLabel:'Звёздное облако',facts:{}}),null,'a star cloud is not explained as a bound cluster');
for(const o of OBJECTS.filter(o=>o.kind==='pulsar'))assert.equal(MapDetails.explainer(o)?.title,'Что такое пульсар',o.id);
for(const o of OBJECTS.filter(o=>o.kind==='nebula'||o.kind==='quasar'||o.kind==='blackhole'||o.kind==='void'))assert.ok(MapDetails.explainer(o),'every record of an unfamiliar class is explained: '+o.id);

for(const id of ['vela','crab']){
 const o=object(id),html=card(id),mass=tiles(html)['Масса'];
 assert.equal(mass.missing&&mass.value,'<span title="нет измерения; ориентир — в справке">—</span>','a typical neutron-star mass is not shown as measured: '+id);
 assert.ok(mass.tip.includes('<p>'+o.facts.mass+'</p>')&&mass.tip.includes('M☉ — масса Солнца'),'the typical value waits behind the hint: '+id);
 assert.ok(!details(html).includes('<dt>Масса'),'no absence row: '+id);
}
assert.equal(tiles(card('horizon'))['Масса'].value,'<span title="'+object('horizon').facts.mass+'">—</span>','the reason is only a hint on the dash');
assert.equal(ObjectCard.missing(''),'нет данных');
for(const id of sample){
 const html=card(id);
 for(const m of details(html).matchAll(/<dt>(Масса|Светимость|Размер|Расстояние)(?:<details class="info-tip">.*?<\\/details>)?<\\/dt><dd>([^<]*)/g))assert.ok(/\\d/.test(m[2]),'details carry values, not statements of absence: '+id+' '+m[0]);
 assert.ok(!html.includes('видимая величина не указана'),'no absence note under the constellation: '+id);
}
for(const o of OBJECTS.filter(o=>/^(?:Нет индивидуальной оценки|Индивидуальная масса)/.test(o.facts?.mass||'')).slice(0,40)){
 const html=card(o.id);
 assert.ok(!html.includes('<dd>'+o.facts.mass),'no absence row: '+o.id);
 assert.equal(tiles(html)['Масса'].value,'<span title="'+o.facts.mass+'">—</span>',o.id);
}
for(const id of sample)for(const tile of Object.values(tiles(card(id))))if(tile.missing)assert.ok(/^<span title="[^"<>]+">—<\\/span>$/.test(tile.value),'a missing value is a plain dash: '+id);
assert.equal(tiles(card('sol'))['Расстояние'].value,'8,3 св. мин<small>от Земли</small>');
const hidden=OBJECTS.filter(o=>o.atlasOnly).slice(0,3);assert.ok(hidden.length);
for(const o of hidden){const html=card(o.id);assert.ok(tiles(html)['Расстояние'].missing,o.id);assert.ok(html.includes('Надёжная дальность неизвестна'),o.id);}

const wide=OBJECTS.filter(o=>/^\\d[\\d\\s]*\\d\\s*\\+/.test(o.facts?.mass||'')).slice(0,4);assert.ok(wide.length>=3);
for(const o of wide){
 const html=card(o.id),mass=tiles(html)['Масса'];
 assert.ok(/^≈ \\d,\\d·10[⁰¹²³⁴⁵⁶⁷⁸⁹]+ M☉<small>/.test(mass.value),'compact mass tile: '+o.id);
 assert.ok(mass.tip.includes('Полная запись: '+o.facts.mass.replace(/[\\s.]*$/,'')+'.')&&!details(html).includes('<dt>Масса'),'the full measurement with its uncertainty waits behind the tile hint: '+o.id);
 assert.ok(mass.tip.includes('M☉ — масса Солнца')&&mass.tip.includes('Значение округлено.'),'the mass hint: '+o.id);
}
const visual=OBJECTS.filter(o=>o.facts?.visual&&!Number.isFinite(o.facts.lum)).slice(0,3);assert.ok(visual.length);
for(const o of visual){
 const html=card(o.id),lum=tiles(html)['Светимость'],band=o.facts.band||'V';
 assert.ok(lum.value.includes('только в полосе '),'a band luminosity is labelled: '+o.id);
 assert.ok(lum.tip.includes('L☉,'+band+' — светимость Солнца в полосе '+band)&&lum.tip.includes('не полная болометрическая мощность')&&!lum.tip.includes('L☉ — полная'),'the band formula and notation wait behind the hint: '+o.id);
 assert.ok(/Абсолютная величина объекта M = [−\\d,]+ mag\\. /.test(lum.tip)&&lum.tip.includes('mag — звёздная величина')&&!html.includes('<dt>Абсолютная величина'),'the absolute magnitude is the basis of the tile and waits behind its hint: '+o.id);
}
const total=OBJECTS.filter(o=>Number.isFinite(o.facts?.lum)).slice(0,3);assert.ok(total.length);
for(const o of total){const html=card(o.id),tip=tiles(html)['Светимость'].tip;assert.ok(tip.includes('L☉ — полная светимость Солнца'),'bolometric notation: '+o.id);assert.ok(/В ваттах — ≈ [^<]+ Вт\\./.test(tip)&&!html.includes('<dt>Мощность излучения'),'watts restate the tile, so they wait behind its hint: '+o.id);}

for(const [ra,dec] of [[0,0],[10.68,41.27],[187.7059,12.3911],[217.43,-62.68],[359.9,-89.5],[83.82,-5.39]]){
 const found=ObjectCard.direction({p3:Space.fromSky(ra,dec,5e7)});
 assert.ok(Math.abs(found[0]-ra)<1e-8&&Math.abs(found[1]-dec)<1e-8,'direction from the physical position: '+ra+' '+dec);
}
assert.equal(ObjectCard.direction({p3:[1,2,3],arrivalAnchor:true}),null,'a game anchor has no sky direction');
assert.equal(ObjectCard.direction({p3:[1,2,3],atlasOnly:true}),null);
assert.equal(ObjectCard.direction({p3:[0,0,0]}),null);
assert.ok(tiles(card('bh-m87'))['Созвездие'].value.startsWith('Дева'),'M87* inherits the direction of its physical position');
assert.ok(tiles(card('sloan'))['Созвездие'].missing,'an unlocated structure has no constellation');
for(const id of ['hyg-32276','sirius','proxima','andromeda','orion','lmc','opengc-ngc6720','3c273','bh-m87']){
 const o=object(id),html=card(id),tile=tiles(html)['Созвездие'],sky=ObjectCard.sky(o);
 assert.ok(!html.includes('Где искать на небе')&&!html.includes('sky-guide'),'no separate sky section: '+id);
 assert.ok(plain(tile.tip).includes('Латинское название — '),'the Latin name is behind the hint: '+id);
 assert.equal(count(html,'Видимая величина V<'),0,'apparent magnitude is not repeated below the tile: '+id);
 if(SkyGuide.magnitude(o)!==null)assert.ok(/ · V\u00a0−?[\\d,]+$/.test(sky.note)&&plain(tile.tip).includes('видимая звёздная величина'),'brightness and its explanation stay in the tile: '+id);
 assert.equal(plain(tile.tip).includes('поднимается над горизонтом'),SkyGuide.canChart(o),'where it rises is said only for charted objects: '+id);
 assert.ok(!/\\.\\.(?:<|$)/.test(tile.tip),'no doubled full stop: '+id);
 if(SkyGuide.canChart(o))assert.ok(html.includes('Направление J2000')&&html.includes('data-photo="chart-wide"'),'chart and coordinates remain: '+id);
}
assert.ok(plain(tiles(card('lmc'))['Созвездие'].tip).includes('NOIRLab'),'published naked-eye evidence is linked from the hint');

for(const [id,text] of [['proxima','Совместная опорная 3D-конфигурация'],['alpha','Совместная опорная 3D-конфигурация'],['orion','Размер рассчитан из угловых размеров каталога OpenNGC и принятого расстояния.']]){
 assert.ok(count(card(id),text)===1,'a repeated note is printed once: '+id);
}
for(const id of ['orion','andromeda','opengc-ngc6205']){
 const html=card(id),row=/<dt>Обозначения<\\/dt><dd>(.*?)<\\/dd>/.exec(html)?.[1];
 if(!row)continue;
 const names=row.replace(/<details>.*<\\/details>/,'').split(' · ').map(s=>s.toLocaleLowerCase('ru').replace(/\\s+/g,''));
 assert.equal(new Set(names).size,names.length,'aliases are not repeated: '+id);
}
const within=(html,title,text)=>{const from=html.indexOf('<h3>'+title+'</h3>'),to=html.indexOf('</section>',from);return from>=0&&html.slice(from,to).includes(text);};
for(const o of OBJECTS.filter(o=>o.positionEstimate).slice(0,3)){const html=card(o.id);assert.ok(within(html,'Данные','Локальный диапазон позиции')&&/<dt>Опорн(?:ое скопление|ая галактика)<\\/dt>/.test(html),'position estimate: '+o.id);}
for(const o of OBJECTS.filter(o=>o.mapOffset?.some(v=>Math.abs(v)>1e-6)).slice(0,3))assert.ok(!card(o.id).includes('не граница принадлежности'),'the map offset is not a fact about the object: '+o.id);
for(const o of OBJECTS.filter(o=>o.catalogDistanceLy!=null).slice(0,3))assert.ok(within(card(o.id),'Данные','Исходная каталожная дальность'),'source distance: '+o.id);
for(const o of OBJECTS.filter(o=>o.region?.sizeUnknown)){const html=card(o.id);assert.ok(tiles(html)['Размер'].missing&&!tiles(html)['Размер'].tip,'no size is invented: '+o.id);assert.ok(!html.includes('Измеренная граница и размер области'),o.id);}
for(const o of OBJECTS.filter(o=>MapGeometry.unlocated(o)&&o.p3)){const html=card(o.id);assert.ok(within(html,'Данные','Игровая точка XYZ')&&within(html,'Данные','Положение центра структуры не измерено')&&!html.includes('нет пространственной привязки'),'unlocated geometry: '+o.id);}
const members=OBJECTS.filter(o=>ExtendedCatalog.systemByMember.has(o.id)),linked={named:0,titled:0,row:0,hinted:0};
for(const o of members){
 const html=card(o.id),system=ExtendedCatalog.systemByMember.get(o.id),title=/<h3>(Система(?: и орбиты)?|Состав группы)<\\/h3>/.exec(html)?.[1];
 assert.ok(title,'system section: '+o.id);
 const from=html.indexOf('<h3>'+title+'</h3>'),block=html.slice(from,html.indexOf('</section>',from)+10),note=/<div class="object-system-note">(.*?)<\\/div>(?:<dl|<div class="stellar|<\\/section>|$)/.exec(block)?.[1]||'';
 const named=plain(note.replace(/<details.*<\\/details>/,'')).includes(system.name),titled=o.name.split(' · ').includes(system.name);
 assert.equal(block.includes('<dt>Связанная система'),!named&&!titled,'the system is named once: in the note, in the title or in the row: '+o.id);
 assert.ok(!block.includes('Компоненты и орбиты'),'the orbit table needs no second heading: '+o.id);
 linked[named?'named':titled?'titled':'row']++;
 if(named&&note.includes('<details class="info-tip">'))linked.hinted++;
}
assert.ok(linked.named>50&&linked.titled>0&&linked.row>20&&linked.hinted>0,'all ways of naming a system are covered and its note keeps the hint: '+JSON.stringify(linked));
assert.ok(within(card('sirius'),'Система и орбиты','class="object-system-note">Компонент A системы «Сириус».'),'the component note opens the system section');
assert.ok(within(card('cygnus'),'Система','<dt>Состав<details')&&!within(card('cygnus'),'Данные','<dt>Система'),'the makeup of a system belongs to the system section');
for(const o of OBJECTS.filter(o=>o.cosmology).slice(0,3))assert.ok(within(card(o.id),'Данные','Красное смещение')&&tiles(card(o.id))['Расстояние'].value.includes('свет шёл'),'lookback note: '+o.id);
assert.ok(!card('orion').includes('M☉ — масса Солнца'),'solar units are explained only where they are used');
for(const o of OBJECTS.filter(o=>o.kind==='nebula'&&!o.region&&!o.facts?.radius).slice(0,5))assert.equal(tiles(card(o.id))['Размер'].value,'<span title="Индивидуальный размер в исходной выборке не приведён.">—</span>','a nebula without a size: '+o.id);
assert.ok(tiles(card('proxima'))['Масса'].tip.includes('M☉ — масса Солнца'));

const link=(bib,label)=>'<a href="https://ui.adsabs.harvard.edu/abs/'+encodeURIComponent(bib)+'/abstract" target="_blank" rel="noopener">'+label+' ↗</a>';
for(const [bib,label] of [['2010ApJ...714.1096S','The Astrophysical Journal, т. 714, с. 1096 (2010)'],['2016ApJ...816L..14L','The Astrophysical Journal Letters, т. 816, с. L14 (2016)'],['2020A&A...633A..51Z','Astronomy &amp; Astrophysics, т. 633, с. A51 (2020)'],['2021MNRAS.504..356D','Monthly Notices of the Royal Astronomical Society, т. 504, с. 356 (2021)'],['2011PASP..123.1011A','Publications of the Astronomical Society of the Pacific, т. 123, с. 1011 (2011)'],['2020yCat.1350....0G','каталог VizieR I/350 (2020)']])assert.equal(ObjectCard.reference(bib),link(bib,label),bib);
assert.ok(ObjectCard.reference('2020A&A...633A..51Z').includes('abs/2020A%26A...633A..51Z/abstract'));
assert.equal(ObjectCard.clean('Литературное расстояние: unspecified in SIMBAD; 2010ApJ...714.1096S'),'Источник оценки: '+link('2010ApJ...714.1096S','The Astrophysical Journal, т. 714, с. 1096 (2010)'),'an unspecified method is not printed');
assert.equal(ObjectCard.clean('Литературное расстояние: paral; 2021MNRAS.504..356D.'),'Метод: тригонометрический параллакс. Источник оценки: '+link('2021MNRAS.504..356D','Monthly Notices of the Royal Astronomical Society, т. 504, с. 356 (2021)'));
assert.equal(ObjectCard.clean('Литературная оценка SIMBAD: kin; 2021MNRAS.504..356D'),'Метод: кинематическая оценка. Источник оценки: '+link('2021MNRAS.504..356D','Monthly Notices of the Royal Astronomical Society, т. 504, с. 356 (2021)'));
assert.ok(ObjectCard.clean('Литературное расстояние: Общая оценка пары: 68 млн св. лет.; 2021MNRAS.504..356D').startsWith('Общая оценка пары: 68 млн св. лет. Источник оценки: <a '));
assert.equal(ObjectCard.clean('Каталожное расстояние HYG 4.1; pc × 3.261563777.'),'Каталожное расстояние HYG 4.1; парсеки пересчитаны в световые годы.');
assert.equal(ObjectCard.clean('Исходная оценка массы: 7.0\\\\pm 0.6'),'Исходная оценка массы: 7.0 ± 0.6');
assert.deepEqual(ObjectCard.split('Литературное расстояние: paral; 2021MNRAS.504..356D  Угловые размеры OpenNGC. Положение оценено.'),['Литературное расстояние: paral; 2021MNRAS.504..356D.','Угловые размеры OpenNGC.','Положение оценено.']);
for(const [text,kept] of [['Малая ось неизвестна; для схемы использована окружность.','Малая ось неизвестна.'],['Каталожное направление J2000; движение за время экспедиции не моделируется.','Каталожное направление J2000.'],['Полёт разрешён к оценочной точке прибытия в область; это не компактное тело.',''],['Только атлас.',''],['На карте показаны опубликованные относительные орбиты.',''],['Область включает Млечный Путь; контур иллюстративный.','Область включает Млечный Путь.'],['Размер — каталожный оптический контур, без внешнего слабого гало.','Размер — каталожный оптический контур, без внешнего слабого гало.'],['Это не время полёта света; видимость древнего света не гарантирует достижимость.','Это не время полёта света; видимость древнего света не гарантирует достижимость.'],['Приближённый диаметр ≈250 млн св. лет; граница разрежения условная.','Приближённый диаметр ≈250 млн св. лет; граница разрежения условная.']])assert.equal(ObjectCard.about(text),kept,text);
for(const [text,topic] of [['Метод: цефеиды, зависимость период — светимость. Источник оценки: x','Расстояние'],['Светимость в V; не болометрическая.','Светимость'],['Масса: звёздная компонента, без газа и тёмной материи.','Масса'],['Это ориентир протяжённой области, не измеренный центр массы.','Положение'],['Малая ось неизвестна.','Размер'],['Параллакс Hipparcos, редукция 2007 года; σπ/π ≈ 0,2%.','Расстояние'],['Каталожная позиция.','Положение'],['Переменная звезда.','']])assert.equal(ObjectCard.topic(text),topic,text);
const literature=OBJECTS.filter(o=>/Литературн/.test(o.distanceMethod||o.desc||''));
assert.ok(literature.length>20,'literature distances are a class of records');
for(const o of literature){
 const source=o.distanceMethod||o.desc,method=/Литературн[^:]*:\\s*(.*?);\\s*\\d{4}/.exec(source)?.[1].trim();
 if(method!==undefined)assert.ok(ObjectCard.methods[method.toLocaleLowerCase('en')]||/unspecified/i.test(method)||/[а-яё]/i.test(method),'a known distance method code: '+o.id+' '+method);
 const html=card(o.id),text=plain(html);
 assert.ok(!/Литературн(?:ое расстояние|ая оценка)|unspecified|\\d{4}[A-Za-z&.]{5}[\\w.]{9}[A-Z](?!\\w)/.test(text),'no raw method code or bibcode: '+o.id);
 if(new RegExp(ObjectCard.bibcode.source).test(source)&&!tiles(html)['Расстояние'].missing)assert.ok(tiles(html)['Расстояние'].tip.includes('Источник оценки: <a href="https://ui.adsabs.harvard.edu/abs/'),'a readable reference behind the distance hint: '+o.id);
}
for(const o of OBJECTS.filter(o=>o.region?.note&&/OpenNGC/.test(o.region.note)).slice(0,12)){
 const html=card(o.id),size=tiles(html)['Размер'];
 assert.ok(!html.includes('Каталожная оптическая область')&&!html.includes('<dt>Область'),'no map region row: '+o.id);
 if(!size.missing)assert.ok(size.tip.includes('Размер рассчитан из угловых размеров каталога OpenNGC и принятого расстояния.'),'the size source waits behind the hint: '+o.id);
}
for(const o of OBJECTS.filter(o=>ExtendedCatalog.systemByMember.get(o.id)?.stellarEnriched).slice(0,4)){
 const html=card(o.id);
 assert.ok(!html.includes('Звёзды с известными орбитами движутся')&&!html.includes('Показана относительная орбита'),'no animation remarks: '+o.id);
 if(html.includes('P = '))assert.ok(html.includes('P — период обращения.'),'orbital notation: '+o.id);
}
const typeCases={'G2V':'жёлтый карлик','F5IV':'жёлто-белый субгигант','F5IV-V':'жёлто-белый субгигант','K0III':'оранжевый гигант','K0/K1III':'оранжевый гигант','M2Iab':'красный сверхгигант','B8Ia':'бело-голубой сверхгигант','O9.5Ib SB':'голубой сверхгигант','K3II+...':'оранжевый яркий гигант','A0V':'белая, главной последовательности','B3Vp':'бело-голубая, главной последовательности','M5.5Ve':'красный карлик','dM5.5e':'красный карлик','sdM1':'красный субкарлик','F8Ia+':'жёлто-белый гипергигант','K5':'оранжевая','A0p Si':'белая','DA2':'белый карлик','WD':'белый карлик','WN6h':'звезда Вольфа — Райе','WC8 + O9I':'звезда Вольфа — Райе','L2':'коричневый карлик','A1 V + белый карлик DA':'белая, главной последовательности','M1Ib + B2.5V':'красный сверхгигант','':'','m':'','*':''};
for(const [spectral,type] of Object.entries(typeCases))assert.equal(MapDetails.starType(spectral),type,'star type of '+spectral);
const morphology={E:'эллиптическая','E-S0':'линзовидная',S0:'линзовидная','S0-a':'линзовидная',Sa:'спиральная',Sbc:'спиральная',SBcd:'спиральная с перемычкой',SABc:'спиральная со слабой перемычкой',SBm:'спиральная с перемычкой',I:'неправильная',IB:'неправильная','S?':'','':''};
for(const [hubble,type] of Object.entries(morphology))assert.equal(MapDetails.galaxyType(hubble),type,'galaxy type of '+hubble);
let typedStars=0,typedGalaxies=0;
for(const o of OBJECTS){
 const subtype=MapDetails.subtype(o),label=MapDetails.typeLabel(o),type=MapDetails.typeName(o);
 if(!subtype){assert.equal(label,type,'no subtype leaves the type as it was: '+o.id);continue;}
 assert.ok(['star','home','galaxy'].includes(o.kind),'only stars and galaxies get a derived subtype: '+o.id);
 assert.ok(!/undefined|null|[A-Z]\d/.test(subtype)&&subtype===subtype.trim()&&subtype.length<60,'a plain subtype: '+o.id+' '+subtype);
 assert.ok(label===type+' · '+subtype||(type==='Звезда'&&subtype.includes('звезда')||type==='Галактика'&&subtype.includes('галактик'))&&label.toLocaleLowerCase('ru')===subtype.toLocaleLowerCase('ru')&&label[0]===label[0].toLocaleUpperCase('ru'),'the subtype stands next to the type: '+o.id+' '+label);
 assert.equal(objectTypeText(o),label+(MapDetails.component(o)?' · компонент '+MapDetails.component(o):''),'the small card shows the same type: '+o.id);
 if(o.kind==='galaxy'&&!MapDetails.galaxyType(o.hubbleType)){assert.ok(card(o.id).includes('<dt>Класс</dt><dd>'+label),'a curated galaxy keeps its described class: '+o.id);continue;}
 if(o.kind==='galaxy'){typedGalaxies++;assert.equal(subtype,MapDetails.galaxyType(o.hubbleType),'galaxy subtype comes from the catalogue morphology: '+o.id);assert.equal(tiles(card(o.id))['Класс'].value,subtype[0].toLocaleUpperCase('ru')+subtype.slice(1)+'<small>'+o.hubbleType+'</small>','morphology tile: '+o.id);}
 else typedStars++;
}
assert.ok(typedStars>800&&typedGalaxies>20,'most stars and catalogue galaxies are typed: '+typedStars+' / '+typedGalaxies);
let sampled=0;
for(const [n,o] of OBJECTS.filter(o=>o.kind==='star'&&o.spectral&&/^ЗВЕЗДА · /.test(o.facts?.class||'')).entries()){
 const derived=MapDetails.starType(o.spectral);
 if(!derived)continue;
 assert.equal(MapDetails.subtype(o),derived,'catalogue stars are typed from their spectral class: '+o.id);
 if(n%16&&o.id!=='hyg-32276')continue;
 sampled++;
 const tile=tiles(card(o.id))['Класс'];
 assert.ok(tile.tip.includes('Спектральный класс '+o.spectral),'the class hint explains the notation: '+o.id);
 assert.equal(tile.value,/ |карлик|гигант/.test(derived)?derived[0].toLocaleUpperCase('ru')+derived.slice(1)+'<small>'+o.spectral+'</small>':o.spectral+'<small>'+derived+' звезда</small>','class tile: '+o.id);
}
assert.ok(sampled>40,'class tiles are checked on a spread of catalogue stars: '+sampled);
const alzirr=object('hyg-32276');
assert.equal(alzirr.spectral,'F5IV');assert.equal(MapDetails.typeLabel(alzirr),'Звезда · жёлто-белый субгигант');
assert.ok(card('hyg-32276').startsWith('<article class="object-card"><div class="modal-eyebrow">КАТАЛОГ / ЗВЕЗДА · ЖЁЛТО-БЕЛЫЙ СУБГИГАНТ</div>'));
assert.equal(MapDetails.typeLabel(object('sol')),'Звезда · Солнце · жёлтый карлик');
assert.equal(objectTypeText(object('alpha')),'Звезда · жёлтый карлик · компонент A');
assert.equal(objectTypeText(object('proxima')),'Звезда · вспыхивающий красный карлик · компонент C');
assert.equal(MapDetails.typeLabel(object('andromeda')),'Спиральная галактика');assert.equal(MapDetails.typeLabel(object('m87')),'Гигантская эллиптическая галактика');assert.equal(MapDetails.typeLabel(object('opengc-ngc4676')),'Пара галактик');
assert.equal(MapDetails.subtype(object('sgr')),'');assert.equal(MapDetails.subtype(OBJECTS.find(o=>o.nuclearStar)),'');
state.destroyed=['alpha'];assert.equal(objectTypeText(object('alpha')),'ОСТАТОК ЗВЕЗДЫ · компонент A');state.destroyed=[];
assert.ok(pageHTML.includes('</span><span class="target-tools"><button id="objectInfo" aria-label="Об объекте" title="Об объекте"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10v1"/></svg></button><button id="objectFocus" aria-label="Показать на карте" title="Показать на карте"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg></button></span></h2>'),'the centre icon of the ship button sits right of the info button');
assert.ok(pageHTML.includes('id="shipBtn" aria-label="Центрировать и следовать: Ковчег" title="Ковчег · центрировать и следовать"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>'),'it is the same icon as on the ship button');
const plainStar=OBJECTS.find(o=>o.kind==='star'&&o.id!=='sol'&&!o.atlasOnly&&!o.nuclearStar&&!o.stellarSystem&&!OrbitalMotion.isOrbiting(o));
const press=id=>{state.selected=id;cameraGoal=null;followShip=true;$('toast').textContent='';$('objectFocus').onclick();assert.ok(cameraGoal&&cameraGoal.span>0&&Number.isFinite(cameraGoal.span),'the small card moves the camera: '+id);assert.equal(followShip,false,'centring on an object releases ship following: '+id);assert.equal($('toast').textContent,'','centring does not announce map remarks: '+id);return {...cameraGoal};};
for(const id of ['opengc-ngc6302','virgo','andromeda','sloan',plainStar.id]){
 const o=object(id),p=o.region?RegionMap.center(o):MapLayout.project(o),goal=press(id);
 assert.equal(objectOrbitBox(o),null,'no orbit to frame: '+id);
 assert.ok(Math.abs(goal.x-p.x)<=1e-9*Math.max(1,Math.abs(p.x))&&Math.abs(goal.y-p.y)<=1e-9*Math.max(1,Math.abs(p.y)),'the small card centres the map on the object: '+id);
 if(o.region)assert.ok(Math.abs(goal.span/(Math.max(o.region.major,o.region.minor)*Cosmology.regionScale(o)*Math.max(1.7,width/Math.max(height*.6,1)))-1)<1e-9,'a region fills the view as the former card button did: '+id);
}
const orbitCurves=o=>o.id==='sol'?OrbitalMotion.planets.map(q=>E=>OrbitalMotion.planetPoint(q,E)):o.id==='proxima'?[OrbitalMotion.alphaCurve('proxima').pointAt]:['alpha','hyg-71453'].includes(o.id)?['alpha','hyg-71453'].map(id=>OrbitalMotion.alphaCurve(id).pointAt):(track=>track.branches.filter(b=>b.factor).map(b=>OrbitalMotion.stellarCurve(track,b.ids[0],b.factor).pointAt))(OrbitalMotion.stellarOrbits.filter(t=>t.system===o.stellarSystem&&t.branches.some(b=>b.factor&&b.ids.includes(o.id))).sort((a,b)=>a.q.a-b.q.a)[0]);
const orbiting=['sol','alpha','hyg-71453','proxima',...new Set(OrbitalMotion.stellarOrbits.flatMap(t=>t.branches.filter(b=>b.factor).flatMap(b=>b.ids)))].filter(id=>object(id)&&!object(id).historicalStellarNavigation);
assert.ok(orbiting.length>40,'planets, Alpha Centauri and catalogue binaries are covered: '+orbiting.length);
for(const id of orbiting){
 const o=object(id),goal=press(id),before=cam;cam=goal;
 const v=routeViewport(),points=orbitCurves(o).flatMap(at=>Array.from({length:72},(_,n)=>screen(at(n/72*2*Math.PI)))),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 assert.ok(Math.min(...xs)>=v.left-1&&Math.max(...xs)<=v.right+1&&Math.min(...ys)>=v.top-1&&Math.max(...ys)<=v.bottom+1,'the whole orbit is in the free part of the map: '+id);
 if(goal.span>.00006000001)assert.ok(Math.max((Math.max(...xs)-Math.min(...xs))/(v.right-v.left),(Math.max(...ys)-Math.min(...ys))/(v.bottom-v.top))>.75,'and the orbit fills it: '+id);
 else assert.ok(Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))>=20,'a binary tighter than the deepest zoom is still resolved: '+id);
 assert.ok(goal.span<24,'closer than the catalogue view of a star: '+id);
 cam=before;
}
for(const [id,orbit] of [['sgr',undefined],[OBJECTS.find(o=>o.nuclearStar).id,OBJECTS.find(o=>o.nuclearStar).orbit]]){
 const goal=press(id);NuclearStars.focus(orbit);
 assert.deepEqual(goal,{...cameraGoal},'the nuclear cluster view shows the stars around Sagittarius A*: '+id);
 assert.ok(goal.span<24,'orbits of the nuclear stars are resolved: '+id);
}
const unplaced=OBJECTS.find(o=>o.atlasOnly&&!o.cosmicEpoch&&!o.nuclearStar);
state.selected=unplaced.id;cameraGoal=null;$('objectFocus').onclick();
assert.equal(cameraGoal,null,'an object without a map position leaves the camera in place');
assert.ok($('toast').textContent.length>0,'and says why');
followShip=false;state.selected=initial().selected;

{
const key=name=>ObjectCard.nameKey(name),bare=name=>name.replace(/ \\(имя IAU\\)$/,'');
let marked=0,cleaned=0;
for(const o of OBJECTS){
 const names=ObjectCard.names(o),keys=names.map(name=>key(bare(name))),title=new Set([o.name,...o.name.split(' · ')].map(key)),official=new Set((o.iauNames||[]).map(key));
 assert.equal(new Set(keys).size,keys.length,'a designation is listed once: '+o.id);
 for(const [i,name] of names.entries()){
  assert.ok(keys[i]&&!title.has(keys[i]),'the title is not repeated among the designations: '+o.id+' '+name);
  const query=MapDetails.designationQuery(bare(name));
  assert.ok(!(query&&MapDetails.designationMatches(o,query)),'the designation under the title is not repeated: '+o.id+' '+name);
  assert.equal(name.endsWith(' (имя IAU)'),official.has(keys[i]),'the IAU mark: '+o.id+' '+name);
  assert.ok(!/^(?:NGC|IC)\\d|^(?:NGC|IC) 0|^MESSIER/.test(name),'catalogue numbers are written one way: '+o.id+' '+name);
  if(name.endsWith(' (имя IAU)'))marked++;
 }
 for(const name of o.iauNames||[])assert.ok(title.has(key(name))||keys.includes(key(name)),'an IAU name is never lost: '+o.id+' '+name);
 if(names.length<new Set([...(o.aliases||[]),o.ngc||''].filter(Boolean)).size)cleaned++;
}
assert.ok(marked>50&&cleaned>500,'the clean-up covers the catalogue, not single records: '+marked+' '+cleaned);
assert.deepEqual(ObjectCard.names(object('andromeda')),['Andromeda Galaxy','NGC 224','PGC 2557']);
assert.ok(ObjectCard.names(object('sirius')).includes('Sirius (имя IAU)')&&!ObjectCard.names(object('hyg-32276')).some(name=>name.includes('IAU')||/Gem/.test(name)),'a differing IAU name is marked, a repeated one and the raw designation are dropped');
assert.ok(!ObjectCard.names(object('member-m31-v1')).some(name=>/andromeda|Андромеда/.test(name)),'the host galaxy is not a designation of its star');

const banned=['<dt>Имена IAU','<dt>Другие обозначения','<dt>Каталог NGC','<dt>Абсолютная величина','<dt>Мощность излучения','<dt>Оптический размер','<dt>Масса','<dt>Размер','<dt>Светимость','<dt>Расстояние<','<dt>Созвездие','Компоненты и орбиты</h3>','задаёт отбор','Выборка ограничена','Округлённая оценка.','Источник имени и обозначений'];
const special=['sirius','alpha','proxima','sol','vega','andromeda','orion','omega','horizon','cygnus','opengc-ngc4038','s1','s2','bh-m87','3c273','vela','hyg-32276','hyg-64037','member-m31-v1',...OBJECTS.filter(o=>o.facts?.extra).map(o=>o.id),...OBJECTS.filter(o=>/^blackcat-/.test(o.id)).slice(0,3).map(o=>o.id)];
const checked=[...new Set([...special,...OBJECTS.filter((o,i)=>i%25===0).map(o=>o.id)])];
const seenTitles=new Set();
for(const id of checked){
 const o=object(id),html=card(id),body=details(html),found=tiles(html);
 for(const text of banned)assert.ok(!body.includes(text),'a fact shown above is not repeated below: '+id+' '+text);
 for(const title of sections(html)){assert.ok(order.includes(title),'known section: '+id+' '+title);seenTitles.add(title);}
 assert.ok(count(html,'<h3>Данные</h3>')<=1&&!/<h3>(?:Характеристики|Положение|Имена и каталоги)<\\/h3>/.test(html),'measurements, position and designations share one section: '+id);
 const sources=/<h3>(Источники(?: и примечания)?)<\\/h3>(.*?)<\\/section>/.exec(html);
 if(sources){
  assert.equal(sources[1]==='Источники и примечания',sources[2].includes('class="object-note"'),'the heading promises remarks only when there are some: '+id);
  const urls=[...sources[2].matchAll(/<a href="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(urls).size,urls.length,'a source is linked once: '+id);
  if(o.stellarNameSource)assert.ok(urls.includes(o.stellarNameSource),'the source of names sits with the other sources: '+id);
 }
 if(html.includes('quest-lead'))assert.ok(!html.includes('class="object-lead"'),'the quest story replaces the lead: '+id);
 const extra=o.facts?.extra;
 if(extra){
  const measured=/\\d/.test(plain(extra[1])),tile=['Расстояние','Размер','Масса','Светимость'].find(label=>extra[0].startsWith(label)&&!found[label].missing);
  if(!measured)assert.ok(!body.includes('<dt>'+extra[0]),'a row without a measurement only restates the type: '+id);
  else if(tile)assert.ok(found[tile].tip.includes(extra[0]+': ')&&!body.includes('<dt>'+extra[0]),'a second form of a tile value waits behind its hint: '+id);
  else assert.ok(body.includes('<dt>'+(id==='cygnus'?'Состав':extra[0])),'a measured row stays: '+id+' '+extra[0]);
 }
 const rows=[...body.matchAll(/<dt>([^<]+)/g)].map(m=>m[1]);
 assert.equal(new Set(rows).size,rows.length,'no label twice: '+id);
 const data=/<h3>Данные<\\/h3><dl class="object-facts">(.*?)<\\/dl>/.exec(html)?.[1]||'';
 const at=label=>data.indexOf('<dt>'+label);
 for(const [first,second] of [['Возраст','Galactic XYZ'],['Красное смещение','Galactic XYZ'],['Орбита','Galactic XYZ'],['Galactic XYZ','Направление J2000'],['Направление J2000','Обозначения'],['Galactic XYZ','Обозначения'],['Игровая точка XYZ','Обозначения'],['Опорная галактика','Обозначения']])if(at(first)>=0&&at(second)>=0)assert.ok(at(first)<at(second),'data order: what the object is, then where it is, then how it is listed: '+id+' '+first+' / '+second);
}
for(const title of ['Данные','Источники','Источники и примечания','Система','Система и орбиты'])assert.ok(seenTitles.has(title),'the sample reaches the section '+title);
assert.ok(tiles(card('andromeda'))['Размер'].tip.includes('Оптические оси, как они видны с Земли: '),'the second axis of a galaxy waits behind the size hint');
assert.ok(tiles(card('horizon'))['Размер'].tip.includes('Размер области: ≈ 93 млрд св. лет'),'the diameter of the horizon waits behind its radius');
for(const id of ['s1','s2']){const html=card(id);assert.ok(/<dt>Орбита<details class="info-tip">.*?Траектория рассчитана по опубликованным элементам\\..*?<\\/details><\\/dt>/.test(html)&&sections(html).includes('Источники'),'the remark about an orbit explains the orbit row: '+id);}
for(const o of OBJECTS.filter(o=>/^blackcat-/.test(o.id)).slice(0,3)){const html=card(o.id);assert.equal(count(html,'динамическое подтверждение'),1,'a remark that repeats the lead is printed once: '+o.id);}
assert.ok(ObjectCard.echoes('Исторический кандидат BlackCAT 2015; динамическое подтверждение в этой публикации отсутствует.',ObjectCard.stems('Кандидат в исторической выборке BlackCAT 2015. Эта запись не утверждает современное динамическое подтверждение.'))&&!ObjectCard.echoes('Переменная звезда.',ObjectCard.stems('Переменная звезда в плече Ориона'))&&!ObjectCard.echoes('Релятивистский джет направлен почти к нам.',ObjectCard.stems('Один из первых идентифицированных квазаров.')),'only a sentence that repeats the heading text is an echo');
assert.equal(ObjectCard.about('Видимая величина V задаёт отбор ярких звёзд.'),'','a remark about the sample is not a fact about the object');
assert.equal(ObjectCard.about('Выборка ограничена публикацией; она не является полным современным списком чёрных дыр.'),'');
}
`);
console.log('PASS object card: six uniform key tiles for every record, honest missing values, fixed section order, type explanations, curated leads and deduplicated notes');
console.log('PASS object card hints: explanations and notation behind info hints, readable distance methods and references, no map or flight remarks');
console.log('PASS object types: stars are named from their spectral class and galaxies from their morphology on both cards, with the notation behind the class hint');
console.log('PASS object card layout: one fact in one place — second forms of tile values wait behind the hints, measurements, position and designations share one section, names and remarks are not repeated');
console.log('PASS object focus: the small card centres and zooms the map on any located object, frames planetary, binary and nuclear orbits, and shows no map remarks');
