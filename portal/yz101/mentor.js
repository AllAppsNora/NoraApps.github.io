// All authorization and provider calls run on the server. No credentials here.
window.createYZ101Mentor=function({client,getUser}){
 let dialog,owner,context,requestVersion=0,busy=false,result=null,audioUrl=null;
 const element=id=>dialog.querySelector('#'+id);
 const messages={premium_required:'AI Mentoru premium üyeler içindir.',evaluation_required:'Önce yanıtını Kontrol et düğmesiyle değerlendir.',processing:'Açıklaman hazırlanıyor. Biraz sonra tekrar dene.',slow_down:'Birkaç saniye bekleyip tekrar dene.',not_found:'Bu açıklama artık kullanılamıyor.'};
 function stopAudio(){if(!dialog)return;const audio=element('mentor-audio');audio.pause();audio.removeAttribute('src');audio.hidden=true;if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=null;}
 function close(){requestVersion++;busy=false;if(dialog){stopAudio();dialog.remove();dialog=null;}result=null;}
 function setBusy(value){busy=value;if(!dialog)return;dialog.querySelectorAll('button[data-request]').forEach(b=>b.disabled=value);element('mentor-question').disabled=value;}
 function current(version){return dialog?.open&&version===requestVersion&&getUser()?.id===owner;}
 async function explain(){
  if(busy)return;if(!context.answer.trim()&&!element('mentor-question').value.trim()){element('mentor-status').textContent='Sorunu yaz.';element('mentor-question').focus();return;}const version=++requestVersion;setBusy(true);stopAudio();result=null;element('mentor-listen').hidden=true;
  element('mentor-status').textContent='İnceleniyor…';element('mentor-explanation').textContent='';
  try{
   const {data,error}=await client.functions.invoke('yz101-mentor',{body:{action:'explain',...context,message:element('mentor-question').value.trim()}});
   if(!current(version))return;if(error){const detail=await error.context?.json?.().catch(()=>null);if(error.context?.status===401){element('mentor-status').textContent='Oturumun sona erdi. Yeniden giriş yap.';return;}if(detail?.error==='invalid_input'){element('mentor-status').textContent='Sorunu kontrol edip tekrar gönder.';return;}throw error;}
   if(data.status!=='ready'){element('mentor-status').textContent=messages[data.status]||'Şu anda açıklama hazırlanamadı. Tekrar deneyebilirsin.';return;}
   result=data;element('mentor-question').value='';element('mentor-counter').textContent='0/500';element('mentor-explanation').textContent=data.text;element('mentor-listen').hidden=false;element('mentor-status').textContent='';
  }catch{if(current(version))element('mentor-status').textContent='Yanıt alınamadı. Tekrar dene.';}
  finally{if(current(version))setBusy(false);}
 }
 async function listen(){
  if(busy||!result)return;const version=++requestVersion;setBusy(true);element('mentor-status').textContent='Ses hazırlanıyor…';
  try{
   const {data,error}=await client.functions.invoke('yz101-mentor',{body:{action:'voice',id:result.id}});
   if(!current(version))return;if(error)throw error;
   if(data.status!=='ready'){element('mentor-status').textContent=messages[data.status]||'Ses şu anda hazırlanamadı.';return;}
   stopAudio();const bytes=Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0));audioUrl=URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}));
   const audio=element('mentor-audio');audio.src=audioUrl;audio.hidden=false;element('mentor-listen').hidden=true;element('mentor-status').textContent='';
   await audio.play().catch(()=>{if(current(version))element('mentor-status').textContent='Dinlemek için oynat düğmesine dokun.';});
  }catch{if(current(version))element('mentor-status').textContent='Ses hazırlanamadı. Yazılı açıklamayı okuyabilir veya tekrar deneyebilirsin.';}
  finally{if(current(version))setBusy(false);}
 }
 return {close,open(data){
  close();owner=getUser()?.id;context=data;if(!owner)return;
  dialog=document.createElement('dialog');dialog.className='app-result-dialog mentor-dialog';dialog.setAttribute('aria-labelledby','mentor-title');
  dialog.innerHTML='<div class="mentor-heading"><h2 id="mentor-title">AI Mentoru <small>PREMIUM</small></h2><button type="button" id="mentor-close" aria-label="Kapat">×</button></div><p id="mentor-explanation" aria-live="polite"></p><button type="button" id="mentor-listen" data-request hidden>Dinle</button><audio id="mentor-audio" controls preload="none" hidden></audio><form id="mentor-form"><label for="mentor-question">Sorun</label><textarea id="mentor-question" maxlength="500" rows="3" placeholder="Bu derste neye takıldın?"></textarea><span class="mentor-counter" id="mentor-counter">0/500</span><button type="submit" data-request>Gönder</button></form><p id="mentor-status" role="status"></p>';
  document.body.append(dialog);element('mentor-close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});element('mentor-form').onsubmit=e=>{e.preventDefault();explain();};element('mentor-listen').onclick=listen;element('mentor-question').oninput=()=>{element('mentor-counter').textContent=element('mentor-question').value.length+'/500';};dialog.showModal();
  if(data.answer.trim().length>=40)explain();else element('mentor-question').focus();
 }};
};
