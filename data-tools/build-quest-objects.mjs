import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readMapCatalog} from './map-radial-catalog.mjs';

const MARATHON_START = 'm87';
const messierNumber = o => {
  const text = String(o.messier ?? '').replace(/^0+(?=\d)/, '');
  return /^(?:[1-9]|[1-9]\d|10\d|110)$/.test(text) ? Number(text) : null;
};
const marathonName = o => {
  const code = 'M' + messierNumber(o),
    words = o.name.split(' · ').filter(part => /[А-Яа-яЁё]/.test(part) && !/M\s?\d/.test(part));
  return words.length ? code + ' · ' + words[0] : code;
};
const distance = (a, b) => Math.hypot(a.p3[0] - b.p3[0], a.p3[1] - b.p3[1], a.p3[2] - b.p3[2]);
const pathLength = path => path.slice(1).reduce((sum, o, i) => sum + distance(path[i], o), 0);

function shortestPath(objects, startId) {
  const start = objects.find(o => o.id === startId), home = {p3: [0, 0, 0]};
  if (!start) throw Error('Marathon start is not a Messier object: ' + startId);
  const finish = objects.filter(o => o !== start).sort((a, b) => distance(a, home) - distance(b, home) || a.id.localeCompare(b.id))[0],
    left = objects.filter(o => o !== start && o !== finish).sort((a, b) => a.id.localeCompare(b.id)), path = [start];
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (distance(path.at(-1), left[i]) < distance(path.at(-1), left[best])) best = i;
    path.push(...left.splice(best, 1));
  }
  path.push(finish);
  const last = path.length - 1, shorter = (after, before) => after < before * (1 - 1e-12);
  for (let improved = true; improved;) {
    improved = false;
    for (let i = 1; i < last; i++) {
      for (let j = i + 1; j < last; j++) {
        const before = distance(path[i - 1], path[i]) + distance(path[j], path[j + 1]),
          after = distance(path[i - 1], path[j]) + distance(path[i], path[j + 1]);
        if (!shorter(after, before)) continue;
        path.splice(i, j - i + 1, ...path.slice(i, j + 1).reverse());
        improved = true;
      }
    }
    for (let i = 1; i < last; i++) {
      const o = path[i], gain = distance(path[i - 1], o) + distance(o, path[i + 1]) - distance(path[i - 1], path[i + 1]);
      let best = -1, bestCost = gain;
      for (let j = 0; j < last; j++) {
        if (j === i - 1 || j === i) continue;
        const cost = distance(path[j], o) + distance(o, path[j + 1]) - distance(path[j], path[j + 1]);
        if (shorter(cost, bestCost)) {
          best = j;
          bestCost = cost;
        }
      }
      if (best < 0) continue;
      path.splice(i, 1);
      path.splice(best < i ? best + 1 : best, 0, o);
      improved = true;
    }
  }
  return path;
}

export function buildQuestObjects({c, core, rows, pointer, manifest}) {
  for (const [name, files] of [['BlackHoleCatalog', ['black-hole-catalog-data', 'black-hole-catalog']], ['NuclearStars', ['nuclear-stars-data', 'nuclear-stars']]])
    if (vm.runInContext('typeof ' + name + " === 'undefined'", c))
      vm.runInContext(files.map(n => fs.readFileSync('dist/' + n + '.js', 'utf8')).join('\n'), c);
  const catalog = vm.runInContext('ExtendedCatalog', c), root = 'dist/' + pointer.dataRoot + '/',
    search = JSON.parse(fs.readFileSync(root + 'search.json', 'utf8')), files = new Map(search.map(r => [r[0], r[5]])),
    leaves = new Set(manifest.nodes.filter(n => !n.children.length).map(n => n.file)),
    extra = [...new Set(search.map(r => r[5]))].filter(file => !leaves.has(file))
      .flatMap(file => JSON.parse(fs.readFileSync(root + file, 'utf8'))),
    known = id => core.find(o => o.id === id) || catalog.coreIndex?.get(id),
    streamed = new Map([...rows, ...extra].map(row => [row[0], row])),
    find = id => known(id) || (streamed.has(id) ? catalog.decode(streamed.get(id)) : null),
    quests = data => {
      const context = vm.createContext({QUEST_OBJECTS: data});
      vm.runInContext(fs.readFileSync('dist/quests-data.js', 'utf8') + '\nglobalThis.QUESTS = QUESTS;', context);
      return context.QUESTS;
    },
    coreIds = new Set(core.map(o => o.id)), messier = new Map();
  for (const o of core) if (messierNumber(o) && !o.supersededBy && !o.atlasOnly) messier.set(o.id, o);
  for (const row of [...rows, ...extra]) {
    if (coreIds.has(row[0]) || messier.has(row[0]) || !row[11]?.messier) continue;
    const o = catalog.coreIndex?.get(row[0]) || catalog.decode(row);
    if (messierNumber(o) && !o.supersededBy && !o.atlasOnly) messier.set(o.id, o);
  }
  const objects = [...messier.values()], numbers = new Set(objects.map(messierNumber)), complete = numbers.size === 110;
  if (numbers.size !== objects.length) throw Error('Messier numbers repeat: ' + objects.length + ' objects, ' + numbers.size + ' numbers');
  if (complete) for (const o of objects)
    if (!o.navigable || !o.p3?.every(Number.isFinite)) throw Error('Messier object is not a reachable map object: ' + o.id);
  const path = complete ? shortestPath(objects, MARATHON_START) : [],
    data = {catalogRevision: manifest.revision, tiles: {}, unreachable: [], marathon: path.map(o => [o.id, marathonName(o)]),
      marathonLightYears: Math.round(pathLength(path))},
    stages = [...new Set(quests(data).flatMap(q => q.steps.map(step => step.id)))].sort();
  for (const id of stages) {
    const o = find(id);
    if (!o) throw Error('Quest stage is not in the catalogue: ' + id);
    if (!o.navigable || !o.p3?.every(Number.isFinite)) data.unreachable.push(id);
  }
  const ids = [...new Set(quests(data).flatMap(q => q.steps.flatMap(step => [step.id, ...(step.accept || [])])))].sort();
  for (const id of ids) if (!known(id) && files.has(id)) data.tiles[id] = files.get(id);
  const content = "'use strict';\nconst QUEST_OBJECTS=" + JSON.stringify(data) + ';\n',
    revision = crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
  fs.writeFileSync('dist/quest-objects-data.js', content);
  const html = fs.readFileSync('dist/index.html', 'utf8'),
    updated = html.replace(/(quest-objects-data\.js\?v=)[^" ]+/, (_, p) => p + revision);
  if (!/quest-objects-data\.js\?v=/.test(html)) throw Error('dist/index.html does not load quest-objects-data.js');
  if (updated !== html) fs.writeFileSync('dist/index.html', updated);
  return {revision, catalogRevision: data.catalogRevision, streamed: Object.keys(data.tiles).length,
    messier: objects.length, unreachable: data.unreachable, marathon: data.marathon.length, marathonLightYears: data.marathonLightYears};
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(buildQuestObjects(await readMapCatalog({supplement: true}))));
