// Só o shell público. Auth, API, MCP, originais e respostas privadas nunca são armazenados aqui.
const SHELL='araread-shell-v1';
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(['/','/icon.svg','/manifest.webmanifest']))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('araread-shell-')&&k!==SHELL).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api')||url.pathname.startsWith('/auth')||url.pathname.startsWith('/mcp')||url.pathname.startsWith('/.well-known'))return;
 const shell=url.pathname==='/'||url.pathname==='/icon.svg'||url.pathname==='/manifest.webmanifest'||/^\/assets\/[A-Za-z0-9_.-]+\.(js|css|woff2?)$/.test(url.pathname);
 if(!shell)return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(SHELL).then(c=>c.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));
});
