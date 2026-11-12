"""Attach reviewed destination identities without regenerating the scientific core.

Source objects, measured positions, source photo metadata and tiles stay intact.
The original curator embeds this same policy on subsequent full core imports.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'dist/catalog-import.js'
text = path.read_text()
prefix, payload = text.split('const IMPORTED_CATALOG=', 1)
data, end = json.JSONDecoder().raw_decode(payload)
data['identityPolicy'] = json.loads((ROOT / 'data-tools/deep-sky-identities.json').read_text())
ids = {o['id'] for o in data['objects']}
seen = set()
for group in data['identityPolicy']['groups']:
    assert group['target'] in group['members'] and set(group['members']) <= ids
    assert not seen.intersection(group['members']), 'overlapping identity groups'
    seen.update(group['members'])
for group in data['identityPolicy']['distinct']:
    assert set(group['members']) <= ids or not group.get('names')
path.write_text(prefix + 'const IMPORTED_CATALOG=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + payload[end:])
print('Attached reviewed deep-sky identity policy; source objects unchanged')
