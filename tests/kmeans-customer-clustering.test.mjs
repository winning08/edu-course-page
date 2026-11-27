import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("군집 활동지와 쇼핑몰 고객 군집화 활동이 등록되어 있다", async () => {
  const data = JSON.parse(await readFile(new URL("data/activity-groups.json", root), "utf8"));
  const classification = data.groups.find(({ id }) => id === "machine-learning-algorithms");
  const clustering = data.groups.find(({ id }) => id === "machine-learning-clustering");
  assert.equal(classification.title, "기계학습 알고리즘 - 분류");
  assert.equal(clustering.title, "기계학습 알고리즘 - 군집");
  assert.deepEqual(clustering.children.map(({ id }) => id), ["kmeans-customer-clustering"]);
});

test("활동은 K-means 체험과 5개 군집 분석 활동지를 제공한다", async () => {
  const html = await readFile(new URL("lessons/kmeans-customer-clustering/index.html", root), "utf8");
  assert.match(html, /id="cluster-chart"/);
  assert.match(html, /id="step-sim"/);
  assert.match(html, /id="run-sim"/);
  assert.match(html, /Orange3/);
  assert.match(html, /5개 군집의 고객 특성과 마케팅 전략/);
  assert.doesNotMatch(html, /군집화 결과 예상하기/);
  assert.doesNotMatch(html, /Orange3로 군집 개수 비교하기/);
  assert.doesNotMatch(html, /name="final_k"/);
  assert.match(html, /id="cluster-cards"/);
  assert.match(html, /활동지가 제출되었습니다/);
  assert.doesNotMatch(html, /인쇄·PDF 저장/);
  assert.match(html, /data-guard-group="machine-learning-clustering"/);
  assert.match(html, /data-guard-lesson="kmeans-customer-clustering"/);
});

test("5개 군집 분석 카드를 만들고 결과를 안전하게 표시한다", async () => {
  const js = await readFile(new URL("lessons/kmeans-customer-clustering/app.js", root), "utf8");
  assert.match(js, /index<=5/);
  assert.match(js, /cluster_\$\{index\}_name/);
  assert.match(js, /cluster_\$\{index\}_features/);
  assert.doesNotMatch(js, /name="cluster_\$\{index\}_evidence"/);
  assert.match(js, /cluster_\$\{index\}_strategy/);
  assert.match(js, /textContent/);
  assert.doesNotMatch(js, /resultContent\.innerHTML/);
});

test("군집 활동지를 지정된 Apps Script에 저장한 뒤 완료 화면을 연다", async () => {
  const html = await readFile(new URL("lessons/kmeans-customer-clustering/index.html", root), "utf8");
  const js = await readFile(new URL("lessons/kmeans-customer-clustering/app.js", root), "utf8");
  assert.match(html, /id="submit-button"/);
  assert.match(js, /AKfycbx1ZkNr1bOKPpc7GB5L-aPU2Zv6_xaCv2g_BDcRW6nVAIZwUIWY28rr4m3gevR-MYTV/);
  assert.match(js, /await fetch\(ENDPOINT/);
  assert.match(js, /"Content-Type":"text\/plain;charset=utf-8"/);
  assert.match(js, /clusters,activity:/);
  assert.match(js, /if\(!responseData\.success\)throw/);
});
