import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  classify, COLORS, TEXTURES, SEASONS, TRAIN_ROUNDS, TEST_ROUNDS, PHASES, REVIEW_OPTIONS,
  makeTrainRounds, makeTestRounds, seededRandom,
  createSession, currentSample, submitPrediction, advancePhase, comparisonPairs,
  submitReview, startTest, submitTestBatch, sessionResults, restartSession,
} from "../lessons/ai-signal-noise/game-core.js";

const lessonRoot = new URL("../lessons/ai-signal-noise/", import.meta.url);

function runFullTraining(session, predictionFn = (sample) => classify(sample)) {
  for (let round = 0; round < TRAIN_ROUNDS; round += 1) {
    submitPrediction(session, predictionFn(currentSample(session)));
    advancePhase(session);
  }
}

test("정답 규칙은 색깔·촉감으로만 정해지고 계절은 결과에 영향을 주지 않는다", () => {
  for (const color of COLORS) {
    for (const texture of TEXTURES) {
      const withoutSeason = classify({ color, texture });
      for (const season of SEASONS) {
        assert.equal(classify({ color, texture, season }), withoutSeason);
      }
    }
  }
});

test("1000개 시드에서 학습 12문제는 색깔·촉감이 같고 계절만 다른 비교쌍 6개로 정확히 구성된다", () => {
  for (let seed = 1; seed <= 1000; seed += 1) {
    const random = seededRandom(seed);
    const rounds = makeTrainRounds(random);
    assert.equal(rounds.length, TRAIN_ROUNDS);
    const groups = new Map();
    for (const sample of rounds) {
      assert.ok(SEASONS.includes(sample.season), `${seed}: 알 수 없는 계절 ${sample.season}`);
      const key = `${sample.color}-${sample.texture}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(sample);
    }
    assert.equal(groups.size, 6, `${seed}: 비교쌍이 6개가 아님`);
    for (const [key, entries] of groups) {
      assert.equal(entries.length, 2, `${seed}: ${key} 쌍이 2개가 아님`);
      const seasons = entries.map((entry) => entry.season).sort();
      assert.deepEqual(seasons, [...SEASONS].sort(), `${seed}: ${key} 쌍의 계절이 서로 달라야 함`);
      assert.equal(classify(entries[0]), classify(entries[1]), `${seed}: ${key} 쌍은 계절이 달라도 정답이 같아야 함`);
    }
  }
});

test("학습 6개 비교쌍은 잘 익음 3개·안 익음 3개로 균형 잡혀 있다", () => {
  const rounds = makeTrainRounds(seededRandom(1));
  const answers = new Map();
  for (const sample of rounds) answers.set(`${sample.color}-${sample.texture}`, classify(sample));
  const values = [...answers.values()];
  assert.equal(values.filter((answer) => answer === "잘 익음").length, 3);
  assert.equal(values.filter((answer) => answer === "안 익음").length, 3);
});

test("1000개 시드에서 시험 5문제는 색깔·촉감·계절 값이 모두 유효하다", () => {
  for (let seed = 1; seed <= 1000; seed += 1) {
    const rounds = makeTestRounds(seededRandom(seed));
    assert.equal(rounds.length, TEST_ROUNDS);
    for (const sample of rounds) {
      assert.ok(COLORS.includes(sample.color));
      assert.ok(TEXTURES.includes(sample.texture));
      assert.ok(SEASONS.includes(sample.season));
    }
  }
});

test("전체 진행은 학습→검토→시험→결과 순서로만 전이된다", () => {
  const session = createSession(seededRandom(42));
  assert.equal(session.phase, PHASES.TRAIN);
  runFullTraining(session);
  assert.equal(session.phase, PHASES.REVIEW);
  assert.equal(session.roundIndex, 0);
  assert.equal(session.trainAttempts.length, TRAIN_ROUNDS);

  assert.throws(() => submitPrediction(session, "잘 익음"));
  assert.throws(() => advancePhase(session));
  assert.throws(() => submitTestBatch(session, session.testRounds.map(() => "잘 익음")), "검토 전에는 시험을 제출할 수 없다");
  assert.throws(() => startTest(session), "검토 질문에 답하기 전에는 시험을 시작할 수 없다");

  const reviewOutcome = submitReview(session, "계절");
  assert.deepEqual(reviewOutcome, { reveal: true, correct: true, correctAnswer: "계절" });

  startTest(session);
  assert.equal(session.phase, PHASES.TEST);

  const testOutcome = submitTestBatch(session, session.testRounds.map(() => "잘 익음"));
  assert.deepEqual(testOutcome, { reveal: false });
  assert.equal(session.phase, PHASES.RESULTS);
  assert.equal(session.testAttempts.length, TEST_ROUNDS);
});

test("검토 질문은 REVIEW 단계에서만, 정해진 선택지로만 제출할 수 있다", () => {
  const session = createSession(seededRandom(2));
  assert.throws(() => submitReview(session, "계절"), "학습 단계에서는 검토 질문을 제출할 수 없다");
  runFullTraining(session);
  assert.throws(() => submitReview(session, "무게"), "알 수 없는 선택지는 거부한다");
  assert.deepEqual([...REVIEW_OPTIONS].sort(), ["계절", "색깔", "촉감"].sort());

  const wrong = submitReview(session, "색깔");
  assert.deepEqual(wrong, { reveal: true, correct: false, correctAnswer: "계절" });
  assert.equal(session.reviewChoice, "색깔");
  assert.equal(session.reviewCorrect, false);
});

test("학습 12개 완료 후 색깔·촉감이 같은 비교쌍을 만들 수 있고, 두 항목의 정답이 같다", () => {
  const session = createSession(seededRandom(11));
  runFullTraining(session);
  const pairs = comparisonPairs(session);
  assert.equal(pairs.length, 6);
  for (const pair of pairs) {
    assert.equal(pair.length, 2);
    assert.equal(pair[0].color, pair[1].color);
    assert.equal(pair[0].texture, pair[1].texture);
    assert.notEqual(pair[0].season, pair[1].season);
    assert.equal(pair[0].answer, pair[1].answer);
  }
});

test("시험 답안 5개를 한 번에 제출하면 결과 단계로 전환되고 정답·정오답 정보가 응답에 담기지 않는다", () => {
  const session = createSession(seededRandom(7));
  runFullTraining(session);
  submitReview(session, "계절");
  startTest(session);
  const answers = ["잘 익음", "안 익음", "잘 익음", "안 익음", "잘 익음"];
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
  submitReview(session, "계절");
  startTest(session);
  const incomplete = ["잘 익음", "안 익음", null, "안 익음", "잘 익음"];
  assert.throws(() => submitTestBatch(session, incomplete), (error) => {
    assert.equal(error.missingIndex, 2);
    return true;
  });
  assert.equal(session.phase, PHASES.TEST);
  assert.equal(session.testAttempts.length, 0);
});

test("재시작하면 학습 단계로 돌아가고 검토·시험 상태가 모두 초기화된다", () => {
  const session = createSession(seededRandom(99));
  runFullTraining(session);
  submitReview(session, "계절");
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

test("sessionResults는 학습·시험 점수와 검토 결과를 함께 담는다", () => {
  const session = createSession(seededRandom(5));
  runFullTraining(session);
  submitReview(session, "촉감");
  startTest(session);
  submitTestBatch(session, session.testRounds.map((sample) => classify(sample)));
  const results = sessionResults(session);
  assert.equal(results.train.correct, TRAIN_ROUNDS);
  assert.equal(results.test.correct, TEST_ROUNDS);
  assert.deepEqual(results.review, { choice: "촉감", correct: false });
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

test("시작 안내에는 계절 정보가 판단에 도움이 되는지 확인한다고만 나오고, 계절이 무관하다는 정답은 미리 밝히지 않는다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const introMatch = html.match(/<section class="intro"[\s\S]*?<\/section>/);
  assert.ok(introMatch, "intro 섹션을 찾을 수 없음");
  const intro = introMatch[0];
  assert.match(intro, /계절/);
  assert.doesNotMatch(intro, /관계없|도움이 되지 않|필요 없|노이즈/);
});

test("학습 후 검토 화면에는 전체 결과표와 판단 질문이 있고, 정답은 선택 제출 전에 노출되지 않는다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const reviewMatch = html.match(/<div id="review-view"[\s\S]*?id="start-test-button"[\s\S]*?<\/button>\s*<\/div>/);
  assert.ok(reviewMatch, "review-view 섹션을 찾을 수 없음");
  const reviewHtml = reviewMatch[0];
  assert.match(reviewHtml, /id="review-summary-body"/);
  assert.match(reviewHtml, /name="review-choice"/);
  assert.match(reviewHtml, /value="색깔"/);
  assert.match(reviewHtml, /value="촉감"/);
  assert.match(reviewHtml, /value="계절"/);
  assert.match(reviewHtml, /id="review-result"[^>]*hidden/);
});

test("시험 5문제는 한 화면에 렌더링되고 결과 화면은 개별 정답 없이 전체 점수만 보여준다", async () => {
  const [html, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /id="test-grid"/);
  assert.match(html, /id="test-error"/);
  assert.match(html, /role="alert"/);
  assert.match(js, /submitTestBatch/);
  const resultsMatch = html.match(/<div id="results-view"[\s\S]*?<\/div>\s*<\/section>/);
  assert.ok(resultsMatch, "results-view 섹션을 찾을 수 없음");
  assert.doesNotMatch(resultsMatch[0], /class="result/);
});

test("결과 화면은 정보가 많다고 항상 좋은 것은 아니라는 정리와 다음 활동 링크를 제공한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /정보가 많다고 항상 더 좋은 것은 아닙니다/);
  assert.match(html, /노이즈/);
  assert.match(html, /href="\.\.\/ai-biased-data\/"/);
});

test("이전·다음 활동과 수업 목록으로 가는 이동 링크를 제공한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /class="lesson-pager"/);
  assert.match(html, /href="\.\.\/ai-inference-ripeness\/"/);
  assert.match(html, /href="\.\.\/ai-biased-data\/"/);
});
