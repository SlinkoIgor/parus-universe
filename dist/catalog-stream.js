'use strict';
// Full catalog objects stay in bounded tiles; only selected/visited objects are pinned.
const ExtendedCatalog = {
  manifest: null,
  cache: new Map(),
  inflight: new Map(),
  viewLoads: new Map(),
  pinned: new Map(),
  visibleMap: new Map(),
  visible: [],
  wanted: [],
  worker: null,
  seq: 0,
  searchLimit: 100,
  lastUpdate: -Infinity,
  errors: new Map(),
  foreground: new Set(EXTENDED_BOOT.foreground),
  systemByMember: new Map(),
  systemViewRequest: 0,
  systemView: null,
  isSystemMember(o) {
    return !!this.systemView && this.systemView.selected === state.selected && this.systemView.members.has(o?.id);
  },
  stellarAddedCount: 0,
  get systems() {
    if (!this.systemList) {
      const added = EXTENDED_BOOT.stellarCatalog?.systems || [],
        replaced = new Set(added.flatMap(s => s.originalSystemIds)),
        audited = new Set(EXTENDED_BOOT.stellarCatalog?.auditTargets || []);
      this.systemList = [...EXTENDED_BOOT.systems.filter(s => !replaced.has(s.id) &&
        !(s.source?.includes('HYG-Database') && s.members.some(id=>audited.has(id)))), ...added];
    }
    return this.systemList;
  },
  transitions: new Map(),
  cutKey: null,
  matchesMap(o, categoryOnly = false) {
    if (!o || o.supersededBy || globalThis.MapGeometry?.unlocated(o)) return false;
    const cache = categoryOnly || typeof MapDetails === 'undefined' ? null : MapDetails.frameMatches,
      known = cache?.get(o);
    if (known !== undefined) return known;
    const result = this.computeMatchesMap(o, categoryOnly);
    cache?.set(o, result);
    return result;
  },
  computeMatchesMap(o, categoryOnly) {
    const selected = typeof filter === 'string' ? filter : 'all';
    // Keep bulk survey envelopes out of the overview, including pinned/saved
    // targets. Atlas search and explicit class filters retain the full catalog.
    if (
      !globalThis.MapFilters && selected === 'all' &&
      o.cosmicCatalog &&
      !o.cosmicLandmark &&
      (o.kind === 'void' || o.cosmicSubtype === 'supercluster')
    )
      return false;
    return (
      (globalThis.MapFilters?.anchor(o) || this.matches(o.kind, selected, o)) &&
      (!globalThis.MapFilters || MapFilters.matches(o)) &&
      (categoryOnly || this.isSystemMember(o) || globalThis.MapFilters?.promotes(o) || globalThis.MapFilters?.anchor(o) || !globalThis.MapLayers || MapLayers.admits(o))
    );
  },
  opacity(o, detail = true) {
    return (
      (detail ? MapDetails.opacity(o, cam.span) : 1) *
      (this.coreIndex?.has(o.id) ||
      this.pinned.has(o.id) ||
      globalThis.MapFilters?.promotes(o) ||
      globalThis.MapLayers?.visibleMap.has(o.id)
        ? 1
        : (this.transitions.get(o.id)?.alpha ?? 1))
    );
  },
  stagger(id) {
    let h = 2166136261;
    for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return (h >>> 0) % 181;
  },
  adoptCut(rows, now) {
    const fresh = rows.filter((o) => !o.atlasOnly),
      byid = new Map(fresh.map((o) => [o.id, o]));
    // The fixed hierarchy already contains every eligible point. Only legacy
    // indexes need viewport history to keep their changing representatives.
    const retained = globalThis.MapVisibility?.active
      ? []
      : [...this.transitions.values()]
          .filter((q) => q.alpha > 0.015 && this.retainInView(q.o))
          .map((q) => byid.get(q.o.id) || q.o);
    const target = new Map(
      (globalThis.MapVisibility?.active ? fresh : [...retained, ...fresh].slice(0, 8000)).map(
        (o) => [o.id, o],
      ),
    );
    for (const [id, q] of this.transitions)
      if (!target.has(id) && q.to !== 0)
        Object.assign(q, {
          from: q.alpha,
          to: 0,
          start: now,
          delay: this.stagger(id),
          duration: 650,
        });
    for (const [id, o] of target) {
      const q = this.transitions.get(id);
      if (q) {
        q.o = o;
        if (q.to !== 1)
          Object.assign(q, { from: q.alpha, to: 1, start: now, delay: 0, duration: 400 });
      } else
        this.transitions.set(id, {
          o,
          alpha: 0,
          from: 0,
          to: 1,
          start: now,
          delay: this.stagger(id),
          duration: 450,
        });
    }
    // Legacy samples need a union cap. Fixed visibility releases offscreen fades
    // on time, without discarding eligible points to satisfy a camera quota.
    if (!globalThis.MapVisibility?.active && this.transitions.size > 16000)
      for (const [id] of [...this.transitions]
        .filter(([, q]) => !q.to)
        .sort((a, b) => a[1].alpha - b[1].alpha)
        .slice(0, this.transitions.size - 16000))
        this.transitions.delete(id);
    this.visibilityDirty = true;
    this.advanceVisibility(now);
  },
  retainInView(o) {
    if (
      o.atlasOnly ||
      !this.matchesMap(o, true) ||
      (!MapDetails.visible(o, cam.span) && !MapDetails.sparse(o, cam.span))
    )
      return false;
    const p = screen(o);
    return p.x >= -64 && p.x <= width + 64 && p.y >= -64 && p.y <= height + 64;
  },
  advanceVisibility(now) {
    for (const [id, q] of this.transitions) {
      if (q.alpha === 1 && q.to === 1) continue;
      const t = Math.max(0, Math.min(1, (now - q.start - q.delay) / q.duration));
      q.alpha = q.from + (q.to - q.from) * t * t * (3 - 2 * t);
      if (!q.to && t === 1) {
        this.transitions.delete(id);
        this.visibilityDirty = true;
      }
    }
    if (this.visibilityDirty) {
      this.visible = [...this.transitions.values()].map((q) => q.o);
      this.visibleMap = new Map(this.visible.map((o) => [o.id, o]));
      this.visibilityDirty = false;
    }
  },
  sources: {
    HYG: ['https://github.com/astronexus/HYG-Database', 'HYG 4.1'],
    OpenNGC: ['https://github.com/mattiaverga/OpenNGC', 'OpenNGC'],
    ATNF: ['https://www.atnf.csiro.au/research/pulsar/psrcat/', 'ATNF 2.9.0'],
  },
  get total() {
    return (
      EXTENDED_BOOT.total -
      // Older immutable snapshots counted the separately imported components.
      Object.keys(CatalogIdentities.redirects).filter(id=>!EXTENDED_BOOT.coreIdentityRedirects?.[id]).length +
      (EXTENDED_BOOT.stellarCatalog?.newObjectCount || 0) +
      OBJECTS.filter((o) => o.quasarCatalog).length +
      (globalThis.DistantCatalog?.objects.length || 0) +
      (globalThis.BlackHoleCatalog?.objects.length || 0) +
      (globalThis.UniverseMap?.areas.length || 0) +
      OBJECTS.filter((o) => o.nuclearStar).length +
      [...this.pinned.values()].filter((o) => o.synthetic).length
    );
  },
  get identityRedirects() {
    return this.redirectCache??={...EXTENDED_BOOT.identityRedirects,...CatalogIdentities.redirects};
  },
  get(id) {
    const historical=this.pinned.get(id);
    if(historical?.supersededBy || historical?.historicalStellarNavigation)return historical;
    id=this.identityRedirects[id]||id;
    return (
      this.coreIndex?.get(id) ||
      this.pinned.get(id) ||
      globalThis.MapFilters?.objects.get(id) ||
      globalThis.MapLayers?.get(id) ||
      this.visibleMap.get(id) ||
      this.identityTarget(id)
    );
  },
  identityTarget(id) {
    this.identityCache ??= new Map();
    if(this.identityCache.has(id))return this.identityCache.get(id);
    const row=EXTENDED_BOOT.identityTargetRows?.find(r=>r[0]===id);if(!row)return;
    const o=this.decode(row);this.identityCache.set(id,o);this.prepareGalaxy(o);return o;
  },
  background(o) {
    if (globalThis.MapFilters?.promotes(o)) return false;
    if (this.isSystemMember(o)) return false;
    return (
      !o.stellarSystem &&
      !o.synthetic &&
      !o.messier &&
      (!o.galaxyMember || o.bulkGalaxyMember) &&
      (o.bulkGalaxyMember ||
        o.streamed ||
        (o.kind === 'star' && o.d > 0 && o.d <= 50 && !this.foreground.has(o.id))) &&
      MapDetails.mass(o) === null
    );
  },
  readJSON(path, options, revision = EXTENDED_BOOT.revision) {
    if (globalThis.PARUS_CATALOG_FILES?.[path])
      return Promise.resolve().then(() => {
        const v = globalThis.PARUS_CATALOG_FILES[path];
        return typeof v === 'string' ? JSON.parse(v) : v;
      });
    const url = path.startsWith('catalog-data/')
      ? (EXTENDED_BOOT.dataRoot || 'catalog-data') + '/' + path.slice(13)
      : path;
    if (globalThis.PARUS_CATALOG_FILES?.[url])
      return Promise.resolve().then(() => {
        const v = globalThis.PARUS_CATALOG_FILES[url];
        return typeof v === 'string' ? JSON.parse(v) : v;
      });
    // Every catalogue consumer must eventually leave its pending state, even
    // when the connection stays open without delivering a response or body.
    const timeout = globalThis.AbortSignal?.timeout?.(15000), signal = options?.signal,
      request = timeout && (!signal || globalThis.AbortSignal.any)
        ? {...options, signal: signal ? AbortSignal.any([signal, timeout]) : timeout}
        : options;
    return fetch(url + '?v=' + revision, request).then((r) => {
      if (!r.ok) throw Error('Не удалось загрузить ' + path);
      return r.json();
    }).catch(error => {
      if (error.name === 'TimeoutError') throw Error('Не удалось дождаться загрузки каталога. Повторите попытку.', {cause:error});
      if (error.name === 'TypeError') throw Error('Не удалось загрузить каталог. Проверьте соединение и повторите попытку.', {cause:error});
      throw error;
    });
  },
  astrometryNote(o) {
    if (!o.astrometrySource) return;
    const note =
      o.uncertaintyMatched && o.distanceRelativeError != null
        ? 'Решение ' +
          o.astrometrySource +
          '; σπ/π ≈ ' +
          (100 * o.distanceRelativeError).toFixed(1).replace('.', ',') +
          '%.'
        : 'Для принятого расстояния формальная погрешность не задана; погрешность другого решения не подставляется.';
    o.coordinateNote = (o.coordinateNote || '') + ' ' + note;
  },
  adopt(o, fresh, saved) {
    const p = o.p3,
      active = p && [saved?.current, saved?.flight?.target, saved?.flight?.fromId].includes(o.id);
    Object.assign(o, fresh);
    if (active && fresh.atlasOnly) {
      o.p3 = p;
      o.historicalNavigation = true;
      o.coordinateNote +=
        ' Текущее положение корабля или старый маршрут сохраняет прежнюю приблизительную навигационную оценку. Каталожный объект остаётся только в атласе.';
    }
    return o;
  },
  stellarProperties(o) {
    const data = EXTENDED_BOOT.stellarCatalog, entry = data?.names[o.id];
    if (entry && o.kind === 'star' && !o.synthetic) {
      o.aliases = [...new Set([o.name, ...(o.aliases || []), ...entry.aliases, entry.name])];
      o.name = entry.name;
      o.stellarLabel = /^(?:HIP|HYG|HD|HR|Gl|GJ)\s*\d/.test(entry.name) ? null : entry.name;
      o.stellarNameBasis = entry.basis;
      o.stellarNameSource = entry.source;
      o.stellarRevision = data.revision;
    }
    if (data && !o.historicalStellarNavigation) {
      this.stellarObjectIndex ??= new Map(data.objects.map(q => [q.id, q]));
      const q = this.stellarObjectIndex.get(o.id);
      if (q) {
        Object.assign(o, q, Space.point(q.p3), {mapPosition:null, mapOffset:null, mapGeometry:MapLayout.version});
        if (q.unresolvedSourcePhotometry && o.facts) {
          o.unresolvedSourceFacts ??= {...o.facts};
          o.facts = {...o.facts, class:q.type, mass:'Индивидуальная масса не указана.', lum:null, visual:null,
            lumUnknown:'Исходная фотометрия относится к неразрешённой паре; индивидуальная светимость неизвестна.',
            radius:'Индивидуальный радиус неизвестен.', note:q.coordinateNote};
          o.massSolar=null;o.radiusSolar=null;o.temperatureK=null;o.bolometricLuminositySolar=null;
        }
        if (o.facts && !o.facts.refs.some(r => r[0] === q.source))
          o.facts.refs.push([q.source, 'Компоненты и относительные орбиты системы']);
      }
    }
    // GJ 887 = Lacaille 9352 = HIP 114046; Mann et al. (2015), as
    // tabulated by Hartogh et al. (2026), A&A 707 A93, Table 1.
    if (o.id !== 'hyg-113687') return;
    const ref = 'https://doi.org/10.1051/0004-6361/202554984';
    Object.assign(o, {
      massSolar: 0.495,
      massUncertaintySolar: 0.049,
      massSource: ref,
      bolometricLuminositySolar: 0.0368,
      radiusSolar: 0.468,
      temperatureK: 3688,
    });
    Object.assign(o.facts, {
      mass: '0,495 ± 0,049 M☉ · оценка',
      lum: 0.0368,
      radius: '0,468 ± 0,022 R☉',
      ref,
      lumUnknown: null,
      note: 'Масса, болометрическая светимость, радиус и температура: Mann et al. (2015), таблица 1 Hartogh et al. (2026). Астрометрия HYG сохранена.',
    });
    if (!o.facts.refs.some((r) => r[0] === ref))
      o.facts.refs.push([ref, 'Физические параметры GJ 887 · таблица 1']);
  },
  decode(r) {
    const [
        id,
        name,
        kind,
        d,
        raDeg,
        decDeg,
        positionQuality,
        distanceMethod,
        aliases,
        apparentV,
        source,
        extra,
        x,
        y,
      ] = r,
      located = d > 0 && Number.isFinite(raDeg) && Number.isFinite(decDeg),
      ref = extra.referenceURL
        ? [extra.referenceURL, source]
        : this.sources[source] || this.sources.HYG;
    const o = {
      id,
      name,
      kind,
      d,
      raDeg,
      decDeg,
      positionQuality,
      distanceMethod,
      aliases,
      apparentV,
      ...extra,
      catalogRevision: EXTENDED_BOOT.revision,
      mapGeometry: MapLayout.version,
      source: ref[0],
      catalog: ref[1],
      streamed: true,
      mapPosition: { x, y },
      ...(located ? Space.point(extra.p3 || Space.fromSky(raDeg, decDeg, d)) : { p3: null, x, y }),
      navigable: located && !extra.invalidIdentification && !extra.atlasOnly,
      type:
        {
          star: 'ЗВЕЗДА',
          pulsar: 'ПУЛЬСАР',
          galaxy: 'ГАЛАКТИКА',
          cluster: 'СКОПЛЕНИЕ',
          nebula: 'ТУМАННОСТЬ',
        }[kind] +
        ' · ' +
        source,
    };
    o.desc = distanceMethod + (extra.identificationNote ? ' ' + extra.identificationNote : '');
    o.coordinateNote =
      positionQuality === 'unknown'
        ? 'Недостаточно данных для положения на карте. Объект доступен только в атласе.'
        : positionQuality === 'approximate'
          ? 'Приблизительная позиция; полёт разрешён по указанной оценке. ' + distanceMethod
          : 'Каталожная позиция J2000; собственное движение не моделируется.';
    o.facts = {
      class: o.type,
      mass: 'Нет индивидуальной оценки в этом каталоге.',
      lumUnknown: 'Болометрическая светимость не указана.',
      note:
        distanceMethod +
        (extra.sizeEstimated
          ? ' Индивидуальный угловой диаметр отсутствует; контур галактики не строится.'
          : ''),
      refs: [ref],
    };
    if (extra.placementNote) o.coordinateNote = extra.placementNote;
    if (extra.geometrySource) o.facts.refs.push([extra.geometrySource, 'Геометрия диска']);
    if (extra.membershipSource)
      o.facts.refs.push([extra.membershipSource, 'Принадлежность к галактике']);
    if (extra.memberType) o.type = o.facts.class = extra.memberType;
    if (extra.positionReason) o.coordinateNote = extra.positionReason;
    if (extra.catalogTypeLabel) o.type = o.facts.class = extra.catalogTypeLabel;
    if (extra.catalogClass === 'galaxy-cluster')
      o.type = o.facts.class = 'Скопление галактик · ' + source;
    if (extra.cosmicCatalog)
      o.coordinateNote =
        (extra.positionReason || distanceMethod) +
        ' Фиксированная каталожная эпоха; собственные движения не интегрируются.';
    if (extra.arrivalAnchor)
      o.coordinateNote +=
        ' Прибытие к каталожному ориентиру протяжённой области, не к компактному телу.';
    if (extra.atlasOnly)
      o.coordinateNote +=
        ' Качество расстояния или тип измерения не проходит отбор карты; запись доступна в атласе.';
    if (extra.massSolar) {
      o.massSource = extra.massSource || ref[0];
      o.facts.mass =
        extra.massSolar.toLocaleString('ru-RU', { maximumSignificantDigits: 4 }) +
        ' M☉ · ' +
        (extra.massBasis || 'каталожная оценка');
    }
    if (extra.sizeOrientationUnknown)
      o.facts.note += ' Позиционный угол не приведён; ориентация контура условная.';
    if (extra.sizeUnknown)
      o.facts.note += ' Угловой размер в этой выборке не приведён; на карте показана точка.';
    if (extra.xrayLuminosityW)
      o.facts.extra = [
        'Рентгеновская L500',
        extra.xrayLuminosityW.toExponential(3).replace('e+', ' × 10^') + ' Вт · не болометрическая',
      ];
    if (extra.filamentLengthLy)
      o.facts.extra = [
        'Длина оси',
        extra.filamentLengthLy.toLocaleString('ru-RU', { maximumSignificantDigits: 4 }) +
          ' св. лет',
      ];
    for (const m of extra.catalogMeasurements || [])
      if (!o.facts.refs.some((r) => r[0] === m.source)) o.facts.refs.push([m.source, m.catalog]);
    if (extra.regionData) o.region = extra.regionData;
    this.stellarProperties(o);
    this.astrometryNote(o);
    if (extra.periodSeconds)
      o.facts.extra = ['Период вращения', String(extra.periodSeconds) + ' с'];
    globalThis.StellarClusters?.prepare(o);
    globalThis.Nebulae?.prepare(o);
    return o;
  },
  init() {
    this.coreIndex = new Map(OBJECTS.map((o) => [o.id, o]));
    for (const [id, p] of Object.entries(EXTENDED_BOOT.patches)) {
      const o = OBJECTS.find((o) => o.id === id);
      if (!o) continue;
      Object.assign(o, p);
      const located = p.d > 0 && Number.isFinite(p.raDeg) && Number.isFinite(p.decDeg);
      Object.assign(
        o,
        located
          ? Space.point(p.p3 || Space.fromSky(p.raDeg, p.decDeg, p.d))
          : { p3: null, x: p.display[0], y: p.display[1] },
      );
      // Generated positions are compact [x,y], while original map coordinates stay unchanged.
      o.mapPosition = { x: p.display[0], y: p.display[1] };
      o.navigable = located;
      this.prepareGalaxy(o);
      o.coordinateNote = located
        ? 'Приблизительная позиция. Полёт разрешён по оценке расстояния. ' + p.distanceMethod
        : p.distanceMethod;
      if (o.facts) {
        o.facts.note = p.distanceMethod;
        if (p.distanceSource)
          o.facts.refs.push([p.distanceSource, 'Расстояние и принадлежность к системе']);
        if (o.facts.visual && o.apparentV != null) {
          const absoluteV = o.apparentV - 5 * Math.log10(p.d / 3.2615637771674336) + 5;
          o.absoluteV = absoluteV;
          o.visualLuminositySolar = 10 ** ((4.83 - absoluteV) / 2.5);
          o.facts.visual = { absoluteV, solarV: o.visualLuminositySolar };
        }
      }
      MapLayout.cache.delete(id);
    }
    for (const [id, name] of Object.entries(EXTENDED_BOOT.renames)) {
      const o = OBJECTS.find((o) => o.id === id);
      if (o) {
        o.aliases = [...new Set([o.name, ...(o.aliases || []), name])];
        o.name = name;
      }
    }
    for (const [id, policy] of Object.entries(EXTENDED_BOOT.policies || {})) {
      const o = this.coreIndex.get(id);
      if (o) Object.assign(o, policy);
    }
    for (const row of EXTENDED_BOOT.members || []) {
      const o = this.decode(row);
      o.streamed = false;
      OBJECTS.push(o);
      this.coreIndex.set(o.id, o);
    }
    this.hiddenIds = new Set(EXTENDED_BOOT.hiddenIds || []);
    for (const o of OBJECTS) {
      this.stellarProperties(o);
      const area = ['structure', 'wall', 'void', 'ring', 'arc', 'horizon'].includes(o.kind);
      if (area)
        o.coordinateNote = (o.coordinateNote || '').replace(
          /не используется в физических маршрутах\.|В физические маршруты не включён\.|Область не является точкой остановки\./g,
          '',
        );
      if (area && !o.p3 && Number.isFinite(o.d) && Number.isFinite(o.x) && Number.isFinite(o.y)) {
        const angle = Math.atan2(-o.y, o.x);
        o.p3 = [o.d * Math.cos(angle), o.d * Math.sin(angle), 0];
        o.arrivalAnchor = true;
        o.coordinateNote =
          (o.coordinateNote || '') +
          ' Игровая точка прибытия в протяжённую область; не измеренный компактный центр.';
      }
      if (!area && (o.positionQuality === 'unknown' || !o.p3?.every(Number.isFinite)))
        o.atlasOnly = true;
      if (o.atlasOnly && !area) {
        o.navigable = false;
        o.coordinateNote =
          o.positionReason || 'Недостаточно данных для положения на карте. Только атлас.';
      } else if (o.p3?.every(Number.isFinite)) {
        o.navigable = true;
        if (area && !o.arrivalAnchor)
          o.coordinateNote =
            (o.coordinateNote || '') +
            ' Полёт разрешён к оценочной точке прибытия в область; это не компактное тело.';
      }
      if (!o.streamed) this.astrometryNote(o);
    }
    for (const [id, patch] of Object.entries(EXTENDED_BOOT.cosmicPatches || {})) {
      const o = this.coreIndex.get(id);
      if (!o) continue;
      o.aliases = [...new Set([...(o.aliases || []), ...(patch.aliases || [])])];
      o.catalogMeasurements = patch.catalogMeasurements;
      for (const field of [
        'massSolar',
        'massUncertaintySolar',
        'massIsSystem',
        'massBasis',
        'massSource',
      ])
        if (patch[field] != null) o[field] = patch[field];
      for (const m of patch.catalogMeasurements || [])
        if (o.facts && !o.facts.refs.some((r) => r[0] === m.source))
          o.facts.refs.push([m.source, m.catalog]);
      if (patch.massSolar && o.facts)
        o.facts.mass =
          patch.massSolar.toLocaleString('ru-RU', { maximumSignificantDigits: 4 }) +
          ' M☉ · ' +
          patch.massBasis;
    }
    for (const q of EXTENDED_BOOT.stellarCatalog?.objects || []) {
      if (this.coreIndex.has(q.id)) continue;
      const o = {...q, facts:{class:q.type, mass:'Индивидуальная масса в этом дополнении не назначена.',
        lumUnknown:'Индивидуальная болометрическая светимость не указана.', note:q.coordinateNote,
        refs:[[q.source, 'Опубликованные компоненты и орбиты системы']]}};
      this.stellarProperties(o);
      OBJECTS.push(o);
      this.coreIndex.set(o.id,o);
      this.stellarAddedCount++;
    }
    for (const s of this.systems)
      for (const id of s.members) {
        this.systemByMember.set(id, s);
        const o = this.coreIndex.get(id);
        if (s.id === 'system-cygnus-x1' && o?.facts)
          o.facts.refs = [
            ...(o.facts.refs || []).filter((r) => r[0] !== s.source),
            [s.source, 'Расстояние и параметры двойной системы'],
          ];
      }
    MapLayout.resolve = (id) => this.get(id);
    MapLayout.init();
  },
  start() {
    if (typeof fetch !== 'function' && !globalThis.PARUS_CATALOG_FILES) return;
    this.readJSON('catalog-data/manifest.json')
      .then((m) => {
        this.manifest = m;
        this.lastUpdate = -Infinity;
        this.refreshSaved();
        if (!$('catalog').hidden) renderCatalog();
      })
      .catch((e) => {
        this.manifestError = e.message;
      });
  },
  async refreshSaved() {
    const ids = new Set(
      [...this.pinned.values()]
        .filter((o) => !o.synthetic && !o.historicalStellarNavigation && o.catalogRevision !== EXTENDED_BOOT.revision)
        .map((o) => o.id),
    );
    if (!ids.size) return;
    try {
      const index = await this.readJSON('catalog-data/search.json'),
        entries = index.filter((r) => ids.has(r[0]));
      for (const entry of entries) {
        const rows = await this.tile(entry[5]),
          fresh = rows.find((o) => o.id === entry[0]);
        if (fresh && this.pinned.has(fresh.id)) {
          const o = this.pinned.get(fresh.id);
          this.adopt(o, fresh, state);
          this.prepareGalaxy(o);
        }
      }
      this.lastUpdate = -Infinity;
      renderUI();
    } catch (e) {
      this.migrationError = e.message;
    }
  },
  cancelViewLoads(wanted) {
    const keep = new Set(wanted);
    for (const [file, load] of this.viewLoads) {
      // Search, linked systems and restored navigation may share this request.
      if (keep.has(file) || load.retained) continue;
      load.controller.abort();
      this.viewLoads.delete(file);
      if (this.inflight.get(file) === load.promise) this.inflight.delete(file);
    }
  },
  tile(file, { view = false } = {}) {
    if (this.cache.has(file)) {
      const r = this.cache.get(file);
      this.cache.delete(file);
      this.cache.set(file, r);
      return Promise.resolve(r);
    }
    if (this.inflight.has(file)) {
      if (!view && this.viewLoads.has(file)) this.viewLoads.get(file).retained = true;
      return this.inflight.get(file);
    }
    const load = view && typeof AbortController === 'function'
      ? { controller: new AbortController(), retained: false } : null;
    const promise = this.readJSON(
      /^(map-radial|map-visibility)\//.test(file) ? file : 'catalog-data/' + file,
      load ? { signal: load.controller.signal } : undefined,
    )
      .then((rows) => {
        if(load?.controller.signal.aborted)throw Object.assign(new Error('Cancelled map request'),{name:'AbortError'});
        const objects = rows.map((r) => this.decode(r));
        this.cache.set(file, objects);
        while (this.cache.size > 48) {
          const key = [...this.cache.keys()].find((k) => !this.wanted.includes(k));
          if (!key) break;
          this.cache.delete(key);
        }
        this.errors.delete(file);
        return objects;
      })
      .catch((e) => {
        if (e.name !== 'AbortError') this.errors.set(file, performance.now());
        throw e;
      })
      .finally(() => {
        if (this.inflight.get(file) === promise) this.inflight.delete(file);
        if (this.viewLoads.get(file) === load) this.viewLoads.delete(file);
      });
    if (load) { load.promise = promise; this.viewLoads.set(file, load); }
    this.inflight.set(file, promise);
    return promise;
  },
  nodesForView(view, w, h) {
    if (globalThis.MapFilters?.narrow) return [];
    if (globalThis.MapVisibility?.active) return MapVisibility.filesForView(view, w, h);
    const manifest = globalThis.MapRadial?.active() ? MapRadial.manifest : this.manifest;
    if (!manifest) return [];
    view = Cosmology.referenceView(view);
    const pixel = view.span / Math.max(1, w),
      box = [
        view.x - w * 0.55 * pixel,
        view.y - h * 0.6 * pixel,
        view.x + w * 0.7 * pixel,
        view.y + h * 0.6 * pixel,
      ];
    const intersects = (b) => b[0] <= box[2] && b[2] >= box[0] && b[1] <= box[3] && b[3] >= box[1];
    const cachedBounds = new Map(),
      bounds = (n) => {
        if (cachedBounds.has(n)) return cachedBounds.get(n);
        const b = n.box.slice();
        for (const [minimumSize, x0, y0, x1, y1] of n.geometryBoxes || [])
          if (minimumSize / pixel < 40000) {
            b[0] = Math.min(b[0], x0);
            b[1] = Math.min(b[1], y0);
            b[2] = Math.max(b[2], x1);
            b[3] = Math.max(b[3], y1);
          }
        cachedBounds.set(n, b);
        return b;
      };
    // Complete coverage of points and drawable envelopes. Huge offscreen areas
    // cannot consume the stellar-view budget: their outlines cannot be drawn there.
    let cut = manifest.roots
      .map((id) => ({ id, node: manifest.nodes[id] }))
      .filter((q) => intersects(bounds(q.node)));
    while (cut.length < 32) {
      let best = -1,
        score = -1,
        children = [];
      for (let i = 0; i < cut.length; i++) {
        const n = cut[i].node,
          nb = bounds(n),
          cs = n.children
            .map((id) => ({ id, node: manifest.nodes[id] }))
            .filter((q) => intersects(bounds(q.node)));
        if (!cs.length || cut.length - 1 + cs.length > 32) continue;
        const rows =
          cut.reduce((sum, q) => sum + (q.node.children.length ? 48 : q.node.count), 0) -
          (n.children.length ? 48 : n.count) +
          cs.reduce((sum, q) => sum + (q.node.children.length ? 48 : q.node.count), 0);
        if (rows > 8000) continue;
        const size = Math.max(nb[2] - nb[0], nb[3] - nb[1]) / pixel;
        if (size <= 340) continue;
        const overlap =
          Math.max(0, Math.min(nb[2], box[2]) - Math.max(nb[0], box[0])) *
          Math.max(0, Math.min(nb[3], box[3]) - Math.max(nb[1], box[1]));
        const area = Math.max(pixel * pixel, (nb[2] - nb[0]) * (nb[3] - nb[1])),
          density = n.count * Math.min(1, overlap / area),
          value = size * Math.sqrt(1 + density);
        if (value > score) {
          best = i;
          score = value;
          children = cs;
        }
      }
      if (best < 0) break;
      cut.splice(best, 1, ...children);
    }
    return cut.map((q) => q.node.file);
  },
  galaxyLimit: 2048,
  sweepGalaxies() {
    if (GALAXIES.length <= this.galaxyLimit) return;
    const live = new Set(this.coreIndex?.keys());
    const mark = (rows) => {
      for (const o of rows) if (o) live.add(o.id);
    };
    mark(OBJECTS);
    mark(this.pinned.values());
    mark(this.visible);
    for (const q of this.transitions.values()) live.add(q.o.id);
    for (const rows of this.cache.values()) mark(rows);
    if (this.identityCache) mark(this.identityCache.values());
    if (globalThis.MapFilters) mark(MapFilters.objects.values());
    if (globalThis.MapLayers) {
      mark(MapLayers.visible);
      for (const rows of MapLayers.cache.values()) mark(rows);
    }
    GalaxyRegistry.retain((g) => !g.catalogGeometry || live.has(g.id));
    this.galaxyLimit = Math.max(2048, GALAXIES.length * 2);
  },
  update(now) {
    this.advanceVisibility(now);
    if (now - this.lastUpdate < 180) return;
    this.lastUpdate = now;
    this.sweepGalaxies();
    if (
      this.manifest &&
      (!globalThis.MapRadial?.active() || MapRadial.manifest)
    ) {
      this.wanted = this.nodesForView(cam, width, height);
      this.cancelViewLoads(this.wanted);
      for (const file of this.wanted)
        if (
          !this.cache.has(file) &&
          this.inflight.size + (globalThis.MapLayers?.inflight.size || 0) < 4 &&
          now - (this.errors.get(file) || -Infinity) > 3000
        )
          this.tile(file, { view: true })
            .then(() => {
              this.lastUpdate = -Infinity;
            })
            .catch(() => {});
      if (this.wanted.every((file) => this.cache.has(file))) {
        const key = this.wanted.join('|');
        if (key !== this.cutKey) {
          this.cutKey = key;
          this.adoptCut(
            this.wanted.flatMap((file) => this.cache.get(file)),
            now,
          );
        }
      }
    }
  },
  pin(o) {
    if (!o) return o;
    if (o.historicalStellarNavigation) {this.pinned.set(o.id,o);return o;}
    const core = OBJECTS.find((q) => q.id === o.id);
    if (core) return core;
    globalThis.StellarClusters?.prepare(o);
    globalThis.Nebulae?.prepare(o);
    this.pinned.set(o.id, o);
    this.prepareGalaxy(o);
    this.repairLocalStar(o);
    return o;
  },
  repairLocalStar(o, seen = new Set()) {
    if (!o?.synthetic || !o.parentObject || seen.has(o.id)) return;
    seen.add(o.id);
    const host = this.coreIndex?.get(o.parentObject) || this.pinned.get(o.parentObject);
    if (!host?.p3 || !o.p3) return;
    this.repairLocalStar(host, seen);
    if(o.arrivalHost||o.id.startsWith('arrival-star:')){
      const n=Number(o.id.split(':').at(-1));
      o.name='Игровая звезда возле «'+host.name+'»'+(n>1?' · '+n:'');
    }
    // Store a reference-epoch position. MapLayout.project already applies the
    // common host translation; storing its expanded position applied that twice.
    const base = MapLayout.ordinaryProject(host),
      offset = o.p3.map((v, i) => v - host.p3[i]);
    o.mapPosition = { x: base.x + offset[0], y: base.y - offset[1] };
    MapLayout.cache.delete(o.id);
    Cosmology.cache.delete(o.id);
  },
  prepareGalaxy(o) {
    if (o.kind !== 'galaxy' || !o.p3 || o.supersededBy) return;
    const angular=o.angularMajorArcmin>0&&o.d>0;
    const diameter=angular?2*o.d*Math.tan(o.angularMajorArcmin*Math.PI/21600):o.diameterLy;
    const derived=!o.galaxy || o.galaxy.catalogGeometry || o.streamed&&!this.coreIndex?.has(o.id);
    // A missing angular size supplies no measured galaxy outline. Keep a point.
    if (derived && (!(diameter > 0) || !angular&&(o.sizeEstimated || o.sizeUnknown))) {
      delete o.galaxy;
      GalaxyRegistry.remove(o.id);
      return;
    }
    if (o.galaxy) {
      Object.assign(o.galaxy, {
        x: o.x,
        y: o.y,
        p3: o.p3,
        mapPosition: o.mapPosition,
        diameterLy: derived ? diameter : o.galaxy.diameterLy || o.diameterLy,
        ...(derived ? {catalogGeometry:true} : {}),
      });
      GalaxyRegistry.add(o.galaxy);
      return;
    }
    const g = {
      id: o.id,
      name: o.name,
      x: o.x,
      y: o.y,
      p3: o.p3,
      mapPosition: o.mapPosition,
      diameterLy: diameter,
      catalogGeometry: true,
      axisRatio: (o.angularMinorArcmin || o.angularMajorArcmin || 1) / (o.angularMajorArcmin || 1),
      shape: /^(?:d?E|d?Sph|S0)/i.test(o.hubbleType || '')
        ? 'elliptical'
        : /^S(?!0)/.test(o.hubbleType || '')
          ? 'spiral'
          : 'irregular',
      rotation: 0,
    };
    o.galaxy = g;
    GalaxyRegistry.add(g);
  },
  async resolve(entry) {
    const existing = OBJECTS.find((o) => o.id === entry.id) || this.get(entry.id);
    if (existing) return this.pin(existing);
    const file = entry.tile || EXTENDED_BOOT.systemTiles?.[entry.id];
    if (!file) throw Error('Нет адреса записи каталога');
    const rows = await this.tile(file),
      o = rows.find((o) => o.id === entry.id);
    if (!o) throw Error('Запись не найдена в каталоге');
    return this.pin(o);
  },
  focus(o) {
    if (o.cosmicEpoch) {
      UniverseMap.focus(o);
      return;
    }
    if (o.nuclearStar) {
      NuclearStars.focus(o.orbit);
      return;
    }
    if (o.atlasOnly) {
      toast(
        o.positionReason ||
          'Для этого объекта недостаточно точное положение. Он доступен только в атласе.',4200,'warning',
      );
      return;
    }
    if (o.region) {
      RegionMap.focus(o);
      return;
    }
    const p = MapLayout.project(o),
      span = o.positionEstimate
        ? Math.max(24, 4 * o.positionEstimate.localEnvelopeLy, 4 * (o.diameterLy || 0))
        : o.kind === 'galaxy'
          ? (o.galaxy?.diameterLy || 30000) * 2.8
          : o.positionQuality === 'unknown'
            ? Math.max(400, Math.hypot(p.x, p.y) * 0.04)
            : o.synthetic
              ? 2
              : o.kind === 'star'
                ? 24
                : Math.max(24, Math.min(20000, (o.d || 100) * 0.03));
    const system = this.systemByMember.get(o.id),
      viewSpan = system?.separationLy ? Math.max(0.00006, system.separationLy * 6) : span;
    goCamera(
      p.x,
      p.y,
      globalThis.MapVisibility?.active ? MapVisibility.focusSpan(o, viewSpan) : viewSpan,
    );
  },
  capture(saved) {
    saved.catalogGeometry = MapLayout.version;
    saved.catalogRevision = EXTENDED_BOOT.revision;
    const ids = new Set([
      saved.current,
      saved.selected,
      saved.flight?.target,
      saved.flight?.fromId,
      ...(saved.visited || []),
      ...(saved.destroyed || []),
      ...(saved.flightHistory || []).flatMap((h) => [h.fromId, h.target]),
      ...(saved.itinerary || []).map((n) => n.id),
      ...(saved.nextTargets || []).map((n) => n.id),
      saved.flight?.requestedTarget,
      ...(saved.flight?.route || []).map((n) => n.id),
    ]);
    // Include the parent galaxy so a generated star can still be identified on reload.
    for (const id of ids) {
      const o = this.get(id);
      if (o?.parentGalaxy) ids.add(o.parentGalaxy);
      if (o?.parentObject) ids.add(o.parentObject);
      const anchor = o && MapLayout.anchorId(o);
      if (anchor) ids.add(anchor);
    }
    saved.catalogObjects = [...ids].map((id) => this.pinned.get(id) ||
      (this.coreIndex.get(id)?.stellarSystem ? this.coreIndex.get(id) : null)).filter(Boolean);
    for (const [id, o] of this.pinned) if (!ids.has(id) && !this.isSystemMember(o)) this.pinned.delete(id);
  },
  restore(saved) {
    this.systemView = null;
    this.systemViewRequest++;
    if(saved.visited)saved.visited=[...new Set(saved.visited.map(id=>CatalogIdentities.redirects[id]||id))];
    // Older versions did not serialize core-star records. Active endpoints
    // still carry their original physical coordinates in the frozen plan.
    saved.catalogObjects ??= [];
    for (const [id,point] of [[saved.flight?.target,saved.flight?.aim],[saved.flight?.fromId,saved.flight?.from],
      [!saved.flight&&!saved.orbit?saved.current:null,saved.ship]]) {
      const current=this.coreIndex.get(id);
      if(current?.stellarSystem&&point?.p3?.every(Number.isFinite)&&!saved.catalogObjects.some(o=>o.id===id))
        saved.catalogObjects.push({...current,...Space.point(point.p3)});
    }
    const restoring = new Map((saved?.catalogObjects || []).filter(o => o?.id).map(o => [o.id, o]));
    const navigationIds = new Set([
      saved?.current, saved?.flight?.target, saved?.flight?.fromId, saved?.flight?.requestedTarget,
      ...(saved?.flight?.route || []).map(n => n.id),
      ...(saved?.flightHistory || []).flatMap(h => [h.fromId, h.target]),
      ...(saved?.itinerary || []).map(n => n.id),
      ...(saved?.nextTargets || []).map(n => n.id),
    ]);
    // Saved arrival stars and local systems also need their original hosts.
    // Set iteration includes newly discovered ancestors and terminates on cycles.
    for (const id of navigationIds) {
      const o = restoring.get(id) || this.coreIndex.get(id), anchor = o && MapLayout.anchorId(o);
      if (anchor) navigationIds.add(anchor);
    }
    // Old core destinations were usually omitted from catalogObjects. Retain
    // their original component position privately when an old voyage uses it.
    for(const id of navigationIds){
      if(!CatalogIdentities.redirects[id]||restoring.has(id))continue;
      const source=IMPORTED_CATALOG.objects.find(o=>o.id===id);
      if(!source||![source.raDeg,source.decDeg,source.d].every(Number.isFinite))continue;
      const old={...source,...Space.point(Space.fromSky(source.raDeg,source.decDeg,source.d)),
        navigable:true,mapGeometry:MapLayout.version};
      old.mapPosition=MapLayout.place(old);old.mapOffset=[0,0];
      saved.catalogObjects.push(old);restoring.set(id,old);
    }
    const privateSelection = navigationIds.has(saved?.selected) &&
      restoring.has(saved?.selected);
    if(saved?.selected && !privateSelection)saved.selected=this.identityRedirects[saved.selected]||saved.selected;
    const oldGeometry =
        saved &&
        (saved.catalogGeometry !== MapLayout.version ||
          saved.catalogRevision !== EXTENDED_BOOT.revision),
      oldCoordinates = (saved?.catalogGeometry ?? 1) < 2;
    for (const o of saved?.catalogObjects || []) {
      if (!o || typeof o.id !== 'string') continue;
      const successor=this.identityRedirects[o.id];
      if(successor){
        // Old active navigation keeps its exact physical estimate and frozen
        // plan. This private compatibility record never becomes a second map
        // object or search result. Ordinary selection uses the canonical host.
        if(!navigationIds.has(o.id))continue;
        const canonical=this.coreIndex.get(successor);
        Object.assign(o,{supersededBy:successor,historicalNavigation:true,name:canonical?.name||o.name});
      }
      const authoritative = this.coreIndex.get(o.id);
      const stellarNavigation = authoritative?.stellarSystem && navigationIds.has(o.id) && o.p3?.every(Number.isFinite) &&
        (o.historicalStellarNavigation || Math.hypot(...o.p3.map((v,i)=>v-authoritative.p3[i]))>1e-12);
      if (stellarNavigation) {
        // An existing flight/parking keeps its exact physical endpoint. Names
        // and source metadata may be refreshed without moving that endpoint.
        o.historicalStellarNavigation = true;
        if(o.kind!==authoritative.kind)o.facts=JSON.parse(JSON.stringify(authoritative.facts));
        Object.assign(o,{kind:authoritative.kind,type:authoritative.type,
          stellarSystem:authoritative.stellarSystem,stellarComponent:authoritative.stellarComponent});
        this.stellarProperties(o);
      } else if (authoritative?.coordinateModel) this.adopt(o, authoritative, saved);
      const correction = (
        EXTENDED_BOOT.coordinateCorrections ||
        EXTENDED_BOOT.pulsarCorrections ||
        []
      ).find((r) => r[0] === o.id);
      if (correction && !stellarNavigation) this.adopt(o, this.decode(correction), saved);
      if ((o.mapGeometry !== MapLayout.version || !Number.isFinite(o.mapPosition?.x) || !Number.isFinite(o.mapPosition?.y)) && o.p3?.every(Number.isFinite)) {
        const previous = o.mapGeometry ?? saved?.catalogGeometry ?? 1,
          raw = MapLayout.base(o.p3);
        delete o.mapOffset;
        const d = MapLayout.displacement(
          o,
          raw,
          (id) => this.coreIndex.get(id) || restoring.get(id) || this.pinned.get(id),
        );
        o.mapOffset = [d.x, d.y];
        o.mapPosition = { x: raw.x + d.x, y: raw.y + d.y };
        o.mapGeometry = MapLayout.version;
        if (previous < 2 && !o.synthetic) {
          o.atlasOnly = this.hiddenIds.has(o.id) || o.positionQuality === 'unknown';
          o.navigable = !o.atlasOnly && !!o.p3;
          delete o.distanceRelativeError;
          o.uncertaintyMatched = false;
        }
      }
      if (this.hiddenIds.has(o.id) || o.positionQuality === 'unknown') {
        o.atlasOnly = true;
        o.navigable = false;
        o.coordinateNote =
          o.positionReason ||
          'Индивидуальная глубина или пригодное расстояние не определены. Только атлас.';
        if (o.historicalNavigation)
          o.coordinateNote +=
            ' Прежняя приблизительная навигационная оценка сохранена только для текущего положения корабля или старого маршрута.';
      }
      if (
        (o.p3 == null || o.p3.every(Number.isFinite)) &&
        (o.atlasOnly || (Number.isFinite(o.mapPosition?.x) && Number.isFinite(o.mapPosition?.y)))
      )
        this.pin(o);
    }
    for (const o of this.pinned.values()) this.repairLocalStar(o);
    if (
      saved?.flight &&
      (this.get(saved.flight.fromId)?.synthetic || this.get(saved.flight.target)?.synthetic)
    )
      delete saved.flight.view;
    if (oldGeometry) {
      const f = saved.flight,
        target = f && this.get(f.target);
      if (f) {
        if (oldCoordinates && target?.p3 && f.from?.p3 && saved.phase !== 'flyby') {
          const aim = f.aim?.p3 ? f.aim : target;
          f.distance = Space.distance(f.from, aim);
          f.cosmic = Cosmology.isCosmic(this.get(f.fromId) || f.from, target);
          if (f.distance > 0 && saved.ship)
            Object.assign(saved.ship, Space.mix(f.from, aim, f.covered / f.distance));
        }
        delete f.view;
      } else if (saved.ship && (oldCoordinates || this.get(saved.current)?.coordinateModel)) {
        const current = this.get(saved.current);
        if (current?.p3) Object.assign(saved.ship, Space.point(current.p3));
      }
      saved.catalogGeometry = MapLayout.version;
      saved.catalogRevision = EXTENDED_BOOT.revision;
    }
  },
  arrivalStar(host, destroyed = state.destroyed) {
    if (globalThis.ArrivalStars?.eligible(host)) {
      const result = ArrivalStars.lookup(host, destroyed);
      if (result.star) return result.star;
      if (!result.ready && (ArrivalStars.index || typeof fetch === 'function' || globalThis.PARUS_CATALOG_FILES)) return null;
    }
    return this.syntheticArrivalStar(host, destroyed);
  },
  syntheticArrivalStar(host, destroyed = state.destroyed) {
    // Pure preview: fictional stars are only registered at the actual stop.
    if (
      !host?.navigable ||
      host.atlasOnly ||
      !host.p3?.every(Number.isFinite) ||
      host.rangeProbe ||
      ['home', 'star'].includes(host.kind)
    )
      return null;
    let n = 1;
    while (destroyed.includes('arrival-star:' + host.id + ':' + n)) n++;
    const id = 'arrival-star:' + host.id + ':' + n,
      existing = this.get(id);
    if (existing) {existing.name='Игровая звезда возле «'+host.name+'»'+(n>1?' · '+n:'');return existing;}
    const p = MapLayout.ordinaryProject(host),
      o = {
        id,
        name: 'Игровая звезда возле «' + host.name + '»' + (n > 1 ? ' · ' + n : ''),
        aliases: [host.name, 'Игровая звезда'],
        kind: 'star',
        type: 'УСЛОВНАЯ ИГРОВАЯ ЗВЕЗДА',
        synthetic: true,
        arrivalHost: host.id,
        parentObject: host.id,
        ...(host.kind === 'galaxy' ? { parentGalaxy: host.id } : {}),
        ...Space.point([...host.p3]),
        mapPosition: { ...p },
        d: Math.hypot(...host.p3),
        navigable: true,
        positionQuality: 'fictional',
        desc:
          'Игровая звезда возле «' +
          host.name +
          '». Создана для продолжения экспедиции; подходящая известная звезда в каталоге не найдена. Игровая позиция совпадает с опорной точкой объекта.',
        coordinateNote: 'Игровая позиция в выбранной области; не астрономическое измерение.',
        facts: {
          class: 'Условная игровая звезда',
          mass: 'Индивидуальная масса неизвестна.',
          lumUnknown: 'Для разгона используется игровая оценка светимости.',
          note: 'Появляется при прибытии корабля. Положение и параметры не являются измерением реальной звезды.',
          refs: [],
        },
      };
    return o;
  },
  revealArrival(host, star = this.arrivalStar(host)) {
    if (!star) return host;
    return this.pin(star);
  },
  // The fixed visibility hierarchy has already resolved density. Only the
  // legacy renderer needs a local foreground exclusion grid.
  backgroundBuckets() {
    if (globalThis.MapVisibility?.active) return null;
    const buckets = new Map();
    for (const o of OBJECTS) {
      if (this.background(o) || o.region || !this.matchesMap(o) || !MapDetails.visible(o, cam.span))
        continue;
      const p = screen(o);
      if (p.x <= -30 || p.x >= width + 30 || p.y <= -30 || p.y >= height + 30) continue;
      const key = Math.floor(p.x / 16) + ',' + Math.floor(p.y / 16);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ ...p, level: MapDetails.level(o) });
    }
    return buckets;
  },
  backgroundCovered(o, p, buckets) {
    const bx = Math.floor(p.x / 16),
      by = Math.floor(p.y / 16),
      level = MapDetails.level(o);
    for (let ix = -1; ix <= 1; ix++)
      for (let iy = -1; iy <= 1; iy++) {
        if (
          (buckets.get(bx + ix + ',' + (by + iy)) || []).some(
            (q) => q.level >= level && Math.hypot(q.x - p.x, q.y - p.y) < 16,
          )
        )
          return true;
      }
    return false;
  },
  draw() {
    const buckets = this.backgroundBuckets(),
      seen = new Set();
    const sources = [
      globalThis.MapFilters?.objects.values() || [],
      globalThis.MapLayers?.visible || [],
      this.visible,
      this.pinned.values(),
      OBJECTS,
    ];
    const outside = (q) => q.x < 0 || q.y < 0 || q.x > width || q.y > height;
    for (const source of sources)
      for (const o of source) {
        // Reject foreground objects before their visibility/geometry calculations.
        if (
          seen.has(o.id) ||
          o.id === state.selected ||
          o.id === state.current ||
          !this.background(o)
        )
          continue;
        const located = o.p3 ? screenOf(o) : null;
        if (
          (located && outside(located)) ||
          (o.region?.shape === 'polyline' && !RegionMap.asPoint(o)) ||
          MapDetails.sparse(o, cam.span) ||
          !MapDetails.visible(o, cam.span) ||
          !RegionMap.asPoint(o) ||
          !this.matchesMap(o)
        )
          continue;
        const alpha = this.opacity(o);
        if (alpha < 0.015) continue;
        seen.add(o.id);
        const p = located || screen(o);
        if (outside(p)) continue;
        const name = MapDetails.mapLabelName(o);
        if (
          buckets &&
          name === null &&
          !(globalThis.MapLayers?.active && MapLayers.manages(o)) &&
          this.backgroundCovered(o, p, buckets)
        )
          continue;
        const opacity = alpha * RegionMap.pointOpacity(o);
        ctx.save();
        // Its visible nucleus already paints this exact centre. Keep the host
        // identity/hit record below without overpainting the compact-object ink.
        ctx.globalAlpha = globalThis.BlackHoleCatalog?.renderedHosts?.has(o.id)
          ? 0 : (o.kind === 'star' ? 0.65 : 0.9) * opacity;
        if (MapSymbols.handles(o)) MapSymbols.draw(o, p, '#555555');
        else {
          ctx.fillStyle = paint(o.kind === 'star' ? '#858585' : '#555555');
          ctx.beginPath();
          ctx.arc(p.x, p.y, o.kind === 'star' ? 1.25 : 1.85, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        hitObjects.push({ o, p, r: 5, background: true });
        if (name !== null)
          MapLabels.point({
            key: 'object-' + o.id,
            object: o,
            name,
            detail: () => routeLabelDistance(o),
            p,
            mass: MapDetails.mass(o),
            level: MapDetails.level(o),
            priority: 10,
            opacity,
          });
      }
  },
  drawSystems() {
    const get = (id) => {
      const o = this.get(id);
      return o?.atlasOnly || !this.matchesMap(o) ? null : o;
    };
    this.stellarTargets ??= new Set(EXTENDED_BOOT.stellarCatalog?.auditTargets || []);
    this.systemNotes ??= new WeakMap();
    for (const s of this.systems) {
      if (s.stellarEnriched || s.members.some(id => this.stellarTargets.has(id))) continue;
      let memo = this.systemNotes.get(s);
      if (!memo || memo.note !== s.note)
        this.systemNotes.set(s, (memo = { note: s.note, conventional: /ориентация и фаза.*условны/i.test(s.note||'') }));
      if (s.id === 'system-alpha-centauri' || memo.conventional) continue;
      const members = s.members.map(get).filter(Boolean);
      if (members.length < 2 || (cam.span > 2000 && members.every((o) => o.kind === 'star')))
        continue;
      for (let i = 0; i < s.links.length; i++) {
        const [ai, bi] = s.links[i],
          a = get(ai),
          b = get(bi);
        if (!a || !b) continue;
        const pa = screenOf(a),
          pb = screenOf(b);
        const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
        if (
          d > Math.max(width, height) * 1.5 ||
          Math.max(pa.x, pb.x) < 0 ||
          Math.min(pa.x, pb.x) > width ||
          Math.max(pa.y, pb.y) < 0 ||
          Math.min(pa.y, pb.y) > height
        )
          continue;
        ctx.save();
        ctx.strokeStyle = paint('#aaa');
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 0.6;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        // An association has no measured orbital elements. A straight link
        // identifies components without inventing an orbital ellipse.
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  },
  async showSystem(id) {
    const system = this.systemByMember.get(id);
    if (!system) return;
    const selected = state.selected, dialogOpen = $('infoDialog').open,
      request = ++this.systemViewRequest;
    const results = await Promise.allSettled(system.members.map(id => this.resolve({id})));
    // Ignore a slow catalogue response after the user opens another card.
    if (request !== this.systemViewRequest || selected !== state.selected || dialogOpen && !$('infoDialog').open) return;
    const members = results.filter(r => r.status === 'fulfilled').map(r => this.pin(r.value)),
      bounds = focusRelatedSystem(members);
    if (!bounds) {
      toast('Для компонентов системы нет доступных положений на карте.',4200,'warning');
      return;
    }
    if (bounds.members.length < system.members.length)
      toast('На карте ' + bounds.members.length + ' из ' + system.members.length + ' компонентов: остальные положения неизвестны или не загрузились.',4200,'warning');
    return bounds;
  },
  searchIdleMs: 300000,
  searchClosedMs: 60000,
  releaseSearchAfter(delay) {
    clearTimeout(this.searchRelease);
    if (!this.worker) return;
    this.searchRelease = setTimeout(() => {
      if (!this.worker) return;
      if (this.pendingSearch.size) {
        this.releaseSearchAfter(delay);
        return;
      }
      this.worker.terminate();
      this.worker = null;
    }, delay);
  },
  async search(term, filter, limit) {
    if (globalThis.PARUS_CATALOG_FILES || typeof Worker !== 'function') {
      this.fallbackIndex ||= this.readJSON('catalog-data/search.json');
      const rows = await this.fallbackIndex,
        key = MapDetails.searchKey(term);
      const all = rows
        .filter((r) => this.matches(r[8] || r[2], filter) && r[6].includes(key))
        .sort(
          (a, b) =>
            (key
              ? Number(b[6].includes('|' + key + '|')) - Number(a[6].includes('|' + key + '|'))
              : 0) || (a[3] ?? Infinity) - (b[3] ?? Infinity),
        );
      return {
        total: all.length,
        items: all
          .slice(0, limit)
          .map((r) => ({
            id: r[0],
            name: r[1],
            kind: r[2],
            d: r[3],
            positionQuality: r[4],
            tile: r[5],
            atlasOnly: !!r[7],
            catalogClass: r[8] || null,
            streamed: true,
            searchExact: !!key && r[6].includes('|' + key + '|'),
          })),
      };
    }
    if (!this.worker) {
      this.worker = new Worker('catalog-search-worker.js?v=81');
      this.pendingSearch = new Map();
      this.worker.onmessage = ({ data }) => {
        const p = this.pendingSearch.get(data.seq);
        if (p) {
          this.pendingSearch.delete(data.seq);
          data.error ? p.reject(Error(data.error)) : p.resolve(data);
        }
      };
      this.worker.onerror = () => {
        for (const p of this.pendingSearch.values())
          p.reject(Error('Не удалось открыть поиск полного каталога'));
        this.pendingSearch.clear();
        this.worker.terminate();
        this.worker = null;
      };
    }
    clearTimeout(this.searchRelease);
    const seq = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pendingSearch.set(seq, { resolve, reject });
      this.worker.postMessage({
        seq,
        term,
        filter,
        limit,
        dataRoot: EXTENDED_BOOT.dataRoot || 'catalog-data',
        version: EXTENDED_BOOT.revision,
      });
    }).finally(() =>
      this.releaseSearchAfter($('catalog').hidden ? this.searchClosedMs : this.searchIdleMs));
  },
  matches(kind, filter, o) {
    if (kind === 'cluster' && o) {
      const gal =
        o.catalogClass === 'galaxy-cluster' ||
        /галактик/i.test([o.type, o.name, o.facts?.class].join(' '));
      return filter === 'all' || filter === (gal ? 'galaxy-cluster' : 'stellar-cluster');
    }
    return (
      filter === 'all' ||
      (filter === 'star' && ['star', 'home'].includes(kind)) ||
      (filter === 'stellar-cluster' && kind === 'cluster') ||
      (filter === 'structure' && ['structure', 'wall', 'ring', 'arc'].includes(kind)) ||
      (filter === kind &&
        [
          'pulsar',
          'blackhole',
          'quasar',
          'nebula',
          'galaxy',
          'void',
          'horizon',
          'galaxy-cluster',
          'stellar-cluster',
        ].includes(kind))
    );
  },
};
ExtendedCatalog.init();
