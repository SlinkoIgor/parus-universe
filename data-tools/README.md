# Full catalog snapshot, 2026-10-25

Current expansion generator: `build-full-catalog.py`. Existing curated core: `curate_catalog.py`; historical `normalize_catalog.py` must not replace the current core.

Full HYG 4.1 / OpenNGC / ATNF snapshots → 143122 generated atlas records (+40 nuclear stars at runtime), bounded spatial tiles, lazy search worker index, approximate positions and atlas-only uncertain records and catalog system links. Keep source snapshots in ignored `raw/`; derived `../dist/catalog-data/` is tracked. See `../README-AGENT.md` for regeneration, source paths, uncertainty, persistence and validation. Audit: `full-catalog-audit.json`. Run `node verify-stream.mjs`, `node verify-map.mjs`, `node verify.mjs`.

The legacy curated audit `selection-audit.json` still verifies all 652 IAU names and the original nearest30 / brightest500 core. Licenses/provenance: `../dist/catalog-sources.json` and `../THIRD_PARTY_NOTICES.md`.

Hipparcos I/239 parallax uncertainties: `hipparcos-errors.json`; relative errors above 50% exclude individual stars from the map. Four sourced extragalactic members: `nearby-galaxy-stars.json`, M31 disk estimates and measured directions; host distance with unresolved depth in the Magellanic Clouds. Megastructure contours remain; every mapped destination supports arrival and a departure star.

Published system memberships and shared-distance exceptions: `confirmed-systems.json`; independently documented Alpha Centauri, Antennae and Cygnus X-1 also retain confirmed links. Update `../docs/catalog.md` with every selection/position rule change.

25.10.2026: formal policy in coordinate-policy.json; disk geometry in disk_geometry.py + galaxy-disk-models.json; observed selection in galaxy-disk-objects.json. Re-import offline with python3 data-tools/import-galaxy-disks.py, or explicitly use --download to refresh CDS snapshots. Regenerate spatial tiles with build-full-catalog.py afterwards. Full selection and placement rules are in docs/catalog.md; per-record audit galaxy-disk-audit.json.
