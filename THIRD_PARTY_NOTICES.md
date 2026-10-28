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

Four extragalactic stellar members (`data-tools/nearby-galaxy-stars.json`): NASA Hubble M31 V1, ESO eso1030 R136a1, SIMBAD coordinates for AF And/R136a1/HD5980 and individual membership publications. Exact links and transformations are retained per record. SIMBAD subset remains ODbL; only factual values and links from publications are included. M31/LMC use documented population disk models; HD5980 remains atlas-only because its SMC depth is unresolved.

Cygnus X-1/HDE226868 shared distance: Miller-Jones et al. (2021), Science, https://doi.org/10.1126/science.abb3363. Relative separation scale derived from 5.6-day period and summed mass; orbital phase/orientation illustrative. HYG component distance estimates retain original values and an explicit derivation log in `data-tools/system-position-audit.json`. Incompatible catalog associations do not imply physical binding.

Confirmed system associations and adopted shared distances: per-entry NASA/ESA observations and Muterspaugh et al. (2015) alpha Com binary orbit, sources retained in `data-tools/confirmed-systems.json`. Dust mass fraction estimate: ESA CESAR, The Interstellar Medium, https://cesar.esa.int/upload/201705/Booklet_ISM.pdf.

## Nearby-galaxy observed objects

LGGS revised catalogs: Massey, Neugent & Smart (2016), AJ 152,62, CDS J/AJ/152/62; only spectroscopic members Mm=1. PHAT/AP: Johnson et al. (2015), ApJ 802,127, CDS J/ApJ/802/127 main cluster table2 (no synthetic tablec2, ancillary candidates or background galaxies). M33 SNRs: Long et al. (2018), ApJ 855,140, CDS J/ApJ/855/140 table1 Conf=yes. Original observations/catalogs remain credited to the authors and publishers; data access by CDS/VizieR (DOI 10.26093/cds/vizier). Rights follow the originating catalog/publisher policies, not an implied grant under this repository's code license. Source URLs and SHA-256 values are in data-tools/galaxy-disk-objects.json.

Disk-depth estimates, display transforms and conservative uncertainty gates are this game's derived model; they are not individual published parallax measurements.

## OGLE Magellanic Cepheids

Jacyszyn-Dobrzeniecka et al. (2016), Acta Astronomica 66,149, https://arxiv.org/abs/1602.09141; public Table 3 at https://ogle.astrouw.edu.pl/cont/4_main/str/3_dim_str/table3.dat. Credit to OGLE and the authors. Retained factual fields: IDs, host label, observed J2000 directions, individual period-Wesenheit distances and reported errors, V magnitude, pulsation mode, period, age. No randomly generated depths. Data rights remain with the original authors; this repository code license does not relicense the original catalog. SHA256 and original URL in data-tools/magellanic-cepheids.json.

## Geometry corrections and independent distance data

Hipparcos new reduction: van Leeuwen (2007), A&A 474,653, VizieR I/311, https://cdsarc.cds.unistra.fr/viz-bin/cat/I/311. HIP, parallax and formal error retained in data-tools/hipparcos-2007.json. Match to the adopted HYG distance before using the error; I/239 retained for matching older exceptions. Source data remain credited to ESA/van Leeuwen/CDS and originating rights, not relicensed under the game code license.

Galactic GC models: https://people.smp.uq.edu.au/HolgerBaumgardt/globular/parameter.html and combined_table.txt, author compilation; distances mostly Baumgardt & Vasiliev (2021), https://doi.org/10.1093/mnras/stab1474. Only factual centre coordinates, host distances/errors, half-light and model tidal radii retained. Derived compact-host point estimates and local map views are this game's approximations, not measured individual pulsar depths.

SIMBAD low-z mesDistance subset: ODbL; Wenger et al. 2000, A&AS 143,9, CDS Strasbourg. Explicit accepted independent distance methods only; original bibcodes, units, errors, ADQL query and snapshot hash in data-tools/low-z-galaxy-distances.json. Acknowledgment: this research has made use of the SIMBAD database, operated at CDS, Strasbourg, France.

NGC4676 membership and approximate common distance: ESA/Hubble, https://esahubble.org/images/heic0206h/. Factual values and source link retained; no source imagery redistributed.
