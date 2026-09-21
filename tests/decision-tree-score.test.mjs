import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DATA,
  accuracy,
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

test("화면은 나만의 의사결정트리를 만드는 활동과 파비콘을 제공한다", async () => {
  const html = await readFile(
    new URL("../lessons/decision-tree-score/index.html", import.meta.url),
    "utf8",
  );

  assert.match(html, /나만의 의사결정트리로/);
  assert.match(html, /공부 시간/);
  assert.match(html, /수면 시간/);
  assert.match(html, /favicon\.svg/);
  assert.match(html, /data-guard-group="machine-learning-algorithms"/);
});
