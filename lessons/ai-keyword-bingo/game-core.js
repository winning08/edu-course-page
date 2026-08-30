import { KEYWORDS } from "./keywords.js";

export const TOTAL_KEYWORDS = KEYWORDS.length;
export const PHASES = { PREP: "prep", DRAW: "draw" };

export function createSession() {
  return { phase: PHASES.PREP, checkedTerms: [], drawOrder: [] };
}

export function remainingTerms(session) {
  const drawn = new Set(session.drawOrder);
  return KEYWORDS.filter((term) => !drawn.has(term));
}

export function toggleChecked(session, term) {
  if (!KEYWORDS.includes(term)) throw new Error(`알 수 없는 용어입니다: ${term}`);
  const index = session.checkedTerms.indexOf(term);
  if (index === -1) session.checkedTerms.push(term);
  else session.checkedTerms.splice(index, 1);
  return session.checkedTerms.length;
}

export function startDraw(session) {
  session.phase = PHASES.DRAW;
}

export function drawNext(session, random = Math.random) {
  if (session.phase !== PHASES.DRAW) throw new Error("추첨 단계에서만 다음 용어를 뽑을 수 있습니다.");
  const remaining = remainingTerms(session);
  if (remaining.length === 0) throw new Error("이미 25개 용어를 모두 뽑았습니다.");
  const index = Math.floor(random() * remaining.length);
  const term = remaining[index];
  session.drawOrder.push(term);
  return term;
}

// "다음 뽑기"의 무작위 추첨 대신, 화면에 흩뿌려진 용어 칩을 교사가 직접 클릭해서 그 용어를 뽑은 것으로
// 기록할 때 쓴다(예: 학생이 먼저 외쳤거나 교사가 순서를 직접 정하고 싶을 때). 이미 뽑힌 용어는 다시 뽑을 수 없다.
export function drawSpecific(session, term) {
  if (session.phase !== PHASES.DRAW) throw new Error("추첨 단계에서만 용어를 뽑을 수 있습니다.");
  if (!KEYWORDS.includes(term)) throw new Error(`알 수 없는 용어입니다: ${term}`);
  if (session.drawOrder.includes(term)) throw new Error(`이미 뽑힌 용어입니다: ${term}`);
  session.drawOrder.push(term);
  return term;
}

export function undoLastDraw(session) {
  if (session.drawOrder.length === 0) return null;
  return session.drawOrder.pop();
}

export function resetDraw(session) {
  session.drawOrder = [];
}

export function currentTerm(session) {
  return session.drawOrder.length ? session.drawOrder[session.drawOrder.length - 1] : null;
}

export function isDrawComplete(session) {
  return session.drawOrder.length === TOTAL_KEYWORDS;
}

export function serializeSession(session) {
  return JSON.stringify({ phase: session.phase, checkedTerms: session.checkedTerms, drawOrder: session.drawOrder });
}

export function deserializeSession(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.phase !== PHASES.PREP && parsed.phase !== PHASES.DRAW) return null;
  if (!Array.isArray(parsed.checkedTerms) || !Array.isArray(parsed.drawOrder)) return null;

  const validSet = new Set(KEYWORDS);
  if (!parsed.checkedTerms.every((term) => typeof term === "string" && validSet.has(term))) return null;
  if (!parsed.drawOrder.every((term) => typeof term === "string" && validSet.has(term))) return null;
  if (new Set(parsed.checkedTerms).size !== parsed.checkedTerms.length) return null;
  if (new Set(parsed.drawOrder).size !== parsed.drawOrder.length) return null;
  if (parsed.drawOrder.length > TOTAL_KEYWORDS) return null;

  return { phase: parsed.phase, checkedTerms: [...parsed.checkedTerms], drawOrder: [...parsed.drawOrder] };
}
