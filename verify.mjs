import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Keep the routine run comfortably below a minute. Exhaustive parameter grids,
// whole-catalogue audits and performance workloads belong in --extended.
export const defaultChecks = [
  'tests/verify-test-runner.mjs',
  'tests/verify-map.mjs',
  'tests/verify-propulsion.mjs',
  'tests/verify-time-controls.mjs',
  'tests/verify-idle-runtime.mjs',
  'tests/verify-burst-once.mjs',
  'tests/verify-flight-policy.mjs',
  'tests/verify-text-selection.mjs',
  'tests/verify-catalog-smoke.mjs',
  'tests/verify-atlas-transitions.mjs',
  'tests/verify-map-continuity.mjs',
  'tests/verify-map-render-cache.mjs',
  'tests/verify-map-overview.mjs',
  'tests/verify-expedition-number.mjs',
  'tests/verify-telemetry-scale.mjs',
  'tests/verify-runtime-recovery.mjs',
  'tests/verify-orbit-paths.mjs',
  'tests/verify-route-feedback.mjs',
  'tests/verify-route-presentation.mjs',
  'tests/verify-sky-dss.mjs',
  'tests/verify-object-card.mjs',
  'tests/verify-star-names-ages.mjs',
  'tests/verify-cards.mjs',
  'tests/verify-atlas-expansion.mjs',
  'tests/verify-map-class-symbols.mjs',
  'tests/verify-milkyway-layout.mjs',
  'tests/verify-cosmic-media.mjs',
  'tests/verify-wikipedia.mjs',
  'tests/verify-stellar-catalog.mjs',
  'tests/verify-sky-guide.mjs',
  'tests/verify-geometry-fixes.mjs',
  'tests/verify-flight-tip-links.mjs',
  'tests/verify-diffraction.mjs',
  'tests/verify-map-visits.mjs',
  'tests/verify-galaxy-structure.mjs',
];

// Detailed regressions remain available individually and in --extended.
const detailedChecks = [
  'tests/verify-analytics.mjs',
  'tests/verify-startup-dom.mjs',
  'tests/verify-propulsion.mjs',
  'tests/verify-composed.mjs',
  'tests/verify-planner.mjs',
  'tests/verify-time-controls.mjs',
  'tests/verify-flight-tips.mjs',
  'tests/verify-engine-start.mjs',
  'tests/verify-flight-tip-links.mjs',
  'tests/verify-quests.mjs',
  'tests/verify-library.mjs',
  'tests/verify-orbits.mjs',
  'tests/verify-departure-access.mjs',
  'tests/verify-boss-local.mjs',
  'tests/verify-flash-reception.mjs',
  'tests/verify-collector-survival.mjs',
  'tests/verify-preboost.mjs',
  'tests/verify-burst-once.mjs',
  'tests/verify-flight-policy.mjs',
  'tests/verify-reserve-policy.mjs',
  'tests/verify-max-range.mjs',
  'tests/verify-telemetry-scale.mjs',
  'tests/verify-diffraction.mjs',
  'tests/verify-flight-menu.mjs',
  'tests/verify-atlas-transitions.mjs',
  'tests/verify-catalog-registry.mjs',
  'tests/verify-map-filters.mjs',
  'tests/verify-messier.mjs',
  'tests/verify-map-hierarchy.mjs',
  'tests/verify-map-landmarks.mjs',
  'tests/verify-map-discovery.mjs',
  'tests/verify-map-names.mjs',
  'tests/verify-stellar-cluster-map.mjs',
  'tests/verify-cluster-membership.mjs',
  'tests/verify-milkyway-layout.mjs',
  'tests/verify-map-class-symbols.mjs',
  'tests/verify-map-radial.mjs',
  'tests/verify-system-coordinates.mjs',
  'tests/verify-stellar-catalog.mjs',
  'tests/verify-system-view.mjs',
  'tests/verify-sky-guide.mjs',
  'tests/verify-object-card.mjs',
  'tests/verify-star-names-ages.mjs',
  'tests/verify-cosmic-media.mjs',
  'tests/verify-sky-dss.mjs',
  'tests/verify-sky-photos.mjs',
  'tests/verify-sky-imaging.mjs',
  'tests/verify-orbit-paths.mjs',
  'tests/verify-extended-geometry.mjs',
  'tests/verify-galaxy-structure.mjs',
  'tests/verify-map-continuity.mjs',
  'tests/verify-landmark-continuity.mjs',
  'tests/verify-map-render-cache.mjs',
  'tests/verify-map-visibility.mjs',
  'tests/verify-map-annotations.mjs',
  'tests/verify-map-visits.mjs',
  'tests/verify-expedition-number.mjs',
  'tests/verify-sparse-labels.mjs',
  'tests/verify-area-labels.mjs',
  'tests/verify-atlas-expansion.mjs',
  'tests/verify-black-hole-visibility.mjs',
  'tests/verify-structure-labels.mjs',
  'tests/verify-galaxy-identities.mjs',
  'tests/verify-galaxy-pairs.mjs',
  'tests/verify-nebula-identities.mjs',
  'tests/verify-map-overview.mjs',
  'tests/verify-universe.mjs',
  'tests/verify-current-reach.mjs',
  'tests/verify-reach-reuse.mjs',
  'tests/verify-new-tasks.mjs',
  'tests/verify-flight-tracks.mjs',
  'tests/verify-runtime-performance.mjs',
  'tests/verify-idle-runtime.mjs',
  'tests/verify-runtime-recovery.mjs',
  'tests/verify-map-interaction-performance.mjs',
  'tests/verify-filament-performance.mjs',
  'tests/verify-wishlist.mjs',
  'tests/verify-route-camera.mjs',
  'tests/verify-ship-camera.mjs',
  'tests/verify-quick-flight.mjs',
  'tests/verify-text-selection.mjs',
  'tests/verify-shift-routes.mjs',
  'tests/verify-unified-routes.mjs',
  'tests/verify-route-recovery.mjs',
  'tests/verify-route-feedback.mjs',
  'tests/verify-route-search.mjs',
  'tests/verify-route-presentation.mjs',
];

export const extendedChecks = [...new Set([...defaultChecks, ...detailedChecks, 'tests/verify-map.mjs', 'tests/verify-stream.mjs'])];
export const DEFAULT_BUDGET_MS = 55_000;
const root = fileURLToPath(new URL('.', import.meta.url));

// Each check has its own mutable browser/physics harness. Keep fresh processes
// and sequential execution, including for CPU-sensitive performance checks.
export function runSuites(checks, {cwd = root, budgetMs = Infinity, log = console.log, error = console.error} = {}) {
  const started = performance.now(), failed = [];
  let completed = 0;
  for (const [index, check] of checks.entries()) {
    const remaining = budgetMs - (performance.now() - started);
    if (remaining <= 0) break;
    log(`RUN ${index + 1}/${checks.length} ${check}`);
    const start = performance.now();
    const result = spawnSync(process.execPath, [check], {
      cwd, stdio: 'inherit',
      // SIGKILL also bounds a hung check that installs a SIGTERM handler.
      ...(Number.isFinite(remaining) ? {timeout: Math.ceil(remaining), killSignal: 'SIGKILL'} : {}),
    });
    completed++;
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    if (result.status === 0) log(`PASS suite ${check} (${elapsed}s)`);
    else {
      failed.push(check);
      error(`FAIL suite ${check} (${elapsed}s): ${result.error?.code === 'ETIMEDOUT' ? 'suite time budget exhausted' : result.error?.message || result.signal || 'exit ' + result.status}`);
    }
    if (result.error?.code === 'ETIMEDOUT') break;
  }
  const elapsedMs = performance.now() - started, elapsed = (elapsedMs / 1000).toFixed(1);
  if (completed < checks.length || elapsedMs > budgetMs) {
    error(`FAIL time budget ${budgetMs / 1000}s exceeded (${elapsed}s); ${checks.length - completed} suites not run. Run a failing check directly to investigate.`);
    return 1;
  }
  if (failed.length) {
    error(`FAIL ${failed.length}/${checks.length} suites (${elapsed}s): ${failed.join(', ')}`);
    return 1;
  }
  log(`PASS all ${checks.length} suites (${elapsed}s)`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), unknown = args.filter(arg => !['--extended', '--list', '--help'].includes(arg));
  if (unknown.length) {
    console.error(`Unknown option: ${unknown.join(', ')}. Use node verify.mjs --help.`);
    process.exitCode = 2;
  } else if (args.includes('--help')) {
    console.log('node verify.mjs                 Routine regression suite (55s budget, under 1 minute)\nnode verify.mjs --extended      Exhaustive numerical/catalogue/performance checks (several minutes)\nnode verify.mjs [--extended] --list  List checks without running them');
  } else {
    const extended = args.includes('--extended'), checks = extended ? extendedChecks : defaultChecks;
    if (args.includes('--list')) console.log(checks.join('\n'));
    else {
      console.log(`PROFILE ${extended ? 'extended' : 'default'}: ${checks.length} suites${extended ? '' : ', 55s budget'}`);
      process.exitCode = runSuites(checks, {budgetMs: extended ? Infinity : DEFAULT_BUDGET_MS});
    }
  }
}
