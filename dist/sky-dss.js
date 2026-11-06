'use strict';
// Presentation reads prepared local records; all photographic astronomy is offline.
const SkyDSS = {
  shards: new Map(),
  url(p, format = 'gif') {
    return 'https://archive.stsci.edu/cgi-bin/dss_search?v=poss2ukstu_red&r=' + encodeURIComponent(p.raDeg) +
      '&d=' + encodeURIComponent(p.decDeg) + '&e=J2000&h=10&w=10&f=' + format + '&c=none';
  },
  direction(o) {
    const p = o.catalogAstrometry?.hyg;
    return p && Number.isFinite(p.raDeg) && Number.isFinite(p.decDeg) ? p : o;
  },
  identifier(o) {
    // Use an exact catalogue identity, never the brightest object in the field
    // or an inferred identity borrowed from another member of the system.
    for (const source of [o.stellarNameSource, o.referenceURL, o.source]) try {
      const u = new URL(source);
      if (['simbad.harvard.edu', 'simbad.cfa.harvard.edu', 'simbad.cds.unistra.fr'].includes(u.hostname)) {
        const id = u.searchParams.get('Ident');
        if (id && id.length < 160) return this.catalogueIdentifier(id);
      }
    } catch {}
    if (/^[1-9]\d*$/.test(String(o.hip || ''))) return 'HIP ' + o.hip;
    if (/^[1-9]\d*$/.test(String(o.hd || ''))) return 'HD ' + o.hd;
    const id = [o.gliese, ...(o.aliases || [])].find(id => typeof id === 'string' &&
      /^(?:(?:HIP|HD|HR|GJ|Gl|Gliese|Gaia DR[23]|2MASS|IRAS|WR|RMC|HH|TYC|UCAC[234])\s+\S|(?:WASP|HATS|HAT-P|KELT|TOI|Kepler|CoRoT|TrES|XO|TRAPPIST)-\d|OGLE-[A-Za-z0-9])/.test(id));
    return id ? this.catalogueIdentifier(id) : null;
  },
  catalogueIdentifier(id) {
    // HYG's Gl 244B and SIMBAD's GJ 244 B are the same component, not GJ 244.
    const gj = id.trim().match(/^(?:Gl|Gliese|GJ)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]*)$/);
    return gj ? 'GJ '+gj[1]+(gj[2]?' '+gj[2]:'') : id.trim();
  },
  preview(o) {
    const record = this.match(o, SKY_DSS_DATA.core[o.id]);
    return this.url(record ? {raDeg:record.position[0], decDeg:record.position[1]} : this.direction(o));
  },
  match(o, record) {
    const p = this.direction(o), key = record?.input;
    // Old saved objects or another catalogue version must not borrow a stale
    // component's calibration. Do not silently use its primary's photograph.
    return key && Math.abs(key[0]-p.raDeg)<1e-8 && Math.abs(key[1]-p.decDeg)<1e-8 && key[2]===this.identifier(o) ? record : null;
  },
  shard(id) {
    let h=2166136261;
    for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);
    return (h>>>0)%SKY_DSS_DATA.shardCount;
  },
  async record(o) {
    if(Object.hasOwn(SKY_DSS_DATA.core,o.id))return this.match(o,SKY_DSS_DATA.core[o.id]);
    const shard=this.shard(o.id);
    if(!this.shards.has(shard)) {
      if(this.shards.size>=8)this.shards.delete(this.shards.keys().next().value);
      const pending=fetch(SKY_DSS_DATA.dataRoot+'/'+shard+'.json', {credentials:'omit'})
        .then(response=>{if(!response.ok)throw Error('Local DSS index '+response.status);return response.json();})
        .catch(error=>{this.shards.delete(shard);throw error;});
      this.shards.set(shard,pending);
    }
    return this.match(o,(await this.shards.get(shard))[o.id]);
  },
  mount(o, figure, signal) {
    const image=figure.querySelector('img'), field=figure.querySelector('.stellar-photo-field'),
      description=figure.querySelector('.stellar-dss-description'), date=figure.querySelector('.stellar-photo-date'), link=figure.querySelector('.stellar-photo-source');
    const load=async()=>{
      if(signal.aborted||!figure.isConnected)return;
      let record=null;
      try{record=await this.record(o);}catch{}
      if(signal.aborted||!figure.isConnected)return;
      const p=record?{raDeg:record.position[0],decDeg:record.position[1]}:this.direction(o), url=this.url(p),
        note='Яркие звёзды бывают пересвечены, тесные компоненты могут сливаться. Орбитальное движение пары и годичный параллакс здесь не учитываются.';
      image.src=url;link.href=url;
      if(record?.date)date.textContent=new Date(record.date.slice(0,10)+'T12:00:00Z').toLocaleDateString('ru-RU',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
      const text=record?.status==='calibrated'
        ? 'Отметка — расчётное положение звезды на дату снимка с учётом собственного движения. '
        : record?.status==='plate-epoch-estimate'
          ? 'Центр поля приблизительный: собственное движение учтено по эпохе ближайшей пластинки DSS. Точное положение на этом кадре не подтверждено; отметка не показана. '
          : record
            ? 'Показано направление из каталога. Собственное движение неизвестно; положение на дату снимка не уточнено, точная отметка не показана. '
            : 'Положение звезды на дату снимка не уточнено; показано каталожное поле без точной отметки. ';
      description.textContent=text+note;
      if(record?.status==='calibrated'&&record.marker){
        const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');
        overlay.classList.add('stellar-photo-overlay');overlay.setAttribute('viewBox','0 0 '+record.size.join(' '));overlay.setAttribute('aria-hidden','true');
        overlay.innerHTML='<circle cx="'+record.marker[0]+'" cy="'+record.marker[1]+'" r="'+record.size[0]/35+'"/>';
        const reveal=()=>{
          if(signal.aborted||!figure.isConnected||overlay.isConnected)return;
          if(image.naturalWidth!==record.size[0]||image.naturalHeight!==record.size[1]){
            description.textContent='Размер снимка не совпал с подготовленной координатной сеткой; точная отметка не показана. '+note;
            return;
          }
          field.append(overlay);
          const north=document.createElement('span');north.className='stellar-photo-north';north.setAttribute('aria-hidden','true');
          north.innerHTML='N <b style="transform:rotate('+record.northAngle+'deg)">↑</b>';field.append(north);
        };
        image.addEventListener('load',reveal,{once:true});if(image.complete&&image.naturalWidth)reveal();
      }
      if(record?.source){
        const credit=document.createElement('a'),sim=record.source.coordinateSource!=='HYG 4.1';
        credit.className='stellar-photo-astrometry';credit.target='_blank';credit.rel='noopener';
        credit.href=sim?'https://simbad.cfa.harvard.edu/simbad/sim-id?Ident='+encodeURIComponent(record.source.identifier):'https://github.com/astronexus/HYG-Database';
        credit.textContent='Данные положения: '+(sim?'SIMBAD':'HYG 4.1')+' ↗';description.append(' ',credit);
      }
    };
    if(typeof IntersectionObserver==='function'){
      const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();load();}}, {root:figure.parentElement,threshold:.05});
      observer.observe(figure);signal.addEventListener('abort',()=>observer.disconnect(),{once:true});
    }else load();
  },
};
globalThis.SkyDSS=SkyDSS;
