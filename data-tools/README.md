# Catalog snapshot, 2026-10-24

Current generator: `curate_catalog.py`; the old `normalize_catalog.py` is historical. See [README-AGENT.md](../README-AGENT.md#каталог-и-воспроизведение) for selection, download paths, rebuilding, attribution and validation.

30 nearest + top500 apparent Johnson V + all652 IAU names + traditional HYG names + named OpenNGC and original landmarks. Unknown distances remain unknown. Audit: `selection-audit.json`. Rebuild display embedding with `node data-tools/create-layout.mjs`, validate with `node verify.mjs`.

Per-source provenance/licenses: `../dist/catalog-sources.json` and `../THIRD_PARTY_NOTICES.md`. Raw source files live in ignored `raw/`; generated browser snapshots are tracked.
