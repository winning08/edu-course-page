import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PUZZLE_START, PUZZLE_GOAL, manhattanDistance, puzzleMoves, puzzleKey,
  runPuzzlePriorityTrace, runPuzzleBfsCount, checkStepAnswer, buildComparison,
} from "../lessons/search-greedy-eight-puzzle/game-core.js";

const lessonRoot = new URL("../lessons/search-greedy-eight-puzzle/", import.meta.url);

test("이 활동의 초기 상태·목표 상태는 활동 02와 다른 새 문제다", () => {
  assert.notEqual(puzzleKey(PUZZLE_START), "123456780");
  assert.notEqual(puzzleKey(PUZZLE_GOAL), "123456780");
  assert.deepEqual([...PUZZLE_START].sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...PUZZLE_GOAL].sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});

test("맨해튼 거리 휴리스틱은 목표 상태에서 0이고, 목표에서 한 칸 움직이면 1이 된다", () => {
  assert.equal(manhattanDistance(PUZZLE_GOAL), 0);
  const oneMoveAway = puzzleMoves(PUZZLE_GOAL)[0].state;
  assert.equal(manhattanDistance(oneMoveAway), 1);
});

test("최상 우선 탐색(greedy)은 h(n)만 보고 다음 상태를 고르며, g(n)이 커도 h(n)이 작으면 먼저 연다", () => {
  const result = runPuzzlePriorityTrace("greedy");
  assert.ok(result.path, "목표에 도달하지 못함");
  for (let i = 1; i < result.steps.length; i += 1) {
    const step = result.steps[i];
    const bestCandidateH = Math.min(...step.candidates.map((c) => c.h));
    assert.equal(step.h, bestCandidateH, `단계 ${i}에서 h가 최소인 후보를 고르지 않음`);
  }
});

test("checkStepAnswer는 실제로 확장된 상태를 골랐을 때만 correct다", () => {
  const result = runPuzzlePriorityTrace("greedy");
  const step = result.steps.find((s) => s.candidates.length > 1);
  assert.ok(step, "후보가 2개 이상인 단계를 찾을 수 없음");
  assert.equal(checkStepAnswer(step, step.expandedKey).correct, true);
  const wrong = step.candidates.find((c) => c.key !== step.expandedKey);
  assert.equal(checkStepAnswer(step, wrong.key).correct, false);
});

test("이 퍼즐에서 최상 우선 탐색은 너비 우선 탐색보다 훨씬 적은 상태를 연다", () => {
  const bfs = runPuzzleBfsCount();
  const greedy = runPuzzlePriorityTrace("greedy");
  assert.ok(greedy.opened < bfs.opened, "최상 우선 탐색이 BFS보다 적게 열어야 함");
  assert.ok(greedy.opened <= 15, "학생이 화면에서 직접 한 단계씩 풀 수 있을 만큼 적어야 함");
});

test("buildComparison은 BFS와 최상 우선 탐색의 열어본 상태 수·이동 횟수를 함께 돌려준다", () => {
  const comparison = buildComparison();
  assert.ok(comparison.bfs.opened > comparison.greedy.opened);
  assert.equal(typeof comparison.greedy.pathLength, "number");
  assert.equal(typeof comparison.bfs.pathLength, "number");
});

test("독립 lesson 페이지와 접근성 장치를 제공한다", async () => {
  const [html, labCss, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("../shared/lab-base.css", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /프로젝터 모드/);
  assert.match(html, /data-guard-scope="page" data-guard-group="ai-search" data-guard-lesson="search-greedy-eight-puzzle"/);
  assert.match(labCss, /prefers-reduced-motion/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

test("h(n)만 보고 g(n)은 보지 않는다는 설명과 완전성·최적성·효율 비교표가 화면에 있다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /g\(n\)은 아예 보지 않습니다/);
  assert.match(html, /완전성/);
  assert.match(html, /최적성/);
  assert.match(html, /효율/);
  assert.match(html, /id="bfs-opened-cell"/);
  assert.match(html, /id="greedy-opened-cell"/);
});

test("결과 화면은 units/ai-search와 루트 홈으로 각각 돌아가는 링크를 함께 제공한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /href="\.\.\/\.\.\/units\/ai-search\/"/);
  assert.match(html, /href="\.\.\/\.\.\/">전체 활동지 홈으로/);
});
