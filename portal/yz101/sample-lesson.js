// Hesap açmadan denenen kısa örnek ders (P01). Sunucuya hiçbir şey yazmaz, puan/ilerleme vermez.
window.mountYZ101Sample=function(root,opts){
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const l=opts.lesson,q=l.questions[0],correct=1,
  why='Serbest biçimli mesajların sınıflandırılması belirsiz dil girdilerini yorumlamayı gerektirir; sabit kurallar buna yetmez.';
 let step=0,picked=null;
 function view(){
  let body='';
  if(step===0){
   body=`<span class="eyebrow">Örnek ders · 1 dakika</span><h1>${esc(l.title)}</h1><p class="muted">${esc(l.objective)}</p>
   <p>${esc(l.concept)}</p><div class="example"><h3>Gerçek örnek</h3><p style="margin:0">${esc(l.example)}</p></div>
   <button class="primary wide" data-sample="next">Bir soru çöz</button><button class="secondary wide actions" data-sample="back">Geri</button>`;
  }else if(step===1){
   body=`<span class="eyebrow">Örnek ders · soru</span><h1>${esc(q.prompt)}</h1>
   <fieldset class="question" style="border:0;padding:0;margin:0"><legend class="muted">Bir seçenek işaretle</legend>${q.options.map((o,i)=>`<label class="option"><input type="radio" name="sq" value="${i}" ${picked===i?'checked':''}><span>${esc(o)}</span></label>`).join('')}</fieldset>
   <button class="primary wide" data-sample="check" ${picked===null?'disabled':''}>Cevabı kontrol et</button>`;
  }else{
   const ok=picked===correct;
   body=`<span class="eyebrow">Örnek ders</span><h1>${ok?'Doğru cevap!':'Neredeyse'}</h1>
   <div class="feedback ${ok?'':'error'}"><strong>${ok?'Başarılı':'Doğru cevap: '+esc(q.options[correct])}</strong><p>${esc(why)}</p></div>
   <p>Bu, günlük derslerin küçük bir parçası. Her ders bir görev ve sorulardan oluşur; görevini yapay zekâ değerlendirir.</p>
   <button class="primary wide" data-sample="signup">Hesap oluştur, derslere başla</button>
   <button class="secondary wide actions" data-sample="login">Hesabım var · Giriş yap</button>`;
  }
  root.innerHTML=`<section class="card auth" data-sample-view>${body}</section>`;
  const box=root.querySelector('[data-sample-view]');
  box.addEventListener('change',e=>{if(e.target.name==='sq'){picked=Number(e.target.value);const b=box.querySelector('[data-sample="check"]');if(b)b.disabled=false;}});
  box.addEventListener('click',e=>{
   const b=e.target.closest('button[data-sample]');if(!b)return;
   e.stopPropagation();
   const a=b.dataset.sample;
   if(a==='next'){step=1;view();window.scrollTo(0,0);}
   else if(a==='check'&&picked!==null){step=2;view();window.scrollTo(0,0);}
   else if(a==='back')opts.onBack();
   else if(a==='signup')opts.onSignup();
   else if(a==='login')opts.onLogin();
  });
 }
 view();
};
