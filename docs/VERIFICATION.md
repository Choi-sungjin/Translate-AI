# 실행 검증 기록

검증일: **2026-10-18 04:46 KST**. Windows, Node.js 24.11.1, Playwright 1.64.1, **Chrome for Testing 156.0.8078.4**.

## 결과

`npm run check`와 `npm test`를 실행했다. JavaScript 구문·manifest 참조 검사 통과, 텍스트 처리 시험 **3개 통과**, 브라우저 시험 **14개 통과**(실패·건너뜀·재시도 성공 0개). 브라우저 시험 시간은 약 34.8초였다.

실제 Manifest V3 확장을 별도 브라우저 프로필에 로드했다. 실제 service worker, content script, Chrome 메시지 전달, DOM 및 키보드 이벤트를 사용했다. `chrome` API를 가짜 객체로 대체하지 않았다. 브라우저는 자동화용 headless 모드였다.

| 범위 | 확인한 동작 | 번역 응답 |
|---|---|---|
| 브라우저 회귀 13개 | 병기·해제, 원문 링크·버튼 보존, 중복 방지, 동적 문단, textarea/input/단순 contenteditable, Space 3회와 복구, 연타 간격·길게 누르기 구별, 늦은 응답 보호, 오류 시 원문 유지, 비밀번호·서식 편집기 제외, 설정 저장, 알림 우선순위 | 로컬 OpenAI 호환 테스트 서버 |
| 실제 서비스 1개 | 원문과 한국어 병기, 한국어 입력 후 실제 Space 3회 → 영어 치환, 공개 웹페이지 번역 | **MyMemory 실제 네트워크 API** |
| 텍스트 처리 3개 | UTF-8 바이트 한도, 유니코드·줄바꿈 보존, 단어 경계, 앞뒤 공백 유지 | 네트워크 없음 |

테스트의 페이지 번역 시작은 확장 메시지 경로를 호출했다. 사용자의 일상 Chrome 프로필 설치, 툴바 아이콘 수동 클릭, Alt 단축키의 운영체제 충돌까지 확인한 것은 아니다. 일반 Chrome 설치는 README의 압축해제 확장 로드 절차를 따른다.

## 실제 번역 예문

- 페이지 원문: `The weather is nice today. We can go for a walk in the park.`
- 페이지 번역: `오늘 날씨가 좋네요. 공원에서 산책을 할 수 있습니다.`
- 입력 원문: `오늘 날씨가 좋습니다.`
- **Space를 3번 누른 뒤 입력창 결과:** `The weather is nice today.`

[실제 응답과 시험 수를 담은 JSON](verification.json), [병기·입력창 스크린샷](screenshots/live-bilingual-and-input.png), [설정 화면](screenshots/settings.png), [공개 사이트 실행 화면](screenshots/public-website.png).

공개 페이지는 `https://example.com/`을 사용했다. 로딩 표시나 오류 문구가 아니라 한국어 번역이 완료된 DOM 요소가 나타나는지 확인했다. 서비스가 반환한 번역의 표현과 정확도를 모든 문장에 대해 보증하는 검사는 아니다.

## 검증 경계

- 한국어 IME 조합 방지는 합성 composition 이벤트로 검사했다. 실제 Windows 한국어 IME의 물리 키 입력은 미검증이다.
- 개인 AI API는 로컬 호환 서버로 정상 응답·인증 오류·지연 응답을 검사했다. 실제 유료 공급자 키나 로컬 모델을 연결한 시험은 하지 않았다.
- 복잡한 서식 편집기, 닫힌 Shadow DOM, PDF, 자막, 모든 웹사이트와 모든 브라우저 조합은 지원·검증 범위 밖이다.
- 무료 API에는 외부 서비스의 한도·장애·품질 변동이 있다. 동일 예문을 다시 요청해도 결과가 달라질 수 있다.
- GitHub Actions는 외부 번역 서비스 한도에 의존하지 않도록 구문 검사, 텍스트 시험, 브라우저 회귀 시험만 실행한다. 실서비스 시험은 `npm run test:live`로 별도 재현할 수 있다.

REA의 Codex 설정과 MCP 실제 기동 검증은 [별도 기록](REA.md)에 있다. 이 확장의 실행에는 REA가 필요하지 않다.
