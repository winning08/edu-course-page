import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { KEYWORDS } from "../lessons/ai-keyword-bingo/keywords.js";
import {
  TOTAL_KEYWORDS, PHASES,
  createSession, remainingTerms, toggleChecked, startDraw, drawNext, undoLastDraw,
  resetDraw, currentTerm, isDrawComplete, serializeSession, deserializeSession,
} from "../lessons/ai-keyword-bingo/game-core.js";

const lessonRoot = new URL("../lessons/ai-keyword-bingo/", import.meta.url);
const groupPageUrl = new URL("../units/ai-vocabulary/index.html", import.meta.url);
const referenceUrl = new URL("../../참고/bingo.html", import.meta.url);

// 참고 원본(../참고/bingo.html)의 keywords 배열을 그대로 옮겨 적은 값. 철자·띄어쓰기·순서를 고정해 회귀를 막는다.
const EXPECTED_KEYWORDS = [
  "인공지능", "머신러닝", "딥러닝", "수치형 데이터", "범주형 데이터",
  "결측치", "이상치", "데이터 편향성", "알고리즘 편향성", "튜링 테스트",
  "인공 신경망", "지도 학습", "비지도 학습", "강화 학습", "회귀",
  "분류", "군집화", "연관 규칙", "선형 회귀 모델", "오차 함수",
  "분류 모델", "결정 트리", "KNN 알고리즘", "군집 모델", "K-평균 군집화",
];

function makeSequentialRandom() {
  // remaining 배열의 항상 0번째를 뽑도록 만드는 결정론적 난수(테스트 재현용).
  return () => 0;
}

test("keywords.js는 25개 용어를 참고 원본과 동일한 철자·띄어쓰기·순서로 담는다", () => {
  assert.equal(KEYWORDS.length, 25);
  assert.equal(TOTAL_KEYWORDS, 25);
  assert.deepEqual(KEYWORDS, EXPECTED_KEYWORDS);
  assert.equal(new Set(KEYWORDS).size, 25, "용어 25개는 서로 중복되지 않아야 함");
});

test("참고 원본 bingo.html이 로컬에 있으면 keywords 배열을 직접 대조한다(없으면 건너뜀)", async () => {
  let referenceHtml;
  try {
    referenceHtml = await readFile(referenceUrl, "utf8");
  } catch {
    return;
  }
  const match = referenceHtml.match(/const keywords\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, "참고 원본에서 keywords 배열을 찾을 수 없음");
  const referenceKeywords = [...match[1].matchAll(/'([^']*)'/g)].map((entry) => entry[1]);
  assert.deepEqual(KEYWORDS, referenceKeywords, "참고 원본의 keywords 배열과 완전히 동일해야 함");
});

test("createSession은 prep 단계, 빈 체크·빈 추첨 상태로 시작한다", () => {
  const session = createSession();
  assert.equal(session.phase, PHASES.PREP);
  assert.deepEqual(session.checkedTerms, []);
  assert.deepEqual(session.drawOrder, []);
  assert.deepEqual(remainingTerms(session), KEYWORDS);
});

test("toggleChecked는 체크·해제를 토글하고 알 수 없는 용어는 거부한다", () => {
  const session = createSession();
  assert.equal(toggleChecked(session, "인공지능"), 1);
  assert.ok(session.checkedTerms.includes("인공지능"));
  assert.equal(toggleChecked(session, "인공지능"), 0);
  assert.ok(!session.checkedTerms.includes("인공지능"));
  assert.throws(() => toggleChecked(session, "존재하지않는용어"));
});

test("drawNext는 prep 단계에서는 호출할 수 없고, draw 단계에서만 뽑을 수 있다", () => {
  const session = createSession();
  assert.throws(() => drawNext(session));
  startDraw(session);
  assert.equal(session.phase, PHASES.DRAW);
  const term = drawNext(session, makeSequentialRandom());
  assert.ok(KEYWORDS.includes(term));
  assert.equal(session.drawOrder.length, 1);
});

test("25번 뽑으면 중복 없이 25개 용어가 모두 나오고, 그 다음은 에러를 던진다", () => {
  const session = createSession();
  startDraw(session);
  const random = () => Math.random();
  const drawn = [];
  for (let i = 0; i < TOTAL_KEYWORDS; i += 1) {
    drawn.push(drawNext(session, random));
  }
  assert.equal(drawn.length, 25);
  assert.equal(new Set(drawn).size, 25, "뽑힌 용어는 중복이 없어야 함");
  assert.deepEqual([...drawn].sort(), [...KEYWORDS].sort());
  assert.ok(isDrawComplete(session));
  assert.equal(remainingTerms(session).length, 0);
  assert.throws(() => drawNext(session, random));
});

test("undoLastDraw는 가장 최근 뽑은 용어를 취소하고 다시 뽑을 수 있는 상태로 되돌린다", () => {
  const session = createSession();
  startDraw(session);
  const first = drawNext(session, makeSequentialRandom());
  const second = drawNext(session, makeSequentialRandom());
  assert.equal(session.drawOrder.length, 2);

  const undone = undoLastDraw(session);
  assert.equal(undone, second);
  assert.equal(session.drawOrder.length, 1);
  assert.deepEqual(session.drawOrder, [first]);
  assert.ok(remainingTerms(session).includes(second));

  const undoneAgain = undoLastDraw(session);
  assert.equal(undoneAgain, first);
  assert.equal(session.drawOrder.length, 0);
  assert.deepEqual(remainingTerms(session), KEYWORDS);
});

test("추첨 기록이 없을 때 undoLastDraw는 null을 반환하고 상태를 바꾸지 않는다", () => {
  const session = createSession();
  startDraw(session);
  assert.equal(undoLastDraw(session), null);
  assert.deepEqual(session.drawOrder, []);
});

test("resetDraw는 추첨 기록만 지우고 단계는 유지한다", () => {
  const session = createSession();
  startDraw(session);
  drawNext(session, makeSequentialRandom());
  drawNext(session, makeSequentialRandom());
  resetDraw(session);
  assert.deepEqual(session.drawOrder, []);
  assert.equal(session.phase, PHASES.DRAW);
  assert.deepEqual(remainingTerms(session), KEYWORDS);
});

test("currentTerm은 가장 최근 뽑은 용어를, 없으면 null을 반환한다", () => {
  const session = createSession();
  startDraw(session);
  assert.equal(currentTerm(session), null);
  const term = drawNext(session, makeSequentialRandom());
  assert.equal(currentTerm(session), term);
});

test("serializeSession/deserializeSession은 상태를 그대로 복원한다(새로고침 사고 대비)", () => {
  const session = createSession();
  toggleChecked(session, "이상치");
  startDraw(session);
  drawNext(session, makeSequentialRandom());
  drawNext(session, makeSequentialRandom());

  const raw = serializeSession(session);
  const restored = deserializeSession(raw);
  assert.deepEqual(restored, {
    phase: session.phase,
    checkedTerms: session.checkedTerms,
    drawOrder: session.drawOrder,
  });
});

test("deserializeSession은 손상되었거나 조작된 상태를 보수적으로 거부하고 null을 반환한다", () => {
  assert.equal(deserializeSession(null), null);
  assert.equal(deserializeSession(""), null);
  assert.equal(deserializeSession("이건 JSON이 아님"), null);
  assert.equal(deserializeSession(JSON.stringify({ phase: "존재하지않는단계", checkedTerms: [], drawOrder: [] })), null);
  assert.equal(deserializeSession(JSON.stringify({ phase: "draw", checkedTerms: [], drawOrder: ["존재하지않는용어"] })), null);
  assert.equal(deserializeSession(JSON.stringify({ phase: "draw", checkedTerms: [], drawOrder: ["인공지능", "인공지능"] })), null, "중복된 추첨 기록은 거부해야 함");
  assert.equal(deserializeSession(JSON.stringify({ phase: "draw", checkedTerms: [], drawOrder: new Array(30).fill("인공지능") })), null, "25개를 넘는 추첨 기록은 거부해야 함");
});

test("독립 활동 페이지와 접근성·반응형 장치를 제공한다", async () => {
  const [html, css, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible|:has\(input:checked\)/);
  assert.match(js, /event\.key === "Enter"/);
  assert.match(js, /Space/);
  assert.match(html, /id="fullscreen-toggle"/);
  assert.match(js, /requestFullscreen/);
  assert.match(js, /exitFullscreen/);
});

test("25개 용어를 고대비 카드 목록으로 모두 보여주고, 진행 카운트(0/25)를 제공한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  for (const term of KEYWORDS) {
    assert.match(html, new RegExp(`data-term="${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`), `${term}이(가) 준비 화면에 없음`);
  }
  assert.match(html, /id="prep-progress-count">0</);
  assert.match(html, /\/ 25 확인함/);
});

test("추첨 시작 전에는 확인 절차가 있고, 추첨 화면에는 현재 용어 안내·N\\/25·25개 전체 용어판·취소·초기화·전체화면을 제공한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /id="confirm-start-overlay"/);
  assert.match(html, /id="confirm-start-ok"/);
  assert.match(html, /id="draw-current"/);
  assert.match(html, /id="draw-count"/);
  assert.match(html, /id="term-board"/);
  assert.match(html, /id="draw-undo-button"/);
  assert.match(html, /id="draw-reset-button"/);
  assert.match(html, /id="reset-confirm-overlay"/);
  assert.match(html, /id="fullscreen-toggle"/);
});

test("교사 전용 화면이므로 학생 의견을 묻는 마무리 영역이 없다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.doesNotMatch(html, /id="wrapup-view"/);
  assert.doesNotMatch(html, /id="wrapup-notes"/);
});

test("units/ai-vocabulary/ 목록 페이지는 25개 용어를 keywords.js와 동일한 철자·순서로 미리보기한다", async () => {
  const html = await readFile(groupPageUrl, "utf8");
  assert.match(html, /class="term-preview"/);
  const items = [...html.matchAll(/<ul class="term-preview">([\s\S]*?)<\/ul>/g)];
  assert.equal(items.length, 1, "term-preview 목록은 정확히 하나여야 함");
  const terms = [...items[0][1].matchAll(/<li>([^<]+)<\/li>/g)].map((m) => m[1]);
  assert.deepEqual(terms, KEYWORDS);
});

test("학생용 빈 빙고판을 인쇄할 수 있는 버튼과 인쇄 전용 영역이 있다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /id="print-board-button"/);
  assert.match(html, /id="printable-board"[^>]*aria-hidden="true"/);
  assert.match(html, /id="board-print-grid"/);
  assert.match(js, /printBoardButton.*addEventListener\("click",\s*\(\)\s*=>\s*window\.print\(\)\)/s);
  assert.match(js, /Array\.from\(\{\s*length:\s*TOTAL_KEYWORDS\s*\}\)/, "빈 칸 개수는 TOTAL_KEYWORDS(용어 25개)와 동기화되어야 함");
});

test("긴 용어 정의나 디지털 빙고 판정 로직을 포함하지 않는다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.doesNotMatch(html, /정의\s*[:：]/);
  assert.doesNotMatch(html, /class="bingo-grid"|class="bingo-cell"/);
  assert.doesNotMatch(js, /bingo-cell|checkBingoLine|isBingo\(/);
});

test("group-guard 마크업을 포함하고 소속 그룹은 ai-vocabulary다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /data-guard-scope="page"/);
  assert.match(html, /data-guard-group="ai-vocabulary"/);
  assert.match(html, /id="guard-blocked"/);
  assert.match(html, /href="\.\.\/\.\.\/"/);
});

test("허브·그룹 페이지와 lessons.json에 새 활동 링크·항목이 등록되어 있다", async () => {
  const [hubHtml, groupHtml, lessonsJson] = await Promise.all([
    readFile(new URL("../../index.html", lessonRoot), "utf8"),
    readFile(new URL("../../units/ai-vocabulary/index.html", lessonRoot), "utf8"),
    readFile(new URL("../../data/lessons.json", lessonRoot), "utf8"),
  ]);
  assert.match(hubHtml, /href="units\/ai-vocabulary\/"/);
  assert.match(groupHtml, /href="\.\.\/\.\.\/lessons\/ai-keyword-bingo\/"/);
  const lessons = JSON.parse(lessonsJson).lessons;
  const bingo = lessons.find((lesson) => lesson.id === "ai-keyword-bingo");
  assert.ok(bingo, "lessons.json에 ai-keyword-bingo가 없음");
  assert.equal(bingo.path, "lessons/ai-keyword-bingo/");
  assert.equal(bingo.status, "published");
});

function parseColor(raw) {
  const value = raw.trim();
  const hexMatch = value.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  const rgbaMatch = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
      a: rgbaMatch[4] === undefined ? 1 : Number(rgbaMatch[4]),
    };
  }
  throw new Error(`색상 값을 해석할 수 없음: ${raw}`);
}

function compositeOver(fg, bg) {
  return {
    r: fg.a * fg.r + (1 - fg.a) * bg.r,
    g: fg.a * fg.g + (1 - fg.a) * bg.g,
    b: fg.a * fg.b + (1 - fg.a) * bg.b,
  };
}

function relativeLuminance({ r, g, b }) {
  const channel = (c) => {
    const normalized = c / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(colorA, colorB) {
  const lumA = relativeLuminance(colorA);
  const lumB = relativeLuminance(colorB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

test("#draw-next-button의 .shortcut-help 글자색은 버튼 배경(accent) 대비 4.5:1 이상을 확보한다", async () => {
  const [css, baseCss] = await Promise.all([
    readFile(new URL("styles.css", lessonRoot), "utf8"),
    readFile(new URL("../shared/lab-base.css", lessonRoot), "utf8"),
  ]);

  const accentMatch = baseCss.match(/--accent:\s*(#[0-9a-f]{6})/i);
  assert.ok(accentMatch, "--accent 토큰을 shared/lab-base.css에서 찾을 수 없음");
  const buttonBackground = parseColor(accentMatch[1]);

  const overrideMatch = css.match(/#draw-next-button\s+\.shortcut-help\s*\{\s*color:\s*([^;]+);/);
  assert.ok(overrideMatch, "#draw-next-button .shortcut-help 전용 색상 규칙이 없음");
  const foreground = compositeOver(parseColor(overrideMatch[1]), buttonBackground);

  const ratio = contrastRatio(foreground, buttonBackground);
  assert.ok(ratio >= 4.5, `대비 ${ratio.toFixed(2)}:1은 4.5:1 미만임`);

  // 흰색 계열인지도 함께 확인한다(단순히 색을 accent와 같게 만들어 눈속임하는 경우 방지).
  assert.ok(foreground.r > 200 && foreground.g > 200 && foreground.b > 200, "흰색 계열이 아님");
});

test("두 확인 모달은 Tab/Shift+Tab 포커스 트랩, Escape 취소, 열기 전 트리거로의 포커스 복귀를 구현한다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");

  // Tab 트랩
  assert.match(js, /function trapOverlayFocus/);
  assert.match(js, /event\.key === "Tab"/);
  assert.match(js, /trapOverlayFocus\(event\)/);
  assert.match(js, /event\.shiftKey/);
  assert.match(js, /overlay\.querySelectorAll\(FOCUSABLE_SELECTOR\)/);
  assert.match(js, /event\.preventDefault\(\)/);

  // Escape 취소 (두 오버레이 모두)
  assert.match(js, /event\.key === "Escape"/);
  assert.match(js, /if \(!elements\.confirmStartOverlay\.hidden\) cancelStart\(\);/);
  assert.match(js, /if \(!elements\.resetConfirmOverlay\.hidden\) cancelReset\(\);/);

  // 열기 전 포커스 트리거 기록과 닫을 때 복귀
  assert.match(js, /lastFocusedTrigger = trigger/);
  assert.match(js, /lastFocusedTrigger\?\.focus\(\);/);
  assert.match(js, /lastFocusedTrigger = null;/);
});

test("추첨 완료 시 다음 뽑기 버튼에 포커스가 있었다면 초기화 버튼으로 안전하게 포커스를 옮긴다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /focusWasOnNextButton/);
  assert.match(js, /isDrawComplete\(session\) && focusWasOnNextButton/);
  assert.match(js, /elements\.drawResetButton\.focus\(\);/);
});

test("교실 프로젝터(가로 900px 이상 · 높이 800px 이하) 환경에서 추첨 화면 높이를 압축해 핵심 정보를 한 화면에 보여준다", async () => {
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  const mediaMatch = css.match(/@media \(min-width: 900px\) and \(max-height: 800px\) \{([\s\S]*?)\n\}/);
  assert.ok(mediaMatch, "900px 이상 · 800px 이하 높이 전용 미디어 쿼리가 없음");
  const block = mediaMatch[1];
  assert.match(block, /\.draw-announce\s*\{[^}]*padding:/, "draw-announce 여백을 압축하지 않음");
  assert.match(block, /\.draw-current\s*\{[^}]*font-size:/, "draw-current 글자 크기를 압축하지 않음");
  assert.match(block, /main\s*\{[^}]*padding:/, "main 여백을 압축하지 않음");
});

test("추첨 화면은 돌아다니는 장식 애니메이션 없이, 25개 용어를 겹치지 않는 무작위 위치에 흩뿌려 처음부터 모두 보여주고 뽑힌 것을 강조 표시한다", async () => {
  const [html, css, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);

  // 떠다니는 장식 애니메이션 레이어(keyword-motion.js)는 완전히 제거되어 있다.
  assert.doesNotMatch(html, /id="floating-field"/);
  assert.doesNotMatch(html, /id="draw-stage"/);
  assert.doesNotMatch(js, /keyword-motion\.js/);
  await assert.rejects(readFile(new URL("keyword-motion.js", lessonRoot), "utf8"));

  // 5x5 격자(칸) 대신, 25개 용어를 절대 위치로 자유롭게 흩뿌려 놓는다.
  assert.match(html, /id="term-board"/);
  const termBoardBlockMatch = css.match(/\.term-board\s*\{[^}]*\}/);
  assert.ok(termBoardBlockMatch, ".term-board 컨테이너 스타일이 없음");
  assert.doesNotMatch(termBoardBlockMatch[0], /grid-template-columns/, "격자(그리드) 배치가 아니어야 함");
  assert.match(css, /\.term-board\s*\{[^}]*position:\s*relative;/, "흩뿌려진 칩들의 기준이 되는 컨테이너여야 함");
  assert.match(css, /\.term-board li\s*\{[^}]*position:\s*absolute;/, "칩은 JS가 계산한 left\\/top으로 자유롭게 배치되어야 함");

  // 위치는 실제 렌더링 크기를 측정해 겹치지 않게 계산하고(무작위 시도 + 나선형 안전망),
  // 컨테이너가 아직 안 보일 때(가드 대기·준비 화면)는 측정하지 않고 보일 때까지 기다린다.
  assert.match(js, /function placeTermBoardTiles/);
  assert.match(js, /function tilesOverlap/);
  assert.match(js, /getBoundingClientRect\(\)/);
  assert.match(js, /if \(width === 0 \|\| height === 0\) return false;/);
  assert.match(js, /new ResizeObserver/);

  // 뽑힌 칩(is-drawn)과 방금 막 뽑힌 칩(is-current)을 색으로 구분해 강조한다.
  assert.match(js, /is-drawn/);
  assert.match(js, /is-current/);
  assert.match(css, /\.term-board li\.is-drawn/);
  assert.match(css, /\.term-board li\.is-current/);

  // 몇 번째로 뽑혔는지 배지로 안내하되, 배지는 칩의 측정된 크기(이미 계산된 위치)에 영향을 주지 않는다.
  assert.match(js, /term-order-badge/);
  assert.match(css, /\.term-order-badge\s*\{[^}]*position:\s*absolute;/, "배지가 칩의 박스 크기에 영향을 주지 않아야(위치가 나중에 밀리지 않아야) 함");
});
