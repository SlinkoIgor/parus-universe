# Catalog snapshot, 2026-10-23

The browser loads dist/catalog-import.js (derived data: HYG/OpenNGC CC BY-SA4.0; ATNF acknowledgement). Source URLs, SHA256 hashes, formulas and attribution are in dist/catalog-sources.json.

normalize_catalog.py reads hyg_v41.csv, NGC.csv and psrcat.db in this directory; download the exact sources listed in metadata (ATNF db is inside the official tarball). Small SIMBAD coordinate extracts are retained here. It writes import-catalog.json. Browser normalization and removal of repeated original systems are in dist/coordinates.js.

The shipped HYG/OpenNGC data portions are licensed CC BY-SA4.0, https://creativecommons.org/licenses/by-sa/4.0/. Attribution: David Nash/Astronexus (HYG4.1); Mattia Verga and contributors (OpenNGC). Changes: selected subset, unit conversion, distance/luminosity calculations and Russian notes. ATNF: Manchester et al. 2005 AJ129 1993–2006, doi:10.1086/428488. SIMBAD: CDS, Strasbourg, France.

## Display embedding

Run `node data-tools/create-layout.mjs` from the repository root after updating coordinates. It computes deterministic constrained t-SNE (3D affinity probabilities, Student-t KL objective, solar-radius constraints, Galactic-plane anchors). The generated `dist/layout-data.js` is display-only; physical coordinates stay in `dist/coordinates.js`. Implementation and constraints are documented in `docs/physics.md`.

## Sail calibration

Run `node data-tools/calibrate-sails.mjs` from the root to reproduce the S/M/L areas in dist/catalog.js. It bisects the integrated stellar-wind solution at reference mass1.5kg to beta targets .999/.99999/.9999999. Speeds at other payload masses are derived from the same force, never clamped to those targets.
