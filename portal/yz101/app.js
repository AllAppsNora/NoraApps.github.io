const root=document.querySelector('#app');
const recoveryRequested=new URLSearchParams(location.hash.slice(1)).get('type')==='recovery';
const client=window.supabase?.createClient('https://gjztdlihsfmozxcgdwke.supabase.co','sb_publishable_tDQAKMpHaorQAplXqg5Nqg_zwOImZeT',{auth:{storageKey:'nora-yz101-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'';
let serverOffset=0,countdownTimer=null;
let session=null,state=null,page='home',exam=null,lesson=null,reading=null,recovery=recoveryRequested,noticeTimer,working=false;
const goals=['Anlamak','Kullanmak','Üretmek'];
const goalSelect=v=>`<label>Hedef<select name="goal">${goals.map(x=>`<option ${v===x?'selected':''}>${x}</option>`).join('')}</select></label>`;
function notify(message){const el=document.querySelector('#notice');el.textContent=message;el.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{el.hidden=true},8000);}
function failure(e){let message=e?.message||'İşlem tamamlanamadı. Tekrar deneyin.';if(/invalid login credentials/i.test(message))message='E-posta veya şifre hatalı.';if(/email not confirmed/i.test(message))message='Önce e-postanızdaki doğrulama bağlantısını açın.';if(/unique|duplicate key/i.test(message))message='Bu kullanıcı adı kullanılıyor. Başka bir ad seçin.';if(/fetch|network/i.test(message))message='Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.';notify(message);}
async function api(action,data={}){const {data:result,error}=await client.rpc('yz101_api',{p_action:action,p_data:data});if(error)throw error;return result;}
async function reload(){state=await api('state');serverOffset=Date.parse(state.server_now||new Date().toISOString())-Date.now();render();}
function tabs(){return `<nav aria-label="Uygulama menüsü">${[['home','Bugün'],['lessons','Dersler'],['news','Haberler'],['ranking','Sıralama'],['profile','Profil']].map(([id,label])=>`<button data-page="${id}" ${page===id?'aria-current="page"':''}>${label}</button>`).join('')}</nav>`;}
function auth(mode='login',message=''){
 page=mode;const reset=mode==='forgot',signup=mode==='signup';
 root.innerHTML=`<section class="card auth"><div class="eyebrow">Yapay zekayı adım adım keşfet</div><h1>${reset?'Şifreni yenile':signup?'Aramıza katıl':'Hoş geldin.'}</h1>${message?`<div class="notice-inline">${esc(message)}</div>`:''}<form id="auth-form"><label>E-posta<input name="email" type="email" required autocomplete="email"></label>${reset?'':`<label>Şifre<input name="password" type="password" required minlength="6" autocomplete="${signup?'new-password':'current-password'}"></label>`}<button class="primary wide">${reset?'Bağlantı gönder':signup?'Hesap oluştur':'Giriş yap'}</button></form><div class="actions row">${reset?'<button class="text" data-action="login">Girişe dön</button>':`<button class="text" data-action="${signup?'login':'signup'}">${signup?'Zaten hesabım var':'Hesap oluştur'}</button><button class="text" data-action="forgot">Şifremi unuttum</button>`}</div><p class="muted">NoWord hesabın varsa aynı e-posta ve şifreyle giriş yapabilirsin. YZ101 profilini ayrıca oluşturacağız.</p></section>`;
}
function resetScreen(){root.innerHTML=`<section class="card auth"><h1>Şifreni yenile</h1><form id="reset-form"><label>Şifre<input name="password" type="password" minlength="6" required autocomplete="new-password" placeholder="En az 6 karakter"></label><label>Tekrar<input name="repeat" type="password" minlength="6" required autocomplete="new-password"></label><p class="muted">Bu şifre NoWord girişin için de geçerli olacak.</p><button class="primary wide">Kaydet</button></form></section>`;}
function onboarding(){root.innerHTML=`<section class="card auth"><div class="eyebrow">Sana özel bir başlangıç</div><h1>YZ101 profilin</h1><form id="enroll-form"><label>Kullanıcı adı<input name="username" required minlength="2" maxlength="40" autocomplete="nickname"></label>${goalSelect('Anlamak')}<p class="muted">İlk seviyeden başlayabilir veya 5 soruyla seviyeni belirleyebilirsin.</p><button class="primary wide" name="start" value="begin">İlk seviyeden başla</button><button class="secondary wide actions" name="start" value="test">Seviyemi belirle</button></form><button class="text" data-action="logout">Çıkış yap</button></section>`;}
function render(){
 clearInterval(countdownTimer);
 if(recovery){resetScreen();return;}if(!session){auth();return;}if(!state){root.innerHTML='<section class="card"><p>Bilgilerin yükleniyor…</p></section>';return;}if(!state.profile){onboarding();return;}
 if(page==='exam'){renderExam();return;}if(page==='module'){renderModule();return;}if(page==='article'){renderArticle();return;}
 const u=state.profile,progress=new Set(state.progress.map(x=>x.module_id)),current=state.modules.filter(x=>x.level===u.level),next=current.find(x=>!progress.has(x.id));
 let body='';
 if(page==='home'){
 const now=Date.now()+serverOffset,lessonLocked=Date.parse(state.lesson_unlock_at||'')>now,newsLocked=Date.parse(state.news_unlock_at||'')>now,n=state.news[0];
 const clock=(id,until)=>`<span class="countdown" id="${id}" data-until="${esc(until)}">--:--:--</span>`;
 const lessonDone=lessonLocked||(!next&&current.length>0),newsDone=newsLocked||n?.read;
 const lessonAction=lessonLocked?'data-page="lessons"':next?`data-module="${esc(next.id)}"`:u.level!=='Final'?'data-action="level-test"':'data-page="lessons"';
 body=`<div class="daily-heading"><h1>Bugün</h1><span>${esc(state.points)} puan · ${esc(u.level)}</span></div><div class="grid daily-grid"><button type="button" class="card daily-card ${lessonDone?'completed':''}" ${lessonAction}><span class="daily-label">Günün dersi <span aria-hidden="true">${lessonDone?'✓':'↗'}</span></span><strong class="daily-title">${lessonDone?'Dersini tamamladın!':next?esc(next.title):u.level==='Final'?'Tüm dersler tamamlandı!':'Seviye sınavın hazır'}</strong>${lessonLocked?`<span class="muted">Sonraki dersine kalan süre</span>${clock('lesson-countdown',state.lesson_unlock_at)}`:`<span class="muted">${next?esc(next.benefit):u.level==='Final'?'Tebrikler!':'Bir sonraki seviyeye geçmeye hazırsın.'}</span>`}</button><button type="button" class="card daily-card ${newsDone?'completed':''}" data-page="news"><span class="daily-label">Günün haberi <span aria-hidden="true">${newsDone?'✓':'↗'}</span></span><strong class="daily-title">${newsDone?'Haberini tamamladın!':n?esc(n.title):'Yeni haber hazırlanıyor.'}</strong>${newsLocked?`<span class="muted">Sonraki haberine kalan süre</span>${clock('news-countdown',state.news_unlock_at)}`:`<span class="muted">${newsDone?'Yeni haber yarın burada.':n?'Oku, 10 puan kazan.':'Güncel haber yakında burada.'}</span>`}</button></div>`;
 }else if(page==='lessons'){
 body='<h1>Derslerin</h1>'+state.modules.map(m=>`<button class="lesson" data-module="${esc(m.id)}"><span class="num">${progress.has(m.id)?'✓':esc(m.module_no)}</span><span>${esc(m.title)}<small>${esc(m.level)} · ${esc(m.score)} puan</small></span></button>`).join('');
 }else if(page==='news'){
 const n=state.news[0],left=Date.parse(state.news_unlock_at||0)-(Date.now()+serverOffset);
 if(left>0){body='<section class="card auth"><span class="pill">✓ +10 puan</span><h1>Bugünlük tamam!</h1><p>Yeni bir haber için yarın görüşürüz.</p><p class="muted">Sonraki okuma hakkına kalan süre</p><strong id="news-countdown" style="font-size:36px;font-variant-numeric:tabular-nums"></strong></section>';}
 else if(n&&!n.read){body=`<h1>Günün haberi</h1><article class="card"><span class="pill">${esc(n.source_name)} · ${esc(n.source_published_at?new Date(n.source_published_at).toLocaleDateString('tr-TR'):n.publish_date)}</span><h2>${esc(n.title)}</h2><div class="content">${esc(n.summary)}</div><p><a href="${esc(n.source_url)}" target="_blank" rel="noopener noreferrer">Kaynağında oku ↗</a></p><button class="primary" data-action="read-today">Okudum · 10 puan</button></article>`;}
 else{body='<section class="card auth"><h1>'+ (n?.read?'Bugünlük tamam!':'Yeni haber hazırlanıyor.')+'</h1><p class="muted">'+(n?.read?'Bugünün haberini okudun. Yeni haber yarın burada.':'Güncel bir yapay zeka haberi yayımlandığında burada göreceksin.')+'</p><button class="secondary" data-action="refresh-news">Yenile</button></section>';}
 }else if(page==='ranking'){
 body='<h1>Sıralama</h1><div class="row"><button data-ranking="all">Tüm zamanlar</button><button class="secondary" data-ranking="week">Bu hafta</button><button class="secondary" data-ranking="month">Bu ay</button></div><section class="card actions" id="ranking-content">Yükleniyor…</section>';
 }else if(page==='profile'){
 body=`<section class="card auth"><h1>Profilin</h1><p class="muted">${esc(u.email)}</p><form id="profile-form"><label>Kullanıcı adı<input name="username" value="${esc(u.username)}" required minlength="2" maxlength="40"></label>${goalSelect(u.goal)}<button class="primary wide">Kaydet</button></form><div class="notice-inline">${u.is_premium?'Premium üyeliğin korunuyor.':'Standart üyelik · Her 24 saatte bir ders.'}<br>Web sürümünde reklam izleme ve yeni premium satın alma henüz sunulmuyor.</div><button class="text" data-action="forgot">Şifremi yenile</button><button class="text" data-action="logout">Çıkış yap</button><details class="actions"><summary>YZ101 profilimi sil</summary><p>YZ101 ders ve puan kayıtların silinir. NoWord profilin varsa korunur.</p><form id="delete-form"><label>Silmek için YZ101 yaz<input name="confirm" required pattern="YZ101" autocomplete="off"></label><button class="danger">YZ101 profilimi kalıcı sil</button></form></details></section>`;
 }
 root.innerHTML=tabs()+body;
 const clocks=[['lesson-countdown',state.lesson_unlock_at],['news-countdown',state.news_unlock_at]].filter(([id])=>document.querySelector('#'+id));
 if(clocks.length){let expired=false;const tick=()=>{for(const [id,until] of clocks){const el=document.querySelector('#'+id);if(!el)continue;const sec=Math.max(0,Math.ceil((Date.parse(until)-Date.now()-serverOffset)/1000));el.textContent=[Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(x=>String(x).padStart(2,'0')).join(':');if(sec===0&&!expired){expired=true;clearInterval(countdownTimer);reload().catch(failure);}}};countdownTimer=setInterval(tick,1000);tick();}
 if(page==='ranking')loadRanking('all').catch(failure);
}
async function loadRanking(period){const rows=await api('ranking',{period});const node=document.querySelector('#ranking-content');if(!node)return;node.innerHTML=rows.map((r,i)=>`<div class="rank ${r.is_me?'me':''}"><span>${i+1}. ${esc(r.username)} ${r.is_me?'(Sen)':''}</span><strong>${esc(r.points)} puan</strong></div>`).join('')||'<p>Henüz kayıt bulunmuyor.</p>';}
function options(text){try{const a=JSON.parse(text);if(Array.isArray(a))return a.map(String);}catch{}return String(text||'').split('|').map(x=>x.trim()).filter(Boolean);}
function question(id,title,opts){return `<fieldset class="question"><legend>${esc(title)}</legend>${options(opts).map(x=>`<label class="option"><input type="radio" name="${esc(id)}" value="${esc(x)}" required><span>${esc(x)}</span></label>`).join('')}</fieldset>`;}
function renderModule(){root.innerHTML=`<button class="text" data-page="lessons">← Derslere dön</button><article class="card"><div class="eyebrow">${esc(lesson.level)} · Ders ${esc(lesson.module_no)}</div><h1>${esc(lesson.title)}</h1><p class="muted">${esc(lesson.benefit)}</p><div class="content">${esc(lesson.content)}</div></article><section class="card"><h2>Kendini dene</h2><form id="module-form">${question('answer1',lesson.question1,lesson.options1)}${question('answer2',lesson.question2,lesson.options2)}<button class="primary actions">Yanıtları kontrol et</button></form></section>`;}
function renderExam(){root.innerHTML=`<section class="card"><h1>${exam.kind==='placement'?'Seviyeni keşfet':'Seviye sınavı'}</h1>${exam.min_correct?`<p>Geçmek için ${exam.min_correct} doğru yanıt gerekiyor.</p>`:''}<form id="exam-form">${exam.questions.map((q,i)=>question(q.id,`${i+1}. ${q.question}`,q.options)).join('')}<button class="primary actions">Sonucu gör</button></form></section>`;}
function renderArticle(){root.innerHTML=`<button class="text" data-page="news">← Haberlere dön</button><article class="card"><span class="pill">${esc(reading.publish_date)}</span><h1>${esc(reading.title)}</h1><div class="content">${esc(reading.summary)}</div><button class="primary actions" data-action="read-news" ${reading.read?'disabled':''}>${reading.read?'Okundu':'Okudum · 10 puan'}</button></article>`;}
async function execute(task,element){if(working)return;working=true;const buttons=element?.querySelectorAll?.('button')||[];buttons.forEach(b=>b.disabled=true);try{await task();}catch(e){failure(e);}finally{working=false;buttons.forEach(b=>b.disabled=false);}}
root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.type==='submit'&&b.closest('form'))return;
 execute(async()=>{
  if(b.dataset.page){page=b.dataset.page;render();window.scrollTo({top:0,left:0,behavior:'instant'});return;}
  if(b.dataset.module){lesson=await api('module',{id:b.dataset.module});page='module';render();window.scrollTo(0,0);return;}
  if(b.dataset.news){reading=state.news.find(n=>n.id===b.dataset.news);page='article';render();window.scrollTo(0,0);return;}
  if(b.dataset.ranking){await loadRanking(b.dataset.ranking);return;}
  const a=b.dataset.action;
  if(a==='refresh-news'){await reload();return;}
  if(a==='read-today'){const n=state.news[0];if(!n)return;await api('read_news',{id:n.id});page='news';await reload();window.scrollTo({top:0,left:0,behavior:'instant'});return;}
  if(['login','signup','forgot'].includes(a)){auth(a);return;}
  if(a==='logout'){await client.auth.signOut({scope:'local'});session=null;state=null;recovery=false;auth();}
  if(a==='level-test'){exam={...await api('start_level'),kind:'level'};page='exam';render();window.scrollTo(0,0);}
  if(a==='read-news'){const r=await api('read_news',{id:reading.id});page='news';await reload();notify(r.points?`Okundu. ${r.points} puan kazandın.`:'Bu haber daha önce okunmuş.');}
 },b.parentElement);
});
root.addEventListener('submit',event=>{event.preventDefault();const form=event.target,values=Object.fromEntries(new FormData(form)),submitter=event.submitter;
 execute(async()=>{
  if(form.id==='auth-form'){
   const mode=page;
   if(mode==='forgot'){
    const {error}=await client.auth.resetPasswordForEmail(values.email,{redirectTo:new URL('./',location.href).href});if(error)throw error;
    root.innerHTML='<section class="card auth"><div class="eyebrow">E-posta kutunu kontrol et</div><h1>Bağlantı istendi.</h1><p>Bu adres kayıtlıysa şifre yenileme bağlantısı gönderildi. Gelen kutunu ve spam klasörünü kontrol et.</p><button class="primary" data-action="login">Girişe dön</button></section>';return;
   }
   const response=mode==='signup'?await client.auth.signUp({email:values.email.trim(),password:values.password,options:{data:{origin_app:'yz101'},emailRedirectTo:new URL('./',location.href).href}}):await client.auth.signInWithPassword({email:values.email.trim(),password:values.password});
   if(response.error)throw response.error;
   if(!response.data.session){root.innerHTML='<section class="card auth"><h1>E-postanı kontrol et.</h1><p>Adresin yeni bir hesaba uygunsa doğrulama bağlantısı gönderildi. Zaten NoWord veya YZ101 hesabın varsa mevcut şifrenle giriş yapabilirsin.</p><button class="primary" data-action="login">Girişe dön</button></section>';return;}
   session=response.data.session;page='home';await reload();
  }else if(form.id==='reset-form'){
   if(values.password!==values.repeat)throw Error('Şifreler eşleşmiyor.');
   const {error}=await client.auth.updateUser({password:values.password});if(error)throw error;
   await client.auth.signOut({scope:'local'});session=null;state=null;recovery=false;history.replaceState(null,'',location.pathname);auth('login','Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.');
  }else if(form.id==='enroll-form'){
   if(submitter?.value==='test'){exam={...await api('start_placement'),kind:'placement',profile:values};page='exam';renderExam();}
   else{await api('enroll',values);page='home';await reload();notify('YZ101 profilin hazır.');}
  }else if(form.id==='exam-form'){
   if(exam.kind==='placement'){await api('enroll',{...exam.profile,exam_id:exam.exam_id,answers:values});page='home';await reload();notify(`Başlangıç seviyen: ${state.profile.level}`);}
   else{const r=await api('submit_level',{exam_id:exam.exam_id,answers:values});page='home';await reload();notify(`${r.correct}/${r.total} doğru. ${r.passed?`Yeni seviyen: ${r.level}`:'Tekrar deneyebilirsin.'}`);}
  }else if(form.id==='module-form'){
   const r=await api('complete_module',{id:lesson.id,...values});if(!r.passed){notify('Yanıtlarını tekrar gözden geçir.');return;}
   page='home';await reload();notify(r.already_completed?'Bu dersi daha önce tamamlamıştın.':`Ders tamamlandı. ${r.points} puan kazandın!`);window.scrollTo(0,0);
  }else if(form.id==='profile-form'){await api('profile',values);await reload();notify('Profilin kaydedildi.');}
  else if(form.id==='delete-form'){await api('delete_profile',values);await client.auth.signOut({scope:'local'});session=null;state=null;auth('login','YZ101 profilin silindi.');}
 },form);
});
async function init(){
 if(!client)throw Error('Uygulama bağlantısı yüklenemedi. Sayfayı yenileyin.');
 client.auth.onAuthStateChange((event,s)=>{session=s;if(event==='PASSWORD_RECOVERY'){recovery=true;resetScreen();}else if(event==='SIGNED_OUT'){state=null;if(!working&&!recovery)auth();}});
 const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session;
 const hashError=new URLSearchParams(location.hash.slice(1)).get('error_description');if(hashError){auth('forgot','Bağlantının süresi dolmuş olabilir. Yeni bağlantı isteyin.');history.replaceState(null,'',location.pathname);return;}
 if(recovery&&session){resetScreen();history.replaceState(null,'',location.pathname);return;}
 if(recovery&&!session){recovery=false;auth('forgot','Bağlantı geçersiz veya süresi dolmuş. Yeni bağlantı isteyin.');return;}
 if(session)await reload();else auth();
}
init().catch(e=>{root.innerHTML='<section class="card auth"><h1>Bağlantı kurulamadı.</h1><p>Sayfayı yenileyerek tekrar deneyebilirsin.</p><a class="button" href="./">Yenile</a></section>';failure(e);});
