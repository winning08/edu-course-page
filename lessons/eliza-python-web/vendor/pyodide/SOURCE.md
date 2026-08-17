# Pyodide 런타임 (버전 고정, 로컬 번들)

- 배포처: npm `pyodide` 패키지, 버전 `314.0.3` (2026-08-16 기준 npm `latest` 태그)
- 원본 tarball: `https://registry.npmjs.org/pyodide/-/pyodide-314.0.3.tgz`
  (sha256: `d7f7d24f8db486c7eda7280f3b0f7517524c8e43e8b086c6ee6ae8016658b484`)
- 라이선스: Mozilla Public License 2.0 (전문: `LICENSE.txt`, 위 tarball과 같은
  저장소 `pyodide/pyodide`의 LICENSE 원문 그대로)

## 왜 로컬로 고정 버전을 두는가

학교 네트워크가 간헐적으로 느려지거나 끊기고, 한 교시에 학생 30명 이상이 동시에
접속하는 상황을 고려해 `cdn.jsdelivr.net` 같은 외부 CDN에서 매 세션 파이오다이드를
내려받지 않는다. 이 저장소(정적 사이트) 안에 정확히 이 버전만 두고, 학생 브라우저는
사이트를 서빙하는 같은 서버에서 다른 정적 자산(이미지·폰트 등)과 동일하게 캐싱된
채로 받는다. 배포 후 파이오다이드 버전을 올리려면 이 폴더를 새 버전으로 통째로
교체하고 `python-worker.js`의 버전 확인 로직도 함께 갱신한다.

## 어떤 파일만 담았는가 (불필요한 패키지 제외)

npm 패키지 전체가 아니라 인터프리터 실행에 반드시 필요한 최소 파일 5개만 담았다.

- `pyodide.mjs` — ES 모듈 로더(`loadPyodide`)
- `pyodide.asm.mjs` — Emscripten이 생성한 글루(glue) 코드
- `pyodide.asm.wasm` — CPython 인터프리터 WebAssembly 바이너리
- `python_stdlib.zip` — 파이썬 표준 라이브러리(zip으로 마운트됨)
- `pyodide-lock.json` — 런타임 초기화 시 항상 조회하는 패키지 메타데이터
  (실제로 `loadPackage`/`micropip`를 호출하지 않으므로 어떤 패키지도 내려받지 않음)

다음은 실행에 필요하지 않아 제외했다: `pyodide.js`(UMD 번들, 이 프로젝트는 ES
모듈만 사용), `console.html`/`console-v2.html`(파이오다이드 자체 데모 페이지),
`*.d.ts`(타입 선언), `*.map`(소스맵), `README.md`, `package.json`. numpy·pandas
같은 과학 계산 패키지(.whl)는 npm 패키지 자체에도 포함되어 있지 않고, 이 활동
코드에서도 요청하지 않으므로 전혀 내려받지 않는다.

## 무결성 확인

```bash
shasum -a 256 lessons/eliza-python-web/vendor/pyodide/pyodide.asm.wasm
# e7f8fac36f8bf11085309cbc5c829b3ec3057c18bf1d73b05a6741612d63cdbf  (314.0.3 기준)
```
