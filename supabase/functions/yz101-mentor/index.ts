import { synthesizeWaveNet } from '../_shared/wavenet.mjs';
import { MENTOR_SYSTEM, validExplanation, parseMentorInput, plainExplanation } from './policy.mjs';
const base=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={'Access-Control-Allow-Origin':'https://noraapps.web.app','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers});
async function control(action:string,user:string,data:Record<string,unknown>={}){
 const r=await fetch(base+'/rest/v1/rpc/yz101_mentor_control',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_user:user,...data})});
 if(!r.ok)throw Error('control_failed');return await r.json();
}
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 try{
  const bearer=req.headers.get('Authorization')||'';
  if(!/^Bearer [\w.-]+$/.test(bearer))return reply({error:'unauthorized'},401);
  const auth=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:bearer},signal:AbortSignal.timeout(8000)});
  if(!auth.ok)return reply({error:'unauthorized'},401);
  const user=(await auth.json()).id;if(!user)return reply({error:'unauthorized'},401);
  if(Number(req.headers.get('content-length')||0)>12000)return reply({error:'invalid_input'},413);
  const raw=await req.text();if(raw.length>6000)return reply({error:'invalid_input'},413);
  let data;try{data=parseMentorInput(JSON.parse(raw))}catch{return reply({error:'invalid_input'},400)}
  if(data.action==='voice'){
   if(!Deno.env.get('GOOGLE_TTS_API_KEY'))return reply({error:'voice_unavailable'},503);
   const claim=await control('voice_claim',user,{p_id:data.id});
   if(claim.status==='cached')return reply({status:'ready',audio:claim.audio});
   if(claim.status!=='reserved')return reply(claim);
   try{
    const audio=await synthesizeWaveNet(claim.text,{apiKey:Deno.env.get('GOOGLE_TTS_API_KEY')});
    let binary='';for(const byte of audio.bytes)binary+=String.fromCharCode(byte);
    const encoded=btoa(binary);
    await control('voice_finish',user,{p_id:data.id,p_payload:{ok:true,audio:encoded,characters:audio.characters}});
    return reply({status:'ready',audio:encoded});
   }catch{
    await control('voice_finish',user,{p_id:data.id,p_payload:{ok:false}}).catch(()=>{});
    return reply({error:'voice_unavailable'},503);
   }
  }
  const key=Deno.env.get('Anthropic YZ101')||Deno.env.get('ANTHROPIC_API_KEY');
  if(!key)return reply({error:'mentor_unavailable'},503);
  const context=await control('context',user,{p_task:data.task_id});
  if(context.status!=='ready')return reply(context);
  const prompt=JSON.stringify({lesson:context.rubric,previous_feedback:context.feedback,student_answer:data.answer,student_question:data.message||'Yanıtımdaki en önemli eksikliği anlamama yardım et.'});
  const cache=await hash('mentor-v3\n'+prompt);
  const claim=await control('reserve',user,{p_task:data.task_id,p_hash:cache});
  if(claim.status==='cached')return reply({status:'ready',id:claim.id,text:claim.text});
  if(claim.status!=='reserved')return reply(claim);
  let usage={input_tokens:0,output_tokens:0};
  try{
   const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:AbortSignal.timeout(25000),headers:{'x-api-key':key,'anthropic-version':'2023-06-01','Content-Type':'application/json'},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:600,temperature:0,system:MENTOR_SYSTEM,messages:[{role:'user',content:prompt}]})});
   if(!r.ok)throw Error('provider_failed');
   const result=await r.json();usage=result.usage||usage;
   const text=plainExplanation((result.content||[]).filter((x:any)=>x.type==='text').map((x:any)=>x.text).join(''));
   if(!validExplanation(text,result.stop_reason))throw Error('incomplete_explanation');
   await control('finish',user,{p_id:claim.id,p_payload:{ok:true,text,...usage}});
   return reply({status:'ready',id:claim.id,text});
  }catch{
   await control('finish',user,{p_id:claim.id,p_payload:{ok:false,...usage}}).catch(()=>{});
   return reply({error:'mentor_unavailable'},503);
  }
 }catch{return reply({error:'temporarily_unavailable'},503)}
});
