"""Import verified, single-galaxy SGA-2020 photographs; never download pixels.

Read public catalogue metadata, require exact own PGC/NGC identity plus a
coordinate agreement, then verify every selected published JPEG with HTTP HEAD.
Failed/partial refreshes cannot replace the frozen metadata snapshot.
"""
import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[1]
TAP='https://datalab.noirlab.edu/tap/sync'
BASE='https://portal.nersc.gov/project/cosmo/data/sga/2020/'
COLS='sga_id,galaxy,pgc,ra,dec,ra_leda,dec_leda,d26,d25_leda,group_name,group_ra,group_dec,group_primary,group_mult,ellipsebit'


def separation(ra, dec, x, y):
    value=math.sin(math.radians(dec-y)/2)**2+math.cos(math.radians(dec))*math.cos(math.radians(y))*math.sin(math.radians(ra-x)/2)**2
    return math.degrees(2*math.asin(min(1,math.sqrt(value))))*3600


def ngc_key(name):
    m=re.fullmatch(r'(NGC|IC)\s*0*(\d+)([A-Z]?)',name or '',re.I)
    return m[1].upper()+str(int(m[2]))+m[3].upper() if m else ''


def image_url(row):
    group=row['group_name']
    assert re.fullmatch(r'[A-Za-z0-9_+.-]+',group)
    return BASE+'data/'+f'{int(float(row["group_ra"])):03d}/'+group+'/'+group+'-largegalaxy-image-grz.jpg'


def match_objects(objects, rows):
    pgcs, names=defaultdict(list),defaultdict(list)
    for r in rows:
        if int(r['pgc'])>0:pgcs[int(r['pgc'])].append(r)
        if name:=ngc_key(r['galaxy']):names[name].append(r)
    matches, rejected, seen=[],Counter(),set()
    # Prefer the canonical NGC record if an unmerged duplicate has the same ID.
    for o in sorted(objects,key=lambda o:(not bool(o.get('ngc')),o['id'])):
        own={int(m[1]) for n in o.get('aliases') or [] if (m:=re.fullmatch(r'PGC\s*0*(\d+)',n,re.I))}
        if len(own)>1:rejected['ambiguous-own-pgc']+=1;continue
        identified=pgcs.get(next(iter(own)),[]) if own else names.get(ngc_key(o.get('ngc')),[])
        if len(identified)!=1:rejected['no-unique-own-identifier']+=1;continue
        r=identified[0]
        delta=separation(o['raDeg'],o['decDeg'],float(r['ra']),float(r['dec']))
        tolerance=max(3,min(30,float(r['d26'])*60*.05))
        if delta>tolerance:rejected['coordinate-disagreement']+=1;continue
        sid=int(r['sga_id'])
        if sid in seen:rejected['duplicate-physical-galaxy']+=1;continue
        seen.add(sid)
        matches.append(dict(targetId=o['id'],sgaId=sid,galaxy=r['galaxy'],pgc=int(r['pgc']),
            raDeg=float(r['ra']),decDeg=float(r['dec']),d26Arcmin=float(r['d26']),
            d25Arcmin=float(r['d25_leda']),groupName=r['group_name'],groupRaDeg=float(r['group_ra']),
            sourceUrl=image_url(r),separationArcsec=delta,toleranceArcsec=tolerance,
            method='exact own PGC' if own else 'exact own NGC/IC'))
    return sorted(matches,key=lambda r:(-r['d26Arcmin'],r['sgaId'])),dict(rejected)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache',type=Path,default=Path(tempfile.gettempdir())/'parus-sga-2020-metadata')
    parser.add_argument('--candidates',type=Path)
    parser.add_argument('--limit',type=int,default=12000)
    args=parser.parse_args();cache=args.cache;cache.mkdir(parents=True,exist_ok=True)
    candidate_path=args.candidates or cache/'candidates.json'
    if not args.candidates:
        subprocess.run(['/opt/homebrew/bin/node',str(ROOT/'data-tools/export-photo-candidates.mjs'),str(candidate_path)],cwd=ROOT,check=True)
    candidates=json.loads(candidate_path.read_text())
    revision=json.loads((ROOT/'dist/catalog-data/current.json').read_text())['revision']
    assert candidates['catalogueRevision']==revision,'candidate catalogue revision changed'
    def fetch(start):
        path=cache/f'sga-{start:03d}.csv'
        query=f'select {COLS} from sga2020.ellipse where ellipsebit=0 and group_mult=1 and ra_leda>={start} and ra_leda<{start+60}'
        if not path.exists():
            subprocess.run(['curl','-fLsS','--connect-timeout','10','--max-time','90','--retry','1',
                '--data-urlencode','REQUEST=doQuery','--data-urlencode','LANG=ADQL','--data-urlencode','FORMAT=csv',
                '--data-urlencode','MAXREC=500000','--data-urlencode','QUERY='+query,TAP,'-o',str(path)],check=True)
        data=path.read_bytes();rows=list(csv.DictReader(io.StringIO(data.decode())))
        assert rows and set(rows[0])==set(COLS.split(','))
        assert all(r['ellipsebit']=='0' and r['group_mult']=='1' and r['group_primary']=='1' and float(r['d26'])>0 for r in rows)
        return rows,dict(query=query,rows=len(rows),sha256=hashlib.sha256(data).hexdigest())
    with ThreadPoolExecutor(max_workers=3) as pool:parts=list(pool.map(fetch,range(0,360,60)))
    rows=[r for part,_ in parts for r in part]
    assert len({int(r['sga_id']) for r in rows})==len(rows)
    matches,rejected=match_objects(candidates['objects'],rows)
    print(f'{len(rows)} clean single-galaxy atlas records; {len(matches)} exact located matches',flush=True)
    checks_path=cache/'sga-image-checks.jsonl';checks={}
    if checks_path.exists():
        for line in checks_path.read_text().splitlines():
            q=json.loads(line);checks[q['url']]=q
    def usable(q):return bool(q and q['status']==200 and q['contentType'].split(';')[0]=='image/jpeg' and 1000<q['bytes']<=5_000_000)
    for offset in range(0,len(matches),500):
        if sum(usable(checks.get(r['sourceUrl'])) for r in matches)>=args.limit:break
        batch=[r for r in matches[offset:offset+500] if r['sourceUrl'] not in checks]
        if not batch:continue
        config=cache/'head-urls.txt'
        config.write_text(''.join('url = "'+r['sourceUrl']+'"\noutput = "/dev/null"\n' for r in batch))
        command=['curl','--silent','--show-error','--head','--parallel','--parallel-max','6','--connect-timeout','10',
            '--max-time','25','--retry','1','--retry-delay','1','--write-out',
            '%{url_effective}\t%{response_code}\t%{content_type}\t%header{content-length}\n','--config',str(config)]
        with checks_path.open('a') as log:
            job=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True)
            for line in job.stdout:
                try:
                    url,status,ctype,size=line.rstrip('\n').split('\t')
                    q=dict(url=url,status=int(status),contentType=ctype,bytes=int(size or 0),checked=datetime.now(timezone.utc).isoformat())
                except ValueError:continue
                checks[url]=q;log.write(json.dumps(q)+'\n');log.flush()
            job.wait()
        count=sum(usable(checks.get(r['sourceUrl'])) for r in matches)
        print(f'{count} available JPEGs verified',flush=True)
    selected=[dict(r,availability=checks[r['sourceUrl']]) for r in matches if usable(checks.get(r['sourceUrl']))][:args.limit]
    assert len(selected)>=args.limit, f'only {len(selected)} verified images; frozen data preserved'
    payload=dict(version=1,catalogueRevision=revision,retrieved=datetime.now(timezone.utc).isoformat(),
        source=dict(name='Siena Galaxy Atlas 2020',tap=TAP,table='sga2020.ellipse',
            documentation='https://www.legacysurvey.org/sga/sga2020/',
            rights='https://www.legacysurvey.org/acknowledgment/',
            credit='Legacy Surveys / D. Lang (Perimeter Institute)',
            survey='DECaLS / BASS / MzLS',license='CC BY 4.0',queries=[q for _,q in parts]),
        policy=dict(selection='largest D26 first; clean ellipsebit=0; single-galaxy groups only; every JPEG HEAD verified',
            identifier='own exact PGC, otherwise own exact NGC/IC; no sky-proximity join',
            position='separation <= max(3, min(30, 0.05 * D26_arcmin * 60)) arcsec',
            uniqueness='one catalogue object and photograph per SGA_ID',
            image='published observation image-grz.jpg only; no model, residual, montage or diagram'),
        sourceRows=len(rows),candidates=len(candidates['objects']),matchedCandidates=len(matches),
        rejected=rejected,records=selected)
    output=ROOT/'data-tools/sky-sources/media-sga.json';temporary=output.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n');temporary.replace(output)
    print(f'Frozen {len(selected)} verified galaxy photographs',flush=True)


if __name__=='__main__':main()
