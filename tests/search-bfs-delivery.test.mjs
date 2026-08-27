import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  RIVER_ITEMS, RIVER_INITIAL, RIVER_GOAL,
  riverStateKey, isRiverGoal, isRiverInitial,
  riverDanger, isRiverSafe, riverActionOptions, applyRiverAction,
  createRiverSession, tryRiverMove, solveRiverBfs, buildRiverStateSpace,
  MC_ROLES, MC_INITIAL, MC_GOAL, MC_GROUP_SIZE, MC_BOAT_CAPACITY,
  mcStateKey, isMcGoal, isMcInitial, mcBank, mcDanger, isMcSafe,
  mcCrossingOptions, applyMcCrossing, createMcSession, tryMcCrossing, solveMcBfs,
} from "../lessons/search-bfs-delivery/game-core.js";
import {
  PUZZLE_GOAL, PUZZLE_START, PUZZLE_INTERACTIVE_ROUND_CAP,
  puzzleKey, parsePuzzleKey, puzzleMoves, isPuzzleGoal,
  runPuzzleBfsRounds, runPuzzleDfs, summarizePuzzle, puzzlePathSteps,
} from "../lessons/search-eight-puzzle/game-core.js";

const lessonRoot = new URL("../lessons/search-bfs-delivery/", import.meta.url);

// ── 1부: 늑대·양·양배추 강 건너기 ─────────────────────────────────────────

test("초기 상태는 모두 왼쪽, 목표 상태는 모두 오른쪽이다", () => {
  assert.deepEqual(RIVER_INITIAL, { farmer: "L", wolf: "L", sheep: "L", cabbage: "L" });
  assert.deepEqual(RIVER_GOAL, { farmer: "R", wolf: "R", sheep: "R", cabbage: "R" });
  assert.ok(isRiverInitial(RIVER_INITIAL));
  assert.ok(isRiverGoal(RIVER_GOAL));
  assert.ok(!isRiverGoal(RIVER_INITIAL));
});

test("농부가 없는 곳에 늑대·양, 양·양배추가 함께 있으면 위험하다", () => {
  assert.ok(isRiverSafe({ farmer: "L", wolf: "L", sheep: "R", cabbage: "R" }) === false);
  const wolfSheep = riverDanger({ farmer: "R", wolf: "L", sheep: "L", cabbage: "R" });
  assert.equal(wolfSheep.length, 1);
  const sheepCabbage = riverDanger({ farmer: "L", wolf: "L", sheep: "R", cabbage: "R" });
  assert.equal(sheepCabbage.length, 1);
  assert.ok(isRiverSafe({ farmer: "L", wolf: "L", sheep: "L", cabbage: "L" }));
  assert.ok(isRiverSafe(RIVER_GOAL));
});

test("농부가 함께 있으면 늑대·양, 양·양배추가 같은 둑에 있어도 안전하다", () => {
  assert.ok(isRiverSafe({ farmer: "L", wolf: "L", sheep: "L", cabbage: "R" }));
  assert.ok(isRiverSafe({ farmer: "R", wolf: "L", sheep: "R", cabbage: "R" }));
});

test("행동 옵션은 농부와 같은 둑에 있는 항목만 이용 가능하다", () => {
  const options = riverActionOptions(RIVER_INITIAL);
  assert.equal(options.length, 4);
  for (const option of options) assert.ok(option.available, `${option.id}은 초기 상태에서 이용 가능해야 함`);

  const afterSheep = applyRiverAction(RIVER_INITIAL, "sheep");
  const nextOptions = riverActionOptions(afterSheep);
  const byId = Object.fromEntries(nextOptions.map((o) => [o.id, o.available]));
  assert.equal(byId.farmer, true);
  assert.equal(byId.wolf, false, "늑대는 아직 왼쪽 둑에 남아 있어 농부와 같은 둑이 아님");
  assert.equal(byId.sheep, true, "양은 농부와 함께 오른쪽으로 건너감");
  assert.equal(byId.cabbage, false);
});

test("applyRiverAction은 농부와(선택 시) 항목의 둑을 함께 뒤집는다", () => {
  const next = applyRiverAction(RIVER_INITIAL, "wolf");
  assert.deepEqual(next, { farmer: "R", wolf: "R", sheep: "L", cabbage: "L" });
  const farmerAlone = applyRiverAction(next, "farmer");
  assert.deepEqual(farmerAlone, { farmer: "L", wolf: "R", sheep: "L", cabbage: "L" });
});

test("tryRiverMove는 위험한 행동을 막지 않고 실제로 건너가게 한 뒤 게임 오버로 처리한다", () => {
  const session = createRiverSession();
  const result = tryRiverMove(session, "wolf"); // 농부+늑대만 건너면 양과 양배추가 남아 위험
  assert.equal(result.ok, true, "위험한 행동도 시도 자체는 막지 않아야 함");
  assert.equal(result.gameOver, true);
  assert.ok(result.dangers.length > 0);
  assert.deepEqual(session.state, result.state, "위험한 행동도 실제로 세션 상태를 바꿔야 함");
  assert.notDeepEqual(session.state, RIVER_INITIAL);
  assert.equal(session.gameOver, true);
  assert.equal(session.history.length, 1);
  assert.ok(session.history[0].dangers.length > 0);
});

test("tryRiverMove는 안전한 행동을 적용하고 방문 이력을 기록한다", () => {
  const session = createRiverSession();
  const first = tryRiverMove(session, "sheep");
  assert.equal(first.ok, true);
  assert.equal(first.wasVisited, false);
  assert.equal(session.history.length, 1);

  const back = tryRiverMove(session, "farmer");
  assert.equal(back.ok, true);

  const revisit = tryRiverMove(session, "sheep");
  assert.equal(revisit.ok, false, "양은 지금 농부와 다른 둑에 있으므로(오른쪽) 함께 건널 수 없는 행동이어야 함");
  assert.equal(revisit.reason, "unavailable");
});

test("solveRiverBfs는 안전한 상태만 지나며 최소 7번 이동으로 목표에 도달한다", () => {
  const solved = solveRiverBfs();
  assert.equal(solved.reached, true);
  assert.equal(solved.moves, 7, "고전적인 강 건너기 문제의 최적 해는 7번 이동");
  assert.equal(solved.path.length, 7);
  assert.ok(isRiverGoal(solved.path.at(-1).state));
  for (const step of solved.path) assert.ok(isRiverSafe(step.state), `경로의 모든 상태는 안전해야 함: ${riverStateKey(step.state)}`);
});

test("RIVER_ITEMS은 늑대·양·양배추 세 항목을 포함한다", () => {
  assert.deepEqual(RIVER_ITEMS.map((i) => i.id), ["wolf", "sheep", "cabbage"]);
});

test("상태 공간은 안전한 상태를 한 번씩만 펼치고 모든 행동을 분류한다", () => {
  const graph = buildRiverStateSpace();
  assert.equal(new Set(graph.nodes.map((node) => node.key)).size, graph.nodes.length);
  assert.ok(graph.nodes.some((node) => node.key === riverStateKey(RIVER_GOAL)));
  assert.ok(graph.edges.some((edge) => edge.status === "new"));
  assert.ok(graph.edges.some((edge) => edge.status === "repeat"));
  assert.ok(graph.edges.some((edge) => edge.status === "unsafe"));
  for (const node of graph.nodes) {
    const availableCount = riverActionOptions(node.state).filter((option) => option.available).length;
    assert.equal(graph.edges.filter((edge) => edge.from === node.key).length, availableCount);
  }
});

// ── 2부: 8-퍼즐 BFS/DFS ────────────────────────────────────────────────────

test("puzzleKey ↔ parsePuzzleKey는 서로의 역함수다", () => {
  assert.equal(puzzleKey(PUZZLE_GOAL), "123456780");
  assert.deepEqual(parsePuzzleKey(puzzleKey(PUZZLE_START)), PUZZLE_START);
});

test("puzzleMoves는 빈칸 위치에 따라 위/아래/왼쪽/오른쪽 순서로 유효한 이동만 반환한다", () => {
  const cornerBlank = [1, 2, 3, 4, 5, 6, 7, 8, 0]; // 목표 상태, 빈칸이 우하단 모서리
  const moves = puzzleMoves(cornerBlank);
  assert.deepEqual(moves.map((m) => m.dir), ["up", "left"]);
});

test("초기 상태는 목표 상태와 다르고, 8-퍼즐 목표 판정 함수가 올바르게 동작한다", () => {
  assert.ok(!isPuzzleGoal(PUZZLE_START));
  assert.ok(isPuzzleGoal(PUZZLE_GOAL));
});

test("BFS 라운드는 깊이 2~4 수준의 작은 확장이며, 라운드마다 새 상태·중복 상태가 구분된다", () => {
  const result = runPuzzleBfsRounds();
  assert.ok(result.rounds.length >= 2 && result.rounds.length <= 4, "깊이 2~4 정도의 작은 확장이어야 함");
  assert.equal(result.reachedAtDepth, result.rounds.length, "목표는 마지막 라운드에서 발견되어야 함");
  assert.ok(result.path, "BFS가 목표에 도달하지 못함");
  assert.equal(result.path.at(-1), puzzleKey(PUZZLE_GOAL));
  assert.equal(result.path[0], puzzleKey(PUZZLE_START));

  // 첫 라운드는 아직 중복이 없고, 이후 라운드에서 이미 방문한 상태로 되돌아가는 중복이 실제로 나타나야
  // "중복 상태 제거가 눈에 보여야 한다"는 요구가 성립한다.
  assert.equal(result.rounds[0].dupStates.length, 0);
  const laterDupCount = result.rounds.slice(1).reduce((sum, r) => sum + r.dupStates.length, 0);
  assert.ok(laterDupCount > 0, "이후 라운드에 중복 상태가 실제로 나타나야 함");

  for (const round of result.rounds) {
    const overlap = round.newStates.filter((k) => round.dupStates.includes(k));
    assert.equal(overlap.length, 0, "같은 후보가 새 상태이자 중복일 수는 없음");
    assert.equal(round.newStates.length + round.dupStates.length, round.candidates.length);
  }
});

test("BFS 최소 이동 횟수는 3이다(활동에 쓰는 시작 상태 기준)", () => {
  const result = runPuzzleBfsRounds();
  assert.equal(result.path.length - 1, 3);
});

test("학생이 직접 조작하는 라운드 수는 PUZZLE_INTERACTIVE_ROUND_CAP과 일치하고, 그 이후 라운드에 목표가 있다", () => {
  const result = runPuzzleBfsRounds();
  assert.ok(PUZZLE_INTERACTIVE_ROUND_CAP < result.rounds.length, "마지막 라운드는 자동 공개 라운드여야 함");
  const finalRound = result.rounds.at(-1);
  assert.ok(finalRound.containsGoal);
});

test("DFS도 목표에 도달하지만, 같은 방향 우선순위를 쓰는 BFS보다 이동 횟수가 더 많다(최소 보장 없음)", () => {
  const bfs = runPuzzleBfsRounds();
  const dfs = runPuzzleDfs();
  assert.ok(dfs.path, "DFS가 목표에 도달하지 못함");
  const bfsMoves = bfs.path.length - 1;
  const dfsMoves = dfs.path.length - 1;
  assert.ok(dfsMoves > bfsMoves, `DFS 이동 횟수(${dfsMoves})가 BFS 이동 횟수(${bfsMoves})보다 많아야 "BFS만 최소를 보장" 비교가 성립함`);
});

test("summarizePuzzle은 BFS·DFS의 이동 횟수와 확인한 상태 수를 함께 요약한다", () => {
  const bfs = runPuzzleBfsRounds();
  const dfs = runPuzzleDfs();
  const summary = summarizePuzzle(bfs, dfs);
  assert.equal(summary.bfsMoves, 3);
  assert.ok(summary.dfsMoves > summary.bfsMoves);
  assert.ok(summary.bfsOpened > 0 && summary.dfsOpened > 0);
});

test("puzzlePathSteps는 시작 상태부터 순서대로 방향 라벨을 반환하고, 첫 단계는 방향이 없다", () => {
  const bfs = runPuzzleBfsRounds();
  const steps = puzzlePathSteps(bfs);
  assert.equal(steps.length, bfs.path.length);
  assert.equal(steps[0].dirLabel, null);
  for (const step of steps.slice(1)) {
    assert.ok(["위", "아래", "왼쪽", "오른쪽"].includes(step.dirLabel));
  }
});

test("같은 입력에 대해 BFS·DFS 결과는 항상 동일하다(결정론적)", () => {
  const a = runPuzzleBfsRounds();
  const b = runPuzzleBfsRounds();
  assert.deepEqual(a.path, b.path);
  const d1 = runPuzzleDfs();
  const d2 = runPuzzleDfs();
  assert.deepEqual(d1.path, d2.path);
});

// ── 3부: 선교사와 식인종 강 건너기(추가 활동) ────────────────────────────────

test("초기 상태는 모두 왼쪽, 목표 상태는 모두 오른쪽이다(선교사·식인종 각 3명)", () => {
  assert.deepEqual(MC_INITIAL, { mLeft: MC_GROUP_SIZE, cLeft: MC_GROUP_SIZE, boat: "L" });
  assert.deepEqual(MC_GOAL, { mLeft: 0, cLeft: 0, boat: "R" });
  assert.ok(isMcInitial(MC_INITIAL));
  assert.ok(isMcGoal(MC_GOAL));
  assert.ok(!isMcGoal(MC_INITIAL));
  assert.deepEqual(MC_ROLES.map((r) => r.id), ["m", "c"]);
});

test("어느 한쪽 둑에서든 식인종이 선교사보다 많으면 위험하고, 선교사가 0명이면 안전하다", () => {
  assert.ok(!isMcSafe({ mLeft: 1, cLeft: 2, boat: "L" }), "왼쪽에 선교사 1명·식인종 2명이면 위험해야 함");
  assert.ok(isMcSafe({ mLeft: 0, cLeft: 3, boat: "L" }), "선교사가 0명이면 식인종 수와 무관하게 안전해야 함");
  assert.ok(isMcSafe(MC_INITIAL));
  assert.ok(isMcSafe(MC_GOAL));
  const dangers = mcDanger({ mLeft: 1, cLeft: 3, boat: "R" });
  assert.equal(dangers.length, 1);
});

test("배 정원(2명) 안에서 만들 수 있는 모든 조합을 만들고, 정원을 넘거나 인원이 없는 쪽은 제외한다", () => {
  const options = mcCrossingOptions(MC_INITIAL);
  assert.ok(options.every((o) => o.m + o.c >= 1 && o.m + o.c <= MC_BOAT_CAPACITY));
  assert.ok(options.some((o) => o.m === 2 && o.c === 0));
  assert.ok(options.some((o) => o.m === 1 && o.c === 1));
  assert.ok(options.some((o) => o.m === 0 && o.c === 2));
  const emptyBankOptions = mcCrossingOptions({ mLeft: 3, cLeft: 3, boat: "R" });
  assert.equal(emptyBankOptions.length, 0, "배가 있는 쪽에 아무도 없으면 시도할 행동이 없어야 함");
});

test("applyMcCrossing은 배가 있던 쪽 인원을 반대쪽으로 옮기고 배를 뒤집는다", () => {
  const afterTwoMissionaries = applyMcCrossing(MC_INITIAL, { m: 2, c: 0 });
  assert.deepEqual(afterTwoMissionaries, { mLeft: 1, cLeft: 3, boat: "R" });
  const back = applyMcCrossing(afterTwoMissionaries, { m: 1, c: 0 });
  assert.deepEqual(back, { mLeft: 2, cLeft: 3, boat: "L" });
});

test("tryMcCrossing은 위험한 이동을 막지 않고 실제로 건너가게 한 뒤 게임 오버로 처리한다", () => {
  const session = createMcSession();
  const unsafe = tryMcCrossing(session, { m: 1, c: 0 });
  assert.equal(unsafe.ok, true, "위험한 조합도 시도 자체는 막지 않아야 함");
  assert.equal(unsafe.gameOver, true);
  assert.ok(unsafe.dangers.length > 0);
  assert.deepEqual(session.state, unsafe.state, "위험한 이동도 실제로 세션 상태를 바꿔야 함");
  assert.notDeepEqual(session.state, MC_INITIAL);
  assert.equal(session.gameOver, true);
  assert.equal(session.history.length, 1);
  assert.ok(session.history[0].dangers.length > 0);
});

test("tryMcCrossing은 안전한 이동은 방문 이력을 기록하고 게임 오버로 처리하지 않는다", () => {
  const session = createMcSession();
  const safe = tryMcCrossing(session, { m: 0, c: 2 });
  assert.equal(safe.ok, true);
  assert.equal(safe.gameOver, false);
  assert.equal(safe.wasVisited, false);
  assert.equal(session.history.length, 1);
  assert.equal(session.gameOver, false);

  const overCapacity = tryMcCrossing(session, { m: 2, c: 1 });
  assert.equal(overCapacity.ok, false);
  assert.equal(overCapacity.reason, "unavailable");
});

test("solveMcBfs는 안전한 상태만 지나며 고전적인 최적 해인 11번 이동으로 목표에 도달한다", () => {
  const solved = solveMcBfs();
  assert.equal(solved.reached, true);
  assert.equal(solved.moves, 11, "선교사와 식인종 문제의 고전적인 최적 해는 11번 이동");
  assert.equal(solved.path.length, 11);
  assert.ok(isMcGoal(solved.path.at(-1).state));
  for (const step of solved.path) assert.ok(isMcSafe(step.state), `경로의 모든 상태는 안전해야 함: ${mcStateKey(step.state)}`);
});

test("mcBank은 배 쪽과 반대쪽 인원을 정확히 계산한다", () => {
  const state = { mLeft: 2, cLeft: 1, boat: "L" };
  assert.deepEqual(mcBank(state, "L"), { m: 2, c: 1 });
  assert.deepEqual(mcBank(state, "R"), { m: 1, c: 2 });
});

test("추가 활동 화면·스크립트는 선교사·식인종 전용 요소를 갖추고 8-퍼즐 내용과 섞이지 않는다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("cannibals.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /id="cannibals-game"[^>]*hidden/);
  assert.match(html, /id="show-cannibals-button"/);
  assert.match(html, /id="cannibals-scene"/);
  assert.match(html, /id="cannibals-results"/);
  assert.match(html, /id="cannibals-gameover" class="gameover-banner" hidden/);
  assert.match(html, /id="cannibals-gameover-restart"/);
  assert.match(js, /createMcSession/);
  assert.match(js, /tryMcCrossing/);
  assert.match(js, /solveMcBfs/);
  assert.match(js, /function gameOver/);
  // 다음 활동 페이저에는 "8-퍼즐" 제목이 정상적으로 등장하므로 html은 코드 식별자만 검사한다.
  assert.doesNotMatch(js, /8-퍼즐|PUZZLE_|runPuzzle|puzzle-grid/);
  assert.doesNotMatch(html, /PUZZLE_|runPuzzle|puzzle-grid/);
});

test("위험한 이동은 막히지 않고 실제로 건너간 뒤 게임 오버 화면으로 이어진다(방지가 아니라 결과로 처리)", async () => {
  const js = await readFile(new URL("cannibals.js", lessonRoot), "utf8");
  assert.doesNotMatch(js, /reason === "unsafe"/, "더 이상 위험을 이유로 이동 자체를 거부하지 않아야 함");
  assert.match(js, /result\.gameOver/);
  assert.match(js, /el\.gameover\.hidden = false/);
});

// ── 화면 구조·접근성 ────────────────────────────────────────────────────

test("독립 lesson 페이지와 접근성 장치를 제공한다", async () => {
  const [html, labCss, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("../shared/lab-base.css", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /프로젝터 모드/);
  assert.match(html, /data-guard-scope="page" data-guard-group="ai-search" data-guard-lesson="search-bfs-delivery"/);
  assert.match(labCss, /prefers-reduced-motion/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

test("강 건너기 전용 제목과 활동 목록 링크를 제공한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<h1 id="page-title">문제 해결과 탐색<\/h1>/);
  assert.match(html, /<title>문제 해결과 탐색/);
  assert.match(html, /href="\.\.\/\.\.\/units\/ai-search\/"/);
});

test("활동 안내는 현재 상태와 목표 상태만 보여주고 현재 상태를 이동마다 갱신한다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.doesNotMatch(html, /이번 활동에서 찾을 세 가지/);
  assert.doesNotMatch(html, /class="mission-flow"/);
  assert.match(html, /class="state-goal-strip"/);
  assert.match(html, /<dt>현재 상태<\/dt>/);
  assert.match(html, /<dt>목표 상태<\/dt>/);
  assert.match(html, /농부, 늑대, 양, 양배추 모두 강을 건너지 않은 상태/);
  assert.match(html, /농부, 늑대, 양, 양배추 모두 강을 건넌 상태/);
  assert.match(js, /function describeCrossingState/);
  assert.match(js, /el\.currentState\.textContent/);
  assert.match(html, /각 순간의 모습을 <strong>상태<\/strong>/);
});

test("강 건너기는 별도 이동 버튼 없이 캐릭터를 태우고 배 자체를 눌러 이동한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(html, /id="river-scene"/);
  assert.doesNotMatch(html, /id="river-move"/);
  assert.match(html, /id="river-history"/);
  assert.match(js, /data-passenger/);
  assert.match(js, /id="boat-control"/);
  assert.match(js, /배에 탑승/);
  assert.match(js, /농부 혼자/);
  assert.match(js, /function gameOver/);
  assert.match(js, /이미 보았던 상태입니다/);
});

test("강 건너기 페이지의 화면·스크립트·핵심 로직에는 8-퍼즐 코드가 섞이지 않는다", async () => {
  const [html, js, core] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("game-core.js", lessonRoot), "utf8"),
  ]);
  // 스크립트·로직에는 8-퍼즐 관련 텍스트·식별자가 전혀 없어야 하지만, 페이지 하단의
  // "다음 단계" 페이저에는 같은 활동 폴더의 8-퍼즐 이론 실습이 정상적으로 등장하므로 html은 코드 식별자만 검사한다.
  for (const source of [js, core]) {
    assert.doesNotMatch(source, /8-퍼즐|PUZZLE_|runPuzzle|puzzle-grid/);
  }
  assert.doesNotMatch(html, /PUZZLE_|runPuzzle|puzzle-grid/);
  assert.match(html, /href="eight-puzzle-theory\.html"/, "결과 화면에 같은 활동의 8-퍼즐 이론 실습 페이저가 있어야 함");
});

test("해결 전에는 정답 경로를 숨기고 해결 후 상태와 행동의 경로를 공개한다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<div id="river-results" class="summary" hidden>/);
  assert.match(html, /상태와 행동으로 다시 보기/);
  assert.match(html, /id="river-solution-body"/);
  assert.match(html, /<th scope="col">현재 상태<\/th><th scope="col">행동<\/th><th scope="col">다음 상태<\/th>/);
  assert.match(js, /el\.solutionBody\.innerHTML/);
  assert.doesNotMatch(html, /id="river-space-list"/);
});

test("별도 해답 페이지는 전체 상태 공간 트리와 접근 가능한 전이 표를 제공한다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("solution-tree.html", lessonRoot), "utf8"),
    readFile(new URL("solution-tree.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /id="state-space-tree" class="graph-zoom-viewport"/);
  assert.match(html, /class="graph-zoom-controls" data-zoom-for="state-space-tree"/);
  assert.match(html, /id="transition-body"/);
  assert.match(html, /최소비용은 7입니다/);
  assert.match(html, /data-guard-lesson="search-bfs-delivery"/);
  assert.match(js, /buildRiverStateSpace/);
  assert.match(js, /createElementNS/);
  assert.match(js, /enableGraphZoom/);
  assert.match(js, /tree-edge-\$\{child\.status\}/);
  assert.match(js, /tree-leaf-unsafe/);
  assert.match(js, /tree-leaf-repeat/);
  assert.match(js, /edge\.attempted/);
  assert.match(js, /안전하지 않음/);
  const activityHtml = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(activityHtml, /href="solution-tree\.html"/);
});

test("해답 페이지 범례는 선 스타일뿐 아니라 트리 상자와 같은 배경·테두리 색을 쓰고, 다음 활동 페이저를 제공한다", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("solution-tree.html", lessonRoot), "utf8"),
    readFile(new URL("solution-tree.css", lessonRoot), "utf8"),
  ]);
  assert.match(html, /class="lesson-pager"/);
  assert.match(html, /8-퍼즐로 보는 맹목적 탐색/);
  assert.match(html, /class="table-scroll-hint"/);
  assert.match(css, /\.legend i\.new \{[^}]*background:#f4f7ff/);
  assert.match(css, /\.legend i\.repeat \{[^}]*background:#f4f5f7/);
  assert.match(css, /\.legend i\.unsafe \{[^}]*background:#fff5f5/);
});

test("완료 화면은 학생 비용과 최소비용을 비교하고 다시 도전하기 버튼에 전용 스타일을 적용한다", async () => {
  const [html, js, css] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(html, /id="river-cost-result"/);
  assert.match(html, /id="river-restart" class="text-action"/);
  assert.match(js, /studentCost === minimumCost/);
  assert.match(js, /<strong>최소비용<\/strong>/);
  assert.match(js, /더 적은 비용으로 해결하는 방법이 있을 것 같습니다/);
  assert.match(css, /\.primary-action/);
  assert.match(css, /\.river-cost-result\.is-minimum/);
});
