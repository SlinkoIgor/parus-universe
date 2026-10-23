# Catalog snapshot, 2026-10-23

The browser loads dist/catalog-import.js (derived data: HYG/OpenNGC CC BY-SA4.0; ATNF acknowledgement). Source URLs, SHA256 hashes, formulas and attribution are in dist/catalog-sources.json.

normalize_catalog.py reads hyg_v41.csv, NGC.csv and psrcat.db in this directory; download the exact sources listed in metadata (ATNF db is inside the official tarball). Small SIMBAD coordinate extracts are retained here. It writes import-catalog.json. Browser normalization and removal of repeated original systems are in dist/coordinates.js.

The shipped HYG/OpenNGC data portions are licensed CC BY-SA4.0, https://creativecommons.org/licenses/by-sa/4.0/. Attribution: David Nash/Astronexus (HYG4.1); Mattia Verga and contributors (OpenNGC). Changes: selected subset, unit conversion, distance/luminosity calculations and Russian notes. ATNF: Manchester et al. 2005 AJ129 1993–2006, doi:10.1086/428488. SIMBAD: CDS, Strasbourg, France.
