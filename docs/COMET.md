# 실제 Comet 검증 — 2026-10-18

Windows Computer Use로 사용자가 사용하는 Comet 창을 직접 조작했습니다. 별도 Chrome for Testing의 결과와 구분합니다. 공개 NVIDIA 문서와 합성 테스트 문장만 번역했으며 입력 폼은 제출하지 않았습니다.

## 적용 확인

- 프로젝트의 `scripts/stop-bridge.ps1`, `scripts/start-bridge.ps1`로 로컬 연결 프로그램을 재시작했습니다.
- 실행 중인 `/health`: `version: "1.2.0"`, `pageBatchTransport: true`.
- 확장 팝업의 버전 표시를 고정 문자열 `v1.0`에서 `chrome.runtime.getManifest().version`으로 수정했습니다. 실제 Comet 팝업에서 `v1.2.0`을 확인했습니다.
- 기존 연결 코드를 유지한 상태로 번역에 성공했습니다. 확장 관리 화면이나 브라우저 프로필을 우회 조작하지 않았습니다.

## 직접 확인한 동작

| 항목 | 실제 관찰 |
| --- | --- |
| NVIDIA 원문·번역 병기 | [ROS 2 문서](https://docs.isaacsim.omniverse.nvidia.com/latest/ros2_tutorials/index.html)에서 22/22 완료. 영어 문단 아래에 한국어 표시 |
| NVIDIA 원문 복원 | 상단 **원문 보기** 클릭 → 한국어 번역 제거, 영어 원문과 ROS 링크 유지, **원문으로 돌아왔습니다.** 표시 |
| 최신 알림 위치 | 화면 상단 중앙에 번역 상태와 복원 버튼 표시 |
| 스페이스 키 3회 | [공개 테스트 입력 폼](https://httpbin.org/forms/post)의 Delivery instructions에 한국어 입력 후 실제 `space` 키 3회. 연속 키 입력 호출에 255ms 소요. **입력한 내용을 번역하고 있습니다…** 표시 후 영어로 변경 |
| 입력 번역 예문 | `이 문장은 코멧 브라우저의 번역 기능을 확인하는 테스트입니다.` → `This sentence is a test to check the Comet browser's translation feature.` |
| 페이지 단축키 | Comet의 Alt+A는 브라우저 어시스턴트와 충돌. 확장 아이콘의 **이 페이지 번역하기**로 실행 |

문자열 공백 세 개를 한 번에 넣는 동작은 키 연타를 대신하지 않았습니다. 성공한 검증은 네이티브 `space` 키를 세 번 누른 결과입니다.

입력 번역의 **원문 복구** 버튼은 확인했지만 이번 Comet 검사에서 클릭 시점에 알림이 사라져 입력 복구 성공까지는 확인하지 못했습니다. 위 원문 복원 통과는 NVIDIA 페이지의 원문 보기 동작입니다. 입력 복구는 앞서 실제 Chrome 및 별도 테스트 브라우저에서 검증했습니다.

## 측정 경계와 증거

페이지 시작 약 20초 뒤 관찰 시 12/22, 약 33초 뒤 관찰 시 22/22였습니다. 입력 번역은 키 연타 후 약 13초 뒤 관찰 시 완료 상태였습니다. 화면을 연속 측정하지 않았으므로 실제 완료 지연 수치로 사용하지 않습니다. 통제된 성능 비교는 [PERFORMANCE.md](PERFORMANCE.md)를 참고하세요.

스크린샷은 사용자 브라우저의 탭·북마크가 포함되어 로컬 `artifacts/`에만 보관합니다.

- `comet-nvidia-bilingual-1.2.0.png`
- `comet-nvidia-restored-1.2.0.png`
- `comet-extension-version-1.2.0.png`
- `comet-space3-translated-1.2.0.png`
