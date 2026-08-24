// 교사용 설정 파일 — 학생은 이 파일을 열어보거나 고칠 필요가 없습니다.
//
// 최종 제출은 Google Apps Script Web App을 통해 Google Sheet에 저장됩니다.
// 아래 GAS_ENDPOINT가 빈 문자열인 동안에는 app.js가 "최종 제출" 버튼을 비활성화하고,
// 제출 영역에 설정이 필요하다는 안내만 보여줍니다. 학생은 그 상태에서도 코드 작성·
// 실행·ELIZA와의 대화 연습은 그대로 할 수 있습니다.
//
// 설정 순서:
//   1) Google Sheet를 새로 만들고 "제출" 이름의 시트를 추가합니다.
//   2) 그 시트의 확장 프로그램 → Apps Script를 열고, 이 폴더의
//      apps-script-example.gs.txt 내용을 그대로 붙여넣습니다.
//   3) 배포 → 새 배포 → 유형: 웹 앱. 실행 계정 "나", 액세스 권한 "모든 사용자"로 배포합니다.
//   4) 배포된 웹 앱 URL(.../exec 로 끝남)을 아래 GAS_ENDPOINT에 따옴표를 유지한 채 붙여넣습니다.
//   5) 저장 후 페이지를 새로고침하면 "최종 제출" 버튼이 활성화됩니다.
export const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxbGHwu-Z5OskC4pfKsG41L-cC2PreIGlT63SwqL93nGn17--fVPzuX-qun6TMIQNtk1g/exec";

// 제출 데이터에 함께 실리는 활동 페이지 버전(선택 필드). 페이지 구조를 크게 바꿀 때만 올립니다.
export const ACTIVITY_VERSION = "1.0.0";
