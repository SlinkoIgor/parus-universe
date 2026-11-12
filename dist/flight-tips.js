'use strict';
// Only tips about explicit user actions can be learned; explanations keep their display cap.
const FlightTips = {
  minimumFlightSeconds: 20,
  startDelaySeconds: 4,
  arrivalSeconds: 4,
  minimumReadingSeconds: 10,
  maximumShows: 2,
  solarHorizonText: 'Корабль пересёк космологический горизонт Солнца. Вернуться к Земле уже невозможно: даже отправленный сейчас световой сигнал никогда её не достигнет.',
  entries: [
    {id:'double-click', learnable:true, text:'Двойной клик запускает полёт к объекту. Если маршрут уже задан, объект становится его последней точкой. Во время полёта двойной клик добавляет следующий участок.'},
    {id:'shift-route', learnable:true, text:'Чтобы построить маршрут из нескольких точек, удерживайте Shift и выбирайте объекты на карте.'},
    {id:'black-holes', learnable:true, after:['shift-route'], text:'Чёрные дыры можно использовать для гравитационных манёвров.'},
    {id:'supernova', learnable:true, after:['collector'], text:'Для перелетов на длинные расстояния используйте "взрыв сверхновой". Звезда при этом будет уничтожена.'},
    {id:'collector', when:'collector', text:'Коллектор собирает свет звезды и направляет его узким пучком на парус.'},
    {id:'gas-collection', when:'gas', text:'Во время торможения парус собирает межзвездный газ в топливный бак.'},
    {id:'braking-refill', when:'gas', after:['gas-collection'], text:'Торможение часто занимает много времени из-за необходимости заполнить топливный бак межзвездным газом.'},
    {id:'stellar-luminosity', when:'sail', text:'Скорость разгона от звезды зависит от ее светимости.'},
    {id:'collector-survival', after:['collector','supernova'], text:'Коллектор расположен в 100 а.е. от звезды. При взрыве сверхновой он фокусирует фотонный поток около 5 суток, прежде чем выброс вещества уничтожит конструкцию.'},
    {id:'time-dilation', text:'Чем ближе скорость полёта к скорости света, тем медленнее идут бортовые часы по сравнению с часами на Земле.'},
    {id:'time-dilation-99', after:['time-dilation'], text:'При полёте на 99% скорости света за один бортовой год на Земле проходит около 7,1 года.'},
    {id:'time-dilation-99995', after:['time-dilation-99'], text:'При полёте на 99,995% скорости света за один бортовой год на Земле проходит около ста лет.'},
    {id:'proper-time-distance', after:['time-dilation'], text:'Перелёт на сотни световых лет может занять лишь несколько бортовых лет: при околосветовой скорости время на корабле замедляется.'},
    {id:'light-speed-limit', text:'Даже непрерывный разгон не позволит кораблю достичь скорости света: для этого потребовалась бы бесконечная энергия.'},
    {id:'expanding-flight', when:'expansion', text:'Расширение Вселенной продолжается и во время полёта. Планировщик учитывает, насколько за это время успеет удалиться далёкая цель.'},
    {id:'bound-local-group', when:'expansion', after:['expanding-flight'], text:'Гравитация удерживает галактики Местной группы вместе, поэтому расширение Вселенной не меняет расстояние между ними.'},
    {id:'ancient-light', when:'expansion', after:['cosmic-horizon'], text:'Свет далёкой галактики мог отправиться к нам миллиарды лет назад. Сегодня из-за расширения Вселенной она уже может быть недостижима.'},
    {id:'cosmic-horizon', when:'expansion', after:['cosmic-chase'], text:'В начале игры радиус наблюдаемой Вселенной — 46,1 млрд световых лет, а предел достижимости даже для света — около 16,7 млрд.'},
    {id:'cosmic-chase', when:'expansion', after:['expanding-flight'], text:'Из-за расширения Вселенной корабль может не догнать далёкую галактику.'},
    {id:'superluminal-expansion', when:'expansion', after:['expanding-flight','light-speed-limit'], text:'Расширение пространства может отдалять объекты от корабля быстрее скорости света.'},
    {id:'sail-doppler', when:'sail', after:['stellar-luminosity','time-dilation'], text:'Чем быстрее парус удаляется от звезды, тем слабее его толкает свет. Из-за эффекта Доплера фотоны несут меньше энергии для корабля.'},
    {id:'beam-diffraction', after:['collector'], text:'Дифракция расширяет световой пучок коллектора даже при идеальном наведении. Поэтому вдали от коллектора часть света проходит мимо паруса.'},
    {id:'photons-in-flight', after:['collector-survival'], text:'После разрушения коллектора из-за взрыва сверхновой разгон парусом может продолжаться: ранее отправленный свет ещё находится в пути к кораблю.'},
    {id:'photon-engine', when:'engine', text:'Фотонный двигатель создаёт тягу, превращая собранное вещество в свет.'},
    {id:'flyby-course', after:['black-holes'], text:'Гравитационный манёвр у чёрной дыры позволяет повернуть к следующей цели без остановки и повторного разгона.'},
    {id:'flyby-stars', after:['flyby-course'], text:'На околосветовой скорости гравитация обычной звезды слабо изгибает путь корабля. Для сильных поворотов в игре используются чёрные дыры.'},
    {id:'flyby-angle', after:['flyby-course'], text:'Угол гравитационного поворота зависит от скорости и расстояния до чёрной дыры. Планировщик подбирает параметры сближения так, чтобы избежать области захвата.'},
  ],
  current: null,
  learned: null,
  known(used = {}) {
    if (!this.learned) {
      try { this.learned = JSON.parse(localStorage.getItem('parus-flight-tip-used')); } catch {}
      this.learned ||= {};
    }
    const previous = this.learned;
    this.learned = this.normalize({used:previous}).used;
    let changed = this.entries.some(t => previous[t.id] === true && !this.learned[t.id]);
    for (const {id, learnable} of this.entries) if (learnable && used[id] === true && !this.learned[id]) {
      this.learned[id] = true;
      changed = true;
    }
    if (changed) {
      try { localStorage.setItem('parus-flight-tip-used', JSON.stringify(this.learned)); } catch {}
    }
    return {...this.learned};
  },
  normalize(progress) {
    const shown = {}, used = {}, experienced = {};
    for (const {id, learnable} of this.entries) {
      shown[id] = Number.isFinite(progress?.shown?.[id])
        ? Math.max(0, Math.min(this.maximumShows, Math.floor(progress.shown[id]))) : 0;
      used[id] = learnable === true && progress?.used?.[id] === true;
    }
    // Keep valid saved key order: an unchanged expedition must serialize identically after reload.
    for (const id of Object.keys(progress?.experienced || {}))
      if (Object.hasOwn(shown,id) && progress.experienced[id] === true) experienced[id] = true;
    const queue = [...new Set(Array.isArray(progress?.queue) ? progress.queue : [])]
      .filter(id => Object.hasOwn(shown,id) && shown[id] < this.maximumShows && !used[id]);
    const last = Object.hasOwn(shown,progress?.last) ? progress.last : null;
    return {shown, used, experienced, queue, last, solarHorizonShown:progress?.solarHorizonShown === true};
  },
  mergeProgress(older, newer) {
    const a = this.normalize(older), b = this.normalize(newer);
    for (const {id} of this.entries) {
      b.shown[id] = Math.max(a.shown[id], b.shown[id]);
      b.used[id] ||= a.used[id];
      if (a.experienced[id]) b.experienced[id] = true;
    }
    b.solarHorizonShown ||= a.solarHorizonShown;
    return this.normalize(b);
  },
  restoreProgress(saved) {
    const legacyTopics = !saved.flightTips?.experienced;
    const p = saved.flightTips = this.normalize(saved.flightTips), f = saved.flight;
    // Infer knowledge only from actions that existing saves can actually prove.
    if ((saved.phase === 'flyby' && object(f?.target)?.kind === 'blackhole' && f?.encounter?.plan) ||
        saved.journal?.some(entry => entry.text?.startsWith('Пролёт: ')))
      p.used['black-holes'] = true;
    if (saved.destroyed?.some(id => id !== 'sol')) p.used.supernova = true;
    p.used = this.known(p.used);
    if (legacyTopics) this.observe(saved);
    if (f?.flightTip && !this.entries.some(t => t.id === f.flightTip.id && p.shown[t.id] > 0))
      delete f.flightTip;
    if (f?.flightTip && !p.last) p.last = f.flightTip.id;
  },
  use(id,{persistNow=true}={}) {
    if (!this.entries.some(t => t.id === id && t.learnable)) return;
    const p = state.flightTips;
    if (p.used[id] && this.known()[id]) return;
    p.used[id] = true;
    p.queue = p.queue.filter(queued => queued !== id);
    this.known(p.used);
    if (this.current?.tip?.id === id && $('toast').dataset.kind === 'tip')
      $('toast').hidden = true;
    if(persistNow)persist();
  },
  noteLaunch() {
    state.flight.noticeElapsed = 0;
    this.observe(state);
  },
  elapsed(f) {
    if (!f) return 0;
    if (Number.isFinite(f.noticeElapsed) && f.noticeElapsed >= 0) return f.noticeElapsed;
    // Older saves have no presentation clock. Infer their progress once from
    // physical time; subsequent updates record active real seconds across rates.
    const proper = f.missionElapsed?.proper ??
      (Number.isFinite(f.rollback?.proper) ? Math.max(0, state.proper - f.rollback.proper) : 0);
    return Math.max(0, proper / speed);
  },
  advance(f, elapsed, seconds) {
    if (f && Number.isFinite(elapsed) && Number.isFinite(seconds) && seconds >= 0)
      f.noticeElapsed = elapsed + seconds;
  },
  hide() {
    if (['tip','arrival'].includes($('toast').dataset.kind)) $('toast').hidden = true;
  },
  clear() {
    this.hide();
    this.current = null;
  },
  observe(s) {
    const p = s.flightTips, f = s.flight, c = f?.mission?.setup;
    // Familiarity unlocks explanations; it never marks an explanation as learned.
    const remember = (id, happened) => { if (happened) p.experienced[id] = true; };
    remember('shift-route', s.itinerary?.length > 1 || f?.route?.length > 1);
    remember('collector', (c?.sail && c.collector && f.mission.sourceId) || f?.wind?.collectorDiameterM > 0);
    remember('stellar-luminosity', (c?.sail && f.mission.sourceId) || f?.wind);
    remember('gas-collection', s.captured > 0);
    remember('photon-engine', c?.engine || f?.engine);
    remember('expanding-flight', f?.cosmic && s.expansion !== false);
  },
  familiar(id, p = state.flightTips) {
    return p.shown[id] > 0 || p.experienced[id] === true ||
      (this.entries.find(t => t.id === id)?.learnable === true && p.used[id] === true);
  },
  context(s = state) {
    const f = s.flight, c = f?.mission?.setup, p = s.flightTips;
    return {
      collector: p.experienced.collector === true,
      sail: p.experienced['stellar-luminosity'] === true,
      gas: p.experienced['gas-collection'] === true || (c?.brakeSail && c.collectGas !== false && c.densityCm3 > 0) ||
        (f?.magnetic?.k > 0 && !f.magnetic.noCapture),
      engine: p.experienced['photon-engine'] === true,
      expansion: s.expansion !== false,
    };
  },
  eligible(t, p = state.flightTips, context = this.context()) {
    return !(t.learnable && p.used[t.id]) && p.shown[t.id] < this.maximumShows &&
      (!t.when || context[t.when]) && (t.after || []).every(id => this.familiar(id,p));
  },
  shuffle(ids) {
    for (let i = 0; i < ids.length - 1; i++) {
      const j = i + Math.floor(Math.random() * (ids.length - i));
      [ids[i],ids[j]] = [ids[j],ids[i]];
    }
    return ids;
  },
  pick() {
    const p = state.flightTips, context = this.context();
    const eligible = this.entries.filter(t => this.eligible(t,p,context));
    if (!eligible.length) return null;
    // Newly unlocked, unseen tips take priority over a second pass.
    const minimum = Math.min(...eligible.map(t => p.shown[t.id]));
    const ids = eligible.filter(t => p.shown[t.id] === minimum).map(t => t.id);
    p.queue = p.queue.filter(id => ids.includes(id));
    const added = ids.filter(id => !p.queue.includes(id));
    if (added.length) p.queue = this.shuffle([...p.queue,...added]);
    const index = p.queue.findIndex(id => id !== p.last);
    if (index < 0) return null; // A lone remaining tip must not repeat immediately.
    const [id] = p.queue.splice(index,1);
    p.last = id;
    return this.entries.find(t => t.id === id);
  },
  beyondSolarHorizon() {
    if (state.expansion === false || !state.ship?.p3?.every(Number.isFinite)) return false;
    // Both sides use the current physical metric, including bound-group translation.
    // The projected map distance and the ship's fuel-limited range are irrelevant.
    const time = state.cosmicTime || 0, radius = Cosmology.horizon(time) * Cosmology.scale(time);
    return Math.hypot(...Cosmology.position(state.ship)) >= radius;
  },
  renderSolarHorizon() {
    const node = $('toast'), p = state.flightTips;
    if (!node.hidden && node.dataset.kind === 'solar-horizon') {
      if (p.solarHorizonShown && this.beyondSolarHorizon()) return true;
      node.hidden = true;
    }
    if (p.solarHorizonShown || !this.beyondSolarHorizon()) return false;
    // Let an existing user notice finish; retry even after arrival or on a short leg.
    if (!node.hidden && node.dataset.kind === 'notice') return false;
    p.solarHorizonShown = true;
    log(this.solarHorizonText);
    clearTimeout(toastTimer);
    Notices.render(this.solarHorizonText, 'warning', 'solar-horizon');
    toastTimer = setTimeout(() => {
      if (node.dataset.kind !== 'solar-horizon') return;
      node.hidden = true;
      this.render();
    }, 14000);
    return true;
  },
  render(estimate) {
    if (this.renderSolarHorizon()) return;
    const f = state.flight, node = $('toast');
    if (!f) { this.clear(); return; }
    this.observe(state);
    if (this.current?.flight !== f) {
      this.clear();
      this.current = {flight:f,
        tip:this.entries.find(t => t.id === f.flightTip?.id) || null};
    }
    const current = this.current;
    const remaining = (estimate || FlightEstimate.get())?.proper / speed;
    const elapsed = this.elapsed(f);
    if (remaining > 0 && remaining <= this.arrivalSeconds &&
        !f.mission?.passage && !Route.isFlyby(f) && state.phase !== 'flyby') {
      const orbit = !!f.mission?.arrival, target = object(f.target);
      clearTimeout(toastTimer);
      Notices.render((orbit ? 'Выход на орбиту: ' : 'Прибытие: ') + target.name + '.',
        orbit ? 'orbit' : 'arrival', 'arrival');
      return;
    }
    // A speed change may move the arrival window away again.
    if (node.dataset.kind === 'arrival') node.hidden = true;
    if (!(remaining > 0) || elapsed < this.startDelaySeconds ||
        !(elapsed + remaining > this.minimumFlightSeconds)) { this.hide(); return; }
    if (current.tip?.learnable && state.flightTips.used[current.tip.id]) {
      this.hide();
      return;
    }
    // Startup messages yield after four seconds. Later user notices retain
    // priority; hidden tips never spend the expedition's display quota.
    if (!node.hidden && node.dataset.kind === 'notice' &&
        Notices.context?.flight === f && Notices.context.elapsed >= this.startDelaySeconds) return;
    if (!current.tip) {
      if (paused) return;
      if (!(remaining - this.arrivalSeconds > this.minimumReadingSeconds)) return;
      current.tip = this.pick();
      if (!current.tip) return; // A later action may unlock a topic on this same leg.
      state.flightTips.shown[current.tip.id] = (state.flightTips.shown[current.tip.id] || 0) + 1;
      // This receipt survives phase transitions and reloads of the same leg.
      f.flightTip = {id:current.tip.id};
      persist();
    }
    clearTimeout(toastTimer);
    Notices.render(current.tip.text,'tip','tip');
  },
};
globalThis.FlightTips = FlightTips;
