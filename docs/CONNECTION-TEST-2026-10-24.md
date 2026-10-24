# 2026-10-24 연결 및 실제 번역 검사

검사 대상은 Translate AI v1.3.0, Windows, 기존 ChatGPT 계정 로그인입니다. 아래 환경별 결과는 서로 대체하지 않습니다.

게시 시 GitHub main에 먼저 올라온 v1.4.0 Linux 지원 변경을 보존하고 공통 복구 수정을 합쳤습니다. 설치 브라우저 실기 검사는 v1.3.0 보완판 결과로 유지하며 v1.4.0 Linux 실기 검사로 확대 해석하지 않습니다.

## 실행 중인 로컬 연결 프로그램

시작 시 `127.0.0.1:18458`의 연결이 거부됐습니다. `Start-Translate-AI.cmd`로 연결 프로그램을 시작한 뒤 검사했습니다.

| 항목 | 결과 |
|---|---|
| `/health` | v1.3.0, `pageBatchTransport: true`, `modelSelection: true` |
| `/v1/status` | HTTP 200, ChatGPT 로그인 연결됨 |
| `/v1/capabilities` | HTTP 200, GPT-6.1 Sol / GPT-6 Luna / GPT-5.6 Luna 선택 지원 |
| 입력 번역 | HTTP 200, GPT-6 Luna, low, 왕복 7,141ms |
| 문단 2개 묶음 | HTTP 200, GPT-6 Luna, low, 왕복 5,192ms |

입력 원문은 `연결을 확인하고 로봇 센서 설정을 유지합니다.`였으며 결과는 `Check the connection and maintain the robot sensor settings.`였습니다.

문단은 `The robot publishes sensor data at 30 Hz.` → `로봇은 센서 데이터를 30Hz로 게시합니다.`, `Keep the original text visible below the heading.` → `제목 아래에 원문이 보이도록 유지하세요.`였습니다. ROS 문맥의 publish는 ‘발행’이 더 적절할 수 있으므로 전문 용어 품질이 완벽하다는 의미는 아닙니다.

각 요청 1회 측정입니다. 전체 페이지 완료 시간이나 모델별 일반적인 순위를 나타내지 않습니다. 연결 코드·OAuth 인증 정보는 보고서에 포함하지 않았습니다.

## 사용자의 설치된 Comet

검사 페이지: [NVIDIA Isaac Sim ROS 2 문서](https://docs.isaacsim.omniverse.nvidia.com/latest/ros2_tutorials/index.html).

초기에는 로컬 연결 코드 불일치가 표시됐습니다. 사용자가 현재 연결 코드를 Chrome·Comet에 다시 저장한 뒤 다음 결과를 직접 확인했습니다.

- **스페이스바 3회:** 문서 검색창의 `오늘 연결을 확인하고 로봇 설정을 유지합니다.`가 `Today, we’ll check the connection and keep the robot settings.`로 바뀌었습니다. 완료 알림에 GPT-6 Luna가 표시됐습니다.
- **복구 버튼 유지:** 번역 완료를 관찰한 뒤 **92초**가 지나도 버튼이 보였습니다. 이 시간은 번역 속도가 아닙니다.
- **입력 복구 결함 발견:** 초점 이동 뒤 원문 복구 시 ‘입력이 바뀌어 원문 복구를 취소했습니다’가 표시됐습니다. 검색창은 열려 있었고 번역문은 유지됐습니다. 성공으로 기록하지 않습니다.
- **페이지 병기:** 확장 팝업에서 GPT-6 Luna 선택을 확인하고 번역을 시작했습니다. **22 / 22** 완료 안내와 영문 아래 한국어 문단이 함께 표시되는 것을 확인했습니다.
- **페이지 복원:** ‘원문 보기’를 누른 뒤 한국어 병기가 사라지고 영문 문서와 ‘원문으로 돌아왔습니다’ 안내가 남았습니다.

입력 복구 결함은 [복구 보완판](RESTORE-UPDATE-2026-10-24.md)에서 수정했습니다. 설치된 브라우저에서 수정판을 새로고침한 뒤의 최종 검사 결과는 아래에 별도로 기록합니다.

## 격리된 Chrome for Testing

실제 ChatGPT 계정과 격리 연결 포트를 사용했습니다. 사용자의 Chrome·Comet 프로필은 사용하지 않았습니다.

```powershell
npm run test:login:isolated -- --grep "selecting each Luna|NVIDIA modal search"
```

수정 전 v1.3.0에서 **2개 시험 통과**:

- GPT-6 Luna와 GPT-5.6 Luna 각각 모델 선택·저장·재로드, 페이지 병기, 스페이스 3회 입력 번역, 입력 원문 복구, 페이지 원문 복원.
- 실제 NVIDIA 검색창 번역, 즉시 마우스로 원문 복구, 검색 모달 열림 유지. 이 검사는 초점 이동 뒤 복구 결함을 포함하지 않았습니다.

## 복구 보완판 검사

새 검사에서 복구 버튼으로 초점을 이동한 뒤 Enter로 실행하는 실패를 먼저 재현했습니다. 수정 후 실제 편집과 초점 이동을 구분하며, 같은 텍스트로 편집해 되돌렸을 때도 복구를 취소하는 보호 동작을 함께 확인했습니다.

```powershell
npm run check
npm run test:regression
```

JavaScript 구문 검사, 로컬 모의 API를 이용하는 브라우저 회귀 **26개 통과**.

수정 후 실제 계정의 NVIDIA 검색창 검사도 다시 실행해 **1개 통과**했습니다. GPT-6 Luna가 `아이작심에서 로스 연결 방법을 알려주세요.`를 `Please tell me how to connect ROS in Isaac Sim.`로 번역했고, 복구 버튼으로 키보드 초점을 옮긴 뒤 Enter를 눌러 원문 일치·검색 모달 열림 유지를 확인했습니다. 이 결과는 격리된 Chrome for Testing에서 확인한 것입니다.

### 설치된 Chrome·Comet 최종 확인

사용자가 두 브라우저의 확장을 새로고침한 뒤 대상 웹페이지도 새로고침했습니다. 실제 설치 브라우저에서 아래 결과를 확인했습니다.

| 검사 | Chrome | Comet |
|---|---|---|
| 스페이스 3회 입력 번역 | GPT-6 Luna 영어 번역 완료 | GPT-6 Luna 영어 번역 완료 |
| 수정판 복구 버튼 유지 | 완료 관찰 후 34초에도 표시 | 완료 관찰 후 54초에도 표시 |
| 초점 이동 후 원문 복구 | Tab으로 버튼에 이동 → Enter → 정확한 원문 일치 | Tab으로 버튼에 이동 → Enter → 정확한 원문 일치 |
| 복구 후 검색창 | 열린 상태 유지 | 열린 상태 유지 |
| 이번 페이지 병기·복원 | 이번 연결 검사에서는 미실시 | 같은 날 22/22 병기·페이지 복원 확인; 입력 복구 코드 수정 전의 결과 |

Chrome 원문 `크롬에서 연결을 확인하고 원문을 복구합니다.` → `Check the connection in Chrome and restore the original text.` → 같은 한국어 원문으로 복구했습니다. Comet도 앞서 적은 한국어 예문으로 정확하게 돌아왔고 `입력 원문을 복구했습니다.` 안내를 확인했습니다.

Comet 최종 검사에서는 검색창을 닫았다가 다시 열어도 번역문과 복구 버튼이 유지됐습니다. 그 상태에서 키보드로 복구 버튼에 초점을 이동해 원문을 복구했습니다. 34초·54초는 버튼 유지 관찰 시간이며 번역 속도가 아닙니다. 모든 사이트의 편집기나 실제 한글 IME 조합 전체에 대한 보장은 아닙니다.

## 설명서 검수

게시용 체크아웃에서는 기존 v1.4.0 변경에 복구 수정을 합친 뒤 구문 검사와 단위 **21개**, 브라우저 회귀 **26개**를 다시 실행해 통과했습니다. 기존 Linux 실행 파일·연결 프로그램·버전 파일이 원격 변경과 동일하게 보존됐고, 게시한 입력 처리 파일은 설치 브라우저에서 검사한 파일과 SHA-256이 일치합니다.

HTML 설명서를 1440px·390px 화면으로 렌더링해 가로 넘침이 없음을 확인했습니다. 테마 전환, 주소 복사 결과 안내, 인쇄 버튼과 JavaScript 오류를 검사했습니다. A4 PDF 6쪽을 PNG로 렌더링해 글자·표·페이지 나눔을 확인했습니다.

전체 브라우저 화면 증거와 서버 응답은 로컬 `artifacts`에 보관하며 개인 탭·북마크가 보이는 이미지는 공개 저장소에 추가하지 않습니다. 주요 파일은 `comet-1024-fixed-restored.png`, `comet-1024-final-result.json`, `chrome-1024-fixed-restored.png`, `comet-1024-page-22.png`, `comet-1024-page-restored.png`입니다.
