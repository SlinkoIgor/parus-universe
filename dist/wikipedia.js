'use strict';
// Frozen article identities are independent of scientific data and saved games.
// Only metadata for the selected object's images is requested at card opening.
const Wikipedia = {
  cache:new Map(),pending:new Map(),failed:new Set(),
  observations:new Set(WIKIPEDIA_INDEX.observations),
  objectIds(o) {
    if(!o||o.synthetic)return [];
    if(o.supersededBy){const current=ExtendedCatalog.get(o.supersededBy);if(current)return this.objectIds(current);}
    return [...new Set([o.id,...(o.catalogObjectIds||[])])];
  },
  article(o) {
    const ids=[...new Set(this.objectIds(o).map(id=>WIKIPEDIA_INDEX.targets[id]).filter(Boolean))];
    if(ids.length!==1)return null;
    const [en,ru]=WIKIPEDIA_INDEX.articles[ids[0]],title=ru||en;
    return {title,language:ru?'ru':'en',url:'https://'+(ru?'ru':'en')+'.wikipedia.org/wiki/'+encodeURIComponent(title.replace(/ /g,'_'))};
  },
  link(o) {
    const a=this.article(o);if(!a)return '';
    const esc=SkyGuide.escape,label='Википедия: '+a.title+(a.language==='en'?' (на английском)':'');
    return ' <a class="object-wikipedia" href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer" title="'+esc(label)+'" aria-label="'+esc(label)+'"><span aria-hidden="true">W</span></a>';
  },
  ids(o) {return [...new Set(this.objectIds(o).flatMap(id=>WIKIPEDIA_INDEX.mediaTargets[id]||[]))].sort((a,b)=>Number(this.observations.has(b))-Number(this.observations.has(a)));},
  // The shard is recorded in the index, avoiding a cryptographic operation in
  // a synchronous gallery render. Learn the small reverse map once.
  shard(id) {return WIKIPEDIA_INDEX.shards[id];},
  hasObservation(o) {return this.ids(o).some(id=>this.observations.has(id));},
  media(o) {return this.ids(o).map(id=>this.cache.get(this.shard(id))?.[id]).filter(Boolean);},
  missing(o) {return [...new Set(this.ids(o).map(id=>this.shard(id)).filter(s=>!this.cache.has(s)))];},
  valid(id,p) {
    if(p.id!==id||!p.title||!p.description||!p.credit||!p.rights)return false;
    try {
      const url=new URL(p.url),source=new URL(p.source);
      return url.protocol==='https:'&&['upload.wikimedia.org','thumb.wikimedia.org'].includes(url.hostname)&&
        source.origin==='https://commons.wikimedia.org'&&source.pathname.startsWith('/wiki/File:')&&
        ['observation','map','diagram','illustration','reconstruction','composite'].includes(p.mediaType);
    } catch {return false;}
  },
  async ensure(o) {
    const missing=this.missing(o).filter(s=>!this.failed.has(s));
    if(!missing.length)return false;
    await Promise.all(missing.map(s=>{
      if(!this.pending.has(s)){
        const job=Promise.resolve().then(async()=>{
          try {
            const entry=WIKIPEDIA_INDEX.files[s],embedded=globalThis.PARUS_CATALOG_FILES?.[entry.url.split('?')[0]];
            let data;
            if(embedded)data=JSON.parse(embedded);
            else {const response=await fetch(entry.url);if(!response.ok)throw Error('Wikipedia media HTTP '+response.status);data=await response.json();}
            if(data.version!==1||!data.photos||Object.keys(data.photos).length!==entry.count)throw Error('Wikipedia media version');
            for(const [id,p] of Object.entries(data.photos))if(this.shard(id)!==s||!this.valid(id,p))throw Error('Wikipedia media record');
            this.cache.set(s,data.photos);
          } catch {this.failed.add(s);}
          finally {this.pending.delete(s);}
        });
        this.pending.set(s,job);
      }
      return this.pending.get(s);
    }));
    return true;
  },
};
globalThis.Wikipedia=Wikipedia;
