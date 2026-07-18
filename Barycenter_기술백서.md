# Barycenter 기술 백서 (Technical Whitepaper)

**버전**: 1.1
**작성일**: 2026년 7월 19일
**작성자**: JTech-CO
**참고 문서**: Barycenter 디자인 백서 v1.1, Barycenter 작업 하네스 v0.2

> **코드네임 안내** — `Barycenter`(질량중심)는 개발용 코드네임이며, 대외 브랜드명은 추후 확정한다. 질량중심·총운동량 보존이 본 시뮬레이터의 검증·신뢰 서사의 축이라는 점에서 코드네임을 이렇게 둔다.

---

## 1. 프로젝트 개요 (Project Overview)

### 1.1. 프로젝트 명
**Barycenter — 브라우저 기반 N-body 중력 샌드박스 / 태양계 시뮬레이터**

### 1.2. 목적 (Purpose)
심플렉틱(symplectic) 적분기로 장기 궤도 안정성을 보존하며, 다체(N-body) 중력계·삼체 문제·라그랑주점을 수치적으로 정확하게 시뮬레이션·시각화하는 순수 클라이언트 웹 애플리케이션을 구축한다.

- 천문학 배경이 없는 일반 사용자도 "태양이 둘이면 행성 궤도가 어떻게 되는가" 같은 질문을 자연어로 던지는 즉시 장면을 얻도록, 전문 해석 도구의 프레임 안에 자연어 시나리오 입력과 프리셋 갤러리라는 진입로를 둔다.
- 적분기가 에너지·각운동량·질량중심을 얼마나 잘 보존하는지를 상시 계측·표시하여, 시뮬레이션의 물리적 신뢰성을 사용자가 직접 확인할 수 있게 한다(검증 오버레이 = 신뢰 장치).
- 고정 스텝 심플렉틱 적분 + 시드 없는 순수 결정론(초기조건이 궤도를 유일하게 결정)으로, 시나리오 하나가 항상 동일 궤도를 재현하도록 한다. `SimConfig`를 URL에 담으면 타인이 동일 계를 재생·이어보기 가능하다.

### 1.3. 핵심 차별점 (Key Differentiators)
1. **보존 보장 (Conservation Guarantee)**: leapfrog·Yoshida 4차 등 심플렉틱 적분기를 채택해 장기 적분에서 총에너지가 secular drift 없이 유계로 유지된다. 총에너지·각운동량·질량중심 드리프트를 상시 오버레이하여 정확성을 계측·증명한다.
2. **자연어 시나리오 (Natural-Language Scenario)**: "태양 두 개와 그 주위를 도는 행성" 같은 평문을 Fable 5가 구조화 JSON(질량·위치·속도 또는 케플러 요소)으로 변환해 로더에 주입한다. 코어 솔버는 AI 없이도 완결 동작하며, AI 계층은 선택적·격리형이다.
3. **정규화 단위계 (Normalized Units)**: AU · 년 · 태양질량으로 정규화하여 G = 4π²로 고정, 수치 범위를 O(1)로 유지한다. 이는 부동소수 안정성·프리셋 가독성·크로스 시나리오 재현성을 동시에 확보한다.

---

## 2. 상세 기능 요구사항 (Detailed Requirements)

### 2.1. 시스템 환경 및 인터페이스 (System & Interface)
- **뷰 모드 (View Mode)**: Desktop First / 해석 도구형 고정 프레임. 리본 커맨드바 · 좌측 사양 트리 + 속성 관리자 · 중앙 그래픽(플롯) 영역 · 우측 figure 도킹(플롯) · 하단 커맨드/콘솔 · 상태바. 최소 폭 1280px 가정. 모바일은 그래픽 + 재생 컨트롤 + 단일 드리프트 계측기로 축약한 관람 모드.
- **테마 정책 (Theme Policy)**: 단일 라이트 해석 테마. CSS Variables 토큰 기반. 그래픽 영역은 near-white 기술 플롯 표면(§디자인 백서 §5.1). 다크 테마는 v1 범위 외.
- **공간 차원**: 물리 상태는 내부적으로 3D 벡터(위치·속도)로 보유하여 궤도 경사(inclination)를 정확히 반영한다. 기본 렌더는 기준면(황도면)으로의 정사영 top-down 뷰. 3D 궤도 뷰는 v1 이후 확장.
- **렌더 백엔드**: 그래픽 영역은 Canvas 2D 기본, 천체 수 증가 대비 WebGL2 인스턴싱 옵션. 대규모 입자(수천~수만)의 힘 계산 가속은 WebGL2 transform feedback / (옵션) WebGPU 컴퓨트. 도달률을 위해 WebGL2를 주력으로, WebGPU는 비의존.
- **연산 백엔드**: 적분·힘 계산은 CPU(TypedArray) 기본, 대규모 시 GPU 가속 경로.

### 2.2. 사용자 상호작용 로직 (Interaction Logic)
- **이벤트 처리 (Event Handling)**:
  - **Input**: 천체 물성(질량·위치·속도 또는 케플러 요소)·시뮬 파라미터(dt·softening·적분기)는 단위 접미사가 붙은 드래그-스크럽 수치 필드 + 직접 입력. 그래픽은 팬(드래그)·줌/맞춤(휠)·천체 선택(클릭)·측정 프로브. 자연어 시나리오는 하단 커맨드 라인에 평문 입력.
  - **Action**: 재생/일시정지/한 스텝/리셋은 리본 트리거. 적분기·dt·softening·시간배속 변경은 리본. 파라미터 변경은 즉시 반영하되, 재현을 위해 초기조건 편집은 리셋 지점 기준으로 관리.
- **데이터 검증 (Validation)**: 파라미터는 클라이언트 범위 클램프(dt 상한, softening ≥ 최소값)한다. `kind='massive'`는 질량 > 0, `kind='tracer'`는 질량 = 0만 허용하며 음수 질량은 항상 거부한다. 자연어 → JSON은 스키마 검증(필수 필드·수 범위·NaN 차단) 통과분만 로더로 주입한다. 케플러 요소는 물리 유효 범위(`0 ≤ e < 1`, a > 0 등) 검증 후 상태 벡터로 변환.

### 2.3. 데이터 모델 (Data Model)
JSDoc 타입으로 정의하며 직렬화 가능(저장·공유·GPU 전송)해야 한다.

1. **Body**: 천체. `{ id(int), name(string), kind('massive'|'tracer'), mass(number, M☉), position(Vec3, AU), velocity(Vec3, AU/yr), radius(number, 표시용), fixed(bool) }`. tracer는 massive body의 중력을 받지만 질량원이나 보존량 합에는 기여하지 않는다. `fixed=true`는 외부 제약을 뜻하므로 해당 World를 폐쇄계 보존 게이트에서 제외한다.
2. **KeplerElements**: 궤도 요소 입력. `{ a(반장축), e(이심률), i(경사), Omega(승교점 경도), omega(근점 인수), anomaly:{ type('true'|'mean'), value }, primaryId }` → 로더가 primary/body 질량으로 `μ=G(m_primary+m_body)`를 계산해 상태 벡터로 변환한다. v1 속성 UI의 ν는 `type='true'`로 직렬화한다.
3. **World**: 계 스냅샷. `{ bodies(Body[]), G(=4π²), time(number, yr), step(int), frame:{ type('inertial'|'rotating'|'barycentric'), refA?, refB? } }`
4. **SimConfig**: 실행 설정. `{ integrator('leapfrog'|'yoshida4'|'rk4'), dt(number, yr), substeps(int), softening(number, ε), scenarioId(string|null), timeScale(number), rendering:{ trailLength, showVelocity, showContours } }`
5. **Diagnostics**: 보존량 계측 시계열. `{ E0, L0, com0, P0, scales, constrained, series:{ t[], energySignedErr[], energyError[], angularMomentumError[], comDrift[] } }` (윈도우드 링버퍼)
6. **Scenario**: 프리셋/공유 단위. `{ id, title, bodies, config, frame }` → lz-string 압축 후 URL 해시.

### 2.4. 출력 및 성능 기준 (Output & Performance)
- **결과물 형식**:
  - 시나리오 저장/공유: `Scenario`(천체 초기조건 + 설정)를 lz-string 압축해 URL 해시로 인코딩.
  - 시뮬 클립·타임랩스: `canvas.captureStream()` + `MediaRecorder` → WebM 원탭 저장.
  - 계측 데이터: 보존량 시계열 CSV 내보내기(figure 플롯 원본).
- **품질 기준 (QA Standards)**:
  - 초기 로딩(LCP): 2.5초 이내(코어·wasm 우선, UI 코드 스플리팅).
  - 실시간성: 수백 천체 O(N²) CPU 경로에서 60fps 목표. 수천~수만은 GPU 경로 또는 Barnes-Hut.
  - 브라우저: Chrome·Edge·Safari·Firefox 최신. WebGL2 폴백 보장. 구형 모바일 관람 모드 최소 동작.
  - 정확성 불변식: 이체 케플러 궤도가 해석해와 일치, leapfrog 에너지 드리프트 유계(§4.3, 하네스 §1 불변식).
- **결과물 형식(플롯)**: 그래픽 영역과 figure 도킹의 모든 플롯은 흰 배경 기술 플롯 규격(축 눈금·AU/년 단위 라벨)을 따른다.

---

## 3. 기술 스택 및 라이브러리 (Tech Stack)

### 3.1. Core
- **Frontend**: React + Vite(정확한 지원 안정 버전은 M1에서 lockfile로 고정). 상태관리 Zustand. 언어 JavaScript/ESM + JSDoc 타입 주석.
- **Numerics**: 자작 심플렉틱 적분기·힘 계산(외부 물리엔진 미사용 — 심플렉틱 성질·보존량 계측을 직접 통제해야 하므로). 벡터·선형대수는 경량 자작 유틸(TypedArray 기반).
- **Rendering**: Canvas 2D(주력) + WebGL2(인스턴싱·GPU 힘 계산, 옵션).
- **AI 계층(선택)**: Anthropic API(Fable 5), 자연어 시나리오 → JSON. 키 노출 방지 최소 프록시 경유(§7.1). 코어와 완전 분리.

### 3.2. Libraries & Tools
1. **자작 numerics 코어** (필수)
   - **용도**: leapfrog/Yoshida4/RK4 적분, 직접합산/Barnes-Hut 힘, softening, 케플러↔직교 변환, 보존량 계측.
   - **설정 값**: 정규화 단위 G=4π², 고정 dt, softening ε 하한.
2. **zustand** (필수)
   - **용도**: 에디터 UI 전역 상태(실행 상태·선택 천체·설정·계측 요약).
3. **lz-string** (필수)
   - **용도**: 시나리오/설정 URL 인코딩.
4. **경량 플로팅 유틸(자작 또는 최소 라이브러리)** (필수)
   - **용도**: figure 도킹의 보존량·분리거리·위상공간 플롯. 흰 배경 기술 플롯 규격 렌더.

---

## 4. 아키텍처 및 로직 (Architecture & Logic)

### 4.1. 상태 관리 전략 (State Management)
- **Scope**: 전역(Global)은 실행 상태·설정·선택·계측 요약. 지역(Local)은 패널 UI 상태. 시뮬레이션 코어의 대용량 데이터(천체 상태 배열·궤적 버퍼·물리 월드)는 Zustand에 넣지 않고 코어 소유로 두고, UI에는 요약·파생만 push한다(대량 천체에서 리렌더 폭주 방지).
- **Tool**: Zustand Store + 커스텀 훅. 코어는 프레임워크 무관 순수 모듈로 분리. 스토어는 코어 이벤트(스텝 완료·계측 갱신)를 구독해 UI 파생 상태만 보유.

```javascript
// 상태 스키마 예시 (UI 파생 상태만 보유, 천체 상태 배열은 코어 소유)
const useBaryStore = create((set) => ({
  status: 'idle',          // 'idle' | 'running' | 'paused'
  time: 0,                 // 시뮬 시간 (yr)
  diagnostics: null,       // { energyError, angularMomentumError, comDrift, constrained }
  selectedId: null,
  config: defaultConfig,
  setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  onStep: (t, diag) => set({ time: t, diagnostics: diag }),
}));
```

### 4.2. 주요 동작 파이프라인 (Main Workflow)
1. **초기화 (Init)**: URL 해시에서 `Scenario` 복원(없으면 기본 프리셋) → 케플러 요소 입력분을 상태 벡터로 변환 → 질량중심 보정(총운동량 0으로 이동, 선택) → 초기 보존량 `E0·L0·com0` 기록 → 렌더 준비.
2. **적분 루프 (Process)**: 렌더 프레임과 물리 스텝을 분리(accumulator 패턴). 프레임 간 경과시간을 고정 dt·substeps로 소진하며 적분기 스텝 → 매 스텝 힘 계산(직접합산 또는 Barnes-Hut) → 상태 갱신 → 보존량 계측 링버퍼 갱신 → 궤적 버퍼 append(윈도우). 시간배속은 프레임당 소진 스텝 수로 조절.
3. **렌더/갱신 (Update)**: 그래픽 영역에 천체 마커·궤적 폴리라인·(옵션) 속도 벡터·기준 트라이어드·AU 눈금 렌더. 스텝마다 스토어에 계측 요약 push → 상태바·figure 플롯·보존 모니터 갱신. AI 계층 활성 시 자연어 입력을 비동기 처리하고 결과를 로더로 주입(렌더 블로킹 없음).

### 4.3. 핵심 알고리즘 (Core Algorithms)
- **심플렉틱 적분 (Symplectic Integration)**:
  - 기본: velocity Verlet / leapfrog(2차 심플렉틱), 고정 dt. 킥-드리프트-킥 분리로 장기 에너지 유계.
  - 고정밀 프리셋: Yoshida 4차(leapfrog 3-스텝 합성, 계수 고정). 삼체 정밀 궤도용.
  - 교육/비교용(옵션): RK4(비심플렉틱). 동일 계의 장기 에너지 거동을 심플렉틱 경로와 비교해 구조적 차이를 시연한다. 특정 `dt`에서 반드시 단조 drift해야 한다는 CI 전제는 두지 않는다.
  - 적응 스텝은 심플렉틱 구조를 깨므로 미채택. 근접 조우는 softening 또는 균등 서브스텝으로 처리.
- **중력 softening**: `F = G·m₁·m₂·r⃗ / (|r⃗|² + ε²)^{3/2}`. r→0 특이점에서의 힘 폭주·속도 발산(NaN)을 억제. ε는 계 스케일 대비 하한 클램프.
- **힘 계산 (Force Evaluation)**:
  - 직접합산 O(N²): massive–massive 쌍은 대칭성(뉴턴 제3법칙)으로 쌍당 1회 계산한다. massless tracer는 massive source의 가속도만 받고 역작용·tracer 간 중력은 만들지 않는다. TypedArray 기반 CPU 경로를 정확성 oracle로 유지한다.
  - Barnes-Hut O(N log N, 선택): 내부 상태가 3D이므로 힘 계산에는 팔분트리(octree)를 사용한다. 개방각 θ ≈ 0.5를 시작점으로 CPU 직접합산 parity를 검증한다.
  - GPU 경로(옵션): 힘 커널을 WebGL2/WebGPU로 오프로드.
- **케플러 ↔ 직교 변환 (Orbital Elements ↔ State Vector)**: v1 요소 입력은 타원 궤도(`0 ≤ e < 1`)로 제한한다. 진근점 이각 ν 입력은 직접 perifocal 상태로 변환하고, 평균근점 이각 M 입력에만 케플러 방정식(`M = E − e·sinE`)의 수렴 보호 반복을 적용한다. 이후 관성 좌표계로 회전하며, 역변환은 각도 wrapping과 anomaly 종류를 명시한다.
- **보존량 계측 (Conservation Diagnostics)**: 매 스텝 총에너지 `E = Σ½mv² − Σ_{i<j} G·mᵢmⱼ/sqrt(|rᵢ−rⱼ|²+ε²)`, 총 각운동량 `L = Σ mᵢ(rᵢ × vᵢ)`, 선운동량 `P`, 질량중심 `com`을 산출한다. 에너지는 signed/absolute 오차를 함께 보관하고, `L₀≈0`은 특성 각운동량으로 정규화하며, COM은 예상 관성 경로 `com₀+(P₀/M)t`와 비교한다. `fixed` 천체가 있으면 constrained 상태를 표시하고 폐쇄계 보존 성공으로 판정하지 않는다.
- **회전 좌표계 · 유효 퍼텐셜 (Rotating Frame · Effective Potential)**: 두 주 천체 기준 공회전 좌표계 변환. 야코비 유효 퍼텐셜 등고선 + 라그랑주점 L1–L5 위치 + 야코비 상수 표시. 제한 삼체 문제(CR3BP) 모드 지원.
- **충돌 병합 (Collision Merge, 옵션)**: 근접 임계 이하에서 비탄성 병합. 질량·운동량 보존으로 합체 천체 생성(선택 시나리오).

---

## 5. UI 구현 가이드 (Implementation Guide)

> 상세 시각 규격은 **Barycenter 디자인 백서 v1.0**을 기준으로 한다. 본 절은 기술 접점만 요약한다.

### 5.1. 디자인 토큰 (Design Tokens)
- **Colors**: 라이트 해석 테마. 표면 계층 토큰(`--canvas`, `--bg`, `--panel`, `--panel-header`, `--border`) + 단일 인터랙션 액센트(`--accent`, 엔지니어링 블루, 선택·활성·포커스에만). 플롯 시리즈색은 물리량 구분(에너지·각운동량·천체별 궤적)에 한해 사용하는 정성 팔레트. 보존 상태(허용/주의/발산)는 상태색. 구체 Hex는 디자인 백서 §5.1.
- **Typography**: `Pretendard`(UI) + `JetBrains Mono`(수치·좌표·단위, `tabular-nums`). 최대 2 패밀리. 수치 밀도가 높은 도구이므로 mono 사용 비중이 크다.
- **Breakpoints**: Desktop(전체 프레임), Mobile(관람 모드). 상세 px는 디자인 백서 §4.2.

### 5.2. 공통 컴포넌트 (Shared Components)
- **NumberField (단위 부착)**: 드래그-스크럽 + 직접 입력 + 범위 클램프 + 단위 접미사(AU·yr·M☉). 모든 물성/파라미터 입력의 원자 단위.
- **SpecTree**: 계 계층 트리(World → Frame → Bodies → Constraints → Presets).
- **PropertyManager**: 선택 항목의 편집 가능한 속성 폼(직교/케플러 전환).
- **GraphicsArea**: 궤도 플롯 렌더 + 팬/줌/선택/측정.
- **FigureDock**: 보존량·분리거리·위상공간 스택 플롯(흰 배경 기술 플롯 규격).
- **ConservationMonitor**: 에너지·각운동량 드리프트 상시 계측기 + 스파크라인(시그니처).

---

## 6. 파일 구조 (File Structure)

```text
barycenter/
├── src/
│   ├── core/                 # 프레임워크 무관 시뮬레이션 코어
│   │   ├── vec.js            # Vec3·선형대수 유틸 (TypedArray)
│   │   ├── integrators.js    # leapfrog·yoshida4·rk4
│   │   ├── forces.js         # 직접합산·Barnes-Hut·softening
│   │   ├── kepler.js         # 케플러↔직교 변환
│   │   ├── diagnostics.js    # 에너지·각운동량·질량중심 계측
│   │   ├── frames.js         # 회전 좌표계·유효 퍼텐셜·라그랑주점
│   │   ├── merge.js          # 충돌 병합 (옵션)
│   │   └── world.js          # 계 상태·스텝 오케스트레이션
│   ├── scenarios/            # 프리셋 (태양계·figure-8·CR3BP·연성 등)
│   ├── ai/
│   │   └── scenario.js       # Fable 5 자연어→JSON 클라이언트 (프록시 경유)
│   ├── state/
│   │   └── store.js          # Zustand 스토어 + 훅
│   ├── render/
│   │   ├── graphics.js       # 궤도 플롯 렌더러 (Canvas/WebGL)
│   │   └── figures.js        # 보존량 플롯 렌더러
│   ├── components/
│   │   ├── common/           # NumberField, IconButton, Tabs 등 원자 단위
│   │   ├── layout/           # TitleBar, Ribbon, DockZone, Splitter, StatusBar, Console
│   │   └── panels/           # SpecTree, PropertyManager, FigureDock, ConservationMonitor
│   ├── hooks/
│   ├── utils/                # lz-string 인코딩, 단위 포맷터
│   ├── App.jsx
│   └── main.jsx
├── public/
└── [설정 파일 - package.json, vite.config.js, eslint 등]
```

---

## 7. 개발 시 주의사항 (Implementation Notes)

1. **보안 (Security)**:
   - Anthropic API 키는 절대 클라이언트 번들에 포함하지 않는다. AI 계층은 최소 프록시(Fastify) 경유로만 호출하며 키는 서버 환경변수에 둔다. 코어 솔버는 프록시 없이 완전 정적 배포 가능하도록 AI 계층을 선택적·격리형으로 유지한다.
   - 자연어 → 로더 주입 경로는 스키마 검증을 반드시 통과시킨다(악성/비물리 입력이 솔버를 오염시키지 않도록).
2. **성능 최적화 (Optimization)**:
   - 힘 계산이 병목이다. O(N²)는 대칭성으로 쌍당 1회, TypedArray로 캐시 친화 배치. 대규모는 Barnes-Hut·GPU 경로로 전환.
   - 렌더와 물리 스텝 분리(accumulator). 궤적 버퍼는 윈도우(고정 길이 링버퍼)로 메모리 상한. React 리렌더는 스텝 요약 단위로만 트리거.
   - 천체 마커·궤적은 배치 렌더(WebGL 인스턴싱). 전 천체 개별 DOM 금지.
3. **이슈 대응 (Known Issues)**:
   - **에너지 secular drift**: 비심플렉틱 적분기(RK4)나 적응 스텝 오용 시 총에너지가 단조 이탈. 기본은 심플렉틱 고정 dt로 통제. RK4는 비교 시연 전용.
   - **근접 조우 발산(NaN)**: r→0에서 힘 폭주. softening ε 하한 + 스텝 후 NaN 검사 + 발산 시 안전 정지·경고.
   - **부동소수 재현**: 결정론은 "동일 빌드·플랫폼" 전제. 크로스머신 완전 일치는 v1 목표 아님(PROGRESS 명시).
   - **GPU↔CPU 힘 정합성**: GPU 경로 사용 시 동일 배치에 대해 CPU와 힘·궤적이 일치해야 한다(정합성 게이트).
   - **Safari iOS 100vh·자원 제약**: 관람 모드 뷰포트 높이·GPU 경로 폴백 대응.
