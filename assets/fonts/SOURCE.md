# Noto Sans KR (변수 폰트)

- 글꼴: Noto Sans KR, 가변 폭(wght 100–900), Regular 인스턴스 기준
- 원문 출처(공식 배포처): https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf
  (Google Fonts 공식 카탈로그 저장소 `google/fonts`, `ofl/notosanskr/` 경로)
- 라이선스: SIL Open Font License, Version 1.1 (전문: `OFL.txt`, 같은 출처 저장소의
  `ofl/notosanskr/OFL.txt`에서 그대로 가져옴)
- 이 저장소에 포함된 `NotoSansKR-Variable.woff2`는 위 TTF 원본을 `fonttools`로
  WOFF2 압축하고, `OS/2.usWeightClass`를 원본 값(100)에서 400으로 보정해 만들었다.
  원본의 `usWeightClass=100`은 Safari/WebKit에서 지정한 `font-weight`보다 얇게
  렌더링되는 크로스 브라우저 굵기 불일치를 일으켜 400으로 고쳤다(Chrome은 영향 없음).
  글리프나 `fvar` 축 범위(100–900)는 변경하지 않았고, 라이선스 조건도 그대로다.
  OFL 1.1은 폰트 형식 변환·메타데이터 수정을 포함한 수정·재배포를 허용한다.
- 외부 CDN(Google Fonts API 등)에 런타임 의존하지 않도록 이 저장소 안에
  WOFF2와 라이선스 원문을 함께 보관한다.
