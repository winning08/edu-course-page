import assert from "node:assert/strict";
import test from "node:test";
import { COLORS, TEXTURES } from "../lessons/ai-inference-ripeness/game-core.js";
import { buildSpecimenLabel, buildSpecimenSvg } from "../lessons/ai-inference-ripeness/specimen-visual.js";

test("모든 색깔·촉감 조합에 대해 접근 가능한 설명을 만든다", () => {
  for (const color of COLORS) {
    for (const texture of TEXTURES) {
      const label = buildSpecimenLabel({ color, texture });
      assert.match(label, new RegExp(color));
      assert.equal(typeof label, "string");
      assert.ok(label.length > 0);
    }
  }
});

test("모든 색깔·촉감 조합에 대해 외부 네트워크 없이 유효한 인라인 SVG를 만든다", () => {
  for (const color of COLORS) {
    for (const texture of TEXTURES) {
      const svg = buildSpecimenSvg({ color, texture }, "test-uid");
      assert.match(svg, /^<svg /);
      assert.match(svg, /<\/svg>$/);
      assert.doesNotMatch(svg, /https?:\/\//);
      assert.doesNotMatch(svg, /<image/);
      assert.match(svg, /aria-hidden="true"/);
    }
  }
});

test("촉감마다 시각적으로 구별되는 모양이나 무늬를 사용한다", () => {
  const firm = buildSpecimenSvg({ color: "초록", texture: "단단함" }, "uid-a");
  const medium = buildSpecimenSvg({ color: "초록", texture: "중간" }, "uid-b");
  const soft = buildSpecimenSvg({ color: "초록", texture: "말랑함" }, "uid-c");
  assert.notEqual(firm, medium);
  assert.notEqual(medium, soft);
  assert.notEqual(firm, soft);
});

test("서로 다른 uid를 넘기면 id 충돌이 나는 요소를 만들지 않는다", () => {
  const a = buildSpecimenSvg({ color: "빨강", texture: "단단함" }, "round-0");
  const b = buildSpecimenSvg({ color: "빨강", texture: "단단함" }, "round-1");
  assert.match(a, /round-0/);
  assert.match(b, /round-1/);
});
