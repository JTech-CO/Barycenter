# Barycenter 디자인 백서 (Design Whitepaper)

**버전**: 1.1
**작성일**: 2026년 7월 19일
**작성자**: JTech-CO
**참고 문서**: Barycenter 기술 백서 v1.1, Barycenter 작업 하네스 v0.2

---

## 1. 프로젝트 개요 (Project Overview)

### 1.1. 프로젝트 명
**Barycenter UI/UX Design — 해석 도구형 궤도 시뮬레이터**

### 1.2. 목적 (Purpose)
수치해석·모델링·해석 계열 도구의 시각 언어(라이트 테마 · 사양 트리 + 속성 관리자 · 리본형 커맨드바 · 그래픽 영역 + 도킹 figure 플롯 · 상태바)로, 일반 사용자가 다체 중력계의 궤도 진화를 관찰하고 초기조건에 개입할 수 있는 화면을 구축한다.

- 중앙 그래픽 영역을 "라이브 기술 플롯"으로 삼아, 조작 지식 없이도 궤도가 어떻게 그려지는지 3초 안에 읽히게 한다.
- 진지한 해석 도구의 정밀함(단위 부착 수치·다중 계측 플롯)과 관람의 즉시성(재생 한 번으로 완결되는 궤도 장면·자연어 진입)을 양립시킨다.
- AI가 만든 티가 나는 시각 클리셰(네온·그라데이션·글래스·장식 이모지·검은 우주 배경+반짝이는 별)를 전면 배제하고, 실재하는 해석 도구의 절제된 시각 언어를 차용한다.

### 1.3. 핵심 차별점 (Key Differentiators)
1. **플롯으로서의 궤도 뷰 (Orbit-as-Figure)**: 궤도 뷰는 검은 우주 배경이 아니라 흰 배경 위 기술 플롯이다. 궤적은 얇은 폴리라인, 천체는 채운 마커, 축은 AU 눈금 — 실제 수치해석 도구에서 궤도를 플롯하는 방식 그대로다. 이 표면이 이 페이지의 시그니처다.
2. **보존 모니터 (Conservation Monitor)**: 총에너지·각운동량·질량중심 드리프트를 상시 계측·표시하는 계측기가 화면에 항상 떠 있다. 물리 시뮬레이터에서 신뢰는 곧 보존량 계측이므로, 이 계측기가 신뢰의 시그니처 장치다.
3. **단일 액센트 규율 (Single-Accent Discipline)**: 인터랙션 색은 엔지니어링 블루 1색으로 한정한다. 색을 쓰는 유일한 예외는 "서로 다른 물리량(에너지·각운동량·천체별 궤적)을 구분 인코딩하는 플롯 시리즈색"이다. 나머지 크롬은 전부 중성 계조다.

---

## 2. 상세 기능 요구사항 (Detailed Requirements)

### 2.1. 레이아웃 및 인터페이스 (Layout & Interface)
- **뷰 모드 (View Mode)**: Desktop First / 해석 도구형 고정 프레임.
  - *데스크톱*: 타이틀바 · 리본 커맨드바(탭: 홈 · 시나리오 · 시뮬레이션 · 해석 · 보기 · 도움말) · 좌측 도킹(사양 트리 + 속성 관리자) · 중앙 그래픽(플롯) 영역 · 우측 도킹(figure 스택) · 하단 커맨드/콘솔 라인 · 상태바. 최소 폭 1280px, 그 이하는 패널 폭 축소. 패널 경계는 리사이즈 스플리터.
  - *모바일*: 관람 모드로 축약 — 그래픽 영역 + 하단 고정 재생 컨트롤 + 단일 보존 드리프트 계측기. 트리·속성·figure·콘솔은 데스크톱 전용.
- **테마 정책 (Theme Policy)**: 단일 라이트 해석 테마. CSS Variables 토큰 기반.
  - *그래픽 영역 배경*: `#FCFCFD` (near-white 플롯 표면)
  - *앱 크롬 배경*: `#F0F1F3`
  - *기본 텍스트*: `#1F2328`

### 2.2. 사용자 상호작용 (Interaction Logic)
- **주요 액션 (Actions)**:
  - **Hover**: 트리 행·리본 버튼 배경의 미세 명도 변화(±1 계조)만. 스케일·회전·그림자 확대 금지.
  - **Selection**: 선택 천체·활성 커맨드는 엔지니어링 블루 좌측 바(2px) 또는 1px 아웃라인. 배경 채움은 저채도 블루 alpha 0.10 이내. 그래픽에서 천체 선택 시 트리·속성 관리자 동기화.
  - **Navigation**: 상단 리본 탭(커맨드 그룹) + 좌측 사양 트리. 햄버거·오버레이 드로어 미사용(해석 도구 관성).
  - **Graphics**: 팬(드래그) · 줌/맞춤(휠, 프레임 맞춤 단축키) · 천체 선택(클릭) · 측정 프로브(천체 간 거리·궤도 주기 읽기) · 오버레이 토글(궤적·속도 벡터·유효 퍼텐셜 등고선·회전 좌표계).
- **입력 방식 (Input)**:
  - **NumberField (단위 부착)**: 좌우 드래그 스크럽(커서 `ew-resize`) + 더블클릭 직접 입력 + 범위 클램프 + 단위 접미사. 값은 등폭 서체·`tabular-nums`.
  - **커맨드/콘솔 라인**: 자연어 시나리오 평문 입력 + 실행 로그. 해석 도구의 콘솔 관성을 계승하되, 초심자 진입로 역할.
  - **Segmented/Toggle**: 적분기 선택·좌표계 전환·직교/케플러 입력 전환 등 이산 상태.

### 2.3. 데이터 구조 및 모듈 (Component Structure)
화면 골격 모듈. 각 모듈의 스타일 가이드를 정의한다.

1. **타이틀바 (Title Bar, 높이 28px)**: 좌측 로고 마크(작게) + 문서명(시나리오명). 배경 `--panel-header`, 하단 1px `--border`.
2. **리본 커맨드바 (Ribbon, 높이 84px)**: 탭 스트립(28px) + 커맨드 그룹 영역(56px). 그룹은 라벨(예: "재생 제어", "적분기", "천체", "시나리오", "해석")로 구획, 각 그룹에 아이콘+텍스트 커맨드 버튼. 그룹 간 1px 세로 구분선. 배경 `--panel`.
3. **좌측 도킹 (Left Dock, 폭 280px)**: 상단 "사양 트리(Spec Tree)"(World → Reference Frame → Bodies → Constraints/Merges → Presets) + 하단 "속성 관리자(Property Manager)"(선택 항목의 편집 폼, 직교/케플러 전환). 세로 분할, 각 접기 가능.
4. **그래픽 영역 (Graphics Area, 중앙 flex-grow)**: 라이브 기술 플롯. 흰 배경 · AU 축 눈금(ruler) · 천체 마커(질량 log 스케일 크기) · 궤적 폴리라인(천체색, 뒤로 갈수록 낮은 alpha) · (옵션) 속도 벡터 · 기준 트라이어드 · 좌상단 보존 모니터 오버레이. 무배경 장식.
5. **우측 도킹 (Right Dock, 폭 320px)**: "Figures" — 스택 플롯 탭(에너지 드리프트 / 각운동량 드리프트 / 천체 분리거리 / 위상공간). 각 플롯은 흰 배경 기술 플롯 규격(축·격자·단위 라벨).
6. **하단 커맨드/콘솔 (Console, 높이 120px)**: 자연어 시나리오 입력 라인 + 실행/검증 로그. 등폭 서체. 접기 가능.
7. **상태바 (Status Bar, 높이 22px)**: FPS · 시뮬 시간(yr) · 스텝 수 · dt · 적분기 · |ΔE/E₀| · 천체 수 · 단위계 표기. 등폭 서체, `--text-muted`.

### 2.4. 출력 및 결과물 (Output)
- **결과물 형식**: React 컴포넌트(JSX) + CSS Modules + CSS Variables 토큰.
- **품질 기준 (QA Standards)**:
  - 접근성: 키보드 포커스 가시(`--accent` 2px 링), 색 외 표식 병행(보존 상태를 색만으로 구분하지 않음 — 아이콘·수치 동반), 라이트 테마 대비 4.5:1 이상.
  - 반응형: 데스크톱 고정 프레임에서 가로 스크롤 발생 금지(패널 폭 축소로 흡수). 모바일 관람 모드 정상 동작.
  - 모션: `prefers-reduced-motion: reduce` 존중.

---

## 3. 기술 스택 및 라이브러리 (Tech Stack)

### 3.1. Core
- **Frontend Framework**: React + Vite. 정확한 지원 안정 버전은 M1 lockfile을 따른다.
- **Styling Engine**: CSS Variables(디자인 토큰) + CSS Modules(컴포넌트 스코프). 토큰 주도 라이트 해석 테마 특성상 유틸리티 프레임워크보다 토큰+모듈이 깔끔하며 "템플릿 티" 위험도 낮다.

### 3.2. Libraries & Tools
1. **lucide-react** (아이콘)
   - **용도**: 리본·트리·패널 헤더 아이콘. 장식 이모지 대체.
   - **설정 값**: stroke 1.5px, size 16/18px 고정.
2. **Pretendard / JetBrains Mono** (웹폰트)
   - **용도**: UI 텍스트 / 수치·좌표·단위.
   - **설정 값**: 최대 2 패밀리 엄수. mono는 `font-variant-numeric: tabular-nums`.

---

## 4. 아키텍처 및 로직 (Architecture & Logic)

### 4.1. 시각적 계층 구조 (Visual Hierarchy)
밀도 높은 해석 도구를 지향하므로 UI 텍스트는 컴팩트 스케일을 쓴다(읽기 surface가 아닌 조작·계측 surface). 수치는 등폭으로 스캔성을 확보하고 라이트 테마에서 대비 4.5:1 이상을 유지한다.

- **Level 1 (다이얼로그/모달 타이틀)**: 18px / 600 / `--text`
- **Level 2 (패널·리본 그룹 헤더)**: 12px / 600 / `--text-muted`(대문자 트래킹 없이)
- **Level 3 (라벨·트리 항목·본문)**: 12px / 400 / `--text`
- **Level 4 (수치 값)**: 13px / JetBrains Mono 500 / `tabular-nums`
- **Level 5 (상태바·캡션·로그)**: 11px / 400 / `--text-muted`

```css
/* 스타일 적용 예시 */
.ribbon-group-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}
.value {
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}
.plot-axis-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: var(--text-muted);
}
```

### 4.2. 반응형 로직 (Responsive Logic)
1. **Desktop (Default, ≥1280px)**: 리본 + 좌/우 도킹 + 그래픽 + 콘솔 + 상태바 전체. 패널 폭 고정 + 스플리터 리사이즈.
2. **Transition Point (< 1024px)**: 우측 figure 도킹을 탭 전환식 오버레이로 축소, 콘솔 접기, 리본 그룹 라벨 축약.
3. **Mobile (< 768px)**: 관람 모드 — 그래픽 전면 + 하단 고정 재생 바 + 단일 보존 드리프트 계측기 + 상단 시나리오명. 좌/우 도킹·콘솔 제거.

### 4.3. 핵심 컴포넌트 로직 (Core Components)
- **GraphicsArea (시그니처)**: Canvas 렌더. 흰 배경 기술 플롯 위에 궤적 폴리라인 + 천체 마커. 궤적은 천체색을 물려받아 뒤로 갈수록 alpha 감쇠. AU 눈금이 이동 스케일을 공간에 직접 대응시켜 "얼마나 멀리·어떤 형태로 도는가"를 즉시 읽게 한다. 유효 퍼텐셜 등고선·회전 좌표계는 토글 오버레이(라그랑주점 시연).
- **ConservationMonitor (시그니처)**: 그래픽 좌상단 상시 오버레이 + 우측 figure 연동. scale-aware `energyError`·`angularMomentumError`·예상 경로 대비 `comDrift`를 수치 + 스파크라인으로 표시한다. constrained world는 보존 성공 대신 외력 제약 상태를 명시한다. 허용 범위 내 `--ok`, 증가 시 `--warn`, 발산 시 `--danger`(색 + 아이콘·수치 병행).
- **NumberField (단위 부착)**: 드래그 스크럽 상태 커서·값 실시간 갱신. 단위 접미사 표시. 범위 클램프 시 경계에서 정지(값 색 변화 없이).
- **SpecTree**: 계 계층. 현재 선택 천체 `--accent` 강조. 항목 클릭 시 속성 관리자·그래픽·figure 동기화.
- **PropertyManager**: 선택 천체의 질량·위치·속도(직교) 또는 케플러 요소(a·e·i·Ω·ω·ν) 편집 폼. 세그먼트 토글로 입력 방식 전환.
- **FigureDock**: 흰 배경 기술 플롯 스택. 각 플롯 축·격자·단위 라벨. 정체·발산은 플롯 형상으로 자연 노출(별도 경고색 남용 없이, 발산만 `--danger`).

---

## 5. UI/UX 디자인 가이드 (Design System)

### 5.1. 색상 팔레트 (Color Palette)
중성 계조 1 family(cool gray) + 인터랙션 액센트 1색 + 최소 상태색. 순수 흰/검정 미사용, 채도 100% 미사용.

**표면·텍스트 (중성 계조 · 라이트)**
- Canvas(그래픽·플롯 표면): `#FCFCFD` (`--canvas`)
- Background(앱 크롬): `#F0F1F3` (`--bg`)
- Panel(패널·리본): `#F6F7F8` (`--panel`)
- Panel Header(타이틀바·트리/패널 헤더): `#E9EBED` (`--panel-header`)
- Border(하어라인 구분): `#D2D6DB` (`--border`)
- Border Strong(스플리터·플롯 축): `#B8BEC6` (`--border-strong`)
- Text(주 텍스트): `#1F2328` (`--text`)
- Text Muted(라벨·보조·로그): `#616B76` (`--text-muted`)

**인터랙션 액센트 (단 1색)**
- Accent(선택·활성·포커스·현재 선택 천체): `#2C6FB3` (`--accent`) — 엔지니어링 블루. 해석 도구의 표준적 선택색 관성을 계승, 저채도로 절제. 채움은 alpha 0.10 이내.

**상태색 (정보 전달 필수 시에만)**
- OK(보존 허용 범위 내): `#2E7D5B` (`--ok`)
- Warn(드리프트 증가·주의): `#B7791F` (`--warn`)
- Danger(발산/NaN/무효 입력/오류): `#C0392B` (`--danger`)

**플롯 시리즈 컬러맵 (데이터 인코딩 전용, 크롬 장식 사용 금지)**
서로 다른 물리량·천체를 구분하는 정성(qualitative) 팔레트. 저채도, 라이트 배경 위 판별성 확보:
- `#2C6FB3`(블루) · `#B7791F`(앰버) · `#2E7D5B`(그린) · `#8E5CA8`(퍼플) · `#C0392B`(레드) · `#4A5568`(슬레이트)
- 에너지·각운동량은 고정 시리즈색 배정, 천체별 궤적은 위 팔레트 순환.

### 5.2. 타이포그래피 (Typography)
- **Font Family**: `Pretendard`(UI, Fallback `system-ui, sans-serif`) + `JetBrains Mono`(수치·좌표·단위·로그).
- **Font Weight**: 400 / 500 / 600 3단계. 100/300 극세, 700 초과 미사용.
- **원칙**: mono는 스캔·계측 대상(수치·좌표·플롯 축·로그)에 광범위 사용. 음수 트래킹·답답한 행간 금지. UI 컴팩트 스케일 정당화는 §4.1.

---

## 6. 파일 구조 (File Structure)

```text
src/
├── assets/
│   ├── fonts/                  # Pretendard, JetBrains Mono
│   └── styles/
│       ├── tokens.css          # 디자인 토큰 (CSS Variables, 라이트)
│       ├── reset.css           # Reset & 전역
│       └── colormap.js         # 플롯 시리즈 팔레트 (데이터 전용)
├── components/
│   ├── layout/                 # TitleBar, Ribbon, DockZone, Splitter, StatusBar, Console
│   ├── panels/                 # SpecTree, PropertyManager, FigureDock, ConservationMonitor
│   ├── common/                 # NumberField, IconButton, Tabs, Toggle, Segmented (Atomic)
│   └── graphics/               # GraphicsArea 렌더 컨테이너
└── [설정 파일 - vite.config.js 등]
```

---

## 7. 개발 시 주의사항 (Implementation Notes)

1. **스타일링 전략 (Styling Strategy)**:
   - 모든 색·간격·서체 값은 `tokens.css`에서 파생. 컴포넌트에 하드코딩 Hex 금지.
   - 간격 스케일 4/8px 기반(`4 / 8 / 12 / 16 / 24 / 32`). 임의값 금지.
   - CSS Modules 선택자 특이도 충돌 주의(리본·패널 간 padding/margin 상쇄 방지).
   - **금지 목록 준수**: 그라데이션(궤도 뷰·크롬 어디에도 배경 그라데이션 미사용)·네온 글로우·글래스모피즘(backdrop-blur)·장식 이모지·떠다니는 blob·검은 우주 배경+반짝이는 별·호버 스케일/회전·무한 반복 애니메이션·색 그림자. 색은 5색 이내(중성 family + 액센트 1 + 상태 3, 플롯 팔레트는 데이터 전용 예외).
2. **접근성 가이드 (Accessibility)**:
   - 보존 상태·발산을 색만으로 전달하지 않는다(아이콘·수치·형태 병행).
   - 키보드 네비게이션·포커스 가시성 필수. 아이콘 전용 버튼에 `aria-label`·tooltip.
   - 그래픽 인터랙션의 키보드 대체 경로(재생/정지/스텝/맞춤) 제공.
   - 라이트 테마 회색 텍스트(`--text-muted`)는 대비 4.5:1 이상 검증.
3. **예외 처리 (Exception Handling)**:
   - 시뮬레이션 미시작(idle): 그래픽 영역에 "프리셋 불러오기 / 자연어로 시나리오 입력" 유도 empty state, 톤은 인터페이스 목소리로.
   - 발산/무효 천체: 그래픽·트리에서 `--danger` 표식 + 사유 라벨. 사용자를 탓하지 않고 무엇이 발생했는지 명시(예: 근접 조우로 힘 발산 → softening 조정 안내).
   - 자연어 파싱 실패: 콘솔에 무엇이 부족한지 명시(필수 필드·범위), 로더 주입은 검증 통과분만.
   - AI 계층 미연결·실패: 콘솔 자연어 입력은 비활성 안내하되 프리셋·수동 입력 경로는 정상. 코어 조작을 막지 않는다.
   - 폰트 로딩 실패: `system-ui` fallback으로 레이아웃 보존.
