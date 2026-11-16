import assert from 'node:assert/strict';
let handler,reservation={status:'reserved',id:'fixture',rubric:{criteria:'Synthetic task'}},providerCalls=0,finished;
const full='Doğru adımları ayırmışsın. '+ 'Kontrol noktasını açıkça belirtmelisin. '.repeat(9);
globalThis.Deno={env:{get:()=> 'test-only'},serve:fn=>{handler=fn}};
globalThis.fetch=async(url,options)=>{
 if(url.endsWith('/auth/v1/user'))return Response.json({id:'test-user'});
 if(url.endsWith('/yz101_ai_evaluation_control')){const body=JSON.parse(options.body);if(body.p_action==='finish'){finished=body.p_payload;return Response.json({updated:true})}return Response.json(reservation)}
 if(url==='https://api.anthropic.com/v1/messages'){providerCalls++;assert.equal(JSON.parse(options.body).max_tokens,400);return Response.json({usage:{input_tokens:100,output_tokens:100},content:[{type:'text',text:JSON.stringify({passed:false,feedback:full})}]})}
 throw Error('Unexpected endpoint');
};
await import('../supabase/functions/yz101-grade-answer/index.ts');
const req=()=>new Request('https://example.com',{method:'POST',headers:{Authorization:'Bearer fixture-token'},body:JSON.stringify({task_id:'P10',answer:'An entirely synthetic educational response for the test.'})});
let result=await (await handler(req())).json();assert.equal(result.feedback.feedback,full.trim());assert.equal(finished.feedback.feedback,full.trim());assert.ok(result.feedback.feedback.length>300);
reservation={status:'completed',feedback:{passed:false,feedback:('İnsan onayını belirt. '+ 'a'.repeat(300)).slice(0,300)}};
result=await (await handler(req())).json();assert.equal(result.feedback.feedback,'İnsan onayını belirt.');assert.equal(providerCalls,1);
console.log('PASS: long feedback preserved; old clipped cache ends at a complete sentence; cache adds zero provider calls.');
