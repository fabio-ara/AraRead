// Public shell only. Private material lives in per-account IndexedDB, never CacheStorage.
const ROOT=new URL('.',self.location.href).pathname,SHELL='araread-shell-v5-reader:'+ROOT;
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const response=await fetch(ROOT+'offline-assets.json',{cache:'reload'});if(!response.ok)throw Error('Manifesto do aplicativo indisponível.');
 const assets=await response.json();if(!Array.isArray(assets)||assets.some(name=>typeof name!=='string'||!/^assets\/[A-Za-z0-9_.-]+\.(js|css|woff2?)$/.test(name)))throw Error('Manifesto do aplicativo inválido.');
 const cache=await caches.open(SHELL);await cache.addAll([ROOT,ROOT+'icon.svg',ROOT+'assets/brand/ara-mark.svg',ROOT+'manifest.webmanifest',...assets.map(name=>ROOT+name)]);await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('araread-shell-')&&!k.includes(':'))||(k.endsWith(':'+ROOT)&&k!==SHELL)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==location.origin||url.search)return;
 const path=url.pathname.slice(ROOT.length),shell=url.pathname===ROOT||url.pathname.startsWith(ROOT)&&(['icon.svg','assets/brand/ara-mark.svg','manifest.webmanifest'].includes(path)||/^assets\/[A-Za-z0-9_.-]+\.(js|css|woff2?)$/.test(path));
 if(!shell)return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(SHELL).then(c=>c.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));
});
