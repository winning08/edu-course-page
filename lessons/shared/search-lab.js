// '인공지능과 탐색' 활동지(BFS·균일 비용 탐색·A*)가 함께 쓰는 학교 지도와 탐색 엔진.
// 세 활동 모두 같은 지도(벽 배치)를 그대로 재사용하고, "눈이 오기 전/후"를 비용 프로필로만 바꾼다.

export const ROWS = 6;
export const COLS = 6;
const COL_LETTERS = ["A", "B", "C", "D", "E", "F"];

// true = 이동 가능한 칸, false = 벽(이동 불가). 세 활동이 공유하는 유일한 지도 구조.
export const WALL_LAYOUT = [
  [true, true, true, false, true, true],
  [true, false, true, false, true, true],
  [true, false, true, true, true, false],
  [true, true, true, false, true, true],
  [false, false, true, false, true, false],
  [true, true, true, true, true, true],
];

// 눈이 쌓인 정도(이동 비용). 1=평지, 2=살짝 쌓임, 3=많이 쌓임. 벽 칸의 값은 쓰이지 않는다.
export const SNOW_COST = [
  [1, 1, 1, 0, 1, 1],
  [2, 0, 1, 0, 3, 1],
  [1, 0, 1, 1, 1, 0],
  [1, 1, 1, 0, 1, 1],
  [0, 0, 2, 0, 1, 0],
  [1, 1, 1, 1, 1, 1],
];

export const START = { row: 0, col: 0 };
export const GOAL = { row: ROWS - 1, col: COLS - 1 };

// 빈칸(로봇)이 다음 칸을 고를 때 비용이 같으면 이 순서로 먼저 살펴본다(교과서 8-퍼즐 예시와 동일한 순서).
const DIRECTIONS = [
  { dr: -1, dc: 0, name: "위" },
  { dr: 1, dc: 0, name: "아래" },
  { dr: 0, dc: -1, name: "왼쪽" },
  { dr: 0, dc: 1, name: "오른쪽" },
];

export function cellId(row, col) {
  return `${COL_LETTERS[col]}${row + 1}`;
}

export function parseCellId(id) {
  const col = COL_LETTERS.indexOf(id[0]);
  const row = Number(id.slice(1)) - 1;
  return { row, col };
}

export function isInBounds(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

export function isOpen(row, col) {
  return isInBounds(row, col) && WALL_LAYOUT[row][col];
}

export function neighbors(row, col) {
  const out = [];
  for (const { dr, dc, name } of DIRECTIONS) {
    const nr = row + dr;
    const nc = col + dc;
    if (isOpen(nr, nc)) out.push({ row: nr, col: nc, dir: name, id: cellId(nr, nc) });
  }
  return out;
}

export function manhattan(row, col, goal = GOAL) {
  return Math.abs(row - goal.row) + Math.abs(col - goal.col);
}

// profile: "flat"(활동01 · 눈 오기 전, 칸마다 비용 1) | "snow"(활동02·03 · 실제 눈 쌓인 비용)
export function costAt(row, col, profile) {
  return profile === "snow" ? SNOW_COST[row][col] : 1;
}

export function pathCostUnder(pathIds, profile) {
  let total = 0;
  for (let i = 1; i < pathIds.length; i += 1) {
    const { row, col } = parseCellId(pathIds[i]);
    total += costAt(row, col, profile);
  }
  return total;
}

function reconstructPath(parent, goalId, startId) {
  const path = [goalId];
  let cur = goalId;
  while (cur !== startId) {
    cur = parent.get(cur);
    path.push(cur);
  }
  return path.reverse();
}

// 너비 우선 탐색(BFS). 라운드(층)별로 한꺼번에 넓혀가며, 라운드마다 "다음 라운드에 열릴 칸"을
// 예측하는 활동01의 UI가 그대로 쓸 수 있도록 layers 배열을 함께 반환한다.
export function runBfsLayers() {
  const startId = cellId(START.row, START.col);
  const goalId = cellId(GOAL.row, GOAL.col);
  const visited = new Set([startId]);
  const parent = new Map();
  const order = [];
  const layers = [];
  let frontier = [startId];
  while (frontier.length > 0) {
    layers.push([...frontier]);
    order.push(...frontier);
    const next = [];
    for (const id of frontier) {
      const { row, col } = parseCellId(id);
      for (const n of neighbors(row, col)) {
        if (!visited.has(n.id)) {
          visited.add(n.id);
          parent.set(n.id, id);
          next.push(n.id);
        }
      }
    }
    frontier = next;
  }
  const reached = visited.has(goalId);
  const path = reached ? reconstructPath(parent, goalId, startId) : null;
  return {
    layers,
    order,
    parent,
    path,
    opened: order.length,
    pathCost: path ? pathCostUnder(path, "flat") : null,
  };
}

// 깊이 우선 탐색(DFS). 활동01의 "BFS/DFS 짧은 비교"용으로, 같은 지도·같은 방향 우선순위(위→아래→왼쪽→오른쪽)를
// 스택으로 재귀 대신 반복문으로 처리한다. 인터랙티브 활동으로는 쓰지 않고 비교 수치·경로만 보여준다.
export function runDfs() {
  const startId = cellId(START.row, START.col);
  const goalId = cellId(GOAL.row, GOAL.col);
  const visited = new Set([startId]);
  const parent = new Map();
  const order = [];
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop();
    order.push(id);
    if (id === goalId) break;
    const { row, col } = parseCellId(id);
    const toPush = [];
    for (const n of neighbors(row, col)) {
      if (!visited.has(n.id)) {
        visited.add(n.id);
        parent.set(n.id, id);
        toPush.push(n.id);
      }
    }
    // 스택은 후입선출이므로, 방향 우선순위(위→아래→왼쪽→오른쪽)대로 먼저 가 보려면 역순으로 넣는다.
    for (let i = toPush.length - 1; i >= 0; i -= 1) stack.push(toPush[i]);
  }
  const reached = visited.has(goalId);
  const path = reached ? reconstructPath(parent, goalId, startId) : null;
  return {
    order,
    parent,
    path,
    opened: order.length,
    pathCost: path ? pathCostUnder(path, "flat") : null,
  };
}

// 균일 비용 탐색(UCS, heuristic 없음)과 A*(heuristic=맨해튼 거리)를 하나의 엔진으로 계산한다.
// 각 확장 단계마다 그 시점의 오픈 리스트를 f(=g+h) 기준으로 정렬해 상위 4개까지 후보 카드로 남긴다.
export function runPriorityTrace({ useHeuristic }) {
  const startId = cellId(START.row, START.col);
  const goalId = cellId(GOAL.row, GOAL.col);
  const g = new Map([[startId, 0]]);
  const parent = new Map();
  const closed = new Set();
  let open = [{ id: startId, g: 0, h: useHeuristic ? manhattan(START.row, START.col) : 0 }];
  const steps = [];
  const order = [];

  const priority = (entry) => entry.g + entry.h;

  while (open.length > 0) {
    open.sort((a, b) => {
      const fa = priority(a);
      const fb = priority(b);
      if (fa !== fb) return fa - fb;
      if (a.h !== b.h) return a.h - b.h;
      return 0;
    });
    const candidates = open.slice(0, 4).map((entry) => ({
      cellId: entry.id,
      g: entry.g,
      h: entry.h,
      f: priority(entry),
    }));
    const winner = open.shift();
    if (closed.has(winner.id)) continue;
    closed.add(winner.id);
    order.push(winner.id);
    steps.push({
      index: steps.length,
      expanded: winner.id,
      g: winner.g,
      h: winner.h,
      f: priority(winner),
      candidates,
    });
    if (winner.id === goalId) break;
    const { row, col } = parseCellId(winner.id);
    for (const n of neighbors(row, col)) {
      if (closed.has(n.id)) continue;
      const cost = costAt(n.row, n.col, "snow");
      const ng = winner.g + cost;
      if (!g.has(n.id) || ng < g.get(n.id)) {
        g.set(n.id, ng);
        parent.set(n.id, winner.id);
        const h = useHeuristic ? manhattan(n.row, n.col) : 0;
        const existingIndex = open.findIndex((entry) => entry.id === n.id);
        const entry = { id: n.id, g: ng, h };
        if (existingIndex >= 0) open[existingIndex] = entry;
        else open.push(entry);
      }
    }
  }

  const reached = closed.has(goalId);
  const path = reached ? reconstructPath(parent, goalId, startId) : null;
  return {
    steps,
    order,
    parent,
    path,
    opened: order.length,
    pathCost: path ? pathCostUnder(path, "snow") : null,
  };
}

// A*가 "목표에 가까워 보이는(h가 작은) 칸"이 실제로는 더 비싼(g가 큰) 함정이 되는 첫 단계를 찾는다.
// 실제 트레이스 결과에서 계산하므로 지도를 손으로 다시 맞출 필요가 없다.
export function findGreedyTrapStep(steps) {
  for (const step of steps) {
    if (step.candidates.length < 2) continue;
    const [winner, ...rest] = step.candidates;
    const trap = rest.find((c) => c.h < winner.h && c.g > winner.g);
    if (trap) return { stepIndex: step.index, winner, trap };
  }
  return null;
}
