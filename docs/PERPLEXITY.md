# Perplexity 호환성 작업 — 2026-10-18

## 현재 상태

**사용자의 일상 Chrome 설치 및 실제 Perplexity 번역 성공은 아직 검증하지 못했습니다.** 브라우저 자동화 도구가 `chrome://extensions` 접근을 거절하여 수동 설치/새로고침을 요청한 상태입니다. 이 제한을 우회하거나 브라우저 프로필을 직접 수정하지 않았습니다.

실제 로그인된 Perplexity의 새 탭에서 입력창을 관찰하고 테스트 문장을 입력했습니다. `#ask-input`은 `data-lexical-editor="true"`인 contenteditable이며, 문장은 `<p><span data-lexical-text="true">…</span></p>` 안에 들어갑니다. 기존 확장은 텍스트 노드만 있는 contenteditable을 지원하므로 이 입력창을 처리하지 못했습니다.

## 수정

- 일반 텍스트 문단으로 구성된 Lexical 입력창을 인식합니다.
- DOM을 직접 비우지 않고 편집기의 텍스트 붙여넣기 처리기로 내용을 바꿔 내부 상태도 갱신합니다. 시스템 클립보드는 사용하지 않습니다.
- 문단 사이 줄바꿈, 앞뒤 빈 문단, 문장 중간 커서 위치를 유지합니다.
- 원문 복구 뒤에도 정상적으로 타이핑할 수 있습니다.
- 서식, 멘션, 첨부 요소 및 문단 내부 BR 줄바꿈은 거절합니다. 새로운 입력이 발생하면 이전 번역 결과로 덮어쓰지 않습니다.

Lexical의 상태 관리 원리는 [공식 설명](https://lexical.dev/docs/intro)을 참고했으며, 테스트는 실제 Lexical 0.52.0 엔진으로 구성했습니다. 사이트의 비공개 프레임워크 객체나 로그인 쿠키는 사용하지 않습니다.

## 실행 증거

다음 결과는 **별도 Chrome for Testing 156.0.8078.4와 로컬 테스트 페이지**에서 실행한 것입니다. 일상 Chrome이나 실제 Perplexity 성공으로 해석하면 안 됩니다.

| 검증 | 결과 |
|---|---|
| 기존 15개 브라우저 회귀 검사 | 통과 |
| Lexical 단문 번역, 내부 상태, 복구 후 타이핑 | 통과 |
| Lexical 여러 문단과 중간 커서 복구 | 통과 |
| Lexical 서식 보호와 늦은 응답 보호 | 통과 |
| Lexical 앞뒤 빈 문단 보존 | 통과 |
| 텍스트·로컬 연결 단위 검사 | 9개 통과 |
| 실제 ChatGPT 로그인 연결 화면 | 통과 |
| 실제 ChatGPT 원문·번역 병기와 textarea Space 3회 | 통과 |
| 실제 ChatGPT Lexical Space 3회·내부 상태·복구 | 통과 |
| 사용자의 일상 Chrome에 설치·연결 | 수동 설치 확인 대기 |
| 실제 웹사이트 및 Perplexity 원문·번역 병기/Space 3회 | 설치 후 확인 필요 |

실제 계정 요청 예문(API 키 및 가짜 응답 사용 없음):

- 페이지: `The weather is nice today. We can go for a walk in the park.` → `오늘은 날씨가 좋네요. 공원에 산책하러 가도 되겠어요.` — 약 4.0초.
- textarea: `오늘 날씨가 좋습니다.` → `The weather is nice today.` — 약 5.0초. 원문 복구 성공.
- Lexical: `안녕하세요. 오늘 날씨가 좋습니다.` → `Hello. The weather is nice today.` — 약 4.1초. 화면과 편집기 내부 상태 일치, 원문 복구 성공.

## 실제 Chrome에서 남은 절차

1. `chrome://extensions`에서 이 저장소의 `extension` 폴더를 로드하거나 기존 Translate AI를 새로고침합니다.
2. 로컬 연결 프로그램을 실행하고 확장 설정에 연결 코드를 저장하여 ChatGPT 상태를 확인합니다.
3. 이미 열린 대상 웹페이지를 새로고침합니다.
4. 공개 영어 페이지와 Perplexity 영어 답변에서 Alt+A로 병기/해제를 확인합니다.
5. Perplexity 새 입력창에서 테스트 문장을 쓴 뒤 Space를 빠르게 3번 누릅니다. 영어 결과, 원문 복구, 후속 타이핑과 정상 전송 내용을 확인합니다.

실제 사이트 구조는 변경될 수 있습니다. 이 문서의 로컬 테스트 결과가 모든 Lexical 버전이나 모든 사이트 호환성을 보장하지 않습니다.
