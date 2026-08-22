import { runBfsLayers, runPriorityTrace, pathCostUnder } from "../shared/search-lab.js";
import { renderMap, renderCandidateCards, markCandidateResult } from "../shared/search-ui.js";
import { buildUcsSteps, checkStepAnswer, summarize } from "./game-core.js";

const $ = (selector) => document.querySelector(selector);
const el = {
  predictInput: $("#predict-input"),
  predictSubmit: $("#predict-submit"),
  predictResult: $("#predict-result"),
  startUcsButton: $("#start-ucs-button"),
  predictView: $("#predict-view"),
  experiment: $("#experiment"),
  stageLabel: $("#stage-label"),
  progressBar: $("#progress-bar"),
  stepBadge: $("#step-badge"),
  mapGrid: $("#map-grid"),
  candidatePrompt: $("#candidate-prompt"),
  candidateCards: $("#candidate-cards"),
  nextStep: $("#next-step"),
  stepFeedback: $("#step-feedback"),
  fastForward: $("#fast-forward"),
  fastForwardButton: $("#fast-forward-button"),
  recordBody: $("#record-body"),
  traceView: $("#trace-view"),
  resultsView: $("#results-view"),
  resultsSummary: $("#results-summary"),
  costCompare: $("#cost-compare"),
  ucsReveal: $("#ucs-reveal"),
  predictButtons2: $("#predict-buttons-2"),
  restartButton: $("#restart-button"),
  projectorToggle: $("#projector-toggle"),
};

const bfsResult = runBfsLayers();
const ucsResult = runPriorityTrace({ useHeuristic: false });
const steps = buildUcsSteps(ucsResult);
const orderIndex = new Map(ucsResult.order.map((id, index) => [id, index + 1]));

let currentStepIndex = 0;
let answered = false;

function renderStepMap(step) {
  const closedUpTo = ucsResult.order.slice(0, step.index); // 이 단계 이전까지 확정된 칸
  const statesById = {};
  for (const id of closedUpTo) statesById[id] = "visited";
  for (const candidate of step.candidates) {
    if (!statesById[candidate.cellId]) statesById[candidate.cellId] = "frontier";
  }
  renderMap(el.mapGrid, { statesById, profile: "snow" });
}

function appendRecordRow(cellId, g, parentId) {
  if (el.recordBody.querySelector(".empty-row")) el.recordBody.innerHTML = "";
  const row = document.createElement("tr");
  row.innerHTML = `<th scope="row">${orderIndex.get(cellId)}</th><td>${cellId}</td><td>${parentId ?? "—(시작)"}</td><td>${g}</td>`;
  el.recordBody.appendChild(row);
}

function updateStageLabel(step) {
  el.stageLabel.textContent = `단계 ${step.displayIndex} / ${steps.length} · 균일 비용 탐색(UCS)`;
  el.progressBar.style.width = `${Math.round((step.displayIndex / steps.length) * 100)}%`;
  el.stepBadge.textContent = `단계 ${step.displayIndex}`;
}

function showStep(index) {
  currentStepIndex = index;
  answered = false;
  const step = steps[index];
  updateStageLabel(step);
  renderStepMap(step);
  el.stepFeedback.hidden = true;
  el.stepFeedback.className = "step-feedback";
  el.nextStep.hidden = true;

  if (!step.interactive) {
    el.candidateCards.innerHTML = "";
    el.candidatePrompt.textContent = "이제부터는 같은 규칙(g(n) 최소)이 반복됩니다.";
    el.fastForward.hidden = false;
    return;
  }

  el.fastForward.hidden = true;
  el.candidatePrompt.textContent = "g(n)이 가장 작은 후보를 하나 고르세요.";
  renderCandidateCards(el.candidateCards, step.candidates, { mode: "single", metrics: [{ key: "g", label: "g(n)" }] });
}

el.candidateCards.addEventListener("click", (event) => {
  const button = event.target.closest(".candidate-card");
  if (!button || button.disabled || answered) return;
  answered = true;
  const step = steps[currentStepIndex];
  const outcome = checkStepAnswer(step, button.dataset.cellId);
  button.setAttribute("aria-pressed", "true");
  markCandidateResult(el.candidateCards, [step.expanded]);
  appendRecordRow(step.expanded, step.g, ucsResult.parent.get(step.expanded));

  el.stepFeedback.hidden = false;
  el.stepFeedback.classList.add(outcome.correct ? "correct" : "incorrect");
  const winnerCard = step.candidates[0];
  el.stepFeedback.innerHTML = outcome.correct
    ? `<strong>정답이에요.</strong><p>${step.expanded}은(는) 지금까지 비용 g=${step.g}로 오픈 리스트에서 가장 작았습니다.</p>`
    : `<strong>다시 확인해 볼까요.</strong><p>실제로 다음에 열린 칸은 <b>${step.expanded}</b>(g=${winnerCard.g})입니다. 오픈 리스트에서 g(n)이 더 작은 후보가 있었어요.</p>`;

  el.nextStep.hidden = false;
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

el.fastForwardButton.addEventListener("click", () => {
  for (let i = currentStepIndex; i < steps.length; i += 1) {
    const step = steps[i];
    appendRecordRow(step.expanded, step.g, ucsResult.parent.get(step.expanded));
  }
  finishTrace();
});

function finishTrace() {
  el.traceView.hidden = true;
  el.resultsView.hidden = false;
  renderResults();
  el.resultsView.querySelector("h2").focus();
}

function renderResults() {
  const summary = summarize({ bfsResult, ucsResult });
  el.resultsSummary.textContent = `UCS는 총 ${summary.ucsOpened}칸을 확정해 매점에 도착했고, 그 경로의 실제 이동 비용은 ${summary.ucsPathCost}입니다. 활동01의 BFS 경로를 그대로 따라갔다면 비용은 ${summary.bfsCostUnderSnow}이 됩니다.`;
  el.costCompare.innerHTML = `
    <div class="stat-block"><span>BFS 경로 비용(눈 온 뒤)</span><strong>${summary.bfsCostUnderSnow}</strong></div>
    <div class="stat-block"><span>UCS 경로 비용</span><strong>${summary.ucsPathCost}</strong></div>
    <div class="stat-block"><span>UCS가 아낀 비용</span><strong>${summary.cheaper}</strong></div>
  `;
}

el.predictSubmit.addEventListener("click", () => {
  const guess = Number(el.predictInput.value);
  const actual = pathCostUnder(bfsResult.path, "snow");
  el.predictResult.hidden = false;
  el.predictResult.className = "step-feedback";
  if (Number.isFinite(guess) && guess > 0) {
    const diff = Math.abs(guess - actual);
    el.predictResult.classList.add(diff === 0 ? "correct" : "incorrect");
    el.predictResult.innerHTML = `<strong>실제 비용은 ${actual}이었어요.</strong><p>내 예상은 ${guess}, 차이는 ${diff}입니다. 정확히 몰라도 괜찮아요 — 이제부터 UCS가 실제로 얼마가 드는지 한 걸음씩 확인합니다.</p>`;
  } else {
    el.predictResult.innerHTML = `<strong>실제 비용은 ${actual}이었어요.</strong><p>숫자를 입력하지 않아도 괜찮아요 — 이제부터 UCS가 실제로 얼마가 드는지 한 걸음씩 확인합니다.</p>`;
  }
  el.startUcsButton.hidden = false;
  el.startUcsButton.focus();
});

el.startUcsButton.addEventListener("click", () => {
  el.predictView.hidden = true;
  el.experiment.hidden = false;
  showStep(0);
  el.experiment.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
});

el.predictButtons2.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-answer]");
  if (!button) return;
  [...el.predictButtons2.children].forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
  el.ucsReveal.hidden = false;
});

el.restartButton.addEventListener("click", () => {
  el.resultsView.hidden = true;
  el.traceView.hidden = false;
  el.recordBody.innerHTML = '<tr class="empty-row"><td colspan="4">아직 확정된 칸이 없습니다.</td></tr>';
  showStep(0);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.experiment.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
});

el.projectorToggle.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("projector-mode");
  el.projectorToggle.setAttribute("aria-pressed", String(enabled));
});
