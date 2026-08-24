// GitHub Pages처럼 응답 헤더를 직접 설정할 수 없는 정적 호스팅에서
// SharedArrayBuffer를 사용할 수 있도록 서비스워커를 준비한다.
// 등록 완료가 아니라 실제 controller 확보까지 기다린 후 새로고침하며,
// 실패해도 무한 새로고침하지 않도록 버전별로 횟수를 제한한다.
(function () {
  const BOOT_VERSION = "v2";
  const ATTEMPT_KEY = `eliza-python-web:coi-attempts:${BOOT_VERSION}`;
  const MAX_RELOADS = 2;
  const state = { status: "checking", message: "입력 기능을 준비하고 있습니다." };
  window.__ELIZA_COI_STATE__ = state;

  function publish(status, message) {
    state.status = status;
    state.message = message;
    window.dispatchEvent(new CustomEvent("eliza-coi-state", { detail: { status, message } }));
  }

  window.retryElizaInputSetup = function () {
    sessionStorage.removeItem(ATTEMPT_KEY);
    location.reload();
  };

  if (window.crossOriginIsolated) {
    sessionStorage.removeItem(ATTEMPT_KEY);
    publish("ready", "입력 기능 준비 완료");
    return;
  }

  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    publish("unavailable", "이 브라우저에서는 대화 입력 기능을 준비할 수 없습니다.");
    return;
  }

  function waitForController(timeoutMs) {
    if (navigator.serviceWorker.controller) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        clearTimeout(timer);
        resolve(true);
      }, { once: true });
    });
  }

  async function prepare() {
    try {
      const registration = await navigator.serviceWorker.register("./sw-coi.js?v=2", {
        scope: "./",
        updateViaCache: "none",
      });
      await registration.update();
      await navigator.serviceWorker.ready;
      await waitForController(8000);

      const attempts = Number(sessionStorage.getItem(ATTEMPT_KEY) || "0");
      if (attempts < MAX_RELOADS) {
        sessionStorage.setItem(ATTEMPT_KEY, String(attempts + 1));
        location.reload();
        return;
      }
      publish("unavailable", "입력 기능 준비가 완료되지 않았습니다. 다시 준비 버튼을 눌러주세요.");
    } catch (error) {
      console.warn("[eliza-python-web] 입력 기능 준비 실패:", error);
      publish("unavailable", "입력 기능을 준비하지 못했습니다. 다시 준비 버튼을 눌러주세요.");
    }
  }

  prepare();
})();
