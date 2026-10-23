# Third-party notices

## Astronomical datasets

The derived HYG and OpenNGC data portions in `dist/catalog-import.js` are distributed under [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).

- **HYG 4.1** — David Nash / Astronexus. Source: <https://github.com/astronexus/HYG-Database/tree/main/hyg>. Changes: union of 30 nearest, top500 apparent V, traditional and IAU-named stars, conversion of coordinates and distances, Russian descriptions, visual luminosity labels, duplicate removal.
- **OpenNGC** — Mattia Verga and contributors. Source: <https://github.com/mattiaverga/OpenNGC>. Changes: named deep-sky subset selection; literature distances, optical dimensions and visual luminosities; Russian descriptions.
- **ATNF Pulsar Catalogue 2.9.0** — Manchester, R. N., Hobbs, G. B., Teoh, A. & Hobbs, M. (2005), AJ 129, 1993–2006, <https://doi.org/10.1086/428488>. Source: <https://www.atnf.csiro.au/research/pulsar/psrcat/>. Selected entries use independent distance estimates; assumed neutron-star mass and radius are explicitly identified as modeling parameters.
- **IAU WGSN Catalog of Star Names** — all652 names as of2026-10-24: <https://exopla.net/star-names/modern-iau-star-names/>. Names are public domain; etymology prose is not redistributed.
- **SIMBAD derived subsets** (`data-tools/named-astrometry.json`, `galaxy-distances.json` and corresponding browser fields) — [ODbL](https://opendatacommons.org/licenses/odbl/1-0/); Wenger et al. (2000), A&AS143,9. Individual literature references retained. Changes: identity joins, quality-limited parallax inversion, distance selection and unit conversion. These terms apply to the SIMBAD portions separately from HYG/OpenNGC.
- This project has made use of the **SIMBAD database**, operated at CDS, Strasbourg, France: <https://simbad.cds.unistra.fr/simbad/>.
- Individually curated original objects link to NASA, ESO, CDS/SIMBAD and scientific publications in their cards.

Full source provenance, snapshot dates, transformations and source hashes are recorded in `dist/catalog-sources.json`.

## Fonts

Bundled **Golos Text** and **IBM Plex Mono** are distributed under the SIL Open Font License 1.1. Full notices and license terms are retained in `dist/fonts/golostext-OFL.txt` and `dist/fonts/ibmplexmono-OFL.txt`.

Display embedding adds a deterministic constrained t-SNE transformation to the existing catalog-derived data, preserving the data attribution and CC BY-SA 4.0 terms above. Algorithm reference: van der Maaten & Hinton (2008), JMLR 9:2579–2605. The optimizer is implemented in this repository; no external t-SNE source code is bundled.
