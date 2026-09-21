import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyPoint, generateDataset } from "../lessons/knn-neighbors/game-core.js";

const root = new URL("../lessons/knn-neighbors/", import.meta.url);

test("요청한 클래스 수와 전체 데이터 수로 재현 가능한 데이터를 만든다", () => {
  const first = generateDataset(3, 60, 1234);
  const second = generateDataset(3, 60, 1234);
  assert.deepEqual(first, second);
  assert.equal(first.length, 60);
  assert.deepEqual([...new Set(first.map(({ classId }) => classId))], [0, 1, 2]);
});

test("KNN은 가장 가까운 k개만 집계해 다수 클래스를 선택한다", () => {
  const data = [
    { id: 0, classId: 0, x: 0, y: 0 }, { id: 1, classId: 1, x: .1, y: 0 },
    { id: 2, classId: 1, x: .12, y: 0 }, { id: 3, classId: 0, x: .9, y: .9 },
  ];
  const result = classifyPoint(data, { x: .08, y: 0 }, 3, 2);
  assert.equal(result.neighbors.length, 3);
  assert.deepEqual(result.votes, [1, 2]);
  assert.equal(result.winner, 1);
});

test("화면은 정확한 KNN 용어와 접근 가능한 조작 장치를 제공한다", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /클래스 수/);
  assert.match(html, /이웃 수\(k\)/);
  assert.match(html, /전체 데이터 수\(샘플 수\)/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /data-guard-group="machine-learning-algorithms"/);
});

test("마우스 이동은 위치 미리보기만 하고 클릭하면 분류 위치를 고정한다", async () => {
  const js = await readFile(new URL("game.js", root), "utf8");
  assert.match(js, /pointermove/);
  assert.match(js, /previewTarget = pointAtPointer/);
  assert.match(js, /pointerdown/);
  assert.match(js, /target = pointAtPointer/);
});

test("클래스별 데이터 범위가 서로 겹쳐 경계가 지나치게 분리되지 않는다", () => {
  const data = generateDataset(3, 90, 20260921);
  const ranges = [0, 1, 2].map((classId) => {
    const points = data.filter((point) => point.classId === classId);
    return { minX: Math.min(...points.map((p) => p.x)), maxX: Math.max(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)), maxY: Math.max(...points.map((p) => p.y)) };
  });
  assert.ok(ranges[0].maxX > ranges[1].minX);
  assert.ok(ranges[0].maxY > ranges[2].minY);
});
