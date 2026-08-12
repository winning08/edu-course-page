import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);

async function loadGroups() {
  const raw = await readFile(new URL("data/activity-groups.json", repoRoot), "utf8");
  return JSON.parse(raw);
}

const GROUP_PAGES = {
  "ai-learning": ["units/ai-learning/index.html", "lessons/ai-inference-ripeness/index.html", "lessons/ai-signal-noise/index.html", "lessons/ai-biased-data/index.html"],
  "ai-vocabulary": ["units/ai-vocabulary/index.html", "lessons/ai-keyword-bingo/index.html"],
};

test("모든 group은 명시적인 active boolean 필드를 갖는다", async () => {
  const data = await loadGroups();
  assert.ok(data.groups.length >= 2);
  for (const group of data.groups) {
    assert.equal(typeof group.active, "boolean", `${group.id}의 active가 boolean이 아님`);
  }
});

test("새 그룹 ai-vocabulary는 초기 active=true다", async () => {
  const data = await loadGroups();
  const group = data.groups.find((candidate) => candidate.id === "ai-vocabulary");
  assert.ok(group, "ai-vocabulary group을 찾을 수 없음");
  assert.equal(group.active, true);
  assert.equal(group.children.length, 1);
  assert.equal(group.children[0].id, "ai-keyword-bingo");
});

test("기존 ai-learning 그룹도 active=true로 명시되어 있다", async () => {
  const data = await loadGroups();
  const group = data.groups.find((candidate) => candidate.id === "ai-learning");
  assert.ok(group);
  assert.equal(group.active, true);
});

test("assets/group-guard.js와 assets/guard.css가 존재하고, 로더는 data/activity-groups.json을 스스로의 위치 기준 상대 경로로 불러온다", async () => {
  const [js, css] = await Promise.all([
    readFile(new URL("assets/group-guard.js", repoRoot), "utf8"),
    readFile(new URL("assets/guard.css", repoRoot), "utf8"),
  ]);
  assert.ok(js.length > 0);
  assert.ok(css.length > 0);
  assert.match(js, /import\.meta\.url/);
  assert.match(js, /\.\.\/data\/activity-groups\.json/);
  assert.match(js, /fetch\(/);
});

test("루트 허브는 hub 스코프 가드를 선언하고, 모든 group에 data-group-card를 붙인다", async () => {
  const [html, data] = await Promise.all([
    readFile(new URL("index.html", repoRoot), "utf8"),
    loadGroups(),
  ]);
  assert.match(html, /data-guard-scope="hub"/);
  assert.match(html, /assets\/group-guard\.js/);
  assert.match(html, /assets\/guard\.css/);
  for (const group of data.groups) {
    assert.match(html, new RegExp(`data-group-card="${group.id}"`), `허브에 ${group.id}의 data-group-card가 없음`);
  }
});

test("guard.css는 잠금 배지가 .group-card의 grid-template-columns 3열을 깨지 않도록 전체 폭 행으로 배치한다", async () => {
  const css = await readFile(new URL("assets/guard.css", repoRoot), "utf8");
  assert.match(
    css,
    /\.group-card\s*>\s*\.group-status-badge\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/,
    "group-status-badge가 grid-column: 1 / -1로 전체 폭 행에 배치되어야 함(3열 grid 4번째 자식으로 끼어들며 레이아웃이 깨지는 문제 방지)"
  );
});

test("group-guard.js의 허브 가드는 fetch 실패 시(catch) 카드를 잠그지 않고 열어 둔다(fail-open)", async () => {
  const js = await readFile(new URL("assets/group-guard.js", repoRoot), "utf8");
  const catchBlockMatch = js.match(/async function guardHub[\s\S]*?catch \(error\) \{([\s\S]*?)\n\}/);
  assert.ok(catchBlockMatch, "guardHub의 catch 블록을 찾을 수 없음");
  assert.doesNotMatch(catchBlockMatch[1], /markCardLocked/, "허브 fetch 실패 시 카드를 잠그면 안 됨(file:// 등에서 모든 카드가 영구 잠기는 문제)");
  assert.match(catchBlockMatch[1], /status\.set\(card, "active"\)/, "허브 fetch 실패 시 카드를 active로 되돌려(fail-open) 클릭이 통과되어야 함");
});

test("모든 unit·lesson 페이지는 공통 가드(pending 초기 상태, 소속 group-id, 준비 중 안내, 홈 복귀 링크)를 갖는다", async () => {
  for (const [groupId, pages] of Object.entries(GROUP_PAGES)) {
    for (const page of pages) {
      const html = await readFile(new URL(page, repoRoot), "utf8");
      assert.match(html, /data-guard\("pending"\)|setAttribute\("data-guard", "pending"\)/, `${page}에 초기 pending 가드 스크립트가 없음`);
      assert.match(html, new RegExp(`data-guard-scope="page"[^>]*data-guard-group="${groupId}"|data-guard-group="${groupId}"[^>]*data-guard-scope="page"`), `${page}의 data-guard-group이 ${groupId}가 아님`);
      assert.match(html, /id="guard-blocked"/, `${page}에 guard-blocked 안내가 없음`);
      assert.match(html, /id="guard-content"/, `${page}에 guard-content 래퍼가 없음`);
      assert.match(html, /class="guard-home-link"/, `${page}에 홈 복귀 링크가 없음`);
      assert.match(html, /assets\/group-guard\.js/, `${page}에 group-guard.js 로드가 없음`);
      assert.match(html, /assets\/guard\.css/, `${page}에 guard.css 로드가 없음`);
    }
  }
});
