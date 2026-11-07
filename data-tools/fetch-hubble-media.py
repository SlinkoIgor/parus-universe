#!/usr/bin/env python3
"""Refresh credited Hubble observations from NASA's Messier/Caldwell pages.

This offline preparation command fetches HTML metadata only. The game loads
images directly from their publishers, one visible slide at a time. Frozen
records are consumed by build-sky-guide.py without network access.
"""
import argparse
import concurrent.futures
import hashlib
import html
import json
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'data-tools/sky-sources'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cache', type=Path, default=Path(tempfile.gettempdir()) / 'parus-hubble-metadata')
parser.add_argument('--output', type=Path, default=SRC / 'media-hubble.json')
args = parser.parse_args()
args.cache.mkdir(parents=True, exist_ok=True)


def clean(text):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', text))).strip()


def fetch(url):
    path = args.cache / (hashlib.sha256(url.encode()).hexdigest() + '.html')
    if not path.exists():
        data = subprocess.run(['curl', '-fLsS', '--connect-timeout', '8', '--max-time', '25', url],
                              check=True, capture_output=True).stdout
        path.write_bytes(data)
    return path.read_text()


caldwell = {q['caldwell']: q['identifier'] for q in json.loads((SRC / 'visual-targets.json').read_text())['entries']}
old = {q['id']: q for q in json.loads((SRC / 'media-hubble.json').read_text())}
jobs = []
for catalogue in ['caldwell', 'messier']:
    root = 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-' + catalogue + '-catalog/'
    page = fetch(root)
    links = dict(re.findall(r'href="(' + re.escape(root) + catalogue + r'-(\d+)/)"', page))
    jobs.extend((catalogue, int(number), url) for url, number in links.items())


def observation(job):
    catalogue, number, url = job
    page = fetch(url)
    identifier = caldwell[number] if catalogue == 'caldwell' else 'M ' + str(number)
    identifiers = re.findall(r'(?:NGC|IC)\s*\d+', identifier) or [identifier]
    for figure in re.findall(r'<figure\b[^>]*>.*?</figure>\s*<figcaption.*?</figcaption>', page, re.S):
        credit_match = re.search(r'<div class="hds-credits">(.*?)</div>', figure, re.S)
        caption_match = re.search(r'<figcaption[^>]*>(.*?)</figcaption>', figure, re.S)
        image = re.search(r'<img\b[^>]*src="([^"]+)"', figure)
        credit = clean(credit_match[1]) if credit_match else ''
        caption = clean(caption_match[1].split('<div class="hds-credits">')[0]) if caption_match else ''
        if not image or not re.search(r'NASA|ESA|Hubble', credit):
            continue
        # Comparison plates, artist concepts and finder charts are separate
        # source-page assets and must not become the main object photograph.
        if re.search(r'chart|Stellarium|illustration|artist|ground.based|amateur|left.+right.+Hubble', credit + ' ' + caption, re.I):
            continue
        key = 'nasa-' + catalogue + '-' + str(number)
        prior = old.get(key, {})
        return dict(id=key, objects=prior.get('objects', []),
                    identifiers=list(dict.fromkeys(identifiers + prior.get('identifiers', []))),
                    kind='deep-sky', title=prior.get('title', identifier + ' — Hubble'),
                    instrument='Hubble / NASA', band='Обработанные наблюдения · цвета зависят от фильтров',
                    date='Архив Hubble', url=html.unescape(image[1]).split('?')[0] + '?w=1200',
                    source=url, credit=credit,
                    description='Наблюдение Hubble. Кадр может показывать часть объекта. Цвета и детали после обработки не соответствуют виду в любительский телескоп.',
                    identification=dict(method='NASA observing-catalogue object page and credited observational caption',
                                        catalogueIdentifier=identifier, pageSha256=hashlib.sha256(page.encode()).hexdigest(),
                                        caption=caption or 'Primary credited Hubble observation on the NASA catalogue page for ' + identifier))
    return None


# A failed request raises before writing; it cannot erase a frozen good index.
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    records = [q for q in pool.map(observation, jobs) if q]
assert len(records) >= 150, 'Unexpected source-page layout/coverage change; inspect before replacing the index'
args.output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
print(f'{len(records)} observed images from {len(jobs)} NASA object pages: {args.output}')
