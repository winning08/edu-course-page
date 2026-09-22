import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("퀵드로우는 활동 안내를 거쳐 공식 외부 사이트로 연결된다", async () => {
  const [html, unit] = await Promise.all([
    readFile(
      new URL("../lessons/quick-draw/index.html", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../units/machine-learning-algorithms/index.html",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(unit, /href="\.\.\/\.\.\/lessons\/quick-draw\/"/);
  assert.match(html, /이렇게 활동하세요/);
  assert.match(html, /그리는 동안 생각해 보세요/);
  assert.match(html, /AI는 그림을 ‘이해’한 걸까요/);
  assert.match(html, /href="https:\/\/quickdraw\.withgoogle\.com\/"/);
  assert.match(html, /target="_blank"/);
});
