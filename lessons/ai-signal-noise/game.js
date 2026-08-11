import {
  PHASES, TRAIN_ROUNDS,
  createSession, currentSample, submitPrediction, advancePhase,
  comparisonPairs, submitReview, startTest, submitTestBatch, sessionResults, restartSession,
} from "./game-core.js";
import { buildSpecimenLabel, buildSpecimenSvg } from "../shared/specimen-visual.js";

const $ = (selector) => document.querySelector(selector);
const elements = {
  head: $("#experiment-head"), round: $("#round-label"), progress: $("#progress-bar"),
  accuracyBlock: $("#accuracy-block"), accuracy: $("#accuracy"), sample: $("#sample-id"),
  specimen: $("#specimen-visual"), hint: $("#question-hint"),
  color: $("#feature-color"), texture: $("#feature-texture"), season: $("#feature-season"),
  ripe: $("#predict-ripe"), unripe: $("#predict-unripe"), feedback: $("#feedback"), waiting: $("#feedback-waiting"),
  result: $("#feedback-result"), mark: $("#feedback-mark"), title: $("#feedback-title"), copy: $("#feedback-copy"),
  next: $("#next-button"), checkpoint: $("#checkpoint"),
  question: $("#question-view"), review: $("#review-view"), results: $("#results-view"),
  reviewScoreLine: $("#review-train-score"), reviewTrainCount: $("#review-train-count"),
  reviewSummaryBody: $("#review-summary-body"),
  reviewForm: $("#review-form"), reviewOptions: $("#review-options"), reviewError: $("#review-error"),
  reviewSubmit: $("#review-submit-button"), reviewResult: $("#review-result"),
  reviewResultMark: $("#review-result-mark"), reviewResultTitle: $("#review-result-title"), reviewResultCopy: $("#review-result-copy"),
  startTest: $("#start-test-button"),
  testView: $("#test-view"), testGrid: $("#test-grid"), testError: $("#test-error"), submitTest: $("#submit-test-button"),
  trainScore: $("#train-score"), trainCount: $("#train-count"),
  reviewScoreBlock: $("#review-score"), reviewCount: $("#review-count"),
  testScore: $("#test-score"), testCount: $("#test-count"),
  restart: $("#restart-button"), projector: $("#projector-toggle"),
};

let session = createSession();
let answered = false;

function scrollTop() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
}

function showPhaseView() {
  const isTrain = session.phase === PHASES.TRAIN;
  const isTest = session.phase === PHASES.TEST;
  elements.question.hidden = !isTrain;
  elements.testView.hidden = !isTest;
  elements.review.hidden = session.phase !== PHASES.REVIEW;
  elements.results.hidden = session.phase !== PHASES.RESULTS;
  elements.head.hidden = !isTrain;
  elements.accuracyBlock.hidden = !isTrain;
}

function renderRound() {
  const sample = currentSample(session);
  elements.round.textContent = `${session.roundIndex + 1} / ${TRAIN_ROUNDS}번째 학습 과일`;
  elements.sample.textContent = `과일 ${String(session.roundIndex + 1).padStart(2, "0")}`;
  elements.progress.style.width = `${((session.roundIndex + 1) / TRAIN_ROUNDS) * 100}%`;
  elements.color.textContent = sample.color;
  elements.texture.textContent = sample.texture;
  elements.season.textContent = sample.season;
  elements.specimen.setAttribute("aria-label", buildSpecimenLabel(sample));
  elements.specimen.innerHTML = buildSpecimenSvg(sample, `specimen-train-${session.roundIndex}`);
  elements.hint.textContent = "색깔·촉감·계절을 함께 보고 잘 익었는지 예상해 보세요.";
  elements.waiting.textContent = "예상을 선택하면 정답을 바로 확인할 수 있어요.";
  elements.ripe.disabled = false;
  elements.unripe.disabled = false;
  elements.waiting.hidden = false;
  elements.result.hidden = true;
  elements.feedback.className = "feedback";
  elements.checkpoint.hidden = ![4, 8].includes(session.roundIndex);
  answered = false;
}

function predict(prediction) {
  if (answered) return;
  answered = true;
  const outcome = submitPrediction(session, prediction);
  elements.ripe.disabled = true;
  elements.unripe.disabled = true;
  elements.waiting.hidden = true;
  elements.result.hidden = false;

  elements.feedback.classList.add(outcome.correct ? "correct" : "incorrect");
  elements.mark.textContent = outcome.correct ? "O" : "X";
  elements.title.textContent = outcome.correct ? "예상이 맞았습니다." : "예상과 달랐습니다.";
  elements.copy.innerHTML = `실제 정답은 <strong>${outcome.answer}</strong>입니다. 색깔·촉감·계절 중 어떤 정보가 정답과 함께 움직이는지 생각해 보세요.`;

  const isLastRound = session.roundIndex === TRAIN_ROUNDS - 1;
  elements.next.innerHTML = isLastRound
    ? "학습 결과 보기 <span aria-hidden=\"true\">→</span>"
    : "다음 과일 <span aria-hidden=\"true\">→</span>";

  updateScore();
  elements.next.focus();
}

function next() {
  if (!answered) return;
  const phase = advancePhase(session);
  if (phase === PHASES.REVIEW) return showReview();
  renderRound();
  $("#experiment").scrollIntoView({ block: "start" });
}

function renderReviewSummary() {
  const { train } = sessionResults(session);
  elements.reviewScoreLine.textContent = `${train.accuracy}%`;
  elements.reviewTrainCount.textContent = `학습 12개 중 ${train.correct}개를 맞혔습니다.`;
  elements.reviewSummaryBody.innerHTML = session.trainAttempts.map((a) => `<tr><th scope="row">${String(a.round).padStart(2, "0")}</th><td>${a.color}</td><td>${a.texture}</td><td>${a.season}</td><td>${a.prediction}</td><td>${a.answer}</td><td><span class="result ${a.correct ? "ok" : "no"}"><span aria-hidden="true">${a.correct ? "O" : "X"}</span><span class="sr-only">${a.correct ? "정답" : "오답"}</span></span></td></tr>`).join("");
}

function resetReviewForm() {
  elements.reviewForm.reset();
  elements.reviewForm.hidden = false;
  elements.reviewError.hidden = true;
  elements.reviewError.textContent = "";
  elements.reviewSubmit.disabled = false;
  elements.reviewResult.hidden = true;
  elements.reviewResult.className = "review-result";
  elements.startTest.hidden = true;
  document.querySelectorAll('input[name="review-choice"]').forEach((input) => { input.disabled = false; });
}

function showReview() {
  renderReviewSummary();
  resetReviewForm();
  showPhaseView();
  scrollTop();
  elements.review.querySelector("h2")?.focus?.();
}

function reviewExplanation(correct) {
  const pairs = comparisonPairs(session);
  const [first, second] = pairs[0] ?? [];
  const compareLine = first && second
    ? `학습 ${String(first.round).padStart(2, "0")}번과 ${String(second.round).padStart(2, "0")}번을 비교해 보세요. 색깔(${first.color})과 촉감(${first.texture})은 같았지만 계절만 ${first.season}→${second.season}로 달랐는데, 정답은 둘 다 '${first.answer}'였습니다.`
    : "학습 결과표에서 색깔·촉감이 같고 계절만 다른 과일들을 비교해 보세요.";
  return correct
    ? `정답입니다. 계절은 바뀌어도 정답은 바뀌지 않았어요. ${compareLine}`
    : `정답은 '계절'입니다. ${compareLine}`;
}

function submitReviewChoice(event) {
  event.preventDefault();
  const selected = document.querySelector('input[name="review-choice"]:checked');
  if (!selected) {
    elements.reviewError.hidden = false;
    elements.reviewError.textContent = "색깔, 촉감, 계절 중 하나를 선택해 주세요.";
    return;
  }
  elements.reviewError.hidden = true;
  elements.reviewError.textContent = "";
  const outcome = submitReview(session, selected.value);
  document.querySelectorAll('input[name="review-choice"]').forEach((input) => { input.disabled = true; });
  elements.reviewSubmit.disabled = true;

  elements.reviewResult.hidden = false;
  elements.reviewResult.classList.add(outcome.correct ? "correct" : "incorrect");
  elements.reviewResultMark.textContent = outcome.correct ? "O" : "X";
  elements.reviewResultTitle.textContent = outcome.correct ? "잘 찾았습니다." : "다시 살펴볼까요.";
  elements.reviewResultCopy.textContent = reviewExplanation(outcome.correct);

  elements.startTest.hidden = false;
  elements.startTest.focus();
}

function renderTestView() {
  elements.testError.hidden = true;
  elements.testError.textContent = "";
  elements.testGrid.innerHTML = session.testRounds.map((sample, index) => {
    const uid = `specimen-test-${index}`;
    return `<fieldset class="test-card" data-index="${index}">
      <legend><span class="sample-id">시험 과일 ${index + 1}</span></legend>
      <div class="specimen">
        <div class="specimen-visual" role="img" aria-label="${buildSpecimenLabel(sample)}">${buildSpecimenSvg(sample, uid)}</div>
      </div>
      <dl class="feature-grid cols-3" aria-label="${index + 1}번째 시험 과일의 색깔·촉감·계절 정보">
        <div><dt><span>01</span>색깔</dt><dd>${sample.color}</dd></div>
        <div><dt><span>02</span>촉감</dt><dd>${sample.texture}</dd></div>
        <div><dt><span>03</span>계절</dt><dd>${sample.season}</dd></div>
      </dl>
      <div class="test-options">
        <label><input type="radio" name="test-answer-${index}" value="잘 익음"><span>잘 익음</span></label>
        <label><input type="radio" name="test-answer-${index}" value="안 익음"><span>안 익음</span></label>
      </div>
    </fieldset>`;
  }).join("");
}

function beginTest() {
  startTest(session);
  renderTestView();
  showPhaseView();
  scrollTop();
  elements.testView.querySelector("h2")?.focus?.();
}

function submitTest() {
  const answers = session.testRounds.map((_, index) => {
    const selected = document.querySelector(`input[name="test-answer-${index}"]:checked`);
    return selected ? selected.value : null;
  });
  const missingIndex = answers.findIndex((answer) => answer === null);
  if (missingIndex !== -1) {
    elements.testError.hidden = false;
    elements.testError.textContent = `${missingIndex + 1}번째 시험 과일에 아직 답하지 않았습니다. 잘 익음 또는 안 익음을 선택해 주세요.`;
    document.querySelector(`input[name="test-answer-${missingIndex}"]`)?.focus();
    return;
  }
  elements.testError.hidden = true;
  elements.testError.textContent = "";
  submitTestBatch(session, answers);
  showResults();
}

function showResults() {
  const { train, test, review } = sessionResults(session);
  elements.trainScore.textContent = train.accuracy;
  elements.trainCount.textContent = `학습 12개 중 ${train.correct}개를 맞혔습니다.`;
  elements.reviewScoreBlock.textContent = review.correct ? "O" : "X";
  elements.reviewCount.textContent = `내가 고른 답: ${review.choice}`;
  elements.testScore.textContent = test.accuracy;
  elements.testCount.textContent = `시험 5개 중 ${test.correct}개를 맞혔습니다.`;
  showPhaseView();
  scrollTop();
  elements.results.querySelector("h2")?.focus?.();
}

function updateScore() {
  if (session.phase !== PHASES.TRAIN) return;
  const { train } = sessionResults(session);
  elements.accuracy.textContent = session.trainAttempts.length ? `${train.correct}/${session.trainAttempts.length} · ${train.accuracy}%` : "—";
}

function restart() {
  restartSession(session);
  answered = false;
  showPhaseView();
  updateScore();
  renderRound();
  scrollTop();
}

elements.ripe.addEventListener("click", () => predict("잘 익음"));
elements.unripe.addEventListener("click", () => predict("안 익음"));
elements.next.addEventListener("click", next);
elements.reviewForm.addEventListener("submit", submitReviewChoice);
elements.startTest.addEventListener("click", beginTest);
elements.submitTest.addEventListener("click", submitTest);
elements.restart.addEventListener("click", restart);
elements.projector.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("projector-mode");
  elements.projector.setAttribute("aria-pressed", String(enabled));
});
document.addEventListener("keydown", (event) => {
  if (event.target.matches("button, a, input")) return;
  if (session.phase !== PHASES.TRAIN) return;
  if (!answered && event.key === "1") predict("잘 익음");
  if (!answered && event.key === "2") predict("안 익음");
  if (answered && ["Enter", "ArrowRight"].includes(event.key)) next();
});

showPhaseView();
renderRound();
