import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runPuzzleBfsRounds, PUZZLE_GOAL, puzzleKey } from "../lessons/search-eight-puzzle/game-core.js";

const lessonRoot = new URL("../lessons/search-eight-puzzle/", import.meta.url);

test("BFS 탐색 중 실제로 목표 상태가 후보로 나타난다(강조 기능이 죽은 코드가 아님을 확인)", () => {
  const goalKey = puzzleKey(PUZZLE_GOAL);
  const bfs = runPuzzleBfsRounds();
  const roundWithGoal = bfs.rounds.find((round) => round.candidates.includes(goalKey));
  assert.ok(roundWithGoal, "고정된 초기·목표 상태 조합에서 목표 상태가 BFS 후보로 등장해야 합니다");
});

test("목표 상태 강조를 위한 GOAL_KEY 상수와 markGoalCard 헬퍼가 있고, 더 이상 별도 배지를 만들지 않는다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /const GOAL_KEY = puzzleKey\(PUZZLE_GOAL\);/);
  assert.match(js, /function markGoalCard\(card, key\) \{/);
  assert.match(js, /card\.classList\.add\("is-goal"\)/);
  assert.doesNotMatch(js, /goal-badge/);
});

test("초기 상태 카드와 BFS로 새로 펼쳐지는 카드 모두 목표 상태 강조 대상이다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /grid\(PUZZLE_START, "small", \{ emphasizeGoal: true \}\)/);
  assert.match(js, /markGoalCard\(card, card\.dataset\.key\);/);
  assert.match(js, /grid\(move\.state, "small", \{ emphasizeGoal: true \}\)/);
  assert.match(js, /markGoalCard\(child, key\);/);
});

test("공개 전에는 시각적 배지 없이 aria-label로만 목표 상태를 스크린 리더에 알린다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /aria-label", isGoal \? `\$\{describe\(state\)\}, 목표 상태` : describe\(state\)\)/);
});

test("목표 상태가 새 상태로 공개되면 state-chip 문구가 '새 상태' 대신 '목표 상태'로 대체된다(배지 추가 없음)", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /chip\.textContent = isNew \? \(key === GOAL_KEY \? "목표 상태" : "새 상태"\) : "중복 상태 · 제외";/);
  // revealRound 안에서 chip을 만드는 곳은 한 곳뿐이어야 한다(목표용 chip을 별도로 더 만들지 않음).
  const chipCreationCount = (js.match(/chip\.className = "state-chip";/g) || []).length;
  assert.equal(chipCreationCount, 1);
});

test("중복으로 제외되는 상태는 목표 상태여도 '중복 상태 · 제외' 문구를 그대로 유지한다(오해 방지)", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  // isNew가 거짓이면 목표 여부와 무관하게 항상 같은 "중복 상태 · 제외" 분기로 떨어져야 한다.
  assert.match(js, /: "중복 상태 · 제외";/);
  assert.doesNotMatch(js, /isNew \? "목표 상태"/);
});

test("결과(02-3) 경로 카드의 grid 호출은 건드리지 않아 강조 범위가 BFS 층별 탐색 카드로 한정된다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /grid\(parsePuzzleKey\(step\.key\), "small"\)\);/);
  assert.doesNotMatch(js, /grid\(parsePuzzleKey\(step\.key\), "small", \{ emphasizeGoal: true \}\)/);
});

test("새 상태·중복 상태 구분 로직과 카드 누적 로직은 그대로 보존된다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /card\.dataset\.kind = isNew \? "new" : "duplicate";/);
  assert.doesNotMatch(js, /el\.levels\.innerHTML\s*=\s*""/);
  assert.doesNotMatch(js, /el\.trace\.hidden\s*=\s*true/);
});

test("목표 카드는 border-color만 덮어써서 테두리 두께·박스 크기가 일반 카드와 동일하게 유지된다", async () => {
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  const goalRuleMatch = css.match(/\.puzzle-candidate\.is-goal \{([^}]*)\}/);
  assert.ok(goalRuleMatch, ".puzzle-candidate.is-goal 규칙을 찾지 못했습니다");
  const goalRuleBody = goalRuleMatch[1];
  assert.match(goalRuleBody, /border-color:#c9880c/);
  // border-width/style을 새로 지정하는 shorthand("border:")나 width/style 단독 지정이 없어야
  // 원래 카드(1px 또는 2px)의 두께가 그대로 유지된다.
  assert.doesNotMatch(goalRuleBody, /\bborder:/);
  assert.doesNotMatch(goalRuleBody, /border-width/);
  assert.doesNotMatch(goalRuleBody, /border-style/);
  assert.doesNotMatch(goalRuleBody, /width:/);
  assert.doesNotMatch(goalRuleBody, /height:/);
  assert.doesNotMatch(css, /\.goal-badge/);
});

test("목표 강조 스타일은 새 상태/중복 상태 색상 규칙보다 뒤에 선언되어 색상이 우선 적용된다", async () => {
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  const newRuleIndex = css.indexOf('[data-kind="new"]');
  const duplicateRuleIndex = css.indexOf('[data-kind="duplicate"]');
  const goalRuleIndex = css.indexOf(".puzzle-candidate.is-goal");
  assert.ok(newRuleIndex > -1 && duplicateRuleIndex > -1 && goalRuleIndex > -1);
  assert.ok(goalRuleIndex > newRuleIndex);
  assert.ok(goalRuleIndex > duplicateRuleIndex);
});

test("숫자판(그리드) 색상 강조는 유지된다", async () => {
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  assert.match(css, /\.puzzle-grid--goal \{[^}]*background:#e0a315/);
  assert.match(css, /\.puzzle-grid--goal \.puzzle-tile \{[^}]*background:#fff8e6/);
});
