# 인공지능 기초 활동지

여러 수업 활동을 독립 웹페이지로 제작하고 GitHub Pages에서 제공하기 위한 프로젝트입니다. 수업 시간에 진행할 **활동 묶음(그룹)** 을 루트 허브에서 고르면, 그 묶음에 속한 개별 활동 목록 페이지로 이동하고, 거기서 각 활동을 엽니다.

## 구조

- `index.html`: 활동 묶음 카드를 보여주는 최상위 허브. 아직 존재하지 않는 묶음은 카드로 만들지 않습니다.
- `units/<group-id>/index.html`: 묶음 하나에 속한 하위 활동을 01/02/03 순서로 보여주는 목록 페이지. 예: `units/ai-learning/`
- `lessons/<lesson-id>/`: 활동 하나의 독립 웹페이지(기존 URL은 이동·삭제하지 않습니다)
- `lessons/shared/`: 여러 활동이 함께 쓰는 CSS·JS 공통 자산
- `data/activity-groups.json`: 묶음(group)과 하위 활동(children)을 함께 관리하는 확장용 스키마. group마다 `id/order/title/description/path/status/children`을, children마다 `id/order/title/path/duration/difficulty/status/objective`를 가집니다. 정적 사이트라 런타임에 fetch하지 않고, 루트/그룹 페이지의 HTML을 직접 최신 상태로 유지하는 **관리 원본이자 검증 소스**로 씁니다(`tests/activity-groups.test.mjs`가 HTML과 JSON이 어긋나지 않는지 확인).
- `data/lessons.json`: 활동별 메타데이터를 담은 기존 평면 목록(하위 호환용으로 그대로 유지). `activity-groups.json`의 각 child와 id·order·path·duration·difficulty가 일치해야 합니다.
- `tests/`: 수업 로직과 정적 페이지 구조를 확인하는 테스트 하네스

### 새 활동 묶음을 추가하려면

1. `units/<새-group-id>/index.html`을 만들고, 기존 `units/ai-learning/index.html`을 참고해 헤더(뒤로가기·묶음 제목·소개)와 하위 활동 카드 목록을 작성합니다.
2. `data/activity-groups.json`의 `groups` 배열에 새 group 객체(id/order/title/description/path/status/children)를 추가합니다.
3. 루트 `index.html`의 `.group-grid` 안에 새 `.group-card`를 추가하고 `units/<새-group-id>/`로 연결합니다. 아직 활동이 없는 빈 묶음 카드는 만들지 않습니다.
4. `npm test`로 스키마·링크 검증 테스트가 통과하는지 확인합니다.

### 기존 묶음에 하위 활동을 추가하려면

1. `lessons/<새-lesson-id>/`에 독립 웹페이지를 만듭니다(다른 활동처럼 `index.html`·`game-core.js`·`game.js`·`styles.css`, 필요하면 `lessons/shared/`의 공통 자산 재사용).
2. 해당 묶음의 `units/<group-id>/index.html`에 새 `.lesson-card`를 순서(01/02/03…)에 맞게 추가하고 `../../lessons/<새-lesson-id>/`로 연결합니다.
3. `data/activity-groups.json`의 해당 group `children` 배열과 `data/lessons.json`의 `lessons` 배열에 같은 내용(id/order/title/path/duration/difficulty/status, children에는 objective 추가)을 등록합니다.
4. 이웃 활동들의 상단 back-link(`../../units/<group-id>/`)와 하단 이전/다음 이동 링크를 새 활동을 포함하도록 갱신합니다.

## 활동 묶음 01 · AI는 어떻게 학습할까? (마트 AI 실습실)

같은 마트 과일 선별 AI를 소재로 세 활동이 이어지는, 루트 허브의 첫 번째 활동 묶음입니다. 묶음 목록 페이지는 `units/ai-learning/`이고, 각 활동은 `lessons/` 아래 독립된 URL로 바로 열립니다. 화면 상단 back-link와 하단(그리고 활동 01은 결과 화면에도)의 이동 링크는 `units/ai-learning/`(활동 묶음 목록)으로 돌아가며, 활동 03의 결과 화면에는 전체 활동지 홈(`/`)으로 가는 링크도 별도로 있습니다. 활동 간 이전/다음 링크는 그대로 유지됩니다.

1. **`lessons/ai-inference-ripeness/`(잘 익은 과일 찾기)** — 마트의 과일 선별 AI 역할을 맡아 과일의 색깔과 촉감을 함께 보고 익음 여부를 예측하는 실습입니다. 먼저 과일 12개로 AI를 학습시키며 매번 정답과 O/X를 바로 확인하고, 학습이 끝나면 전환 화면에서 12개 전체 결과표로 색깔·촉감과 판단을 한눈에 비교합니다. 이어서 같은 판단 규칙을 다른 과일 5개에 적용해 한 화면에 모두 띄워 놓고 다섯 문제를 동시에 답한 뒤 한 번에 제출해 실제 시험을 치릅니다. 시험 중과 제출 후 모두 문제별 정답은 공개되지 않고 전체 점수만 확인할 수 있어, 학습 때 찾은 규칙이 새로운 과일에도 통하는지 스스로 검증하게 됩니다. 결과 화면에는 활동과 AI 개념(입력 정보·학습 자료·학습·시험·시험 정확도)을 연결하는 정리와, "AI는 말로 규칙을 찾지 않고 자료를 계산하며 판단 기준을 조정한다"는 짧은 오개념 방지 문장이 있습니다.
2. **`lessons/ai-signal-noise/`(정보가 많으면 더 정확할까?)** — 같은 마트 AI에 색깔·촉감과 함께 **계절** 정보를 추가로 알려주는 후속 임무입니다. 학습 자료는 색깔·촉감이 같고 계절만 다른 비교쌍 6개(익음 3·안 익음 3)를 정확히 두 번씩 보여주도록 구성되어, 계절이 달라도 정답은 같다는 사실을 학생이 직접 비교할 수 있습니다. 학습 12개를 마치면 전체 결과표를 먼저 보여주고, "색깔·촉감·계절 중 판단에 도움이 되지 않은 정보는?"이라는 질문에 스스로 답한 뒤에야 정답과 해설이 공개됩니다. 이어서 처음 보는 과일 5개를 한 화면에서 동시에 시험 치르며(개별 정답은 비공개, 전체 점수만 공개), 결과 화면에서 "정보가 많다고 항상 더 좋은 것은 아니다"와 "노이즈(판단과 관계없는 정보)" 개념을 정리합니다.
3. **`lessons/ai-biased-data/`(학습 자료가 한쪽으로 치우치면?)** — 같은 마트 AI를 이번에는 창고 과일 12개로만 학습시키는데, 자료가 의도적으로 초록 5개·빨강 4개·노랑 2개·주황 1개로 치우쳐 있고 노랑·주황의 촉감 조합은 충분히 등장하지 않습니다. 학습을 마치면 색깔별 개수를 막대로 보여주고 "가장 적게 등장한 색깔은?"을 학생이 먼저 답한 뒤 해설을 공개합니다. 이어지는 시험 8문제는 노랑·주황의 단단함·중간·말랑함을 모두 포함하도록 균형 있게 구성되어, 학습 자료만 보고 만든 단순한 규칙의 한계가 드러납니다. 시험 중에는 정답이 공개되지 않고, 종료 후 전체 점수와 함께 색깔별 정확도표를 제공합니다(문항별 정답은 노출하지 않음). 결과 화면에서 "학습 자료가 한쪽으로 치우친 것"을 쉬운 말로 설명한 뒤 **편향된 데이터**라는 용어를 소개합니다.

세 활동 모두 활동1의 실험실/마트 디자인 언어와 과일 SVG, 접근성 장치(키보드 포커스, `aria-live`, `fieldset`/`legend`, `prefers-reduced-motion`)를 공유합니다. 공통 코드와 스타일은 `lessons/shared/`(난수·집계 유틸, 과일 SVG, 공통 CSS)에 모아 유지보수하고, 각 활동의 정답 판정 규칙은 학습 시점 이전에는 화면에 노출하지 않습니다.

## 로컬 확인

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 열어 루트 허브(`/`)에서 활동 묶음 카드를 고르고, `units/ai-learning/`에서 세 활동으로 이동하거나, 각 활동 폴더를 바로 엽니다(`/lessons/ai-inference-ripeness/`, `/lessons/ai-signal-noise/`, `/lessons/ai-biased-data/`). 테스트는 `npm test`로 실행합니다.
