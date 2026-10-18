# twiper

일본어 12키 가나 플릭 입력을 **실제 스마트폰 키보드로** 훈련하는 모바일 PWA.

자체 키보드를 만들지 않는다. 시스템 일본어 かな 키보드로 입력한 결과 문자열을 받아 채점하고, 약한 부분을 찾아 다시 훈련시킨다.

설계 문서: [docs/superpowers/specs/2026-10-07-twiper-design.md](docs/superpowers/specs/2026-10-07-twiper-design.md)

## 구조

| 경로            | 역할                                                    |
| --------------- | ------------------------------------------------------- |
| `packages/core` | 플랫폼 독립 로직. 순수 TypeScript이며 DOM을 쓰지 않는다 |
| `apps/web`      | Vite + React 웹 앱                                      |

## 개발

```sh
pnpm install
pnpm dev         # 개발 서버 (이 컴퓨터에서만)
pnpm dev:lan     # 같은 Wi-Fi의 스마트폰에서 접속 + 실기 trace 수집
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## 설치형 앱(PWA)

빌드하면 `manifest.webmanifest`와 서비스 워커(`sw.js`)가 생기고, 앱 화면과 콘텐츠를 모두 미리 받아 두어 인터넷 없이도 훈련할 수 있다.

- 서비스 워커는 빌드에서만 켠다. `pnpm dev`·`pnpm dev:lan`에서는 등록하지 않는다.
- 새 버전은 홈·설정 화면에 「새 버전이 있어요」 알림으로만 알리고, 사용자가 「업데이트」를 눌렀을 때 적용한다. 훈련·튜토리얼 중에는 알리지 않는다.
- 이 컴퓨터에서 확인: `pnpm build && pnpm --filter @twiper/web preview` 후 `http://localhost:4173`.
- 서비스 워커는 HTTPS(또는 localhost)에서만 동작한다. iPhone에서 설치·오프라인을 확인하려면 HTTPS로 배포한 주소가 필요하다. LAN 주소(`http://192.168…`)에서는 홈 화면에 추가해도 오프라인으로 동작하지 않는다.

## IME 스파이크 (`/lab/ime`)

현재 단계(M0)의 목표는 "실제 iPhone かな 키보드로 문제를 끊김 없이 연속해서 풀 수 있는가"를 확인하는 것이다.

1. `pnpm dev:lan`을 실행하고 터미널에 표시된 `IME lab:` 주소(`…/lab/ime#k=…`)를 같은 Wi-Fi의 스마트폰에서 연다.
2. "입력 시작"을 누르고 かな 키보드로 화면의 줄을 입력한다.
3. 리셋 전략(R1–R4)과 스냅샷 타이밍을 바꿔 가며 반복하고, 이상이 보이면 표시 버튼을 누른다.
4. "서버로 보내기"를 누르면 trace가 `packages/core/test/fixtures/traces/incoming/`에 저장된다.

같은 주소에서 경로만 `/lab/guide-check`로 바꾸면 키보드 가이드 확인 화면이 열린다. 안내된 동작(예: `[や] 키 ← 왼쪽으로 플릭`)을 실제 키보드로 하고 "기록 → 다음"을 누르면, 나온 문자를 `packages/content`의 가이드 데이터가 예상한 문자와 비교한다. 문헌으로 확정하지 못한 항목만 묻는다.

`pnpm dev`는 이 컴퓨터에서만 접속할 수 있고 trace를 받지 않는다. `pnpm dev:lan`은 개발 서버를 같은 네트워크에 열고 trace 저장 엔드포인트(`/__trace`)를 켠다. 이 엔드포인트는 저장소 폴더에 파일을 쓰므로, 서버를 띄울 때마다 새로 만드는 키(주소의 `#k=…`)를 가진 요청만 받고 요청 크기와 저장 파일 수를 제한한다. 신뢰할 수 있는 네트워크에서만 사용한다.
