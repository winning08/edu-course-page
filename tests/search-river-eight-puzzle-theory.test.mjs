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
  assert.match(js, /const START = \[1, 2, 3, 4, 0, 6, 7, 5, 8\]/);
  assert.match(js, /const GOAL = \[1, 2, 3, 4, 5, 6, 7, 8, 0\]/);
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

test("8-퍼즐 이론 다음에 단일 경로를 따라가는 부분 탐색 트리와 88개 목표 상태 확장이 있다", async () => {
  const [html, js] = await Promise.all([readFile(new URL("eight-puzzle-theory.html", root), "utf8"), readFile(new URL("eight-puzzle-theory.js", root), "utf8")]);
  assert.ok(html.indexOf('id="advanced-count-title"') > html.indexOf('id="tree-section"'));
  assert.match(html, /<span>3<\/span><strong>심화 문제\(숫자 퀴즈\)<\/strong>/);
  assert.match(html, /id="advanced-count-activity"[^>]*hidden/);
  assert.match(js, /document\.getElementById\("advanced-count-activity"\)\.hidden = false/);
  assert.match(html, /백의 자리가 7/);
  assert.match(html, /십의 자리가 7/);
  assert.match(html, /일의 자리가 7/);
  assert.match(html, /id="partial-tree-lab"/);
  assert.match(html, /id="step-branch-select"/);
  assert.match(html, /id="step-slot1-select"/);
  assert.match(html, /id="step-slot2-select"/);
  assert.match(html, /id="slot1-digit-grid"/);
  assert.match(html, /id="slot2-digit-grid"/);
  assert.match(html, /id="partial-tree-viewer"/);
  assert.match(js, /function selectBranch\(branch, button\)/);
  assert.match(js, /function handleSlot1DigitClick\(digit\)/);
  assert.match(js, /function handleSlot2DigitClick\(digit\)/);
  assert.match(html, /id="count-answer" type="number"/);
  assert.doesNotMatch(html, /id="judge-card"/);
  assert.doesNotMatch(html, /id="live-tree-visualizer"/);
});

test("부분 탐색 트리는 단일 경로와 직하위 분기만 표시하며 오개념 방지 문구를 갖춘다", async () => {
  const [html, js, css] = await Promise.all([
    readFile(new URL("eight-puzzle-theory.html", root), "utf8"),
    readFile(new URL("eight-puzzle-theory.js", root), "utf8"),
    readFile(new URL("eight-puzzle-theory.css", root), "utf8"),
  ]);
  assert.match(html, /id="partial-tree-viewer"/);
  assert.match(html, /id="partial-tree-graph"/);
  assert.match(html, /부분 탐색 트리 · 현재 선택한 경로만 표시/);
  assert.match(html, /전체 탐색 트리가 아닙니다/);
  assert.match(js, /function renderPartialTree\(\)/);
  assert.match(js, /조건 \(가\) 위반/);
  assert.match(js, /조건 \(나\) 위반/);
  assert.match(js, /세 자리 자연수 위반/);
  assert.match(css, /\.tree-node\.is-valid/);
  assert.match(css, /\.tree-node\.is-goal/);
  assert.match(css, /\.tree-node\.is-active-path/);
  assert.match(css, /\.digit-btn\.is-neutral/);
  assert.match(css, /\.digit-btn\.is-valid\.is-selected/);
  assert.match(css, /\.digit-btn\.is-excluded/);
  assert.match(css, /\.goal-fan-row/);
  const numberTreeJs = js.slice(js.indexOf("const DIGITS = "));
  assert.doesNotMatch(numberTreeJs, /\.focus\(\)/);
});

test("숫자 개수 퀴즈 정답을 맞힌 뒤에만 상태 선택 활동이 열린다", async () => {
  const [html, js] = await Promise.all([readFile(new URL("eight-puzzle-theory.html", root), "utf8"), readFile(new URL("eight-puzzle-theory.js", root), "utf8")]);
  assert.match(html, /id="count-answer-quiz"/);
  assert.match(html, /id="number-tree-lab" class="number-tree-lab" hidden/);
  assert.match(js, /answer !== 88/);
  assert.match(js, /numberTreeLab\.hidden = false/);
});

test("부분 트리 완성 후 다른 경로도 동일하게 탐색함을 설명하고 88개 경우의 수를 별도로 제시한다", async () => {
  const [html, js] = await Promise.all([readFile(new URL("eight-puzzle-theory.html", root), "utf8"), readFile(new URL("eight-puzzle-theory.js", root), "utf8")]);
  assert.match(html, /id="count-solution"/);
  assert.match(html, /id="solution-path-summary"/);
  assert.match(js, /numberBranches/);
  assert.match(html, /36 \+ 16 \+ 36 = 88/);
});

test("모바일 레이아웃은 가로 스크롤 없이 트리 가지와 후보 숫자들을 배치한다", async () => {
  const css = await readFile(new URL("eight-puzzle-theory.css", root), "utf8");
  const mobile = css.slice(css.indexOf("@media(max-width:700px)", css.indexOf(".number-tree-lab")));
  assert.doesNotMatch(mobile, /overflow-x:auto/);
  assert.match(mobile, /\.branch-cards-grid\{grid-template-columns:1fr;gap:\.7rem\}/);
  assert.match(mobile, /\.digit-grid\{grid-template-columns:repeat\(5,1fr\)/);
});
