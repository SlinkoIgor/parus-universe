#!/usr/bin/env python3
"""Rebuild the additive photographed-quasar landmarks from frozen evidence."""
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / 'data-tools/sky-sources/quasars.json').read_text())
records = source['objects']
assert len({q['id'] for q in records}) == len(records)
for q in records:
    assert 0 <= q['ra'] < 360 and -90 <= q['dec'] <= 90 and q['z'] > 0
    assert q['redshiftError'] is None or q['redshiftError'] > 0
    assert q['photoIds'] and q['sourceEvidence']['coordinates'] and q['sourceEvidence']['redshift']
    assert q['url'].startswith('https://simbad.')
payload = [{k: v for k, v in q.items() if k not in ['sourceEvidence', 'photoIds']} for q in records]
code = '// BEGIN GENERATED QUASARS\n// data-tools/build-quasar-catalog.py; ICRS J2000, dimensionless z.\n'
code += 'for(const q of ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ')CosmicCatalog.addQuasar(q);\n'
code += '// END GENERATED QUASARS'
path = ROOT / 'dist/cosmic-catalog.js'
text, count = re.subn(r'// BEGIN GENERATED QUASARS\n.*?// END GENERATED QUASARS', lambda _: code, path.read_text(), flags=re.S)
assert count == 1
if text != path.read_text():
    path.write_text(text)
print(f'Photographed quasars: {len(records)} additive nuclei; source positions, redshifts and errors retained')
