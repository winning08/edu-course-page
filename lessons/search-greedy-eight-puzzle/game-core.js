// 8-퍼즐 최상 우선 탐색(Greedy Best-First Search) 활동 전용 로직.
// 이 활동만의 초기 상태·목표 상태를 쓴다(활동02 "8-퍼즐로 보는 맹목적 탐색"과는 다른 문제).
export const PUZZLE_START = Object.freeze([2, 8, 3, 1, 6, 4, 7, 0, 5]);
export const PUZZLE_GOAL = Object.freeze([1, 2, 3, 8, 0, 4, 7, 6, 5]);

export const PUZZLE_DIRECTIONS = [
  { id: "up", label: "위", dr: -1, dc: 0 },
  { id: "down", label: "아래", dr: 1, dc: 0 },
  { id: "left", label: "왼쪽", dr: 0, dc: -1 },
  { id: "right", label: "오른쪽", dr: 0, dc: 1 },
];

export const puzzleKey = (state) => state.join("");
export const parsePuzzleKey = (key) => key.split("").map(Number);
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

function goalPositionsOf(goal) {
  const positions = new Map();
  goal.forEach((value, index) => positions.set(value, { row: Math.floor(index / 3), col: index % 3 }));
  return positions;
}

// 맨해튼 거리 휴리스틱: 빈칸을 뺀 각 숫자가 목표 위치까지 가로+세로로 몇 칸 떨어져 있는지 모두 더한다.
export function manhattanDistance(state, goal = PUZZLE_GOAL) {
  const goalPositions = goalPositionsOf(goal);
  let total = 0;
  state.forEach((value, index) => {
    if (value === 0) return;
    const row = Math.floor(index / 3);
    const col = index % 3;
    const target = goalPositions.get(value);
    total += Math.abs(row - target.row) + Math.abs(col - target.col);
  });
  return total;
}

function reconstruct(parent, goalKey, startKey) {
  const path = [goalKey];
  let current = goalKey;
  while (current !== startKey) {
    current = parent.get(current).fromKey;
    path.push(current);
  }
  return path.reverse();
}

// mode: "greedy"(h(n)만 사용) | "astar"(g(n)+h(n)) | "ucs"(g(n)만 사용)
// 매 확장 단계마다 그 시점의 오픈 리스트를 우선순위 기준으로 정렬해 상위 후보를 카드로 남긴다.
export function runPuzzlePriorityTrace(mode, { start = PUZZLE_START, goal = PUZZLE_GOAL, maxCandidates = 4 } = {}) {
  const startKey = puzzleKey(start);
  const goalKey = puzzleKey(goal);
  const bestG = new Map([[startKey, 0]]);
  const parent = new Map();
  const closed = new Set();
  const priorityOf = (entry) => {
    if (mode === "greedy") return entry.h;
    if (mode === "ucs") return entry.g;
    return entry.g + entry.h;
  };
  let open = [{ key: startKey, state: start, g: 0, h: manhattanDistance(start, goal), dirLabel: null }];
  const steps = [];
  const order = [];

  while (open.length > 0) {
    open.sort((a, b) => {
      const diff = priorityOf(a) - priorityOf(b);
      if (diff !== 0) return diff;
      if (a.h !== b.h) return a.h - b.h;
      return 0;
    });
    const candidates = open.slice(0, maxCandidates).map((entry) => ({
      key: entry.key, state: entry.state, g: entry.g, h: entry.h, f: priorityOf(entry), dirLabel: entry.dirLabel,
    }));
    const winner = open.shift();
    if (closed.has(winner.key)) continue;
    closed.add(winner.key);
    order.push(winner.key);
    steps.push({
      index: steps.length,
      expandedKey: winner.key,
      state: winner.state,
      g: winner.g,
      h: winner.h,
      f: priorityOf(winner),
      dirLabel: winner.dirLabel,
      candidates,
    });
    if (winner.key === goalKey) break;
    puzzleMoves(winner.state).forEach((move) => {
      const key = puzzleKey(move.state);
      if (closed.has(key)) return;
      const ng = winner.g + 1;
      if (!bestG.has(key) || ng < bestG.get(key)) {
        bestG.set(key, ng);
        parent.set(key, { fromKey: winner.key, dirLabel: move.dirLabel });
        const entry = { key, state: move.state, g: ng, h: manhattanDistance(move.state, goal), dirLabel: move.dirLabel };
        const existingIndex = open.findIndex((candidate) => candidate.key === key);
        if (existingIndex >= 0) open[existingIndex] = entry;
        else open.push(entry);
      }
    });
  }

  const reached = closed.has(goalKey);
  const path = reached ? reconstruct(parent, goalKey, startKey) : null;
  return { steps, order, parent, path, opened: order.length, pathLength: path ? path.length - 1 : null };
}

// 너비 우선 탐색(BFS)이 이 퍼즐에서 몇 개 상태를 열어보고, 몇 번 이동으로 목표에 닿는지 계산한다
// (비교표용 수치만 필요하므로 인터랙티브 단계는 따로 만들지 않는다).
export function runPuzzleBfsCount(start = PUZZLE_START, goal = PUZZLE_GOAL) {
  const startKey = puzzleKey(start);
  const goalKey = puzzleKey(goal);
  const visited = new Set([startKey]);
  const parent = new Map();
  let opened = 1;
  let frontier = [start];
  while (frontier.length > 0 && !frontier.some((state) => puzzleKey(state) === goalKey)) {
    const next = [];
    for (const state of frontier) {
      for (const move of puzzleMoves(state)) {
        const key = puzzleKey(move.state);
        if (visited.has(key)) continue;
        visited.add(key);
        parent.set(key, { fromKey: puzzleKey(state) });
        opened += 1;
        next.push(move.state);
      }
    }
    frontier = next;
  }
  const reached = visited.has(goalKey);
  const path = reached ? reconstruct(parent, goalKey, startKey) : null;
  return { opened, pathLength: path ? path.length - 1 : null };
}

export function checkStepAnswer(step, selectedKey) {
  return { correct: selectedKey === step.expandedKey };
}

export function buildComparison({ start = PUZZLE_START, goal = PUZZLE_GOAL } = {}) {
  const bfs = runPuzzleBfsCount(start, goal);
  const greedy = runPuzzlePriorityTrace("greedy", { start, goal });
  return {
    bfs: { opened: bfs.opened, pathLength: bfs.pathLength },
    greedy: { opened: greedy.opened, pathLength: greedy.pathLength },
  };
}
