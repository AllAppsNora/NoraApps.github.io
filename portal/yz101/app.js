const root=document.querySelector('#app');
const recoveryRequested=new URLSearchParams(location.hash.slice(1)).get('type')==='recovery';
const client=window.supabase?.createClient('https://gjztdlihsfmozxcgdwke.supabase.co','sb_publishable_tDQAKMpHaorQAplXqg5Nqg_zwOImZeT',{auth:{storageKey:'nora-yz101-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const date=v=>v?new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'';
let serverOffset=0,countdownTimer=null;
let session=null,state=null,page='home',exam=null,lesson=null,reading=null,recovery=recoveryRequested,noticeTimer,working=false;
const goals=['Anlamak','Kullanmak','Üretmek'];
const goalSelect=v=>`<label>Hedef<select name="goal">${goals.map(x=>`<option ${v===x?'selected':''}>${x}</option>`).join('')}</select></label>`;
function notify(message){showResultDialog('Bilgilendirme',message,'Tamam');}
function showResultDialog(title,message,buttonLabel='Tamam',tone='info'){
 document.querySelector('#app-dialog')?.remove();
 const d=document.createElement('dialog');d.id='app-dialog';d.className='app-result-dialog';d.dataset.tone=tone;
 d.innerHTML='<h2>'+esc(title)+'</h2><p>'+esc(message)+'</p><button class="primary wide" type="button">'+esc(buttonLabel)+'</button>';
 document.body.append(d);d.showModal();
 const close=()=>{d.close();d.remove();};
 d.querySelector('button').addEventListener('click',close);
 d.addEventListener('cancel',e=>{e.preventDefault();close();});
}
function failure(e){let message=e?.message||'İşlem tamamlanamadı. Tekrar deneyin.';if(/invalid login credentials/i.test(message))message='E-posta veya şifre hatalı.';if(/email not confirmed/i.test(message))message='Önce e-postanızdaki doğrulama bağlantısını açın.';if(/already registered|user_already_exists/i.test(message))message='Bu e-posta kayıtlı. Şifreni hatırlamıyorsan "Şifremi unuttum" de.';if(/unique|duplicate key/i.test(message))message='Bu kullanıcı adı kullanılıyor. Başka bir ad seçin.';if(/fetch|network/i.test(message))message='Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.';notify(message);}
async function detachPush(){try{if(!('serviceWorker' in navigator))return;const r=await navigator.serviceWorker.getRegistration();const s=await r?.pushManager.getSubscription();if(s){await client.rpc('nora_push',{p_action:'remove_device',p_data:{endpoint:s.endpoint}});await s.unsubscribe();}}catch{}}
async function api(action,data={}){const modern=['state','profile','ranking','read_news'].includes(action);const {data:result,error}=await client.rpc(modern?'yz101_app':'yz101_api',{p_action:action,p_data:data});if(error)throw error;return result;}
async function loadState(){const r=await api('state');state={...r,pilot_progress:r.progress,progress:(r.progress||[]).filter(x=>x.completed).map(x=>({module_id:x.task_id})),modules:LESSONS.map((l,i)=>({id:l.id,level:l.level,module_no:i+1,title:l.title,benefit:l.objective,score:100})),lesson_unlock_at:r.access?.cooldown_until};serverOffset=Date.parse(r.access?.server_now||new Date().toISOString())-Date.now();}
async function reload(){await loadState();render();}
const lessonView=window.createYZ101LessonView({client,root,getUser:()=>session?.user,getState:()=>state,refresh:loadState,notify,onExit:()=>{page='home';render();window.scrollTo(0,0);}});
const courseGroups=['Temel','Uygulama','İleri'];
const courseLevel=()=>state.modules.find(m=>!state.progress.some(p=>p.module_id===m.id))?.level||'İleri';
const levels=['A1','A2','B1','B2','C1','C2'];
const names=['Meraklı','Kâşif','Uygulayıcı','Problem Çözücü','Üretici','Yol Gösterici'];
const levelName=l=>names[levels.indexOf(l)]||(l==='Final'?'Yol Gösterici':l);
let deferredInstall=null;
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const shareIcon='<svg class="share-ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function installBody(){
 if(isIOS())return '<ol class="install-steps"><li>Safari\'de alttaki '+shareIcon+' <b>Paylaş</b> düğmesine dokun.</li><li>Listeyi kaydırıp <b>Ana Ekrana Ekle</b>\'yi seç.</li><li><b>Ekle</b>\'ye dokun. Uygulama ana ekranında açılır; bildirimler de bundan sonra çalışır.</li></ol><p class="muted install-note">Chrome yerine Safari ile açman gerekir.</p>';
 if(deferredInstall)return '<button type="button" class="primary wide" data-action="install">Uygulamayı yükle</button>';
 return '<p class="muted">Tarayıcı menüsünden (⋮) <b>Uygulamayı yükle</b> ya da <b>Ana ekrana ekle</b>\'yi seç.</p>';
}
function installCard(dismissible){
 if(isStandalone())return '';
 try{if(dismissible&&localStorage.getItem('yz101_install_off'))return '';}catch{}
 const close=dismissible?'<button type="button" class="text install-close" data-action="install-off" aria-label="Kapat">Şimdi değil</button>':'';
 return '<section class="card install-card" id="install-card"><strong>Ana ekranına ekle</strong><p class="muted">Tek dokunuşla aç, günlük ders bildirimini al.</p>'+installBody()+close+'</section>';
}
function installPopupBody(){return '<h2>Uygulamayı ana ekranına ekle</h2><p class="muted">Tek dokunuşla aç. Bildirimler de böyle çalışır.</p>'+installBody()+'<button type="button" class="text" data-pop="off">Şimdi değil</button>';}
function maybeInstallPopup(){
 if(isStandalone()||document.getElementById('install-pop'))return;
 try{const t=Number(localStorage.getItem('yz101_install_off')||0);if(t&&Date.now()-t<3*864e5)return;if(sessionStorage.getItem('yz101_install_seen'))return;sessionStorage.setItem('yz101_install_seen','1');}catch{}
 setTimeout(()=>{
  if(page!=='home'||document.getElementById('install-pop')||isStandalone())return;
  const d=document.createElement('dialog');d.id='install-pop';d.className='install-pop';d.innerHTML='<div class="install-pop-body">'+installPopupBody()+'</div>';
  d.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
   if(b.dataset.pop==='off'){try{localStorage.setItem('yz101_install_off',String(Date.now()));}catch{}d.close();d.remove();}
   else if(b.dataset.action==='install'&&deferredInstall){deferredInstall.prompt();try{await deferredInstall.userChoice;}catch{}deferredInstall=null;d.close();d.remove();}
  });
  document.body.append(d);d.showModal();
 },1500);
}
let setupStep='install';
function renderSetup(){
 updateChrome();
 if(setupStep==='install'&&isStandalone())setupStep='notify';
 if(setupStep==='install'){root.innerHTML='<section class="card auth setup" id="install-card"><span class="eyebrow">Kurulum · 1/2</span><h1>Uygulamayı ana ekranına ekle</h1><p class="muted">Uygulama gibi açılır. Bildirimler de böyle çalışır.</p>'+installBody()+'<button class="primary wide actions" data-action="setup-next">Devam et</button><button class="text" data-action="setup-next">Şimdi değil</button></section>';}
 else{const iosWeb=isIOS()&&!isStandalone();root.innerHTML='<section class="card auth setup"><span class="eyebrow">Kurulum · 2/2</span><h1>Dersin hazır olunca haber verelim</h1><p class="muted">Günde bir hatırlatma. İstediğin zaman kapatabilirsin.</p>'+(iosWeb?'<p class="muted install-note">iPhone\'da bildirimler için önce uygulamayı ana ekrana ekle, sonra Hesap sayfasından aç.</p>':'<a class="button primary wide" href="bildirimler.html?start=1">Bildirimleri aç</a>')+'<button class="'+(iosWeb?'primary wide actions':'text')+'" data-action="setup-done">'+(iosWeb?'Derslere başla':'Şimdi değil')+'</button></section>';}
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;const pb=document.querySelector('#install-pop .install-pop-body');if(pb)pb.innerHTML=installPopupBody();const c=document.getElementById('install-card');if(c){const t=document.createElement('div');t.innerHTML=installCard(!!c.querySelector('.install-close'));c.replaceWith(t.firstChild);}});
window.addEventListener('appinstalled',()=>{deferredInstall=null;document.getElementById('install-card')?.remove();});
const mascots={robot:{name:'Robot',color:'#E2C18A'},fox:{name:'Tilki',color:'#f3b579'},owl:{name:'Baykuş',color:'#b3a1db'},cat:{name:'Kedi',color:'#e4b5cf'},panda:{name:'Panda',color:'#b4d7c5'}};
function avatarId(){const id=session?.user?.user_metadata?.yz101_mascot;return mascots[id]?id:'robot';}
function mascot(id){const m=mascots[id]||mascots.robot;if(id==='robot'||!mascots[id])return '<svg viewBox="0 0 512 512" role="img" aria-label="Sarı yüz" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" rx="112" fill="#FFC83D"/><circle cx="190" cy="215" r="44" fill="#fff"/><circle cx="322" cy="215" r="44" fill="#fff"/><circle cx="204" cy="222" r="19" fill="#2B2118"/><circle cx="336" cy="222" r="19" fill="#2B2118"/><path d="M170 322Q256 398 342 322" fill="none" stroke="#2B2118" stroke-width="30" stroke-linecap="round"/><path d="M128 150Q190 112 236 142" fill="none" stroke="#2B2118" stroke-width="18" stroke-linecap="round"/></svg>';let ears=id==='robot'?'<path d="M32 17V9"/><circle cx="32" cy="8" r="3" fill="#fff"/>':id==='panda'?'<circle cx="17" cy="20" r="8" fill="#5E4A32"/><circle cx="47" cy="20" r="8" fill="#5E4A32"/>':'<path d="M14 28L12 11L29 22M50 28L52 11L35 22" fill="'+m.color+'"/>';
return `<svg viewBox="0 0 64 64" role="img" aria-label="${m.name}" xmlns="http://www.w3.org/2000/svg"><g stroke="#4F3E2A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ears}<rect x="12" y="19" width="40" height="35" rx="${id==='robot'?10:18}" fill="${m.color}"/>${id==='owl'?'<circle cx="24" cy="34" r="10" fill="#fff"/><circle cx="40" cy="34" r="10" fill="#fff"/>':''}${id==='panda'?'<ellipse cx="24" cy="34" rx="7" ry="9" fill="#5E4A32"/><ellipse cx="40" cy="34" rx="7" ry="9" fill="#5E4A32"/>':''}<circle cx="24" cy="34" r="3" fill="${id==='panda'?'#fff':'#4F3E2A'}" stroke="none"/><circle cx="40" cy="34" r="3" fill="${id==='panda'?'#fff':'#4F3E2A'}" stroke="none"/><path d="M26 44Q32 49 38 44" fill="none"/>${id==='fox'||id==='cat'?'<path d="M29 39L32 41L35 39"/>':''}</g></svg>`;}

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
 if(!session||recovery||lessonView.busy())return;lessonView.keepDraft();
 const route=event.state?.yz101?event.state:{page:'home'};
 page=route.page||'home';selectedLevel=route.selectedLevel||null;lesson=route.lesson||null;reading=route.reading||null;exam=route.exam||null;
 restoringHistory=true;render();restoringHistory=false;window.scrollTo(0,0);
});
function updateChrome(){
 document.body.dataset.page=page;
 const profile=document.querySelector('#header-profile');
 if(profile){profile.hidden=!session||!state?.profile;profile.innerHTML=mascot(avatarId());}
}
document.querySelector('#header-profile')?.addEventListener('click',()=>{if(!state?.profile||lessonView.busy())return;lessonView.keepDraft();page='profile';render();window.scrollTo(0,0);});
const back=()=>'';
function tabs(){return page==='home'?'':back(page==='lessons'?'journey':page==='ranking'?'profile':'home');}
function progressBar(done,total){return `<progress max="${total||1}" value="${done}" aria-label="${done} / ${total} ders tamamlandı"></progress>`;}
function journeySummary(u,progress,current){const done=state.progress.length;return `<button class="journey-summary" data-page="journey" aria-label="Öğrenme yolculuğunu aç"><span class="compact-progress"><strong>${esc(levelName(displayLevel(u)))}</strong><span>${done}/15 ders</span><span class="points">${esc(state.points)} puan</span></span><span class="journey-link">Yolculuğunu gör</span>${progressBar(done,15)}</button>`;}
function journey(u,progress,current){const active=courseGroups.indexOf(courseLevel()),done=state.progress.length===15;return `<h1>Yolculuğum</h1><p class="muted">Hedefin: ${esc(u.goal)}</p><div class="journey-path">${courseGroups.map((level,i)=>{const modules=state.modules.filter(m=>m.level===level),count=modules.filter(m=>progress.has(m.id)).length;return `<button class="milestone ${count===modules.length?'done':i===active?'current':i===active+1?'upcoming':''}" data-level="${level}" ${i===active?'aria-current="step"':''}><span class="step-dot">${count===modules.length?'✓':i+1}</span><span class="step-body"><strong>${level}</strong>${i===active&&!done?'<span class="pill">Buradasın</span>':''}<small>${count} / ${modules.length} ders</small>${progressBar(count,modules.length)}<span class="chevron">›</span></span></button>`;}).join('')}</div><aside class="journey-tip">${done?'15 derslik programı tamamladın. Tamamladığın dersleri gözden geçirebilirsin.':u.is_premium?'Sıradaki dersle öğrenmeye devam et.':'Bir dersi tamamladığında yeni ders 24 saat sonra açılır.'}</aside>`;}
function auth(mode='welcome',message=''){
 page=mode;updateChrome();if(mode==='welcome'){root.innerHTML=`<section class="auth welcome"><span class="welcome-mark">${mascot('robot')}</span><h1>Günde bir ders,<br>60 günde yapay zeka.</h1><p class="muted">Sıfırdan başla.<br>Her gün küçük bir adım ilerle.</p><button class="primary wide" data-action="sample">Başla</button><button class="secondary wide actions" data-action="login">Hesabım var</button></section>`;return;}const reset=mode==='forgot',signup=mode==='signup';
 root.innerHTML=`<section class="card auth"><h1>${reset?'Şifreni yenile':signup?'Ücretsiz hesap aç':'Tekrar hoş geldin'}</h1>${signup?'<p class="muted auth-caption">E-posta ve şifrenle devam et.</p>':''}${message?`<div class="notice-inline">${esc(message)}</div>`:''}<form id="auth-form"><label>E-posta<input name="email" type="email" required autocomplete="email"></label>${reset?'':`<label>Şifre<input name="password" type="password" required minlength="6" autocomplete="${signup?'new-password':'current-password'}"></label>`}<button class="primary wide">${reset?'Bağlantı gönder':signup?'Hesap oluştur':'Giriş yap'}</button></form><div class="actions row">${reset?'<button class="text" data-action="login">Girişe dön</button>':`<button class="text" data-action="${signup?'login':'signup'}">${signup?'Zaten hesabım var':'Hesap oluştur'}</button><button class="text" data-action="forgot">Şifremi unuttum</button>`}</div><p class="legal-links"><a href="gizlilik-politikasi.html">Gizlilik Politikası</a> · <a href="kullanim-kosullari.html">Kullanım Koşulları</a></p></section>`;
}
function resetScreen(){root.innerHTML=`<section class="card auth"><h1>Şifreni yenile</h1><form id="reset-form"><label>Şifre<input name="password" type="password" minlength="6" required autocomplete="new-password" placeholder="En az 6 karakter"></label><label>Tekrar<input name="repeat" type="password" minlength="6" required autocomplete="new-password"></label><button class="primary wide">Kaydet</button></form></section>`;}
function onboarding(){page='onboarding';updateChrome();let known='';try{known=localStorage.getItem('yz101_guest_level')||'';}catch{}
 root.innerHTML=`<section class="card auth"><h1>${known?'Hesabın hazır':'Yolculuğunu seç'}</h1>${known?'<p class="muted">Seviyen kayıtlı. Şimdi bir kullanıcı adı ve hedef seç.</p>':''}<form id="enroll-form"><label>Kullanıcı adı<input name="username" required minlength="2" maxlength="40" autocomplete="nickname"></label><fieldset class="goal-choices"><legend>Yapay zeka ile ne yapmak istiyorsun?</legend>${goals.map((g,i)=>`<label class="goal-choice"><input type="radio" name="goal" value="${g}" ${i===0?'checked':''}><span><strong>${g}</strong><small>${['Temelleri keşfet · 2 seviye','Günlük hayatında uygula · 4 seviye','Kendi çözümlerini geliştir · 6 seviye'][i]}</small></span></label>`).join('')}</fieldset>${known?'<button class="primary wide" name="start" value="begin">Başla</button>':'<p class="muted">Kısa testle seviyeni belirleyebilir ya da ilk dersten başlayabilirsin.</p><button class="primary wide" name="start" value="test">Seviyemi belirle</button><button class="secondary wide actions" name="start" value="begin">İlk dersten başla</button>'}</form><button class="text" data-action="logout">Çıkış yap</button></section>`;}
function render(){
 clearInterval(countdownTimer);updateChrome();
 if(recovery){resetScreen();return;}if(!session){auth();return;}if(!state){root.innerHTML='<section class="card"><p>Bilgilerin yükleniyor…</p></section>';return;}if(!state.profile){if(page==='exam'&&exam?.kind==='placement'){renderExam();return;}onboarding();return;}
 syncNavigation();
 if(page==='setup'){renderSetup();return;}
 if(page==='placement-result'){renderPlacementResult();return;}
 if(page==='exam'){renderExam();return;}if(page==='module'){renderModule();return;}if(page==='article'){renderArticle();return;}
 const u=state.profile,progress=new Set(state.progress.map(x=>x.module_id)),current=state.modules.filter(x=>x.level===courseLevel()),next=state.modules.find(x=>!progress.has(x.id));
 let body='';
 if(page==='home'){
 const now=Date.now()+serverOffset,lessonLocked=Date.parse(state.lesson_unlock_at||'')>now,newsLocked=Date.parse(state.news_unlock_at||'')>now,n=state.news[0];
 const clock=(id,until)=>`<span class="countdown" id="${id}" data-until="${esc(until)}">--:--:--</span>`;
 const goalDone=state.progress.length===15;
 const examReady=false;
 const lessonDone=goalDone||lessonLocked,newsDone=newsLocked||n?.read;
 const lessonAction=examReady?'data-action="level-test"':goalDone?'data-page="journey"':next?`data-module="${esc(next.id)}"`:'data-page="lessons"';
 body=`${journeySummary(u,progress,current)}<div class="grid daily-grid"><button type="button" class="card daily-card ${examReady?'exam-card':'lesson-card'} ${examReady?'':lessonDone?'completed':''}" ${lessonAction}><span class="daily-label">${examReady?'Seviye yükseltme sınavı':'Günün dersi'} <span aria-hidden="true">${examReady?'↗':lessonDone?'✓':'↗'}</span></span><strong class="daily-title">${examReady?'Yeni seviyeye hazır mısın?':goalDone?'Hedefine ulaştın!':lessonDone?(state.access?.reason==='retry'?'Deneme hakkın doldu':'Dersini tamamladın!'):next?esc(next.title):'Tüm dersler tamamlandı!'}</strong>${examReady?'<span class="muted">Bu seviyenin tüm derslerini bitirdin. Kısa sınavı geçerek bir sonraki seviyenin derslerini açabilirsin.</span>':goalDone?'<span class="muted">Yolculuğunu görüntüle veya yeni bir hedef seç.</span>':lessonLocked?`<span class="muted">${state.access?.reason==='retry'?'Tekrar denemek için kalan süre':'Sonraki dersine kalan süre'}</span>${clock('lesson-countdown',state.lesson_unlock_at)}`:`<span class="muted">${next?esc(next.benefit):'Tebrikler!'}</span>`}</button><button type="button" class="card daily-card news-card ${newsDone?'completed':''}" data-page="news"><span class="daily-label">Günün haberi <span aria-hidden="true">${newsDone?'✓':'↗'}</span></span><strong class="daily-title">${newsDone?'Haberini tamamladın!':n?esc(n.title):'Yeni haber hazırlanıyor.'}</strong>${newsLocked?`<span class="muted">Sonraki haberine kalan süre</span>${clock('news-countdown',state.news_unlock_at)}`:`<span class="muted">${newsDone?'Yeni haber yarın burada.':n?'Oku, 10 puan kazan.':'Güncel haber yakında burada.'}</span>`}</button></div>`;
 }else if(page==='journey'){
 body=journey(u,progress,current);
 }else if(page==='lessons'){
 const locked=courseGroups.indexOf(selectedLevel||courseLevel())>courseGroups.indexOf(courseLevel());
 body=`<h1>${esc(selectedLevel||courseLevel())}</h1>${locked?`<section class="card locked-level"><span class="pill">Henüz açılmadı</span><h2>Buraya birlikte ilerleyeceğiz.</h2><p class="muted">Bu seviyenin dersleri, önceki dersleri tamamladığında açılacak.</p><button class="primary" data-page="home">Günün dersine dön</button></section>`:'<p class="muted">Dersler</p>'}`+state.modules.filter(m=>m.level===(selectedLevel||courseLevel())).map(m=>`<button class="lesson" data-module="${esc(m.id)}"><span class="num">${progress.has(m.id)?'✓':esc(m.module_no)}</span><span>${esc(m.title)}<small>${esc(levelName(m.level))} · ${esc(m.score)} puan</small></span></button>`).join('');
 }else if(page==='news'){
 const n=state.news[0],left=Date.parse(state.news_unlock_at||0)-(Date.now()+serverOffset);
 if(left>0){body='<section class="card auth news-waiting"><span class="pill">✓ +10 puan</span><h1>Bugünlük tamam!</h1><p class="muted">Sonraki okuma hakkına kalan süre</p><strong id="news-countdown" style="font-size:36px;font-variant-numeric:tabular-nums"></strong></section>';}
 else if(n&&!n.read){body=`<h1>Günün haberi</h1><article class="card news-article"><p class="news-source"><a href="${esc(safeUrl(n.source_url)||'#')}" target="_blank" rel="noopener noreferrer" ${n.source_url?'':'hidden'}>${esc(n.source_name||'Haber kaynağı')} ↗</a><span class="muted"> · ${esc(n.source_published_at?new Date(n.source_published_at).toLocaleDateString('tr-TR'):n.publish_date)}</span></p><h2>${esc(n.title)}</h2><div class="content news-full-text">${esc(n.full_text||n.summary)}</div><button class="primary wide actions news-read-button" data-action="read-today">Okudum · 10 puan</button></article>`;}
 else{body='<section class="card auth news-completed"><h1>'+ (n?.read?'Bugünlük tamam!':'Yeni haber hazırlanıyor.')+'</h1><p class="muted">'+(n?.read?'Bugünün haberini okudun. Yeni haber yarın burada.':'Güncel bir yapay zeka haberi yayımlandığında burada göreceksin.')+'</p><button class="secondary" data-action="refresh-news">Yenile</button></section>';}
 }else if(page==='ranking'){
 body='<h1>Sıralama</h1><div class="ranking-periods" role="group" aria-label="Sıralama dönemi"><button data-ranking="all" aria-pressed="true">Tüm zamanlar</button><button data-ranking="week" aria-pressed="false">Bu hafta</button><button data-ranking="month" aria-pressed="false">Bu ay</button></div><section class="card actions" id="ranking-content">Yükleniyor…</section>';
 }else if(page==='legal'){
 body='<h1>Hukuki metinler</h1><p class="muted">Web sürümü · 13 Kasım 2026</p><section class="settings"><a class="settings-link" href="gizlilik-politikasi.html">Gizlilik Politikası <span>›</span></a><a class="settings-link" href="kullanim-kosullari.html">Kullanım Koşulları <span>›</span></a></section>';
 }else if(page==='account'){
 body=`<h1>Hesap ve destek</h1>${installCard(false)}<section class="settings"><button data-action="forgot">Şifremi yenile <span>›</span></button><a class="settings-link" href="mailto:all.apps.nora@gmail.com">Yardım ve iletişim <span>↗</span></a><button data-page="legal">Hukuki metinler <span>›</span></button><button data-action="logout">Çıkış yap <span>↗</span></button><details class="delete-profile"><summary>YZ101 profilimi sil</summary><p>Ders ve puan kayıtların silinir. Aynı e-postayla yeniden başlayabilirsin.</p><form id="delete-form"><label>Silmek için YZ101 yaz<input name="confirm" required pattern="YZ101" autocomplete="off"></label><button class="danger">YZ101 profilimi kalıcı sil</button></form></details></section>`;
 }else if(page==='profile'){
 body=`<h1>Profilim</h1><section class="profile-head"><button type="button" class="avatar large" data-action="choose-mascot" aria-label="Maskot seç" aria-expanded="false" aria-controls="mascot-options">${mascot(avatarId())}</button><div class="profile-identity"><button class="editable-name" data-action="edit-name" aria-label="Kullanıcı adını düzenle" aria-expanded="false" aria-controls="name-editor">${esc(u.username)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z"/></svg></button><div class="identity-meta"><span class="pill">${esc(levelName(displayLevel(u)))}</span><span class="points">${esc(state.points)} puan</span></div></div></section><form id="profile-form" class="inline-editor" hidden><label>Kullanıcı adı<input id="name-editor" name="username" value="${esc(u.username)}" required minlength="2" maxlength="40" autocomplete="nickname"></label><input type="hidden" name="goal" value="${esc(u.goal)}"><div class="row"><button class="primary">Kaydet</button><button type="button" class="secondary" data-action="cancel-name">Vazgeç</button></div></form><div class="mascot-picker" id="mascot-options" hidden><div class="mascot-options">${Object.entries(mascots).map(([id,m])=>`<button type="button" data-mascot="${id}" aria-label="${m.name}" aria-pressed="${avatarId()===id}">${mascot(id)}<small>${m.name}</small></button>`).join('')}</div></div><section class="settings"><details class="goal-picker"><summary><span>Öğrenme hedefi</span><strong>${esc(u.goal||'Anlamak')}</strong></summary><div class="goal-options" role="group" aria-label="Öğrenme hedefin">${goals.map(g=>`<button type="button" data-goal="${g}" aria-pressed="${u.goal===g}">${g}${u.goal===g?' ✓':''}</button>`).join('')}</div></details><a class="settings-link" href="bildirimler.html">Bildirimler <span>›</span></a><button data-page="ranking">Sıralama <span>›</span></button><button data-page="account">Hesap ve destek <span>›</span></button><div class="membership"><strong>${u.is_premium?'Premium üyelik':'Standart üyelik'}</strong><small>${u.is_premium?'Mevcut üyeliğin korunuyor.':'Her 24 saatte bir ders'}</small></div></section>`;
 }
 root.innerHTML=tabs()+body;if(page==='home')maybeInstallPopup();
 const clocks=[['lesson-countdown',state.lesson_unlock_at],['news-countdown',state.news_unlock_at]].filter(([id])=>document.querySelector('#'+id));
 if(clocks.length){let expired=false;const tick=()=>{for(const [id,until] of clocks){const el=document.querySelector('#'+id);if(!el)continue;const sec=Math.max(0,Math.ceil((Date.parse(until)-Date.now()-serverOffset)/1000));el.textContent=[Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(x=>String(x).padStart(2,'0')).join(':');if(sec===0&&!expired){expired=true;clearInterval(countdownTimer);reload().catch(failure);}}};countdownTimer=setInterval(tick,1000);tick();}
 if(page==='ranking')loadRanking('all').catch(failure);
}
let rankingRequest=0;
async function loadRanking(period){const request=++rankingRequest;document.querySelectorAll('[data-ranking]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ranking===period)));const rows=await api('ranking',{period});if(request!==rankingRequest||page!=='ranking')return;const node=document.querySelector('#ranking-content');if(!node)return;node.innerHTML=rows.map((r,i)=>`<div class="rank ${r.is_me?'me':''}"><span><b class="rank-number">${i+1}</b> ${esc(r.username)} ${r.is_me?'(Sen)':''}</span><strong>${esc(r.points)} puan</strong></div>`).join('')||'<p>Henüz kayıt bulunmuyor.</p>';}
function options(text){try{const a=JSON.parse(text);if(Array.isArray(a))return a.map(String);}catch{}return String(text||'').split('|').map(x=>x.trim()).filter(Boolean);}
function question(id,title,opts){return `<fieldset class="question"><legend>${esc(title)}</legend>${options(opts).map(x=>`<label class="option"><input type="radio" name="${esc(id)}" value="${esc(x)}" required><span>${esc(x)}</span></label>`).join('')}</fieldset>`;}
function lessonResult(passed,message){
 showResultDialog(passed?'🎉 Tebrikler!':'Bir kez daha dene',message,passed?'Devam et':'Tekrar dene',passed?'success':'error');
 const dialog=document.querySelector('#app-dialog');
 dialog?.querySelector('button')?.addEventListener('click',()=>{
  if(!passed){const form=document.querySelector('#module-form');form?.reset();form?.querySelector('input')?.focus();}
  else window.scrollTo(0,0);
 },{once:true});
}
function renderModule(){if(!lessonView.open(lesson.index)){page='home';render();}}
function renderPlacementResult(){
 const u=state.profile,complete=reachedGoal(u);
 root.innerHTML=`<section class="card auth placement-result"><div class="setup-steps"><span>✓ Hesap</span><span>✓ Hedef</span><b>✓ Seviye</b></div><span class="welcome-mark">${mascot(avatarId())}</span><p class="eyebrow">Başlangıç seviyen</p><h1>${esc(levelName(u.level))}</h1><p class="muted">Test yanıtlarına göre başlangıç seviyeni belirledik.</p><p><span class="muted">Hedefin</span> <strong>${esc(u.goal)}</strong></p>${complete?'<p>Seviyen, seçtiğin hedefi karşılıyor. Yolculuğunu inceleyebilir veya profilinden hedefini genişletebilirsin.</p>':'<p>Derslerin bu seviyeden başlayacak. Her gün küçük bir adımla ilerleyebilirsin.</p>'}<button class="primary wide" data-page="${complete?'journey':'home'}">${complete?'Yolculuğumu gör':'Yolculuğa başla'}</button></section>`;
}
function renderExam(){root.innerHTML=back()+`<section class="card ${exam.kind==='placement'?'placement-exam':'level-exam'}">${exam.kind==='placement'?'<div class="setup-steps"><span>✓ Hesap</span><span>✓ Hedef</span><b>3 · Seviye</b></div>':''}<h1>${exam.kind==='placement'?'Seviyeni keşfet':'Seviye testi'}</h1><p class="muted">${exam.questions.length} soru · Kendi hızında yanıtla.</p>${exam.min_correct?`<p>Geçmek için ${exam.min_correct} doğru yanıt gerekiyor.</p>`:''}<form id="exam-form">${exam.questions.map((q,i)=>question(q.id,`${i+1}. ${q.question}`,q.options)).join('')}<button class="primary actions">Sonucu gör</button></form></section>`;}
function renderArticle(){root.innerHTML=`<article class="card"><p><a href="${esc(safeUrl(reading.source_url)||'#')}" target="_blank" rel="noopener noreferrer" ${reading.source_url?'':'hidden'}>${esc(reading.source_name||'Haber kaynağı')} ↗</a> <span class="muted">· ${esc(reading.source_published_at?new Date(reading.source_published_at).toLocaleDateString('tr-TR'):reading.publish_date)}</span></p><h1>${esc(reading.title)}</h1><div class="content">${esc(reading.summary)}</div><button class="primary wide actions" data-action="read-news" ${reading.read?'disabled':''}>${reading.read?'Okundu':'Okudum · 10 puan'}</button></article>`;}
async function execute(task,element){if(working||lessonView.busy())return;working=true;const buttons=element?.querySelectorAll?.('button')||[];buttons.forEach(b=>b.disabled=true);try{await task();}catch(e){failure(e);}finally{working=false;buttons.forEach(b=>b.disabled=false);}}
root.addEventListener('click',event=>{const b=event.target.closest('button');if(b?.closest('[data-lesson-view]'))return;if(!b||b.type==='submit'&&b.closest('form'))return;
 execute(async()=>{
  if(b.dataset.goal){if(!goals.includes(b.dataset.goal))return;await api('profile',{username:state.profile.username,goal:b.dataset.goal});await reload();notify('Öğrenme hedefin güncellendi.');return;}
  if(b.dataset.mascot){if(!mascots[b.dataset.mascot])return;const {data,error}=await client.auth.updateUser({data:{yz101_mascot:b.dataset.mascot}});if(error)throw error;session={...session,user:data.user};render();notify('Maskotun kaydedildi.');return;}
  if(b.dataset.level){if(!courseGroups.includes(b.dataset.level))return;selectedLevel=b.dataset.level;page='lessons';render();window.scrollTo(0,0);return;}
  if(b.dataset.page){lessonView.keepDraft();page=b.dataset.page;render();window.scrollTo({top:0,left:0,behavior:'instant'});return;}
  if(b.dataset.module){const index=LESSONS.findIndex(l=>l.id===b.dataset.module);if(index<0)return;lesson={id:b.dataset.module,index};selectedLevel=LESSONS[index].level;page='module';render();window.scrollTo(0,0);return;}
  if(b.dataset.news){reading=state.news.find(n=>n.id===b.dataset.news);page='article';render();window.scrollTo(0,0);return;}
  if(b.dataset.ranking){await loadRanking(b.dataset.ranking);return;}
  const a=b.dataset.action;
  if(a==='edit-name'||a==='cancel-name'){const form=document.querySelector('#profile-form');form.hidden=a==='cancel-name'||!form.hidden;document.querySelector('[data-action="edit-name"]').setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden){const input=document.querySelector('#name-editor');input.focus();input.select();}return;}
  if(a==='choose-mascot'){const panel=document.querySelector('#mascot-options');panel.hidden=!panel.hidden;b.setAttribute('aria-expanded',String(!panel.hidden));return;}
  if(a==='refresh-news'){await reload();return;}
  if(a==='read-today'){const n=state.news[0];if(!n)return;await api('read_news',{id:n.id});page='news';await reload();window.scrollTo({top:0,left:0,behavior:'instant'});return;}
  if(a==='install'){if(deferredInstall){deferredInstall.prompt();try{await deferredInstall.userChoice;}catch{}deferredInstall=null;document.getElementById('install-card')?.remove();}return;}
  if(a==='setup-next'){setupStep='notify';renderSetup();window.scrollTo(0,0);return;}
  if(a==='setup-done'){page='home';await reload();window.scrollTo(0,0);return;}
  if(a==='install-off'){try{localStorage.setItem('yz101_install_off','1');}catch{}document.getElementById('install-card')?.remove();return;}
  if(a==='sample'){page='sample';updateChrome();window.mountYZ101Start(root,{onBack:()=>auth('welcome'),onSignup:()=>auth('signup'),onLogin:()=>auth('login')});window.scrollTo(0,0);return;}
  if(['login','signup','forgot'].includes(a)){auth(a);return;}
  if(a==='logout'){await detachPush();await client.auth.signOut({scope:'local'});session=null;state=null;recovery=false;auth();}
  if(a==='level-test'){exam={...await api('start_level'),kind:'level'};page='exam';render();window.scrollTo(0,0);}
  if(a==='read-news'){const r=await api('read_news',{id:reading.id});page='news';await reload();notify(r.points?`Okundu. ${r.points} puan kazandın.`:'Bu haber daha önce okunmuş.');}
 },b.parentElement);
});
root.addEventListener('submit',event=>{if(event.target.closest('[data-lesson-view]'))return;event.preventDefault();const form=event.target,values=Object.fromEntries(new FormData(form)),submitter=event.submitter;
 execute(async()=>{
  if(form.id==='auth-form'){
   const mode=page;
   if(mode==='forgot'){
    const {error}=await client.auth.resetPasswordForEmail(values.email,{redirectTo:new URL('./',location.href).href});if(error)throw error;
    root.innerHTML='<section class="card auth"><div class="eyebrow">E-posta kutunu kontrol et</div><h1>Bağlantı istendi.</h1><p>Bu adres kayıtlıysa şifre yenileme bağlantısı gönderildi. Gelen kutunu ve spam klasörünü kontrol et.</p><button class="primary" data-action="login">Girişe dön</button></section>';return;
   }
   const credentials={email:values.email.trim(),password:values.password};
   let response;
   if(mode==='signup'){
    response=await client.auth.signInWithPassword(credentials);
    if(response.error){
     if(!['invalid_credentials','email_not_confirmed'].includes(response.error.code))throw response.error;
     response=await client.auth.signUp({...credentials,options:{data:{origin_app:'yz101'},emailRedirectTo:new URL('./',location.href).href}});
    }
   }else response=await client.auth.signInWithPassword(credentials);
   if(response.error)throw response.error;
   if(!response.data.session){root.innerHTML='<section class="card auth"><h1>Neredeyse hazır</h1><p>E-postandaki bağlantıyı aç, sonra giriş yap. Gelmediyse spam klasörüne bak.</p><button class="primary wide" data-action="login">Giriş yap</button><button class="text actions" data-action="forgot">Şifremi unuttum</button></section>';return;}
   session=response.data.session;page='home';await reload();
  }else if(form.id==='reset-form'){
   if(values.password!==values.repeat)throw Error('Şifreler eşleşmiyor.');
   const {error}=await client.auth.updateUser({password:values.password});if(error)throw error;
   await detachPush();await client.auth.signOut({scope:'local'});session=null;state=null;recovery=false;history.replaceState(null,'',location.pathname);auth('login','Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.');
  }else if(form.id==='enroll-form'){
   if(submitter?.value==='test'){exam={...await api('start_placement'),kind:'placement',profile:values};page='exam';updateChrome();renderExam();window.scrollTo(0,0);}
   else{await api('enroll',values);await loadState();page='setup';setupStep='install';render();window.scrollTo(0,0);}
  }else if(form.id==='exam-form'){
   if(exam.kind==='placement'){await api('enroll',{...exam.profile,exam_id:exam.exam_id,answers:values});page='placement-result';await reload();window.scrollTo(0,0);}
   else{const r=await api('submit_level',{exam_id:exam.exam_id,answers:values});page='home';await reload();showResultDialog(r.passed?'Tebrikler!':'Henüz geçemedin',`${r.correct}/${r.total} doğru. ${r.passed?(reachedGoal(state.profile)?'Hedefine ulaştın!':`Yeni seviyen: ${levelName(r.level)}`):'Sınavı yeniden deneyebilirsin.'}`,r.passed?'Devam et':'Tamam');}
  }else if(form.id==='module-form'){
   const r=await api('complete_module',{id:lesson.id,...values});if(!r.passed){lessonResult(false,'Yanıtların henüz doğru değil. Beklemeden tekrar deneyebilirsin.');return;}
   page='home';await reload();lessonResult(true,r.already_completed?'Bu dersi daha önce tamamlamıştın.':`Dersi tamamladın ve ${r.points} puan kazandın!`);
  }else if(form.id==='profile-form'){await api('profile',values);await reload();notify('Profilin kaydedildi.');}
  else if(form.id==='delete-form'){await api('delete_profile',values);await detachPush();await client.auth.signOut({scope:'local'});session=null;state=null;auth('signup','Profilin silindi. Yeniden başlamak için e-posta ve şifreni yaz.');}
 },form);
});
async function init(){
 if(!client)throw Error('Uygulama bağlantısı yüklenemedi. Sayfayı yenileyin.');
 client.auth.onAuthStateChange((event,s)=>{session=s;if(event==='PASSWORD_RECOVERY'){recovery=true;resetScreen();}else if(event==='SIGNED_OUT'){lessonView.reset();state=null;if(!working&&!recovery)auth();}});
 const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session;
 const hashError=new URLSearchParams(location.hash.slice(1)).get('error_description');if(hashError){auth('forgot','Bağlantının süresi dolmuş olabilir. Yeni bağlantı isteyin.');history.replaceState(null,'',location.pathname);return;}
 if(recovery&&session){resetScreen();history.replaceState(null,'',location.pathname);return;}
 if(recovery&&!session){recovery=false;auth('forgot','Bağlantı geçersiz veya süresi dolmuş. Yeni bağlantı isteyin.');return;}
 if(session){await reload();}else auth();
}
init().catch(e=>{root.innerHTML='<section class="card auth"><h1>Bağlantı kurulamadı.</h1><p>Sayfayı yenileyerek tekrar deneyebilirsin.</p><a class="button" href="./">Yenile</a></section>';failure(e);});


try{const clr=()=>{if(document.visibilityState==='visible'&&navigator.clearAppBadge)navigator.clearAppBadge().catch(()=>{});};document.addEventListener('visibilitychange',clr);clr();}catch{}
