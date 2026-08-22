import { PUZZLE_START, PUZZLE_GOAL, runHillClimb } from "./game-core.js";

const $ = (selector) => document.querySelector(selector);
const el = {
  stageLabel: $("#stage-label"),
  progressBar: $("#progress-bar"),
  stepBadge: $("#step-badge"),
  stepForm: $("#step-form"),
  candidateCards: $("#candidate-cards"),
  checkStep: $("#check-step"),
  nextStep: $("#next-step"),
  stepFeedback: $("#step-feedback"),
  recordBody: $("#record-body"),
  traceView: $("#trace-view"),
  resultsView: $("#results-view"),
  resultsSummary: $("#results-summary"),
  restartButton: $("#restart-button"),
  projectorToggle: $("#projector-toggle"),
  startPreview: $("#start-preview"),
  goalPreview: $("#goal-preview"),
};

const trace = runHillClimb();
const steps = trace.steps;

let currentStepIndex = 0;
let checked = false;

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

function renderCandidates(step) {
  el.candidateCards.innerHTML = "";
  step.candidates.forEach((candidate, index) => {
    const card = document.createElement("div");
    card.className = "worksheet-candidate";
    card.dataset.key = candidate.key;

    const label = document.createElement("p");
    label.className = "worksheet-candidate-label";
    label.textContent = `후보 ${index + 1} · 빈칸 ${candidate.dirLabel}`;
    card.appendChild(label);
    card.appendChild(buildBoard(candidate.state));

    const scoreRow = document.createElement("label");
    scoreRow.className = "worksheet-score-row";
    scoreRow.textContent = "평가 함수값 ";
    const scoreInput = document.createElement("input");
    scoreInput.type = "number";
    scoreInput.min = "0";
    scoreInput.max = "8";
    scoreInput.required = true;
    scoreInput.name = `score-${candidate.key}`;
    scoreInput.dataset.role = "score-input";
    scoreRow.appendChild(scoreInput);
    card.appendChild(scoreRow);

    const pickRow = document.createElement("label");
    pickRow.className = "worksheet-pick-row";
    const pickInput = document.createElement("input");
    pickInput.type = "radio";
    pickInput.name = "next-state";
    pickInput.value = candidate.key;
    pickInput.required = true;
    pickRow.appendChild(pickInput);
    pickRow.append(" 다음 상태로 선택");
    card.appendChild(pickRow);

    el.candidateCards.appendChild(card);
  });
}

function appendRecordRow(step) {
  if (el.recordBody.querySelector(".empty-row")) el.recordBody.innerHTML = "";
  const row = document.createElement("tr");
  const th = document.createElement("th");
  th.scope = "row";
  th.textContent = String(step.index + 1);
  const stateCell = document.createElement("td");
  const bestCandidate = step.candidates.find((c) => c.key === step.bestKey);
  stateCell.appendChild(buildBoard(bestCandidate.state, { size: "small" }));
  const dirCell = document.createElement("td");
  dirCell.textContent = `빈칸 ${step.bestDirLabel}`;
  const scoreCell = document.createElement("td");
  scoreCell.textContent = String(step.bestScore);
  row.append(th, stateCell, dirCell, scoreCell);
  el.recordBody.appendChild(row);
}

function updateStageLabel(displayIndex) {
  el.stageLabel.textContent = `단계 ${displayIndex} / ${steps.length} · 언덕 오르기`;
  el.progressBar.style.width = `${Math.round((displayIndex / steps.length) * 100)}%`;
  el.stepBadge.textContent = `단계 ${displayIndex}`;
}

function showStep(index) {
  currentStepIndex = index;
  checked = false;
  const step = steps[index];
  updateStageLabel(index + 1);
  renderCandidates(step);
  el.stepFeedback.hidden = true;
  el.stepFeedback.className = "step-feedback";
  el.nextStep.hidden = true;
  el.checkStep.disabled = false;
  [...el.candidateCards.querySelectorAll("input")].forEach((input) => { input.disabled = false; });
}

el.stepForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (checked) return;
  const step = steps[currentStepIndex];
  const scoreInputs = [...el.candidateCards.querySelectorAll('[data-role="score-input"]')];
  const pickedInput = el.candidateCards.querySelector('input[name="next-state"]:checked');
  if (scoreInputs.some((input) => input.value === "") || !pickedInput) {
    el.stepFeedback.hidden = false;
    el.stepFeedback.className = "step-feedback incorrect";
    el.stepFeedback.innerHTML = "<strong>모두 입력해 주세요.</strong><p>후보마다 평가 함수값을 적고, 다음 상태로 선택할 후보를 하나 골라야 확인할 수 있습니다.</p>";
    return;
  }

  checked = true;
  let allScoresCorrect = true;
  scoreInputs.forEach((input) => {
    const card = input.closest(".worksheet-candidate");
    const candidate = step.candidates.find((c) => c.key === card.dataset.key);
    const correct = Number(input.value) === candidate.score;
    if (!correct) allScoresCorrect = false;
    card.classList.add(correct ? "is-correct" : "is-incorrect");
    input.disabled = true;
    const note = document.createElement("p");
    note.className = "worksheet-score-note";
    note.textContent = correct ? "정답" : `정답은 ${candidate.score}입니다.`;
    card.appendChild(note);
  });
  [...el.candidateCards.querySelectorAll('input[name="next-state"]')].forEach((input) => { input.disabled = true; });

  const pickCorrect = pickedInput.value === step.bestKey;
  el.checkStep.disabled = true;

  el.stepFeedback.hidden = false;
  el.stepFeedback.classList.add(allScoresCorrect && pickCorrect ? "correct" : "incorrect");
  if (allScoresCorrect && pickCorrect) {
    el.stepFeedback.innerHTML = `<strong>정답이에요.</strong><p>평가 함수값과 선택 모두 맞았습니다. 다음 상태는 빈칸이 ${step.bestDirLabel}로 이동한 상태(값 ${step.bestScore})입니다.</p>`;
  } else if (!pickCorrect) {
    el.stepFeedback.innerHTML = `<strong>선택을 다시 확인해 볼까요.</strong><p>실제 다음 상태는 빈칸이 <b>${step.bestDirLabel}</b>로 이동한 상태(평가 함수값 ${step.bestScore})입니다. 값이 같으면 위→왼쪽→오른쪽→아래 순으로 우선한다는 점도 기억하세요.</p>`;
  } else {
    el.stepFeedback.innerHTML = `<strong>선택은 맞았지만 평가 함수값을 다시 확인하세요.</strong><p>각 후보 카드에 정답을 표시해 두었습니다.</p>`;
  }

  appendRecordRow(step);
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
  el.resultsSummary.textContent = `총 ${steps.length}단계 만에 목표 상태에 도착했습니다. 매 단계 직전 상태로만 돌아가지 않고, 평가 함수값이 가장 큰 후보를 골라 이동했습니다.`;
  el.resultsView.querySelector("h2").focus();
}

el.restartButton.addEventListener("click", () => {
  el.resultsView.hidden = true;
  el.traceView.hidden = false;
  el.recordBody.innerHTML = '<tr class="empty-row"><td colspan="4">아직 확정된 상태가 없습니다.</td></tr>';
  showStep(0);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.traceView.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
});

el.projectorToggle.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("projector-mode");
  el.projectorToggle.setAttribute("aria-pressed", String(enabled));
});

el.startPreview.appendChild(buildBoard(PUZZLE_START, { size: "medium" }));
el.goalPreview.appendChild(buildBoard(PUZZLE_GOAL, { size: "medium" }));
showStep(0);
