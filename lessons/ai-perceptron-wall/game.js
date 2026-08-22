import {
  PHASES, RULES, MYCIN_CASES, STAGE1_POINTS, CHECKER_POINTS,
  createSession, updatePerceptronLine, advanceFromPerceptron,
  updateXorLine, advanceFromXor,
  currentMycinCase, submitMycinAnswer, advanceMycinCase, advanceFromMycin,
  updateBreakthroughLines, advanceFromBreakthrough, findBandAutomatically,
  sessionResults, restartSession,
} from "./game-core.js";

const $ = (selector) => document.querySelector(selector);

let session = createSession();
let mycinAnswered = false;
let mycinReviewVisible = false;

function scrollTop() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
}

// --- SVG 좌표평면 + 직선-분류 캔버스 ------------------------------------------
const PAD = 34;
const SIZE = 220;
const INNER = SIZE - PAD * 2;
const AXIS_OVERSHOOT = 14;
const px = (x) => PAD + x * INNER;
const py = (y) => (SIZE - PAD) - y * INNER;

function lineEndpoints(line) {
  const x1 = -0.5;
  const x2 = 1.5;
  return [
    { x: x1, y: line.slope * x1 + line.intercept },
    { x: x2, y: line.slope * x2 + line.intercept },
  ];
}

function axisMarkup() {
  const originX = px(0);
  const originY = py(0);
  const yTop = py(1) - AXIS_OVERSHOOT;
  const xRight = px(1) + AXIS_OVERSHOOT;
  const gridLines = [0.25, 0.5, 0.75].map((t) => `
    <line x1="${px(t)}" y1="${py(0)}" x2="${px(t)}" y2="${py(1)}" class="grid-line" />
    <line x1="${px(0)}" y1="${py(t)}" x2="${px(1)}" y2="${py(t)}" class="grid-line" />
  `).join("");
  return `
    ${gridLines}
    <line x1="${originX}" y1="${originY}" x2="${originX}" y2="${yTop}" class="axis-line" />
    <line x1="${originX}" y1="${originY}" x2="${xRight}" y2="${originY}" class="axis-line" />
    <path d="M ${originX - 5} ${yTop + 9} L ${originX} ${yTop} L ${originX + 5} ${yTop + 9}" class="axis-arrow" />
    <path d="M ${xRight - 9} ${originY - 5} L ${xRight} ${originY} L ${xRight - 9} ${originY + 5}" class="axis-arrow" />
    <text x="${originX - 8}" y="${originY + 14}" class="axis-label" text-anchor="end">0</text>
    <text x="${px(1)}" y="${originY + 14}" class="axis-label" text-anchor="middle">1</text>
    <text x="${originX - 8}" y="${py(1) + 4}" class="axis-label" text-anchor="end">1</text>
  `;
}

function drawCanvas(svg, lines, score) {
  const lineMarkup = lines.map((line) => {
    const [p1, p2] = lineEndpoints(line);
    return `<line x1="${px(p1.x)}" y1="${py(p1.y)}" x2="${px(p2.x)}" y2="${py(p2.y)}" class="boundary-line" />`;
  }).join("");

  const pointMarkup = score.perPoint.map((point) => {
    const cx = px(point.x);
    const cy = py(point.y);
    const fill = point.label ? "expected-true" : "expected-false";
    const ring = point.correct ? "point-ok" : "point-no";
    return `<circle class="point ${fill} ${ring}" cx="${cx}" cy="${cy}" r="9" />`;
  }).join("");

  svg.innerHTML = `${axisMarkup()}${lineMarkup}${pointMarkup}`;
}

// --- 단계 전환 -------------------------------------------------------------
const STAGE_INFO = {
  [PHASES.PERCEPTRON]: { index: 1, name: "퍼셉트론" },
  [PHASES.XOR]: { index: 2, name: "퍼셉트론의 한계" },
  [PHASES.MYCIN]: { index: 3, name: "마이신 규칙 진단" },
  [PHASES.BREAKTHROUGH]: { index: 4, name: "여러 경계와 오차 기반 학습" },
  [PHASES.RESULTS]: { index: 4, name: "결과" },
};

function showPhaseView() {
  const phase = session.phase;
  $("#perceptron-view").hidden = phase !== PHASES.PERCEPTRON;
  $("#xor-view").hidden = phase !== PHASES.XOR;
  $("#mycin-view").hidden = phase !== PHASES.MYCIN;
  $("#breakthrough-view").hidden = phase !== PHASES.BREAKTHROUGH;
  $("#results-view").hidden = phase !== PHASES.RESULTS;
  $("#experiment-head").hidden = phase === PHASES.RESULTS;

  const info = STAGE_INFO[phase];
  $("#stage-label").textContent = `${info.index} / 4단계 · ${info.name}`;
  $("#progress-bar").style.width = `${(info.index / 4) * 100}%`;
  $("#accuracy-block").hidden = phase === PHASES.MYCIN || phase === PHASES.RESULTS;
}

// --- 1단계: 퍼셉트론 ---------------------------------------------------------
function readLine(prefix) {
  return { slope: Number($(`#${prefix}-slope`).value), intercept: Number($(`#${prefix}-intercept`).value) };
}

function renderPerceptron() {
  const line = session.perceptron.line;
  $("#perceptron-slope").value = String(line.slope);
  $("#perceptron-intercept").value = String(line.intercept);
  onPerceptronInput();
}

function onPerceptronInput() {
  const line = readLine("perceptron");
  const score = updatePerceptronLine(session, line);
  drawCanvas($("#perceptron-canvas"), [line], score);
  $("#perceptron-score").textContent = `${score.correct} / ${score.total} 정답 (${score.accuracy}%)`;
  $("#accuracy").textContent = `${score.accuracy}%`;
  const solved = score.correct === score.total;
  $("#perceptron-next").disabled = !solved;
  $("#perceptron-hint").textContent = solved ? "모두 맞혔습니다!" : "모두 갈릴 때까지 움직여 보세요.";
  $("#perceptron-reveal").hidden = !solved;
}

function goToXor() {
  advanceFromPerceptron(session);
  showPhaseView();
  renderXor();
  scrollTop();
  $("#xor-title")?.focus?.();
}

// --- 2단계: 퍼셉트론의 한계 ----------------------------------------------------
function renderXor() {
  const line = session.xor.line;
  $("#xor-slope").value = String(line.slope);
  $("#xor-intercept").value = String(line.intercept);
  const score = updateXorLine(session, line);
  session.xor.interactions = 0; // 초기 렌더링은 상호작용으로 세지 않음
  drawXorScore(score);
}

function drawXorScore(score) {
  drawCanvas($("#xor-canvas"), [session.xor.line], score);
  $("#xor-score").textContent = `${score.correct} / ${score.total} 정답 (${score.accuracy}%) · 최고 기록 ${session.xor.best}/${score.total}`;
  $("#accuracy").textContent = `${score.accuracy}%`;
  $("#xor-struggle-hint").hidden = session.xor.interactions < 4;
  $("#xor-next").disabled = session.xor.interactions === 0;
}

function onXorInput() {
  const line = readLine("xor");
  const score = updateXorLine(session, line);
  drawXorScore(score);
}

function goToMycin() {
  advanceFromXor(session);
  $("#xor-reveal").hidden = false;
  $("#xor-best-text").textContent = String(session.xor.best);
  $("#xor-total-text").textContent = String(CHECKER_POINTS.length);
  showPhaseView();
  renderMycinRules();
  renderMycinCase();
  scrollTop();
  $("#mycin-title")?.focus?.();
}

// --- 3단계: 마이신 규칙 진단 --------------------------------------------------
// 환자 증상(#mycin-fields)과 항상 같은 순서로 보여줘야 규칙-환자 대조가 쉬워진다.
const MYCIN_FIELDS = ["열", "기침", "콧물"];
const MEDICINE_CLASSES = {
  "해열제": "medicine-fever",
  "기침약": "medicine-cough",
  "콧물약": "medicine-runny-nose",
  "처방 없음": "medicine-none",
};

function renderMedicineBadges(treatment) {
  return treatment.split(" + ").map((medicine) =>
    `<span class="medicine-chip ${MEDICINE_CLASSES[medicine] ?? "medicine-none"}">${medicine}</span>`
  ).join("");
}

function formatCondition(field, value) {
  if (!value) return { text: "상관없음", className: "condition-any" };
  const isPresent = field === "열" ? value === "높음" : value === "있음";
  return isPresent
    ? { text: "있음", className: "condition-positive" }
    : { text: "없음", className: "condition-negative" };
}

function renderMycinRules() {
  $("#mycin-rules").innerHTML = RULES.map((rule, index) => {
    const conditions = MYCIN_FIELDS.map((field) => {
      const value = rule.when[field];
      const condition = formatCondition(field, value);
      return `<tr><th scope="row">${field}</th><td><span class="condition-chip ${condition.className}">${condition.text}</span></td></tr>`;
    }).join("");
    return `<article class="mycin-rule-card rule-color-${index + 1}">
      <h3>${rule.label}</h3>
      <table><caption>${rule.label}의 증상 조건</caption><thead><tr><th scope="col">증상</th><th scope="col">조건</th></tr></thead><tbody>${conditions}</tbody></table>
      <div class="mycin-rule-treatment"><span class="treatment-label">처방</span><div class="medicine-badges">${renderMedicineBadges(rule.treatment)}</div></div>
    </article>`;
  }).join("");
}

function renderMycinCase() {
  mycinAnswered = false;
  mycinReviewVisible = false;
  $("#mycin-case-view").hidden = false;
  $("#mycin-review-view").hidden = true;

  const patient = currentMycinCase(session);
  $("#mycin-progress").textContent = `${session.mycin.index + 1} / ${MYCIN_CASES.length}번째 환자`;
  $("#mycin-progress-bar").style.width = `${((session.mycin.index + 1) / MYCIN_CASES.length) * 100}%`;

  $("#mycin-fields").innerHTML = Object.entries(patient).filter(([key]) => key !== "id")
    .map(([key, value], index) => `<div><dt><span>${String(index + 1).padStart(2, "0")}</span>${key}</dt><dd>${value}</dd></div>`)
    .join("");

  $("#mycin-choices").innerHTML = [...RULES.map((rule) => `<button type="button" data-choice="${rule.id}" aria-label="${rule.treatment}"><span class="medicine-badges">${renderMedicineBadges(rule.treatment)}</span></button>`),
    `<button type="button" data-choice="NONE" class="no-prescription-choice"><span class="no-prescription-icon" aria-hidden="true">×</span><span>처방할 수 없음</span></button>`].join("");

  $("#feedback-waiting").hidden = false;
  $("#feedback-result").hidden = true;
  $("#mycin-feedback").className = "feedback";
}

function onMycinChoice(choiceId) {
  if (mycinAnswered) return;
  mycinAnswered = true;
  const attempt = submitMycinAnswer(session, choiceId);

  $("#mycin-choices").querySelectorAll("button").forEach((button) => { button.disabled = true; });
  $("#feedback-waiting").hidden = true;
  $("#feedback-result").hidden = false;
  $("#mycin-feedback").classList.add(attempt.correct ? "correct" : "incorrect");
  $("#feedback-mark").textContent = attempt.correct ? "O" : "X";

  if (attempt.expectedId === "NONE") {
    $("#feedback-title").textContent = attempt.correct ? "맞습니다, 맞는 처방이 없습니다." : "다시 살펴볼까요.";
    $("#feedback-copy").textContent = "처방 4가지 중 어느 것도 맞지 않습니다. 새 규칙 없이는 진단할 수 없습니다.";
  } else {
    const rule = RULES.find((r) => r.id === attempt.expectedId);
    $("#feedback-title").textContent = attempt.correct ? "정답입니다." : "다시 살펴볼까요.";
    $("#feedback-copy").textContent = `맞는 처방은 "${rule.treatment}"입니다.`;
  }

  const isLast = session.mycin.index === MYCIN_CASES.length - 1;
  $("#next-button").innerHTML = isLast ? "결과 확인하기 <span aria-hidden=\"true\">→</span>" : "다음 환자 <span aria-hidden=\"true\">→</span>";
  $("#next-button").focus();
}

function onMycinNext() {
  if (!mycinAnswered) return;
  const moved = advanceMycinCase(session);
  if (moved) {
    renderMycinCase();
    $("#experiment").scrollIntoView({ block: "start" });
  } else {
    showMycinReview();
  }
}

function showMycinReview() {
  mycinReviewVisible = true;
  $("#mycin-case-view").hidden = true;
  $("#mycin-review-view").hidden = false;
  const { mycin } = sessionResults(session);
  $("#mycin-review-summary").textContent = `${mycin.total}명 중 ${mycin.correct}명 정답, 그중 ${mycin.wallCount}번은 규칙에 없는 사례였습니다.`;
  scrollTop();
  $("#mycin-review-title")?.focus?.();
}

function goToBreakthrough() {
  advanceFromMycin(session);
  showPhaseView();
  renderBreakthrough();
  scrollTop();
  $("#breakthrough-title")?.focus?.();
}

// --- 4단계: 여러 경계와 오차 기반 학습(두 직선) -------------------------------
const BREAKTHROUGH_INPUT_IDS = ["breakthrough-a-slope", "breakthrough-a-intercept", "breakthrough-b-slope", "breakthrough-b-intercept"];
let autoFindRunning = false;

function renderBreakthrough() {
  const { lineA, lineB } = session.breakthrough;
  $("#breakthrough-a-slope").value = String(lineA.slope);
  $("#breakthrough-a-intercept").value = String(lineA.intercept);
  $("#breakthrough-b-slope").value = String(lineB.slope);
  $("#breakthrough-b-intercept").value = String(lineB.intercept);
  autoFindRunning = false;
  $("#auto-find-button").disabled = false;
  $("#auto-find-status").hidden = true;
  setBreakthroughInputsDisabled(false);
  onBreakthroughInput();
}

function onBreakthroughInput() {
  const lineA = readLine("breakthrough-a");
  const lineB = readLine("breakthrough-b");
  const score = updateBreakthroughLines(session, lineA, lineB);
  drawCanvas($("#breakthrough-canvas"), [lineA, lineB], score);
  $("#breakthrough-score").textContent = `${score.correct} / ${score.total} 정답 (${score.accuracy}%)`;
  $("#accuracy").textContent = `${score.accuracy}%`;
  const solved = score.correct === score.total;
  $("#breakthrough-next").disabled = !solved;
  $("#breakthrough-reveal").hidden = !solved;
}

function setBreakthroughInputsDisabled(disabled) {
  BREAKTHROUGH_INPUT_IDS.forEach((id) => { $(`#${id}`).disabled = disabled; });
}

function applyBreakthroughStep(step) {
  $("#breakthrough-a-slope").value = String(step.lineA.slope);
  $("#breakthrough-a-intercept").value = String(step.lineA.intercept);
  $("#breakthrough-b-slope").value = String(step.lineB.slope);
  $("#breakthrough-b-intercept").value = String(step.lineB.intercept);
  onBreakthroughInput();
}

// "AI가 자동으로 찾기": 미리 계산해 둔 경로(오차가 줄어드는 방향으로 한 걸음씩 이동한 기록)를
// 한 스텝씩 재생한다. 계산 자체는 findBandAutomatically가 클릭 시점에 즉시 끝내고, 여기서는
// 그 결과를 눈으로 볼 수 있게 시간차를 두고 보여줄 뿐이다.
function runAutoFind() {
  if (autoFindRunning) return;
  autoFindRunning = true;
  const path = findBandAutomatically(CHECKER_POINTS);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const statusEl = $("#auto-find-status");
  const button = $("#auto-find-button");
  button.disabled = true;
  setBreakthroughInputsDisabled(true);
  statusEl.hidden = false;

  let index = 0;
  const showStep = () => {
    const step = path[index];
    applyBreakthroughStep(step);
    const isLast = index === path.length - 1;
    statusEl.textContent = isLast
      ? `학습 완료! ${step.score.correct}/${step.score.total}로 스스로 찾았습니다. (총 ${path.length}단계)`
      : `학습 중… ${index + 1} / ${path.length}단계 · 정답 ${step.score.correct}/${step.score.total}`;
    index += 1;
    if (index < path.length) {
      setTimeout(showStep, reduced ? 0 : 220);
    } else {
      button.disabled = false;
      setBreakthroughInputsDisabled(false);
      autoFindRunning = false;
    }
  };
  showStep();
}

function goToResults() {
  advanceFromBreakthrough(session);
  showPhaseView();
  renderResults();
  scrollTop();
  $("#results-view h2")?.focus?.();
}

// --- 결과 화면 ---------------------------------------------------------------
function renderResults() {
  const results = sessionResults(session);
  const journey = [
    { year: "1958년", title: "퍼셉트론", detail: `직선 하나로 ${results.perceptronBest}/${STAGE1_POINTS.length} 완전 분류. 성공.` },
    { year: "1969년", title: "퍼셉트론의 한계", detail: `직선 하나로 최고 ${results.xorBest}/${CHECKER_POINTS.length}. 전형적인 XOR처럼 선형 분리가 불가능한 문제와 단층 퍼셉트론의 한계를 확인.` },
    { year: "1972년", title: "마이신(규칙 기반)", detail: `${results.mycin.total}명 중 ${results.mycin.correct}명 진단, ${results.mycin.wallCount}번은 처방 불가. 한계 재발견.` },
    { year: "1986년", title: "다층 신경망 연구의 도약", detail: `두 직선의 띠로 ${results.breakthroughBest}/${CHECKER_POINTS.length} 완전 분류. 여러 경계와 오차 기반 학습의 가능성을 확인.` },
  ];
  $("#journey-list").innerHTML = journey.map((step) => `<li>
    <span class="journey-year">${step.year}</span>
    <div><strong>${step.title}</strong><p>${step.detail}</p></div>
  </li>`).join("");
}

// --- 재시작 -------------------------------------------------------------------
function restart() {
  restartSession(session);
  mycinAnswered = false;
  mycinReviewVisible = false;
  showPhaseView();
  renderPerceptron();
  $("#xor-reveal").hidden = true;
  scrollTop();
}

// --- 이벤트 바인딩 -------------------------------------------------------------
$("#perceptron-slope").addEventListener("input", onPerceptronInput);
$("#perceptron-intercept").addEventListener("input", onPerceptronInput);
$("#perceptron-next").addEventListener("click", goToXor);

$("#xor-slope").addEventListener("input", onXorInput);
$("#xor-intercept").addEventListener("input", onXorInput);
$("#xor-next").addEventListener("click", goToMycin);

$("#mycin-choices").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-choice]");
  if (!button) return;
  onMycinChoice(button.dataset.choice);
});
$("#next-button").addEventListener("click", onMycinNext);
$("#mycin-next-stage").addEventListener("click", goToBreakthrough);

$("#breakthrough-a-slope").addEventListener("input", onBreakthroughInput);
$("#breakthrough-a-intercept").addEventListener("input", onBreakthroughInput);
$("#breakthrough-b-slope").addEventListener("input", onBreakthroughInput);
$("#breakthrough-b-intercept").addEventListener("input", onBreakthroughInput);
$("#breakthrough-next").addEventListener("click", goToResults);
$("#auto-find-button").addEventListener("click", runAutoFind);

$("#restart-button").addEventListener("click", restart);
$("#projector-toggle").addEventListener("click", () => {
  const enabled = document.body.classList.toggle("projector-mode");
  $("#projector-toggle").setAttribute("aria-pressed", String(enabled));
});

showPhaseView();
renderPerceptron();
