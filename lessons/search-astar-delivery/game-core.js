export const GOAL_STATE = Object.freeze([1, 2, 3, 8, 0, 4, 7, 6, 5]);
export const NEW_GOAL_STATE = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 0]);
export const TEXTBOOK_START = Object.freeze([2, 8, 3, 1, 6, 4, 7, 0, 5]);
export const NEW_START = Object.freeze([1, 2, 3, 4, 8, 5, 0, 7, 6]);

export const MOVE_ORDER = Object.freeze([
  { key: "up", label: "위", delta: -3 },
  { key: "down", label: "아래", delta: 3 },
  { key: "left", label: "왼쪽", delta: -1 },
  { key: "right", label: "오른쪽", delta: 1 },
]);

export function boardKey(board) {
  return board.join(",");
}

export function misplacedTiles(board, goal = GOAL_STATE) {
  return board.reduce((count, tile, index) => count + (tile !== 0 && tile !== goal[index] ? 1 : 0), 0);
}

export function getNeighbors(board) {
  const blank = board.indexOf(0);
  const row = Math.floor(blank / 3);
  const col = blank % 3;
  return MOVE_ORDER.flatMap((move) => {
    if ((move.key === "up" && row === 0) ||
        (move.key === "down" && row === 2) ||
        (move.key === "left" && col === 0) ||
        (move.key === "right" && col === 2)) return [];
    const target = blank + move.delta;
    const next = [...board];
    [next[blank], next[target]] = [next[target], next[blank]];
    return [{ board: next, move: move.label }];
  });
}

function sortedOpen(open, bestG, closed) {
  return open
    .filter((item) => !closed.has(item.key) && bestG.get(item.key) === item.g)
    .sort((a, b) => a.f - b.f || a.serial - b.serial);
}

export function solveAstar(start, goal = GOAL_STATE) {
  const startBoard = [...start];
  const startKey = boardKey(startBoard);
  const goalKey = boardKey(goal);
  let serial = 0;
  const startNode = {
    key: startKey, board: startBoard, g: 0,
    h: misplacedTiles(startBoard, goal), parentKey: null, move: "시작", serial: serial++,
  };
  startNode.f = startNode.g + startNode.h;

  const open = [startNode];
  const bestG = new Map([[startKey, 0]]);
  const closed = new Set();
  const nodes = new Map([[startKey, startNode]]);
  const steps = [];

  while (open.length) {
    const candidates = sortedOpen(open, bestG, closed);
    if (!candidates.length) break;
    const current = candidates[0];
    open.splice(open.indexOf(current), 1);
    closed.add(current.key);
    steps.push({
      index: steps.length,
      chosenKey: current.key,
      chosen: current,
      candidates: candidates.map((candidate) => ({ ...candidate, board: [...candidate.board] })),
    });

    if (current.key === goalKey) {
      const path = [];
      let cursor = current;
      while (cursor) {
        path.push(cursor);
        cursor = cursor.parentKey ? nodes.get(cursor.parentKey) : null;
      }
      path.reverse();
      return { found: true, steps, path, opened: closed.size, cost: current.g };
    }

    for (const neighbor of getNeighbors(current.board)) {
      const key = boardKey(neighbor.board);
      const g = current.g + 1;
      if (closed.has(key) || (bestG.has(key) && bestG.get(key) <= g)) continue;
      const node = {
        key, board: neighbor.board, g,
        h: misplacedTiles(neighbor.board, goal),
        parentKey: current.key, move: neighbor.move, serial: serial++,
      };
      node.f = node.g + node.h;
      bestG.set(key, g);
      nodes.set(key, node);
      open.push(node);
    }
  }
  return { found: false, steps, path: [], opened: closed.size, cost: null };
}

export function checkChoice(step, selectedKey) {
  return { correct: step.chosenKey === selectedKey, answer: step.chosen };
}
