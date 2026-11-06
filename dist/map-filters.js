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
  get key() { return [filter, this.collection, this.catalog].join('|'); },
  get count() { return [filter, this.collection, this.catalog].filter(v => v !== 'all').length; },
  allowsCategory(category) {
    return [this.collections[this.collection], this.catalogs[this.catalog]]
      .every(q => !q?.[2] || q[2].includes(category));
  },
  matches(o) {
    if (!o?.id) return true; // Layer probes have no individual catalogue metadata.
    if (!this.matchesCollection(o)) return false;
    if (this.catalog === 'all') return true;
    const sources = [o.source, o.coordinateSource, o.catalog, ...(o.facts?.refs || []).flat()].join(' ');
    const measurement = name => o.catalog === name ||
      (o.catalogMeasurements || []).some(m => m.catalog === name);
    switch (this.catalog) {
      case 'hyg': return o.hygId != null || /HYG(?:-Database|\s|$)/i.test(sources);
      case 'opengc': return /^(NGC|IC)\s*\d/i.test(o.ngc || '') || /OpenNGC/i.test(sources);
      case 'atnf': return /atnf\.csiro\.au|\bATNF\b/i.test(sources);
      case 'nearby': return measurement('Nearby-Galaxies');
      case 'cf4': return measurement('Cosmicflows-4');
      case 'blackholes': return !!o.blackHoleCatalog;
      default: return false;
    }
  },
  matchesCollection(o) {
    switch (this.collection) {
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
  invalidate() {
    ExtendedCatalog.systemView = null;
    hover = null;
    hitObjects = [];
    RegionMap.hits = [];
    RegionMap.renderCache = null;
    MapLayers.landmarkContext = null;
    MapLayers.lastUpdate = ExtendedCatalog.lastUpdate = -Infinity;
  },
  change(classFilter, collection, catalog, save = true) {
    filter = this.classes.includes(classFilter) ? classFilter : 'all';
    this.collection = Object.hasOwn(this.collections, collection) ? collection : 'all';
    this.catalog = Object.hasOwn(this.catalogs, catalog) ? catalog : 'all';
    this.invalidate();
    this.sync();
    if (save) {
      try { localStorage.setItem('parus-map-filters-v1', JSON.stringify({classFilter: filter, collection: this.collection, catalog: this.catalog})); } catch {}
    }
  },
  sync() {
    $('mapClassFilter').value = filter;
    $('mapCollectionFilter').value = this.collection;
    $('mapCatalogFilter').value = this.catalog;
    const names = [filter !== 'all' ? $('mapClassFilter').selectedOptions?.[0]?.textContent : '',
      this.collection !== 'all' ? this.collections[this.collection][0] : '',
      this.catalog !== 'all' ? this.catalogs[this.catalog][0] : ''].filter(Boolean);
    const label = 'Фильтры карты' + (names.length ? ': ' + names.join(' · ') : '');
    $('mapFilterBtn').title = label;
    $('mapFilterBtn').setAttribute('aria-label', label);
    $('mapFilterBtn').classList.toggle('has-filters', this.count > 0);
    $('mapFilterCount').textContent = this.count;
    $('mapFilterCount').hidden = !this.count;
    $('resetMapFilters').disabled = !this.count;
    $('mapCollectionNote').textContent = this.collections[this.collection][1];
    $('mapCollectionNote').hidden = this.collection === 'all';
    $('mapCatalogNote').textContent = this.catalogs[this.catalog][1];
    $('mapCatalogNote').hidden = this.catalog === 'all';
  },
  pickerOpen() {
    return CSS.supports('selector(:open)') &&
      ['mapClassFilter', 'mapCollectionFilter', 'mapCatalogFilter'].some(id => $(id).matches(':open'));
  },
  close() {
    const restoreFocus = document.activeElement?.closest('#mapFilters');
    $('mapFilters').hidden = true;
    $('mapFilterBtn').setAttribute('aria-expanded', 'false');
    if (restoreFocus) $('mapFilterBtn').focus({preventScroll: true});
  },
  open() {
    closeCatalog();
    closeMenu();
    $('themePicker').hidden = true;
    $('themeBtn').setAttribute('aria-expanded', 'false');
    $('mapFilters').hidden = false;
    $('mapFilterBtn').setAttribute('aria-expanded', 'true');
    $('mapClassFilter').focus({preventScroll: true});
  },
  setup() {
    $('mapClassFilter').innerHTML = $('catalogFilter').innerHTML;
    for (const [id, options] of [['mapCollectionFilter', this.collections], ['mapCatalogFilter', this.catalogs]]) {
      $(id).replaceChildren();
      for (const [value, [label]] of Object.entries(options)) {
        const option = document.createElement('option');
        option.value = value; option.textContent = label;
        $(id).append(option);
      }
    }
    let saved;
    try { saved = JSON.parse(localStorage.getItem('parus-map-filters-v1')); } catch {}
    this.change(saved?.classFilter, saved?.collection, saved?.catalog, false);
    $('mapFilterBtn').onclick = () => $('mapFilters').hidden ? this.open() : this.close();
    $('closeMapFilters').onclick = () => this.close();
    $('resetMapFilters').onclick = () => this.change('all', 'all', 'all');
    for (const id of ['mapClassFilter', 'mapCollectionFilter', 'mapCatalogFilter'])
      $(id).onchange = () => this.change($('mapClassFilter').value, $('mapCollectionFilter').value, $('mapCatalogFilter').value);
    $('mapFilters').onkeydown = event => {
      if (event.key !== 'Escape') return;
      if (this.pickerOpen()) return;
      event.preventDefault(); event.stopPropagation(); this.close();
    };
  },
};
globalThis.MapFilters = MapFilters;
