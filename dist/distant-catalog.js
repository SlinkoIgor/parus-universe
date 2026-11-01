'use strict';
// Additive registration only. The ordinary map renderer and global hierarchy
// handle these records alongside the base catalogue in every projection.
const DistantCatalog={
 data:DISTANT_CATALOG_DATA,objects:[],
 init(){
  for(const q of this.data.objects){
   const cluster=q.kind==='cluster',located=!q.atlasOnly&&q.p3?.every(Number.isFinite),o={...q,...(located?Space.point(q.p3):{p3:null}),index:OBJECTS.length,distantCatalog:true,streamed:false,source:q.referenceURL,positionQuality:located?'approximate':'unknown',navigable:located,sizeUnknown:true,...(cluster?{catalogClass:'galaxy-cluster',arrivalAnchor:true}:{}),aliases:[q.id,...(q.observations||[]).map(r=>r.observationID)]};
   o.type=cluster?(q.objectOfInterest?'Объект интереса · CCPC-II':'Кандидат в протоскопление · CCPC-II'):q.kind==='unknown'?'Спектроскопическая цель · JADES DR4':'Галактика · JADES DR4';
   const quality={A:'высоко надёжное, эмиссионные линии R≈1000',B:'высоко надёжное, эмиссионные линии Prism/Clear',C:'надёжное, спектральные разрывы или слабые линии',D:'предварительное',E:'красное смещение не определено'}[q.quality];
   o.desc=cluster?(q.objectOfInterest?'Объект интереса из дополнительной таблицы CCPC-II; не включён в основной список кандидатов в протоскопления. ':'Возможный предшественник скопления галактик. ')+ 'Сгущение из '+q.members+' галактик на близких красных смещениях. Статус кандидата не гарантирует образование скопления. Символ обозначает каталожный центр, форма и граница структуры не измерены.':'Спектроскопическая цель JWST в участке неба '+(q.field==='gn'?'GOODS-N':'GOODS-S')+'. Качество z: '+q.quality+' — '+quality+'. Объединено наблюдений: '+q.observations.length+'.';
   o.coordinateNote='J2000. Современная сопутствующая дальность рассчитана по z в модели атласа H₀=70, Ωm=0,3. Видимость древнего света не означает достижимость сигнала, отправленного сейчас.';
   const note=cluster?(q.redshiftStatistic==='mean'?'Среднее':'Медианное')+' z = '+q.redshift+(q.redshiftError>0?' ± '+q.redshiftError:'. Погрешность z в этой таблице не дана')+'. Эффективный радиус Re = '+q.effectiveRadiusMpc+' Мпк из CCPC-II — не измеренная граница и не радиус компактного тела.':'JADES наблюдал два узких поля GOODS-S и GOODS-N. Объекты на разных расстояниях образуют на карте лучи: это покрытие обзора, не физические нити. Вне этих полей отсутствие точек не означает отсутствие галактик. NIRCam DR5 используется для сопоставления; NIRSpec ID локален для программы. Погрешность z в Obs_info не дана; флаги качества не являются σ. На карту допускаются положительные z качества A/B/C. D — предварительное z, E — z не определено; эти наблюдения сохранены в данных.';
   o.facts={class:o.type,mass:'Индивидуальная масса в этой импортированной выборке не задана.',lumUnknown:'Болометрическая светимость не приведена.',note,refs:[[q.referenceURL,q.catalog]]};
   if(cluster){const r=q.catalogData,values=[];if(r.Mass)values.push('Mvir ≈ '+r.Mass+'·10¹⁴ M☉');if(r.OME)values.push('Mδ '+(r.l_OME||'≈')+' '+r.OME+'·10¹⁴ M☉');o.facts.mass=values.length?'Ориентировочные модельные оценки: '+values.join('; ')+'. Не масса компактного тела; погрешность в таблице не дана.':'Модельная масса для этой строки в CCPC-II не приведена.';}
   if(!located){o.positionReason=q.positionReasonCode==='conflicting-observations'?'Надёжные наблюдения одного фотометрического источника дают несовместимые z или координаты. Сохранён в атласе до уточнения; положение на карте не назначается.':'Нет принятого положительного спектроскопического z качества A/B/C. Дальность и тип объекта не установлены; предварительные измерения сохранены в исходных наблюдениях. Только атлас.';o.coordinateNote=o.positionReason;}
   OBJECTS.push(o);this.objects.push(o);ExtendedCatalog.coreIndex.set(o.id,o);
  }
  for(const m of this.data.matches){const o=ExtendedCatalog.get(m.targetId);if(!o)throw Error('Нет сопоставленной цели '+m.targetId);o.catalogMeasurements=[...(o.catalogMeasurements||[]),{catalog:m.measurement.catalog,sourceId:m.sourceId,source:m.measurement.referenceURL,distanceLy:m.measurement.d,redshift:m.measurement.redshift,observations:m.measurement.observations,basis:m.basis}];o.aliases=[...new Set([...(o.aliases||[]),m.sourceId,...(m.measurement.observations||[]).map(r=>r.observationID)])];o.facts.refs.push([m.measurement.referenceURL,m.measurement.catalog]);}
 }
};
globalThis.DistantCatalog=DistantCatalog;
DistantCatalog.init();
