# Barycenter

Barycenter는 AU · yr · 태양질량 단위에서 G=4π²를 사용하는 브라우저 기반
3D N-body 중력 샌드박스입니다. 물리 상태는 Float64 3D로 유지하고,
고정 스텝 leapfrog 또는 Yoshida 4차 심플렉틱 적분기로 장기 궤도 구조를
보존합니다. Canvas 2D는 XY 투영을 표시하며, 에너지·각운동량·질량중심
드리프트를 같은 완료 스텝 snapshot에서 계측합니다.

현재 상태는 **Product Beta / Core v1 release candidate**입니다. 모든 로컬
자동 release gate는 통과했지만 지원 브라우저의 물리 smoke와 최종 LCP를
이 환경에서 측정할 수 없어 Core v1 표식은 보류했습니다.

## 시작

Node 24.14 계열과 pnpm 11.9를 사용합니다.

    pnpm install --frozen-lockfile
    pnpm dev

Production 확인:

    pnpm verify
    pnpm release:verify
    pnpm preview

## 주요 기능

- 직접합산 O(N²) CPU 중력, massive/tracer 역할, softening, safe stop
- leapfrog·Yoshida4 production 경로와 RK4 비교 경로
- 원형 이체, 주성–행성, Figure-8, CR3BP L4 Tadpole 프리셋
- 관성·질량중심·회전 프레임, L1–L5, 야코비 상수, 영속도 등고선
- 재생·고정 스텝·리셋, Cartesian/Kepler 편집, pan/zoom/fit/측정
- 고정 길이 진단 및 총량 제한 trail, CSV, URL 공유, 사용자 시작 WebM
- 선택형 자연어 ScenarioDraft 요청 → 검토 → 적용 흐름
- Canvas 미지원 시에도 계속 동작하는 CPU 시뮬레이션·속성·진단·CSV 경로

## 자연어 시나리오

정적 빌드는 프록시 없이 결정적 오프라인 참조 해석기를 사용합니다.
외부 공급자를 활성화하려면 packages/ai-proxy를 별도 배포하고 공개
VITE_BARYCENTER_AI_PROXY_URL만 클라이언트에 설정합니다. 공급자 키,
upstream URL, 모델은 서버의 BARYCENTER_AI_* 환경변수에만 둡니다.

공급자·모델·비용은 아직 선택하지 않았으며 외부 API는 제품 실행의
필수 조건이 아닙니다.

## 성능과 메모리

MSI Stealth 15 A13VF / i7-13620H / Windows High performance 기준
결정적 N=500 fixture의 JavaScript p95 프레임 추정치는 7.2769ms입니다.
N=2000은 67.1555ms로 realtime 범위 밖입니다. 따라서 직접합산 oracle을
유지하고 Barnes-Hut/Worker는 향후 2000+ 천체 요구 시점으로 미뤘습니다.

Trail은 요청된 천체별 길이에 더해 전체 32768점 상한을 적용합니다.
측정한 N=100/500/2000에서 trail typed-array 저장량은 약 0.8MB로
고정됩니다.

    pnpm benchmark
    pnpm report:performance
    pnpm report:bundle

## 정적 배포

Production 빌드는 dist에 생성됩니다. 해시 asset에는 immutable 1년 cache,
index.html에는 no-cache, 직접 URL에는 index fallback 정책이 포함됩니다.

    pnpm build
    pnpm deploy:check

실제 host가 public/_headers와 public/_redirects 형식을 지원하지 않으면
같은 정책을 해당 host 설정으로 옮기십시오. 자연어 프록시는 정적
배포와 독립적입니다.

## 검증 계층

- pnpm verify: lint, 브라우저/프록시 strict checkJs, 빠른 테스트, build,
  bundle budget, 정적 artifact, secret 경계
- pnpm test:physics:long: 1000주기 이체와 100주기 Figure-8 기준선
- pnpm test:analysis: 회전 프레임·CR3BP·L1–L5·Jacobi 기준선
- pnpm release:verify: 위 release 계층과 M7 benchmark

수치 근거는 reports/physics-baseline.md와 reports/analysis-baseline.md,
성능·출시 근거는 reports/performance-baseline.md,
reports/bundle-baseline.md, reports/core-v1-release-candidate.md에 있습니다.

## 알려진 제한

- 물리 브라우저 matrix와 최종 LCP가 완료되기 전까지 Core v1 표식을 쓰지
  않습니다.
- N=2000은 기준 장치에서 realtime이 아니며 Barnes-Hut/GPU가 없습니다.
- 공유되는 비신뢰 Scenario는 128천체로 제한됩니다.
- 렌더는 Canvas 2D XY 투영이며 3D orbit view는 후속 범위입니다.
- WebM은 브라우저 MediaRecorder와 video/webm codec 지원이 필요합니다.
- 충돌 병합은 없으며 근접 조우는 softening으로 다룹니다.
- 외부 자연어 공급자는 미선택·미설정 상태입니다.
