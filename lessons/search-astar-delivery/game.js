import { runBfsLayers, runPriorityTrace } from "../shared/search-lab.js";
import { renderMap, renderCandidateCards, markCandidateResult } from "../shared/search-ui.js";
import { buildAstarSteps, checkStepAnswer, getTrapInfo, isTrapStep, buildFinalComparison } from "./game-core.js";

const $ = (selector) => document.querySelector(selector);
const el = {
  predictButtons1: $("#predict-buttons-1"),
  predictResult: $("#predict-result"),
  startAstarButton: $("#start-astar-button"),
  predictView: $("#predict-view"),
  experiment: $("#experiment"),
  stageLabel: $("#stage-label"),
  progressBar: $("#progress-bar"),
  stepBadge: $("#step-badge"),
  trapWarning: $("#trap-warning"),
  mapGrid: $("#map-grid"),
  candidatePrompt: $("#candidate-prompt"),
  candidateCards: $("#candidate-cards"),
  nextStep: $("#next-step"),
  stepFeedback: $("#step-feedback"),
  recordBody: $("#record-body"),
  traceView: $("#trace-view"),
  resultsView: $("#results-view"),
  resultsSummary: $("#results-summary"),
  bfsOpenedCell: $("#bfs-opened-cell"),
  ucsOpenedCell: $("#ucs-opened-cell"),
  astarOpenedCell: $("#astar-opened-cell"),
  restartButton: $("#restart-button"),
  projectorToggle: $("#projector-toggle"),
};

const bfsResult = runBfsLayers();
const ucsResult = runPriorityTrace({ useHeuristic: false });
const astarResult = runPriorityTrace({ useHeuristic: true });
const steps = buildAstarSteps(astarResult);
const trapInfo = getTrapInfo(astarResult);
const orderIndex = new Map(astarResult.order.map((id, index) => [id, index + 1]));

let currentStepIndex = 0;
let answered = false;
let predictedFewer = null;

function renderStepMap(step) {
  const closedUpTo = astarResult.order.slice(0, step.index);
  const statesById = {};
  for (const id of closedUpTo) statesById[id] = "visited";
  for (const candidate of step.candidates) {
    if (!statesById[candidate.cellId]) statesById[candidate.cellId] = "frontier";
  }
  renderMap(el.mapGrid, { statesById, profile: "snow" });
}

function appendRecordRow(step) {
  if (el.recordBody.querySelector(".empty-row")) el.recordBody.innerHTML = "";
  const row = document.createElement("tr");
  const parentId = astarResult.parent.get(step.expanded) ?? "—(시작)";
  row.innerHTML = `<th scope="row">${orderIndex.get(step.expanded)}</th><td>${step.expanded}</td><td>${parentId}</td><td>${step.g}</td><td>${step.h}</td><td>${step.f}</td>`;
  el.recordBody.appendChild(row);
}

function updateStageLabel(step) {
  el.stageLabel.textContent = `단계 ${step.displayIndex} / ${steps.length} · A* 탐색`;
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
  el.trapWarning.hidden = !isTrapStep(step, trapInfo);
  el.candidatePrompt.textContent = "f(n)이 가장 작은 후보를 하나 고르세요.";
  renderCandidateCards(el.candidateCards, step.candidates, {
    mode: "single",
    metrics: [{ key: "g", label: "g" }, { key: "h", label: "h" }, { key: "f", label: "f" }],
  });
}

el.candidateCards.addEventListener("click", (event) => {
  const button = event.target.closest(".candidate-card");
  if (!button || button.disabled || answered) return;
  answered = true;
  const step = steps[currentStepIndex];
  const pickedId = button.dataset.cellId;
  const outcome = checkStepAnswer(step, pickedId);
  button.setAttribute("aria-pressed", "true");
  markCandidateResult(el.candidateCards, [step.expanded]);
  appendRecordRow(step);

  el.stepFeedback.hidden = false;
  el.stepFeedback.classList.add(outcome.correct ? "correct" : "incorrect");
  const trapPicked = isTrapStep(step, trapInfo) && trapInfo.trap.cellId === pickedId;
  if (outcome.correct) {
    el.stepFeedback.innerHTML = `<strong>정답이에요.</strong><p>${step.expanded}은(는) f=g+h=${step.g}+${step.h}=${step.f}로 가장 작았습니다.</p>`;
  } else if (trapPicked) {
    el.stepFeedback.innerHTML = `<strong>그렇게 생각하기 쉬워요.</strong><p>${pickedId}는 h(목표까지 어림짐작)만 보면 가까워 보이지만, 그 칸까지 오는 데 이미 비용(g)이 많이 들어서 f로 따지면 더 비쌉니다. 실제로 열린 칸은 <b>${step.expanded}</b>(f=${step.f})입니다. g 없이 h만 보면 이렇게 속기 쉬워요.</p>`;
  } else {
    el.stepFeedback.innerHTML = `<strong>다시 확인해 볼까요.</strong><p>실제로 다음에 열린 칸은 <b>${step.expanded}</b>(f=${step.f})입니다. 후보들의 f 값을 다시 비교해 보세요.</p>`;
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
  const comparison = buildFinalComparison({ bfsResult, ucsResult, astarResult });
  const guessNote = predictedFewer === true
    ? "처음 예상대로 A*가 훨씬 적게 열어봤습니다."
    : predictedFewer === false
      ? "처음 예상과 달리, A*는 UCS보다 훨씬 적은 칸만 열어봤습니다."
      : "";
  el.resultsSummary.textContent = `A*는 이 지도에서 ${comparison.astar.opened}칸만 열어보고 매점에 도착했습니다(UCS는 ${comparison.ucs.opened}칸). 최종 경로 비용은 ${comparison.astar.pathCost}로 UCS와 같습니다 — 같은 최적 경로를 더 적게 검토해서 찾은 것입니다. ${guessNote}`;
  el.bfsOpenedCell.textContent = `${comparison.bfs.opened}칸`;
  el.ucsOpenedCell.textContent = `${comparison.ucs.opened}칸`;
  el.astarOpenedCell.textContent = `${comparison.astar.opened}칸`;
}

el.predictButtons1.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-answer]");
  if (!button) return;
  predictedFewer = button.dataset.answer === "fewer";
  [...el.predictButtons1.children].forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
  el.predictResult.hidden = false;
  el.predictResult.className = "step-feedback";
  el.predictResult.innerHTML = "<p>좋아요, 이제 A*를 한 단계씩 직접 진행하면서 실제로 몇 칸을 열어보는지 확인해 봅시다.</p>";
  el.startAstarButton.hidden = false;
  el.startAstarButton.focus();
});

el.startAstarButton.addEventListener("click", () => {
  el.predictView.hidden = true;
  el.experiment.hidden = false;
  showStep(0);
  el.experiment.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
});

el.restartButton.addEventListener("click", () => {
  el.resultsView.hidden = true;
  el.traceView.hidden = false;
  el.recordBody.innerHTML = '<tr class="empty-row"><td colspan="6">아직 확정된 칸이 없습니다.</td></tr>';
  showStep(0);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.experiment.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
});

el.projectorToggle.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("projector-mode");
  el.projectorToggle.setAttribute("aria-pressed", String(enabled));
});
