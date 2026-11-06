'use strict';
// An additive, sourced compact-object layer. Existing galaxy IDs, coordinates
// and active flight plans remain authoritative; a nucleus has its own identity.
const BlackHoleCatalog={
 data:BLACK_HOLE_CATALOG_DATA,objects:[],hosts:new Map(),
 number(n){return Number(n.toPrecision(4)).toLocaleString('ru-RU');},
 massConstraintText(raw){
  const text=String(raw||'').trim().replace(/\\+(leq|geq|gtrsim|lesssim|pm)\b/g,(_,key)=>({leq:'≤',geq:'≥',gtrsim:'≳',lesssim:'≲',pm:'±'})[key]),
   num='(\\d+(?:[.,]\\d+)?)',format=s=>s.replace('.',','),
   range=text.match(new RegExp('^'+num+'\\s*[-–−]\\s*'+num+'$')),
   bound=text.match(new RegExp('^([<>≤≥≳≲])\\s*'+num+'(?:\\s*±\\s*'+num+')?$'));
  if(range)return format(range[1])+'–'+format(range[2]);
  if(bound)return bound[1]+' '+(bound[3]?'('+format(bound[2])+' ± '+format(bound[3])+')':format(bound[2]));
  return null;
 },
 init(){
  if(this.data.baseCatalogRevision!==EXTENDED_BOOT.revision)throw Error('Каталог чёрных дыр требует соответствующую версию галактик');
  for(const q of this.data.hosts){
   const host=ExtendedCatalog.get(q.id)||(q.catalogRow?ExtendedCatalog.decode(q.catalogRow):q);
   this.hosts.set(host.id,host);
   // Keep the full decoded source record available for host projection/search,
   // without inserting an extra galaxy marker or loading its surrounding tile.
   if(!ExtendedCatalog.coreIndex.has(host.id))ExtendedCatalog.coreIndex.set(host.id,host);
  }
  for(const q of this.data.objects){
   const located=!q.atlasOnly&&q.p3?.every(Number.isFinite),host=q.parentGalaxy&&this.hosts.get(q.parentGalaxy);
   const o={...q,...(located?Space.point(q.p3):{p3:null,x:NaN,y:NaN}),index:OBJECTS.length,
    blackHoleCatalog:true,notableLandmark:true,blackHolePopulation:q.population,
    landmarkPriority:q.id==='bh-m87'?3:q.id==='bh-andromeda'?2:0,
    coordinateModel:'black-hole-catalog-v1',blackHoleRevision:this.data.revision,
    mapGeometry:MapLayout.version,mapPosition:null,mapOffset:null,
    massSolar:q.massSolar||null,massUncertaintySolar:q.massUncertaintySolar??null,
    massErrorPlusSolar:q.massErrorPlusSolar??null,massErrorMinusSolar:q.massErrorMinusSolar??null,gravity:null,
    parentGalaxy:q.parentGalaxy||null,distanceHost:q.distanceHost||null,boundSystemPrimary:null,systemAnchorP3:null,
    navigable:located,positionQuality:located?'approximate':'unknown',streamed:false,
    source:q.source,massSource:q.massSource||q.source,
    ...(host?{mapPosition:MapLayout.ordinaryProject(host),mapOffset:host.mapOffset||[0,0]}:{}),
   };
   if(located){
    const raw=host?MapLayout.rawProject(host):MapLayout.base(o.p3),offset=MapLayout.displacement(o,raw);
    o.mapPosition=host?MapLayout.ordinaryProject(host):MapLayout.place(o);
    o.mapOffset=[offset.x,offset.y];
   }
   o.type=q.population==='supermassive'?'Сверхмассивная чёрная дыра':q.confirmed?'Звёздная чёрная дыра · динамическое измерение':'Исторический кандидат в чёрные дыры · BlackCAT';
   const constraint=this.massConstraintText(q.massRaw);
   const mass=q.massSolar>0?this.number(q.massSolar)+(q.massUncertaintySolar>0?' ± '+this.number(q.massUncertaintySolar):q.massErrorPlusSolar>0?' +'+this.number(q.massErrorPlusSolar)+' / −'+this.number(q.massErrorMinusSolar):'')+' M☉':
    q.estimates?.length>1?'Индивидуальная точечная масса не установлена: опубликованы несовместимые оценки. Обе сохранены в происхождении.':
    constraint?constraint+' M☉ · '+(q.confirmed?'чёрная дыра':'кандидат в чёрные дыры'):
    'Индивидуальная точечная масса не установлена.'+(q.massRaw?' Источник задаёт предел или диапазон: '+q.massRaw+' (солнечные массы).':'');
   o.desc=q.id==='bh-m87'?'M87* — чёрная дыра в центре галактики M87. Её тень впервые показана на изображении Event Horizon Telescope в 2019 году.':q.id==='bh-andromeda'?'M31* — сверхмассивная чёрная дыра в центре Андромеды. Динамическая масса измерена по движению звёзд ядра.':q.population==='supermassive'?'Динамически обнаруженный компактный объект в ядре галактики '+(host?.name||q.name)+'. Представлен отдельно от галактики-хозяина.':q.confirmed?'Чёрная дыра в неразрешённой двойной системе; положение относится к каталожному направлению системы.':'Кандидат в исторической выборке BlackCAT 2015. Эта запись не утверждает современное динамическое подтверждение.';
   o.coordinateNote=located?[q.coordinateEpoch,q.distanceMethod,'Собственное движение и внутреннее орбитальное смещение не моделируются.'].filter(Boolean).join(' · '):q.positionReason;
   o.facts={class:o.type,mass,lumUnknown:'Собственная болометрическая светимость чёрной дыры не назначается. Аккреционное излучение не заменяется светимостью звезды.',
    note:[q.distanceMethod,q.id==='bh-m87'?'Первое изображение тени чёрной дыры: EHT, 2019.':q.population==='supermassive'?'Координаты совпадают с принятым центром галактики. Ошибка массы относится к исходному динамическому решению; дополнительная ошибка дальности здесь не вычисляется.':'Выборка ограничена публикацией; она не является полным современным списком чёрных дыр.',q.massRaw?'Исходная оценка массы: '+q.massRaw:''].filter(Boolean).join(' '),
    refs:[[q.source,q.population==='supermassive'?'McConnell & Ma 2013 · динамические массы':q.id.startsWith('gaia')?'Измерение Gaia и лучевых скоростей':'BlackCAT 2015 · таблицы 1 и 4'],...(q.massSource&&q.massSource!==q.source?[[q.massSource,'EHT / NASA · первое изображение']]:[]) ]};
   if(q.massSolar>0&&q.confirmed&&located)o.gravity={kind:'blackhole',massSolar:q.massSolar,radiusMeters:0,source:o.massSource,note:'Слабополевая модель Шварцшильда; вращение, диск и джет не моделируются.'};
   OBJECTS.push(o);this.objects.push(o);ExtendedCatalog.coreIndex.set(o.id,o);
  }
  for(const id of ['sgr','cygnus']){const o=ExtendedCatalog.get(id);if(o)Object.assign(o,{notableLandmark:true,landmarkPriority:id==='sgr'?2:1,blackHolePopulation:id==='sgr'?'supermassive':'stellar'});}
  const m87=ExtendedCatalog.get('m87');
  if(m87){
   m87.aliases=[...new Set([...(m87.aliases||[]),m87.name])];m87.name='M87 · Дева A';
   if(m87.galaxy)m87.galaxy.name=m87.name;
   for(const g of GALAXIES)if(g.id===m87.id)g.name=m87.name;
  }
 }
};
globalThis.BlackHoleCatalog=BlackHoleCatalog;
BlackHoleCatalog.init();
