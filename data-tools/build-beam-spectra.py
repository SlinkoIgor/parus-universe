#!/usr/bin/env python3
from pathlib import Path
import gzip,json,math,hashlib
import argparse
parser=argparse.ArgumentParser(description='Rebin Nugent SN spectra for diffraction (no photometric light-curve model).')
parser.add_argument('--raw-dir', type=Path, required=True, help='sn2p.gz, sn1a.gz, sn1bc.gz downloaded from the URLs stored in the output')
parser.add_argument('--output', type=Path, default=Path('dist/beam-spectra.js'))
args=parser.parse_args()
N=64;edges=[100e-9*25**(i/N) for i in range(N+1)];wavelengths=[math.sqrt(edges[i]*edges[i+1]) for i in range(N)]
data={}
for key,name,label,version in [('iip','sn2p','II-P','1.2'),('ia','sn1a','Ia','1.2'),('ibc','sn1bc','Ib/c','1.1')]:
 raw=(args.raw_dir/f'{name}.gz').read_bytes();rows={}
 for line in gzip.decompress(raw).decode().splitlines():
  if not line.strip() or line.startswith('#'):continue
  t,angstrom,f=map(float,line.split());rows.setdefault(t,[]).append((angstrom*1e-10,max(0,f)))
 # Day zero of Ia/Ibc is only a numerical flux floor. Extend the first
 # nonzero spectrum back to zero rather than normalize that artificial floor.
 phases=sorted(t for t in rows if 1<=t<=30)
 if key=='iip':phases.append(36.)
 spectra=[]
 for t in phases:
  weights=[0.]*N; a=rows[t]
  # Trapezoidal energy integration, split at every output band boundary.
  for (x,f),(y,g) in zip(a,a[1:]):
   cuts=[x]+[z for z in edges if x<z<y]+[y]
   for u,v in zip(cuts,cuts[1:]):
    mid=(u+v)/2;i=min(N-1,max(0,int(math.log(mid/edges[0])/math.log(25)*N)))
    fu=f+(g-f)*(u-x)/(y-x);fv=f+(g-f)*(v-x)/(y-x)
    weights[i]+=(fu+fv)*(v-u)/2
  total=sum(weights);spectra.append([float(f'{w/total:.9g}') for w in weights])
 data[key]={'label':label,'days':phases,'weights':spectra,'url':f'https://c3.lbl.gov/nugent/templates/{name}_flux.v{version}.dat.gz','sha256':hashlib.sha256(raw).hexdigest()}
(args.output).write_text("'use strict';\n// Nugent time-evolving SN templates; 100–2500 nm, 64 energy bands.\n// Rebinning/normalization: data-tools/build-beam-spectra.py. Source/limits: docs/physics.md.\nconst BeamSpectra="+json.dumps({'wavelengths':wavelengths,'profiles':data},separators=(',',':'))+';\n')
print('spectral data bytes', (args.output).stat().st_size)
