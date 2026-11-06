'use strict';
// Photographic astrometry is separate from the simulation's adopted positions.
// SIMBAD's ICRS positions have epoch J2000; DSS DATE-OBS is the exposure date.
export const DSSAstrometry = {
  astrometry: new Map(),
  plates: new Map(),
  remember(cache, key, value) {if (cache.size >= 256) cache.delete(cache.keys().next().value); cache.set(key, value);},
  url(p, format = 'gif') {
    return 'https://archive.stsci.edu/cgi-bin/dss_search?v=poss2ukstu_red&r=' + encodeURIComponent(p.raDeg) +
      '&d=' + encodeURIComponent(p.decDeg) + '&e=J2000&h=10&w=10&f=' + format + '&c=none';
  },
  direction(o) {
    const p = o.catalogAstrometry?.hyg;
    return p && Number.isFinite(p.raDeg) && Number.isFinite(p.decDeg) ? p : o;
  },
  identifier(o) {
    // Use an exact catalogue identity, never the brightest object in the field
    // or an inferred identity borrowed from another member of the system.
    for (const source of [o.stellarNameSource, o.referenceURL, o.source]) try {
      const u = new URL(source);
      if (['simbad.harvard.edu', 'simbad.cfa.harvard.edu', 'simbad.cds.unistra.fr'].includes(u.hostname)) {
        const id = u.searchParams.get('Ident');
        if (id && id.length < 160) return this.catalogueIdentifier(id);
      }
    } catch {}
    if (/^[1-9]\d*$/.test(String(o.hip || ''))) return 'HIP ' + o.hip;
    if (/^[1-9]\d*$/.test(String(o.hd || ''))) return 'HD ' + o.hd;
    const id = [o.gliese, ...(o.aliases || [])].find(id => typeof id === 'string' &&
      /^(?:(?:HIP|HD|HR|GJ|Gl|Gliese|Gaia DR[23]|2MASS|IRAS|WR|RMC|HH|TYC|UCAC[234])\s+\S|(?:WASP|HATS|HAT-P|KELT|TOI|Kepler|CoRoT|TrES|XO|TRAPPIST)-\d|OGLE-[A-Za-z0-9])/.test(id));
    return id ? this.catalogueIdentifier(id) : null;
  },
  catalogueIdentifier(id) {
    // HYG's Gl 244B and SIMBAD's GJ 244 B are the same component, not GJ 244.
    const gj = id.trim().match(/^(?:Gl|Gliese|GJ)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]*)$/);
    return gj ? 'GJ '+gj[1]+(gj[2]?' '+gj[2]:'') : id.trim();
  },
  decodeAstrometry(json, identifier) {
    if (json.data?.length !== 1) return null;
    const cols = new Map(json.metadata.map((m, i) => [m.name, {...m, value: json.data[0][i]}]));
    const get = k => cols.get(k)?.value ?? null;
    const inUnit = (k, unit) => cols.get(k)?.unit === unit ? get(k) : null;
    // Do not guess the units or the reference epoch of a different response.
    for (const k of ['ra', 'dec']) if (cols.get(k)?.unit !== 'deg' || !cols.get(k)?.utype?.includes('CT.epoch=J2000')) return null;
    for (const k of ['pmra', 'pmdec']) if (cols.get(k)?.unit !== 'mas.yr-1') return null;
    const p = {identifier, name: get('main_id'), raDeg: get('ra'), decDeg: get('dec'), epoch: 2000,
      pmRaCosDec: get('pmra'), pmDec: get('pmdec'),
      parallaxMas: inUnit('plx_value', 'mas'), radialKmS: inUnit('rvz_radvel', 'km.s-1'),
      coordinateErrorMajorMas: inUnit('coo_err_maj', 'mas'), coordinateErrorMinorMas: inUnit('coo_err_min', 'mas'),
      parallaxErrorMas: inUnit('plx_err', 'mas'), radialErrorKmS: inUnit('rvz_err', 'km.s-1'), parallaxSource: get('plx_bibcode'), radialSource: get('rvz_bibcode'),
      coordinateSource: get('coo_bibcode'), motionSource: get('pm_bibcode'),
      motionErrorMajorMasYr: inUnit('pm_err_maj', 'mas.yr-1'), motionErrorMinorMasYr: inUnit('pm_err_min', 'mas.yr-1')};
    return Number.isFinite(p.raDeg) && p.raDeg >= 0 && p.raDeg < 360 && Number.isFinite(p.decDeg) && Math.abs(p.decDeg) <= 90 ? p : null;
  },
  async resolve(o, signal) {
    const id = this.identifier(o);
    if (!id) return null;
    if (this.astrometry.has(id)) return this.astrometry.get(id);
    const query = "SELECT TOP 2 b.main_id,b.ra,b.dec,b.pmra,b.pmdec,b.plx_value,b.rvz_radvel,b.coo_bibcode,b.pm_bibcode,b.pm_err_maj,b.pm_err_min,b.coo_err_maj,b.coo_err_min,b.plx_err,b.rvz_err,b.plx_bibcode,b.rvz_bibcode FROM basic b JOIN ident i ON i.oidref=b.oid WHERE i.id='" + id.replace(/'/g, "''") + "'";
    const url = 'https://simbad.cfa.harvard.edu/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query=' + encodeURIComponent(query);
    const response = await fetch(url, {signal, credentials: 'omit'});
    if (!response.ok) throw Error('SIMBAD HTTP ' + response.status);
    const result = this.decodeAstrometry(await response.json(), id);
    this.remember(this.astrometry, id, result);
    return result;
  },
  at(p, year) {
    if (![p.pmRaCosDec, p.pmDec, year].every(Number.isFinite)) return null;
    const rad = Math.PI / 180, a = p.raDeg * rad, d = p.decDeg * rad, dt = year - p.epoch,
      mas = rad / 3600000, u = [Math.cos(d)*Math.cos(a), Math.cos(d)*Math.sin(a), Math.sin(d)],
      east = [-Math.sin(a), Math.cos(a), 0], north = [-Math.sin(d)*Math.cos(a), -Math.sin(d)*Math.sin(a), Math.cos(d)],
      radial = p.parallaxMas > 0 && Number.isFinite(p.radialKmS) ? p.radialKmS * 31557600 / (1000 / p.parallaxMas * 3.0856775814913673e13) : 0,
      v = u.map((x, i) => x*(1 + dt*radial) + dt*mas*(p.pmRaCosDec*east[i] + p.pmDec*north[i])), length = Math.hypot(...v);
    return {raDeg: (Math.atan2(v[1], v[0]) / rad + 360) % 360, decDeg: Math.asin(v[2] / length) / rad};
  },
  header(bytes) {
    const h = {}, text = new TextDecoder('ascii').decode(bytes);
    for (let i = 0; i + 80 <= text.length; i += 80) {
      const card = text.slice(i, i + 80), key = card.slice(0, 8).trim();
      if (key === 'END') return h;
      if (card[8] !== '=') continue;
      const value = card.slice(10).trim();
      h[key] = value[0] === "'" ? value.match(/^'((?:[^']|'')*)'/)?.[1].replace(/''/g, "'").trim() : Number(value.split('/')[0].trim().replace(/D/gi, 'e'));
    }
    return null;
  },
  plate(h) {
    // DATE is the download/creation date, never the epoch of the photograph.
    const raw = h?.['DATE-OBS'], day = typeof raw === 'string' ? raw.slice(0,10) : '',
      midday = /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(day+'T12:00:00Z') : NaN;
    if (!Number.isFinite(midday) || new Date(midday).toISOString().slice(0,10) !== day) return null;
    // Some original DSS headers have invalid clock minutes (e.g. 07:80).
    // Retain the known exposure day; do not pretend its clock time is measured.
    const exact = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?$/.test(raw) ? Date.parse(raw+'Z') : NaN,
      timeKnown = Number.isFinite(exact), time = timeKnown ? exact : midday, date = timeKnown ? raw : day;
    if (!Number.isFinite(time) || !(h.NAXIS1 > 0 && h.NAXIS2 > 0) || h.EQUINOX !== 2000 || h.CTYPE1 !== 'RA---TAN' || h.CTYPE2 !== 'DEC--TAN') return null;
    const matrix = ['CD1_1', 'CD1_2', 'CD2_1', 'CD2_2'].map(k => h[k]);
    if (!['CRPIX1', 'CRPIX2', 'CRVAL1', 'CRVAL2'].every(k => Number.isFinite(h[k])) || !matrix.every(Number.isFinite)) return null;
    if (Math.abs(matrix[0]*matrix[3] - matrix[1]*matrix[2]) < 1e-16) return null;
    return {header: h, id: h.PLATEID, date, timeKnown, year: 2000 + (time - Date.UTC(2000, 0, 1, 12)) / 31557600000, width: h.NAXIS1, height: h.NAXIS2};
  },
  async readPlate(p, signal) {
    const url = this.url(p, 'fits');
    if (this.plates.has(url)) return this.plates.get(url);
    const response = await fetch(url, {signal, credentials: 'omit'});
    if (!response.ok) throw Error('DSS HTTP ' + response.status);
    const reader = response.body.getReader();
    let bytes = new Uint8Array(0);
    try {
      // Only the header is needed. Stop before downloading the image array.
      while (bytes.length < 262144) {
        const {value, done} = await reader.read();
        if (value) {const next = new Uint8Array(bytes.length + value.length); next.set(bytes); next.set(value, bytes.length); bytes = next;}
        const header = this.header(bytes);
        if (header) {const plate = this.plate(header); if (!plate) throw Error('DSS astrometry unavailable'); this.remember(this.plates, url, plate); return plate;}
        if (done) break;
      }
      throw Error('DSS FITS header unavailable');
    } finally {await reader.cancel();}
  },
  pixel(plate, p) {
    const h = plate.header, rad = Math.PI / 180, a = (p.raDeg-h.CRVAL1)*rad, d = p.decDeg*rad, d0 = h.CRVAL2*rad,
      den = Math.sin(d0)*Math.sin(d) + Math.cos(d0)*Math.cos(d)*Math.cos(a);
    if (!(den > 0)) return null;
    const x = Math.cos(d)*Math.sin(a)/den/rad, y = (Math.cos(d0)*Math.sin(d)-Math.sin(d0)*Math.cos(d)*Math.cos(a))/den/rad,
      det = h.CD1_1*h.CD2_2-h.CD1_2*h.CD2_1,
      px = h.CRPIX1-.5+(h.CD2_2*x-h.CD1_2*y)/det, py = plate.height+.5-h.CRPIX2-(-h.CD2_1*x+h.CD1_1*y)/det;
    return px >= 0 && px < plate.width && py >= 0 && py < plate.height ? {x:px,y:py} : null;
  },
  northAngle(plate) {
    const h=plate.header, det=h.CD1_1*h.CD2_2-h.CD1_2*h.CD2_1;
    return Math.atan2(-h.CD1_2/det,h.CD1_1/det)*180/Math.PI;
  },
  async calibrate(o, signal) {
    let source = null;
    try {source = await this.resolve(o, signal);} catch (error) {if (signal.aborted) throw error;}
    const start = source || this.direction(o);
    let position = start, plate = await this.readPlate(start, signal);
    if (!source || !this.at(source, plate.year)) return {url: this.url(start), plate, source, marker: null};
    // Crossing a plate boundary can change DATE-OBS. Check the actual final
    // cutout, rather than applying the first exposure date to another plate.
    for (let n = 0; n < 3; n++) {
      position = this.at(source, plate.year);
      const final = await this.readPlate(position, signal);
      if (final.date === plate.date) return {url: this.url(position), plate: final, source, marker: this.pixel(final, position)};
      plate = final;
    }
    return {url: this.url(position), plate, source, marker: null};
  },
};
