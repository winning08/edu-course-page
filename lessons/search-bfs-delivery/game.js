import {
  RIVER_ITEMS, RIVER_INITIAL, createRiverSession, tryRiverMove, solveRiverBfs,
} from "./game-core.js?v=2026082504";

const $ = (selector) => document.querySelector(selector);
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ITEM_BY_ID = new Map(RIVER_ITEMS.map((item) => [item.id, item]));
const session = createRiverSession();
let passenger = null;

const el = {
  scene: $("#river-scene"), feedback: $("#river-feedback"), history: $("#river-history"),
  play: $("#river-play"), results: $("#river-results"), summary: $("#river-summary"),
  costResult: $("#river-cost-result"),
  solutionBody: $("#river-solution-body"), count: $("#river-move-count"), instruction: $("#river-instruction"),
  stateAnnouncement: $("#river-state-announcement"),
  currentState: $("#river-current-state"),
  reset: $("#river-reset-play"), restart: $("#river-restart"), projector: $("#projector-toggle"),
  showCannibals: $("#show-cannibals-button"), cannibalsGame: $("#cannibals-game"),
  gameover: $("#river-gameover"), gameoverMessage: $("#river-gameover-message"), gameoverRestart: $("#river-gameover-restart"),
};

function actionLabel(actionId) {
  if (actionId === "farmer") return "농부 혼자 건너기";
  return `농부와 ${ITEM_BY_ID.get(actionId).label} 건너기`;
}

function stateBadge(state) {
  const side = (code) => [
    state.farmer === code ? "농부" : null,
    ...RIVER_ITEMS.map((item) => state[item.id] === code ? item.label : null),
  ].filter(Boolean).join("·") || "비어 있음";
  return `<span class="state-mini"><span>${side("L")}</span><b aria-hidden="true">→</b><span>${side("R")}</span></span>`;
}

function stateText(state) {
  const side = (code) => [
    state.farmer === code ? "농부" : null,
    ...RIVER_ITEMS.map((item) => state[item.id] === code ? item.label : null),
  ].filter(Boolean).join(", ") || "없음";
  return `왼쪽: ${side("L")} / 오른쪽: ${side("R")}`;
}

function describeCrossingState(state) {
  const people = [
    { label: "농부", side: state.farmer },
    ...RIVER_ITEMS.map((item) => ({ label: item.label, side: state[item.id] })),
  ];
  const crossed = people.filter((person) => person.side === "R").map((person) => person.label);
  const waiting = people.filter((person) => person.side === "L").map((person) => person.label);
  if (crossed.length === 0) return "농부, 늑대, 양, 양배추 모두 강을 건너지 않은 상태";
  if (waiting.length === 0) return "농부, 늑대, 양, 양배추 모두 강을 건넌 상태";
  return `${crossed.join(", ")}은(는) 강을 건넜고, ${waiting.join(", ")}은(는) 아직 건너지 않은 상태`;
}

function render() {
  const state = session.state;
  const bank = (side) => {
    const people = [];
    if (state.farmer === side) people.push({ id: "farmer", label: "농부", icon: "👨‍🌾" });
    RIVER_ITEMS.forEach((item) => { if (state[item.id] === side) people.push(item); });
    return `<section class="river-bank" aria-label="${side === "L" ? "왼쪽 출발지" : "오른쪽 목적지"}">
      <h3>${side === "L" ? "왼쪽 · 출발지" : "오른쪽 · 목적지"}</h3>
      <div class="river-characters">${people.map((item) => {
        if (item.id === "farmer") return `<span class="river-character is-farmer"><span aria-hidden="true">${item.icon}</span><b>${item.label}</b></span>`;
        const available = state.farmer === side && !session.gameOver;
        const selected = passenger === item.id;
        return `<button type="button" class="river-character${available ? " is-available" : ""}${selected ? " is-selected" : ""}" data-passenger="${item.id}" aria-pressed="${selected}" ${available ? "" : "disabled"}><span aria-hidden="true">${item.icon}</span><b>${item.label}</b><small>${selected ? "배에 탑승" : available ? "눌러서 태우기" : session.gameOver ? "게임 오버" : "농부가 반대편"}</small></button>`;
      }).join("") || '<span class="river-empty">비어 있음</span>'}</div>
    </section>`;
  };
  const selected = passenger ? ITEM_BY_ID.get(passenger) : null;
  const direction = state.farmer === "L" ? "오른쪽" : "왼쪽";
  el.scene.innerHTML = `${bank("L")}<div class="river-channel"><span class="river-name">강</span><button class="boat-control" id="boat-control" type="button" ${session.gameOver ? "disabled" : ""} aria-label="${selected ? `${selected.label}과 함께` : "농부 혼자"} ${direction}으로 건너기"><span class="boat-passenger">${selected ? selected.icon : "👨‍🌾"}</span><span class="boat-icon" aria-hidden="true">⛵</span><strong>${direction}으로 이동</strong></button></div>${bank("R")}`;
  el.count.textContent = `${session.history.length}회`;
  el.instruction.textContent = selected
    ? `${selected.label}이(가) 배에 탔습니다. 가운데 배를 눌러 ${direction}으로 이동하세요.`
    : `함께 데려갈 캐릭터를 고르거나, 농부만 이동하려면 바로 배를 누르세요.`;
  const left = [state.farmer === "L" ? "농부" : null, ...RIVER_ITEMS.map((i) => state[i.id] === "L" ? i.label : null)].filter(Boolean).join(", ") || "없음";
  const right = [state.farmer === "R" ? "농부" : null, ...RIVER_ITEMS.map((i) => state[i.id] === "R" ? i.label : null)].filter(Boolean).join(", ") || "없음";
  el.stateAnnouncement.textContent = `현재 상태. 왼쪽: ${left}. 오른쪽: ${right}.`;
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
  row.innerHTML = `<th scope="row">${entry.order}</th><td>${actionLabel(entry.action)}</td><td>${result}</td>`;
  el.history.appendChild(row);
}

el.scene.addEventListener("click", (event) => {
  const character = event.target.closest("button[data-passenger]");
  if (character) {
    passenger = passenger === character.dataset.passenger ? null : character.dataset.passenger;
    render();
    return;
  }
  if (!event.target.closest("#boat-control")) return;
  const result = tryRiverMove(session, passenger || "farmer");
  if (!result.ok) {
    feedback("incorrect", "지금은 함께 탈 수 없습니다.", "농부가 반대편에 있는 대상은 태울 수 없습니다.");
    return;
  }
  passenger = null;
  addHistory(session.history.at(-1));
  render();
  if (result.gameOver) gameOver(result.dangers);
  else if (result.solved) finish();
  else if (result.wasVisited) feedback("incorrect", "이미 보았던 상태입니다.", "안전한 이동이지만 같은 상태로 되돌아왔습니다.");
  else feedback("correct", "안전하게 이동했습니다.", "새로운 상태입니다. 다음 이동을 선택하세요.");
});

function renderSolution() {
  const solved = solveRiverBfs();
  let current = RIVER_INITIAL;
  el.solutionBody.innerHTML = solved.path.map((step, index) => {
    const row = `<tr><th scope="row">${index + 1}</th><td>${stateText(current)}</td><td>${actionLabel(step.action)}</td><td>${stateText(step.state)}${index === solved.path.length - 1 ? '<span class="goal-mark">목표</span>' : ""}</td></tr>`;
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
  session.state = RIVER_INITIAL;
  session.history = [];
  session.visitedKeys = new Set([Object.values(RIVER_INITIAL).join("")]);
  session.solved = false;
  session.gameOver = false;
  passenger = null;
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
el.projector.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("projector-mode");
  el.projector.setAttribute("aria-pressed", String(enabled));
});
el.showCannibals?.addEventListener("click", () => {
  el.cannibalsGame.hidden = false;
  el.cannibalsGame.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
});

render();

// ?debug=results 로 접속하면 최적 경로(7수)를 자동으로 진행해 결과 화면으로 바로 건너뛴다.
// 검토용 지름길일 뿐, 평소 학생 화면에는 영향이 없다.
if (new URLSearchParams(location.search).get("debug") === "results") {
  const solved = solveRiverBfs();
  for (const step of solved.path) {
    const result = tryRiverMove(session, step.action);
    addHistory(session.history.at(-1));
    if (result.solved) finish();
  }
  render();
  el.results.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
}
