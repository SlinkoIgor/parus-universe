'use strict';
// Membership uses each record's own provenance, never its host or neighbours.
// The build discovers entries and counts from the active catalogue and layers.
const CatalogRegistry = {
  aliases: {'HYG':'hyg','HYG 4.1':'hyg','OpenNGC':'opengc','ATNF':'atnf','ATNF 2.9.0':'atnf',
    'Nearby-Galaxies':'nearby','Cosmicflows-4':'cf4','IAU WGSN':'iau','SIMBAD':'simbad'},
  titles: {hyg:'HYG 4.1 · звёзды',opengc:'OpenNGC · NGC / IC',atnf:'ATNF 2.9.0 · пульсары',
    nearby:'UNGC · близкие галактики',cf4:'Cosmicflows-4 · галактики',
    blackholes:'Сводный каталог чёрных дыр',iau:'IAU WGSN · имена звёзд',simbad:'SIMBAD · отдельные объекты',
    'nuclear-stars':'S-звёзды · опубликованные орбиты',literature:'Отдельные научные публикации',
    cosmology:'Космологическая модель',game:'Игровые звёзды',
    'gaia-clusters':'Gaia · скопления Hunt–Reffert',globularmodels:'Baumgardt · шаровые скопления',
    'sdss-filaments':'SDSS · нити Tempel','sdss-superclusters':'SDSS · сверхскопления Liivamägi',
    'sdss-voids':'SDSS · войды Nadathur–Hotchkiss',nasa:'NASA · отдельные объекты',
    orb6:'ORB6 · орбиты двойных звёзд',msc:'MSC · кратные звёзды',sb9:'SB9 · спектроскопические двойные',
    'hipparcos-2007':'Hipparcos 2007 · астрометрия'},
  cache: new WeakMap(),
  key(name) { return this.aliases[name] || name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,''); },
  sourceCatalog(o) {
    const url = o.source || '';
    if (/\/wds\/orb6(?:\/|\.)/.test(url)) return 'ORB6';
    if (url.includes('J/ApJS/235/6')) return 'MSC';
    if (url.includes('B/sb9')) return 'SB9';
    return null;
  },
  primary(o) {
    if (o.catalog === 'HYG 4.1 + IAU WGSN') return 'HYG';
    if (o.catalog === 'OpenNGC + SIMBAD literature distances') return 'OpenNGC';
    if (o.catalog === 'IAU WGSN + SIMBAD') return 'SIMBAD';
    if (o.catalog === 'GalaxyDisks') {
      const url = o.referenceURL || o.source || '';
      return url.includes('152/62') ? 'LGGS' : url.includes('802/127') ? 'PHAT/AP' : url.includes('855/140') ? 'M33 SNR · Long 2018' : o.catalog;
    }
    if (o.distantCatalog) return o.facts?.refs?.[0]?.[1];
    if (o.catalog) return o.catalog;
    return this.sourceCatalog(o);
  },
  ownMemberships(o) {
    if (o.synthetic) return ['game'];
    if (o.cosmicEpoch || o.kind === 'horizon') return ['cosmology'];
    const names = [this.primary(o),this.sourceCatalog(o), ...(o.catalogMeasurements || []).map(m => m.catalog)].filter(Boolean);
    const ids = new Set(names.map(n => this.key(n)));
    const refs = [o.source,o.coordinateSource,o.coordinateModel,...(o.facts?.refs || []).flat()].filter(Boolean).join(' ');
    // Promoted components retain their original HYG identity after enrichment.
    if (o.hygId != null || /^hyg-\d+$/.test(o.id || '') || /HYG(?:-Database|\s|$)/i.test(refs)) ids.add('hyg');
    if (o.kind === 'home' && typeof EXTENDED_BOOT !== 'undefined' && EXTENDED_BOOT.sourceCoverage.HYG.sunIncluded) ids.add('hyg');
    if (/^(NGC|IC)\s*\d/i.test(o.ngc || '') || /OpenNGC/i.test(refs)) ids.add('opengc');
    if (/atnf\.csiro\.au|\bATNF\b/i.test(refs)) ids.add('atnf');
    if (o.iauNames?.length) ids.add('iau');
    if (/simbad\./i.test(refs) || o.astrometrySource === 'SIMBAD matched parallax') ids.add('simbad');
    if (o.astrometrySource === 'I/311 HIP2007') ids.add('hipparcos-2007');
    if (o.nuclearStar) ids.add('nuclear-stars');
    if (o.blackHoleCatalog || o.blackHolePopulation) ids.add('blackholes');
    return [...ids];
  },
  urls(o) {
    return [...new Set([o.referenceURL,o.source,...(o.catalogMeasurements || []).map(m=>m.source),
      ...(o.facts?.refs || []).map(r=>r[0])].filter(s=>/^https?:\/\//.test(s || '')))];
  },
  memberships(o) {
    if (!o || !o.id) return [];
    if (this.cache.has(o)) return this.cache.get(o);
    const ids = new Set(this.ownMemberships(o));
    if (!ids.size) ids.add('literature');
    const result = [...ids]; this.cache.set(o,result); return result;
  },
  get data() { return typeof CATALOG_REGISTRY_DATA === 'undefined' ? {entries:[]} : CATALOG_REGISTRY_DATA; },
  get entries() { return this.data.entries; },
  defaultHidden(o) { return o.kind === 'void' || !!(o.cosmicCatalog && !o.cosmicLandmark && o.cosmicSubtype === 'supercluster'); },
  get total() { return this.data.total + this.stats({id:'game'}).total; },
  matches(o,id) { return this.memberships(o).includes(id); },
  get filters() {
    if (!this.filterOptions) this.filterOptions = Object.fromEntries([['all',['Все каталоги','']],
      ...this.entries.map(e=>[e.id,[e.name,e.description,e.categories]])]);
    return this.filterOptions;
  },
  stats(entry) {
    if (entry.id !== 'game') return entry;
    const objects = new Map([...OBJECTS,...ExtendedCatalog.pinned.values()].filter(o=>o.synthetic).map(o=>[o.id,o]));
    return {...entry,total:objects.size,mapped:objects.size};
  },
  libraryHTML() {
    const escape = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const number = n=>n.toLocaleString('ru-RU');
    return '<div class="catalog-source-list">'+this.entries.map(entry=>{
      const e = this.stats(entry);
      const links = e.urls.map(url=>'<a href="'+escape(url)+'" target="_blank" rel="noopener">'+escape(url.replace(/^https?:\/\//,''))+' ↗</a>');
      return '<section class="catalog-source-row" data-catalog-source="'+escape(e.id)+'"><h3>'+escape(e.name)+'</h3>'+
        '<p class="catalog-source-counts">В атласе: '+number(e.total)+' · на карте: '+number(e.mapped)+'</p>'+
        '<p>'+escape(e.description)+'</p>'+
        (links.length===1?'<p class="catalog-source-link">'+links[0]+'</p>':links.length?'<details class="catalog-source-refs"><summary>Публикации и данные · '+links.length+'</summary><ul>'+links.map(link=>'<li>'+link+'</li>').join('')+'</ul></details>':'')+'</section>';
    }).join('')+'</div>';
  },
};
globalThis.CatalogRegistry = CatalogRegistry;
