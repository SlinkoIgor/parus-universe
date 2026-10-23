"""Bundle the checked-in static game into one offline HTML file."""
from pathlib import Path
import base64,re,sys,mimetypes
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
html=re.sub(r'<script src="([^" ]+)"></script>',lambda m:'<script>'+ (root/m[1].split('?')[0]).read_text().replace('</script','<\\/script')+'</script>',html)
output=Path(sys.argv[1]);output.parent.mkdir(parents=True,exist_ok=True);output.write_text(html)
print(output)
