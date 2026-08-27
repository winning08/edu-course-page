import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const lessonRoot = new URL("../lessons/search-eight-puzzle/", import.meta.url);

test("02-3 설명 블록의 순서는 경로 목록 → 참고자료 → 알고리즘 비교 → 함께 생각해 보기이다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const markers = [
    ['id="path-list"', "경로 목록"],
    ['class="reference-box"', "참고자료"],
    ['<p class="result-note-eyebrow">알고리즘 비교</p>', "알고리즘 비교"],
    ['<h3>함께 생각해 보기</h3>', "함께 생각해 보기"],
  ];
  const positions = markers.map(([marker, label]) => {
    const index = html.indexOf(marker);
    assert.notEqual(index, -1, `${label}(${marker})을 찾지 못했습니다`);
    return index;
  });
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(positions[i] > positions[i - 1], `${markers[i][1]}이 ${markers[i - 1][1]}보다 앞에 있으면 안 됩니다`);
  }
});

test("02-3에서 이동 비용 다음 활동 안내를 제거한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.doesNotMatch(html, /이동 비용이 다르면\?/);
  assert.doesNotMatch(html, /href="\.\.\/search-cost-delivery\/"/);
  assert.doesNotMatch(html, /next-step/);
});

test("이전 활동 이동(lesson-pager)은 그대로 유지되고 새로 강조되지 않는다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<nav class="lesson-pager"><a href="\.\.\/search-bfs-delivery\/">/);
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  assert.doesNotMatch(css, /\.lesson-pager/);
});

test("다음 활동(search-cost-delivery) 링크가 남아 있지 않다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const pagerMatch = html.match(/<nav class="lesson-pager">([\s\S]*?)<\/nav>/);
  assert.ok(pagerMatch, "lesson-pager를 찾지 못했습니다");
  const pagerHtml = pagerMatch[1];
  assert.doesNotMatch(pagerHtml, /search-cost-delivery/);
  assert.doesNotMatch(pagerHtml, /class="next"/);
  assert.doesNotMatch(pagerHtml, /다음 활동/);
  assert.doesNotMatch(html, /href="\.\.\/search-cost-delivery\/"/);
});

test("참고자료는 iframe 없이 링크 전용의 짧은 카드로 구성되고, 통일 카드(result-block)에는 속하지 않는다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<div class="reference-box">/);
  assert.doesNotMatch(html, /<div class="reference-box result-block">/);
  assert.doesNotMatch(html, /<details/);
  assert.doesNotMatch(html, /<summary/);
  assert.doesNotMatch(html, /<iframe/);
  assert.doesNotMatch(html, /reference-frame|reference-loading|reference-body/);
});

test("참고자료 카드는 라벨·제목·실행 사이트 열기 버튼만 유지하고, 안내문·GitHub 저장소 링크는 제거되었다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<p class="reference-eyebrow">참고자료<\/p>/);
  assert.match(html, /<p class="reference-title">8-퍼즐 BFS·DFS 시뮬레이터\(외부 사이트\)<\/p>/);
  assert.doesNotMatch(html, /reference-notice/);
  assert.doesNotMatch(html, /reference-link/);
  assert.doesNotMatch(html, /GitHub 저장소 보기/);
  assert.doesNotMatch(html, /외부 참고자료이며 현재 활동과 화면 구성이 다를 수 있습니다/);
  assert.doesNotMatch(html, /github\.com\/kankanssam\/Uninformed_Search/);

  const executeLinkTag = html.match(/<a class="reference-button"[^>]*>/)?.[0];
  assert.ok(executeLinkTag, "실행 사이트 버튼을 찾지 못했습니다");
  assert.match(executeLinkTag, /href="https:\/\/kankanssam\.github\.io\/Uninformed_Search\/"/);
  assert.match(executeLinkTag, /target="_blank"/);
  assert.match(executeLinkTag, /rel="noopener noreferrer"/);
});

test("참고자료 관련 JS·CSS(iframe 지연 로딩, 전용 iframe 스타일, 삭제된 안내문/저장소 링크 스타일)는 더 이상 존재하지 않는다", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
  ]);
  assert.doesNotMatch(js, /reference|REFERENCE/);
  assert.doesNotMatch(css, /reference-frame|reference-loading|reference-body|reference-links/);
  assert.doesNotMatch(css, /\.reference-notice/);
  assert.doesNotMatch(css, /\.reference-link\b/);
});

test("알고리즘 비교와 생각해 보기 카드는 같은 result-note·result-block 구조와 스타일을 공유한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.equal((html.match(/class="result-note result-block"/g) || []).length, 2);

  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  const baseRuleMatch = css.match(/#puzzle-results \.result-block \{([^}]*)\}/);
  assert.ok(baseRuleMatch, "#puzzle-results .result-block 공통 규칙을 찾지 못했습니다");
  const baseRule = baseRuleMatch[1];
  assert.match(baseRule, /max-width:640px/);
  assert.match(baseRule, /padding:1rem 1\.2rem/);
  assert.match(baseRule, /border:1px solid var\(--line\)/);
  assert.match(baseRule, /border-radius:4px/);

  // 역할별 규칙은 border-left-color/background 같은 색상만 다루고,
  // 공통 규칙이 정한 max-width/padding/border/border-radius/min-height를 다시 지정하지 않는다.
  assert.doesNotMatch(css, /#puzzle-results \.result-note\.result-block \{/);
});

test("모바일(600px 이하)에서도 두 카드는 같은 result-block 규칙으로 전체 폭에 자연스럽게 늘어난다", async () => {
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  assert.match(css, /@media\(max-width:600px\)\{[\s\S]*#puzzle-results \.result-block \{ padding:1rem 1\.2rem; \}/);
  // 카드별로 각각 다른 모바일 규칙을 따로 두지 않는다(공통 규칙 하나만 조정).
  assert.doesNotMatch(css, /@media\(max-width:600px\)\{[\s\S]*\.result-note \{ padding/);
});
