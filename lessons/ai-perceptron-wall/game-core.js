import { summarize } from "../shared/random.js";

export { summarize };

// 1단계(퍼셉트론)에서 쓰는 좌표평면 위 점들. 이진 진리표가 아니라 그냥 흩어진 점들이다.
// 같은 y=0.6에 참(0.6,0.6)과 거짓(0.1,0.6) 점이 함께 있어 수평선(기울기 0)으로는 절대 못 가르고,
// 대각선(기울기와 y절편을 함께 조정한 선)으로만 완전히 갈릴 수 있도록 배치했다.
export const STAGE1_POINTS = [
  { x: 0.75, y: 0.5, label: true },
  { x: 0.6, y: 0.6, label: true },
  { x: 0.5, y: 0.75, label: true },
  { x: 0.65, y: 0.45, label: true },
  { x: 0.2, y: 0.3, label: false },
  { x: 0.1, y: 0.6, label: false },
  { x: 0.35, y: 0.2, label: false },
  { x: 0.15, y: 0.15, label: false },
];

// 2·4단계(퍼셉트론의 한계 / 여러 경계와 학습)에서 쓰는 점들. 참(파란 점)은 대각선 띠 안에,
// 거짓(빨간 점)은 그 띠의 양쪽 바깥(왼쪽 아래·오른쪽 위)에 흩어져 있다. 거짓이 참을 사이에 두고
// 양쪽에 있으므로 직선 하나(반평면 하나)로는 어떤 각도·위치를 잡아도 절대 완전히 못 가른다
// 전형적인 XOR처럼 선형 분리가 불가능한 성질을 보여주지만, 이 점 배치 자체가 표준 XOR 진리표는 아니다.
// 직선 두 개로 만든 띠(아래쪽 경계 위 AND 위쪽 경계 아래)로는 완전히 풀린다.
export const CHECKER_POINTS = [
  { x: 0.5, y: 0.5, label: true },
  { x: 0.4, y: 0.6, label: true },
  { x: 0.6, y: 0.4, label: true },
  { x: 0.55, y: 0.65, label: true },
  { x: 0.45, y: 0.55, label: true },
  { x: 0.65, y: 0.55, label: true },
  { x: 0.35, y: 0.65, label: true },
  { x: 0.1, y: 0.15, label: false },
  { x: 0.2, y: 0.3, label: false },
  { x: 0.05, y: 0.35, label: false },
  { x: 0.3, y: 0.15, label: false },
  { x: 0.85, y: 0.9, label: false },
  { x: 0.9, y: 0.75, label: false },
  { x: 0.95, y: 0.8, label: false },
  { x: 0.75, y: 0.95, label: false },
];

export const SLOPE_MIN = -3;
export const SLOPE_MAX = 3;
export const INTERCEPT_MIN = -1;
export const INTERCEPT_MAX = 2;

// 직선은 중학교 수학과 같은 기울기(slope)·y절편(intercept) 형태 y=mx+b로 정의된다.
// 점이 이 직선보다 위(y > mx+b)에 있으면 "통과"로 분류한다.
export function classifyPoint(line, point) {
  return point.y > line.slope * point.x + line.intercept;
}

export function scorePoints(points, line) {
  const perPoint = points.map((point) => {
    const predicted = classifyPoint(line, point);
    return { ...point, predicted, correct: point.label === predicted };
  });
  const correct = perPoint.filter((p) => p.correct).length;
  return { correct, total: points.length, accuracy: Math.round((correct / points.length) * 100), perPoint };
}

// 여러 경계 단계: 직선 A(아래쪽 경계)보다 위에 있으면서 동시에 직선 B(위쪽 경계)보다 아래에 있는
// 점만 통과로 분류한다. 즉 두 직선 사이의 띠만 통과가 된다.
export function classifyTwoLines(lineA, lineB, point) {
  const aboveA = classifyPoint(lineA, point);
  const belowB = point.y < lineB.slope * point.x + lineB.intercept;
  return aboveA && belowB;
}

export function scoreTwoLinesPoints(points, lineA, lineB) {
  const perPoint = points.map((point) => {
    const predicted = classifyTwoLines(lineA, lineB, point);
    return { ...point, predicted, correct: point.label === predicted };
  });
  const correct = perPoint.filter((p) => p.correct).length;
  return { correct, total: points.length, accuracy: Math.round((correct / points.length) * 100), perPoint };
}

// "AI가 자동으로 찾기" 기능이 쓰는 값들. 항상 이 고정된 시작점에서 출발해야 실패 없이 수렴한다
// (임의의 시작점에서는 국소최적점에 갇혀 만점에 못 이를 수 있음을 실험으로 확인했다).
export const AUTO_FIND_START_A = { slope: 0, intercept: 0.3 };
export const AUTO_FIND_START_B = { slope: 0, intercept: 0.7 };
const GRADIENT_MARGIN = 0.1;
const GRADIENT_STEP_EPS = 0.005;
const GRADIENT_LEARNING_RATE = 0.05;
const GRADIENT_MAX_STEPS = 80;

// 두 직선 사이의 여유(margin)를 하나의 연속값으로 나타낸다. 참인 점은 이 값이 클수록,
// 거짓인 점은 작을수록(음수일수록) 좋다. classifyTwoLines의 판정 기준과 정확히 일치한다.
function bandMargin(lineA, lineB, point) {
  const aboveA = point.y - (lineA.slope * point.x + lineA.intercept);
  const belowB = (lineB.slope * point.x + lineB.intercept) - point.y;
  return Math.min(aboveA, belowB);
}

// 오차(손실): 마진 안쪽까지 제대로 못 들어온 점마다 벌점을 매겨 더한다. 0이면 모든 점이
// 여유를 두고 완전히 분류된 상태다. 이 값을 줄이는 방향으로 두 직선을 움직이는 것이 학습이다.
function bandLoss(points, lineA, lineB) {
  let total = 0;
  for (const point of points) {
    const target = point.label ? 1 : -1;
    total += Math.max(0, GRADIENT_MARGIN - target * bandMargin(lineA, lineB, point));
  }
  return total;
}

function clip(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// 이 자동 찾기는 오차의 기울기(gradient)를 수치적으로 계산해 반대 방향으로 이동하는 경사하강
// 과정이다. 실제 역전파를 구현한 것은 아니다. 역전파는 여러 층으로 이루어진 신경망에서 각
// 파라미터의 기울기를 연쇄법칙으로 효율적으로 계산해 이러한 경사하강을 가능하게 하는 방법이다.
export function findBandAutomatically(points, startA = AUTO_FIND_START_A, startB = AUTO_FIND_START_B) {
  let lineA = { ...startA };
  let lineB = { ...startB };
  const path = [{ lineA, lineB, score: scoreTwoLinesPoints(points, lineA, lineB) }];
  for (let step = 0; step < GRADIENT_MAX_STEPS; step += 1) {
    if (path[path.length - 1].score.correct === points.length) break;
    const base = bandLoss(points, lineA, lineB);
    const gradA = { slope: 0, intercept: 0 };
    const gradB = { slope: 0, intercept: 0 };
    for (const key of ["slope", "intercept"]) {
      gradA[key] = (bandLoss(points, { ...lineA, [key]: lineA[key] + GRADIENT_STEP_EPS }, lineB) - base) / GRADIENT_STEP_EPS;
      gradB[key] = (bandLoss(points, lineA, { ...lineB, [key]: lineB[key] + GRADIENT_STEP_EPS }) - base) / GRADIENT_STEP_EPS;
    }
    lineA = {
      slope: clip(lineA.slope - GRADIENT_LEARNING_RATE * gradA.slope, SLOPE_MIN, SLOPE_MAX),
      intercept: clip(lineA.intercept - GRADIENT_LEARNING_RATE * gradA.intercept, INTERCEPT_MIN, INTERCEPT_MAX),
    };
    lineB = {
      slope: clip(lineB.slope - GRADIENT_LEARNING_RATE * gradB.slope, SLOPE_MIN, SLOPE_MAX),
      intercept: clip(lineB.intercept - GRADIENT_LEARNING_RATE * gradB.intercept, INTERCEPT_MIN, INTERCEPT_MAX),
    };
    path.push({ lineA, lineB, score: scoreTwoLinesPoints(points, lineA, lineB) });
  }
  return path;
}

// 1972년 마이신을 본뜬 규칙 기반 진단 활동. 규칙에 명시된 항목만 검사하고(나머지는 무관), 순서대로 첫 매칭 규칙을 쓴다.
// treatment는 학생에게 버튼으로 보여줄 "처방"이고, result는 해설에 쓰는 진단명을 포함한 전체 문구다.
export const RULES = [
  { id: "R1", label: "규칙 1", when: { 열: "높음", 기침: "있음" }, treatment: "해열제 + 기침약", result: "독감 의심 · 해열제 + 기침약" },
  { id: "R2", label: "규칙 2", when: { 열: "정상", 콧물: "있음" }, treatment: "콧물약", result: "가벼운 감기 · 콧물약" },
  { id: "R3", label: "규칙 3", when: { 열: "높음", 기침: "없음", 콧물: "없음" }, treatment: "해열제", result: "단순 발열 · 해열제" },
  { id: "R4", label: "규칙 4", when: { 열: "정상", 기침: "없음", 콧물: "없음" }, treatment: "처방 없음", result: "이상 없음 · 처방 없음" },
];

export function matchRule(rules, patient) {
  return rules.find((rule) => Object.entries(rule.when).every(([key, value]) => patient[key] === value)) ?? null;
}

// 6개 사례 중 4·6번째는 규칙 4개 중 어느 것과도 맞지 않는 "벽"이다(matchRule로 직접 검증됨).
export const MYCIN_CASES = [
  { id: 1, 열: "높음", 기침: "있음", 콧물: "있음" },
  { id: 2, 열: "정상", 기침: "있음", 콧물: "있음" },
  { id: 3, 열: "높음", 기침: "없음", 콧물: "없음" },
  { id: 4, 열: "높음", 기침: "없음", 콧물: "있음" },
  { id: 5, 열: "정상", 기침: "없음", 콧물: "없음" },
  { id: 6, 열: "정상", 기침: "있음", 콧물: "없음" },
];

export const PHASES = {
  PERCEPTRON: "perceptron",
  XOR: "xor",
  MYCIN: "mycin",
  BREAKTHROUGH: "breakthrough",
  RESULTS: "results",
};

export function createSession() {
  return {
    phase: PHASES.PERCEPTRON,
    perceptron: { line: { slope: 0, intercept: 0.5 }, best: 0 },
    xor: { line: { slope: 0, intercept: 0.5 }, best: 0, interactions: 0 },
    mycin: { index: 0, attempts: [] },
    breakthrough: { lineA: { slope: 0, intercept: 0.3 }, lineB: { slope: 0, intercept: 0.7 }, best: 0 },
  };
}

export function updatePerceptronLine(session, line) {
  session.perceptron.line = line;
  const score = scorePoints(STAGE1_POINTS, line);
  session.perceptron.best = Math.max(session.perceptron.best, score.correct);
  return score;
}

export function advanceFromPerceptron(session) {
  if (session.perceptron.best < STAGE1_POINTS.length) {
    throw new Error(`퍼셉트론 문제를 ${STAGE1_POINTS.length}/${STAGE1_POINTS.length}로 풀어야 다음 단계로 갈 수 있습니다`);
  }
  session.phase = PHASES.XOR;
}

export function updateXorLine(session, line) {
  session.xor.line = line;
  session.xor.interactions += 1;
  const score = scorePoints(CHECKER_POINTS, line);
  session.xor.best = Math.max(session.xor.best, score.correct);
  return score;
}

export function advanceFromXor(session) {
  session.phase = PHASES.MYCIN;
}

export function currentMycinCase(session) {
  return MYCIN_CASES[session.mycin.index];
}

export function submitMycinAnswer(session, choiceId) {
  const patient = currentMycinCase(session);
  const matched = matchRule(RULES, patient);
  const expectedId = matched ? matched.id : "NONE";
  const correct = choiceId === expectedId;
  const attempt = { caseId: patient.id, choiceId, expectedId, correct, resultText: matched ? matched.result : null };
  session.mycin.attempts.push(attempt);
  return attempt;
}

// 다음 사례로 이동했으면 true, 이미 마지막 사례였다면(더 이동할 곳이 없으면) false를 반환한다.
export function advanceMycinCase(session) {
  if (session.mycin.index < MYCIN_CASES.length - 1) {
    session.mycin.index += 1;
    return true;
  }
  return false;
}

export function advanceFromMycin(session) {
  if (session.mycin.attempts.length < MYCIN_CASES.length) {
    throw new Error("모든 사례에 답해야 다음 단계로 갈 수 있습니다");
  }
  session.phase = PHASES.BREAKTHROUGH;
}

export function updateBreakthroughLines(session, lineA, lineB) {
  session.breakthrough.lineA = lineA;
  session.breakthrough.lineB = lineB;
  const score = scoreTwoLinesPoints(CHECKER_POINTS, lineA, lineB);
  session.breakthrough.best = Math.max(session.breakthrough.best, score.correct);
  return score;
}

export function advanceFromBreakthrough(session) {
  if (session.breakthrough.best < CHECKER_POINTS.length) {
    throw new Error(`두 직선으로 ${CHECKER_POINTS.length}/${CHECKER_POINTS.length}를 풀어야 결과를 볼 수 있습니다`);
  }
  session.phase = PHASES.RESULTS;
}

export function sessionResults(session) {
  const mycinSummary = summarize(session.mycin.attempts);
  const wallCount = session.mycin.attempts.filter((a) => a.expectedId === "NONE").length;
  return {
    perceptronBest: session.perceptron.best,
    xorBest: session.xor.best,
    mycin: { ...mycinSummary, total: session.mycin.attempts.length, wallCount },
    breakthroughBest: session.breakthrough.best,
  };
}

export function restartSession(session) {
  Object.assign(session, createSession());
  return session;
}
