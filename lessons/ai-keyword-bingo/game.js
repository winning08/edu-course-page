import { KEYWORDS } from "./keywords.js";
import {
  TOTAL_KEYWORDS, PHASES,
  createSession, toggleChecked, startDraw, drawNext, undoLastDraw,
  resetDraw, currentTerm, isDrawComplete, serializeSession, deserializeSession,
} from "./game-core.js";

const STORAGE_KEY = "ai-keyword-bingo:v1";

const $ = (selector) => document.querySelector(selector);
const elements = {
  prepView: $("#prep-view"),
  progressCount: $("#prep-progress-count"),
  printBoardButton: $("#print-board-button"),
  boardPrintGrid: $("#board-print-grid"),
  startDrawButton: $("#start-draw-button"),
  confirmStartOverlay: $("#confirm-start-overlay"),
  confirmStartCancel: $("#confirm-start-cancel"),
  confirmStartOk: $("#confirm-start-ok"),
  drawView: $("#draw-view"),
  drawCount: $("#draw-count"),
  drawCurrent: $("#draw-current"),
  termBoard: $("#term-board"),
  drawNextButton: $("#draw-next-button"),
  drawUndoButton: $("#draw-undo-button"),
  drawResetButton: $("#draw-reset-button"),
  resetConfirmOverlay: $("#reset-confirm-overlay"),
  resetConfirmCancel: $("#reset-confirm-cancel"),
  resetConfirmOk: $("#reset-confirm-ok"),
  fullscreenToggle: $("#fullscreen-toggle"),
};

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return deserializeSession(raw) ?? createSession();
  } catch {
    return createSession();
  }
}

function saveSession() {
  try {
    localStorage.setItem(STORAGE_KEY, serializeSession(session));
  } catch {
    // 저장 공간을 쓸 수 없어도 진행에는 지장이 없다.
  }
}

let session = loadSession();
let lastFocusedTrigger = null;

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isOverlayOpen() {
  return !elements.confirmStartOverlay.hidden || !elements.resetConfirmOverlay.hidden;
}

function getOpenOverlay() {
  if (!elements.confirmStartOverlay.hidden) return elements.confirmStartOverlay;
  if (!elements.resetConfirmOverlay.hidden) return elements.resetConfirmOverlay;
  return null;
}

function openOverlay(overlay, trigger) {
  lastFocusedTrigger = trigger ?? document.activeElement;
  overlay.hidden = false;
  overlay.querySelector("button")?.focus();
}

function closeOverlay(overlay) {
  overlay.hidden = true;
  lastFocusedTrigger?.focus();
  lastFocusedTrigger = null;
}

function trapOverlayFocus(event) {
  const overlay = getOpenOverlay();
  if (!overlay) return;
  const focusable = Array.from(overlay.querySelectorAll(FOCUSABLE_SELECTOR));
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !overlay.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !overlay.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}

function renderPrintableBoard() {
  elements.boardPrintGrid.innerHTML = Array.from({ length: TOTAL_KEYWORDS })
    .map(() => `<div class="board-print-cell"></div>`)
    .join("");
}

function syncPrepCheckboxes() {
  KEYWORDS.forEach((term, index) => {
    const checkbox = document.getElementById(`term-check-${index}`);
    if (checkbox) checkbox.checked = session.checkedTerms.includes(term);
  });
  elements.progressCount.textContent = String(session.checkedTerms.length);
}

// 25개 용어를 겹치지 않는 무작위 위치에 흩뿌려 놓는다(격자 배치 대신).
// 위치 계산은 실제 렌더링된 칩 크기를 측정해야 하므로, 컨테이너가 화면에 보일 때(너비 > 0)까지 미룬다 —
// 가드가 아직 콘텐츠를 숨기고 있거나(#guard-content pending) 아직 준비 화면이라 draw-view 자체가 hidden이면
// 너비가 0으로 측정되어 전부 한 점에 겹쳐 버리기 때문이다(ResizeObserver로 실제로 드러나는 시점을 기다린다).
const TERM_BOARD_MARGIN = 14;
const termTileByTerm = new Map();
let termBoardPositioned = false;
let termBoardObserver = null;

function buildTermBoardTiles() {
  elements.termBoard.innerHTML = KEYWORDS.map((term) => (
    `<li class="term-tile" data-term="${term}"><span class="term-order-badge" aria-hidden="true"></span><span class="term-label">${term}</span></li>`
  )).join("");
  termTileByTerm.clear();
  elements.termBoard.querySelectorAll("li").forEach((li) => {
    termTileByTerm.set(li.dataset.term, li);
  });
}

function tilesOverlap(a, b) {
  return (
    a.x < b.x + b.w + TERM_BOARD_MARGIN && a.x + a.w + TERM_BOARD_MARGIN > b.x &&
    a.y < b.y + b.h + TERM_BOARD_MARGIN && a.y + a.h + TERM_BOARD_MARGIN > b.y
  );
}

function placeTermBoardTiles() {
  const { width, height } = elements.termBoard.getBoundingClientRect();
  if (width === 0 || height === 0) return false;

  const placed = [];
  KEYWORDS.forEach((term) => {
    const el = termTileByTerm.get(term);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const maxX = Math.max(0, width - w);
    const maxY = Math.max(0, height - h);
    let candidate = { x: 0, y: 0, w, h };
    let placedOk = false;

    for (let attempt = 0; attempt < 300 && !placedOk; attempt += 1) {
      candidate = { x: Math.random() * maxX, y: Math.random() * maxY, w, h };
      placedOk = !placed.some((other) => tilesOverlap(candidate, other));
    }

    if (!placedOk) {
      // 무작위 시도로 빈 자리를 못 찾으면 중심에서 바깥으로 나선형으로 훑으며 자리를 찾는다(안전망).
      const cx = maxX / 2;
      const cy = maxY / 2;
      let angle = 0;
      let radius = 0;
      for (let step = 0; step < 3000 && !placedOk; step += 1) {
        candidate = {
          x: Math.min(Math.max(cx + radius * Math.cos(angle), 0), maxX),
          y: Math.min(Math.max(cy + radius * Math.sin(angle), 0), maxY),
          w, h,
        };
        placedOk = !placed.some((other) => tilesOverlap(candidate, other));
        angle += 0.7;
        radius += 0.9;
      }
    }

    placed.push(candidate);
    el.style.left = `${candidate.x}px`;
    el.style.top = `${candidate.y}px`;
  });

  return true;
}

function ensureTermBoardLayout() {
  if (termBoardPositioned) return;
  if (placeTermBoardTiles()) {
    termBoardPositioned = true;
    termBoardObserver?.disconnect();
    return;
  }
  if (!termBoardObserver) {
    termBoardObserver = new ResizeObserver(() => ensureTermBoardLayout());
    termBoardObserver.observe(elements.termBoard);
  }
}

function renderTermBoard() {
  const drawOrderByTerm = new Map(session.drawOrder.map((term, index) => [term, index + 1]));
  const current = currentTerm(session);

  KEYWORDS.forEach((term) => {
    const li = termTileByTerm.get(term);
    const order = drawOrderByTerm.get(term);
    li.classList.toggle("is-drawn", Boolean(order));
    li.classList.toggle("is-current", term === current);
    li.setAttribute("aria-label", order ? `${term}, ${order}번째로 뽑힘` : term);
    li.querySelector(".term-order-badge").textContent = order ?? "";
  });

  ensureTermBoardLayout();
}

function renderDrawStatus() {
  const drawnCount = session.drawOrder.length;
  elements.drawCount.textContent = `${drawnCount} / ${TOTAL_KEYWORDS}`;

  const term = currentTerm(session);
  elements.drawCurrent.classList.remove("is-placeholder", "is-complete");
  if (isDrawComplete(session)) {
    elements.drawCurrent.textContent = `마지막 용어: ${term} · 25개를 모두 뽑았습니다`;
    elements.drawCurrent.classList.add("is-complete");
  } else if (term) {
    elements.drawCurrent.textContent = `방금 뽑힌 용어: ${term}`;
  } else {
    elements.drawCurrent.textContent = "아래 \"다음 뽑기\"를 눌러 첫 용어를 뽑아 주세요";
    elements.drawCurrent.classList.add("is-placeholder");
  }

  elements.drawNextButton.disabled = isDrawComplete(session);
  elements.drawUndoButton.disabled = drawnCount === 0;
  elements.drawResetButton.disabled = drawnCount === 0;

  renderTermBoard();
}

function showPhaseView() {
  const isDraw = session.phase === PHASES.DRAW;
  elements.prepView.hidden = isDraw;
  elements.drawView.hidden = !isDraw;
}

function handleStartDrawRequest() {
  openOverlay(elements.confirmStartOverlay, elements.startDrawButton);
}

function confirmStart() {
  startDraw(session);
  saveSession();
  closeOverlay(elements.confirmStartOverlay);
  showPhaseView();
  renderDrawStatus();
  elements.drawCurrent.focus();
}

function cancelStart() {
  closeOverlay(elements.confirmStartOverlay);
}

function handleDrawNext() {
  if (session.phase !== PHASES.DRAW || isDrawComplete(session)) return;
  const focusWasOnNextButton = document.activeElement === elements.drawNextButton;
  drawNext(session, Math.random);
  saveSession();
  renderDrawStatus();
  if (isDrawComplete(session) && focusWasOnNextButton) {
    elements.drawResetButton.focus();
  }
}

function handleUndo() {
  if (session.drawOrder.length === 0) return;
  undoLastDraw(session);
  saveSession();
  renderDrawStatus();
}

function handleResetRequest() {
  if (session.drawOrder.length === 0) return;
  openOverlay(elements.resetConfirmOverlay, elements.drawResetButton);
}

function confirmReset() {
  resetDraw(session);
  saveSession();
  closeOverlay(elements.resetConfirmOverlay);
  renderDrawStatus();
}

function cancelReset() {
  closeOverlay(elements.resetConfirmOverlay);
}

elements.printBoardButton.addEventListener("click", () => window.print());
elements.startDrawButton.addEventListener("click", handleStartDrawRequest);
elements.confirmStartCancel.addEventListener("click", cancelStart);
elements.confirmStartOk.addEventListener("click", confirmStart);
elements.drawNextButton.addEventListener("click", handleDrawNext);
elements.drawUndoButton.addEventListener("click", handleUndo);
elements.drawResetButton.addEventListener("click", handleResetRequest);
elements.resetConfirmCancel.addEventListener("click", cancelReset);
elements.resetConfirmOk.addEventListener("click", confirmReset);

elements.confirmStartOverlay.addEventListener("click", (event) => {
  if (event.target === elements.confirmStartOverlay) cancelStart();
});
elements.resetConfirmOverlay.addEventListener("click", (event) => {
  if (event.target === elements.resetConfirmOverlay) cancelReset();
});

document.querySelectorAll("#term-grid input[type=\"checkbox\"]").forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    toggleChecked(session, checkbox.dataset.term);
    saveSession();
    elements.progressCount.textContent = String(session.checkedTerms.length);
  });
});

elements.fullscreenToggle.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
});
document.addEventListener("fullscreenchange", () => {
  const isFullscreen = Boolean(document.fullscreenElement);
  document.body.classList.toggle("is-fullscreen", isFullscreen);
  elements.fullscreenToggle.setAttribute("aria-pressed", String(isFullscreen));
  elements.fullscreenToggle.textContent = isFullscreen ? "전체화면 종료" : "전체화면";
});

document.addEventListener("keydown", (event) => {
  if (isOverlayOpen()) {
    if (event.key === "Escape") {
      if (!elements.confirmStartOverlay.hidden) cancelStart();
      if (!elements.resetConfirmOverlay.hidden) cancelReset();
    } else if (event.key === "Tab") {
      trapOverlayFocus(event);
    }
    return;
  }
  if (session.phase !== PHASES.DRAW) return;
  const tag = (event.target?.tagName || "").toLowerCase();
  if (["input", "textarea", "button", "a"].includes(tag)) return;
  if (event.key === "Enter" || event.key === " " || event.code === "Space") {
    event.preventDefault();
    handleDrawNext();
  }
});

renderPrintableBoard();
syncPrepCheckboxes();
buildTermBoardTiles();
showPhaseView();
renderDrawStatus();
