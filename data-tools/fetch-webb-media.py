#!/usr/bin/env python3
"""Freeze ESA/Webb outreach observation metadata; images stay on ESA's CDN.

Refresh with a new --cache directory. Incomplete archives never replace the
snapshot. The offline photo builder applies the same primary-target review as
AstroPix, without position joins or changes to the scientific catalogue.
"""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import html
import json
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://esawebb.org'
RIGHTS = ORIGIN + '/copyright/'
NON_PHOTO = re.compile(r'\bannotat\w*|\blabel(?:led|ed|s)?\b|\bspectrum\b|\bspectra\b|spectroscopic|'
                       r'\billustrat\w*|\bartist\w*|\bdiagram\b|\bsimulation\b|\bcomparison\b|'
                       r'\bcompared\b|\bcollage\b|\bgraph\b|\bchart\b|\blight curve\b|'
                       r'\bzoom sequence\b|\bsonification\b', re.I)


def clean(value):
    value = re.sub(r'<(?:script|style)\b[^>]*>.*?</(?:script|style)>', '', value, flags=re.S | re.I)
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', value))).strip()


def named_targets(text):
    """Explicit names in a heading/opening, never names inferred from position."""
    patterns = [
        r'\b(?:NGC|IC|Messier|M|Arp|Abell|UGC|PGC|Terzan|Pismis|Lynds|WR)\s*\d+[A-Za-z]?\b',
        r'\b(?:IRAS|MACS|WHL|SPT-CL|SDSS)\s*J?\d[\d.]*[+−-][\d.]+\b',
        r'\bSh\s*2[- ]\d+\b', r'\bL\s*\d{3,4}\b',
        r'\b(?:[A-Z][a-z]+(?:[’\'-][A-Z]?[a-z]+)?\s+){1,4}(?:Nebula|Galaxy|Cluster)\b',
    ]
    return list(dict.fromkeys(m.group() for pattern in patterns for m in re.finditer(pattern, text)))


def extract(markup, image_id):
    fields, cells = {}, {}
    for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', markup, re.S | re.I):
        heading = re.search(r'<th\b[^>]*>(.*?)</th>', row, re.S | re.I)
        cell = re.search(r'<td\b[^>]*>(.*?)</td>', row, re.S | re.I)
        if heading and cell:
            name = clean(heading[1]).rstrip(':')
            fields[name], cells[name] = clean(cell[1]), cell[1]
    title_match = re.search(r'<h1\b[^>]*>(.*?)</h1>', markup, re.S | re.I)
    credit_match = re.search(r'<div\b[^>]*class="credit"[^>]*>(.*?)</div>', markup, re.S | re.I)
    if not title_match or not credit_match or fields.get('Id') != image_id:
        return None, 'incomplete-metadata'
    title, credit = clean(title_match[1]), clean(credit_match[1])
    # The caption follows the main image's viewer script and precedes Credit.
    section = markup[title_match.end():credit_match.start()]
    section = re.split(r'</script\s*>', section, flags=re.I)[-1]
    caption = clean(re.split(r'<strong>\s*Credit:', section, flags=re.I)[0])
    names = [clean(n) for n in re.findall(r'<a\b[^>]*>(.*?)</a>', cells.get('Name', ''), re.S | re.I)]
    names = list(dict.fromkeys(names or [n.strip() for n in fields.get('Name', '').split(',') if n.strip()]))
    original_names = list(names)
    name_evidence = None
    if not names:
        opening = '. '.join(re.split(r'\. (?=[A-Z])', caption, maxsplit=2)[:2])
        names = named_targets(title)
        evidence = title
        if not names:
            names, evidence = named_targets(opening), opening
        if names:
            name_evidence = dict(method='Name field absent; explicit target names in primary heading/opening', text=evidence)
    categories = [clean(n) for n in re.findall(r'<a\b[^>]*>(.*?)</a>', cells.get('Category', ''), re.S | re.I)]
    if fields.get('Type') != 'Observation':
        return None, 'type-' + fields.get('Type', 'unknown').lower()
    filtered_title = re.sub(r'\b(?:unannotated|non[- ]annotated|without annotations?)\b', '', title, flags=re.I)
    if NON_PHOTO.search(filtered_title):
        return None, 'non-photo-title'
    if re.search(r'\bexoplanet\b|\bplanet\b', title, re.I):
        return None, 'planet-target-outside-target-catalogue'
    if not names or not credit or not caption:
        return None, 'missing-identity-credit-caption'
    # These are actual filters of the published observation, not an instrument
    # mentioned in related links or the site's navigation.
    filter_section = re.search(r'id="object_observation_div".*?<table\b[^>]*>(.*?)</table>', markup, re.S | re.I)
    filters = []
    if filter_section:
        for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', filter_section[1], re.S | re.I):
            values = [clean(v) for v in re.findall(r'<td\b[^>]*>(.*?)</td>', row, re.S | re.I)]
            if values:
                filters.append(values)
    instruments = [i for i in ['NIRCam', 'MIRI', 'NIRSpec', 'NIRISS'] if i in categories or
                   re.search(r'\b' + i + r'\b', ' '.join(' '.join(r) for r in filters) + ' ' + title)]
    if re.search(r'\bHubble\b|\bHST\b', title) and not re.search(r'\bWebb\b|\bJWST\b', title):
        return None, 'hubble-comparison-frame'
    if not instruments and not re.search(r'\b(?:Webb|JWST)\b', caption + ' ' + credit):
        return None, 'no-webb-observation-evidence'
    # Preserve the source's physical category. A star-forming region is not a
    # portrait of every star tagged with its host's name.
    subjects = []
    if 'Nebulae' in categories:
        subjects.append('B.4')
    if 'Galaxies' in categories or 'Cosmology' in categories:
        subjects.append('B.5')
    if 'Galaxy clusters' in categories:
        subjects.append('B.5.5.3')
    if 'Stars' in categories:
        subjects.append('B.3')
    if 'Solar System' in categories:
        return None, 'solar-system-outside-target-catalogue'
    if not subjects:
        opening = title + ' ' + '. '.join(caption.split('. ', 2)[:2])
        if re.search(r'\bnebula\b|\bsupernova\b|\bremnant\b', opening, re.I):
            subjects.append('B.4')
        elif re.search(r'\bgalax(?:y|ies)\b|\bquasar\b', opening, re.I):
            subjects.append('B.5')
        elif re.search(r'\bprotostar\b|\bstar\b', opening, re.I):
            subjects.append('B.3')
        else:
            return None, 'unclassified-target'
    asset = re.search(r'<meta\s+property="og:image:secure_url"\s+content="([^"]+)"', markup)
    if not asset or not re.fullmatch(r'https://cdn\.esawebb\.org/archives/images/screen/[A-Za-z0-9_.-]+\.jpg', asset[1]):
        return None, 'unexpected-image-url'
    date = datetime.strptime(fields['Release date'], '%d %B %Y, %H:%M').date().isoformat()
    facilities = 'James Webb' + (' · ' + ' / '.join(instruments) if instruments else '')
    if re.search(r'\bHubble\b|\bHST\b', title):
        facilities += ' / Hubble'
    if re.search(r'\bALMA\b', title):
        facilities += ' / ALMA'
    return dict(id='esawebb-' + image_id, publisher='esawebb', imageId=image_id,
                identifiers=names, subjects=subjects, title=title, archiveTitle=title,
                mediaKind='observation', instrument=facilities, detectors=instruments,
                band=('ИК / оптика' if 'Hubble' in facilities else 'ИК') + ' · обработанные цвета',
                date=date, url=asset[1], source=ORIGIN + '/images/' + image_id + '/',
                archive=ORIGIN + '/images/' + image_id + '/', archiveLabel='ESA/Webb',
                credit=credit, rights='CC BY 4.0', creditUrl=RIGHTS,
                description='Наблюдение James Webb в инфракрасном диапазоне. Цвета назначены фильтрам при обработке; кадр может показывать отдельную область объекта.',
                sourceCaption=caption, sourceCategories=categories, sourceFilters=filters,
                originalNames=original_names, nameEvidence=name_evidence,
                identification=dict(method='ESA/Webb About the Object names and physical categories; primary-target review, no sky-proximity join',
                                    type=fields['Type'], pageSha256=hashlib.sha256(markup.encode()).hexdigest())), None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path(tempfile.gettempdir()) / 'parus-webb-metadata')
    parser.add_argument('--output', type=Path, default=ROOT / 'data-tools/sky-sources/media-webb.json')
    args = parser.parse_args()
    for directory in ['pages', 'details']:
        (args.cache / directory).mkdir(parents=True, exist_ok=True)

    def fetch(relative, path):
        if not path.exists():
            data = subprocess.run(['curl', '-fLsS', '--connect-timeout', '10', '--max-time', '45',
                                   '--retry', '1', ORIGIN + relative], capture_output=True, check=True).stdout
            path.write_bytes(data)
        return path.read_text()

    first = fetch('/images/', args.cache / 'pages/01.html')
    last = max(int(n) for n in re.findall(r'/images/page/(\d+)/', first))
    pages, listing = [], []
    for page in range(1, last + 1):
        relative = '/images/' + (f'page/{page}/' if page > 1 else '')
        markup = fetch(relative, args.cache / 'pages' / f'{page:02}.html')
        ids = re.findall(r"id: '([^']+)',\s*title:", markup)
        assert ids and (page == last or len(ids) == 50), 'incomplete image listing'
        pages.append(dict(url=ORIGIN + relative, count=len(ids), sha256=hashlib.sha256(markup.encode()).hexdigest()))
        listing.extend(ids)
    assert len(set(listing)) == len(listing) and len(listing) >= 500, 'archive changed during refresh'

    def one(ident):
        markup = fetch('/images/' + ident + '/', args.cache / 'details' / (ident + '.html'))
        photo, reason = extract(markup, ident)
        return ident, photo, reason

    records, rejected = [], []
    with ThreadPoolExecutor(max_workers=6) as pool:
        for ident, photo, reason in pool.map(one, listing):
            if photo:
                records.append(photo)
            else:
                rejected.append(dict(imageId=ident, reason=reason))
    assert len(records) >= 100 and len(records) + len(rejected) == len(listing)
    checks_path = args.cache / 'availability.json'
    checks = json.loads(checks_path.read_text()) if checks_path.exists() else {}

    def check_asset(photo):
        url = photo['url']
        if url in checks:
            return url, checks[url]
        result = subprocess.run(['curl', '-fLsSI', '--connect-timeout', '8', '--max-time', '35',
                                 '--retry', '1', url], capture_output=True, check=True)
        headers = result.stdout.decode(errors='replace')
        statuses = re.findall(r'^HTTP/\S+\s+(\d+)', headers, re.M)
        types = re.findall(r'^content-type:\s*([^\r\n]+)', headers, re.I | re.M)
        return url, dict(status=int(statuses[-1]) if statuses else 0,
                         contentType=types[-1] if types else '', checkedAt=datetime.now(timezone.utc).isoformat())

    with ThreadPoolExecutor(max_workers=6) as pool:
        checks.update(pool.map(check_asset, records))
    checks_path.write_text(json.dumps(checks, indent=2) + '\n')
    for photo in records:
        check = checks[photo['url']]
        assert check['status'] == 200 and check['contentType'].startswith('image/'), 'unavailable image; previous snapshot preserved: ' + photo['url']
        photo['availability'] = check
    result = dict(version=1, source=ORIGIN + '/images/', rightsSource=RIGHTS,
                  inputCount=len(listing), pages=pages,
                  filterSummary=dict(accepted=len(records), rejected=dict(sorted(Counter(r['reason'] for r in rejected).items()))),
                  rejected=rejected, records=sorted(records, key=lambda p: p['id']))
    temporary = args.output.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(args.output)
    print(f'{len(records)} ESA/Webb observations / {len(listing)} archive records; {len(rejected)} explicitly rejected')


if __name__ == '__main__':
    main()
