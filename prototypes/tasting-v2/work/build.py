from pathlib import Path
import json,re,os
os.chdir(Path(__file__).resolve().parent.parent)
out=Path('../../public/tasting-v2');out.mkdir(parents=True,exist_ok=True)
css=Path('work/shell.css').read_text()+'\n'+Path('work/wheel-component.css').read_text()+'\n'+Path('work/integration.css').read_text()
js='const STARTING_POINTS='+Path('work/consolidated-reference/sources/tea-starting-points.json').read_text()+';const REFERENCE_PROFILES='+Path('work/consolidated-reference/sources/reference-profiles.json').read_text()+';const VOCABULARY='+Path('work/vocabulary.json').read_text()+';\n'+Path('work/wheel-component.js').read_text()+'\n'+Path('work/app.js').read_text().replace('wheel?.navigateTo?.(v)','wheel?.navigate?.(TeaWheel.families.findIndex(f=>f.notes.includes(v)||f.name===v))')
html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="/fonts/fonts.css"><title>Tasting v2 · Teajia</title><style>'''+css+'''</style></head><body><div id="tea-journey" aria-label="Tea tasting prototype"><header><button type="button" class="plain back-head" data-action="back" aria-label="Back to assessment" hidden>←</button><div class="tea-heading"><span class="small">Tasting v2 · preview</span><h2 id="tea-title">Da Hong Pao</h2><span class="small" id="tea-context"></span></div><button id="save" type="button" data-action="save">Save</button></header><nav class="workspace-nav" aria-label="Tasting workspace"></nav><main></main><footer><p id="save-status" role="status" aria-live="polite"></p></footer></div><script>'''+js+'''</script></body></html>'''
(out/'index.html').write_text(html)
print('Built standalone outputs/tea-tasting.html')
