import { puzzleKey, puzzleMoves } from "../search-eight-puzzle/game-core.js";

const START = [2, 8, 3, 1, 0, 4, 7, 6, 5];
const GOAL = [1, 2, 3, 8, 0, 4, 7, 6, 5];
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
  }
}

place("theory-start", START);
place("theory-goal", GOAL);
renderMaker();
document.getElementById("maker-reset").addEventListener("click", () => {
  renderMaker();
  document.getElementById("maker-feedback").textContent = "초기 상태로 돌아왔습니다. 빈칸 옆의 숫자를 누르세요.";
});
