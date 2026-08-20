// 8-퍼즐 활동 전용 BFS·DFS 탐색 로직.
export const PUZZLE_GOAL = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 0]);
export const PUZZLE_START = Object.freeze([1, 2, 3, 4, 6, 0, 7, 5, 8]);
export const PUZZLE_DIRECTIONS = [
  { id: "up", label: "위", dr: -1, dc: 0 },
  { id: "down", label: "아래", dr: 1, dc: 0 },
  { id: "left", label: "왼쪽", dr: 0, dc: -1 },
  { id: "right", label: "오른쪽", dr: 0, dc: 1 },
];
export const PUZZLE_INTERACTIVE_ROUND_CAP = 2;

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

function reconstruct(parent, goalKey, startKey) {
  const path = [goalKey];
  let current = goalKey;
  while (current !== startKey) {
    current = parent.get(current).fromKey;
    path.push(current);
  }
  return path.reverse();
}

export function runPuzzleBfsRounds(start = PUZZLE_START, goal = PUZZLE_GOAL, maxDepth = 3) {
  const startKey = puzzleKey(start);
  const goalKey = puzzleKey(goal);
  const visited = new Set([startKey]);
  const parent = new Map();
  const rounds = [];
  let frontier = [start];
  let depth = 0;
  let reachedAtDepth = null;
  while (frontier.length && depth < maxDepth) {
    const candidateInfo = new Map();
    frontier.forEach((state) => puzzleMoves(state).forEach((move) => {
      const key = puzzleKey(move.state);
      if (!candidateInfo.has(key)) candidateInfo.set(key, { ...move, fromKey: puzzleKey(state) });
    }));
    const newStates = [];
    const dupStates = [];
    for (const [key, info] of candidateInfo) {
      if (visited.has(key)) dupStates.push(key);
      else {
        visited.add(key);
        parent.set(key, info);
        newStates.push(key);
      }
    }
    depth += 1;
    const containsGoal = newStates.includes(goalKey);
    rounds.push({ depth, frontierBefore: frontier.map(puzzleKey), candidates: [...candidateInfo.keys()], candidateInfo, newStates, dupStates, containsGoal });
    if (containsGoal) { reachedAtDepth = depth; break; }
    frontier = newStates.map((key) => candidateInfo.get(key).state);
  }
  return { rounds, reachedAtDepth, path: reachedAtDepth ? reconstruct(parent, goalKey, startKey) : null, opened: visited.size, parent };
}

export function runPuzzleDfs(start = PUZZLE_START, goal = PUZZLE_GOAL, maxDepth = 12) {
  const startKey = puzzleKey(start);
  const goalKey = puzzleKey(goal);
  const visited = new Set([startKey]);
  const parent = new Map();
  const stack = [{ state: start, depth: 0 }];
  const order = [startKey];
  while (stack.length) {
    const { state, depth } = stack.pop();
    const key = puzzleKey(state);
    if (key === goalKey) return { path: reconstruct(parent, goalKey, startKey), opened: visited.size, order, parent };
    if (depth >= maxDepth) continue;
    const children = [];
    puzzleMoves(state).forEach((move) => {
      const nextKey = puzzleKey(move.state);
      if (visited.has(nextKey)) return;
      visited.add(nextKey);
      parent.set(nextKey, { fromKey: key, dir: move.dir, dirLabel: move.dirLabel });
      order.push(nextKey);
      children.push({ state: move.state, depth: depth + 1 });
    });
    for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
  }
  return { path: null, opened: visited.size, order, parent };
}

export function puzzlePathSteps(result) {
  if (!result.path) return [];
  return result.path.map((key, index) => ({ key, dirLabel: index === 0 ? null : result.parent.get(key)?.dirLabel }));
}

export function summarizePuzzle(bfs, dfs) {
  return {
    bfsMoves: bfs.path ? bfs.path.length - 1 : null,
    bfsOpened: bfs.opened,
    dfsMoves: dfs.path ? dfs.path.length - 1 : null,
    dfsOpened: dfs.opened,
  };
}
