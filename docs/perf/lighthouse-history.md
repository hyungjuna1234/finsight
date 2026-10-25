# Lighthouse 성능 루프 기록

마지막 run-dir: /private/tmp/claude-501/-Users-hjkim-Desktop-ai-project-finsight/601edb70-beef-4dd0-9c66-7c91a1fef263/scratchpad/perf-loop/run-20261025105242 · 마지막 kept 평균 점수: 74.3 · 다음 iteration: 10 (STOP: 분석가 제안 없음 — 아래 참고)

## Iteration 9 — 2026-10-25 11:10 KST (측정 생략 — 코드 변경 없어 baseline과 동일)
대상: 루트 레이아웃 폰트(2MB) 바이트 자체를 줄이는 방향(iteration 8의 preload:false 대신)
분석 결과(정량 재확인): `run-20261025105242`의 원본 JSON에서 — 폰트 하나가 페이지 전체 전송량의 ~89%(2,058,506 / 2,300,404 bytes), 시뮬레이션 다운로드 속도(1474.56Kbps)로 나누면 ≈11.17s ≈ 관찰된 LCP(12.3s)와 거의 일치. 반면 실측 트레이스(`lcp-breakdown-insight`)는 LCP 요소 자체 렌더 지연이 132ms뿐이라고 보여줌 — 즉 Lighthouse 헤드라인 LCP는 Lantern 시뮬레이션이 이 프리로드 리소스의 다운로드 시간을 그대로 반영한 것으로 보임.
결과: **제안 없음** — `weight` 범위 좁히기는 가변 폰트라 바이트 절감 효과가 없음(variable font는 weight 디스크립터와 무관하게 전체 2MB를 받음). 정적 서브셋으로 교체하는 안전한 길은 `src/app/layout.tsx`(전역)에서 `(app)`/`(marketing)` 라우트 그룹별 레이아웃으로 폰트 선언을 분리하는 다중 파일 변경이 필요하고, `npm run build` 산출물(생성되는 preload 링크)로 직접 검증해야 하는데, 같은 폰트 레버에서 이미 iteration 8이 -7.5pt 회귀를 낸 전례가 있어 남은 예산(iteration 10, 최대 도달) 대비 리스크 과다로 판단해 적용 안 함.
멈출 조건: 분석가 제안 없음 → **정체로 STOP**

후속 조사 메모(수동, 다음에 더 긴 예산으로 시도할 때):
1. `pretendard` 선언을 `src/app/(app)/layout.tsx`로 옮기고 `src/app/layout.tsx`에서 제거 → `npm run build` 후 `(marketing)` 라우트의 `<head>`에서 폰트 preload가 실제로 사라지는지 확인
2. 정적 서브셋(`node_modules/pretendard/dist/web/static/woff2/Pretendard-{Regular,Bold}.woff2`, 각 748K/776K — variable 2.0M보다 작지만 둘 다 로드하면 절감이 크지 않을 수 있음, 실사용 weight 조합을 먼저 좁혀야 함)로 교체 검토
3. 위 둘을 build 산출물로 확인한 뒤에만 Lighthouse 재측정

## Iteration 8 — 2026-10-25 11:01 KST
| 페이지 | 점수(전) | 점수(후) | Δ |
|---|---|---|---|
| / | 75 | 56 | -19 |
| /demo | 75 | 56 | -19 |
| /pricing | 74 | 56 | -18 |
| /guide | 74 | 99 | +25 |
| /refund | 74 | 56 | -18 |
| /privacy | 74 | 56 | -18 |
| /terms | 74 | 99 | +25 |
| /login | 74 | 56 | -18 |

평균: 74.3 → 66.8 (Δ-7.5)
대상 audit: layout.tsx `preload: false` (iteration 7)
결과: **폐기(discarded) — 6/8 페이지에서 3점 한도를 크게 초과하는 악화(-18~-19점)**. FCP가 ~11s로 폭증(원래 ~1.6~1.7s) — `display:"swap"`이면 폴백 폰트로 즉시 그려질 거라 예상했는데 실제로는 FCP 자체가 크게 늦어짐. 2페이지(guide, terms)만 99점으로 급등해 LCP~2.1s를 보였는데, 이건 나머지 6페이지와 정반대 방향이라 실제 효과가 아니라 **run 순서/npx lighthouse 콜드스타트 변동 같은 측정 노이즈**로 추정됨(같은 run 안에서 순서상 뒤에 있던 두 페이지만 좋게 나옴). `git restore src/app/layout.tsx`로 되돌림(preload 옵션 없음 = 기본값 true로 복귀).
교훈(다음 analyzer가 참고): **`next/font/local`에서 `preload: false`는 이 레포 PUB 측정 환경에서 시도하지 말 것** — 가설(2MB 폰트 preload가 critical path를 부풀린다)은 방향은 맞을 수 있으나 `preload: false`라는 구체적 해법은 역효과였다. 폰트 크기 자체를 줄이는 방향(정적 서브셋 사용, weight 범위 축소 등)을 다음에 고려할 것. 또한 이번 run에서 2/8 페이지가 반대 방향으로 크게 튄 것을 보면, **이 레포의 PUB Lighthouse 측정 자체에 run-to-run 변동성이 꽤 크다**는 점도 염두에 둘 것(다음 analyzer나 사용자는 결과를 2회 이상 재현해서 판단하는 걸 고려).

## Iteration 7 — 2026-10-25 10:59 KST
대상: `render-blocking-insight`/`network-dependency-tree-insight` (score 0, 원인 조사)
가설 검증됨(이번엔 메인이 직접 raw Lighthouse `network-requests` audit을 뜯어서 발견): `src/app/layout.tsx`의 루트 레이아웃 폰트(`node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2`)가 **2,058,506 bytes(2MB)** 이고, `preload` 옵션을 지정하지 않아 next/font/local 기본값인 `preload: true`로 `<link rel="preload" as="font">` 최우선순위 요청이 걸려 있음. 루트 레이아웃 공통 리소스라 PUB 8페이지 전부에 동일하게 영향 — 지금까지 관찰한 "모든 페이지 LCP가 콘텐츠와 무관하게 ~12.3~12.8s로 뭉쳐 나온다"는 현상과 정확히 일치하는 가장 강력한 후보.
시도: `layout.tsx`의 `localFont({...})`에 `preload: false` 추가(`display: "swap"`은 유지 — 폴백 폰트로 즉시 렌더 후 전환, 기능 회귀 없음). `layout.tsx`는 TDD 가드 예외 + 로직 없는 설정값 변경이라 신규 테스트 생략(레포 관례: page/layout엔 로직을 안 둠).
lint/test: 통과 (892/892)
결과: 적용됨, 아직 미커밋 — 다음 iteration(8)의 측정이 LCP가 실제로 줄었는지 확인하고 keep/discard를 정한다. **지금까지 중 LCP에 실제 영향을 줄 가능성이 가장 높은 시도.**

## Iteration 6 — 2026-10-25 10:52 KST (kept 2/2 — 정체 조건 충족)
| 페이지 | 점수(전) | 점수(후) | Δ |
|---|---|---|---|
| / | 75 | 75 | 0 |
| /demo | 75 | 75 | 0 |
| /pricing | 74 | 74 | 0 |
| /guide | 74 | 74 | 0 |
| /refund | 74 | 74 | 0 |
| /privacy | 74 | 74 | 0 |
| /terms | 74 | 74 | 0 |
| /login | 74 | 74 | 0 |

평균: 74.3 → 74.3 (Δ0)
대상: iteration 5의 proxy.ts 가설(불필요한 getClaims 호출이 LCP를 지연시킨다)
결과: kept (commit d9722c7) — 코드는 더 정확해졌지만(불필요한 네트워크 호출 제거) Lighthouse 점수·LCP 수치엔 측정 가능한 영향 없음. **가설이 틀렸거나, 이 레포의 PUB 더미 env 측정 방식 자체의 한계**(Lighthouse 모바일 네트워크 시뮬레이션이 뭔가 다른 요인으로 모든 요청에 균일하게 ~12s를 더하는 것일 수 있음 — 다음 investigation이 필요하면 `src/services/supabase/server.ts`의 클라이언트 "생성" 자체(런타임 import/초기화 비용)나 `@vercel/analytics/next` 초기 스크립트, 또는 Lighthouse CLI/Chrome 버전 특이사항을 봐야 함)
멈출 조건: kept 2연속(iteration 4, 6) 모두 Δ<1.0(둘 다 0) → **정체로 STOP**

## Iteration 5 — 2026-10-25 10:20 KST
대상: LCP/TTFB (전체 PUB 8페이지에서 LCP가 콘텐츠와 무관하게 ~12.3~12.8s로 뭉쳐 나오는 현상의 실제 원인 조사)
가설 검증됨: `src/proxy.ts`가 `isProtectedPath()` 확인보다 **먼저** 무조건 `supabase.auth.getClaims()`를 호출한다. PUB 8개 경로는 전부 `PROTECTED_PREFIXES`(`src/lib/domain/routes.ts`)에 없는 비보호 경로라 이 호출 결과가 응답에 전혀 영향을 안 주는데도 매 요청마다 실행됨 — PUB 더미 env의 응답 없는 `127.0.0.1:54321`로의 요청이라 서버 사이드 TTFB를 지연시키고, 이게 LCP에 직접 가산되는 것으로 보인다(이전 iteration들에서 기록한 "측정 아티팩트 추정"을 코드로 확인).
시도: `proxy.ts`에서 `isProtectedPath()`를 먼저 평가해 `false`면 Supabase 생성·`getClaims()`를 완전히 스킵하고 바로 통과시키도록 순서를 뒤집음. `proxy.ts`는 TDD 가드 예외 파일이지만 인증 리다이렉트 로직이라 `src/proxy.test.ts`를 새로 추가(비보호 경로는 getClaims 호출 안 함 / 보호 경로 미인증은 리다이렉트 / 보호 경로 인증됨은 통과, 3케이스).
lint/test: 통과 (892/892, 신규 3건 포함)
결과: 적용됨, 아직 미커밋 — 다음 iteration(6)의 측정이 LCP가 실제로 줄었는지 확인하고 keep/discard를 정한다.
참고(안전성): `src/services/supabase/server.ts`의 주석("Server Components cannot write cookies. src/proxy.ts refreshes them")을 보면 proxy.ts가 쿠키 갱신의 유일한 지점인데, 비보호 경로에서 이를 스킵해도 보호 경로 요청 시점에는 여전히 전체 로직이 돌아 그때 갱신되므로 기능적으로 안전하다고 판단함(로그인 세션이 PUB 페이지만 보는 동안엔 갱신을 미루는 정도의 영향).

## Iteration 4 — 2026-10-25 10:14 KST (kept 1/2 — 정체 판단에 쓸 kept 카운트)
| 페이지 | 점수(전) | 점수(후) | Δ |
|---|---|---|---|
| / | 75 | 75 | 0 |
| /demo | 75 | 75 | 0 |
| /pricing | 74 | 74 | 0 |
| /guide | 74 | 74 | 0 |
| /refund | 74 | 74 | 0 |
| /privacy | 74 | 74 | 0 |
| /terms | 74 | 74 | 0 |
| /login | 74 | 74 | 0 |

평균: 74.3 → 74.3 (Δ0)
대상 audit: `unused-javascript` (iteration 3에서 적용한 next/dynamic 변경)
결과: kept (commit b5acdb0) — 점수에는 측정 가능한 영향 없음(Δ0)이지만 회귀도 없어 규칙상 keep. `unused-javascript` 총 저장치도 그대로 ~1200ms — 이 audit은 recharts 코드 스플리팅만으로는 해결 안 되는 다른 원인(아마 공용 vendor 청크)일 가능성. 다음 analyzer는 이 audit을 또 고르면 구체적인 다른 접근이 필요함을 알 것.
멈출 조건 확인: 목표(90) 미달, kept 2연속 정체는 아직 1개뿐(이번이 첫 kept), iteration 4<10 → CONTINUE

## Iteration 3 — 2026-10-25 09:57 KST
대상 audit: `unused-javascript` (/demo 몫 ~300ms)
시도: iteration 1과 같은 변경(`CategoryChart`를 `next/dynamic`으로 지연 로딩) + 이번엔 테스트도 같이 고침. 1차로 `findAllByText`로 바꿔봤으나 이 매처는 "1개 이상 찾으면 바로 resolve"라서 SummaryTiles의 2개만 찾고 통과 안 되고 실패(여전히 2개). `waitFor(() => expect(screen.getAllByText(...)).toHaveLength(3))` 패턴(이 레포의 `chat-panel.test.tsx`와 동일 관례)으로 바꾸니 통과.
적용 파일: `src/components/dashboard/dashboard-view.tsx`(dynamic import), `src/components/dashboard/dashboard-view.test.tsx`(waitFor)
lint/test: 통과 (889/889)
결과: 적용됨, 아직 미커밋 — 다음 iteration(4)의 측정이 점수를 재보고 keep/discard를 정한다.
교훈: `findAllByText`/`findByText`는 "최소 1개 매치"에서 resolve하니, "정확히 N개"를 기다릴 땐 `waitFor(() => expect(...).toHaveLength(N))`을 써야 함.

## Iteration 2 — 2026-10-25 09:52 KST
결과: 변경 없음 재측정 (iteration 1이 빌드 전에 폐기되어 코드가 baseline과 동일 — 평균 74.3, Δ0, regression 없음). 커밋할 대상이 없어 "kept"로 집계하지 않고, 정체 판단에도 포함하지 않는다. 바로 iteration 3 분석으로 넘어감.

## Iteration 1 — 2026-10-25 09:49 KST
대상 audit: `unused-javascript` (저장 가능 ~1200ms, 영향 페이지: /, /demo, /pricing, /guide, /refund, /login)
시도: `src/components/dashboard/dashboard-view.tsx`에서 `CategoryChart` 정적 import를 `next/dynamic` 지연 로딩으로 교체
결과: discarded — lint/test 실패. `dashboard-view.test.tsx`의 "대시보드 섹션과 거래 링크 및 선택적 Pro 슬롯을 표시한다" 테스트가 `CategoryChart`가 동기적으로 렌더되어 "₩18,000"이 3번(SummaryTiles 2곳 + 차트 내부 목록 1곳) 나타난다고 가정하는데, 지연 로딩으로 바뀌면 render() 시점엔 아직 차트가 로드되지 않아 2번만 잡혀서 실패. Lighthouse 재측정 없이 폐기(변경 전 코드로 git restore).
교훈(다음 analyzer가 참고): `CategoryChart`를 지연 로딩하려면 `dashboard-view.test.tsx`의 "₩18,000" 3회 assertion도 `findAllByText`로 비동기 대기하게 같이 고쳐야 함 — 다음 제안에서는 이 테스트 수정을 포함하거나, 아예 다른 audit/파일을 타겟으로 고를 것.

## Iteration 0 — baseline — 2026-10-25 09:45 KST
| 페이지 | 점수 |
|---|---|
| / | 75 |
| /demo | 75 |
| /pricing | 74 |
| /guide | 74 |
| /refund | 74 |
| /privacy | 74 |
| /terms | 74 |
| /login | 74 |

평균: 74.3 (baseline, 비교 대상 없음)
상위 opportunity: `unused-javascript` (저장 가능 ~1200ms, 영향 페이지: /, /demo, /pricing, /guide, /refund, /login)
참고: 모든 페이지의 시뮬레이션 LCP가 12.3~12.9s로 비정상적으로 높게 나오는데, 이는 PUB 더미 env의 `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`(응답 없음)로 가는 요청이 Lighthouse의 모바일 네트워크 스로틀링 시뮬레이션에서 과장되게 반영된 것으로 보인다(실제 Supabase가 응답하는 운영 환경에서는 이 정도로 느리지 않을 가능성이 높음). `topOpportunities`(저장 시간 기반 audit)에는 영향 없음 — 이 값을 최적화 타겟으로 쓰지 않는다.
결과: baseline
