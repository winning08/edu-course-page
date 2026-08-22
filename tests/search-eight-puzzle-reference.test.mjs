import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const lessonRoot = new URL("../lessons/search-eight-puzzle/", import.meta.url);

test("02-3 설명 블록의 순서는 경로 목록 → 참고자료 → 알고리즘 비교 → 함께 생각해 보기 → 다음 활동이다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const markers = [
    ['id="path-list"', "경로 목록"],
    ['class="reference-box"', "참고자료"],
    ['class="compare-box result-block"', "알고리즘 비교"],
    ['class="discussion result-block"', "함께 생각해 보기"],
    ['class="next-step result-block"', "다음 활동"],
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

test("02-3에는 다음 활동을 라벨·제목·설명·버튼을 갖춘 CTA 카드로 안내한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<div class="next-step result-block">/);
  assert.match(html, /<p class="next-step-eyebrow">다음 활동<\/p>/);
  assert.match(html, /<h3 class="next-step-title">이동 비용이 다르면\?<\/h3>/);
  assert.match(html, /<p class="next-step-desc">[^<]+<\/p>/);
  assert.match(html, /<a class="next-step-button" href="\.\.\/search-cost-delivery\/">다음 활동으로 이동/);
  const puzzleResultsStart = html.indexOf('id="puzzle-results"');
  const nextStepStart = html.indexOf('<div class="next-step result-block">');
  assert.ok(nextStepStart > puzzleResultsStart);
});

test("이전 활동 이동(lesson-pager)은 그대로 유지되고 새로 강조되지 않는다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<nav class="lesson-pager"><a href="\.\.\/search-bfs-delivery\/">/);
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  assert.doesNotMatch(css, /\.lesson-pager/);
});

test("다음 활동(search-cost-delivery) 링크는 02-3 CTA 카드에만 있고 lesson-pager와 중복되지 않는다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  const pagerMatch = html.match(/<nav class="lesson-pager">([\s\S]*?)<\/nav>/);
  assert.ok(pagerMatch, "lesson-pager를 찾지 못했습니다");
  const pagerHtml = pagerMatch[1];
  assert.doesNotMatch(pagerHtml, /search-cost-delivery/);
  assert.doesNotMatch(pagerHtml, /class="next"/);
  assert.doesNotMatch(pagerHtml, /다음 활동/);
  const nextActivityLinkCount = (html.match(/href="\.\.\/search-cost-delivery\/"/g) || []).length;
  assert.equal(nextActivityLinkCount, 1);
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

test("알고리즘 비교·생각해 보기·다음 활동 세 카드는 하나의 result-block 규칙으로 크기·폭·패딩·테두리·모서리·최소높이를 공유한다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<div class="compare-box result-block">/);
  assert.match(html, /<div class="discussion result-block">/);
  assert.match(html, /<div class="next-step result-block">/);

  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  const baseRuleMatch = css.match(/#puzzle-results \.result-block \{([^}]*)\}/);
  assert.ok(baseRuleMatch, "#puzzle-results .result-block 공통 규칙을 찾지 못했습니다");
  const baseRule = baseRuleMatch[1];
  assert.match(baseRule, /max-width:720px/);
  assert.match(baseRule, /padding:1\.3rem 1\.4rem/);
  assert.match(baseRule, /border:1px solid var\(--line\)/);
  assert.match(baseRule, /border-radius:6px/);
  assert.match(baseRule, /min-height:128px/);

  // 역할별 규칙은 border-left-color/background 같은 색상만 다루고,
  // 공통 규칙이 정한 max-width/padding/border/border-radius/min-height를 다시 지정하지 않는다.
  const roleSelectors = [
    "#puzzle-results .compare-box.result-block",
    "#puzzle-results .discussion.result-block",
    "#puzzle-results .next-step.result-block",
  ];
  roleSelectors.forEach((selector) => {
    const escaped = selector.replace(/[.#]/g, "\\$&");
    const ruleMatch = css.match(new RegExp(`${escaped} \\{([^}]*)\\}`));
    assert.ok(ruleMatch, `${selector} 규칙을 찾지 못했습니다`);
    const body = ruleMatch[1];
    assert.doesNotMatch(body, /max-width|padding:|border-radius|min-height|\bborder:/);
  });
});

test("모바일(600px 이하)에서도 세 카드는 같은 result-block 규칙으로 전체 폭에 자연스럽게 늘어난다", async () => {
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  assert.match(css, /@media\(max-width:600px\)\{[\s\S]*#puzzle-results \.result-block \{ padding:1\.1rem 1\.2rem; \}/);
  // 카드별로 각각 다른 모바일 규칙을 따로 두지 않는다(공통 규칙 하나만 조정).
  assert.doesNotMatch(css, /@media\(max-width:600px\)\{[\s\S]*\.next-step \{ padding/);
  assert.doesNotMatch(css, /@media\(max-width:600px\)\{[\s\S]*\.compare-box \{ padding/);
});
