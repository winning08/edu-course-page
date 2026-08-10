export const COLORS = ["초록", "노랑", "빨강", "주황"];
export const TEXTURES = ["단단함", "중간", "말랑함"];
export const SEASONS = ["봄", "여름", "가을", "겨울"];
export const TOTAL_ROUNDS = 15;

const colorScores = { 초록: 0, 노랑: 2, 빨강: 3, 주황: 2 };
const textureScores = { 단단함: 0, 중간: 1, 말랑함: 2 };

export function classify(sample) {
  return colorScores[sample.color] + textureScores[sample.texture] >= 3 ? "잘 익음" : "안 익음";
}

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

export function makeRounds(random = Math.random) {
  const core = COLORS.flatMap((color) => TEXTURES.map((texture) => ({ color, texture })));
  const extras = shuffle([
    { color: "초록", texture: "중간" },
    { color: "빨강", texture: "단단함" },
    { color: "주황", texture: "말랑함" },
  ], random);
  const samples = shuffle([...core, ...extras], random);
  const seasonPool = shuffle([...SEASONS, ...SEASONS, ...SEASONS, ...SEASONS], random).slice(0, TOTAL_ROUNDS);
  return samples.map((sample, index) => ({ ...sample, season: seasonPool[index] }));
}

export function summarize(attempts) {
  const correct = attempts.filter((attempt) => attempt.correct).length;
  return { correct, accuracy: attempts.length ? Math.round((correct / attempts.length) * 100) : 0 };
}
