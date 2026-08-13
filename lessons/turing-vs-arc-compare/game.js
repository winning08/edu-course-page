import { summarizeArcResults } from "./game-core.js";

// arc-puzzle-challenge/puzzles.js가 정의한 문제 수와 같은 값(4). 각 활동은 독립 폴더로 유지하는
// 프로젝트 관례상 그 파일을 직접 import하지 않고 값만 그대로 옮겨 적었다.
const ARC_PUZZLE_TOTAL = 4;

const $ = (selector) => document.querySelector(selector);
const el = {
  turingSummary: $("#my-turing-summary"),
  arcSummary: $("#my-arc-summary"),
};

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// 활동 01의 질문은 이제 이 사이트가 아니라 구글 설문에 바로 적어 제출하므로
// (localStorage에 남지 않음) 여기서는 완료 여부를 알 수 없다. 대신 무엇을 했는지만 안내한다.
function renderTuringSummary() {
  el.turingSummary.innerHTML = `
    <p class="my-result-title">활동 01 · 튜링 테스트 질문</p>
    <p class="my-result-empty">설문에 질문을 적어 제출했어요. 제출한 질문은 선생님 화면에서 모아 볼 수 있어요.</p>
    <a href="../turing-test-questions/">활동 01 다시 보기 →</a>
  `;
}

function renderArcSummary() {
  const saved = readJSON("arc-puzzle-challenge:v1");
  const summary = summarizeArcResults(saved?.results);
  if (summary.attempted === 0) {
    el.arcSummary.innerHTML = `
      <p class="my-result-title">활동 02 · ARC 퍼즐</p>
      <p class="my-result-empty">아직 푼 퍼즐이 없어요.</p>
      <a href="../arc-puzzle-challenge/">활동 02 하러 가기 →</a>
    `;
    return;
  }
  const inProgress = summary.attempted < ARC_PUZZLE_TOTAL;
  const parts = [`${ARC_PUZZLE_TOTAL}문제 중 ${summary.solved}문제를 스스로 풀었어요`];
  if (summary.solvedRetry > 0) parts.push(`그중 ${summary.solvedRetry}문제는 다시 도전해서 성공`);
  if (summary.skipped > 0) parts.push(`${summary.skipped}문제는 건너뜀`);
  el.arcSummary.innerHTML = `
    <p class="my-result-title">활동 02 · ARC 퍼즐</p>
    <p class="my-result-highlight">${parts.join(", ")}</p>
    ${inProgress ? '<p class="my-result-empty">아직 진행 중이에요 — <a href="../arc-puzzle-challenge/">이어서 풀기 →</a></p>' : ""}
  `;
}

function init() {
  renderTuringSummary();
  renderArcSummary();
}

init();
