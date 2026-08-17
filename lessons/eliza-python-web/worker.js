// Pyodide 실행 전용 Web Worker.
//
// 메인 스레드가 아니라 여기서 파이썬 코드를 돌리는 이유는 두 가지다.
// 1) 무한 루프(예: while True에 종료 조건이 없는 코드)에 빠져도 메인 스레드의
//    페이지 UI는 멈추지 않는다. 학생이 "중지" 버튼을 누르면 메인 스레드가 이
//    워커를 그냥 terminate()해서 즉시 죽인다 — 별도의 정리 로직이 필요 없는
//    가장 확실한 중지 방법이다.
// 2) input()을 진짜로 "줄 때까지 멈춰서 기다리는" 것처럼 동작시키려면
//    Atomics.wait로 스레드를 동기적으로 블록해야 하는데, 이는 워커 스레드에서만
//    허용된다(메인 스레드에서 호출하면 브라우저가 예외를 던진다).
import { loadPyodide } from "./vendor/pyodide/pyodide.mjs";

const INDEX_URL = new URL("./vendor/pyodide/", import.meta.url).href;

const STATE_WAITING = 1;
const STATE_READY = 2;
const HEADER_INT32_COUNT = 2; // [0]=state, [1]=payload byte length
const HEADER_BYTES = HEADER_INT32_COUNT * 4;

let pyodideReadyPromise = null;
let headerView = null; // Int32Array, main 스레드와 공유
let payloadView = null; // Uint8Array, main 스레드와 공유

function initSharedBuffer(sharedBuffer) {
  if (!sharedBuffer) {
    headerView = null;
    payloadView = null;
    return;
  }
  headerView = new Int32Array(sharedBuffer, 0, HEADER_INT32_COUNT);
  payloadView = new Uint8Array(sharedBuffer, HEADER_BYTES);
}

class StreamBuffer {
  constructor(type) {
    this.type = type;
    this.decoder = new TextDecoder();
    this.buffer = new Uint8Array(4096);
    this.pos = 0;
  }

  handleByte(byte) {
    if (this.pos >= this.buffer.length) {
      const next = new Uint8Array(this.buffer.length * 2);
      next.set(this.buffer);
      this.buffer = next;
    }
    this.buffer[this.pos++] = byte;
    if (byte === 10) {
      this.flush();
    }
  }

  flush() {
    if (this.pos > 0) {
      const text = this.decoder.decode(this.buffer.subarray(0, this.pos));
      if (text) {
        postMessage({ type: this.type, text });
      }
      this.pos = 0;
    }
  }
}

const stdoutBuf = new StreamBuffer("stdout");
const stderrBuf = new StreamBuffer("stderr");

function flushStreams() {
  stdoutBuf.flush();
  stderrBuf.flush();
}

// input() 한 번을 처리한다: 메인 스레드에 "입력 대기 중"을 알리고, 답이
// SharedArrayBuffer에 쓰여 Atomics.notify될 때까지 이 워커 스레드를 그대로
// 블록한다. 공유 버퍼가 없는 환경(cross-origin isolation 실패)에서는 즉시
// null을 돌려줘 파이썬 쪽에서 EOFError가 나게 한다 — 조용히 멈춰버리는 것보다
// 명확한 오류가 낫다.
function requestInputLine() {
  if (!headerView) return null;
  Atomics.store(headerView, 0, STATE_WAITING);
  postMessage({ type: "input-request" });
  Atomics.wait(headerView, 0, STATE_WAITING);
  if (Atomics.load(headerView, 0) !== STATE_READY) return null;
  const length = Atomics.load(headerView, 1);
  const bytes = payloadView.slice(0, length);
  return new TextDecoder().decode(bytes);
}

function stdinCallback() {
  flushStreams();
  const line = requestInputLine();
  if (line === null) return null; // EOF -> 파이썬에서 EOFError
  return `${line}\n`;
}

function formatError(error) {
  const raw = (error && error.message) || String(error);
  let hint = "";
  if (/IndentationError/.test(raw)) {
    hint = "들여쓰기를 확인해 보세요. if, elif, else, while 다음 줄은 안쪽으로 들여써야 합니다.";
  } else if (/SyntaxError/.test(raw)) {
    hint = "문법 오류입니다. 괄호·따옴표·콜론(:)이 빠지지 않았는지 확인해 보세요.";
  } else if (/NameError/.test(raw)) {
    hint = "정의하지 않은 이름을 사용했을 수 있습니다. 변수·함수 이름의 철자를 확인해 보세요.";
  } else if (/TypeError/.test(raw)) {
    hint = "자료형이 맞지 않습니다. 문자열과 숫자를 더하려면 str()로 변환했는지 확인해 보세요.";
  } else if (/ValueError/.test(raw)) {
    hint = "올바른 형식의 값이 전달되지 않았습니다. 입력 값을 다시 확인해 보세요.";
  } else if (/IndexError/.test(raw)) {
    hint = "목록이나 문자열의 범위를 벗어난 위치에 접근했습니다. 인덱스 번호를 확인해 보세요.";
  } else if (/EOFError/.test(raw)) {
    hint = "입력을 받을 수 없는 상태에서 input()이 호출되었습니다. 방금 실행을 중지했다면 정상입니다.";
  } else if (/RecursionError/.test(raw)) {
    hint = "함수가 스스로를 너무 많이 반복해서 불렀습니다. 재귀 호출에 종료 조건이 있는지 확인해 보세요.";
  }
  return { raw, hint };
}

async function ensurePyodide() {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = loadPyodide({ indexURL: INDEX_URL }).then((pyodide) => {
      pyodide.setStdout({ raw: (b) => stdoutBuf.handleByte(b) });
      pyodide.setStderr({ raw: (b) => stderrBuf.handleByte(b) });
      pyodide.setStdin({ stdin: stdinCallback, autoEOF: true });
      return pyodide;
    });
  }
  return pyodideReadyPromise;
}

function resetMainNamespace(pyodide) {
  try {
    pyodide.runPython(`
import sys
main_dict = sys.modules["__main__"].__dict__
for k in list(main_dict.keys()):
    if not (k.startswith("__") and k.endswith("__")):
        del main_dict[k]
`);
  } catch {
    // namespace reset 실패 시 무시
  }
}

async function runCode(code) {
  try {
    const pyodide = await ensurePyodide();
    resetMainNamespace(pyodide);
    await pyodide.runPythonAsync(code);
    flushStreams();
    postMessage({ type: "done" });
  } catch (error) {
    flushStreams();
    const { raw, hint } = formatError(error);
    postMessage({ type: "error", text: raw, hint });
  }
}

self.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === "init") {
    initSharedBuffer(msg.sharedBuffer);
    ensurePyodide().then(
      () => postMessage({ type: "ready" }),
      (error) => postMessage({ type: "pyodide-load-error", text: (error && error.message) || String(error) })
    );
    return;
  }
  if (msg.type === "run") {
    runCode(msg.code);
  }
};
