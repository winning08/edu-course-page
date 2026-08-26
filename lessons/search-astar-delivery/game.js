import { GOAL_STATE, NEW_GOAL_STATE, TEXTBOOK_START, NEW_START, solveAstar, checkChoice } from "./game-core.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const configs = {
  textbook: { start: TEXTBOOK_START, goal: GOAL_STATE, label: "교과서 예시" },
  new: { start: NEW_START, goal: NEW_GOAL_STATE, label: "새 문제" },
};
const state = {
  textbook: { step: 0, correct: 0, answered: false, calcVerified: false, result: solveAstar(TEXTBOOK_START) },
  new: { step: 0, correct: 0, answered: false, calcVerified: false, result: solveAstar(NEW_START, NEW_GOAL_STATE) },
};

function boardMarkup(board, label = "퍼즐판") {
  return `<div class="puzzle-board" role="img" aria-label="${label}: ${board.map((v) => v || "빈칸").join(", ")}">${board.map((tile) => `<span class="tile${tile === 0 ? " blank" : ""}">${tile || '<i aria-hidden="true">빈칸</i>'}</span>`).join("")}</div>`;
}

function renderReference(kind) {
  const root = $(`[data-reference="${kind}"]`);
  root.innerHTML = `
    <article><span>초기 상태</span>${boardMarkup(configs[kind].start, "초기 상태")}</article>
    <div class="reference-arrow" aria-hidden="true">→</div>
    <article><span>목표 상태</span>${boardMarkup(configs[kind].goal, "목표 상태")}</article>`;
}

function usableSteps(kind) {
  return state[kind].result.steps.slice(1);
}

function practiceCandidatesMarkup(step, activity, currentKey, { givenG = false } = {}) {
  const indexed = step.candidates.map((candidate, index) => ({ candidate, index }));
  const waiting = indexed.filter(({ candidate }) => candidate.parentKey !== currentKey);
  const created = indexed.filter(({ candidate }) => candidate.parentKey === currentKey);
  const renderGroup = (items, type) => {
    if (!items.length) return "";
    const waitingGroup = type === "waiting";
    return `<section class="candidate-group ${type}" aria-labelledby="${type}-candidates-title">
      <div class="candidate-group-heading">
        <span class="origin-badge">${waitingGroup ? "이전 후보" : "새 후보"}</span>
        <div><h4 id="${type}-candidates-title">${waitingGroup ? "이전 단계부터 기다리던 후보" : "현재 상태에서 새로 만든 후보"}</h4><p>${waitingGroup ? "앞 단계에서 선택되지 않아 오픈 리스트에 남아 있었습니다." : "현재 상태의 빈칸을 움직여 이번 단계에 추가했습니다."}</p></div>
      </div>
      <div class="candidate-grid">
        ${items.map(({ candidate, index }) => `<article class="candidate-card candidate-entry" data-key="${candidate.key}">
          <span class="candidate-number">후보 ${index + 1}</span>
          <span class="saved-state-mark ${waitingGroup ? "saved" : "added"}">${waitingGroup ? "✓ 오픈 리스트에 저장됨" : "+ 이번 단계에 추가됨"}</span>
          ${boardMarkup(candidate.board, `후보 ${index + 1}`)}
          ${waitingGroup
            ? `<dl class="saved-metrics" aria-label="후보 ${index + 1}에 저장된 값"><div><dt>g(n)</dt><dd>${candidate.g}</dd></div><div><dt>h(n)</dt><dd>${candidate.h}</dd></div><div><dt>f(n)</dt><dd>${candidate.f}</dd></div></dl>`
            : `<div class="metric-inputs">
                ${givenG ? `<label class="given-metric"><span>g(n)</span><output aria-label="후보 ${index + 1}에 주어진 g(n) 값">${candidate.g}</output></label>` : `<label><span>g(n)</span><input type="number" inputmode="numeric" min="0" max="30" data-candidate-index="${index}" data-metric="g" aria-label="후보 ${index + 1}의 g 값" ${activity.calcVerified ? `value="${candidate.g}" disabled` : ""} required></label>`}
                ${["h", "f"].map((metric) => `<label><span>${metric}(n)</span><input type="number" inputmode="numeric" min="0" max="30" data-candidate-index="${index}" data-metric="${metric}" aria-label="후보 ${index + 1}의 ${metric} 값" ${activity.calcVerified ? `value="${candidate[metric]}" disabled` : ""} required></label>`).join("")}
              </div>`}
          ${activity.calcVerified ? `<button type="button" class="candidate-select" data-key="${candidate.key}" ${activity.answered ? "disabled" : ""}>이 상태 선택</button>` : ""}
        </article>`).join("")}
      </div>
    </section>`;
  };
  return `<form class="candidate-calculation">
    <aside class="open-list-guide"><strong>한 줄에 있는 두 구역 모두 오픈 리스트입니다.</strong> 새 후보의 값을 계산한 뒤, 이전 후보와 새 후보를 합쳐 f(n)이 가장 작은 상태를 선택하세요.</aside>
    <div class="candidate-groups-row" aria-label="이전 후보와 새 후보 전체">
      ${renderGroup(waiting, "waiting")}
      ${renderGroup(created, "created")}
    </div>
    ${activity.calcVerified ? '<p class="calculation-status">새 후보의 값이 모두 맞았습니다. 이전 후보까지 포함하여 f(n)이 가장 작은 상태를 선택하세요.</p>' : `<button type="submit" class="check-candidate-values">${givenG ? "값 확인하기" : "새 후보의 값 확인"}</button>`}
  </form>`;
}

function renderTrace(kind) {
  const root = $(`[data-activity="${kind}"]`);
  const activity = state[kind];
  const steps = usableSteps(kind);
  const step = steps[activity.step];
  const current = activity.result.steps[activity.step].chosen;
  const isLast = activity.step === steps.length - 1;
  if (!step) return;

  root.innerHTML = `
    <div class="trace-heading">
      <div><span>${configs[kind].label}</span><strong>선택 ${activity.step + 1} / ${steps.length}</strong></div>
      <div class="progress" aria-hidden="true"><i style="width:${Math.round(((activity.step + 1) / steps.length) * 100)}%"></i></div>
    </div>
    <div class="current-state">
      <div><span>현재 확인한 상태</span>${boardMarkup(current.board, "현재 확인한 상태")}</div>
      <div class="current-info">
        <p>${current.move === "시작" ? "초기 상태입니다." : `빈칸을 <b>${current.move}</b>로 움직여 도착했습니다.`}</p>
        <dl class="current-metrics" aria-label="현재 상태의 g(n), h(n), f(n) 값">
          <div><dt>g(n)</dt><dd>${current.g}</dd></div>
          <i aria-hidden="true">+</i>
          <div><dt>h(n)</dt><dd>${current.h}</dd></div>
          <i aria-hidden="true">=</i>
          <div class="metric-f"><dt>f(n)</dt><dd>${current.f}</dd></div>
        </dl>
      </div>
    </div>
    <div class="candidate-area">
      <div class="candidate-heading"><h3>${!activity.calcVerified ? (kind === "textbook" ? "모든 새 후보의 g(n), h(n), f(n)을 계산하세요" : "주어진 g(n)을 보고 h(n), f(n)을 계산하세요") : "후보 중 다음에 확인할 상태는?"}</h3><p>${activity.calcVerified ? "f(n)이 가장 작은 후보를 선택하세요." : "값을 모두 맞히면 상태를 선택할 수 있습니다."}</p></div>
      ${practiceCandidatesMarkup(step, activity, current.key, { givenG: kind === "new" })}
    </div>
    <div class="trace-feedback" aria-live="polite" ${activity.answered ? "" : "hidden"}></div>
    <button class="primary-action trace-next" type="button" ${activity.answered ? "" : "hidden"}>${isLast ? (kind === "textbook" ? "새 문제에 도전하기" : "활동 정리하기") : "다음 선택으로"} <span aria-hidden="true">→</span></button>`;

  if (activity.answered) showStoredFeedback(kind);
}

function showStoredFeedback(kind) {
  const root = $(`[data-activity="${kind}"]`);
  const activity = state[kind];
  const step = usableSteps(kind)[activity.step];
  const picked = activity.lastPicked;
  const feedback = $(".trace-feedback", root);
  if (!feedback || !picked) return;
  const correct = picked === step.chosenKey;
  $$(".candidate-card", root).forEach((card) => {
    if (card.dataset.key === step.chosenKey) card.classList.add("correct");
    if (card.dataset.key === picked && !correct) card.classList.add("incorrect");
  });
  feedback.hidden = false;
  feedback.className = `trace-feedback ${correct ? "correct" : "incorrect"}`;
  feedback.innerHTML = correct
    ? `<strong>맞았습니다.</strong> f(n)=${step.chosen.f}로 가장 작은 상태입니다.`
    : `<strong>확인해 봅시다.</strong> 다음 상태는 f(n)=${step.chosen.g}+${step.chosen.h}=${step.chosen.f}인 퍼즐판입니다.`;
}

function chooseCandidate(kind, key) {
  const activity = state[kind];
  if (activity.answered) return;
  const step = usableSteps(kind)[activity.step];
  const outcome = checkChoice(step, key);
  activity.answered = true;
  activity.lastPicked = key;
  if (outcome.correct) activity.correct += 1;
  renderTrace(kind);
  $(".trace-next", $(`[data-activity="${kind}"]`)).focus();
}

function advanceTrace(kind) {
  const activity = state[kind];
  const steps = usableSteps(kind);
  if (activity.step < steps.length - 1) {
    activity.step += 1;
    activity.answered = false;
    activity.calcVerified = false;
    activity.lastPicked = null;
    renderTrace(kind);
    $(`[data-activity="${kind}"]`).scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  } else {
    showView(kind === "textbook" ? "new" : "result");
  }
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function showView(name) {
  $$(".lesson-view").forEach((view) => { view.hidden = view.id !== `${name}-view`; });
  const navButtons = $$(".stage-nav button");
  const names = ["intro", "textbook", "new", "result"];
  const index = names.indexOf(name);
  navButtons.forEach((button, buttonIndex) => {
    if (buttonIndex <= index) button.disabled = false;
    button.toggleAttribute("aria-current", buttonIndex === index);
  });
  if (name === "result") renderResult();
  const heading = $(`#${name}-view h2`);
  heading?.focus();
  window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
}

function renderResult() {
  const textbookTotal = usableSteps("textbook").length;
  const newTotal = usableSteps("new").length;
  $("#score-summary").innerHTML = `
    <article><span>교과서 예시</span><strong>${state.textbook.correct} / ${textbookTotal}</strong><p>목표까지 ${state.textbook.result.cost}번 이동</p></article>
    <article><span>새 문제</span><strong>${state.new.correct} / ${newTotal}</strong><p>목표까지 ${state.new.result.cost}번 이동</p></article>`;
}

function resetAll() {
  for (const kind of Object.keys(state)) Object.assign(state[kind], { step: 0, correct: 0, answered: false, calcVerified: false, lastPicked: null });
  renderTrace("textbook");
  renderTrace("new");
  $("#warmup-form").reset();
  $("#warmup-form").classList.remove("correct", "incorrect");
  $$("#warmup-form input, #warmup-form button").forEach((control) => { control.disabled = false; });
  $("#warmup-feedback").hidden = true;
  const start = $("#start-textbook");
  start.disabled = true;
  start.textContent = "계산 연습 후 시작할 수 있습니다";
  showView("intro");
}

for (const kind of Object.keys(configs)) {
  renderReference(kind);
  renderTrace(kind);
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest(".stage-nav button[data-view]");
  if (nav && !nav.disabled) return showView(nav.dataset.view);
  const next = event.target.closest("[data-next]");
  if (next) return showView(next.dataset.next);
  const candidate = event.target.closest("button.candidate-card, .candidate-select");
  if (candidate) return chooseCandidate(candidate.closest("[data-activity]").dataset.activity, candidate.dataset.key);
  const traceNext = event.target.closest(".trace-next");
  if (traceNext) return advanceTrace(traceNext.closest("[data-activity]").dataset.activity);
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest(".candidate-calculation");
  if (!form) return;
  event.preventDefault();
  const root = form.closest("[data-activity]");
  const kind = root.dataset.activity;
  const activity = state[kind];
  const step = usableSteps(kind)[activity.step];
  let wrongCount = 0;
  $$("input[data-candidate-index]", form).forEach((input) => {
    const candidate = step.candidates[Number(input.dataset.candidateIndex)];
    const correct = Number(input.value) === candidate[input.dataset.metric];
    input.classList.toggle("input-correct", correct);
    input.classList.toggle("input-incorrect", !correct);
    input.setAttribute("aria-invalid", String(!correct));
    if (!correct) wrongCount += 1;
  });
  const feedback = $(".trace-feedback", root);
  feedback.hidden = false;
  if (wrongCount === 0) {
    activity.calcVerified = true;
    renderTrace(kind);
    $(".candidate-select", root)?.focus();
  } else {
    feedback.className = "trace-feedback incorrect";
    feedback.innerHTML = kind === "new"
      ? `<strong>${wrongCount}개의 값을 다시 확인하세요.</strong> h(n)은 이 8-퍼즐에서 제자리가 아닌 숫자 타일 수이며, f(n)은 주어진 g(n)에 h(n)을 더한 값입니다.`
      : `<strong>${wrongCount}개의 값을 다시 확인하세요.</strong> g(n)은 시작부터 이동한 횟수, h(n)은 이 8-퍼즐에서 제자리가 아닌 숫자 타일 수이며, f(n)=g(n)+h(n)입니다.`;
    $("input.input-incorrect", form)?.focus();
  }
});

$("#warmup-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const hInput = $("#warmup-h");
  const fInput = $("#warmup-f");
  const correct = Number(hInput.value) === 4 && Number(fInput.value) === 4;
  const form = event.currentTarget;
  form.classList.remove("correct", "incorrect");
  form.classList.add(correct ? "correct" : "incorrect");
  const feedback = $("#warmup-feedback");
  feedback.hidden = false;
  feedback.className = `trace-feedback ${correct ? "correct" : "incorrect"}`;
  if (correct) {
    feedback.innerHTML = "<strong>맞았습니다.</strong> 이 8-퍼즐에서 제자리가 아닌 숫자 타일은 2, 8, 1, 6의 4개이므로 h(n)=4이고, f(n)=g(n)+h(n)=0+4=4입니다.";
    $$("#warmup-form input, #warmup-form button").forEach((control) => { control.disabled = true; });
    const start = $("#start-textbook");
    start.disabled = false;
    start.innerHTML = '교과서 예시 시작하기 <span aria-hidden="true">→</span>';
    start.focus();
  } else {
    feedback.innerHTML = "<strong>다시 계산해 보세요.</strong> 빈칸은 제외하고 목표 자리와 다른 숫자 타일을 센 뒤, 그 h(n) 값에 주어진 g(n)=0을 더하세요.";
    hInput.focus();
  }
});

$("#restart-button").addEventListener("click", resetAll);

const previewStep = new URLSearchParams(window.location.search).get("preview");
const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
if (isLocalPreview && previewStep === "3") showView("new");
