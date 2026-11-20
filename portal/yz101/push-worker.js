self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>e.waitUntil(self.registration.showNotification('Yapay Zekâ 101',{body:'Günün dersi veya haberi seni bekliyor.',icon:new URL('app-icon.svg',self.registration.scope).href,tag:'yz101-daily',data:{url:self.registration.scope}})));
self.addEventListener('notificationclick',e=>{e.notification.close();const target=self.registration.scope;e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async pages=>{for(const p of pages){if(p.url.startsWith(target)&&'focus' in p){await p.navigate(target);return p.focus();}}return self.clients.openWindow(target);}));});
