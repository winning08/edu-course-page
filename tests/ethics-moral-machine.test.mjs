import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);

test("인공지능의 사회적 영향 단원과 모럴머신 활동이 등록되어 있다", async () => {
  const groups = JSON.parse(
    await readFile(new URL("data/activity-groups.json", repoRoot), "utf8"),
  );
  const group = groups.groups.find(({ id }) => id === "ai-ethics");
  assert.ok(group);
  assert.equal(
    group.title,
    "인공지능 윤리 - 자율주행자동차는 누구를 지켜야 할까?",
  );
  assert.equal(group.path, "lessons/ethics-moral-machine/");
  assert.equal(group.active, true);
  assert.deepEqual(
    group.children.map(({ id }) => id),
    ["ethics-moral-machine"],
  );
});

test("활동지는 외부 모럴머신 체험과 윤리 성찰 제출 흐름을 제공한다", async () => {
  const html = await readFile(
    new URL("lessons/ethics-moral-machine/index.html", repoRoot),
    "utf8",
  );
  assert.match(html, /https:\/\/www\.moralmachine\.net\//);
  assert.doesNotMatch(html, /docs\.google\.com\/forms/);
  assert.match(html, /체험 결과 기록/);
  assert.match(html, /결과를 바탕으로 생각 기록하기/);
  assert.match(html, /name="result_saved"/);
  assert.match(html, /name="result_sacrificed"/);
  assert.doesNotMatch(html, /name="completed"/);
  for (const field of [
    "preference_count",
    "preference_passenger",
    "preference_law",
    "preference_inaction",
    "preference_gender",
    "preference_species",
    "preference_age",
    "preference_fitness",
    "preference_social",
  ]) {
    assert.match(html, new RegExp(`name="${field}"`));
  }
  assert.match(html, /중요하지 않음/);
  assert.match(html, /매우 중요함/);
  assert.match(html, /<legend>성별 선호도<\/legend>/);
  assert.doesNotMatch(html, /<legend>(?:[3-9]|10|11)\./);
  assert.match(html, /<span>남성<\/span>/);
  assert.match(html, /<span>여성<\/span>/);
  assert.match(html, /<span>인간<\/span>/);
  assert.match(html, /<span>애완동물<\/span>/);
  assert.match(html, /<span>젊은이<\/span>/);
  assert.match(html, /<span>노인<\/span>/);
  assert.match(html, /<span>건강인<\/span>/);
  assert.match(html, /<span>비만인<\/span>/);
  assert.match(html, /<span>높음<\/span>/);
  assert.match(html, /<span>낮음<\/span>/);
  assert.equal((html.match(/class="scale-question"/g) ?? []).length, 9);
  assert.equal((html.match(/type="radio" name="preference_/g) ?? []).length, 45);
  assert.match(html, /name="criterion_1"/);
  assert.match(html, /name="criterion_2"/);
  assert.match(html, /name="criterion_3"/);
  assert.match(html, /name="criterion_least"/);
  assert.match(html, /name="criterion_least_reason"/);
  assert.doesNotMatch(html, /② 자신의 판단에/);
  assert.match(html, /정답을 맞히는 활동이 아닙니다/);
  assert.match(html, /선택하기 어려웠던 상황의 두 선택지/);
  assert.match(html, /두 선택지 사이에서 고민했던 이유/);
  assert.match(html, /name="dilemma_reason"/);
  assert.match(html, /최종적으로 선택한 결과/);
  assert.match(html, /id="ethics-form"/);
  assert.match(html, /data-guard-group="ai-ethics"/);
});

test("제출 스크립트는 학번과 필수 응답을 검증하고 모럴머신 활동을 구분한다", async () => {
  const script = await readFile(
    new URL("lessons/ethics-moral-machine/form.js", repoRoot),
    "utf8",
  );
  assert.match(script, /\^\\d\{5\}\$/);
  assert.match(script, /\[모럴머신 결과\]/);
  assert.doesNotMatch(script, /form\.elements\.completed/);
  assert.match(script, /result_saved/);
  assert.match(script, /result_sacrificed/);
  assert.match(script, /criterion_least_reason/);
  assert.match(script, /dilemma_reason/);
  assert.match(script, /payload\.motivation = payload\.question/);
  assert.match(script, /payload\.usage_improvement = payload\.reason/);
  assert.match(script, /payload\.code =/);
  assert.match(script, /new Set\(rankedCriteria\)/);
  assert.match(
    script,
    /AKfycbxGsJyw_w11KylS-VkgKpmN9xTtrQ--zlwAJD3wNE2itdUogNCAYiK8y44Jh8zpYsI3\/exec/,
  );
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /summary\.innerHTML/);
});
