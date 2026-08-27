import {
  RIVER_ITEMS, RIVER_INITIAL, RIVER_GOAL, buildRiverStateSpace, riverStateKey,
} from "./game-core.js?v=2026082507";
import { enableGraphZoom } from "../shared/search-graph-ui.js?v=2026082401";

const graph = buildRiverStateSpace();
const treeContainer = document.querySelector("#state-space-tree");
const tbody = document.querySelector("#transition-body");
const labels = new Map([["farmer", "농부 혼자"], ...RIVER_ITEMS.map((item) => [item.id, `농부 + ${item.label}`])]);
const FARMER_ICON = "👨‍🌾";
const byKey = new Map(graph.nodes.map((node) => [node.key, node]));
const rootKey = riverStateKey(RIVER_INITIAL);
const goalKey = riverStateKey(RIVER_GOAL);

function sideText(state, code) {
  return [state.farmer === code ? "농부" : null, ...RIVER_ITEMS.map((item) => (state[item.id] === code ? item.label : null))]
    .filter(Boolean).join(" · ") || "없음";
}

function stateText(state) {
  return `왼쪽 ${sideText(state, "L")} / 오른쪽 ${sideText(state, "R")}`;
}

// 트리 그림 안에서는 이름 대신 아이콘으로 누가 어느 둑에 있는지 보여준다(글로 다시
// 읽는 표는 아래 전이 표에서 그대로 담당한다).
function sideIcons(state, code) {
  const icons = [state.farmer === code ? FARMER_ICON : null, ...RIVER_ITEMS.map((item) => (state[item.id] === code ? item.icon : null))]
    .filter(Boolean);
  return icons.length ? icons.join("") : "–";
}

// ── 상태 공간 그래프를 실제 가지가 있는 트리 그림(SVG)으로 그린다 ──────────────
// 각 상태에서 시도할 수 있는 행동을 모두(안전·위험·반복 가리지 않고) 한 단계 아래
// 줄에 나열한다. 그중 새로운 안전한 상태만 그 아래로 더 뻗어나가고, 위험하거나
// 이미 나온 상태는 그 자리에서 다르게 칠해진 채 막다른 잎으로 끝난다.
const NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

// graph.edges를 그대로 따라가며 실제 트리 구조(vnode)를 만든다. "새 상태"만 더
// 자식을 갖고, "반복"·"안전하지 않음"은 그 edge 하나로 끝나는 잎이 된다. 목표 상태에
// 도착하면 이미 다 찾은 것이므로, 그 뒤로 시도할 수 있는 행동은 더 펼치지 않는다.
function buildVNode(node, edge) {
  const vnode = {
    id: node.key, depth: node.depth, status: edge ? edge.status : "root", edge, node, children: [],
  };
  if (node.key === goalKey) return vnode;
  for (const outEdge of graph.edges.filter((e) => e.from === node.key)) {
    if (outEdge.status === "new") {
      vnode.children.push(buildVNode(byKey.get(outEdge.to), outEdge));
    } else {
      vnode.children.push({
        id: `${outEdge.from}|${outEdge.action}`, depth: node.depth + 1, status: outEdge.status, edge: outEdge, node: null, children: [],
      });
    }
  }
  return vnode;
}
const root = buildVNode(byKey.get(rootKey), null);

// 정점(부모)을 항상 자식들의 정가운데에 두려고 하면, 트리 전체에서 잎(막다른 상자) 하나하나에
// 서로 다른 자리를 배정하게 되어 그림이 필요 이상으로 넓어진다(잎이 21개면 21칸만큼).
// 실제로 자리가 겹치지 않아야 하는 대상은 "같은 줄(깊이)"에 있는 상자들뿐이므로, 줄마다
// 왼쪽부터 순서대로 자리를 매긴다 — 가지 순서를 그대로 따라가서 읽기 순서와도 맞는다.
const rowsByDepth = new Map();
(function collectRows(vnode) {
  if (!rowsByDepth.has(vnode.depth)) rowsByDepth.set(vnode.depth, []);
  rowsByDepth.get(vnode.depth).push(vnode);
  vnode.children.forEach(collectRows);
}(root));

let maxRowWidth = 0;
for (const rowVNodes of rowsByDepth.values()) {
  maxRowWidth = Math.max(maxRowWidth, rowVNodes.length - 1);
}
for (const rowVNodes of rowsByDepth.values()) {
  const centerOffset = (maxRowWidth - (rowVNodes.length - 1)) / 2;
  rowVNodes.forEach((vnode, i) => { vnode.slot = i + centerOffset; });
}

const allVNodes = [...rowsByDepth.values()].flat();
const maxSlot = maxRowWidth;
const maxDepth = Math.max(...allVNodes.map((v) => v.depth));

const SLOT_WIDTH = 210;
const ROW_HEIGHT = 150;
const MARGIN_X = 110;
const TOP_MARGIN = 65;
const NODE_W = 178;
const NODE_H = 84;

function xFor(vnode) { return MARGIN_X + (vnode.slot * SLOT_WIDTH); }
function yFor(vnode) { return TOP_MARGIN + (vnode.depth * ROW_HEIGHT); }
// 정점·위험·반복 상자 모두 같은 크기로 그려 왼쪽·오른쪽 구성을 그대로 보여준다.
function boxSize() { return [NODE_W, NODE_H]; }

const svgWidth = (MARGIN_X * 2) + (maxSlot * SLOT_WIDTH);
const svgHeight = TOP_MARGIN + (maxDepth * ROW_HEIGHT) + (NODE_H / 2) + 50;

const svg = svgEl("svg", {
  viewBox: `0 0 ${svgWidth} ${svgHeight}`,
  class: "state-tree-svg graph-diagram",
  role: "img",
  "aria-label": "늑대·양·양배추 강 건너기에서 각 상태마다 시도할 수 있는 모든 행동을 아래로 펼친 나무 그림. 실선은 새로운 안전한 상태, 회색 파선은 이미 나온 상태, 빨간 점선은 위험한 이동을 뜻한다.",
});

// 간선을 먼저 그려 상자 아래 깔리게 한다.
(function drawEdges(vnode) {
  for (const child of vnode.children) {
    const [, ph] = boxSize(vnode);
    const [, ch] = boxSize(child);
    svg.appendChild(svgEl("line", {
      x1: xFor(vnode), y1: yFor(vnode) + (ph / 2),
      x2: xFor(child), y2: yFor(child) - (ch / 2),
      class: `tree-edge-${child.status}`,
    }));
    drawEdges(child);
  }
}(root));

// 상태 상자(정점이든, 위험해서 갈 수 없는 시도든)를 같은 모양으로 그린다. 가운데
// 세로선으로 왼쪽 둑·오른쪽 둑을 나누고, 각 칸 위에 "왼쪽"/"오른쪽"을 적은 뒤 그
// 아래에 그 둑에 있는 대상을 아이콘으로 보여준다. 맨 위 배너(처음 상태/목표 상태/
// 위험)가 있으면 그만큼 나머지 칸을 아래로 밀어서 배치한다.
function drawStateBox(vnode, state, { groupClass, bannerText, bannerClass, titleTooltip }) {
  const x = xFor(vnode);
  const y = yFor(vnode);
  const [w, h] = boxSize(vnode);
  const y0 = y - (h / 2);
  const y1 = y + (h / 2);
  const g = svgEl("g", { class: groupClass });
  const title = svgEl("title", {});
  title.textContent = titleTooltip;
  g.appendChild(title);
  g.appendChild(svgEl("rect", { x: x - (w / 2), y: y0, width: w, height: h, rx: 10, class: "tree-node-bg" }));

  if (bannerText) {
    const bannerEl = svgEl("text", { x, y: y0 + 14, class: bannerClass });
    bannerEl.textContent = bannerText;
    g.appendChild(bannerEl);
  }

  const dividerTop = bannerText ? y0 + 24 : y0 + 10;
  g.appendChild(svgEl("line", { x1: x, y1: dividerTop, x2: x, y2: y1 - 8, class: "tree-node-divider" }));

  const labelY = dividerTop + 11;
  const iconY = dividerTop + (bannerText ? 34 : 38);
  const leftX = x - (w / 4);
  const rightX = x + (w / 4);

  const leftLabel = svgEl("text", { x: leftX, y: labelY, class: "tree-node-side-label" });
  leftLabel.textContent = "왼쪽";
  g.appendChild(leftLabel);
  const rightLabel = svgEl("text", { x: rightX, y: labelY, class: "tree-node-side-label" });
  rightLabel.textContent = "오른쪽";
  g.appendChild(rightLabel);

  const leftIcons = svgEl("text", { x: leftX, y: iconY, class: "tree-node-icons" });
  leftIcons.textContent = sideIcons(state, "L");
  g.appendChild(leftIcons);
  const rightIcons = svgEl("text", { x: rightX, y: iconY, class: "tree-node-icons" });
  rightIcons.textContent = sideIcons(state, "R");
  g.appendChild(rightIcons);

  svg.appendChild(g);
}

function drawRealNode(vnode) {
  const node = vnode.node;
  const isInitial = node.key === rootKey;
  const isGoal = node.key === goalKey;
  const bannerText = isInitial ? "처음 상태" : isGoal ? "목표 상태" : null;
  drawStateBox(vnode, node.state, {
    groupClass: `tree-node${isInitial ? " is-initial" : ""}${isGoal ? " is-goal" : ""}`,
    bannerText,
    bannerClass: "tree-node-title",
    titleTooltip: `${bannerText ? `${bannerText}. ` : ""}${stateText(node.state)}`,
  });
}

// 위험해서 갈 수 없는 시도도 정점과 같은 왼쪽/오른쪽 모양으로 그려, 그 자리에서
// 실제로 어떤 조합이 위험한지 한눈에 보이게 한다.
function drawUnsafeLeaf(vnode) {
  const { edge } = vnode;
  drawStateBox(vnode, edge.attempted, {
    groupClass: "tree-leaf tree-leaf-unsafe",
    bannerText: "위험",
    bannerClass: "tree-leaf-title",
    titleTooltip: `${labels.get(edge.action)}: ${edge.dangers.map((danger) => danger.message).join(" ")}`,
  });
}

// 이미 나온 상태로 돌아가는 반복도 정점·위험 상자와 같은 모양으로 그려, 실제로
// 어떤 상태로 되돌아가는지 왼쪽/오른쪽 구성을 그대로 보여준다.
function drawRepeatLeaf(vnode) {
  const { edge } = vnode;
  const existingState = byKey.get(edge.to).state;
  drawStateBox(vnode, existingState, {
    groupClass: "tree-leaf tree-leaf-repeat",
    bannerText: "이미 나온 상태",
    bannerClass: "tree-leaf-title",
    titleTooltip: `${labels.get(edge.action)}: 이미 나온 상태로 돌아감`,
  });
}

(function drawNodes(vnode) {
  if (vnode.node) drawRealNode(vnode);
  else if (vnode.status === "unsafe") drawUnsafeLeaf(vnode);
  else drawRepeatLeaf(vnode);
  vnode.children.forEach(drawNodes);
}(root));

treeContainer.appendChild(svg);
// 트리가 넓고 길어서 확대·축소가 필요하다. 뷰포트(.graph-zoom-viewport)는 높이가 제한돼
// 있어 처음에는 스크롤이 맨 위(=처음 상태)에서 시작한다.
enableGraphZoom(svg, document.querySelector('[data-zoom-for="state-space-tree"]'), { maxBase: 1400 });

tbody.innerHTML = graph.edges.map((edge) => {
  const from = byKey.get(edge.from).state;
  const result = edge.status === "unsafe" ? edge.attempted : byKey.get(edge.to).state;
  const verdict = edge.status === "new" ? "새로운 안전한 상태" : edge.status === "repeat" ? "이미 나온 상태" : `안전하지 않음 · ${edge.dangers.map((danger) => danger.message).join(" ")}`;
  return `<tr class="${edge.status}"><td>${stateText(from)}</td><td>${labels.get(edge.action)}</td><td>${stateText(result)}</td><td><span>${verdict}</span></td></tr>`;
}).join("");
