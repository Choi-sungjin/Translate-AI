# Perplexity 호환성 작업 — 2026-10-18

## 현재 상태

**사용자의 일상 Chrome에서 확장 설치, ChatGPT 연결, Perplexity와 일반 웹사이트의 입력 번역을 확인했습니다.** 사용자가 확장을 설치하고 로컬 연결 코드를 저장한 뒤 검사했습니다. 실제 사이트의 원문·번역 병기는 아직 검증 완료 전입니다. 도구의 Alt+A 입력으로 Chrome 확장 명령이 시작되지 않아 두 탭에서 번역 시작 버튼을 직접 눌러 달라고 요청한 상태입니다. 브라우저 내부 페이지 제한을 우회하거나 프로필을 직접 수정하지 않았습니다.

## 실제 사용 중인 Chrome에서 확인한 내용

- Perplexity에서 `안녕하세요. 오늘 날씨가 좋습니다.` + Space 3회 → `Hello. The weather is nice today.`
- Perplexity에서 `반갑습니다. 번역 기능을 확인하고 있습니다.` → `Nice to meet you. I'm testing the translation feature.` → 원문 복구 버튼으로 한국어 원문 복원.
- Perplexity에서 `이 답변을 한 문장으로 요약해 주세요.` → `Please summarize this answer in one sentence.` → 번역 완료를 확인한 뒤 Enter 전송. 실제 대화에 이 영어 질문이 표시되는 것까지 확인.
- 공개 웹사이트 `https://httpbin.org/forms/post`의 textarea에서 `이 문장은 번역 기능을 확인하기 위한 테스트입니다.` + Space 3회 → `This sentence is a test to check the translation feature.` 이 폼은 제출하지 않았습니다.
- 로컬 연결 프로그램을 다시 실행했고 공식 CLI의 ChatGPT 로그인 상태가 정상임을 확인했습니다.

좁은 화면(약 634 × 455)에서 원문 복구 버튼과 Perplexity 제출 버튼의 화면 영역이 겹치는 문제도 실제 DOM 좌표로 확인했습니다. **v1.1.2에서는 알림을 화면 위쪽으로 이동**했습니다. 별도 테스트 Chrome에서 알림이 보이는 동안 아래쪽 전송 버튼을 클릭하고 번역된 값이 전달되는 회귀 검사를 통과했습니다. 이 위치 수정은 확장을 새로고침하고 웹페이지를 다시 열어야 적용되며, 사용자의 실제 Chrome에서 수정 후 위치는 아직 확인하지 않았습니다.

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
| 좁은 화면에서 번역 알림이 보일 때 전송 버튼 클릭 | 통과 |

실제 계정 요청 예문(API 키 및 가짜 응답 사용 없음):

- 페이지: `The weather is nice today. We can go for a walk in the park.` → `오늘은 날씨가 좋네요. 공원에 산책하러 가도 되겠어요.` — 약 4.0초.
- textarea: `오늘 날씨가 좋습니다.` → `The weather is nice today.` — 약 5.0초. 원문 복구 성공.
- Lexical: `안녕하세요. 오늘 날씨가 좋습니다.` → `Hello. The weather is nice today.` — 약 4.1초. 화면과 편집기 내부 상태 일치, 원문 복구 성공.

## 실제 Chrome에서 남은 절차

1. v1.1.2 알림 위치 수정을 반영하려면 `chrome://extensions`에서 Translate AI를 새로고침하고 대상 웹페이지도 새로고침합니다.
2. 열어둔 Example Domain과 Perplexity 영어 답변 탭에서 확장 메뉴의 **이 페이지 번역하기**를 누릅니다.
3. 원문 유지, 한국어 번역 표시, 링크 유지, 원문만 보기 동작을 확인합니다.

실제 사이트 구조는 변경될 수 있습니다. 이 문서의 로컬 테스트 결과가 모든 Lexical 버전이나 모든 사이트 호환성을 보장하지 않습니다.
