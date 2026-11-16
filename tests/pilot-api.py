"""Live API regression checks. Requires private fixture credentials, never real user accounts."""
import json,re,sys,urllib.request,urllib.error
from pathlib import Path
accounts=json.loads(Path(sys.argv[1]).read_text())
source=(Path(__file__).resolve().parents[1]/'portal/yz101/index.html').read_text()
lessons=json.loads(re.search(r'const LESSONS=(.*?);\s*const ',source,re.S)[1])
BASE='https://gjztdlihsfmozxcgdwke.supabase.co'
KEY='sb_publishable_tDQAKMpHaorQAplXqg5Nqg_zwOImZeT'
def call(path,body,token=None):
 h={'apikey':KEY,'Content-Type':'application/json'}
 if token:h['Authorization']='Bearer '+token
 req=urllib.request.Request(BASE+path,data=json.dumps(body).encode(),headers=h)
 try:
  with urllib.request.urlopen(req,timeout=30) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
count=0
for i,l in enumerate(lessons):
 token=accounts[i//5]['token'];answers=[q['correct'] for q in l['questions']]
 for j in range(3):
  wrong=answers.copy();wrong[j]=(wrong[j]+1)%len(l['questions'][j]['options'])
  status,d=call('/rest/v1/rpc/yz101_pilot_submit',{'p_task':l['id'],'p_answers':wrong},token)
  assert status==200 and not d['quiz_passed'],(l['id'],j,d);count+=1
 if l.get('numericExercise'):
  for bad in [None,l['numericExercise']['value']+1]:
   _,d=call('/rest/v1/rpc/yz101_pilot_submit',{'p_task':l['id'],'p_numeric':bad},token)
   assert not d['numeric_passed'],(l['id'],d)
 _,d=call('/rest/v1/rpc/yz101_pilot_submit',{'p_task':l['id'],'p_answers':answers,'p_numeric':l.get('numericExercise',{}).get('value')},token)
 assert d['quiz_passed'] and d['numeric_passed'],(l['id'],d)
 print(l['id'],'3 wrong-answer checks + correct answers + numeric passed',flush=True)
assert call('/rest/v1/rpc/yz101_pilot_progress',{'p_action':'list'})[0] in (401,403)
assert call('/rest/v1/rpc/yz101_ai_evaluation_control',{'p_action':'reserve'},accounts[0]['token'])[0] in (401,403)
for i,a in enumerate(accounts):
 _,data=call('/rest/v1/rpc/yz101_pilot_progress',{'p_action':'list'},a['token'])
 assert {x['task_id'] for x in data}=={x['id'] for x in lessons[i*5:i*5+5]},data
print('PASS: 45 individual negative question checks, 15 full answer sets, 4 numerical exercises, anonymous rejection and account isolation',flush=True)
