// Reproduce the additive compact-object catalogue offline from published rows.
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {readMapCatalog} from './map-radial-catalog.mjs';
const root='data-tools/black-hole-sources/',read=n=>JSON.parse(fs.readFileSync(root+n));
const blackcat=read('blackcat-2015.json'),supermassive=read('smbh-2013.json'),gaia=read('gaia.json');
const {c,core,objects,manifest,rows:sourceRows}=await readMapCatalog();
const sky=vm.runInContext('Space.fromSky.bind(Space)',c),sourceById=new Map(sourceRows.map(r=>[r[0],r]));
const point=(ra,dec,d)=>Array.from(sky(ra,dec,d)),pc=3.2615637771674336,mpc=pc*1e6;
const norm=s=>String(s).toLowerCase().replace(/^n(?=\d)/,'ngc').replace(/^u(?=\d)/,'ugc').replace(/[\s()-]/g,'').replace(/(ngc|ic|ugc)0+(?=\d)/g,'$1');
const sex=(s,ra=false)=>{const a=s.trim().split(/\s+/).map(Number);return (s.trim().startsWith('-')?-1:1)*(Math.abs(a[0])+a[1]/60+a[2]/3600)*(ra?15:1);};
const estimate=s=>{
 const text=String(s||'').replace(/\^\\ast/g,'').replace(/\\+sim/g,'').trim();
 const a=text.match(/^(\d+(?:\.\d+)?)\^\{\+(\d+(?:\.\d+)?)\}_\{-(\d+(?:\.\d+)?)\}$/);
 if(a)return{value:Number(a[1]),plus:Number(a[2]),minus:Number(a[3]),error:null};
 const m=text.match(/^(\d+(?:\.\d+)?)(?:\s*\\+pm\s*(\d+(?:\.\d+)?))?$/);
 return m?{value:Number(m[1]),error:m[2]?Number(m[2]):null,approximate:/sim/.test(s)}:null;
};
const catalogue=[],hosts=new Map(),unmatched=[],conflicts=[];
for(const r of blackcat.records){
 const distance=estimate(r.distanceKpcRaw),mass=estimate(r.massSolarRaw),located=r.dynamicalInSource&&distance&&(!distance.error||distance.error/distance.value<=.5);
 const d=distance?distance.value*1000*pc:null,ra=sex(r.raHms,true),dec=sex(r.decDms);
 catalogue.push({id:'blackcat-'+norm(r.name),name:r.name,aliases:r.aliases,kind:'blackhole',population:'stellar',confirmed:r.dynamicalInSource,
  p3:located?point(ra,dec,d):null,d,raDeg:ra,decDeg:dec,atlasOnly:!located,
  distanceErrorLy:distance?.error?distance.error*1000*pc:null,
  positionReason:!r.dynamicalInSource?'Исторический кандидат BlackCAT 2015; динамическое подтверждение в этой публикации отсутствует.':!distance?'В каталоге нет точечной дальности: пустое поле, предел или диапазон.':'Опубликованная относительная ошибка расстояния превышает 50%.',
  ...(mass?{massSolar:mass.value,massUncertaintySolar:mass.error,massErrorPlusSolar:mass.plus,massErrorMinusSolar:mass.minus}:{}),massRaw:r.massSolarRaw||null,
  source:blackcat.source,sourceRecord:r,coordinateEpoch:'J2000',distanceMethod:'Дальность из таблицы BlackCAT; пределы и диапазоны не превращаются в точки.',
 });
}
const byName=new Map();
for(const o of objects){if(o.kind!=='galaxy')continue;for(const value of [o.name,...(o.aliases||[]),o.ngc]){if(!value)continue;const key=norm(value);if(!byName.has(key))byName.set(key,new Map());byName.get(key).set(o.id,o);}}
const grouped=new Map();
for(const row of supermassive.records){
 const name=row[0].match(/^(N\d+[A-Z]?|U\d+[A-Z]?|IC\s*\d+[A-Z]?|Circinus|A\d+-BCG|M\d+|Milky Way)/)?.[0];
 if(!name)throw Error('Unparsed galaxy identifier: '+row[0]);
 const key=norm(name);if(!grouped.has(key))grouped.set(key,{name,rows:[]});grouped.get(key).rows.push(row);
}
for(const {name,rows} of grouped.values()){
 if(name==='Milky Way')continue; // Retain the newer existing Sgr A* solution.
 const candidates=[...(byName.get(norm(name))?.values()||[])].filter(o=>!o.atlasOnly&&o.p3?.every(Number.isFinite));
 candidates.sort((a,b)=>Number(core.includes(b))-Number(core.includes(a))||a.id.localeCompare(b.id));
 const host=candidates[0];
 if(candidates.length>1&&!core.includes(host)&&candidates.some(o=>Math.hypot(...o.p3.map((x,i)=>x-host.p3[i]))>1000))throw Error('Ambiguous host '+name);
 const id=host?'bh-'+host.id:'bh-'+norm(name),d=host?.d??null;
 const estimates=rows.map(row=>{const m=row[1].match(/^([\d.]+)\s*\(([\d.]+),([\d.]+)\)\s*e(\d+)$/);if(!m)throw Error('Unparsed BH mass '+row[1]);const scale=d?d/(Number(row[9])*mpc):1,factor=10**Number(m[4])*scale;return{solar:Number(m[1])*factor,plus:Number(m[2])*factor,minus:Number(m[3])*factor,adoptedDistanceScale:scale,sourceDistanceMpc:Number(row[9]),method:row[10],sourceRow:row};});
 if(!host)unmatched.push(name);
 if(estimates.length>1)conflicts.push(name);
 if(host)hosts.set(host.id,{...Object.fromEntries(['id','name','kind','p3','d','mapPosition','mapOffset','parentGalaxy','cosmology','raDeg','decDeg','diameterLy','galaxy','coordinateSource','source','referenceURL'].filter(k=>host[k]!==undefined).map(k=>[k,host[k]])),...(!core.includes(host)?{catalogRow:sourceById.get(host.id)}:{})});
 const label=name.startsWith('N')?name.replace(/^N/,'NGC '):name.startsWith('U')?name.replace(/^U/,'UGC '):name;
 catalogue.push({id,name:host?.id==='andromeda'?'M31*':host?.id==='m87'?'M87*':'Чёрная дыра · '+label,
  mapLabel:host?.id==='andromeda'?'M31* · Андромеда':host?.id==='m87'?'M87* · первое изображение':label+' · чёрная дыра',
  aliases:[label,...(host?.id==='andromeda'?['Чёрная дыра Андромеды','Andromeda black hole']:host?.id==='m87'?['Первое изображение чёрной дыры','M87 black hole','Powehi']:[])],
  kind:'blackhole',population:'supermassive',confirmed:true,parentGalaxy:host?.id,distanceHost:host?.id,
  hostDiameterLy:host?.galaxy?.diameterLy||host?.diameterLy||null,p3:host?.p3||null,d,atlasOnly:!host,
  positionReason:'Галактика-хозяин не сопоставлена однозначно с картографическим каталогом; координаты не назначены.',
  // NGC1399 has two incompatible published solutions. Do not invent a mean.
  ...(estimates.length===1?{massSolar:estimates[0].solar,massErrorPlusSolar:estimates[0].plus,massErrorMinusSolar:estimates[0].minus}:{}),
  estimates,source:supermassive.source,coordinateEpoch:'Каталожный центр галактики',distanceMethod:'Положение ядра и дальность принятой галактики-хозяина; дополнительная глубина не назначается. Масса и её ошибки линейно пересчитаны к принятой дальности, без добавления неизвестной ошибки самой дальности.',
 });
}
for(const q of gaia.records){
 const parallax=estimate(q.parallaxMasRaw),mass=estimate(q.massSolarRaw);if(!parallax||!mass)throw Error('Unparsed Gaia solution');
 const d=1000/parallax.value*pc;
 catalogue.push({...q,aliases:[q.name.replace('BH','BH ')],kind:'blackhole',population:'stellar',confirmed:true,d,p3:point(q.raDeg,q.decDeg,d),atlasOnly:false,
  massSolar:mass.value,massUncertaintySolar:mass.error,distanceErrorLy:d*parallax.error/parallax.value,
  distanceMethod:'Обратный орбитальный параллакс опубликованного решения. Малое смещение чёрной дыры относительно неразрешённой системы не моделируется.',sourceRecord:q});
}
// Prefer the existing, independently sourced EHT mass over the older stellar fit.
const m87=catalogue.find(q=>q.id==='bh-m87');m87.estimates.push({solar:6.5e9,source:'https://science.nasa.gov/resource/first-image-of-a-black-hole/',basis:'EHT first image; NASA gives approximately 6.5 billion solar masses; no numerical uncertainty on this page.'});
Object.assign(m87,{massSolar:6.5e9,massSource:m87.estimates.at(-1).source,massErrorPlusSolar:null,massErrorMinusSolar:null});
const revision=crypto.createHash('sha256').update(manifest.revision+JSON.stringify(catalogue)).digest('hex').slice(0,12);
const data={version:1,revision,baseCatalogRevision:manifest.revision,sources:[blackcat.source,supermassive.source,...gaia.records.map(r=>r.source)],hosts:[...hosts.values()],objects:catalogue};
fs.writeFileSync('dist/black-hole-catalog-data.js',"'use strict';\n// Reproducible additive catalogue; provenance and units: data-tools/black-hole-sources/.\nconst BLACK_HOLE_CATALOG_DATA="+JSON.stringify(data)+';\n');
const audit={revision,baseCatalogRevision:manifest.revision,objects:catalogue.length,mapped:catalogue.filter(q=>!q.atlasOnly).length,atlasOnly:catalogue.filter(q=>q.atlasOnly).length,populations:Object.fromEntries(['stellar','supermassive'].map(p=>[p,catalogue.filter(q=>q.population===p).length])),unmatchedHosts:unmatched,incompatibleMassSolutions:conflicts,sourceEstimates:supermassive.records.length,uniqueSupermassiveHosts:grouped.size,existingSgrPreserved:true,filamentsUnchanged:true};
fs.writeFileSync('data-tools/black-hole-catalog-audit.json',JSON.stringify(audit,null,2)+'\n');
const html=fs.readFileSync('dist/index.html','utf8');
fs.writeFileSync('dist/index.html',html.replace(/(black-hole-catalog-data\.js\?v=)[^"\s]+/,(_,prefix)=>prefix+revision));
console.log(JSON.stringify(audit));
