// Reproduce the historical presentation overlay without rewriting catalogue data.
import fs from 'node:fs';
import crypto from 'node:crypto';

const source = JSON.parse(fs.readFileSync('data-tools/map-collection-history.json','utf8'));
if (source.version !== 1) throw Error('Unsupported historical source version');
const members = {};
for (const row of source.records) {
  if (Object.hasOwn(members,row.key)) throw Error('Duplicate historical identity: '+row.key);
  const prehistoric = row.precision === 'prehistory';
  const dated = prehistoric || Number.isFinite(row.knownByYear);
  members[row.key] = [
    ...(!row.uncertain && dated && (prehistoric || row.knownByYear < 1609) ? ['pre-telescope'] : []),
    ...(!row.uncertain && dated && (prehistoric || row.knownByYear <= 1782) ? ['before-herschel'] : []),
    ...(row.messierDiscovery ? ['messier-discoveries'] : []),
  ];
}
for (const key of source.galileo.keys) {
  if (!members[key]) throw Error('Missing Galileo identity: '+key);
  members[key].push('galileo');
}
const data = {version:1,members,sources:source.sources};
const content = "'use strict';\n// Generated from sourced historical observations; not scientific catalogue records.\nconst MAP_COLLECTION_HISTORY="+JSON.stringify(data)+';\n';
fs.writeFileSync('dist/map-collection-history.js',content);
const revision = crypto.createHash('sha256').update(content).digest('hex').slice(0,12);
const html = fs.readFileSync('dist/index.html','utf8');
if (!html.includes('map-collection-history.js?v=')) throw Error('Historical overlay script is not registered');
fs.writeFileSync('dist/index.html',html.replace(/(map-collection-history\.js\?v=)[^" ]+/,(_,p) => p+revision));
console.log(JSON.stringify({records:source.records.length,bytes:Buffer.byteLength(content),revision}));
