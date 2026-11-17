'use strict';
const Quests = {
  view: null,
  opened: false,
  isOpen: false,
  focus: null,
  pending: null,
  presenting: false,
  autoPaused: false,
  panelKey: null,
  badge: null,
  announced: null,
  story: null,
  esc(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  },
  blank() {
    return {active: [], seen: {}, credited: {}};
  },
  normalize(saved) {
    const known = new Set(QUESTS.map(q => q.id)),
      keys = new Set(QUESTS.flatMap(q => q.steps.map(s => this.key(q, s)))),
      flags = source => Object.fromEntries(
        Object.keys(source && typeof source === 'object' ? source : {})
          .filter(k => keys.has(k) && source[k] === true).map(k => [k, true]));
    return {
      active: [...new Set(Array.isArray(saved?.active) ? saved.active : [])].filter(id => known.has(id)),
      seen: flags(saved?.seen),
      credited: flags(saved?.credited),
    };
  },
  restore(saved) {
    saved.quests = this.normalize(saved.quests);
  },
  reset() {
    this.focus = this.pending = this.panelKey = this.announced = this.story = null;
    this.view = null;
    this.opened = this.autoPaused = false;
  },
  store() {
    return (state.quests ||= this.blank());
  },
  quest(id) {
    return QUESTS.find(q => q.id === id) || null;
  },
  ids(step) {
    return step.accept ? [step.id, ...step.accept] : [step.id];
  },
  key(quest, step) {
    return quest.id + '/' + step.id;
  },
  name(step) {
    return step.name || object(step.id)?.name || step.id;
  },
  visitedSet() {
    return new Set(state.visited);
  },
  done(step, visited = this.visitedSet()) {
    return this.ids(step).some(id => visited.has(id));
  },
  progress(quest, visited = this.visitedSet()) {
    const done = quest.steps.filter(step => this.done(step, visited)).length;
    return {done, total: quest.steps.length, complete: done === quest.steps.length};
  },
  isActive(quest) {
    return this.store().active.includes(quest.id);
  },
  flightIds(f = state.flight) {
    return f ? [f.target, f.requestedTarget].filter(Boolean) : [];
  },
  routeIds() {
    return Route.future().map(n => n.id);
  },
  unlocked(step, visited = this.visitedSet()) {
    const flying = this.flightIds();
    return this.done(step, visited) || this.ids(step).some(id => flying.includes(id));
  },
  entries(id) {
    const active = this.store().active, flying = this.flightIds().includes(id), found = [];
    for (const quest of QUESTS) {
      if (!active.includes(quest.id) && quest.id !== this.focus && !flying) continue;
      const index = quest.steps.findIndex(step => this.ids(step).includes(id));
      if (index >= 0) found.push({quest, step: quest.steps[index], index});
    }
    return found;
  },
  ordered() {
    const active = this.store().active;
    return [...active.map(id => this.quest(id)).filter(Boolean), ...QUESTS.filter(quest => !active.includes(quest.id))];
  },
  nextTarget() {
    if (state.flight || state.itinerary.length || !state.current || state.selected !== state.current) return null;
    const store = this.store();
    if (!store.active.length) return null;
    const visited = this.visitedSet(), active = store.active.map(id => this.quest(id)).filter(Boolean),
      here = active.filter(quest => quest.steps.some(step => this.ids(step).includes(state.current)));
    for (const quest of [...here, ...active]) {
      const step = this.next(quest, visited);
      if (step && object(step.id)?.navigable) return {quest, step};
    }
    return null;
  },
  next(quest, visited = this.visitedSet()) {
    const busy = new Set([...this.flightIds(), ...this.routeIds()]);
    return quest.steps.find(step => !this.done(step, visited) && !this.ids(step).some(id => busy.has(id))) || null;
  },
  start(id) {
    const quest = this.quest(id), store = this.store();
    if (!quest || store.active.includes(id)) return false;
    const visited = this.visitedSet();
    store.active.push(id);
    for (const step of quest.steps) if (this.done(step, visited)) store.credited[this.key(quest, step)] = true;
    log('Квест начат: ' + quest.title + '.');
    persist();
    return true;
  },
  sync() {
    const store = this.store();
    if (!store.active.length && !Object.keys(store.credited).length) return;
    const visited = this.visitedSet();
    for (const quest of QUESTS) {
      const active = store.active.includes(quest.id), fresh = [];
      for (const step of quest.steps) {
        const key = this.key(quest, step);
        if (!active || !this.done(step, visited)) {
          delete store.credited[key];
          continue;
        }
        if (store.credited[key]) continue;
        store.credited[key] = true;
        fresh.push(step);
      }
      if (fresh.length) this.credit(quest, fresh, visited);
    }
  },
  credit(quest, steps, visited) {
    const p = this.progress(quest, visited),
      step = steps.find(s => this.ids(s).includes(state.current)) || steps.at(-1),
      ids = this.ids(step), here = ids.includes(state.current),
      id = here ? state.current : ids.find(x => visited.has(x)) || step.id;
    for (const s of steps) log('Квест «' + quest.title + '»: ' + this.name(s) + ' · ' + p.done + ' из ' + p.total + '.');
    if (p.complete) log('Квест пройден: ' + quest.title + '.');
    if ((here || !state.flight) && !this.store().seen[this.key(quest, step)]) {
      this.pending = id;
      return;
    }
    toast(
      p.complete
        ? 'Квест «' + quest.title + '» пройден.'
        : 'Квест «' + quest.title + '»: ' + this.name(step) + ' · ' + p.done + ' из ' + p.total + '.',
      9000, 'quest', {label: 'Открыть', run: () => this.read(id, quest.id)});
  },
  flightStory(f = state.flight) {
    if (!f) return null;
    const store = this.store(), flying = this.flightIds(f);
    for (const quest of this.ordered()) {
      const index = quest.steps.findIndex(step => this.ids(step).some(x => flying.includes(x)));
      if (index < 0) continue;
      const step = quest.steps[index];
      if (store.seen[this.key(quest, step)] || this.done(step)) continue;
      return {quest, step, index, id: this.ids(step).find(x => flying.includes(x))};
    }
    return null;
  },
  announce(story) {
    if (this.announced?.story.step !== story.step || this.announced.story.id !== story.id)
      this.announced = {story, action: {label: 'Читать', run: () => this.read(story.id, story.quest.id)}};
    Notices.render('Квест «' + story.quest.title + '»\n' + this.name(story.step) + '. ' + story.step.title + '.',
      'quest', 'quest', this.announced.action);
  },
  read(id, questId) {
    const quest = this.quest(questId), step = quest?.steps.find(s => this.ids(s).includes(id)),
      visited = this.visitedSet(), flying = this.flightIds(),
      shown = step
        ? this.ids(step).find(x => flying.includes(x)) || (visited.has(id) ? id : this.ids(step).find(x => visited.has(x))) || step.id
        : id;
    if (!object(shown)) return false;
    this.focus = quest?.id || null;
    showObject(shown);
    return true;
  },
  show(id) {
    const o = object(id);
    if (!o) return;
    select(id);
    ExtendedCatalog.focus(o);
  },
  fly(id, questId) {
    const target = object(id);
    if (!target?.navigable) {
      toast('Для этого объекта нет точных координат.', 4200, 'warning');
      return false;
    }
    if (questId) this.start(questId);
    $('infoDialog').close();
    if (!state.flight && state.current === id) return false;
    if (state.selected !== id) select(id);
    if (state.flight) {
      const added = Route.add(id, {mode: 'stop'});
      if (added) toast('Добавлена точка «' + target.name + '».', 4200, 'route');
      this.renderPanel(true);
      return added;
    }
    if (state.itinerary.length && state.itinerary.at(-1).id !== id && !Route.add(id, {mode: 'stop'})) return false;
    Route.cancelFeedback();
    launchSelectedTarget();
    if (!state.flight) {
      Route.flushFeedback();
      return false;
    }
    this.close();
    return true;
  },
  present() {
    const id = this.pending;
    if (!id || zenMode || $('infoDialog').open || $('flightBuilder').open) return false;
    this.pending = null;
    if (!object(id)) return false;
    if (state.flight && !paused) {
      syncClock();
      paused = true;
      this.autoPaused = true;
      persist();
    }
    showObject(id);
    return true;
  },
  dialogClosed() {
    this.focus = this.story = null;
    if (!this.autoPaused) return;
    this.autoPaused = false;
    if (!paused) return;
    syncClock();
    paused = false;
    renderUI();
    persist();
  },
  storyActions(quest, visited) {
    const esc = this.esc, p = this.progress(quest, visited);
    let html = '';
    if (!this.isActive(quest))
      html += '<button class="modal-start" data-quest-start="' + quest.id + '">Начать квест →</button>';
    else if (!p.complete) {
      const next = this.next(quest, visited);
      if (next)
        html += '<button class="modal-start" data-quest-fly="' + esc(next.id) + '" data-quest="' + quest.id + '">' +
          (state.flight ? 'Затем: ' + esc(this.name(next)) + ' · в маршрут +' : 'Лететь дальше: ' + esc(this.name(next)) + ' →') + '</button>';
      else html += '<p class="quest-note">Оставшиеся объекты квеста уже в маршруте.</p>';
    }
    return html + '<button class="text-action" data-quest-panel="' + quest.id + '">Все объекты квеста · ' + p.done + ' из ' + p.total + '</button>';
  },
  storyHTML(o) {
    const entries = this.entries(o.id);
    if (!entries.length) return '';
    const esc = this.esc, visited = this.visitedSet(), open = entries.filter(({step}) => this.unlocked(step, visited)),
      step = open[0]?.step;
    let story = '<p class="quest-lead">Этот объект входит в квест. Его история откроется в полёте к нему.</p>';
    if (step) {
      const refs = step.refs?.length
        ? '<p class="object-sources">' + step.refs.map(([url, label]) =>
          '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + ' ↗</a>').join('') + '</p>'
        : '';
      story = '<h3>' + esc(step.title) + '</h3>' +
        '<p class="quest-lead">' + esc(step.lead) + '</p>' +
        (step.more?.length
          ? '<details class="quest-more"><summary>Подробнее</summary>' +
            step.more.map(text => '<p class="quest-lead">' + esc(text) + '</p>').join('') + refs + '</details>'
          : refs);
    }
    return '<section class="quest-story' + (step ? '' : ' is-locked') + '">' + story + entries.map(entry => {
      const {quest, index} = entry, p = this.progress(quest, visited), unlocked = open.includes(entry);
      return '<div class="quest-membership"><div class="modal-eyebrow">КВЕСТ · ' + esc(quest.title.toUpperCase()) + ' · ' +
        (index + 1) + ' / ' + p.total + '</div>' +
        (unlocked && p.complete ? '<p class="quest-outro"><b>Квест пройден.</b> ' + esc(quest.outro || '') + '</p>' : '') +
        (unlocked
          ? '<div class="quest-story-actions" data-quest-actions="' + quest.id + '">' + this.storyActions(quest, visited) + '</div>'
          : '<div class="quest-story-actions"><button class="text-action" data-quest-panel="' + quest.id + '">Все объекты квеста · ' +
            p.done + ' из ' + p.total + '</button></div>') + '</div>';
    }).join('') + '</section>';
  },
  storyKey() {
    return [state.flight ? 1 : 0, state.current, state.visited.length, ...this.flightIds(), '/', ...this.routeIds()].join('|');
  },
  mountStory(o) {
    const entries = this.entries(o.id);
    this.story = null;
    if (!entries.length) return;
    const store = this.store(), visited = this.visitedSet();
    let changed = false;
    for (const {quest, step} of entries) {
      const key = this.key(quest, step);
      if (store.seen[key] || !this.unlocked(step, visited)) continue;
      store.seen[key] = changed = true;
    }
    if (changed) persist();
    this.story = {id: o.id, key: this.storyKey()};
    this.bindStory(o);
  },
  refreshStory() {
    const story = this.story;
    if (!story || !$('infoDialog').open) return;
    const key = this.storyKey();
    if (key === story.key) return;
    story.key = key;
    const o = object(story.id), visited = this.visitedSet();
    if (!o) return;
    for (const node of $('dialogContent').querySelectorAll('[data-quest-actions]')) {
      const quest = this.quest(node.dataset.questActions);
      if (quest) node.innerHTML = this.storyActions(quest, visited);
    }
    this.bindStory(o);
  },
  bindStory(o) {
    for (const button of $('dialogContent').querySelectorAll('.quest-story button')) {
      button.onclick = () => {
        const d = button.dataset;
        if (d.questStart) {
          this.start(d.questStart);
          showObject(o.id);
        } else if (d.questFly) this.fly(d.questFly, d.quest);
        else if (d.questPanel) {
          $('infoDialog').close();
          this.open(d.questPanel);
        }
      };
    }
  },
  stepHTML(quest, step, index, visited) {
    const esc = this.esc, o = object(step.id), ids = this.ids(step), flying = this.flightIds(), routed = this.routeIds(),
      done = this.done(step, visited), target = ids.some(id => flying.includes(id)),
      queued = !target && ids.some(id => routed.includes(id)), here = !state.flight && ids.includes(state.current),
      status = here ? 'ВЫ ЗДЕСЬ' : done ? 'ПОСЕЩЕНО' : target ? 'ЦЕЛЬ ПОЛЁТА' : queued ? 'В МАРШРУТЕ' : '',
      type = o ? MapDetails.typeName(o) : 'Объект каталога';
    let action;
    if (done || target)
      action = '<button class="quest-step-action" data-quest-read="' + esc(step.id) + '">История</button>';
    else if (queued) action = '<button class="quest-step-action" disabled>В маршруте</button>';
    else
      action = '<button class="quest-step-action" data-quest-fly="' + esc(step.id) + '"' + (o?.navigable ? '' : ' disabled') + '>' +
        (state.flight ? 'В маршрут' : 'Лететь') + '</button>';
    return '<li class="quest-step' + (done ? ' is-done' : '') + (target || here ? ' is-current' : '') + '">' +
      '<span class="quest-step-number">' + (done ? '✓' : String(index + 1).padStart(2, '0')) + '</span>' +
      '<button class="quest-step-name" data-quest-select="' + esc(step.id) + '"' + (o ? '' : ' disabled') + '>' +
      '<strong>' + esc(this.name(step)) + '</strong><small>' + esc(type) +
      (status ? ' · ' + status : '') + (here ? '' : ' · <span data-quest-distance="' + esc(step.id) + '">' + esc(this.distance(o)) + '</span>') +
      '</small></button>' + action + '</li>';
  },
  distance(o) {
    return o?.navigable ? distanceText(Cosmology.physicalDistance(state.ship, o)) : 'расстояние неизвестно';
  },
  statusText(quest, p) {
    const active = this.isActive(quest);
    return (p.complete && active ? 'ПРОЙДЕН' : active ? 'АКТИВЕН' : 'НЕ НАЧАТ') + ' · ' + p.done + ' / ' + p.total;
  },
  progressHTML(p) {
    return '<span class="quest-progress" role="img" aria-label="Посещено ' + p.done + ' из ' + p.total + '"><i style="width:' +
      (p.total ? 100 * p.done / p.total : 0) + '%"></i></span>';
  },
  detailHTML(quest, visited) {
    const esc = this.esc, p = this.progress(quest, visited), active = this.isActive(quest), next = this.next(quest, visited);
    let actions;
    if (!active) actions = '<button class="modal-start" data-quest-start="' + quest.id + '">Начать квест →</button>';
    else if (p.complete) actions = '<p class="quest-note"><b>Квест пройден.</b> ' + esc(quest.outro || '') + '</p>';
    else
      actions = (next
        ? '<button class="modal-start" data-quest-fly="' + esc(next.id) + '">' +
          (state.flight ? 'Затем: ' + esc(this.name(next)) + ' · в маршрут +' : (p.done ? 'Лететь дальше: ' : 'Лететь: ') + esc(this.name(next)) + ' →') + '</button>'
        : '<p class="quest-note">Оставшиеся объекты уже в маршруте.</p>');
    return '<button class="text-action quest-back" data-quest-back>← Все квесты</button>' +
      '<div class="quest-status">' + this.statusText(quest, p) + '</div>' +
      '<h3 class="quest-title">' + esc(quest.title) + '</h3>' + this.progressHTML(p) +
      quest.intro.map(text => '<p class="quest-text">' + esc(text) + '</p>').join('') +
      '<div class="quest-actions">' + actions + '</div>' +
      '<ol class="quest-steps">' + quest.steps.map((step, index) => this.stepHTML(quest, step, index, visited)).join('') + '</ol>';
  },
  listHTML(visited) {
    const esc = this.esc;
    return '<p class="quest-text">Путешествия по Вселенной. Начните квест — его объекты засчитываются при прибытии, каким бы путём вы до них ни добрались. Можно вести несколько квестов одновременно.</p>' +
      QUESTS.map(quest => {
        const p = this.progress(quest, visited), active = this.isActive(quest);
        return '<button class="quest-card' + (active ? ' is-active' : '') + '" data-quest-open="' + quest.id + '">' +
          '<span class="quest-status">' + this.statusText(quest, p) + '</span>' +
          '<strong>' + esc(quest.title) + '</strong><span class="quest-card-summary">' + esc(quest.summary) + '</span>' +
          this.progressHTML(p) + '</button>';
      }).join('');
  },
  renderPanel(force = false) {
    if (!this.isOpen) return;
    const quest = this.quest(this.view), visited = this.visitedSet(), store = this.store(),
      key = JSON.stringify([quest?.id || null, store.active, QUESTS.map(q => q.steps.map(s => Number(this.done(s, visited)))),
        state.current, this.flightIds(), this.routeIds(), !!state.flight]);
    if (force || key !== this.panelKey) {
      this.panelKey = key;
      $('questsBody').innerHTML = quest ? this.detailHTML(quest, visited) : this.listHTML(visited);
      return;
    }
    for (const node of $('questsBody').querySelectorAll('[data-quest-distance]')) {
      const text = this.distance(object(node.dataset.questDistance));
      if (node.textContent !== text) node.textContent = text;
    }
  },
  renderBadge() {
    const store = this.store(), visited = this.visitedSet(),
      count = store.active.filter(id => this.quest(id) && !this.progress(this.quest(id), visited).complete).length;
    if (count === this.badge) return;
    this.badge = count;
    $('questCount').textContent = String(count);
    $('questCount').hidden = !count;
    $('questBtn').classList.toggle('has-quests', count > 0);
    const label = 'Квесты' + (count ? ' · активных: ' + count : '');
    $('questBtn').title = label;
    $('questBtn').setAttribute('aria-label', label);
  },
  render() {
    this.sync();
    this.renderBadge();
    this.renderPanel();
    this.refreshStory();
    if (this.pending && !this.presenting) {
      this.presenting = true;
      setTimeout(() => {
        this.presenting = false;
        this.present();
      }, 0);
    }
  },
  panelClick(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const d = button.dataset;
    if (d.questOpen) this.view = d.questOpen;
    else if ('questBack' in d) this.view = null;
    else if (d.questStart) this.start(d.questStart);
    else if (d.questFly) {
      this.fly(d.questFly, this.view);
      return;
    } else if (d.questRead) {
      this.read(d.questRead, this.view);
      return;
    } else if (d.questSelect) {
      this.show(d.questSelect);
      return;
    } else return;
    this.renderBadge();
    this.renderPanel(true);
    $('questsBody').scrollTop = 0;
  },
  open(questId) {
    closeCatalog();
    closeMenu();
    MapFilters.close();
    $('themePicker').hidden = true;
    $('themeBtn').setAttribute('aria-expanded', 'false');
    if (questId !== undefined) this.view = this.quest(questId)?.id || null;
    else if (!this.opened) this.view = this.store().active[0] || null;
    this.opened = this.isOpen = true;
    $('quests').hidden = false;
    $('questBtn').setAttribute('aria-expanded', 'true');
    this.renderPanel(true);
    $('closeQuests').focus({preventScroll: true});
  },
  close() {
    if (!this.isOpen) return;
    const restoreFocus = document.activeElement?.closest?.('#quests');
    this.isOpen = false;
    $('quests').hidden = true;
    $('questBtn').setAttribute('aria-expanded', 'false');
    if (restoreFocus) $('questBtn').focus({preventScroll: true});
  },
  draw() {
    const active = this.store().active;
    if (!active.length) return;
    const visited = this.visitedSet(), viewHeight = zenMode ? height : cameraViewportHeight(),
      ink = paint('#171717'), paper = paint('#f8f8f8'), drawn = new Set();
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.lineJoin = ctx.lineCap = 'round';
    for (const id of active) {
      for (const step of this.quest(id)?.steps || []) {
        if (drawn.has(step.id) || this.done(step, visited)) continue;
        drawn.add(step.id);
        const o = object(step.id);
        if (!o?.p3?.every(Number.isFinite) || o.atlasOnly || MapGeometry.unlocated(o)) continue;
        const p = screen(o);
        if (!(p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= viewHeight)) continue;
        const x = p.x + 6, y = p.y - 6;
        for (const [color, lineWidth] of [[paper, 4.5], [ink, 1.5]]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - 16);
          ctx.lineTo(x + 10, y - 12);
          ctx.lineTo(x, y - 8);
          ctx.stroke();
        }
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.moveTo(x, y - 16);
        ctx.lineTo(x + 10, y - 12);
        ctx.lineTo(x, y - 8);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  },
  setup() {
    $('quests').hidden = true;
    $('questBtn').onclick = () => (this.isOpen ? this.close() : this.open());
    $('closeQuests').onclick = () => this.close();
    $('questsBody').onclick = event => this.panelClick(event);
    $('quests').onkeydown = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      this.close();
    };
    $('infoDialog').addEventListener('close', () => this.dialogClosed());
    $('mapFilterBtn').addEventListener('click', () => this.close());
    $('toast').onclick = () => Notices.run();
    this.renderBadge();
  },
};
globalThis.Quests = Quests;
