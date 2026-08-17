import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);
const LESSON_IDS = ["ai-inference-ripeness", "ai-signal-noise", "ai-biased-data"];

test("루트 허브는 메인 제목과 활동지 카드를 보여주고 그룹 목록 페이지로 연결한다", async () => {
  const html = await readFile(new URL("index.html", repoRoot), "utf8");
  assert.match(html, /<title>인공지능 기초 활동지 모음<\/title>/);
  assert.match(html, /<h1>인공지능 기초 활동지 모음<\/h1>/);
  assert.match(html, /class="group-card" href="units\/ai-learning\/"/);
  assert.match(html, />AI는 어떻게 학습할까\?</);
  assert.doesNotMatch(html, /href="lessons\//, "루트 허브는 개별 lesson으로 바로 연결하지 않아야 함");
});

test("루트 허브 제목은 작은 화면과 브라우저 글꼴 차이에도 한 줄로 유지된다", async () => {
  const css = await readFile(new URL("assets/hub.css", repoRoot), "utf8");
  assert.match(css, /\.hub-header h1\s*\{[^}]*font-size:clamp\([^}]*white-space:nowrap/s);
});

test("활동지 목록 페이지는 세 활동을 01/02/03 순서로 등록하고 각 lesson 폴더로 직접 연결한다", async () => {
  const html = await readFile(new URL("units/ai-learning/index.html", repoRoot), "utf8");
  const positions = LESSON_IDS.map((id) => html.indexOf(`lessons/${id}/`));
  for (const [index, position] of positions.entries()) {
    assert.ok(position !== -1, `그룹 페이지에 lessons/${LESSON_IDS[index]}/ 링크가 없음`);
  }
  assert.ok(positions[0] < positions[1] && positions[1] < positions[2], "그룹 페이지의 활동 순서가 01/02/03이 아님");
  assert.match(html, />01</);
  assert.match(html, />02</);
  assert.match(html, />03</);
  for (const id of LESSON_IDS) {
    assert.match(html, new RegExp(`href="\\.\\./\\.\\./lessons/${id}/"`), `그룹 페이지의 ${id} 링크가 올바른 상대 경로가 아님`);
  }
});

test("세 활동 페이지의 상단 back-link는 활동지 목록 페이지로 돌아간다", async () => {
  for (const id of LESSON_IDS) {
    const html = await readFile(new URL(`lessons/${id}/index.html`, repoRoot), "utf8");
    assert.match(html, /class="back-link" href="\.\.\/\.\.\/units\/ai-learning\/"/, `${id}의 back-link가 그룹 페이지를 가리키지 않음`);
  }
});

test("data/lessons.json은 ai-learning 세 활동을 order 1/2/3, published 상태로 담는다", async () => {
  const raw = await readFile(new URL("data/lessons.json", repoRoot), "utf8");
  const data = JSON.parse(raw);
  assert.ok(data.lessons.length >= 3);
  const byId = Object.fromEntries(data.lessons.map((lesson) => [lesson.id, lesson]));
  for (const id of LESSON_IDS) {
    assert.ok(byId[id], `${id}가 lessons.json에 없음`);
    assert.equal(byId[id].status, "published");
    assert.equal(byId[id].path, `lessons/${id}/`);
  }
  assert.equal(byId["ai-inference-ripeness"].order, 1);
  assert.equal(byId["ai-signal-noise"].order, 2);
  assert.equal(byId["ai-biased-data"].order, 3);
});

test("세 활동 모두 독립 index.html·game-core.js·game.js·styles.css를 lessons/ 아래에 직접 갖는다", async () => {
  for (const id of LESSON_IDS) {
    for (const file of ["index.html", "game-core.js", "game.js", "styles.css"]) {
      const content = await readFile(new URL(`lessons/${id}/${file}`, repoRoot), "utf8");
      assert.ok(content.length > 0, `lessons/${id}/${file}가 비어 있음`);
    }
  }
});

test("각 활동 페이지는 lessons/shared/의 공통 자산을 상대 경로로 참조한다(외부 네트워크 요청 없음)", async () => {
  for (const id of ["ai-signal-noise", "ai-biased-data"]) {
    const [html, js] = await Promise.all([
      readFile(new URL(`lessons/${id}/index.html`, repoRoot), "utf8"),
      readFile(new URL(`lessons/${id}/game.js`, repoRoot), "utf8"),
    ]);
    assert.match(html, /href="\.\.\/shared\/lab-base\.css"/);
    assert.match(js, /from "\.\.\/shared\/specimen-visual\.js"/);
    assert.doesNotMatch(html, /https?:\/\//);
    assert.doesNotMatch(js, /https?:\/\//);
  }
});

test("shared 모듈은 유효한 함수를 내보내고 세 활동의 game-core.js가 공통으로 재사용한다", async () => {
  const sharedRandom = await import("../lessons/shared/random.js");
  assert.equal(typeof sharedRandom.seededRandom, "function");
  assert.equal(typeof sharedRandom.shuffle, "function");
  assert.equal(typeof sharedRandom.summarize, "function");

  for (const id of LESSON_IDS) {
    const gameCoreSource = await readFile(new URL(`lessons/${id}/game-core.js`, repoRoot), "utf8");
    assert.match(gameCoreSource, /from "\.\.\/shared\/random\.js"/, `${id}가 shared/random.js를 재사용하지 않음`);
  }
});

test("README는 세 활동 구조와 로컬 실행법을 설명한다", async () => {
  const readme = await readFile(new URL("README.md", repoRoot), "utf8");
  for (const id of LESSON_IDS) {
    assert.match(readme, new RegExp(`lessons/${id}/`));
  }
  assert.match(readme, /npm test/);
  assert.match(readme, /python3 -m http\.server/);
});
