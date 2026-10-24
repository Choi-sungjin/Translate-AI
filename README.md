# Translate AI

웹페이지는 **원문과 한국어를 함께**, 입력한 문장은 **스페이스바 3회로 바로 번역**하는 Chrome/Edge Manifest V3 확장 프로그램입니다.

**v1.4.0 — Windows / Linux 선택 다운로드**

| 운영체제 | 다운로드 | 시작 |
|---|---|---|
| Windows | [Windows ZIP](https://github.com/Choi-sungjin/Translate-AI/releases/download/v1.4.0/Translate-AI-1.4.0-windows.zip) | `Start-Translate-AI.cmd` |
| Linux | [Linux ZIP](https://github.com/Choi-sungjin/Translate-AI/releases/download/v1.4.0/Translate-AI-1.4.0-linux.zip) | `sh Start-Translate-AI.sh` |
| 확장만 · 공용 | [확장 ZIP](https://github.com/Choi-sungjin/Translate-AI/releases/download/v1.4.0/Translate-AI-1.4.0-extension.zip) | 브라우저에서 압축해제된 확장 로드 |

두 운영체제 모두 **Node.js 22 이상과 npm**, Chrome/Edge 계열 브라우저가 필요합니다. ZIP에 Node.js나 로그인 정보는 포함하지 않습니다. 첫 시작 시 인터넷으로 잠금 파일에 지정된 공식 Codex 의존성을 설치합니다. Linux는 x64·arm64용 의존성을 선택하며, 이 릴리스의 실기 검증 환경은 Ubuntu 24.04 x64입니다. [1.4.0 검증 범위](docs/VERIFICATION-1.4.0.md)

**v1.1.0: 내 ChatGPT 계정 로그인으로 번역합니다.** 이 PC에서 실행하는 공식 Codex CLI가 로그인을 처리하며 별도 OpenAI API 키가 필요하지 않습니다. 기존 무료 번역·개인 API 방식도 선택할 수 있습니다.

**v1.3.0:** 설정 화면과 팝업에서 **GPT-6.1 Sol / GPT-6 Luna / GPT-5.6 Luna**를 선택할 수 있습니다. 실제 로그인 비교에서 입력 번역 중앙값은 각각 7.53/5.68/6.00초, 문단 3개 묶음은 8.70/6.75/6.01초였습니다. 모델·방식당 3회 측정이므로 모든 자료에서의 속도 순위를 보장하지 않습니다. [선택 방법·속도·번역 품질 비교](docs/MODELS-1.3.0.md)

**사용 설명서:** [HTML 내려받아 열기](docs/USER-GUIDE.html) · [PDF 6쪽](output/pdf/Translate-AI-사용설명서.pdf). 설치·계정 연결, 원문과 번역 병기, Space 세 번, 복구, 모델 선택과 문제 해결을 담았습니다.

**2026-10-24 복구 보완 및 연결 재검사:** 초점 이동을 입력 수정으로 오인해 원문 복구를 취소하는 문제를 고쳤습니다. 설치된 Chrome·Comet에서 실제 GPT-6 Luna 입력 번역, 초점 이동 후 원문 복구, 검색창 열림 유지와 복구 버튼 지속 표시(Chrome 34초·Comet 54초)를 확인했습니다. 같은 날 Comet의 NVIDIA 22/22 병기·페이지 원문 복원도 확인했습니다. 회귀 검사 26개와 수정 후 실제 계정의 NVIDIA 검색창 검사 1개가 통과했습니다. [현재 검사 결과](docs/CONNECTION-TEST-2026-10-24.md) · [복구 보완판 적용](docs/RESTORE-UPDATE-2026-10-24.md) · [10월 18일 검사 기록](docs/VERIFICATION-1.3.0.md)

**Windows 실행 파일 보완:** 시작 시 실행 중인 연결 프로그램의 버전을 검사합니다. 구버전이 남아 있으면 준비 완료로 표시하지 않습니다. **`Restart-Translate-AI.cmd`**는 PID 기록이 없어도 실제 연결 포트를 조회하고 이 프로젝트의 실행 경로를 확인한 뒤 재시작합니다. 버전·모델 선택 지원을 검사하고 결과 창을 유지합니다. 최초 v1.3.0 ZIP 사용자는 같은 릴리스의 **`Translate-AI-1.3.0-launcher-update-r2.zip`**을 기존 설치 폴더에 덮어 적용하세요. Git으로 업데이트한 폴더에는 포함돼 있습니다. [적용 방법](docs/LAUNCHER-UPDATE-1.3.0.md)

**v1.2.2:** 팝업 검색창 뒤에 번역 안내·복구 버튼이 가려지거나 복구 시 검색창이 닫히는 문제를 수정했습니다. 실제 Comet에서 NVIDIA 문서 22/22 병기·페이지 원문 복원을 확인했습니다. Chrome·Comet 모두 검색창 스페이스 3회 번역, 30초 이상 복구 버튼 유지, 입력 원문 복구와 검색창 열림 유지에 통과했습니다. [최종 검증 기록](docs/SEARCH-1.2.2.md)

**v1.2.1:** 입력 번역의 **원문 복구** 버튼은 자동으로 사라지지 않습니다. 복구하거나 **닫기**를 누를 때까지 유지하며, 새 번역을 시작하면 새 알림으로 바뀝니다. 일반 안내는 30초 동안 표시됩니다. 실제 Chrome에서 50초 이상 유지 후 입력 원문 복구, Perplexity 입력 번역·복구, NVIDIA 문서 22/22 병기·원문 복원을 확인했습니다. [v1.2.1 검증 기록](docs/CHROME-1.2.1.md)

**v1.2.0:** 페이지 문단을 묶어 번역하고 입력 번역은 별도로 처리합니다. 동일한 NVIDIA 문서 12개 항목의 실제 ChatGPT 번역이 86.9초에서 13.7초로 줄었습니다(1회 비교). 실제 Comet에서 NVIDIA 22/22 병기·페이지 원문 복원과 스페이스 3회 입력 번역을 확인했습니다. [측정 방법](docs/PERFORMANCE.md), [Comet 검증](docs/COMET.md)

**v1.1.2:** 사용자의 실제 Chrome에서 ChatGPT 연결, Perplexity 입력 번역·원문 복구·영어 질문 전송과 일반 웹사이트 입력 번역을 확인했습니다. 좁은 창에서 알림이 전송 버튼을 가리지 않도록 위치를 수정했습니다. [검증 범위](docs/PERPLEXITY.md)

![ChatGPT 로그인으로 실제 브라우저 번역 실행](docs/screenshots/chatgpt-bilingual-and-input.png)

## 설치

1. 위 표에서 운영체제에 맞는 ZIP을 내려받아 **계속 보관할 폴더**에 풉니다. 이 저장소를 복제해 사용할 수도 있습니다.
2. Chrome 주소창에 `chrome://extensions`를 입력하고 **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**를 누르고 **`extension` 폴더**를 선택합니다. 확장만 들어 있는 `Translate-AI-1.4.0-extension.zip`을 푼 경우에는 `manifest.json`이 있는 폴더를 선택합니다.
4. 기존 웹페이지를 새로고침하고 툴바에서 Translate AI를 고정합니다.

확장 자체는 빌드 과정 없이 로드할 수 있습니다. ChatGPT 로그인 번역에는 아래 로컬 연결 프로그램이 필요합니다. Chrome 웹 스토어에 게시한 제품은 아닙니다.

### ChatGPT 계정 연결

1. **Node.js 22 이상**을 설치합니다. Windows는 **`Start-Translate-AI.cmd`**, Linux는 터미널에서 **`sh Start-Translate-AI.sh`**를 실행합니다. 최초 실행 시 공식 Codex CLI 의존성을 설치하고, 이후 로컬 연결 프로그램을 백그라운드로 실행합니다.
2. 열리는 연결 화면에서 로그인 상태를 확인합니다. 기존 Codex의 ChatGPT 로그인을 재사용합니다. 로그인이 필요하다면 이 프로젝트 폴더에서 **`npx codex login`**을 실행하고 공식 브라우저 로그인을 직접 완료합니다.
3. 연결 화면의 **로컬 연결 코드**를 복사합니다. 확장 설정 → **ChatGPT 계정 로그인** → **로컬 연결 코드**에 붙여넣고 저장합니다.
4. **저장한 연결 상태 확인**, **저장한 설정으로 연결 확인**으로 확인합니다. 기존 v1.0 사용자는 확장을 새로고침한 뒤 서비스를 직접 ChatGPT로 바꾸세요.

이 코드는 이 PC의 확장과 로컬 프로그램 사이의 연결 코드입니다. ChatGPT OAuth 토큰이나 API 키가 아니며 다른 사람과 공유하지 마세요. 계정 로그인 정보는 공식 CLI 저장소에 그대로 남습니다. 브라우저 쿠키나 OAuth 토큰을 확장으로 복사하지 않습니다.

시작 스크립트는 로그인 시 자동 실행을 등록하지 않습니다. 재부팅 후 다시 시작하세요. Windows 종료·재시작은 `Stop-Translate-AI.cmd` / `Restart-Translate-AI.cmd`를 사용합니다.

### Linux 설치와 앱 메뉴

압축을 푼 폴더에서 실행하세요. `sudo`는 필요하지 않습니다.

```sh
sh Install-Translate-AI.sh   # 앱 메뉴에 Translate AI 등록 (선택)
sh Start-Translate-AI.sh     # 연결 프로그램 시작 + 연결 화면 열기
sh Stop-Translate-AI.sh      # 이 설치 폴더의 연결 프로그램만 종료
sh Restart-Translate-AI.sh   # 업데이트 후 재시작
```

- 앱 메뉴의 **Translate AI**로 시작할 수 있고, 메뉴의 추가 동작에서 재시작·종료할 수 있습니다. 등록한 폴더를 옮겼거나 Node.js 설치 경로가 바뀌면 `sh Install-Translate-AI.sh`를 다시 실행하세요.
- 확장은 Chrome의 `chrome://extensions` 또는 Edge의 `edge://extensions`에서 개발자 모드를 켜고 **이 폴더의 `extension`**을 로드합니다. 앱 메뉴 등록과 확장 설치는 별도입니다.
- 시작·재시작에 `--no-open`을 붙이면 브라우저를 열지 않습니다. 시작 버튼을 다시 눌러도 연결 프로그램을 중복 실행하지 않습니다.
- 다른 프로그램이나 다른 설치 폴더가 포트 18458을 사용하면 중단합니다. 번역 처리 중에는 종료·재시작을 거부합니다. 잠깐 겹쳐 실행한 명령은 잠금 때문에 종료 코드 73으로 중단되므로 앞선 명령이 끝난 뒤 재시도하세요.
- 연결 코드와 로그: `${XDG_DATA_HOME:-~/.local/share}/Translate-AI/`. 연결 코드는 업데이트·재시작해도 유지됩니다. 로그 파일은 `bridge.log`입니다.
- `flock`이 없다면 배포판의 `util-linux` 패키지가 필요합니다. 브라우저 자동 열기에는 `xdg-open`을 사용하며, 없으면 `http://127.0.0.1:18458/`을 직접 여세요. X11·Wayland 입력을 직접 가로채지 않고 브라우저 확장 안에서 단축키를 처리합니다. Wayland 실기 검증은 별도입니다.
- 앱 메뉴 등록 해제: `~/.local/share/applications/translate-ai.desktop`(XDG_DATA_HOME을 썼다면 그 아래 `applications`)과 `~/.local/bin/translate-ai`를 삭제합니다. 먼저 연결 프로그램을 종료하세요. 로그인 정보는 삭제하지 않습니다.

실행 스크립트 대신 `npm ci --omit=dev --ignore-scripts`, `npm run bridge`를 실행할 수도 있습니다. 이 경우 종료는 해당 터미널에서 Ctrl+C입니다. 업데이트 후에는 연결 프로그램 재시작 → 확장 새로고침 → 웹페이지 새로고침 순서로 적용하세요.

## 사용

| 기능 | 조작 |
|---|---|
| 원문·번역 병기 | 확장 아이콘 → **이 페이지 번역하기**, 또는 **Alt+A** |
| 원문만 보기 | 같은 버튼이나 **Alt+A**를 다시 누르기 |
| 입력창 번역 | 문장을 쓴 뒤 **Space를 빠르게 3회**, 또는 **Alt+I** |
| 입력 원문 복구 | 유지되는 번역 알림의 **원문 복구** 버튼 |
| ChatGPT 모델 변경 | 팝업의 **ChatGPT 번역 모델** 선택(자동 저장), 또는 전체 설정에서 선택 후 저장 |
| 언어·번역 서비스 | 확장 아이콘 → **언어 · 번역 서비스 설정** |

- 기본값: 웹페이지는 **한국어**, 입력창은 **영어**. 각각 따로 변경할 수 있습니다.
- Space 연타 간격 기본 300ms, 설정에서 200/300/500ms를 선택합니다. 길게 누르기는 연타로 계산하지 않습니다.
- 원문 노드·링크·강조·이벤트를 유지하고 별도 번역문을 추가합니다. 화면 가까이 있는 문단부터 번역하고 동적으로 추가된 문단도 처리합니다.
- 번역을 기다리며 새 글을 쓰면 오래된 결과로 덮어쓰지 않습니다. 자동으로 Enter를 누르거나 메시지를 전송하지 않습니다.
- 원문 복구 알림은 자동으로 닫히지 않습니다. 복구하거나 **닫기**를 누르거나 새 번역을 시작할 때까지 유지됩니다. 일반 안내는 30초 뒤 닫힙니다. 적용 후 내용을 바꿨다면 복구로 덮어쓰지 않습니다. 브라우저 기본 Undo 지원은 보장하지 않습니다.
- Comet의 Alt+A는 브라우저 어시스턴트와 충돌할 수 있습니다. 이 경우 확장 아이콘에서 페이지 번역을 실행하세요.

## 번역 서비스

**ChatGPT 계정 로그인**이 새 설치의 기본값입니다. 공식 Codex CLI 0.162.1의 저장된 ChatGPT 인증으로 `codex exec`를 실행합니다. 별도 API 결제 키를 사용하지 않으며 **계정의 Codex 이용 한도**가 적용됩니다. 일반 API보다 느릴 수 있으며 긴 문서는 계정 사용량을 소비합니다. v1.2.0부터 인접한 페이지 요청을 최대 12개·합계 12,000자씩 묶어 처리합니다. 페이지 묶음 1개와 입력 번역 1개를 별도로 처리하므로 입력이 페이지 대기열에 막히지 않습니다. 원문·프롬프트를 자체 로그에 남기지 않습니다. 개인 번역 용도의 로컬 연결이며 공개 API 서버로 배포하지 마세요.

v1.3.0부터 선택한 모델을 명시적으로 지정하며 추론 강도는 `low`입니다. 기존 설정은 GPT-6.1 Sol로 유지됩니다. 모델 변경은 다음 요청부터 적용되므로 이미 번역한 페이지는 원문 복원 후 다시 번역하세요. 모델별로 캐시와 문단 묶음을 분리합니다. 업데이트 시 로컬 연결 프로그램 재시작, 확장 새로고침, 웹페이지 새로고침이 모두 필요합니다. 계정에서 모델을 사용할 수 없으면 오류를 표시합니다.

로컬 연결은 `127.0.0.1:18458`에서만 수신합니다. 연결 코드를 검증하며 외부 웹 Origin을 거부합니다. Codex 실행은 읽기 전용 샌드박스, 사용자 설정 미로딩, 도구·앱·MCP·브라우저·메모리 기능 비활성화, 전용 번역 지침을 사용합니다. CLI 계정 인증은 계속 공식 CLI가 담당합니다. 회사 관리 정책이 기능을 제한하면 해당 제한을 우회하지 않습니다.

**MyMemory 무료 API**도 설정에서 선택할 수 있습니다. 익명 사용에는 일일 한도가 있고, 품질은 문장과 언어에 따라 달라집니다. ChatGPT 오류가 나더라도 다른 서비스로 자동 전송하지 않습니다.

개인 AI API는 OpenAI 호환 `chat/completions` 규격을 지원합니다. 설정에서 전체 API 주소, 모델 이름, 필요한 경우 API 키를 입력하고 저장한 뒤 **저장한 설정으로 연결 확인**을 누릅니다. 로컬 서버는 `http://127.0.0.1:포트/v1/chat/completions` 등의 주소를 사용할 수 있습니다. 외부 서버는 HTTPS만 허용합니다. 실제 개인 API 서비스·로컬 모델은 사용자가 별도로 준비해야 합니다.

개인 API 프로토콜은 로컬 테스트 서버로 검증했으며 모든 공급자·모델과의 호환성을 뜻하지 않습니다. Gemini 계정 로그인은 이 버전에 구현하지 않았습니다.

## 지원 범위

- HTTP/HTTPS 일반 웹페이지, 텍스트/검색 input, textarea, 텍스트 노드만 있는 단순 contenteditable, 일반 텍스트 문단으로 구성된 Lexical 편집기.
- Lexical은 사이트의 붙여넣기 처리기로 내부 상태를 갱신합니다. 서식·멘션·첨부 요소나 문단 내부 BR 줄바꿈이 있으면 처리하지 않습니다. 시스템 클립보드를 읽거나 변경하지 않습니다.
- 복잡한 서식 편집기(Gmail·Notion 등), 닫힌 Shadow DOM, 브라우저 내부 페이지, 웹 스토어, PDF·자막 번역은 현재 지원 범위에 포함하지 않습니다.
- 입력 번역 최대 12,000자. 페이지당 최대 1,000개 문단을 추적하며 12,000자를 넘는 단일 문단은 건너뜁니다.
- 한국어 IME 조합 중 트리거 방지는 이벤트 시뮬레이션으로 검사했습니다. 실제 Windows IME 키 입력, 모든 사이트의 편집기 호환성을 검증한 것은 아닙니다.

## 개인정보와 권한

번역 버튼이나 입력 번역 단축키를 실행하면 대상 텍스트가 선택한 번역 서비스로 전송됩니다. ChatGPT 방식은 로컬 연결 프로그램 → 공식 CLI → OpenAI 순서로 전송됩니다. API 키·로컬 연결 코드는 이 브라우저의 확장 로컬 저장소에 저장되며 웹페이지에 전달하지 않고, 동기화하지 않습니다. 이 저장소는 비밀 보관소 수준의 암호화를 제공하는 것은 아닙니다. 로컬 연결 코드는 사용자 앱 데이터의 `Translate-AI/bridge-state.json`에 저장됩니다. OAuth 인증·서버 보관 정책은 공식 서비스의 정책을 따릅니다.

HTTP/HTTPS 사이트 접근 권한은 문단 읽기·번역문 표시·입력 단축키와 설정한 번역 서버 호출에 사용합니다. 비밀번호 필드는 제외합니다. 확장 자체는 계정·분석용 추적·사용 이력 수집 기능이 없습니다. 번역 캐시는 메모리에만 보관합니다. 서버로 보낸 텍스트의 보관 정책은 해당 번역 공급자의 정책을 따릅니다.

## 개발과 검증

Git 소스 체크아웃에서 Node.js 22 이상:

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run test:linux  # Linux에서 포트 18458이 비어 있을 때
npm run package
npm run test:package
```

- `npm run test:regression`: 실제 확장을 로드한 Chrome for Testing + 결정적인 로컬 API 응답으로 회귀 동작 검사.
- `npm run test:live`: 실제 MyMemory API, 공개 사이트, 입력창 번역 검사. 네트워크 연결과 무료 서비스의 잔여 한도가 필요합니다.
- `npm run test:login`: 실행 중인 로컬 연결 프로그램과 기존 ChatGPT 로그인으로 실제 확장 번역을 시험. 계정 사용량을 소비합니다.
- `npm run test:login:isolated`: 별도 포트의 연결 프로그램과 Chrome for Testing에서 실제 ChatGPT 번역을 시험. 사용자의 설치된 Chrome/Comet 검증과 구분합니다.
- `npm run benchmark:models`: 세 모델의 실제 로그인 번역 속도와 번역문을 비교합니다. 계정 사용량을 소비합니다.
- Windows 실행 파일 검사: `powershell.exe -NoProfile -File tests/windows-launcher.test.ps1`. 실제 프로세스·네트워크·브라우저·사용자 앱 데이터 쓰기를 모의 처리한 12개 시나리오입니다.
- `npm test`: 텍스트·로컬 연결 보안 시험 + 회귀·무료 API 브라우저 시험. ChatGPT 로그인 시험은 별도입니다.
- `npm run package`: `dist/`에 `-windows.zip`, `-linux.zip`, `-extension.zip`과 `SHA256SUMS.txt`를 생성합니다. Git에 추적된 배포 대상 파일만 포함하며, 실행용 ZIP에는 개발 테스트 도구를 넣지 않습니다. 개발 검사는 저장소를 복제해서 실행하세요. 사용자 설정·키·브라우저 프로필·node_modules는 포함하지 않습니다.

검증 범위와 실제 번역 예문: [ChatGPT 로그인 검증 보고서](docs/CHATGPT-LOGIN.md), [v1.0 검증 보고서](docs/VERIFICATION.md). 설정 화면: [스크린샷](docs/screenshots/chatgpt-settings.png).
