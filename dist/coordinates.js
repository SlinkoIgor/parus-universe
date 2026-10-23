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
for(const entry of IMPORTED_CATALOG.objects){
 const duplicate=entry.legacyId?originals.find(o=>o.id===entry.legacyId):entry.kind==='star'?originals.find(o=>o.kind==='star'&&known[o.id]&&(entry.hygId!=null&&known[o.id].hygId!=null&&String(known[o.id].hygId)===String(entry.hygId)||(known[o.id].hygId==null&&Number.isFinite(entry.d)&&Math.abs(o.raDeg-entry.raDeg)*Math.cos(entry.decDeg*Math.PI/180)<.02&&Math.abs(o.decDeg-entry.decDeg)<.02&&Math.abs(o.d-entry.d)<o.d*.06))):null;
 if(duplicate){for(const k of ['hygId','hip','hd','ngc','messier','apparentV'])if(entry[k]!==undefined)duplicate[k]=entry[k];duplicate.aliases=[...new Set([...(duplicate.aliases||[]),entry.name,...(entry.aliases||[])])];duplicate.iauNames=[...new Set([...(duplicate.iauNames||[]),...(entry.iauNames||[])])];duplicate.selection=[...new Set([...(duplicate.selection||[]),...(entry.selection||[])])];continue;}
 const located=Number.isFinite(entry.d)&&entry.d>0&&Number.isFinite(entry.raDeg)&&Number.isFinite(entry.decDeg);
 const o={...entry,...(located?Space.point(Space.fromSky(entry.raDeg,entry.decDeg,entry.d)):{p3:null,x:NaN,y:NaN}),navigable:located,index:OBJECTS.length,desc:'Реальный объект: '+entry.catalog+'. '+entry.distanceMethod};
 o.facts={class:entry.type,mass:'Нет индивидуальной оценки в выбранном каталоге.',band:'V',visual:entry.absoluteV==null?null:{absoluteV:entry.absoluteV,solarV:entry.visualLuminositySolar},lumUnknown:entry.visualLuminositySolar==null?entry.luminosityNote:null,note:[entry.luminosityNote,entry.distanceMethod,entry.sizeNote].filter(Boolean).join(' '),refs:[[entry.source,entry.catalog],["catalog-sources.json","Происхождение, преобразования и лицензии"]]};
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
const CATALOG_COUNTS=Object.freeze({get all(){return OBJECTS.length;},get stars(){return OBJECTS.filter(o=>o.kind==='star').length;},get galaxies(){return OBJECTS.filter(o=>o.kind==='galaxy').length;},get pulsars(){return OBJECTS.filter(o=>o.kind==='pulsar').length;}});
