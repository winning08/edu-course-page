import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const lessonRoot = new URL("../lessons/search-eight-puzzle/", import.meta.url);
const playRoot = new URL("../lessons/search-eight-puzzle-play/", import.meta.url);

function openingTag(html, attr) {
  const marker = `data-step-panel="${attr}"`;
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `data-step-panel="${attr}"를 찾지 못했습니다`);
  const tagStart = html.lastIndexOf("<", start);
  const tagEnd = html.indexOf(">", start);
  return html.slice(tagStart, tagEnd + 1);
}

test("02-1·02-2·02-3은 한 번에 하나만 보이는 단계 패널로 나뉜다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(openingTag(html, "1"), /data-step-panel="1"/);
  assert.doesNotMatch(openingTag(html, "1"), /\bhidden\b/);
  assert.match(openingTag(html, "2"), /\bhidden\b/);
  assert.match(openingTag(html, "3"), /\bhidden\b/);
  // 결과 정리(02-3)는 BFS 관찰(02-2)과 분리된 독립 패널이어야 한다.
  const puzzleGameEnd = html.indexOf("</section>", html.indexOf('data-step-panel="2"'));
  const resultsPanelStart = html.indexOf('data-step-panel="3"');
  assert.ok(resultsPanelStart > puzzleGameEnd, "02-3 패널은 02-2 패널이 끝난 뒤 별도 section이어야 합니다");
  assert.ok(html.indexOf('id="puzzle-results"') > resultsPanelStart);
});

test("접근 가능한 단계 탭(stepper)이 있고 잠긴 단계는 disabled로 표시된다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<nav class="step-tabs" aria-label="8-퍼즐 활동 단계">/);
  assert.match(html, /data-step-tab="1"[^>]*aria-current="step"/);
  assert.match(html, /data-step-tab="2"[^>]*disabled/);
  assert.match(html, /data-step-tab="3"[^>]*disabled/);
});

test("하단에 이전/다음 단계 버튼과 현재 단계 표시가 있다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<div class="step-bottom-nav">/);
  assert.match(html, /id="step-prev"[^>]*disabled/);
  assert.match(html, /id="step-next"/);
  assert.match(html, /id="step-nav-status"/);
  assert.match(html, /id="step-nav-hint"/);
});

test("02-1을 완료하기 전에는 02-2로 넘어갈 수 없고, 완료 시 이벤트로 잠금이 풀린다", async () => {
  const [gameJs, playJs] = await Promise.all([
    readFile(new URL("game.js", lessonRoot), "utf8"),
    readFile(new URL("game.js", playRoot), "utf8"),
  ]);
  assert.match(playJs, /document\.dispatchEvent\(new CustomEvent\("eight-puzzle:play-complete"\)\)/);
  assert.match(gameJs, /addEventListener\("eight-puzzle:play-complete"/);
  assert.match(gameJs, /function markStep1Done/);
  assert.match(gameJs, /function maxUnlockedStep/);
  assert.match(gameJs, /if \(stepState\.step2Done\) return 3;/);
  assert.match(gameJs, /if \(stepState\.step1Done\) return 2;/);
  const completeHandler = gameJs.match(/document\.addEventListener\("eight-puzzle:play-complete", \(\) => \{([\s\S]*?)\n\}\);/);
  assert.ok(completeHandler, "8-퍼즐 완료 이벤트 처리기를 찾을 수 없음");
  assert.match(completeHandler[1], /markStep1Done\(\)/);
  assert.doesNotMatch(completeHandler[1], /goToStep\(2\)/, "완성 즉시 자동으로 2단계로 이동하면 안 됨");
  assert.match(gameJs, /stepEl\.goto2\?\.addEventListener\("click", \(\) => goToStep\(2\)\)/);
});

test("BFS 층별 관찰(02-2)의 누적 상태 로직은 그대로 보존된다", async () => {
  const gameJs = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(gameJs, /function createInitialLevel/);
  assert.match(gameJs, /function candidateLevel/);
  assert.match(gameJs, /function expandState/);
  assert.match(gameJs, /seenThisLevel/);
  assert.doesNotMatch(gameJs, /el\.levels\.innerHTML\s*=\s*""/);
  assert.doesNotMatch(gameJs, /el\.trace\.hidden\s*=\s*true/);
});

test("결과(02-3)는 BFS 완료 시 자동으로 다음 단계로 넘어가며 결정론적으로 재구성된다", async () => {
  const gameJs = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(gameJs, /function buildResults/);
  assert.match(gameJs, /function finish\(\{ focus = true \} = \{\}\)/);
  assert.match(gameJs, /markStep2Done\(\);\s*\n\s*goToStep\(3, \{ focus: false \}\);/);
  // 새로고침으로 되돌아와도(결정론적 BFS/DFS 계산 결과이므로) 결과 화면을 조용히 다시 만들 수 있다.
  assert.match(gameJs, /if \(stepState\.step2Done\) buildResults\(\);/);
  assert.match(gameJs, /goToStep\(stepState\.step, \{ focus: false \}\);/);
});

test("단계 진행 상태는 세션 한정(sessionStorage)으로만 저장되고 다른 저장소는 쓰지 않는다", async () => {
  const gameJs = await readFile(new URL("game.js", lessonRoot), "utf8");
  assert.match(gameJs, /const STEP_STORAGE_KEY = "search-eight-puzzle:step:v1";/);
  assert.match(gameJs, /sessionStorage\.getItem\(STEP_STORAGE_KEY\)/);
  assert.match(gameJs, /sessionStorage\.setItem\(STEP_STORAGE_KEY/);
  assert.doesNotMatch(gameJs, /localStorage/);
  // 저장소를 쓸 수 없는 환경(예: 시크릿 모드 제한)에서도 페이지가 깨지지 않아야 한다.
  assert.match(gameJs, /function loadStepState\(\) \{\s*\n\s*try \{/);
  // saveStepState는 로컬 미리보기 중에는 아무것도 저장하지 않고 즉시 반환한 뒤에 try/sessionStorage로 이어진다
  // (tests/search-eight-puzzle-preview.test.mjs에서 previewActive 가드를 더 자세히 검증한다).
  assert.match(gameJs, /function saveStepState\(\) \{\s*\n\s*if \(previewActive\) return;\s*\n\s*try \{/);
});

test("모바일에서 단계 탭과 하단 버튼이 줄바꿈되어 잘리지 않는다", async () => {
  const css = await readFile(new URL("styles.css", lessonRoot), "utf8");
  assert.match(css, /\.step-tabs ol \{[^}]*flex-wrap:wrap/);
  assert.match(css, /@media\(max-width:600px\)\{[\s\S]*\.step-tabs li \{ flex:1 1 100%; \}/);
  assert.match(css, /@media\(max-width:600px\)\{[\s\S]*\.step-bottom-nav \{ flex-direction:column/);
  assert.match(css, /@media\(max-width:600px\)\{[\s\S]*\.step-nav-button \{ width:100%; \}/);
});

test("외부 자료의 코드를 그대로 가져오지 않고 CDN 의존성을 추가하지 않는다", async () => {
  const [html, css, gameJs] = await Promise.all([
    readFile(new URL("index.html", lessonRoot), "utf8"),
    readFile(new URL("styles.css", lessonRoot), "utf8"),
    readFile(new URL("game.js", lessonRoot), "utf8"),
  ]);
  assert.doesNotMatch(html, /cdn\.|tailwindcss|d3js|d3\.v7|font-awesome|tone\.js/i);
  assert.doesNotMatch(css, /@import url\(.*(cdn|googleapis)/i);
  // game.js는 참고자료 사이트의 코드를 전혀 옮겨오지 않는다(iframe/lazy-load 로직 없이 순수 링크 카드).
  assert.doesNotMatch(gameJs, /d3\.|tailwind|Tone\.|tone\.js|kankanssam/i);
  // 참고자료는 실행 사이트 링크 한 곳만 남기고, 원본 저장소 링크는 완전히 제거되었다.
  const executeSrcMentions = (html.match(/kankanssam\.github\.io\/Uninformed_Search/g) || []).length;
  const repoLinkMentions = (html.match(/github\.com\/kankanssam\/Uninformed_Search/g) || []).length;
  assert.equal(executeSrcMentions, 1, "실행 사이트 링크는 한 곳에만 있어야 합니다");
  assert.equal(repoLinkMentions, 0, "GitHub 저장소 링크는 더 이상 없어야 합니다");
});

test("건너뛰기 링크는 항상 화면에 보이는 요소를 가리킨다", async () => {
  const html = await readFile(new URL("index.html", lessonRoot), "utf8");
  assert.match(html, /<a class="skip-link" href="#game-title">활동으로 바로가기<\/a>/);
});
