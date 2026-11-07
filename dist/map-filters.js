'use strict';
// Presentation preferences only. Search, catalogue records and flight saves are independent.
const MapFilters = {
  collection: 'all',
  catalog: 'all',
  classes: ['all', 'star', 'pulsar', 'blackhole', 'quasar', 'nebula', 'galaxy',
    'stellar-cluster', 'galaxy-cluster', 'structure', 'void', 'horizon'],
  collections: {
    all: ['Все объекты', ''],
    'naked-eye': ['Звёзды, видимые глазом', 'Каталожная яркость V ≤ 6 с Земли. Нужны тёмное небо и подходящая широта; неразрешённая пара не считается двумя видимыми звёздами.', ['star']],
    messier: ['Объекты Мессье · M1–M110', 'Туманности, скопления и галактики с номером Мессье. Записи без надёжного положения остаются в поиске; M40 — оптическая пара без единой дальности.', ['star', 'stellar-cluster', 'nebula', 'galaxy']],
    nearby: ['Соседи Солнца · до 25 св. лет', 'Звёзды с известной каталожной дальностью не более 25 световых лет от Солнца.', ['star', 'home']],
    multiple: ['Двойные и кратные звёзды', 'Компоненты систем, представленных в каталоге. Принадлежность к системе не означает, что её орбита известна.', ['star']],
    remnants: ['Компактные объекты', 'Белые карлики, пульсары и чёрные дыры, включая сверхмассивные. Белые карлики определяются по собственному классу или спектру.', ['star', 'pulsar', 'blackhole']],
  },
  catalogs: {
    all: ['Все каталоги', ''],
    hyg: ['HYG · звёзды', 'Звёзды с идентификатором или источником HYG.', ['star', 'home']],
    opengc: ['OpenNGC · NGC / IC', 'Объекты с идентификатором NGC или IC из используемой выборки OpenNGC.', ['star', 'stellar-cluster', 'nebula', 'galaxy']],
    atnf: ['ATNF · пульсары', 'Пульсары с источником ATNF Pulsar Catalogue.', ['pulsar']],
    nearby: ['UNGC · близкие галактики', 'Галактики с измерениями Updated Nearby Galaxy Catalog (Nearby-Galaxies), включая сопоставленные записи.', ['galaxy']],
    cf4: ['Cosmicflows-4 · галактики', 'Галактики с измерениями Cosmicflows-4, включая сопоставленные записи.', ['galaxy']],
    blackholes: ['Сводный каталог чёрных дыр', 'Источники из отдельной подборки чёрных дыр. Статусы кандидатов и ограничения измерений указаны в карточках.', ['blackhole']],
  },
  classNames: {'star':'Звёзды',pulsar:'Пульсары',blackhole:'Чёрные дыры',quasar:'Квазары',nebula:'Туманности',galaxy:'Галактики','stellar-cluster':'Звёздные скопления','galaxy-cluster':'Скопления галактик',structure:'Мегаструктуры',void:'Войды',horizon:'Горизонт'},
  tab: 'classes',
  selection: null,
  objects: new Map(),
  promoted: new Set(),
  narrow: false,
  limit: 300,
  revision: 0,
  options(group) {
    return group === 'classes' ? Object.keys(this.classNames) : Object.keys(this[group]).filter(k => k !== 'all');
  },
  defaults(group) { return group === 'classes' ? this.options(group).filter(k => k !== 'void') : []; },
  values(group) { return this.selection?.[group] || this.defaults(group); },
  all(group) { return this.values(group).length === this.options(group).length; },
  unrestricted(group) { return group === 'classes' ? this.all(group) : this.values(group).length === 0; },
  get key() { return ['classes','collections','catalogs'].map(g => this.unrestricted(g) ? 'all' : this.values(g).join(',')).join('|'); },
  get count() { return ['classes','collections','catalogs'].filter(g => !this.unrestricted(g)).length; },
  anchor(o) { return o?.id === 'sol' || o?.id === 'milkyway' || o?.kind === 'planet'; },
  classOf(o) {
    return o.kind === 'home' ? 'star' : o.kind === 'cluster' ? MapDetails.group(o) :
      ['wall','ring','arc'].includes(o.kind) ? 'structure' : o.kind;
  },
  allowsCategory(category) {
    const kind = category === 'home' ? 'star' : ['filament','supercluster','wall','ring','arc'].includes(category) ? 'structure' : category;
    return this.values('classes').includes(kind) && ['collections','catalogs'].every(g =>
      this.unrestricted(g) || this.values(g).some(k => this[g][k][2]?.includes(category)));
  },
  matches(o) {
    if (this.anchor(o)) return true;
    if (!this.values('classes').includes(this.classOf(o))) return false;
    if (!o?.id) return true; // Category probes have no individual source metadata.
    return (this.unrestricted('collections') || this.values('collections').some(k => this.matchesCollection(o, k))) &&
      (this.unrestricted('catalogs') || this.values('catalogs').some(k => this.matchesCatalog(o, k)));
  },
  matchesCatalog(o, catalog) {
    const sources = [o.source, o.coordinateSource, o.catalog, ...(o.facts?.refs || []).flat()].join(' ');
    const measurement = name => o.catalog === name ||
      (o.catalogMeasurements || []).some(m => m.catalog === name);
    switch (catalog) {
      case 'hyg': return o.hygId != null || /HYG(?:-Database|\s|$)/i.test(sources);
      case 'opengc': return /^(NGC|IC)\s*\d/i.test(o.ngc || '') || /OpenNGC/i.test(sources);
      case 'atnf': return /atnf\.csiro\.au|\bATNF\b/i.test(sources);
      case 'nearby': return measurement('Nearby-Galaxies');
      case 'cf4': return measurement('Cosmicflows-4');
      case 'blackholes': return !!o.blackHoleCatalog;
      default: return false;
    }
  },
  matchesCollection(o, collection) {
    switch (collection) {
      case 'all': return true;
      case 'naked-eye': return o.kind === 'star' && !o.synthetic && !o.unresolvedSourcePhotometry &&
        Number.isFinite(o.apparentV) && o.apparentV <= 6;
      // Use the object's own designation: M87* is not Messier 87, nor is the Crab pulsar M1.
      case 'messier': return /^(?:0?[1-9]|[1-9]\d|10\d|110)$/.test(String(o.messier || '').replace(/^0+(?=\d)/, ''));
      case 'nearby': return ['star', 'home'].includes(o.kind) && !o.synthetic &&
        Number.isFinite(o.d) && o.d >= 0 && o.d <= 25;
      case 'multiple': return o.kind === 'star' && !o.synthetic &&
        !!(o.stellarSystem || o.boundSystemPrimary || ExtendedCatalog.systemByMember.has(o.id));
      case 'remnants': return ['pulsar', 'blackhole'].includes(o.kind) ||
        o.kind === 'star' && !o.synthetic && (/бел[а-яё]*\s+карлик/i.test(o.type || '') || /^D(?:[ABCOQXZ0-9]|$)/i.test(o.spectral || ''));
      default: return false;
    }
  },
  promotes(o) { return this.narrow && this.promoted.has(o?.id) && this.matches(o); },
  collapsedStar(o, span) {
    return o?.kind === 'star' && span >= 100000 && this.values('collections').length === 1 &&
      this.values('collections')[0] === 'naked-eye';
  },
  bucketMatches(b) {
    return this.values('classes').includes(b[0]) && ['collections','catalogs'].every((g,i) =>
      this.unrestricted(g) || !!(b[i+1] & this.masks[g]));
  },
  refreshSelection() {
    const revision = ++this.revision;
    this.objects.clear(); this.promoted.clear(); this.narrow = false; this.loading = false; this.loadError = false;
    this.masks = Object.fromEntries(['collections','catalogs'].map(g => [g,
      this.options(g).reduce((mask,k,i) => mask | (this.values(g).includes(k) ? 1 << i : 0), 0)]));
    const data = typeof MAP_FILTER_DATA === 'undefined' ? null : MAP_FILTER_DATA;
    // Never infer a small complete selection from whichever tiles happen to be loaded.
    if (!data || data.version !== 1 || data.catalogRevision !== EXTENDED_BOOT.revision ||
        data.collections.join() !== this.options('collections').join() ||
        data.catalogs.join() !== this.options('catalogs').join()) return;
    const buckets = data.buckets.filter(b => this.bucketMatches(b));
    const core = OBJECTS.filter(o => !o.atlasOnly && !o.supersededBy && !MapGeometry.unlocated(o) && !this.anchor(o) && this.matches(o));
    this.total = core.length + buckets.reduce((n,b) => n + b[3], 0);
    if (this.total > Math.min(this.limit, data.limit)) return;
    this.narrow = true;
    const refs = buckets.flatMap(b => b[4] || []);
    const requested = new Set(refs.map(r => r[0]));
    this.promoted = new Set([...core.map(o => o.id), ...refs.map(r => r[0])]);
    const files = [...new Set(refs.map(r => r[1]))];
    if (!files.length || typeof fetch !== 'function' && !globalThis.PARUS_CATALOG_FILES) return;
    this.loading = true;
    // Bounded, separate presentation references: no expedition pins or saved catalogue objects.
    this.pending = (async () => {
      let cursor = 0;
      await Promise.all(Array.from({length:Math.min(3,files.length)}, async () => {
        while (revision === this.revision && cursor < files.length) {
          const file = files[cursor++];
          try {
            const rows = await ExtendedCatalog.tile(file);
            if (revision !== this.revision) return;
            for (const row of rows) if (requested.has(row.id)) {
              const o = ExtendedCatalog.coreIndex.get(row.id) || row;
              if (!this.matches(o)) continue;
              ExtendedCatalog.prepareGalaxy(o); this.objects.set(o.id,o);
            }
          } catch { if (revision === this.revision) this.loadError = true; }
        }
      }));
      if (revision !== this.revision) return;
      this.loading = false; RegionMap.renderCache = null; this.sync();
    })();
  },
  invalidate() {
    ExtendedCatalog.systemView = null;
    hover = null;
    hitObjects = [];
    RegionMap.hits = [];
    RegionMap.renderCache = null;
    if (globalThis.MapAnnotations) MapAnnotations.hits = [];
    MapLayers.landmarkContext = null;
    MapLayers.lastUpdate = ExtendedCatalog.lastUpdate = -Infinity;
  },
  change(classFilter, collection, catalog, save = true) {
    this.selection = Object.fromEntries([['classes',classFilter],['collections',collection],['catalogs',catalog]].map(([g,v]) => {
      const valid = this.options(g), values = Array.isArray(v) ? v : v === 'all' ? (g === 'classes' ? valid : []) : valid.includes(v) ? [v] : this.defaults(g);
      return [g,valid.filter(k => values.includes(k))];
    }));
    filter = this.values('classes').length === 1 ? this.values('classes')[0] : 'all';
    this.collection = this.unrestricted('collections') ? 'all' : this.values('collections').join(',');
    this.catalog = this.unrestricted('catalogs') ? 'all' : this.values('catalogs').join(',');
    this.invalidate(); this.refreshSelection(); this.sync();
    if (save) {
      try { localStorage.setItem('parus-map-filters-v3', JSON.stringify(this.selection)); } catch {}
    }
  },
  setGroup(group, values) {
    const selection = {...this.selection,[group]:values};
    this.change(selection.classes,selection.collections,selection.catalogs);
  },
  setTab(group, focus = false) {
    this.tab = group;
    $('mapFilters').querySelector('.map-filter-scroll').scrollTop = 0;
    for (const g of ['classes','collections','catalogs']) {
      $('filterPanel-'+g).hidden = group !== g;
      $('filterTab-'+g).setAttribute('aria-selected',String(group === g));
      $('filterTab-'+g).tabIndex = group === g ? 0 : -1;
    }
    this.sync();
    if (focus) $('filterTab-'+group).focus({preventScroll:true});
  },
  sync() {
    for (const input of document.querySelectorAll('#mapFilters input[data-filter-group]'))
      input.checked = this.values(input.dataset.filterGroup).includes(input.value);
    for (const group of ['collections','catalogs']) {
      $('filterCount-'+group).textContent = this.values(group).length;
      $('filterCount-'+group).hidden = this.values(group).length === 0;
    }
    const names = ['classes','collections','catalogs'].filter(g => !this.unrestricted(g)).map(g =>
      this.values(g).length ? this.values(g).map(k => g === 'classes' ? this.classNames[k] : this[g][k][0]).join(', ') : 'ничего не выбрано');
    const label = 'Фильтры карты' + (names.length ? ': '+names.join(' · ') : '');
    $('mapFilterBtn').title = label; $('mapFilterBtn').setAttribute('aria-label',label);
    $('mapFilterBtn').classList.toggle('has-filters',this.count > 0);
    $('mapFilterCount').textContent = this.count; $('mapFilterCount').hidden = !this.count;
    $('mapFilterAllText').textContent = {classes:'Все объекты',collections:'Все подборки',catalogs:'Все каталоги'}[this.tab];
    $('mapFilterAll').checked = this.all(this.tab);
    $('mapFilterAll').indeterminate = this.values(this.tab).length > 0 && !this.all(this.tab);
    $('mapFilterAll').setAttribute('aria-controls', this.options(this.tab).map(k => 'map-filter-'+this.tab+'-'+k).join(' '));
    $('mapFilterStatus').textContent = this.loading ? 'Загружаем все объекты выборки…' : this.loadError ? 'Часть объектов не загрузилась. Смените фильтр, чтобы повторить.' :
      this.narrow ? (this.total ? 'Объектов: '+this.total : 'Нет объектов по выбранным условиям.') : '';
    $('mapFilterStatus').hidden = !$('mapFilterStatus').textContent;
  },
  pickerOpen() { return false; },
  close() {
    const restoreFocus = document.activeElement?.closest('#mapFilters');
    $('mapFilters').hidden = true; $('mapFilterBtn').setAttribute('aria-expanded','false');
    if (restoreFocus) $('mapFilterBtn').focus({preventScroll:true});
  },
  open() {
    closeCatalog(); closeMenu();
    $('themePicker').hidden = true; $('themeBtn').setAttribute('aria-expanded','false');
    this.setTab('classes');
    $('mapFilters').hidden = false; $('mapFilterBtn').setAttribute('aria-expanded','true');
    $('filterTab-classes').focus({preventScroll:true});
  },
  setup() {
    for (const group of ['classes','collections','catalogs']) {
      const panel = $('filterPanel-'+group); panel.replaceChildren();
      for (const value of this.options(group)) {
        const label = document.createElement('label'), input = document.createElement('input'), text = document.createElement('span');
        label.className = 'map-filter-option';
        input.type = 'checkbox'; input.value = value; input.dataset.filterGroup = group;
        input.id = 'map-filter-'+group+'-'+value;
        const title = document.createElement('strong'); title.textContent = group === 'classes' ? this.classNames[value] : this[group][value][0]; text.append(title);
        if (group === 'classes' && value === 'void') {
          const note = document.createElement('small'); note.className = 'map-filter-note'; note.textContent = 'по умолчанию выкл'; text.append(note);
        }
        label.append(input); label.append(text); panel.append(label);
        input.onchange = () => this.setGroup(group,this.options(group).filter(k => k === value ? input.checked : this.values(group).includes(k)));
      }
      $('filterTab-'+group).onclick = () => this.setTab(group);
      $('filterTab-'+group).onkeydown = event => {
        const groups = ['classes','collections','catalogs'], i = groups.indexOf(group);
        const next = {ArrowRight:(i+1)%3,ArrowLeft:(i+2)%3,Home:0,End:2}[event.key];
        if (next === undefined) return;
        event.preventDefault(); this.setTab(groups[next],true);
      };
    }
    let saved;
    try { saved = JSON.parse(localStorage.getItem('parus-map-filters-v3')); } catch {}
    if (saved && !Array.isArray(saved)) this.change(saved.classes,saved.collections,saved.catalogs,false);
    else {
      let previous;
      try { previous = JSON.parse(localStorage.getItem('parus-map-filters-v2')); } catch {}
      if (previous && !Array.isArray(previous)) {
        const migrate = group => Array.isArray(previous[group]) && this.options(group).every(k => previous[group].includes(k)) ? [] : previous[group];
        this.change(previous.classes,migrate('collections'),migrate('catalogs'),false);
      } else {
        let legacy;
        try { legacy = JSON.parse(localStorage.getItem('parus-map-filters-v1')); } catch {}
        this.change(legacy?.classFilter === 'all' ? undefined : legacy?.classFilter,legacy?.collection,legacy?.catalog,false);
      }
    }
    $('mapFilterBtn').onclick = () => $('mapFilters').hidden ? this.open() : this.close();
    $('closeMapFilters').onclick = () => this.close();
    $('mapFilterAll').onchange = () => this.setGroup(this.tab, $('mapFilterAll').checked ? this.options(this.tab) : []);
    $('mapFilters').onkeydown = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); this.close();
    };
  },
};
globalThis.MapFilters = MapFilters;
