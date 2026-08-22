import {
  runBfsLayers, runPriorityTrace, findGreedyTrapStep, pathCostUnder,
} from "../shared/search-lab.js";

// 총 열어보는 칸이 12개뿐이라(A*의 효율성 자체가 학습 목표) 모든 단계를 학생이 직접 예측한다.
export function buildAstarSteps(astarResult = runPriorityTrace({ useHeuristic: true })) {
  return astarResult.steps.slice(1).map((step, index) => ({
    ...step,
    displayIndex: index + 1,
  }));
}

export function checkStepAnswer(step, selectedCellId) {
  return { correct: selectedCellId === step.expanded };
}

// 실제 트레이스에서 계산된 "h는 작지만 g가 커서 f가 밀리는" 함정 단계.
export function getTrapInfo(astarResult = runPriorityTrace({ useHeuristic: true })) {
  return findGreedyTrapStep(astarResult.steps);
}

export function isTrapStep(step, trapInfo) {
  return Boolean(trapInfo) && step.index === trapInfo.stepIndex;
}

export function buildFinalComparison({
  bfsResult = runBfsLayers(),
  ucsResult = runPriorityTrace({ useHeuristic: false }),
  astarResult = runPriorityTrace({ useHeuristic: true }),
} = {}) {
  return {
    bfs: { opened: bfsResult.opened, pathCost: pathCostUnder(bfsResult.path, "snow"), hops: bfsResult.path.length - 1 },
    ucs: { opened: ucsResult.opened, pathCost: ucsResult.pathCost, hops: ucsResult.path.length - 1 },
    astar: { opened: astarResult.opened, pathCost: astarResult.pathCost, hops: astarResult.path.length - 1 },
  };
}
