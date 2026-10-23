# Catalog snapshot, 2026-10-23

The browser loads dist/catalog-import.js (derived data: HYG/OpenNGC CC BY-SA4.0; ATNF acknowledgement). Source URLs, SHA256 hashes, formulas and attribution are in dist/catalog-sources.json.

normalize_catalog.py reads hyg_v41.csv, NGC.csv and psrcat.db in this directory; download the exact sources listed in metadata (ATNF db is inside the official tarball). Small SIMBAD coordinate extracts are retained here. It writes import-catalog.json. Browser normalization and removal of repeated original systems are in dist/coordinates.js.

The shipped HYG/OpenNGC data portions are licensed CC BY-SA4.0, https://creativecommons.org/licenses/by-sa/4.0/. Attribution: David Nash/Astronexus (HYG4.1); Mattia Verga and contributors (OpenNGC). Changes: selected subset, unit conversion, distance/luminosity calculations and Russian notes. ATNF: Manchester et al. 2005 AJ129 1993–2006, doi:10.1086/428488. SIMBAD: CDS, Strasbourg, France.

## Display embedding

Run `node data-tools/create-layout.mjs` from the repository root after updating coordinates. It computes deterministic constrained t-SNE (3D affinity probabilities, Student-t KL objective, solar-radius constraints, Galactic-plane anchors). The generated `dist/layout-data.js` is display-only; physical coordinates stay in `dist/coordinates.js`. Implementation and constraints are documented in `docs/physics.md`.

## Sail calibration

Run `node data-tools/calibrate-sails.mjs` from the root to reproduce S/M/L areas and verify the integrated finite-flash solutions. Reference launch mass is 1mg (empty tank), acceleration capped at100g. M is the previously discussed 4.719e12m² sail; S/M/L areas scale1e-4/1/1e4, with nominal automatic folding at beta .99999/.9999999/.999999999. Earlier braking or insufficient available light lowers the achieved speed; it is never assigned instantly.
