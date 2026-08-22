import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runPriorityTrace } from "../lessons/shared/search-lab.js";
import { buildAstarSteps, checkStepAnswer, getTrapInfo, isTrapStep, buildFinalComparison } from "../lessons/search-astar-delivery/game-core.js";

const lessonRoot = new URL("../lessons/search-astar-delivery/", import.meta.url);
const astarResult = runPriorityTrace({ useHeuristic: true });
const steps = buildAstarSteps(astarResult);
const trapInfo = getTrapInfo(astarResult);

test("A* 단계는 1부터 순차적으로 매겨지고, 모든 단계가 학생이 직접 푸는 대상이다(총 열린 칸이 적어 fast-forward 불필요)", () => {
  assert.deepEqual(steps.map((s) => s.displayIndex), steps.map((_, i) => i + 1));
  assert.ok(steps.length <= 12, "A*가 열어보는 칸이 적어야 전 단계를 학생이 직접 풀 수 있음");
});

test("checkStepAnswer는 실제로 확장된 칸을 골랐을 때만 correct다", () => {
  const step = steps[0];
  assert.equal(checkStepAnswer(step, step.expanded).correct, true);
  const wrong = step.candidates.find((c) => c.cellId !== step.expanded);
  if (wrong) assert.equal(checkStepAnswer(step, wrong.cellId).correct, false);
});

test("함정 단계가 실제로 존재하고, isTrapStep은 그 단계에서만 true다", () => {
  assert.ok(trapInfo, "함정 단계를 찾지 못함");
  const trapStep = steps.find((s) => s.index === trapInfo.stepIndex);
  assert.ok(trapStep, "함정 단계가 실제 단계 목록 안에 있어야 함");
  assert.equal(isTrapStep(trapStep, trapInfo), true);
  const otherStep = steps.find((s) => s.index !== trapInfo.stepIndex);
  assert.equal(isTrapStep(otherStep, trapInfo), false);
});

test("buildFinalComparison은 A*가 UCS보다 적게 열고, 경로 비용은 서로 같음을 보여준다", () => {
  const comparison = buildFinalComparison();
  assert.ok(comparison.astar.opened < comparison.ucs.opened);
  assert.equal(comparison.astar.pathCost, comparison.ucs.pathCost);
});

test("독립 lesson 페이지와 접근성 장치를 제공한다", async () => {
  const [html, labCss, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("../shared/lab-base.css", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /프로젝터 모드/);
  assert.match(html, /data-guard-scope="page" data-guard-group="ai-search" data-guard-lesson="search-astar-delivery"/);
  assert.match(labCss, /prefers-reduced-motion/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

test("f(n)=g(n)+h(n)과 완전성·최적성·효율 비교표, 함정 문항 경고 UI가 화면에 있다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /f\(n\) = g\(n\) \+ h\(n\)/);
  assert.match(html, /완전성/);
  assert.match(html, /최적성/);
  assert.match(html, /효율/);
  assert.match(html, /id="trap-warning"[^>]*hidden/);
  assert.match(html, /id="bfs-opened-cell"/);
  assert.match(html, /id="ucs-opened-cell"/);
  assert.match(html, /id="astar-opened-cell"/);
});

test("결과 화면은 units/ai-search와 루트 홈으로 각각 돌아가는 링크를 함께 제공한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /href="\.\.\/\.\.\/units\/ai-search\/"/);
  assert.match(html, /href="\.\.\/\.\.\/">전체 활동지 홈으로/);
});
