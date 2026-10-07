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
pnpm dev         # 개발 서버 (같은 Wi-Fi의 스마트폰에서 접속 가능)
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## IME 스파이크 (`/lab/ime`)

현재 단계(M0)의 목표는 "실제 iPhone かな 키보드로 문제를 끊김 없이 연속해서 풀 수 있는가"를 확인하는 것이다.

1. `pnpm dev`를 실행하고 터미널에 표시된 Network 주소를 스마트폰에서 연다.
2. `/lab/ime`에서 "입력 시작"을 누르고 かな 키보드로 화면의 줄을 입력한다.
3. 리셋 전략(R1–R4)과 스냅샷 타이밍을 바꿔 가며 반복하고, 이상이 보이면 표시 버튼을 누른다.
4. "서버로 보내기"를 누르면 trace가 `packages/core/test/fixtures/traces/incoming/`에 저장된다.

`/__trace` 엔드포인트는 개발 서버에서만 동작한다.
