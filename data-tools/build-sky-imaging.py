"""Build a compact exact-object index and lazy SGA photo metadata, offline."""
import hashlib
import json
from pathlib import Path
import re
import zlib

ROOT=Path(__file__).resolve().parents[1]


def build():
    frozen=json.loads((ROOT/'data-tools/sky-sources/media-sga.json').read_text())
    assert frozen['version']==1
    assert frozen['catalogueRevision']==json.loads((ROOT/'dist/catalog-data/current.json').read_text())['revision']
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
    index=dict(version=1,catalogueRevision=frozen['catalogueRevision'],photoCount=len(records),
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
