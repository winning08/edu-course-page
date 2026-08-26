import {
  MC_ROLES, MC_INITIAL, MC_BOAT_CAPACITY,
  mcBank, createMcSession, tryMcCrossing, solveMcBfs, mcCrossingLabel, mcStateKey,
} from "./game-core.js?v=2026082504";

const $ = (selector) => document.querySelector(selector);
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ROLE_BY_ID = new Map(MC_ROLES.map((role) => [role.id, role]));
const session = createMcSession();
let selected = { m: 0, c: 0 };

const el = {
  section: $("#cannibals-game"),
};

if (el.section) {
  Object.assign(el, {
    scene: $("#cannibals-scene"), feedback: $("#cannibals-feedback"), history: $("#cannibals-history"),
    play: $("#cannibals-play"), results: $("#cannibals-results"), summary: $("#cannibals-summary"),
    costResult: $("#cannibals-cost-result"),
    solutionBody: $("#cannibals-solution-body"), count: $("#cannibals-move-count"), instruction: $("#cannibals-instruction"),
    stateAnnouncement: $("#cannibals-state-announcement"),
    currentState: $("#cannibals-current-state"),
    reset: $("#cannibals-reset-play"), restart: $("#cannibals-restart"),
    gameover: $("#cannibals-gameover"), gameoverMessage: $("#cannibals-gameover-message"), gameoverRestart: $("#cannibals-gameover-restart"),
  });

  function sideLabel(state, side) {
    const bank = mcBank(state, side);
    const parts = [];
    if (bank.m) parts.push(`선교사 ${bank.m}명`);
    if (bank.c) parts.push(`식인종 ${bank.c}명`);
    return parts.join(", ") || "없음";
  }

  function stateBadge(state) {
    return `<span class="state-mini"><span>${sideLabel(state, "L")}</span><b aria-hidden="true">→</b><span>${sideLabel(state, "R")}</span></span>`;
  }

  function stateText(state) {
    return `왼쪽: ${sideLabel(state, "L")} / 오른쪽: ${sideLabel(state, "R")}`;
  }

  function describeCrossingState(state) {
    const rightBank = mcBank(state, "R");
    const leftBank = mcBank(state, "L");
    if (rightBank.m === 0 && rightBank.c === 0) return "선교사 3명, 식인종 3명 모두 강을 건너지 않은 상태";
    if (leftBank.m === 0 && leftBank.c === 0) return "선교사 3명, 식인종 3명 모두 강을 건넌 상태";
    return `오른쪽으로 ${sideLabel(state, "R")}이(가) 건너갔고, 왼쪽에는 ${sideLabel(state, "L")}이(가) 남은 상태`;
  }

  function bankHtml(side) {
    const state = session.state;
    const counts = mcBank(state, side);
    const isBoatSide = state.boat === side;
    const capacityFull = selected.m + selected.c >= MC_BOAT_CAPACITY;
    const tokens = MC_ROLES.map((role) => {
      const count = counts[role.id];
      const selectedCount = isBoatSide ? selected[role.id] : 0;
      return Array.from({ length: count }, (_, i) => {
        const isSelected = i < selectedCount;
        const disabled = session.gameOver || !isBoatSide || (!isSelected && capacityFull);
        const smallText = isSelected ? "배에 탑승" : isBoatSide ? "눌러서 태우기" : "배가 반대편";
        return `<button type="button" class="river-character${isSelected ? " is-selected" : ""}" data-role="${role.id}" aria-pressed="${isSelected}" ${disabled ? "disabled" : ""}><span aria-hidden="true">${role.icon}</span><b>${role.label}</b><small>${smallText}</small></button>`;
      }).join("");
    }).join("");
    return `<section class="river-bank" aria-label="${side === "L" ? "왼쪽 출발지" : "오른쪽 목적지"}">
      <h3>${side === "L" ? "왼쪽 · 출발지" : "오른쪽 · 목적지"}</h3>
      <div class="river-characters">${tokens || '<span class="river-empty">비어 있음</span>'}</div>
    </section>`;
  }

  function boatHtml() {
    const state = session.state;
    const direction = state.boat === "L" ? "오른쪽" : "왼쪽";
    const total = selected.m + selected.c;
    const passengerIcons = [
      ...Array(selected.m).fill(ROLE_BY_ID.get("m").icon),
      ...Array(selected.c).fill(ROLE_BY_ID.get("c").icon),
    ].join("") || "—";
    const label = total ? mcCrossingLabel(selected) : "아무도 없이";
    return `<div class="river-channel"><span class="river-name">강</span><button class="boat-control" id="cannibals-boat-control" type="button" ${session.gameOver ? "disabled" : ""} aria-label="${label} ${direction}으로 건너기"><span class="boat-passenger">${passengerIcons}</span><span class="boat-icon" aria-hidden="true">⛵</span><strong>${direction}으로 이동</strong></button></div>`;
  }

  function render() {
    const state = session.state;
    el.scene.innerHTML = `${bankHtml("L")}${boatHtml()}${bankHtml("R")}`;
    el.count.textContent = `${session.history.length}회`;
    const direction = state.boat === "L" ? "오른쪽" : "왼쪽";
    const total = selected.m + selected.c;
    el.instruction.textContent = total > 0
      ? `${mcCrossingLabel(selected)}이(가) 배에 탔습니다(정원 ${MC_BOAT_CAPACITY}명 중 ${total}명). 가운데 배를 눌러 ${direction}으로 이동하세요.`
      : "배에 태울 인원을 최대 2명까지 고르고, 가운데 배를 누르세요.";
    el.stateAnnouncement.textContent = `현재 상태. 왼쪽: ${sideLabel(state, "L")}. 오른쪽: ${sideLabel(state, "R")}.`;
    el.currentState.textContent = describeCrossingState(state);
  }

  function feedback(kind, title, message) {
    el.feedback.hidden = false;
    el.feedback.className = `step-feedback ${kind}`;
    el.feedback.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
  }

  function addHistory(entry) {
    if (el.history.querySelector(".empty-row")) el.history.innerHTML = "";
    const row = document.createElement("tr");
    const result = entry.dangers.length ? `게임 오버 · ${stateBadge(entry.to)}` : entry.wasVisited ? "이미 본 상태" : stateBadge(entry.to);
    row.innerHTML = `<th scope="row">${entry.order}</th><td>${mcCrossingLabel(entry.crossing)} 건너기</td><td>${result}</td>`;
    el.history.appendChild(row);
  }

  el.scene.addEventListener("click", (event) => {
    const token = event.target.closest("button[data-role]");
    if (token) {
      const role = token.dataset.role;
      const isSelected = token.getAttribute("aria-pressed") === "true";
      if (isSelected) selected[role] -= 1;
      else if (selected.m + selected.c < MC_BOAT_CAPACITY) selected[role] += 1;
      render();
      return;
    }
    if (!event.target.closest("#cannibals-boat-control")) return;
    if (selected.m + selected.c < 1) {
      feedback("incorrect", "태울 인원을 먼저 골라 주세요.", "적어도 한 명은 배에 타야 이동할 수 있습니다.");
      return;
    }
    const result = tryMcCrossing(session, selected);
    if (!result.ok) {
      feedback("incorrect", "지금은 이 조합으로 건널 수 없습니다.", "정원(2명)을 다시 확인해 보세요.");
      return;
    }
    selected = { m: 0, c: 0 };
    addHistory(session.history.at(-1));
    render();
    if (result.gameOver) gameOver(result.dangers);
    else if (result.solved) finish();
    else if (result.wasVisited) feedback("incorrect", "이미 보았던 상태입니다.", "안전한 이동이지만 같은 상태로 되돌아왔습니다.");
    else feedback("correct", "안전하게 이동했습니다.", "새로운 상태입니다. 다음 이동을 선택하세요.");
  });

  function renderSolution() {
    const solved = solveMcBfs();
    let current = MC_INITIAL;
    el.solutionBody.innerHTML = solved.path.map((step, index) => {
      const row = `<tr><th scope="row">${index + 1}</th><td>${stateText(current)}</td><td>${mcCrossingLabel(step.crossing)} 건너기</td><td>${stateText(step.state)}${index === solved.path.length - 1 ? '<span class="goal-mark">목표</span>' : ""}</td></tr>`;
      current = step.state;
      return row;
    }).join("");
    return solved;
  }

  function finish() {
    const solved = renderSolution();
    const studentCost = session.history.length;
    const minimumCost = solved.moves;
    const isMinimum = studentCost === minimumCost;
    el.play.hidden = true;
    el.results.hidden = false;
    el.summary.textContent = `배를 한 번 건널 때의 비용을 1이라고 하면, 나의 총비용은 ${studentCost}입니다.`;
    el.costResult.className = `river-cost-result ${isMinimum ? "is-minimum" : "is-extra"}`;
    el.costResult.innerHTML = isMinimum
      ? `<span>탐색 결과</span><strong>최소비용</strong><p>가장 적은 비용 ${minimumCost}으로 해결했습니다.</p>`
      : `<span>탐색 결과</span><strong>해결 성공</strong><p>목표에는 도착했지만, 더 적은 비용으로 해결하는 방법이 있을 것 같습니다.</p>`;
    el.results.querySelector("h2").focus();
  }

  function gameOver(dangers) {
    el.feedback.hidden = true;
    el.gameoverMessage.textContent = dangers.map((danger) => danger.message).join(" ");
    el.gameover.hidden = false;
    el.gameover.querySelector("h2").focus();
  }

  function reset() {
    session.state = MC_INITIAL;
    session.history = [];
    session.visitedKeys = new Set([mcStateKey(MC_INITIAL)]);
    session.solved = false;
    session.gameOver = false;
    selected = { m: 0, c: 0 };
    el.history.innerHTML = '<tr class="empty-row"><td colspan="3">아직 이동한 기록이 없습니다.</td></tr>';
    el.feedback.hidden = true;
    el.gameover.hidden = true;
    render();
  }

  el.reset.addEventListener("click", reset);
  el.restart.addEventListener("click", () => {
    reset();
    el.results.hidden = true;
    el.play.hidden = false;
    el.play.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  });
  el.gameoverRestart.addEventListener("click", () => {
    reset();
    el.play.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  });

  render();

  // ?debug=cannibals 로 접속하면 첫 활동을 풀지 않고도 바로 이 섹션을 확인할 수 있다.
  // 검토용 지름길일 뿐, 평소 학생 화면에는 영향이 없다.
  if (new URLSearchParams(location.search).get("debug") === "cannibals") {
    el.section.hidden = false;
    el.section.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }
}
