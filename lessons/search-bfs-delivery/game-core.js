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
    gameOver: false,
  };
}

// 위험한 행동을 "시도조차 못 하게" 막지 않는다 — 실제로 건너가게 두고, 그 결과 늑대가 양을
// 잡아먹거나 양이 양배추를 먹어치우면 게임 오버로 끝낸다(농부가 반대편이라 애초에 태울 수
// 없는 행동만 막는다).
export function tryRiverMove(session, actionId) {
  const option = riverActionOptions(session.state).find((item) => item.id === actionId);
  if (!option?.available) return { ok: false, reason: "unavailable" };
  const attempted = applyRiverAction(session.state, actionId);
  const dangers = riverDanger(attempted);
  const key = riverStateKey(attempted);
  const wasVisited = session.visitedKeys.has(key);
  session.history.push({
    order: session.history.length + 1, from: session.state, action: actionId, to: attempted, wasVisited, dangers,
  });
  session.state = attempted;
  session.visitedKeys.add(key);
  if (dangers.length) {
    session.gameOver = true;
    return { ok: true, state: attempted, wasVisited, solved: false, gameOver: true, dangers };
  }
  session.solved = isRiverGoal(attempted);
  return { ok: true, state: attempted, wasVisited, solved: session.solved, gameOver: false };
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

// ── 2부: 선교사와 식인종 건너기 ────────────────────────────────────────────
// 늑대·양·양배추 문제와 달리 "농부" 역할이 따로 없다 — 배는 정원 2명 안에서
// 선교사·식인종을 어떤 조합으로든 태울 수 있다. 상태는 각 역할이 왼쪽 둑에
// 몇 명 있는지와 배가 어느 둑에 있는지로만 결정된다(개인을 구분하지 않는다).
export const MC_ROLES = [
  { id: "m", label: "선교사", icon: "😇" },
  { id: "c", label: "식인종", icon: "😈" },
];
export const MC_GROUP_SIZE = 3;
export const MC_BOAT_CAPACITY = 2;
export const MC_INITIAL = Object.freeze({ mLeft: MC_GROUP_SIZE, cLeft: MC_GROUP_SIZE, boat: "L" });
export const MC_GOAL = Object.freeze({ mLeft: 0, cLeft: 0, boat: "R" });

export function mcStateKey(state) {
  return `${state.mLeft}${state.cLeft}${state.boat}`;
}

export function isMcGoal(state) {
  return mcStateKey(state) === mcStateKey(MC_GOAL);
}

export function isMcInitial(state) {
  return mcStateKey(state) === mcStateKey(MC_INITIAL);
}

export function mcBank(state, side) {
  return side === "L"
    ? { m: state.mLeft, c: state.cLeft }
    : { m: MC_GROUP_SIZE - state.mLeft, c: MC_GROUP_SIZE - state.cLeft };
}

export function mcDanger(state) {
  const dangers = [];
  for (const side of ["L", "R"]) {
    const bank = mcBank(state, side);
    if (bank.m > 0 && bank.c > bank.m) {
      dangers.push({ side, message: `${side === "L" ? "왼쪽" : "오른쪽"}에서 식인종(${bank.c}명)이 선교사(${bank.m}명)보다 많아 선교사를 잡아먹어요.` });
    }
  }
  return dangers;
}

export function isMcSafe(state) {
  return mcDanger(state).length === 0;
}

// 배가 있는 쪽에서 태울 수 있는 모든 조합(선교사 m명 + 식인종 c명, 합계 1~정원)을 만든다.
export function mcCrossingOptions(state) {
  const boatBank = mcBank(state, state.boat);
  const options = [];
  for (let m = 0; m <= Math.min(MC_BOAT_CAPACITY, boatBank.m); m += 1) {
    for (let c = 0; c <= Math.min(MC_BOAT_CAPACITY - m, boatBank.c); c += 1) {
      if (m + c === 0) continue;
      options.push({ m, c });
    }
  }
  return options;
}

export function mcCrossingKey(crossing) {
  return `${crossing.m}m${crossing.c}c`;
}

export function mcCrossingLabel(crossing) {
  const parts = [];
  if (crossing.m) parts.push(`선교사 ${crossing.m}명`);
  if (crossing.c) parts.push(`식인종 ${crossing.c}명`);
  return parts.join(" + ");
}

export function applyMcCrossing(state, crossing) {
  const sign = state.boat === "L" ? -1 : 1;
  return {
    mLeft: state.mLeft + (sign * crossing.m),
    cLeft: state.cLeft + (sign * crossing.c),
    boat: state.boat === "L" ? "R" : "L",
  };
}

export function createMcSession() {
  return {
    state: MC_INITIAL,
    history: [],
    visitedKeys: new Set([mcStateKey(MC_INITIAL)]),
    solved: false,
    gameOver: false,
  };
}

// 위험한 조합을 "시도조차 못 하게" 막지 않는다 — 실제로 건너가게 두고, 그 결과 식인종이
// 선교사를 잡아먹으면 게임 오버로 끝낸다(정원 초과 등 애초에 배에 태울 수 없는 조합만 막는다).
export function tryMcCrossing(session, crossing) {
  const total = crossing.m + crossing.c;
  if (total < 1 || total > MC_BOAT_CAPACITY) return { ok: false, reason: "unavailable" };
  const boatBank = mcBank(session.state, session.state.boat);
  if (crossing.m > boatBank.m || crossing.c > boatBank.c) return { ok: false, reason: "unavailable" };
  const attempted = applyMcCrossing(session.state, crossing);
  const dangers = mcDanger(attempted);
  const key = mcStateKey(attempted);
  const wasVisited = session.visitedKeys.has(key);
  session.history.push({
    order: session.history.length + 1, from: session.state, crossing, to: attempted, wasVisited, dangers,
  });
  session.state = attempted;
  session.visitedKeys.add(key);
  if (dangers.length) {
    session.gameOver = true;
    return { ok: true, state: attempted, wasVisited, solved: false, gameOver: true, dangers };
  }
  session.solved = isMcGoal(attempted);
  return { ok: true, state: attempted, wasVisited, solved: session.solved, gameOver: false };
}

export function solveMcBfs(initial = MC_INITIAL, goal = MC_GOAL) {
  const startKey = mcStateKey(initial);
  const goalKey = mcStateKey(goal);
  const visited = new Set([startKey]);
  const parent = new Map();
  let frontier = [initial];
  while (frontier.length && !visited.has(goalKey)) {
    const next = [];
    for (const state of frontier) {
      for (const crossing of mcCrossingOptions(state)) {
        const attempted = applyMcCrossing(state, crossing);
        const key = mcStateKey(attempted);
        if (!isMcSafe(attempted) || visited.has(key)) continue;
        visited.add(key);
        parent.set(key, { fromKey: mcStateKey(state), crossing, state: attempted });
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
    path.unshift({ crossing: step.crossing, state: step.state });
    current = step.fromKey;
  }
  return { path, moves: path.length, reached: true };
}
