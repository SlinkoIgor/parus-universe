'use strict';
// Search catalogue coordinates, never the current map cut or its 2D layout.
const ArrivalStars = {
  index:null, loading:null, error:'', resolved:new Map(), results:new Map(), pending:new Map(), revision:0, failedAt:-Infinity,
  eligible(host) {
    return !!host?.navigable && !host.atlasOnly && !host.rangeProbe &&
      host.p3?.every(Number.isFinite) && !['home','star'].includes(host.kind);
  },
  key(host,destroyed) { return JSON.stringify([host.id,host.p3,destroyed]); },
  remember(key,star) { if(this.results.size>=256)this.results.clear(); this.results.set(key,star); },
  radius(host) {
    const m=globalThis.MapGeometry?.model(host);
    // Optical contours supply a size envelope; individual depth is unknown.
    if(m&&m.kind!=='spine')return Math.max(m.radius,m.minorRadius||0);
    const r=host.region||host.regionData;
    if(r?.shape==='polyline')return Math.max(r.major||0,r.minor||0)/2;
    return 0;
  },
  usable(o,used) {
    return o && ['star','home'].includes(o.kind) && !o.synthetic && !o.atlasOnly &&
      !o.supersededBy && !o.historicalStellarNavigation && !used.has(o.id) && o.p3?.every(Number.isFinite);
  },
  async load() {
    if(this.index)return this.index;
    if(!this.loading)this.loading=ExtendedCatalog.readJSON('arrival-stars-index.json',undefined,ARRIVAL_STARS_BOOT.revision).then(data=>{
      if(data.version!==1||data.rows.length!==ARRIVAL_STARS_BOOT.count||data.catalogRevision!==EXTENDED_BOOT.revision||data.geometryVersion!==MapLayout.version)throw Error('Индекс звёзд не соответствует каталогу.');
      this.index=data;this.error='';return data;
    }).catch(e=>{this.error='Не удалось подобрать звезду: '+e.message;this.loading=null;throw e;});
    return this.loading;
  },
  nearest(host,destroyed) {
    const used=new Set(destroyed),radius=this.radius(host),limit=radius||5,p=host.p3;
    let best=null,bestD=Infinity;
    const consider=(id,q,member,value)=>{
      if(used.has(id))return;
      const d=Math.hypot(...q.map((v,i)=>v-p[i]));
      if(!(member===host.id || (radius?d<=limit:d<limit)))return;
      if(d<bestD||d===bestD&&id<best.id){bestD=d;best={id,value};}
    };
    // Authoritative core includes the individually modelled nuclear stars.
    for(const o of OBJECTS)if(this.usable(o,used))consider(o.id,o.p3,o.parentGalaxy||o.parentObject,o);
    for(const o of ExtendedCatalog.pinned.values())if(!o.streamed&&this.usable(o,used))consider(o.id,o.p3,o.parentGalaxy||o.parentObject,o);
    const rows=this.index.rows;
    const visit=(lo,hi,depth)=>{
      if(lo>=hi)return;
      const mid=(lo+hi)>>1,r=rows[mid],axis=depth%3,delta=p[axis]-r[axis+1];
      consider(r[0],r.slice(1,4),r[5],r);
      if(delta<0){visit(lo,mid,depth+1);if(delta*delta<=Math.min(limit,bestD)**2)visit(mid+1,hi,depth+1);}
      else{visit(mid+1,hi,depth+1);if(delta*delta<=Math.min(limit,bestD)**2)visit(lo,mid,depth+1);}
    };
    visit(0,rows.length,0);
    // Explicit membership also works when a catalogue has no measured size.
    for(const r of rows)if(r[5]===host.id)consider(r[0],r.slice(1,4),r[5],r);
    return best?.value||null;
  },
  lookup(host,destroyed=state.destroyed) {
    if(!this.eligible(host))return {ready:true,star:null};
    const key=this.key(host,destroyed);
    if(this.results.has(key))return {ready:true,star:this.results.get(key)};
    if(this.index&&!this.pending.has(key)){
      const candidate=this.nearest(host,destroyed),star=Array.isArray(candidate)?this.resolved.get(candidate[0])||ExtendedCatalog.get(candidate[0]):candidate;
      if(!candidate||star){this.remember(key,star||null);return {ready:true,star:star||null};}
    }
    this.prepare(host,[...destroyed]);
    return {ready:false,star:null};
  },
  prepare(host,destroyed=state.destroyed) {
    if(!this.eligible(host))return Promise.resolve(null);
    const key=this.key(host,destroyed);
    if(this.results.has(key))return Promise.resolve(this.results.get(key));
    if(this.pending.has(key))return this.pending.get(key);
    // Older embedded runtimes without fetch retain the legacy arrival policy.
    // Offline exports provide the full index in PARUS_CATALOG_FILES.
    if(!this.index && typeof fetch!=='function' && !globalThis.PARUS_CATALOG_FILES)return Promise.resolve(null);
    if(this.error&&performance.now()-this.failedAt<3000)return Promise.resolve(null);
    const job=this.load().then(async()=>{
      const candidate=this.nearest(host,destroyed);let star=candidate;
      if(Array.isArray(candidate)){
        star=this.resolved.get(candidate[0])||ExtendedCatalog.get(candidate[0]);
        if(!star){const rows=await ExtendedCatalog.tile(candidate[4]);star=rows.find(o=>o.id===candidate[0]);}
        if(!star)throw Error('В каталоге отсутствует выбранная звезда.');
        this.resolved.set(star.id,star);
      }
      this.remember(key,star);this.revision++;MissionPlanner.cache.clear();FlightQueue.cache=null;
      if(typeof state!=='undefined'&&state){renderUI();if($('flightBuilder').open)FlightBuilder.render();}
      return star;
    }).catch(e=>{this.error='Не удалось подобрать звезду: '+e.message;this.failedAt=performance.now();this.revision++;MissionPlanner.cache.clear();if(typeof state!=='undefined'&&state)renderUI();return null;}).finally(()=>this.pending.delete(key));
    this.pending.set(key,job);return job;
  },
  primeRoutes() {
    for(const n of [...(state.flight?.route?.slice((state.flight.legIndex||0)+1)||[]),...state.itinerary,...state.nextTargets])
      if(n.mode!=='flyby')this.prepare(object(n.id));
  },
  issue(host,destroyed=state.destroyed) {
    if(!this.eligible(host))return '';
    if(!this.index && typeof fetch!=='function' && !globalThis.PARUS_CATALOG_FILES)return '';
    return this.lookup(host,destroyed).ready?'':this.error||'Подбираем звезду для торможения…';
  },
};
globalThis.ArrivalStars=ArrivalStars;
