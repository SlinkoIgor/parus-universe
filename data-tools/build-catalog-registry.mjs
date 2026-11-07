// Discover the actual source union, including atlas-only rows and additive layers.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readMapCatalog} from './map-radial-catalog.mjs';

export async function buildCatalogRegistry({check=false}={}) {
  const state = await readMapCatalog({supplement:true});
  const {c,rows,core,pointer,manifest} = state;
  const modules = ['black-hole-catalog-data','black-hole-catalog','nuclear-stars-data','nuclear-stars',
    'universe-map','map-geometry-data','map-geometry','catalog-registry'];
  vm.runInContext(modules.map(n=>fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),c);
  const registry = c.CatalogRegistry, catalog = vm.runInContext('ExtendedCatalog',c);
  const search = JSON.parse(fs.readFileSync('dist/'+pointer.dataRoot+'/search.json','utf8'));
  const leaves = new Set(manifest.nodes.filter(n=>!n.children.length).map(n=>n.file));
  const extraFiles = [...new Set(search.map(r=>r[5]))].filter(f=>!leaves.has(f));
  const extraRows = [];
  for (const file of extraFiles) extraRows.push(...JSON.parse(fs.readFileSync('dist/'+pointer.dataRoot+'/'+file,'utf8')));
  const objects = [...new Map([...rows,...extraRows].map(r=>[r[0],catalog.coreIndex.get(r[0]) || catalog.decode(r)])
    .concat(core.map(o=>[o.id,o]))).values()].filter(o=>!o.supersededBy);
  const names = new Map(), urls = new Map();
  const learn = (name,url) => {
    if (!name) return;
    const id = registry.key(name); names.set(id,names.get(id) || name);
    if (/^https?:\/\//.test(url || '')) {
      if (!urls.has(url)) urls.set(url,new Set());
      urls.get(url).add(id);
    }
  };
  for (const o of objects) {
    // Merged core objects can keep the name of one catalogue and the adopted
    // URL of another. Learn catalogue links from direct source rows instead;
    // each merged measurement still contributes its own explicit reference.
    const direct = (o.streamed || o.distantCatalog) && !o.distanceHost;
    learn(registry.primary(o),direct ? o.referenceURL || o.source : null);
    learn(registry.sourceCatalog(o),o.source);
    for (const m of o.catalogMeasurements || []) learn(m.catalog,m.source);
  }
  const entries = new Map();
  const details = vm.runInContext('MapDetails',c);
  const classOf = o=>o.kind==='home'?'star':o.kind==='cluster'?details.group(o):
    ['wall','ring','arc'].includes(o.kind)?'structure':o.kind;
  const get = id=>{
    if (!entries.has(id)) entries.set(id,{id,name:registry.titles[id] || names.get(id) || id,total:0,mapped:0,defaultSelected:false,categories:new Set(),urls:new Set()});
    return entries.get(id);
  };
  for (const o of objects) {
    const mapped = o.cosmicEpoch || !o.atlasOnly && !c.MapGeometry.unlocated(o);
    for (const id of registry.memberships(o)) {
      const e = get(id); e.total++; if (mapped) e.mapped++;
      if (!registry.defaultHidden(o)) e.defaultSelected = true;
      e.categories.add(classOf(o)); e.categories.add(o.kind);
      if (classOf(o) === 'structure') for (const kind of ['filament','supercluster','wall','ring','arc']) e.categories.add(kind);
    }
  }
  for (const [url,ids] of urls) for (const id of ids) if (entries.has(id)) get(id).urls.add(url);
  const baseSources = catalog.sources;
  for (const [name,[url]] of Object.entries(baseSources)) if (entries.has(registry.key(name))) get(registry.key(name)).urls.add(url);
  const provenance = JSON.parse(fs.readFileSync('dist/catalog-sources.json','utf8'));
  for (const p of provenance.provenance) {
    const id = /IAU WGSN/.test(p.name)?'iau':/^SIMBAD/.test(p.name)?'simbad':/Hipparcos new reduction/.test(p.name)?'hipparcos-2007':null;
    if (id && entries.has(id)) get(id).urls.add(p.url);
  }
  for (const id of ['blackholes','nuclear-stars','literature','cosmology']) {
    for (const o of objects) if (registry.memberships(o).includes(id)) for (const u of registry.urls(o)) get(id).urls.add(u);
  }
  get('game').categories.add('star');
  get('game').defaultSelected = true; // Arrival stars are enabled before the first discovery.
  const order = ['hyg','opengc','atnf','nearby','cf4','blackholes'];
  const descriptions = {
    hyg:'Звёзды: положения, расстояния и яркость из HYG, включая записи с уточнениями других источников.',
    opengc:'Галактики, туманности и звёздные скопления из каталогов NGC и IC.',
    atnf:'Пульсары: нейтронные звёзды с измеренными периодами вращения.',
    nearby:'Близкие галактики из Updated Nearby Galaxy Catalog.',
    cf4:'Галактики с оценками расстояний из Cosmicflows-4.',
    globularmodels:'Шаровые звёздные скопления с моделями Baumgardt.',
    'ccpc-ii':'Кандидаты в протоскопления галактик в ранней Вселенной.',
    'gaia-clusters':'Звёздные скопления Млечного Пути из обзора Hunt–Reffert по данным Gaia.',
    glade:'Выборка ярких галактик GLADE+ со спектроскопическими красными смещениями.',
    'hipparcos-2007':'Звёзды с астрометрией Hipparcos 2007: положения, параллаксы и собственные движения.',
    iau:'Звёзды с собственными именами, утверждёнными Международным астрономическим союзом.',
    'jades-dr4':'Галактики и спектроскопические цели JWST, в том числе в ранней Вселенной. Цели без известной глубины доступны только в поиске.',
    lggs:'Массивные звёзды и области ионизованного водорода в Андромеде и Треугольнике.',
    'm33-snr-long-2018':'Подтверждённые остатки сверхновых в галактике Треугольника.',
    'mcxc-ii':'Скопления галактик, обнаруженные в рентгеновских обзорах.',
    msc:'Кратные звёздные системы: тройные и системы с большим числом компонентов.',
    nasa:'Отдельные объекты по материалам NASA, включая звёздное скопление Плеяды.',
    ogle:'Звёзды-цефеиды Большого и Малого Магеллановых Облаков.',
    orb6:'Двойные звёзды с опубликованными орбитами визуально разделяемых компонентов.',
    'phat-ap':'Звёздные скопления Андромеды. Доступны в поиске; неизвестная глубина не позволяет разместить их на 3D-карте.',
    'nuclear-stars':'Звёзды возле Стрельца A* с опубликованными данными об орбитах.',
    sb9:'Спектроскопические двойные звёзды: орбиты, определённые по движению спектральных линий.',
    'sdss-voids':'Космические пустоты — области пониженной плотности галактик в обзоре SDSS.',
    'sdss-filaments':'Космические нити — вытянутые цепочки галактик в обзоре SDSS.',
    'sdss-superclusters':'Сверхскопления галактик из обзора SDSS.',
    simbad:'Отдельные астрономические объекты с данными и отождествлениями из SIMBAD.',
    literature:'Индивидуальные объекты из научных публикаций и справочных материалов. Это сборная группа, не отдельный научный каталог.',
    game:'Звёзды, созданные при прибытии в экспедиции. Игровые объекты, не наблюдательный каталог.',
    cosmology:'Модельные эпохи и горизонты. Это космологическая модель, не каталог наблюдаемых тел.',
    blackholes:'Сводная группа чёрных дыр, включая Стрелец A* и Лебедь X-1. Статусы кандидатов и источники сохранены в карточках.',
  };
  const categoryNames = {star:'звёзды',home:'звёзды',pulsar:'пульсары',blackhole:'чёрные дыры',quasar:'квазары',
    nebula:'туманности',galaxy:'галактики','stellar-cluster':'звёздные скопления','galaxy-cluster':'скопления галактик',
    structure:'мегаструктуры',void:'космические пустоты',horizon:'космологические горизонты'};
  const data = {version:1,catalogRevision:manifest.revision,manifest:pointer.manifest,total:objects.length,
    entries:[...entries.values()].sort((a,b)=>{
      const rank=id=>order.includes(id)?order.indexOf(id):order.length;
      return rank(a.id)-rank(b.id) || a.name.localeCompare(b.name,'ru');
    }).map(e=>({...e,categories:[...e.categories].filter(Boolean).sort(),urls:[...e.urls].sort(),
      description:descriptions[e.id] || 'Содержит: '+([...new Set([...e.categories].map(k=>categoryNames[k]).filter(Boolean))].sort().join(', ') || 'астрономические объекты')+'.'}))};
  const content = "'use strict';\n// Generated by data-tools/build-catalog-registry.mjs from the active records.\nconst CATALOG_REGISTRY_DATA="+JSON.stringify(data)+';\n';
  const file = 'dist/catalog-registry-data.js';
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file,'utf8') !== content) throw Error('Catalogue registry is stale: node data-tools/build-map-filter-index.mjs');
  } else {
    fs.writeFileSync(file,content);
    let html = fs.readFileSync('dist/index.html','utf8');
    for (const name of ['catalog-registry-data','catalog-registry']) {
      const revision = crypto.createHash('sha256').update(fs.readFileSync('dist/'+name+'.js')).digest('hex').slice(0,12);
      html = html.replace(new RegExp('('+name+'\\.js\\?v=)[^" ]+'),(_,p)=>p+revision);
    }
    fs.writeFileSync('dist/index.html',html);
  }
  vm.runInContext(content,c); registry.cache = new WeakMap();
  return {...state,objects,search,data};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {data} = await buildCatalogRegistry({check:process.argv.includes('--check')});
  console.log(JSON.stringify({sources:data.entries.length,objects:data.total,catalogRevision:data.catalogRevision}));
}
