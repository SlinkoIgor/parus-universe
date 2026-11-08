'use strict';
// Only tips about explicit user actions can be learned; explanations keep their display cap.
const FlightTips = {
  minimumFlightSeconds: 20,
  startDelaySeconds: 4,
  arrivalSeconds: 4,
  minimumReadingSeconds: 10,
  maximumShows: 2,
  entries: [
    {id:'double-click', learnable:true, text:'Двойной клик запускает полёт к объекту. Если маршрут уже задан, объект становится его последней точкой. Во время полёта двойной клик добавляет следующий участок.'},
    {id:'shift-route', learnable:true, text:'Чтобы построить маршрут из нескольких точек, удерживайте Shift и выбирайте объекты на карте.'},
    {id:'black-holes', learnable:true, text:'Чёрные дыры можно использовать для гравитационных манёвров.'},
    {id:'supernova', learnable:true, text:'Для перелетов на длинные расстояния используйте "взрыв сверхновой". Звезда при этом будет уничтожена.'},
    {id:'collector', text:'Коллектор собирает свет звезды и направляет его узким пучком на парус.'},
    {id:'gas-collection', text:'Во время торможения парус собирает межзвездный газ в топливный бак.'},
    {id:'braking-refill', text:'Торможение часто занимает много времени из-за необходимости заполнить топливный бак межзвездным газом.'},
    {id:'stellar-luminosity', text:'Скорость разгона от звезды зависит от ее светимости.'},
    {id:'collector-survival', text:'Коллектор расположен в 100 а.е. от звезды. При взрыве сверхновой он фокусирует фотонный поток около 5 суток, прежде чем выброс вещества уничтожит конструкцию.'},
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
    const shown = {}, used = {};
    for (const {id, learnable} of this.entries) {
      shown[id] = Number.isFinite(progress?.shown?.[id])
        ? Math.max(0, Math.min(this.maximumShows, Math.floor(progress.shown[id]))) : 0;
      used[id] = learnable === true && progress?.used?.[id] === true;
    }
    return {shown, used};
  },
  mergeProgress(older, newer) {
    const a = this.normalize(older), b = this.normalize(newer);
    for (const {id} of this.entries) {
      b.shown[id] = Math.max(a.shown[id], b.shown[id]);
      b.used[id] ||= a.used[id];
    }
    return b;
  },
  restoreProgress(saved) {
    const p = saved.flightTips = this.normalize(saved.flightTips), f = saved.flight;
    // Infer knowledge only from actions that existing saves can actually prove.
    if ((saved.phase === 'flyby' && object(f?.target)?.kind === 'blackhole' && f?.encounter?.plan) ||
        saved.journal?.some(entry => entry.text?.startsWith('Пролёт: ')))
      p.used['black-holes'] = true;
    if (saved.destroyed?.some(id => id !== 'sol')) p.used.supernova = true;
    p.used = this.known(p.used);
    if (f?.flightTip && !this.entries.some(t => t.id === f.flightTip.id && p.shown[t.id] > 0))
      delete f.flightTip;
  },
  use(id,{persistNow=true}={}) {
    if (!this.entries.some(t => t.id === id && t.learnable)) return;
    const p = state.flightTips;
    if (p.used[id] && this.known()[id]) return;
    p.used[id] = true;
    this.known(p.used);
    if (this.current?.tip?.id === id && $('toast').dataset.kind === 'tip')
      $('toast').hidden = true;
    if(persistNow)persist();
  },
  noteLaunch() {
    state.flight.noticeElapsed = 0;
  },
  elapsed(f) {
    if (!f) return 0;
    if (Number.isFinite(f.noticeElapsed) && f.noticeElapsed >= 0) return f.noticeElapsed;
    // Older saves have no presentation clock. Infer their progress once from
    // physical time; subsequent updates record active real seconds across rates.
    const proper = f.missionElapsed?.proper ??
      (Number.isFinite(f.rollback?.proper) ? Math.max(0, state.proper - f.rollback.proper) : 0);
    return Math.max(0, proper / Simulation.replayRate());
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
  pick() {
    const p = state.flightTips;
    const eligible = this.entries.filter(t => !(t.learnable && p.used[t.id]) && p.shown[t.id] < this.maximumShows);
    return eligible.length ? eligible[Math.floor(Math.random() * eligible.length)] : null;
  },
  render(estimate) {
    const f = state.flight, node = $('toast');
    if (!f) { this.clear(); return; }
    if (this.current?.flight !== f) {
      this.clear();
      this.current = {flight:f,
        tip:this.entries.find(t => t.id === f.flightTip?.id) || null, exhausted:false};
    }
    const current = this.current;
    const remaining = (estimate || FlightEstimate.get())?.proper / Simulation.replayRate();
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
    if (current.exhausted || (current.tip?.learnable && state.flightTips.used[current.tip.id])) {
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
      if (!current.tip) { current.exhausted = true; return; }
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
