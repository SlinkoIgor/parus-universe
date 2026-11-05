#!/usr/bin/env python3
"""Rebuild the additive stellar identity/multiplicity layer, without network I/O.

Source rows and their units are preserved in stellar-sources/. ORB6 astrometric
photocentre/planet fits are deliberately not interpreted as relative star orbits.
"""
import hashlib
import json
import math
import os
import pathlib
import re
import sys
from urllib.parse import quote
from stellar_base import validate as validate_base

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / 'data-tools/stellar-sources'
read = lambda name: json.loads((SRC / name).read_text())
selection = read('catalog-selection.json')
identities = read('simbad-identities.json')
catalogs = read('orbit-catalogs.json')
sources = read('sources.json')


def write(path, content):
    if path.exists() and path.read_text() == content:
        return
    temp = path.with_name(path.name + '.' + str(os.getpid()) + '.tmp')
    temp.write_text(content)
    temp.replace(path)
PC = 3.2615637771674336
AU = 1 / 63241.077
EPOCH = 2026.81
MATRIX = [[-.0548755604162154, -.8734370902348850, -.4838350155487132],
          [.4941094278755837, -.4448296299600112, .7469822444972189],
          [-.8676661490190047, -.1980763734312015, .4559837761750669]]
SIMBAD = 'https://simbad.harvard.edu/simbad/sim-id?Ident='
ORB6 = 'https://www.astro.gsu.edu/wds/orb6.html'
MSC = 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/235/6'
SB9 = 'https://cdsarc.cds.unistra.fr/viz-bin/cat/B/sb9'


def norm(s):
    return re.sub(r'[^a-z0-9+.-]', '', str(s).lower().replace('gl ', 'gj '))


def number(s):
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def sky(ra, dec, d):
    ra, dec = math.radians(ra), math.radians(dec)
    v = [d * math.cos(ra) * math.cos(dec), d * math.sin(ra) * math.cos(dec), d * math.sin(dec)]
    return [sum(x * y for x, y in zip(row, v)) for row in MATRIX]


def orbit_vector(q, E):
    w, node, inc, ra, dec = map(math.radians, [q['omega'], q['node'], q['i'], q['raDeg'], q['decDeg']])
    x, y = q['a'] * (math.cos(E) - q['e']), q['a'] * math.sqrt(1 - q['e']**2) * math.sin(E)
    u, v = x * math.cos(w) - y * math.sin(w), x * math.sin(w) + y * math.cos(w)
    east, north, depth = u * math.sin(node) + v * math.cos(node) * math.cos(inc), u * math.cos(node) - v * math.sin(node) * math.cos(inc), v * math.sin(inc)
    icrs = [-math.sin(ra) * east - math.sin(dec) * math.cos(ra) * north + math.cos(dec) * math.cos(ra) * depth,
            math.cos(ra) * east - math.sin(dec) * math.sin(ra) * north + math.cos(dec) * math.sin(ra) * depth,
            math.cos(dec) * north + math.sin(dec) * depth]
    return [sum(x * y for x, y in zip(row, icrs)) * AU for row in MATRIX]


def phase(q):
    M = (EPOCH - q['peri']) / q['period'] * 2 * math.pi % (2 * math.pi)
    lo, hi, E = 0, 2 * math.pi, M
    for _ in range(80):
        f = E - q['e'] * math.sin(E) - M
        if abs(f) < 1e-14:
            break
        if f > 0:
            hi = E
        else:
            lo = E
        trial = E - f / (1 - q['e'] * math.cos(E))
        E = trial if lo < trial < hi else (lo + hi) / 2
    return E


constellations = dict(zip(
    'And Ant Aps Aqr Aql Ara Ari Aur Boo Cae Cam Cnc CVn CMa CMi Cap Car Cas Cen Cep Cet Cha Cir Col Com CrA CrB Crt Cru Crv Cyg Del Dor Dra Equ Eri For Gem Gru Her Hor Hya Hyi Ind Lac Leo LMi Lep Lib Lup Lyn Lyr Men Mic Mon Mus Nor Oct Oph Ori Pav Peg Per Phe Pic Psc PsA Pup Pyx Ret Sge Sgr Sco Scl Sct Ser Sex Tau Tel TrA Tri Tuc UMa UMi Vel Vir Vol Vul'.split(),
    ['Андромеды', 'Насоса', 'Райской Птицы', 'Водолея', 'Орла', 'Жертвенника', 'Овна', 'Возничего', 'Волопаса', 'Резца', 'Жирафа', 'Рака', 'Гончих Псов', 'Большого Пса', 'Малого Пса', 'Козерога', 'Киля', 'Кассиопеи', 'Центавра', 'Цефея', 'Кита', 'Хамелеона', 'Циркуля', 'Голубя', 'Волос Вероники', 'Южной Короны', 'Северной Короны', 'Чаши', 'Южного Креста', 'Ворона', 'Лебедя', 'Дельфина', 'Золотой Рыбы', 'Дракона', 'Малого Коня', 'Эридана', 'Печи', 'Близнецов', 'Журавля', 'Геркулеса', 'Часов', 'Гидры', 'Южной Гидры', 'Индейца', 'Ящерицы', 'Льва', 'Малого Льва', 'Зайца', 'Весов', 'Волка', 'Рыси', 'Лиры', 'Столовой Горы', 'Микроскопа', 'Единорога', 'Мухи', 'Наугольника', 'Октанта', 'Змееносца', 'Ориона', 'Павлина', 'Пегаса', 'Персея', 'Феникса', 'Живописца', 'Рыб', 'Южной Рыбы', 'Кормы', 'Компаса', 'Сетки', 'Стрелы', 'Стрельца', 'Скорпиона', 'Скульптора', 'Щита', 'Змеи', 'Секстанта', 'Тельца', 'Телескопа', 'Южного Треугольника', 'Треугольника', 'Тукана', 'Большой Медведицы', 'Малой Медведицы', 'Парусов', 'Девы', 'Летучей Рыбы', 'Лисички']))
greek = dict(zip('alf alp bet gam del eps zet eta tet the iot kap lam mu nu ksi xi omi pi rho sig tau ups phi khi chi psi ome'.split(),
                 'Альфа Альфа Бета Гамма Дельта Эпсилон Дзета Эта Тета Тета Йота Каппа Лямбда Мю Ню Кси Кси Омикрон Пи Ро Сигма Тау Ипсилон Фи Хи Хи Пси Омега'.split()))
traditional = {'Wolf': 'Вольф', 'Ross': 'Росс', 'Lalande': 'Лаланд', 'Lacaille': 'Лакайль', 'Struve': 'Струве',
               'Groombridge': 'Грумбридж', 'Kruger': 'Крюгер', 'Krüger': 'Крюгер', 'Luyten': 'Лейтен', 'VB': 'Ван Бисбрук'}
translations = {'Sirius': 'Сириус', 'Procyon': 'Процион', 'Capella': 'Капелла', "Luyten's Star": 'Звезда Лейтена',
                "Kapteyn's Star": 'Звезда Каптейна', "Van Maanen's Star": 'Звезда ван Маанена',
                'Alula Australis': 'Алула Южная', 'Porrima': 'Поррима', 'Keid': 'Кейд', 'Achird': 'Ахирд'}
alias_index = {}
for identity in identities:
    for alias in identity['ids'].split('|'):
        alias_index.setdefault(norm(alias), identity)


def match(o):
    # Exact identifiers, with HIP first; never transfer a nearby star's name.
    aliases = o.get('aliases', [])
    for a in sorted(aliases, key=lambda a: not a.startswith('HIP ')) + [o['name']]:
        if norm(a) in alias_index:
            return alias_index[norm(a)]


def bayer(s):
    s = re.sub(r'^\*\s*', '', s).strip()
    m = re.fullmatch(r'(?:\d+\s*)?([A-Za-z]+)(\d{0,2})\s+([A-Za-z]{3})(?:\s*([ABCabc]{1,2}))?', s)
    if not m or m[3] not in constellations:
        m = re.fullmatch(r'(\d+)\s+([A-Za-z]{3})(?:\s*([ABCD]{1,2}))?', s)
        return (m[1] + ' ' + constellations[m[2]] + (' ' + m[3] if m[3] else '')) if m and m[2] in constellations else None
    token = greek.get(m[1].lower(), m[1])
    if m[1].lower() not in greek and len(m[1]) > 1:
        return None
    index = str(int(m[2])) if m[2] else ''
    return token + index + ' ' + constellations[m[3]] + (' ' + m[4] if m[4] else '')


def human_name(o):
    original = re.sub(r'\s+', ' ', o['name']).strip()
    identity = match(o)
    aliases = identity['ids'].split('|') if identity else []
    for candidate in [original, *aliases]:
        m = re.fullmatch(r'(Wolf|Ross|Lalande|Lacaille|Struve|Groombridge|Kruger|Krüger|Luyten|VB)\s+(\d+)(?:\s+([ABCD]))?', candidate)
        if m:
            return traditional[m[1]] + ' ' + m[2] + (' ' + m[3] if m[3] else ''), 'traditional-designation', aliases
    gould = re.fullmatch(r'(\d+)\s+G\.\s+([A-Za-z]{3})', original)
    if gould and gould[2] in constellations:
        return gould[1] + ' G. ' + constellations[gould[2]], 'Gould-designation', aliases
    if original == 'p Eridani':
        return 'p Эридана', 'Bayer-Flamsteed', aliases
    # Preserve the existing chosen proper name (IAU names can be non-English).
    catalog_code = bool(re.match(r'^(?:Gl|GJ|HIP|HYG|HD|HR|G |\d|[A-Za-z]{3}\d|[A-Za-z]+\d)', original))
    if not catalog_code and not re.fullmatch(r'[A-Za-z]{1,3}\s+[A-Za-z]{3}', original):
        return translations.get(original, original), 'existing-name', aliases
    for candidate in aliases:
        if candidate.startswith('NAME '):
            value = candidate[5:]
            for name, translated in translations.items():
                if value == name or value.startswith(name + ' '):
                    return translated + value[len(name):], 'SIMBAD-name', aliases
    # Common surname designations (including their numbers) are valid names.
    for candidate in [original, *aliases]:
        m = re.fullmatch(r'(Wolf|Ross|Lalande|Lacaille|Struve|Groombridge|Kruger|Krüger|Luyten|VB)\s+(\d+)(?:\s+([ABCD]))?', candidate)
        if m:
            return traditional[m[1]] + ' ' + m[2] + (' ' + m[3] if m[3] else ''), 'traditional-designation', aliases
    for candidate in [original, *(a for a in aliases if a.startswith('* '))]:
        value = bayer(candidate)
        if value:
            return value, 'Bayer-Flamsteed', aliases
    for candidate in [original, *aliases]:
        candidate = re.sub(r'^V\*\s+', '', candidate)
        m = re.fullmatch(r'([A-Z]{1,2}|V\d+)\s+([A-Za-z]{3})', candidate)
        if m and m[2] in constellations:
            return m[1] + ' ' + constellations[m[2]], 'variable-star', aliases
    return original, 'catalogue-designation', aliases


objects = {o['id']: o for o in selection['targets']}
for row in selection['catalogRows']:
    objects.setdefault(row[0], dict(id=row[0], name=row[1], d=row[3], raDeg=row[4], decDeg=row[5], aliases=row[8], apparentV=row[9], **row[11]))
names = {}
for id, o in objects.items():
    name, basis, aliases = human_name(o)
    identity = match(o)
    names[id] = dict(name=name, basis=basis, aliases=list(dict.fromkeys([o['name'], *o.get('aliases', []), *aliases])),
                     source=SIMBAD + quote(str(identity['main_id']), safe='') if identity else 'https://github.com/astronexus/HYG-Database')

msc = catalogs['msc']
components = msc['J/ApJS/235/6/catalog']
msc_pairs = msc['J/ApJS/235/6/systems']
msc_orbits = msc['J/ApJS/235/6/orbits']
orb6 = catalogs['orb6']
original_by_member = {id: s for s in selection['originalSystems'] for id in s['members']}
groups = {}
singles = []
for id in selection['localTargets']:
    o = objects[id]
    identity = match(o)
    hips = {a[4:].strip() for a in o.get('aliases', []) if a.startswith('HIP ')}
    wds = next((r['ID'] for r in components if r['HIP'] and r['HIP'] in hips), None)
    if not wds:
        wds = next((r['wds'] for r in orb6 if r['hip'] in hips and r['grade'] not in ('7', '9')), None)
    original = original_by_member.get(id)
    exact_ids = {norm(a) for a in o.get('aliases', []) + (identity['ids'].split('|') if identity else []) if norm(a)}
    if not wds:
        wds = next((r['ID'] for r in components if
                    (r['HD'] and norm('HD ' + r['HD']) in exact_ids) or
                    any(norm(a.replace('_', ' ')) in exact_ids for a in r['OID'].split(', ') if norm(a))), None)
    if not wds and identity:
        wds = next((m[1] for a in identity['ids'].split('|') if (m := re.match(r'WDS J(\d{5}[+-]\d{4})', a))
                    and (original or any(r['ID'] == m[1] for r in msc_pairs))), None)
    if not wds and id in catalogs.get('sb9Targets', {}):
        wds = 'SB9-' + catalogs['sb9Targets'][id]
    if not wds:
        singles.append(dict(id=id, status='no-confirmed-stellar-companion-in-screened-sources', sources=[MSC, ORB6, SB9]))
        continue
    if wds == '14396-6050':
        # Keep the more precise, separately audited Alpha Cen model.
        continue
    g = groups.setdefault(wds, dict(targets=[], original=original))
    g['targets'].append(id)
    if original:
        g['original'] = original


def convert_orbit(r, distance, ra, dec):
    fields = ['period', 'aArcsec', 'inclination', 'node', 'peri', 'e', 'omega']
    missing = [k for k in fields if number(r.get(k)) is None]
    if r['grade'] == '9':
        return None, ['relative-orbit: astrometric photocentre, possible planet']
    if missing:
        return None, missing
    p, a, inc, node, peri, e, omega = [number(r[k]) for k in fields]
    if not (p > 0 and a > 0 and 0 <= e < 1 and 0 <= inc <= 180):
        return None, ['non-elliptic-or-invalid-elements']
    factor = {'a': 1, 'm': .001, 'M': 60, 'u': .000001}.get(r['aUnit'])
    p_factor = {'y': 1, 'd': 1 / 365.25, 'c': 100}.get(r['periodUnit'])
    if factor is None or p_factor is None:
        return None, ['unknown-unit']
    # ORB6 T0 is a Besselian year, truncated JD, MJD, or centuries.
    peri_unit = r['periUnit']
    jd = 2415020.31352 + (peri - 1900) * 365.242198781 if peri_unit == 'y' else peri + 2400000 + (.5 if peri_unit == 'm' else 0)
    if peri_unit == 'c':
        jd = 2415020.31352 + (peri * 100 - 1900) * 365.242198781
    if peri_unit not in ('y', 'c', 'd', 'm'):
        return None, ['unknown-periastron-unit']
    q = dict(period=p * p_factor, a=a * factor * distance / PC, e=e, i=inc, node=node, omega=omega,
             peri=2000 + (jd - 2451545) / 365.25, raDeg=ra, decDeg=dec, grade=int(r['grade']),
             source=ORB6, reference=r['reference'], original=r,
             uncertainty={k: number(r.get(k)) for k in ['periodError', 'aError', 'inclinationError', 'nodeError', 'periError', 'eError', 'omegaError']},
             note='Относительная визуальная орбита ORB6. Формальные ошибки сохранены в исходных единицах. Для чисто визуальной орбиты знак глубины неоднозначен на 180°. Прямолинейное движение системы и взаимодействия тел не интегрируются.')
    return q, []


systems, extra_objects, rejected = [], [], []
for wds, group in sorted(groups.items()):
    original = group['original']
    primary = objects.get(original['primary']) if original else None
    primary = primary or objects[group['targets'][0]]
    if primary['id'] not in names:
        n, b, aliases = human_name(primary)
        names[primary['id']] = dict(name=n, basis=b, aliases=aliases, source=MSC)
    stem = re.sub(r'\s+[ABCD](?:[ab])?$', '', names[primary['id']]['name'])
    if wds == '16555-0820':
        stem = 'Вольф 630'
    rows = [r for r in msc_pairs if r['ID'] == wds]
    accepted = [r for r in rows if r['Type'] != 'X' and 'planet' not in r['Comm'].lower() and
                ('?' not in r['Type']) and re.search(r'[CVAS]', r['Type'])]
    for r in rows:
        if r not in accepted:
            rejected.append(dict(wds=wds, pair=r['Prim'] + ',' + r['Sec'], type=r['Type'], reason=r['Comm']))
    pairs = [dict(primary=r['Prim'], secondary=r['Sec'], parent=r['Parent'], source=MSC, original=r,
                  massFraction=number(r['Mass2']) / (number(r['Mass1']) + number(r['Mass2'])) if number(r['Mass1']) and number(r['Mass2']) else 0,
                  massRatioBasis='MSC individual estimates; estimation codes preserved, not assigned as measured stellar masses') for r in accepted]
    for p in pairs:
        if p['parent'] != '*' and not re.fullmatch(r'[A-Z][A-Za-z]*', p['parent']):
            # MSC's lower-case 't' flags a non-hierarchical/tidal relationship,
            # not a component named t. Keep the flag in the original row.
            p['parent'] = p['primary'] + p['secondary']
    if not pairs:
        pairs = [dict(primary='A', secondary='B', parent='*', source=SB9 if wds.startswith('SB9-') else ORB6, massFraction=0, massRatioBasis='Unknown mass ratio: relative secondary orbit; primary recoil not modelled')]
    mass_model = catalogs.get('orbitalMasses', {}).get(wds)
    if mass_model:
        for p in pairs:
            if p['primary'] == 'A' and p['secondary'] == 'B':
                p['massFraction'] = mass_model['secondary'] / (mass_model['primary'] + mass_model['secondary'])
                p['massRatioBasis'] = mass_model
    # Root is often named '*' or AB; lower-level parents identify the tree.
    split = {p['parent']: p for p in pairs if p['parent'] != '*'}
    root = next((p for p in pairs if p['parent'] == '*'), None)
    if not root:
        children = {p[k] for p in pairs for k in ('primary', 'secondary')}
        root = next((p for p in pairs if p['parent'] not in children), pairs[0])
    split['*'] = root

    def leaves(label, seen=None):
        seen = set() if seen is None else seen
        if label in seen:
            raise ValueError('Cyclic source hierarchy ' + wds)
        p = split.get(label)
        return leaves(p['primary'], seen | {label}) + leaves(p['secondary'], seen | {label}) if p else [label]

    labels = leaves('*')
    # ORB6 uses Aa,Ab for the Capella giants; MSC calls them A,B.
    by_pair = {}
    for r in orb6:
        if r['wds'] != catalogs.get('wdsAliases', {}).get(wds, wds):
            continue
        designation = r['designation']
        tail = re.search(r'([A-Z][a-z]?,[A-Z][a-z]?|[A-Z],[A-Z]{2}|[A-Z]{2})$', designation)
        pair = tail[1] if tail else 'A,B'
        if ',' not in pair and len(pair) == 2:
            pair = ','.join(pair)
        if wds == '05167+4600' and pair == 'Aa,Ab':
            pair = 'A,B'
        by_pair.setdefault(pair, []).append(r)
    for p in pairs:
        options = by_pair.get(p['primary'] + ',' + p['secondary'], [])
        if not options and len(pairs) == 1 and p['primary'] == 'A' and p['secondary'] == 'B':
            # A resolved binary's orbit can use Aa,Ab when A denotes the
            # unresolved catalogued source. There is no separate outer AB here.
            options = by_pair.get('Aa,Ab', [])
        # Never choose a photocentre solution over a resolved relative orbit.
        options.sort(key=lambda r: (r['grade'] in ('7', '9'), int(r['grade'] or 9), r['reference']))
        p['orbit'] = None
        p['missingElements'] = []
        for r in options:
            q, missing = convert_orbit(r, primary['d'], primary['raDeg'], primary['decDeg'])
            if q:
                p['orbit'] = q
                break
            p['missingElements'] = missing
            p['partialOrbit'] = r
        if not options:
            p['missingElements'] = ['published-relative-orbit']
            partial = next((r for r in msc_orbits if r['ID'] == wds and r['Syst'] == p['primary'] + ',' + p['secondary']), None)
            if partial:
                p['partialOrbit'] = partial
        if wds.startswith('SB9-'):
            options_sb9 = [r for r in catalogs['sb9']['B/sb9/orbits'] if r['Seq'] == wds[4:]]
            if options_sb9:
                p['partialOrbit'] = dict(max(options_sb9, key=lambda r: int(r['o'])), x_Per='d')
                p['missingElements'] = ['aArcsec', 'inclination', 'node']
    # HYG suffixes refer to resolved components; split a source aggregate only
    # through a confirmed published hierarchy. Preserve the old ID for its main leaf.
    mapping, unresolved = {}, set()
    old_members = [objects[id] for id in original['members'] if id in objects] if original else [primary]
    for index, o in enumerate(old_members):
        suffix = next((m[1] for a in o.get('aliases', []) if (m := re.fullmatch(r'(?:Gl|GJ)\s*\d+(?:\.\d+)?\s*([A-Z])', a))), None)
        suffix = suffix or ('A' if o['id'] == primary['id'] else chr(65 + index))
        if wds == '16555-0820' and suffix == 'C':
            suffix = 'F'  # GJ 644 C = VB 8 = WDS F; WDS C is GJ 643.
        candidates = leaves(suffix)
        label = candidates[0]
        if label in labels and label not in mapping:
            mapping[label] = o['id']
            if len(candidates) > 1:
                unresolved.add(o['id'])
    # Reuse an existing full-catalogue identity for a wide companion even if
    # HYG did not put it in this system (e.g. GJ 643 beside GJ 644).
    for label in labels:
        if label in mapping:
            continue
        cr = next((r for r in components if r['ID'] == wds and r['m_ID'] == label), None)
        if not cr:
            continue
        aliases = cr['OID'].replace('_', ' ').split(', ')
        if cr['HIP']:
            aliases.insert(0, 'HIP ' + cr['HIP'])
        resolved_aliases = set(norm(a) for a in aliases if norm(a))
        for alias in aliases:
            identity = alias_index.get(norm(alias))
            if identity and abs(identity['ra'] - float(cr['RAJ2000'])) * math.cos(math.radians(float(cr['DEJ2000']))) < .02 and abs(identity['dec'] - float(cr['DEJ2000'])) < .02:
                resolved_aliases.update(norm(a) for a in identity['ids'].split('|') if norm(a))
        candidates = [o for o in objects.values() if o['id'] not in mapping.values() and number(o.get('raDeg')) is not None and number(o.get('decDeg')) is not None and
                      abs(o['raDeg'] - float(cr['RAJ2000'])) * math.cos(math.radians(float(cr['DEJ2000']))) < .02 and
                      abs(o['decDeg'] - float(cr['DEJ2000'])) < .02 and
                      any(norm(a) in resolved_aliases for a in o.get('aliases', []) if norm(a))]
        if len(candidates) == 1:
            mapping[label] = candidates[0]['id']
    for label in labels:
        mapping.setdefault(label, 'stellar-' + wds + '-' + label)
    comp_rows = {r['m_ID']: r for r in components if r['ID'] == wds}
    positions = {}
    anchor = primary.get('p3') or sky(primary['raDeg'], primary['decDeg'], primary['d'])

    def place(label, center):
        p = split.get(label)
        if p:
            if p['orbit']:
                v = orbit_vector(p['orbit'], phase(p['orbit']))
                f = p['massFraction']
                ca = [x - f * y for x, y in zip(center, v)]
                cb = [x + (1 - f) * y for x, y in zip(center, v)]
            else:
                ca, cb = center, center
                cr = comp_rows.get(p['secondary'])
                row = p.get('original')
                if cr and number(cr['RAJ2000']) is not None:
                    cb = sky(float(cr['RAJ2000']), float(cr['DEJ2000']), primary['d'])
                elif row and 'C' in row['Type'] and number(row['Sep']) and number(row['PA']) is not None and row['x_Sep'] == '"':
                    # Observed sky separation, common adopted distance, unknown
                    # individual depth. This is not a fitted orbital ellipse.
                    theta = math.radians(float(row['PA']))
                    dr = float(row['Sep']) / 3600
                    direction = sky(primary['raDeg'] + dr * math.sin(theta) / math.cos(math.radians(primary['decDeg'])), primary['decDeg'] + dr * math.cos(theta), primary['d'])
                    origin = sky(primary['raDeg'], primary['decDeg'], primary['d'])
                    cb = [x + y - z for x, y, z in zip(center, direction, origin)]
            place(p['primary'], ca)
            place(p['secondary'], cb)
        else:
            positions[label] = center

    place('*', anchor)
    # Retain the adopted primary position exactly; the remaining positions are
    # sourced relative orbital offsets, with the same shared-distance systematic.
    delta = [anchor[i] - positions[labels[0]][i] for i in range(3)]
    for label in positions:
        positions[label] = [x + y for x, y in zip(positions[label], delta)]
    members = []
    for label in labels:
        id = mapping[label]
        existing = objects.get(id)
        cr = comp_rows.get(label)
        # Alternative names of individual wide companions are not inherited
        # from their host: WDS C/F in the Gl 644 quintuple are distinct examples.
        individual = None
        if cr:
            for alias in cr['OID'].replace('_', ' ').split(', '):
                if norm(alias) in alias_index:
                    candidate = alias_index[norm(alias)]
                    if abs(candidate['ra'] - float(cr['RAJ2000'])) * math.cos(math.radians(float(cr['DEJ2000']))) < .02 and abs(candidate['dec'] - float(cr['DEJ2000'])) < .02:
                        individual = candidate
                        break
        name = stem + ' ' + label
        if wds == '16555-0820' and label in ('C', 'F'):
            name = 'Вольф 629' if label == 'C' else 'Ван Бисбрук 8'
        if id == primary['id'] and len(labels) == 2:
            name = stem + ' A'
        aliases = names.get(id, {}).get('aliases', []) + ([*individual['ids'].split('|')] if individual else [])
        aliases = list(dict.fromkeys([name, *(existing.get('aliases', []) if existing else []), *aliases]))
        names[id] = dict(name=name, basis='published-system-component', aliases=aliases, source=MSC if rows else SB9 if wds.startswith('SB9-') else ORB6)
        p3 = positions[label]
        spectral = cr['SpT'] if cr else ''
        pair_spectrum = next((p['original'].get('SpT1' if p['primary'] == label else 'SpT2', '') for p in pairs
                              if p.get('original') and label in (p['primary'], p['secondary'])), '')
        spectral = spectral or pair_spectrum
        if re.match(r'^[LTY]\d', spectral):
            component_type = 'Коричневый карлик · ' + spectral
        elif '?' in spectral:
            component_type = 'Компаньон · природа не установлена (' + spectral + ')'
        else:
            component_type = 'Звезда · ' + (spectral or 'компонент системы')
        coordinate_note = 'Компонент опубликованной системы. Общая дальность принята по основной звезде; индивидуальная глубина не измерена. Положение по известным относительным орбитам на эпоху 2026,81; без полной орбиты используется наблюдаемое направление или неразрешённое положение родителя. Собственное движение центра системы не интегрируется.'
        o = dict(id=id, name=name, kind='star', type=component_type if not existing or id in unresolved else existing.get('type') or component_type,
                 p3=p3, d=math.hypot(*p3), raDeg=(existing or {}).get('raDeg', float(cr['RAJ2000']) if cr else primary['raDeg']),
                 decDeg=(existing or {}).get('decDeg', float(cr['DEJ2000']) if cr else primary['decDeg']),
                 aliases=aliases, apparentV=(existing or {}).get('apparentV', number(cr['Vmag']) if cr else None),
                 stellarSystem='stellar-system-' + wds, stellarComponent=label, coordinateModel='published-stellar-systems-v1',
                 boundSystemPrimary=primary['id'] if id != primary['id'] else None, unresolvedSourcePhotometry=id in unresolved,
                 coordinateNote=coordinate_note, source=MSC if rows else SB9 if wds.startswith('SB9-') else ORB6,
                 sourcePosition={k: existing[k] for k in ('p3', 'd', 'raDeg', 'decDeg', 'parallaxMas', 'parallaxErrorMas', 'distanceRelativeError', 'uncertaintyMatched', 'astrometrySource') if k in existing} if existing else None,
                 positionQuality='approximate', atlasOnly=False, navigable=True, streamed=False)
        if id != primary['id']:
            o.update(uncertaintyMatched=False, distanceRelativeError=None,
                     astrometrySource='Published relative geometry at the primary distance; individual distance error unknown')
        extra_objects.append(o)
        members.append(id)
    for p in pairs:
        assert all(l in mapping for l in leaves(p['primary']) + leaves(p['secondary'])), (wds, labels, p)
        p['primaryMembers'] = [mapping[l] for l in leaves(p['primary'])]
        p['secondaryMembers'] = [mapping[l] for l in leaves(p['secondary'])]
    separation = max(math.dist(positions[a], positions[b]) for a in labels for b in labels)
    system = dict(id='stellar-system-' + wds, wds=wds, name=stem, members=members, primary=mapping[labels[0]], pairs=pairs, separationLy=separation,
                  originalSystemIds=[original['id']] if original else [], stellarEnriched=True,
                  source=MSC if rows else SB9 if wds.startswith('SB9-') else ORB6, note='Иерархия опубликованных компонентов. На карте показаны только относительные орбиты с полным набором элементов; неизвестные орбиты не заменяются прямыми линиями. Кеплеровы орбиты — кинематическая модель без возмущений и движения центра системы.',
                  sourceNotes=[r for r in msc['J/ApJS/235/6/notes'] if r['ID'] == wds])
    systems.append(system)

data = dict(version=1, baseCatalogRevision=selection['catalogRevision'], epoch=EPOCH, names=names, objects=extra_objects,
            systems=systems, auditTargets=selection['localTargets'], singleScreening=singles, rejected=rejected,
            sources=sources['sources'],
            limitations='Сопоставление имён охватывает исходные звёзды основного набора. Проверка кратности ограничена ближайшим набором и Gl 644; MSC/ORB6 не гарантируют отсутствие неизвестных компаньонов. Пустые элементы и параметры фотометрического центра не превращаются в относительные орбиты. Для широких пар индивидуальные глубины и орбиты часто неизвестны.')
data['newObjectCount'] = sum(o['id'].startswith('stellar-') for o in extra_objects)
path = ROOT / 'dist/catalog-extended.js'
text = path.read_text()
boot = json.loads(text.split('=', 1)[1].rstrip(';\n'))
if boot['revision'] != data['baseCatalogRevision']:
    validation = dict(revision=boot['revision'], selectionSha256=hashlib.sha256((SRC / 'catalog-selection.json').read_bytes()).hexdigest(),
                      policy='Exact source identities and unchanged adopted astrometry of all modelled systems')
    if len(sys.argv) == 3 and sys.argv[1] == '--validate-base':
        candidate = json.loads(pathlib.Path(sys.argv[2]).read_text())
        assert candidate['revision'] == boot['revision']
        validate_base(selection, candidate['objects'])
    elif boot.get('stellarCatalog', {}).get('baseValidation') != validation:
        raise ValueError('Base revision changed: validate fresh identities/astrometry with --validate-base, or re-audit stellar-sources/catalog-selection.json')
    data['baseCatalogRevision'] = boot['revision']
    data['baseValidation'] = validation
data['revision'] = hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]
boot['stellarCatalog'] = data
write(path, text.split('=', 1)[0] + '=' + json.dumps(boot, ensure_ascii=False, separators=(',', ':')) + ';\n')
write(ROOT / 'data-tools/stellar-catalog.json', json.dumps(data, ensure_ascii=False, indent=2) + '\n')
original_ids = {o['id'] for o in selection['targets']}
audit = dict(revision=data['revision'], names=len(names), originalTargets=len(selection['targets']), localTargets=len(selection['localTargets']),
             systems=len(systems), systemComponents=len(extra_objects), promotedOrNew=sum(o['id'] not in original_ids for o in extra_objects),
             fullRelativeOrbits=sum(bool(p['orbit']) for s in systems for p in s['pairs']),
             incompletePairs=[dict(system=s['name'], pair=p['primary'] + ',' + p['secondary'], missing=p['missingElements']) for s in systems for p in s['pairs'] if not p['orbit']],
             singles=singles, rejected=rejected, limitations=data['limitations'])
write(ROOT / 'data-tools/stellar-catalog-audit.json', json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in audit.items() if k not in ('incompletePairs', 'singles', 'rejected')}, ensure_ascii=False))
