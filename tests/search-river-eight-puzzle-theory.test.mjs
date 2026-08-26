import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../lessons/search-bfs-delivery/", import.meta.url);

test("8-퍼즐 이론 실습은 강 건너기 활동 폴더에 속한다", async () => {
  const [river, theory] = await Promise.all([readFile(new URL("index.html", root), "utf8"), readFile(new URL("eight-puzzle-theory.html", root), "utf8")]);
  assert.match(river, /href="eight-puzzle-theory\.html"/);
  assert.match(theory, /data-guard-lesson="search-bfs-delivery"/);
  assert.match(theory, /문제 해결과 탐색 · 이론/);
});

test("교과서 예시로 상태·행동·탐색 트리의 깊이를 설명한다", async () => {
  const [html, js] = await Promise.all([readFile(new URL("eight-puzzle-theory.html", root), "utf8"), readFile(new URL("eight-puzzle-theory.js", root), "utf8")]);
  assert.match(html, /초기 상태와 목표 상태/);
  assert.match(html, /가능한 행동/);
  assert.match(html, /탐색 트리의 깊이 1/);
  assert.doesNotMatch(html, /첫 번째 층/);
  assert.match(js, /const START = \[2, 8, 3, 1, 0, 4, 7, 6, 5\]/);
  assert.match(js, /puzzleMoves\(START\)/);
});

test("트리 구성 단계는 깊이 0·1·2 행을 각각 깊이 표시와 함께 보여주고, 완성 시 다음 깊이로 이어지는 미리보기를 드러낸다", async () => {
  const [html, js] = await Promise.all([readFile(new URL("eight-puzzle-theory.html", root), "utf8"), readFile(new URL("eight-puzzle-theory.js", root), "utf8")]);
  assert.match(html, /트리의 깊이 0/);
  assert.match(html, /트리의 깊이 1/);
  assert.match(html, /id="tree-depth-preview"[^>]*hidden/);
  assert.match(html, /트리의 깊이 2/);
  assert.match(js, /document\.getElementById\("tree-depth-preview"\)\.hidden = false/);
});

test("학생이 다음 상태 4개를 직접 만들고 카드를 눌러 탐색 트리를 구성한다", async () => {
  const [html, js] = await Promise.all([readFile(new URL("eight-puzzle-theory.html", root), "utf8"), readFile(new URL("eight-puzzle-theory.js", root), "utf8")]);
  assert.match(html, /id="maker-board"/);
  assert.match(html, /서로 다른 상태 4개/);
  assert.match(html, /id="tree-candidates"/);
  assert.match(html, /id="tree-children"/);
  assert.match(js, /function makeState\(tileIndex\)/);
  assert.match(js, /if \(made\.size === MOVES\.length\) showTreeBuilder\(\)/);
  assert.match(js, /function connectState\(candidate, move\)/);
  assert.match(js, /if \(connected\.size === MOVES\.length\)/);
});
