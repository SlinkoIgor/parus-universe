"""Offline build of the stellar age layer for the object card.

Reads the frozen `star-ages.json` (import-star-ages.py) and the curated
`star-ages-curated.json`, adopts one published determination per Hipparcos
number and writes `dist/star-ages-data.js`, `star-ages-audit.json` and the
cache key in `dist/index.html`. No network, no catalogue tiles.
"""
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FROZEN = ROOT / 'data-tools/star-ages.json'
CURATED = ROOT / 'data-tools/star-ages-curated.json'
AUDIT = ROOT / 'data-tools/star-ages-audit.json'
OUT = ROOT / 'dist/star-ages-data.js'
HTML = ROOT / 'dist/index.html'
SOURCES = [
    {
        'key': 'casagrande2011',
        'label': 'Casagrande и др., 2011',
        'method': 'Возраст по изохронам BASTI из параллакса Hipparcos, температуры и металличности '
                  '(пересмотр Женевско-Копенгагенского обзора). Показаны математическое ожидание '
                  'и интервал 16–84 % распределения вероятности.',
    },
    {
        'key': 'david2015',
        'label': 'David и Hillenbrand, 2015',
        'method': 'Возраст по изохронам из температуры и силы тяжести по фотометрии uvbyβ при солнечном составе. '
                  'Показаны медиана и интервал 68 %. У очень молодых звёзд возле начальной главной '
                  'последовательности метод завышает возраст.',
    },
    {
        'key': 'luck2015',
        'label': 'Luck, 2015',
        'method': 'Возраст гиганта по изохронам из температуры и светимости. Показаны опубликованное среднее '
                  'и разброс между наборами изохрон; формальная погрешность не опубликована.',
    },
]


def main():
    frozen = json.loads(FROZEN.read_text())
    curated = json.loads(CURATED.read_text())
    adopted = {}
    audit = {'adopted': Counter(), 'overlapsResolved': Counter(), 'excluded': {}}
    for r in frozen['casagrande2011']['rows']:
        adopted[r[0]] = [0, r[1], r[2], r[4], int(len(r[8]) > 1)]
    for r in frozen['david2015']['rows']:
        if r[0] in adopted:
            audit['overlapsResolved']['casagrande2011 over david2015'] += 1
            continue
        adopted[r[0]] = [1, r[1], r[2], r[3], 0]
    luck = {}
    for r in frozen['luck2015']['rows']:
        luck.setdefault(r[0], []).append(r)
    repeated = sorted(hip for hip, rows in luck.items() if len(rows) > 1)
    audit['excluded']['luck2015 several rows for one HIP'] = repeated
    for hip, rows in luck.items():
        if len(rows) > 1:
            continue
        if hip in adopted:
            audit['overlapsResolved'][SOURCES[adopted[hip][0]]['key'] + ' over luck2015'] += 1
            continue
        models = [v for v in rows[0][2:] if v is not None]
        adopted[hip] = [2, rows[0][1], min(models) if len(models) > 1 else 0, max(models) if len(models) > 1 else 0,
                        len(models)]
    rows = []
    for hip in sorted(adopted):
        source, value, lower, upper, flag = adopted[hip]
        assert value > 0 and lower >= 0 and upper >= lower, (hip, adopted[hip])
        rows += [hip, source, value, lower, upper, flag]
        audit['adopted'][SOURCES[source]['key']] += 1
    sources = [{**s, 'url': frozen[s['key']]['url'], 'catalog': frozen[s['key']]['catalog']} for s in SOURCES]
    body = {
        'units': 'Myr',
        'columns': ['hip', 'source', 'age', 'lower', 'upper', 'flag'],
        'sources': sources,
        'objects': curated['objects'],
        'rows': rows,
    }
    text = json.dumps(body, ensure_ascii=False, separators=(',', ':'))
    revision = hashlib.sha256(text.encode()).hexdigest()[:12]
    js = "'use strict';\nconst STAR_AGES=" + json.dumps({'revision': revision, **body}, ensure_ascii=False,
                                                         separators=(',', ':')) + ';\n'
    OUT.write_text(js)
    key = hashlib.sha256(js.encode()).hexdigest()[:12]
    html = HTML.read_text()
    updated, count = re.subn(r'(star-ages-data\.js\?v=)[0-9a-f]+', lambda m: m[1] + key, html)
    assert count == 1, count
    HTML.write_text(updated)
    AUDIT.write_text(json.dumps({
        'revision': revision,
        'rule': 'One determination per HIP: Casagrande 2011, then David & Hillenbrand 2015, then Luck 2015. '
                'Published statistics are kept as they are; ages are never averaged across catalogues.',
        'adopted': dict(audit['adopted']),
        'overlapsResolved': dict(audit['overlapsResolved']),
        'excluded': audit['excluded'],
        'curatedObjects': sorted(curated['objects']),
        'frozenSha256': hashlib.sha256(FROZEN.read_bytes()).hexdigest(),
    }, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'revision': revision, 'stars': len(adopted), 'bytes': len(js.encode())}))


main()
