import { loadPuzzles } from "./puzzles.js";
import { createBlankGrid, setCell, gridsEqual, usedColors, requiredPuzzles, bonusPuzzles, summarizeRequiredResults } from "./game-core.js";

const STORAGE_KEY = "arc-puzzle-challenge:v3";

// 이전 버전의 영구 저장값은 제거하고, 연계 활동에 필요한 동안 같은 탭에서만 보관한다.
try { localStorage.removeItem(STORAGE_KEY); } catch { /* 저장소 접근 불가 환경 */ }

const PUZZLES = await loadPuzzles();

const REQUIRED_PUZZLES = requiredPuzzles(PUZZLES);
const BONUS_PUZZLE = bonusPuzzles(PUZZLES)[0];

const COLOR_NAMES = {
  0: "검정", 1: "파랑", 2: "빨강", 3: "초록", 4: "노랑",
  5: "회색", 6: "자홍", 7: "주황", 8: "하늘색", 9: "갈색",
};

const BONUS_OUTCOME_LABELS = {
  "solved-first": "직접 풀었어요.",
  "solved-retry": "다시 도전해서 풀었어요.",
  "skipped": "건너뛰었어요 — 괜찮아요, 나중에 다시 도전해도 됩니다.",
};

const $ = (selector) => document.querySelector(selector);
const el = {
  progressLabel: $("#puzzle-progress-label"),
  puzzleTitle: $("#puzzle-title"),
  trainExamples: $("#train-examples"),
  testInputGrid: $("#test-input-grid"),
  testOutputGrid: $("#test-output-grid"),
  colorPalette: $("#color-palette"),
  colorSelectedName: $("#color-selected-name"),
  checkButton: $("#check-button"),
  clearButton: $("#clear-button"),
  hintButton: $("#hint-button"),
  hintText: $("#hint-text"),
  skipButton: $("#skip-button"),
  nextButton: $("#next-button"),
  feedback: $("#puzzle-feedback"),
  testArea: $(".test-area"),
  puzzleView: $("#puzzle-view"),
  resultsView: $("#results-view"),
  resultsSummary: $("#results-summary"),
  bonusPrompt: $("#bonus-prompt"),
  bonusButton: $("#bonus-button"),
  bonusOutcome: $("#bonus-outcome"),
};

const state = {
  mode: "required", // "required" | "bonus"
  puzzleIndex: 0,
  outputGrid: null,
  selectedColor: 0,
  results: [],
  bonusResult: null,
  attemptedCurrent: false,
  locked: false,
};

function loadProgress() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.results)) return null;
    return {
      results: data.results,
      bonusResult: typeof data.bonusResult === "string" ? data.bonusResult : null,
    };
  } catch {
    return null;
  }
}

function saveProgress() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ results: state.results, bonusResult: state.bonusResult }));
  } catch {
    // sessionStorage를 쓸 수 없는 환경에서는 진행 상황 저장을 건너뛴다.
  }
}

function buildGridElement(grid, { editable, onCellClick } = {}) {
  const el2 = document.createElement("div");
  el2.className = editable ? "arc-grid arc-grid-editable" : "arc-grid";
  const rows = grid.length;
  const cols = grid[0].length;
  el2.style.setProperty("--arc-cols", cols);
  if (!editable) {
    el2.setAttribute("role", "img");
    el2.setAttribute("aria-label", `${rows}행 ${cols}열 그림`);
  }
  grid.forEach((row, r) => {
    row.forEach((value, c) => {
      const cell = document.createElement(editable ? "button" : "div");
      cell.className = `arc-cell symbol-${value}`;
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      if (editable) {
        cell.type = "button";
        cell.setAttribute("aria-label", `${r + 1}행 ${c + 1}열, 현재 ${COLOR_NAMES[value]}`);
        cell.addEventListener("click", () => onCellClick(r, c));
      }
      el2.appendChild(cell);
    });
  });
  return el2;
}

function renderTrainExamples(puzzle) {
  el.trainExamples.innerHTML = "";
  puzzle.train.forEach((pair, index) => {
    const item = document.createElement("div");
    item.className = "train-pair";
    const label = document.createElement("p");
    label.className = "train-pair-label";
    label.textContent = `예시 ${index + 1}`;
    item.appendChild(label);
    const row = document.createElement("div");
    row.className = "train-pair-grids";
    const totalColumns = pair.input[0].length + pair.output[0].length;
    row.style.setProperty("--pair-total-cols", totalColumns);
    row.appendChild(buildGridElement(pair.input));
    const arrow = document.createElement("span");
    arrow.className = "train-pair-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    row.appendChild(arrow);
    row.appendChild(buildGridElement(pair.output));
    item.appendChild(row);
    el.trainExamples.appendChild(item);
  });
}

function renderPalette(puzzle) {
  el.colorPalette.innerHTML = "";
  const colors = usedColors(puzzle);
  colors.forEach((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `color-swatch symbol-${color}`;
    button.dataset.color = String(color);
    button.setAttribute("aria-pressed", String(color === state.selectedColor));
    button.setAttribute("aria-label", COLOR_NAMES[color]);
    button.addEventListener("click", () => selectColor(color));
    el.colorPalette.appendChild(button);
  });
  updateSelectedColorName();
}

function updateSelectedColorName() {
  el.colorSelectedName.textContent = ` — 지금 선택: ${COLOR_NAMES[state.selectedColor]}`;
}

function selectColor(color) {
  state.selectedColor = color;
  el.colorPalette.querySelectorAll(".color-swatch").forEach((button) => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.color) === color));
  });
  updateSelectedColorName();
}

function renderEditableOutput() {
  el.testOutputGrid.innerHTML = "";
  const grid = buildGridElement(state.outputGrid, { editable: true, onCellClick: handleCellClick });
  if (state.locked) grid.classList.add("is-locked");
  el.testOutputGrid.appendChild(grid);
}

function handleCellClick(row, col) {
  if (state.locked) return;
  state.outputGrid = setCell(state.outputGrid, row, col, state.selectedColor);
  const cell = el.testOutputGrid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  if (cell) {
    cell.className = `arc-cell symbol-${state.selectedColor}`;
    cell.setAttribute("aria-label", `${row + 1}행 ${col + 1}열, 현재 ${COLOR_NAMES[state.selectedColor]}`);
  }
}

function setFeedback(message, tone) {
  el.feedback.textContent = message;
  el.feedback.classList.remove("is-success", "is-retry");
  if (tone) el.feedback.classList.add(tone);
}

function currentPuzzle() {
  return state.mode === "bonus" ? BONUS_PUZZLE : REQUIRED_PUZZLES[state.puzzleIndex];
}

function renderPuzzleCommon(puzzle) {
  state.attemptedCurrent = false;
  state.locked = false;
  const dims = puzzle.test.output;
  state.outputGrid = createBlankGrid(dims.length, dims[0].length);
  const colors = usedColors(puzzle);
  state.selectedColor = colors.find((color) => color !== 0) ?? colors[0] ?? 0;

  el.puzzleTitle.textContent = puzzle.title;
  el.puzzleTitle.dataset.sourceId = puzzle.sourceId;
  const testTotalColumns = puzzle.test.input[0].length + puzzle.test.output[0].length;
  el.testArea.style.setProperty("--test-total-cols", testTotalColumns);
  renderTrainExamples(puzzle);
  el.testInputGrid.innerHTML = "";
  el.testInputGrid.appendChild(buildGridElement(puzzle.test.input));
  renderPalette(puzzle);
  renderEditableOutput();

  el.hintText.hidden = true;
  el.hintText.textContent = puzzle.hint;
  el.hintButton.setAttribute("aria-expanded", "false");
  el.nextButton.hidden = true;
  el.checkButton.disabled = false;
  el.clearButton.disabled = false;
  el.skipButton.disabled = false;
  setFeedback("", null);
}

function loadRequiredPuzzle(index) {
  state.mode = "required";
  state.puzzleIndex = index;
  const puzzle = REQUIRED_PUZZLES[index];
  el.progressLabel.textContent = `문제 ${index + 1} / ${REQUIRED_PUZZLES.length} · 수업용 난이도 ${puzzle.difficulty} · 공식 ID ${puzzle.sourceId}`;
  renderPuzzleCommon(puzzle);
  saveProgress();
}

function loadBonusPuzzle() {
  state.mode = "bonus";
  const puzzle = BONUS_PUZZLE;
  el.progressLabel.textContent = `선택 도전 · 수업용 난이도 ${puzzle.difficulty} · 공식 ID ${puzzle.sourceId}`;
  renderPuzzleCommon(puzzle);
}

function lockPuzzle() {
  state.locked = true;
  el.testOutputGrid.querySelectorAll(".arc-cell").forEach((cell) => { cell.disabled = true; });
  el.checkButton.disabled = true;
  el.clearButton.disabled = true;
  el.skipButton.disabled = true;
  el.nextButton.hidden = false;
  if (state.mode === "bonus") {
    el.nextButton.textContent = "결과로 돌아가기 →";
  } else {
    el.nextButton.textContent = state.puzzleIndex === REQUIRED_PUZZLES.length - 1 ? "결과 보기 →" : "다음 문제 →";
  }
}

function handleCheck() {
  const puzzle = currentPuzzle();
  const correct = gridsEqual(state.outputGrid, puzzle.test.output);
  if (correct) {
    const outcome = state.attemptedCurrent ? "solved-retry" : "solved-first";
    if (state.mode === "bonus") {
      state.bonusResult = outcome;
    } else {
      state.results.push(outcome);
    }
    setFeedback("정답입니다! 규칙을 정확히 찾았어요.", "is-success");
    lockPuzzle();
    saveProgress();
  } else {
    state.attemptedCurrent = true;
    setFeedback("아직 규칙과 다릅니다. 예시를 다시 살펴보고 도전해 보세요.", "is-retry");
  }
}

function handleClear() {
  if (state.locked) return;
  const dims = currentPuzzle().test.output;
  state.outputGrid = createBlankGrid(dims.length, dims[0].length);
  renderEditableOutput();
}

function handleHint() {
  const expanded = el.hintButton.getAttribute("aria-expanded") === "true";
  el.hintButton.setAttribute("aria-expanded", String(!expanded));
  el.hintText.hidden = expanded;
}

function handleSkip() {
  if (state.mode === "bonus") {
    state.bonusResult = "skipped";
  } else {
    state.results.push("skipped");
  }
  advance();
}

function advance() {
  if (state.mode === "bonus") {
    saveProgress();
    showResults();
    return;
  }
  if (state.puzzleIndex + 1 < REQUIRED_PUZZLES.length) {
    loadRequiredPuzzle(state.puzzleIndex + 1);
  } else {
    showResults();
  }
}

function renderBonusSection() {
  if (state.bonusResult) {
    el.bonusPrompt.hidden = true;
    el.bonusOutcome.hidden = false;
    el.bonusOutcome.textContent = `선택 도전(Expert) 결과: ${BONUS_OUTCOME_LABELS[state.bonusResult]}`;
  } else {
    el.bonusPrompt.hidden = false;
    el.bonusOutcome.hidden = true;
  }
}

function showResults() {
  saveProgress();
  el.puzzleView.hidden = true;
  el.resultsView.hidden = false;
  const summary = summarizeRequiredResults(state.results, REQUIRED_PUZZLES.length);
  const parts = [`필수 문제 ${summary.total}개 중 ${summary.solved}문제를 스스로 풀었어요.`];
  if (summary.solvedRetry > 0) parts.push(`그중 ${summary.solvedRetry}문제는 다시 도전해서 성공했어요.`);
  if (summary.skipped > 0) parts.push(`${summary.skipped}문제는 건너뛰었어요 — 괜찮아요, 나중에 다시 도전해도 됩니다.`);
  el.resultsSummary.textContent = parts.join(" ");
  renderBonusSection();
}

function handleBonusStart() {
  el.resultsView.hidden = true;
  el.puzzleView.hidden = false;
  loadBonusPuzzle();
}

function init() {
  el.checkButton.addEventListener("click", handleCheck);
  el.clearButton.addEventListener("click", handleClear);
  el.hintButton.addEventListener("click", handleHint);
  el.skipButton.addEventListener("click", handleSkip);
  el.nextButton.addEventListener("click", advance);
  el.bonusButton.addEventListener("click", handleBonusStart);

  const saved = loadProgress();
  if (saved) {
    state.results = saved.results.slice(0, REQUIRED_PUZZLES.length);
    state.bonusResult = saved.bonusResult;
  }
  if (state.results.length >= REQUIRED_PUZZLES.length) {
    showResults();
    return;
  }
  loadRequiredPuzzle(state.results.length);
}

init();
