import { runBfsLayers, runPriorityTrace, pathCostUnder } from "../shared/search-lab.js";

// 학생이 손으로 직접 예측하는 확장 단계 수(맨 처음 시작 칸 자신은 제외, 나머지는 "빠르게 진행하기").
export const INTERACTIVE_STEP_CAP = 8;

// steps[0]은 오픈 리스트에 시작 칸 하나뿐이라 예측할 게 없으므로, 문제는 steps[1]부터 만든다.
export function buildUcsSteps(ucsResult = runPriorityTrace({ useHeuristic: false })) {
  return ucsResult.steps.slice(1).map((step, index) => ({
    ...step,
    displayIndex: index + 1,
    interactive: index + 1 <= INTERACTIVE_STEP_CAP,
  }));
}

export function checkStepAnswer(step, selectedCellId) {
  return { correct: selectedCellId === step.expanded };
}

export function summarize({ bfsResult = runBfsLayers(), ucsResult = runPriorityTrace({ useHeuristic: false }) } = {}) {
  const bfsCostUnderSnow = pathCostUnder(bfsResult.path, "snow");
  return {
    ucsOpened: ucsResult.opened,
    ucsPathCost: ucsResult.pathCost,
    ucsPath: ucsResult.path,
    ucsHops: ucsResult.path.length - 1,
    bfsPath: bfsResult.path,
    bfsCostUnderSnow,
    bfsHops: bfsResult.path.length - 1,
    cheaper: bfsCostUnderSnow - ucsResult.pathCost,
  };
}
