import assert from "node:assert/strict";
import test from "node:test";
import { classify, COLORS, makeRounds, seededRandom, summarize, TEXTURES, TOTAL_ROUNDS } from "../lessons/ai-inference-ripeness/game-core.js";

test("12개 색깔×촉감 조합의 정답 규칙이 정확하다", () => {
  for (const color of COLORS) for (const texture of TEXTURES) {
    const ripe = color === "빨강" || (["노랑", "주황"].includes(color) && texture !== "단단함");
    assert.equal(classify({ color, texture, season: "봄" }), ripe ? "잘 익음" : "안 익음");
  }
});

test("계절은 분류 결과에 영향을 주지 않는다", () => {
  for (const color of COLORS) for (const texture of TEXTURES) {
    const answers = new Set(["봄", "여름", "가을", "겨울"].map((season) => classify({ color, texture, season })));
    assert.equal(answers.size, 1);
  }
});

test("1000개 시드에서 모든 핵심 비교 조합이 보장된다", () => {
  for (let seed = 1; seed <= 1000; seed += 1) {
    const rounds = makeRounds(seededRandom(seed));
    assert.equal(rounds.length, TOTAL_ROUNDS);
    for (const color of COLORS) for (const texture of TEXTURES) {
      assert.ok(rounds.some((sample) => sample.color === color && sample.texture === texture), `${seed}: ${color}-${texture} 누락`);
    }
  }
});

test("정확도를 계산한다", () => {
  assert.deepEqual(summarize([{ correct:true },{ correct:false },{ correct:true }]), { correct:2, accuracy:67 });
  assert.deepEqual(summarize([]), { correct:0, accuracy:0 });
});
