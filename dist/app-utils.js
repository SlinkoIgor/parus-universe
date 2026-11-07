'use strict';
// Shared formatting and theme helpers. No simulation or startup work.
const $ = (id) => document.getElementById(id);
// Replacing a text node also removes the browser's selection. Reuse unchanged
// content and defer changes to selected fragments until the selection moves.
const UIContent = {
  pending: new Map(),
  htmlValues: new WeakMap(),
  text(node, value) { this.write(node, 'textContent', value); },
  html(node, value) { this.write(node, 'innerHTML', value); },
  write(node, property, value) {
    value = String(value ?? '');
    const current = node[property], cached = this.htmlValues.get(node);
    if (current === value || (property === 'innerHTML' && cached?.value === value && cached.dom === current)) {
      this.pending.delete(node);
      return;
    }
    const selection = document.getSelection?.();
    if (selection && !selection.isCollapsed) {
      for (let i = 0; i < selection.rangeCount; i++) {
        if (selection.getRangeAt(i).intersectsNode(node)) {
          this.pending.set(node, { property, value });
          return;
        }
      }
    }
    node[property] = value;
    if (property === 'innerHTML') this.htmlValues.set(node, { value, dom: node.innerHTML });
    else this.htmlValues.delete(node);
    this.pending.delete(node);
  },
  flush() {
    for (const [node, { property, value }] of this.pending) {
      if (node.isConnected === false) this.pending.delete(node);
      else this.write(node, property, value);
    }
  },
};
// Intl setup is much more expensive than formatting a value. There are only
// a handful of precisions in the UI; reuse the formatter for each precision.
const numberFormats = new Map();
const fmt = (n, d = 2) => {
  let formatter = numberFormats.get(d);
  if (!formatter) {
    formatter = new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: d,
      minimumFractionDigits: d,
    });
    numberFormats.set(d, formatter);
  }
  return formatter.format(Number(n));
};
const angleText = (n) =>
  n > 0 && n < 0.01
    ? Number(n).toLocaleString('ru-RU', { notation: 'scientific', maximumSignificantDigits: 6 })
    : fmt(n, 2);
const compact = (n) =>
  n < 0
    ? '−' + compact(-n)
    : n >= 1e9
      ? fmt(n / 1e9, n >= 1e10 ? 1 : 2) + ' млрд'
      : n >= 1e6
        ? fmt(n / 1e6, n >= 1e7 ? 1 : 2) + ' млн'
        : n >= 1e3
          ? fmt(n / 1e3, 1) + ' тыс.'
          : fmt(n, n < 100 ? 2 : 0);
const sailAreaText = (m2) => fmt(m2, 0) + ' м²';
const collectorDiameterText = (sail) => 'Ø ' + fmt(sail.collectorDiameterM, 0) + ' м';
const distanceText = (n) =>
  Number.isFinite(n) ? compact(n) + ' св. лет' : 'расстояние неизвестно';
const scaleDistanceText = (n) =>
  n < 0.001
    ? n * 63241.077 >= 0.01
      ? fmt(n * 63241.077, 2) + ' а.е.'
      : fmt((n * LY) / 1000, 0) + ' км'
    : n < 1000
      ? fmt(n, n < 1 ? 2 : 0) + ' св. лет'
      : distanceText(n);
const object = (id) => ExtendedCatalog.pinned.get(id)?.historicalStellarNavigation
  ? ExtendedCatalog.get(id)
  : MapDetails.frameObjects
    ? MapDetails.frameObjects.get(id) || ExtendedCatalog.get(id)
    : OBJECTS.find((o) => o.id === id) || ExtendedCatalog.get(id);

function objectTypeText(o) {
  return !o
    ? ''
    : (state.destroyed.includes(o.id) && o.kind === 'star'
        ? 'ОСТАТОК ЗВЕЗДЫ'
        : MapDetails.typeName(o)) +
        (MapDetails.component(o) ? ' · компонент ' + MapDetails.component(o) : '');
}
const distance = (a, b) => Space.distance(a, b);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const TIME_RATES = [0, 0.5, 1, 10, 100, 1000];
const SPEED_TICKS = [
  0, 0.09, 0.99, 0.999, 0.9999, 0.99999, 0.999999, 0.9999999, 0.99999999, 0.999999999,
];
function speedScale(beta) {
  beta = clamp(beta, 0, SPEED_TICKS.at(-1));
  const x = -Math.log1p(-beta) / Math.LN10;
  for (let i = 1; i < SPEED_TICKS.length; i++)
    if (beta <= SPEED_TICKS[i]) {
      const a = -Math.log1p(-SPEED_TICKS[i - 1]) / Math.LN10,
        b = -Math.log1p(-SPEED_TICKS[i]) / Math.LN10;
      return (i - 1 + (x - a) / (b - a)) / (SPEED_TICKS.length - 1);
    }
  return 1;
}
function clockRate() {
  if (!state.flight && !state.orbit) return 1;
  const beta = clamp(state.beta, 0, 1 - Number.EPSILON);
  if (state.phase === 'flyby' && state.flight?.encounter?.plan) {
    const p = state.flight.encounter.plan,
      q = Gravity.atProper(p, p.elapsedProper || 0),
      lapse = 1 - p.rp / (p.q * q.r);
    return clamp(lapse * Math.sqrt((1 - p.beta) * (1 + p.beta)), 0, 1);
  }
  return Math.sqrt((1 - beta) * (1 + beta));
}
function renderVelocity() {
  UIContent.html($('velocity'), speedNumber(state.beta) + '<small>% c</small>');
  $('velocity').title =
    fmt((state.beta * Rocket.c) / 1000, state.beta < 0.01 ? 3 : 1) +
    ' км/с относительно неподвижного наблюдателя';
  $('velocityFill').style.width = speedScale(state.beta) * 100 + '%';
  $('velocityBar').setAttribute('aria-valuenow', String(state.beta * 100));
  $('velocityBar').setAttribute('aria-valuetext', percentC(state.beta));
}
const DILATION_MAX = 1e6;
function dilationScale(ratio) {
  return Math.log10(clamp(ratio, 1, DILATION_MAX)) / Math.log10(DILATION_MAX);
}
function renderClockRatio() {
  const ratio = 1 / Math.max(Number.EPSILON, clockRate()),
    value = ratio === 1 ? '1' : compact(ratio);
  UIContent.text($('timeDilation'), value);
  UIContent.text($('dilationUnit'), ratio === 1 ? 'год наблюдателя' : 'лет наблюдателя');
  const position = dilationScale(ratio) * 100;
  $('dilationFill').style.width = position + '%';
  $('dilationMarker').style.left = position + '%';
  $('dilationBar').setAttribute('aria-valuenow', String(Math.min(DILATION_MAX, ratio)));
  $('dilationBar').setAttribute(
    'aria-valuetext',
    fmt(ratio, ratio < 100 ? 2 : 0) + ' лет неподвижного наблюдателя за 1 год на корабле',
  );
  $('timeDilationRow').title =
    'Мгновенное соотношение при сохранении текущей скорости' +
    (state.phase === 'flyby' ? ' и гравитационного потенциала' : '') +
    '. Наблюдатель неподвижен в принятой системе отсчёта; направление полёта не меняет соотношение. Это не задержка радиосигнала.';
}
const STORE = 'parus-expedition-v1';
const SHIP_NAME = 'Ковчег';
const G0 = 9.80665;
const speedDigits = (beta) =>
  beta >= 0.99 ? Math.min(14, Math.max(4, Math.ceil(-Math.log10(100 * (1 - beta))) + 1)) : 2;
const speedNumber = (beta) => {
  const [whole, fraction = ''] = fmt(beta * 100, speedDigits(beta)).split(',');
  return whole + ',' + fraction.replace(/0+$/, '').padEnd(2, '0');
};
const percentC = (beta) => speedNumber(beta) + ' % c';
const durationText = (years) =>
  !Number.isFinite(years)
    ? 'недостижимо'
    : years >= 1
      ? compact(years) + ' лет'
      : years >= 1 / 365.25
        ? fmt(years * 365.25, 1) + ' сут.'
        : years >= 1 / (365.25 * 24)
          ? fmt(years * 365.25 * 24, 1) + ' ч'
          : fmt(years * Rocket.year, 0) + ' с';
const massText = (tonnes) => {
  const kg = tonnes * 1000;
  return kg >= 1
    ? fmt(kg, 3) + ' кг'
    : kg >= 0.001
      ? fmt(kg * 1e3, 3) + ' г'
      : fmt(kg * 1e6, 3) + ' мг';
};
const COLOR_THEMES = {
  dark: {name:'Чёрная', bg:'#000000', ink:'#ededed', accent:'#ededed'},
  light: {name:'Белая', bg:'#f8f8f8', ink:'#252620', accent:'#252620'},
  blueprint: {name:'Blueprint', bg:'#081e39', ink:'#d2eaff', accent:'#76c9ff'},
  radar: {name:'Радар', bg:'#06100b', ink:'#bcf5c7', accent:'#63ec91'},
  amber: {name:'Янтарь', bg:'#161006', ink:'#f8ddb0', accent:'#ffb84d'},
  monokai: {name:'Monokai', bg:'#272822', ink:'#f8f8f2', accent:'#a6e22e'},
  dracula: {name:'Dracula', bg:'#282a36', ink:'#f8f8f2', accent:'#bd93f9'},
  nord: {name:'Nord', bg:'#2e3440', ink:'#eceff4', accent:'#88c0d0'},
  solarized: {name:'Solarized', bg:'#002b36', ink:'#eee8d5', accent:'#2aa198'},
};
let theme = document.documentElement.dataset.theme || 'dark';
// Include the critical colors installed in <head> before the stylesheet loads.
const darkInk = new Map(), themeProperties = new Set(['--paper', '--ink', 'color-scheme']);
function blendInk(a, b, fraction) {
  return '#' + [1,3,5].map(i => Math.round(parseInt(a.slice(i,i+2),16) * (1-fraction) + parseInt(b.slice(i,i+2),16) * fraction).toString(16).padStart(2,'0')).join('');
}
function themeInk(color) {
  const h = color.slice(1), hex = h.length === 3 ? [...h].map(c => c+c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const tone = (.2126*parseInt(hex.slice(0,2),16)+.7152*parseInt(hex.slice(2,4),16)+.0722*parseInt(hex.slice(4,6),16))/255;
  const p = COLOR_THEMES[theme];
  return blendInk(p.bg, p.ink, clamp((248/255-tone)/(248/255),0,1));
}
function applyTheme(value) {
  theme = COLOR_THEMES[value] ? value : 'dark';
  const p = COLOR_THEMES[theme], root = document.documentElement;
  root.dataset.theme = theme;
  // Reset overrides before returning to either original neutral theme.
  for (const key of themeProperties) root.style?.removeProperty(key);
  themeProperties.clear(); darkInk.clear();
  const put = (key, color) => { root.style?.setProperty(key, color); themeProperties.add(key); };
  if (theme !== 'dark' && theme !== 'light') {
    root.style?.setProperty('color-scheme', 'dark'); themeProperties.add('color-scheme');
    const tones = ['f6f6f6','c1c1c1','e3e3e3','9b9b9b','7e7e7e','eaeaea','252525','a7a7a7','e0e0e0','949494','d2d2d2','a8a8a8','bcbcbc','e6e6e6','c5c5c5','dedede','878787','858585','8b8b8b','e9e9e9','333','222','aaa','ddd','bbb','444','ccc','999','666','555','888','777'];
    for (const h of tones) put('--tone-'+h, themeInk('#'+h));
    put('--tone-f6f6f6f5', p.bg+'f5'); put('--tone-00000008', p.ink+'08');
    put('--tone-0002', '#000a'); put('--tone-2225', '#000b'); put('--tone-0001', p.ink+'11');
    put('--paper',p.bg); put('--ink',p.ink); put('--muted',blendInk(p.bg,p.ink,.65));
    put('--line',blendInk(p.bg,p.ink,.24)); put('--card-muted',blendInk(p.bg,p.ink,.7));
    put('--accent',p.accent);
  }
  $('themeBtn').setAttribute('aria-label', 'Выбрать тему · сейчас: '+p.name);
  $('themeBtn').title = 'Выбрать тему · сейчас: '+p.name;
  $('themePicker').innerHTML = Object.entries(COLOR_THEMES).map(([id,q]) => '<button data-color-theme="'+id+'" aria-pressed="'+(theme===id)+'"><i style="background:'+q.bg+';border-color:'+q.ink+';color:'+q.accent+'">●</i><span>'+q.name+'</span></button>').join('');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = p.bg;
  try { localStorage.setItem('parus-theme', theme); } catch {}
}
// Canvas and CSS use the same palette. Neutral dark retains its established inks.
function paint(color) {
  if (theme === 'light') return color;
  if (color === '#f8f8f8') return COLOR_THEMES[theme]?.bg || '#000000';
  if (color.startsWith('rgba')) {
    if (theme === 'dark') return color.replace('37,38,32', '218,218,218');
    const rgb = COLOR_THEMES[theme].ink.match(/[0-9a-f]{2}/gi).map(h => parseInt(h,16));
    return color.replace('37,38,32', rgb.join(','));
  }
  const key = theme + ':' + color, cached = darkInk.get(key);
  if (cached) return cached;
  const h = color.slice(1);
  if (!/^[0-9a-f]{3,6}$/i.test(h)) return color;
  const hex = h.length === 3 ? [...h].map(c => c+c).join('') : h;
  const value = theme === 'dark' ? '#' + [0,2,4].map(i => (255-parseInt(hex.slice(i,i+2),16)).toString(16).padStart(2,'0')).join('') : themeInk(color);
  if (darkInk.size >= 128) darkInk.clear();
  darkInk.set(key, value);
  return value;
}
