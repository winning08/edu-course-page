import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  classify, COLORS, TEXTURES, TRAIN_ROUNDS, TEST_ROUNDS, PHASES,
  makeTrainRounds, makeTestRounds, seededRandom,
  createSession, currentSample, submitPrediction, advancePhase, distribution,
  submitReview, startTest, submitTestBatch, sessionResults, testByColor, restartSession,
} from "../lessons/ai-biased-data/game-core.js";

const lessonRoot = new URL("../lessons/ai-biased-data/", import.meta.url);
const TRAIN_DISTRIBUTION = { 초록: 5, 노랑: 2, 빨강: 4, 주황: 1 };

function runFullTraining(session, predictionFn = (sample) => classify(sample)) {
  for (let round = 0; round < TRAIN_ROUNDS; round += 1) {
    submitPrediction(session, predictionFn(currentSample(session)));
    advancePhase(session);
  }
}

test("정답 규칙은 활동1·2와 동일하게 색깔+촉감으로 정해진다", () => {
  for (const color of COLORS) for (const texture of TEXTURES) {
    const ripe = color === "빨강" || (["노랑", "주황"].includes(color) && texture !== "단단함");
    assert.equal(classify({ color, texture }), ripe ? "잘 익음" : "안 익음");
  }
});

test("1000개 시드에서 학습 12문제는 항상 초록5·빨강4·노랑2·주황1로 치우쳐 있다", () => {
  for (let seed = 1; seed <= 1000; seed += 1) {
    const rounds = makeTrainRounds(seededRandom(seed));
    assert.equal(rounds.length, TRAIN_ROUNDS);
    const counts = Object.fromEntries(COLORS.map((color) => [color, 0]));
    for (const sample of rounds) counts[sample.color] += 1;
    assert.deepEqual(counts, TRAIN_DISTRIBUTION, `${seed}: 분포가 다름 ${JSON.stringify(counts)}`);
  }
});

test("1000개 시드에서 시험 문제는 노랑·주황의 단단함·중간·말랑함을 모두 포함하는 균형 잡힌 8문제다", () => {
  for (let seed = 1; seed <= 1000; seed += 1) {
    const rounds = makeTestRounds(seededRandom(seed));
    assert.equal(rounds.length, TEST_ROUNDS);
    const keys = new Set(rounds.map((sample) => `${sample.color}-${sample.texture}`));
    for (const color of ["노랑", "주황"]) {
      for (const texture of TEXTURES) {
        assert.ok(keys.has(`${color}-${texture}`), `${seed}: ${color}-${texture} 누락`);
      }
    }
    const colors = rounds.map((sample) => sample.color);
    assert.ok(colors.includes("빨강"), `${seed}: 빨강이 시험에 없음`);
    assert.ok(colors.includes("초록"), `${seed}: 초록이 시험에 없음`);
  }
});

test("전체 진행은 학습→검토→시험→결과 순서로만 전이된다", () => {
  const session = createSession(seededRandom(42));
  assert.equal(session.phase, PHASES.TRAIN);
  runFullTraining(session);
  assert.equal(session.phase, PHASES.REVIEW);
  assert.equal(session.trainAttempts.length, TRAIN_ROUNDS);

  assert.throws(() => submitPrediction(session, "잘 익음"));
  assert.throws(() => advancePhase(session));
  assert.throws(() => startTest(session), "검토 질문에 답하기 전에는 시험을 시작할 수 없다");

  const outcome = submitReview(session, "주황");
  assert.deepEqual(outcome, { reveal: true, correct: true, correctAnswer: "주황" });

  startTest(session);
  assert.equal(session.phase, PHASES.TEST);
  const testOutcome = submitTestBatch(session, session.testRounds.map(() => "잘 익음"));
  assert.deepEqual(testOutcome, { reveal: false });
  assert.equal(session.phase, PHASES.RESULTS);
  assert.equal(session.testAttempts.length, TEST_ROUNDS);
});

test("distribution은 학습 완료 후 색깔별 개수를 정확히 센다", () => {
  const session = createSession(seededRandom(3));
  runFullTraining(session);
  assert.deepEqual(distribution(session), TRAIN_DISTRIBUTION);
});

test("검토 질문의 정답은 가장 적게 등장한 색깔(주황)이고, REVIEW 단계에서만 제출할 수 있다", () => {
  const session = createSession(seededRandom(9));
  assert.throws(() => submitReview(session, "주황"), "학습 단계에서는 검토 질문을 제출할 수 없다");
  runFullTraining(session);
  assert.throws(() => submitReview(session, "보라"), "알 수 없는 색깔은 거부한다");

  const wrong = submitReview(session, "초록");
  assert.deepEqual(wrong, { reveal: true, correct: false, correctAnswer: "주황" });
  assert.equal(session.reviewChoice, "초록");
  assert.equal(session.reviewCorrect, false);
});

test("시험 답안 8개를 한 번에 제출하면 결과 단계로 전환되고 정답·정오답 정보가 응답에 담기지 않는다", () => {
  const session = createSession(seededRandom(7));
  runFullTraining(session);
  submitReview(session, "주황");
  startTest(session);
  const answers = session.testRounds.map((_, index) => (index % 2 === 0 ? "잘 익음" : "안 익음"));
  const outcome = submitTestBatch(session, answers);
  assert.deepEqual(outcome, { reveal: false });
  assert.equal("answer" in outcome, false);
  assert.equal("correct" in outcome, false);
  session.testAttempts.forEach((attempt, index) => {
    assert.equal(attempt.prediction, answers[index]);
    assert.ok(["잘 익음", "안 익음"].includes(attempt.answer));
    assert.equal(typeof attempt.correct, "boolean");
  });
});

test("시험 답안 중 하나라도 비어 있으면 제출을 거부하고 첫 미응답 위치를 알려준다", () => {
  const session = createSession(seededRandom(21));
  runFullTraining(session);
  submitReview(session, "주황");
  startTest(session);
  const incomplete = session.testRounds.map(() => "잘 익음");
  incomplete[3] = null;
  assert.throws(() => submitTestBatch(session, incomplete), (error) => {
    assert.equal(error.missingIndex, 3);
    return true;
  });
  assert.equal(session.phase, PHASES.TEST);
  assert.equal(session.testAttempts.length, 0);
});

test("testByColor는 색깔별 시험 정답 수·문항 수·정확도를 담고, 개별 문항의 정오답 배열은 노출하지 않는다", () => {
  const session = createSession(seededRandom(15));
  runFullTraining(session);
  submitReview(session, "주황");
  startTest(session);
  submitTestBatch(session, session.testRounds.map((sample) => classify(sample)));
  const byColor = testByColor(session);
  assert.ok(byColor.노랑);
  assert.ok(byColor.주황);
  assert.equal(byColor.노랑.total, 3);
  assert.equal(byColor.주황.total, 3);
  assert.equal(byColor.노랑.correct, 3);
  assert.equal(byColor.노랑.accuracy, 100);
  for (const color of Object.values(byColor)) {
    assert.equal(typeof color.correct, "number");
    assert.equal(typeof color.total, "number");
    assert.equal(typeof color.accuracy, "number");
  }
});

test("재시작하면 학습 단계로 돌아가고 검토·시험 상태가 모두 초기화된다", () => {
  const session = createSession(seededRandom(99));
  runFullTraining(session);
  submitReview(session, "주황");
  startTest(session);
  submitTestBatch(session, session.testRounds.map(() => "잘 익음"));
  assert.equal(session.phase, PHASES.RESULTS);

  restartSession(session, seededRandom(100));
  assert.equal(session.phase, PHASES.TRAIN);
  assert.equal(session.roundIndex, 0);
  assert.equal(session.trainAttempts.length, 0);
  assert.equal(session.testAttempts.length, 0);
  assert.equal(session.reviewChoice, null);
  assert.equal(session.reviewCorrect, null);
  assert.equal(session.trainRounds.length, TRAIN_ROUNDS);
  assert.equal(session.testRounds.length, TEST_ROUNDS);
});

test("sessionResults는 학습·시험·검토 결과와 색깔별 시험 정확도를 함께 담는다", () => {
  const session = createSession(seededRandom(5));
  runFullTraining(session);
  submitReview(session, "노랑");
  startTest(session);
  submitTestBatch(session, session.testRounds.map((sample) => classify(sample)));
  const results = sessionResults(session);
  assert.equal(results.train.correct, TRAIN_ROUNDS);
  assert.equal(results.test.correct, TEST_ROUNDS);
  assert.deepEqual(results.review, { choice: "노랑", correct: false });
  assert.ok(results.testByColor.노랑);
  assert.ok(results.testByColor.주황);
});

test("독립 lesson 페이지와 접근성 장치를 제공한다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /프로젝터 모드/);
  assert.match(html, /id="specimen-visual"/);
  assert.match(html, /role="img"/);
  assert.match(html, /<fieldset>/);
  assert.match(html, /<legend>/);
  assert.match(html, /href="\.\.\/shared\/lab-base\.css"/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

test("시작 안내는 자료를 직접 관찰하게 하고, 미리 '치우쳤다' 또는 '편향'이라고 알려주지 않는다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const missionMatch = html.match(/<div class="intro-copy">\s*<p>([\s\S]*?)<\/p>/);
  assert.ok(missionMatch, "intro-copy 임무 설명 문단을 찾을 수 없음");
  assert.doesNotMatch(missionMatch[1], /치우|편향/);
});

test("학습 후 검토 화면에는 색깔별 개수를 보여주는 분포와 판단 질문이 있다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /id="dist-bars"/);
  assert.match(html, /name="review-choice"/);
  assert.match(html, /value="초록"/);
  assert.match(html, /value="노랑"/);
  assert.match(html, /value="빨강"/);
  assert.match(html, /value="주황"/);
  assert.match(html, /id="review-result"[^>]*hidden/);
});

test("시험 8문제는 한 화면에 렌더링되고, 결과 화면은 개별 정답 없이 전체 점수와 색깔별 정확도표만 보여준다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /id="test-grid"/);
  assert.match(html, /id="test-error"/);
  assert.match(html, /role="alert"/);
  assert.match(js, /submitTestBatch/);
  assert.match(html, /id="color-breakdown-body"/);
  const resultsMatch = html.match(/<div id="results-view"[\s\S]*?<\/div>\s*<\/section>/);
  assert.ok(resultsMatch, "results-view 섹션을 찾을 수 없음");
});

test("결과 화면은 학습 자료 부족과 편향된 데이터를 비난 없이 설명하고 수업 목록으로 돌아가는 링크를 제공한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /학습 자료에 적게 포함된 경우를 AI가 어려워할 수 있습니다/);
  assert.match(html, /편향된 데이터/);
  assert.match(html, /다양하고 고른 학습 자료가 필요/);
  assert.doesNotMatch(html, /점수가 낮|실력이 부족|틀렸습니다, 당신/);
  assert.match(html, /href="\.\.\/\.\.\/"/);
});

test("이전 활동과 수업 목록으로 가는 이동 링크를 제공한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /class="lesson-pager"/);
  assert.match(html, /href="\.\.\/ai-signal-noise\/"/);
});
