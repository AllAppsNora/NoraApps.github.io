const cfg=window.PUSH_CONFIG;
const client=window.supabase.createClient(cfg.url,cfg.key,{auth:{storage:cfg.sessionStorage?window.sessionStorage:window.localStorage,storageKey:cfg.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $=s=>document.querySelector(s),message=t=>{$('#message').textContent=t;};
let reg,sub,status,refreshing=false;
function notificationState(permission,registered,enabled){if(permission==='denied')return {label:'Tarayıcı engelliyor',button:'İzni açtım, devam et',active:false};if(permission!=='granted')return {label:'İzin bekliyor',button:'Bildirimleri aç',active:false};if(!registered)return {label:'Kapalı',button:'Kurulumu tamamla',active:false};if(!enabled)return {label:'Kapalı',button:'Hatırlatmaları aç',active:false};return {label:'Açık',button:'Bildirimleri aç',active:true};}
const android=/Android/i.test(navigator.userAgent);
const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);
const steps=android?[
'Chrome’da sağ üstteki ⋮ menüsünden Ayarlar’ı aç.',
'Site ayarları → Bildirimler bölümünde noraapps.web.app’i seç ve izin ver.',
'Bu sayfaya dönüp aşağıdaki düğmeye dokun.'
]:ios?[
'Telefonunda Ayarlar → Bildirimler bölümünü aç.',
'Ana ekrana eklediğin Yapay Zekâ 101 uygulamasını seç ve Bildirimlere İzin Ver’i aç.',
'Uygulamaya dönüp aşağıdaki düğmeye dokun.'
]:[
'Adres çubuğunun yanındaki site bilgisi / izin simgesini aç.',
'Bu sitenin Bildirimler iznini İzin ver olarak değiştir.',
'Bu sayfaya dönüp aşağıdaki düğmeye bas.'
];
for(const text of steps){const li=document.createElement('li');li.textContent=text;$('#help-steps').append(li);}
$('#permission-help details').hidden=!android;
const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const rpc=async(action,data={})=>{const r=await client.rpc('nora_push',{p_action:action,p_data:data});if(r.error)throw r.error;return r.data;};
const b64bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
async function refresh(){if(refreshing)return;refreshing=true;try{sub=await reg.pushManager.getSubscription();status=await rpc('status',{endpoint:sub?.endpoint});const view=notificationState(Notification.permission,!!sub&&status.device_registered,status.enabled);$('#time').value=status.time;$('#save').hidden=true;$('#status').textContent=view.label;$('#status').dataset.active=String(view.active);$('#permission-help').hidden=Notification.permission!=='denied';if(Notification.permission!=='denied')message('');$('#enable').textContent=view.button;$('#enable').hidden=Notification.permission!=='denied';$('#toggle').setAttribute('aria-checked',String(view.active));}finally{refreshing=false;}}
async function busy(fn){document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){if($('#status'))$('#status').textContent='İşlem tamamlanamadı';message(e?.name==='NotAllowedError'?'Tarayıcı bildirime izin vermedi. Bu sitenin bildirim iznini kontrol et.':e?.name==='AbortError'?'Cihaz bildirim servisine bağlanamadı. İnternet bağlantını kontrol edip Kurulumu tamamla düğmesine tekrar bas.':e.message||'İşlem tamamlanamadı. Yeniden dene.');}finally{document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function enableNotifications(){if(Notification.permission==='denied'){busy(async()=>{await refresh();message('İzin henüz değişmedi. Yukarıdaki adımları tamamlayıp tekrar dene.');});return;}const permission=Notification.permission==='granted'?Promise.resolve('granted'):Notification.requestPermission();busy(async()=>{$('#status').textContent='Açılıyor…';message('');if(await permission!=='granted'){await refresh();if(Notification.permission!=='denied')message('İzin penceresinde İzin ver seçeneğini seç.');return;}if(!status.public_key)throw Error('Bildirim sistemi hazırlanıyor. Birkaç dakika sonra tekrar dene.');sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64bytes(status.public_key)});await rpc('register',{endpoint:sub.endpoint});await rpc('preferences',{time:$('#time').value,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});await refresh();message('Bildirimler açıldı.');});};
function disableNotifications(){return busy(async()=>{await rpc('preferences',{enabled:false,timezone:status.timezone});if(sub){await rpc('remove_device',{endpoint:sub.endpoint});await sub.unsubscribe();}await refresh();message('Hatırlatmalar kapatıldı.');});}
$('#enable').onclick=enableNotifications;
$('#toggle').onclick=()=>{if($('#toggle').getAttribute('aria-checked')==='true')disableNotifications();else enableNotifications();};
$('#time').oninput=()=>{$('#save').hidden=$('#time').value===status?.time;};
$('#save').onclick=()=>busy(async()=>{if(!$('#time').checkValidity())throw Error('10.00–21.55 arasında bir saat seç.');await rpc('preferences',{time:$('#time').value,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});await refresh();message('Hatırlatma saati kaydedildi.');});
(async()=>{if(!supported){message('Bu tarayıcı bildirimleri desteklemiyor. iPhone’da Safari ile ana ekrana ekleyip uygulama simgesinden aç. Android’de Chrome kullanabilirsin.');return;}const {data}=await client.auth.getSession();if(!data.session){message('Önce uygulamaya giriş yap.');return;}reg=await navigator.serviceWorker.register(cfg.worker,{scope:cfg.scope});await navigator.serviceWorker.ready;await refresh();$('#controls').hidden=false;})().catch(e=>message(e.message||'Bildirim ayarları yüklenemedi.'));

window.addEventListener('focus',()=>{if(reg&&!document.querySelector('button:disabled'))refresh().catch(e=>message(e.message));});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&reg&&!document.querySelector('button:disabled'))refresh().catch(e=>message(e.message));});
