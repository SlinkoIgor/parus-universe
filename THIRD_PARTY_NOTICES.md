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

## Distant spectroscopic targets and protocluster candidates · 2026-11-01

- **CCPC-II**, Franck & McGaugh (2016), ApJ 833, 15, [arXiv:1610.00713](https://arxiv.org/abs/1610.00713), [CDS J/ApJ/833/15](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/833/15). All 173 candidate rows from `ccpc2` plus all 17 `table6` source rows (15 Objects of Interest; repeated Names grouped with provenance), including quality flags, source units, redshift errors and distinct model mass estimates, are retained. Access through CDS/VizieR; acknowledgment: this research has made use of the VizieR catalogue access tool, CDS, Strasbourg, France (DOI 10.26093/cds/vizier).
- **JADES DR4 v1.2**, JWST Advanced Deep Extragalactic Survey team, [MAST JADES HLSP](https://archive.stsci.edu/hlsp/jades), GOODS-S/GOODS-N NIRSpec line-flux FITS `Obs_info` tables. Retained all 5190 Obs_info observations, grouped conservatively into 5095 targets, including PID/TIER, coordinates, original z and quality A–E. One target supplements the existing JADES-GS-z14-0; 1868 targets without reliable positive A/B/C z and five conflicting targets remain Atlas-only. D is tentative and E means no redshift; no distances are fabricated. Full spectra, flux tables, article prose and imagery are not redistributed.

Original authors, survey teams, archives and publishers retain rights in their source data; the repository code license does not relicense those tables. Derived selections, identity grouping, cosmology conversion and display are documented in `docs/universe-overview.md`; URLs, source hashes, units and retained factual rows are in `data-tools/distant-sources/` and the audit. Unknown uncertainties, sizes and masses are not replaced with typical values.

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


## Орбитальный экранный слой (29 октября 2026)

Восемь планет: NASA/JPL Solar System Dynamics, *Approximate Positions of the Planets*, Table1, J2000 elements, https://ssd.jpl.nasa.gov/planets/approx_pos.html. Двухтельная экстраполяция элементов, а не воспроизведение точных JPL DE эфемерид. Земля использует EM Bary.

Alpha Centauri AB: Kervella, Mignard, Mérand & Thévenin (2016), A&A594,A107, Table1 K16, https://arxiv.org/abs/1610.06079. Внешняя орбита Proxima: Kervella et al. (2017), A&A598,L7, Table3, https://arxiv.org/abs/1611.03495. Использованы численные орбитальные элементы и опубликованные неопределённости; рисунки и тексты статей не копируются. Атрибуция существующих GRAVITY2021/Gillessen2017 S-звёзд сохранена.


## Compact-object supplement · 2026-11-05

Factual catalogue subsets retain their original authors and source references:
Corral-Santana et al., **BlackCAT**, A&A 587 A61 (2016),
[arXiv:1510.08869v1](https://arxiv.org/abs/1510.08869v1), 59 historical transients
and the corresponding individual mass rows; McConnell & Ma (2013),
**Revisiting the Scaling Relations of Black Hole Masses and Host Galaxy
Properties**, ApJ 764 184, [arXiv:1211.2816](https://arxiv.org/abs/1211.2816),
Table 2; El-Badry et al. **Gaia BH1/BH2**,
[2209.06833](https://arxiv.org/abs/2209.06833),
[2302.07880](https://arxiv.org/abs/2302.07880); Gaia Collaboration et al.,
**Gaia BH3**, [2404.10486](https://arxiv.org/abs/2404.10486);
[EHT/NASA M87* factual mass and first-image identification](https://science.nasa.gov/resource/first-image-of-a-black-hole/).
No paper prose, spectra or images are redistributed. Extracted factual rows,
source hashes where available and URLs are in `data-tools/black-hole-sources/`.
Changes: conservative distance/confirmation selection, Russian descriptions,
ICRS-to-Galactic conversion, host identity joins, linear dynamical-mass scaling
to adopted host distance, and separate nuclear identities. No source-specific
rights are replaced by the repository's code license; inherited OpenNGC/SIMBAD
host-coordinate portions retain the terms above. Coverage and uncertainties:
`docs/atlas-expansion.md`.


## Nearby stellar identities, multiplicity, orbits and sky fields (2026-11-05)

Names and aliases: [SIMBAD, CDS / Strasbourg Observatory](https://simbad.cds.unistra.fr/), accessed through the Harvard TAP mirror; Wenger et al. (2000).
Component hierarchies: Tokovinin (2018), **The Updated Multiple Star Catalog**,
[MSC J/ApJS/235/6](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/235/6),
[doi:10.3847/1538-4365/aaa1a5](https://doi.org/10.3847/1538-4365/aaa1a5),
December 2023 source version. Visual orbits: Hartkopf, Mason and collaborators,
[Sixth Catalog of Orbits of Visual Binary Stars (ORB6)](https://www.astro.gsu.edu/wds/orb6.html),
USNO / Washington Double Star Catalog, current GSU mirror. Spectroscopic pairs:
Pourbaix et al., [SB9](https://cdsarc.cds.unistra.fr/viz-bin/cat/B/sb9).
Barycentric ratios for Sirius and Procyon: Bond et al.
[2017](https://arxiv.org/abs/1703.10625) and
[2015](https://arxiv.org/abs/1510.00485).

Only selected factual catalogue rows and identifiers are bundled, with original
units, uncertainty fields, source references and full-download SHA-256 values
in `data-tools/stellar-sources/`. Changes: exact identity joins, Russian name
expansions, conservative confirmation selection, unit/epoch conversion and
Galactic-coordinate Kepler models. Source-specific data rights are retained;
the game's code license does not relicense these catalogues.

Online photographs are served by [STScI Digitized Sky Survey](https://archive.stsci.edu/dss/),
POSS-II / UK Schmidt Telescope red plates. DSS was produced at STScI under
US Government grant NAG W-2166; the survey material is based on photographic
data obtained with the Oschin Schmidt Telescope and the UK Schmidt Telescope.
Original plates were processed into compressed digital form with permission
of their institutions. Images are fetched directly for individual sky fields;
no survey image collection is redistributed in this repository.
See `docs/nearby-stellar-systems.md` for coverage and scientific limitations.

### Earth sky finding charts and selected observations

Finding-chart stars are XHIP, Anderson & Francis (2012), CDS V/137D,
distributed as J2000 GeoJSON by [d3-celestial](https://github.com/ofrohn/d3-celestial).
Constellation figures, positions and translated names are from d3-celestial;
its upstream credits include IAU, Wikipedia and Stellarium name translations.
The d3-celestial BSD 3-Clause license, Copyright (c) 2015 Olaf Frohn, is retained
in `data-tools/sky-sources/LICENSE-d3-celestial.txt` and the generated JS header.
Constellation membership boundaries are Roman (1987), CDS VI/42, through
[Astropy](https://www.astropy.org/); its BSD 3-Clause license is retained in
`data-tools/sky-sources/LICENSE-astropy.txt` and the generated JS header.

Selected photographs are fetched from official observatory servers. Every
displayed image has a visible full credit, observation/band description and
link to its original page. No observatory image collection is redistributed.
The initial selected images and required credits are:

- Sirius A/B, Hubble heic0516a: NASA, ESA, H. Bond (STScI), M. Barstow (University of Leicester).
- Alpha Centauri A/B, Hubble potw1635a: ESA/Hubble & NASA.
- Proxima Centauri, Hubble potw1343a: ESA/Hubble & NASA.
- Fomalhaut A dust disc, Webb weic2312a: NASA, ESA, CSA, A. Pagan (STScI), A. Gáspár (University of Arizona).
- Betelgeuse, VLT/SPHERE eso2003a: ESO/M. Montargès et al.
- Vega dust disc, Spitzer PIA07218: NASA/JPL-Caltech/University of Arizona.
- Polaris observational collage, Hubble opo0602a: NASA, ESA, N. Evans (Harvard-Smithsonian CfA), H. Bond (STScI).

The exact URLs, identities, captions and source checks are recorded in
`data-tools/sky-sources/media.json` and `sources.json`. See `docs/sky-guide.md`.


DSS photographic preparation also uses the factual plate-centre/epoch list
from NASA [SkyView DSS2 Red](https://skyview.gsfc.nasa.gov/current/jar/surveys/xml/dss2r.xml.gz),
frozen with source SHA-256 in `data-tools/sky-sources/`. It describes POSS-II /
UK Schmidt red plates; original institutional data rights and DSS credits above
apply. Selected per-object photographic astrometry is from CDS SIMBAD through
its CfA mirror (Wenger et al. 2000), with bibliographic provenance and available
uncertainties retained. Full HYG 4.1 proper motions are used under the existing
HYG attribution/license. These presentation data do not replace the scientific
catalogue and are not relicensed as game code. No DSS pixels are redistributed.

### Historical observing collections

Factual discovery/observation dates and attributions are from Hartmut Frommert
and Christine Kronberg, SEDS, [Discovery Table of the Deep Sky Objects](https://messier.obspm.fr/xtra/history/dis-tab.html),
Observatoire de Paris mirror, source version August 16, 2007. Historical notes,
uncertain identities, source URL and SHA-256 are retained in
`data-tools/map-collection-history.json`. The separate presentation overlay
does not claim complete discovery histories or replace scientific records.
NASA's [Hubble Messier Catalog](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/)
supplies the M31 first-written-report correction and M44/M45 telescope-observation
context. No source photographs or page artwork are bundled for these collections;
source rights remain with their authors.


The expanded gallery also uses NASA's credited Hubble Messier and Caldwell
object pages, frozen as factual image metadata in
`data-tools/sky-sources/media-hubble.json`. The complete credit accompanies
every displayed photograph; original source URLs and observational captions
are retained. Metadata only is bundled; image files stay on publisher servers.
Additional observations are credited to NASA SDO, NASA/CXC/University of Toronto/
M. Durant et al. (Vela), and the EHT Collaboration (M87* and Sagittarius A*),
with their exact credits/URLs in `media.json`.

Caldwell-to-catalogue number correspondences are factual entries from the
[Wikipedia Caldwell catalogue](https://en.wikipedia.org/wiki/Caldwell_catalogue),
source attribution and SHA-256 in `visual-targets.json`. No prose, image or
unstated-band magnitude is copied from that table. NASA's
[Hubble Caldwell Catalog](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/)
provides the separate evidence for visual amateur observing.

### AstroPix observatory image metadata

The mass photographic gallery uses [AstroPix](https://www.astropix.org/),
operated by Caltech/IPAC as part of NASA's Universe of Learning. The documented
[JSON API](https://www.astropix.org/page/developers) supplies factual AVM
identifiers, telescope/filter information, titles, credits and usage policies.
The derived, filtered metadata and provenance are frozen in
`data-tools/sky-sources/media-astropix.json`; original feeds are not bundled.
Photographic pixels are loaded only on demand from external AstroPix URLs.

AstroPix has [no universal image license](https://www.astropix.org/page/image_policies).
Rights remain with each originating institution and credited contributor:
ESA/Hubble, STScI/NASA (including Webb), ESO, NOIRLab, Chandra, Spitzer,
WISE, Herschel, GALEX, NRAO, NuSTAR, Planck, Euclid and ZTF. Each displayed
material retains its full supplied credit, individual usage-rights statement,
AstroPix page and original publisher reference. ESO/ESA archive entries
predominantly specify Creative Commons Attribution 4.0; other entries retain
their own policy or public-domain statement. None are relicensed as game code.

Qualitative naked-eye visibility of the Magellanic Clouds is attributed to
NOIRLab's [Large Magellanic Cloud](https://noirlab.edu/public/images/noao-02332/)
and [Small Magellanic Cloud](https://noirlab.edu/public/images/noao-6051/) pages.
The short factual quotations, source URLs and underlying AVM metadata hashes
are retained in `data-tools/sky-sources/observing-evidence.json`. No magnitude
or other measurement is inferred from those statements.

### Siena Galaxy Atlas / DESI Legacy Imaging Surveys photographs

The additional galaxy gallery uses 12,000 published g/r/z observation images
from the [Siena Galaxy Atlas 2020](https://www.legacysurvey.org/sga/sga2020/)
(Moustakas et al. 2023), based on the DESI Legacy Imaging Surveys. Catalogue
metadata are obtained through the public NOIRLab Astro Data Lab TAP service,
table `sga2020.ellipse`; images remain on the external NERSC SGA-2020 server.
Only derived identification, provenance, availability and attribution metadata
are bundled in `data-tools/sky-sources/media-sga.json` and the lazy runtime
shards. No photographic pixels are redistributed with the application.

As stated in the [Legacy Surveys image policy and acknowledgments](https://www.legacysurvey.org/acknowledgment/),
Legacy Surveys images are licensed under [Creative Commons Attribution 4.0
International](https://creativecommons.org/licenses/by/4.0/). The unaltered,
visible, active credit displayed with every photograph is:
**Legacy Surveys / D. Lang (Perimeter Institute)**. Images are used as supplied,
with browser resizing; these data are not relicensed as application code.

The DESI Legacy Imaging Surveys consist of three individual and complementary
projects: the Dark Energy Camera Legacy Survey (DECaLS), the Beijing-Arizona
Sky Survey (BASS), and the Mayall z-band Legacy Survey (MzLS). DECaLS, BASS and
MzLS together include data obtained, respectively, at the Blanco telescope,
Cerro Tololo Inter-American Observatory, NSF’s NOIRLab; the Bok telescope,
Steward Observatory, University of Arizona; and the Mayall telescope, Kitt Peak
National Observatory, NOIRLab. NOIRLab is operated by AURA under a cooperative
agreement with the National Science Foundation. Pipeline processing and
analyses were supported by NOIRLab and Lawrence Berkeley National Laboratory.
Legacy Surveys is supported by the U.S. Department of Energy Office of Science,
Office of High Energy Physics; NERSC; the U.S. National Science Foundation;
the National Astronomical Observatories of China; the Chinese Academy of
Sciences; and the Chinese National Natural Science Foundation. The complete
Legacy Surveys, DES/DECam, BASS and institutional acknowledgments are available
at the linked official acknowledgment page.

The Siena Galaxy Atlas was made possible by funding support from the U.S.
Department of Energy, Office of Science, Office of High Energy Physics under
Award Number DE-SC0020086 and from the National Science Foundation under grant
AST-1616414.

## Cosmic epoch / large-structure visuals and photographed quasars

The curated manifest `data-tools/sky-sources/media-cosmic.json` retains the
individual image URL, source, full credit, rights statement and description.
Images are linked from their publishers; their pixel files are not bundled.
Five explanatory epoch SVG diagrams are authored in the application and are
explicitly labelled as schematic illustrations.

- Planck: ESA and the Planck Collaboration; Hubble/Webb/Chandra/VLA materials:
  the individual NASA, ESA, CSA, STScI, CXC and NRAO credits and AstroPix rights
  metadata are retained for each image, including images of quasar host galaxies.
- [NASA LAMBDA Universe timeline](https://lambda.gsfc.nasa.gov/education/graphic_history/univ_evol.html):
  NASA / LAMBDA Archive / WMAP Science Team.
- [CLASSIX figures, Böhringer et al. 2025](https://arxiv.org/abs/2501.19236):
  Hans Böhringer, Gayoung Chon, Joachim Trümper, Renee C. Kraan-Korteweg and
  Norbert Schartel. [BOSS Great Wall](https://arxiv.org/abs/1602.08498):
  H. Lietzen et al. [Huge-LQG](https://arxiv.org/abs/1211.6256): Roger G. Clowes
  et al. [Local Void](https://arxiv.org/abs/1905.08329): R. Brent Tully, Daniel
  Pomarède, Romain Graziani, Hélène M. Courtois, Yehuda Hoffman and Edward J. Shaya.
  These are externally linked published scientific figures; no blanket open
  licence is asserted for them.
- [Big Ring / Giant Arc](https://www.lancashire.ac.uk/news/big-ring-in-the-sky):
  Alexia Lopez / University of Central Lancashire; sky-illustration background:
  Stellarium. The material is labelled as a map or an illustration.
- [Hyperion](https://www.eso.org/public/images/eso1833a/):
  ESO/L. Calçada & Olga Cucciati et al., CC BY 4.0.
- [Laniakea reconstruction](https://commons.wikimedia.org/wiki/File:LaniakeaBoundaries.jpg):
  R. Brent Tully (U. Hawaii) et al., SDvision, DP, CEA/Saclay, CC BY 4.0;
  [NASA APOD source](https://apod.nasa.gov/apod/ap140910.html).
- [CfA2 and Sloan walls](https://imagine.gsfc.nasa.gov/features/cosmic/sheets_voids_info.html):
  J. Richard Gott III and Mario Jurić / NASA Imagine the Universe.
- [Boötes Void map](https://commons.wikimedia.org/wiki/File:Boovoid.png):
  Richard Powell / Atlas of the Universe, CC BY-SA 2.5; linked without modification.
- [WMAP Cold Spot](https://commons.wikimedia.org/wiki/File:ColdSpot.jpg):
  Rudnick / NRAO / AUI / NSF; NASA / WMAP, with the published spot marker.
  The source page's attribution limitations are retained; the image is not
  presented as a photograph of the Eridanus supervoid itself.

The photographed-quasar source fixture `data-tools/sky-sources/quasars.json`
retains SIMBAD source records and the astrometry/redshift publication bibcodes.
SIMBAD is operated at CDS, Strasbourg, France.

### ESA/Webb outreach observations · 8 November 2026

The separate [ESA/Webb image archive](https://esawebb.org/images/) contributes
242 frozen observation metadata records (`data-tools/sky-sources/media-webb.json`).
The source's [usage conditions](https://esawebb.org/copyright/) release images
and web text under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Full, unabridged per-image credits are preserved and displayed with the frame;
ESA, NASA, CSA, STScI and individual teams retain their stated attribution.
HTML formatting is converted to text; the game adds Russian explanations and
matches explicit source names to existing catalogue identities. The frozen
snapshot records page hashes, category/filter evidence, absent Name fields and
heading/opening evidence, and HTTP image availability. No image pixels are
bundled: frames load directly from the official ESA/Webb CDN when viewed.
Source text excerpts used to test the importer, with source URLs/hashes and
full credits, are in `data-tools/sky-sources/webb-import-checks.json`.

### Galactic-centre stellar motion · 8 November 2026

[ESO eso1825e](https://www.eso.org/public/videos/eso1825e/), “Stars orbiting the
black hole at the heart of the Milky Way”, is a 20-second VLT/NACO observational
time-lapse credited **ESO/MPE**. The video and poster load directly from ESO's
CDN; no media bytes are bundled. The gallery preserves attribution, the original
source and [ESO's CC BY 4.0 usage conditions](https://www.eso.org/public/outreach/copyright/).
The Russian caption describes the accelerated observations and does not present
them as real-time motion or a direct image of the black hole. Frozen provenance
and source-page hash are in `data-tools/sky-sources/media.json`.
