import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const lessonRoot = new URL("../lessons/eliza-python-web/", import.meta.url);
const repoRoot = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, lessonRoot), "utf8");
}

async function fileExists(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

test("독립 lesson 페이지에 필요한 파일이 모두 존재한다", async () => {
  for (const file of [
    "index.html",
    "styles.css",
    "app.js",
    "python-runner.js",
    "worker.js",
    "editor.js",
    "config.js",
    "coi-bootstrap.js",
    "sw-coi.js",
    "apps-script-example.gs.txt",
  ]) {
    const content = await read(file);
    assert.ok(content.length > 0, `lessons/eliza-python-web/${file}가 비어 있음`);
  }
});

test("Pyodide 런타임이 저장소 안에 로컬로 고정 버전 배치되어 있고 불필요한 파일이 없다", async () => {
  const vendorDir = new URL("vendor/pyodide/", lessonRoot);
  const required = [
    "pyodide.mjs",
    "pyodide.asm.mjs",
    "pyodide.asm.wasm",
    "python_stdlib.zip",
    "pyodide-lock.json",
    "SOURCE.md",
    "LICENSE.txt",
  ];
  for (const file of required) {
    assert.ok(await fileExists(new URL(file, vendorDir)), `vendor/pyodide/${file}가 없음`);
  }
  // numpy/pandas 같은 추가 과학 계산 패키지(.whl)는 전혀 담지 않는다.
  for (const notExpected of ["numpy", "pandas", "micropip"]) {
    assert.ok(
      !(await fileExists(new URL(`${notExpected}.whl`, vendorDir))),
      `vendor/pyodide/에 불필요한 ${notExpected} 패키지가 있으면 안 됨`
    );
  }
  const wasmStat = await stat(new URL("pyodide.asm.wasm", vendorDir));
  assert.ok(wasmStat.size > 1_000_000, "pyodide.asm.wasm 크기가 비정상적으로 작음");
});

test("worker.js는 Web Worker에서 Pyodide를 실행하고 Atomics.wait로 input()을 동기 대기한다", async () => {
  const worker = await read("worker.js");
  assert.match(worker, /from "\.\/vendor\/pyodide\/pyodide\.mjs"/);
  assert.match(worker, /Atomics\.wait/);
  assert.match(worker, /Atomics\.notify|postMessage\(\{ type: "input-request" \}\)/);
  assert.match(worker, /if \(!headerView\) return null;/);
  assert.match(worker, /setStdin/);
  assert.match(worker, /runPythonAsync/);
});

test("교차 출처 격리는 실제 서비스워커 제어까지 기다리고 버전별 제한 횟수 안에서 복구한다", async () => {
  const [bootstrap, serviceWorker] = await Promise.all([read("coi-bootstrap.js"), read("sw-coi.js")]);
  assert.match(bootstrap, /navigator\.serviceWorker\.controller/);
  assert.match(bootstrap, /controllerchange/);
  assert.match(bootstrap, /updateViaCache:\s*"none"/);
  assert.match(bootstrap, /MAX_RELOADS\s*=\s*2/);
  assert.match(bootstrap, /retryElizaInputSetup/);
  assert.match(serviceWorker, /Cross-Origin-Embedder-Policy/);
  assert.match(serviceWorker, /Cross-Origin-Opener-Policy/);
  assert.match(serviceWorker, /WORKER_VERSION\s*=\s*"v2"/);
});

test("python-runner.js는 Worker.terminate()로 무한 루프를 안전하게 중지하고, SharedArrayBuffer는 cross-origin isolated일 때만 사용한다", async () => {
  const runner = await read("python-runner.js");
  assert.match(runner, /new Worker\(new URL\("\.\/worker\.js".*\{ type: "module" \}\)/);
  assert.match(runner, /worker\.terminate\(\)/);
  assert.match(runner, /window\.crossOriginIsolated === true/);
  assert.match(runner, /typeof SharedArrayBuffer !== "undefined"/);
  assert.match(runner, /if \(!supportsSyncInput\(\)\)/);
  assert.match(runner, /onInputUnavailable/);
});

test("입력 기능 준비 전에는 실행을 막고 학생이 직접 다시 준비할 수 있다", async () => {
  const [html, app] = await Promise.all([read("index.html"), read("app.js")]);
  assert.match(html, /id="run-button"[^>]*disabled/);
  assert.match(html, /id="runtime-retry-button"[^>]*hidden/);
  assert.match(app, /runtimeCanRun/);
  assert.match(app, /retryElizaInputSetup/);
  assert.match(app, /onLoadError[\s\S]*runtimeRetryButton\.hidden = false/);
  assert.match(app, /if \(window\.crossOriginIsolated\) runner\.preload\(\)/);
});

test("app.js는 코드·학번·이름을 탭 단위 sessionStorage에 저장하고, GAS_ENDPOINT가 비어 있으면 제출 버튼을 비활성화한다", async () => {
  const app = await read("app.js");
  assert.match(app, /sessionStorage\.setItem\(\s*STORAGE_KEY/);
  assert.doesNotMatch(app, /localStorage\.setItem\(\s*STORAGE_KEY/);
  assert.match(app, /studentNumber: studentNumberInput\.value/);
  assert.match(app, /studentName: studentNameInput\.value/);
  assert.match(app, /if \(!GAS_ENDPOINT\)/);
  assert.match(app, /openConfirmButton\.disabled = true/);
  assert.match(app, /import \{ GAS_ENDPOINT, ACTIVITY_VERSION \} from "\.\/config\.js(\?v=[^"]*)?"/);
});

test("생기부 참고용으로 만든 동기와 활용 및 개선 방안을 최소한으로 받아 제출한다", async () => {
  const [html, app, gasExample] = await Promise.all([
    read("index.html"),
    read("app.js"),
    read("apps-script-example.gs.txt"),
  ]);
  assert.match(html, /id="student-motivation"/);
  assert.match(html, /id="student-usage-improvement"/);
  assert.match(html, /id="confirm-motivation"/);
  assert.match(html, /id="confirm-usage-improvement"/);
  assert.match(app, /motivation: studentMotivationInput\.value/);
  assert.match(app, /usageImprovement: studentUsageImprovementInput\.value/);
  assert.match(app, /motivation: studentMotivationInput\.value\.trim\(\)/);
  assert.match(app, /usage_improvement: studentUsageImprovementInput\.value\.trim\(\)/);
  assert.doesNotMatch(app, /user_agent/);
  assert.match(gasExample, /data\.motivation/);
  assert.match(gasExample, /data\.usage_improvement/);
  assert.doesNotMatch(gasExample, /data\.checklist|data\.user_agent/);
  assert.match(gasExample, /LockService\.getScriptLock\(\)/);
  assert.match(gasExample, /lock\.waitLock\(10000\)/);
  assert.match(gasExample, /function safeCell\(value\)/);
});

test("config.js의 GAS_ENDPOINT는 배포된 Apps Script 웹 앱(.../exec) 주소로 설정되어 있다", async () => {
  const config = await read("config.js");
  assert.match(config, /export const GAS_ENDPOINT = "https:\/\/script\.google\.com\/macros\/s\/[^"]+\/exec";/);
  assert.match(config, /교사용 설정 파일/);
});

test("GAS_ENDPOINT가 이미 설정되어 있으면 교사용 설정 안내를 자동으로 숨긴다", async () => {
  const [html, app] = await Promise.all([read("index.html"), read("app.js")]);
  assert.match(html, /id="teacher-note" class="teacher-note"/);
  assert.match(app, /const teacherNote = \$\("#teacher-note"\);/);
  assert.match(app, /teacherNote\.hidden = Boolean\(GAS_ENDPOINT\);/);
});

test("최종 제출 버튼이 비활성화되어 있으면 빠진 항목을 구체적으로 안내한다", async () => {
  const app = await read("app.js");
  assert.match(app, /const missing = \[\];/);
  assert.match(app, /missing\.push\("학번"\)/);
  assert.match(app, /missing\.push\("이름"\)/);
  assert.match(app, /missing\.push\("코드"\)/);
  assert.match(app, /missing\.push\("만든 동기"\)/);
  assert.match(app, /missing\.push\("활용 및 개선 방안"\)/);
  assert.match(app, /openConfirmButton\.disabled = missing\.length > 0;/);
});

test("만든 동기·활용 및 개선 방안에는 글자 수 제한을 두지 않는다", async () => {
  const [html, app, gasExample] = await Promise.all([
    read("index.html"),
    read("app.js"),
    read("apps-script-example.gs.txt"),
  ]);
  assert.doesNotMatch(html, /minlength=/);
  assert.doesNotMatch(html, /maxlength=/);
  assert.doesNotMatch(app, /motivationLength|usageImprovementLength/);
  assert.doesNotMatch(gasExample, /\.length < 30|\.length > 200/);
});

test("index.html은 활성화 가드·터미널·편집기·제출 영역과 접근성 장치를 갖춘다", async () => {
  const html = await read("index.html");
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /data-guard-scope="page"/);
  assert.match(html, /data-guard-group="ai-history"/);
  assert.match(html, /data-guard-lesson="eliza-python-web"/);
  assert.match(html, /class="back-link" href="\.\.\/\.\.\/units\/ai-history\/"/);
  assert.match(html, /role="log"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="run-button"/);
  assert.match(html, /id="stop-button"[^>]*disabled/);
  assert.match(html, /id="reset-code-button"/);
  assert.match(html, /id="terminal-input"[^>]*disabled/);
  assert.match(html, /id="open-confirm-button"[^>]*disabled/);
  assert.match(html, /apps-script-example\.gs\.txt/);
  assert.doesNotMatch(html, /https?:\/\//, "외부 CDN/네트워크 URL을 참조하면 안 됨(Pyodide는 로컬 vendor만 사용)");
});

test("실행 전/후 점검 체크리스트는 제거되어 있다", async () => {
  const [html, css, app] = await Promise.all([read("index.html"), read("styles.css"), read("app.js")]);
  assert.doesNotMatch(html, /data-checklist=/);
  assert.doesNotMatch(html, /data-review=/);
  assert.doesNotMatch(html, /class="checklist-section"/);
  assert.doesNotMatch(html, /id="auto-check-box"/);
  assert.doesNotMatch(css, /\.checklist-section/);
  assert.doesNotMatch(css, /\.auto-check/);
  assert.doesNotMatch(app, /checklist/i);
});

test("styles.css는 focus-visible과 prefers-reduced-motion을 챙긴다", async () => {
  const css = await read("styles.css");
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});

test("코드 작성과 실행 결과를 독립된 두 작업 카드로 구분하고 프로젝터 모드는 제거한다", async () => {
  const [html, css, app] = await Promise.all([read("index.html"), read("styles.css"), read("app.js")]);
  assert.match(html, /workspace-card editor-workspace/);
  assert.match(html, /workspace-card terminal-workspace/);
  assert.match(html, />1\. 코드 작성</);
  assert.match(html, />2\. 실행 결과</);
  assert.match(css, /\.editor-workspace/);
  assert.match(css, /\.terminal-workspace/);
  assert.doesNotMatch(html, /projector-toggle/);
  assert.doesNotMatch(app, /projector-mode|projector-toggle/);
});

test("editor.js는 Tab/Shift+Tab 들여쓰기, Enter 자동 들여쓰기, Esc 키보드 탈출구를 제공한다", async () => {
  const editor = await read("editor.js");
  assert.match(editor, /event\.key === "Tab"/);
  assert.match(editor, /event\.shiftKey/);
  assert.match(editor, /event\.key === "Enter"/);
  assert.match(editor, /event\.key === "Escape"/);
  assert.match(editor, /textarea\.blur\(\)/);
});

test("data/activity-groups.json과 data/lessons.json에 eliza-python-web이 ai-history 두 번째 활동으로 등록되어 있다", async () => {
  const [groupsRaw, lessonsRaw] = await Promise.all([
    readFile(new URL("data/activity-groups.json", repoRoot), "utf8"),
    readFile(new URL("data/lessons.json", repoRoot), "utf8"),
  ]);
  const groups = JSON.parse(groupsRaw).groups;
  const historyGroup = groups.find((g) => g.id === "ai-history");
  assert.ok(historyGroup, "ai-history group을 찾을 수 없음");
  assert.equal(historyGroup.children.length, 2);
  const child = historyGroup.children.find((c) => c.id === "eliza-python-web");
  assert.ok(child, "eliza-python-web이 ai-history의 children에 없음");
  assert.equal(child.order, 2);
  assert.equal(child.path, "lessons/eliza-python-web/");
  assert.equal(child.active, true);
  assert.equal(child.status, "published");

  const lessons = JSON.parse(lessonsRaw).lessons;
  const lesson = lessons.find((l) => l.id === "eliza-python-web");
  assert.ok(lesson, "eliza-python-web이 data/lessons.json에 없음");
  assert.equal(lesson.order, child.order);
  assert.equal(lesson.path, child.path);
  assert.equal(lesson.duration, child.duration);
  assert.equal(lesson.difficulty, child.difficulty);
});

test("units/ai-history/index.html은 두 활동을 01/02 순서로 lessons/ 폴더에 직접 연결한다", async () => {
  const html = await readFile(new URL("units/ai-history/index.html", repoRoot), "utf8");
  const posWall = html.indexOf("lessons/ai-perceptron-wall/");
  const posEliza = html.indexOf("lessons/eliza-python-web/");
  assert.ok(posWall !== -1 && posEliza !== -1, "그룹 페이지에 두 활동 링크가 모두 있어야 함");
  assert.ok(posWall < posEliza, "그룹 페이지의 활동 순서가 01/02가 아님");
  assert.match(html, /data-lesson-card="eliza-python-web"/);
});

test("data/activity-groups.json의 group.path·children.path가 가리키는 index.html이 실제로 존재한다(회귀 방지)", async () => {
  assert.ok(await fileExists(new URL("lessons/eliza-python-web/index.html", repoRoot)));
});

test("highlightPython은 파이썬 키워드·내장함수·문자열·주석·숫자를 정확히 토큰화한다", async () => {
  const { highlightPython } = await import("../lessons/eliza-python-web/editor.js");
  const code = `# 주석
while True:
    msg = input("나: ")
    if msg == "종료":
        print(123)
        break`;
  const highlighted = highlightPython(code);
  assert.match(highlighted, /<span class="tok-comment"># 주석<\/span>/);
  assert.match(highlighted, /<span class="tok-keyword">while<\/span>/);
  assert.match(highlighted, /<span class="tok-keyword">True<\/span>/);
  assert.match(highlighted, /<span class="tok-builtin">input<\/span>/);
  assert.match(highlighted, /<span class="tok-string">"나: "<\/span>/);
  assert.match(highlighted, /<span class="tok-keyword">if<\/span>/);
  assert.match(highlighted, /<span class="tok-builtin">print<\/span>/);
  assert.match(highlighted, /<span class="tok-number">123<\/span>/);
  assert.match(highlighted, /<span class="tok-keyword">break<\/span>/);
});

test("로컬 Pyodide 런타임은 외부 네트워크 없이 로드되고 starter_code와 example_code를 실행할 수 있다", async () => {
  const { loadPyodide } = await import("../lessons/eliza-python-web/vendor/pyodide/pyodide.mjs");
  const path = await import("path");
  const indexURL = path.resolve("./lessons/eliza-python-web/vendor/pyodide/") + "/";
  const pyodide = await loadPyodide({ indexURL });

  // Starter code 테스트(조건문 없는 미완성 골격 — 수업 중 학생이 함께 완성함).
  // 아직 종료 조건이 없으므로 몇 차례 입력을 받다가 입력이 끊기면(EOF) 자연스럽게
  // EOFError로 끝나는 것까지가 정상 동작이다.
  let starterCallCount = 0;
  pyodide.setStdin({
    stdin: () => {
      starterCallCount += 1;
      return starterCallCount <= 3 ? "안녕\n" : undefined;
    },
  });
  const starterCode = `print("ELIZA와 대화를 시작합니다.")

while True:
    # message : 사용자의 입력
    message = input("나: ")

    # ELIZA의 대화 규칙 만들기
    `;
  let starterErrorCaught = false;
  try {
    await pyodide.runPythonAsync(starterCode);
  } catch (error) {
    starterErrorCaught = true;
    assert.match(String((error && error.message) || error), /EOFError/);
  }
  assert.ok(starterErrorCaught, "조건문 없는 starter_code는 입력이 끊기면 EOFError로 자연스럽게 끝나야 함");
  assert.ok(starterCallCount >= 4, "종료 조건이 없으므로 while 루프가 여러 번 반복되어야 함");

  // Example code 대화 흐름 테스트(딕셔너리 규칙 5개 + dict.get()으로 미등록 입력 처리 — 교과서 예시 방식)
  const exampleInputs = ["안녕\n", "힘들어\n", "좋아\n", "이름이 뭐야\n", "고마워\n", "그냥\n", "종료\n"];
  pyodide.setStdin({ stdin: () => exampleInputs.shift() });
  const exampleCode = `print("ELIZA와 대화를 시작합니다.")

ans = {
    "안녕": "안녕하세요! 만나서 반가워요.",
    "힘들어": "어떤 점이 가장 힘든가요?",
    "좋아": "무엇이 그렇게 좋은가요?",
    "이름이 뭐야": "저는 ELIZA예요.",
    "고마워": "천만에요, 언제든 이야기해요.",
}

while True:
    # message : 사용자의 입력
    message = input("나: ")

    if message == "종료":
        break

    print("ELIZA:", ans.get(message, "죄송합니다. 질문을 이해하지 못 했어요. 다시 말씀해주세요."))
`;
  await pyodide.runPythonAsync(exampleCode);
});

test("Pyodide stdout 스트림 버퍼는 stdin 대기 전에 프롬프트(나: )를 먼저 flush한다", async () => {
  const { loadPyodide } = await import("../lessons/eliza-python-web/vendor/pyodide/pyodide.mjs");
  const path = await import("path");
  const indexURL = path.resolve("./lessons/eliza-python-web/vendor/pyodide/") + "/";
  const pyodide = await loadPyodide({ indexURL });

  const events = [];
  class TestStreamBuffer {
    constructor() {
      this.decoder = new TextDecoder();
      this.buffer = new Uint8Array(4096);
      this.pos = 0;
    }
    handleByte(byte) {
      this.buffer[this.pos++] = byte;
      if (byte === 10) this.flush();
    }
    flush() {
      if (this.pos > 0) {
        const text = this.decoder.decode(this.buffer.subarray(0, this.pos));
        if (text) events.push({ type: "stdout", text });
        this.pos = 0;
      }
    }
  }
  const buf = new TestStreamBuffer();
  pyodide.setStdout({ raw: (b) => buf.handleByte(b) });
  pyodide.setStdin({
    stdin: () => {
      buf.flush();
      events.push({ type: "input-wait" });
      return "종료\n";
    },
  });

  const code = `
print("대화 시작")
msg = input("나: ")
print("종료됨")
`;
  await pyodide.runPythonAsync(code);
  buf.flush();

  assert.deepEqual(events, [
    { type: "stdout", text: "대화 시작\n" },
    { type: "stdout", text: "나: " },
    { type: "input-wait" },
    { type: "stdout", text: "종료됨\n" },
  ]);
});
