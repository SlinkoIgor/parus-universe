#!/usr/bin/env python3
"""Build a small identity index and lazy publisher metadata files, offline.

No scientific catalogue, coordinates, photometry, saved state or maps change.
"""
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from photo_target_roles import catalogue_aliases, primary_identifiers

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'data-tools/sky-sources'
NAME_RULES = dict(
    constellations={name.lower(): f['id'].lower()
                    for f in json.loads((SRC / 'constellations.json').read_text())['features']
                    for name in [f['id'], f['properties']['gen']]},
    greek={name: short for short, names in [
        ('alf', 'alpha alp alf α'), ('bet', 'beta bet β'), ('gam', 'gamma gam γ'),
        ('del', 'delta del δ'), ('eps', 'epsilon eps ε'), ('zet', 'zeta zet ζ'),
        ('eta', 'eta η'), ('the', 'theta the tet θ'), ('iot', 'iota iot ι'),
        ('kap', 'kappa kap κ'), ('lam', 'lambda lam λ'), ('mu', 'mu μ'),
        ('nu', 'nu ν'), ('ksi', 'xi ksi ξ'), ('omi', 'omicron omi ο'),
        ('pi', 'pi π'), ('rho', 'rho ρ'), ('sig', 'sigma sig σ'),
        ('tau', 'tau τ'), ('ups', 'upsilon ups υ'), ('phi', 'phi φ'),
        ('chi', 'chi χ'), ('psi', 'psi ψ'), ('ome', 'omega ome ω')]
        for name in names.split()})


def stellar_designation(value):
    value = unicodedata.normalize('NFKD', value)
    value = re.sub(r'^(?:NAME|V\*|\*)\s+', '', value.strip(), flags=re.I)
    m = re.fullmatch(r'(V\d+|[A-Za-zα-ω]+|\d+)(\d*)\s+([A-Za-z]+)(?:\s+([A-Z]))?', value)
    if not m or m[3].lower() not in NAME_RULES['constellations']:
        return ''
    name, number, con, component = m.groups()
    greek = NAME_RULES['greek'].get(name.lower()) if not (len(name) > 1 and name.isupper()) else None
    if greek:
        prefix = 'bayer' + greek + number
    elif re.fullmatch(r'[A-Z]{1,2}|V\d+', name) and not number:
        prefix = 'var' + name.lower()
    elif name.isdigit() and not number:
        prefix = 'flam' + name
    else:
        return ''
    return prefix + NAME_RULES['constellations'][con.lower()] + (component or '').lower()


def key(value):
    if designation := stellar_designation(value):
        return designation
    value = re.sub(r'^(?:NAME|V\*|\*)\s+', '', value.strip(), flags=re.I)
    value = value.lower().replace('messier', 'm').replace('gliese', 'gj')
    value = re.sub(r'\bgl\s*(?=\d)', 'gj', value)
    value = re.sub(r'\b(ngc|ic|m|hip|hd|hr|gj)\s*0*(\d+)', r'\1\2', value)
    value = unicodedata.normalize('NFKD', value)
    return re.sub('[^a-z0-9+.-]', '', value)


def short_name_evidence(photo, name, title_only=False):
    """Confirm a short AVM code in the primary title/caption, including acronyms.

    Public archives contain erroneous host tags too. For example, an image
    whose title and caption say SMC must not acquire an LMC identification.
    This validates an existing AVM name; it never creates a new identification.
    """
    title = photo['archiveTitle']
    text = title if title_only else title + ' ' + photo['sourceCaption'].split('. ', 1)[0]
    code = key(name)
    if title_only:
        words = re.findall('[A-Za-z0-9]+', re.sub(r'^(?:the|an?)\s+', '', title, flags=re.I))
        return bool(words) and (key(words[0]) == code or len(words) >= 3 and ''.join(w[0] for w in words[:3]).lower() == code)
    if re.search(r'(?<![a-z0-9])' + re.escape(code) + r'(?![a-z0-9])', text, re.I):
        return True
    words = re.findall('[A-Za-z]+', text)
    return any(''.join(w[0] for w in words[i:i+3]).lower() == code for i in range(len(words)-2))


def namespaces(photo, name):
    # Lowercase b/c/... designate exoplanets, uppercase B/C/... stellar
    # components. Case folding must not turn Fomalhaut b into Fomalhaut B.
    if re.search(r'(?:\s|\d)[b-z]$', name.strip()):
        return []
    k = key(name)
    if not k or not re.search('[a-z]', k):
        return []
    subjects = photo['subjects']
    if subjects and not any(re.match('[BCD]\\.', s) for s in subjects):
        return []
    bh = any(re.match(r'[BCD]\.3\.1\.10(?:\.|$)', s) for s in subjects)
    neutron = any(re.match(r'[BCD]\.3\.1\.9(?:\.|$)', s) for s in subjects)
    extended = bool(re.fullmatch(r'(?:ngc|ic|m|caldwell|ugc|pgc|arp|abell)\d+[a-z]?', k))
    galaxy_cluster = any(re.match(r'[BCD]\.5\.5\.3(?:\.|$)', s) for s in subjects)
    # Never turn a named host into an image of its black hole or of a member
    # star. Conversely a black-hole release is not a portrait of the host.
    if bh or neutron:
        return [] if extended else ['blackhole' if bh else 'pulsar']
    if extended:
        return ['deep-sky'] + (['galaxy-cluster'] if galaxy_cluster else [])
    formal_star = bool(re.match(r'^(?:hip|hd|hr|gj|2mass|iras|tyc|lhs|ross|wolf|wasp|kepler|toi|trappist|k2)\d', k))
    if len(k) < 3 and not formal_star:
        return []
    short_code = bool(re.fullmatch('[A-Z]{3}', name.strip()))
    if short_code and not short_name_evidence(photo, name):
        return []
    stellar = any(re.match(r'[BCD]\.3(?:\.|$)', s) and not re.match(r'[BCD]\.3\.6\.4', s) for s in subjects)
    deep = any(re.match(r'[BCD]\.(?:4|5)(?:\.|$)|[BCD]\.3\.6\.4', s) for s in subjects)
    # Older outreach photographs can lack AVM Subject.Category entirely.
    # Require both an explicit short name and a stated physical class in the
    # primary caption, instead of guessing that class from the code's length.
    if not subjects and short_code and re.search(r'\b(?:galaxy|nebula|cluster)\b', photo['sourceCaption'].split('. ', 1)[0], re.I):
        deep = True
    result = []
    if formal_star or stellar:
        result.append('star')
    if deep:
        result.extend(['deep-sky', 'quasar'])
    if galaxy_cluster:
        result.append('galaxy-cluster')
    return result


def build():
    frozen = json.loads((SRC / 'media-astropix.json').read_text())
    aliases, catalogue_revision = catalogue_aliases(ROOT, key, frozen['records'])
    targets, publishers, primary_short = defaultdict(set), defaultdict(dict), defaultdict(set)
    surveys, reviews = set(), []
    for p in frozen['records']:
        primary, evidence = primary_identifiers(p, aliases, key)
        if evidence:
            reviews.append(dict(id=p['id'], source=p['source'], originalIdentifiers=p['identifiers'], **evidence))
        usable = [(kind + ':' + key(name)) for name in primary for kind in namespaces(p, name)]
        for evidence in p.get('primaryStellarIdentifications', []):
            assert evidence['kind'] == 'star' and evidence['title'] == p['archiveTitle'] and p['mediaKind'] == 'survey'
            if 'star' in namespaces(p, evidence['identifier']):
                usable.append('star:' + key(evidence['identifier']))
        if not usable:
            continue
        assert p['url'].startswith('https://www.astropix.org/archive/') and p['credit'] and p['rights']
        for target in usable:
            targets[target].add(p['id'])
            code = target.split(':', 1)[1]
            if re.fullmatch('[a-z]{3}', code) and short_name_evidence(p, code, title_only=True):
                primary_short[target].add(p['id'])
        publishers[p['publisher']][p['id']] = {k: v for k, v in p.items()
                                              if k not in ['identifiers', 'subjects', 'identification', 'primaryStellarIdentifications', 'sourceCaption', 'archiveTitle', 'publisher', 'imageId']}
        # AVM names can be alphabetically sorted; their first item is not a
        # caption (M110 was first on a photograph of Andromeda and satellites).
        publishers[p['publisher']][p['id']]['title'] = p['archiveTitle']
        if evidence:
            publishers[p['publisher']][p['id']]['targetEvidence'] = evidence
        if p.get('mediaKind') == 'survey':
            surveys.add(p['id'])
    files = {}
    for publisher, photos in sorted(publishers.items()):
        payload = json.dumps(dict(version=1, photos=photos), ensure_ascii=False, separators=(',', ':')) + '\n'
        revision = hashlib.sha256(payload.encode()).hexdigest()[:12]
        filename = 'sky-photos-' + publisher + '.json'
        (ROOT / 'dist' / filename).write_text(payload)
        files[publisher] = dict(url=filename + '?v=' + revision, count=len(photos))
    index = dict(version=1, files=files, targets={k: sorted(v, key=lambda photo: (photo in surveys, photo not in primary_short[k], photo)) for k, v in sorted(targets.items())},
                 nameRules=NAME_RULES, surveys=sorted(surveys),
                 targetPolicy='source-primary-targets-v1', catalogueRevision=catalogue_revision,
                 inputCount=frozen['inputCount'], photoCount=sum(len(p) for p in publishers.values()))
    payload = json.dumps(index, ensure_ascii=False, separators=(',', ':'))
    index['revision'] = hashlib.sha256(payload.encode()).hexdigest()[:12]
    script = '"use strict";\nconst SKY_PHOTO_INDEX=' + json.dumps(index, ensure_ascii=False, separators=(',', ':')) + ';\n'
    (ROOT / 'dist/sky-photos-index.js').write_text(script)
    index_path = ROOT / 'dist/index.html'
    cache_key = hashlib.sha256(script.encode()).hexdigest()[:12]
    index_path.write_text(re.sub(r'(sky-photos-index\.js\?v=)[^" ]+', lambda m: m[1]+cache_key, index_path.read_text()))
    audit = dict(version=1, catalogueRevision=catalogue_revision, imageRevision=index['revision'],
                 reviewed=len(reviews), restricted=sum(bool(r['otherIdentifiers']) for r in reviews),
                 unconfirmed=sum(not r['primaryIdentifiers'] for r in reviews), cases=reviews)
    (SRC / 'photo-target-audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2)+'\n')
    print(f'{index["photoCount"]} observations; {len(targets)} classified identity keys; {len(files)} lazy metadata files')
    print(f'{audit["reviewed"]} multi-object records reviewed; {audit["restricted"]} restricted; {audit["unconfirmed"]} without confirmed primary targets')


if __name__ == '__main__':
    build()
