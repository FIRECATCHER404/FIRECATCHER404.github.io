"""Package either vector app as a dependency-free offline HTML file."""
from pathlib import Path
import argparse,base64,json,re
p=argparse.ArgumentParser();p.add_argument('--app',choices=['shape-morph','svg-paint'],default='shape-morph');p.add_argument('--output',required=True,type=Path);args=p.parse_args()
if args.output.exists():raise SystemExit('Output already exists; choose a new path.')
root=Path(__file__).resolve().parents[1]/'projects'/args.app
app=(root/'app.js').read_text(encoding='utf-8')
def inline(match):
    module=(root/match.group(1).split('?')[0]).resolve().read_text(encoding='utf-8')
    return "from"+json.dumps('data:text/javascript;base64,'+base64.b64encode(module.encode()).decode())
app=re.sub(r"from'([^']+)'",inline,app)
html=(root/'index.html').read_text(encoding='utf-8')
html=re.sub(r'<link rel="stylesheet" href="style.css[^\"]*">',lambda _: '<style>'+(root/'style.css').read_text(encoding='utf-8')+'</style>',html)
html=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',html)
html=html.replace('href="../"','href="https://firecatcher404.github.io/projects/"').replace('href="../svg-paint/"','href="SVG-Paint.html"').replace('href="../shape-morph/"','href="Shape-Morph.html"')
html=html.replace('</body>','<script type="module">'+app.replace('</script','<\\/script')+'</script></body>')
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(html,encoding='utf-8')
print(json.dumps({'path':str(args.output.resolve()),'bytes':args.output.stat().st_size}))
