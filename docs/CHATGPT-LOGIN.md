# ChatGPT 로그인 번역 — v1.1.0

확인일: 2026-10-18 KST. 공식 Codex CLI 0.162.1의 `login status`가 **Logged in using ChatGPT**를 반환한 기존 로그인으로 시험했다. API 키를 입력하거나 ChatGPT 브라우저 쿠키·OAuth 토큰을 복사하지 않았다.

## 실제 실행 결과

Windows의 Chrome for Testing 156.0.8078.4에 실제 Manifest V3 확장을 로드하고, 로컬 연결 → 공식 CLI → ChatGPT 계정 요청까지 실행했다. 실제 시험 결과는 [JSON](chatgpt-verification.json)에 있다.

| 조작 | 실제 결과 | 측정 시간 |
|---|---|---|
| 페이지 병기 | `The weather is nice today. We can go for a walk in the park.` 원문 유지, 아래에 `오늘은 날씨가 좋아요. 공원에 산책하러 가도 좋겠어요.` 표시 | 약 5.0초 |
| 입력 후 Space 3회 | `오늘 날씨가 좋습니다.` → `The weather is nice today.` | 약 3.5초 |
| 원문 복구 | 입력창을 `오늘 날씨가 좋습니다.`로 정확하게 복구 | 통과 |

시간은 이번 짧은 예문 1회 측정이며 응답 시간 보장이 아니다. 페이지 시험 시작에는 실제 확장 메시지 경로를 사용했고, Space는 브라우저 키보드 이벤트 3회로 실행했다. 실제 계정 시험에 가짜 번역 서버를 사용하지 않았다.

![ChatGPT 실제 번역 결과](screenshots/chatgpt-bilingual-and-input.png)

## 함께 검사한 범위

- 텍스트 처리 3개, 로컬 연결 접근 제어·요청 검증·CLI 출력 검증 6개 통과.
- 실제 확장 브라우저 회귀 시험 15개 통과. 여기서는 결정적인 응답을 주는 로컬 테스트 서버를 사용했다.
- 기존 MyMemory 실제 API 시험도 통과. 이 무료 번역 시험은 ChatGPT 시험과 별개다.
- ChatGPT 실제 로그인 시험은 개발 PC에서 별도로 실행하며 GitHub CI에 계정 인증을 넣지 않는다.
- 확장 설정에서 로컬 연결 화면을 여는 동작과 실제 로그인 상태 표시도 별도로 통과했다.

## 연결 구조

확장 서비스 워커가 `127.0.0.1:18458`에 인증된 번역 요청을 보낸다. 로컬 연결 프로그램은 공식 Codex 실행 파일을 **인자 배열과 표준입력**으로 호출한다. 웹페이지 텍스트를 셸 명령 문자열에 끼워 넣지 않는다. 임의 CLI 인자·파일 경로·모델 명령은 요청으로 받지 않는다.

계정 인증은 공식 Codex가 기존 인증 저장소에서 읽고 갱신한다. 확장에는 별도의 256비트 로컬 연결 코드만 저장한다. 로컬 코드도 로그인 정보를 이용하는 연결을 허용하므로 공개하거나 Git에 넣지 않는다. 서버는 loopback 바인딩, Host·Origin 검증, Bearer 코드 검증을 한다. 연결 화면은 다른 사이트에서 iframe으로 포함하거나 CORS로 읽을 수 없다.

번역 프로세스는 사용자 Codex 설정 미로딩, 프로젝트 지침 미로딩, 읽기 전용 샌드박스, 임시 세션 모드, 셸·앱·플러그인·메모리·브라우저·컴퓨터 조작·다중 에이전트·후크 기능 비활성화를 명시한다. 기존 사용자의 Codex 설정 파일 자체는 변경하지 않는다. 결과에 도구 실행 이벤트가 나타나면 번역 결과를 거부한다.

로컬 프로그램은 요청 본문이나 원문을 자체 로그에 남기지 않는다. CLI 및 OpenAI 서비스의 데이터 처리는 공식 서비스 정책을 따른다. 로그인 실패·사용량 한도 시 다른 서비스로 자동 전송하지 않는다.

## 사용과 제한

- 새 설치의 기본 서비스는 ChatGPT 로그인이다. v1.0에서 저장한 서비스 설정은 유지하므로 직접 ChatGPT로 변경해야 한다.
- 전체 desktop ZIP의 `Start-Translate-AI.cmd`를 실행하고 연결 코드를 확장 설정에 저장한다. 기존 확장은 새로고침하고 번역할 페이지도 새로고침한다.
- 이 PC에는 로컬 연결 프로그램을 실행해 두었다. PC 재부팅 후 다시 시작해야 하며 자동 시작 항목은 등록하지 않았다. `Stop-Translate-AI.cmd`는 이 패키지에서 실행한 프로세스인지 확인한 뒤 종료한다.
- 순차 요청 방식이며 긴 페이지는 느리고 Codex 계정 사용량을 많이 쓸 수 있다. 구독으로 무제한 번역이 되는 것은 아니다.
- 일상 Chrome 프로필에 확장을 자동 설치하지 않았다. 실제 Windows IME, 복잡한 서식 편집기의 미지원·미검증 범위는 v1.0과 같다.
- Gemini 로그인은 이번 버전에 포함하지 않았다. 사용자가 우선 요청한 기존 ChatGPT 로그인을 연결했다.

## 재현

```sh
npm ci
npm run bridge
# 다른 터미널에서, 계정 로그인이 필요한 경우:
npx codex login
npm run test:login
```

공식 문서: [Codex 로그인과 캐시](https://learn.chatgpt.com/docs/auth), [Codex 비대화형 실행](https://learn.chatgpt.com/docs/non-interactive-mode), [Codex 설정](https://learn.chatgpt.com/docs/config-file/config-reference).
