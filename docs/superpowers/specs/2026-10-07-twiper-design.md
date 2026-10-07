# twiper — 일본어 가나 플릭 입력 훈련 PWA 구현 계획

> 저장소: `https://github.com/GiToon10100011/twiper-kana.git` · 로컬: `/Users/tylerjon/twiper` · 작성일 2026-10-07
> 상태: **2026-10-07 승인.** §19 "Recommended First Implementation"(M0)부터 구현한다.

## Context

로마자 입력 습관이 굳은 사용자가 일본어 12키 가나 플릭 입력으로 넘어가려 해도, 문자 위치·방향이 즉시 떠오르지 않아 몇 번 시도하다 로마자로 돌아간다. twiper는 이 전환을 **체계적인 반복 훈련**으로 끝까지 끌고 가는 모바일 PWA다.

**확정된 핵심 결정 (사용자 지시, 이 계획의 전제)**

| 결정 | 내용 |
|---|---|
| 입력 방식 | **자체 키보드를 만들지 않는다.** 사용자의 실제 시스템 일본어 かな 키보드 → HTML `<input>` → composition/input 이벤트 → 문자열 비교 |
| 분석 대상 | 손가락 움직임이 아니라 **입력 결과 문자열**(과 그 시간). gesture/pointer/가상 키보드/자체 IME는 범위에서 제외 |
| 튜토리얼 | 판정 없는 **시각 설명 + 애니메이션**. 상시 참조 가능한 매뉴얼 |
| 정답 판정 시점 | **단계별**: 기초·문자 조합은 조합 중(미확정) 문자열이 목표와 같아지면 즉시 정답 / 단어·문장·실전은 確定(변환 선택)까지 해야 정답 |
| 기준 키보드 | **iPhone 기본 かな 키보드** (튜토리얼 도해·실기기 검증 1순위). Gboard는 데이터 추가로 확장 |
| UI 언어 | **한국어 → 일본어 → 영어** 순 (일본인 사용자도 대상). 문자열은 처음부터 i18n 분리 |
| 스택 | **Vite + React + TS, pnpm workspace 모노레포** (`packages/core` 순수 TS · `packages/content` · `apps/web`) |
| 학습 루프 | 튜토리얼 → 기초 → 문자 조합 → 단어 → 문장 → 실전 → 약점 보완 → 필요한 단계로 회귀 |

초기 요청서의 §8 Gesture Recognition, §9 Keyboard Profile은 위 결정에 따라 각각 **Input Capture & IME Composition**, **Keyboard Guide(설명용 참조 데이터)** 로 대체한다.

---

## 1. Repository Analysis

| 항목 | 현재 상태 |
|---|---|
| 로컬 `/Users/tylerjon/twiper` | 빈 디렉터리. git 저장소 아님 |
| 원격 `GiToon10100011/twiper-kana` | 2026-10-07 생성, PUBLIC, **empty** (기본 브랜치 없음) |
| framework / TS / styling / PWA / test / lint / CI | 전부 없음 — 그린필드 |
| 로컬 툴체인 | Node 22.15.1 · pnpm 10.12.1 · npm 11.4.2 · bun 1.4.2 |

존중할 기존 구조가 없으므로 아래 스택을 새로 정한다.

| 영역 | 선택 | 이유 |
|---|---|---|
| 패키지 매니저 | pnpm workspace | 이미 설치됨. core/content/web 경계를 패키지로 강제 |
| 앱 | Vite + React 19 + TypeScript(strict) | 서버 불필요한 정적 SPA → 오프라인 PWA와 궁합. RN 이식 시 React 지식·core 재사용 |
| 라우팅 / 상태 | React Router · Zustand | 화면 수 적음. 세션 로직은 core의 순수 reducer, Zustand는 UI 바인딩만 |
| 스타일 | Tailwind CSS v4 + CSS 변수 테마 | 모바일 세로 화면 빠른 구성. 컴포넌트 라이브러리는 필요 시 Radix 프리미티브만 |
| 저장 | IndexedDB (Dexie 4) — repository 인터페이스 뒤 | §13 |
| i18n | i18next + react-i18next | RN에서도 동일 사용 |
| PWA | vite-plugin-pwa (Workbox generateSW) | §14 |
| 테스트 | Vitest · fast-check · React Testing Library · Playwright | §15 |
| 품질 | ESLint(flat) + typescript-eslint + eslint-plugin-boundaries · Prettier | 레이어 위반을 lint로 차단 |
| CI/배포 | GitHub Actions → Cloudflare Pages (정적, PR 프리뷰 URL) | 실기기 테스트에 HTTPS 프리뷰 URL이 필수. 정적 산출물이라 다른 호스트로 교체 쉬움 |

---

## 2. Product Definition

**문제.** 플릭 입력은 "문자 → (키, 방향)" 대응이 자동화돼야 빠른데, 로마자 사용자는 실전(채팅)에서 이 대응을 떠올릴 여유가 없어 익히기 전에 포기한다.

**정의.** twiper는 일본어 타자게임이 아니라, **실제 스마트폰 かな 키보드로 문제 문자열을 만들어내는 연습을 난이도 순으로 반복시키고, 입력 결과에서 약점을 찾아 그 부분으로 되돌려 보내는 입력 습관 훈련 시스템**이다.

**성공 기준 (제품)**
- 사용자가 `こんにちは`를 보고 로마자를 거치지 않고 플릭으로 입력한다 → 지표: 히라가나 단어 첫 입력까지 반응 시간·가나당 시간의 하락, 로마자 키보드 감지 0회.
- 실전 채팅 문장(한자+가타카나+기호 혼합)을 strict 채점으로 통과한다.
- 훈련 밖(실제 메신저)에서 かな 키보드를 유지한다 → 앱 내 자기 보고 체크로 추적.

**비목표.** 자체 키보드·IME, 제스처 분석, 일본어 어휘/문법 교육, 과한 게임화(수집·보상), 로그인 필수.

**우선순위 (재해석).** 실제 키보드에서의 입력 흐름(끊김 없는 입력창·IME 처리) > 학습 효과 > 튜토리얼 UX > 오류 분석 > 콘텐츠 양 > 게임화.

---

## 3. Target User

| 페르소나 | 상태 | 필요 |
|---|---|---|
| **A. 로마자 습관이 강한 일본어 학습자 (1차, 한국어 화자)** | 가나·기초 한자 읽기 가능. 로마자 입력은 빠름. 플릭은 위치가 안 떠오름 | 행 단위 위치 암기 → 자동화, 로마자 힌트 제거, 짧은 세션, 포기 지점(탁음·요음·ー·외래음) 집중 훈련 |
| **B. 일본어 네이티브 중 로마자/토글 입력 사용자 (2차)** | 읽기는 완벽. 플릭만 느림 | 후리가나·뜻 불필요. 일본어 UI, 속도 중심 훈련, 문장·실전 비중 큼 |
| C. 영어권 학습자 (3차) | A와 유사 | 영어 UI (M4) |

A의 핵심 실패 패턴과 대응:
- 머릿속에서 `ko-n-ni-chi-ha`로 번역 → 로마자 힌트 기본 off, 힌트는 "키+방향 도해"로만 제공하고 숙련도에 따라 소거.
- 실전에서 막히면 🌐로 로마자 키보드 복귀 → 입력 스트림에서 **로마자 키보드 사용 감지** 후 안내(§8).
- 같은 키 연타가 다른 문자로 바뀜(토글 입력) → 온보딩에서 iOS `フリックのみ` 설정 안내.

---

## 4. Complete Feature Map

우선순위: P0 = MVP1, P1 = MVP2, P2 = MVP3, P3 = MVP4, F = Future.

| 영역 | 기능 | 우선 | 비고 |
|---|---|---|---|
| 입력 | 시스템 키보드용 훈련 입력창(자동 focus, 연속 풀이, 키보드 유지) | P0 | §8 |
| 입력 | IME composition 처리 → `InputSnapshot` 스트림 | P0 | 브라우저별 이벤트 순서 흡수 |
| 입력 | 단계별 판정(`composing` / `commit`) | P0 / P1 | commit 모드는 가타카나·한자부터 필요 |
| 입력 | 로마자 키보드 감지 · 토글 입력 감지 안내 | P0 / P1 | 결과 스트림 기반 |
| 채점 | AnswerChecker + 정규화 정책(strict/lenient) | P0 / P2 | lenient(가나 폴딩·읽기 채점)는 P2 |
| 채점 | diff 시각화 · 오류 분류 | P1 | §10.4 |
| 온보딩 | 키보드 준비 체크리스트 + 키보드 체크 | P0 | iOS 기준 |
| 튜토리얼 | Part 1–3 (원리·12키·방향) | P0 | FlickDiagram 애니메이션 |
| 튜토리얼 | Part 4–9 / 10–15 / 16 | P1 / P2 / P3 | §6 |
| 튜토리얼 | 상시 매뉴얼 탭 · 문자 검색("이 글자 어떻게 쳐?") | P1 | `explainInput()` 재사용 |
| 도움말 | Contextual Help (반복 오답·머뭇거림 시) | P1 | |
| 훈련 | 기초(50음 행별·랜덤) | P0 | |
| 훈련 | 문자 조합(탁음·반탁음·소문자·요음·촉음) | P1 | |
| 훈련 | 가타카나(변환)·장음·단어 | P1 | |
| 훈련 | 외래음·ヴ·기호·々·문장·실전 채팅 | P2 | |
| 훈련 | 영어/숫자/기호 혼합 | P3 | |
| 엔진 | 세션 내 오답 재출제 | P0 | |
| 엔진 | 약점 가중 출제 · 추천 훈련 | P2 | |
| 엔진 | 세션 간 간격 반복(Leitner) | P3 | Scheduler 교체 |
| 힌트 | Beginner/Normal/Advanced/Expert 단계 소거 | P1 | |
| 통계 | 세션 결과(정확도·가나/분·시간) | P0 | |
| 통계 | 스킬별 숙련도·혼동 쌍·느린 문자 | P1 | |
| 통계 | 대시보드(추세·추천) | P2 | |
| 저장 | IndexedDB 로컬 저장 · 내보내기/가져오기 | P0 / P3 | |
| PWA | 설치·오프라인·업데이트 알림 | P0 | |
| 동기 | 오늘의 훈련·streak·카테고리 mastery | P1–P2 | 수집·보상 없음 |
| i18n | ko + ja UI / ja 튜토리얼 본문 / en | P0 / P2 / P3 | |
| 확장 | Gboard 가이드 / RN 앱·계정·동기화 | P2 / F | |

---

## 5. Japanese Input Coverage

"iOS かな 입력법" 열은 튜토리얼·도움말에 쓰는 **설명용 참조 데이터**다. ⚠︎ 표시는 문헌으로 확정하지 못해 **M0에서 사용자의 iPhone으로 실기 확인 후 데이터화**한다. 채점은 입력법과 무관하게 결과 문자열만 본다.

| # | 범주 (skill) | 범위 | iOS かな 입력법 (참조) | 우선 | 판정 | 단계 |
|---|---|---|---|---|---|---|
| 1 | hiragana 50음 `kana.row.*` | あ〜ん (を 포함) | 각 행 키: 탭=あ단, ←い, ↑う, →え, ↓お. わ키: わ/を←/ん↑ | core | composing | M1 |
| 2 | dakuten | がざだば행 | 문자 뒤 `小゛゜` 키 탭(순환) ⚠︎키 플릭 직접 입력 방향 | core | composing | M2 |
| 3 | handakuten | ぱ행 | は행 + `小゛゜` 2회(は→ば→ぱ) ⚠︎플릭 직접 | core | composing | M2 |
| 4 | small kana | ぁぃぅぇぉ ゃゅょ っ (ゎ는 rare) | 문자 뒤 `小゛゜` (つ→っ→づ, や→ゃ) | core | composing | M2 |
| 5 | yōon | きゃ…りょ, ぎゃ・じゃ・びゃ・ぴゃ 계열 | い단 + や행 + 小 (탁음 요음은 ゛→ゃ 순서) | core | composing | M2 |
| 6 | sokuon | っ / ッ (きって, がっこう, ベッド) | つ + 小 | core | composing(가나) / commit | M2 |
| 7 | katakana | 50음·탁음·소문자 전체 | **가타카나 모드 없음.** 히라가나로 읽기 입력 → 변환 후보에서 선택 | core | commit | M2 |
| 8 | long vowel `ー` | コーヒー, ゲーム | わ키 → | common(실전 빈도 최상) | commit | M2 |
| 9 | foreign-sound (1표) | シェ ジェ チェ ティ ディ ファ フィ フェ フォ デュ ツァ ツェ ツォ | 기본 가나 + 작은 모음(て+い小) → 변환 | common | commit | M3 |
| 10 | foreign-sound (2표) | ウィ ウェ ウォ(IT 어휘 빈도로 common 승격) / トゥ ドゥ テュ フュ イェ クァ… | 동일 | common / advanced | commit | M3 |
| 11 | ヴ 계열 | ヴ ヴァ ヴィ ヴェ ヴォ (ゔ 참고) | う + ゛ → ゔ → 변환 | advanced | commit | M3 |
| 12 | rare kana | ゎ ヮ ヵ ヶ ゔ | ゎ=わ+小. ヵヶ는 단어 읽기로(さんかげつ→三ヶ月) | rare (ヶ는 advanced) | commit | M3 참고 과정 |
| 13 | 々 | 人々 時々 色々 日々 | 단어 읽기로 변환(ひとびと→人々). 단독: 「おなじ」 변환 ⚠︎숫자 모드 8키 | common | commit | M3 |
| 14 | repetition marks | ゝ ゞ ヽ ヾ | 「おなじ」「くりかえし」 변환 후보 ⚠︎ | rare | commit | M3 참고 과정 |
| 15 | punctuation 기본 | 。 、 ！ ？ | `、。?!` 키: 탭、 ←。 ↑？ →！ | core | composing/commit | M1(。、)·M3 |
| 16 | 괄호·기호 | 「」『』（）【】〔〕〈〉《》 ・ 〜 … | 「」=や키 ←/→. 그 외 「かっこ」 변환. ・〜… ⚠︎숫자 모드 / 「てん」「から」 변환 | common(「」・〜…) / advanced | commit | M3 |
| 17 | chat symbols | ｗ www 笑 （笑） …… ！？ ♪ | 笑=「わら」 변환, ♪=「おんぷ」 변환 ⚠︎, w=ABC 모드 | common | commit + 항목별 폭 폴딩 | M3 |
| 18 | English | 소문자·대문자 (iPhone, YouTube, SNS) | `ABC` 모드 전환 ⚠︎대문자 전환 | advanced | commit | M4 |
| 19 | numbers | 0–9 (24GB, 4060) | `☆123` 모드 | advanced | commit | M4 |
| 20 | mixed | 일본어+영어+숫자+기호, URL/이메일 유사 | 모드 전환 왕복 | advanced | commit | M4 |

- 외래음 등급은 내각고시 「外来語の表記」의 제1표(일반적으로 쓰는 가나) / 제2표(원음에 가깝게 쓸 때)를 기준으로 하고, ウィ·ウェ·ウォ만 실사용 빈도로 한 단계 올린다. 단어 빈도는 공개 코퍼스 빈도표(BCCWJ 등)를 참고해 M3에서 보정.
- **가타카나 단일 문자 드릴은 만들지 않는다.** 실제 키보드에서 `カ` 한 글자는 "か 입력 → 후보에서 カ 찾기"라 플릭이 아닌 후보 탐색 훈련이 된다. 가타카나는 2–4자 단어(カメラ, ホテル)부터 시작한다.
- Gboard 차이(Mozc 오픈소스 매핑 테이블로 확인): や키 ←（ →）, `〜`·`…` 플릭 직접 입력, modifier 키의 ゛/゜/小 직접 플릭. M3에서 `gboard-12key` 가이드로 추가.

---

## 6. Tutorial Architecture

**원칙.** 튜토리얼은 입력을 판정하지 않는다. 데이터로 정의된 설명·도해·애니메이션이며, 온보딩 1회용이 아니라 **매뉴얼 탭에서 언제든 열람**한다.

**구성 요소**
- `KeyboardGuide` (참조 데이터, §9): 12키 배치와 각 키의 탭/4방향 문자, modifier 순환 규칙, 기호 입력 레시피.
- `explainInput(unit, guide) → InputStep[]` (core 순수 함수): 문자·조합을 입력 단계로 분해.
  - `きゃ` → `[か키 ←(き)] → [や키 탭(や)] → [小゛゜ 탭(ゃ)]`
  - `ヴァ` → `[あ키 ↑(う)] → [小゛゜ ×2(ゔ)] → [あ키 탭] → [小゛゜(ぁ)] → [변환: ヴァ]`
  - `々` → `[읽기: おなじ] → [변환]`
- `<FlickDiagram>` (web): 12키 그리드에서 해당 키를 강조하고 손가락 점이 방향으로 움직이는 SVG/CSS 애니메이션. `InputStep[]`을 순서대로 재생. `prefers-reduced-motion`이면 정지 화살표.
- 튜토리얼 문서 = 블록 배열(콘텐츠 패키지): `text | diagram | steps | examples | tip | platformNote | tryIt`. 본문은 로케일별(ko → ja → en).

**블록 흐름 (각 Part 공통)**: 설명 → 애니메이션(`steps`) → 예시 단어 → `tryIt`(선택: 훈련과 **같은 입력창 컴포넌트**로 실제 키보드 입력 3–5문제) → 관련 훈련으로 이동.
"엔진 공유" 요구는 이 형태로 유지된다: 튜토리얼의 `tryIt`과 훈련은 동일한 `InputSession`·`AnswerChecker`·`<TrainingInput>`을 쓴다.

| Part | 주제 | 단계 |
|---|---|---|
| 0 | 키보드 준비 (かな 키보드 추가, `フリックのみ`, 🌐 전환, 確定/후보 바) | M1 |
| 1–3 | 플릭 원리 / 12키 위치 / 방향(단)의 의미 | M1 |
| 4–7 | 탁음·반탁음 / 작은 가나 / 요음 / 촉음 | M2 |
| 8–9 | 가타카나(읽기→변환) / 장음 `ー` — 히라가나 장음 표기(おかあさん, こうこう)와의 차이 포함 | M2 |
| 10–12 | 외래어 조합 / ヴ / 특수 가나(ヵヶ 용례) | M3 |
| 13–15 | 々·반복 기호 / 문장부호·괄호 / 채팅 기호 | M3 |
| 16 | 영어·숫자·기호 모드 전환 | M4 |

**Contextual Help.** 훈련 중 같은 unit을 세션 내 2회 이상 틀리거나 2.5초 이상 진행이 없으면, 입력창 위 힌트 영역에 도움 카드를 띄운다(키보드가 화면 하단을 덮으므로 하단 시트는 쓰지 않는다). 카드 내용은 `helpFor(unit, prevUnit, mistakeKind)`가 조립: 문자, 필요한 키·방향, 추가 동작(小/゛/゜/변환), 대표 예시, 해당 튜토리얼 Part 링크.

---

## 7. UX Flow

```
첫 접속 → 언어 감지(ko/ja) → 소개 1화면
 → 키보드 준비 체크리스트(Part 0)
 → 키보드 체크: 「かきくけこ」 입력
     ├ 가나가 바로 들어옴 → 통과
     └ 조합 중 로마자(k, ky…) 감지 → "로마자 키보드입니다. 🌐로 かな 키보드로 바꾸세요"
 → 튜토리얼 Part 1–3 (건너뛰기 가능)
 → Level 1 あ행 … Level 10 50음 랜덤
 → 홈: 오늘의 훈련(추천 2–3개) · 코스 지도 · 매뉴얼 · 통계
 → 세션(2–3분) → 결과(정확도·가나/분·틀린 문자·다음 추천)
 → 2회 완료 후 홈 화면 추가(PWA 설치) 안내
 → 조합 → 단어 → 문장 → 실전 채팅 → 약점 보완 ↺
```

**훈련 화면 (상단 고정 레이아웃).** 시스템 키보드가 화면 하단 40–50%를 덮고 iOS에서는 키보드 높이를 신뢰성 있게 알 수 없으므로, 모든 훈련 UI를 화면 **상단 절반**에 일반 흐름으로 배치한다. 하단 고정 요소·페이지 스크롤 없음.

```
┌────────────────────────────┐
│ ←  Lv.3 さ행     7/20   ✕  │
│        し す さ そ せ       │  목표 (lang="ja", 큰 글자, 현재 unit 강조)
│     [힌트: さ키 ← ]         │  힌트/도움 카드 영역 (레벨에 따라 소거)
│ ┌────────────────────────┐ │
│ │ 입력창 (실제 <input>)   │ │
│ └────────────────────────┘ │
│  ✓ / 틀린 부분 표시         │
├────────────────────────────┤
│      (시스템 키보드)        │
```

- **기초·조합(composing 판정)**: 한 문제 = 5–10 unit 한 줄. 한 번의 조합으로 이어서 입력하고, 조합 중 문자열이 줄 전체와 같아지면 즉시 정답 → 다음 줄. 틀린 글자는 지우고 고쳐야 진행(오류는 기록).
- **단어·문장·실전(commit 판정)**: 확정된 문자열이 목표와 같아지는 순간 자동 통과. 틀린 채 `改行`/확인 버튼을 누르면 diff와 함께 오답 처리. "건너뛰기" 제공.
- **실전 채팅**: 상대 말풍선(A) → 내 말풍선 자리에 목표(B) → 바로 아래 입력창. 난이도에 따라 길이·혼합도 증가.
- **힌트 단계**: Beginner(다음 unit의 키+방향 도해, 후리가나, 탁점·소문자 표식) → Normal(머뭇거릴 때만 도해) → Advanced(후리가나만) → Expert(목표만). 로마자 표기는 별도 옵션(기본 off), 숙련도 상승 시 자동 해제.
- 레벨은 **소프트 잠금**: 추천 경로를 강조하되 어느 레벨이든 직접 진입 가능.

---

## 8. Input Capture & IME Composition Architecture *(구 Gesture Recognition 대체)*

```
System Japanese IME
   ↓
<input> (apps/web: platform/input)
   ↓  compositionstart/update/end · beforeinput · input
DOM 어댑터  ── 이벤트 순서에 의존하지 않고 스냅샷으로 환원
   ↓  InputSnapshot { t, value, composing }
InputSession (core, 순수 reducer)
   ↓  진행 위치 · unit별 시간 · 수정 기록 · 감지 플래그
AnswerChecker (core)
```

**왜 스냅샷인가.** 조합 확정 시 이벤트 순서와 `inputType`이 브라우저마다 다르다(Chrome은 `insertCompositionText` 후 `compositionend`, Safari는 `insertFromComposition`을 내고 확정 키의 keydown이 `isComposing=false`로 늦게 도착, Firefox는 `compositionend` 후 `input`). 어댑터는 composition 이벤트로 `composing` 플래그만 갱신하고, 매 이벤트 뒤 마이크로태스크에서 `(performance.now(), input.value, composing)` 한 건을 내보낸다. keydown에는 의존하지 않는다(Android는 keyCode 229만 온다). 이 형태는 RN `onChangeText`로도 만들 수 있어 core가 플랫폼 독립이 된다.

**InputSession 규칙 (조합 중 오답 처리 금지)**
- 값 = `확정부 + 조합부`. 조합부는 읽기(히라가나) 공간에서, 확정부는 표면 문자열 공간에서 목표와 정렬한다.
- **마지막 글자는 항상 보류(pending)**. 목표가 `ぱ`일 때 `は → ば → ぱ`, `づ`일 때 `つ → っ → づ`, 로마자 키보드의 `k → か`는 중간 상태이지 오류가 아니다. 판단 근거는 core의 변형 계열표 `{は,ば,ぱ}` `{つ,っ,づ}` `{う,ぅ,ゔ}` `{や,ゃ}` 등.
- 오류로 기록하는 시점: ① 틀린 글자 뒤에 다음 글자가 입력됨 ② 틀린 글자를 지움(수정) ③ commit 모드에서 틀린 채 제출.
- unit별 시간 = 직전 unit 완료(또는 문제 표시)부터 해당 unit이 올바른 형태가 된 시점까지. 문제 표시→첫 입력은 `reactionMs`로 따로 기록(위치 회상 속도의 핵심 지표).

**결과 스트림 기반 감지 (제스처 분석 아님)**
- 로마자 키보드: 가나 문제의 조합부에 라틴 문자가 나타남 → 안내 배너 + attempt에 플래그.
- 토글 입력: 마지막 글자가 같은 행 안에서 제자리 교체(あ→い→う) → `フリックのみ` 설정 안내.

**입력창 요건**
- 훈련 시작 버튼의 탭 핸들러 안에서 동기적으로 `focus()` (iOS는 사용자 제스처 없이는 키보드를 띄우지 않는다).
- `lang="ja" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"`, 글자 크기 16px 이상(iOS 자동 확대 방지).
- 문제 전환 시 키보드를 닫지 않는다. **조합을 리셋하면서 키보드를 유지하는 방법이 최대 기술 위험**이며 §19 스파이크에서 아래 후보를 실기기로 판정한다.
  - R1 두 `<input>` 간 포커스 교대 / R2 조합 중 `value=''` 직접 대입 / R3 blur→clear→focus / R4(대안) 리셋하지 않고 確定을 받은 뒤 비움.
  - 줄 단위 출제(§7)는 리셋 횟수를 줄여 이 위험의 영향을 낮춘다. 리셋이 매끄러우면 "한 글자씩" 플래시 모드도 켠다.
- 개발용 `TraceRecorder`: 원시 이벤트와 스냅샷을 JSON으로 내보내 테스트 픽스처로 쓴다(사용자 데이터로는 저장하지 않음).

---

## 9. Keyboard Guide Architecture *(구 Keyboard Profile 대체 — 설명 전용)*

입력에는 관여하지 않는다. 튜토리얼 도해, 힌트, Contextual Help, 오류 분류의 "같은 키/같은 방향" 추정에만 쓰는 **참조 데이터**다. 플랫폼 차이는 가이드 교체로 처리한다.

```ts
type FlickDirection = 'tap' | 'left' | 'up' | 'right' | 'down';
interface GuideKey { id: string; label: string; outputs: Partial<Record<FlickDirection, string>>; }
interface KeyboardGuide {
  id: 'ios-kana' | 'gboard-12key';
  layers: Record<'kana' | 'alpha' | 'number', GuideKey[][]>; // 4행×3열 + 기능 키
  modifier: { label: string; cycles: string[][]; direct?: Partial<Record<FlickDirection, 'dakuten'|'handakuten'|'small'>> };
  recipes: Record<string, InputStep[]>;   // 々 『 … ♪ 등 키 직접 입력이 없는 문자
  notes: { flickOnlySetting: string; convertKeyLabel: string };
}
type InputStep =
  | { kind: 'key'; layer: string; keyId: string; dir: FlickDirection; out: string }
  | { kind: 'modifier'; times: number; out: string }
  | { kind: 'reading'; text: string }
  | { kind: 'convert'; pick: string }
  | { kind: 'layer'; to: 'kana' | 'alpha' | 'number' };
```

- 위치: 타입·`explainInput()`은 `packages/core/src/guide/`, 데이터는 `packages/content/src/guides/ios-kana.ts`(M1), `gboard-12key.ts`(M3).
- 기기 감지(UA)로 기본 가이드를 고르고 설정에서 수동 전환.
- **정확성 확보**: `ios-kana` 데이터는 M0에서 사용자의 iPhone으로 검증한다. `/lab/guide-check` 화면이 가이드의 주장("や키 ← = 「")을 하나씩 제시하고 사용자가 실제로 입력해 일치 여부를 기록 → 불일치 항목을 고친 뒤에야 튜토리얼에 반영. Gboard는 Mozc `flick-hiragana.tsv` 등 오픈소스 매핑으로 1차 작성 후 실기 확인.

---

## 10. Training Engine

```
Training Engine (core)
 ├ Question Generator  : 레벨·스케줄러 → 다음 문제(줄 / 단어 / 문장)
 ├ Answer Checker      : 정규화 정책 + 비교 + diff + 오류 분류
 ├ Scoring             : 정확도·속도·결과 등급
 ├ Weakness Analyzer   : skill/unit 숙련도, 혼동 쌍, 추천
 └ Progress Manager    : 레벨 통과·streak·오늘의 훈련
```

### 10.1 Unit 토크나이저 (약점 분석의 기반)
`tokenize(text, reading?) → Unit[]`. 문자열을 **입력 규칙 단위**로 자르고 skill을 자동 부여한다. 콘텐츠를 일일이 손으로 태깅하지 않아도 모든 문제가 skill 통계에 기여한다.

| 입력 | units (kind) |
|---|---|
| `きって` | き(kana) · っ(sokuon) · て(kana) |
| `ぎゃく` | ぎゃ(yoon+dakuten) · く(kana) |
| `パーティー` | パ(handakuten,katakana) · ー(long) · ティ(foreign) · ー(long) |
| `{今日\|きょう}は` | 今日(kanji; 읽기 きょ·う) · は(kana) |

각 가나 unit은 행(=키)·단(=방향) 속성을 가진다 → "い단(왼쪽 방향) 문자가 느리다" 같은 통계를 **결과만으로** 낼 수 있다.

### 10.2 커리큘럼 (학습 루프에 맞춘 레벨)

| 단계 | 레벨 | 내용 | 판정 |
|---|---|---|---|
| 튜토리얼 | L0 | 키보드 준비·체크, Part 1–3 | — |
| 기초 | L1–L9 | あ·か·さ·た·な·は·ま·や·ら/わ행 (행별 줄 드릴) | composing |
| 기초 | L10 | 50음 랜덤 + 쉬운 히라가나 단어 | composing |
| 조합 | L11–L15 | 탁음 · 반탁음 · 작은 가나 · 요음 · 촉음 (+규칙이 드러나는 단어) | composing |
| 조합→단어 | L16–L19 | 가타카나 단어 · 장음 · 외래어 조합 · ヴ | commit |
| 조합 | L20–L21 | 기호·문장부호·々 · 영/숫자/기호 혼합 | commit |
| 단어 | L22 | 단어 종합(규칙 혼합) | commit |
| 문장 | L23 | 주제별 문장 | commit |
| 실전 | L24 | 채팅 | commit |
| 약점 보완 | R | 약한 skill로 자동 구성 → 해당 기초/조합 레벨로 회귀 | 항목별 |

- 각 레벨 출제는 **신규 70% + 이전 범위 30%** 교차.
- 통과 기준(조정 가능 상수): 최근 30 unit 첫 시도 정확도 ≥ 90% **그리고** unit 중앙 시간 ≤ 레벨 기준. 등급: 입문 → 익숙(≤1.5s/가나) → 능숙(≤0.9s) → 자동화(≤0.6s).

### 10.3 출제 (Scheduler 인터페이스로 교체 가능)
```ts
interface Scheduler { next(state, pool, n): ContentItem[]; record(result: AttemptResult): SchedulerState; }
```
- M1 `SimpleScheduler`: 레벨 풀에서 무작위 + **세션 내 재출제**(틀린 unit을 2–4문제 뒤, 세션 끝에 한 번 더).
- M3 `WeightedScheduler`: `weight = priorityBase × (1 + k·(1 − mastery)²) × recency`, 숙련 항목도 하한 가중치로 주기적 복습. 항목 선택은 "약한 skill을 포함한 콘텐츠" 기준.
- M4 `LeitnerScheduler`: unit/skill 단위 5상자(당일·1·3·7·21일). 저장 필드(`box`, `dueAt`)는 M1 스키마에 미리 둔다.

### 10.4 Answer Checker
```ts
check(target, input, policy) → { pass, matchKind: 'exact'|'normalized'|'lenient'|'none', diff: DiffOp[], mistakes: Mistake[] }
```

| 정규화 층 | 내용 | strict(기본) | lenient(옵션) |
|---|---|---|---|
| A. 항상 | NFC, 앞뒤 공백·줄바꿈 제거, 제로폭 문자 제거, `～`(U+FF5E)→`〜`(U+301C) | ✔ | ✔ |
| B. 폭·이형 | 전각/반각 영숫자·문장부호, `…`/`・・・`/`...`, 전각/반각 공백 | ✘ | ✔ |
| C. 가나·읽기 | 가타카나↔히라가나 폴딩, 한자 대신 읽기 입력 허용 | ✘ | ✔ |

- 기본 훈련은 strict. 콘텐츠 항목이 `policy`로 층을 개별 지정할 수 있다(예: 채팅 `www`는 폭 폴딩 허용).
- `ー`(U+30FC)는 어떤 정책에서도 하이픈·대시·`一`와 구분한다 — 장음 훈련의 핵심 오류이기 때문.
- lenient로 통과하면 `matchKind:'lenient'`로 기록해 통계에서 구분한다.

**오류 분류 (결과 문자 쌍으로 추정, 초기 요청 §24 대응)**

| kind | 판정 근거 | 예 |
|---|---|---|
| direction | 같은 행, 다른 단 (같은 키·방향 착오 추정) | え→う |
| key | 같은 단, 다른 행 (다른 키 추정) | か→さ |
| dakuten / handakuten | 같은 기본자, 탁점 차이 | が→か, ぱ→ば |
| small | 크기 차이 | ゃ→や, っ→つ |
| sequence | 요음·조합의 순서 뒤바뀜 | きゃ→ゃき |
| long-vowel | ー 누락·대체(う/あ/하이픈) | コーヒー→コウヒイ |
| script | 변환 안 함(히라가나로 확정) | カメラ→かめら |
| conversion | 다른 한자·표기 | 行って→言って |
| width | 전각/반각 차이 | ！→! |
| omission / insertion | 정렬상 누락·삽입 | |
| timing | 정답이지만 unit 시간이 기준의 2배 초과 | |

---

## 11. Content / Data Model

**저장 위치.** 전부 `packages/content`의 TypeScript 데이터 모듈. React 코드에 문자·단어를 쓰지 않는다. 빌드 시 JSON으로도 내보낸다(네이티브 이식·검증용).

```
packages/content/src/
  kana/        hiragana.ts  variants.ts(탁음·반탁음·소문자 계열)
  combos/      yoon.ts  sokuon.ts  long-vowel.ts  foreign-sound.ts  vu.ts  rare-kana.ts
  symbols/     punctuation.ts  brackets.ts  repetition-marks.ts  chat.ts
  mixed/       latin.ts  numbers.ts  mixed.ts
  words/       hiragana.ts  katakana.ts  long-vowel.ts  foreign.ts  sokuon.ts  kanji.ts …
  sentences/   daily.ts  chat.ts  travel.ts  school.ts  game.ts  sns.ts  work.ts  shopping.ts  food.ts  hobby.ts
  courses/     levels.ts            # L0–L24, 통과 기준, 연결 튜토리얼
  guides/      ios-kana.ts  gboard-12key.ts
  tutorials/   parts.ts(블록 구조)  ko/ ja/ en/(본문)
```

```ts
type Priority = 'core' | 'common' | 'advanced' | 'rare';
type Stage = 'char' | 'combo' | 'word' | 'sentence' | 'chat';

interface ContentItem {
  id: string;                    // 'word.koohii'
  stage: Stage;
  text: string;                  // 표면 문자열. 한자는 루비 표기: '{今日|きょう}は{友達|ともだち}と…'
  category: CategoryId;          // §14 분류 트리의 노드 (UI·커리큘럼용)
  focus: SkillId[];              // 이 항목이 의도적으로 훈련시키는 규칙 ('long-vowel','foreign-sound')
  priority: Priority;
  difficulty: 1 | 2 | 3 | 4 | 5;
  topics?: string[];             // daily, travel, game, sns …
  gloss?: Partial<Record<Locale, string>>;   // 뜻 (네이티브 사용자에겐 숨김)
  explanation?: string;          // i18n 키
  policy?: Partial<ComparePolicy>;
  context?: { speaker: 'A' | 'B'; text: string }[];   // 채팅 앞 대화
}
// 빌드 시 파생: surface, reading, units: Unit[], skills: SkillId[]
```

- `focus`(사람이 붙인 교육 의도)와 `skills`(토크나이저 자동 파생)를 구분한다. 테스트로 `focus ⊆ skills`를 강제한다.
- `SkillId` 체계 = 초기 요청 §14 분류 트리를 그대로 식별자로: `kana.row.ka`, `kana.dan.i`, `dakuten`, `handakuten`, `small`, `yoon`, `sokuon`, `katakana`, `long-vowel`, `foreign.t1`, `foreign.t2`, `vu`, `rare-kana`, `repeat.noma`, `repeat.other`, `punct.basic`, `punct.bracket`, `chat`, `latin`, `digit`, `symbol`, `kanji`, `mixed`.
- **콘텐츠 품질 규칙** (검증 스크립트 + 수동 QA): 모든 항목은 iOS かな 키보드로 실제 입력 가능해야 한다. 변환 후보가 갈리는 표기(何/なに, 下さい/ください)는 피하거나 읽기 채점 대상임을 표시. 문장은 직접 작성한 원문만 사용(저작권).
- 초기 분량 목표: M1 가나 전체 + 히라가나 단어 60 · M2 조합 전부 + 단어 300 · M3 문장 200 + 채팅 80 · M4 혼합 100.

---

## 12. Statistics

**기록 단위 (결과 중심)**
```ts
interface Attempt {
  id; sessionId; itemId; at;
  targetText; inputText;
  result: 'correct' | 'corrected' | 'wrong' | 'skipped';   // corrected = 고쳐서 통과
  matchKind; elapsedMs; reactionMs;
  mistakes: { index; expected; actual; kind }[];
  corrections: number;
  unitTimings: number[];          // unit별 ms (알 수 없으면 -1)
  category; stage; difficulty; judge: 'composing' | 'commit'; hintLevel: 0 | 1 | 2 | 3;
  flags?: ('romaji-suspected' | 'toggle-suspected')[];
}
```
집계(로그에서 재계산 가능): `UnitStat`(문자·조합별), `SkillStat`(카테고리별), `Confusion`(expected→actual 횟수), `DailyStat`.

**지표 정의**
| 지표 | 계산 |
|---|---|
| 정확도(첫 시도) | 오류 없이 한 번에 맞힌 unit / 전체 unit — 기본 표시 지표 |
| 최종 정확도 | 통과한 문제 / 전체 문제 |
| 가나/분 (KPM) | 입력한 읽기 가나 수 ÷ 분 — **주 속도 지표** |
| 문자/분 (CPM) | 표면 문자 수 ÷ 분 (한자 혼합 문장용) |
| unit 시간 | 중앙값 (IME 묶음 전달에 따른 잡음 때문에 평균 대신) |
| 반응 시간 | 문제 표시 → 첫 입력 |
| 오타율 · 연속 성공 | 수정 횟수 / unit · 무오류 연속 문제 수 |
| WPM(참고) | 읽기의 헤본식 로마자 길이 ÷ 5 ÷ 분. 계산법을 화면에 명시, M4 |
| 숙련도 mastery | `0.7 × 정확도 EWMA + 0.3 × min(1, 기준시간/중앙시간)`, 표본 < 8이면 "측정 중" |

**대시보드**: 오늘/누적 학습 시간, 정확도·KPM 추세(7/30일), 최고 기록, 카테고리별 숙련도 막대(히라가나 96% · 탁음 73% · 장음 55% …), 가장 많이 틀린·가장 느린 문자, 혼동 쌍("が를 か로"), 행·단별 시간, 최근 변화, 추천 훈련. 점수보다 **이전 대비 변화**를 앞에 둔다.

**Weakness Analyzer → 추천**: mastery 하위 skill 2–3개를 골라 "장음 + 외래음 조합 집중" 같은 약점 세션을 만들고, 해당 skill의 기초/조합 레벨로 되돌려 보낸다.

---

## 13. Storage

| 후보 | 판단 |
|---|---|
| LocalStorage | 동기 API·약 5MB·문자열 전용. attempt 로그에 부적합 → **설정(언어·테마·힌트 단계)만** 저장해 부팅 시 동기 읽기 |
| **IndexedDB (Dexie 4)** | 구조화 데이터·인덱스·스키마 버전 관리·`liveQuery`. **채택** |

- core에 포트 정의: `AttemptRepo`, `StatRepo`, `ProgressRepo`, `SchedulerRepo`, `SettingsRepo`. web이 Dexie로 구현, 테스트·core는 인메모리 구현. RN은 SQLite 구현으로 교체.
- 스토어: `attempts`(append-only, 인덱스 `at`·`itemId`·`sessionId`), `unitStats`, `skillStats`, `confusions`, `progress`, `scheduler`, `sessions`, `daily`, `meta`.
- **동기화 대비**: 모든 레코드에 ULID `id`·`updatedAt`·`deviceId`. attempt 로그가 원본이고 집계는 파생값이라, 클라우드 동기화는 "로그 병합 후 재집계"로 붙일 수 있다.
- iOS 대응: Safari 탭에서는 7일 미사용 시 스크립트 저장소가 지워질 수 있고 홈 화면 설치 앱은 예외 → 설치 유도 + `navigator.storage.persist()` 요청 + JSON 내보내기/가져오기(M4, 필요 시 앞당김).

---

## 14. PWA Architecture

- **Manifest**: `display: standalone`, `orientation: portrait`, 아이콘(maskable 포함), `lang`. iOS용 `apple-touch-icon`·status bar 메타.
- **Service Worker** (vite-plugin-pwa, generateSW): 앱 셸 + 콘텐츠 청크 전부 precache → 네트워크 없이 훈련 전 기능 동작. 새 버전은 "업데이트 있음" 토스트로 사용자가 적용(세션 중 강제 리로드 금지).
- **Viewport**: `viewport-fit=cover` + `env(safe-area-inset-*)`, `100dvh`, body 스크롤 잠금·`overscroll-behavior: none`. Android Chrome에는 `interactive-widget=resizes-content` 메타. iOS는 standalone에서 `visualViewport`가 불안정하므로 **키보드 높이에 의존하지 않는 상단 고정 레이아웃**이 기본이고 `visualViewport`는 보조로만 사용.
- **표시**: 일본어 텍스트에는 항상 `lang="ja"` (한국어 기기에서 한자가 한국식 자형으로 나오는 것 방지). 시스템 폰트(Hiragino / Noto Sans CJK JP). `ぱ/ば`, `っ/つ`, `ー/一` 구분을 위해 목표는 큰 글자 + Beginner 단계 표식.
- **데스크톱**: 지원 대상 아님. 동작은 하되 "스마트폰에서 여세요" 안내 + QR.
- 햅틱·타건음은 시스템 키보드가 제공하므로 앱에서 구현하지 않는다.

---

## 15. Testing Strategy

| 수준 | 대상 | 방법 |
|---|---|---|
| Unit (core, 커버리지 90%+) | 정규화·정책 / 토크나이저 / 루비 파서 / diff·오류 분류 / InputSession / 스케줄러 / 채점·통계 / `explainInput` | Vitest. 정규화·토크나이저는 fast-check 속성 테스트(멱등성, 분해 후 재결합 = 원문) |
| **Trace replay** | InputSession + AnswerChecker | 실기기에서 `TraceRecorder`로 녹화한 스냅샷 JSON을 픽스처로 재생. iOS Safari(탭/standalone)·Android Chrome+Gboard·데스크톱. 탁음 순환·수정·분절 변환·로마자 키보드 시나리오 |
| Content 검증 | 전체 콘텐츠 | id 유일, 토크나이즈 가능, `focus ⊆ skills`, 읽기·표면 정합, 금지 유사 문자(`～` U+FF5E, 하이픈류 장음) 없음, skill별 최소 항목 수 |
| Integration (web) | `<TrainingInput>` + 세션 + 저장 / 튜토리얼 `tryIt` | RTL + 합성 composition 이벤트, fake-indexeddb |
| E2E | 온보딩 → 훈련 → 결과 → 재접속 복구, 오프라인, 설치 가능성 | Playwright. Chromium은 CDP `Input.imeSetComposition`·`Input.insertText`로 조합 시뮬레이션. WebKit·모바일 에뮬레이션은 레이아웃 스모크 |
| 실기기 (수동 체크리스트) | iOS Safari 탭·홈 화면 앱 / Android Chrome·설치 앱 | 키보드 유지, 리셋, 자동 진행, 회전·safe area, 오프라인, 데이터 보존. 릴리스마다 수행 |

IME 실동작은 에뮬레이터로 재현되지 않으므로 **실기기 trace가 사양의 근거**다. 새 버그는 trace를 녹화해 픽스처로 추가한 뒤 고친다.

---

## 16. MVP Roadmap

의존: `M0 → M1 → M2 → M3 → M4`. 각 마일스톤 안에서는 core → content → web 순.

**M0 — 스캐폴딩 + IME 스파이크** *(§19)*
1. git init, 원격 연결, 이 계획을 `docs/`에 커밋. pnpm workspace·tsconfig·ESLint 경계 규칙·Vitest·CI·Cloudflare Pages 프리뷰.
2. `/lab/ime` 진단 페이지 + `TraceRecorder`.
3. iPhone 실기 검증 → 리셋 전략·판정 방식 결정 기록(`docs/decisions/0001-ime-input.md`), trace 픽스처 커밋.
4. `/lab/guide-check`로 `ios-kana` 가이드 ⚠︎ 항목 확정.

**M1 (MVP 1) — 기초 훈련 수직 슬라이스** ← M0 결정
- core: kana 표·변형 계열, 정규화(A층), 토크나이저(기본 가나), InputSession, AnswerChecker(strict), SimpleScheduler, 기본 채점.
- content: 히라가나 50음, L0–L10, 히라가나 단어 60, `ios-kana` 가이드, 튜토리얼 Part 0–3(ko, UI 문자열 ko+ja).
- web: 온보딩·키보드 체크(로마자 감지), `<TrainingInput>`, 줄 드릴, 결과 화면, `<FlickDiagram>`, Dexie 저장, PWA 설치·오프라인.
- 완료 기준: iPhone에서 L1–L10을 키보드를 닫지 않고 연속 진행, 오프라인 동작, 재접속 시 진행 복구.

**M2 (MVP 2) — 조합 + 가타카나 + 단어** ← M1
- core: 토크나이저 확장(탁음·소문자·요음·촉음·장음·가타카나), commit 판정, diff·오류 분류, UnitStat/SkillStat, 힌트 단계.
- content: L11–L17, 단어 300, 튜토리얼 Part 4–9.
- web: 단어 연습, diff 표시, Contextual Help, 매뉴얼 탭·문자 검색, 스킬 통계 화면, 토글 입력 감지, streak·오늘의 훈련.

**M3 (MVP 3) — 실전 일본어** ← M2
- core: 루비 파서·한자 unit, lenient 정책(B·C층), WeightedScheduler, Weakness Analyzer.
- content: L18–L20·L22–L24(외래음·ヴ·기호·々·문장 200·채팅 80), 튜토리얼 Part 10–15, **ja 튜토리얼 본문**, `gboard-12key` 가이드.
- web: 문장·채팅 모드, 약점 보완 세션, 대시보드, 관대한 채점 옵션, Android 실기 검증.

**M4 (MVP 4) — 고급 학습** ← M3
- LeitnerScheduler(세션 간 간격 반복), L21 혼합 입력 + Part 16, 행·단별 분석·추세, WPM(참고), 내보내기/가져오기, **en 로케일**, 클라우드 동기화 설계 문서.

**Future** — RN(Expo) 앱, 계정·크로스 플랫폼 동기화, 커스텀 코스, 고급 통계.

---

## 17. Risks

| # | 위험 | 영향 | 대응 |
|---|---|---|---|
| 1 | 조합 리셋 시 키보드가 닫히거나 이전 조합 문자가 되살아남 (iOS) | 연속 풀이 흐름 붕괴 | M0 스파이크에서 R1–R4 판정. 줄 단위 출제로 리셋 빈도 축소. 최후 수단은 確定 후 비움 |
| 2 | 브라우저·IME별 이벤트 순서 차이 | 오판정·중복 처리 | 스냅샷 환원 + trace replay 테스트. keydown 비의존 |
| 3 | 웹은 활성 키보드를 강제·식별할 수 없음 | 로마자로 풀어도 통과 | 온보딩 체크 + 로마자/토글 감지 안내. 플릭 여부는 추정임을 명시 |
| 4 | 변환 후보에 목표 표기가 없거나 찾기 어려움 | 풀 수 없는 문제 | 콘텐츠 입력 가능성 QA, 표기 갈리는 단어 회피, 건너뛰기, lenient 옵션 |
| 5 | 유사 코드포인트(〜/～, ー/－, …/・・・, 전각/반각) | 맞게 쳤는데 오답 | 정규화 A층 고정 + 정책 표를 테스트로 고정. 실기 trace로 각 키보드의 실제 출력 확인 |
| 6 | iOS standalone의 viewport·키보드 버그 | 목표·입력창이 가려짐 | 상단 고정 레이아웃, 하단 고정 요소 금지 |
| 7 | iOS 저장소 삭제(7일) | 진행 소실 | 설치 유도, `storage.persist()`, 내보내기 |
| 8 | 키보드 가이드 데이터 오류 | 튜토리얼이 틀린 방법을 가르침 | `/lab/guide-check` 실기 검증을 통과한 항목만 게시. iOS 버전 변경 시 재검증 |
| 9 | unit 시간 잡음(IME 묶음 전달) | 잘못된 약점 진단 | 중앙값·최소 표본·"측정 중" 표시 |
| 10 | 실제 키보드 사용의 높은 마찰로 이탈 | 학습 중단 | 2–3분 세션, 오늘의 훈련, 즉각적 향상 지표 |
| 11 | 콘텐츠 작성량(문장·3개 언어 튜토리얼) | 일정 지연 | 구조 우선·분량은 마일스톤별 목표, ko→ja→en 순차 |

---

## 18. Future Native Port

| 계층 | 위치 | 이식 |
|---|---|---|
| kana 표·정규화·토크나이저·diff·오류 분류 | `packages/core` (tsconfig `lib: ES2022`, DOM 타입 없음) | RN에서 그대로 import |
| InputSession · Training Engine · Scheduler · 통계 | `packages/core` | 그대로 |
| 콘텐츠·가이드·튜토리얼 블록 | `packages/content` (+ JSON 내보내기) | 그대로 |
| 저장 | core 포트 / web Dexie 구현 | SQLite·MMKV 구현 추가 |
| 입력 어댑터 | `apps/web/src/platform/input` | RN `TextInput.onChangeText` → `InputSnapshot`. 조합 플래그가 없으면 휴리스틱 또는 marked text를 노출하는 작은 네이티브 모듈 |
| UI·애니메이션·PWA | `apps/web` | RN 컴포넌트 재작성(react-native-svg·Reanimated) |

- 권장 경로는 **React Native(Expo)**: core/content를 재작성 없이 쓴다. Flutter를 택하면 core를 Dart로 다시 써야 하므로, 콘텐츠 JSON과 테스트 벡터(정규화·토크나이저·trace 기대값) JSON을 내보내 재구현 검증에 쓴다.
- 경계는 ESLint boundaries(`core`는 `web`·DOM import 금지, `content`는 `core` 타입만)와 core의 DOM 없는 tsconfig로 컴파일 단계에서 강제한다.

---

## 19. Recommended First Implementation

**목표: "실제 iPhone かな 키보드로 문제를 끊김 없이 연속해서 풀 수 있는가"를 가장 먼저 검증한다.** 전체 앱이 이 한 가지에 달려 있다.

**범위 (M0, 이것만)**
1. 모노레포 최소 골격: `packages/core`(빈 패키지 + Vitest), `apps/web`(Vite + React), CI, Cloudflare Pages 프리뷰 URL.
2. `apps/web`의 `/lab/ime` 한 화면:
   - 실제 `<input>` 하나, 목표 가나 한 줄(`あいうえお` → `かきくけこ` → `がぎぐげご` → `きゃきゅきょ` → `カメラ`).
   - 화면 내 이벤트 로그(종류·`data`·`inputType`·`isComposing`·`value`·시각)와 JSON 내보내기.
   - 조합 중 일치 시 자동 진행 + 리셋 전략 전환 스위치(R1–R4).
   - `visualViewport` 값 표시.
3. `packages/core`: `InputSnapshot` 타입과 최소 `InputSession`(접두 일치·보류 규칙), 녹화한 trace로 도는 테스트.

**하지 않는 것**: 코스·통계·저장·튜토리얼·PWA 설치·디자인.

**판정할 질문 → 결과는 `docs/decisions/0001-ime-input.md`에 기록**
- 플릭 1회마다 조합 문자열 전체가 스냅샷으로 오는가? 탁음 순환은 어떻게 보이는가?
- 조합 중 일치 시점에 입력을 비우고 다음 문제로 넘어갈 때 키보드가 유지되는가? 어느 리셋 전략이 안전한가?
- Safari 탭과 홈 화면 앱에서 동작이 같은가? 목표·입력창이 키보드에 가려지지 않는가?
- 가타카나 변환 확정 시 확정 문자열을 정확히 받는가?
- `、。?!`·`ー`·`〜`가 실제로 어떤 코드포인트로 들어오는가?

**통과 기준**: 사용자의 iPhone에서 위 5줄을 키보드를 닫지 않고 연속으로 풀 수 있고, 리셋 전략 하나가 Safari 탭·홈 화면 앱 양쪽에서 안정적임을 trace로 확인. 실패 시 "確定 후 진행" 방식으로 §7 드릴 UX를 수정한 뒤 M1에 들어간다.

---

## Verification (이 계획의 실행 검증 방법)

- **M0**: `pnpm install && pnpm -r test && pnpm --filter @twiper/web dev` → 프리뷰 URL을 iPhone Safari에서 열어 `/lab/ime` 체크리스트 수행 → 내보낸 trace JSON을 `packages/core/test/fixtures/traces/`에 커밋 → `pnpm -r test`가 그 trace로 통과.
- **M1 이후 매 마일스톤**: `pnpm -r typecheck lint test` · `pnpm --filter @twiper/web build && pnpm exec playwright test` · 실기기 체크리스트(§15) · Lighthouse PWA 설치 가능성 · 비행기 모드에서 훈련 1세션 완료 · 앱 종료 후 재실행 시 진행·통계 복구.
- **콘텐츠 변경 시**: `pnpm --filter @twiper/content validate`.

## Sources (조사 근거)

- Mozc 오픈소스 플릭 매핑 테이블 `src/data/preedit/flick-hiragana.tsv`, `flick-halfwidthascii(_ios).tsv`, `toggle_flick-hiragana.tsv` — https://github.com/google/mozc
- 文化庁 「外来語の表記」 제1표/제2표 — https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/gairai/honbun01.html
- iOS フリックのみ 설정 — https://iphone-mania.jp/news-142624/ · https://appllio.com/ios-keyboard-flick-input-characters-in-a-low-iphone-ipad
- Gboard フリック入力のみ — https://roboin.io/article/2026/07/01/how-to-enable-flick-input-only-in-gboard/
- Composition 이벤트 순서·Safari isComposing 버그 — https://bugs.webkit.org/show_bug.cgi?id=165004 · https://github.com/w3c/input-events/issues/34 · https://developer.squareup.com/blog/understanding-composition-browser-events/ · https://github.com/mdn/browser-compat-data/pull/30009
- iOS 키보드와 viewport — https://bugs.webkit.org/show_bug.cgi?id=265578 · https://dev.to/cederhook/fixing-the-ios-standalone-pwa-keyboard-bug-that-shrinks-your-viewport-for-good-63d
- WebKit 저장소 정책 — https://webkit.org/blog/14403/updates-to-storage-policy/ · https://developer.apple.com/forums/thread/710157
- Playwright IME 시뮬레이션 — https://github.com/microsoft/playwright/issues/5777
