#!/usr/bin/env python3
"""Import public outreach observations through the documented AstroPix JSON API.

Only metadata is downloaded. Image URLs point to AstroPix/IPAC's public archive.
The cache is external to the repository; a failed/partial refresh never replaces
the frozen index. build-sky-photos.py rebuilds browser data without networking.
"""
import argparse
from collections import Counter
import concurrent.futures
import hashlib
import html
import json
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
QUERY = [('q[container]', 'all'), ('q[values][][element]', '23'),
         ('q[values][][condition]', '=='), ('q[values][][term]', 'Observation')]
API = 'https://www.astropix.org/advanced_search.json'
BANDS = {'Optical': 'оптика', 'Infrared': 'ИК', 'Ultraviolet': 'УФ', 'X-ray': 'рентген',
         'Gamma-ray': 'гамма', 'Radio': 'радио', 'Millimeter': 'миллиметровый диапазон'}
# AVM's Observation tag is necessary, but old archives sometimes misclassify
# comparison plates, finder fields, spectra and artwork. Exclude these too.
REJECT = re.compile(r'chart|annotat|\blabel(?:led|ed|s)?\b|spectrum|spectra\b|spectroscopic|'
                    r'artist|illustrat|diagram|simulation|schematic|\bgraph\b|\bplot\b|'
                    r'comparison|compared|\bmontage\b|\bcollage\b|\bDSS\b|digitized sky|'
                    r'digitised sky|location of|positions? of|zoom(?:ing)? (?:in|into)|'
                    r'light curve|evolution of|timeline|3-d |3d |reconstruction of the orbit', re.I)
PLOT = re.compile(r'measurements|phase.folded|frequency comb|first fringes|observations\+model|\bmodel\b', re.I)


def clean(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', value or ''))).strip()


def sequence(values):
    return list(dict.fromkeys(clean(v) for v in values or [] if clean(v)))


def convert(row):
    title, caption = clean(row.get('title')), clean(row.get('description'))
    names = sequence(row.get('object_name'))
    credit, rights = clean(row.get('image_credit')), clean(row.get('usage_rights'))
    publisher, image = row.get('publisher_id', ''), row.get('image_id', '')
    if (row.get('image_type') != 'Observation' or not names or not credit or not rights or not title
            or REJECT.search(title) or PLOT.search(title)
            or any(re.fullmatch(r'spectrum|spectra|chart', n, re.I) for n in names)
            or re.search(r'digit[ai][sz]ed sky survey|\bDSS\b|error bars|vertical axis|this (?:chart|graph|plot)|'
                         r'(?:picture|image|chart).{0,55}(?:part of a spectrum|represents the spectrum)', caption, re.I)
            or re.search(r'^(?:this (?:image|illustration|artist)|an? artist).*?(?:illustration|impression|concept)', caption, re.I)
            or not re.fullmatch(r'[a-z0-9_-]+', publisher)
            or not re.fullmatch(r'[A-Za-z0-9_.-]+', image)):
        return None
    source = row.get('reference_url') or ''
    if source.startswith('http://'):
        source = 'https://' + source[7:]
    if not source.startswith('https://'):
        source = f'https://www.astropix.org/image/{publisher}/{image}'
    facilities = sequence(row.get('telescope_facility'))
    instruments = sequence(row.get('telescope_instrument'))
    bands = sequence(row.get('spectral_band'))
    # AstroPix preserves AVM identifier case in JSON, but its archive paths
    # are lowercase (notably WISE and NRAO). This applies to every publisher.
    asset = image.lower()
    # Keep the original subject taxonomy: the builder uses it to distinguish
    # stars, extended objects, neutron stars and black holes, independently of
    # the scientific catalogue and independently of finder-chart eligibility.
    return dict(id=f'astropix-{publisher}-{image}', publisher=publisher, imageId=image,
                identifiers=names, subjects=sequence(row.get('subject')),
                title=names[0] + ' — ' + (' / '.join(facilities[:2]) or clean(row.get('publisher'))),
                archiveTitle=title,
                instrument=' / '.join(facilities[:4]) or clean(row.get('publisher')),
                detectors=instruments,
                band=(' / '.join(BANDS.get(b, b) for b in bands) or 'Архивное наблюдение') + ' · обработанные цвета',
                date=(row.get('image_release_date') or '')[:10] or 'Архив обсерватории',
                url=f'https://www.astropix.org/archive/{publisher}/{asset}/{publisher}_{asset}_1280.jpg',
                source=source, archive=f'https://www.astropix.org/image/{publisher}/{image}',
                credit=credit, rights=rights,
                description='Наблюдение обсерватории: объект или его окружение. Кадр может показывать только часть объекта. Цвета зависят от фильтров и обработки; это не вид в окуляре.',
                sourceCaption=caption[:1800],
                identification=dict(method='AVM Subject.Name and Subject.Category; no free-text or sky-proximity join',
                                    type=row['image_type'], astropixId=row['astropix_id'],
                                    metadataSha256=hashlib.sha256(json.dumps(row, sort_keys=True).encode()).hexdigest()))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path(tempfile.gettempdir()) / 'parus-astropix-metadata')
    parser.add_argument('--output', type=Path, default=ROOT / 'data-tools/sky-sources/media-astropix.json')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)

    def fetch(page):
        url = API + '?' + urlencode(QUERY + [('page', page)])
        path = args.cache / f'feed-{page:03}.json'
        if not path.exists():
            data = subprocess.run(['curl', '-fLsS', '--connect-timeout', '10', '--max-time', '55',
                                   '--retry', '2', url], check=True, capture_output=True).stdout
            rows = json.loads(data)
            assert isinstance(rows, list) and all(q.get('image_type') == 'Observation' for q in rows)
            path.write_bytes(data)
        data = path.read_bytes()
        rows = json.loads(data)
        assert isinstance(rows, list) and all(q.get('image_type') == 'Observation' for q in rows)
        return rows, dict(url=url, count=len(rows), sha256=hashlib.sha256(data).hexdigest())

    rows, pages, finished = [], [], False
    # Bounded batches avoid thousands of empty requests when a feed ends.
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for start in range(1, 202, 4):
            for batch, evidence in pool.map(fetch, range(start, start + 4)):
                if finished:
                    continue
                pages.append(evidence)
                rows.extend(batch)
                if len(batch) < 120:
                    finished = True
            if finished:
                break
    assert finished and len(rows) >= 8000, 'Incomplete/unexpected feed; frozen data preserved'
    assert len({q['astropix_id'] for q in rows}) == len(rows), 'Pagination changed during refresh; retry with a fresh cache'
    records = [p for q in rows if (p := convert(q))]
    assert len(records) >= 5000 and len({p['id'] for p in records}) == len(records)
    result = dict(version=1, source='https://www.astropix.org/page/developers',
                  imagePolicy='https://www.astropix.org/page/image_policies',
                  inputCount=len(rows), pages=pages, records=sorted(records, key=lambda p: p['id']))
    temporary = args.output.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(args.output)
    print(f'{len(records)} filtered observations / {len(rows)} input records; {dict(Counter(p["publisher"] for p in records))}')


if __name__ == '__main__':
    main()
