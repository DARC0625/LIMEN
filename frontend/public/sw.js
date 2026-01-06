// Service Worker for LIMEN PWA
// 오프라인 지원 및 캐싱 전략

const CACHE_NAME = 'limen-v2';
const RUNTIME_CACHE = 'limen-runtime-v2';

// 캐시할 리소스 목록
const STATIC_CACHE_URLS = [
  '/',
  '/login',
  '/register',
  '/offline',
  '/manifest.json',
];

// 네트워크 우선, 실패 시 캐시 전략
// 주의: /_next/static/은 ServiceWorker가 가로채지 않음 (위에서 처리)
const NETWORK_FIRST_PATTERNS = [
  /^\/api\//,
];

// 캐시 우선, 실패 시 네트워크 전략
const CACHE_FIRST_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
  /\.(?:woff|woff2|ttf|eot)$/,
  /\.(?:css|js)$/,
];

// 설치 시 정적 리소스 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE_URLS).catch((err) => {
        console.log('Cache install error:', err);
      });
    })
  );
  self.skipWaiting();
});

// 활성화 시 오래된 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => {
            return caches.delete(cacheName);
          })
      );
    })
  );
  return self.clients.claim();
});

// 요청 가로채기 및 캐싱 전략 적용
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 같은 출처 요청만 처리
  if (url.origin !== location.origin) {
    return;
  }

  // Next.js RSC (React Server Components) 요청은 ServiceWorker가 처리하지 않음
  // RSC 요청은 ?_rsc= 쿼리 파라미터를 포함
  if (url.searchParams.has('_rsc')) {
    return; // ServiceWorker가 가로채지 않음 - 브라우저가 직접 처리
  }

  // Next.js 내부 경로는 ServiceWorker가 처리하지 않음 (보안 및 안정성)
  // /_next/ 경로는 네트워크로 직접 전달
  if (url.pathname.startsWith('/_next/')) {
    return; // ServiceWorker가 가로채지 않음 - 브라우저가 직접 처리
  }

  // WebSocket 연결은 ServiceWorker가 처리하지 않음
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // API 요청은 네트워크 우선
  if (NETWORK_FIRST_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 정적 리소스는 캐시 우선 (하지만 /_next/static/은 제외)
  if (CACHE_FIRST_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 기본: 네트워크 우선, 실패 시 캐시
  event.respondWith(networkFirst(request));
});

// 네트워크 우선 전략
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    // Next.js 내부 파일은 캐시하지 않음 (항상 최신 버전 사용)
    if (request.url.includes('/_next/') || request.url.includes('?_rsc=')) {
      return response;
    }
    
    // 성공한 응답을 캐시에 저장
    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Next.js 내부 파일은 캐시에서 찾지 않음
    if (request.url.includes('/_next/') || request.url.includes('?_rsc=')) {
      throw error;
    }

    // 네트워크 실패 시 캐시에서 찾기
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }

    // 페이지 요청이고 캐시에 없으면 오프라인 페이지 반환
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline');
      if (offlinePage) {
        return offlinePage;
      }
    }

    throw error;
  }
}

// 캐시 우선 전략
async function cacheFirst(request) {
  // Next.js 내부 파일은 캐시 우선 전략 사용하지 않음
  if (request.url.includes('/_next/') || request.url.includes('?_rsc=')) {
    try {
      return await fetch(request);
    } catch (error) {
      throw error;
    }
  }

  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    
    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    throw error;
  }
}

// 백그라운드 동기화 (선택적)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // 백그라운드에서 동기화 작업 수행
  console.log('Background sync triggered');
}



