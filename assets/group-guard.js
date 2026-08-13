// 허브/그룹/활동 페이지가 공통으로 쓰는 활성화 가드.
// data/activity-groups.json을 런타임에 불러와 group.active(및 개별 활동의 child.active)를 확인하고,
// 허브에서는 비활성 그룹 카드의 이동을 막고, 그룹·활동 페이지에서는 콘텐츠 대신 "준비 중" 안내를 보여준다.
// 실제 접근 차단(보안 경계)은 그룹·활동 페이지(guardPage)에서만 일어나며, 그곳은 로드 실패 시 항상
// 보수적으로(비활성 취급) 처리한다. 반면 허브 카드(guardHub)는 안내용 진입점일 뿐이므로, JSON을
// 불러오지 못했다고 해서(예: file://로 직접 열었거나 네트워크가 불안정한 경우) 이미 화면에 나와 있는
// 모든 활동지 카드를 영구히 잠그지 않는다 — 실패 시에는 카드를 열어 두고(fail-open) 안내 문구만 보여준다.
//
// 개별 활동(child)도 그룹과 같은 방식으로 켜고 끌 수 있다: 활동 페이지는 <body>에
// data-guard-lesson="<child-id>"를 추가로 선언하면(그룹이 active여도) 그 child가
// active=false일 때 접근이 차단된다. 그룹 목록 페이지(units/<group>/index.html)의
// 각 활동 카드에 data-lesson-card="<child-id>"를 붙이면, 허브의 그룹 카드와 동일하게
// 비활성 활동 카드만 잠기고(fail-open, 목록 fetch 실패 시에는 전부 열어 둠) 클릭이 막힌다.
const GROUPS_URL = new URL("../data/activity-groups.json", import.meta.url);

async function fetchGroups() {
  const response = await fetch(GROUPS_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`활동지 정보를 불러오지 못했습니다 (${response.status})`);
  const data = await response.json();
  if (!data || !Array.isArray(data.groups)) throw new Error("활동지 데이터 형식이 올바르지 않습니다");
  return data.groups;
}

function isActiveGroup(group) {
  return Boolean(group) && group.active === true;
}

function isActiveChild(child) {
  return Boolean(child) && child.active === true;
}

function markCardLocked(card, isError) {
  card.classList.add("group-card--locked");
  card.setAttribute("aria-disabled", "true");
  if (!card.querySelector(".group-status-badge")) {
    const badge = document.createElement("span");
    badge.className = "group-status-badge";
    badge.textContent = isError ? "상태 확인 필요" : "준비 중";
    card.appendChild(badge);
  }
}

async function guardHub() {
  const cards = Array.from(document.querySelectorAll("[data-group-card]"));
  const status = new Map(cards.map((card) => [card, "pending"]));
  cards.forEach((card) => {
    card.addEventListener("click", (event) => {
      if (status.get(card) !== "active") event.preventDefault();
    });
  });
  try {
    const groups = await fetchGroups();
    const byId = new Map(groups.map((group) => [group.id, group]));
    cards.forEach((card) => {
      const group = byId.get(card.dataset.groupCard);
      if (isActiveGroup(group)) {
        status.set(card, "active");
      } else {
        status.set(card, "inactive");
        markCardLocked(card, false);
      }
    });
  } catch (error) {
    // 최신 active 상태를 확인하지 못했을 뿐, 이미 허브에 카드가 존재하는 활동지는 게시된 것으로 간주하고
    // 그대로 열어 둔다. 실제로 비활성인 활동지라면 이동한 뒤 그룹·활동 페이지의 guardPage가 막는다.
    cards.forEach((card) => status.set(card, "active"));
    const errorBox = document.getElementById("groups-load-error");
    if (errorBox) errorBox.hidden = false;
  }
}

async function guardPage() {
  const groupId = document.body.dataset.guardGroup;
  if (!groupId) return;
  const lessonId = document.body.dataset.guardLesson;

  // 활동 페이지(data-guard-lesson 있음)에는 하위 카드가 없다. 그룹 목록 페이지에만
  // data-lesson-card가 있으므로, 있으면 허브 카드와 같은 방식으로 잠금을 준비해 둔다.
  const lessonCards = lessonId ? [] : Array.from(document.querySelectorAll("[data-lesson-card]"));
  const cardStatus = new Map(lessonCards.map((card) => [card, "pending"]));
  lessonCards.forEach((card) => {
    card.addEventListener("click", (event) => {
      if (cardStatus.get(card) !== "active") event.preventDefault();
    });
  });

  try {
    const groups = await fetchGroups();
    const group = groups.find((candidate) => candidate.id === groupId);
    let active = isActiveGroup(group);
    if (active && lessonId) {
      const child = group.children.find((candidate) => candidate.id === lessonId);
      active = isActiveChild(child);
    }
    document.documentElement.setAttribute("data-guard", active ? "active" : "blocked");

    if (lessonCards.length > 0) {
      const byId = new Map((group?.children ?? []).map((child) => [child.id, child]));
      lessonCards.forEach((card) => {
        const child = byId.get(card.dataset.lessonCard);
        if (isActiveChild(child)) {
          cardStatus.set(card, "active");
        } else {
          cardStatus.set(card, "inactive");
          markCardLocked(card, false);
        }
      });
    }
  } catch (error) {
    // 그룹 목록 페이지 자체가 이미 fail-closed로 막히므로(위 catch가 data-guard를 blocked로
    // 남겨 둠), 그 안의 활동 카드까지 따로 열어 둘 필요가 없다 — 허브와 달리 이 페이지는
    // 활성 상태를 확인 못 하면 콘텐츠 전체가 보이지 않는다.
    document.documentElement.setAttribute("data-guard", "blocked");
  }
}

const scope = document.body?.dataset.guardScope;
if (scope === "hub") guardHub();
if (scope === "page") guardPage();
