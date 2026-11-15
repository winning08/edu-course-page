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
    "preference_count",
    "preference_passenger",
    "preference_law",
    "preference_inaction",
    "preference_gender",
    "preference_species",
    "preference_age",
    "preference_fitness",
    "preference_social",
    "criterion_1",
    "criterion_reason_1",
    "criterion_2",
    "criterion_reason_2",
    "criterion_3",
    "criterion_reason_3",
    "criterion_least",
    "criterion_least_reason",
    "hard_scenario",
    "dilemma_reason",
    "choice",
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
  const rankedCriteria = [data.criterion_1, data.criterion_2, data.criterion_3];
  if (new Set(rankedCriteria).size !== rankedCriteria.length) {
    showError("1·2·3순위는 서로 다른 기준으로 선택하세요.", form.elements.criterion_1);
    return;
  }

  const preferences = [
    ["희생자 숫자(1 중요하지 않음↔5 매우 중요함)", data.preference_count],
    ["승객 보호(1 중요하지 않음↔5 매우 중요함)", data.preference_passenger],
    ["법규 준수(1 중요하지 않음↔5 매우 중요함)", data.preference_law],
    ["개입 회피(1 중요하지 않음↔5 매우 중요함)", data.preference_inaction],
    ["성별(1 남성↔5 여성)", data.preference_gender],
    ["종(1 인간↔5 애완동물)", data.preference_species],
    ["연령(1 젊은이↔5 노인)", data.preference_age],
    ["체력(1 건강인↔5 비만인)", data.preference_fitness],
    ["사회적 가치관(1 높음↔5 낮음)", data.preference_social],
  ].map(([label, value]) => `${label}: ${value}`).join(" / ");

  const payload = {
    student_number: String(data.student_number).trim(),
    student_name: String(data.student_name).trim(),
    question: `[모럴머신 결과] 가장 많이 살린 사람: ${String(data.result_saved).trim()}\n가장 많이 죽인 사람: ${String(data.result_sacrificed).trim()}\n\n[윤리적 판단 선호도 1~5] ${preferences}`,
    reason: `[중요 기준] 1순위 ${String(data.criterion_1).trim()}: ${String(data.criterion_reason_1).trim()}\n2순위 ${String(data.criterion_2).trim()}: ${String(data.criterion_reason_2).trim()}\n3순위 ${String(data.criterion_3).trim()}: ${String(data.criterion_reason_3).trim()}\n\n[가장 적게 영향을 미친 기준] ${String(data.criterion_least).trim()}: ${String(data.criterion_least_reason).trim()}`,
    followup: `[선택하기 어려웠던 상황의 두 선택지] ${String(data.hard_scenario).trim()}\n[두 선택지 사이에서 고민했던 이유] ${String(data.dilemma_reason).trim()}`,
    followup_reason: `[선택한 결과] ${String(data.choice).trim()}`,
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
    addSummary("가장 많이 살린 사람", String(data.result_saved).trim());
    addSummary("가장 많이 죽인 사람", String(data.result_sacrificed).trim());
    addSummary("윤리적 판단 선호도", preferences);
    addSummary("중요 기준 1순위", String(data.criterion_1).trim());
    addSummary("중요 기준 2순위", String(data.criterion_2).trim());
    addSummary("중요 기준 3순위", String(data.criterion_3).trim());
    addSummary("가장 적게 영향을 미친 기준", String(data.criterion_least).trim());
    addSummary("가장 고민된 상황", String(data.hard_scenario).trim());
    addSummary("고민했던 이유", String(data.dilemma_reason).trim());
    addSummary("선택한 결과", String(data.choice).trim());
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
