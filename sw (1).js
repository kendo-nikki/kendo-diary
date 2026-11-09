// 剣道日記：ホーム画面のアプリ用（index.html と同じ場所に置く）
// ・ページ（index.html）は「まず通信で最新を取り、3.5秒たっても届かなければ端末に保存した前回分」を出す
//   → 更新はすぐ反映され、体育館など電波が弱い場所でも開ける
// ・アイコンなどは端末に保存した分を使う（通信しない）
// ・記録・分析（Google の GAS）への通信には一切さわらない
const CACHE = 'kendo-nikki-v5'; // アイコンを変えたら番号を上げる（古い保存分は自動で消える）
const ASSETS = ['./manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c) {
    return Promise.all(['./'].concat(ASSETS).map(function(u) { return c.add(u).catch(function() {}); }));
  }));
});
self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // GAS など外への通信はそのまま
  const isPage = /\/(index\.html)?$/.test(url.pathname);
  // 利用規約・プライバシーポリシーなど、日記の本体以外のページはそのまま（日記の控えを上書きしない）
  if (req.mode === 'navigate' && !isPage) return;
  if (isPage) {
    e.respondWith(new Promise(function(resolve) {
      let done = false;
      const fallback = function() {
        return caches.match(req, { ignoreSearch: true }).then(function(r) { return r || caches.match('./'); });
      };
      const timer = setTimeout(function() {
        fallback().then(function(r) { if (r && !done) { done = true; resolve(r); } });
      }, 3500);
      // ブラウザの一時保存（GitHub Pages は最大10分）を使わず、必ず最新の index.html を取りに行く
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function(res) {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(function(c) { c.put('./', copy); }); }
        if (!done) { done = true; clearTimeout(timer); resolve(res); }
      }).catch(function() {
        fallback().then(function(r) { if (!done) { done = true; clearTimeout(timer); resolve(r || Response.error()); } });
      });
    }));
    return;
  }
  e.respondWith(caches.match(req).then(function(r) { return r || fetch(req); }));
});
