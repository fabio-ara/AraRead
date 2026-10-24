// Public shell only. Private material lives in per-account IndexedDB, never CacheStorage.
const ROOT=new URL('.',self.location.href).pathname,SHELL='araread-shell-v2:'+ROOT;
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll([ROOT,ROOT+'icon.svg',ROOT+'manifest.webmanifest'])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('araread-shell-')&&!k.includes(':'))||(k.endsWith(':'+ROOT)&&k!==SHELL)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==location.origin||url.search)return;
 const path=url.pathname.slice(ROOT.length),shell=url.pathname===ROOT||url.pathname.startsWith(ROOT)&&(['icon.svg','manifest.webmanifest'].includes(path)||/^assets\/[A-Za-z0-9_.-]+\.(js|css|woff2?)$/.test(path));
 if(!shell)return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(SHELL).then(c=>c.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));
});
