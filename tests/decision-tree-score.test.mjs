import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DATA,
  accuracy,
  matches,
  predict,
} from "../lessons/decision-tree-score/game-core.js";

test("사용자가 만든 조건과 가지에 따라 데이터를 분류한다", () => {
  const rules = {
    root: { feature: "x", threshold: 6 },
    yes: null,
    no: null,
  };

  assert.equal(predict({ x: 7, y: 2 }, rules), 1);
  assert.equal(predict({ x: 3, y: 8 }, rules), 0);
  assert.ok(accuracy(DATA, rules) >= 0 && accuracy(DATA, rules) <= 100);
});

test("질문에서 이상과 이하를 선택할 수 있다", () => {
  assert.equal(
    matches({ x: 4, y: 7 }, { feature: "x", threshold: 5, operator: "lte" }),
    true,
  );
  assert.equal(
    matches({ x: 6, y: 3 }, { feature: "x", threshold: 5, operator: "lte" }),
    false,
  );
});

test("화면은 나만의 의사결정트리를 만드는 활동과 파비콘을 제공한다", async () => {
  const html = await readFile(
    new URL("../lessons/decision-tree-score/index.html", import.meta.url),
    "utf8",
  );

  assert.match(html, /나만의 의사결정트리로/);
  assert.match(html, /공부 시간/);
  assert.match(html, /수면 시간/);
  assert.match(html, /15명의 학습 데이터/);
  assert.match(html, /id="dataset-body"/);
  assert.match(html, /이렇게 활동하세요/);
  assert.match(html, /정확도 90% 이상/);
  assert.match(html, /root-threshold-value/);
  assert.match(html, /root-operator/);
  assert.match(html, /id="point-detail"/);
  assert.match(html, /id="tree-visual"/);
  assert.match(html, /favicon\.svg/);
  assert.match(html, /data-guard-group="machine-learning-algorithms"/);
});
