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
    root: { feature: "x", threshold: 5 },
    yes: null,
    no: null,
  };

  assert.equal(predict({ x: 5.5, y: 2 }, rules), 1);
  assert.equal(predict({ x: 4.5, y: 1.4 }, rules), 0);
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
  assert.match(html, /꽃잎 길이/);
  assert.match(html, /꽃잎 너비/);
  assert.match(html, /15개의 붓꽃 표본/);
  assert.match(html, /id="dataset-body"/);
  assert.match(html, /이렇게 활동하세요/);
  assert.match(html, /정확도 90% 이상/);
  assert.match(html, /root-threshold-value/);
  assert.match(html, /root-operator/);
  assert.match(html, /같은 점을 다시 클릭하면 사라집니다/);
  assert.match(html, /id="tree-visual"/);
  const script = await readFile(
    new URL("../lessons/decision-tree-score/game.js", import.meta.url),
    "utf8",
  );
  assert.match(script, /pointCallout/);
  assert.match(script, /\(x=\$\{point\.x\}, y=\$\{point\.y\}\)/);
  assert.match(script, /selectedPoint === index \? null : index/);
  assert.match(script, /꽃잎 길이.*꽃잎 너비/s);
  assert.match(script, /plot-grid/);
  assert.match(html, /favicon\.svg/);
  assert.match(html, /data-guard-group="machine-learning-algorithms"/);
});
