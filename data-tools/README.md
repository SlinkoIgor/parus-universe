# Full catalog snapshot, 2026-10-24

Current expansion generator: `build-full-catalog.py`. Existing curated core: `curate_catalog.py`; historical `normalize_catalog.py` must not replace the current core.

Full HYG 4.1 / OpenNGC / ATNF snapshots → 138198 atlas records, bounded spatial tiles, lazy search worker index, approximate positions and atlas-only uncertain records and catalog system links. Keep source snapshots in ignored `raw/`; derived `../dist/catalog-data/` is tracked. See `../README-AGENT.md` for regeneration, source paths, uncertainty, persistence and validation. Audit: `full-catalog-audit.json`. Run `node verify-stream.mjs`, `node verify-map.mjs`, `node verify.mjs`.

The legacy curated audit `selection-audit.json` still verifies all 652 IAU names and the original nearest30 / brightest500 core. Licenses/provenance: `../dist/catalog-sources.json` and `../THIRD_PARTY_NOTICES.md`.

Hipparcos I/239 parallax uncertainties: `hipparcos-errors.json`; relative errors above 50% exclude individual stars from the map. Four sourced extragalactic members: `nearby-galaxy-stars.json`, host distance and measured direction, unresolved individual depth. Megastructure contours remain; every mapped destination supports arrival and a departure star.
