// 메인 스레드에서 파이썬 실행 워커(worker.js)를 관리한다.
// - Worker 생성/종료, input() 응답을 위한 SharedArrayBuffer 관리
// - worker.js가 보내는 메시지를 app.js가 등록한 콜백으로 그대로 전달
const STATE_READY = 2;
const HEADER_INT32_COUNT = 2;
const HEADER_BYTES = HEADER_INT32_COUNT * 4;
const PAYLOAD_BYTES_CAPACITY = 8192; // input() 한 줄에 담을 수 있는 최대 UTF-8 바이트 수

export function supportsSyncInput() {
  return typeof SharedArrayBuffer !== "undefined" && window.crossOriginIsolated === true;
}

export function createPythonRunner(callbacks) {
  let worker = null;
  let headerView = null;
  let payloadView = null;
  let running = false;

  function handleMessage(msg) {
    switch (msg.type) {
      case "ready":
        callbacks.onReady?.(supportsSyncInput());
        break;
      case "pyodide-load-error":
        // 네트워크 문제 등으로 부팅 자체가 실패한 경우: 다음 "실행" 클릭이
        // 진짜 재시도가 되도록 이 워커를 버린다(캐시된 실패 Promise를 계속
        // 재사용하면 재시도 없이 같은 오류만 반복된다).
        teardownWorker();
        callbacks.onLoadError?.(msg.text);
        break;
      case "stdout":
        callbacks.onStdout?.(msg.text);
        break;
      case "stderr":
        callbacks.onStderr?.(msg.text);
        break;
      case "input-request":
        callbacks.onInputRequest?.();
        break;
      case "done":
        running = false;
        callbacks.onDone?.();
        break;
      case "error":
        running = false;
        callbacks.onError?.(msg.text, msg.hint);
        break;
      default:
        break;
    }
  }

  function spawnWorker() {
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (event) => handleMessage(event.data);
    worker.onerror = (event) => {
      teardownWorker();
      callbacks.onLoadError?.(`파이썬 실행 환경을 불러오는 중 오류가 발생했습니다: ${event.message || "알 수 없는 오류"}`);
    };

    let sharedBuffer = null;
    if (supportsSyncInput()) {
      sharedBuffer = new SharedArrayBuffer(HEADER_BYTES + PAYLOAD_BYTES_CAPACITY);
      headerView = new Int32Array(sharedBuffer, 0, HEADER_INT32_COUNT);
      payloadView = new Uint8Array(sharedBuffer, HEADER_BYTES);
    } else {
      headerView = null;
      payloadView = null;
    }
    worker.postMessage({ type: "init", sharedBuffer });
  }

  function ensureWorker() {
    if (!worker) spawnWorker();
  }

  function teardownWorker() {
    if (worker) worker.terminate();
    worker = null;
    headerView = null;
    payloadView = null;
    running = false;
  }

  // 페이지 진입 시 미리 호출해 파이오다이드(약 13MB)를 백그라운드에서
  // 받아두면, 학생이 활동 안내를 읽는 동안 로딩이 끝나 있을 가능성이 높다.
  function preload() {
    ensureWorker();
  }

  function run(code) {
    ensureWorker();
    running = true;
    worker.postMessage({ type: "run", code });
  }

  // input() 대기 중인 워커에 사용자가 입력한 한 줄을 전달한다.
  // 공유 버퍼에 직접 쓰고 Atomics.notify로 깨우기만 하면 되므로 postMessage 왕복이 필요 없다.
  function submitInput(text) {
    if (!headerView) return false;
    const bytes = new TextEncoder().encode(text);
    const length = Math.min(bytes.length, payloadView.length);
    payloadView.set(bytes.subarray(0, length));
    Atomics.store(headerView, 1, length);
    Atomics.store(headerView, 0, STATE_READY);
    Atomics.notify(headerView, 0);
    return true;
  }

  function stop() {
    teardownWorker();
  }

  function isRunning() {
    return running;
  }

  return { preload, run, stop, submitInput, isRunning };
}
