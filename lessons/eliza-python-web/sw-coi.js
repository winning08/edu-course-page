// Cross-Origin Isolation을 켜기 위한 최소 서비스워커.
// 이 활동은 무한 루프에 빠진 학생 코드의 input()을 안전하게 멈춰 세우기 위해
// Web Worker 안에서 Atomics.wait로 동기 대기한다(coi-bootstrap.js 참고). 그러려면
// 브라우저가 이 페이지를 "cross-origin isolated"로 인식해야 하는데, 이 사이트는
// 정적 파일만 서빙하므로(예: GitHub Pages) 서버 응답 헤더를 직접 바꿀 수 없다.
// 대신 같은 오리진 응답에 COOP/COEP 헤더를 덧붙이는 이 서비스워커를 등록해
// 우회한다. 이 활동 폴더 바깥의 리소스는 모두 같은 출처(same-origin)라 COEP
// require-corp의 영향을 받지 않으므로 별도 처리가 필요 없다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 0) return response; // 불투명(opaque) 응답은 건드릴 수 없음
        const headers = new Headers(response.headers);
        headers.set("Cross-Origin-Embedder-Policy", "require-corp");
        headers.set("Cross-Origin-Opener-Policy", "same-origin");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      })
      .catch(() => fetch(request))
  );
});
