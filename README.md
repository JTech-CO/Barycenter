# Barycenter

> **심플렉틱 적분으로 장기 궤도 안정성을 보존하는 브라우저 기반 N-body 중력 샌드박스**

## 1. 소개 (Introduction)

Barycenter는 다체 중력계, 삼체 문제, 태양계 궤도와 라그랑주점을 수치적으로
시뮬레이션·시각화하는 순수 클라이언트 웹 애플리케이션입니다. 물리 상태는
AU · yr · 태양질량 단위와 `G = 4π²`를 사용하는 Float64 3D 좌표로 유지하며,
Canvas 2D에는 XY 기준면을 투영합니다.

고정 스텝 심플렉틱 적분과 결정론적 실행을 통해 같은 초기조건에서 같은 궤도를
재현하고, 에너지·각운동량·질량중심 드리프트를 완료된 동일 스텝에서 계측하여
시뮬레이션의 물리적 신뢰성을 직접 확인할 수 있습니다.

**주요 기능**

- **N-body 시뮬레이션**: 직접합산 `O(N²)` 중력, massive/tracer 역할, softening, 안전 정지
- **장기 궤도 적분**: leapfrog·Yoshida 4차 production 경로와 RK4 비교 경로
- **CR3BP 분석**: 관성·질량중심·회전 좌표계, L1–L5, 야코비 상수, 영속도 등고선
- **인터랙티브 워크벤치**: 프리셋, Cartesian/Kepler 편집, pan·zoom·fit·측정, 진단 플롯
- **재현과 내보내기**: URL 시나리오 공유, CSV, 사용자 시작 WebM, 고정 길이 trail·diagnostics
- **선택형 자연어 시나리오**: 오프라인 참조 해석기 또는 격리된 외부 AI 프록시를 통한 요청 → 검토 → 적용

> **현재 상태:** Product Beta / Core v1 release candidate. 자동 릴리스 게이트는
> 통과했지만 실제 지원 브라우저 smoke와 최종 LCP 계측이 남아 있어 Core v1
> 표식은 보류하고 있습니다.

## 2. 기술 스택 (Tech Stack)

- **Frontend**: React 19, Vite 7, JavaScript/ESM + JSDoc
- **Numerics**: 자작 Float64 3D 중력 코어, leapfrog, Yoshida4, RK4, CR3BP 해석 도구
- **Rendering**: Canvas 2D XY 투영
- **State Management**: Zustand
- **Validation**: Vitest, ESLint, TypeScript `checkJs`, 결정론적 물리·성능 기준선
- **Optional Backend**: 의존성 없는 Node `node:http` 자연어 시나리오 프록시
- **Deployment**: 정적 `dist/` 아티팩트, SPA fallback, 해시 asset 캐시 정책

## 3. 설치 및 실행 (Quick Start)

**검증 기준:** Node.js 24.14.x, pnpm 11.9.0

`package.json`의 지원 범위는 Node.js `^22.13.0 || ^24.0.0`입니다.

1. **설치 (Install)**

   ```bash
   git clone https://github.com/JTech-CO/Barycenter.git
   cd Barycenter
   pnpm install --frozen-lockfile
   ```

2. **환경 변수 (Environment)**

   기본 시뮬레이터와 오프라인 자연어 해석기는 환경 변수 없이 동작합니다.
   외부 AI 공급자를 연결할 때만 브라우저에 공개 프록시 경로를 설정하고,
   자격 증명은 `packages/ai-proxy` 서버 환경에만 둡니다.

   ```bash
   # 브라우저에 공개 가능한 프록시 경로
   VITE_BARYCENTER_AI_PROXY_URL=http://localhost:8787/v1/scenario-drafts

   # 프록시 서버 전용 — 클라이언트 번들 또는 저장소에 커밋하지 않음
   BARYCENTER_AI_UPSTREAM_URL=https://provider.example/v1/generate
   BARYCENTER_AI_API_KEY=replace-me
   BARYCENTER_AI_MODEL=replace-me
   ```

   외부 공급자·모델은 아직 고정하지 않았으며, 프록시는 제품 실행의 필수
   구성요소가 아닙니다. 자세한 경계는
   [`packages/ai-proxy/README.md`](./packages/ai-proxy/README.md)를 참고하세요.

3. **실행 및 검증 (Run & Verify)**

   ```bash
   pnpm dev

   # 빠른 저장소 게이트
   pnpm verify

   # 장기 물리·CR3BP·성능을 포함한 릴리스 게이트
   pnpm release:verify
   ```

   Production 빌드와 로컬 프리뷰는 다음과 같이 실행합니다.

   ```bash
   pnpm build
   pnpm preview
   ```

   GitHub Pages 배포 주소는 <https://jtech-co.github.io/Barycenter/>입니다.

## 4. 폴더 구조 (Structure)

```text
Barycenter/
├── src/
│   ├── core/          # React·DOM과 분리된 결정론적 수치 코어
│   ├── runtime/       # 시뮬레이션 실행, snapshot, bounded history
│   ├── scenarios/     # 물리 프리셋과 시나리오 계약
│   ├── render/        # Canvas 궤도·분석 렌더링
│   ├── workbench/     # 데스크톱형 시뮬레이션 워크벤치
│   ├── components/    # UI 컴포넌트
│   ├── state/         # Zustand UI 상태
│   ├── ai/            # ScenarioDraft 요청·검토·적용 흐름
│   ├── export/        # CSV·WebM·공유 파일 경계
│   └── validation/    # 물리·성능 fixture와 회귀 검증
├── packages/ai-proxy/ # 선택형 외부 AI 프록시
├── scripts/           # 검증·리포트·번들·배포 도구
├── public/            # 정적 배포 헤더와 SPA fallback
└── .github/workflows/ # 빠른 CI와 예약/수동 릴리스 검증
```

## 5. 정보 (Info)

- **Release status**: Product Beta / Core v1 release candidate
- **Known limits**: Canvas 2D XY 투영, Barnes–Hut/GPU 미도입, 충돌 병합 미지원, 실제 브라우저/LCP 최종 확인 대기
- **Live site**: [jtech-co.github.io/Barycenter](https://jtech-co.github.io/Barycenter/)
- **Repository**: [JTech-CO/Barycenter](https://github.com/JTech-CO/Barycenter)
- **Contact**: [GitHub Issues](https://github.com/JTech-CO/Barycenter/issues)
- **License**: 현재 별도 라이선스 파일이 지정되어 있지 않습니다.
