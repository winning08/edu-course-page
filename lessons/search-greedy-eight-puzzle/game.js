import {
  PUZZLE_START, PUZZLE_GOAL, parsePuzzleKey, runPuzzlePriorityTrace, runPuzzleBfsCount, checkStepAnswer,
} from "./game-core.js";

const $ = (selector) => document.querySelector(selector);
const el = {
  predictButtons: $("#predict-buttons-1"),
  predictResult: $("#predict-result"),
  startButton: $("#start-greedy-button"),
  predictView: $("#predict-view"),
  experiment: $("#experiment"),
  stageLabel: $("#stage-label"),
  progressBar: $("#progress-bar"),
  stepBadge: $("#step-badge"),
  candidatePrompt: $("#candidate-prompt"),
  candidateCards: $("#candidate-cards"),
  nextStep: $("#next-step"),
  stepFeedback: $("#step-feedback"),
  recordBody: $("#record-body"),
  traceView: $("#trace-view"),
  resultsView: $("#results-view"),
  resultsSummary: $("#results-summary"),
  bfsOpenedCell: $("#bfs-opened-cell"),
  greedyOpenedCell: $("#greedy-opened-cell"),
  restartButton: $("#restart-button"),
  projectorToggle: $("#projector-toggle"),
};

const bfsResult = runPuzzleBfsCount();
const greedyResult = runPuzzlePriorityTrace("greedy");
const steps = greedyResult.steps.slice(1); // 0번 단계(초기 상태만 있는 단계)는 고를 후보가 없어 건너뛴다.
const orderIndex = new Map(greedyResult.order.map((key, index) => [key, index + 1]));

let currentStepIndex = 0;
let answered = false;
let predictedFar = null;

function describe(state) {
  return [state.slice(0, 3), state.slice(3, 6), state.slice(6, 9)].map((row) => row.map((n) => n || "빈칸").join(" ")).join(", ");
}

function buildBoard(state, { size = "small" } = {}) {
  const wrap = document.createElement("div");
  wrap.className = `puzzle-grid puzzle-grid--${size}`;
  wrap.setAttribute("role", "img");
  wrap.setAttribute("aria-label", describe(state));
  state.forEach((number) => {
    const tile = document.createElement("span");
    tile.className = `puzzle-tile${number === 0 ? " is-blank" : ""}`;
    tile.textContent = number || "";
    wrap.appendChild(tile);
  });
  return wrap;
}

function renderCandidateCards(candidates) {
  el.candidateCards.innerHTML = "";
  candidates.forEach((candidate, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "priority-card";
    button.dataset.key = candidate.key;
    button.setAttribute("aria-pressed", "false");
    const label = document.createElement("span");
    label.className = "priority-card-label";
    label.textContent = `후보 ${index + 1}${candidate.dirLabel ? ` · 빈칸 ${candidate.dirLabel}` : ""}`;
    button.appendChild(label);
    button.appendChild(buildBoard(candidate.state));
    const metric = document.createElement("span");
    metric.className = "priority-card-metric";
    metric.innerHTML = `h <strong>${candidate.h}</strong>`;
    button.appendChild(metric);
    el.candidateCards.appendChild(button);
  });
}

function markCandidateResult(correctKey) {
  el.candidateCards.querySelectorAll(".priority-card").forEach((button) => {
    button.disabled = true;
    if (button.dataset.key === correctKey) button.classList.add("is-correct");
    else if (button.getAttribute("aria-pressed") === "true") button.classList.add("is-incorrect");
  });
}

function appendRecordRow(step) {
  if (el.recordBody.querySelector(".empty-row")) el.recordBody.innerHTML = "";
  const row = document.createElement("tr");
  const parentInfo = greedyResult.parent.get(step.expandedKey);
  const parentOrder = parentInfo ? orderIndex.get(parentInfo.fromKey) : null;
  const th = document.createElement("th");
  th.scope = "row";
  th.textContent = String(orderIndex.get(step.expandedKey));
  const boardCell = document.createElement("td");
  boardCell.appendChild(buildBoard(step.state, { size: "small" }));
  const parentCell = document.createElement("td");
  parentCell.textContent = parentOrder ? `${parentOrder}번째 상태` : "초기 상태";
  const hCell = document.createElement("td");
  hCell.textContent = String(step.h);
  row.append(th, boardCell, parentCell, hCell);
  el.recordBody.appendChild(row);
}

function updateStageLabel(displayIndex) {
  el.stageLabel.textContent = `단계 ${displayIndex} / ${steps.length} · 최상 우선 탐색`;
  el.progressBar.style.width = `${Math.round((displayIndex / steps.length) * 100)}%`;
  el.stepBadge.textContent = `단계 ${displayIndex}`;
}

function showStep(index) {
  currentStepIndex = index;
  answered = false;
  const step = steps[index];
  updateStageLabel(index + 1);
  el.stepFeedback.hidden = true;
  el.stepFeedback.className = "step-feedback";
  el.nextStep.hidden = true;
  el.candidatePrompt.textContent = "h(n)이 가장 작은(목표까지 가장 가까워 보이는) 상태를 하나 고르세요.";
  renderCandidateCards(step.candidates);
}

el.candidateCards.addEventListener("click", (event) => {
  const button = event.target.closest(".priority-card");
  if (!button || button.disabled || answered) return;
  answered = true;
  const step = steps[currentStepIndex];
  const pickedKey = button.dataset.key;
  const outcome = checkStepAnswer(step, pickedKey);
  button.setAttribute("aria-pressed", "true");
  markCandidateResult(step.expandedKey);
  appendRecordRow(step);

  el.stepFeedback.hidden = false;
  el.stepFeedback.classList.add(outcome.correct ? "correct" : "incorrect");
  if (outcome.correct) {
    el.stepFeedback.innerHTML = `<strong>정답이에요.</strong><p>이 상태는 h=${step.h}로 후보 중 가장 작았습니다. g(n)은 아예 보지 않고 h(n)만 비교합니다.</p>`;
  } else {
    el.stepFeedback.innerHTML = `<strong>다시 확인해 볼까요.</strong><p>실제로 다음에 열린 상태는 h=${step.h}인 상태입니다. 후보들의 h 값을 다시 비교해 보세요.</p>`;
  }

  el.nextStep.hidden = false;
  el.nextStep.textContent = currentStepIndex + 1 >= steps.length ? "결과 보기 →" : "다음 단계 →";
  el.nextStep.focus();
});

el.nextStep.addEventListener("click", () => {
  const nextIndex = currentStepIndex + 1;
  if (nextIndex >= steps.length) {
    finishTrace();
    return;
  }
  showStep(nextIndex);
});

function finishTrace() {
  el.traceView.hidden = true;
  el.resultsView.hidden = false;
  renderResults();
  el.resultsView.querySelector("h2").focus();
}

function renderResults() {
  const guessNote = predictedFar === true
    ? "처음 예상대로 최상 우선 탐색이 훨씬 적게 열어봤습니다."
    : predictedFar === false
      ? "처음 예상과 달리, 최상 우선 탐색은 너비 우선 탐색보다 훨씬 적은 상태만 열어봤습니다."
      : "";
  el.resultsSummary.textContent = `최상 우선 탐색은 이 퍼즐에서 ${greedyResult.opened}개 상태만 열어보고 목표에 도착했습니다(너비 우선 탐색은 ${bfsResult.opened}개). 이동 횟수는 ${greedyResult.pathLength}번으로, 이번에는 너비 우선 탐색이 찾는 최소 이동과도 같았습니다. ${guessNote}`;
  el.bfsOpenedCell.textContent = `${bfsResult.opened}개`;
  el.greedyOpenedCell.textContent = `${greedyResult.opened}개`;
}

el.predictButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-answer]");
  if (!button) return;
  predictedFar = button.dataset.answer === "far";
  [...el.predictButtons.children].forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
  el.predictResult.hidden = false;
  el.predictResult.className = "step-feedback";
  el.predictResult.innerHTML = "<p>좋아요, 이제 최상 우선 탐색을 한 단계씩 직접 진행하면서 실제로 몇 개나 열어보는지 확인해 봅시다.</p>";
  el.startButton.hidden = false;
  el.startButton.focus();
});

el.startButton.addEventListener("click", () => {
  el.predictView.hidden = true;
  el.experiment.hidden = false;
  showStep(0);
  el.experiment.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
});

el.restartButton.addEventListener("click", () => {
  el.resultsView.hidden = true;
  el.traceView.hidden = false;
  el.recordBody.innerHTML = '<tr class="empty-row"><td colspan="4">아직 확정된 상태가 없습니다.</td></tr>';
  showStep(0);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.experiment.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
});

el.projectorToggle.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("projector-mode");
  el.projectorToggle.setAttribute("aria-pressed", String(enabled));
});

// 초기·목표 상태 미리보기(안내 영역)
const startPreview = $("#start-preview");
const goalPreview = $("#goal-preview");
if (startPreview) { startPreview.innerHTML = ""; startPreview.appendChild(buildBoard(parsePuzzleKey(PUZZLE_START.join("")), { size: "medium" })); }
if (goalPreview) { goalPreview.innerHTML = ""; goalPreview.appendChild(buildBoard(parsePuzzleKey(PUZZLE_GOAL.join("")), { size: "medium" })); }
