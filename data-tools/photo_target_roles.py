"""Separate the photographed target from other objects in AVM subject tags.

Names in one Subject.Name array are not necessarily aliases. Only source
headings/opening captions establish a primary target in a multi-object field.
Catalogue aliases preserve e.g. M31 = NGC224 without equating its satellites.
"""
from collections import defaultdict
import json
import re

CODE = re.compile(r'(ngc|ic|m|ugc|pgc|arp|abell)\d+[a-z]?\Z')
GROUP = re.compile(r'\b(?:pair|duo|trio|triplet|quartet|quintet|double cluster|twin galaxies|two (?:\w+ ){0,3}galaxies|'
                   r'three (?:\w+ ){0,3}galaxies|four (?:\w+ ){0,3}galaxies|'
                   r'(?:interacting|merging|colliding) galaxies)\b', re.I)


def catalogue_aliases(root, key, photos):
    """Read own aliases, without changing or rebuilding scientific catalogues."""
    text = (root / 'dist/catalog-import.js').read_text()
    core = json.JSONDecoder().raw_decode(text.split('const IMPORTED_CATALOG=', 1)[1])[0]['objects']
    pointer = json.loads((root / 'dist/catalog-data/current.json').read_text())
    directory = root / 'dist' / pointer['dataRoot']
    search = json.loads((directory / 'search.json').read_text())
    wanted = {key(name) for p in photos for name in p['identifiers']}
    files = {r[5] for r in search if r[2] in ['galaxy', 'nebula', 'cluster'] and wanted.intersection(r[6].split('|'))}
    objects = list(core)
    for file in sorted(files):
        objects.extend(dict(id=r[0], kind=r[2], aliases=r[8], **r[11]) for r in json.loads((directory / file).read_text()))
    owners, names = defaultdict(set), defaultdict(set)
    for o in objects:
        if o['kind'] not in ['galaxy', 'nebula', 'cluster'] or o.get('galaxyMember'):
            continue
        own = [o.get('ngc'), 'M'+str(o['messier']) if o.get('messier') else None, *o.get('aliases', [])]
        own = {n for n in own if n and not re.search('[а-яё]', n, re.I)}
        identity = key(o.get('ngc') or o['id'])
        names[identity].update(own)
        for n in own:
            owners[key(n)].add(identity)
    # A shared search label must not merge two catalogue objects transitively.
    aliases = {n: (next(iter(ids)), names[next(iter(ids))]) for n, ids in owners.items() if len(ids) == 1}
    return aliases, pointer['revision']


def name_position(text, names, key):
    # Publishers abbreviate joint targets: NGC 4038/4039, NGC 5426-27, etc.
    def expand(m):
        prefix, first, separator, last = m.groups()
        full = first[:len(first)-len(last)] + last if len(last) < len(first) else last
        numbers = range(int(first), int(full)+1) if separator != '/' and 0 < int(full)-int(first) <= 20 else [first, full]
        return ' '.join(prefix + str(n) for n in numbers)
    text = re.sub(r'\b(NGC\s*|IC\s*|M\s*|Abell\s*)(\d+)\s*([/–-])\s*(\d+)\b', expand, text, flags=re.I)
    text = re.sub(r'\b(NGC\s*|IC\s*|M\s*|Abell\s*)(\d+(?:\s*(?:,|&|and)\s*\d+)+)',
                  lambda m: ' '.join(m[1]+n for n in re.findall(r'\d+', m[2])), text, flags=re.I)
    positions = []
    for name in names:
        code = CODE.fullmatch(key(name))
        if code:
            number = re.search(r'\d+[a-z]?$', key(name))[0]
            prefix = '(?:M|Messier)' if code[1] == 'm' else code[1]
            pattern = prefix + r'\s*0*' + number
        else:
            if len(name) < 3 or not re.search('[a-z]', name, re.I):
                continue
            # Andromeda and Andromeda Galaxy name the same source; do not
            # shorten Orion Nebula to the constellation name "Orion".
            pattern = re.escape(re.sub(r'\s+galaxy$', '', name, flags=re.I)).replace(r'\ ', r'\s+')
        match = re.search(r'(?<![a-z0-9])' + pattern + r'(?![a-z0-9])', text, re.I)
        if match:
            positions.append(match.start())
    return min(positions) if positions else None


def primary_identifiers(photo, aliases, key):
    names = photo['identifiers']
    groups, known, families = defaultdict(list), set(), defaultdict(set)
    for name in names:
        code = key(name)
        identity = aliases[code][0] if code in aliases else code
        groups[identity].append(name)
        if code in aliases:
            known.add(identity)
        if match := CODE.fullmatch(code):
            families[match[1]].add(identity)
    ambiguous = len(known) > 1 or any(len(ids) > 1 for ids in families.values())
    if not ambiguous:
        return names, None
    title = photo['archiveTitle']
    opening = '. '.join(photo['sourceCaption'].split('. ', 3)[:3])
    evidence_names = {identity: list(tagged) + list(aliases[key(tagged[0])][1] if key(tagged[0]) in aliases else [])
                      for identity, tagged in groups.items()}
    title_hits = {g for g, ns in evidence_names.items() if name_position(title, ns, key) is not None}
    caption_hits = {g: pos for g, ns in evidence_names.items() if (pos := name_position(opening, ns, key)) is not None}
    before_host = re.split(r'\s+(?:in|within)\s+', title, maxsplit=1, flags=re.I)[0]
    before_hits = {g for g, ns in evidence_names.items() if name_position(before_host, ns, key) is not None}
    if before_hits:
        title_hits = before_hits
    # A genuine joint portrait retains both/all targets. A host and its small
    # companions do not become a joint portrait merely by sharing an AVM tag.
    other_field = bool(re.search(r'not (?:seen|shown|pictured)|nearby patch', opening, re.I))
    joint = bool(GROUP.search(title + ' ' + opening)) or len(caption_hits) > 1 and bool(re.search(r'\b(?:galaxies|nebulae|clusters|both)\b', opening, re.I))
    if other_field:
        selected, method = set(), 'source describes a separate field or an object outside the image'
    elif joint:
        selected = title_hits | set(caption_hits) if len(title_hits | set(caption_hits)) > 1 else set(groups)
        method = 'joint portrait explicitly described in source heading/opening'
    elif title_hits:
        selected, method = title_hits, 'primary target named in source heading'
    elif caption_hits:
        selected = {min(caption_hits, key=caption_hits.get)}
        method = 'first named target in source opening'
    else:
        selected, method = set(), 'ambiguous multi-object tags without primary-target evidence'
    primary = [n for n in names if (aliases[key(n)][0] if key(n) in aliases else key(n)) in selected]
    return primary, dict(method=method, primaryIdentifiers=primary,
                         otherIdentifiers=[n for n in names if n not in primary],
                         sourceTitle=title, openingCaption=opening)
