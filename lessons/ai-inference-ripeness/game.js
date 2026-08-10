import { classify, makeRounds, summarize, TOTAL_ROUNDS } from "./game-core.js";
import { buildSpecimenLabel, buildSpecimenSvg } from "./specimen-visual.js";

const $ = (selector) => document.querySelector(selector);
const elements = {
  round: $("#round-label"), progress: $("#progress-bar"), accuracy: $("#accuracy"), sample: $("#sample-id"),
  specimen: $("#specimen-visual"),
  color: $("#feature-color"), texture: $("#feature-texture"), season: $("#feature-season"),
  ripe: $("#predict-ripe"), unripe: $("#predict-unripe"), feedback: $("#feedback"), waiting: $("#feedback-waiting"),
  result: $("#feedback-result"), mark: $("#feedback-mark"), title: $("#feedback-title"), copy: $("#feedback-copy"),
  next: $("#next-button"), checkpoint: $("#checkpoint"), play: $("#play-view"), summary: $("#summary-view"),
  finalScore: $("#final-score"), finalCount: $("#final-count"), restart: $("#restart-button"), logBody: $("#log-body"),
  logCount: $("#log-count"), projector: $("#projector-toggle"),
};

let rounds = makeRounds();
let roundIndex = 0;
let attempts = [];
let answered = false;
let activeFilter = "all";

function scrollTop() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
}

function renderRound() {
  const sample = rounds[roundIndex];
  elements.round.textContent = `${roundIndex + 1} / ${TOTAL_ROUNDS}번째 과일`;
  elements.sample.textContent = `과일 ${String(roundIndex + 1).padStart(2, "0")}`;
  elements.progress.style.width = `${((roundIndex + 1) / TOTAL_ROUNDS) * 100}%`;
  elements.color.textContent = sample.color;
  elements.texture.textContent = sample.texture;
  elements.season.textContent = sample.season;
  elements.specimen.setAttribute("aria-label", buildSpecimenLabel(sample));
  elements.specimen.innerHTML = buildSpecimenSvg(sample, `specimen-${roundIndex}`);
  elements.ripe.disabled = false;
  elements.unripe.disabled = false;
  elements.waiting.hidden = false;
  elements.result.hidden = true;
  elements.feedback.className = "feedback";
  elements.checkpoint.hidden = !([5, 10].includes(roundIndex));
  answered = false;
}

function predict(prediction) {
  if (answered) return;
  answered = true;
  const sample = rounds[roundIndex];
  const answer = classify(sample);
  const correct = prediction === answer;
  attempts.push({ ...sample, round: roundIndex + 1, prediction, answer, correct });
  elements.ripe.disabled = true;
  elements.unripe.disabled = true;
  elements.waiting.hidden = true;
  elements.result.hidden = false;
  elements.feedback.classList.add(correct ? "correct" : "incorrect");
  elements.mark.textContent = correct ? "O" : "X";
  elements.title.textContent = correct ? "맞았습니다." : "정답과 달랐습니다.";
  elements.copy.innerHTML = `실제 정답은 <strong>${answer}</strong>입니다. 지난 기록과 비교해 내 생각을 다시 확인해 보세요.`;
  elements.next.innerHTML = roundIndex === TOTAL_ROUNDS - 1 ? "결과 보기 <span aria-hidden=\"true\">→</span>" : "다음 과일 <span aria-hidden=\"true\">→</span>";
  updateScore();
  renderLog();
  elements.next.focus();
}

function next() {
  if (!answered) return;
  if (roundIndex === TOTAL_ROUNDS - 1) return finish();
  roundIndex += 1;
  renderRound();
  $("#experiment").scrollIntoView({ block: "start" });
}

function finish() {
  const { correct, accuracy } = summarize(attempts);
  elements.play.hidden = true;
  elements.summary.hidden = false;
  elements.finalScore.textContent = accuracy;
  elements.finalCount.textContent = `15개 중 ${correct}개를 맞혔습니다.`;
  scrollTop();
  $("#summary-view h2").focus?.();
}

function updateScore() {
  const { correct, accuracy } = summarize(attempts);
  elements.accuracy.textContent = attempts.length ? `${correct}/${attempts.length} · ${accuracy}%` : "—";
  elements.logCount.textContent = attempts.length;
}

function filteredAttempts() {
  if (activeFilter === "wrong") return attempts.filter((attempt) => !attempt.correct);
  if (activeFilter !== "all") return attempts.filter((attempt) => attempt.color === activeFilter);
  return attempts;
}

function renderLog() {
  const visible = filteredAttempts();
  if (!visible.length) {
    elements.logBody.innerHTML = `<tr class="empty-row"><td colspan="6">${attempts.length ? "이 조건에 맞는 기록이 없습니다." : "첫 번째 과일을 선택하면 기록이 나타납니다."}</td></tr>`;
    return;
  }
  elements.logBody.innerHTML = visible.map((a) => `<tr><th scope="row">${String(a.round).padStart(2, "0")}</th><td>${a.color}</td><td>${a.texture}</td><td>${a.season}</td><td>${a.answer}</td><td><span class="result ${a.correct ? "ok" : "no"}"><span aria-hidden="true">${a.correct ? "O" : "X"}</span><span class="sr-only">${a.correct ? "정답" : "오답"}</span></span></td></tr>`).join("");
}

function restart() {
  rounds = makeRounds(); roundIndex = 0; attempts = []; answered = false; activeFilter = "all";
  elements.play.hidden = false; elements.summary.hidden = true;
  document.querySelectorAll(".filter").forEach((button) => { button.classList.toggle("active", button.dataset.filter === "all"); button.setAttribute("aria-pressed", button.dataset.filter === "all"); });
  updateScore(); renderLog(); renderRound(); scrollTop();
}

elements.ripe.addEventListener("click", () => predict("잘 익음"));
elements.unripe.addEventListener("click", () => predict("안 익음"));
elements.next.addEventListener("click", next);
elements.restart.addEventListener("click", restart);
elements.projector.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("projector-mode");
  elements.projector.setAttribute("aria-pressed", String(enabled));
});
document.querySelectorAll(".filter").forEach((button) => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter").forEach((item) => { const active = item === button; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); });
  renderLog();
}));
document.addEventListener("keydown", (event) => {
  if (event.target.matches("button, a") && ["Enter", " "].includes(event.key)) return;
  if (!answered && event.key === "1") predict("잘 익음");
  if (!answered && event.key === "2") predict("안 익음");
  if (answered && ["Enter", "ArrowRight"].includes(event.key)) next();
});

renderRound();
