'use strict';
// ICRS/J2000 -> heliocentric Galactic Cartesian, IAU/ESA Gaia DR3 convention.
// Orthographic display: (X,-Y); Z is retained for EVERY physical route calculation.
const Space={
 matrix:[[-.0548755604162154,-.8734370902348850,-.4838350155487132],[.4941094278755837,-.4448296299600112,.7469822444972189],[-.8676661490190047,-.1980763734312015,.4559837761750669]],
 fromSky(raDeg,decDeg,d){const a=raDeg*Math.PI/180,b=decDeg*Math.PI/180,v=[d*Math.cos(a)*Math.cos(b),d*Math.sin(a)*Math.cos(b),d*Math.sin(b)];return this.matrix.map(row=>row.reduce((s,x,i)=>s+x*v[i],0));},
 point(p3){return{x:p3[0],y:-p3[1],p3:[...p3]};},
 distance(a,b){return a.p3&&b.p3?Math.hypot(...a.p3.map((v,i)=>v-b.p3[i])):Math.hypot(a.x-b.x,a.y-b.y);},
 mix(a,b,t){if(a.p3&&b.p3)return this.point(a.p3.map((v,i)=>v+(b.p3[i]-v)*t));return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
};
const known=IMPORTED_CATALOG.knownCoordinates;
for(const o of OBJECTS){
 if(o.id==='sol'){Object.assign(o,Space.point([0,0,0]),{navigable:true});continue;}
 const k=known[o.id];if(!k){o.navigable=false;o.coordinateNote='Ориентир атласа: положение схематично, не используется в физических маршрутах.';continue;}
 Object.assign(o,Space.point(Space.fromSky(k.raDeg,k.decDeg,o.d)),{raDeg:k.raDeg,decDeg:k.decDeg,coordinateSource:k.source,navigable:true,coordinateNote:k.coordinateNote||'Каталожное направление J2000; движение за время экспедиции не моделируется.'});
}
const originals=OBJECTS.slice();
// Review complete destinations explicitly. A shared common name alone does
// not identify two physical regions (e.g. the separate Eastern Veil portions).
const CatalogIdentities={
 groups:IMPORTED_CATALOG.identityPolicy?.groups||[],
 get redirects(){return this.redirectCache??=Object.fromEntries(this.groups.flatMap(g=>g.members.filter(id=>id!==g.target).map(id=>[id,g.target])));},
 prepare(entry){
  const group=this.groups.find(g=>g.target===entry.id);
  if(group){
   const components=group.members.map(id=>IMPORTED_CATALOG.objects.find(o=>o.id===id));
   if(components.some(o=>!o))throw Error('Missing component of '+group.id);
   return {...entry,name:group.name,type:group.type,catalogIdentity:group.id,
    catalogIdentityLabel:group.label,catalogIdentityDescription:group.description,
    catalogObjectIds:group.members,catalogComponents:components.map(o=>({...o})),
    catalogComponentUnits:{d:'ly',raDeg:'deg',decDeg:'deg',diameterLy:'ly',minorDiameterLy:'ly',angularMajorArcmin:'arcmin',angularMinorArcmin:'arcmin',positionAngleDeg:'deg'},
    catalogIdentityNote:group.note,catalogIdentitySources:group.sources,
    aliases:[...new Set(components.flatMap(o=>[o.name,o.ngc,...o.aliases||[]]).filter(Boolean))]};
  }
  const distinct=IMPORTED_CATALOG.identityPolicy?.distinct.find(g=>g.names&&g.members.includes(entry.id));
  return distinct?{...entry,name:distinct.names[distinct.members.indexOf(entry.id)],aliases:[...new Set([entry.name,...entry.aliases||[]])]}:entry;
 },
};
// Merging an existing landmark must retain measured angular extents. Reuse the
// landmark's adopted distance later; do not import a size derived at another d.
function mergeNebulaSize(target,entry){
 if(target.kind!=='nebula'||!(entry.angularMajorArcmin>0)||target.angularMajorArcmin>0)return;
 for(const field of ['angularMajorArcmin','angularMinorArcmin','positionAngleDeg'])if(entry[field]!=null)target[field]=entry[field];
 target.angularSizeSource='https://github.com/mattiaverga/OpenNGC';
}
for(const sourceEntry of IMPORTED_CATALOG.objects){
 if(CatalogIdentities.redirects[sourceEntry.id])continue;
 const entry=CatalogIdentities.prepare(sourceEntry);
 const duplicate=entry.legacyId?originals.find(o=>o.id===entry.legacyId):entry.kind==='star'?originals.find(o=>o.kind==='star'&&known[o.id]&&(entry.hygId!=null&&known[o.id].hygId!=null&&String(known[o.id].hygId)===String(entry.hygId)||(known[o.id].hygId==null&&Number.isFinite(entry.d)&&Math.abs(o.raDeg-entry.raDeg)*Math.cos(entry.decDeg*Math.PI/180)<.02&&Math.abs(o.decDeg-entry.decDeg)<.02&&Math.abs(o.d-entry.d)<o.d*.06))):null;
 if(duplicate){for(const k of ['hygId','hip','hd','ngc','messier','apparentV'])if(entry[k]!==undefined)duplicate[k]=entry[k];mergeNebulaSize(duplicate,entry);duplicate.aliases=[...new Set([...(duplicate.aliases||[]),entry.name,...(entry.aliases||[])])];duplicate.iauNames=[...new Set([...(duplicate.iauNames||[]),...(entry.iauNames||[])])];duplicate.selection=[...new Set([...(duplicate.selection||[]),...(entry.selection||[])])];continue;}
 const located=Number.isFinite(entry.d)&&entry.d>0&&Number.isFinite(entry.raDeg)&&Number.isFinite(entry.decDeg);
 const o={...entry,...(located?Space.point(Space.fromSky(entry.raDeg,entry.decDeg,entry.d)):{p3:null,x:NaN,y:NaN}),navigable:located,index:OBJECTS.length,desc:entry.distanceMethod};
 o.facts={class:entry.type,mass:'Нет индивидуальной оценки в выбранном каталоге.',band:'V',visual:entry.absoluteV==null?null:{absoluteV:entry.absoluteV,solarV:entry.visualLuminositySolar},lumUnknown:entry.visualLuminositySolar==null?entry.luminosityNote:null,note:[entry.luminosityNote,entry.distanceMethod,entry.sizeNote].filter(Boolean).join(' '),refs:[[entry.source,entry.catalog],["catalog-sources.json","Происхождение, преобразования и лицензии"]]};
 if(entry.catalogIdentityNote){o.desc=entry.catalogIdentityDescription;o.facts.note+=' '+entry.catalogIdentityNote;o.facts.refs.push(...entry.catalogIdentitySources);}
 if(!located)o.coordinateNote='Не хватает надёжного расстояния или направления для полной 3D-позиции. Объект присутствует в атласе; точка физического маршрута недоступна.';
 if(entry.periodSeconds)o.facts.extra=['Период вращения',entry.periodSeconds.toLocaleString('ru-RU',{maximumSignificantDigits:6})+' с'];
 if(entry.kind==='galaxy'&&located&&entry.diameterLy){
  const g={id:o.id,name:o.name,x:o.x,y:o.y,diameterLy:entry.diameterLy,axisRatio:entry.minorDiameterLy/entry.diameterLy||1,shape:/^E|^S0/.test(entry.hubbleType)?'elliptical':/^I/.test(entry.hubbleType)?'irregular':'spiral',rotation:(entry.positionAngleDeg||0)*Math.PI/180};o.galaxy=g;GALAXIES.push(g);
 }
 OBJECTS.push(o);
}
// Only explicitly catalogued black holes are gravitational turning points.
for(const o of OBJECTS){
 const bh={cygnus:21.2,sgr:4.3e6,m87:6.5e9}[o.id];
 if(bh)o.gravity={kind:'blackhole',massSolar:bh,radiusMeters:0,note:'Поворот вокруг чёрной дыры. Метрика Шварцшильда; вращение, аккреционный диск и джет не моделируются.'};
 if(o.galaxy)Object.assign(o.galaxy,{x:o.x,y:o.y});
}
Object.assign(GALAXIES[0],{x:OBJECTS.find(o=>o.id==='sgr').x,y:OBJECTS.find(o=>o.id==='sgr').y,axisRatio:1});
// Every drawn host needs a galaxy identity for source cross-matching. A nucleus
// is a different physical class; sharing its centre must not merge their IDs.
for(const g of GALAXIES){
 if(OBJECTS.some(o=>o.id===g.id)||!g.coordinateHost)continue;
 const host=OBJECTS.find(o=>o.id===g.coordinateHost);if(!host?.p3)continue;
 const o={id:g.id,name:g.name,kind:'galaxy',type:'Спиральная галактика',aliases:g.aliases||[],
  ...Space.point(host.p3),d:host.d,raDeg:host.raDeg,decDeg:host.decDeg,
  coordinateHost:g.coordinateHost,coordinateModel:'galaxy-center-v1',coordinateSource:host.coordinateSource,
  coordinateNote:'Положение центра галактики совпадает с принятым положением её ядра.',
  navigable:true,index:OBJECTS.length,galaxy:g,diameterLy:g.diameterLy,
  desc:'Наша спиральная галактика. Солнце находится внутри её диска.',
  facts:{class:'Спиральная галактика',mass:'Полная масса галактики здесь не назначена.',lumUnknown:'Индивидуальная болометрическая светимость здесь не задана.',
   note:'Расстояние относится к центру галактики, а не к другой галактике за её пределами. Оптический диаметр диска — около 100 тысяч световых лет.',refs:[...(host.facts?.refs||[])]}};
 OBJECTS.push(o);
}
const CATALOG_COUNTS=Object.freeze({get all(){return OBJECTS.length;},get stars(){return OBJECTS.filter(o=>o.kind==='star').length;},get galaxies(){return OBJECTS.filter(o=>o.kind==='galaxy').length;},get pulsars(){return OBJECTS.filter(o=>o.kind==='pulsar').length;}});
