'use strict';
// Catalogue search, object cards and informational dialogs.
const Notices={
  labels:{info:'Сообщение',tip:'Подсказка',warning:'Предупреждение',orbit:'Выход на орбиту',arrival:'Прибытие',route:'Маршрут',reset:'Состояние экспедиции',quest:'Квест'},
  action:null,
  run(){
    const action=this.action;
    if(!action||$('toast').hidden)return;
    this.action=null;
    UIPatch.apply($('toast'),'.has-action',false);
    UIPatch.apply($('toastAction'),'hidden',true);
    clearTimeout(toastTimer);
    $('toast').hidden=true;
    action.run();
  },
  render(text,icon='info',kind='notice',action=null){
    const node=$('toast');if(!this.labels[icon])icon='info';
    if(this.action!==action){
      this.action=action;
      UIPatch.apply(node,'.has-action',!!action);
      UIPatch.apply($('toastAction'),'hidden',!action);
    }
    UIContent.text($('toastAction'),action?.label||'');
    if(kind==='notice')this.context={flight:state.flight,phase:state.phase,elapsed:globalThis.FlightTips?.elapsed(state.flight)??0};
    if(node.dataset.kind!==kind)node.dataset.kind=kind;
    if(node.dataset.icon!==icon)node.dataset.icon=icon;
    UIPatch.apply(node,'@role',icon==='warning'?'alert':'status');
    UIPatch.apply(node,'@aria-label',this.labels[icon]);
    UIPatch.apply($('toastIcon'),'@href','#'+icon+'-icon');
    UIContent.text($('toastText'),text);if(node.hidden)node.hidden=false;
  },
};
function toast(text,duration=4200,icon='info',action=null){
  Notices.render(text,icon,'notice',action);
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{$('toast').hidden=true;globalThis.FlightTips?.render();},duration);
}

let catalogRevision = 0,
  catalogTimer;
function catalogRows(items, total, loading = false, error = '') {
  $('catalogCount').textContent =
    total.toLocaleString('ru-RU') +
    ' / ' +
    ExtendedCatalog.total.toLocaleString('ru-RU') +
    (loading ? ' · поиск…' : '');
  $('catalogList').replaceChildren();
  if (!items.length) {
    const e = document.createElement('p');
    e.className = 'empty-state';
    e.textContent = loading ? 'Поиск по полному каталогу…' : error || 'Объекты не найдены.';
    $('catalogList').append(e);
  }
  for (const entry of items) {
    const b = document.createElement('button');
    b.className = 'catalog-item';
    const quality =
      entry.atlasOnly || entry.positionQuality === 'unknown'
        ? ' · ТОЛЬКО ПОИСК'
        : entry.positionQuality === 'approximate'
          ? ' · ПРИБЛИЗИТЕЛЬНО'
          : entry.synthetic
            ? ' · ИГРОВАЯ ЗВЕЗДА'
            : '';
    const body = document.createElement('span');
    body.className = 'catalog-item-body';
    const name = document.createElement('strong');
    name.textContent = entry.name;
    const detail = document.createElement('small');
    detail.textContent =
      MapDetails.typeName(entry) +
      ' · ' +
      (entry.atlasOnly ? 'дальность не определена' : distanceText(entry.d)) +
      quality +
      (state.visited.includes(entry.id) ? ' · ИССЛЕДОВАНО' : '');
    body.append(name);
    body.append(detail);
    b.append(body);
    const arrow = document.createElement('span');
    arrow.textContent = '↗';
    b.append(arrow);
    b.addEventListener('click', async (event) => {
      b.disabled = true;
      try {
        const o = await ExtendedCatalog.resolve(entry);
        const picking = Route.picking;
        select(o.id,false,{deferPreview:event.shiftKey||picking,routeAnchor:!event.shiftKey&&!picking});
        closeCatalog();
        if (picking) {
          if (Route.add(o.id)) fitRoute(o,{wholeRoute:true});
        } else {
          ExtendedCatalog.focus(o);
          if (event.shiftKey) planRoutePoint(o.id,{deferPreview:true});
        }
      } catch (e) {
        toast(e.message,4200,'warning');
        b.disabled = false;
      }
    });
    $('catalogList').append(b);
  }
  if (error && items.length) {
    const e = document.createElement('p');
    e.className = 'empty-state';
    e.textContent = error + ' · показана основная выборка';
    $('catalogList').append(e);
  }
  if (total > items.length && !loading && !error) {
    const more = document.createElement('button');
    more.className = 'map-size-action';
    more.textContent = 'Ещё 100 объектов';
    more.onclick = () => {
      ExtendedCatalog.searchLimit += 100;
      renderCatalog();
    };
    $('catalogList').append(more);
  }
}
function catalogMatchRank(o, term, exact) {
  if (!term) return 0;
  const name = MapDetails.searchKey(o.name || ''),
    id = MapDetails.searchKey(o.id || '');
  return name === term || id === term
    ? 5
    : o.kind === 'galaxy' && exact(o)
      ? 4
      : name.startsWith(term)
        ? 3
        : o.searchExact || exact(o)
          ? 2
          : name.includes(term)
            ? 1
            : 0;
}
function renderCatalog() {
  if ($('catalog').hidden) return;
  const revision = ++catalogRevision,
    term = MapDetails.searchKey($('search').value.trim()),
    designation = MapDetails.designationQuery($('search').value),
    limit = ExtendedCatalog.searchLimit;
  const designated = (o) => !!designation && MapDetails.designationMatches(o, designation);
  const exact = (o) =>
    designated(o) ||
    (!!term &&
    [
      o.name,
      o.id,
      ...(o.aliases || []),
      o.ngc || '',
      'HIP ' + (o.hip || ''),
      'HD ' + (o.hd || ''),
    ].some((v) => MapDetails.searchKey(v) === term));
  const core = [...OBJECTS, ...ExtendedCatalog.pinned.values()]
    .filter(
      (o) =>
        !o.supersededBy &&
        !o.historicalCoordinateNavigation &&
        !o.streamed &&
        ExtendedCatalog.matches(o.kind, searchFilter, o) &&
        (designated(o) ||
          MapDetails.searchKey(
            `${o.name} ${(o.aliases || []).join(' ')} ${o.type} ${MapDetails.typeName(o)} ${o.id} ${o.ngc || ''} ${o.hip || ''} ${o.hd || ''} ${o.gliese || ''}`,
          ).includes(term)),
    )
    .sort(
      (a, b) =>
        catalogMatchRank(b, term, exact) - catalogMatchRank(a, term, exact) ||
        (a.d ?? Infinity) - (b.d ?? Infinity),
    );
  catalogRows(core.slice(0, limit), core.length, true);
  if (typeof fetch !== 'function' && !globalThis.PARUS_CATALOG_FILES) {
    catalogRows(core.slice(0, limit), core.length);
    return;
  }
  ExtendedCatalog.search(term, searchFilter, limit, designation?.pattern)
    .then((result) => {
      if (revision !== catalogRevision || $('catalog').hidden) return;
      const ids = new Set(core.map((o) => o.id));
      const items = [...core, ...result.items.filter((o) => !ids.has(o.id))]
        .sort(
          (a, b) =>
            catalogMatchRank(b, term, exact) - catalogMatchRank(a, term, exact) ||
            (a.d ?? Infinity) - (b.d ?? Infinity) ||
            a.id.localeCompare(b.id),
        )
        .slice(0, limit);
      catalogRows(items, core.length + result.total);
    })
    .catch((e) => {
      if (revision === catalogRevision)
        catalogRows(core.slice(0, limit), core.length, false, e.message);
    });
}
function showMenuPage(page, focus = false) {
  document.querySelectorAll('[data-menu-page]').forEach((panel) => {
    panel.hidden = panel.dataset.menuPage !== page;
  });
  $('libraryBtn').setAttribute('aria-expanded', String(page === 'library'));
  $('settingsBtn').setAttribute('aria-expanded', String(page === 'settings'));
  $('menu').scrollTop = 0;
  if (focus) $('menu').querySelector('[data-menu-page]:not([hidden]) button, [data-menu-page]:not([hidden]) input')?.focus();
}
function closeMenu() {
  const restoreFocus = document.activeElement?.closest('#menu');
  const opener = $('libraryBtn').getAttribute?.('aria-expanded') === 'true' ? $('libraryBtn') : $('settingsBtn');
  $('menu').hidden = true;
  showMenuPage();
  if (restoreFocus) opener.focus();
}
function toggleMenu(page) {
  const button = page === 'library' ? $('libraryBtn') : $('settingsBtn');
  const open = !$('menu').hidden && button.getAttribute('aria-expanded') === 'true';
  closeMenu();
  if (open) return;
  MapFilters.close();
  closeCatalog();
  $('themePicker').hidden = true;
  $('themeBtn').setAttribute('aria-expanded', 'false');
  showMenuPage(page);
  $('menu').hidden = false;
}
function planRoutePoint(id,{deferPreview=false}={}) {
  const before=Route.nodes().length;
  if (!Route.add(id,{toggle:true,deferPreview,afterSelection:true})) return;
  if(Route.nodes().length>before)FlightTips.use('shift-route',{persistNow:!deferPreview});
  toast(Route.nodes().length<before?'Участок удалён.':Gravity.canFlyby(object(id))?'Пролёт у «'+object(id).name+'». Добавьте следующую точку.':'Добавлена точка «'+object(id).name+'».',4200,'route');
}
function openCatalog() {
  MapFilters.close();
  Quests.close();
  closeMenu();
  $('catalog').hidden = false;
  $('catalogBtn').setAttribute('aria-expanded', 'true');
  renderCatalog();
  $('search').focus();
}
function closeCatalog() {
  const restoreFocus = document.activeElement?.closest('#catalog');
  $('catalog').hidden = true;
  $('catalogBtn').setAttribute('aria-expanded', 'false');
  ExtendedCatalog.releaseSearchAfter(ExtendedCatalog.searchClosedMs);
  if (restoreFocus) $('catalogBtn').focus();
  Route.picking = false;
}
function showDialog(html, library = false) {
  ExtendedCatalog.systemViewRequest++;
  MapFilters.close();
  closeMenu();
  $('infoDialog').classList.toggle('library-dialog', library);
  $('dialogContent').onclick = null;
  $('dialogContent').innerHTML = html;
  $('infoDialog').showModal();
}
function stellarOrbitBounds(o) {
  if (!o || o.historicalStellarNavigation || !globalThis.OrbitalMotion) return null;
  const curves = [];
  for (const track of OrbitalMotion.stellarOrbits) {
    if (track.system !== o.stellarSystem) continue;
    for (const branch of track.branches) {
      if (!branch.factor) continue;
      const id = branch.ids[0], curve = OrbitalMotion.stellarCurve(track, id, branch.factor);
      if (curve) curves.push({id, curve});
    }
  }
  if (['alpha','hyg-71453','proxima'].includes(o.id))
    for (const id of ExtendedCatalog.systemByMember.get(o.id)?.members || [o.id]) {
      const curve = OrbitalMotion.alphaCurve(id);
      if (curve) curves.push({id, curve});
    }
  if (!curves.length) return null;
  return {box:orbitCurvesBox(curves.map(q => q.curve)), anchor:object(curves[0].id)};
}
function orbitCurvesBox(curves) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const curve of curves) {
    // Both map modes use an affine local orbital frame. Recover the exact
    // projected ellipse from three eccentric anomalies, including its offset.
    const a = curve.pointAt(0), b = curve.pointAt(Math.PI), d = curve.pointAt(Math.PI / 2),
      c = {x:(a.x+b.x)/2, y:(a.y+b.y)/2},
      rx = Math.hypot((a.x-b.x)/2, d.x-c.x), ry = Math.hypot((a.y-b.y)/2, d.y-c.y);
    box[0] = Math.min(box[0], c.x-rx);box[1] = Math.min(box[1], c.y-ry);
    box[2] = Math.max(box[2], c.x+rx);box[3] = Math.max(box[3], c.y+ry);
  }
  return box;
}
function objectOrbitBox(o) {
  if (!o || o.atlasOnly || o.historicalStellarNavigation || !globalThis.OrbitalMotion) return null;
  const curves = [];
  if (o.id === 'sol') {
    if (!state.destroyed.includes('sol'))
      for (const q of OrbitalMotion.planets) curves.push({pointAt:E => OrbitalMotion.planetPoint(q, E)});
  } else if (o.id === 'proxima') curves.push(OrbitalMotion.alphaCurve(o.id));
  else if (['alpha','hyg-71453'].includes(o.id))
    for (const id of ['alpha','hyg-71453']) curves.push(OrbitalMotion.alphaCurve(id));
  else {
    const track = OrbitalMotion.stellarOrbits
      .filter(t => t.system === o.stellarSystem && t.branches.some(b => b.factor && b.ids.includes(o.id)))
      .sort((a, b) => a.q.a - b.q.a)[0];
    for (const branch of track?.branches || [])
      if (branch.factor) curves.push(OrbitalMotion.stellarCurve(track, branch.ids[0], branch.factor));
  }
  const box = orbitCurvesBox(curves.filter(Boolean));
  return box.every(Number.isFinite) && box[2] > box[0] && box[3] > box[1] ? box : null;
}
function fitMapBox(b, v = routeViewport()) {
  const span = Math.max(.00006, (b[2]-b[0])*width/(v.right-v.left)*1.25,
    (b[3]-b[1])*width/(v.bottom-v.top)*1.25);
  goCamera((b[0]+b[2])/2-((v.left+v.right)/2-width*.43)*span/width,
    (b[1]+b[3])/2-((v.top+v.bottom)/2-mapOriginY())*span/width, span);
}
function focusObject(o) {
  if (!o) return;
  if (o.id === 'sgr') {
    NuclearStars.focus();
    return;
  }
  const orbits = objectOrbitBox(o);
  if (orbits) fitMapBox(orbits);
  else ExtendedCatalog.focus(o, true);
}
function relatedSystemBounds(members) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const include = b => {
    if (!b?.every(Number.isFinite)) return;
    box[0] = Math.min(box[0], b[0]);box[1] = Math.min(box[1], b[1]);
    box[2] = Math.max(box[2], b[2]);box[3] = Math.max(box[3], b[3]);
  };
  const located = members.filter(o => o?.p3?.length === 3 && o.p3.every(Number.isFinite) && !o.atlasOnly && !MapGeometry.unlocated(o));
  for (const o of located) {
    const p = MapLayout.project(o), extent = MapGeometry.indexBounds(o), scale = Cosmology.regionScale(o);
    include(extent ? [p.x+extent[0]*scale,p.y+extent[1]*scale,p.x+extent[2]*scale,p.y+extent[3]*scale] : [p.x,p.y,p.x,p.y]);
    include(stellarOrbitBounds(o)?.box);
  }
  return located.length && box.every(Number.isFinite) ? {box, anchor:located[0], members:located} : null;
}
function focusRelatedSystem(members) {
  const bounds = relatedSystemBounds(members);
  if (!bounds) return;
  $('infoDialog').close();
  if (bounds.members.some(o => !ExtendedCatalog.matches(o.kind, filter, o) || !MapFilters.matches(o)))
    MapFilters.change('all', 'all', 'all');
  MapFilters.invalidate();
  ExtendedCatalog.systemView = {selected:state.selected, members:new Set(bounds.members.map(o => o.id))};
  const controls = document.querySelector('.map-controls');
  if (width < 700 && controls) controls.open = false;
  const b = bounds.box, v = routeViewport(), panel = controls?.getBoundingClientRect(),
    card = $('flightCard').getBoundingClientRect();
  // The mobile sidebar is a transparent full-width wrapper. Reserve only the
  // visible control panel, and keep the ellipse above the actual target card.
  if (width < 700 && card.top > v.top + 24) v.bottom = Math.min(v.bottom, card.top - 12);
  if (panel?.bottom > v.top && panel.top < v.bottom)
    v.left = Math.min(v.right-100, Math.max(v.left, panel.right+16));
  fitMapBox(b, v);
  return bounds;
}
function stellarSkyPhoto(o) {
  return SkyGuide.gallery(o);
}

function stellarOrbitFacts(system) {
  if (!system?.stellarEnriched) return '';
  const number = n => Number(n.toPrecision(6)).toLocaleString('ru-RU'),
    missingName = {aArcsec:'большая полуось',node:'долгота узла',omega:'аргумент периастра',peri:'эпоха периастра',inclination:'наклонение',e:'эксцентриситет',period:'период'};
  return '<div class="stellar-orbit-facts">' + system.pairs.map(p => {
    const q = p.orbit, partial = p.partialOrbit,
      period = q ? q.period : partial?.period ? Number(partial.period) * (partial.periodUnit === 'd' ? 1/365.25 : 1) : partial?.Per ? Number(partial.Per) * (partial.x_Per === 'd' ? 1/365.25 : 1) : null;
    const value = q ? 'P = ' + number(q.period) + ' лет · e = ' + number(q.e) + ' · a = ' + number(q.a) + ' а.е.' :
      (period ? 'P = ' + number(period) + ' лет. ' : '') + 'Полная пространственная орбита не определена' +
      (p.missingElements.some(k => missingName[k]) ? ': отсутствует ' + p.missingElements.map(k => missingName[k]).filter(Boolean).join(', ') : '') + '.';
    const pair = p.primary + ' — ' + p.secondary,
      source = q ? 'Орбита из каталога ORB6 · ' + q.reference + ' · ' + (q.grade <= 5 ? 'класс качества ' + q.grade + '/5 (1 — лучший)' : 'интерферометрическое решение') + '.' : '';
    return '<div class="stellar-orbit-row"><strong>' + pair + ObjectCard.tip(pair, [source], value) + '</strong><span>' + value + '</span></div>';
  }).join('') + '</div>';
}
const ObjectCard = {
  measured: /^(?:[≈~<>≤≥≳≲]|около|порядка)?\s*\(?\d/i,
  bibcode: /(?<![\w.])\d{4}[A-Za-z&.]{5}[\w.]{9}[A-Z](?!\w)/g,
  journals: {
    ApJ: 'The Astrophysical Journal',
    ApJS: 'The Astrophysical Journal Supplement Series',
    AJ: 'The Astronomical Journal',
    MNRAS: 'Monthly Notices of the Royal Astronomical Society',
    'A&A': 'Astronomy &amp; Astrophysics',
    PASP: 'Publications of the Astronomical Society of the Pacific',
    BaltA: 'Baltic Astronomy',
  },
  methods: {
    paral: 'тригонометрический параллакс',
    plx: 'тригонометрический параллакс',
    sbf: 'флуктуации поверхностной яркости',
    't-rgb': 'вершина ветви красных гигантов',
    trgb: 'вершина ветви красных гигантов',
    't-f': 'соотношение Талли — Фишера',
    cep: 'цефеиды, зависимость период — светимость',
    ceph: 'цефеиды, зависимость период — светимость',
    kin: 'кинематическая оценка',
    mem: 'принадлежность к группе или скоплению',
    'st-l': 'спектральный класс и светимость',
    pnlf: 'функция светимости планетарных туманностей',
  },
  glossary: [
    [/M☉/, 'M☉ — масса Солнца, ≈ 2·10³⁰ кг.'],
    [/R☉/, 'R☉ — радиус Солнца, ≈ 696 тыс. км.'],
    [
      /L☉,([A-Z])/,
      (m) =>
        'L☉,' +
        m[1] +
        ' — светимость Солнца в полосе ' +
        m[1] +
        ': сравнивается только свет этой полосы, а не всё излучение.',
    ],
    [/L☉(?!,)/, 'L☉ — полная светимость Солнца, ≈ 3,8·10²⁶ Вт.'],
    [
      /(?<![A-Za-z])mag(?![A-Za-z])/,
      'mag — звёздная величина, логарифмическая шкала яркости: чем меньше число, тем ярче; разница в 5 mag — в 100 раз.',
    ],
    [
      /(?<![А-Яа-яЁё])[кМГ]?пк(?![А-Яа-яЁё])/,
      'пк — парсек, ≈ 3,26 св. года; кпк — тысяча парсеков, Мпк — миллион, Гпк — миллиард.',
    ],
    [/σπ\/π/, 'σπ/π — относительная погрешность параллакса.'],
    [
      /(?<![A-Za-z])z(?![A-Za-z])/,
      'z — красное смещение: насколько расширение Вселенной растянуло длину волны света в пути.',
    ],
    [
      /H₀|Ωm/,
      'H₀ и Ωm — параметры космологической модели: скорость расширения Вселенной и доля вещества в ней.',
    ],
    [/h⁻¹|(?<![A-Za-z])h=/, 'h — постоянная Хаббла в единицах 100 км/с на Мпк.'],
    [/J2000/, 'J2000 — эпоха, к которой отнесены небесные координаты: начало 2000 года.'],
    [/(?<![A-Za-zА-Яа-яЁё])P\s*=/, 'P — период обращения.'],
    [
      /(?<![A-Za-zА-Яа-яЁё])e\s*=/,
      'e — эксцентриситет орбиты: 0 — окружность, ближе к 1 — вытянутый эллипс.',
    ],
    [/(?<![A-Za-zА-Яа-яЁё])\|?a\|?\s*[=≈]/, 'a — большая полуось орбиты.'],
    [
      /а\.\s?е\./,
      'а.е. — астрономическая единица: среднее расстояние от Земли до Солнца, ≈ 150 млн км.',
    ],
  ],
  staged:
    /на (?:\dD-)?карт|карт[аеуы](?![а-яё])|схем|иллюстратив|рисун|значок|изобража|пунктир|полёт(?!а света)|маршрут|игров|только атлас|в атласе|за время экспедиции|не моделиру|не интегриру|внешним часам|точк[аеиу] (?:прибытия|начинает|остановки)|физическая точка|(?<!оптический )контур|(?:ширин|толщин|кривизн|ориентаци)[^.;]*условн|кеплеров|без возмущений|настоящего момента/i,
  topics: [
    ['Расстояние', /^(?:Метод|Источник оценки):/],
    ['Масса', /(?<!центр )масс/i],
    ['Светимость', /светимост|болометр|фотометр|поглощени|излучени/i],
    [
      'Размер',
      /размер|диаметр|радиус|(?<![а-яё])ос[ьи](?![а-яё])|протяжённост|размах|границ|длина|объём|бассейн|гало/i,
    ],
    [
      'Расстояние',
      /расстояни|дальност|параллакс|глубин|σπ|сопутств|красн\S* смещени|(?<![A-Za-z])z(?![A-Za-z])|древнего света|[кМ]пк/i,
    ],
    ['Положение', /позици|направлени|координат|положени|J2000|ICRS|на эпоху|начальная эпоха|центр/i],
  ],
  sampling:
    /задаёт отбор|выборка ограничена|не является полным[^.]*списком|^округлённ\S+ оценк\S+\.?$/i,
  plain(text) {
    return String(text || '').replace(/<[^>]+>/g, '');
  },
  nameKey(name) {
    return MapDetails.searchKey(String(name))
      .replace(/^messier(?=\d)/, 'm')
      .replace(/^m0+(?=\d)/, 'm');
  },
  stems(text) {
    return new Set(
      (this.plain(text).toLocaleLowerCase('ru').match(/[\p{L}\p{N}]{4,}/gu) || []).map((word) =>
        word.slice(0, 5),
      ),
    );
  },
  echoes(part, told) {
    const words = [...this.stems(part)];
    return words.length > 2 && words.filter((word) => told.has(word)).length >= words.length * 0.6;
  },
  names(o) {
    const host = object(o.positionEstimate?.anchor),
      seen = new Set(
        [o.name, ...o.name.split(' · '), ...(host ? [host.id, ...host.name.split(' · ')] : [])].map(
          (name) => this.nameKey(name),
        ),
      ),
      official = new Set((o.iauNames || []).map((name) => this.nameKey(name)));
    return [...(o.aliases || []), o.ngc || '']
      .flatMap((name) => String(name).split(' · '))
      .map((name) =>
        name
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/^NAME(?:-IAU)? /, ''),
      )
      .filter((name) => {
        const key = this.nameKey(name),
          designation = MapDetails.designationQuery(name.replace(/^V?\* /, ''));
        return (
          key &&
          !seen.has(key) &&
          seen.add(key) &&
          !(designation && MapDetails.designationMatches(o, designation))
        );
      })
      .map(
        (name) =>
          name.replace(/^(NGC|IC)\s*0*(?=\d)/, '$1 ').replace(/^MESSIER\s*0*(?=\d)/i, 'M ') +
          (official.has(this.nameKey(name)) ? ' (имя IAU)' : ''),
      );
  },
  split(text) {
    return String(text || '')
      .replace(new RegExp('(' + this.bibcode.source + ')\\s+(?=[A-ZА-ЯЁ«])', 'g'), '$1. ')
      .replace(/\.\s+·\s+(?=[A-ZА-ЯЁ«])/g, '. ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/(?<=[.!?…])\s+(?=[A-ZА-ЯЁ«])/)
      .filter(Boolean);
  },
  about(sentence) {
    if (this.sampling.test(sentence)) return '';
    const parts = sentence.split(/(;\s+|\s+·\s+)/),
      cut = parts.findIndex((part, i) => i % 2 === 0 && this.staged.test(part));
    if (cut < 0) return sentence;
    return cut
      ? parts
          .slice(0, cut - 1)
          .join('')
          .replace(/[\s.,·:]*$/, '.')
      : '';
  },
  reference(bib) {
    const journal = bib.slice(4, 9).replace(/\./g, ''),
      volume = bib.slice(9, 13).replace(/\./g, ''),
      mark = /[LA\d]/.test(bib[13]) ? bib[13] : '',
      page = bib.slice(14, 18).replace(/\./g, ''),
      label =
        journal === 'yCat'
          ? 'каталог VizieR' +
            (/^[1-9]\d{3}$/.test(volume)
              ? ' ' +
                ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][volume[0] - 1] +
                '/' +
                Number(volume.slice(1))
              : '')
          : (this.journals[journal] || SkyGuide.escape(journal)) +
            (journal === 'ApJ' && mark === 'L' ? ' Letters' : '') +
            (volume ? ', т. ' + volume : '') +
            (page ? ', с. ' + mark + page : '');
    return (
      '<a href="https://ui.adsabs.harvard.edu/abs/' +
      encodeURIComponent(bib) +
      '/abstract" target="_blank" rel="noopener">' +
      label +
      ' (' +
      bib.slice(0, 4) +
      ') ↗</a>'
    );
  },
  clean(sentence) {
    const derived = 'Размер рассчитан из угловых размеров каталога OpenNGC и принятого расстояния.';
    return String(sentence || '')
      .replace(
        new RegExp(
          'Литературн(?:ое расстояние|ая оценка SIMBAD):\\s*(.*?);\\s*(?=' +
            this.bibcode.source +
            ')',
        ),
        (_, method) => {
          const known = this.methods[method.trim().toLocaleLowerCase('en')];
          return (
            (known
              ? 'Метод: ' + known + '. '
              : /unspecified/i.test(method)
                ? ''
                : method.trim().replace(/[.\s]*$/, '. ')) + 'Источник оценки: '
          );
        },
      )
      .replace(this.bibcode, (bib) => this.reference(bib))
      .replace(/(<\/a>)\.$/, '$1')
      .replace(/; pc × \d+(?:[.,]\d+)?/, '; парсеки пересчитаны в световые годы')
      .replace(/\s*\\pm\s*/g, ' ± ')
      .replace(/\\geq\s*/g, '≥ ')
      .replace(/\\leq\s*/g, '≤ ')
      .replace(/\\gtrsim\s*/g, '≳ ')
      .replace(/\^\{\+?([^}]*)\}_\{-?([^}]*)\}/g, ' +$1/−$2')
      .replace(/Решение I\/311 HIP2007/, 'Параллакс Hipparcos, редукция 2007 года')
      .replace(/Решение SIMBAD matched parallax/, 'Параллакс из SIMBAD')
      .replace(
        /^Каталожная оптическая область ≈[\d.,\s×]+св\. лет: угловые оси OpenNGC и принятое расстояние\.?$/,
        derived,
      )
      .replace(/^Оптические оси ≈[\d.,\s×]+св\. лет; угловые размеры OpenNGC\.?$/, derived)
      .replace(/^Угловые размеры OpenNGC\.?$/, derived)
      .replace(/^(?:Иерархия опубликованных компонентов|Компонент опубликованной системы)\.?$/, '')
      .replace(/^J2000(?:\.|\s+·)?\s*(?=[А-ЯЁ]|$)/, '');
  },
  topic(sentence) {
    const text = this.plain(sentence);
    return this.topics.find(([, test]) => test.test(text))?.[0] || '';
  },
  tip(label, notes, text = '') {
    const body = (notes || []).filter(Boolean),
      all = this.plain(label + ' ' + text + ' ' + body.join(' '));
    for (const [test, entry] of this.glossary) {
      const found = test.exec(all);
      if (found) body.push(typeof entry === 'function' ? entry(found) : entry);
    }
    return body.length
      ? '<details class="info-tip"><summary aria-label="Справка: ' +
          SkyGuide.escape(this.plain(label)) +
          '"><span aria-hidden="true">i</span></summary><div class="info-pop">' +
          body.map((part) => '<p>' + part + '</p>').join('') +
          '</div></details>'
      : '';
  },
  parse(text) {
    text = String(text || '').trim();
    if (!this.measured.test(text)) return null;
    const cut = text.indexOf(' · ');
    return cut < 0
      ? { value: text, note: '' }
      : { value: text.slice(0, cut), note: text.slice(cut + 3) };
  },
  span(n) {
    return n >= 1000
      ? distanceText(n)
      : Number(n.toPrecision(3)).toLocaleString('ru-RU') + ' св. лет';
  },
  distance(o) {
    if (o.kind === 'home') return { value: '8,3 св. мин', note: 'от Земли' };
    if (o.atlasOnly || !Number.isFinite(o.d)) return { reason: 'Надёжная дальность неизвестна.' };
    return {
      value: distanceText(o.d),
      note: o.coordinateAnchor
        ? 'до опорной звезды от Солнца'
        : o.cosmology
          ? 'от Солнца · свет шёл ≈ ' + compact(o.cosmology.lookbackYears) + ' лет'
          : 'от Солнца',
      info: [
        o.cosmology
          ? 'Современное сопутствующее расстояние: где объект находится сейчас, с учётом расширения Вселенной. Свет шёл меньше, ≈ ' +
            compact(o.cosmology.lookbackYears) +
            ' лет: пока он был в пути, пространство растягивалось.'
          : '',
        o.coordinateAnchor
          ? 'Компоненты группы находятся на собственных расстояниях; расстояние группы принято по опорной звезде ' +
            o.coordinateAnchor +
            '.'
          : '',
      ],
    };
  },
  size(o) {
    const f = o.facts || {},
      g = o.galaxy,
      r = o.region;
    if (g?.diameterLy > 0)
      return {
        value: '≈ ' + this.span(g.diameterLy),
        note: 'оптический диаметр',
        info: [
          g.axisRatio > 0 && g.axisRatio < 0.98
            ? 'Оптические оси, как они видны с Земли: ' +
              distanceText(g.diameterLy) +
              ' × ' +
              distanceText(g.diameterLy * g.axisRatio) +
              '.'
            : '',
        ],
      };
    const own = this.parse(f.radius);
    if (own) return { ...own, source: 'radius' };
    if (
      r &&
      !r.sizeUnknown &&
      Number.isFinite(r.major) &&
      r.major > 0 &&
      !globalThis.MapGeometry?.unlocated(o)
    ) {
      const oval = r.mapSizeDerived && r.minor > 0 && Math.abs(r.major - r.minor) > r.major * 0.02;
      return {
        value:
          '≈ ' +
          (oval ? this.span(r.major).replace(' св. лет', '') + ' × ' : '') +
          this.span(oval ? r.minor : r.major),
        note:
          {
            'half-light': 'диаметр области половины света',
            'half-number': 'диаметр области с половиной звёзд',
            optical: oval ? 'оптические оси' : 'оптический диаметр',
            diameter: 'каталожный диаметр',
          }[r.sizeKind] ||
          (['ribbon', 'arc', 'polyline'].includes(r.shape) ? 'длина' : 'поперечник'),
        info: [
          {
            'half-light': 'Внутри этой области излучается половина видимого света объекта.',
            'half-number': 'Внутри этой области находится половина звёзд объекта.',
          }[r.sizeKind],
        ],
      };
    }
    return {
      reason:
        globalThis.StellarClusters?.is(o) && !r
          ? o.atlasOnly
            ? 'Объект доступен только в поиске; масштабный контур на карте не строится.'
            : 'Индивидуальный физический размер неизвестен. Точка обозначает положение; её диаметр на экране условный.'
          : f.radius ||
            (o.kind === 'nebula' && !r
              ? 'Индивидуальный размер в исходной выборке не приведён.'
              : ''),
    };
  },
  mass(o) {
    const text = o.facts?.mass,
      found = this.parse(text);
    if (!found) return { reason: text || '' };
    const wide = /^(\d[\d\s]*\d)\s*(?:[+±][^M]*)?M☉$/.exec(found.value),
      amount = wide ? Number(wide[1].replace(/\s/g, '')) : 0,
      rounded = /^≈/.test(found.value) || amount >= 1e5 ? ['Значение округлено.'] : [];
    if (amount < 1e5) return { ...found, info: rounded };
    const ranged = /[+±]/.test(found.value);
    return {
      value: '≈ ' + quantity(amount) + ' M☉',
      note: found.note || (ranged ? 'измерение с погрешностью' : ''),
      info: [...rounded, ranged ? 'Полная запись: ' + text.replace(/[\s.]*$/, '') + '.' : ''],
    };
  },
  luminosity(o) {
    const f = o.facts || {},
      band = f.band || 'V',
      own = 'Светимость — собственное излучение объекта, а не его видимая яркость с Земли. ';
    if (Number.isFinite(f.lum))
      return {
        value: '≈ ' + quantity(f.lum) + ' L☉',
        note: 'во всех диапазонах',
        info: [
          own +
            'Здесь — болометрическая: излучение во всех диапазонах. Значение округлено. В ваттах — ≈ ' +
            quantity(f.lum * Astro.solarLuminosity) +
            ' Вт.',
        ],
      };
    if (f.visual)
      return {
        value: '≈ ' + quantity(f.visual.solarV) + ' L☉,' + band,
        note: 'только в полосе ' + band,
        banded: true,
        info: [
          own +
            'Здесь — только в полосе ' +
            band +
            ': рассчитана из каталожной фотометрии и расстояния, M = m − 5 log₁₀(d/10 пк), L = 10⁰·⁴⁽ᴹ☉⁻ᴹ⁾ L☉,' +
            band +
            '. Абсолютная величина объекта M = ' +
            fmt(f.visual.absoluteV, 1).replace('-', '−') +
            ' mag. Без поправки на поглощение пылью; это приблизительная оценка, не полная болометрическая мощность.',
        ],
      };
    return { reason: f.lumUnknown || '' };
  },
  direction(o) {
    if (SkyGuide.hasDirection(o)) return [o.raDeg, o.decDeg];
    if (
      o.synthetic ||
      o.atlasOnly ||
      o.arrivalAnchor ||
      o.navigable === false ||
      !o.p3?.every(Number.isFinite) ||
      !(Math.hypot(...o.p3) > 0)
    )
      return null;
    const [x, y, z] = Space.matrix[0].map((_, i) =>
      Space.matrix.reduce((sum, line, j) => sum + line[i] * o.p3[j], 0),
    );
    return [
      ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
      (Math.asin(z / Math.hypot(x, y, z)) * 180) / Math.PI,
    ];
  },
  sky(o) {
    if (o.kind === 'home') return { value: 'Зодиак', note: 'за год Солнце обходит эклиптику' };
    const direction = this.direction(o),
      code = direction ? SkyGuide.constellation(...direction) : null,
      c = code ? SKY_GUIDE_DATA.constellations[code] : null;
    if (!c) return { reason: '' };
    const seen = SkyGuide.observing(o),
      v = SkyGuide.magnitude(o),
      text = seen
        ? seen.text
        : v !== null
          ? 'нужна оптика'
          : ['structure', 'wall', 'void', 'ring', 'arc'].includes(o.kind) ||
              (o.kind === 'cluster' && !globalThis.StellarClusters?.is(o))
            ? 'направление на центр области'
            : '';
    return {
      value: c.name,
      note: [
        text ? text[0].toLocaleLowerCase('ru') + text.slice(1) : '',
        v === null
          ? ''
          : 'V\u00a0' + v.toLocaleString('ru-RU', { maximumFractionDigits: 2 }).replace('-', '−'),
      ]
        .filter(Boolean)
        .join(' · '),
      info: [
        'Латинское название — ' + c.latin + ', сокращение ' + code + '.',
        v === null
          ? ''
          : 'V — видимая звёздная величина: яркость объекта на земном небе. Чем меньше число, тем ярче; невооружённым глазом под тёмным небом видны объекты примерно до 6.',
        ...SkyGuide.observingNotes(o),
      ],
    };
  },
  years(myr, digits = 2) {
    const billions = myr >= 1000;
    return [
      Number((billions ? myr / 1000 : myr).toPrecision(digits)).toLocaleString('ru-RU', {
        maximumFractionDigits: 2,
      }),
      billions ? 'млрд' : 'млн',
    ];
  },
  age(o) {
    const a = !state.destroyed.includes(o.id) && MapDetails.age(o);
    if (!a) return null;
    const bounded = a.upper > 0,
      half = (a.upper - a.lower) / 2,
      wide = bounded && ((half >= 1000 && half / a.age >= 0.25) || a.age < a.lower || a.age > a.upper),
      [value, unit] = this.years(a.age, a.digits),
      [low, lowUnit] = this.years(a.lower),
      [high, highUnit] = this.years(a.upper),
      same = lowUnit === highUnit;
    return {
      value:
        (wide
          ? 'от ' + low + (same ? '' : ' ' + lowUnit) + ' до ' + high + ' ' + highUnit + ' лет'
          : '≈ ' +
            value +
            ' ' +
            unit +
            ' лет' +
            (bounded
              ? ' (' +
                (same
                  ? low + '–' + high + (highUnit === unit ? '' : ' ' + highUnit)
                  : low + ' ' + lowUnit + ' – ' + high + ' ' + highUnit) +
                ')'
              : '')) + ' · на начало полёта',
      info: [
        a.source.method,
        wide
          ? 'Интервал шире миллиарда лет и четверти самой оценки или не включает её: метод не различает возраст этой звезды, поэтому показаны только границы.'
          : '',
        a.models === 1 ? 'Оценка получена по одному набору изохрон; её разброс неизвестен.' : '',
        a.composite
          ? 'Фотометрия источника включает несколько компонентов системы: оценка относится к их общему свету.'
          : '',
        'Возраст отнесён к началу полёта: за время экспедиции по земным часам звезда становится старше на столько же.',
      ],
      link: [a.source.url, 'Возраст · ' + a.source.label],
    };
  },
  type(o) {
    const text = MapDetails.classText(o),
      cut = text.indexOf(' · '),
      head = cut < 0 ? text : text.slice(0, cut),
      subtype = MapDetails.subtype(o),
      capital = subtype && subtype[0].toLocaleUpperCase('ru') + subtype.slice(1),
      spectral = MapDetails.spectralClass(o);
    if (spectral) {
      const info = [
        'Спектральный класс ' +
          spectral +
          ': буква и цифра — температура поверхности, от горячих O и B к холодным K и M; римская цифра — класс светимости: I — сверхгиганты, II — яркие гиганты, III — гиганты, IV — субгиганты, V — карлики главной последовательности.',
        subtype
          ? 'Название типа выведено из этого класса' +
            (/I[-–/]|V[-–/]|I[ab]+[-–/]/.test(spectral)
              ? '; в классе указаны две ступени светимости, тип назван по первой.'
              : '.')
          : '',
      ];
      if (subtype && /^(?:именованная )?звезда$/i.test(head))
        return / |карлик|гигант/.test(subtype)
          ? { value: capital, note: spectral, info }
          : { value: spectral, note: subtype + ' звезда', info };
      return cut < 0
        ? { value: text, note: '', info }
        : { value: head, note: text.slice(cut + 3), info };
    }
    if (o.kind === 'galaxy' && subtype && head === 'Галактика')
      return {
        value: capital,
        note: o.hubbleType,
        info: [
          'Морфологический тип ' +
            o.hubbleType +
            ' по классификации Хаббла — де Вокулёра из исходного каталога: E — эллиптические, S0 — линзовидные, S — спиральные (SB — с перемычкой, SAB — со слабой перемычкой), I — неправильные.',
        ],
      };
    return cut < 0 ? { value: text, note: '' } : { value: head, note: text.slice(cut + 3) };
  },
  keys(o) {
    return [
      ['Расстояние', this.distance(o)],
      ['Размер', this.size(o)],
      ['Масса', this.mass(o)],
      ['Светимость', this.luminosity(o)],
      ['Класс', this.type(o)],
      ['Созвездие', this.sky(o)],
    ];
  },
  estimate(reason) {
    return /\d[^.;]*(?:M☉|R☉|L☉|св\. |км)/.test(String(reason || ''));
  },
  missing(reason) {
    return this.estimate(reason)
      ? 'нет измерения; ориентир — в справке'
      : this.plain(reason).trim() || 'нет данных';
  },
  keysHTML(keys) {
    return (
      '<dl class="object-key-facts">' +
      keys
        .map(
          ([label, fact]) =>
            '<div class="object-key' +
            (fact.value ? '' : ' is-missing') +
            '"><dt>' +
            label +
            (fact.value
              ? this.tip(label, fact.info, fact.value + ' ' + (fact.note || ''))
              : this.estimate(fact.reason)
                ? this.tip(label, [fact.reason])
                : '') +
            '</dt><dd>' +
            (fact.value
              ? fact.value +
                (fact.note
                  ? '<small>' +
                    (fact.note.length > 24
                      ? fact.note.replace(/^[А-ЯЁ](?=[а-яё])/, (c) => c.toLocaleLowerCase('ru'))
                      : fact.note) +
                    '</small>'
                  : '')
              : '<span title="' + SkyGuide.escape(this.missing(fact.reason)) + '">—</span>') +
            '</dd></div>',
        )
        .join('') +
      '</dl>'
    );
  },
};
function showObject(id = state.selected) {
  const o = object(id);
  if (!o) return;
  const f = o.facts || {},
    g = o.galaxy,
    chartable = SkyGuide.canChart(o),
    system = ExtendedCatalog.systemByMember.get(o.id),
    keys = ObjectCard.keys(o),
    fact = Object.fromEntries(keys),
    band = f.band || 'V',
    seen = new Set(),
    notes = { Расстояние: [], Размер: [], Масса: [], Светимость: [], Положение: [], '': [] };
  const sentences = (text) =>
    ObjectCard.split(text)
      .map((part) => ObjectCard.clean(ObjectCard.about(part)))
      .filter((part) => {
        const key = ObjectCard.plain(part)
          .toLocaleLowerCase('ru')
          .replace(/[\s.;,·↗]+$/, '');
        return key && !seen.has(key) && seen.add(key);
      });
  const fresh = (text) => sentences(text).join(' ');
  const route = (topic, text) => {
    for (const part of sentences(text)) notes[ObjectCard.topic(part) || topic].push(part);
  };
  const row = (label, value, info) =>
    value
      ? '<div class="fact-row"><dt>' +
        label +
        (info === false ? '' : ObjectCard.tip(label, info, value)) +
        '</dt><dd>' +
        value +
        '</dd></div>'
      : '';
  const list = (rows) => {
    const body = rows.join('');
    return body ? '<dl class="object-facts">' + body + '</dl>' : '';
  };
  const section = (title, body) =>
    body ? '<section class="object-section"><h3>' + title + '</h3>' + body + '</section>' : '';
  const description = MapDetails.description(o),
    designations = MapDetails.designationText(o),
    age = ObjectCard.age(o),
    lead = MapDetails.lead(o),
    story = Quests.storyHTML(o),
    explainer = MapDetails.explainer(o);
  sentences(lead);
  const componentNote = fresh(MapDetails.componentNote(o)),
    systemNote = system ? sentences(system.note) : [],
    membership = fresh(o.membershipNote),
    identification = fresh(o.identificationNote);
  route('Расстояние', o.distanceMethod || (lead ? '' : description));
  route('', o.coordinateNote);
  route('Размер', o.region?.note);
  route('', f.note);
  for (const label of ['Расстояние', 'Размер', 'Масса', 'Светимость'])
    if (fact[label].value)
      fact[label].info = [
        ...(fact[label].info || []),
        ...notes[label].filter(
          (part) =>
            !(fact[label].banded && /болометр/i.test(part)) &&
            !/^[А-ЯЁа-яё ]{0,40}≈\s*[\d\s.,×]+\s*св\. (?:лет|года)\.?$/.test(part),
        ),
      ];
    else notes[''].push(...notes[label].filter((part) => /\d/.test(ObjectCard.plain(part))));
  if (fact['Размер'].value && fact['Размер'].source !== 'radius' && f.radius)
    fact['Размер'].info = [...(fact['Размер'].info || []), fresh(f.radius)];
  const measured = f.extra && /\d/.test(ObjectCard.plain(f.extra[1])) ? f.extra : null,
    tile =
      measured &&
      ['Расстояние', 'Размер', 'Масса', 'Светимость'].find(
        (label) => measured[0].startsWith(label) && fact[label].value,
      );
  if (tile) fact[tile].info = [...(fact[tile].info || []), measured[0] + ': ' + measured[1] + '.'];
  const stray = () => notes['Положение'].splice(0);
  const told = ObjectCard.stems(lead + ' ' + story),
    orbital =
      measured && measured[0] === 'Орбита'
        ? notes[''].filter((part) => /траектори|орбит/i.test(part))
        : [];
  notes[''] = notes[''].filter((part) => !orbital.includes(part) && !ObjectCard.echoes(part, told));
  const titled = !!system && o.name.split(' · ').includes(system.name),
    makeup = measured && !tile && system && measured[0] === 'Система' ? measured[1] : '';
  const actions =
    (!o.region && (g || o.id === 'sgr')
      ? '<button class="map-size-action" id="viewGalaxy">Показать галактику в масштабе <span>↗</span></button>'
      : '') +
    (system
      ? '<button class="map-size-action" id="viewSystem">' +
        (system.associationOnly ? 'Показать компоненты группы' : 'Показать связанную систему') +
        ' ↗</button>'
      : '') +
    (o.id === 'sgr' || o.nuclearStar
      ? '<button class="map-size-action" id="viewNuclearCluster">Звёзды и орбиты у Стрельца A* ↗</button>'
      : '');
  let html =
    '<article class="object-card"><div class="modal-eyebrow">КАТАЛОГ / ' +
    MapDetails.typeLabel(o).toLocaleUpperCase('ru') +
    '</div><h2>' +
    o.name +
    '</h2>' +
    (typeof Wikipedia==='undefined' ? '' : Wikipedia.link(o)) +
    (designations ? '<p class="object-designation">' + designations + '</p>' : '') +
    (lead && !story.includes('quest-lead') ? '<p class="object-lead">' + lead + '</p>' : '') +
    story +
    stellarSkyPhoto(o) +
    ObjectCard.keysHTML(keys) +
    (explainer
      ? '<section class="object-explainer"><h3>' +
        explainer.title +
        '</h3><p>' +
        explainer.text +
        '</p></section>'
      : '') +
    (actions ? '<div class="object-actions">' + actions + '</div>' : '');
  const orbits = stellarOrbitFacts(system),
    named = !!system && !!componentNote && componentNote.includes(system.name);
  html += section(
    orbits ? 'Система и орбиты' : system || componentNote ? 'Система' : 'Состав группы',
    (componentNote
      ? '<div class="object-system-note">' +
        componentNote +
        (named ? ObjectCard.tip('Система', systemNote, componentNote) : '') +
        '</div>'
      : titled && !makeup && systemNote.length
        ? '<div class="object-system-note">' + systemNote.join(' ') + '</div>'
        : '') +
      list([
        makeup ? row('Состав', makeup, systemNote) : '',
        system && !named && !titled ? row('Связанная система', system.name, systemNote) : '',
        row('Членство', membership),
        o.opticalComponents
          ? row(
              'Компоненты оптической группы',
              o.opticalComponents
                .map(
                  (q) =>
                    q.name +
                    ': ≈ ' +
                    distanceText(q.distanceLy) +
                    ' ± ' +
                    distanceText(q.distanceErrorLy),
                )
                .join('<br>'),
            )
          : '',
      ]) +
      orbits,
  );
  const place = [],
    axes =
      'Оси от Солнца: X — к центру Галактики, Y — по направлению её вращения, Z — к северному галактическому полюсу.';
  if (o.p3)
    place.push(
      row(
        o.arrivalAnchor
          ? o.cosmicCatalog
            ? 'Каталожный ориентир XYZ'
            : 'Игровая точка XYZ'
          : 'Galactic XYZ',
        o.p3.map((v) => compact(v)).join(' / ') + ' св. лет',
        [
          o.arrivalAnchor
            ? o.cosmicCatalog
              ? 'Ориентир по наблюдаемому каталогу; протяжённая область не является компактным телом.'
              : 'Положение центра структуры не измерено: это условная точка внутри области.'
            : '',
          axes,
          ...stray(),
        ],
      ),
    );
  if (chartable)
    place.push(
      row(
        'Направление J2000',
        fmt(o.raDeg, 4) + '° / ' + fmt(o.decDeg, 4).replace('-', '−') + '°',
        [
          'Прямое восхождение и склонение — небесные аналоги долготы и широты.',
          ...stray(),
        ],
      ),
    );
  place.push(row('Отождествление', identification));
  if (o.catalogDistanceLy != null)
    place.push(
      row('Исходная каталожная дальность', distanceText(o.catalogDistanceLy), [
        'Расстояние из каталога до оценки по принадлежности к системе.',
      ]),
    );
  place.push(
    row('Опорная звезда', o.coordinateAnchor, [
      'Положение и расстояние группы приняты по этой звезде.',
    ]),
  );
  if (o.positionEstimate) {
    const e = o.positionEstimate,
      shared = Number.isFinite(e.sharedDistanceErrorLy)
        ? ' Общая погрешность дальности центра ≈ ' +
          distanceText(e.sharedDistanceErrorLy) +
          '; она коррелирована для членов системы.'
        : e.sharedDistanceNote || ' Общая систематика расстояния отдельно не оценена.';
    place.push(
      row('Локальный диапазон позиции', '≈ ' + distanceText(e.localEnvelopeLy), [
        e.envelopeMeaning + shared,
      ]),
    );
    if (e.anchor)
      place.push(
        row(
          e.method === 'bounded-compact-host' || e.method === 'cluster-membership'
            ? 'Опорное скопление'
            : 'Опорная галактика',
          object(e.anchor)?.name || e.anchorName || e.anchor,
        ),
      );
  }
  const names = ObjectCard.names(o);
  html += section(
    'Данные',
    list([
      age ? row('Возраст', age.value, age.info) : '',
      measured && !tile && !makeup
        ? row(measured[0], measured[1], orbital.length ? orbital : measured[2])
        : '',
      o.cosmology
        ? row('Красное смещение', fmt(o.redshift, 4), [
            'Показывает, насколько расширение Вселенной растянуло длину волны света в пути. Расстояние в карточке — современное сопутствующее, ≈ ' +
              distanceText(o.d) +
              '; свет шёл ≈ ' +
              compact(o.cosmology.lookbackYears) +
              ' лет — это разные величины.',
          ])
        : '',
      o.apparentV != null && !fact['Созвездие'].value
        ? row('Видимая величина V', fmt(o.apparentV, 2).replace('-', '−') + ' mag', [
            'Яркость объекта на земном небе, а не его собственная светимость.',
          ])
        : '',
      ...place,
      names.length
        ? row(
            'Обозначения',
            names.length > 8
              ? names.slice(0, 5).join(' · ') +
                  '<details><summary>Все обозначения (' +
                  names.length +
                  ')</summary>' +
                  names.join(' · ') +
                  '</details>'
              : names.join(' · '),
            false,
          )
        : '',
    ]),
  );
  const cited = new Set(),
    links = [
      ...(['alpha', 'hyg-71453', 'proxima'].includes(o.id)
        ? [
            [
              'https://www.nasa.gov/universe/chandra-scouts-nearest-star-system-for-possible-hazards/',
              'NASA · компоненты Альфы Центавра',
            ],
          ]
        : []),
      ...(f.refs || []),
      ...(o.stellarNameSource ? [[o.stellarNameSource, 'Имена и обозначения']] : []),
      ...(age ? [age.link] : []),
    ].filter(([url]) => !cited.has(url) && cited.add(url)),
    remarks = [
      [...notes[''], ...stray().filter((part) => /\d/.test(ObjectCard.plain(part)))].join(' '),
      o.atlasOnly
        ? 'Доступен в поиске: положение недостаточно точное. На карте объект не размещён.'
        : '',
    ].filter(Boolean);
  html +=
    section(
      remarks.length ? 'Источники и примечания' : 'Источники',
      remarks.map((text) => '<p class="object-note">' + text + '</p>').join('') +
        (links.length
          ? '<p class="object-sources">' +
            links
              .map(
                ([url, label]) =>
                  '<a href="' + url + '" target="_blank" rel="noopener">' + label + ' ↗</a>',
              )
              .join('') +
            '</p>'
          : ''),
    ) + '</article>';
  GameAnalytics.cardOpened(o);
  showDialog(html);
  SkyGuide.mount(o);
  Quests.mountStory(o);
  if (o.id === 'sgr' || o.nuclearStar)
    $('viewNuclearCluster').onclick = () => {
      $('infoDialog').close();
      NuclearStars.focus();
    };
  if (system) $('viewSystem').onclick = () => ExtendedCatalog.showSystem(o.id);
  if (!o.region && (g || o.id === 'sgr'))
    $('viewGalaxy').onclick = () => {
      const shape = g || GALAXIES[0];
      $('infoDialog').close();
      focusGalaxy(shape);
    };
}
document.addEventListener('click', (event) => {
  for (const tip of document.querySelectorAll('details.info-tip[open]'))
    if (!tip.contains(event.target)) tip.open = false;
});
document.addEventListener(
  'toggle',
  (event) => {
    if (event.target.open && event.target.matches?.('details.info-tip'))
      event.target.lastElementChild.scrollIntoView({ block: 'nearest' });
  },
  true,
);
$('infoDialog').addEventListener('cancel', (event) => {
  const tip = event.currentTarget.querySelector('details.info-tip[open]');
  if (!tip) return;
  event.preventDefault();
  tip.open = false;
  tip.firstElementChild.focus();
});
function focusGalaxy(g) {
  const span = g.diameterLy * Math.max(2.5, width / Math.max(cameraViewportHeight() * 0.58, 1));
  const p = MapLayout.project(g);
  goCamera(p.x, p.y, span);
  toast('Оптический контур · ' + distanceText(g.diameterLy) + ' · в масштабе карты');
}
function showJournal() {
  showDialog(
    '<div class="modal-eyebrow">' +
      SHIP_NAME.toUpperCase() +
      ' / ЖУРНАЛ</div><h2>След экспедиции.</h2><p>Исследовано ' +
      state.visited.length +
      ' из ' +
      (OBJECTS.length - 1) +
      ' точек · пройдено ' +
      distanceText(state.totalDistance) +
      ' · собрано ' +
      massText(state.captured) +
      ' · аннигилировано на ' +
      compact(state.spentEnergy / 1e15) +
      ' ПДж; отведено тепла ' +
      compact(state.heatRadiated / 1e15) +
      ' ПДж.</p>' +
      [...state.journal]
        .reverse()
        .map(
          (e) =>
            '<div class="journal-entry"><time>' +
            compact(e.t) +
            ' лет</time><p>' +
            e.text +
            '</p></div>',
        )
        .join(''),
  );
}
/* Monochrome, resolution-independent engineering chart. */
