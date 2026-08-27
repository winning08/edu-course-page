import { puzzleKey, puzzleMoves } from "../search-eight-puzzle/game-core.js";

const START = [1, 2, 3, 4, 0, 6, 7, 5, 8];
const GOAL = [1, 2, 3, 4, 5, 6, 7, 8, 0];
const MOVES = puzzleMoves(START);
const moveByKey = new Map(MOVES.map((move) => [puzzleKey(move.state), move]));
const made = new Map();
const connected = new Set();

function boardLabel(board) {
  return board.map((number) => number || "빈칸").join(", ");
}

function createBoard(board, { interactive = false } = {}) {
  const grid = document.createElement("div");
  grid.className = `theory-grid${interactive ? " is-interactive" : ""}`;
  if (!interactive) {
    grid.setAttribute("role", "img");
    grid.setAttribute("aria-label", boardLabel(board));
  }
  const movable = new Set(MOVES.map((move) => move.state.indexOf(0)));
  board.forEach((number, index) => {
    if (interactive && movable.has(index)) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.tileIndex = String(index);
      button.textContent = number;
      button.setAttribute("aria-label", `${number} 숫자를 빈칸으로 옮기기`);
      grid.appendChild(button);
      return;
    }
    const tile = document.createElement("span");
    tile.className = number === 0 ? "blank" : "";
    tile.textContent = number || "";
    grid.appendChild(tile);
  });
  return grid;
}

function place(id, board) {
  const target = document.getElementById(id);
  target.replaceChildren(createBoard(board));
}

function smallState(move, { button = false } = {}) {
  const item = document.createElement(button ? "button" : "article");
  if (button) item.type = "button";
  item.className = "state-card";
  item.dataset.stateKey = puzzleKey(move.state);
  const label = document.createElement("strong");
  label.textContent = `빈칸 ${move.dirLabel}`;
  item.append(label, createBoard(move.state));
  return item;
}

function renderMaker() {
  const board = document.getElementById("maker-board");
  board.replaceChildren(createBoard(START, { interactive: true }));
  board.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => makeState(Number(button.dataset.tileIndex))));
}

function makeState(tileIndex) {
  const next = START.slice();
  const blankIndex = next.indexOf(0);
  [next[blankIndex], next[tileIndex]] = [next[tileIndex], next[blankIndex]];
  const key = puzzleKey(next);
  const move = moveByKey.get(key);
  if (!move) return;
  const feedback = document.getElementById("maker-feedback");
  if (made.has(key)) {
    feedback.textContent = `빈칸 ${move.dirLabel} 상태는 이미 만들었습니다. 다른 숫자를 움직여 보세요.`;
    return;
  }
  made.set(key, move);
  const list = document.getElementById("made-states");
  list.querySelector(".empty-message")?.remove();
  list.appendChild(smallState(move));
  document.getElementById("made-count").textContent = `${made.size} / 4`;
  feedback.textContent = `빈칸 ${move.dirLabel} 상태를 만들었습니다. ${4 - made.size}개 남았습니다.`;
  if (made.size === MOVES.length) showTreeBuilder();
}

function showTreeBuilder() {
  const section = document.getElementById("tree-section");
  const candidates = document.getElementById("tree-candidates");
  MOVES.forEach((move) => {
    const candidate = smallState(move, { button: true });
    candidate.setAttribute("aria-pressed", "false");
    candidate.addEventListener("click", () => connectState(candidate, move));
    candidates.appendChild(candidate);
  });
  place("tree-parent-board", START);
  section.hidden = false;
  const heading = section.querySelector("h3");
  heading.tabIndex = -1;
  heading.focus();
}

function connectState(candidate, move) {
  const key = puzzleKey(move.state);
  if (connected.has(key)) return;
  connected.add(key);
  candidate.disabled = true;
  candidate.setAttribute("aria-pressed", "true");
  candidate.classList.add("is-connected");
  document.getElementById("tree-children").appendChild(smallState(move));
  document.getElementById("tree-progress").textContent = `${connected.size} / 4개 연결`;
  if (connected.size === MOVES.length) {
    document.getElementById("tree-depth-preview").hidden = false;
    const complete = document.getElementById("tree-complete");
    complete.hidden = false;
    complete.tabIndex = -1;
    complete.focus();
    document.getElementById("advanced-count-activity").hidden = false;
  }
}

place("theory-start", START);
place("theory-goal", GOAL);
renderMaker();
document.getElementById("maker-reset").addEventListener("click", () => {
  renderMaker();
  document.getElementById("maker-feedback").textContent = "초기 상태로 돌아왔습니다. 빈칸 옆의 숫자를 누르세요.";
});

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const EXCLUDE_REASON = {
  leadingZero: "세 자리 자연수 위반 · 백의 자리는 0이 될 수 없어요",
  duplicateSeven: "조건 (가) 위반 · 7은 이미 한 번 사용했어요",
  evenParity: "조건 (나) 위반 · 짝수이면 곱이 짝수가 돼요",
};

function digitStatus(digit, position) {
  if (position === "hundreds" && digit === 0) return { valid: false, reason: EXCLUDE_REASON.leadingZero };
  if (digit === 7) return { valid: false, reason: EXCLUDE_REASON.duplicateSeven };
  if (position !== "tens" && digit % 2 === 0) return { valid: false, reason: EXCLUDE_REASON.evenParity };
  return { valid: true, reason: "" };
}

const numberBranches = [
  {
    id: "hundreds",
    label: "백의 자리가 7",
    pattern: "7 _ _",
    expected: 36,
    slots: [
      { id: "tens", name: "십의 자리", depth: 2, requiredCount: 9 },
      { id: "ones", name: "일의 자리", depth: 3, requiredCount: 4 },
    ],
    formatPreview: (s0, s1) => `7 ${s0 ?? "_"} ${s1 ?? "_"}`,
    formatGoal: (s0, s1) => `7${s0}${s1}`,
    branchFormula: "1 × 9 × 4 = 36",
    ruleSummary: "십의 자리 9가지(7 제외) × 일의 자리 4가지(홀수 1,3,5,9) = 36개",
  },
  {
    id: "tens",
    label: "십의 자리가 7",
    pattern: "_ 7 _",
    expected: 16,
    slots: [
      { id: "hundreds", name: "백의 자리", depth: 2, requiredCount: 4 },
      { id: "ones", name: "일의 자리", depth: 3, requiredCount: 4 },
    ],
    formatPreview: (s0, s1) => `${s0 ?? "_"} 7 ${s1 ?? "_"}`,
    formatGoal: (s0, s1) => `${s0}7${s1}`,
    branchFormula: "4 × 1 × 4 = 16",
    ruleSummary: "백의 자리 4가지(홀수 1,3,5,9) × 일의 자리 4가지(홀수 1,3,5,9) = 16개",
  },
  {
    id: "ones",
    label: "일의 자리가 7",
    pattern: "_ _ 7",
    expected: 36,
    slots: [
      { id: "hundreds", name: "백의 자리", depth: 2, requiredCount: 4 },
      { id: "tens", name: "십의 자리", depth: 3, requiredCount: 9 },
    ],
    formatPreview: (s0, s1) => `${s0 ?? "_"} ${s1 ?? "_"} 7`,
    formatGoal: (s0, s1) => `${s0}${s1}7`,
    branchFormula: "4 × 9 × 1 = 36",
    ruleSummary: "백의 자리 4가지(홀수 1,3,5,9) × 십의 자리 9가지(7 제외) = 36개",
  },
];

let currentBranch = null;
let chosenSlot1Digit = null;
let slot1PrunedClicks = new Set();
let discoveredSlot2Valids = new Set();
let slot2PrunedClicks = new Set();

function setDepth(depth) {
  const depthEl = document.getElementById("number-tree-depth");
  if (depthEl) depthEl.textContent = String(depth);
}

function setFeedback(text) {
  const feedback = document.getElementById("number-tree-feedback");
  if (feedback) feedback.textContent = text;
}

function updatePathDisplay() {
  const container = document.getElementById("active-path-display");
  const stateEl = document.getElementById("number-current-state");
  if (!container) return;
  container.innerHTML = "";

  const rootSpan = document.createElement("span");
  rootSpan.className = "path-node is-active";
  rootSpan.textContent = "초기 상태 [ _ _ _ ]";
  container.appendChild(rootSpan);

  if (!currentBranch) {
    if (stateEl) stateEl.textContent = "_ _ _";
    return;
  }

  const arrow1 = document.createElement("span");
  arrow1.className = "path-arrow";
  arrow1.textContent = "→";
  arrow1.setAttribute("aria-hidden", "true");

  const branchSpan = document.createElement("span");
  branchSpan.className = "path-node is-active";
  branchSpan.textContent = `깊이 1 [ ${currentBranch.pattern} ]`;
  container.append(arrow1, branchSpan);

  if (chosenSlot1Digit === null) {
    if (stateEl) stateEl.textContent = currentBranch.pattern;
    return;
  }

  const arrow2 = document.createElement("span");
  arrow2.className = "path-arrow";
  arrow2.textContent = "→";
  arrow2.setAttribute("aria-hidden", "true");

  const s0Preview = currentBranch.formatPreview(chosenSlot1Digit, null);
  const slot1Span = document.createElement("span");
  slot1Span.className = "path-node is-active";
  slot1Span.textContent = `깊이 2 [ ${s0Preview} ]`;
  container.append(arrow2, slot1Span);

  if (discoveredSlot2Valids.size === 0) {
    if (stateEl) stateEl.textContent = s0Preview;
    return;
  }

  const arrow3 = document.createElement("span");
  arrow3.className = "path-arrow";
  arrow3.textContent = "→";
  arrow3.setAttribute("aria-hidden", "true");

  const slot2Span = document.createElement("span");
  slot2Span.className = "path-node is-active is-goal";
  slot2Span.textContent = `깊이 3 (${discoveredSlot2Valids.size}개 목표 상태 완성)`;
  container.append(arrow3, slot2Span);

  if (stateEl) stateEl.textContent = `${s0Preview} (${discoveredSlot2Valids.size}개 목표)`;
}

function renderPartialTree() {
  const container = document.getElementById("partial-tree-graph");
  if (!container) return;
  container.innerHTML = "";

  const tree = document.createElement("div");
  tree.className = "partial-tree-flow";

  // Level 0 (Root)
  const lvl0 = document.createElement("div");
  lvl0.className = "tree-lvl lvl-0";
  lvl0.innerHTML = `
    <div class="tree-lvl-badge">깊이 0 · 초기 상태</div>
    <div class="tree-node is-root is-active-path">
      <span class="node-val">_ _ _</span>
      <span class="node-tag">루트 상태</span>
    </div>
  `;
  tree.appendChild(lvl0);

  if (!currentBranch) {
    container.appendChild(tree);
    return;
  }

  // Connector 0 -> 1
  const conn0 = document.createElement("div");
  conn0.className = "tree-connector-line is-active-line";
  tree.appendChild(conn0);

  // Level 1 (Branch State)
  const lvl1 = document.createElement("div");
  lvl1.className = "tree-lvl lvl-1";
  lvl1.innerHTML = `
    <div class="tree-lvl-badge">깊이 1 · ${currentBranch.label}</div>
    <div class="tree-node is-branch is-active-path">
      <span class="node-val">${currentBranch.pattern}</span>
      <span class="node-tag">${currentBranch.label} 선택</span>
    </div>
  `;
  tree.appendChild(lvl1);

  if (chosenSlot1Digit === null) {
    container.appendChild(tree);
    return;
  }

  // Connector 1 -> 2
  const conn1 = document.createElement("div");
  conn1.className = "tree-connector-line is-active-line";
  tree.appendChild(conn1);

  // Level 2 (Slot 1 Chosen State)
  const lvl2 = document.createElement("div");
  lvl2.className = "tree-lvl lvl-2";
  const s0Preview = currentBranch.formatPreview(chosenSlot1Digit, null);
  lvl2.innerHTML = `
    <div class="tree-lvl-badge">깊이 2 · ${currentBranch.slots[0].name} (${chosenSlot1Digit}) 선택</div>
    <div class="tree-node is-valid is-active-path">
      <span class="node-val">${s0Preview}</span>
      <span class="node-tag">${currentBranch.slots[0].name}: ${chosenSlot1Digit}</span>
    </div>
  `;
  tree.appendChild(lvl2);

  // Connector 2 -> 3 (Fan-out)
  const conn2 = document.createElement("div");
  conn2.className = "tree-connector-line is-active-line";
  tree.appendChild(conn2);

  // Level 3 (Goal States Fan-out)
  const lvl3 = document.createElement("div");
  lvl3.className = "tree-lvl lvl-3";
  lvl3.innerHTML = `<div class="tree-lvl-badge">깊이 3 · ${currentBranch.slots[1].name} 목표 상태 분기 (현재 경로)</div>`;

  const fanRow = document.createElement("div");
  fanRow.className = "goal-fan-row";

  if (discoveredSlot2Valids.size === 0) {
    const emptyNote = document.createElement("p");
    emptyNote.className = "tree-empty-note";
    emptyNote.textContent = `${currentBranch.slots[1].name} 유효 숫자를 누르면 이곳에 목표 상태들이 연결됩니다.`;
    fanRow.appendChild(emptyNote);
  } else {
    const fanConnector = document.createElement("div");
    fanConnector.className = "goal-fan-connector";
    fanConnector.setAttribute("aria-hidden", "true");
    fanConnector.innerHTML = '<span class="stem"></span><span class="bar"></span>';
    lvl3.appendChild(fanConnector);
    // Render sorted goal nodes
    const sortedValids = Array.from(discoveredSlot2Valids).sort((a, b) => a - b);
    sortedValids.forEach((digit) => {
      const goalNum = currentBranch.formatGoal(chosenSlot1Digit, digit);
      const node = document.createElement("div");
      node.className = "tree-node is-goal is-valid is-active-goal";
      node.innerHTML = `
        <span class="node-val">${goalNum}</span>
        <span class="node-tag">✓ 목표 상태</span>
      `;
      fanRow.appendChild(node);
    });
  }

  lvl3.appendChild(fanRow);
  tree.appendChild(lvl3);

  container.appendChild(tree);
}

function handleSlot1DigitClick(digit) {
  const status = digitStatus(digit, currentBranch.slots[0].id);

  if (status.valid) {
    chosenSlot1Digit = digit;
    setDepth(2);
    updatePathDisplay();
    renderSlot1Grid();
    renderSlot2Step();
    renderPartialTree();
    setFeedback(`✓ ${currentBranch.slots[0].name}에 ${digit}을 선택하여 부분 상태 [${currentBranch.formatPreview(digit, null)}]로 이동했습니다. ${currentBranch.slots[1].name}의 유효 숫자를 모두 찾으세요.`);
  } else {
    slot1PrunedClicks.add(digit);
    renderSlot1Grid();
    setFeedback(`❌ [숫자 ${digit}] 제외: ${status.reason} (가지치기)`);
  }
}

function handleSlot2DigitClick(digit) {
  const status = digitStatus(digit, currentBranch.slots[1].id);
  const reqCount = currentBranch.slots[1].requiredCount;

  if (status.valid) {
    discoveredSlot2Valids.add(digit);
    setDepth(3);
    updatePathDisplay();
    renderSlot2Grid();
    renderPartialTree();

    const goal = currentBranch.formatGoal(chosenSlot1Digit, digit);
    setFeedback(`✓ 목표 상태 [${goal}] 도달! (${discoveredSlot2Valids.size} / ${reqCount}개 발견)`);

    if (discoveredSlot2Valids.size === reqCount) {
      // Partial Tree for this path is complete!
      const solution = document.getElementById("count-solution");
      const pathSummary = document.getElementById("solution-path-summary");
      if (solution) {
        solution.hidden = false;
        if (pathSummary) {
          pathSummary.textContent = `방금 완성한 부분 트리는 ${currentBranch.slots[0].name}가 '${chosenSlot1Digit}'일 때의 ${reqCount}개 목표 상태입니다. ${currentBranch.slots[0].name}의 다른 ${currentBranch.slots[0].requiredCount}가지 유효 숫자에서도 각각 ${reqCount}개씩 만들어지므로 이 가지는 총 ${currentBranch.branchFormula}가지가 됩니다. 세 가지를 모두 합치면 36 + 16 + 36 = 88개가 됩니다.`;
        }
        solution.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      setFeedback(`🎉 [${currentBranch.formatPreview(chosenSlot1Digit, null)}] 경로의 부분 탐색 트리를 완성했습니다! 아래에서 전체 88개 경우의 수 확장 원리를 확인하세요.`);
    }
  } else {
    slot2PrunedClicks.add(digit);
    renderSlot2Grid();
    setFeedback(`❌ [숫자 ${digit}] 제외: ${status.reason} (가지치기)`);
  }
}

function renderSlot1Grid() {
  const grid = document.getElementById("slot1-digit-grid");
  if (!grid) return;
  grid.innerHTML = "";

  DIGITS.forEach((digit) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.digit = String(digit);

    if (chosenSlot1Digit === digit) {
      btn.className = "digit-btn is-valid is-selected";
      btn.setAttribute("aria-pressed", "true");
      btn.setAttribute("aria-label", `숫자 ${digit} (선택된 유효 경로)`);
      btn.innerHTML = `<span class="digit-val">${digit}</span><span class="digit-badge">선택됨 ✓</span>`;
    } else if (slot1PrunedClicks.has(digit)) {
      btn.className = "digit-btn is-excluded";
      btn.setAttribute("aria-pressed", "false");
      const status = digitStatus(digit, currentBranch.slots[0].id);
      btn.setAttribute("aria-label", `숫자 ${digit} 제외: ${status.reason}`);
      btn.innerHTML = `<span class="digit-val is-strikethrough">${digit}</span><span class="digit-badge">제외 ✕</span>`;
    } else {
      btn.className = "digit-btn is-neutral";
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", `후보 숫자 ${digit}`);
      btn.innerHTML = `<span class="digit-val">${digit}</span>`;
    }

    btn.addEventListener("click", () => handleSlot1DigitClick(digit));
    grid.appendChild(btn);
  });
}

function renderSlot2Step() {
  const step2 = document.getElementById("step-slot2-select");
  const heading = document.getElementById("slot2-heading");
  const progressBadge = document.getElementById("slot2-progress-badge");
  if (!step2) return;

  step2.hidden = false;
  if (heading) {
    heading.textContent = `${currentBranch.slots[1].name} 모든 목표 상태 완성 (부분 상태: ${currentBranch.formatPreview(chosenSlot1Digit, null)})`;
  }
  if (progressBadge) {
    const req = currentBranch.slots[1].requiredCount;
    progressBadge.textContent = `${discoveredSlot2Valids.size} / ${req}개 발견`;
    progressBadge.className = `slot-progress-badge ${discoveredSlot2Valids.size === req ? "is-all-found" : ""}`;
  }

  renderSlot2Grid();
}

function renderSlot2Grid() {
  const grid = document.getElementById("slot2-digit-grid");
  const progressBadge = document.getElementById("slot2-progress-badge");
  if (progressBadge && currentBranch) {
    const req = currentBranch.slots[1].requiredCount;
    progressBadge.textContent = `${discoveredSlot2Valids.size} / ${req}개 발견`;
    progressBadge.className = `slot-progress-badge ${discoveredSlot2Valids.size === req ? "is-all-found" : ""}`;
  }
  if (!grid) return;
  grid.innerHTML = "";

  DIGITS.forEach((digit) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.digit = String(digit);

    if (discoveredSlot2Valids.has(digit)) {
      btn.className = "digit-btn is-valid is-selected";
      btn.setAttribute("aria-pressed", "true");
      btn.setAttribute("aria-label", `목표 숫자 ${digit} (유효)`);
      btn.innerHTML = `<span class="digit-val">${digit}</span><span class="digit-badge">유효 ✓</span>`;
    } else if (slot2PrunedClicks.has(digit)) {
      btn.className = "digit-btn is-excluded";
      btn.setAttribute("aria-pressed", "false");
      const status = digitStatus(digit, currentBranch.slots[1].id);
      btn.setAttribute("aria-label", `숫자 ${digit} 제외: ${status.reason}`);
      btn.innerHTML = `<span class="digit-val is-strikethrough">${digit}</span><span class="digit-badge">제외 ✕</span>`;
    } else {
      btn.className = "digit-btn is-neutral";
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", `후보 숫자 ${digit}`);
      btn.innerHTML = `<span class="digit-val">${digit}</span>`;
    }

    btn.addEventListener("click", () => handleSlot2DigitClick(digit));
    grid.appendChild(btn);
  });
}

function selectBranch(branch, button) {
  currentBranch = branch;
  chosenSlot1Digit = null;
  slot1PrunedClicks = new Set();
  discoveredSlot2Valids = new Set();
  slot2PrunedClicks = new Set();

  document.querySelectorAll(".branch-card").forEach((btn) => {
    btn.classList.remove("is-selected");
    btn.setAttribute("aria-selected", "false");
  });
  if (button) {
    button.classList.add("is-selected");
    button.setAttribute("aria-selected", "true");
  }

  setDepth(1);
  updatePathDisplay();

  const step1 = document.getElementById("step-slot1-select");
  const step2 = document.getElementById("step-slot2-select");
  const solution = document.getElementById("count-solution");
  const slot1Heading = document.getElementById("slot1-heading");

  if (step1) step1.hidden = false;
  if (step2) step2.hidden = true;
  if (solution) solution.hidden = true;
  if (slot1Heading) slot1Heading.textContent = `${branch.slots[0].name} 숫자 선택 (0~9 중 유효 숫자 1개)`;

  renderSlot1Grid();
  renderPartialTree();
  setFeedback(`${branch.label} (${branch.pattern})을 선택했습니다. ${branch.slots[0].name}의 유효한 숫자 하나를 누르세요.`);
}

function renderBranchCards() {
  const container = document.getElementById("branch-cards-container");
  if (!container) return;
  container.innerHTML = "";

  numberBranches.forEach((branch, idx) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "branch-card";
    button.dataset.branch = branch.id;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", "false");

    button.innerHTML = `
      <div class="branch-card-header">
        <span class="branch-tag">가지 ${idx + 1}</span>
        <span class="branch-yield">${branch.branchFormula}개</span>
      </div>
      <strong class="branch-pattern">${branch.pattern}</strong>
      <span class="branch-label">${branch.label}</span>
    `;

    button.addEventListener("click", () => selectBranch(branch, button));
    container.appendChild(button);
  });
}

renderBranchCards();
renderPartialTree();

const countAnswerQuiz = document.getElementById("count-answer-quiz");
const countAnswerInput = document.getElementById("count-answer");
const countAnswerFeedback = document.getElementById("count-answer-feedback");
const numberTreeLab = document.getElementById("number-tree-lab");

countAnswerQuiz?.addEventListener("submit", (event) => {
  event.preventDefault();
  const answer = Number(countAnswerInput.value);
  if (answer !== 88) {
    countAnswerQuiz.classList.remove("is-correct");
    countAnswerQuiz.classList.add("is-incorrect");
    countAnswerFeedback.textContent = "아직 정답이 아닙니다. 7이 들어갈 자리를 세 가지로 나누어 다시 생각해 보세요.";
    return;
  }

  countAnswerQuiz.classList.remove("is-incorrect");
  countAnswerQuiz.classList.add("is-correct");
  countAnswerFeedback.textContent = "정답입니다! 이제 아래 상태를 눌러 부분 탐색 트리를 만들어 보세요.";
  countAnswerInput.disabled = true;
  countAnswerQuiz.querySelector('button[type="submit"]').disabled = true;
  numberTreeLab.hidden = false;
});
