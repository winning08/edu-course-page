// 여러 수업 페이지가 함께 쓰는 결정론적 난수·섞기·집계 유틸리티.
export function seededRandom(seed = Date.now()) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

export function summarize(attempts) {
  const correct = attempts.filter((attempt) => attempt.correct).length;
  return { correct, accuracy: attempts.length ? Math.round((correct / attempts.length) * 100) : 0 };
}
