#!/usr/bin/env python3
"""Intersect Wikipedia's astronomy categories with the installed catalogue.

Only exact, unambiguous own names/identifiers in compatible object classes
qualify. No fuzzy search, sky-neighbour join, host inheritance or generated
article URLs. HTTP responses are cached outside the repository. Network access
is only needed here, never to resolve identities while opening a game card.
"""
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import hashlib
import html
import json
import os
from pathlib import Path
import re
import ssl
import time
import threading
import unicodedata
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data-tools/sky-sources/wikipedia.json'
API = 'https://en.wikipedia.org/w/api.php'
COMMONS = 'https://commons.wikimedia.org/w/api.php'
CATEGORIES = {
    'deep-sky': ['NGC objects', 'IC objects', 'Messier objects', 'Caldwell objects',
                 'Barnard objects', 'Sharpless objects', 'Arp objects', 'UGC objects',
                 'Principal Galaxies Catalogue objects', 'Local Group'],
    'star': ['Hipparcos objects', 'Henry Draper Catalogue objects',
             'Bright Star Catalogue objects', 'Gliese and GJ objects',
             'Stars with proper names', 'IAU-designated stars', 'Exoplanet host stars'],
    'quasar': ['Quasars'],
    'pulsar': ['Pulsars'],
    'blackhole': ['Stellar black holes', 'Supermassive black holes', 'Intermediate-mass black holes'],
    'structure': ['Galaxy filaments', 'Galaxy superclusters'],
    'void': ['Voids (astronomy)'],
    'galaxy-cluster': ['Galaxy clusters', 'Abell objects'],
}
# Traversal stays within astronomical subject categories; catalogue categories
# already enumerate their members and do not need per-constellation recursion.
RECURSE = {'Quasars', 'Pulsars',
           'Stellar black holes', 'Supermassive black holes', 'Exoplanet host stars'}
DISAMBIGUATORS = r'galaxy|star|astronomy|quasar|pulsar|black hole|cosmic structure|supercluster|galaxy cluster|void|nebula|star cluster'


def key(value):
    value = unicodedata.normalize('NFKD', str(value)).casefold()
    value = re.sub(r'^(?:name|v\*|\*)\s+', '', value)
    value = re.sub(r'\s*\((?:' + DISAMBIGUATORS + r')\)$', '', value)
    value = value.replace('messier', 'm').replace('gliese', 'gj')
    value = re.sub(r'\bgl\s*(?=\d)', 'gj', value)
    value = re.sub(r'\babell\s*(?=\d)', 'a', value)
    value = re.sub(r'\b(ngc|ic|m|hip|hd|hr|gj)\s*0*(\d+)', r'\1\2', value)
    value = re.sub('[−–—]', '-', value)
    return ''.join(c for c in value if c.isalnum() or c in '+.-*')


def file_key(value):
    # File titles are not astronomical aliases: case, catalogue zeroes and
    # punctuation distinguish different crops/authors/licenses on Commons.
    name = unicodedata.normalize('NFC', value.replace('_', ' '))
    return name[:1].upper() + name[1:]


def family(o):
    if o.get('opticalGroup'):
        return 'deep-sky'
    if o['kind'] in ('home', 'star'):
        return 'star'
    if o['kind'] == 'cluster' and o.get('catalogClass') == 'galaxy-cluster':
        return 'galaxy-cluster'
    # An unclassified NGC/IC record still has its own catalogue identity. This
    # presentation match does not assign a scientific type to that record.
    if o['kind'] in ('galaxy', 'nebula', 'cluster', 'unknown'):
        return 'deep-sky'
    if o['kind'] in ('structure', 'supercluster', 'filament', 'wall', 'ring', 'arc'):
        return 'structure'
    return o['kind']


def name_keys(name, group):
    keys = {key(name)}
    if group == 'galaxy-cluster':
        # MCXC uses short proper names such as Ophiuchus and FORNAX. The type
        # supplies "galaxy cluster"; it is not part of those proper names.
        base = re.sub(r'\s+(?:galaxy\s+)?cluster$', '', name, flags=re.I)
        keys.add(key(base))
    return keys


def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', value or ''))).strip()


def clean_url(value):
    u = urlsplit(value)
    return urlunsplit((u.scheme, u.netloc, u.path, '', ''))


def cache_json(path, data):
    temporary = path.with_name(path.name + f'.{os.getpid()}.{threading.get_ident()}.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False))
    temporary.replace(path)


class Client:
    def __init__(self, cache):
        self.cache = Path(cache)
        self.cache.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.next_request = 0
        self.ssl = ssl.create_default_context()
        # python.org's macOS build can lack its optional bundled CA symlink.
        # Use the OS certificate store, retaining normal TLS verification.
        if not self.ssl.get_ca_certs() and Path('/etc/ssl/cert.pem').is_file():
            self.ssl.load_verify_locations('/etc/ssl/cert.pem')

    def get(self, base, **params):
        params = dict(action='query', format='json', **params)
        url = base + '?' + urlencode(sorted(params.items()))
        path = self.cache / (hashlib.sha256(url.encode()).hexdigest() + '.json')
        if path.exists():
            return json.loads(path.read_text())
        for attempt in range(30):
            try:
                with self.lock:
                    time.sleep(max(0, self.next_request - time.monotonic()))
                    # Anonymous bot access is limited across Wikimedia APIs.
                    # Keep one shared request cadence, including worker pools.
                    self.next_request = time.monotonic() + 6.2
                request = Request(url, headers={'User-Agent': 'ParusAtlas/1.0 (educational astronomy catalogue enrichment)'})
                with urlopen(request, timeout=40, context=self.ssl) as response:
                    result = json.load(response)
                if 'error' in result:
                    raise ValueError(result['error'])
                cache_json(path, result)
                return result
            except Exception as error:
                if attempt == 29:
                    raise
                delay = min(60, 2 ** attempt)
                if isinstance(error, HTTPError) and error.code in (429, 503):
                    delay = max(delay, min(60, int(error.headers.get('Retry-After', '10'))) + 2)
                    with self.lock:
                        self.next_request = max(self.next_request, time.monotonic() + delay)
                print('Retry:', type(error).__name__, str(error)[:100], 'wait:', delay, flush=True)
                time.sleep(delay)

    def category(self, title, api=API):
        rows, continuation = [], {}
        while True:
            data = self.get(api, list='categorymembers', cmtitle='Category:' + title,
                            cmlimit=500, cmtype='page|subcat', **continuation)
            rows.extend(data['query']['categorymembers'])
            continuation = data.get('continue')
            if not continuation:
                return rows

    def pages(self, api, titles, **params):
        # Per-page caching also works when a changed English-language match
        # changes the grouping of the remaining Russian article requests.
        signature = hashlib.sha256((api + urlencode(sorted(params.items()))).encode()).hexdigest()[:16]
        directory = self.cache / ('pages-' + signature)
        directory.mkdir(exist_ok=True)
        path_for = lambda title: directory / (hashlib.sha256(title.encode()).hexdigest() + '.json')
        result, missing = [], []
        for title in titles:
            path = path_for(title)
            if path.exists():
                result.append(json.loads(path.read_text()))
            else:
                missing.append(title)
        if missing:
            data = self.get(api, titles='|'.join(missing), **params)
            for page in data['query']['pages'].values():
                cache_json(path_for(page['title']), page)
                result.append(page)
        return result


def discover(client, topics=None):
    articles = defaultdict(set)
    jobs = [(group, cat, 0) for group, cats in CATEGORIES.items() for cat in cats]
    visited = set()
    with ThreadPoolExecutor(max_workers=3) as pool:
        while jobs:
            current, jobs = jobs, []
            results = pool.map(client.category, [cat for _, cat, _ in current])
            for (group, cat, depth), rows in zip(current, results):
                visited.add((group, cat))
                for row in rows:
                    if row['ns'] == 0:
                        articles[row['title']].add(group)
                    elif row['ns'] == 14:
                        subcat = row['title'].split(':', 1)[1]
                        # A category's main article often belongs only to its
                        # own subcategory. Verify that same-name article too.
                        if topics is not None:
                            topics[subcat].add(group)
                        if depth == 0 and cat in RECURSE and (group, subcat) not in visited:
                            jobs.append((group, subcat, depth + 1))
                print('Category:', cat, len(rows), flush=True)
    return articles


def chunks(values, count=50):
    values = list(values)
    return [values[i:i + count] for i in range(0, len(values), count)]


def subgroup_articles(client):
    """Local Group members also live in their host subgroup categories."""
    articles = defaultdict(set)
    for row in client.category('Local Group'):
        if row['ns'] != 14:
            continue
        category = row['title'].split(':', 1)[1]
        for member in client.category(category):
            if member['ns'] == 0:
                articles[member['title']].add('deep-sky')
            elif member['ns'] == 14:
                articles[member['title'].split(':', 1)[1]].add('deep-sky')
        print('Subgroup:', category, flush=True)
    return articles


def russian_pages(client, lookup, english_pages):
    """Find Russian-only catalogue articles, without duplicating translations."""
    api = 'https://ru.wikipedia.org/w/api.php'
    categories = {
        'deep-sky': ['Объекты «Нового общего каталога»', 'Объекты каталога IC',
                     'Объекты Мессье', 'Местная группа'],
        'structure': ['Сверхскопления галактик', 'Галактические нити'],
        'void': ['Войды'], 'quasar': ['Квазары'], 'pulsar': ['Пульсары'],
        'blackhole': ['Чёрные дыры'], 'galaxy-cluster': ['Скопления галактик'],
    }
    known = {r['*']: p for p in english_pages for r in p.get('langlinks', []) if r['lang'] == 'ru'}
    titles = defaultdict(set)
    for group, cats in categories.items():
        queue = list(cats)
        seen = set()
        while queue:
            cat = queue.pop(0)
            if cat in seen:
                continue
            seen.add(cat)
            rows = client.category(cat, api)
            for r in rows:
                if r['ns'] == 0 and not known.get(r['title'], {}).get('pageimage') and match([r['title']], [group], lookup):
                    titles[r['title']].add(group)
                elif r['ns'] == 14 and cat in ['Объекты «Нового общего каталога»', 'Объекты каталога IC']:
                    # These roots classify their NGC/IC members into galaxies,
                    # nebulae and clusters; their direct pages are incomplete.
                    queue.append(r['title'].split(':', 1)[1])
            print('Russian category:', cat, len(rows), flush=True)
    # Russian IC articles have no shared IC category. Enumerate existing titles
    # by catalogue prefix and retain only an actual IC number in the source.
    continuation = {}
    while True:
        data = client.get(api, list='allpages', apprefix='IC ', apnamespace=0,
                          apfilterredir='nonredirects', aplimit=500, **continuation)
        for r in data['query'].get('allpages', []):
            if re.fullmatch(r'IC \d+[A-Za-z]?', r['title']) and match([r['title']], ['deep-sky'], lookup) and not known.get(r['title'], {}).get('pageimage'):
                titles[r['title']].add('deep-sky')
        continuation = data.get('continue')
        if not continuation:
            break
    pages = []
    for i, batch in enumerate(chunks(sorted(titles))):
        data = client.pages(api, batch, prop='info|pageprops|pageimages',
                            inprop='url', piprop='original|name')
        for p in data:
            if p.get('missing') is not None or 'redirect' in p or 'disambiguation' in p.get('pageprops', {}):
                continue
            previous = known.get(p['title'])
            if previous:
                if p.get('pageimage'):
                    previous['pageimage'] = p['pageimage']
                    previous['imageArticle'] = p['canonicalurl']
                continue
            p.update(matches=dict(match([p['title']], titles[p['title']], lookup)),
                     family=sorted(titles[p['title']])[0], language='ru')
            pages.append(p)
        if i % 20 == 0:
            print('Russian articles:', (i + 1) * 50, '/', len(titles), flush=True)
    return pages


def match(names, groups, lookup):
    evidence = defaultdict(list)
    for name in names:
        for group in groups:
            ids = set().union(*(lookup.get((group, k), set()) for k in name_keys(name, group)))
            # A common alias of two components/hosts cannot identify either.
            if len(ids) == 1:
                evidence[next(iter(ids))].append(name)
    return evidence


def image_record(page, info):
    meta = info.get('extmetadata', {})
    get = lambda field: plain(meta.get(field, {}).get('value', ''))
    url = clean_url(info.get('thumburl') or info['url'])
    # Commons supplies the license and attribution, not Wikipedia's page text.
    if not get('LicenseShortName') or not get('Artist'):
        return None
    # MediaWiki treats spaces and underscores as the same file title. Use one
    # identity so a gallery reference cannot duplicate an article's lead file.
    name = file_key(page['pageimage'])
    words = (name + ' ' + get('ImageDescription') + ' ' + get('Categories')).lower()
    filename = name.lower().replace('_', ' ')
    # Locator charts, simulations, spectra and illustrative art are never
    # advertised as an observatory photograph or used by the photo collection.
    if (re.search(r'light.?curve|spectrum|spectra|\b(?:graph|plot)\b|крив[а-я]+ блеска|спектр|диаграм', filename) or
            re.search(r'\b(?:graph|plot) (?:of|showing)\b|кривая блеска|диаграмма', words)):
        kind = 'diagram'
    elif (re.search(r'constellation|locator|finder|\bmap\b|\bchart\b|skymap|схем|карт', filename) or
          re.search(r'\b(?:map|chart) (?:of|showing)\b|\b(?:finder|locator|constellation|sky|star) (?:map|chart)\b|схема|карта (?:неба|созвездия|распределения)', words)):
        kind = 'map'
    elif (re.search(r'\b(?:illustration|simulation|reconstruction|rendering|concept)\b|иллюстрац|реконструк', filename) or
          re.search(r"artist(?:'s|’s)? (?:impression|illustration|concept)|\b(?:simulation|reconstruction) of\b|computer.generated (?:image|rendering)|художественная иллюстрация|реконструкция", words)):
        kind = 'diagram'
    elif name.lower().endswith('.svg') or family({'kind': page['family']}) in ('structure', 'void'):
        kind = 'map'
    elif re.search(r'photograph|observation|hubble|jwst|webb|sdss|desi|digitized sky|chandra|spitzer|telescope|exposure|imaging camera|observing conditions|снимок|фотограф', words):
        kind = 'observation'
    else:
        kind = 'illustration'
    source = info['descriptionurl']
    return dict(id='wiki-' + hashlib.sha256(name.encode()).hexdigest()[:16],
                title=get('ObjectName') or re.sub(r'\.[^.]+$', '', name).replace('_', ' '), url=url, source=source,
                instrument='Wikimedia Commons', band='Материал из Википедии',
                date=get('DateTimeOriginal') or 'дата не указана',
                description=get('ImageDescription')[:1800] or page['title'],
                credit=get('Artist'), rights=get('LicenseShortName'),
                archive=source, archiveLabel='Wikimedia Commons',
                licenseUrl=meta.get('LicenseUrl', {}).get('value', ''),
                mediaType=kind, mediaKind='survey' if re.search(r'\bdss[12]?\b|digitized sky survey', words) else kind,
                fileTitle='File:' + name, width=info['width'], height=info['height'])


def fetch_images(client, files):
    # Reuse file metadata even when a later catalogue run groups the same files
    # into different request batches. Raw API responses stay in the local cache.
    images = {}
    for path in client.cache.glob('*.json'):
        try:
            data = json.loads(path.read_text())
        except (ValueError, OSError):
            continue
        for p in data.get('query', {}).get('pages', {}).values():
            if p.get('ns') == 6 and p.get('imageinfo'):
                images[file_key(p['title'].split(':', 1)[1])] = p['imageinfo'][0]
    missing = [f for f in files if file_key(f) not in images]
    def imageinfo(batch):
        return client.get(COMMONS, titles='|'.join('File:' + f for f in batch),
                          prop='imageinfo', iiprop='url|extmetadata|size', iiurlwidth=1280)['query']['pages'].values()
    with ThreadPoolExecutor(max_workers=2) as pool:
        for batch in pool.map(imageinfo, chunks(missing)):
            for p in batch:
                if p.get('imageinfo'):
                    images[file_key(p['title'].split(':', 1)[1])] = p['imageinfo'][0]
    return images


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', required=True)
    parser.add_argument('--candidates', required=True)
    args = parser.parse_args()
    client = Client(args.cache)
    catalogue = json.loads(Path(args.candidates).read_text())
    by_id = {o['id']: o for o in catalogue['objects']}
    lookup = defaultdict(set)
    for o in catalogue['objects']:
        for name in o['names']:
            # Display labels with several identities are not aliases.
            if '·' not in name and (len(key(name)) >= 3 or len(key(name)) >= 2 and re.search(r'\d', name)):
                for k in name_keys(name, family(o)):
                    lookup[(family(o), k)].add(o['id'])
    topics = defaultdict(set)
    articles = discover(client, topics)
    additional_topics = {title: groups for title, groups in topics.items() if title not in articles}
    # Keep supplemental discovery in its own batches so expanding category
    # coverage preserves cached requests for the main catalogue articles.
    subgroup_topics = {title: groups for title, groups in subgroup_articles(client).items()
                       if title not in articles and title not in additional_topics}
    # Structures such as gravitational flow regions need not belong to a
    # filament or supercluster category. Use the common parent subject too.
    structure_topics = {row['title']: {'structure'} for row in client.category('Large-scale structure of the cosmos')
                        if row['ns'] == 0 and row['title'] not in articles
                        and row['title'] not in additional_topics and row['title'] not in subgroup_topics}
    # Query redirects for the category articles as well: a common name such as
    # the Andromeda Galaxy can have a catalogue designation as a redirect.
    pages = []
    def metadata(batch):
        pages, continuation = {}, {}
        while True:
            data = client.get(API, titles='|'.join(batch), prop='info|pageprops|pageimages|langlinks|redirects',
                              inprop='url', piprop='original|name', lllang='ru', lllimit=500,
                              rdlimit=500, rdprop='title', **continuation)
            for id, page in data['query']['pages'].items():
                if id not in pages:
                    pages[id] = page
                else:
                    for field in ('redirects', 'langlinks'):
                        pages[id].setdefault(field, []).extend(page.get(field, []))
            continuation = data.get('continue')
            if not continuation:
                return pages.values()
    with ThreadPoolExecutor(max_workers=3) as pool:
        # Keep category-page and category-topic batches separate so that new
        # topics do not invalidate cached batches for thousands of known pages.
        batches = chunks(sorted(articles)) + chunks(sorted(additional_topics)) + chunks(sorted(subgroup_topics)) + chunks(sorted(structure_topics))
        for i, batch in enumerate(pool.map(metadata, batches)):
            for p in batch:
                if p.get('missing') is not None or 'redirect' in p or 'disambiguation' in p.get('pageprops', {}):
                    continue
                names = [p['title'], *[r['title'] for r in p.get('redirects', [])],
                         *[r['*'] for r in p.get('langlinks', [])]]
                groups = articles.get(p['title'], additional_topics.get(p['title'], subgroup_topics.get(p['title'], structure_topics.get(p['title'], set()))))
                found = match(names, groups, lookup)
                if found:
                    p['matches'] = dict(found)
                    p['family'] = sorted(groups)[0]
                    pages.append(p)
            if i % 20 == 0:
                print('Articles:', (i + 1) * 50, '/', len(articles), 'matched:', len(pages), flush=True)
    pages.extend(russian_pages(client, lookup, pages))
    files = sorted({p['pageimage'] for p in pages if p.get('pageimage')})
    images = fetch_images(client, files)
    records = []
    for p in sorted(pages, key=lambda p: p['title']):
        ru = next((r['*'] for r in p.get('langlinks', []) if r['lang'] == 'ru'), None)
        if p.get('language') == 'ru':
            ru = p['title']
        record = dict(title=p['title'], pageId=('ru-' if p.get('language') == 'ru' else '') + str(p['pageid']), revision=p['lastrevid'],
                      language=p.get('language', 'en'),
                      aliases=sorted({r['title'] for r in p.get('redirects', [])}),
                      url=clean_url(p['canonicalurl']), wikidata=p.get('pageprops', {}).get('wikibase_item'),
                      russianTitle=ru, matches=p['matches'])
        if p.get('imageArticle'):
            record['imageArticle'] = p['imageArticle']
        if p.get('pageimage') and file_key(p['pageimage']) in images:
            record['media'] = image_record(p, images[file_key(p['pageimage'])])
            # Some Wikipedia redirects for nuclei lead to their host galaxy's
            # article. The article remains relevant, but its leading galaxy
            # portrait must not become an image of the black hole itself.
            record['mediaObjects'] = [oid for oid in p['matches'] if by_id[oid]['kind'] != 'blackhole' or
                re.search(r'black.?hole|ч[её]рн.{0,3}дыр|\beht\b|event.horizon|sagittarius.?a',
                          p.get('pageimage', ''), re.I)]
        records.append(record)
    result = dict(version=1, catalogueRevision=catalogue['catalogueRevision'],
                  method='Exact own catalogue aliases / canonical article, redirects or Russian language link; compatible astronomy category; ambiguous aliases rejected',
                  categories=CATEGORIES, articleCount=len(articles) + len(additional_topics) + len(subgroup_topics) + len(structure_topics), records=records)
    SOURCE.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print('Saved', len(records), 'articles,', sum(bool(r.get('media')) for r in records), 'images', flush=True)


if __name__ == '__main__':
    main()
