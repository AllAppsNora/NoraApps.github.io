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
const levels=['A1','A2','B1','B2','C1','C2'];
const names=['Meraklı','Kâşif','Uygulayıcı','Problem Çözücü','Üretici','Yol Gösterici'];
const levelName=l=>names[levels.indexOf(l)]||(l==='Final'?'Yol Gösterici':l);
const mascots={robot:{name:'Robot',color:'#83cee9'},fox:{name:'Tilki',color:'#f3b579'},owl:{name:'Baykuş',color:'#b3a1db'},cat:{name:'Kedi',color:'#e4b5cf'},panda:{name:'Panda',color:'#b4d7c5'}};
function avatarId(){const id=session?.user?.user_metadata?.yz101_mascot;return mascots[id]?id:'robot';}
function mascot(id){const m=mascots[id]||mascots.robot;let ears=id==='robot'?'<path d="M32 17V9"/><circle cx="32" cy="8" r="3" fill="#fff"/>':id==='panda'?'<circle cx="17" cy="20" r="8" fill="#33475d"/><circle cx="47" cy="20" r="8" fill="#33475d"/>':'<path d="M14 28L12 11L29 22M50 28L52 11L35 22" fill="'+m.color+'"/>';
return `<svg viewBox="0 0 64 64" role="img" aria-label="${m.name}" xmlns="http://www.w3.org/2000/svg"><g stroke="#263d53" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ears}<rect x="12" y="19" width="40" height="35" rx="${id==='robot'?10:18}" fill="${m.color}"/>${id==='owl'?'<circle cx="24" cy="34" r="10" fill="#fff"/><circle cx="40" cy="34" r="10" fill="#fff"/>':''}${id==='panda'?'<ellipse cx="24" cy="34" rx="7" ry="9" fill="#33475d"/><ellipse cx="40" cy="34" rx="7" ry="9" fill="#33475d"/>':''}<circle cx="24" cy="34" r="3" fill="${id==='panda'?'#fff':'#263d53'}" stroke="none"/><circle cx="40" cy="34" r="3" fill="${id==='panda'?'#fff':'#263d53'}" stroke="none"/><path d="M26 44Q32 49 38 44" fill="none"/>${id==='fox'||id==='cat'?'<path d="M29 39L32 41L35 39"/>':''}</g></svg>`;}

const goalCount=u=>({Anlamak:2,Kullanmak:4,Üretmek:6}[u.goal]||6);
const reachedGoal=u=>u.level==='Final'||levels.indexOf(u.level)>=goalCount(u);
const displayLevel=u=>reachedGoal(u)?levels[goalCount(u)-1]:u.level;
let selectedLevel=null;
let restoringHistory=false;
function syncNavigation(){
 const snapshot={yz101:true,page,selectedLevel,lesson,reading,exam};
 if(!history.state?.yz101){history.replaceState({yz101:true,page:'home'},'',location.pathname+location.search);}
 if(!restoringHistory&&(history.state.page!==page||history.state.selectedLevel!==selectedLevel))history.pushState(snapshot,'',location.pathname+location.search);
}
window.addEventListener('popstate',event=>{
 if(!session||recovery)return;
 const route=event.state?.yz101?event.state:{page:'home'};
 page=route.page||'home';selectedLevel=route.selectedLevel||null;lesson=route.lesson||null;reading=route.reading||null;exam=route.exam||null;
 restoringHistory=true;render();restoringHistory=false;window.scrollTo(0,0);
});
function updateChrome(){
 document.body.dataset.page=page;
 const profile=document.querySelector('#header-profile');
 if(profile){profile.hidden=!session||!state?.profile;profile.innerHTML=mascot(avatarId());}
}
document.querySelector('#header-profile')?.addEventListener('click',()=>{if(!state?.profile)return;page='profile';render();window.scrollTo(0,0);});
const back=()=>'';
function tabs(){return page==='home'?'':back(page==='lessons'?'journey':page==='ranking'?'profile':'home');}
function progressBar(done,total){return `<progress max="${total||1}" value="${done}" aria-label="${done} / ${total} ders tamamlandı"></progress>`;}
function journeySummary(u,progress,current){const done=current.filter(m=>progress.has(m.id)).length;return `<button class="journey-summary" data-page="journey" aria-label="Öğrenme yolculuğunu aç"><span class="compact-progress"><strong>${esc(levelName(displayLevel(u)))}</strong><span>${reachedGoal(u)?'Hedef tamamlandı':`${done}/${current.length} ders`}</span><span class="points">${esc(state.points)} puan</span></span><span class="journey-link">Yolculuğunu gör</span>${progressBar(reachedGoal(u)?current.length:done,current.length)}</button>`;}
function journey(u,progress,current){const index=u.level==='Final'?6:levels.indexOf(u.level),remaining=current.filter(m=>!progress.has(m.id)).length;
 const complete=reachedGoal(u),target=index+1<goalCount(u)?names[index+1]:null;
 let tip=complete?'Hedefine ulaştın! Tamamladığın derslere dönebilir veya profilinden hedefini genişletebilirsin.':u.level==='Final'?'Tüm seviyeleri tamamladın. İstediğin derse dönüp bilgilerini tazeleyebilirsin.':remaining===0?'Seviye testin hazır. Öğrendiklerini sınama zamanı.':u.is_premium?`Bu seviyede ${remaining} dersin kaldı.`:`Günde 1 dersle yaklaşık ${remaining} gün sonra ${target?esc(target)+' testine':'hedef tamamlama testine'} hazırsın.`;
 return `<h1>Yolculuğum</h1><p class="muted">Hedefin: ${esc(u.goal)}</p><div class="journey-path">${levels.slice(0,goalCount(u)).map((l,i)=>{const modules=state.modules.filter(m=>m.level===l),done=modules.filter(m=>progress.has(m.id)).length;return `<button class="milestone ${i<index?'done':i===index?'current':i===index+1?'upcoming':''}" data-level="${l}" ${i===index?'aria-current="step"':''}><span class="step-dot">${i<index?'✓':i+1}</span><span class="step-body"><strong>${names[i]}</strong>${i===index?`<span class="pill">Buradasın</span><small>${done} / ${modules.length} ders</small>${progressBar(done,modules.length)}`:''}<span class="chevron">›</span></span></button>`;}).join('')}</div><aside class="journey-tip">${tip}${!complete?'<small>Geçiş, test sonucuna bağlıdır.</small>':''}</aside>${complete?'<button class="secondary wide actions" data-page="profile">Hedefini düzenle</button>':''}${remaining===0&&!complete?'<button class="primary wide actions" data-action="level-test">Seviye testine başla</button>':''}`;
}
function auth(mode='welcome',message=''){
 page=mode;updateChrome();if(mode==='welcome'){root.innerHTML=`<section class="auth welcome"><span class="welcome-mark">${mascot('robot')}</span><h1>Yapay zekâyı<br>adım adım keşfet.</h1><p class="muted">Hedefini seç. Seviyeni belirle.<br>Her gün bir dersle ilerle.</p><button class="primary wide" data-action="signup">Başla</button><button class="secondary wide actions" data-action="login">Hesabım var · Giriş yap</button></section>`;return;}const reset=mode==='forgot',signup=mode==='signup';
 root.innerHTML=`<section class="card auth">${signup?'<div class="setup-steps"><b>1 · Hesap</b><span>2 · Hedef</span><span>3 · Seviye</span></div>':''}<h1>${reset?'Şifreni yenile':signup?'Yolculuğuna başla':'Tekrar hoş geldin'}</h1>${signup?'<p class="muted auth-caption">Hesabını doğruladıktan sonra hedefini ve başlangıç seviyeni seçeceksin.</p>':''}${message?`<div class="notice-inline">${esc(message)}</div>`:''}<form id="auth-form"><label>E-posta<input name="email" type="email" required autocomplete="email"></label>${reset?'':`<label>Şifre<input name="password" type="password" required minlength="6" autocomplete="${signup?'new-password':'current-password'}"></label>`}<button class="primary wide">${reset?'Bağlantı gönder':signup?'Hesap oluştur':'Giriş yap'}</button></form><div class="actions row">${reset?'<button class="text" data-action="login">Girişe dön</button>':`<button class="text" data-action="${signup?'login':'signup'}">${signup?'Zaten hesabım var':'Hesap oluştur'}</button><button class="text" data-action="forgot">Şifremi unuttum</button>`}</div><p class="legal-links"><a href="gizlilik-politikasi.html">Gizlilik Politikası</a> · <a href="kullanim-kosullari.html">Kullanım Koşulları</a></p><details class="account-info"><summary aria-label="Ortak hesap hakkında bilgi">ⓘ Hesap bilgisi</summary><p>NoWord hesabın varsa aynı e-posta ve şifreyle giriş yapabilirsin. YZ101 öğrenme profilin ayrıdır.</p></details></section>`;
}
function resetScreen(){root.innerHTML=`<section class="card auth"><h1>Şifreni yenile</h1><form id="reset-form"><label>Şifre<input name="password" type="password" minlength="6" required autocomplete="new-password" placeholder="En az 6 karakter"></label><label>Tekrar<input name="repeat" type="password" minlength="6" required autocomplete="new-password"></label><p class="muted">Bu şifre NoWord girişin için de geçerli olacak.</p><button class="primary wide">Kaydet</button></form></section>`;}
function onboarding(){page='onboarding';updateChrome();root.innerHTML=`<section class="card auth"><div class="setup-steps"><span>✓ Hesap</span><b>2 · Hedef</b><span>3 · Seviye</span></div><h1>Yolculuğunu seç</h1><form id="enroll-form"><label>Kullanıcı adı<input name="username" required minlength="2" maxlength="40" autocomplete="nickname"></label><fieldset class="goal-choices"><legend>Yapay zekâyla ne yapmak istiyorsun?</legend>${goals.map((g,i)=>`<label class="goal-choice"><input type="radio" name="goal" value="${g}" ${i===0?'checked':''}><span><strong>${g}</strong><small>${['Temelleri keşfet · 2 seviye','Günlük hayatında uygula · 4 seviye','Kendi çözümlerini geliştir · 6 seviye'][i]}</small></span></label>`).join('')}</fieldset><p class="muted">Kısa testle seviyeni belirleyebilir veya ilk dersten başlayabilirsin.</p><button class="primary wide" name="start" value="test">Seviyemi belirle</button><button class="secondary wide actions" name="start" value="begin">İlk dersten başla</button></form><button class="text" data-action="logout">Çıkış yap</button></section>`;}
function render(){
 clearInterval(countdownTimer);updateChrome();
 if(recovery){resetScreen();return;}if(!session){auth();return;}if(!state){root.innerHTML='<section class="card"><p>Bilgilerin yükleniyor…</p></section>';return;}if(!state.profile){if(page==='exam'&&exam?.kind==='placement'){renderExam();return;}onboarding();return;}
 syncNavigation();
 if(page==='exam'){renderExam();return;}if(page==='module'){renderModule();return;}if(page==='article'){renderArticle();return;}
 const u=state.profile,progress=new Set(state.progress.map(x=>x.module_id)),current=state.modules.filter(x=>x.level===displayLevel(u)),next=reachedGoal(u)?null:current.find(x=>!progress.has(x.id));
 let body='';
 if(page==='home'){
 const now=Date.now()+serverOffset,lessonLocked=Date.parse(state.lesson_unlock_at||'')>now,newsLocked=Date.parse(state.news_unlock_at||'')>now,n=state.news[0];
 const clock=(id,until)=>`<span class="countdown" id="${id}" data-until="${esc(until)}">--:--:--</span>`;
 const goalDone=reachedGoal(u);
 const lessonDone=goalDone||lessonLocked||u.level==='Final'||(!next&&current.length>0),newsDone=newsLocked||n?.read;
 const lessonAction=goalDone?'data-page="journey"':lessonLocked?'data-page="lessons"':next?`data-module="${esc(next.id)}"`:u.level!=='Final'?'data-action="level-test"':'data-page="lessons"';
 body=`${journeySummary(u,progress,current)}<div class="grid daily-grid"><button type="button" class="card daily-card ${lessonDone?'completed':''}" ${lessonAction}><span class="daily-label">Günün dersi <span aria-hidden="true">${lessonDone?'✓':'↗'}</span></span><strong class="daily-title">${goalDone?'Hedefine ulaştın!':lessonDone?'Dersini tamamladın!':next?esc(next.title):u.level==='Final'?'Tüm dersler tamamlandı!':'Seviye sınavın hazır'}</strong>${goalDone?'<span class="muted">Yolculuğunu görüntüle veya yeni bir hedef seç.</span>':lessonLocked?`<span class="muted">Sonraki dersine kalan süre</span>${clock('lesson-countdown',state.lesson_unlock_at)}`:`<span class="muted">${next?esc(next.benefit):u.level==='Final'?'Tebrikler!':'Bir sonraki seviyeye geçmeye hazırsın.'}</span>`}</button><button type="button" class="card daily-card ${newsDone?'completed':''}" data-page="news"><span class="daily-label">Günün haberi <span aria-hidden="true">${newsDone?'✓':'↗'}</span></span><strong class="daily-title">${newsDone?'Haberini tamamladın!':n?esc(n.title):'Yeni haber hazırlanıyor.'}</strong>${newsLocked?`<span class="muted">Sonraki haberine kalan süre</span>${clock('news-countdown',state.news_unlock_at)}`:`<span class="muted">${newsDone?'Yeni haber yarın burada.':n?'Oku, 10 puan kazan.':'Güncel haber yakında burada.'}</span>`}</button></div>`;
 }else if(page==='journey'){
 body=journey(u,progress,current);
 }else if(page==='lessons'){
 const locked=u.level!=='Final'&&levels.indexOf(selectedLevel||displayLevel(u))>levels.indexOf(u.level);
 body=`<h1>${esc(levelName(selectedLevel||displayLevel(u)))}</h1>${locked?`<section class="card locked-level"><span class="pill">Henüz açılmadı</span><h2>Buraya birlikte ilerleyeceğiz.</h2><p class="muted">Bu seviyenin dersleri, önceki seviyeyi tamamlayıp testini geçtiğinde açılacak.</p><button class="primary" data-page="home">Günün dersine dön</button></section>`:'<p class="muted">Dersler</p>'}`+state.modules.filter(m=>m.level===(selectedLevel||displayLevel(u))).map(m=>`<button class="lesson" data-module="${esc(m.id)}"><span class="num">${progress.has(m.id)?'✓':esc(m.module_no)}</span><span>${esc(m.title)}<small>${esc(levelName(m.level))} · ${esc(m.score)} puan</small></span></button>`).join('');
 }else if(page==='news'){
 const n=state.news[0],left=Date.parse(state.news_unlock_at||0)-(Date.now()+serverOffset);
 if(left>0){body='<section class="card auth"><span class="pill">✓ +10 puan</span><h1>Bugünlük tamam!</h1><p>Yeni bir haber için yarın görüşürüz.</p><p class="muted">Sonraki okuma hakkına kalan süre</p><strong id="news-countdown" style="font-size:36px;font-variant-numeric:tabular-nums"></strong></section>';}
 else if(n&&!n.read){body=`<h1>Günün haberi</h1><article class="card"><span class="pill">${esc(n.source_name)} · ${esc(n.source_published_at?new Date(n.source_published_at).toLocaleDateString('tr-TR'):n.publish_date)}</span><h2>${esc(n.title)}</h2><div class="content">${esc(n.summary)}</div><p><a href="${esc(n.source_url)}" target="_blank" rel="noopener noreferrer">Kaynağında oku ↗</a></p><button class="primary" data-action="read-today">Okudum · 10 puan</button></article>`;}
 else{body='<section class="card auth"><h1>'+ (n?.read?'Bugünlük tamam!':'Yeni haber hazırlanıyor.')+'</h1><p class="muted">'+(n?.read?'Bugünün haberini okudun. Yeni haber yarın burada.':'Güncel bir yapay zeka haberi yayımlandığında burada göreceksin.')+'</p><button class="secondary" data-action="refresh-news">Yenile</button></section>';}
 }else if(page==='ranking'){
 body='<h1>Sıralama</h1><div class="ranking-periods" role="group" aria-label="Sıralama dönemi"><button data-ranking="all" aria-pressed="true">Tüm zamanlar</button><button data-ranking="week" aria-pressed="false">Bu hafta</button><button data-ranking="month" aria-pressed="false">Bu ay</button></div><section class="card actions" id="ranking-content">Yükleniyor…</section>';
 }else if(page==='legal'){
 body='<h1>Hukuki metinler</h1><p class="muted">Web sürümü · 13 Kasım 2026</p><section class="settings"><a class="settings-link" href="gizlilik-politikasi.html">Gizlilik Politikası <span>›</span></a><a class="settings-link" href="kullanim-kosullari.html">Kullanım Koşulları <span>›</span></a></section>';
 }else if(page==='account'){
 body=`<h1>Hesap ve destek</h1><section class="settings"><button data-action="forgot">Şifremi yenile <span>›</span></button><a class="settings-link" href="mailto:all.apps.nora@gmail.com">Yardım ve iletişim <span>↗</span></a><button data-page="legal">Hukuki metinler <span>›</span></button><button data-action="logout">Çıkış yap <span>↗</span></button><details class="delete-profile"><summary>YZ101 profilimi sil</summary><p>YZ101 ders ve puan kayıtların silinir. NoWord profilin varsa ortak giriş hesabın korunur; aynı şifreyle yeniden başlayabilirsin.</p><form id="delete-form"><label>Silmek için YZ101 yaz<input name="confirm" required pattern="YZ101" autocomplete="off"></label><button class="danger">YZ101 profilimi kalıcı sil</button></form></details></section>`;
 }else if(page==='profile'){
 body=`<h1>Profilim</h1><section class="profile-head"><button type="button" class="avatar large" data-action="choose-mascot" aria-label="Maskot seç" aria-expanded="false" aria-controls="mascot-options">${mascot(avatarId())}</button><div class="profile-identity"><button class="editable-name" data-action="edit-name" aria-label="Kullanıcı adını düzenle" aria-expanded="false" aria-controls="name-editor">${esc(u.username)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z"/></svg></button><div class="identity-meta"><span class="pill">${esc(levelName(displayLevel(u)))}</span><span class="points">${esc(state.points)} puan</span></div></div></section><form id="profile-form" class="inline-editor" hidden><label>Kullanıcı adı<input id="name-editor" name="username" value="${esc(u.username)}" required minlength="2" maxlength="40" autocomplete="nickname"></label><input type="hidden" name="goal" value="${esc(u.goal)}"><div class="row"><button class="primary">Kaydet</button><button type="button" class="secondary" data-action="cancel-name">Vazgeç</button></div></form><div class="mascot-picker" id="mascot-options" hidden><div class="mascot-options">${Object.entries(mascots).map(([id,m])=>`<button type="button" data-mascot="${id}" aria-label="${m.name}" aria-pressed="${avatarId()===id}">${mascot(id)}<small>${m.name}</small></button>`).join('')}</div></div><section class="settings"><details class="goal-picker"><summary><span>Öğrenme hedefi</span><strong>${esc(u.goal||'Anlamak')}</strong></summary><div class="goal-options" role="group" aria-label="Öğrenme hedefin">${goals.map(g=>`<button type="button" data-goal="${g}" aria-pressed="${u.goal===g}">${g}${u.goal===g?' ✓':''}</button>`).join('')}</div></details><button data-page="ranking">Sıralama <span>›</span></button><button data-page="account">Hesap ve destek <span>›</span></button><div class="membership"><strong>${u.is_premium?'Premium üyelik':'Standart üyelik'}</strong><small>${u.is_premium?'Mevcut üyeliğin korunuyor.':'Her 24 saatte bir ders'}</small></div></section>`;
 }
 root.innerHTML=tabs()+body;
 const clocks=[['lesson-countdown',state.lesson_unlock_at],['news-countdown',state.news_unlock_at]].filter(([id])=>document.querySelector('#'+id));
 if(clocks.length){let expired=false;const tick=()=>{for(const [id,until] of clocks){const el=document.querySelector('#'+id);if(!el)continue;const sec=Math.max(0,Math.ceil((Date.parse(until)-Date.now()-serverOffset)/1000));el.textContent=[Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(x=>String(x).padStart(2,'0')).join(':');if(sec===0&&!expired){expired=true;clearInterval(countdownTimer);reload().catch(failure);}}};countdownTimer=setInterval(tick,1000);tick();}
 if(page==='ranking')loadRanking('all').catch(failure);
}
let rankingRequest=0;
async function loadRanking(period){const request=++rankingRequest;document.querySelectorAll('[data-ranking]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ranking===period)));const rows=await api('ranking',{period});if(request!==rankingRequest||page!=='ranking')return;const node=document.querySelector('#ranking-content');if(!node)return;node.innerHTML=rows.map((r,i)=>`<div class="rank ${r.is_me?'me':''}"><span><b class="rank-number">${i+1}</b> ${esc(r.username)} ${r.is_me?'(Sen)':''}</span><strong>${esc(r.points)} puan</strong></div>`).join('')||'<p>Henüz kayıt bulunmuyor.</p>';}
function options(text){try{const a=JSON.parse(text);if(Array.isArray(a))return a.map(String);}catch{}return String(text||'').split('|').map(x=>x.trim()).filter(Boolean);}
function question(id,title,opts){return `<fieldset class="question"><legend>${esc(title)}</legend>${options(opts).map(x=>`<label class="option"><input type="radio" name="${esc(id)}" value="${esc(x)}" required><span>${esc(x)}</span></label>`).join('')}</fieldset>`;}
function renderModule(){root.innerHTML=`<article class="card"><div class="eyebrow">${esc(levelName(lesson.level))} · Ders ${esc(lesson.module_no)}</div><h1>${esc(lesson.title)}</h1><p class="muted">${esc(lesson.benefit)}</p><div class="content">${esc(lesson.content)}</div></article><section class="card"><h2>Kendini dene</h2><form id="module-form">${question('answer1',lesson.question1,lesson.options1)}${question('answer2',lesson.question2,lesson.options2)}<button class="primary actions">Yanıtları kontrol et</button></form></section>`;}
function renderExam(){root.innerHTML=back()+`<section class="card">${exam.kind==='placement'?'<div class="setup-steps"><span>✓ Hesap</span><span>✓ Hedef</span><b>3 · Seviye</b></div>':''}<h1>${exam.kind==='placement'?'Seviyeni keşfet':'Seviye testi'}</h1><p class="muted">${exam.questions.length} soru · Kendi hızında yanıtla.</p>${exam.min_correct?`<p>Geçmek için ${exam.min_correct} doğru yanıt gerekiyor.</p>`:''}<form id="exam-form">${exam.questions.map((q,i)=>question(q.id,`${i+1}. ${q.question}`,q.options)).join('')}<button class="primary actions">Sonucu gör</button></form></section>`;}
function renderArticle(){root.innerHTML=`<article class="card"><span class="pill">${esc(reading.publish_date)}</span><h1>${esc(reading.title)}</h1><div class="content">${esc(reading.summary)}</div><button class="primary actions" data-action="read-news" ${reading.read?'disabled':''}>${reading.read?'Okundu':'Okudum · 10 puan'}</button></article>`;}
async function execute(task,element){if(working)return;working=true;const buttons=element?.querySelectorAll?.('button')||[];buttons.forEach(b=>b.disabled=true);try{await task();}catch(e){failure(e);}finally{working=false;buttons.forEach(b=>b.disabled=false);}}
root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.type==='submit'&&b.closest('form'))return;
 execute(async()=>{
  if(b.dataset.goal){if(!goals.includes(b.dataset.goal))return;await api('profile',{username:state.profile.username,goal:b.dataset.goal});await reload();notify('Öğrenme hedefin güncellendi.');return;}
  if(b.dataset.mascot){if(!mascots[b.dataset.mascot])return;const {data,error}=await client.auth.updateUser({data:{yz101_mascot:b.dataset.mascot}});if(error)throw error;session={...session,user:data.user};render();notify('Maskotun kaydedildi.');return;}
  if(b.dataset.level){if(levels.indexOf(b.dataset.level)>=goalCount(state.profile))return;selectedLevel=b.dataset.level;page='lessons';render();window.scrollTo(0,0);return;}
  if(b.dataset.page){page=b.dataset.page;render();window.scrollTo({top:0,left:0,behavior:'instant'});return;}
  if(b.dataset.module){lesson=await api('module',{id:b.dataset.module});selectedLevel=lesson.level;page='module';render();window.scrollTo(0,0);return;}
  if(b.dataset.news){reading=state.news.find(n=>n.id===b.dataset.news);page='article';render();window.scrollTo(0,0);return;}
  if(b.dataset.ranking){await loadRanking(b.dataset.ranking);return;}
  const a=b.dataset.action;
  if(a==='edit-name'||a==='cancel-name'){const form=document.querySelector('#profile-form');form.hidden=a==='cancel-name'||!form.hidden;document.querySelector('[data-action="edit-name"]').setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden){const input=document.querySelector('#name-editor');input.focus();input.select();}return;}
  if(a==='choose-mascot'){const panel=document.querySelector('#mascot-options');panel.hidden=!panel.hidden;b.setAttribute('aria-expanded',String(!panel.hidden));return;}
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
   if(!response.data.session){root.innerHTML='<section class="card auth"><h1>Kaydına devam et</h1><p>İlk kez kayıt oluyorsan e-postandaki doğrulama bağlantısını aç. Gelen kutunu ve spam klasörünü kontrol et.</p><p>NoWord hesabın varsa veya yalnız YZ101 profilini sildiysen yeni doğrulama e-postası gelmez. Mevcut şifrenle giriş yaparak devam et.</p><button class="primary wide" data-action="login">Giriş yap</button><button class="text actions" data-action="forgot">Şifremi unuttum</button></section>';return;}
   session=response.data.session;page='home';await reload();if(state.profile)notify(`Merhaba ${state.profile.username}. Bugün küçük bir adım daha.`);
  }else if(form.id==='reset-form'){
   if(values.password!==values.repeat)throw Error('Şifreler eşleşmiyor.');
   const {error}=await client.auth.updateUser({password:values.password});if(error)throw error;
   await client.auth.signOut({scope:'local'});session=null;state=null;recovery=false;history.replaceState(null,'',location.pathname);auth('login','Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.');
  }else if(form.id==='enroll-form'){
   if(submitter?.value==='test'){exam={...await api('start_placement'),kind:'placement',profile:values};page='exam';updateChrome();renderExam();window.scrollTo(0,0);}
   else{await api('enroll',values);page='home';await reload();notify('YZ101 profilin hazır.');}
  }else if(form.id==='exam-form'){
   if(exam.kind==='placement'){await api('enroll',{...exam.profile,exam_id:exam.exam_id,answers:values});page='home';await reload();notify(`Başlangıç seviyen: ${levelName(state.profile.level)}`);}
   else{const r=await api('submit_level',{exam_id:exam.exam_id,answers:values});page='home';await reload();notify(`${r.correct}/${r.total} doğru. ${r.passed?(reachedGoal(state.profile)?'Hedefine ulaştın!':`Yeni seviyen: ${levelName(r.level)}`):'Tekrar deneyebilirsin.'}`);}
  }else if(form.id==='module-form'){
   const r=await api('complete_module',{id:lesson.id,...values});if(!r.passed){notify('Yanıtlarını tekrar gözden geçir.');return;}
   page='home';await reload();notify(r.already_completed?'Bu dersi daha önce tamamlamıştın.':`Ders tamamlandı. ${r.points} puan kazandın!`);window.scrollTo(0,0);
  }else if(form.id==='profile-form'){await api('profile',values);await reload();notify('Profilin kaydedildi.');}
  else if(form.id==='delete-form'){await api('delete_profile',values);await client.auth.signOut({scope:'local'});session=null;state=null;auth('login','YZ101 profilin silindi. NoWord hesabın varsa aynı e-posta ve şifreyle giriş yapıp yeniden başlayabilirsin. Yoksa yeni hesap oluştur.');}
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
