const C="mindspace-v4";
const A=["./","./index.html","./manifest.webmanifest","./icon-180.png","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const req=e.request;
  // Network-first for HTML/navigation so app updates appear immediately; fall back to cache offline.
  if(req.mode==="navigate" || (req.headers.get("accept")||"").includes("text/html")){
    e.respondWith(fetch(req).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(req,cp));return res;}).catch(()=>caches.match(req).then(r=>r||caches.match("./index.html"))));
    return;
  }
  // Cache-first for static assets (icons, manifest, etc).
  e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(req,cp));return res;})));
});
