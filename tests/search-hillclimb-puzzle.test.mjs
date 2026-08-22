import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PUZZLE_START, PUZZLE_GOAL, matchingTileScore, puzzleMoves, puzzleKey, hillClimbStep, runHillClimb,
} from "../lessons/search-hillclimb-puzzle/game-core.js";

const lessonRoot = new URL("../lessons/search-hillclimb-puzzle/", import.meta.url);

test("이 활동은 양지고 수행평가 '인공지능 탐색 문제 해결'과 같은 초기·목표 상태를 쓴다", () => {
  assert.equal(puzzleKey(PUZZLE_START), "283164705");
  assert.equal(puzzleKey(PUZZLE_GOAL), "123804765");
});

test("평가 함수값은 목표와 같은 위치의 숫자 타일 개수이고, 빈칸은 세지 않는다", () => {
  assert.equal(matchingTileScore(PUZZLE_GOAL), 8);
  assert.equal(matchingTileScore(PUZZLE_START), 4);
});

test("방향 우선순위는 위 → 왼쪽 → 오른쪽 → 아래 순이다", () => {
  const moves = puzzleMoves(PUZZLE_START);
  assert.deepEqual(moves.map((m) => m.dirLabel), ["위", "왼쪽", "오른쪽"]);
});

test("직전 상태로 되돌아가는 이동은 다음 상태 후보에서 제외된다", () => {
  const { candidates } = hillClimbStep(PUZZLE_START, null);
  const afterUp = candidates.find((c) => c.dirLabel === "위").state;
  const stepBack = hillClimbStep(afterUp, puzzleKey(PUZZLE_START));
  assert.ok(!stepBack.candidates.some((c) => c.key === puzzleKey(PUZZLE_START)), "직전 상태가 후보에 남아있으면 안 됨");
});

test("수행평가지와 동일한 5단계 정답 트레이스를 만든다(위,위,왼쪽,아래,오른쪽 순으로 함수값 5,5,6,7,8)", () => {
  const { steps, reached, finalState } = runHillClimb();
  assert.equal(reached, true);
  assert.deepEqual(finalState, [...PUZZLE_GOAL]);
  assert.equal(steps.length, 5);
  assert.deepEqual(steps.map((s) => s.bestDirLabel), ["위", "위", "왼쪽", "아래", "오른쪽"]);
  assert.deepEqual(steps.map((s) => s.bestScore), [5, 5, 6, 7, 8]);
});

test("평가 함수값이 같으면 방향 우선순위(위>왼쪽>오른쪽>아래)로 다음 상태를 고른다(2단계)", () => {
  const { steps } = runHillClimb();
  const step2 = steps[1];
  const tiedScores = step2.candidates.filter((c) => c.score === step2.bestScore);
  assert.ok(tiedScores.length >= 2, "2단계에는 동점 후보가 있어야 함");
  assert.equal(step2.bestDirLabel, "위");
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
  assert.match(html, /data-guard-scope="page" data-guard-group="ai-search" data-guard-lesson="search-hillclimb-puzzle"/);
  assert.match(labCss, /prefers-reduced-motion/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

test("평가 함수 규칙(같은 위치·빈칸 제외·직전 상태 제외·방향 우선순위)이 화면에 그대로 설명되어 있다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /같은 위치/);
  assert.match(html, /빈칸은 계산하지 않습니다/);
  assert.match(html, /직전 상태로 되돌아가는 이동은 다음 상태 후보에서 제외/);
  assert.match(html, /위 → 왼쪽 → 오른쪽 → 아래/);
});

test("결과 화면은 units/ai-search와 루트 홈으로 각각 돌아가는 링크를 함께 제공한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /href="\.\.\/\.\.\/units\/ai-search\/"/);
  assert.match(html, /href="\.\.\/\.\.\/">전체 활동지 홈으로/);
});
