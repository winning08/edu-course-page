// Cross-Origin Isolation 부트스트랩. 반드시 module 스크립트보다 먼저,
// 일반 <script>(classic script)로 로드해 최대한 빨리 실행되게 한다.
//
// SharedArrayBuffer + Atomics.wait(python-runner.js/worker.js가 input()을
// 동기적으로 기다리는 데 사용)를 쓰려면 브라우저가 "cross-origin isolated"
// 상태여야 한다. 이 상태는 문서 응답에 Cross-Origin-Opener-Policy: same-origin,
// Cross-Origin-Embedder-Policy: require-corp 헤더가 있어야 켜지는데, 정적 파일만
// 서빙하는 이 사이트는 서버 응답 헤더를 직접 설정할 수 없다. 그래서 같은 출처
// 응답에 그 두 헤더를 덧붙이는 서비스워커(sw-coi.js)를 등록하고, 서비스워커가
// 활성화된 뒤 이 세션에서 딱 한 번만 새로고침해 격리 상태로 만든다.
//
// 여기서 실패하거나(구형 브라우저, 서비스워커 비활성 등) 격리에 끝내
// 도달하지 못해도 활동 자체는 막히지 않는다 — python-runner.js가
// window.crossOriginIsolated를 확인해 SharedArrayBuffer를 못 쓰는 경우
// input()을 즉시 EOF로 처리하는 대체 경로로 넘어간다.
(function () {
  const RELOAD_FLAG = "eliza-python-web:coi-reloaded:v1";

  if (window.crossOriginIsolated) return;
  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext) return;
  // 이미 한 번 새로고침을 시도했는데도 격리되지 않았다면 더 재시도하지 않는다(무한 루프 방지).
  if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;

  navigator.serviceWorker
    .register("./sw-coi.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      sessionStorage.setItem(RELOAD_FLAG, "1");
      location.reload();
    })
    .catch((error) => {
      console.warn("[eliza-python-web] cross-origin isolation 서비스워커 등록 실패:", error);
    });
})();
