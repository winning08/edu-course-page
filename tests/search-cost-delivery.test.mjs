import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runPriorityTrace } from "../lessons/shared/search-lab.js";
import { buildUcsSteps, checkStepAnswer, summarize, INTERACTIVE_STEP_CAP } from "../lessons/search-cost-delivery/game-core.js";

const lessonRoot = new URL("../lessons/search-cost-delivery/", import.meta.url);
const ucsResult = runPriorityTrace({ useHeuristic: false });
const steps = buildUcsSteps(ucsResult);

test("UCS 단계는 1부터 순차적으로 매겨지고, 각 후보에는 h가 없다(=0)", () => {
  assert.deepEqual(steps.map((s) => s.displayIndex), steps.map((_, i) => i + 1));
  for (const step of steps) for (const c of step.candidates) assert.equal(c.h, 0);
});

test(`처음 ${INTERACTIVE_STEP_CAP}단계만 interactive이고, 나머지는 자동 진행 대상이다`, () => {
  const interactiveSteps = steps.filter((s) => s.interactive);
  assert.equal(interactiveSteps.length, Math.min(INTERACTIVE_STEP_CAP, steps.length));
});

test("checkStepAnswer는 실제로 확장된 칸을 골랐을 때만 correct다", () => {
  const step = steps[0];
  assert.equal(checkStepAnswer(step, step.expanded).correct, true);
  const wrong = step.candidates.find((c) => c.cellId !== step.expanded);
  if (wrong) assert.equal(checkStepAnswer(step, wrong.cellId).correct, false);
});

test("summarize()는 UCS 경로 비용이 BFS 경로를 그대로 따라갔을 때보다 싸거나 같음을 보여준다", () => {
  const summary = summarize();
  assert.ok(summary.cheaper >= 0);
  assert.equal(summary.ucsHops, summary.ucsPath.length - 1);
});

test("독립 lesson 페이지와 접근성 장치, 먼저 예측하기 UI를 제공한다", async () => {
  const [html, labCss, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("../shared/lab-base.css", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /프로젝터 모드/);
  assert.match(html, /data-guard-scope="page" data-guard-group="ai-search" data-guard-lesson="search-cost-delivery"/);
  assert.match(html, /id="predict-input"/);
  assert.match(html, /id="predict-result"[^>]*hidden/);
  assert.match(labCss, /prefers-reduced-motion/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

test("균일 비용 탐색의 정의와 g(n) 표기, 맹목적(무정보) 탐색 용어가 화면에 등장한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /균일 비용 탐색/);
  assert.match(html, /g\(n\)/);
  assert.match(html, /맹목적 탐색\(무정보 탐색, uninformed search\)/);
  assert.match(html, /완전성/);
  assert.match(html, /최적성/);
});
