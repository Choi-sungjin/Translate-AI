# 팝업 검색창 수정 — v1.2.2

## 재현한 문제

사용자가 Chrome과 Comet의 검색창에서 스페이스 3회 번역이 되지 않는다고 보고했습니다. 실제 Chrome의 NVIDIA 문서 검색창에서 `아이작심에서 로스 연결 방법을 알려주세요.`를 입력한 뒤 스페이스 키를 세 번 눌렀습니다. 입력은 `Please tell me how to connect ROS in Isaac Sim.`로 번역됐지만 진행 안내와 **원문 복구** 버튼이 검색창 뒤로 가려졌습니다. 열린 모달 외부에 있는 버튼은 클릭할 수 없었습니다. Comet 확장 팝업에서는 v1.2.1을 확인했습니다.

이 재현은 모달 검색창의 알림·복구 접근 문제를 확인한 것이며, 모든 스페이스 키 미인식 원인이 같다는 뜻은 아닙니다. 브라우저 주소창과 브라우저 자체 찾기(Ctrl+F)는 웹페이지 입력창이 아니므로 확장의 번역 대상에 포함되지 않습니다.

## 수정

- 검색창이 네이티브 모달이면 번역 알림을 해당 모달 내부에 둡니다.
- 수동 popover를 사용해 모달의 배경막·변형·잘라내기보다 위에 알림을 표시합니다. 검색창 포커스와 입력은 유지합니다.
- NVIDIA 사이트가 복구 버튼을 누른 좌표를 검색창 바깥 클릭으로 오인하지 않도록 알림의 클릭 이벤트가 사이트 검색창으로 전달되지 않게 했습니다. 원문을 복구해도 검색창이 열린 상태로 남습니다.
- 모달을 열거나 닫을 때 알림 위치를 갱신하고, 사용자가 닫은 알림은 다시 나타나지 않게 합니다.
- 원문 복구 알림은 시간제한 없이 유지합니다. 일반 안내는 기존처럼 30초 표시합니다.

모달 외부가 비활성화되는 동작과 popover의 최상위 표시 동작은 [MDN dialog 문서](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog), [showPopover 문서](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/showPopover)를 참고했습니다.

## 검증

- 구문·manifest 검사: 22개 JavaScript 파일 통과.
- 단위 검사: 17/17 통과.
- 최종 회귀 검사: 24/24 통과. `artifacts/regression-1.2.2.json`.
- 실제 ChatGPT 계정 검사: 기존 4개 시나리오 통과, 추가한 NVIDIA 검색창 시나리오는 수정 후 재실행에 통과. `artifacts/login-1.2.2-initial.json`, `artifacts/login-modal-1.2.2.json`에 실행별 결과를 구분해 보관합니다.

추가 회귀 검사는 변형·잘라내기·바깥 클릭 닫기가 적용된 검색 모달에서 스페이스 3회 번역 후 12.5초를 기다린 뒤 복구 버튼을 실제 클릭합니다. 검색 모달이 열린 상태를 유지하고 폼이 제출되지 않으며 원문이 돌아오는지 확인합니다. 별도 검사에서는 페이지 원문 보기 버튼이 모달을 열고 닫는 동안 사용 가능한지와 닫은 알림이 다시 생기지 않는지 확인합니다.

별도 Chrome for Testing에서 실제 ChatGPT 계정으로 NVIDIA 검색창을 시험했습니다. `아이작심에서 로스 연결 방법을 알려주세요.` → `Please tell me how to connect ROS to Isaac Sim.` 번역과 한국어 복구, 복구 후 검색창 열림 유지가 통과했습니다. 번역부터 복구까지 7.490초였습니다. 초기 실행에서 쿠키 동의창이 검색 버튼을 가렸으며, 선택적 쿠키 거절을 검사 준비 단계에 추가했습니다. 이어서 실제 사이트의 바깥 클릭 닫기 동작을 발견해 수정한 후 재실행에 성공했습니다. 최종 결과는 로컬 `artifacts/login-modal-1.2.2.json`에 있습니다.

## 사용자 Chrome·Comet 최종 검증 — 2026-10-18

사용자가 Chrome·Comet 확장을 최종 새로고침한 뒤 실제 NVIDIA 문서에서 직접 확인했습니다. Comet 팝업의 `v1.2.2` 표시를 확인하고 웹페이지도 새로고침했습니다. 기존 ChatGPT 연결 설정을 그대로 사용했으며 검색 폼은 제출하지 않았습니다.

| 항목 | 사용자 Comet | 사용자 Chrome |
| --- | --- | --- |
| 페이지 병기 | NVIDIA 문서 22/22 완료, 영어 문단 아래 한국어 표시 | 이전 v1.2.1에서 22/22 확인. 이번 실행은 검색창 수정에 집중 |
| 페이지 원문 보기 | 상단 버튼 클릭 후 한국어 번역 제거, 영어 원문·링크 표시, 완료 안내 확인 | 이전 검증 기록 참고 |
| 검색창 스페이스 3회 | 실제 `space` 키 세 번으로 영어 번역 확인 | 검색 입력창에 연속 스페이스 키 세 번으로 영어 번역 확인 |
| 복구 버튼 유지 | 완료 관찰 후 최소 33.688초 | 완료 관찰 후 최소 40.560초 |
| 입력 원문 복구 | 한국어 원문 일치, 검색창 열림 유지 | 한국어 원문 일치, DOM의 모달 열림 상태 확인 |

Comet 예문은 `코멧 검색창에서 원문 복구 기능을 확인합니다.` → `Check the original text restoration feature in the Comet search bar.`였습니다. 세 번의 네이티브 키 입력 호출에는 총 294ms가 걸렸습니다. 원문 복구 클릭 후 한국어가 정확히 돌아왔으며 검색창은 열린 상태였습니다.

Chrome 예문은 `검색창을 열린 채로 유지하고 원문을 복구합니다.` → `Keep the search bar open and restore the original text.`였습니다. 복구 후 동일한 한국어와 `modalOpen: true`를 확인했습니다.

버튼 유지 시간은 번역 완료 상태를 처음 관찰한 순간부터 잰 최솟값입니다. 번역 완료 지연이나 영구 유지의 시간 측정값은 아닙니다. 코드에는 복구 알림의 자동 만료 타이머가 없으며, 사용자가 복구·닫기·새 번역을 실행하면 알림이 바뀝니다.

최종 수정 적용 전 Chrome 검사에서도 번역과 43.867초 후 원문 복구는 성공했지만 검색창이 닫혔습니다. 확장 재적용 후 위 최종 검사를 통과했으므로 이 적용 대기 상태는 해소됐습니다.

화면에는 개인 탭·북마크가 포함될 수 있어 스크린샷은 공개 저장소에 올리지 않고 로컬 `artifacts/`에 보관합니다.

- `comet-version-final-1.2.2.png`
- `comet-nvidia-bilingual-final-1.2.2.png`, `comet-nvidia-restored-final-1.2.2.png`
- `comet-search-translated-final-1.2.2.png`, `comet-search-held-final-1.2.2.png`, `comet-search-restored-final-1.2.2.png`
- `chrome-search-translated-final-1.2.2.png`, `chrome-search-restored-final-1.2.2.png`
- `comet-installed-final-1.2.2.json`, `chrome-installed-final-1.2.2.json`

v1.2.1의 실제 Chrome 페이지·Perplexity 검증 기록은 [CHROME-1.2.1.md](CHROME-1.2.1.md), Comet의 버전별 검증은 [COMET.md](COMET.md)에 있습니다.
