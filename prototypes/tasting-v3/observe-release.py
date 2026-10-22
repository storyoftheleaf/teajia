"""Observe one immutable Pages release without redeploying. Resume with its state JSON."""
import hashlib,json,os,re,subprocess,sys,time,urllib.request
from pathlib import Path
state_path=Path(sys.argv[1]).resolve()
s=json.loads(state_path.read_text())
def persist():
    s['updated_at']=time.time()
    tmp=state_path.with_suffix('.tmp');tmp.write_text(json.dumps(s,indent=2));tmp.replace(state_path)
def digest(url):
    req=urllib.request.Request(url,headers={'Cache-Control':'no-cache','User-Agent':'Teajia-V3-release-proof'})
    with urllib.request.urlopen(req,timeout=30) as response:
        return hashlib.sha256(response.read()).hexdigest()
s.update(pid=os.getpid(),state='observing');persist()
while time.time()<s['deadline']:
    try:
        result=subprocess.run(['gh','api',f"repos/storyoftheleaf/teajia/commits/{s['revision']}/check-runs"],capture_output=True,text=True,timeout=45,check=True)
        checks=json.loads(result.stdout)['check_runs']
        check=next((c for c in checks if c['name']=='Cloudflare Pages'),None)
        s['deployment_status']=check['status'] if check else 'pending';persist()
        if check and check['status']=='completed':
            if check['conclusion']!='success':
                s.update(state='failed',error='Cloudflare Pages: '+str(check['conclusion']));break
            urls=re.findall(r'https://[a-z0-9-]+\.teajiafinal\.pages\.dev',check['output'].get('summary') or '')
            if not urls: raise ValueError('Successful Pages check missing deployment URL')
            direct=urls[0]+'/tasting-v3/'
            s['deployment_url']=direct
            s['direct_sha256']=digest(direct)
            s['production_sha256']=digest(s['url']+'?revision='+s['revision'])
            if s['direct_sha256']==s['expected_sha256']==s['production_sha256']:
                s.update(state='live',verified_at=time.time());break
            s['last_error']='Live bytes do not yet match the immutable candidate'
    except Exception as error:
        s['last_error']=str(error)
    persist();time.sleep(45)
else:
    s.update(state='needs_attention',error='Timed out waiting for exact live artifact')
persist()
# Local owner notification only, deduplicated in the durable state.
if not s.get('notified'):
    message='Tasting V3 is verified live at teajia.com/tasting-v3/' if s['state']=='live' else 'Tasting V3 publishing needs attention. Check the saved release status.'
    if sys.platform=='darwin':
        subprocess.run(['osascript','-e','display notification '+json.dumps(message)+' with title "Teajia release"'],capture_output=True)
    s['notified']=True;persist()
