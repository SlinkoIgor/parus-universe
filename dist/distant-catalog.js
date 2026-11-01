'use strict';
// Additive catalogue: base tile revisions and all established positions stay fixed.
const DistantCatalog={
 data:DISTANT_CATALOG_DATA,objects:[],
 init(){
  for(const q of this.data.objects){
   const cluster=q.kind==='cluster',o={...q,...Space.point(q.p3),index:OBJECTS.length,distantCatalog:true,streamed:false,cosmicLandmark:true,source:q.referenceURL,positionQuality:'approximate',navigable:!q.atlasOnly,sizeUnknown:true,...(cluster?{catalogClass:'galaxy-cluster',arrivalAnchor:true}:{}),aliases:[q.id,...(q.observations||[]).map(r=>r.observationID)]};
   o.type=cluster?'Кандидат в протоскопление · CCPC-II':'Галактика · JADES DR4';
   o.desc=cluster?'Кандидат в протоскопление: спектроскопические красные смещения '+q.members+' галактик. Символ обозначает каталожный центр; форма и граница структуры не измерены.':'Спектроскопическая цель JWST в участке неба '+(q.field==='gn'?'GOODS-N':'GOODS-S')+'. Качество красного смещения: '+q.quality+'. Объединено наблюдений: '+q.observations.length+'.';
   o.coordinateNote='J2000. Современная сопутствующая дальность рассчитана по z в модели атласа H₀=70, Ωm=0,3. Видимость древнего света не означает достижимость сигнала, отправленного сейчас.';
   const note=cluster?'z = '+q.redshift+' ± '+q.redshiftError+'. Эффективный радиус Re = '+q.effectiveRadiusMpc+' Мпк из CCPC-II — не измеренная граница и не радиус компактного тела.':'Поле обзора — участок неба, не физическая структура. NIRCam DR5 используется для сопоставления; NIRSpec ID локален для программы. Погрешность z в Obs_info не дана; A/B/C не являются σ.';
   o.facts={class:o.type,mass:'Индивидуальная масса в этой импортированной выборке не задана.',lumUnknown:'Болометрическая светимость не приведена.',note,refs:[[q.referenceURL,q.catalog]]};
   if(cluster){const r=q.catalogData,values=[];if(r.Mass)values.push('Mvir ≈ '+r.Mass+'·10¹⁴ M☉');if(r.OME)values.push('Mδ '+(r.l_OME||'≈')+' '+r.OME+'·10¹⁴ M☉');o.facts.mass=values.length?'Ориентировочные модельные оценки: '+values.join('; ')+'. Не масса компактного тела; погрешность в таблице не дана.':'Модельная масса для этой строки в CCPC-II не приведена.';}
   if(q.atlasOnly){o.positionReason='Наблюдения одного фотометрического источника дают несовместимые z или координаты. Сохранён в атласе до уточнения; положение на карте не назначается.';o.coordinateNote=o.positionReason;}
   OBJECTS.push(o);this.objects.push(o);ExtendedCatalog.coreIndex.set(o.id,o);
  }
  for(const m of this.data.matches){const o=ExtendedCatalog.get(m.targetId);if(!o)throw Error('Нет сопоставленной цели '+m.targetId);o.catalogMeasurements=[...(o.catalogMeasurements||[]),{catalog:m.measurement.catalog,sourceId:m.sourceId,source:m.measurement.referenceURL,distanceLy:m.measurement.d,redshift:m.measurement.redshift,observations:m.measurement.observations,basis:m.basis}];o.aliases=[...new Set([...(o.aliases||[]),m.sourceId,...(m.measurement.observations||[]).map(r=>r.observationID)])];o.facts.refs.push([m.measurement.referenceURL,m.measurement.catalog]);}
  // Two independently sourced overview anchors; all other names appear only
  // at finer scales. Metadata stays independent of pan, hover and selection.
  const candidates=this.objects.filter(o=>o.candidate&&!o.atlasOnly),anchors=new Set([candidates.reduce((a,b)=>!a||b.d>a.d?b:a,null)?.id,candidates.reduce((a,b)=>!a||b.members>a.members?b:a,null)?.id]);
  for(const o of this.objects){if(o.atlasOnly)continue;const limit=anchors.has(o.id)?1e10:o.d/(o.candidate?600:6000);MAP_LABEL_BOOT.entries.push({id:o.id,name:o.name,limits:[limit,limit],minPixel:0});}
  MapAnnotations.index=null;
 },
 draw(){
  const overview=cam.span>=3e10;
  for(const o of this.objects){
   if(o.atlasOnly||!ExtendedCatalog.matchesMap(o)||!MapDetails.visible(o,cam.span)||overview&&!o.candidate&&o.d<Cosmology.horizon(0)&&o.id!==state.selected)continue;
   const p=screen(o);if(p.x<0||p.x>width||p.y<0||p.y>height)continue;
   const selected=o.id===state.selected;ctx.save();ctx.globalAlpha=(selected?1:o.candidate?o.best?.8:.45:.28)*ExtendedCatalog.opacity(o);
   ctx.strokeStyle=ctx.fillStyle=paint('#454545');ctx.lineWidth=.8;
   if(o.candidate){const r=selected?4:o.best?2.8:2;ctx.beginPath();ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x+r,p.y);ctx.lineTo(p.x,p.y+r);ctx.lineTo(p.x-r,p.y);ctx.closePath();ctx.stroke();}
   else{ctx.beginPath();ctx.arc(p.x,p.y,selected?2.5:.65,0,2*Math.PI);ctx.fill();}
   if(selected)circle(p.x,p.y,8,'#454545',.8,[2,3]);ctx.restore();hitObjects.push({o,p,r:selected?8:5,background:!o.candidate});
  }
 }
};
globalThis.DistantCatalog=DistantCatalog;
DistantCatalog.init();
