import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GOAL_STATE, NEW_GOAL_STATE, TEXTBOOK_START, NEW_START, getNeighbors, misplacedTiles, solveAstar, checkChoice } from "../lessons/search-astar-delivery/game-core.js";

const lessonRoot = new URL("../lessons/search-astar-delivery/", import.meta.url);

test("교과서 예시의 초기·목표 상태와 휴리스틱을 그대로 사용한다", () => {
  assert.deepEqual(TEXTBOOK_START, [2,8,3,1,6,4,7,0,5]);
  assert.deepEqual(GOAL_STATE, [1,2,3,8,0,4,7,6,5]);
  assert.equal(misplacedTiles(TEXTBOOK_START), 4);
  assert.equal(misplacedTiles(GOAL_STATE), 0);
});

test("빈칸의 다음 상태는 위·아래·왼쪽·오른쪽 순서로 만든다", () => {
  assert.deepEqual(getNeighbors(TEXTBOOK_START).map((item) => item.move), ["위","왼쪽","오른쪽"]);
});

test("교과서 예시는 A*로 5회 만에 목표에 도달한다", () => {
  const result = solveAstar(TEXTBOOK_START);
  assert.equal(result.found, true);
  assert.equal(result.cost, 5);
  assert.deepEqual(result.path.slice(1).map((node) => node.move), ["위","위","왼쪽","아래","오른쪽"]);
});

test("새 연습 문제는 네 번 선택해 목표에 도달한다", () => {
  const result = solveAstar(NEW_START, NEW_GOAL_STATE);
  assert.deepEqual(NEW_GOAL_STATE, [1,2,3,4,5,6,7,8,0]);
  assert.equal(result.found, true);
  assert.equal(result.cost, 4);
  assert.equal(result.steps.length - 1, 4);
});

test("모든 단계에서 선택된 후보의 f는 최소이며 f=g+h이다", () => {
  for (const result of [solveAstar(TEXTBOOK_START), solveAstar(NEW_START, NEW_GOAL_STATE)]) {
    for (const step of result.steps) {
      assert.equal(step.chosen.f, step.chosen.g + step.chosen.h);
      assert.equal(step.chosen.f, Math.min(...step.candidates.map((candidate) => candidate.f)));
      assert.equal(checkChoice(step, step.chosenKey).correct, true);
    }
  }
});

test("두 활동·접근성·활동지 03 연결을 제공한다", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /활동 1 · 교과서 예시 따라가기/);
  assert.match(html, /모든 후보의 값을 정확히 입력하면/);
  assert.match(html, /활동 2 · 새로운 문제에 적용하기/);
  assert.match(html, /새 후보마다 g\(n\)만 제공합니다/);
  assert.match(html, /f\(n\) = g\(n\) \+ h\(n\)/);
  assert.match(html, /이미 사용한 비용/);
  assert.match(html, /이 8-퍼즐에서 사용하는 어림값/);
  assert.match(html, /id="warmup-h"/);
  assert.match(html, /id="warmup-f"/);
  assert.match(html, /id="warmup-g"[^>]*value="0"[^>]*readonly/);
  assert.doesNotMatch(html, /data-warmup-answer/);
  assert.match(html, /data-guard-group="ai-search" data-guard-lesson="search-astar-delivery"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(css, /prefers-reduced-motion/);
});
