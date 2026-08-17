import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  STAGE1_POINTS, CHECKER_POINTS, PHASES, RULES, MYCIN_CASES,
  classifyPoint, scorePoints, classifyTwoLines, scoreTwoLinesPoints, matchRule,
  createSession, updatePerceptronLine, advanceFromPerceptron,
  updateXorLine, advanceFromXor,
  currentMycinCase, submitMycinAnswer, advanceMycinCase, advanceFromMycin,
  updateBreakthroughLines, advanceFromBreakthrough, findBandAutomatically,
  AUTO_FIND_START_A, AUTO_FIND_START_B,
  sessionResults, restartSession,
} from "../lessons/ai-perceptron-wall/game-core.js";

const lessonRoot = new URL("../lessons/ai-perceptron-wall/", import.meta.url);
const SOLVED_STAGE1_LINE = { slope: -1.5, intercept: 1.3 };

function sweepBest(points, { slopeStep = 0.05, interceptStep = 0.02 } = {}) {
  let best = 0;
  for (let slope = -3; slope <= 3; slope += slopeStep) {
    for (let intercept = -1; intercept <= 2; intercept += interceptStep) {
      best = Math.max(best, scorePoints(points, { slope, intercept }).correct);
    }
  }
  return best;
}

test("1단계 점들은 기울기·y절편을 함께 조정하면 만점을 달성할 수 있는 조합이 존재한다", () => {
  assert.equal(sweepBest(STAGE1_POINTS), STAGE1_POINTS.length);
  assert.equal(scorePoints(STAGE1_POINTS, SOLVED_STAGE1_LINE).correct, STAGE1_POINTS.length);
});

test("1단계 점들은 기울기 0(수평선)으로 고정해서는 어떤 y절편을 골라도 만점이 나오지 않는다", () => {
  let best = 0;
  for (let intercept = -1; intercept <= 2; intercept += 0.01) {
    best = Math.max(best, scorePoints(STAGE1_POINTS, { slope: 0, intercept }).correct);
  }
  assert.ok(best < STAGE1_POINTS.length, "기울기 0만으로는 만점이 나오면 안 됨(기울기 조정이 반드시 필요해야 함)");
});

test("1단계에는 y값이 같은 참·거짓 점이 있어 수평선으로는 원리적으로 분리가 불가능하다", () => {
  const byY = new Map();
  for (const point of STAGE1_POINTS) {
    if (!byY.has(point.y)) byY.set(point.y, new Set());
    byY.get(point.y).add(point.label);
  }
  const sharedY = [...byY.values()].some((labels) => labels.size > 1);
  assert.ok(sharedY, "같은 y값에 참과 거짓이 함께 있어야 수평선 분리가 원천적으로 불가능함");
});

test("1단계 기본 시작값(기울기 0, y절편 0.5)은 만점이 아니다(도전 과제가 남아있어야 함)", () => {
  const score = scorePoints(STAGE1_POINTS, { slope: 0, intercept: 0.5 });
  assert.ok(score.correct < STAGE1_POINTS.length);
});

test("2단계 점들은 어떤 직선 하나로도 만점을 달성할 수 없다", () => {
  const best = sweepBest(CHECKER_POINTS);
  assert.ok(best < CHECKER_POINTS.length, `직선 하나로 ${best}/${CHECKER_POINTS.length}까지만 가능해야 하는데 만점이 나옴`);
});

test("2단계 점은 참인 점이 거짓인 점들 사이(양쪽)에 끼어 있어 여러 개(15개) 배치된다", () => {
  assert.ok(CHECKER_POINTS.length >= 10, "점이 여러 개(최소 10개 이상) 배치되어야 함");
  const trueXY = CHECKER_POINTS.filter((p) => p.label).map((p) => p.x + p.y);
  const falseXY = CHECKER_POINTS.filter((p) => !p.label).map((p) => p.x + p.y);
  const trueMin = Math.min(...trueXY);
  const trueMax = Math.max(...trueXY);
  assert.ok(falseXY.some((w) => w < trueMin), "참인 점들보다 x+y가 작은 거짓 점(아래쪽 바깥)이 있어야 함");
  assert.ok(falseXY.some((w) => w > trueMax), "참인 점들보다 x+y가 큰 거짓 점(위쪽 바깥)이 있어야 함");
});

test("직선 A(위) · 직선 B(아래) 두 직선으로 띠를 만들면 2단계 점들을 만점으로 완전히 풀 수 있다", () => {
  const lineA = { slope: -1, intercept: 0.8 };
  const lineB = { slope: -1, intercept: 1.4 };
  const score = scoreTwoLinesPoints(CHECKER_POINTS, lineA, lineB);
  assert.equal(score.correct, CHECKER_POINTS.length);
  assert.equal(score.accuracy, 100);
});

test("classifyTwoLines는 직선 A보다 위 AND 직선 B보다 아래일 때만 참이다", () => {
  const lineA = { slope: -1, intercept: 0.8 };
  const lineB = { slope: -1, intercept: 1.4 };
  for (const point of CHECKER_POINTS) {
    const aboveA = classifyPoint(lineA, point);
    const belowB = point.y < lineB.slope * point.x + lineB.intercept;
    assert.equal(classifyTwoLines(lineA, lineB, point), aboveA && belowB);
  }
});

test("findBandAutomatically는 고정된 시작점에서 2단계 점들을 오차 없이(만점) 자동으로 찾는다", () => {
  const path = findBandAutomatically(CHECKER_POINTS);
  assert.ok(path.length >= 2, "최소 시작 단계 외에 실제로 이동한 단계가 있어야 함");
  const first = path[0];
  assert.deepEqual(first.lineA, AUTO_FIND_START_A);
  assert.deepEqual(first.lineB, AUTO_FIND_START_B);
  const last = path[path.length - 1];
  assert.equal(last.score.correct, CHECKER_POINTS.length, "자동 탐색은 항상 만점에 도달해야 함(교실 데모이므로 실패하면 안 됨)");
});

test("findBandAutomatically의 각 단계는 점진적으로 오차(오답 수)를 줄이거나 유지한다(널뛰지 않음)", () => {
  const path = findBandAutomatically(CHECKER_POINTS);
  let prevWrong = CHECKER_POINTS.length - path[0].score.correct;
  for (const step of path.slice(1)) {
    const wrong = CHECKER_POINTS.length - step.score.correct;
    assert.ok(wrong <= prevWrong + 2, `오답 수가 갑자기 크게 늘면 학습처럼 안 보임(이전 ${prevWrong} -> 이번 ${wrong})`);
    prevWrong = wrong;
  }
});

test("findBandAutomatically가 반환하는 모든 직선은 슬라이더 범위(기울기 -3~3, y절편 -1~2) 안에 있다", () => {
  const path = findBandAutomatically(CHECKER_POINTS);
  for (const step of path) {
    for (const line of [step.lineA, step.lineB]) {
      assert.ok(line.slope >= -3 && line.slope <= 3, `기울기가 슬라이더 범위를 벗어남: ${line.slope}`);
      assert.ok(line.intercept >= -1 && line.intercept <= 2, `y절편이 슬라이더 범위를 벗어남: ${line.intercept}`);
    }
  }
});

test("마이신 규칙 6개 사례 중 정확히 2개(4·6번째)는 규칙 4개 어디에도 맞지 않는다", () => {
  const results = MYCIN_CASES.map((patient) => matchRule(RULES, patient));
  const unmatchedIndexes = results.map((rule, index) => (rule ? null : index)).filter((index) => index !== null);
  assert.deepEqual(unmatchedIndexes, [3, 5]);
  assert.equal(results.filter(Boolean).length, 4);
});

test("규칙은 명시된 항목만 검사하고 나머지는 무관(don't-care)하게 매칭된다", () => {
  const rule1 = RULES.find((r) => r.id === "R1");
  assert.deepEqual(Object.keys(rule1.when).sort(), ["기침", "열"]);
  assert.ok(matchRule(RULES, { 열: "높음", 기침: "있음", 콧물: "있음" }));
  assert.ok(matchRule(RULES, { 열: "높음", 기침: "있음", 콧물: "없음" }));
});

test("규칙마다 버튼에 보여줄 처방(treatment)이 있고, 네 처방은 서로 다른 문구다", () => {
  const treatments = RULES.map((rule) => rule.treatment);
  assert.equal(treatments.length, new Set(treatments).size, "처방 문구가 중복되면 버튼을 구분할 수 없음");
  for (const rule of RULES) {
    assert.ok(rule.treatment.length > 0);
    assert.ok(rule.result.includes(rule.treatment) || rule.result.length > 0);
  }
});

test("퍼셉트론 단계는 만점을 달성해야만 다음 단계로 넘어갈 수 있다", () => {
  const session = createSession();
  assert.throws(() => advanceFromPerceptron(session));
  updatePerceptronLine(session, { slope: 0, intercept: 0.5 });
  assert.throws(() => advanceFromPerceptron(session));
  updatePerceptronLine(session, SOLVED_STAGE1_LINE);
  advanceFromPerceptron(session);
  assert.equal(session.phase, PHASES.XOR);
});

test("XOR 단계는 시도 없이는 넘어갈 수 없다는 정책이 없고(항상 진행 가능), best는 전체 점수를 넘지 않는다", () => {
  const session = createSession();
  updatePerceptronLine(session, SOLVED_STAGE1_LINE);
  advanceFromPerceptron(session);
  updateXorLine(session, { slope: -1, intercept: 1.1 });
  updateXorLine(session, { slope: 0, intercept: 0.5 });
  advanceFromXor(session);
  assert.equal(session.phase, PHASES.MYCIN);
  assert.ok(session.xor.best < CHECKER_POINTS.length);
});

test("advanceMycinCase는 다음 사례로 이동했으면 true, 이미 마지막 사례였다면 false를 반환한다", () => {
  const session = createSession();
  for (let i = 0; i < MYCIN_CASES.length - 1; i += 1) {
    assert.equal(advanceMycinCase(session), true, `${i}번째에서 다음 사례로 이동했어야 함`);
    assert.equal(session.mycin.index, i + 1);
  }
  assert.equal(advanceMycinCase(session), false, "마지막 사례에서는 더 이동할 곳이 없어야 함");
  assert.equal(session.mycin.index, MYCIN_CASES.length - 1);
});

test("마이신 단계는 사례 6개에 모두 답해야 다음 단계로 넘어갈 수 있고, game.js와 같은 방식(moved=false일 때만 리뷰로 감)으로 진행하면 6번 모두 답하게 된다", () => {
  const session = createSession();
  updatePerceptronLine(session, SOLVED_STAGE1_LINE);
  advanceFromPerceptron(session);
  advanceFromXor(session);
  assert.throws(() => advanceFromMycin(session));

  let moved = true;
  let answered = 0;
  while (true) {
    const patient = currentMycinCase(session);
    const rule = matchRule(RULES, patient);
    submitMycinAnswer(session, rule ? rule.id : "NONE");
    answered += 1;
    moved = advanceMycinCase(session);
    if (!moved) break;
  }
  assert.equal(answered, MYCIN_CASES.length, "game.js의 onMycinNext 로직대로면 6개 사례에 모두 답해야 함");

  advanceFromMycin(session);
  assert.equal(session.phase, PHASES.BREAKTHROUGH);
  const results = sessionResults(session);
  assert.equal(results.mycin.correct, MYCIN_CASES.length);
  assert.equal(results.mycin.wallCount, 2);
});

test("역전파 단계는 두 직선(띠)으로 만점을 달성해야 결과 화면으로 넘어갈 수 있다", () => {
  const session = createSession();
  session.phase = PHASES.BREAKTHROUGH;
  assert.throws(() => advanceFromBreakthrough(session));
  updateBreakthroughLines(session, { slope: -1, intercept: 0.8 }, { slope: -1, intercept: 1.4 });
  advanceFromBreakthrough(session);
  assert.equal(session.phase, PHASES.RESULTS);
});

test("restartSession은 세션을 처음 상태로 되돌린다", () => {
  const session = createSession();
  updatePerceptronLine(session, SOLVED_STAGE1_LINE);
  advanceFromPerceptron(session);
  restartSession(session);
  assert.equal(session.phase, PHASES.PERCEPTRON);
  assert.equal(session.perceptron.best, 0);
  assert.equal(session.mycin.attempts.length, 0);
});

test("독립 lesson 페이지와 접근성 장치를 제공한다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /data-guard-scope="page" data-guard-group="ai-history" data-guard-lesson="ai-perceptron-wall"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /프로젝터 모드/);
  assert.match(html, /role="img"/);
  assert.match(html, /href="\.\.\/shared\/lab-base\.css"/, "공통 lab-base.css(prefers-reduced-motion·:focus-visible 포함)를 재사용해야 함");
  assert.match(js, /prefers-reduced-motion: reduce/);
});

test("실험 영역 전에 '왜 점과 선인가'를 설명하는 개념 다리(concept-bridge)가 있고, 실험 영역보다 앞에 온다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const bridgeIndex = html.indexOf('class="concept-bridge"');
  const experimentIndex = html.indexOf('id="experiment"');
  assert.ok(bridgeIndex !== -1, "concept-bridge 블록이 없음");
  assert.ok(experimentIndex !== -1 && bridgeIndex < experimentIndex, "concept-bridge는 실험 영역보다 앞에 있어야 함");
  const bridgeMatch = html.match(/<div class="concept-bridge">[\s\S]*?<\/div>/);
  assert.ok(bridgeMatch, "concept-bridge 블록 내용을 찾을 수 없음");
  assert.match(bridgeMatch[0], /점/);
  assert.match(bridgeMatch[0], /선/);
});

test("네 단계(퍼셉트론·XOR·마이신·역전파)와 결과 화면 구조를 모두 갖춘다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  for (const id of ["perceptron-view", "xor-view", "mycin-view", "breakthrough-view", "results-view"]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id}가 없음`);
  }
  assert.match(html, /id="mycin-rules"/);
  assert.match(html, /id="mycin-choices"/);
  assert.match(html, /id="journey-list"/);
});

test("4단계에는 'AI가 자동으로 찾기' 버튼과 상태 표시가 있고, game.js가 findBandAutomatically를 사용한다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /id="auto-find-button"/);
  assert.match(html, /id="auto-find-status"[^>]*aria-live="polite"/);
  assert.match(js, /findBandAutomatically/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

test("역전파 해설(reveal)에는 '자동으로 찾기'가 실제로 한 일(오차를 줄이는 방향으로 반복 조정)에 대한 설명이 있다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const revealMatch = html.match(/<aside class="reveal-box" id="breakthrough-reveal"[\s\S]*?<\/aside>/);
  assert.ok(revealMatch, "breakthrough-reveal 블록을 찾을 수 없음");
  assert.match(revealMatch[0], /오차/);
});

test("슬라이더는 기울기(m)·y절편(b) 이름을 쓰고, 4개 라인 컨트롤(1·2·4단계, 4단계는 A/B) 모두 존재한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, />기울기\(m\)</);
  assert.match(html, />y절편\(b\)</);
  for (const id of ["perceptron-slope", "perceptron-intercept", "xor-slope", "xor-intercept",
    "breakthrough-a-slope", "breakthrough-a-intercept", "breakthrough-b-slope", "breakthrough-b-intercept"]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} 슬라이더가 없음`);
  }
  assert.doesNotMatch(html, /기울기\(각도\)|선의 위치/, "옛 각도·오프셋 UI 문구가 남아있으면 안 됨");
});

test("과제 화면에는 AND/XOR 이름이 없고, 해설은 현재 배치를 표준 XOR 자체로 오해시키지 않는다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const taskHeadings = html.match(/<h2[^>]*>([^<]*)<\/h2>/g) ?? [];
  for (const heading of taskHeadings) {
    assert.doesNotMatch(heading, /\bAND\b|\bXOR\b/, `과제 제목에 논리 용어가 노출됨: ${heading}`);
  }
  assert.match(html, /id="xor-reveal"[\s\S]*?전형적인 XOR과 마찬가지로/, "해설은 XOR과의 유사성을 정확히 설명해야 함");
  assert.doesNotMatch(html, /이런 배치를 <strong>XOR<\/strong>이라 부릅니다/);
});

test("자동 찾기를 실제 역전파 구현으로 과장하지 않고 경사하강과 역전파의 관계를 구분한다", async () => {
  const [html, core] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game-core.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /경사하강 과정/);
  assert.match(html, /실제 역전파는/);
  assert.match(core, /실제 역전파를 구현한 것은 아니다/);
  assert.doesNotMatch(html, /역전파의 핵심 원리입니다/);
});

test("마이신 단계 버튼은 규칙 번호가 아니라 처방으로 표시된다(game.js가 rule.treatment를 사용)", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /rule\.treatment/);
  assert.doesNotMatch(js, /\$\{rule\.label\}<\/button>/, "버튼에 규칙 번호(label)를 쓰면 안 됨");
});

test("data/activity-groups.json에 ai-history 그룹과 ai-perceptron-wall 활동이 등록되어 있다", async () => {
  const raw = await readFile(new URL("../../data/activity-groups.json", lessonRoot), "utf8");
  const data = JSON.parse(raw);
  const group = data.groups.find((g) => g.id === "ai-history");
  assert.ok(group, "ai-history 그룹이 없음");
  assert.equal(group.path, "units/ai-history/");
  assert.equal(group.children.length, 2);
  assert.equal(group.children[0].id, "ai-perceptron-wall");
  assert.equal(group.children[0].path, "lessons/ai-perceptron-wall/");
});

test("루트 허브와 활동지 목록 페이지가 서로 연결된다", async () => {
  const [hub, unitPage] = await Promise.all([
    readFile(new URL("../../index.html", lessonRoot), "utf8"),
    readFile(new URL("../../units/ai-history/index.html", lessonRoot), "utf8"),
  ]);
  assert.match(hub, /href="units\/ai-history\/"/);
  assert.match(unitPage, /href="\.\.\/\.\.\/lessons\/ai-perceptron-wall\/"/);
  assert.match(unitPage, /data-guard-group="ai-history"/);
});
