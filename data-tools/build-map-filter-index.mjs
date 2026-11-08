// Presentation-only membership counts and references for complete small selections.
// Read the immutable catalogue; never rewrite source rows, coordinates or tiles.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {buildCatalogRegistry} from './build-catalog-registry.mjs';

const {c,rows,core,pointer,manifest} = await buildCatalogRegistry();
vm.runInContext(['sky-guide-data','sky-photos-index','sky-photos','sky-guide','map-collection-history','map-filters']
  .map(n => fs.readFileSync('dist/'+n+'.js','utf8')).join('\n'),c);
const filters = c.MapFilters, coreIds = new Set(core.map(o => o.id));
const catalog = vm.runInContext('ExtendedCatalog',c);
const search = JSON.parse(fs.readFileSync('dist/'+pointer.dataRoot+'/search.json','utf8'));
const files = new Map(search.map(r => [r[0],r[5]]));
const buckets = new Map();
for (const row of rows) {
  if (coreIds.has(row[0])) continue;
  const o = catalog.coreIndex.get(row[0]) || catalog.decode(row);
  if (o.atlasOnly || o.supersededBy || c.MapGeometry.unlocated(o)) continue;
  const kind = filters.classOf(o);
  if (!kind) throw Error('Unclassified object: '+o.id);
  const masks = [filters.options('collections').reduce((mask,k,i)=>mask | (filters.matchesCollection(o,k)?1<<i:0),0),
    c.CatalogRegistry.memberships(o).sort()];
  const defaultHidden = filters.defaultHidden(o);
  const key = JSON.stringify([kind,...masks,defaultHidden]);
  let bucket = buckets.get(key);
  if (!bucket) buckets.set(key,bucket=[kind,...masks,0,[],defaultHidden]);
  bucket[3]++;
  const referenceLimit=Math.max(filters.limit,...filters.options('collections').map((k,i)=>
    masks[0] & (1<<i) ? filters.collectionLimits[k] || filters.limit : filters.limit));
  if (bucket[3] <= referenceLimit) {
    if (!files.has(o.id)) throw Error('Missing leaf reference: '+o.id);
    bucket[4].push([o.id,files.get(o.id)]);
  } else bucket[4] = null;
}
const data = {version:3,catalogRevision:manifest.revision,limit:filters.limit,
  collectionLimits:filters.collectionLimits,
  photoRevision:vm.runInContext('SKY_PHOTO_INDEX.revision',c),guideRevision:vm.runInContext('SKY_GUIDE_DATA.revision',c),
  collections:filters.options('collections'),catalogs:filters.options('catalogs'),
  buckets:[...buckets.values()].sort((a,b) => a.slice(0,3).join('|').localeCompare(b.slice(0,3).join('|')) || Number(a[5])-Number(b[5]))};
const content = "'use strict';\n// Generated membership counts; full records remain in their original catalogue tiles.\nconst MAP_FILTER_DATA="+JSON.stringify(data)+';\n';
fs.writeFileSync('dist/map-filter-data.js',content);
const revision = crypto.createHash('sha256').update(content).digest('hex').slice(0,12);
const filterRevision = crypto.createHash('sha256').update(fs.readFileSync('dist/map-filters.js')).digest('hex').slice(0,12);
const html = fs.readFileSync('dist/index.html','utf8').replace(/(map-filter-data\.js\?v=)[^" ]+/,(_,p) => p+revision)
  .replace(/(map-filters\.js\?v=)[^" ]+/,(_,p)=>p+filterRevision);
fs.writeFileSync('dist/index.html',html);
console.log(JSON.stringify({buckets:data.buckets.length,records:data.buckets.reduce((n,b)=>n+b[3],0),bytes:content.length,revision}));
