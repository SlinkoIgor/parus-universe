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


## Supernova spectral templates

`dist/beam-spectra.js` contains normalized, rebinned numerical energy fractions derived from Peter E. Nugent's [LBNL time-evolving supernova templates](https://c3.lbl.gov/nugent/nugent_templates.html): normal Ia v1.2 (Nugent, Kim & Perlmutter, PASP114,803,2002), Ib/c v1.1 (Levan et al., ApJ,2005; SN1999ex photometry from Hamuy et al., AJ124,417,2002), II-P v1.2 (Baron et al., ApJ616,91,2004; Gilliland, Phillips & Nugent, ApJ521,30,1999). Original download URLs and SHA-256 hashes are embedded per profile. Changes: truncate to the first30 source days with a bracketing II-P day36 spectrum, integrate fλdλ into64 logarithmic100–2500nm bands, normalize each phase to unit energy, extend the first nonzero spectrum back to day0 instead of normalizing the Ia/Ib-c numerical flux floor, linearly interpolate energy fractions. Raw spectra and template photometric light curves are not bundled. The game retains its fictional constant luminosity and30-day emission duration; it does not reproduce the original bolometric light curves. Reproduction: `data-tools/build-beam-spectra.py --raw-dir DIR`.


Individual stellar-parameter supplement: **GJ887 / Lacaille9352 / HIP114046** — Mann et al.(2015), values tabulated in Hartogh et al.(2026), *RedDots: Multiplanet system around M dwarf GJ887 in the solar neighborhood*, A&A707,A93, Table1, <https://doi.org/10.1051/0004-6361/202554984> (CC BY4.0). Mass and uncertainty, bolometric luminosity, radius and effective temperature are stored in the foreground/streamed object; HYG identity and astrometry are retained. No planet data or article prose is reproduced.


## Observed multi-scale catalogues · snapshot 2026-10-29

Access via CDS/VizieR IDIA mirror. Acknowledgment: This research has made use of the VizieR catalogue access tool, CDS, Strasbourg, France (DOI 10.26093/cds/vizier). Original authors/publishers retain rights to source tables; the game code license does not relicense them. No article prose or imagery redistributed. Numerical selections, unit/cosmology conversion, cross-identification, projection, spatial sampling and compressed derived records are documented in docs/catalog.md. Raw query URLs, SHA-256, versions and selection limits are preserved in dist/catalog-sources.json and data-tools/cosmic-catalog-audit.json.

- **MCXC-II**, Sadibekova et al. (2024), A&A688,A187: <https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/688/A187>; 2,221 rows, aperture mass/radius and X-ray luminosity retained as such.
- **SDSS DR7 superclusters**, Liivamägi, Tempel & Saar (2012), A&A539,A80: <https://doi.org/10.1051/0004-6361/201016288>; mainadap only (1,313).
- **Bisous filaments**, Tempel et al. (2014), MNRAS438,3465: <https://doi.org/10.1093/mnras/stt2454>; 15,421 axes, all 275,599 spine points, and 120 galaxy rows for independent frame validation. Catalogue <https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465>.
- **SDSS DR7 voids**, Nadathur & Hotchkiss (2014), MNRAS440,1248: <https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/440/1248>; Type1 comoving subsets, 635 selected out of 808. This is not the BOSS DR11 catalogue.
- **Cosmicflows-4**, Tully et al. (2023), ApJ944,94: <https://doi.org/10.3847/1538-4357/ac94d8>; corrected individual table2 (55,877), not flawed August2022 tables. <https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94>.
- **Updated Nearby Galaxy Catalog**, Karachentsev, Makarov & Kaisina (2013), AJ145,101: <https://doi.org/10.1088/0004-6256/145/4/101>; 869 catalogue rows and 783 distance/method rows, quality gates retained.
- **GLADE+**, Dálya et al. (2022), MNRAS514,1403: <https://doi.org/10.1093/mnras/stac1443>; CDS VII/291. Only Type G, B≤15.5, spectroscopic f_dL=3, zhelio>0.002 subset (45,727); no claim to reproduce the full ≈23-million-object source. Stellar masses remain metadata, not total point masses.
- **Gaia DR3 cluster catalogue update**, Hunt & Reffert (2024), A&A686,A42: <https://doi.org/10.1051/0004-6361/202348662>; high-quality o/m/g/d subset (4,100 of7,167), rejected r excluded. Group masses are aggregate. <https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/686/A42>.
