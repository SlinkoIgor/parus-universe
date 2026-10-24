# Third-party notices

## Astronomical datasets

The derived HYG and OpenNGC data portions in `dist/catalog-import.js`, `dist/catalog-extended.js` and `dist/catalog-data/` are distributed under [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).

- **HYG 4.1** — David Nash / Astronexus. Source: <https://github.com/astronexus/HYG-Database/tree/main/hyg>. Changes: full local snapshot expansion, spatial tiling and representative sampling, compact search index, component-group links, curated foreground selection, conversion of coordinates and distances, Russian descriptions, visual luminosity labels, duplicate removal.
- **OpenNGC** — Mattia Verga and contributors. Source: <https://github.com/mattiaverga/OpenNGC>. Changes: full local snapshot expansion, tiling, search and component-group links; literature distances, optical dimensions and visual luminosities; Russian descriptions.
- **ATNF Pulsar Catalogue 2.9.0** — Manchester, R. N., Hobbs, G. B., Teoh, A. & Hobbs, M. (2005), AJ 129, 1993–2006, <https://doi.org/10.1086/428488>. Source: <https://www.atnf.csiro.au/research/pulsar/psrcat/>. All 4503 catalog records are represented; distances use independent estimates, positive parallaxes or the catalog dispersion models and are labelled approximate; assumed neutron-star mass and radius are explicitly identified as modeling parameters.
- **IAU WGSN Catalog of Star Names** — all652 names as of2026-10-24: <https://exopla.net/star-names/modern-iau-star-names/>. Names are public domain; etymology prose is not redistributed.
- **SIMBAD derived subsets** (`data-tools/named-astrometry.json`, `galaxy-distances.json` and corresponding browser fields) — [ODbL](https://opendatacommons.org/licenses/odbl/1-0/); Wenger et al. (2000), A&AS143,9. Individual literature references retained. Changes: identity joins, parallax inversion with explicit quality labels, distance selection and unit conversion. These terms apply to the SIMBAD portions separately from HYG/OpenNGC.
- This project has made use of the **SIMBAD database**, operated at CDS, Strasbourg, France: <https://simbad.cds.unistra.fr/simbad/>.
- Individually curated original objects link to NASA, ESO, CDS/SIMBAD and scientific publications in their cards.

Full source provenance, snapshot dates, transformations and source hashes are recorded in `dist/catalog-sources.json`.

## Fonts

Bundled **Golos Text** and **IBM Plex Mono** are distributed under the SIL Open Font License 1.1. Full notices and license terms are retained in `dist/fonts/golostext-OFL.txt` and `dist/fonts/ibmplexmono-OFL.txt`.

Display embedding adds a deterministic constrained t-SNE transformation to the existing catalog-derived data, preserving the data attribution and CC BY-SA 4.0 terms above. Algorithm reference: van der Maaten & Hinton (2008), JMLR 9:2579–2605. The optimizer is implemented in this repository; no external t-SNE source code is bundled.

System hierarchy references: Kervella et al. (2017), A&A, https://doi.org/10.1051/0004-6361/201629930 (Alpha Cen AB–C); NASA Cygnus X-1 / HDE226868, https://imagine.gsfc.nasa.gov/features/yba/CygX1_mass/cygX1_more.html; NASA Caldwell60/61 (Antennae), https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-60-61/. Schematics do not reproduce measured orbital elements. Fictional departure stars are explicitly labelled as game entities and are not attributed to these datasets.

Messier supplements: M40 direction from SIMBAD (https://simbad.cds.unistra.fr/simbad/sim-id?Ident=M%2040), M45 distance from NASA Hubble (https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-45/) with approximate center from HYG members, and M102 identification/distance from NASA Hubble (https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-102/). Only factual values and links are retained.

Hipparcos uncertainty subset (`data-tools/hipparcos-errors.json`): ESA (1997), The Hipparcos and Tycho Catalogues, ESA SP-1200; VizieR I/239, https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=I/239/hip_main. HIP, parallax and standard error retained for a 50% relative-error map filter.

Four extragalactic stellar members (`data-tools/nearby-galaxy-stars.json`): NASA Hubble M31 V1, ESO eso1030 R136a1, SIMBAD coordinates for AF And/R136a1/HD5980 and individual membership publications. Exact links and transformations are retained per record. SIMBAD subset remains ODbL; only factual values and links from publications are included. Distances inherited from host galaxies, with unresolved individual depth explicitly marked.
