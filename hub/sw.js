/* HYOJE HUB service worker
   - 허브 페이지(index.html 등)는 "캐시 먼저 보여 주고 뒤에서 새 버전 받기"
     → 와이파이가 끊겨도 링크로 열리고, 인터넷이 있으면 다음에 열 때 최신 버전
   - 바깥 글꼴·스크립트·이미지(파비콘 등)는 한 번 받으면 저장해 두고 씀
   - 검색 API 같은 데이터 요청은 저장하지 않음 (항상 최신 결과) */
const CACHE = 'hyoje-hub-v1';
const EXT_CACHE = 'hyoje-hub-ext-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== EXT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // 같은 사이트(허브 자체): 저장된 것 바로 보여 주고, 뒤에서 새 버전 받아 두기
  if(url.origin === self.location.origin){
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req, { ignoreSearch: true }) ||
                     (req.mode === 'navigate' ? await cache.match('./index.html') : null);
      const network = fetch(req).then(res => {
        if(res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if(cached){ e.waitUntil(network); return cached; }
      const res = await network;
      return res || new Response('오프라인이에요', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }

  // 바깥 글꼴·스크립트·스타일·이미지: 한 번 받으면 저장해 두고 씀
  if(['font', 'script', 'style', 'image'].includes(req.destination)){
    e.respondWith((async () => {
      const cache = await caches.open(EXT_CACHE);
      const cached = await cache.match(req);
      if(cached) return cached;
      try{
        const res = await fetch(req);
        if(res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }catch(err){
        return cached || Response.error();
      }
    })());
  }
  // 그 밖의 요청(검색 API 등)은 건드리지 않음
});
