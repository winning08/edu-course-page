import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const lessonRoot = new URL("../lessons/ai-inference-ripeness/", import.meta.url);

test("독립 lesson 페이지와 접근성 장치를 제공한다", async () => {
  const [html, css, js] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /프로젝터 모드/);
  assert.match(html, /data-filter="wrong"/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /event\.key === "1"/);
  assert.match(js, /event\.key === "2"/);
});

test("화면에는 숨은 점수나 가중치 설명이 없다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.doesNotMatch(html, /가중치|색깔 점수|촉감 점수|임계값/);
});

test("정답 확인표에는 내 예측 열이 없고 쉬운 표현을 쓴다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.doesNotMatch(html, /내 예측/);
  assert.doesNotMatch(html, /관측값|가설|데이터 로그|분류 규칙을 추론/);
  assert.match(html, /정답 확인표/);
  assert.match(html, /내 생각 점검/);
});
