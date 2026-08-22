import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const lessonRoot = new URL("../lessons/search-eight-puzzle/", import.meta.url);

test("미리보기는 localhost/127.0.0.1로만 허용되고, 다른 호스트에서는 쿼리를 완전히 무시한다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /const LOCAL_PREVIEW_HOSTNAMES = new Set\(\["localhost", "127\.0\.0\.1"\]\);/);
  // readPreviewStep은 쿼리를 읽기 전에 호스트부터 확인해, 허용 호스트가 아니면 쿼리 값과 무관하게 항상 null이어야 한다.
  const fnMatch = js.match(/function readPreviewStep\(\) \{([\s\S]*?)\n\}/);
  assert.ok(fnMatch, "readPreviewStep 함수를 찾지 못했습니다");
  const fnBody = fnMatch[1].trim();
  assert.match(fnBody, /^if \(!LOCAL_PREVIEW_HOSTNAMES\.has\(location\.hostname\)\) return null;/);
});

test("preview 값은 1~3(STEP_TOTAL) 범위의 정수만 허용하고 그 외에는 무시(null)한다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /const step = Number\(new URLSearchParams\(location\.search\)\.get\("preview"\)\);/);
  assert.match(js, /if \(!Number\.isInteger\(step\) \|\| step < 1 \|\| step > STEP_TOTAL\) return null;/);
});

test("미리보기가 활성화되면 요청한 단계와 그 이전 단계의 잠금이 메모리상에서만 풀린다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /const previewStep = readPreviewStep\(\);/);
  assert.match(js, /const previewActive = previewStep !== null;/);
  assert.match(js, /if \(previewActive\) \{\s*\n\s*stepState\.step1Done = previewStep >= 2;\s*\n\s*stepState\.step2Done = previewStep >= 3;\s*\n\s*stepState\.step = previewStep;/);
});

test("미리보기 상태는 sessionStorage에 절대 저장되지 않아 기존 학생 진행도를 건드리지 않는다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  const fnMatch = js.match(/function saveStepState\(\) \{([\s\S]*?)\n\}/);
  assert.ok(fnMatch, "saveStepState 함수를 찾지 못했습니다");
  const fnBody = fnMatch[1].trim();
  // previewActive면 sessionStorage 접근 코드에 도달하기 전에 즉시 반환해야 한다.
  assert.match(fnBody, /^if \(previewActive\) return;/);
  assert.match(fnBody, /sessionStorage\.setItem\(STEP_STORAGE_KEY/);
  // preview 전용 저장소 키나 localStorage 등 새로운 영구 저장 경로를 추가하지 않는다.
  assert.doesNotMatch(js, /localStorage/);
  const setItemCount = (js.match(/sessionStorage\.setItem\(/g) || []).length;
  assert.equal(setItemCount, 1, "sessionStorage.setItem 호출은 saveStepState 한 곳에만 있어야 합니다");
});

test("?preview=3은 02-2 완료 시와 동일한 결정론적 경로(buildResults→goToStep)로 02-3을 바로 렌더링한다", async () => {
  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  // 미리보기 전용 렌더링 분기를 새로 만들지 않고, 기존 세션 복원 로직 한 곳만 재사용해야 한다.
  const buildResultsCallCount = (js.match(/\bbuildResults\(\);/g) || []).length;
  assert.equal(buildResultsCallCount, 2, "buildResults() 호출은 finish() 내부와 세션 복원부 두 곳에만 있어야 합니다");
  assert.match(js, /if \(stepState\.step2Done\) buildResults\(\);\s*\n\s*goToStep\(stepState\.step, \{ focus: false \}\);/);
});

test("로컬 미리보기 배지 요소가 기본적으로 숨겨져 있고, 미리보기 활성화 시에만 표시된다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<p id="preview-badge" class="preview-badge" hidden role="status">로컬 미리보기 · <span id="preview-badge-step"><\/span>단계 \(세션에 저장 안 됨\)<\/p>/);

  const js = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(js, /const previewBadge = document\.getElementById\("preview-badge"\);/);
  assert.match(js, /previewBadge\.hidden = false;/);
  // 배지를 보이게 하는 코드는 previewActive 분기 안에서만 실행돼야 한다(항상 표시되면 안 됨).
  const previewBlockMatch = js.match(/if \(previewActive\) \{([\s\S]*?)\n\}/);
  assert.ok(previewBlockMatch, "previewActive 분기를 찾지 못했습니다");
  assert.match(previewBlockMatch[1], /previewBadge\.hidden = false;/);
});

test("배지 스타일은 다른 화면 요소를 가리지 않도록 고정 위치의 작은 알약형이다", async () => {
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  assert.match(css, /\.preview-badge \{[^}]*position:fixed/);
  assert.match(css, /\.preview-badge \{[^}]*z-index:90/);
  assert.match(css, /@media\(max-width:600px\)\{ \.preview-badge \{/);
});
