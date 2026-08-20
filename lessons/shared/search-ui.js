// '인공지능과 탐색' 세 활동이 함께 쓰는 지도·후보 카드 DOM 렌더링 헬퍼(브라우저 전용, 화면 그리기만 담당).
import { ROWS, COLS, WALL_LAYOUT, SNOW_COST, cellId, START, GOAL } from "./search-lab.js";

const START_ID = cellId(START.row, START.col);
const GOAL_ID = cellId(GOAL.row, GOAL.col);

// statesById: { [cellId]: "visited" | "frontier" | "current" | "path" } — 기본값은 미방문.
export function renderMap(gridEl, { statesById = {}, profile = "flat", label } = {}) {
  gridEl.setAttribute("role", "img");
  gridEl.setAttribute("aria-label", label || "학교 지도 격자, 정문에서 매점까지 로봇이 이동할 칸들");
  gridEl.innerHTML = "";
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const id = cellId(row, col);
      const wall = !WALL_LAYOUT[row][col];
      const cell = document.createElement("div");
      cell.className = "map-cell";
      cell.dataset.cell = id;
      if (wall) {
        cell.dataset.wall = "true";
      } else {
        let state = statesById[id] || "";
        if (id === START_ID && !state) state = "start";
        if (id === GOAL_ID && !["visited", "current", "path"].includes(state)) state = state || "goal";
        if (state) cell.dataset.state = state;
        const label2 = id === START_ID ? "🏫" : id === GOAL_ID ? "🏪" : "";
        cell.innerHTML = `${label2 ? `<span class="cell-icon" aria-hidden="true">${label2}</span>` : ""}<span class="cell-id" aria-hidden="true">${id}</span>`;
        if (profile === "snow" && SNOW_COST[row][col] > 1) {
          cell.innerHTML += `<span class="cell-cost" aria-hidden="true">×${SNOW_COST[row][col]}</span>`;
        }
      }
      gridEl.appendChild(cell);
    }
  }
}

// mode "single": 라디오처럼 하나만 고를 수 있음. mode "multi": 체크박스처럼 여러 개를 고를 수 있음.
export function renderCandidateCards(containerEl, candidates, { mode, metrics }) {
  containerEl.innerHTML = "";
  candidates.forEach((candidate, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "candidate-card";
    button.dataset.cellId = candidate.cellId;
    button.setAttribute("aria-pressed", "false");
    const metricsHtml = (metrics || [])
      .map(({ key, label }) => `<span>${label} <strong>${candidate[key]}</strong></span>`)
      .join("");
    button.innerHTML = `
      <span class="cc-key">${mode === "multi" ? "☐" : "①②③④"[index] || ""} 후보 ${index + 1}</span>
      <span class="cc-name">${candidate.cellId}</span>
      ${metricsHtml ? `<span class="cc-metrics">${metricsHtml}</span>` : ""}
    `;
    containerEl.appendChild(button);
  });
}

export function markCandidateResult(containerEl, correctIds) {
  const correctSet = new Set(correctIds);
  containerEl.querySelectorAll(".candidate-card").forEach((button) => {
    button.disabled = true;
    if (correctSet.has(button.dataset.cellId)) button.classList.add("is-correct");
    else if (button.getAttribute("aria-pressed") === "true") button.classList.add("is-incorrect");
  });
}
