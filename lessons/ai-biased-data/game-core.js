import { seededRandom, shuffle, summarize } from "../shared/random.js";

export { seededRandom, shuffle, summarize };

export const COLORS = ["초록", "노랑", "빨강", "주황"];
export const TEXTURES = ["단단함", "중간", "말랑함"];
export const TRAIN_ROUNDS = 12;
export const TEST_ROUNDS = 8;

const colorScores = { 초록: 0, 노랑: 2, 빨강: 3, 주황: 2 };
const textureScores = { 단단함: 0, 중간: 1, 말랑함: 2 };

// 활동1·2와 동일한 규칙: 색깔+촉감으로만 정답을 정한다.
export function classify(sample) {
  return colorScores[sample.color] + textureScores[sample.texture] >= 3 ? "잘 익음" : "안 익음";
}

// 의도적으로 치우친 학습 자료: 초록 5개·빨강 4개·노랑 2개·주황 1개.
// 초록·빨강은 촉감이 달라도 항상 같은 정답이 나오는 색깔이라, 이 구성만 보면
// "색깔만 봐도 된다"는 규칙이 그럴듯해 보인다. 반면 노랑·주황은 촉감에 따라
// 정답이 갈리는데도 각각 2개·1개만 등장해 그 특징을 충분히 보여주지 못한다.
const TRAIN_COMPOSITION = [
  { color: "초록", texture: "단단함" },
  { color: "초록", texture: "단단함" },
  { color: "초록", texture: "중간" },
  { color: "초록", texture: "중간" },
  { color: "초록", texture: "말랑함" },
  { color: "빨강", texture: "단단함" },
  { color: "빨강", texture: "단단함" },
  { color: "빨강", texture: "중간" },
  { color: "빨강", texture: "말랑함" },
  { color: "노랑", texture: "단단함" },
  { color: "노랑", texture: "중간" },
  { color: "주황", texture: "단단함" },
];

// 균형 잡힌 시험 자료: 노랑·주황은 세 촉감을 모두 포함해, 학습 자료만 보고
// 만든 단순한 규칙이 통하는지 정면으로 검증한다. 빨강·초록도 하나씩 포함한다.
const TEST_COMPOSITION = [
  { color: "노랑", texture: "단단함" },
  { color: "노랑", texture: "중간" },
  { color: "노랑", texture: "말랑함" },
  { color: "주황", texture: "단단함" },
  { color: "주황", texture: "중간" },
  { color: "주황", texture: "말랑함" },
  { color: "빨강", texture: "중간" },
  { color: "초록", texture: "중간" },
];

export function makeTrainRounds(random = Math.random) {
  return shuffle(TRAIN_COMPOSITION, random);
}

export function makeTestRounds(random = Math.random) {
  return shuffle(TEST_COMPOSITION, random);
}

export const PHASES = { TRAIN: "train", REVIEW: "review", TEST: "test", RESULTS: "results" };

export function createSession(random = Math.random) {
  const trainRounds = makeTrainRounds(random);
  const testRounds = makeTestRounds(random);
  return {
    phase: PHASES.TRAIN, trainRounds, testRounds, roundIndex: 0,
    trainAttempts: [], reviewChoice: null, reviewCorrect: null, testAttempts: [],
  };
}

export function currentSample(session) {
  return session.trainRounds[session.roundIndex];
}

export function submitPrediction(session, prediction) {
  if (session.phase !== PHASES.TRAIN) {
    throw new Error(`cannot submit a prediction during phase "${session.phase}"`);
  }
  const sample = currentSample(session);
  const answer = classify(sample);
  const correct = prediction === answer;
  const attempt = { ...sample, round: session.roundIndex + 1, prediction, answer, correct };
  session.trainAttempts.push(attempt);
  return { reveal: true, answer, correct };
}

export function advancePhase(session) {
  if (session.phase !== PHASES.TRAIN) {
    throw new Error(`cannot advance during phase "${session.phase}"`);
  }
  if (session.roundIndex >= TRAIN_ROUNDS - 1) {
    session.phase = PHASES.REVIEW;
    session.roundIndex = 0;
  } else {
    session.roundIndex += 1;
  }
  return session.phase;
}

// 학습 과일 12개를 색깔별로 세어, 어떤 색이 많고 적었는지 학생이 눈으로 볼 수 있게 한다.
export function distribution(session) {
  const counts = Object.fromEntries(COLORS.map((color) => [color, 0]));
  for (const attempt of session.trainAttempts) counts[attempt.color] += 1;
  return counts;
}

// 검토 질문: "학습 자료에서 가장 적게 등장한 색깔은?" 정답은 분포에서 직접 계산한다.
export function submitReview(session, choice) {
  if (session.phase !== PHASES.REVIEW) {
    throw new Error(`cannot submit the review during phase "${session.phase}"`);
  }
  if (!COLORS.includes(choice)) {
    throw new Error(`알 수 없는 선택지입니다: ${choice}`);
  }
  const counts = distribution(session);
  const minCount = Math.min(...COLORS.map((color) => counts[color]));
  const correctAnswer = COLORS.find((color) => counts[color] === minCount);
  session.reviewChoice = choice;
  session.reviewCorrect = choice === correctAnswer;
  return { reveal: true, correct: session.reviewCorrect, correctAnswer };
}

export function startTest(session) {
  if (session.phase !== PHASES.REVIEW) {
    throw new Error(`cannot start the test during phase "${session.phase}"`);
  }
  if (session.reviewChoice === null) {
    throw new Error("판단 질문에 먼저 답해야 시험을 시작할 수 있습니다");
  }
  session.phase = PHASES.TEST;
  session.roundIndex = 0;
}

// 시험 8문제는 한 화면에서 동시에 답하고 한 번에 제출한다. 정답은 절대 밖으로 내보내지 않는다
// (reveal:false만 반환) — 결과 화면에서는 전체 점수와 색깔별 점수만 확인할 수 있다.
export function submitTestBatch(session, answers) {
  if (session.phase !== PHASES.TEST) {
    throw new Error(`cannot submit the test during phase "${session.phase}"`);
  }
  if (!Array.isArray(answers) || answers.length !== TEST_ROUNDS) {
    throw new Error(`시험 답안은 ${TEST_ROUNDS}개를 한 번에 제출해야 합니다`);
  }
  const missingIndex = answers.findIndex((answer) => answer !== "잘 익음" && answer !== "안 익음");
  if (missingIndex !== -1) {
    const error = new Error("모든 시험 문항에 답해야 제출할 수 있습니다");
    error.missingIndex = missingIndex;
    throw error;
  }
  session.testAttempts = session.testRounds.map((sample, index) => {
    const answer = classify(sample);
    const prediction = answers[index];
    return { ...sample, round: index + 1, prediction, answer, correct: prediction === answer };
  });
  session.phase = PHASES.RESULTS;
  return { reveal: false };
}

export function testByColor(session) {
  const byColor = {};
  for (const color of COLORS) {
    const attempts = session.testAttempts.filter((attempt) => attempt.color === color);
    if (attempts.length) byColor[color] = { ...summarize(attempts), total: attempts.length };
  }
  return byColor;
}

export function sessionResults(session) {
  return {
    train: summarize(session.trainAttempts),
    test: summarize(session.testAttempts),
    review: { choice: session.reviewChoice, correct: session.reviewCorrect },
    testByColor: testByColor(session),
  };
}

export function restartSession(session, random = Math.random) {
  Object.assign(session, createSession(random));
  return session;
}
