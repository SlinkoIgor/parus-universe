#!/usr/bin/env python3
"""Import observed M31/M33 members; --download refreshes public source snapshots."""
from pathlib import Path
import json,hashlib,csv,collections
ROOT=Path(__file__).resolve().parent.parent;raw=ROOT/'data-tools/raw'
# Default is offline. Download only when explicitly requested on the command line.
if '--download' in __import__('sys').argv:
 from urllib.request import urlopen
 from urllib.parse import urlencode
 import ssl
 ctx=ssl.create_default_context(cafile='/etc/ssl/cert.pem' if Path('/etc/ssl/cert.pem').exists() else None)
 urls={'lggs-confirmed.tsv':'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?'+urlencode({'-source':'J/AJ/152/62','Mm':'1','-out.all':'','-out.max':'unlimited'}),'phat-clusters.dat':'https://cdsarc.cds.unistra.fr/ftp/J/ApJ/802/127/table2.dat','m33-snr.dat':'https://cdsarc.cds.unistra.fr/ftp/J/ApJ/855/140/table1.dat'}
 raw.mkdir(exist_ok=True)
 for name,url in urls.items():
  body=urlopen(url,context=ctx,timeout=120).read()
  if not body or b'#INFO\tError=' in body:raise RuntimeError('Invalid catalog response: '+name)
  (raw/name).write_bytes(body)
def num(v):
 try:return float(v)
 except:return None
def sex(v,h=False):
 p=v.split();sign=-1 if p[0].startswith('-') else 1
 return sign*(abs(float(p[0]))+float(p[1])/60+float(p[2])/3600)*(15 if h else 1)
objects=[]
s=raw.joinpath('lggs-confirmed.tsv').read_text().split('#Name: J/AJ/152/62/catalog\n',1)[1].split('#Table',1)[0]
lines=[l for l in s.splitlines() if l and not l.startswith('#')];header=lines[0].split('\t')
for line in lines[3:]:
 q=dict(zip(header,[v.strip() for v in line.split('\t')]))
 if q.get('Mm')!='1':continue
 host={'M31':'andromeda','M33':'triangulum'}[q['Gal']];spect=q['SpT'];pure_neb=spect.startswith('HII') and not any(c in spect for c in ['+','/'])
 objects.append({'id':'lggs-'+q['Gal'].lower()+'-'+q['LGGS'].lower(),'name':q['Gal']+' · LGGS '+q['LGGS'],'host':host,'kind':'nebula' if pure_neb else 'star','type':'Область H II' if pure_neb else 'Звезда · '+spect,'raDeg':sex(q['RAJ2000'],True),'decDeg':sex(q['DEJ2000']),'magV':num(q['Vmag']),'publishedRgc':num(q['Rgc']),'crowding':q['Cwd'],'placement':'disk','aliases':['LGGS '+q['LGGS'],q['Gal']+' '+q['LGGS']],'source':'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/152/62','membership':'LGGS Mm=1: членство подтверждено спектроскопией.'})
for line in raw.joinpath('phat-clusters.dat').read_text().splitlines():
 ident=line[:5].strip();alt=line[64:82].strip();flag=line[83:84].strip()
 objects.append({'id':'phat-ap-'+ident,'name':'M31 · PHAT AP '+ident,'host':'andromeda','kind':'cluster','type':'Звёздное скопление · PHAT','raDeg':float(line[6:15]),'decDeg':float(line[16:25]),'halfLightRadiusArcsec':num(line[32:37]),'weightedClusterFraction':num(line[52:58]),'sourceFlag':flag,'placement':'host-envelope','aliases':['AP '+ident,'[JSD2015] AP'+ident]+([alt] if alt else []),'source':'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/802/127','membership':'Основной каталог PHAT/AP, table2: скопления M31. Фоновые галактики и непроверенные кандидаты из других таблиц не включены.'})
for line in raw.joinpath('m33-snr.dat').read_text().splitlines():
 if line[79:82].strip()!='yes':continue
 ident=line[:8].strip()
 objects.append({'id':'m33-snr-'+ident.lower(),'name':'M33 · '+ident,'host':'triangulum','kind':'nebula','type':'Остаток сверхновой · спектроскопическое подтверждение','raDeg':sex(line[9:20],True),'decDeg':sex(line[21:32]),'diameterPc':num(line[33:36]),'placement':'disk','aliases':[ident,'M33 SNR '+ident],'source':'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/855/140','membership':'Long et al. 2018, table1 Conf=yes: [S II]/Hα ≥0,4; диагностический критерий остатка сверхновой.'})
result={'retrieved':__import__('re').search(r'#\s+Date:\s*(\d{4}-\d{2}-\d{2})',raw.joinpath('lggs-confirmed.tsv').read_text())[1],'selection':'LGGS 2016 Mm=1; PHAT/AP 2015 main table2 only; M33 SNR 2018 Conf=yes. No foreground or background-galaxy tables.','rawSHA256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [raw/'lggs-confirmed.tsv',raw/'phat-clusters.dat',raw/'m33-snr.dat']},'counts':dict(collections.Counter(o['host']+':'+o['kind'] for o in objects)),'objects':objects}
ROOT.joinpath('data-tools/galaxy-disk-objects.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
print(result['counts'],len(objects))
