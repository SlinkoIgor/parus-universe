'use strict';
// Published single-galaxy photographs with exact, reviewed catalogue identities.
// Only the ID index is loaded initially. Metadata and image pixels remain lazy.
const SkyImaging = {
  cache:new Map(),pending:new Map(),failed:new Set(),limit:8,
  part(o) {
    if(!o||o.synthetic||o.kind!=='galaxy'||o.atlasOnly||SKY_IMAGING_INDEX.catalogueRevision!==EXTENDED_BOOT.revision)return undefined;
    return Object.hasOwn(SKY_IMAGING_INDEX.targets,o.id)?SKY_IMAGING_INDEX.targets[o.id]:undefined;
  },
  has(o) { return this.part(o)!==undefined; },
  missing(o) { const part=this.part(o);return part===undefined||this.cache.has(part)?[]:[part]; },
  media(o) {
    const part=this.part(o),photos=this.cache.get(part);
    if(!photos)return [];
    this.cache.delete(part);this.cache.set(part,photos);
    return photos[o.id]?[photos[o.id]]:[];
  },
  async ensure(o) {
    const part=this.missing(o)[0];if(part===undefined||this.failed.has(part))return false;
    if(!this.pending.has(part)){
      const job=Promise.resolve().then(async()=>{
        try{
          const entry=SKY_IMAGING_INDEX.files[part],embedded=globalThis.PARUS_CATALOG_FILES?.[entry.url.split('?')[0]];
          let data;
          if(embedded)data=JSON.parse(embedded);
          else{const response=await fetch(entry.url);if(!response.ok)throw Error('SGA metadata HTTP '+response.status);data=await response.json();}
          if(data.version!==1||!data.photos||Object.keys(data.photos).length!==entry.count)throw Error('SGA metadata version');
          for(const [id,p] of Object.entries(data.photos))if(p.targetId!==id||SKY_IMAGING_INDEX.targets[id]!==part||
            !/^sga-grz-\d+$/.test(p.id)||!p.url.startsWith('https://portal.nersc.gov/project/cosmo/data/sga/2020/data/')||
            !p.url.endsWith('-largegalaxy-image-grz.jpg')||!p.source.startsWith('https://')||!p.credit||!p.rights)throw Error('SGA metadata identity');
          this.cache.set(part,data.photos);
          while(this.cache.size>this.limit)this.cache.delete(this.cache.keys().next().value);
        }catch(error){this.failed.add(part);}
        finally{this.pending.delete(part);}
      });
      this.pending.set(part,job);
    }
    await this.pending.get(part);return true;
  },
};
globalThis.SkyImaging=SkyImaging;
