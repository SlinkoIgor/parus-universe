'use strict';
// Optional, best-effort Umami events. Never serialize the game/save or block it.
const GameAnalytics = (() => {
  const STORE_KEY = 'parus-analytics-v1', OPT_OUT_KEY = 'parus-analytics-disabled';
  let config, meta, ready = false, bound = false, cardId = null, visitId;
  let visible, lastClock, lastInput, visitSeconds = 0, closed = false, errors = 0;
  const flights = new WeakMap();
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(meta)); } catch {} };
  const uuid = () => globalThis.crypto.randomUUID();
  const isId = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
  const blocked = () => [globalThis.navigator?.doNotTrack, globalThis.window?.doNotTrack]
    .some(value => value === 1 || value === '1' || value === 'yes') || globalThis.navigator?.globalPrivacyControl === true;
  const configured = () => {
    config = globalThis.PARUS_ANALYTICS_CONFIG;
    const loc = globalThis.location;
    return config?.enabled === true && loc && /^https?:$/.test(loc.protocol) &&
      config.hosts?.includes(loc.hostname) &&
      isId(config.websiteId) &&
      new URL(config.endpoint, loc.href).origin === loc.origin && typeof fetch === 'function';
  };
  function track(name, data = {}) {
    if (!ready || blocked() || read(OPT_OUT_KEY) === '1' || read('umami.disabled')) return;
    // The send API is the same API used by Umami's tracker. No external script,
    // cookies, query strings, referrer, search input, messages or save contents.
    const payload = {
      website: config.websiteId, id: meta.playerId, hostname: location.hostname,
      url: location.pathname, title: 'ПАРУС', language: navigator.language,
      ...(name ? {name, data: {
        schema_version: 1, visit_id: visitId, expedition_id: meta.expedition?.id,
        expedition_number: meta.expedition?.number, ...data,
      }} : {}),
    };
    // No automatic retries: Umami's collection endpoint is not idempotent.
    // keepalive also sends the final small events when the tab closes.
    try {
      Promise.resolve(fetch(config.endpoint, {
        method: 'POST', credentials: 'omit', keepalive: true, referrerPolicy: 'no-referrer',
        headers: {'Content-Type': 'application/json'}, body: JSON.stringify({type: 'event', payload}),
      })).catch(() => {});
    } catch {}
  }
  function totals() {
    const e = meta.expedition;
    return {
      flights_started: e.flightsStarted, flights_finished: e.flightsFinished,
      flights_cancelled: e.flightsCancelled, cards_opened: e.cardsOpened,
      theme_changes: e.themeChanges, quests_completed: e.questsCompleted,
      active_seconds: Math.round(e.activeSeconds),
    };
  }
  function beginExpedition(reason = 'open') {
    if (!ready) return;
    const existing = meta.expedition;
    if (reason !== 'reset' && existing?.number === state.expedition) {
      track('expedition_resumed', totals());
      return;
    }
    const preexisting = reason !== 'reset' && !!(state.proper || state.flight || state.visited.length > 1 || state.expedition > 1);
    meta.expedition = {
      id: uuid(), number: state.expedition, flightsStarted: 0, flightsFinished: 0,
      flightsCancelled: 0, cardsOpened: 0, themeChanges: 0, activeSeconds: 0, questsCompleted: 0,
      // Do not retrospectively report quests completed before instrumentation.
      completedQuests: Quests.store().active.filter(id => Quests.progress(Quests.quest(id)).complete),
      activeFlight: null,
    };
    save();
    track(preexisting ? 'expedition_observed' : 'expedition_started', {reason, preexisting_progress: preexisting});
  }
  const fingerprint = f => JSON.stringify([f.fromId, f.target, f.legIndex || 0, f.rollback?.proper, f.rollback?.earth]);
  function flightData(f, record) {
    return {
      flight_id: record.id, flight_number: record.number, from_id: f.fromId || 'space',
      target_id: f.requestedTarget || f.target, target_kind: object(f.target)?.kind || 'unknown',
      departure: f.departureMode || 'coast', route_leg: (f.legIndex || 0) + 1,
      route_legs: f.route?.length || 1, mode: Route.isFlyby(f) ? 'flyby' : 'stop',
      distance_ly: String(f.distance), observed_mid_flight: record.observedMidFlight,
    };
  }
  function observeFlight(restored = false) {
    if (!ready || !state.flight) return;
    const f = state.flight, e = meta.expedition, key = fingerprint(f);
    let record = flights.get(f);
    if (record) {
      if (record.key !== key) { record.key = key; save(); }
      return record;
    }
    const previous = restored && e.activeFlight?.key === key ? e.activeFlight : null;
    record = previous || {
      id: uuid(), key, number: restored ? null : ++e.flightsStarted,
      observedMidFlight: restored, finished: false,
    };
    flights.set(f, record);
    e.activeFlight = record;
    save();
    track(restored ? 'flight_resumed' : 'flight_started', flightData(f, record));
    if (!restored && !meta.played) {
      meta.played = true;
      save();
      track('play_started');
    }
    return record;
  }
  function flightFinished(f, outcome) {
    if (!ready || !f) return;
    const record = flights.get(f) || (state.flight === f && observeFlight(true));
    if (!record || record.finished) return;
    record.finished = true;
    meta.expedition.flightsFinished++;
    save();
    track('flight_finished', {
      ...flightData(f, record),
      outcome: outcome || (Route.isFlyby(f) ? 'flyby' : 'arrived'),
      flights_in_expedition: meta.expedition.flightsStarted,
    });
  }
  function flightCancelled(reason = 'cancel') {
    if (!ready || !state.flight) return;
    const record = flights.get(state.flight) || observeFlight(true);
    if (!record || record.finished) return;
    record.finished = true;
    meta.expedition.flightsCancelled++;
    save();
    track('flight_cancelled', {...flightData(state.flight, record), reason});
  }
  function endExpedition() {
    if (!ready) return;
    pulse();
    flightCancelled('reset');
    track('expedition_ended', {...totals(), reason: 'reset'});
  }
  function cardOpened(o) {
    if (!ready || ($('infoDialog').open && cardId === o.id)) return;
    cardId = o.id;
    meta.expedition.cardsOpened++;
    save();
    track('object_card_opened', {object_id: o.id, object_kind: o.kind, in_flight: !!state.flight});
  }
  function themeChanged(from, to) {
    if (!ready || from === to) return;
    meta.expedition.themeChanges++;
    save();
    track('theme_changed', {from_theme: from, to_theme: to});
  }
  function questProgress(quest, progress, steps = []) {
    if (!ready) return;
    const data = {quest_id: quest.id, steps_done: progress.done, steps_total: progress.total};
    if (steps.length) track('quest_progress', {...data, new_steps: steps.length});
    if (progress.complete && !meta.expedition.completedQuests.includes(quest.id)) {
      meta.expedition.completedQuests.push(quest.id);
      meta.expedition.questsCompleted++;
      save();
      track('quest_completed', data);
    }
  }
  function pulse() {
    if (!ready) return;
    const now = Date.now(), end = !paused && state.flight ? now : Math.min(now, lastInput + 60000);
    const seconds = visible ? Math.max(0, Math.min(45, (end - lastClock) / 1000)) : 0;
    lastClock = now;
    if (seconds < 1) return;
    visitSeconds += seconds;
    meta.expedition.activeSeconds += seconds;
    save();
    track('active_time', {seconds: Math.round(seconds)});
  }
  function start() {
    if (ready || !configured()) return;
    const setting = $('analyticsSetting'), toggle = $('analyticsToggle');
    setting.hidden = false;
    toggle.checked = !blocked() && read(OPT_OUT_KEY) !== '1' && !read('umami.disabled');
    toggle.disabled = blocked();
    toggle.onchange = safe(() => {
      try { localStorage.setItem(OPT_OUT_KEY, toggle.checked ? '0' : '1'); } catch {}
      if (toggle.checked) start();
      else { ready = false; }
    });
    if (!toggle.checked) return;
    let saved;
    try { saved = JSON.parse(read(STORE_KEY)); } catch {}
    const returning = isId(saved?.playerId);
    meta = returning ? saved : {playerId: uuid(), played: false};
    const e = meta.expedition;
    if (e && !(isId(e.id) && Number.isInteger(e.number) && e.number > 0 &&
      ['flightsStarted', 'flightsFinished', 'flightsCancelled', 'cardsOpened', 'themeChanges', 'activeSeconds', 'questsCompleted']
        .every(key => Number.isFinite(e[key]) && e[key] >= 0) &&
      Array.isArray(e.completedQuests) && e.completedQuests.every(id => typeof id === 'string')))
      delete meta.expedition;
    visitId = uuid();
    visitSeconds = 0; closed = false;
    visible = !document.hidden;
    lastInput = lastClock = Date.now();
    ready = true;
    beginExpedition();
    track(); // Umami pageview with the same persistent identity from the start.
    track('game_opened', {returning, theme, in_flight: !!state.flight});
    observeFlight(true);
    if (bound) return;
    bound = true;
    for (const event of ['pointerdown', 'keydown', 'wheel'])
      document.addEventListener(event, () => { lastInput = Date.now(); }, {passive: true});
    document.addEventListener('visibilitychange', () => {
      pulse(); visible = !document.hidden; lastClock = Date.now();
    });
    window.addEventListener('pagehide', () => {
      if (!ready || closed) return;
      pulse(); closed = true;
      track('session_summary', {...totals(), visit_active_seconds: Math.round(visitSeconds), theme});
    });
    window.addEventListener('pageshow', () => { closed = false; lastClock = Date.now(); });
    window.addEventListener('error', event => {
      if (!ready || errors++ >= 5 || !event.error) return;
      track('runtime_error', {error_type: event.error.name || 'Error'});
    });
    setInterval(safe(pulse), 30000);
  }
  // Analytics storage, configuration and transport failures never affect play.
  function safe(fn) { return (...args) => { try { return fn(...args); } catch {} }; }
  return Object.fromEntries(Object.entries({
    start, track, beginExpedition, endExpedition, observeFlight, flightFinished,
    flightCancelled, cardOpened, themeChanged, questProgress,
  }).map(([name, fn]) => [name, safe(fn)]));
})();
