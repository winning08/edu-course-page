import assert from "node:assert/strict";
import test from "node:test";
import {
  classify, COLORS, TEXTURES, TRAIN_ROUNDS, TEST_ROUNDS, PHASES,
  makeTrainRounds, makeTestRounds, seededRandom, summarize,
  createSession, currentSample, submitPrediction, advancePhase, startTest, submitTestBatch, sessionResults, restartSession,
  sortByColorAndTexture, CHECKPOINT_ROUNDS, CHECKPOINT_MESSAGES, TRAIN_HINTS, nextHintCount,
} from "../lessons/ai-inference-ripeness/game-core.js";

test("12개 색깔×촉감 조합의 정답 규칙이 정확하다", () => {
  for (const color of COLORS) for (const texture of TEXTURES) {
    const ripe = color === "빨강" || (["노랑", "주황"].includes(color) && texture !== "단단함");
    assert.equal(classify({ color, texture }), ripe ? "잘 익음" : "안 익음");
  }
});

test("샘플에는 색깔과 촉감 두 속성만 존재하고 계절 속성은 없다", () => {
  for (let seed = 1; seed <= 50; seed += 1) {
    const random = seededRandom(seed);
    const trainRounds = makeTrainRounds(random);
    const testRounds = makeTestRounds(random);
    for (const sample of [...trainRounds, ...testRounds]) {
      assert.deepEqual(Object.keys(sample).sort(), ["color", "texture"]);
      assert.equal("season" in sample, false);
    }
  }
});

test("1000개 시드에서 학습 12문제는 색깔×촉감 12개 조합을 정확히 한 번씩 포함한다", () => {
  for (let seed = 1; seed <= 1000; seed += 1) {
    const rounds = makeTrainRounds(seededRandom(seed));
    assert.equal(rounds.length, TRAIN_ROUNDS);
    const seen = new Set(rounds.map((sample) => `${sample.color}-${sample.texture}`));
    assert.equal(seen.size, TRAIN_ROUNDS, `${seed}: 조합 중복 또는 누락`);
    for (const color of COLORS) for (const texture of TEXTURES) {
      assert.ok(seen.has(`${color}-${texture}`), `${seed}: ${color}-${texture} 누락`);
    }
  }
});

test("1000개 시드에서 시험 5문제는 학습과 같은 (색깔·촉감) 속성 공간에서 새 과일 사례로 무작위 생성된다", () => {
  const seenFirstSamples = new Set();
  for (let seed = 1; seed <= 1000; seed += 1) {
    const random = seededRandom(seed);
    makeTrainRounds(random);
    const testRounds = makeTestRounds(random);
    assert.equal(testRounds.length, TEST_ROUNDS);
    for (const sample of testRounds) {
      assert.ok(COLORS.includes(sample.color), `${seed}: 알 수 없는 색깔 ${sample.color}`);
      assert.ok(TEXTURES.includes(sample.texture), `${seed}: 알 수 없는 촉감 ${sample.texture}`);
    }
    seenFirstSamples.add(`${testRounds[0].color}-${testRounds[0].texture}`);
  }
  assert.ok(seenFirstSamples.size > 1, "1000개 시드에서 시험 샘플이 항상 동일하게 고정되어 있음");
});

test("정확도를 계산한다", () => {
  assert.deepEqual(summarize([{ correct: true }, { correct: false }, { correct: true }]), { correct: 2, accuracy: 67 });
  assert.deepEqual(summarize([]), { correct: 0, accuracy: 0 });
});

test("전체 진행은 학습→전환→시험→결과 순서로만 전이된다", () => {
  const random = seededRandom(42);
  const session = createSession(random);
  assert.equal(session.phase, PHASES.TRAIN);

  for (let round = 0; round < TRAIN_ROUNDS; round += 1) {
    assert.equal(session.roundIndex, round);
    const sample = currentSample(session);
    assert.equal("season" in sample, false);
    const outcome = submitPrediction(session, classify(sample));
    assert.deepEqual(outcome, { reveal: true, answer: classify(sample), correct: true });
    advancePhase(session);
  }
  assert.equal(session.phase, PHASES.TRANSITION);
  assert.equal(session.roundIndex, 0);
  assert.equal(session.trainAttempts.length, TRAIN_ROUNDS);

  assert.throws(() => submitPrediction(session, "잘 익음"));
  assert.throws(() => advancePhase(session));

  startTest(session);
  assert.equal(session.phase, PHASES.TEST);

  const answers = session.testRounds.map(() => "잘 익음");
  const outcome = submitTestBatch(session, answers);
  assert.deepEqual(outcome, { reveal: false });
  assert.equal(session.phase, PHASES.RESULTS);
  assert.equal(session.testAttempts.length, TEST_ROUNDS);

  const { train, test: testResult } = sessionResults(session);
  assert.equal(train.correct, TRAIN_ROUNDS);
  assert.equal(train.accuracy, 100);
  assert.equal(testResult.correct + (TEST_ROUNDS - testResult.correct), TEST_ROUNDS);
});

test("학습 12개 완료 후 전환 화면에 필요한 학습 결과 표 데이터가 색깔·촉감·내 판단·정답·정오답을 모두 담고 있다", () => {
  const random = seededRandom(11);
  const session = createSession(random);
  for (let round = 0; round < TRAIN_ROUNDS; round += 1) {
    submitPrediction(session, round % 2 === 0 ? "잘 익음" : "안 익음");
    advancePhase(session);
  }
  assert.equal(session.phase, PHASES.TRANSITION);
  assert.equal(session.trainAttempts.length, TRAIN_ROUNDS);
  session.trainAttempts.forEach((attempt, index) => {
    assert.equal(attempt.round, index + 1);
    assert.ok(COLORS.includes(attempt.color));
    assert.ok(TEXTURES.includes(attempt.texture));
    assert.ok(["잘 익음", "안 익음"].includes(attempt.prediction), "내 판단이 담겨 있어야 함");
    assert.ok(["잘 익음", "안 익음"].includes(attempt.answer), "실제 정답이 담겨 있어야 함");
    assert.equal(typeof attempt.correct, "boolean");
  });
});

test("시험 답안 5개를 한 번에 제출하면 결과 단계로 즉시 전환되고, 응답에는 정답이나 정오답 정보가 전혀 담기지 않는다", () => {
  const random = seededRandom(7);
  const session = createSession(random);
  for (let round = 0; round < TRAIN_ROUNDS; round += 1) {
    submitPrediction(session, "잘 익음");
    advancePhase(session);
  }
  startTest(session);
  const answers = ["잘 익음", "안 익음", "잘 익음", "안 익음", "잘 익음"];
  const outcome = submitTestBatch(session, answers);
  assert.deepEqual(outcome, { reveal: false });
  assert.equal("answer" in outcome, false);
  assert.equal("correct" in outcome, false);
  assert.equal(session.phase, PHASES.RESULTS);
  assert.equal(session.testAttempts.length, TEST_ROUNDS);
  session.testAttempts.forEach((attempt, index) => {
    assert.equal(attempt.prediction, answers[index]);
    assert.ok(["잘 익음", "안 익음"].includes(attempt.answer));
    assert.equal(typeof attempt.correct, "boolean");
  });
});

test("시험 답안 5개 중 하나라도 비어 있으면 제출을 거부하고 첫 미응답 문항 위치를 알려준다", () => {
  const random = seededRandom(21);
  const session = createSession(random);
  for (let round = 0; round < TRAIN_ROUNDS; round += 1) {
    submitPrediction(session, "잘 익음");
    advancePhase(session);
  }
  startTest(session);

  const incomplete = ["잘 익음", "안 익음", null, "안 익음", "잘 익음"];
  assert.throws(() => submitTestBatch(session, incomplete), (error) => {
    assert.equal(error.missingIndex, 2);
    return true;
  });
  assert.equal(session.phase, PHASES.TEST, "미응답 제출은 단계를 전환하지 않는다");
  assert.equal(session.testAttempts.length, 0);

  assert.throws(() => submitTestBatch(session, ["잘 익음", "안 익음"]));
});

test("시험 단계가 아니면 시험 답안을 일괄 제출할 수 없고, 학습 단계가 아니면 개별 예측을 제출할 수 없다", () => {
  const session = createSession(seededRandom(3));
  assert.throws(() => submitTestBatch(session, session.testRounds.map(() => "잘 익음")));

  for (let round = 0; round < TRAIN_ROUNDS; round += 1) {
    submitPrediction(session, "잘 익음");
    advancePhase(session);
  }
  assert.throws(() => submitPrediction(session, "잘 익음"));
  startTest(session);
  assert.throws(() => submitPrediction(session, "잘 익음"));
});

test("전환 화면에서만 시험을 시작할 수 있다", () => {
  const session = createSession(seededRandom(1));
  assert.throws(() => startTest(session));
});

test("재시작하면 학습 단계로 돌아가고 새 학습·시험 샘플과 빈 기록을 받는다", () => {
  const random = seededRandom(99);
  const session = createSession(random);
  for (let round = 0; round < TRAIN_ROUNDS; round += 1) {
    submitPrediction(session, "잘 익음");
    advancePhase(session);
  }
  startTest(session);
  submitTestBatch(session, session.testRounds.map(() => "잘 익음"));
  assert.equal(session.phase, PHASES.RESULTS);

  restartSession(session, seededRandom(100));
  assert.equal(session.phase, PHASES.TRAIN);
  assert.equal(session.roundIndex, 0);
  assert.equal(session.trainAttempts.length, 0);
  assert.equal(session.testAttempts.length, 0);
  assert.equal(session.trainRounds.length, TRAIN_ROUNDS);
  assert.equal(session.testRounds.length, TEST_ROUNDS);
});

test("1000개 시드에서 학습 순서는 같은 색깔이 3개 연속으로 나오지 않는다", () => {
  for (let seed = 1; seed <= 1000; seed += 1) {
    const rounds = makeTrainRounds(seededRandom(seed));
    let run = 1;
    for (let index = 1; index < rounds.length; index += 1) {
      run = rounds[index].color === rounds[index - 1].color ? run + 1 : 1;
      assert.ok(run <= 2, `${seed}: ${index}번째에서 같은 색깔이 3개 이상 연속됨`);
    }
  }
});

test("1000개 시드에서 각 색깔의 두 번째 사례는 첫 사례로부터 3문제 이내에 등장해 바로 비교할 수 있다", () => {
  for (let seed = 1; seed <= 1000; seed += 1) {
    const rounds = makeTrainRounds(seededRandom(seed));
    for (const color of COLORS) {
      const positions = rounds.map((sample, index) => (sample.color === color ? index : -1)).filter((index) => index !== -1);
      assert.equal(positions.length, 3, `${seed}: ${color}은 정확히 3번 등장해야 함`);
      assert.ok(positions[1] - positions[0] <= 3, `${seed}: ${color}의 두 번째 사례가 첫 사례로부터 3문제를 넘어서 등장함`);
    }
  }
});

test("1000개 시드에서 학습 순서는 항상 같은 색깔 순서 블록으로 고정되지 않고 시드에 따라 충분히 달라진다", () => {
  const orderSignatures = new Set();
  const firstColorSeen = new Set();
  for (let seed = 1; seed <= 1000; seed += 1) {
    const rounds = makeTrainRounds(seededRandom(seed));
    orderSignatures.add(rounds.map((sample) => sample.color).join(","));
    firstColorSeen.add(rounds[0].color);
  }
  assert.ok(orderSignatures.size > 50, `색깔 등장 순서 패턴이 ${orderSignatures.size}가지뿐이라 다양성이 부족함`);
  assert.equal(firstColorSeen.size, COLORS.length, "첫 문제 색깔이 특정 색깔로 고정되어 있음");
});

test("1000개 시드에서 색깔별 촉감 등장 순서도 고정되지 않고 시드에 따라 달라진다", () => {
  const textureOrdersByColor = Object.fromEntries(COLORS.map((color) => [color, new Set()]));
  for (let seed = 1; seed <= 1000; seed += 1) {
    const rounds = makeTrainRounds(seededRandom(seed));
    for (const color of COLORS) {
      const textureOrder = rounds.filter((sample) => sample.color === color).map((sample) => sample.texture);
      textureOrdersByColor[color].add(textureOrder.join(","));
    }
  }
  for (const color of COLORS) {
    assert.ok(textureOrdersByColor[color].size > 1, `${color}의 촉감 순서가 항상 고정되어 있음`);
  }
});

test("sortByColorAndTexture는 색깔(초록·노랑·빨강·주황) 순으로 묶고 그룹 안에서는 촉감을 단단함→중간→말랑함 순으로 정렬한다", () => {
  const random = seededRandom(5);
  const session = createSession(random);
  for (let round = 0; round < TRAIN_ROUNDS; round += 1) {
    submitPrediction(session, "잘 익음");
    advancePhase(session);
  }
  const sorted = sortByColorAndTexture(session.trainAttempts);
  assert.equal(sorted.length, TRAIN_ROUNDS);
  assert.deepEqual(sorted.map((a) => a.color), COLORS.flatMap((color) => [color, color, color]));
  for (let index = 0; index < sorted.length; index += 3) {
    assert.deepEqual(sorted.slice(index, index + 3).map((a) => a.texture), TEXTURES);
  }
  assert.deepEqual(new Set(sorted.map((a) => a.round)), new Set(session.trainAttempts.map((a) => a.round)), "정렬 후에도 원래 학습 순서(round) 값은 그대로 보존되어야 함");
});

test("5번째·9번째 체크포인트는 구체적 비교 전략을 안내하고 정답 자체를 밝히지 않는다", () => {
  assert.deepEqual(CHECKPOINT_ROUNDS, [4, 8]);
  for (const round of CHECKPOINT_ROUNDS) {
    const message = CHECKPOINT_MESSAGES[round];
    assert.equal(typeof message, "string");
    assert.match(message, /비교/);
    assert.doesNotMatch(message, /점수|가중치|임계값|3점 이상/);
  }
  assert.match(CHECKPOINT_MESSAGES[4], /같은 색깔/);
  assert.match(CHECKPOINT_MESSAGES[8], /빨강.*초록|초록.*빨강/);
  assert.match(CHECKPOINT_MESSAGES[8], /노랑.*주황|주황.*노랑/);
});

test("힌트 4단계는 순서대로 한 단계씩만 공개되고, 점수 패널티나 부정적 표현이 없다", () => {
  assert.equal(TRAIN_HINTS.length, 4);
  for (const hint of TRAIN_HINTS) {
    assert.equal(typeof hint, "string");
    assert.ok(hint.length > 0);
    assert.doesNotMatch(hint, /감점|패널티|불이익|점수가 깎/);
  }
  let revealed = 0;
  for (let step = 1; step <= TRAIN_HINTS.length; step += 1) {
    revealed = nextHintCount(revealed);
    assert.equal(revealed, step);
  }
  assert.equal(nextHintCount(revealed), TRAIN_HINTS.length, "마지막 단계 이후에는 더 늘어나지 않아야 함");
});
