const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxGsJyw_w11KylS-VkgKpmN9xTtrQ--zlwAJD3wNE2itdUogNCAYiK8y44Jh8zpYsI3/exec";
const form = document.querySelector("#ethics-form");
const button = document.querySelector("#submit-button");
const errorBox = document.querySelector("#form-error");
const successBox = document.querySelector("#submit-success");
const summary = document.querySelector("#submit-summary");

function addSummary(label, value) {
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = value;
  summary.append(term, description);
}

function showError(message, field) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  field?.focus();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  const data = Object.fromEntries(new FormData(form));
  const required = [
    "student_number",
    "student_name",
    "result_saved",
    "result_sacrificed",
    "result_pattern",
    "hard_scenario",
    "choice",
    "criterion",
    "reason",
    "responsibility",
    "reflection",
  ];
  const missing = required.find((key) => !String(data[key] || "").trim());
  if (missing) {
    showError("모든 문항에 답한 뒤 제출하세요.", form.elements[missing]);
    return;
  }
  if (!/^\d{5}$/.test(String(data.student_number).trim())) {
    showError(
      "학번을 5자리 숫자로 입력하세요. 예: 10401",
      form.elements.student_number,
    );
    return;
  }
  if (!form.elements.completed.checked) {
    showError(
      "모럴머신 활동을 마쳤는지 확인해 주세요.",
      form.elements.completed,
    );
    return;
  }

  const payload = {
    student_number: String(data.student_number).trim(),
    student_name: String(data.student_name).trim(),
    question: `[모럴머신 결과] 가장 많이 보호한 대상: ${String(data.result_saved).trim()}\n가장 많이 희생된 대상: ${String(data.result_sacrificed).trim()}\n판단 경향: ${String(data.result_pattern).trim()}\n\n[생각 정리] 가장 고민된 상황: ${String(data.hard_scenario).trim()}\n나의 선택: ${String(data.choice).trim()}`,
    reason: `중요 기준: ${String(data.criterion).trim()}\n선택 이유: ${String(data.reason).trim()}`,
    followup: `[모럴머신] 책임 주체: ${String(data.responsibility).trim()}`,
    followup_reason: String(data.reflection).trim(),
  };

  button.disabled = true;
  button.textContent = "제출 중…";
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!result.success)
      throw new Error(result.message || "제출하지 못했습니다.");
    form.hidden = true;
    summary.replaceChildren();
    addSummary("가장 많이 보호한 대상", String(data.result_saved).trim());
    addSummary("가장 많이 희생된 대상", String(data.result_sacrificed).trim());
    addSummary("나의 판단 경향", String(data.result_pattern).trim());
    addSummary("가장 고민된 상황", String(data.hard_scenario).trim());
    addSummary("나의 선택", String(data.choice).trim());
    addSummary("중요 기준", String(data.criterion).trim());
    addSummary("책임 주체", String(data.responsibility).trim());
    successBox.hidden = false;
    successBox.focus();
  } catch (submitError) {
    showError(
      submitError.message || "인터넷 연결을 확인한 뒤 다시 제출하세요.",
    );
  } finally {
    button.disabled = false;
    button.textContent = "활동지 제출하기";
  }
});
