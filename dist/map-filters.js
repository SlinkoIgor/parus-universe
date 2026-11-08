'use strict';
// Presentation preferences only. Search, catalogue records and flight saves are independent.
const MapFilters = {
  collection: 'all',
  catalog: 'all',
  classes: ['all', 'star', 'pulsar', 'blackhole', 'quasar', 'nebula', 'galaxy',
    'stellar-cluster', 'galaxy-cluster', 'structure', 'void', 'horizon'],
  collections: {
    all: ['Все объекты', ''],
    photos: ['Красивые снимки', 'Объекты со снимками Hubble, Webb, ESO и других обсерваторий. Карты неба и обзорные поля DSS не учитываются.', ['home','star','pulsar','blackhole','quasar','nebula','galaxy','cluster','stellar-cluster','galaxy-cluster']],
    'naked-eye': ['Звёзды, видимые глазом', 'Каталожная яркость V ≤ 6 с Земли. Нужны тёмное небо и подходящая широта; неразрешённая пара не считается двумя видимыми звёздами.', ['star']],
    messier: ['Объекты Мессье · M1–M110', 'Туманности, скопления и галактики с номером Мессье. Записи без надёжного положения остаются в поиске; M40 — оптическая пара без единой дальности.', ['star', 'stellar-cluster', 'nebula', 'galaxy']],
    nearby: ['Соседи Солнца · до 25 св. лет', 'Звёзды с известной каталожной дальностью не более 25 световых лет от Солнца.', ['star', 'home']],
    multiple: ['Двойные и кратные звёзды', 'Компоненты систем, представленных в каталоге. Принадлежность к системе не означает, что её орбита известна.', ['star']],
    remnants: ['Компактные объекты', 'Белые карлики, пульсары и чёрные дыры, включая сверхмассивные. Белые карлики определяются по собственному классу или спектру.', ['star', 'pulsar', 'blackhole']],
    'pre-telescope': ['Известны до Галилея · до 1609', 'Туманности, скопления и галактики из исторической таблицы SEDS, известные до телескопических наблюдений Галилея. Это проверенная часть атласа, а не полный список древнего неба.', ['star', 'stellar-cluster', 'nebula', 'galaxy']],
    galileo: ['В телескоп Галилея · 1610', 'Ясли (M44) и Плеяды (M45): Галилей рассмотрел в них отдельные звёзды. Сами скопления известны с древности; это не их открытие.', ['stellar-cluster']],
    'messier-discoveries': ['Открытия Шарля Мессье', 'Объекты, открытие которых историческая таблица SEDS приписывает самому Мессье. Объекты других первооткрывателей из его каталога сюда не входят.', ['star', 'stellar-cluster', 'nebula', 'galaxy']],
    'before-herschel': ['До обзора Гершеля · 1782', 'Объекты из исторической таблицы SEDS, известные до начала систематического обзора Уильяма Гершеля в сентябре 1782 года. Спорные отождествления исключены.', ['star', 'stellar-cluster', 'nebula', 'galaxy']],
    'brightest-stars': ['Ярчайшие звёзды · V ≤ 1,5', 'Индивидуальная каталожная яркость V не слабее 1,5 с Земли. Суммарная фотометрия неразрешённых пар исключена.', ['star']],
    'planetary-nebulae': ['Планетарные туманности', 'Газовые оболочки звёзд с собственным классом PN в OpenNGC. Название историческое: к планетам эти туманности не относятся.', ['nebula']],
    'supernova-remnants': ['Остатки сверхновых', 'Туманности с собственным каталожным классом SNR. Пульсар внутри остатка — отдельный объект.', ['nebula']],
    'globular-clusters': ['Шаровые звёздные скопления', 'Скопления с собственным классом GCl или явным типом «шаровое скопление». Не включает скопления галактик.', ['stellar-cluster']],
    'nearby-galaxies': ['Галактический двор · до 15 млн св. лет', 'Галактики с принятой каталожной дальностью не более 15 миллионов световых лет. Это отбор по расстоянию, а не по членству в Местной группе.', ['galaxy']],
    'early-universe': ['Ранняя Вселенная · z ≥ 6', 'Галактики и квазары с каталожным красным смещением z ≥ 6. Метод измерения и неопределённость сохраняются в исходных карточках.', ['galaxy', 'quasar']],
  },
  get catalogs() { return CatalogRegistry.filters; },
  classNames: {'star':'Звёзды',pulsar:'Пульсары',blackhole:'Чёрные дыры',quasar:'Квазары',nebula:'Туманности',galaxy:'Галактики','stellar-cluster':'Звёздные скопления','galaxy-cluster':'Скопления галактик',structure:'Мегаструктуры',void:'Войды',horizon:'Горизонт'},
  tab: 'classes',
  activeGroup: 'classes',
  selection: null,
  objects: new Map(),
  promoted: new Set(),
  narrow: false,
  limit: 300,
  collectionLimits: {photos:2000},
  selectionLimit() {
    return this.activeGroup==='collections' && this.values('collections').length===1 ?
      this.collectionLimits[this.values('collections')[0]] || this.limit : this.limit;
  },
  revision: 0,
  options(group) {
    return group === 'classes' ? Object.keys(this.classNames) : Object.keys(this[group]).filter(k => k !== 'all');
  },
  defaults(group) {
    return group === 'classes' ? this.options(group).filter(k => k !== 'void') :
      group === 'catalogs' ? CatalogRegistry.entries.filter(e => e.defaultSelected).map(e => e.id) : [];
  },
  values(group) { return this.selection?.[group] || this.defaults(group); },
  isDefault(group = this.activeGroup) {
    const values = this.values(group), defaults = this.defaults(group);
    return values.length === defaults.length && defaults.every(k => values.includes(k));
  },
  // The ordinary overview selects sources with ordinary records, hiding bulk envelopes.
  // Explicit class/source choices expose the complete matching records.
  defaultHidden(o) { return CatalogRegistry.defaultHidden(o); },
  all(group) { return this.values(group).length === this.options(group).length; },
  unrestricted(group) { return group !== this.activeGroup || (group === 'collections' ? this.values(group).length === 0 : this.all(group)); },
  get key() { return ['classes','collections','catalogs'].map(g => this.unrestricted(g) ? 'all' : this.values(g).join(',')).join('|') + (this.isDefault() ? '|default' : ''); },
  get count() { return this.isDefault() ? 0 : 1; },
  anchor(o) { return o?.id === 'sol' || o?.id === 'milkyway' || o?.kind === 'planet'; },
  classOf(o) {
    return o.kind === 'home' ? 'star' : o.kind === 'cluster' ? MapDetails.group(o) :
      ['wall','ring','arc'].includes(o.kind) ? 'structure' : o.kind;
  },
  allowsCategory(category) {
    const kind = category === 'home' ? 'star' : ['filament','supercluster','wall','ring','arc'].includes(category) ? 'structure' : category;
    if (this.isDefault() && (kind === 'void' || category === 'supercluster')) return false;
    return (this.unrestricted('classes') || this.values('classes').includes(kind)) && ['collections','catalogs'].every(g =>
      this.unrestricted(g) || this.values(g).some(k => this[g][k][2]?.includes(category)));
  },
  matches(o) {
    if (this.anchor(o)) return true;
    if (this.isDefault() && this.defaultHidden(o)) return false;
    if (!this.unrestricted('classes') && !this.values('classes').includes(this.classOf(o))) return false;
    if (!o?.id) return true; // Category probes have no individual source metadata.
    return (this.unrestricted('collections') || this.values('collections').some(k => this.matchesCollection(o, k))) &&
      (this.unrestricted('catalogs') || this.values('catalogs').some(k => this.matchesCatalog(o, k)));
  },
  matchesCatalog(o, catalog) {
    return CatalogRegistry.matches(o,catalog);
  },
  matchesCollection(o, collection = this.collection) {
    switch (collection) {
      case 'all': return true;
      // Complete selections already carry their reviewed catalogue identities.
      case 'photos': return !o?.synthetic && (this.narrow && this.collection==='photos' ?
        this.promoted.has(o?.id) : SkyGuide.hasObservatoryPhoto(o));
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
      case 'pre-telescope': case 'galileo': case 'messier-discoveries': case 'before-herschel':
        return this.historical(o, collection);
      case 'brightest-stars': return this.matchesCollection(o, 'naked-eye') && o.apparentV <= 1.5;
      case 'planetary-nebulae': return o.kind === 'nebula' && this.catalogType(o, 'PN');
      case 'supernova-remnants': return o.kind === 'nebula' && this.catalogType(o, 'SNR');
      case 'globular-clusters': return o.kind === 'cluster' &&
        (this.catalogType(o, 'GCl') || /ШАРОВОЕ\s+СКОПЛЕНИЕ/i.test(o.type || ''));
      case 'nearby-galaxies': return o.kind === 'galaxy' && !o.synthetic &&
        Number.isFinite(o.d) && o.d >= 0 && o.d <= 15e6;
      case 'early-universe': return ['galaxy', 'quasar'].includes(o.kind) && !o.synthetic &&
        Number.isFinite(o.redshift) && o.redshift >= 6;
      default: return false;
    }
  },
  catalogType(o, type) {
    return o.catalogType === type || (o.type || '').split('·').pop().trim() === type;
  },
  historical(o, collection) {
    if (o.synthetic || !['home', 'star', 'cluster', 'nebula', 'galaxy'].includes(o.kind)) return false;
    const data = typeof MAP_COLLECTION_HISTORY === 'undefined' ? null : MAP_COLLECTION_HISTORY.members;
    if (!data) return false;
    // Only the object's own identifiers: never inherit the discovery of a host or neighbour.
    const messier = String(o.messier || '').replace(/^0+(?=\d)/, '');
    const ngc = /^(NGC|IC)\s*0*(\d+)$/i.exec(o.ngc || '');
    return ['id:'+o.id, 'M'+messier, ngc && ngc[1].toUpperCase()+Number(ngc[2])]
      .some(key => key && data[key]?.includes(collection));
  },
  promotes(o) { return this.narrow && this.promoted.has(o?.id) && this.matches(o); },
  collapsedStar(o, span) {
    return this.activeGroup === 'collections' && o?.kind === 'star' && span >= 100000 && this.values('collections').length === 1 &&
      this.values('collections')[0] === 'naked-eye';
  },
  bucketMatches(b) {
    return (!this.isDefault() || !b[5]) &&
      (this.unrestricted('classes') || this.values('classes').includes(b[0])) &&
      (this.unrestricted('collections') || !!(b[1] & this.masks.collections)) &&
      (this.unrestricted('catalogs') || b[2].some(id=>this.values('catalogs').includes(id)));
  },
  refreshSelection() {
    const revision = ++this.revision;
    this.objects.clear(); this.promoted.clear(); this.narrow = false; this.loading = false; this.loadError = false;
    this.masks = {collections:this.options('collections').reduce((mask,k,i)=>mask | (this.values('collections').includes(k)?1<<i:0),0)};
    const data = typeof MAP_FILTER_DATA === 'undefined' ? null : MAP_FILTER_DATA;
    // Never infer a small complete selection from whichever tiles happen to be loaded.
    if (!data || data.version !== 3 || data.catalogRevision !== EXTENDED_BOOT.revision ||
        data.collections.join() !== this.options('collections').join() ||
        data.catalogs.join() !== this.options('catalogs').join()) return;
    if (this.activeGroup==='collections' && this.values('collections').includes('photos') &&
        (data.photoRevision!==SKY_PHOTO_INDEX.revision || data.guideRevision!==SKY_GUIDE_DATA.revision)) return;
    const buckets = data.buckets.filter(b => this.bucketMatches(b));
    const core = OBJECTS.filter(o => !o.atlasOnly && !o.supersededBy && !MapGeometry.unlocated(o) && !this.anchor(o) && this.matches(o));
    this.total = core.length + buckets.reduce((n,b) => n + b[3], 0);
    const limit=this.selectionLimit(), indexedLimit=this.activeGroup==='collections' && this.values('collections').length===1 ?
      data.collectionLimits?.[this.values('collections')[0]] || data.limit : data.limit;
    if (this.total > Math.min(limit,indexedLimit)) return;
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
  change(classFilter, collection, catalog, save = true, activeGroup) {
    this.selection = Object.fromEntries([['classes',classFilter],['collections',collection],['catalogs',catalog]].map(([g,v]) => {
      const valid = this.options(g), values = Array.isArray(v) ? v : v === 'all' ? (g === 'collections' ? [] : valid) : valid.includes(v) ? [v] : this.defaults(g);
      // Old unions become one choice; a formerly complete set stays unrestricted.
      if (g === 'collections') return [g,valid.every(k => values.includes(k)) ? [] : values.filter(k => valid.includes(k)).slice(0,1)];
      return [g,valid.filter(k => values.includes(k))];
    }));
    // Legacy combined preferences keep the most specific mode: collection, source, class.
    this.activeGroup = ['classes','collections','catalogs'].includes(activeGroup) ? activeGroup :
      this.values('collections').length ? 'collections' :
        (Array.isArray(catalog) || this.options('catalogs').includes(catalog)) && this.values('catalogs').length ? 'catalogs' : 'classes';
    this.tab = this.activeGroup;
    for (const group of ['classes','collections','catalogs'])
      if (group !== this.activeGroup) this.selection[group] = this.defaults(group);
    filter = this.activeGroup === 'classes' && this.values('classes').length === 1 ? this.values('classes')[0] : 'all';
    this.collection = this.unrestricted('collections') ? 'all' : this.values('collections').join(',');
    this.catalog = this.unrestricted('catalogs') ? 'all' : this.values('catalogs').join(',');
    this.invalidate(); this.refreshSelection(); this.sync();
    if (save) {
      try { localStorage.setItem('parus-map-filters-v5', JSON.stringify({activeGroup:this.activeGroup,...this.selection})); } catch {}
    }
  },
  setGroup(group, values) {
    const selection = {...this.selection,[group]:values};
    this.change(selection.classes,selection.collections,selection.catalogs,true,group);
  },
  setTab(group, focus = false) {
    if (!['classes','collections','catalogs'].includes(group)) return;
    if (group !== this.activeGroup) this.setGroup(group,this.defaults(group));
    $('mapFilters').querySelector('.map-filter-scroll').scrollTop = 0;
    this.sync();
    if (focus) $('filterTab-'+group).focus({preventScroll:true});
  },
  sync() {
    for (const group of ['classes','collections','catalogs']) {
      $('filterPanel-'+group).hidden = this.tab !== group;
      $('filterTab-'+group).setAttribute('aria-selected',String(this.tab === group));
      $('filterTab-'+group).tabIndex = this.tab === group ? 0 : -1;
    }
    for (const input of document.querySelectorAll('#mapFilters input[data-filter-group]'))
      input.checked = this.values(input.dataset.filterGroup).includes(input.value);
    for (const group of ['collections','catalogs']) {
      $('filterCount-'+group).textContent = this.values(group).length;
      $('filterCount-'+group).hidden = group !== this.activeGroup || this.isDefault(group) || this.values(group).length === 0;
    }
    const names = ['classes','collections','catalogs'].filter(g => g === this.activeGroup && !this.isDefault(g)).map(g =>
      this.values(g).length ? this.values(g).map(k => g === 'classes' ? this.classNames[k] : this[g][k][0]).join(', ') : 'ничего не выбрано');
    const label = 'Фильтры карты' + (names.length ? ': '+names.join(' · ') : '');
    $('mapFilterBtn').title = label; $('mapFilterBtn').setAttribute('aria-label',label);
    $('mapFilterBtn').classList.toggle('has-filters',this.count > 0);
    $('mapFilterCount').textContent = this.count; $('mapFilterCount').hidden = !this.count;
    $('mapFilterToolbar').hidden = this.tab === 'collections';
    $('mapFilterDefault').checked = this.isDefault(this.tab);
    $('mapFilterDefault').title = this.tab === 'catalogs' ? 'Выставить каталоги по умолчанию' : 'Восстановить классы объектов по умолчанию';
    $('mapFilterDefault').setAttribute('aria-controls', this.options(this.tab).map(k => 'map-filter-'+this.tab+'-'+k).join(' '));
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
    this.setTab(this.activeGroup);
    $('mapFilters').hidden = false; $('mapFilterBtn').setAttribute('aria-expanded','true');
    $('filterTab-'+this.activeGroup).focus({preventScroll:true});
  },
  setup() {
    for (const group of ['classes','collections','catalogs']) {
      const panel = $('filterPanel-'+group); panel.replaceChildren();
      for (const value of this.options(group)) {
        const label = document.createElement('label'), input = document.createElement('input'), text = document.createElement('span');
        label.className = 'map-filter-option';
        input.type = group === 'collections' ? 'radio' : 'checkbox';
        if (group === 'collections') input.name = 'map-collection';
        input.value = value; input.dataset.filterGroup = group;
        input.id = 'map-filter-'+group+'-'+value;
        const title = document.createElement('strong'); title.textContent = group === 'classes' ? this.classNames[value] : this[group][value][0]; text.append(title);
        if (group !== 'classes') {
          label.title = this[group][value][1] + (group === 'collections' ? ' Повторное нажатие снимает подборку.' : '');
          input.setAttribute('aria-description', label.title);
          if (group === 'catalogs') {
            text.className = 'map-filter-catalog-text';
            const description = document.createElement('small');
            description.className = 'map-filter-description'; description.id = input.id+'-description';
            description.textContent = this[group][value][1]; text.append(description);
            input.setAttribute('aria-describedby',description.id);
          }
        }
        label.append(input); label.append(text); panel.append(label);
        if (group === 'collections') {
          input.onclick = () => this.setGroup(group,this.values(group).includes(value) ? [] : [value]);
          input.onkeydown = event => {
            if (event.code !== 'Space') return;
            event.preventDefault();
            input.onclick();
          };
        } else input.onchange = () => this.setGroup(group,this.options(group).filter(k => k === value ? input.checked : this.values(group).includes(k)));
      }
      $('filterTab-'+group).onclick = () => this.setTab(group);
      $('filterTab-'+group).onkeydown = event => {
        const groups = ['classes','collections','catalogs'], i = groups.indexOf(group);
        const next = {ArrowRight:(i+1)%3,ArrowLeft:(i+2)%3,Home:0,End:2}[event.key];
        if (next === undefined) return;
        event.preventDefault(); this.setTab(groups[next],true);
      };
    }
    const readPreference = version => {
      try {
        const value = JSON.parse(localStorage.getItem('parus-map-filters-'+version));
        return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
      } catch { return null; }
    };
    const saved = readPreference('v5'), previous = saved ? null : readPreference('v4') || readPreference('v3');
    const older = saved || previous ? null : readPreference('v2');
    // Before v5, empty catalogues meant the default overview. New empty selections
    // genuinely hide ordinary records and must survive subsequent reloads.
    const oldCatalogs = values => values === 'all' || Array.isArray(values) && !values.length ? undefined : values;
    if (saved) this.change(saved.classes,saved.collections,saved.catalogs,false,saved.activeGroup);
    else if (previous) {
      this.change(previous.classes,previous.collections,oldCatalogs(previous.catalogs),false,previous.activeGroup);
    } else if (older) {
      // v2 had five collections. Adding options must not revive its former unrestricted set.
      const oldOptions = {collections:['naked-eye','messier','nearby','multiple','remnants'],catalogs:['hyg','opengc','atnf','nearby','cf4','blackholes']};
      const migrate = group => Array.isArray(older[group]) && oldOptions[group].every(k => older[group].includes(k)) ? [] : older[group];
      this.change(older.classes,migrate('collections'),oldCatalogs(migrate('catalogs')),false);
    } else {
      const legacy = readPreference('v1');
      this.change(legacy?.classFilter === 'all' ? undefined : legacy?.classFilter,legacy?.collection,oldCatalogs(legacy?.catalog),false);
    }
    $('mapFilterBtn').onclick = () => $('mapFilters').hidden ? this.open() : this.close();
    $('closeMapFilters').onclick = () => this.close();
    $('mapFilterDefault').onchange = () => {
      if (this.tab !== 'collections') this.setGroup(this.tab,this.defaults(this.tab));
    };
    $('mapFilters').onkeydown = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); this.close();
    };
  },
};
globalThis.MapFilters = MapFilters;
