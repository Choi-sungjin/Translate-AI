# REA 연결 및 분석 기록

확인일: 2026-10-18 (Asia/Seoul).

- 공식 REA 6.5.0을 로컬에 설치한 뒤 `setup --client codex --dry-run`으로 계획을 확인하고, 사용자의 연결 요청에 따라 `setup --client codex --yes`를 적용했다.
- 기존 Codex 설정의 백업을 생성하며 MCP 서버 등록과 대응 workflow skill을 설치했다.
- `doctor --client codex --skill --json`: 선택한 범위의 `healthy: true`.
- 등록된 것과 같은 Node 엔트리포인트로 MCP stdio 프로세스를 실행해 `initialize`와 `tools/list`를 실제 호출했다. 서버 `rea` 6.5.0, 도구 207개, `analyze_javascript_application` 포함을 확인했다.
- 이미 실행 중인 Codex 채팅의 도구 목록 갱신에는 재시작/재연결이 필요하다. 위 검증은 서버와 설정의 검증이며 해당 채팅에 도구가 즉시 추가되었다는 뜻은 아니다.

분석 대상은 Immersive Translate 1.34.1 공식 Chrome 배포판의 manifest·기본 설정·선택한 content script 2개였다. 정적 분석 파싱 실패는 0개였지만 파일 50개를 분석 범위에서 제외했고 의미 그래프 제한도 있었다. 이를 전체 소스 복원이나 원본 확장의 실시간 동작 검증으로 해석하지 않았다.

새 확장에서는 원문 보존, 별도 번역문 삽입, 입력창 Space 3회, 요청 중 수정 보호를 독립적으로 구현했다. 기존 제품의 배포 코드, 패키지, 계정 설정, REA의 대용량 원본 Evidence는 이 Git 저장소에 넣지 않았다.

다른 PC에서 REA를 Codex에 연결하려면 공식 안내를 따라 변경 계획을 검토한다:

```sh
npx rea-agents@6.5.0 setup --client codex --dry-run
npx rea-agents@6.5.0 setup --client codex
```

자료: [REA](https://github.com/morluto/rea), [입력창 번역 동작](https://immersivetranslate.com/ko/docs/input/), [Chrome 확장 시험](https://playwright.dev/docs/chrome-extensions).
