import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ROWS, COLS, WALL_LAYOUT, START, GOAL,
  cellId, parseCellId, neighbors, manhattan,
  runBfsLayers, runDfs, runPriorityTrace, findGreedyTrapStep, pathCostUnder,
} from "../lessons/shared/search-lab.js";

test("cellId ↔ parseCellId는 서로의 역함수다", () => {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const id = cellId(row, col);
      assert.deepEqual(parseCellId(id), { row, col }, `${id}가 (${row},${col})로 되돌아오지 않음`);
    }
  }
});

test("시작 칸(A1)과 목표 칸(F6)은 이동 가능한 칸이다", () => {
  assert.equal(WALL_LAYOUT[START.row][START.col], true);
  assert.equal(WALL_LAYOUT[GOAL.row][GOAL.col], true);
  assert.equal(cellId(START.row, START.col), "A1");
  assert.equal(cellId(GOAL.row, GOAL.col), "F6");
});

test("neighbors는 비용이 같을 때의 순서(위→아래→왼쪽→오른쪽)로 이동 가능한 칸만 반환한다", () => {
  const list = neighbors(2, 2); // C3: 위(C2) 아래(C4) 왼쪽(B3=벽) 오른쪽(D3)
  assert.deepEqual(list.map((n) => n.id), ["C2", "C4", "D3"]);
});

test("맨해튼 거리 휴리스틱은 목표에서 0이고 음수가 되지 않는다", () => {
  assert.equal(manhattan(GOAL.row, GOAL.col), 0);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      assert.ok(manhattan(row, col) >= 0);
    }
  }
});

test("BFS는 이동 가능한 칸을 전부 방문하고 목표에 도달한다(지도가 완전히 연결되어 있음)", () => {
  const bfs = runBfsLayers();
  const openCount = WALL_LAYOUT.flat().filter(Boolean).length;
  assert.equal(bfs.opened, openCount, "이동 가능한 칸 수와 BFS가 연 칸 수가 달라 지도에 고립된 영역이 있음");
  assert.ok(bfs.path, "BFS가 목표에 도달하지 못함");
  assert.equal(bfs.path[0], "A1");
  assert.equal(bfs.path.at(-1), "F6");
});

test("BFS 경로는 눈이 쌓인 뒤(snow 비용)에는 균일 비용 탐색 경로보다 비싸다", () => {
  const bfs = runBfsLayers();
  const ucs = runPriorityTrace({ useHeuristic: false });
  const bfsCostUnderSnow = pathCostUnder(bfs.path, "snow");
  assert.ok(bfsCostUnderSnow > ucs.pathCost, `BFS 경로 비용(${bfsCostUnderSnow})이 UCS 최적 비용(${ucs.pathCost})보다 커야 활동02의 대비가 성립함`);
});

test("균일 비용 탐색과 A*는 같은 최적 비용의 경로를 찾는다", () => {
  const ucs = runPriorityTrace({ useHeuristic: false });
  const astar = runPriorityTrace({ useHeuristic: true });
  assert.ok(ucs.path && astar.path);
  assert.equal(ucs.pathCost, astar.pathCost, "UCS와 A*가 찾은 최종 경로 비용이 같아야 함(둘 다 최적 탐색)");
});

test("A*는 균일 비용 탐색보다 적은 칸을 열어본다(휴리스틱의 효율)", () => {
  const ucs = runPriorityTrace({ useHeuristic: false });
  const astar = runPriorityTrace({ useHeuristic: true });
  assert.ok(astar.opened < ucs.opened, `A*(${astar.opened}) < UCS(${ucs.opened})여야 효율성 비교가 성립함`);
});

test("각 확장 단계의 후보 카드는 4개를 넘지 않고, 실제로 열린 칸이 후보 0번째다", () => {
  const astar = runPriorityTrace({ useHeuristic: true });
  for (const step of astar.steps) {
    assert.ok(step.candidates.length <= 4);
    assert.ok(step.candidates.length >= 1);
    assert.equal(step.candidates[0].cellId, step.expanded);
  }
});

test("A* 트레이스에는 h는 작지만 g가 더 커서 f가 밀리는 '함정' 후보가 실제로 존재한다", () => {
  const astar = runPriorityTrace({ useHeuristic: true });
  const trap = findGreedyTrapStep(astar.steps);
  assert.ok(trap, "함정 후보를 찾지 못함 — 활동03의 함정 문항 설계가 성립하지 않음");
  assert.ok(trap.trap.h < trap.winner.h);
  assert.ok(trap.trap.g > trap.winner.g);
  assert.ok(trap.trap.f > trap.winner.f);
});

test("DFS도 목표에 도달하지만, BFS와 달리 최소 칸 수 경로를 보장하지 않는다(활동01의 BFS/DFS 비교 근거)", () => {
  const bfs = runBfsLayers();
  const dfs = runDfs();
  assert.ok(dfs.path, "DFS가 목표에 도달하지 못함");
  const dfsHops = dfs.path.length - 1;
  const bfsHops = bfs.path.length - 1;
  assert.ok(dfsHops > bfsHops, `DFS 경로(${dfsHops}칸)가 BFS 경로(${bfsHops}칸)보다 길어야 "칸 수 최소 보장"의 대비가 성립함`);
});

test("같은 입력에 대해 탐색 결과는 항상 동일하다(결정론적)", () => {
  const a1 = runPriorityTrace({ useHeuristic: true });
  const a2 = runPriorityTrace({ useHeuristic: true });
  assert.deepEqual(a1.order, a2.order);
  assert.deepEqual(a1.path, a2.path);
});

test("공통 지도 렌더러는 후보 이름과 지도를 연결할 수 있도록 칸 좌표 라벨을 표시한다", async () => {
  const source = await readFile(new URL("../lessons/shared/search-ui.js", import.meta.url), "utf8");
  assert.match(source, /class="cell-id"/);
  assert.match(source, /\$\{id\}/);
});
