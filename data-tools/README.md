# Full catalog snapshot, 2026-10-24

Current expansion generator: `build-full-catalog.py`. Existing curated core: `curate_catalog.py`; historical `normalize_catalog.py` must not replace the current core.

Full HYG 4.1 / OpenNGC / ATNF snapshots → 138194 atlas records, bounded spatial tiles, lazy search worker index, explicit approximate/unknown positions and catalog system links. Keep source snapshots in ignored `raw/`; derived `../dist/catalog-data/` is tracked. See `../README-AGENT.md` for regeneration, source paths, uncertainty, persistence and validation. Audit: `full-catalog-audit.json`. Run `node verify-stream.mjs`, `node verify-map.mjs`, `node verify.mjs`.

The legacy curated audit `selection-audit.json` still verifies all 652 IAU names and the original nearest30 / brightest500 core. Licenses/provenance: `../dist/catalog-sources.json` and `../THIRD_PARTY_NOTICES.md`.
