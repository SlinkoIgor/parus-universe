// Read the same additive catalogue layers as the app, without UI or navigation.
import fs from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({console, Math, URL});
for (const name of ['catalog', 'astronomy', 'catalog-import', 'catalog-retired', 'coordinates',
  'cosmic-catalog', 'layout-data', 'map-layout', 'map-radial-data', 'map-radial', 'map-slice',
  'cosmology', 'map-details', 'catalog-extended', 'catalog-stream', 'nuclear-stars-data',
  'nuclear-stars', 'orbital-motion']) {
  vm.runInContext(fs.readFileSync('dist/' + name + '.js', 'utf8'), context);
}
process.stdout.write(vm.runInContext(`JSON.stringify({
  objects: OBJECTS.filter(o => o.kind === 'star' && !o.synthetic && Number.isFinite(o.raDeg) && Number.isFinite(o.decDeg)),
  priority: EXTENDED_BOOT.stellarCatalog.auditTargets,
  catalogRevision: EXTENDED_BOOT.revision
})`, context));
