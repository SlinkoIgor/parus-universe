'use strict';
// Full catalog objects stay in bounded tiles; only selected/visited objects are pinned.
const ExtendedCatalog={
 manifest:null,cache:new Map(),inflight:new Map(),pinned:new Map(),visibleMap:new Map(),visible:[],wanted:[],worker:null,seq:0,searchLimit:100,lastUpdate:-Infinity,active:0,errors:new Map(),foreground:new Set(EXTENDED_BOOT.foreground),systemByMember:new Map(),
 sources:{HYG:['https://github.com/astronexus/HYG-Database','HYG 4.1'],OpenNGC:['https://github.com/mattiaverga/OpenNGC','OpenNGC'],ATNF:['https://www.atnf.csiro.au/research/pulsar/psrcat/','ATNF 2.9.0']},
 get total(){return EXTENDED_BOOT.total+[...this.pinned.values()].filter(o=>o.synthetic).length;},
 get(id){return this.coreIndex?.get(id)||this.pinned.get(id)||this.visibleMap.get(id);},
 background(o){return !o.synthetic&&!o.messier&&!o.galaxyMember&&(o.streamed||o.kind==='star'&&o.d>0&&o.d<=50&&!this.foreground.has(o.id));},
 readJSON(path){if(globalThis.PARUS_CATALOG_FILES?.[path])return Promise.resolve().then(()=>{const v=globalThis.PARUS_CATALOG_FILES[path];return typeof v==='string'?JSON.parse(v):v;});return fetch(path+'?v='+EXTENDED_BOOT.revision).then(r=>{if(!r.ok)throw Error('Не удалось загрузить '+path);return r.json();});},
 decode(r){
  const [id,name,kind,d,raDeg,decDeg,positionQuality,distanceMethod,aliases,apparentV,source,extra,x,y]=r,located=d>0&&Number.isFinite(raDeg)&&Number.isFinite(decDeg),ref=extra.referenceURL?[extra.referenceURL,source]:this.sources[source]||this.sources.HYG;
  const o={id,name,kind,d,raDeg,decDeg,positionQuality,distanceMethod,aliases,apparentV,...extra,source:ref[0],catalog:ref[1],streamed:true,mapPosition:{x,y},...(located?Space.point(Space.fromSky(raDeg,decDeg,d)):{p3:null,x,y}),navigable:located&&!extra.invalidIdentification&&!extra.atlasOnly,type:({star:'ЗВЕЗДА',pulsar:'ПУЛЬСАР',galaxy:'ГАЛАКТИКА',cluster:'СКОПЛЕНИЕ',nebula:'ТУМАННОСТЬ'})[kind]+' · '+source};
  o.desc='Реальная каталожная запись '+ref[1]+'. '+distanceMethod+(extra.identificationNote?' '+extra.identificationNote:'');
  o.coordinateNote=positionQuality==='unknown'?'Недостаточно данных для положения на карте. Объект доступен только в атласе.':positionQuality==='approximate'?'Приблизительная позиция; полёт разрешён по указанной оценке. '+distanceMethod:'Каталожная позиция J2000; собственное движение не моделируется.';
  o.facts={class:o.type,mass:'Нет индивидуальной оценки в этом каталоге.',lumUnknown:'Болометрическая светимость не указана.',note:distanceMethod+(extra.sizeEstimated?' Контур галактики имеет условный игровой размер: угловой диаметр в каталоге отсутствует.':''),refs:[ref]};
  if(extra.membershipSource)o.facts.refs.push([extra.membershipSource,'Принадлежность к галактике']);if(extra.memberType)o.type=o.facts.class=extra.memberType;if(extra.positionReason)o.coordinateNote=extra.positionReason;
  if(extra.periodSeconds)o.facts.extra=['Период вращения',String(extra.periodSeconds)+' с'];return o;
 },
 init(){
  this.coreIndex=new Map(OBJECTS.map(o=>[o.id,o]));
  for(const [id,p] of Object.entries(EXTENDED_BOOT.patches)){
   const o=OBJECTS.find(o=>o.id===id);if(!o)continue;Object.assign(o,p);
   const located=p.d>0&&Number.isFinite(p.raDeg)&&Number.isFinite(p.decDeg);
   Object.assign(o,located?Space.point(p.p3||Space.fromSky(p.raDeg,p.decDeg,p.d)):{p3:null,x:p.display[0],y:p.display[1]});
   // Generated positions are compact [x,y], while original map coordinates stay unchanged.
   o.mapPosition={x:p.display[0],y:p.display[1]};o.navigable=located;
   o.coordinateNote=located?'Приблизительная позиция. Полёт разрешён по оценке расстояния. '+p.distanceMethod:p.distanceMethod;
   if(o.facts){o.facts.note=p.distanceMethod;if(p.distanceSource)o.facts.refs.push([p.distanceSource,'Расстояние и принадлежность к системе']);if(o.facts.visual&&o.apparentV!=null){const absoluteV=o.apparentV-5*Math.log10(p.d/3.2615637771674336)+5;o.absoluteV=absoluteV;o.visualLuminositySolar=10**((4.83-absoluteV)/2.5);o.facts.visual={absoluteV,solarV:o.visualLuminositySolar};}}MapLayout.cache.delete(id);
  }
  for(const [id,name] of Object.entries(EXTENDED_BOOT.renames)){const o=OBJECTS.find(o=>o.id===id);if(o){o.aliases=[...new Set([o.name,...(o.aliases||[]),name])];o.name=name;}}
  for(const [id,policy] of Object.entries(EXTENDED_BOOT.policies||{})){const o=this.coreIndex.get(id);if(o)Object.assign(o,policy);}
  for(const row of EXTENDED_BOOT.members||[]){const o=this.decode(row);o.streamed=false;OBJECTS.push(o);this.coreIndex.set(o.id,o);}
  this.hiddenIds=new Set(EXTENDED_BOOT.hiddenIds||[]);
  for(const o of OBJECTS){
   const area=['structure','wall','void','ring','arc','horizon'].includes(o.kind);
   if(area)o.coordinateNote=(o.coordinateNote||'').replace(/не используется в физических маршрутах\.|В физические маршруты не включён\.|Область не является точкой остановки\./g,'');
   if(area&&!o.p3&&Number.isFinite(o.d)&&Number.isFinite(o.x)&&Number.isFinite(o.y)){
    const angle=Math.atan2(-o.y,o.x);o.p3=[o.d*Math.cos(angle),o.d*Math.sin(angle),0];o.arrivalAnchor=true;
    o.coordinateNote=(o.coordinateNote||'')+' Игровая точка прибытия в протяжённую область; не измеренный компактный центр.';
   }
   if(!area&&(o.positionQuality==='unknown'||!o.p3?.every(Number.isFinite)))o.atlasOnly=true;
   if(o.atlasOnly&&!area){o.navigable=false;o.coordinateNote=o.positionReason||'Недостаточно данных для положения на карте. Только атлас.';}
   else if(o.p3?.every(Number.isFinite)){o.navigable=true;if(area&&!o.arrivalAnchor)o.coordinateNote=(o.coordinateNote||'')+' Полёт разрешён к оценочной точке прибытия в область; это не компактное тело.';}
  }
  for(const s of EXTENDED_BOOT.systems)for(const id of s.members){this.systemByMember.set(id,s);const o=this.coreIndex.get(id);if(s.id==='system-cygnus-x1'&&o?.facts)o.facts.refs=[...(o.facts.refs||[]).filter(r=>r[0]!==s.source),[s.source,'Расстояние и параметры двойной системы']];}
 },
 start(){
  if(typeof fetch!=='function'&&!globalThis.PARUS_CATALOG_FILES)return;
  this.readJSON('catalog-data/manifest.json').then(m=>{this.manifest=m;this.lastUpdate=-Infinity;if(!$('catalog').hidden)renderCatalog();}).catch(e=>{this.manifestError=e.message;});
 },
 tile(file){
  if(this.cache.has(file)){const r=this.cache.get(file);this.cache.delete(file);this.cache.set(file,r);return Promise.resolve(r);}
  if(this.inflight.has(file))return this.inflight.get(file);
  const promise=this.readJSON('catalog-data/'+file).then(rows=>{const objects=rows.map(r=>this.decode(r));this.cache.set(file,objects);while(this.cache.size>48){const key=[...this.cache.keys()].find(k=>!this.wanted.includes(k));if(!key)break;this.cache.delete(key);}this.errors.delete(file);return objects;}).catch(e=>{this.errors.set(file,performance.now());throw e;}).finally(()=>this.inflight.delete(file));
  this.inflight.set(file,promise);return promise;
 },
 nodesForView(view,w,h){
  if(!this.manifest)return [];
  const s=view.span/Math.max(1,w),box=[view.x-w*.55*s,view.y-h*.60*s,view.x+w*.7*s,view.y+h*.6*s],chosen=[];
  const intersects=b=>b[0]<=box[2]&&b[2]>=box[0]&&b[1]<=box[3]&&b[3]>=box[1];
  const visit=id=>{const n=this.manifest.nodes[id];if(!intersects(n.box))return;const size=Math.max(n.box[2]-n.box[0],n.box[3]-n.box[1])/s;if(n.children.length&&size>340)for(const c of n.children)visit(c);else chosen.push(n);};
  for(const id of this.manifest.roots)visit(id);
  // Nearest visible cells first, hard caps for frame work and network concurrency.
  return chosen.sort((a,b)=>Math.hypot((a.box[0]+a.box[2])/2-view.x,(a.box[1]+a.box[3])/2-view.y)-Math.hypot((b.box[0]+b.box[2])/2-view.x,(b.box[1]+b.box[3])/2-view.y)).slice(0,32).map(n=>n.file);
 },
 update(now){
  if(now-this.lastUpdate<180)return;this.lastUpdate=now;
  if(this.manifest){this.wanted=this.nodesForView(cam,width,height);const rows=[];for(const file of this.wanted){const loaded=this.cache.get(file);if(loaded)rows.push(...loaded);else if(this.inflight.size<4&&now-(this.errors.get(file)||-Infinity)>3000)this.tile(file).then(()=>{this.lastUpdate=-Infinity;}).catch(()=>{});}this.visible=rows.filter(o=>!o.atlasOnly).slice(0,8000);this.visibleMap=new Map(this.visible.map(o=>[o.id,o]));}
  if(cam.span<200000)for(const g of GALAXIES){if(g.id==='milkyway')continue;const p=MapLayout.project(g);if(Math.hypot(cam.x-p.x,cam.y-p.y)<cam.span)this.ensureGalaxy(OBJECTS.find(o=>o.id===g.id)||this.get(g.id));}
 },
 pin(o){
  if(!o)return o;const core=OBJECTS.find(q=>q.id===o.id);if(core)return core;
  this.pinned.set(o.id,o);this.prepareGalaxy(o);return o;
 },
 prepareGalaxy(o){
  if(o.kind!=='galaxy'||!o.p3||o.galaxy)return;
  const g={id:o.id,name:o.name,x:o.x,y:o.y,p3:o.p3,diameterLy:o.diameterLy||30000,axisRatio:(o.angularMinorArcmin||o.angularMajorArcmin||1)/(o.angularMajorArcmin||1),shape:/^E|^S0/.test(o.hubbleType||'')?'elliptical':/^I/.test(o.hubbleType||'')?'irregular':'spiral',rotation:0};
  o.galaxy=g;if(!GALAXIES.some(q=>q.id===g.id))GALAXIES.push(g);
 },
 async resolve(entry){
  const existing=OBJECTS.find(o=>o.id===entry.id)||this.get(entry.id);if(existing)return this.pin(existing);
  const file=entry.tile||EXTENDED_BOOT.systemTiles?.[entry.id];if(!file)throw Error('Нет адреса записи каталога');
  const rows=await this.tile(file),o=rows.find(o=>o.id===entry.id);if(!o)throw Error('Запись не найдена в каталоге');return this.pin(o);
 },
 focus(o){if(o.atlasOnly){toast(o.positionReason||'Для этого объекта недостаточно точное положение. Он доступен только в атласе.');return;}const p=MapLayout.project(o),span=o.kind==='galaxy'?(o.galaxy?.diameterLy||30000)*2.8:o.positionQuality==='unknown'?Math.max(400,Math.hypot(p.x,p.y)*.04):o.synthetic?2:o.kind==='star'?24:Math.max(24,Math.min(20000,(o.d||100)*.03));const system=this.systemByMember.get(o.id);goCamera(p.x,p.y,system?.separationLy?Math.max(.00006,system.separationLy*6):span);this.ensureGalaxy(o);},
 capture(saved){
  const ids=new Set([saved.current,saved.selected,saved.flight?.target,saved.flight?.fromId,...(saved.visited||[]),...(saved.destroyed||[]),...(saved.itinerary||[]).map(n=>n.id),...(saved.flight?.route||[]).map(n=>n.id)]);
  // Include the parent galaxy so a generated star can still be identified on reload.
  for(const id of [...ids]){const o=this.get(id);if(o?.parentGalaxy)ids.add(o.parentGalaxy);if(o?.parentObject)ids.add(o.parentObject);if(o?.departureStar)ids.add(o.departureStar);}
  saved.catalogObjects=[...ids].map(id=>this.pinned.get(id)).filter(Boolean);
  for(const id of this.pinned.keys())if(!ids.has(id))this.pinned.delete(id);
 },
 restore(saved){for(const o of saved?.catalogObjects||[]){if(!o||typeof o.id!=='string')continue;if(this.hiddenIds.has(o.id)||o.positionQuality==='unknown'){o.atlasOnly=true;o.navigable=false;}if((o.p3==null||o.p3.every(Number.isFinite))&&(o.atlasOnly||Number.isFinite(o.mapPosition?.x)&&Number.isFinite(o.mapPosition?.y)))this.pin(o);}},
 ensureGalaxy(g){
  if(!g||!g.p3||g.atlasOnly&&g.id!==state.current)return null;
  // An unspent star is already a sail source; don't point its arrival button at itself.
  if(g.kind==='star'&&!state.destroyed.includes(g.id))return null;
  this.prepareGalaxy(g);
  const candidates=[...OBJECTS,...this.pinned.values()].filter(o=>o.id!==g.id&&o.kind==='star'&&!o.synthetic&&!o.atlasOnly&&o.p3&&!state.destroyed.includes(o.id));
  const radius=g.kind==='home'?10:g.kind==='galaxy'?Math.max(1,(g.galaxy?.diameterLy||30000)*.6):g.region?Math.max(1,Math.min(10000,g.region.major*.5)):Math.max(1,g.diameterLy||0);
  const real=candidates.filter(o=>o.parentGalaxy===g.id||Space.distance(o,g)<radius).sort((a,b)=>Space.distance(a,g)-Space.distance(b,g))[0];
  if(real){g.departureStar=real.id;return real;}
  let n=1;while(state.destroyed.includes('game-star:'+g.id+':'+n))n++;
  const id='game-star:'+g.id+':'+n;if(this.pinned.has(id)){g.departureStar=id;return this.pinned.get(id);}
  const a=n*2.399963,offset=[.12*Math.cos(a),.12*Math.sin(a),.025],p=MapLayout.project(g);
  const o={id,name:'Неизвестная звезда · '+g.name+(n>1?' · '+n:''),aliases:[g.name,'Игровая звезда'],kind:'star',type:'УСЛОВНАЯ ИГРОВАЯ ЗВЕЗДА',synthetic:true,parentObject:g.id,...(g.kind==='galaxy'?{parentGalaxy:g.id}:{}),p3:g.p3.map((v,i)=>v+offset[i]),mapPosition:{x:p.x+offset[0],y:p.y-offset[1]},navigable:true,positionQuality:'fictional',desc:'Игровая звезда рядом с точкой прибытия: '+g.name+'. Индивидуальная реальная звезда в этой позиции не известна; положение создано для продолжения игры.',coordinateNote:'Условная игровая позиция рядом с точкой прибытия; не астрономическое измерение.',facts:{class:'Условная игровая звезда',mass:'Не задана.',lumUnknown:'Использует игровую модель звёздного импульса.',note:'Доступна для парусного разгона; отдельная звезда в этой позиции не измерена.',refs:[]}};
  Object.assign(o,Space.point(o.p3));o.d=Math.hypot(...o.p3);this.pin(o);g.departureStar=id;return o;
 },
 draw(){
  const points=[...this.visible,...this.pinned.values(),...OBJECTS.filter(o=>this.background(o))],seen=new Set(),protectedPoints=OBJECTS.filter(o=>!this.background(o)&&!o.region&&MapDetails.visible(o,cam.span)).map(o=>screen(o)).filter(p=>p.x>-30&&p.x<width+30&&p.y>-30&&p.y<height+30);
  const buckets=new Map();for(const p of protectedPoints){const k=Math.floor(p.x/16)+','+Math.floor(p.y/16);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(p);}
  for(const o of points){if(seen.has(o.id)||!this.background(o)||!MapDetails.visible(o,cam.span)||o.id===state.selected||o.id===state.current)continue;seen.add(o.id);const p=screen(o);if(p.x<0||p.y<0||p.x>width||p.y>height)continue;
   let covered=false;const bx=Math.floor(p.x/16),by=Math.floor(p.y/16);for(let ix=-1;ix<=1;ix++)for(let iy=-1;iy<=1;iy++)if((buckets.get((bx+ix)+','+(by+iy))||[]).some(q=>Math.hypot(q.x-p.x,q.y-p.y)<16))covered=true;if(covered)continue;
   ctx.save();ctx.globalAlpha=.52*MapDetails.opacity(o,cam.span);ctx.fillStyle=paint('#9b9b9b');ctx.beginPath();ctx.arc(p.x,p.y,o.positionQuality==='unknown'?1.45:1.05,0,Math.PI*2);ctx.fill();ctx.restore();hitObjects.push({o,p,r:5,background:true});
  }
 },
 drawSystems(){
  const get=id=>{const o=this.get(id);return o?.atlasOnly?null:o;};
  for(const s of EXTENDED_BOOT.systems){const members=s.members.map(get).filter(Boolean);if(members.length<2||cam.span>2000&&members.every(o=>o.kind==='star'))continue;
   for(let i=0;i<s.links.length;i++){const [ai,bi]=s.links[i],a=get(ai),b=get(bi);if(!a||!b)continue;let pa=screen(a),pb=screen(b);
    if(s.id==='system-alpha-centauri'&&i===1){const other=get(s.members[1]);if(other){const p=screen(other);pa={x:(pa.x+p.x)/2,y:(pa.y+p.y)/2};}}
    const d=Math.hypot(pa.x-pb.x,pa.y-pb.y);if(d>Math.max(width,height)*1.5||Math.max(pa.x,pb.x)<0||Math.min(pa.x,pb.x)>width||Math.max(pa.y,pb.y)<0||Math.min(pa.y,pb.y)>height)continue;
    ctx.save();ctx.strokeStyle=paint('#aaa');ctx.globalAlpha=.5;ctx.lineWidth=.6;ctx.setLineDash([3,5]);ctx.beginPath();ctx.ellipse((pa.x+pb.x)/2,(pa.y+pb.y)/2,Math.max(11,d/2+6),Math.max(5,Math.min(30,d*.12)),Math.atan2(pb.y-pa.y,pb.x-pa.x),0,Math.PI*2);ctx.stroke();ctx.restore();
   }
  }
 },
 async showSystem(id){
  const s=this.systemByMember.get(id);if(!s)return;
  try{const members=await Promise.all(s.members.map(id=>this.resolve({id})));const labels=members.map((o,i)=>'<button class="map-size-action" data-system-member="'+i+'">'+o.name+' ↗</button>').join('');
   const tertiary=members.length>2?'<ellipse cx="180" cy="95" rx="158" ry="72"/><circle cx="320" cy="62" r="4"/>':'';
   showDialog('<div class="modal-eyebrow">'+(s.associationOnly?'КАТАЛОЖНАЯ ГРУППА · СВЯЗЬ НЕ ПОДТВЕРЖДЕНА':s.relationship==='interacting'?'ВЗАИМОДЕЙСТВУЮЩАЯ СИСТЕМА · СХЕМА СВЯЗИ':'СВЯЗАННАЯ СИСТЕМА · УСЛОВНАЯ СХЕМА')+'</div><h2>'+s.name+'</h2>'+(s.associationOnly?'':'<svg class="system-diagram" viewBox="0 0 360 190" role="img" aria-label="Схема связи компонентов: '+s.name+'"><g fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 5">'+tertiary+'<ellipse cx="160" cy="95" rx="68" ry="28"/></g><g fill="currentColor"><circle cx="148" cy="95" r="5"/><circle cx="218" cy="81" r="4"/></g><text x="140" y="120">A</text><text x="220" y="70">B</text>'+(members.length>2?'<text x="325" y="53">C</text>':'')+'</svg>')+'<p>'+s.note+'</p>'+labels+'<p class="object-sources"><a href="'+s.source+'" target="_blank" rel="noopener">Источник связи ↗</a></p>');
   for(let i=0;i<members.length;i++){const b=document.querySelector('[data-system-member="'+i+'"]');if(b)b.onclick=()=>{$('infoDialog').close();this.pin(members[i]);select(members[i].id);this.focus(members[i]);};}
  }catch(e){toast(e.message);}
 },
 async search(term,filter,limit){
  if(globalThis.PARUS_CATALOG_FILES||typeof Worker!=='function'){
   this.fallbackIndex ||= this.readJSON('catalog-data/search.json');const rows=await this.fallbackIndex,key=MapDetails.searchKey(term);const all=rows.filter(r=>this.matches(r[2],filter)&&r[6].includes(key)).sort((a,b)=>(key?Number(b[6].includes('|'+key+'|'))-Number(a[6].includes('|'+key+'|')):0)||(a[3]??Infinity)-(b[3]??Infinity));return{total:all.length,items:all.slice(0,limit).map(r=>({id:r[0],name:r[1],kind:r[2],d:r[3],positionQuality:r[4],tile:r[5],atlasOnly:!!r[7],streamed:true,searchExact:!!key&&r[6].includes('|'+key+'|')}))};
  }
  if(!this.worker){this.worker=new Worker('catalog-search-worker.js?v=32');this.pendingSearch=new Map();this.worker.onmessage=({data})=>{const p=this.pendingSearch.get(data.seq);if(p){this.pendingSearch.delete(data.seq);data.error?p.reject(Error(data.error)):p.resolve(data);}};this.worker.onerror=()=>{for(const p of this.pendingSearch.values())p.reject(Error('Не удалось открыть поиск полного каталога'));this.pendingSearch.clear();this.worker.terminate();this.worker=null;};}
  const seq=++this.seq;return new Promise((resolve,reject)=>{this.pendingSearch.set(seq,{resolve,reject});this.worker.postMessage({seq,term,filter,limit,version:EXTENDED_BOOT.revision});});
 },
 matches(kind,filter,o){if(kind==='cluster'&&o){const gal=/галактик/i.test([o.type,o.name,o.facts?.class].join(' '));return filter==='all'||filter===(gal?'galaxy-cluster':'stellar-cluster');}return filter==='all'||filter==='star'&&['star','home'].includes(kind)||filter==='stellar-cluster'&&kind==='cluster'||filter==='structure'&&['structure','wall','ring','arc'].includes(kind)||filter===kind&&['pulsar','blackhole','quasar','nebula','galaxy','void','horizon'].includes(kind);}
};
ExtendedCatalog.init();
