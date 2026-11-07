'use strict';
// Catalogue search, object cards and informational dialogs.
function toast(text, duration = 4200) {
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), duration);
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
        ? ' · ТОЛЬКО АТЛАС'
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
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const o = await ExtendedCatalog.resolve(entry);
        const picking = Route.picking;
        select(o.id);
        closeCatalog();
        ExtendedCatalog.focus(o);
        if (picking) {
          Route.add(o.id);
          Route.show();
        }
      } catch (e) {
        toast(e.message);
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
    limit = ExtendedCatalog.searchLimit;
  const exact = (o) =>
    !!term &&
    [
      o.name,
      o.id,
      ...(o.aliases || []),
      o.ngc || '',
      'HIP ' + (o.hip || ''),
      'HD ' + (o.hd || ''),
    ].some((v) => MapDetails.searchKey(v) === term);
  const core = [...OBJECTS, ...ExtendedCatalog.pinned.values()]
    .filter(
      (o) =>
        !o.streamed &&
        ExtendedCatalog.matches(o.kind, searchFilter, o) &&
        MapDetails.searchKey(
          `${o.name} ${(o.aliases || []).join(' ')} ${o.type} ${MapDetails.typeName(o)} ${o.id} ${o.ngc || ''} ${o.hip || ''} ${o.hd || ''} ${o.gliese || ''}`,
        ).includes(term),
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
  ExtendedCatalog.search(term, searchFilter, limit)
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
function showMenuPage(page = 'home', focus = false) {
  document.querySelectorAll('[data-menu-page]').forEach((panel) => {
    panel.hidden = panel.dataset.menuPage !== page;
  });
  $('libraryBtn').setAttribute('aria-expanded', String(page === 'library'));
  $('settingsBtn').setAttribute('aria-expanded', String(page === 'settings'));
  $('menu').scrollTop = 0;
  if (focus) $('menu').querySelector('[data-menu-page]:not([hidden]) button').focus();
}
function closeMenu() {
  const restoreFocus = document.activeElement?.closest('#menu');
  $('menu').hidden = true;
  $('menuBtn').setAttribute('aria-expanded', 'false');
  showMenuPage();
  if (restoreFocus) $('menuBtn').focus();
}
function openCatalog() {
  MapFilters.close();
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
  if (restoreFocus) $('catalogBtn').focus();
  Route.picking = false;
}
function showDialog(html) {
  ExtendedCatalog.systemViewRequest++;
  MapFilters.close();
  closeMenu();
  $('dialogContent').innerHTML = html;
  $('infoDialog').showModal();
}
function showHelp() {
  showDialog(
    '<div class="modal-eyebrow">' +
      SHIP_NAME.toUpperCase() +
      ' / ПОЛЁТ</div><h2>Свет, топливо и остановка.</h2><p>Выберите собственную тягу, постоянный свет звезды через зеркало Ø 100 км либо вспышку через то же зеркало. Вспышка длится 30 суток по часам звезды; постоянный свет действует на всём участке разгона. Звезда уничтожается только в режиме вспышки. Для Солнца этот режим запрещён.</p><p>По умолчанию сухая масса — 1 кг, включая парус Si₃N₄ Ø 100 м массой 0,785 кг. Бак — 1 кг. Световой разгон сохраняет топливо, его масса учитывается. Парус и обратная тяга совместно тормозят корабль, собирая и расходуя вещество. Остаток бака не является условием миссии и показывается в прогнозе. По умолчанию пределы разгона и торможения — 10 g; их можно изменить в параметрах корабля.</p><p>На 1× секунда игрока равна году на борту. Вертикальная шкала темпа под масштабом: 0 — пауза, 0,5× / 1× / 10× / 100× / 1000× — скорость симуляции. На 0,5× секунда игрока равна половине бортового года. Пробел — пауза; колесо — масштаб карты; перетаскивание — перемещение.</p><button class="modal-start" id="startExploring">Продолжить →</button>',
  );
  $('startExploring').onclick = () => $('infoDialog').close();
}

function showModel() {
  const star = object(state.current) || object(state.flight?.fromId),
    light = Stellar.stellarLight(star);
  const c = FlightSetup.read();
  showDialog(
    '<div class="modal-eyebrow">ФИЗИКА / МОДЕЛЬ</div><h2>Парус Ø ' +
      fmt(c.sailDiameterM, 0) +
      ' м.<br>Коллектор Ø ' +
      fmt(c.collectorDiameterM / 1000, 2) +
      ' км.</h2><p>Сухая масса ' +
      fmt(c.dryMassKg, 3) +
      ' кг; бак ' +
      fmt(c.capacityKg, 3) +
      ' кг. Геометрия паруса и полная сухая масса задаются независимо. Каркас, прочность и нагрев плёнки отдельно не рассчитаны.</p><h3>Разгон</h3><p>Фотонный двигатель: эффективность ' +
      fmt(c.engineEfficiencyPercent, 1) +
      '%, предельная мощность ' +
      (c.enginePowerW / 1e12).toLocaleString('ru-RU', { maximumSignificantDigits: 6 }) +
      ' ТВт. Импульс учитывает потери: Δη = ε ln(Mнач/Mкон). Неиспользованная энергия уходит изотропным тепловым излучением в системе корабля.</p><p>Парус: отражение ' +
      fmt(c.reflectivityPercent, 1) +
      '%, давление F = (1 + R) P/c · exp(−2η). Коллектор передаёт ' +
      fmt(c.opticalEfficiencyPercent, 1) +
      '% собранной мощности. ' +
      (c.diffraction ? 'Дифракция круглой апертуры включена. ' : 'Дифракция отключена. ') +
      'Добавочная расходимость ' +
      angleText(c.divergenceDeg) +
      '°. ' +
      (c.diffraction
        ? 'Нулевой добавочный угол сохраняет дифракцию.'
        : 'При нулевом угле весь собранный свет достигает паруса.') +
      ' Это оптимистическая модель наведения; конечный угловой размер звезды и étendue не рассчитаны.</p><p>Светимость источника ' +
      quantity(light.watts) +
      ' Вт; ' +
      light.basis +
      '. Вспышка: ' +
      quantity(c.burstLuminosityW) +
      ' Вт, ' +
      fmt(c.burstDays, 2) +
      ' суток по часам источника. При выборе вспышки с коллектором корабль сначала разгоняется обычным светом до 0,97 c, затем со сложенным парусом ожидает её фотоны; подготовка и ожидание включены в прогноз. Это выбранная скорость встречи, дальнейший разгон не ограничен ею. При вспышке выброс со скоростью 30 000 км/с разрушает коллектор; прекращается отправка нового света, а уже отправленные фотоны продолжают разгон. Скорость выброса — принятый сценарий, нагрев коллектора не рассчитан. Запаздывание догоняющих фотонов учитывается. Начало светового разгона требует звезды; Солнце взрывать нельзя.</p><h3>Торможение</h3><p>Газовый парус и обратная тяга действуют совместно. Плотность ' +
      fmt(c.densityCm3, 3) +
      ' атом/см³ — единое игровое допущение. Пределы: разгон ' +
      fmt(c.maxAccelerationG, 2) +
      ' g, торможение ' +
      fmt(c.maxBrakingG, 2) +
      ' g. Переработка газа и охлаждение идеализированы. Все эти значения меняются в параметрах среды и корабля.</p><h3>Орбитальное движение</h3><p>Планеты, связанные S-звёзды, Альфа Центавра и ближайшие кратные звёзды с опубликованными орбитами движутся по кеплеровым орбитам по часам внешнего наблюдателя. Гиперболическая S111 неподвижна. Взаимные возмущения, прецессия и перехват движущейся цели не рассчитываются: навигация использует опорные каталожные координаты.</p>',
  );
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
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const {curve} of curves) {
    // Both map modes use an affine local orbital frame. Recover the exact
    // projected ellipse from three eccentric anomalies, including its offset.
    const a = curve.pointAt(0), b = curve.pointAt(Math.PI), d = curve.pointAt(Math.PI / 2),
      c = {x:(a.x+b.x)/2, y:(a.y+b.y)/2},
      rx = Math.hypot((a.x-b.x)/2, d.x-c.x), ry = Math.hypot((a.y-b.y)/2, d.y-c.y);
    box[0] = Math.min(box[0], c.x-rx);box[1] = Math.min(box[1], c.y-ry);
    box[2] = Math.max(box[2], c.x+rx);box[3] = Math.max(box[3], c.y+ry);
  }
  return {box, anchor:object(curves[0].id)};
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
  // A complete system cannot be restricted to one physical depth slab.
  if (MapSlice.mode === 'slice') MapSlice.setMode('full');
  MapSlice.focus(bounds.anchor);
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
  const span = Math.max(.00006, (b[2]-b[0])*width/(v.right-v.left)*1.25,
    (b[3]-b[1])*width/(v.bottom-v.top)*1.25);
  goCamera((b[0]+b[2])/2-((v.left+v.right)/2-width*.43)*span/width,
    (b[1]+b[3])/2-((v.top+v.bottom)/2-mapOriginY())*span/width, span);
  return bounds;
}
function stellarSkyPhoto(o) {
  return SkyGuide.gallery(o);
}

function stellarOrbitFacts(system) {
  if (!system?.stellarEnriched) return '';
  const number = n => Number(n.toPrecision(6)).toLocaleString('ru-RU'),
    missingName = {aArcsec:'большая полуось',node:'долгота узла',omega:'аргумент периастра',peri:'эпоха периастра',inclination:'наклонение',e:'эксцентриситет',period:'период'};
  return '<div class="stellar-orbit-facts"><h3>Компоненты и орбиты</h3>' + system.pairs.map(p => {
    const q = p.orbit, partial = p.partialOrbit,
      period = q ? q.period : partial?.period ? Number(partial.period) * (partial.periodUnit === 'd' ? 1/365.25 : 1) : partial?.Per ? Number(partial.Per) * (partial.x_Per === 'd' ? 1/365.25 : 1) : null;
    let value = q ? 'P = ' + number(q.period) + ' лет · e = ' + number(q.e) + ' · a = ' + number(q.a) + ' а.е.' :
      (period ? 'P = ' + number(period) + ' лет. ' : '') + 'Полная пространственная орбита не определена' +
      (p.missingElements.some(k => missingName[k]) ? ': отсутствует ' + p.missingElements.map(k => missingName[k]).filter(Boolean).join(', ') : '') + '.';
    if(q)value += '<small>ORB6 · ' + q.reference + ' · ' + (q.grade <= 5 ? 'класс качества ' + q.grade + '/5 (1 — лучший)' : 'интерферометрическое решение') + '. ' +
      (p.massFraction === 0 ? 'Показана относительная орбита компаньона; движение главной звезды вокруг барицентра не вычисляется без отношения масс.' : 'Движение относительно общего центра масс; отношение масс взято из опубликованной модели.') + '</small>';
    return '<div class="stellar-orbit-row"><strong>' + p.primary + ' — ' + p.secondary + '</strong><span>' + value + '</span></div>';
  }).join('') + '<p class="object-note">Звёзды с известными орбитами движутся по времени внешнего наблюдателя; пауза останавливает движение. Периоды сохраняют опубликованные значения. Неизвестные элементы не заменяются нулевым эксцентриситетом или прямой линией.</p></div>';
}
function showObject(id = state.selected) {
  const o = object(id);
  if (!o) return;
  const f = o.facts,
    g = o.galaxy;
  const row = (label, value) =>
    '<div class="fact-row"><dt>' + label + '</dt><dd>' + value + '</dd></div>';
  let luminosity =
    Number.isFinite(f.lum)
      ? '≈ ' +
        quantity(f.lum) +
        ' L☉<small>Болометрическая мощность: ≈ ' +
        quantity(f.lum * Astro.solarLuminosity) +
        ' Вт</small>'
      : f.visual
        ? '≈ ' +
          quantity(f.visual.solarV) +
          ' L☉,' +
          (f.band || 'V') +
          '<small>Собственная светимость в полосе ' +
          (f.band || 'V') +
          '; абсолютная величина M' +
          (f.band || 'V') +
          ' ≈ ' +
          fmt(f.visual.absoluteV, 1) +
          ' mag</small>'
        : f.lumUnknown;
  const sizeButton = o.region
    ? '<button class="map-size-action" id="viewRegion">Показать область ↗</button>'
    : g || o.id === 'sgr'
      ? '<button class="map-size-action" id="viewGalaxy">Показать галактику в масштабе <span>↗</span></button>'
      : '';
  let html =
    '<div class="modal-eyebrow">АТЛАС / ОБ ОБЪЕКТЕ</div><h2>' +
    o.name +
    '</h2>' +
    stellarSkyPhoto(o) +
    '<div class="object-type">' +
    MapDetails.typeName(o) +
    '</div><p>' +
    MapDetails.description(o) +
    '</p>' +
    (MapDetails.componentNote(o) ? '<p>' + MapDetails.componentNote(o) + '</p>' : '') +
    SkyGuide.finder(o) +
    sizeButton +
    '<dl class="object-facts">' +
    row('Класс', o.kind === 'blackhole' ? MapDetails.typeName(o) : f.class) +
    row('Масса', f.mass) +
    row('Светимость', luminosity);
  if (o.region)
    html += row(
      'Область',
      o.region.note +
        '<small>' +
        (o.region.shape === 'polyline'
          ? 'Проекция опубликованной оси; не все расстояния в объёме сохраняются.'
          : 'Форма и ориентация приблизительны; проекция на плоскость не сохраняет все расстояния в объёме.') +
        '</small>',
    );
  if (StellarClusters.is(o) && !o.region)
    html += row(
      'Размер',
      o.atlasOnly
        ? 'Объект доступен только в атласе; масштабный контур на карте не строится.'
        : 'Индивидуальный физический размер неизвестен. Точка обозначает положение; её диаметр на экране условный.',
    );
  if (o.kind === 'nebula')
    html += row(
      'Значок туманности',
      o.region
        ? 'Условный знак из дуг обозначает положение и тип объекта; его размер на экране условный. Масштабный контур появляется при приближении.'
        : o.atlasOnly
          ? 'Масштабный контур недоступен без пригодного расстояния.'
          : 'Индивидуальный размер в исходной выборке не приведён. Условный знак из дуг обозначает положение; его размер на экране условный.',
    );
  if (o.ngc) html += row('Каталог NGC / IC', o.ngc.replace(/^(NGC|IC)0*(\d+)/, '$1 $2'));
  if (o.cosmology)
    html += row(
      'Красное смещение',
      fmt(o.redshift, 4) +
        '<small>Расстояние на карте — современное сопутствующее, ≈ ' +
        distanceText(o.d) +
        '. Свет шёл ≈ ' +
        compact(o.cosmology.lookbackYears) +
        ' лет; это разные величины.</small>',
    );
  if (o.apparentV != null)
    html += row(
      'Видимая величина V',
      fmt(o.apparentV, 2) +
        ' mag<small>Яркость с Земли: чем меньше число, тем ярче. Не абсолютная светимость.</small>',
    );
  if (o.iauNames?.length) html += row('Имена IAU', o.iauNames.join(', '));
  if (o.aliases?.length) html += row('Другие обозначения', o.aliases.length>8 ?
    o.aliases.slice(0,5).join(' · ')+'<details><summary>Все обозначения ('+o.aliases.length+')</summary>'+o.aliases.join(' · ')+'</details>' : o.aliases.join(' · '));
  if (g)
    html += row(
      'Оптический размер',
      distanceText(g.diameterLy) +
        ' × ' +
        distanceText(g.diameterLy * g.axisRatio) +
        '<small>Наблюдаемые с Земли оптические оси. Проекция на карту рассчитывается отдельно.</small>',
    );
  if (globalThis.MapGeometry?.unlocated(o)) html += row('Геометрия карты', 'В текущем каталоге нет пространственной привязки области. Прежний условный контур скрыт; измеренная форма не восстановлена. Сохранённая игровая точка не является измеренным центром объекта.');
  else if (globalThis.MapGeometry?.model(o)) html += row('Геометрия карты', MapGeometry.model(o).note);
  else if (o.region?.sizeUnknown) html += row('Геометрия карты', 'Измеренная граница и размер области в текущем каталоге отсутствуют. Показана только опорная точка; прежний иллюстративный контур скрыт.');
  else if (f.radius) html += row('Размер', f.radius);
  if (f.extra) html += row(...f.extra);
  if (o.p3) {
    html +=
      row(
        o.arrivalAnchor
          ? o.cosmicCatalog
            ? 'Каталожный ориентир XYZ'
            : 'Игровая точка XYZ'
          : 'Galactic XYZ',
        o.p3.map((v) => compact(v)).join(' / ') +
          ' св. лет<small>' +
          (o.arrivalAnchor
            ? o.cosmicCatalog
              ? 'Ориентир по наблюдаемому каталогу; протяжённая область не является компактным телом'
              : 'Игровой ориентир для полёта; положение центра структуры не измерено'
            : 'Физические координаты относительно Солнца; не координаты схемы') +
          '</small>',
      ) +
      row(
        'Глубина Zg',
        distanceText(o.p3[2]) +
          '<small>Координата вне плоскости карты, относительно Солнца</small>',
      );
    if (o.raDeg !== undefined)
      html += row(
        'Направление J2000',
        fmt(o.raDeg, 4) +
          '° / ' +
          fmt(o.decDeg, 4) +
          '°<small>Прямое восхождение / склонение</small>',
      );
  }
  if (!o.p3 && Number.isFinite(o.raDeg))
    html += row('Направление J2000', fmt(o.raDeg, 4) + '° / ' + fmt(o.decDeg, 4) + '°');
  if (o.catalogDistanceLy != null)
    html += row(
      'Исходная каталожная дальность',
      distanceText(o.catalogDistanceLy) +
        '<small>До оценки по принадлежности к системе; не используется в текущем маршруте</small>',
    );
  if (o.gravity) html += row('Модель пролёта', o.gravity.note);
  if (o.coordinateNote) html += row('Координаты', o.coordinateNote);
  if (globalThis.MapRadial?.active())
    html += row(
      'На радиальной карте',
      OrbitalMotion.isOrbiting(o)
        ? 'Орбитальная система перенесена целиком. Внутренние орбиты и движение сохранены в проекции XY; индивидуальные дальности компонентов от Солнца могут немного отличаться от радиусов на карте.'
        : MapRadial.explain(o).text +
            '<small>' +
            MapRadial.explain(o)
              .chain.map((p) => MapRadial.resolve(p.id)?.name || p.id)
              .join(' → ') +
            '</small>',
    );
  else if (o.mapOffset?.some((v) => Math.abs(v) > 1e-6))
    html += row(
      'На схеме',
      'Положение условно смещено для отделения внеплоскостных объектов от оптического диска Млечного Пути. Это не граница принадлежности к Галактике; расстояния рассчитаны по физическим 3D-координатам.',
    );
  if (o.positionEstimate) {
    const e = o.positionEstimate,
      shared = Number.isFinite(e.sharedDistanceErrorLy)
        ? ' Общая погрешность дальности центра ≈ ' +
          distanceText(e.sharedDistanceErrorLy) +
          '; она коррелирована для членов системы.'
        : e.sharedDistanceNote || ' Общая систематика расстояния отдельно не оценена.';
    html += row(
      'Локальный диапазон позиции',
      '≈ ' + distanceText(e.localEnvelopeLy) + '<small>' + e.envelopeMeaning + shared + '</small>',
    );
    if (e.anchor)
      html += row(
        e.method === 'bounded-compact-host' ? 'Опорное скопление' : 'Опорная галактика',
        object(e.anchor)?.name || e.anchorName || e.anchor,
      );
  }
  if (o.membershipNote) html += row('Членство', o.membershipNote);
  const system = ExtendedCatalog.systemByMember.get(o.id);
  if (system) html += row('Связанная система', system.name + '<small>' + system.note + '</small>');
  html +=
    row('От Солнца', o.atlasOnly ? 'Надёжная дальность неизвестна' : distanceText(o.d)) + '</dl>';
  html += stellarOrbitFacts(system);
  if(o.stellarNameSource)html += '<p class="object-sources"><a href="'+o.stellarNameSource+'" target="_blank" rel="noopener">Источник имени и обозначений ↗</a></p>';
  if (ExtendedCatalog.systemByMember.has(o.id))
    html +=
      '<button class="map-size-action" id="viewSystem">' +
      (system.associationOnly ? 'Показать компоненты группы' : 'Показать связанную систему') + ' ↗</button>';
  if (o.id === 'sgr' || o.nuclearStar)
    html +=
      '<button class="map-size-action" id="viewNuclearCluster">Звёзды и орбиты у Стрельца A* ↗</button>';
  if (o.atlasOnly)
    html +=
      '<p class="object-note">Только атлас: положение недостаточно точное. На карте объект не размещён.</p>';
  html +=
    '<p class="object-note">Оценки округлены. M☉ — масса Солнца; L☉ — его полная светимость, L☉,V и L☉,B — светимость Солнца в соответствующей полосе. Это собственное излучение, а не видимая яркость с Земли.</p>';
  if (f.visual)
    html +=
      '<p class="object-note">Полосовая светимость рассчитана из каталожной фотометрии и расстояния атласа: M = m − 5 log₁₀(d/10 пк), L/L☉ = 10⁰·⁴⁽ᴹ☉⁻ᴹ⁾. Без поправки на поглощение пылью; это приблизительная оценка, не полная болометрическая мощность.</p>';
  if (['alpha','hyg-71453','proxima'].includes(o.id))
    html +=
      '<p class="object-sources"><a href="https://www.nasa.gov/universe/chandra-scouts-nearest-star-system-for-possible-hazards/" target="_blank" rel="noopener">NASA · компоненты Альфы Центавра ↗</a></p>';
  if (f.note) html += '<p class="object-note">' + f.note + '</p>';
  html +=
    '<p class="object-sources">' +
    f.refs
      .map(
        ([url, label]) =>
          '<a href="' + url + '" target="_blank" rel="noopener">' + label + ' ↗</a>',
      )
      .join('') +
    '</p>';
  showDialog(html);
  SkyGuide.mount(o);
  if (o.id === 'sgr' || o.nuclearStar)
    $('viewNuclearCluster').onclick = () => {
      $('infoDialog').close();
      NuclearStars.focus();
    };
  if (ExtendedCatalog.systemByMember.has(o.id))
    $('viewSystem').onclick = () => ExtendedCatalog.showSystem(o.id);
  if (o.region)
    $('viewRegion').onclick = () => {
      $('infoDialog').close();
      RegionMap.focus(o);
    };
  if (g || o.id === 'sgr')
    $('viewGalaxy').onclick = () => {
      const shape = g || GALAXIES[0];
      $('infoDialog').close();
      focusGalaxy(shape);
    };
}
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
