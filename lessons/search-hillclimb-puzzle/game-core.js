// 양지고 인공지능 기초 수행평가 "인공지능 탐색 문제 해결(30점)"과 같은 규칙을 쓰는
// 8-퍼즐 언덕 오르기(hill climbing) 연습 활동 전용 로직.
//
// 평가 함수값 = 목표 상태와 같은 위치에 놓인 숫자 타일의 개수(빈칸은 세지 않음). 값이 클수록 좋다.
// 매 단계 직전 상태로 되돌아가는 이동은 다음 상태 후보에서 제외한다(전체 방문 기록은 두지 않는다).
// 평가 함수값이 가장 큰 후보를 다음 상태로 선택하고, 값이 같으면 빈칸의 이동 방향을
// 위 → 왼쪽 → 오른쪽 → 아래 순으로 우선한다.
export const PUZZLE_START = Object.freeze([2, 8, 3, 1, 6, 4, 7, 0, 5]);
export const PUZZLE_GOAL = Object.freeze([1, 2, 3, 8, 0, 4, 7, 6, 5]);

// 수행평가지와 동일한 우선순위: 위 → 왼쪽 → 오른쪽 → 아래(빈칸이 움직이는 방향 기준).
export const PUZZLE_DIRECTIONS = [
  { id: "up", label: "위", dr: -1, dc: 0 },
  { id: "left", label: "왼쪽", dr: 0, dc: -1 },
  { id: "right", label: "오른쪽", dr: 0, dc: 1 },
  { id: "down", label: "아래", dr: 1, dc: 0 },
];

export const puzzleKey = (state) => state.join("");
export const isPuzzleGoal = (state, goal = PUZZLE_GOAL) => puzzleKey(state) === puzzleKey(goal);

export function puzzleMoves(state) {
  const blank = state.indexOf(0);
  const row = Math.floor(blank / 3);
  const col = blank % 3;
  return PUZZLE_DIRECTIONS.flatMap((direction) => {
    const nextRow = row + direction.dr;
    const nextCol = col + direction.dc;
    if (nextRow < 0 || nextRow > 2 || nextCol < 0 || nextCol > 2) return [];
    const nextIndex = nextRow * 3 + nextCol;
    const next = state.slice();
    [next[blank], next[nextIndex]] = [next[nextIndex], next[blank]];
    return [{ dir: direction.id, dirLabel: direction.label, state: next }];
  });
}

// 목표 상태와 같은 위치에 놓인 숫자 타일 개수(빈칸 제외). 값이 클수록 목표에 가깝다고 본다.
export function matchingTileScore(state, goal = PUZZLE_GOAL) {
  let count = 0;
  for (let i = 0; i < state.length; i += 1) {
    if (state[i] !== 0 && state[i] === goal[i]) count += 1;
  }
  return count;
}

// 한 단계: 직전 상태로 돌아가는 이동만 제외한 후보를 만들고, 평가 함수값 최대(동점이면 방향 우선순위)로 다음 상태를 고른다.
export function hillClimbStep(state, previousKey, goal = PUZZLE_GOAL) {
  const candidates = puzzleMoves(state)
    .filter((move) => puzzleKey(move.state) !== previousKey)
    .map((move) => ({ ...move, key: puzzleKey(move.state), score: matchingTileScore(move.state, goal) }));
  let best = candidates[0];
  for (const candidate of candidates) {
    if (candidate.score > best.score) best = candidate;
  }
  return { candidates, best };
}

// 초기 상태부터 목표 상태까지 언덕 오르기를 끝까지 진행해 전체 단계를 만든다(연습지의 정답 트레이스).
export function runHillClimb(start = PUZZLE_START, goal = PUZZLE_GOAL, maxSteps = 20) {
  const steps = [];
  let current = start;
  let previousKey = null;
  let index = 0;
  while (!isPuzzleGoal(current, goal) && index < maxSteps) {
    const { candidates, best } = hillClimbStep(current, previousKey, goal);
    steps.push({ index, state: current, candidates, bestKey: best.key, bestDirLabel: best.dirLabel, bestScore: best.score });
    previousKey = puzzleKey(current);
    current = best.state;
    index += 1;
  }
  return { steps, finalState: current, reached: isPuzzleGoal(current, goal) };
}
