// 강 건너기 활동의 상태·행동·안전 판정 로직. 화면과 독립된 순수 함수만 둔다.
export const RIVER_ITEMS = [
  { id: "wolf", label: "늑대", icon: "🐺" },
  { id: "sheep", label: "양", icon: "🐑" },
  { id: "cabbage", label: "양배추", icon: "🥬" },
];

export const RIVER_INITIAL = Object.freeze({ farmer: "L", wolf: "L", sheep: "L", cabbage: "L" });
export const RIVER_GOAL = Object.freeze({ farmer: "R", wolf: "R", sheep: "R", cabbage: "R" });

export function riverStateKey(state) {
  return `${state.farmer}${state.wolf}${state.sheep}${state.cabbage}`;
}

export function isRiverGoal(state) {
  return riverStateKey(state) === riverStateKey(RIVER_GOAL);
}

export function isRiverInitial(state) {
  return riverStateKey(state) === riverStateKey(RIVER_INITIAL);
}

export function riverDanger(state) {
  const dangers = [];
  if (state.wolf === state.sheep && state.farmer !== state.wolf) {
    dangers.push({ pair: ["wolf", "sheep"], message: "농부가 없는 사이 늑대가 양을 잡아먹어요." });
  }
  if (state.sheep === state.cabbage && state.farmer !== state.sheep) {
    dangers.push({ pair: ["sheep", "cabbage"], message: "농부가 없는 사이 양이 양배추를 먹어치워요." });
  }
  return dangers;
}

export function isRiverSafe(state) {
  return riverDanger(state).length === 0;
}

export function riverActionOptions(state) {
  return [
    { id: "farmer", label: "농부 혼자 건너기", available: true },
    ...RIVER_ITEMS.map((item) => ({
      id: item.id,
      label: `농부 + ${item.label} 건너기`,
      available: state[item.id] === state.farmer,
    })),
  ];
}

export function applyRiverAction(state, actionId) {
  const nextSide = state.farmer === "L" ? "R" : "L";
  const next = { ...state, farmer: nextSide };
  if (actionId !== "farmer") next[actionId] = nextSide;
  return next;
}

export function createRiverSession() {
  return {
    state: RIVER_INITIAL,
    history: [],
    visitedKeys: new Set([riverStateKey(RIVER_INITIAL)]),
    solved: false,
  };
}

export function tryRiverMove(session, actionId) {
  const option = riverActionOptions(session.state).find((item) => item.id === actionId);
  if (!option?.available) return { ok: false, reason: "unavailable" };
  const attempted = applyRiverAction(session.state, actionId);
  const dangers = riverDanger(attempted);
  if (dangers.length) return { ok: false, reason: "unsafe", dangers, attempted };
  const key = riverStateKey(attempted);
  const wasVisited = session.visitedKeys.has(key);
  session.history.push({ order: session.history.length + 1, from: session.state, action: actionId, to: attempted, wasVisited });
  session.state = attempted;
  session.visitedKeys.add(key);
  session.solved = isRiverGoal(attempted);
  return { ok: true, state: attempted, wasVisited, solved: session.solved };
}

export function solveRiverBfs(initial = RIVER_INITIAL, goal = RIVER_GOAL) {
  const startKey = riverStateKey(initial);
  const goalKey = riverStateKey(goal);
  const visited = new Set([startKey]);
  const parent = new Map();
  let frontier = [initial];
  while (frontier.length && !visited.has(goalKey)) {
    const next = [];
    for (const state of frontier) {
      for (const option of riverActionOptions(state)) {
        if (!option.available) continue;
        const attempted = applyRiverAction(state, option.id);
        const key = riverStateKey(attempted);
        if (!isRiverSafe(attempted) || visited.has(key)) continue;
        visited.add(key);
        parent.set(key, { fromKey: riverStateKey(state), action: option.id, state: attempted });
        next.push(attempted);
      }
    }
    frontier = next;
  }
  if (!visited.has(goalKey)) return { path: [], moves: 0, reached: false };
  const path = [];
  let current = goalKey;
  while (current !== startKey) {
    const step = parent.get(current);
    path.unshift({ action: step.action, state: step.state });
    current = step.fromKey;
  }
  return { path, moves: path.length, reached: true };
}

export function buildRiverStateSpace(initial = RIVER_INITIAL) {
  const nodes = [{ key: riverStateKey(initial), state: initial, depth: 0 }];
  const edges = [];
  const discovered = new Map([[riverStateKey(initial), nodes[0]]]);
  const queue = [nodes[0]];
  while (queue.length) {
    const node = queue.shift();
    for (const option of riverActionOptions(node.state)) {
      if (!option.available) continue;
      const attempted = applyRiverAction(node.state, option.id);
      const to = riverStateKey(attempted);
      const dangers = riverDanger(attempted);
      if (dangers.length) {
        edges.push({ from: node.key, to, action: option.id, status: "unsafe", attempted, dangers });
        continue;
      }
      const existing = discovered.get(to);
      if (existing) {
        edges.push({ from: node.key, to, action: option.id, status: "repeat" });
        continue;
      }
      const nextNode = { key: to, state: attempted, depth: node.depth + 1 };
      discovered.set(to, nextNode);
      nodes.push(nextNode);
      queue.push(nextNode);
      edges.push({ from: node.key, to, action: option.id, status: "new" });
    }
  }
  return { nodes, edges };
}
