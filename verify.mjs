import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Keep the routine run comfortably below a minute. Exhaustive parameter grids,
// whole-catalogue audits and performance workloads belong in --extended.
export const defaultChecks = [
  'verify-test-runner.mjs',
  'verify-map.mjs',
  'verify-propulsion.mjs',
  'verify-time-controls.mjs',
  'verify-idle-runtime.mjs',
  'verify-burst-once.mjs',
  'verify-flight-policy.mjs',
  'verify-text-selection.mjs',
  'verify-catalog-smoke.mjs',
  'verify-atlas-transitions.mjs',
  'verify-map-continuity.mjs',
  'verify-map-render-cache.mjs',
  'verify-map-overview.mjs',
  'verify-expedition-number.mjs',
  'verify-telemetry-scale.mjs',
  'verify-runtime-recovery.mjs',
  'verify-orbit-paths.mjs',
  'verify-route-feedback.mjs',
  'verify-route-presentation.mjs',
  'verify-sky-dss.mjs',
];

// Detailed regressions remain available individually and in --extended.
const detailedChecks = [
  'verify-propulsion.mjs',
  'verify-composed.mjs',
  'verify-planner.mjs',
  'verify-time-controls.mjs',
  'verify-flight-tips.mjs',
  'verify-quests.mjs',
  'verify-library.mjs',
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
  'verify-messier.mjs',
  'verify-map-hierarchy.mjs',
  'verify-map-landmarks.mjs',
  'verify-map-discovery.mjs',
  'verify-map-names.mjs',
  'verify-stellar-cluster-map.mjs',
  'verify-cluster-membership.mjs',
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
  'verify-expedition-number.mjs',
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

export const extendedChecks = [...new Set([...defaultChecks, ...detailedChecks, 'verify-map.mjs', 'verify-stream.mjs'])];
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
