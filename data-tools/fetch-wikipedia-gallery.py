#!/usr/bin/env python3
"""Attribute the labelled maps requested by the user; match all known labels."""
import argparse
import importlib.util
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'data-tools/sky-sources'
spec = importlib.util.spec_from_file_location('wiki_import', ROOT / 'data-tools/fetch-wikipedia-media.py')
wiki = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wiki)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', required=True)
    parser.add_argument('--candidates', required=True)
    args = parser.parse_args()
    client = wiki.Client(args.cache)
    catalogue = json.loads(Path(args.candidates).read_text())
    lookup = defaultdict(set)
    for o in catalogue['objects']:
        for name in o['names']:
            lookup[wiki.key(name)].add(o['id'])
    # Verified language links connect translated labels to the same identity;
    # they do not depend on proximity or on a similar name of a larger region.
    for r in json.loads((SRC / 'wikipedia.json').read_text())['records']:
        for name in [r['title'], r.get('russianTitle'), *r.get('aliases', [])]:
            if name:
                lookup[wiki.key(name)].update(r['matches'])
    sources = json.loads((SRC / 'wikipedia-gallery-sources.json').read_text())['records']
    data = client.get(wiki.COMMONS, titles='|'.join('File:' + p['file'] for p in sources),
                      prop='imageinfo', iiprop='url|extmetadata|size', iiurlwidth=1280)
    files = {wiki.file_key(p['title'].split(':', 1)[1]): p for p in data['query']['pages'].values()}
    records, unmatched = [], []
    for source in sources:
        file = files[wiki.file_key(source['file'])]
        assert file.get('imageinfo'), source['file']
        p = wiki.image_record(dict(pageimage=source['file'], title=source['title'], family='structure'), file['imageinfo'][0])
        assert p, 'Commons attribution is required: ' + source['file']
        objects, evidence = set(), {}
        for label in source['labels']:
            ids = set().union(*(lookup.get(wiki.key(name), set()) for name in [label, *source.get('labelIdentifiers', {}).get(label, [])]))
            if len(ids) == 1:
                oid = next(iter(ids))
                objects.add(oid)
                evidence[oid] = label
            else:
                unmatched.append(dict(file=source['file'], label=label, candidates=sorted(ids)))
        p.update(title=source['title'], description=source['description'], mediaType=source.get('mediaType', 'map'), mediaKind=source.get('mediaType', 'map'),
                 objects=sorted(objects), identification=dict(article=source['article'], labelledObjects=evidence,
                 labelIdentifierSource=source.get('labelIdentifierSource'),
                 method=source.get('labelEvidence') or 'Exact unique own catalogue alias of a label transcribed from the original map; no containment inheritance'))
        records.append(p)
    output = dict(version=1, records=records, unmatched=unmatched)
    (SRC / 'wikipedia-gallery.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print('Gallery maps:', len(records), 'associations:', sum(len(p['objects']) for p in records))
    for p in records:
        print(p['title'], p['objects'])


if __name__ == '__main__':
    main()
