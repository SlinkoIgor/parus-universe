"""Build a compact exact-object index and lazy SGA photo metadata, offline."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import tempfile
import zlib

ROOT=Path(__file__).resolve().parents[1]


def validate_targets(frozen):
    """Recheck frozen image identities against the active catalogue, offline.

    A distance-only update need not discard confirmed images. Original source
    provenance stays frozen; each own identifier and sky separation is checked
    again before binding the index to a newer scientific snapshot.
    """
    pointer=json.loads((ROOT/'dist/catalog-data/current.json').read_text())
    wanted={r['targetId'] for r in frozen['records']}
    # Use the same merged core identities/policies as the original import.
    # Raw OpenNGC aliases alone omit identifiers adopted from other catalogues.
    node='/opt/homebrew/bin/node' if Path('/opt/homebrew/bin/node').exists() else 'node'
    with tempfile.TemporaryDirectory(prefix='parus-image-identities-') as tmp:
        path=Path(tmp)/'candidates.json'
        subprocess.run([node,str(ROOT/'data-tools/export-photo-candidates.mjs'),str(path)],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
        candidates=json.loads(path.read_text())
    assert candidates['catalogueRevision']==pointer['revision']
    objects={o['id']:o for o in candidates['objects'] if o['id'] in wanted}
    assert set(objects)==wanted, 'A photographed catalogue identity disappeared'
    spec=importlib.util.spec_from_file_location('sga_import',ROOT/'data-tools/fetch-sga-photos.py')
    matcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(matcher)
    for r in frozen['records']:
        o=objects[r['targetId']]
        pgcs={int(m[1]) for n in o.get('aliases') or [] if (m:=re.fullmatch(r'PGC\s*0*(\d+)',n,re.I))}
        if r['method']=='exact own PGC':assert pgcs=={r['pgc']},o['id']
        else:assert not pgcs and matcher.ngc_key(o.get('ngc'))==matcher.ngc_key(r['galaxy']),o['id']
        delta=matcher.separation(o['raDeg'],o['decDeg'],r['raDeg'],r['decDeg'])
        assert delta<=r['toleranceArcsec'],o['id']+' no longer agrees with the image position'
    return pointer['revision']


def build():
    frozen=json.loads((ROOT/'data-tools/sky-sources/media-sga.json').read_text())
    assert frozen['version']==1
    catalogue_revision=validate_targets(frozen)
    records=frozen['records'];assert len({r['sgaId'] for r in records})==len(records)
    assert len({r['targetId'] for r in records})==len(records)
    parts={i:{} for i in range(32)};targets={}
    for r in records:
        assert r['availability']['status']==200 and r['availability']['contentType'].split(';')[0]=='image/jpeg'
        assert 1000<r['availability']['bytes']<=5_000_000
        group=r['groupName'];assert re.fullmatch(r'[A-Za-z0-9_+.-]+',group)
        expected='https://portal.nersc.gov/project/cosmo/data/sga/2020/data/'+f'{int(r["groupRaDeg"]):03d}/'+group+'/'+group+'-largegalaxy-image-grz.jpg'
        assert r['availability']['url']==r['sourceUrl']==expected
        assert r['method'] in ['exact own PGC','exact own NGC/IC'] and r['d26Arcmin']>0
        assert r['separationArcsec']<=r['toleranceArcsec']<=30
        part=zlib.crc32(r['targetId'].encode())%32;targets[r['targetId']]=part
        parts[part][r['targetId']]=dict(id='sga-grz-'+str(r['sgaId']),targetId=r['targetId'],
            title=r['galaxy']+' — Siena Galaxy Atlas',instrument='DESI Legacy Imaging Surveys',
            band='g / r / z · цветной снимок',date='Релиз SGA-2020',url=r['sourceUrl'],source=r['sourceUrl'],
            archive=frozen['source']['documentation'],archiveLabel='Siena Galaxy Atlas',
            credit=frozen['source']['credit'],creditUrl=frozen['source']['rights'],rights='CC BY 4.0',
            description='Фотография галактики из Siena Galaxy Atlas, составленная из наблюдений в трёх фильтрах. Цвета зависят от обработки; фотографические детали обычно не видны в окуляре.',
            mediaKind='observation',identification=dict(sgaId=r['sgaId'],pgc=r['pgc'],method=r['method'],
                raDeg=r['raDeg'],decDeg=r['decDeg'],d26Arcmin=r['d26Arcmin'],
                separationArcsec=r['separationArcsec'],toleranceArcsec=r['toleranceArcsec']))
    files={}
    for part,photos in parts.items():
        if not photos:continue
        payload=json.dumps(dict(version=1,photos=dict(sorted(photos.items()))),ensure_ascii=False,separators=(',',':'))+'\n'
        name=f'sky-imaging-{part:02d}.json';revision=hashlib.sha256(payload.encode()).hexdigest()[:12]
        (ROOT/'dist'/name).write_text(payload);files[part]=dict(url=name+'?v='+revision,count=len(photos))
    index=dict(version=1,catalogueRevision=catalogue_revision,sourceCatalogueRevision=frozen['catalogueRevision'],photoCount=len(records),
        targets=dict(sorted(targets.items())),files=files)
    index['revision']=hashlib.sha256(json.dumps(index,separators=(',',':')).encode()).hexdigest()[:12]
    script="'use strict';\nconst SKY_IMAGING_INDEX="+json.dumps(index,separators=(',',':'))+';\n'
    (ROOT/'dist/sky-imaging-index.js').write_text(script)
    html=(ROOT/'dist/index.html').read_text()
    for name in ['sky-imaging-index','sky-imaging']:
        digest=hashlib.sha256((ROOT/'dist'/f'{name}.js').read_bytes()).hexdigest()[:12]
        html=re.sub('('+name+r'\.js\?v=)[^" ]+',lambda m:m[1]+digest,html)
    (ROOT/'dist/index.html').write_text(html)
    print(f'{len(records)} verified SGA observations; {len(files)} lazy shards; index {len(script)} bytes; revision {index["revision"]}')


if __name__=='__main__':build()
