import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("AI 추론 실험실 페이지를 한국어로 렌더링한다", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /AI 추론 실험실/);
  assert.match(html, /실험 데이터를 준비하고 있습니다/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("15라운드와 접근성 설정을 유지한다", async () => {
  const [game, css] = await Promise.all([
    readFile(new URL("../app/ripeness-game.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(game, /const TOTAL_ROUNDS = 15/);
  assert.match(game, /aria-live="polite"/);
  assert.match(game, /잘 익음/);
  assert.match(game, /안 익음/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
});
