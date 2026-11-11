// Change the cache name with each app release. An installed update waits until
// all old app windows close, so a running notebook exam never mixes versions.
const CACHE='vocab-notebook-shell-2026-11-11-pwa1';
const ROOT=new URL('./',self.location.href);
const FILES=['./','index.html','style.css','app.js','core.js','speech.js','pwa.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png'];
const URLS=new Set(FILES.map(file=>new URL(file,ROOT).href));
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(file=>new Request(new URL(file,ROOT),{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('vocab-notebook-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);url.search='';url.hash='';
 if(url.origin!==ROOT.origin||!URLS.has(url.href))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(url.href);
  if(cached)return cached;
  return fetch(event.request);
 }));
});
