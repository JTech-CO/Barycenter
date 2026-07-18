# Barycenter — Codex 작업 하네스 (Harness)

**버전**: 0.2
**작성일**: 2026년 7월 19일
**관계 문서**: `AGENTS.md`, `PROGRESS.md`, `Barycenter_마일스톤.md`, `Barycenter_기술백서.md`, `Barycenter_디자인백서.md`

> 이 문서는 무엇을 만드는지가 아니라 어떻게 진행·검증·복구하는지를 정의한다. 물리 시뮬레이터의 완료 기준은 화면이 움직이는지가 아니라 알려진 해와 보존량을 재현하는지다.

---

## 0. 문서 역할과 세션 루프

### 0.1 문서 역할

- `AGENTS.md`: Codex가 매 작업에서 지켜야 할 짧고 지속적인 저장소 규칙
- `PROGRESS.md`: 현재 마일스톤, 다음 작업, 게이트 결과, 미결 질문, 결정 로그
- `Barycenter_마일스톤.md`: M0–M7 작업 패키지·의존성·완료 기준의 단일 기준
- 기술/디자인 백서: 제품·물리·시각 요구사항
- 본 하네스: 반복 작업 규율, 검증 계층, 런북, 중단 규칙

충돌 시 `AGENTS.md`에 명시된 문서 우선순위를 따르고, 해석 결과를 `PROGRESS.md` 결정 로그에 남긴다.

### 0.2 세션 루프

1. **시작**: `PROGRESS.md` → 현재 마일스톤 절 → 본 하네스 불변식 → 관련 백서 절을 읽는다.
2. **작업 선택**: 현재 마일스톤의 작업 패키지 하나 또는 명시된 하위 슬라이스만 선택한다.
3. **구현**: 좁은 테스트로 반복하고, 코어 불변식에 닿는 변경은 기준 fixture를 함께 실행한다.
4. **게이트**: 완료를 말하기 전에 해당 마일스톤의 모든 DoD와 검증 명령을 실행한다.
5. **인계**: `PROGRESS.md`의 완료 항목, 다음 작업, 게이트 증거, 결정, blocker를 갱신한다.

### 0.3 완료 판정

- DoD는 전부 충족해야 한다. 일부 통과는 마일스톤 완료가 아니다.
- 허용오차·fixture·step 수 변경은 코드 수정으로 숨기지 않고 결정 로그와 검증 근거를 남긴다.
- M6은 선택 경로다. 핵심 v1 의존성은 M1 → M2 → M3 → M4 → M5 → M7이다.
- 세부 범위와 번호는 `Barycenter_마일스톤.md`가 단일 기준이다.

---

## 1. 전 마일스톤 불변식

### INV-1 — 심플렉틱 장기 보존

leapfrog·Yoshida4는 고정 step 장기 적분에서 총에너지의 secular drift가 없이 유계여야 한다. 이체계 10³ 주기와 figure-8 10² 기준 주기를 M3 장기 gate의 최소 범위로 삼는다. signed 에너지 오차의 선형 추세가 진동 포락선에 비해 작아야 한다.

### INV-2 — 무발산·안전정지

유효한 입력의 위치·속도·가속도·진단에 NaN/Inf가 없어야 한다. 근접 조우는 softening과 고정 substep으로 다루며, 발산을 감지하면 실패 step을 커밋하지 않고 마지막 유효 스냅샷과 원인을 반환한다.

### INV-3 — 해석해 일치

이체 케플러 궤도의 주기·반장축·이심률이 해석값과 일치해야 한다. 각운동량과 질량중심은 올바른 정규화와 기준 경로를 사용한다.

### INV-4 — 결정론

동일 빌드·플랫폼·CPU 경로에서 같은 초기조건과 설정은 같은 궤적을 만든다. 천체 순서, 힘 합산 순서, step 수를 고정한다. 가속 경로는 bitwise 일치 대신 CPU oracle과의 수치 parity를 요구한다.

### INV-5 — 가속 경로 정합성

Barnes–Hut 또는 GPU를 도입하면 동일 배치의 천체별 힘, 기준 궤도, 보존 오차가 CPU 직접합산과 고정 허용오차 안에서 일치해야 한다. 직접합산은 제거하지 않는다.

### INV-6 — 회전계·CR3BP 분석 정확성

관성계와 회전계의 정·역변환이 일치하고, L1–L5에서 유효 퍼텐셜 gradient residual이 허용오차를 통과하며, 기준 CR3BP 궤도의 야코비 상수가 유계여야 한다.

### 진단 계약

- softening 힘과 동일한 `-G mi mj / sqrt(r²+ε²)` 퍼텐셜을 에너지에 사용한다.
- `L0=0` 계는 `ΔL/L0`가 아니라 특성 각운동량으로 정규화한다.
- COM drift는 `com0 + (P0/M)t`에서 벗어난 양이다.
- `fixed=true`인 천체가 있으면 constrained world로 표시하고 폐쇄계 보존 gate를 적용하지 않는다.

---

## 2. 마일스톤 게이트 요약

자세한 작업 패키지와 수치는 마일스톤 문서를 따른다.

| 마일스톤 | 진입 | 핵심 gate | 대표 검증 |
|---|---|---|---|
| M0 Codex 전환 | 없음 | 이전 에이전트 전용 활성 지침 0건, 계획·인계 문서 존재 | 문서 링크·용어 검색 |
| M1 기반 | M0 | 설치·lint·typecheck·test·build green, core import 경계 강제 | `pnpm verify`, 경계 위반 fixture |
| M2 수치 코어 | M1 | 힘·적분·케플러·진단·safe stop·결정론 단위 gate | core test, round-trip, NaN scan |
| M3 물리 검증 | M2 | 해석 주기, 장기 에너지, 각운동량, COM, 수렴 차수 | 빠른/장기 physics suite와 리포트 |
| M4 CR3BP | M3 | frame round-trip, L1–L5 residual, Jacobi 보존 | analysis test와 contour scan |
| M5 제품 Beta | M4 | 재생·편집·계측·공유 E2E, 디자인·접근성 gate | E2E, 수동 QA, core/UI 수치 대조 |
| M6 자연어, 선택 | M5+결정 | schema·키 격리·실패 격리·정적 앱 독립 | 계약 test, 실패 주입, 번들 검색 |
| M7 출시 | M5 | 프로파일, 선택적 parity, 메모리, CI, 브라우저, 배포 | benchmark, release suite, preview smoke |

---

## 3. 검증 계층

M1에서 아래 이름의 실행 스크립트를 실제 `package.json`과 이 문서에 동기화한다. 존재하지 않는 명령을 완료 증거로 기록하지 않는다.

### 3.1 반복 중

- 바꾼 모듈의 단위 테스트
- 관련 JSDoc typecheck와 lint
- 물리 공식 변경 시 최소 해석 fixture 하나

### 3.2 마일스톤 gate

- `pnpm verify`: lint + typecheck + 빠른 test + production build
- `pnpm test:physics`: 짧은 해석해·보존·결정론 회귀
- M4 이후 `pnpm test:analysis`: frame·CR3BP·L점 회귀
- M5 이후 `pnpm test:e2e`: 대표 사용자 흐름

### 3.3 릴리스 gate

- `pnpm test:physics:long`: 10²–10³ 주기 장기 검증
- `pnpm benchmark`: 물리·렌더·진단·메모리 분리 측정
- 가속 도입 시 `pnpm test:parity`
- 지원 브라우저 smoke와 정적 배포 preview

### 3.4 증거 규칙

- fixture에 초기조건, 단위, 적분기, `dt`, substeps, softening, 기준 주기를 함께 둔다.
- 리포트에 빌드, 브라우저/런타임, 하드웨어, 실행 명령, elapsed time을 기록한다.
- 대용량 raw trajectory는 커밋하지 않는다. 작은 JSON/CSV 요약과 재생성 명령을 남긴다.
- 허용오차 변경은 이전/이후 결과와 이유를 `PROGRESS.md`에 기록한다.

---

## 4. 런북

| # | 증상 | 우선 가설 | 먼저 할 일 |
|---|---|---|---|
| 1 | 설치·빌드 실패 | 런타임/lockfile 불일치 | 고정 버전과 clean install 재현, 첫 오류부터 수정 |
| 2 | core 경계 lint 실패 | React·DOM·브라우저 의존 유입 | adapter를 runtime/render/state로 이동 |
| 3 | flaky 결정론 테스트 | 순회 순서·시간·난수·공유 상태 | 입력과 순서를 고정하고 최소 fixture로 축소 |
| 4 | 에너지 모니터만 드리프트 | 힘·퍼텐셜 softening 불일치 | analytic pair와 수치 미분 test 확인 |
| 5 | 궤도 붕괴 | `G`/단위, 힘 부호, KDK 순서, 초기속도 오류 | 원형 이체 sanity부터 역추적 |
| 6 | NaN/Inf | 0 거리, 과대 `dt`, 무효 값, softening 부족 | 실패 직전 snapshot과 첫 비유한 항목 기록 |
| 7 | figure-8의 `ΔL/L0`가 Inf | `L0≈0`에 상대오차 사용 | scale-normalized 각운동량 확인 |
| 8 | COM이 움직여 실패 | `P0≠0`인 계에 정지 COM 가정 | 예상 관성 경로와 비교하거나 barycentric 보정 |
| 9 | fixed world 보존 실패 | 외부 제약을 폐쇄계로 취급 | constrained 상태 표시와 gate 비적용 확인 |
| 10 | L1–L3 solver 불안정 | 무보호 Newton 초기값 | bracket, residual, 반복 이력을 확인 |
| 11 | UI와 figure 수치 불일치 | 서로 다른 core step snapshot | step 완료 snapshot을 단일 source로 사용 |
| 12 | 프레임 저하 | force, 진단, trail, React 중 원인 미분리 | M7A 계측으로 비용을 먼저 분리 |
| 13 | Barnes–Hut parity 실패 | 2D 트리, `θ` 과대, COM/질량 집계 오류 | 3D octree·천체별 diff·작은 N부터 확인 |
| 14 | 자연어 연동 실패 | 공급자 계약·timeout·schema 변화 | adapter fixture 확인, 코어 경로 정상성 우선 확인 |

---

## 5. STOP 규칙

### 5.1 멈춰야 하는 상황

- 같은 오류를 서로 다른 근거 있는 방법으로 3회 시도했으나 같은 지점에서 막힌다.
- INV-1–INV-6 또는 마일스톤 gate를 우회해야만 다음 단계로 갈 수 있다.
- 큰 아키텍처 변경, 물리 정의 변경, 공개 데이터 계약 파괴가 필요하다.
- 허용오차 완화, 테스트 삭제, fixture 교체만으로 green을 만들고 싶어진다.
- 외부 접근·비밀정보·비용·배포 권한처럼 현재 사용자 권한을 넘어선다.

### 5.2 멈출 때 기록

`PROGRESS.md`에 다음을 남긴다.

1. 증상과 최초 실패 명령
2. 최소 재현 입력과 환경
3. 시도한 방법과 각 결과
4. 현재 가설과 반증된 가설
5. 필요한 결정 또는 권한

그 뒤 사용자에게 선택지를 보고한다. 결정 전에는 불변식을 깨는 임시 우회를 만들지 않는다.

### 5.3 절대 금지

- 테스트 삭제·skip·허용오차 임의 완화로 통과 위장
- 보존·해석해·CR3BP·parity가 깨진 상태로 다음 마일스톤 진행
- API 키, `.env`, private payload, 대용량 산출물 커밋
- AI 계층을 코어 실행 필수 의존으로 결합
- 3D 물리 상태를 렌더 편의를 위해 2D로 축소
- 직접합산 oracle을 parity 증거 없이 가속 경로로 대체

---

## 6. `PROGRESS.md` 갱신 체크리스트

작업 종료 전 다음 중 바뀐 항목을 갱신한다.

- 현재 마일스톤과 상태
- 방금 완료한 작업 패키지
- 다음 실행 가능한 한두 작업
- 실행한 gate와 결과/증거 경로
- 새 미결 질문과 blocker
- 날짜·결정·이유가 있는 결정 로그
- M3 허용오차, M6 공급자, M7 기준 장치처럼 재현에 영향을 주는 설정

검증 우선순위는 항상 다음과 같다.

```text
물리·분석 불변식 > 핵심 기능 실효 > 통합 정합성 > UX > 성능 주장 > 선택 기능
```
