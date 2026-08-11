import { seededRandom, shuffle, summarize } from "../shared/random.js";

export { seededRandom, shuffle, summarize };

export const COLORS = ["초록", "노랑", "빨강", "주황"];
export const TEXTURES = ["단단함", "중간", "말랑함"];
export const SEASONS = ["여름", "겨울"];
export const TRAIN_ROUNDS = 12;
export const TEST_ROUNDS = 5;

const colorScores = { 초록: 0, 노랑: 2, 빨강: 3, 주황: 2 };
const textureScores = { 단단함: 0, 중간: 1, 말랑함: 2 };

// 활동1과 똑같이 색깔·촉감만으로 정답을 정한다. 계절은 판단에 전혀 쓰이지 않는다.
export function classify(sample) {
  return colorScores[sample.color] + textureScores[sample.texture] >= 3 ? "잘 익음" : "안 익음";
}

// 색깔·촉감이 같고 계절만 다른 비교쌍 6개(익음 3, 안 익음 3)로 학습 12문제를 구성한다.
// 학생이 "같은 조건, 계절만 다름 → 정답도 같음"을 직접 눈으로 비교할 수 있게 하기 위한 의도적 구성이다.
const TRAIN_BASE_PAIRS = [
  { color: "초록", texture: "단단함" },
  { color: "초록", texture: "말랑함" },
  { color: "노랑", texture: "중간" },
  { color: "빨강", texture: "단단함" },
  { color: "주황", texture: "단단함" },
  { color: "주황", texture: "말랑함" },
];

const TEST_SAMPLES = [
  { color: "초록", texture: "중간", season: "여름" },
  { color: "노랑", texture: "단단함", season: "겨울" },
  { color: "노랑", texture: "말랑함", season: "여름" },
  { color: "빨강", texture: "중간", season: "겨울" },
  { color: "주황", texture: "중간", season: "여름" },
];

export function makeTrainRounds(random = Math.random) {
  const rounds = TRAIN_BASE_PAIRS.flatMap((combo) => SEASONS.map((season) => ({ ...combo, season })));
  return shuffle(rounds, random);
}

export function makeTestRounds(random = Math.random) {
  return shuffle(TEST_SAMPLES, random);
}

export const PHASES = { TRAIN: "train", REVIEW: "review", TEST: "test", RESULTS: "results" };
export const REVIEW_OPTIONS = ["색깔", "촉감", "계절"];
const REVIEW_CORRECT_ANSWER = "계절";

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

// 학습 중에는 한 문제씩 정답을 즉시 공개한다.
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

// 학습 12개를 색깔·촉감으로 묶어, 같은 조건에서 계절만 달랐던 비교쌍을 돌려준다.
export function comparisonPairs(session) {
  const groups = new Map();
  for (const attempt of session.trainAttempts) {
    const key = `${attempt.color}-${attempt.texture}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(attempt);
  }
  return [...groups.values()].filter((entries) => entries.length === 2);
}

// 검토 질문: "색깔/촉감/계절 중 판단에 도움이 되지 않은 정보는?" 정답 선택 즉시 해설을 공개한다(형성 평가).
export function submitReview(session, choice) {
  if (session.phase !== PHASES.REVIEW) {
    throw new Error(`cannot submit the review during phase "${session.phase}"`);
  }
  if (!REVIEW_OPTIONS.includes(choice)) {
    throw new Error(`알 수 없는 선택지입니다: ${choice}`);
  }
  session.reviewChoice = choice;
  session.reviewCorrect = choice === REVIEW_CORRECT_ANSWER;
  return { reveal: true, correct: session.reviewCorrect, correctAnswer: REVIEW_CORRECT_ANSWER };
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

// 시험 5문제는 한 화면에서 동시에 답하고 한 번에 제출한다. 정답은 절대 밖으로 내보내지 않는다
// (reveal:false만 반환) — 결과 화면에서는 총점만 확인할 수 있다(총괄 평가).
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

export function sessionResults(session) {
  return {
    train: summarize(session.trainAttempts),
    test: summarize(session.testAttempts),
    review: { choice: session.reviewChoice, correct: session.reviewCorrect },
  };
}

export function restartSession(session, random = Math.random) {
  Object.assign(session, createSession(random));
  return session;
}
