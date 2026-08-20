import {
  RIVER_ITEMS, RIVER_INITIAL, RIVER_GOAL, buildRiverStateSpace, riverStateKey,
} from "./game-core.js?v=2026081905";

const graph = buildRiverStateSpace();
const tree = document.querySelector("#state-space-tree");
const tbody = document.querySelector("#transition-body");
const labels = new Map([["farmer", "농부 혼자"], ...RIVER_ITEMS.map((item) => [item.id, `농부 + ${item.label}`])]);
const byKey = new Map(graph.nodes.map((node) => [node.key, node]));

function sideText(state, code) {
  return [state.farmer === code ? "농부" : null, ...RIVER_ITEMS.map((item) => state[item.id] === code ? item.label : null)]
    .filter(Boolean).join(" · ") || "없음";
}

function stateText(state) {
  return `왼쪽 ${sideText(state, "L")} / 오른쪽 ${sideText(state, "R")}`;
}

function actionResult(edge) {
  if (edge.status === "new") return "새 상태로 이동";
  if (edge.status === "repeat") return "이미 나온 상태로 돌아감";
  return edge.dangers.map((danger) => danger.message.replace("농부가 없는 사이 ", "")).join(" ");
}

for (let depth = 0; depth <= Math.max(...graph.nodes.map((node) => node.depth)); depth += 1) {
  const level = document.createElement("section");
  level.className = "tree-level";
  level.setAttribute("aria-labelledby", `depth-${depth}`);
  const nodes = graph.nodes.filter((node) => node.depth === depth);
  level.innerHTML = `<div class="depth-marker"><span id="depth-${depth}">${depth === 0 ? "처음" : `${depth}단계`}</span></div><div class="level-nodes"></div>`;
  const nodeWrap = level.querySelector(".level-nodes");

  nodes.forEach((node) => {
    const isInitial = node.key === riverStateKey(RIVER_INITIAL);
    const isGoal = node.key === riverStateKey(RIVER_GOAL);
    const card = document.createElement("article");
    card.className = `tree-state-card${isInitial ? " initial" : ""}${isGoal ? " goal" : ""}`;
    const outgoing = graph.edges.filter((edge) => edge.from === node.key);
    card.innerHTML = `
      <div class="state-card-head"><strong>${isInitial ? "처음 상태" : isGoal ? "목표 상태" : `상태 ${node.key}`}</strong><span>${node.key}</span></div>
      <dl class="bank-state"><div><dt>왼쪽</dt><dd>${sideText(node.state, "L")}</dd></div><div><dt>오른쪽</dt><dd>${sideText(node.state, "R")}</dd></div></dl>
      <p class="actions-title">이 상태에서 가능한 행동 ${outgoing.length}개</p>
      <ul class="state-actions">${outgoing.map((edge) => `<li class="${edge.status}"><b>${labels.get(edge.action)}</b><span>${actionResult(edge)}</span></li>`).join("")}</ul>`;
    nodeWrap.append(card);
  });
  tree.append(level);
}

tbody.innerHTML = graph.edges.map((edge) => {
  const from = byKey.get(edge.from).state;
  const result = edge.status === "unsafe" ? edge.attempted : byKey.get(edge.to).state;
  const verdict = edge.status === "new" ? "새로운 안전한 상태" : edge.status === "repeat" ? "이미 나온 상태" : `안전하지 않음 · ${edge.dangers.map((danger) => danger.message).join(" ")}`;
  return `<tr class="${edge.status}"><td>${stateText(from)}</td><td>${labels.get(edge.action)}</td><td>${stateText(result)}</td><td><span>${verdict}</span></td></tr>`;
}).join("");
