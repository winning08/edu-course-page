import assert from "node:assert/strict";
import test from "node:test";
import { generateRandomGraph, runUcsGraphTrace, pathCostFor } from "../lessons/shared/search-graph-lab.js";

const VIEW_W = 640;
const VIEW_H = 420;
const NODE_R = 36;

test("연습용 랜덤 그래프는 정점 7~10개를 갖고, 시작·목표가 실제 정점 목록에 있다", () => {
  for (let i = 0; i < 30; i += 1) {
    const g = generateRandomGraph();
    assert.ok(g.nodes.length >= 7 && g.nodes.length <= 10, `정점 수(${g.nodes.length})가 7~10 범위를 벗어남`);
    const ids = new Set(g.nodes.map((n) => n.id));
    assert.ok(ids.has(g.start));
    assert.ok(ids.has(g.goal));
    assert.notEqual(g.start, g.goal, "시작과 목표가 같으면 안 됨");
  }
});

test("랜덤 그래프는 항상 연결되어 있어 균일 비용 탐색이 목표에 도달한다", () => {
  for (let i = 0; i < 30; i += 1) {
    const g = generateRandomGraph();
    const trace = runUcsGraphTrace(g);
    assert.ok(trace.path, "목표에 도달하지 못함");
    assert.equal(trace.path[0], g.start);
    assert.equal(trace.path.at(-1), g.goal);
    assert.equal(trace.pathCost, pathCostFor(trace.path, g));
  }
});

test("랜덤 그래프의 모든 간선 비용은 양수이고, 노드는 뷰박스 안쪽에 겹치지 않게 배치된다", () => {
  for (let i = 0; i < 30; i += 1) {
    const g = generateRandomGraph();
    for (const edge of g.edges) {
      assert.ok(edge.cost > 0);
      assert.notEqual(edge.a, edge.b);
    }
    for (const node of g.nodes) {
      assert.ok(node.x - NODE_R >= 0 && node.x + NODE_R <= VIEW_W, `노드 ${node.id}가 가로 범위를 벗어남(x=${node.x})`);
      assert.ok(node.y - NODE_R >= 0 && node.y + NODE_R <= VIEW_H, `노드 ${node.id}가 세로 범위를 벗어남(y=${node.y})`);
    }
    for (let a = 0; a < g.nodes.length; a += 1) {
      for (let b = a + 1; b < g.nodes.length; b += 1) {
        const dx = g.nodes[a].x - g.nodes[b].x;
        const dy = g.nodes[a].y - g.nodes[b].y;
        const dist = Math.sqrt((dx * dx) + (dy * dy));
        assert.ok(dist >= NODE_R * 2 - 5, `노드 ${g.nodes[a].id}·${g.nodes[b].id}가 너무 가까움(${dist.toFixed(1)}px)`);
      }
    }
  }
});

test("간선 가운데 값 버블(중복 선택 시 반지름 21px)이 그 간선 자신의 양쪽 끝 정점 원과 겹치지 않는다", () => {
  const CHOICE_R = 21;
  for (let i = 0; i < 30; i += 1) {
    const g = generateRandomGraph();
    const pos = new Map(g.nodes.map((n) => [n.id, n]));
    for (const edge of g.edges) {
      const a = pos.get(edge.a);
      const b = pos.get(edge.b);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      for (const endpoint of [a, b]) {
        const dist = Math.hypot(midX - endpoint.x, midY - endpoint.y);
        assert.ok(
          dist >= NODE_R + CHOICE_R,
          `간선 ${edge.a}-${edge.b}의 값 버블이 정점 ${endpoint.id}와 겹침(거리=${dist.toFixed(1)}px)`,
        );
      }
    }
  }
});

test("랜덤 그래프의 간선은 서로 교차하지 않는다(교차하면 비용 값이 겹쳐 안 보임)", () => {
  function ccw(p, q, r) {
    return ((q.x - p.x) * (r.y - p.y)) - ((q.y - p.y) * (r.x - p.x));
  }
  function segmentsProperlyCross(a1, a2, b1, b2) {
    const d1 = ccw(b1, b2, a1);
    const d2 = ccw(b1, b2, a2);
    const d3 = ccw(a1, a2, b1);
    const d4 = ccw(a1, a2, b2);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  for (let i = 0; i < 30; i += 1) {
    const g = generateRandomGraph();
    const pos = new Map(g.nodes.map((n) => [n.id, n]));
    for (let a = 0; a < g.edges.length; a += 1) {
      for (let b = a + 1; b < g.edges.length; b += 1) {
        const e1 = g.edges[a];
        const e2 = g.edges[b];
        if (e1.a === e2.a || e1.a === e2.b || e1.b === e2.a || e1.b === e2.b) continue;
        const crosses = segmentsProperlyCross(pos.get(e1.a), pos.get(e1.b), pos.get(e2.a), pos.get(e2.b));
        assert.ok(!crosses, `간선 ${e1.a}-${e1.b}와 ${e2.a}-${e2.b}가 서로 교차함`);
      }
    }
  }
});

test("시작·목표 노드에는 각각 🚩·🏁 아이콘이 붙는다", () => {
  const g = generateRandomGraph();
  const startNode = g.nodes.find((n) => n.id === g.start);
  const goalNode = g.nodes.find((n) => n.id === g.goal);
  assert.equal(startNode.icon, "🚩");
  assert.equal(goalNode.icon, "🏁");
});

test("runUcsGraphTrace/pathCostFor는 인자를 생략하면 여전히 고정 학교 그래프로 동작한다(하위 호환)", () => {
  const trace = runUcsGraphTrace();
  assert.deepEqual(trace.order, ["gate", "yard", "lobby", "cafeteria", "store"]);
  assert.equal(trace.pathCost, 12);
});
