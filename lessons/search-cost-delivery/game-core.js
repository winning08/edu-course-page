import { runUcsGraphTrace, pathCostFor, nodeLabel, START, GOAL } from "../shared/search-graph-lab.js?v=2026082401";

// 이동 횟수는 적지만(2번) 더 비싼 비교 경로 — "적게 이동한다고 항상 싸지는 않다"는 예측 단계의 근거.
export const FEWER_HOPS_PATH = ["gate", "lobby", "store"];

export function buildRounds(trace = runUcsGraphTrace()) {
  return trace.steps.map((step) => ({
    ...step,
    isSetup: step.pickCandidates.length <= 1,
    dupChildren: step.children.filter((c) => c.status === "open-worse-skip" || c.status === "open-replace"),
    infoChildren: step.children.filter((c) => c.status === "new" || c.status === "closed-skip"),
  }));
}

export function checkPickAnswer(round, selectedId) {
  return { correct: selectedId === round.expandedId };
}

// insert=true는 "새 값을 오픈 리스트에 넣는다(=기존 값을 교체한다)"는 학생의 선택.
export function checkDupAnswer(dupChild, insert) {
  const shouldInsert = dupChild.status === "open-replace";
  return { correct: insert === shouldInsert, shouldInsert };
}

export function summarize({ trace = runUcsGraphTrace() } = {}) {
  const fewerHopsCost = pathCostFor(FEWER_HOPS_PATH);
  return {
    path: trace.path,
    pathCost: trace.pathCost,
    hops: trace.path.length - 1,
    testedCount: trace.order.length,
    fewerHopsPath: FEWER_HOPS_PATH,
    fewerHopsCost,
    fewerHopsHops: FEWER_HOPS_PATH.length - 1,
    saved: fewerHopsCost - trace.pathCost,
  };
}

export function pathLabel(pathIds) {
  return pathIds.map((id) => nodeLabel(id)).join(" → ");
}

export { START, GOAL };
