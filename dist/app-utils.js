'use strict';
// Shared formatting and theme helpers. No simulation or startup work.
const $ = (id) => document.getElementById(id);
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
const object = (id) => OBJECTS.find((o) => o.id === id) || ExtendedCatalog.get(id);
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
  $('velocity').innerHTML = speedNumber(state.beta) + '<small>% c</small>';
  $('velocity').title =
    fmt((state.beta * Rocket.c) / 1000, state.beta < 0.01 ? 3 : 1) +
    ' км/с относительно неподвижного наблюдателя';
  $('velocityFill').style.width = speedScale(state.beta) * 100 + '%';
  $('velocityBar').setAttribute('aria-valuenow', String(state.beta * 100));
  $('velocityBar').setAttribute('aria-valuetext', percentC(state.beta));
}
const DILATION_MAX = 1e8;
function dilationScale(ratio) {
  return Math.log10(clamp(ratio, 1, DILATION_MAX)) / Math.log10(DILATION_MAX);
}
function renderClockRatio() {
  const ratio = 1 / Math.max(Number.EPSILON, clockRate()),
    value = ratio === 1 ? '1' : compact(ratio);
  $('timeDilation').textContent = value;
  $('dilationUnit').textContent = ratio === 1 ? 'год наблюдателя' : 'лет наблюдателя';
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
let theme = document.documentElement.dataset.theme || 'dark';
function applyTheme(value) {
  theme = value;
  document.documentElement.dataset.theme = value;
  const label = value === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
  $('themeBtn').setAttribute('aria-label', label);
  $('themeBtn').title = label;
  $('themeBtn').innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#theme-' +
    (value === 'dark' ? 'light' : 'dark') +
    '-icon"/></svg>';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = value === 'dark' ? '#000000' : '#f6f6f6';
  try {
    localStorage.setItem('parus-theme', value);
  } catch {}
}
// Map the existing engineering ink palette to a neutral dark drawing palette.
const darkInk = new Map();
function paint(color) {
  if (theme === 'light') return color;
  if (color === '#f8f8f8') return '#000000';
  if (color.startsWith('rgba')) return color.replace('37,38,32', '218,218,218');
  const cached = darkInk.get(color);
  if (cached) return cached;
  const h = color.slice(1);
  if (!/^[0-9a-f]{3,6}$/i.test(h)) return color;
  const hex = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const value =
    '#' +
    [0, 2, 4]
      .map((i) => (255 - parseInt(hex.slice(i, i + 2), 16)).toString(16).padStart(2, '0'))
      .join('');
  if (darkInk.size >= 128) darkInk.clear();
  darkInk.set(color, value);
  return value;
}
