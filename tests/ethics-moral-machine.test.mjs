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
  assert.match(
    html,
    /https:\/\/docs\.google\.com\/forms\/d\/e\/1FAIpQLScDFeHDZme1rcofIBD5ROUXwImnl1CdXoGL7rMbT209OCD4lw\/viewform/,
  );
  assert.match(html, /모럴머신 결과 기록하기/);
  assert.match(html, /이메일 입력이 필요합니다/);
  assert.match(html, /정답을 맞히는 활동이 아닙니다/);
  assert.match(html, /가장 고민되었던 상황/);
  assert.match(html, /가장 중요하게 고려한 기준/);
  assert.match(html, /가장 큰 책임을 져야 하는 주체/);
  assert.match(html, /id="ethics-form"/);
  assert.match(html, /data-guard-group="ai-ethics"/);
});

test("제출 스크립트는 학번과 필수 응답을 검증하고 모럴머신 활동을 구분한다", async () => {
  const script = await readFile(
    new URL("lessons/ethics-moral-machine/form.js", repoRoot),
    "utf8",
  );
  assert.match(script, /\^\\d\{5\}\$/);
  assert.match(script, /\[모럴머신\]/);
  assert.match(script, /form\.elements\.completed\.checked/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /summary\.innerHTML/);
});
