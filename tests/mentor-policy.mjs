import test from 'node:test';import assert from 'node:assert/strict';
import {parseMentorInput,validExplanation} from '../supabase/functions/yz101-mentor/policy.mjs';
test('enforces message, answer and task boundaries',()=>{
 const good={action:'explain',task_id:'P01',answer:'a'.repeat(40),message:'b'.repeat(500)};
 assert.equal(parseMentorInput(good).message.length,500);
 for(const bad of [{...good,message:'b'.repeat(501)},{...good,answer:'a'.repeat(1601)},{...good,task_id:'P99'},{...good,message:{}},{...good,answer:''}])assert.throws(()=>parseMentorInput(bad));
});
test('rejects truncated, oversized or markup model responses',()=>{
 assert.equal(validExplanation('Duygu analizi uygun. Hangi hatayı kontrol edersin?','end_turn'),true);
 for(const [text,stop] of [['Yarım kalan açıklama','end_turn'],['Tam cümle.','max_tokens'],['a'.repeat(601)+'.','end_turn'],['<b>Yanıt.</b>','end_turn']])assert.equal(validExplanation(text,stop),false);
});
