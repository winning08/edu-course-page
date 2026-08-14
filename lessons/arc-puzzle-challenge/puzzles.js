// ARC-AGI-1 공식 공개 evaluation JSON을 화면용 정보와 결합한다.
// 격자는 lessons/arc-puzzle-challenge/official-tasks/*.json에 원본 그대로 보존하며,
// 아래에는 수업용 제목·순서·힌트만 둔다.
// 출처: François Chollet, ARC-AGI, Apache License 2.0
// https://github.com/fchollet/ARC-AGI/tree/master/data/evaluation

export const PUZZLE_DEFINITIONS = [
  {
    id: "quadrant-colors",
    sourceId: "19bb5feb",
    title: "색깔의 위치 찾기",
    tier: "required",
    difficulty: "쉬움",
    hint: "큰 그림 속 색깔 네모가 왼쪽 위·오른쪽 위·왼쪽 아래·오른쪽 아래 중 어디에 있는지 살펴보세요.",
  },
  {
    id: "count-bars",
    sourceId: "5289ad53",
    title: "색 막대의 길이 세기",
    tier: "required",
    difficulty: "보통",
    hint: "초록색 막대와 빨간색 막대가 각각 몇 칸인지 세고, 작은 출력의 두 줄과 비교해 보세요.",
  },
  {
    id: "spiral-path",
    sourceId: "e5c44e8f",
    title: "중심에서 길 이어가기",
    tier: "required",
    difficulty: "어려움 1",
    hint: "가운데 초록색 칸에서 시작해 바깥쪽으로 이어지는 길의 모양을 찾아보세요. 빨간색 칸은 길을 멈추게 합니다.",
  },
  {
    id: "match-shapes",
    sourceId: "604001fa",
    title: "같은 모양끼리 찾기",
    tier: "required",
    difficulty: "어려움 2",
    hint: "주황색 조각과 파란색 조각을 방향을 돌려 비교해 보세요. 같은 모양인 두 조각은 출력에서 같은 새 색을 얻습니다.",
  },
  {
    id: "fit-the-gap",
    sourceId: "1acc24af",
    title: "빈틈에 맞는 도형 찾기",
    tier: "bonus",
    difficulty: "Expert",
    hint: "위쪽 파란 선의 빈틈 모양과 아래쪽 회색 도형을 비교하세요. 돌리거나 뒤집지 않고 꼭 맞는 도형만 찾습니다.",
  },
];

function isArcTask(task) {
  return task && Array.isArray(task.train) && Array.isArray(task.test)
    && task.train.length > 0 && task.test.length > 0;
}

export async function loadPuzzles(fetchImpl = fetch) {
  return Promise.all(PUZZLE_DEFINITIONS.map(async (definition) => {
    const url = new URL(`./official-tasks/${definition.sourceId}.json`, import.meta.url);
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`ARC 문제 ${definition.sourceId}를 불러오지 못했습니다.`);
    const task = await response.json();
    if (!isArcTask(task)) throw new Error(`ARC 문제 ${definition.sourceId}의 형식이 올바르지 않습니다.`);
    return {
      ...definition,
      train: task.train,
      test: task.test[0],
    };
  }));
}
