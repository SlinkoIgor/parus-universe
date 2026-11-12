"""Bundle the checked-in static game into one offline HTML file."""
from pathlib import Path
import base64,re,sys,mimetypes,json
root=Path(__file__).resolve().parent.parent/'dist'
html=(root/'index.html').read_text()
def css(match):
 text=(root/match[1].split('?')[0]).read_text()
 def asset(m):
  name=m[1].strip('\"\'');p=root/name
  if not p.is_file():return m[0]
  mime=mimetypes.guess_type(p)[0] or 'application/octet-stream'
  return 'url(data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()+')'
 return '<style>'+re.sub(r'url\(([^)]+)\)',asset,text)+'</style>'
html=re.sub(r'<link[^>]+href="([^" ]+\.css(?:\?[^" ]*)?)"[^>]*>',css,html)
html=re.sub(r'<script src="([^" ]+)"(?: data-app)?></script>',lambda m:'<script>'+ (root/m[1].split('?')[0]).read_text().replace('</script','<\\/script')+'</script>',html)
# file:// cannot fetch local tiles. Embed their JSON as strings; parse only the
# requested tile. HTTP preview remains the efficient, bounded-memory default.
pointer=root/'catalog-data/current.json'
catalog=root/(json.loads(pointer.read_text())['dataRoot'] if pointer.exists() else 'catalog-data')
if catalog.exists():
 manifest=json.loads((catalog/'manifest.json').read_text())
 search=json.loads((catalog/'search.json').read_text())
 names={'manifest.json','search.json'}|{n['file'] for n in manifest['nodes']}|{row[5] for row in search}
 files={'catalog-data/'+name:(catalog/name).read_text() for name in sorted(names)}
 for path in root.glob('sky-photos-*.json'):files[path.name]=path.read_text()
 for path in root.glob('sky-imaging-*.json'):files[path.name]=path.read_text()
 if (root/'arrival-stars-index.json').exists():files['arrival-stars-index.json']=(root/'arrival-stars-index.json').read_text()
 layer_pointer=root/'map-layers/current.json'
 if layer_pointer.exists():
  layer_root=json.loads(layer_pointer.read_text())['dataRoot']
  layer_manifest=json.loads((root/layer_root/'manifest.json').read_text())
  for node in layer_manifest['nodes']:
   if 'file' in node:files[layer_root+'/'+node['file']]=(root/layer_root/node['file']).read_text()
 slice_pointer=root/'map-slices/current.json'
 if slice_pointer.exists():
  slice_info=json.loads(slice_pointer.read_text());slice_root=slice_info['dataRoot']
  slice_manifest=json.loads((root/slice_root/'manifest.json').read_text())
  for name in ['map-slices/current.json',slice_root+'/manifest.json']+[n['file'] for n in slice_manifest['nodes'] if n['file'].startswith('map-slices/')]:
   files[name]=(root/name).read_text()
 radial_pointer=root/'map-radial/current.json'
 if radial_pointer.exists():
  radial_root=json.loads(radial_pointer.read_text())['dataRoot']
  radial_manifest=json.loads((root/radial_root/'manifest.json').read_text())
  radial_layers=json.loads((root/radial_root/'layers.json').read_text())
  radial_files=['map-radial/current.json',radial_root+'/manifest.json',radial_root+'/layers.json']+[n['file'] for n in radial_manifest['nodes']]+[radial_root+'/'+n['file'] for n in radial_layers['nodes'] if 'file' in n]
  for name in radial_files:files[name]=(root/name).read_text()
 visibility_pointer=root/'map-visibility/current.json'
 if visibility_pointer.exists():
  visibility_root=json.loads(visibility_pointer.read_text())['dataRoot']
  for path in (root/visibility_root).glob('*.json'):
   if path.name=='manifest.json':continue
   files[str(path.relative_to(root))]=path.read_text()
 payload=json.dumps(files,ensure_ascii=False,separators=(',',':')).replace('</script','<\\/script')
 html=html.replace('</head>','<script>globalThis.PARUS_CATALOG_FILES='+payload+';</script></head>')
output=Path(sys.argv[1]);output.parent.mkdir(parents=True,exist_ok=True);output.write_text(html)
print(output)
