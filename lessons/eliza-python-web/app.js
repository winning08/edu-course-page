import { setupEditor } from "./editor.js";
import { createPythonRunner } from "./python-runner.js?v=2026082501";
import { GAS_ENDPOINT, ACTIVITY_VERSION } from "./config.js?v=2026082402";

const STORAGE_KEY = "eliza-python-web:v2";

// 이전 버전의 영구 저장값은 한 번 정리하고, 이제부터는 현재 탭에서만 보관한다.
try { localStorage.removeItem(STORAGE_KEY); } catch { /* 저장소 접근 불가 환경 */ }

const STARTER_CODE = `print("ELIZA와 대화를 시작합니다.")

# 키워드: 응답 형태로 대화 규칙을 채워 넣으세요.
# (예시처럼 계속 추가해 보세요)
data = {
    "안녕": "안녕하세요",
    "이름이 뭐야?": "제 이름은 ELIZA에요.",
}

while True:
    # msg : 사용자의 입력
    msg = input("나: ")

    # ELIZA의 대화 규칙 만들기


    print("ELIZA:", reply)
`;

const $ = (selector) => document.querySelector(selector);

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function initApp() {
  const runtimeStatus = $("#runtime-status");
  const runtimeRetryButton = $("#runtime-retry-button");
  const runButton = $("#run-button");
  const stopButton = $("#stop-button");
  const copyCodeButton = $("#copy-code-button");
  const copyCodeStatus = $("#copy-code-status");
  const resetCodeButton = $("#reset-code-button");
  const terminalLog = $("#terminal-log");
  const terminalForm = $("#terminal-input-form");
  const terminalInput = $("#terminal-input");
  const terminalSend = $("#terminal-send");
  const inputWaitStatus = $("#input-wait-status");
  const studentNumberInput = $("#student-number");
  const studentNameInput = $("#student-name");
  const studentMotivationInput = $("#student-motivation");
  const studentUsageImprovementInput = $("#student-usage-improvement");
  const submitConfigNotice = $("#submit-config-notice");
  const teacherNote = $("#teacher-note");
  const openConfirmButton = $("#open-confirm-button");
  const confirmPanel = $("#confirm-panel");
  const confirmHeading = $("#confirm-heading");
  const confirmNumber = $("#confirm-number");
  const confirmName = $("#confirm-name");
  const confirmMotivation = $("#confirm-motivation");
  const confirmUsageImprovement = $("#confirm-usage-improvement");
  const confirmCode = $("#confirm-code");
  const confirmCancel = $("#confirm-cancel");
  const confirmSubmit = $("#confirm-submit");
  const submitResult = $("#submit-result");

  const savedState = loadState();

  const editor = setupEditor({
    textarea: $("#code-textarea"),
    gutter: $("#code-gutter"),
    highlightPane: $("#code-highlight"),
    highlightCode: $("#code-highlight-code"),
    onChange: () => {
      refreshSubmitAvailability();
      saveState();
    },
  });
  editor.setValue(savedState?.code ?? STARTER_CODE);

  studentNumberInput.value = savedState?.studentNumber ?? "";
  studentNameInput.value = savedState?.studentName ?? "";
  // 기존 임시 저장값도 잃지 않도록 이전 필드에서 한 번 마이그레이션한다.
  studentMotivationInput.value = savedState?.motivation ?? savedState?.careerContext ?? "";
  studentUsageImprovementInput.value = savedState?.usageImprovement ?? savedState?.implementationReflection ?? savedState?.usagePlan ?? "";

  function saveState() {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          code: editor.getValue(),
          studentNumber: studentNumberInput.value,
          studentName: studentNameInput.value,
          motivation: studentMotivationInput.value,
          usageImprovement: studentUsageImprovementInput.value,
        })
      );
    } catch {
      // sessionStorage를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 저장을 건너뛴다.
    }
  }

  // --- 터미널 출력 -------------------------------------------------------
  let openLine = null;

  function newLine() {
    openLine = document.createElement("div");
    openLine.className = "terminal-line";
    terminalLog.appendChild(openLine);
    return openLine;
  }

  function appendOutput(text, cls) {
    if (!text) return;
    const parts = text.split("\n");
    parts.forEach((part, index) => {
      if (!openLine) newLine();
      if (part) {
        const span = document.createElement("span");
        if (cls) span.className = cls;
        span.textContent = part;
        openLine.appendChild(span);
      }
      if (index < parts.length - 1) openLine = null;
    });
    terminalLog.scrollTop = terminalLog.scrollHeight;
  }

  function appendSystemLine(text) {
    openLine = null;
    const line = newLine();
    line.classList.add("terminal-system");
    line.textContent = text;
    openLine = null;
    terminalLog.scrollTop = terminalLog.scrollHeight;
  }

  function appendErrorBlock(text, hint) {
    openLine = null;
    const line = newLine();
    line.classList.add("terminal-error");
    line.textContent = "⚠️ 코드 실행 중 오류가 발생했습니다.";
    const pre = document.createElement("pre");
    pre.className = "terminal-error-detail";
    pre.textContent = text;
    line.appendChild(pre);
    if (hint) {
      const hintEl = document.createElement("p");
      hintEl.className = "terminal-error-hint";
      hintEl.textContent = `💡 ${hint}`;
      line.appendChild(hintEl);
    }
    openLine = null;
    terminalLog.scrollTop = terminalLog.scrollHeight;
  }

  function clearTerminal() {
    terminalLog.innerHTML = "";
    terminalInput.value = "";
    openLine = null;
  }

  function enableInputRow() {
    terminalInput.disabled = false;
    terminalSend.disabled = false;
    terminalForm.classList.add("is-waiting");
    terminalInput.focus();
    inputWaitStatus.textContent = "ELIZA가 답을 기다리고 있습니다. 위 입력칸에 적어 보내세요.";
  }

  function disableInputRow() {
    terminalInput.disabled = true;
    terminalSend.disabled = true;
    terminalForm.classList.remove("is-waiting");
    inputWaitStatus.textContent = "코드를 실행하면 대화 입력이 활성화됩니다.";
  }

  // --- 실행 상태 UI --------------------------------------------------------
  // 교차 출처 격리가 준비됐다면 Pyodide 다운로드가 끝나기 전에도 실행을
  // 누를 수 있다. Worker는 init과 run을 순서대로 받아 준비가 끝난 뒤 실행한다.
  let runtimeCanRun = window.crossOriginIsolated === true;

  function setRunningUI(isRunning) {
    runButton.disabled = isRunning || !runtimeCanRun;
    stopButton.disabled = !isRunning;
    resetCodeButton.disabled = isRunning;
  }

  const runner = createPythonRunner({
    onReady(supportsInput) {
      runtimeCanRun = supportsInput;
      runtimeStatus.textContent = supportsInput
        ? "파이썬 실행 환경 준비 완료. 실행 버튼을 눌러 시작하세요."
        : (window.__ELIZA_COI_STATE__?.message || "대화 입력 기능을 준비하지 못했습니다. 입력 기능 다시 준비를 눌러주세요.");
      runtimeRetryButton.hidden = supportsInput;
      setRunningUI(false);
    },
    onLoadError(text) {
      runtimeCanRun = false;
      runtimeStatus.textContent = `⚠️ 파이썬 실행 환경을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 실행 버튼을 다시 눌러보세요. (${text})`;
      runtimeRetryButton.hidden = false;
      setRunningUI(false);
      disableInputRow();
    },
    onInputUnavailable() {
      runtimeCanRun = false;
      runtimeStatus.textContent = "대화 입력 기능이 준비되지 않아 실행하지 않았습니다. 입력 기능 다시 준비를 눌러주세요.";
      runtimeRetryButton.hidden = false;
      setRunningUI(false);
      disableInputRow();
    },
    onStdout(text) {
      appendOutput(text, null);
    },
    onStderr(text) {
      appendOutput(text, "terminal-stderr");
    },
    onInputRequest() {
      enableInputRow();
    },
    onDone() {
      appendSystemLine("■ 프로그램이 정상적으로 종료되었습니다.");
      setRunningUI(false);
      disableInputRow();
    },
    onError(text, hint) {
      appendErrorBlock(text, hint);
      setRunningUI(false);
      disableInputRow();
    },
  });

  // 첫 방문에서는 서비스워커가 제어권을 얻은 뒤 곧바로 새로고침하므로,
  // 격리 준비 전 13MB 런타임을 중복 다운로드하지 않는다.
  if (window.crossOriginIsolated) {
    setRunningUI(false);
    runtimeStatus.textContent = "입력 기능 준비 완료. 실행하면 파이썬 환경을 불러옵니다.";
    runner.preload();
  }

  runtimeRetryButton.addEventListener("click", () => {
    runtimeRetryButton.disabled = true;
    runtimeStatus.textContent = "입력 기능을 다시 준비하고 있습니다…";
    if (typeof window.retryElizaInputSetup === "function") {
      window.retryElizaInputSetup();
    } else {
      location.reload();
    }
  });

  runButton.addEventListener("click", () => {
    if (runner.isRunning()) return;
    saveState();
    clearTerminal();
    appendSystemLine("▶ 실행을 시작합니다.");
    setRunningUI(true);
    disableInputRow();
    runner.run(editor.getValue());
  });

  stopButton.addEventListener("click", () => {
    runner.stop();
    appendSystemLine("⏹ 실행을 중지했습니다.");
    setRunningUI(false);
    disableInputRow();
  });

  async function copyCodeToClipboard() {
    const code = editor.getValue();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const copyBuffer = document.createElement("textarea");
        copyBuffer.value = code;
        copyBuffer.setAttribute("readonly", "");
        copyBuffer.style.position = "fixed";
        copyBuffer.style.opacity = "0";
        document.body.appendChild(copyBuffer);
        copyBuffer.select();
        const copied = document.execCommand("copy");
        copyBuffer.remove();
        if (!copied) throw new Error("copy command failed");
      }
      copyCodeButton.textContent = "✓ 복사됨";
      copyCodeStatus.textContent = "내 파이썬 코드 전체를 클립보드에 복사했습니다.";
    } catch {
      copyCodeButton.textContent = "복사 실패";
      copyCodeStatus.textContent = "코드를 복사하지 못했습니다. 코드 편집기에서 직접 전체 선택해 복사해 주세요.";
    }
    window.setTimeout(() => {
      copyCodeButton.textContent = "📋 전체 복사";
    }, 1800);
  }

  copyCodeButton.addEventListener("click", copyCodeToClipboard);

  resetCodeButton.addEventListener("click", () => {
    if (runner.isRunning()) return;
    const confirmed = window.confirm("코드를 기본 예제로 되돌릴까요? 지금까지 작성한 내용이 사라집니다.");
    if (!confirmed) return;
    editor.setValue(STARTER_CODE);
    refreshSubmitAvailability();
    saveState();
  });

  terminalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (terminalInput.disabled) return;
    const text = terminalInput.value;
    appendOutput(`${text}\n`, "terminal-echo");
    terminalInput.value = "";
    disableInputRow();
    runner.submitInput(text);
  });

  studentNumberInput.addEventListener("input", () => {
    saveState();
    refreshSubmitAvailability();
  });
  studentNameInput.addEventListener("input", () => {
    saveState();
    refreshSubmitAvailability();
  });
  studentMotivationInput.addEventListener("input", () => {
    saveState();
    refreshSubmitAvailability();
  });
  studentUsageImprovementInput.addEventListener("input", () => {
    saveState();
    refreshSubmitAvailability();
  });

  // --- 최종 제출 -----------------------------------------------------------
  // 제출 주소가 이미 설정되어 있으면 교사용 설정 안내는 더 이상 필요 없으므로 숨긴다.
  teacherNote.hidden = Boolean(GAS_ENDPOINT);

  function refreshSubmitAvailability() {
    if (!GAS_ENDPOINT) {
      submitConfigNotice.hidden = false;
      submitConfigNotice.textContent =
        "⚠️ 아직 선생님이 제출 주소를 설정하지 않았습니다. 코드 작성과 실행 연습은 그대로 할 수 있고, 설정이 끝나면 제출할 수 있습니다.";
      openConfirmButton.disabled = true;
      return;
    }
    const hasNumber = studentNumberInput.value.trim().length > 0;
    const hasName = studentNameInput.value.trim().length > 0;
    const hasMotivation = studentMotivationInput.value.trim().length > 0;
    const hasUsageImprovement = studentUsageImprovementInput.value.trim().length > 0;
    const hasCode = editor.getValue().trim().length > 0;

    // 버튼이 왜 비활성화되어 있는지 학생이 바로 알 수 있도록 빠진 항목을 그대로 알려준다.
    const missing = [];
    if (!hasNumber) missing.push("학번");
    if (!hasName) missing.push("이름");
    if (!hasCode) missing.push("코드");
    if (!hasMotivation) missing.push("만든 동기");
    if (!hasUsageImprovement) missing.push("활용 및 개선 방안");

    if (missing.length > 0) {
      submitConfigNotice.hidden = false;
      submitConfigNotice.textContent = `아직 제출할 수 없습니다 — 다음을 채워주세요: ${missing.join(", ")}`;
    } else {
      submitConfigNotice.hidden = true;
    }
    openConfirmButton.disabled = missing.length > 0;
  }

  function openConfirmPanel() {
    confirmNumber.textContent = studentNumberInput.value.trim();
    confirmName.textContent = studentNameInput.value.trim();
    confirmMotivation.textContent = studentMotivationInput.value.trim();
    confirmUsageImprovement.textContent = studentUsageImprovementInput.value.trim();
    confirmCode.textContent = editor.getValue();
    confirmPanel.hidden = false;
    submitResult.hidden = true;
    confirmHeading.focus();
  }

  function closeConfirmPanel() {
    confirmPanel.hidden = true;
    openConfirmButton.focus();
  }

  openConfirmButton.addEventListener("click", openConfirmPanel);
  confirmCancel.addEventListener("click", closeConfirmPanel);

  confirmSubmit.addEventListener("click", async () => {
    const payload = {
      timestamp: new Date().toISOString(),
      student_number: studentNumberInput.value.trim(),
      student_name: studentNameInput.value.trim(),
      motivation: studentMotivationInput.value.trim(),
      usage_improvement: studentUsageImprovementInput.value.trim(),
      code: editor.getValue(),
      version: ACTIVITY_VERSION,
    };

    confirmSubmit.disabled = true;
    confirmCancel.disabled = true;
    confirmSubmit.textContent = "제출 중…";

    try {
      const response = await fetch(GAS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data && data.success) {
        showSubmitResult(true, payload, data.message || "제출이 완료되었습니다.");
      } else {
        showSubmitResult(false, payload, (data && data.message) || "제출에 실패했습니다.");
      }
    } catch {
      showSubmitResult(false, payload, "인터넷 연결을 확인한 뒤 다시 제출하세요.");
    } finally {
      confirmSubmit.disabled = false;
      confirmCancel.disabled = false;
      confirmSubmit.textContent = "제출";
    }
  });

  function showSubmitResult(success, payload, message) {
    confirmPanel.hidden = true;
    submitResult.hidden = false;
    submitResult.className = `submit-result ${success ? "success" : "failure"}`;
    if (success) {
      const time = new Date(payload.timestamp).toLocaleString("ko-KR");
      submitResult.innerHTML = `✅ 제출이 완료되었습니다.<br>학번: ${escapeHtml(payload.student_number)}<br>이름: ${escapeHtml(payload.student_name)}<br>제출 시각: ${escapeHtml(time)}`;
    } else {
      submitResult.innerHTML = `❌ 제출에 실패했습니다.<br>${escapeHtml(message)}`;
    }
    submitResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
    openConfirmButton.focus();
  }

  refreshSubmitAvailability();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
