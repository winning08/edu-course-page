import { seededRandom, shuffle, summarize } from "../shared/random.js";

export { seededRandom, shuffle, summarize };

export const COLORS = ["초록", "노랑", "빨강", "주황"];
export const TEXTURES = ["단단함", "중간", "말랑함"];
export const TRAIN_ROUNDS = 12;
export const TEST_ROUNDS = 5;

const colorScores = { 초록: 0, 노랑: 2, 빨강: 3, 주황: 2 };
const textureScores = { 단단함: 0, 중간: 1, 말랑함: 2 };

export function classify(sample) {
  return colorScores[sample.color] + textureScores[sample.texture] >= 3 ? "잘 익음" : "안 익음";
}

function allCombos() {
  return COLORS.flatMap((color) => TEXTURES.map((texture) => ({ color, texture })));
}

// 학습 12문제의 "색깔 등장 순서"만 만드는 제약 있는 무작위 스케줄러.
// - 같은 색깔이 3개 연속으로 나오지 않는다(직전 두 개가 같은 색이면 그 색은 이번 차례 후보에서 제외).
// - 각 색깔의 두 번째 등장은 첫 등장으로부터 최대 3문제 이내로 강제한다(같은 색·다른 촉감을 금방 비교할 수 있게).
//   그 시점이 오면 다른 후보보다 우선해서 배치한다(항상 유일하게 하나뿐이라 다른 제약과 충돌하지 않는다).
// - 그 외에는 "아직 덜 나온 색깔"을 우선하는 그리디 균형 배치 + 동률은 시드 난수로 무작위 선택한다.
//   이 균형 규칙 덕분에 특정 색깔이 끝까지 밀려서 배치가 막히는 경우가 생기지 않는다(재시도 불필요, 항상 성공).
function scheduleColorOrder(random) {
  const remaining = Object.fromEntries(COLORS.map((color) => [color, 3]));
  const firstSeenAt = {};
  const secondPlaced = Object.fromEntries(COLORS.map((color) => [color, false]));
  const order = [];

  for (let index = 0; index < TRAIN_ROUNDS; index += 1) {
    const runBlocked = order.length >= 2 && order[index - 1] === order[index - 2] ? order[index - 1] : null;
    const candidates = COLORS.filter((color) => remaining[color] > 0 && color !== runBlocked);

    const due = candidates.filter(
      (color) => firstSeenAt[color] !== undefined && !secondPlaced[color] && index === firstSeenAt[color] + 3,
    );

    let pool;
    if (due.length > 0) {
      pool = due;
    } else {
      const maxRemaining = Math.max(...candidates.map((color) => remaining[color]));
      pool = candidates.filter((color) => remaining[color] === maxRemaining);
    }

    const choice = pool[Math.floor(random() * pool.length)];
    order.push(choice);
    remaining[choice] -= 1;
    if (firstSeenAt[choice] === undefined) firstSeenAt[choice] = index;
    else secondPlaced[choice] = true;
  }

  return order;
}

// 학습 12문제: 색깔×촉감 12개 조합을 정확히 한 번씩, 제약 있는 무작위 순서로 보여준다.
// 색깔 순서는 scheduleColorOrder가 정하고(연속 2개까지만 허용, 같은 색 두 번째 등장은 3문제 이내),
// 색깔별 촉감 순서는 독립적으로 섞어(같은 색이라도 시드마다 촉감 순서가 다름) 매 시드마다 실제
// 학습 순서가 충분히 달라지되, 비교에 필요한 최소한의 구조(연속 제한 + 비교 가능 거리)는 유지한다.
export function makeTrainRounds(random = Math.random) {
  const texturesByColor = Object.fromEntries(COLORS.map((color) => [color, shuffle(TEXTURES, random)]));
  const nextTextureIndex = Object.fromEntries(COLORS.map((color) => [color, 0]));
  return scheduleColorOrder(random).map((color) => {
    const texture = texturesByColor[color][nextTextureIndex[color]];
    nextTextureIndex[color] += 1;
    return { color, texture };
  });
}

// 시험 5문제: 학습과 같은 (색깔·촉감) 속성 공간에서, 학습 때와 같은 판단 규칙을 적용해 볼
// 다른 과일 사례를 무작위로 뽑는다.
export function makeTestRounds(random = Math.random) {
  return shuffle(allCombos(), random).slice(0, TEST_ROUNDS);
}

// 학습 결과 표를 색깔별로 묶고, 그룹 안에서는 촉감을 단단함→중간→말랑함 순으로 정렬해
// 패턴을 한눈에 비교할 수 있게 한다. 원래 학습 순서(a.round)는 값이 유지되므로 순서 보기로도 되돌릴 수 있다.
export function sortByColorAndTexture(attempts) {
  const colorIndex = new Map(COLORS.map((color, index) => [color, index]));
  const textureIndex = new Map(TEXTURES.map((texture, index) => [texture, index]));
  return [...attempts].sort((a, b) => {
    const colorDiff = colorIndex.get(a.color) - colorIndex.get(b.color);
    if (colorDiff !== 0) return colorDiff;
    return textureIndex.get(a.texture) - textureIndex.get(b.texture);
  });
}

// 학습 중 5번째·9번째 과일에서 보여줄 구체적 비교 전략. 정답을 직접 말하지 않고
// "무엇을 비교하면 되는지"만 안내한다. 키는 0-based roundIndex.
export const CHECKPOINT_ROUNDS = [4, 8];
export const CHECKPOINT_MESSAGES = {
  4: "지금까지 본 과일 중 같은 색깔인데 촉감이 다른 과일을 찾아 비교해 보세요. 촉감이 달라져도 정답이 그대로인 색깔이 있나요?",
  8: "지금까지 본 색깔을 두 그룹으로 나눠 비교해 보세요. 빨강·초록 그룹과 노랑·주황 그룹은 촉감에 따라 정답이 달라지는 방식이 같은가요, 다른가요?",
};

// 전환 화면의 선택형 힌트 사다리. 학생이 요청할 때 한 단계씩만 공개하고, 사용에 불이익은 없다.
export const TRAIN_HINTS = [
  "같은 색깔끼리 모아서 비교해 보세요.",
  "빨강과 초록은 촉감이 달라져도 정답이 똑같은지 확인해 보세요.",
  "노랑과 주황에서는 단단함과 나머지 촉감(중간·말랑함)을 비교해 보세요.",
  "색깔을 먼저 보고, 노랑·주황일 때만 촉감을 다시 확인해 보세요.",
];

// 힌트를 한 단계 더 공개한다. 이미 마지막 단계면 그대로 유지한다.
export function nextHintCount(current) {
  return Math.min(current + 1, TRAIN_HINTS.length);
}

export const PHASES = { TRAIN: "train", TRANSITION: "transition", TEST: "test", RESULTS: "results" };

export function createSession(random = Math.random) {
  const trainRounds = makeTrainRounds(random);
  const testRounds = makeTestRounds(random);
  return { phase: PHASES.TRAIN, trainRounds, testRounds, roundIndex: 0, trainAttempts: [], testAttempts: [] };
}

export function currentSample(session) {
  return session.trainRounds[session.roundIndex];
}

// 학습 중에는 한 문제씩 정답을 즉시 공개한다. 시험은 submitTestBatch로 5문제를 한 번에 처리한다.
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
    session.phase = PHASES.TRANSITION;
    session.roundIndex = 0;
  } else {
    session.roundIndex += 1;
  }
  return session.phase;
}

export function startTest(session) {
  if (session.phase !== PHASES.TRANSITION) {
    throw new Error(`cannot start the test during phase "${session.phase}"`);
  }
  session.phase = PHASES.TEST;
  session.roundIndex = 0;
}

// 시험 5문제는 한 화면에서 동시에 답을 고르고 한 번에 제출한다. 미응답이 있으면 제출을 거부하고
// 정답을 절대 밖으로 내보내지 않는다(reveal:false만 반환) — 결과 화면에서는 총점만 확인할 수 있다.
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
  return { train: summarize(session.trainAttempts), test: summarize(session.testAttempts) };
}

export function restartSession(session, random = Math.random) {
  Object.assign(session, createSession(random));
  return session;
}
