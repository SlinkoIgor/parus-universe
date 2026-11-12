// Main physics/integration regression suite for the current kilogram model.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Identical data: imports cache the same mutable browser/physics harness.
// A fresh process makes the full run match each standalone check. Run them
// sequentially so numerical/performance checks do not compete for the CPU.
const checks = [
  'verify-propulsion.mjs',
  'verify-composed.mjs',
  'verify-planner.mjs',
  'verify-time-controls.mjs',
  'verify-flight-tips.mjs',
  'verify-orbits.mjs',
  'verify-departure-access.mjs',
  'verify-boss-local.mjs',
  'verify-flash-reception.mjs',
  'verify-collector-survival.mjs',
  'verify-preboost.mjs',
  'verify-burst-once.mjs',
  'verify-flight-policy.mjs',
  'verify-reserve-policy.mjs',
  'verify-max-range.mjs',
  'verify-telemetry-scale.mjs',
  'verify-diffraction.mjs',
  'verify-flight-menu.mjs',
  'verify-atlas-transitions.mjs',
  'verify-catalog-registry.mjs',
  'verify-map-filters.mjs',
  'verify-map-hierarchy.mjs',
  'verify-map-landmarks.mjs',
  'verify-map-discovery.mjs',
  'verify-map-names.mjs',
  'verify-stellar-cluster-map.mjs',
  'verify-milkyway-layout.mjs',
  'verify-map-class-symbols.mjs',
  'verify-map-radial.mjs',
  'verify-system-coordinates.mjs',
  'verify-stellar-catalog.mjs',
  'verify-system-view.mjs',
  'verify-sky-guide.mjs',
  'verify-cosmic-media.mjs',
  'verify-sky-dss.mjs',
  'verify-sky-photos.mjs',
  'verify-sky-imaging.mjs',
  'verify-orbit-paths.mjs',
  'verify-extended-geometry.mjs',
  'verify-galaxy-structure.mjs',
  'verify-map-continuity.mjs',
  'verify-landmark-continuity.mjs',
  'verify-map-render-cache.mjs',
  'verify-map-visibility.mjs',
  'verify-map-annotations.mjs',
  'verify-map-visits.mjs',
  'verify-sparse-labels.mjs',
  'verify-area-labels.mjs',
  'verify-atlas-expansion.mjs',
  'verify-black-hole-visibility.mjs',
  'verify-structure-labels.mjs',
  'verify-galaxy-identities.mjs',
  'verify-nebula-identities.mjs',
  'verify-map-overview.mjs',
  'verify-universe.mjs',
  'verify-current-reach.mjs',
  'verify-reach-reuse.mjs',
  'verify-new-tasks.mjs',
  'verify-flight-tracks.mjs',
  'verify-runtime-performance.mjs',
  'verify-idle-runtime.mjs',
  'verify-runtime-recovery.mjs',
  'verify-map-interaction-performance.mjs',
  'verify-filament-performance.mjs',
  'verify-wishlist.mjs',
  'verify-route-camera.mjs',
  'verify-ship-camera.mjs',
  'verify-quick-flight.mjs',
  'verify-text-selection.mjs',
  'verify-shift-routes.mjs',
  'verify-unified-routes.mjs',
  'verify-route-recovery.mjs',
  'verify-route-feedback.mjs',
  'verify-route-search.mjs',
  'verify-route-presentation.mjs',
];

const started = performance.now(), failed = [], cwd = fileURLToPath(new URL('.',import.meta.url));
for (const [index,check] of checks.entries()) {
  console.log(`RUN ${index+1}/${checks.length} ${check}`);
  const start = performance.now();
  const result = spawnSync(process.execPath,[check],{cwd,stdio:'inherit'});
  const elapsed = ((performance.now()-start)/1000).toFixed(1);
  if (result.status === 0) console.log(`PASS suite ${check} (${elapsed}s)`);
  else {
    failed.push(check);
    console.error(`FAIL suite ${check} (${elapsed}s): ${result.error?.message || result.signal || 'exit '+result.status}`);
  }
}
const elapsed = ((performance.now()-started)/1000).toFixed(1);
if (failed.length) {
  console.error(`FAIL ${failed.length}/${checks.length} suites (${elapsed}s): ${failed.join(', ')}`);
  process.exitCode = 1;
} else console.log(`PASS all ${checks.length} suites (${elapsed}s)`);
