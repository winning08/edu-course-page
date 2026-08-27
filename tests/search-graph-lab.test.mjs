import assert from "node:assert/strict";
import test from "node:test";
import { runUcsGraphTrace, pathCostFor, NODES, EDGES, START, GOAL } from "../lessons/shared/search-graph-lab.js";

// 이 그래프·비용은 균일비용탐색.pptx(30~33쪽) 도시 a~e 예제와 동일한 구조를 학교 장소로 옮긴 것이다.
// 교과서 트레이스: a→c→b→d→e 순으로 5번 확장, 최종 경로 a-c-d-e(비용 12).
const trace = runUcsGraphTrace();

test("확장 순서는 교과서와 동일하게 정문→운동장→중앙현관→급식실→매점이다", () => {
  assert.deepEqual(trace.order, ["gate", "yard", "lobby", "cafeteria", "store"]);
});

test("최종 경로는 정문→운동장→급식실→매점, 비용은 12다", () => {
  assert.deepEqual(trace.path, ["gate", "yard", "cafeteria", "store"]);
  assert.equal(trace.pathCost, 12);
  assert.equal(pathCostFor(trace.path), 12);
});

test("정문→중앙현관→매점(2번 이동)은 정문→운동장→급식실→매점(3번 이동)보다 이동 횟수는 적지만 비용은 더 크다", () => {
  const fewerHops = pathCostFor(["gate", "lobby", "store"]);
  assert.equal(fewerHops, 14);
  assert.ok(fewerHops > trace.pathCost, "이동 횟수가 적다고 항상 더 싸지는 않다는 대비가 성립해야 함");
});

test("운동장 확장 단계에서, 이미 오픈 리스트에 있던 더 싼 중앙현관(5)이 더 비싼 새 값(9)을 밀어낸다", () => {
  const step = trace.steps.find((s) => s.expandedId === "yard");
  const lobbyChild = step.children.find((c) => c.id === "lobby");
  assert.equal(lobbyChild.status, "open-worse-skip");
  assert.equal(lobbyChild.newG, 9);
  assert.equal(lobbyChild.existingG, 5);
});

test("급식실 확장 단계에서, 오픈 리스트의 더 비싼 매점(14)이 더 싼 새 값(12)으로 교체된다", () => {
  const step = trace.steps.find((s) => s.expandedId === "cafeteria");
  const storeChild = step.children.find((c) => c.id === "store");
  assert.equal(storeChild.status, "open-replace");
  assert.equal(storeChild.newG, 12);
  assert.equal(storeChild.existingG, 14);
});

test("각 단계의 pickCandidates에는 그 시점 오픈 리스트 전체가 g(n) 오름차순으로 담긴다", () => {
  for (const step of trace.steps) {
    const gs = step.pickCandidates.map((c) => c.g);
    assert.deepEqual(gs, [...gs].sort((a, b) => a - b));
    assert.equal(step.pickCandidates[0].id, step.expandedId);
  }
});

test("목표 상태(매점)를 확장하는 단계는 자식을 만들지 않고 그 자리에서 멈춘다", () => {
  const goalStep = trace.steps.at(-1);
  assert.equal(goalStep.expandedId, GOAL);
  assert.equal(goalStep.isGoal, true);
  assert.deepEqual(goalStep.children, []);
  assert.deepEqual(goalStep.openAfter, []);
});

test("노드는 5개, 간선은 7개이고 시작·목표는 그래프에 실제로 존재하는 노드다", () => {
  assert.equal(NODES.length, 5);
  assert.equal(EDGES.length, 7);
  assert.ok(NODES.some((n) => n.id === START));
  assert.ok(NODES.some((n) => n.id === GOAL));
});

test("같은 입력에 대해 트레이스 결과는 항상 동일하다(결정론적)", () => {
  const again = runUcsGraphTrace();
  assert.deepEqual(again.order, trace.order);
  assert.deepEqual(again.path, trace.path);
});
