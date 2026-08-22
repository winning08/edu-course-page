import {
  PUZZLE_GOAL, PUZZLE_START, parsePuzzleKey, puzzleKey, puzzleMoves, runPuzzleBfsRounds,
  runPuzzleDfs, summarizePuzzle, puzzlePathSteps,
} from "./game-core.js?v=2026081902";

const $ = (selector) => document.querySelector(selector);
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const bfs = runPuzzleBfsRounds();
const dfs = runPuzzleDfs();
const GOAL_KEY = puzzleKey(PUZZLE_GOAL);
let roundIndex = 0;
let revealed = false;

const el = {
  start: $("#start-grid"), goal: $("#goal-grid"), label: $("#round-label"), bar: $("#progress-bar"),
  badge: $("#round-badge"), title: $("#round-title"), note: $("#round-note"), levels: $("#search-levels"),
  reveal: $("#reveal-round"), next: $("#next-round"),
  feedback: $("#round-feedback"), trace: $("#trace-panel"), results: $("#puzzle-results"),
  summary: $("#puzzle-summary"), path: $("#path-list"), dfs: $("#dfs-summary"), projector: $("#projector-toggle"),
};

// 02-1/02-2/02-3을 한 번에 한 화면만 보여주는 단계 컨트롤러.
// 새로고침·뒤로가기에도 진행 상태가 이상해지지 않도록 sessionStorage(같은 탭 한정)에만 저장한다.
const STEP_STORAGE_KEY = "search-eight-puzzle:step:v1";
const STEP_TOTAL = 3;
const STEP_LABELS = { 1: "직접 맞추기", 2: "BFS 층별 관찰", 3: "결과 정리" };

const stepEl = {
  panels: { 1: document.querySelector('[data-step-panel="1"]'), 2: document.querySelector('[data-step-panel="2"]'), 3: document.querySelector('[data-step-panel="3"]') },
  tabs: { 1: document.querySelector('[data-step-tab="1"]'), 2: document.querySelector('[data-step-tab="2"]'), 3: document.querySelector('[data-step-tab="3"]') },
  prev: $("#step-prev"), next: $("#step-next"), status: $("#step-nav-status"), hint: $("#step-nav-hint"),
  goto2: $("#goto-step-2"),
};

function loadStepState() {
  try {
    const raw = sessionStorage.getItem(STEP_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const step1Done = data.step1Done === true;
    const step2Done = data.step2Done === true && step1Done;
    let step = Number(data.step);
    if (!Number.isInteger(step) || step < 1 || step > STEP_TOTAL) step = 1;
    if (step > 1 && !step1Done) step = 1;
    if (step > 2 && !step2Done) step = 2;
    return { step, step1Done, step2Done };
  } catch {
    return { step: 1, step1Done: false, step2Done: false };
  }
}

const stepState = loadStepState();

// 로컬 개발 편의: localhost/127.0.0.1에서만 ?preview=1|2|3으로 해당 단계와 그 이전 단계의 잠금을
// 임시로 해제해 바로 보여준다. 다른 호스트(GitHub Pages 등)에서는 쿼리를 완전히 무시하고,
// 아래 saveStepState()가 아무것도 쓰지 않으므로 세션 저장소나 기존 학생 진행도도 건드리지 않는다.
const LOCAL_PREVIEW_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);
function readPreviewStep() {
  if (!LOCAL_PREVIEW_HOSTNAMES.has(location.hostname)) return null;
  const step = Number(new URLSearchParams(location.search).get("preview"));
  if (!Number.isInteger(step) || step < 1 || step > STEP_TOTAL) return null;
  return step;
}
const previewStep = readPreviewStep();
const previewActive = previewStep !== null;
if (previewActive) {
  stepState.step1Done = previewStep >= 2;
  stepState.step2Done = previewStep >= 3;
  stepState.step = previewStep;
  const previewBadge = document.getElementById("preview-badge");
  const previewBadgeStep = document.getElementById("preview-badge-step");
  if (previewBadgeStep) previewBadgeStep.textContent = String(previewStep);
  if (previewBadge) previewBadge.hidden = false;
}

function saveStepState() {
  if (previewActive) return;
  try { sessionStorage.setItem(STEP_STORAGE_KEY, JSON.stringify(stepState)); } catch { /* 저장소 접근 불가 환경에서는 진행 상황 저장을 건너뛴다 */ }
}

function maxUnlockedStep() {
  if (stepState.step2Done) return 3;
  if (stepState.step1Done) return 2;
  return 1;
}

function renderStepNav() {
  const max = maxUnlockedStep();
  [1, 2, 3].forEach((n) => {
    const unlocked = n <= max;
    stepEl.tabs[n].disabled = !unlocked;
    stepEl.tabs[n].setAttribute("aria-current", n === stepState.step ? "step" : "false");
    stepEl.tabs[n].setAttribute("aria-label", unlocked ? `${n}단계 ${STEP_LABELS[n]}` : `${n}단계 ${STEP_LABELS[n]}, 아직 잠겨 있음`);
    const small = stepEl.tabs[n].querySelector("small");
    if (small) small.textContent = unlocked ? `02-${n}` : `02-${n} · 잠김`;
  });
  stepEl.prev.disabled = stepState.step <= 1;
  stepEl.next.disabled = stepState.step >= max;
  stepEl.status.textContent = `${stepState.step} / ${STEP_TOTAL}단계 · ${STEP_LABELS[stepState.step]}`;
  const waitingOnCurrentStep = stepState.step === max && stepState.step < STEP_TOTAL;
  stepEl.hint.hidden = !waitingOnCurrentStep;
  stepEl.hint.textContent = stepState.step === 1
    ? "먼저 8-퍼즐을 완성하면 다음 단계로 이동할 수 있어요."
    : "BFS 탐색을 끝까지 진행하면 다음 단계로 이동할 수 있어요.";
}

function goToStep(step, { focus = true } = {}) {
  const target = Math.min(Math.max(step, 1), maxUnlockedStep());
  stepState.step = target;
  saveStepState();
  [1, 2, 3].forEach((n) => { stepEl.panels[n].hidden = n !== target; });
  renderStepNav();
  if (!focus) return;
  const heading = stepEl.panels[target].querySelector('h1, h2, [tabindex="-1"]');
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus();
}

function markStep1Done() {
  if (stepState.step1Done) return;
  stepState.step1Done = true;
  saveStepState();
  renderStepNav();
}

function markStep2Done() {
  if (stepState.step2Done) return;
  stepState.step2Done = true;
  saveStepState();
  renderStepNav();
}

function describe(state) {
  return [state.slice(0, 3), state.slice(3, 6), state.slice(6, 9)].map((row) => row.map((n) => n || "빈칸").join(" ")).join(", ");
}

function grid(state, size = "medium", { emphasizeGoal = false } = {}) {
  const isGoal = emphasizeGoal && puzzleKey(state) === GOAL_KEY;
  const wrap = document.createElement("div");
  wrap.className = `puzzle-grid puzzle-grid--${size}${isGoal ? " puzzle-grid--goal" : ""}`;
  wrap.setAttribute("role", "img");
  // 공개(reveal) 전까지는 카드에 별도 배지를 붙이지 않으므로(카드 크기 유지),
  // 화면에 보이지 않는 aria-label로만 스크린 리더에 목표 상태임을 알린다.
  wrap.setAttribute("aria-label", isGoal ? `${describe(state)}, 목표 상태` : describe(state));
  state.forEach((number) => {
    const tile = document.createElement("span");
    tile.className = `puzzle-tile${number === 0 ? " is-blank" : ""}`;
    tile.textContent = number || "";
    wrap.appendChild(tile);
  });
  return wrap;
}

// 탐색 중 나타나는 상태가 목표 상태와 같으면 카드 크기·테두리 두께는 그대로 두고 색상만 강조한다.
// 문구는 배지를 새로 붙이지 않고, 공개 시 state-chip 문구("새 상태")를 "목표 상태"로 대체한다(revealRound 참고).
function markGoalCard(card, key) {
  if (key !== GOAL_KEY) return;
  card.classList.add("is-goal");
}

function placeGrid(container, state, size) {
  container.innerHTML = "";
  container.appendChild(grid(state, size));
}

function createInitialLevel() {
  const level = document.createElement("section");
  level.className = "search-level is-initial";
  level.dataset.depth = "0";
  level.innerHTML = '<div class="level-label"><strong>초기 상태</strong><span>탐색 시작점</span></div><div class="level-states"></div>';
  const card = document.createElement("article");
  card.className = "puzzle-candidate state-expander";
  card.dataset.key = puzzleKey(PUZZLE_START);
  card.setAttribute("role", "button"); card.tabIndex = 0;
  card.innerHTML = "<p>깊이 0</p>";
  card.appendChild(grid(PUZZLE_START, "small", { emphasizeGoal: true }));
  markGoalCard(card, card.dataset.key);
  level.querySelector(".level-states").appendChild(card);
  el.levels.appendChild(level);
}

function candidateLevel(round) {
  let level = el.levels.querySelector(`[data-depth="${round.depth}"]`);
  if (level) return level;
  level = document.createElement("section");
  level.className = "search-level is-current";
  level.dataset.depth = String(round.depth);
  level.innerHTML = `<div class="level-label"><strong>${round.depth}층</strong><span>숫자판을 눌러 추가</span></div><div class="level-states"></div>`;
  el.levels.appendChild(level);
  level.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "nearest" });
  return level;
}

function expandState(card) {
  if (card.dataset.expanded === "true") return;
  const round = bfs.rounds[roundIndex];
  if (!round.frontierBefore.includes(card.dataset.key)) return;
  card.dataset.expanded = "true"; card.classList.add("is-expanded"); card.removeAttribute("role"); card.removeAttribute("tabindex");
  const level = candidateLevel(round), states = level.querySelector(".level-states");
  puzzleMoves(parsePuzzleKey(card.dataset.key)).forEach((move) => {
    const key = puzzleKey(move.state);
    const child = document.createElement("article"); child.className = "puzzle-candidate"; child.dataset.key = key;
    child.innerHTML = `<p>빈칸 ${move.dirLabel}</p>`; child.appendChild(grid(move.state, "small", { emphasizeGoal: true }));
    markGoalCard(child, key);
    states.appendChild(child);
  });
  const expanded = round.frontierBefore.filter((key) => el.levels.querySelector(`[data-key="${key}"][data-expanded="true"]`)).length;
  level.querySelector(".level-label span").textContent = `${states.children.length}개 후보 표시`;
  el.note.textContent = `${round.frontierBefore.length}개 상태 중 ${expanded}개를 펼쳤습니다.`;
  if (expanded === round.frontierBefore.length) { el.reveal.hidden = false; el.reveal.focus(); }
}

function showRound() {
  const round = bfs.rounds[roundIndex];
  revealed = false;
  el.label.textContent = `활동 02-2 · BFS ${round.depth}층 탐색`;
  el.bar.style.width = `${Math.round(((roundIndex + 1) / bfs.rounds.length) * 100)}%`;
  el.badge.textContent = `${round.depth}층`;
  el.note.textContent = `${round.frontierBefore.length}개 숫자판을 차례로 눌러 다음 상태를 확인하세요.`;
  const parentLevel = el.levels.querySelector(`[data-depth="${round.depth - 1}"]`);
  parentLevel?.classList.add("is-current");
  round.frontierBefore.forEach((key) => {
    const card = parentLevel?.querySelector(`[data-key="${key}"]`);
    if (!card) return;
    card.classList.add("state-expander"); card.setAttribute("role", "button"); card.tabIndex = 0;
  });
  el.reveal.hidden = true;
  el.next.hidden = true;
  el.feedback.hidden = true;
}

function revealRound() {
  if (revealed) return;
  revealed = true;
  const round = bfs.rounds[roundIndex];
  const newStates = new Set(round.newStates);
  const currentLevel = el.levels.querySelector(`[data-depth="${round.depth}"]`);
  const seenThisLevel = new Set();
  let newCount = 0;
  let duplicateCount = 0;
  [...currentLevel.querySelectorAll(".puzzle-candidate")].forEach((card) => {
    const key = card.dataset.key;
    const isNew = newStates.has(key) && !seenThisLevel.has(key);
    seenThisLevel.add(key);
    if (isNew) newCount += 1; else duplicateCount += 1;
    card.dataset.kind = isNew ? "new" : "duplicate";
    const chip = document.createElement("strong");
    chip.className = "state-chip";
    // 목표 상태가 "새 상태"로 판정될 때만 문구를 "목표 상태"로 대체한다(별도 배지 없이, 카드 높이 유지).
    // 이미 방문해 제외되는 중복 상태라면(이 활동 구성에서는 실제로 일어나지 않지만) "새로 찾았다"는
    // 오해를 막기 위해 목표 여부와 무관하게 원래의 "중복 상태 · 제외" 문구를 그대로 남긴다.
    chip.textContent = isNew ? (key === GOAL_KEY ? "목표 상태" : "새 상태") : "중복 상태 · 제외";
    card.appendChild(chip);
  });
  currentLevel.classList.add("is-revealed");
  el.feedback.hidden = false;
  el.feedback.className = "step-feedback correct";
  el.feedback.innerHTML = `<strong>${round.depth}층 확인 완료</strong><p>새 상태 ${newCount}개를 남기고, 이미 본 상태 ${duplicateCount}개는 제외했습니다.${round.containsGoal ? " 목표 상태도 찾았습니다." : ""}</p>`;
  el.reveal.hidden = true;
  el.next.textContent = round.containsGoal || roundIndex === bfs.rounds.length - 1 ? "결과 보기 →" : "다음 층 보기 →";
  el.next.hidden = false;
  el.next.focus();
}

function buildResults() {
  const stats = summarizePuzzle(bfs, dfs);
  el.trace.classList.add("is-complete");
  el.reveal.hidden = true;
  el.next.hidden = true;
  el.feedback.hidden = true;
  el.results.hidden = false;
  el.summary.textContent = `BFS는 ${stats.bfsOpened}개 상태를 확인하고 ${stats.bfsMoves}번 이동하는 최소 경로를 찾았습니다.`;
  el.dfs.textContent = `BFS는 가까운 층을 모두 확인하므로 최소 이동을 보장합니다. 같은 순서로 깊게 들어가는 DFS는 이 예에서 ${stats.dfsMoves}번 이동한 뒤 목표에 도착해 최소 이동을 보장하지 못했습니다.`;
  el.path.innerHTML = "";
  puzzlePathSteps(bfs).forEach((step, index, steps) => {
    const item = document.createElement("li");
    item.innerHTML = `<span>${index === 0 ? "초기 상태" : `빈칸 ${step.dirLabel}`}</span>`;
    item.appendChild(grid(parsePuzzleKey(step.key), "small"));
    if (index === steps.length - 1) item.insertAdjacentHTML("beforeend", "<strong>목표 상태</strong>");
    el.path.appendChild(item);
  });
}

function finish({ focus = true } = {}) {
  buildResults();
  markStep2Done();
  goToStep(3, { focus: false });
  if (focus) el.results.querySelector("h2").focus();
}

el.reveal.addEventListener("click", revealRound);
el.levels.addEventListener("click", (event) => { const card=event.target.closest(".state-expander"); if(card) expandState(card); });
el.levels.addEventListener("keydown", (event) => { if((event.key==="Enter"||event.key===" ")&&event.target.matches(".state-expander")){event.preventDefault();expandState(event.target);} });
el.next.addEventListener("click", () => {
  const round = bfs.rounds[roundIndex];
  if (round.containsGoal || roundIndex === bfs.rounds.length - 1) finish();
  else { roundIndex += 1; showRound(); }
});
el.projector.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("projector-mode");
  el.projector.setAttribute("aria-pressed", String(enabled));
});

stepEl.tabs[1].addEventListener("click", () => goToStep(1));
stepEl.tabs[2].addEventListener("click", () => goToStep(2));
stepEl.tabs[3].addEventListener("click", () => goToStep(3));
stepEl.prev.addEventListener("click", () => goToStep(stepState.step - 1));
stepEl.next.addEventListener("click", () => goToStep(stepState.step + 1));
stepEl.goto2?.addEventListener("click", () => goToStep(2));
document.addEventListener("eight-puzzle:play-complete", () => {
  markStep1Done();
  goToStep(2);
});

placeGrid(el.start, PUZZLE_START, "medium");
placeGrid(el.goal, PUZZLE_GOAL, "medium");
createInitialLevel();
showRound();

// 새로고침 등으로 02-2를 이미 완료한 상태가 복원되면, 결정론적으로 다시 계산 가능한
// 결과 화면 내용만 조용히(포커스 이동 없이) 재구성해 둔다. 마지막으로 보던 단계는 그대로 유지한다.
if (stepState.step2Done) buildResults();
goToStep(stepState.step, { focus: false });
