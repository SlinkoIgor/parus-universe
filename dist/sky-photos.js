'use strict';
// Outreach photographs are independent of finder visibility, science and saves.
// Only the identity index is loaded at startup; publisher metadata is lazy.
const SkyPhotos = {
  cache: new Map(), pending: new Map(), failed: new Set(),
  surveys: new Set(SKY_PHOTO_INDEX.surveys||[]),
  stellarDesignation(value) {
    const text=String(value).normalize('NFKD').trim().replace(/^(?:NAME|V\*|\*)\s+/i,''),
      match=text.match(/^(V\d+|[A-Za-zα-ω]+|\d+)(\d*)\s+([A-Za-z]+)(?:\s+([A-Z]))?$/),rules=SKY_PHOTO_INDEX.nameRules;
    if(!match||!rules?.constellations[match[3].toLowerCase()])return '';
    const [,name,number,con,component]=match,
      greek=name.length>1&&name===name.toUpperCase()?null:rules.greek[name.toLowerCase()];
    let prefix;
    if(greek)prefix='bayer'+greek+number;
    else if(/^(?:[A-Z]{1,2}|V\d+)$/.test(name)&&!number)prefix='var'+name.toLowerCase();
    else if(/^\d+$/.test(name)&&!number)prefix='flam'+name;
    else return '';
    return prefix+rules.constellations[con.toLowerCase()]+(component||'').toLowerCase();
  },
  key(s) {
    const designation=this.stellarDesignation(s);if(designation)return designation;
    return String(s).trim().replace(/^(?:NAME|V\*|\*)\s+/i,'').toLowerCase()
      .replace(/messier/g,'m').replace(/gliese/g,'gj').replace(/\bgl\s*(?=\d)/g,'gj')
      .replace(/\b(ngc|ic|m|hip|hd|hr|gj)\s*0*(\d+)/g,'$1$2')
      .normalize('NFKD').replace(/[^a-z0-9+.-]/g,'');
  },
  ownNames(o) {
    if(o.supersededBy){const current=ExtendedCatalog.get(o.supersededBy);if(current)return this.ownNames(current);}
    const names=q=>[q.ngc,q.messier&&'M '+q.messier,...(q.aliases||[])].filter(Boolean),
      host=o.galaxyMember&&o.parentGalaxy&&(typeof object==='function'?object(o.parentGalaxy):
        typeof OBJECTS!=='undefined'?OBJECTS.find(q=>q.id===o.parentGalaxy):null),
      inherited=new Set(host&&host.id!==o.id?names(host).flatMap(s=>[s,s.replace(/^(?:the\s+)?(.+?)\s+galaxy$/i,'$1')]).map(s=>this.key(s)):[]);
    // Cyrillic search labels may contain the host's catalogue code. Removing
    // their letters would silently turn «Андромеда · M31» into an own ID.
    // PHAT's alternate M### labels are M31 cluster names from its source
    // table, not Messier numbers. Keep the source aliases for search, while
    // retaining their PHAT namespace when identifying photographs.
    const phat=/^phat-ap-/.test(o.id)||o.galaxyMember&&/PHAT/.test(o.memberType||'');
    return names(o).filter(s=>!/[а-яё]/i.test(s)&&!inherited.has(this.key(s))&&!(phat&&/^M\d+$/i.test(s)));
  },
  keys(o) {
    if (!o || o.synthetic) return [];
    let names=[],kind=o.kind;
    if(kind==='star') {
      // Some component leaves retain the unresolved system's identifiers.
      // They cannot acquire a photograph of another component through them.
      if(o.unresolvedSourcePhotometry)return [];
      names=[...(o.iauNames||[]),o.hip&&'HIP '+o.hip,o.hd&&'HD '+o.hd,
        ...this.ownNames(o).filter(s=>/^(?:HIP|HD|HR|GJ|Gl|2MASS|IRAS|TYC|LHS|Ross|Wolf|WASP|Kepler|TOI|TRAPPIST|K2)\s*[-\d]/i.test(s)||
          // SIMBAD's explicitly typed own designation retains its component.
          // Untyped search aliases such as Proxima's «α Cen» remain excluded.
          /^(?:\*|V\*)\s+/.test(s)&&!!this.stellarDesignation(s)||
          // Plain proper names are useful for streamed HYG records. Generic
          // Bayer/system names and inherited host identifiers are excluded.
          /^[a-z][a-z'’ -]{3,}$/i.test(s)&&! /^(?:NAME|alpha|beta|gamma|delta|epsilon|alf|alp|bet|gam|del|eps)\b/i.test(s))];
    } else {
      if(kind==='cluster'&&o.catalogClass==='galaxy-cluster')kind='galaxy-cluster';
      else if(['nebula','cluster','galaxy'].includes(kind))kind='deep-sky';
      if(!['deep-sky','galaxy-cluster','blackhole','pulsar','quasar'].includes(kind))return [];
      names=this.ownNames(o);
    }
    return [...new Set(names.filter(Boolean).map(s=>kind+':'+this.key(s)))];
  },
  ids(o) { return [...new Set(this.keys(o).flatMap(k=>SKY_PHOTO_INDEX.targets[k]||[]))].sort((a,b)=>Number(this.surveys.has(a))-Number(this.surveys.has(b))); },
  publisher(id) { return id.startsWith('esawebb-')?'esawebb':id.match(/^astropix-([a-z0-9_]+)-/)?.[1]; },
  validPhoto(id,p,q) {
    const url=new URL(q.url),source=new URL(q.source);
    return q.id===id&&this.publisher(id)===p&&source.protocol==='https:'&&q.credit&&q.rights&&
      (p==='esawebb'?url.origin==='https://cdn.esawebb.org'&&/^\/archives\/images\/screen\/[A-Za-z0-9_.-]+\.jpg$/.test(url.pathname)&&source.origin==='https://esawebb.org':
        url.origin==='https://www.astropix.org'&&url.pathname.startsWith('/archive/'));
  },
  media(o) { return this.ids(o).map(id=>this.cache.get(this.publisher(id))?.[id]).filter(Boolean); },
  missing(o) { return [...new Set(this.ids(o).map(id=>this.publisher(id)).filter(p=>!this.cache.has(p)))]; },
  async ensure(o) {
    const sources=this.missing(o).filter(p=>!this.failed.has(p));
    if(!sources.length)return false;
    await Promise.all(sources.map(p=>{
      if(!this.pending.has(p)) {
        const job=Promise.resolve().then(async()=>{
          try {
            const url=SKY_PHOTO_INDEX.files[p].url,embedded=globalThis.PARUS_CATALOG_FILES?.[url.split('?')[0]];
            let data;
            if(embedded)data=JSON.parse(embedded);
            else {
              const response=await fetch(url);
              if(!response.ok)throw Error('Photo metadata HTTP '+response.status);
              data=await response.json();
            }
            if(data.version!==1||!data.photos||Object.keys(data.photos).length!==SKY_PHOTO_INDEX.files[p].count)throw Error('Photo metadata version');
            for(const [id,q] of Object.entries(data.photos))if(!this.validPhoto(id,p,q))throw Error('Photo metadata record');
            this.cache.set(p,data.photos);
          } catch(error) { this.failed.add(p); }
          finally { this.pending.delete(p); }
        });
        this.pending.set(p,job);
      }
      return this.pending.get(p);
    }));
    return true;
  },
};
globalThis.SkyPhotos=SkyPhotos;
