const CACHE='easysa-studio-v6';
self.addEventListener('install',event=>{event.waitUntil((async()=>{const files=await (await fetch('./precache.json',{cache:'no-store'})).json();const cache=await caches.open(CACHE);await cache.addAll(['./',...files]);await self.skipWaiting();})());});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('easysa-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);if(req.mode==='navigate'){try{const res=await fetch(req);if(res.ok)await cache.put(req,res.clone());return res;}catch{return await cache.match(req,{ignoreVary:true})||await cache.match('./',{ignoreVary:true});}}const cached=await cache.match(req,{ignoreVary:true});if(cached)return cached;const response=await fetch(req);if(response.ok)await cache.put(req,response.clone());return response;})());
});
