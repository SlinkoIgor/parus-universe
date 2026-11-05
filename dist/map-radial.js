'use strict';
// Shared by the offline indexer and the browser. Only anchor coordinates change;
// contours and physical p3 remain untouched. The profile defines every threshold.
const MapRadial={
 data:RADIAL_DATA,cache:new WeakMap(),manifest:null,layers:null,loading:null,error:null,
 get profile(){return this.data.profile;},
 get key(){return this.profile.id+':'+this.data.profileRevision+':'+this.data.anchorRevision;},
 active(){return globalThis.MapSlice?.mode==='radial';},
 vector(p){
  const r=Math.hypot(...p),rho=Math.hypot(p[0],p[1]);
  return rho>0?{x:p[0]/rho*r,y:-p[1]/rho*r}:{x:0,y:(p[2]<0?1:-1)*r};
 },
 category(o){return o.kind==='cluster'?(o.catalogClass==='galaxy-cluster'||/галактик/i.test([o.type,o.name,o.facts?.class].join(' '))?'galaxy-cluster':'stellar-cluster'):o.kind;},
 hostId(o){return o.nuclearStar?'sgr':MapLayout.anchorId(o);},
 resolve(id){return this.data.anchors[id]||MapLayout.resolve?.(id)||globalThis.OBJECTS?.find(o=>o.id===id);},
 distanceDomain(o){
  return this.profile.distanceDomains?.find(d=>d.kinds.includes(this.category(o))&&o.id!==d.origin)||null;
 },
 exactDistance(o){
  const d=this.distanceDomain(o),h=d&&this.resolve(d.origin);
  return !!(h?.p3&&o.p3?.every(Number.isFinite)&&Math.hypot(...o.p3.map((v,i)=>v-h.p3[i]))<=d.radiusLy);
 },
 constrainDistance(o,position){
  const domain=this.distanceDomain(o),host=domain&&this.resolve(domain.origin);
  if(!host?.p3)return{position};
  // Both origins have an acyclic placement: Sun is fixed; Sgr A* is a root
  // anchor. Boundaries are profile constants, never the current 100th row.
  const centre=this.placement(host).position,v=o.p3.map((n,i)=>n-host.p3[i]),r=Math.hypot(...v),a=domain.radiusLy;
  const x=position.x-centre.x,y=position.y-centre.y,m=Math.hypot(x,y),exact=r<=a;
  // Outside the exact sphere the floor grows continuously from a towards 2a.
  // Every farther record stays outside it, including records near the Z pole.
  // Already distant centres and all their rigid local shapes stay unchanged.
  const floor=exact?r:2*a-a*a/r,R=exact?r:Math.max(m,floor);
  if(!exact&&R===m)return{position};
  const rho=Math.hypot(v[0],v[1]);
  const direction=exact||m===0?(rho>0?{x:v[0]/rho,y:-v[1]/rho}:{x:0,y:v[2]<0?1:-1}):{x:x/m,y:y/m};
  return{position:{x:centre.x+direction.x*R,y:centre.y+direction.y*R},distanceDomain:{id:domain.id,origin:domain.origin,exact,trueRadiusLy:r,mapRadiusLy:R}};
 },
 groupKeys(o){return [...new Set([o.catalogData,...(o.catalogMeasurements||[]).map(m=>m.data)].filter(d=>d?.groupPGC>0).map(d=>String(d.groupPGC)))].sort();},
 decision(o){
  const hostId=this.hostId(o),host=hostId&&(this.data.anchors[hostId]||((o.synthetic||o.stellarSystem)&&this.resolve(hostId)));
  // Static catalogue hosts are admitted by the frozen registry. Generated game
  // stars may reference a newly pinned object without changing any old record.
  // Priority is data, not the accidental order of catalogue imports.
  if(o.stellarSystem&&hostId&&hostId!==o.id&&host?.p3)return{rule:'declared-host',frame:'rigid-xy',parent:hostId};
  for(const rule of this.profile.rules){
   if(rule==='protected-anchor'&&this.profile.protected.includes(o.id))return{rule,frame:'fixed',parent:null};
   if(rule==='distance-domain'){const domain=this.distanceDomain(o);if(domain&&this.exactDistance(o))return{rule,frame:'radial',parent:domain.origin,domain:domain.id};}
   if(rule==='declared-host'&&hostId&&hostId!==o.id&&host?.p3)return{rule,frame:'radial',parent:hostId};
   if(rule==='local-cartographic-domain'){
    const candidates=this.profile.localDomains.filter(d=>{const h=this.resolve(d.host);return d.kinds.includes(this.category(o))&&d.host!==o.id&&h?.p3&&Math.hypot(...o.p3.map((v,i)=>v-h.p3[i]))<=d.radiusLy;});
    if(candidates.length===1)return{rule,frame:'radial',parent:candidates[0].host};
    if(candidates.length>1)return{rule:'independent-anchor',frame:'root',parent:null,warning:'overlapping-cartographic-domains'};
   }
   if(rule==='published-cf4-group'&&o.kind==='galaxy'){
    const keys=this.groupKeys(o);
    if(keys.length===1&&this.data.groups[keys[0]])return{rule,frame:'group',parent:this.data.groups[keys[0]],source:'CF4 1PGC'};
    if(keys.length)return{rule:'independent-anchor',frame:'root',parent:null,warning:keys.length>1?'ambiguous-cf4-group':'cf4-anchor-not-in-profile'};
   }
   if(rule==='independent-anchor')return{rule,frame:'root',parent:null,...(hostId?{warning:'unavailable-declared-host'}:{})};
  }
  throw Error('В профиле нет применимого правила: '+o.id);
 },
 placement(o,seen=new Set()){
  if(!o?.p3?.every(Number.isFinite)||o.atlasOnly)return{position:{x:NaN,y:NaN},rule:'unlocated',parent:null};
  const cached=this.cache.get(o);if(cached&&cached.p3===o.p3)return cached.value;
  if(seen.has(o.id))throw Error('Цикл картографических опор: '+[...seen,o.id].join(' → '));
  seen.add(o.id);const d=this.decision(o);let position;
  if(d.frame==='fixed')position=MapLayout.ordinaryProject(o);
  else if(d.parent){
   const host=this.resolve(d.parent),base=this.placement(host,seen).position;
   const delta=o.p3.map((n,i)=>n-host.p3[i]),v=d.frame==='rigid-xy'?{x:delta[0],y:-delta[1]}:this.vector(delta);position={x:base.x+v.x,y:base.y+v.y};
  }else position=this.vector(o.p3);
  const value={...d,...(d.frame==='rigid-xy'?{position}:this.constrainDistance(o,position)),profile:this.key};this.cache.set(o,{p3:o.p3,value});return value;
 },
 project(o){
  // Already laid-out contour/route vertices have no 3D object identity.
  if(!o.p3&&!o.id)return MapLayout.ordinaryProject(o);
  // Galaxy render helpers carry no membership metadata; use the same object as
  // points, selection, layers and navigation, including pinned search results.
  const full=o.id&&(MapLayout.resolve?.(o.id)||this.data.anchors[o.id]);
  return this.placement(full?.p3?full:o).position;
 },
 explain(o){
  const p=this.placement(o),labels={
   'protected-anchor':'Солнце — начало карты',
   'distance-domain':'Радиальное расстояние от центра ближайшего окружения',
   'declared-host':'Общая опора из существующей связи каталога',
   'local-cartographic-domain':'Радиальное размещение в локальной области галактики; физическая принадлежность этим не устанавливается',
   'published-cf4-group':'Опубликованная группа CF4, поле 1PGC',
   'independent-anchor':'Самостоятельная опора',
   'unlocated':'Недостаточно данных для размещения'
  };
  const chain=[];let current=o;const seen=new Set();while(current&&!seen.has(current.id)){seen.add(current.id);const d=this.placement(current);chain.push({id:current.id,...d});current=d.parent&&this.resolve(d.parent);}
  const warnings={'unavailable-declared-host':'опора отсутствует в принятом реестре','cf4-anchor-not-in-profile':'опора этой группы ещё не принята в профиль','ambiguous-cf4-group':'каталоги указывают разные группы','overlapping-cartographic-domains':'пересекаются две картографические области'};
  const focus=p.distanceDomain,focusText=focus?' '+(focus.exact?'Радиус равен 3D-расстоянию от ':'Применена защита ближайшей области от дальних объектов: ')+(this.resolve(focus.origin)?.name||focus.origin)+'.':'';
  return{...p,chain,text:labels[p.rule]+(p.parent?' · '+(this.resolve(p.parent)?.name||p.parent):'')+(p.warning?' · '+warnings[p.warning]:'')+'.'+focusText+' Профиль '+this.profile.id+'.'};
 },
 async load(){
  if(this.manifest||this.loading)return this.loading;
  this.error=null;this.loading=Promise.resolve().then(async()=>{
   try{
    const pointer=await ExtendedCatalog.readJSON('map-radial/current.json');
    const [m,l]=await Promise.all([ExtendedCatalog.readJSON(pointer.dataRoot+'/manifest.json'),ExtendedCatalog.readJSON(pointer.dataRoot+'/layers.json')]);
    if(m.version!==1||l.version!==1||m.revision!==pointer.revision||l.revision!==m.revision||l.dataRoot!==m.dataRoot||m.catalogRevision!==EXTENDED_BOOT.revision||m.geometryVersion!==MapLayout.version||l.geometryVersion!==m.geometryVersion||m.profileKey!==this.key||l.profileKey!==this.key||l.catalogRevision!==m.catalogRevision)throw Error('Индекс радиальной карты не соответствует каталогу и профилю');
    this.manifest=m;this.layers=l;if(this.active())MapLayers.setGeometry(l);ExtendedCatalog.lastUpdate=-Infinity;
   }catch(e){this.error=e.message;}finally{this.loading=null;globalThis.MapSlice?.render();}
  });globalThis.MapSlice?.render();return this.loading;
 }
};
globalThis.MapRadial=MapRadial;
