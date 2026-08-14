import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readFile as readFileSync } from "node:fs/promises";
import { PUZZLE_DEFINITIONS, loadPuzzles } from "../lessons/arc-puzzle-challenge/puzzles.js";
import {
  requiredPuzzles, bonusPuzzles, summarizeRequiredResults, usedColors,
} from "../lessons/arc-puzzle-challenge/game-core.js";

const lessonRoot = new URL("../lessons/arc-puzzle-challenge/", import.meta.url);
const unitRoot = new URL("../units/ai-evaluation/", import.meta.url);
const compareRoot = new URL("../lessons/turing-vs-arc-compare/", import.meta.url);

async function fileFetch(url) {
  try {
    const text = await readFileSync(url, "utf8");
    return { ok: true, json: async () => JSON.parse(text) };
  } catch {
    return { ok: false, json: async () => null };
  }
}

const PUZZLES = await loadPuzzles(fileFetch);

const FORBIDDEN_PPT_STRINGS = [
  "88%", "65~68", "65-68", "Resasong",
];

test("필수 문제는 정확히 4개, 선택 도전 문제는 정확히 1개이며 수업 순서대로 구성된다", () => {
  const required = requiredPuzzles(PUZZLES);
  const bonus = bonusPuzzles(PUZZLES);
  assert.equal(required.length, 4);
  assert.equal(bonus.length, 1);
  assert.deepEqual(required.map((p) => p.difficulty), ["쉬움", "보통", "어려움 1", "어려움 2"]);
  assert.equal(bonus[0].difficulty, "Expert");
});

test("모든 문제는 확인된 ARC-AGI-1 공식 ID와 tier를 가진다", () => {
  assert.deepEqual(PUZZLE_DEFINITIONS.map((p) => p.sourceId), ["19bb5feb", "5289ad53", "e5c44e8f", "604001fa", "1acc24af"]);
  for (const puzzle of PUZZLES) {
    assert.ok(typeof puzzle.sourceId === "string" && puzzle.sourceId.length > 0, `${puzzle.id}에 sourceId가 없음`);
    assert.ok(["required", "bonus"].includes(puzzle.tier), `${puzzle.id}의 tier가 유효하지 않음`);
    assert.ok(puzzle.train.length >= 3, `${puzzle.id}의 공식 학습 예시가 누락됨`);
  }
});

test("puzzles.js는 ARC-AGI-1 공개 평가 세트와 Apache License 2.0 출처를 명시한다", async () => {
  const source = await readFile(new URL("puzzles.js", lessonRoot), "utf8");
  assert.match(source, /ARC-AGI-1/);
  assert.match(source, /evaluation/);
  assert.match(source, /Apache License 2\.0/);
  assert.match(source, /수업용 제목·순서·힌트/);
});

test("summarizeRequiredResults는 필수 문제 결과만 집계한다", () => {
  assert.deepEqual(summarizeRequiredResults(["solved-first", "solved-retry", "skipped"], 3), {
    solvedFirst: 1, solvedRetry: 1, skipped: 1, total: 3, solved: 2,
  });
  assert.deepEqual(summarizeRequiredResults(undefined, 3), { solvedFirst: 0, solvedRetry: 0, skipped: 0, total: 3, solved: 0 });
});

test("usedColors는 각 문제에서 실제로 쓰인 색만 정렬해 반환한다", () => {
  for (const puzzle of PUZZLES) {
    const colors = usedColors(puzzle);
    assert.equal(colors.length, new Set(colors).size);
    assert.deepEqual(colors, [...colors].sort((a, b) => a - b));
  }
});

test("lesson 페이지는 ARC 정의(Abstraction and Reasoning Corpus)와 쉬운 설명, 수업용 난이도 안내, 선택 도전(bonus) 흐름을 담는다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /Abstraction and Reasoning Corpus/);
  assert.match(html, /추상화/);
  assert.match(html, /추론/);
  assert.match(html, /난이도 이름은 공식 등급이 아니라 수업 진행을 위해 붙인 이름/);
  assert.match(html, /id="puzzle-progress-label"/);
  assert.match(html, /id="bonus-prompt"/);
  assert.match(html, /id="bonus-button"/);
  assert.match(html, /id="bonus-outcome"/);
  assert.match(js, /REQUIRED_PUZZLES/);
  assert.match(js, /BONUS_PUZZLE/);
  assert.match(js, /수업용 난이도/);
});

test("결과 화면은 더 도전하기 버튼을 눌러야만 선택 도전 문제로 들어가며, 필수 20분 흐름을 막지 않는다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const resultsSection = html.slice(html.indexOf('id="results-view"'));
  assert.match(resultsSection, /더 도전하기/);
  assert.match(resultsSection, /풀지 않아도 오늘 활동은 완료된 것으로 인정됩니다/);
});

test("접근성 장치(포커스 표시·감소된 모션·색맹 대응 스와치 라벨)가 보존되어 있다", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="group" aria-label="색깔 고르기"/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
});

test("넓은 학습 격자는 전체 열 수에 맞춰 한 줄로 축소하고 작은 화면에서만 세로로 전환한다", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(js, /--pair-total-cols/);
  assert.match(css, /var\(--pair-total-cols\)/);
  assert.match(css, /\.train-pair-grids \{ flex-wrap: wrap;/);
});

test("시험의 문제 입력과 출력도 전체 열 수에 맞춰 한 줄로 표시한다", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.match(js, /--test-total-cols/);
  assert.match(css, /var\(--test-total-cols\)/);
  assert.match(css, /\.test-area \{ display: flex; flex-wrap: nowrap;/);
});

test("progress 저장은 v3 스키마를 쓰고, 힌트·건너뛰기·다시 채점 관련 함수가 남아있다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /arc-puzzle-challenge:v3/);
  assert.match(js, /handleHint/);
  assert.match(js, /handleSkip/);
  assert.match(js, /handleClear/);
  assert.match(js, /handleCheck/);
});

test("units/ai-evaluation 허브 페이지는 1분 이내 워밍업 질문을 포함하고 3개 활동 구조를 유지한다", async () => {
  const html = await readFile(new URL("index.html", unitRoot), "utf8");
  assert.match(html, /일상생활에서 우리는 지능을 언제 사용할까/);
  assert.match(html, /class="warmup-box"/);
  assert.match(html, /3개 활동/);
  assert.match(html, /ARC 그림 퍼즐 4개\(\+선택 도전 1개\)/);
});

test("turing-vs-arc-compare는 필수 4문제 기준으로 요약하고 선택 도전 결과를 별도로 표시한다", async () => {
  const js = await readFile(new URL("game.js", compareRoot), "utf8");
  assert.match(js, /ARC_PUZZLE_TOTAL = 4/);
  assert.match(js, /arc-puzzle-challenge:v3/);
  assert.match(js, /선택 도전\(Expert\)/);
});

test("PPT의 잘못된 점수·오탈자·비공식 이미지 표현이 어디에도 반영되지 않았다", async () => {
  const files = [
    ["index.html", lessonRoot], ["styles.css", lessonRoot], ["game.js", lessonRoot], ["puzzles.js", lessonRoot],
    ["index.html", unitRoot],
    ["index.html", compareRoot], ["game.js", compareRoot],
  ];
  for (const [name, root] of files) {
    const text = await readFile(new URL(name, root), "utf8");
    for (const forbidden of FORBIDDEN_PPT_STRINGS) {
      assert.doesNotMatch(text, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${name}에 PPT 오류 문구(${forbidden})가 남아있음`);
    }
  }
});
