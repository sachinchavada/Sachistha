const CACHE_NAME = 'sachistha-v3';
const ASSETS = [
  './index.html',
  './app.js',
  './data.js',
  './config.js',
  './photos_data.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache=> cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event)=>{
  event.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event)=>{
  // Always go to network for Supabase API calls
  if(event.request.url.includes('supabase.co')){
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached=> cached || fetch(event.request))
  );
});
