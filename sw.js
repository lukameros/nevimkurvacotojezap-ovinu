const CACHE_NAME='airsoft-v2';
const LOCAL_FILES=['./index.html','./airsoft-vision.html','./ai-kamera-lite.html','./manifest.json'];
const CDN_FILES=[
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js',
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.min.js',
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(c=>c.addAll(LOCAL_FILES)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const url=e.request.url;
  if(e.request.method!=='GET')return;
  if(url.includes('api.anthropic.com'))return;
  if(url.startsWith('blob:')||url.startsWith('data:'))return;

  const isCDN=url.includes('cdn.jsdelivr.net')||url.includes('unpkg.com')||url.includes('cdnjs.cloudflare.com');

  if(isCDN){
    e.respondWith(caches.open(CACHE_NAME).then(async c=>{
      const hit=await c.match(e.request);
      if(hit)return hit;
      try{
        const r=await fetch(e.request);
        if(r.ok||r.type==='opaque')c.put(e.request,r.clone());
        return r;
      }catch{return new Response('',{status:503});}
    }));
    return;
  }

  e.respondWith(
    fetch(e.request).then(r=>{
      if(r.ok){const cl=r.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,cl));}
      return r;
    }).catch(()=>caches.match(e.request))
  );
});

// Ruční prefetch CDN při prvním načtení
self.addEventListener('message',async e=>{
  if(e.data?.type!=='PREFETCH')return;
  const cache=await caches.open(CACHE_NAME);
  const urls=[...CDN_FILES,...(e.data.extra||[])];
  let done=0;
  const notify=()=>self.clients.matchAll().then(cs=>cs.forEach(c=>c.postMessage({type:'PREFETCH_PROGRESS',done,total:urls.length})));
  for(const url of urls){
    try{
      if(!await cache.match(url)){
        const r=await fetch(url);
        if(r.ok)cache.put(url,r);
      }
      done++;notify();
    }catch{done++;notify();}
  }
  self.clients.matchAll().then(cs=>cs.forEach(c=>c.postMessage({type:'PREFETCH_DONE'})));
});
