// Hesapsız giriş akışı: seviye → (mentor değerlendirmesi) → yol → tanışma dersi → üyelik.
// Sunucuya hiçbir şey yazmaz. Sonuç yalnızca bu cihazda tutulur.
window.mountYZ101Start=function(root,opts){
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const quiz=[
  {q:'Sohbet botuna "Bunu özetle" yazdın, cevap yetersiz kaldı. Ne yaparsın?',o:['Aynı cümleyi tekrar yazarım.','Ne istediğimi, kimin için olduğunu ve uzunluğu yazarım.','Botu kapatırım.'],c:1},
  {q:'Yapay zekanın cevabında bir tarih yanlış çıktı. Neden olabilir?',o:['İnternet yavaştı.','Model bazen doğru görünen ama yanlış bilgi üretir.','Telefonum eski.'],c:1},
  {q:'Her pazartesi aynı raporu e-postayla göndermek istiyorsun. Hangisi daha iyi?',o:['Her hafta elle yazarım.','Sabit adımları otomasyona bağlarım, metni yapay zekaya yazdırırım.','Yapay zeka kendi kendine anlar.'],c:1},
  {q:'Bir yazılımın yapay zeka servisine istek göndermesini hangisi sağlar?',o:['API','Ekran koruyucu','Klasör'],c:0}
 ];
 const lessons={
  basic:{title:'AI mı, otomasyon mu?',concept:'Sabit bir koşul ve eylem içeren iş her zaman yapay zeka gerektirmez. Yapay zeka; örüntü bulma, belirsiz metni yorumlama ve tahmin gibi işlerde işe yarar.',example:'"Fatura 1.000 TL üzerindeyse yöneticiye e-posta gönder" sabit bir kuraldır. "Fatura açıklamasının konusunu bul" ise yapay zeka işidir.',q:'Hangisi yapay zeka kullanmayı en çok haklı çıkarır?',o:['Belirli saatte ışığı açmak','Gelen müşteri mesajlarının konusunu farklı ifadelerden bulmak','Her pazartesi aynı raporu göndermek','100 TL üstü siparişe kargo eklemek'],c:1,why:'Serbest yazılmış mesajları anlamak belirsiz bir iştir. Sabit kurallar buna yetmez.'},
  adv:{title:'İyi bir komut nasıl yazılır?',concept:'Yapay zeka, ne istediğini ne kadar net yazarsan o kadar iyi yanıt verir. İyi bir komutta üç şey bulunur: iş, okuyucu ve biçim.',example:'"Bunu özetle" yerine şunu yaz: "Bu e-postayı müşteriye gidecek üç maddelik bir özete çevir."',q:'Hangi komut daha iyi sonuç verir?',o:['Rapor yaz.','Satış ekibi için haftalık raporu 5 maddede özetle.','Güzel bir rapor yaz lütfen.'],c:1,why:'Bu komut işi, okuyucuyu ve biçimi söylüyor. Diğerleri model için fazla belirsiz.'}
 };
 const paths={
  Başlangıç:{title:'Temelden başlıyoruz',text:'İlk 10 ders Anlamak aşamasında. Her gün bir ders, küçük adımlarla.',lesson:'basic'},
  Orta:{title:'Temeli biliyorsun',text:'Yine de ilk dersten başlıyorsun. İstersen Anlamak aşamasını seviye sınavıyla geçebilirsin.',lesson:'adv'},
  İleri:{title:'İleri seviyedesin',text:'Yolculuk ilk dersten başlıyor. Anlamak aşamasını seviye sınavıyla geçip doğrudan Kullanmak aşamasına atlayabilirsin.',lesson:'adv'}
 };
 let step='level',qi=0,score=0,level=null,lessonKey='basic',lstep=0,picked=null,sel=null;
 const set=h=>{root.innerHTML=`<section class="card auth" data-start-view>${h}</section>`;bind();window.scrollTo(0,0);};
 function view(){
  if(step==='level')set(`<h1>Yapay zekayla aran nasıl?</h1><p class="muted">Sana uygun yerden başlayalım.</p><button class="primary wide" data-s="new">Yeni başlıyorum</button><button class="secondary wide actions" data-s="assess">Mentor seviyemi belirlesin</button><button class="text" data-s="back">Geri</button>`);
  else if(step==='quiz'){const x=quiz[qi];sel=null;set(`<span class="eyebrow">Soru ${qi+1}/${quiz.length}</span><h1>${esc(x.q)}</h1><div class="start-options">${x.o.map((t,i)=>`<button type="button" class="option-btn" data-s="pick" data-i="${i}">${esc(t)}</button>`).join('')}<button type="button" class="option-btn dk" data-s="pick" data-i="-1">Bilmiyorum</button></div>`);}
  else if(step==='path'){const p=paths[level];set(`<span class="eyebrow">Seviyen · ${esc(level)}</span><h1>${esc(p.title)}</h1><p>${esc(p.text)}</p><p class="muted">Sana kısa bir tanışma dersi hazırladık. Bir dakika sürer.</p><button class="primary wide" data-s="lesson">İlk dersi başlat</button>`);}
  else if(step==='lesson'){const l=lessons[lessonKey];
   if(lstep===0)set(`<span class="eyebrow">Tanışma dersi · 1 dakika</span><h1>${esc(l.title)}</h1><p>${esc(l.concept)}</p><div class="example"><h3>Gerçek örnek</h3><p style="margin:0">${esc(l.example)}</p></div><button class="primary wide" data-s="ask">Bir soru çöz</button>`);
   else if(lstep===1)set(`<span class="eyebrow">Tanışma dersi · soru</span><h1>${esc(l.q)}</h1><fieldset class="question" style="border:0;padding:0;margin:0"><legend class="muted">Bir seçenek işaretle</legend>${l.o.map((o,i)=>`<label class="option"><input type="radio" name="sq" value="${i}" ${picked===i?'checked':''}><span>${esc(o)}</span></label>`).join('')}</fieldset><button class="primary wide" data-s="check" ${picked===null?'disabled':''}>Kontrol et</button>`);
   else{const ok=picked===l.c;set(`<span class="eyebrow">Tanışma dersi</span><h1>${ok?'Doğru':'Neredeyse'}</h1><div class="feedback ${ok?'':'error'}"><strong>${ok?'Başarılı':'Doğru cevap: '+esc(l.o[l.c])}</strong><p>${esc(l.why)}</p></div><p>Günlük derslerde de aynı düzen var. Önce kısa anlatım, sonra görev ve sorular.</p><button class="primary wide" data-s="member">Devam et</button>`);}}
  else if(step==='member')set(`<h1>İlerlemeni kaybetme</h1><p>Ücretsiz hesap aç. Kaldığın yerden devam et, her gün bir ders ilerle.</p><button class="primary wide" data-s="signup">Hesap aç</button><button class="secondary wide actions" data-s="login">Hesabım var</button><p class="muted start-note">AI Mentor, hesap açtıktan sonra ücretli bir özelliktir.</p>`);
 }
 function bind(){
  const box=root.querySelector('[data-start-view]');
  box.addEventListener('change',e=>{if(e.target.name==='sq'){picked=Number(e.target.value);const b=box.querySelector('[data-s="check"]');if(b)b.disabled=false;}});
  box.addEventListener('click',e=>{
   const b=e.target.closest('button[data-s]');if(!b)return;e.stopPropagation();
   const a=b.dataset.s;
   if(a==='back')opts.onBack();
   else if(a==='new'){level='Başlangıç';lessonKey='basic';step='path';view();}
   else if(a==='assess'){qi=0;score=0;step='quiz';view();}
   else if(a==='pick'){const i=Number(b.dataset.i);if(i===quiz[qi].c)score++;if(qi<quiz.length-1){qi++;view();}else{level=score<=1?'Başlangıç':score<=3?'Orta':'İleri';lessonKey=paths[level].lesson;step='path';view();}}
   else if(a==='lesson'){step='lesson';lstep=0;picked=null;view();}
   else if(a==='ask'){lstep=1;view();}
   else if(a==='check'&&picked!==null){lstep=2;view();}
   else if(a==='member'){try{localStorage.setItem('yz101_guest_level',level);}catch{}step='member';view();}
   else if(a==='signup')opts.onSignup();
   else if(a==='login')opts.onLogin();
  });
 }
 view();
};
