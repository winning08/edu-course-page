import assert from "node:assert/strict";
import test from "node:test";

// assets/group-guard.js는 브라우저 DOM(document/fetch)에 의존하는 ES 모듈이므로,
// 실제 런타임 동작(허브 fail-open, 페이지 fail-closed)을 검증하기 위해 최소한의 DOM을 직접 흉내낸다.
// 모듈은 import 시점에 즉시 guardHub()/guardPage()를 실행하므로, 매 테스트마다 전역(document/fetch)을
// 새로 세팅한 뒤 캐시 우회용 쿼리스트링으로 모듈을 다시 import한다.

let importCounter = 0;
async function loadGuardModule() {
  importCounter += 1;
  const url = new URL("../assets/group-guard.js", import.meta.url);
  url.search = `case=${importCounter}`;
  await import(url.href);
}

function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

class FakeElement {
  constructor({ dataset = {} } = {}) {
    this.dataset = dataset;
    this.classNames = new Set();
    this.attributes = new Map();
    this.children = [];
    this.listeners = {};
    this.hidden = undefined;
  }
  addEventListener(type, handler) {
    (this.listeners[type] ??= []).push(handler);
  }
  dispatchClick() {
    const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    for (const handler of this.listeners.click ?? []) handler(event);
    return event;
  }
  get classList() {
    return {
      add: (name) => this.classNames.add(name),
      contains: (name) => this.classNames.has(name),
    };
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  querySelector(selector) {
    if (selector === ".group-status-badge") {
      return this.children.find((child) => child.className === "group-status-badge") ?? null;
    }
    return null;
  }
  appendChild(node) {
    this.children.push(node);
  }
}

function setupDom({ scope, guardGroup, guardLesson, cardIds = [], lessonCardIds = [], hostname = "ivymso13.github.io" } = {}) {
  const cards = cardIds.map((id) => new FakeElement({ dataset: { groupCard: id } }));
  const lessonCards = lessonCardIds.map((id) => new FakeElement({ dataset: { lessonCard: id } }));
  const errorBox = new FakeElement();
  const documentElementAttrs = new Map();
  globalThis.document = {
    body: { dataset: { guardScope: scope, ...(guardGroup ? { guardGroup } : {}), ...(guardLesson ? { guardLesson } : {}) } },
    documentElement: { setAttribute: (name, value) => documentElementAttrs.set(name, value) },
    querySelectorAll: (selector) => {
      if (selector === "[data-group-card]") return cards;
      if (selector === "[data-lesson-card]") return lessonCards;
      return [];
    },
    getElementById: (id) => (id === "groups-load-error" ? errorBox : null),
    createElement: () => new FakeElement(),
  };
  globalThis.location = { hostname };
  return { cards, lessonCards, errorBox, documentElementAttrs };
}

test("허브: JSON fetch가 실패해도(file:// 등) 이미 카드가 있는 활동지는 영구 잠기지 않고 클릭이 통과된다(fail-open)", async () => {
  const { cards, errorBox } = setupDom({ scope: "hub", cardIds: ["ai-learning", "ai-vocabulary"] });
  globalThis.fetch = async () => {
    throw new Error("file:// 환경에서는 fetch를 쓸 수 없음");
  };

  await loadGuardModule();
  await flushMicrotasks();

  for (const card of cards) {
    assert.equal(card.classNames.has("group-card--locked"), false, `${card.dataset.groupCard} 카드가 잠겨 있음`);
    const event = card.dispatchClick();
    assert.equal(event.defaultPrevented, false, `${card.dataset.groupCard} 카드 클릭이 막혀 있음`);
  }
  assert.equal(errorBox.hidden, false, "오류 안내 문구가 표시되지 않음");
});

test("허브: JSON fetch가 성공하면 active=false인 그룹 카드만 잠기고 active=true 카드는 그대로 열린다", async () => {
  const { cards } = setupDom({ scope: "hub", cardIds: ["ai-learning", "ai-vocabulary"] });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      groups: [
        { id: "ai-learning", active: true },
        { id: "ai-vocabulary", active: false },
      ],
    }),
  });

  await loadGuardModule();
  await flushMicrotasks();

  const [activeCard, inactiveCard] = cards;
  assert.equal(activeCard.classNames.has("group-card--locked"), false);
  assert.equal(activeCard.dispatchClick().defaultPrevented, false);

  assert.equal(inactiveCard.classNames.has("group-card--locked"), true);
  assert.equal(inactiveCard.attributes.get("aria-disabled"), "true");
  assert.equal(inactiveCard.dispatchClick().defaultPrevented, true);
  assert.ok(inactiveCard.children.some((child) => child.className === "group-status-badge"));
});

test("로컬 허브: active=false인 그룹도 개발 중에는 클릭할 수 있다", async () => {
  const { cards } = setupDom({ scope: "hub", cardIds: ["ai-search"], hostname: "127.0.0.1" });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ groups: [{ id: "ai-search", active: false }] }),
  });

  await loadGuardModule();
  await flushMicrotasks();

  assert.equal(cards[0].classNames.has("group-card--locked"), false);
  assert.equal(cards[0].dispatchClick().defaultPrevented, false);
});

test("그룹·활동 페이지: JSON fetch가 실패하면 여전히 보수적으로 접근을 차단한다(fail-closed, 보안 경계는 그대로 유지)", async () => {
  const { documentElementAttrs } = setupDom({ scope: "page", guardGroup: "ai-learning" });
  globalThis.fetch = async () => {
    throw new Error("네트워크 오류");
  };

  await loadGuardModule();
  await flushMicrotasks();

  assert.equal(documentElementAttrs.get("data-guard"), "blocked");
});

test("그룹·활동 페이지: 배포 환경에서 active=false인 그룹은 직접 URL로 접근해도 차단된다", async () => {
  const { documentElementAttrs } = setupDom({ scope: "page", guardGroup: "ai-vocabulary" });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ groups: [{ id: "ai-vocabulary", active: false }] }),
  });

  await loadGuardModule();
  await flushMicrotasks();

  assert.equal(documentElementAttrs.get("data-guard"), "blocked");
});

test("로컬 그룹·활동 페이지: active=false여도 localhost에서는 콘텐츠가 열린다", async () => {
  const { documentElementAttrs } = setupDom({
    scope: "page", guardGroup: "ai-search", guardLesson: "search-cost-delivery", hostname: "localhost",
  });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      groups: [{
        id: "ai-search", active: false,
        children: [{ id: "search-cost-delivery", active: false }],
      }],
    }),
  });

  await loadGuardModule();
  await flushMicrotasks();

  assert.equal(documentElementAttrs.get("data-guard"), "active");
});

test("그룹·활동 페이지: active=true인 그룹은 정상적으로 콘텐츠가 열린다", async () => {
  const { documentElementAttrs } = setupDom({ scope: "page", guardGroup: "ai-learning" });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ groups: [{ id: "ai-learning", active: true }] }),
  });

  await loadGuardModule();
  await flushMicrotasks();

  assert.equal(documentElementAttrs.get("data-guard"), "active");
});

test("활동 페이지: 그룹은 active여도 그 활동 자신(child)이 active=false면 차단된다", async () => {
  const { documentElementAttrs } = setupDom({
    scope: "page", guardGroup: "ai-evaluation", guardLesson: "turing-vs-arc-compare",
  });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      groups: [{
        id: "ai-evaluation", active: true,
        children: [
          { id: "turing-test-questions", active: true },
          { id: "turing-vs-arc-compare", active: false },
        ],
      }],
    }),
  });

  await loadGuardModule();
  await flushMicrotasks();

  assert.equal(documentElementAttrs.get("data-guard"), "blocked");
});

test("활동 페이지: 그룹과 그 활동(child) 둘 다 active여야 정상적으로 열린다", async () => {
  const { documentElementAttrs } = setupDom({
    scope: "page", guardGroup: "ai-evaluation", guardLesson: "turing-test-questions",
  });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      groups: [{
        id: "ai-evaluation", active: true,
        children: [
          { id: "turing-test-questions", active: true },
          { id: "turing-vs-arc-compare", active: false },
        ],
      }],
    }),
  });

  await loadGuardModule();
  await flushMicrotasks();

  assert.equal(documentElementAttrs.get("data-guard"), "active");
});

test("활동지 목록 페이지: 그룹이 active면, 그 안의 활동 카드 중 active=false인 child의 카드만 잠기고 클릭이 막힌다(fail-open 방식은 허브와 동일)", async () => {
  const { lessonCards, documentElementAttrs } = setupDom({
    scope: "page", guardGroup: "ai-evaluation",
    lessonCardIds: ["turing-test-questions", "turing-vs-arc-compare"],
  });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      groups: [{
        id: "ai-evaluation", active: true,
        children: [
          { id: "turing-test-questions", active: true },
          { id: "turing-vs-arc-compare", active: false },
        ],
      }],
    }),
  });

  await loadGuardModule();
  await flushMicrotasks();

  assert.equal(documentElementAttrs.get("data-guard"), "active");

  const [activeCard, inactiveCard] = lessonCards;
  assert.equal(activeCard.classNames.has("group-card--locked"), false);
  assert.equal(activeCard.dispatchClick().defaultPrevented, false);

  assert.equal(inactiveCard.classNames.has("group-card--locked"), true);
  assert.equal(inactiveCard.attributes.get("aria-disabled"), "true");
  assert.equal(inactiveCard.dispatchClick().defaultPrevented, true);
  assert.ok(inactiveCard.children.some((child) => child.className === "group-status-badge"));
});
