# Step 2: billing-ui

> **4-billing 실행 조건**: Polar의 사전 서면 승인 후에만 실행한다(plan.md 11장). 실행 여부는 사람이 결정한다. Polar는 `vi.mock`으로 대체하므로 키가 필요 없다. 업체를 바꿔도 이 step의 화면·라우트는 `server/actions/billing.ts`만 거치므로 그대로 쓴다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/USER_FLOWS.md` (③ 결제, ④ 구독, 결제 예외) · `/docs/UI_GUIDE.md` · `/docs/PRD.md` (가격)
- `/docs/ARCHITECTURE.md` (API 표, 에러 코드 표의 `ALREADY_SUBSCRIBED`·`BILLING_UNAVAILABLE`)
- `/src/services/billing/polar.ts`, `/src/server/actions/billing.ts`, `/src/lib/analytics/plan.ts` (Step 0·1)
- `/src/server/auth.ts` (`getOptionalUser`, `getPlan`), `/src/server/handler.ts`, `/src/lib/domain/redirect.ts`, `/src/lib/domain/money.ts`, `/src/lib/domain/month.ts`
- `/src/components/ui/api-fetch.ts` (`apiFetch`, `ApiError`, `redirectPathForError`)
- `/src/app/(app)/settings/page.tsx`와 이 페이지가 import하는 컴포넌트, `/src/server/queries/settings.ts` (2-dashboard settings-data. 구독 관리 자리 표시가 있다)
- `/src/components/pro/*` (3-pro 페이월·티저), `/src/app/(marketing)/demo/page.tsx` (마케팅 레이아웃 참고)

## 작업

### 0. 사전 확인
- `/ops/polar-approval-request.md`와 `/plan.md` 11장에 Polar **거절** 기록이 있으면 `blocked`로 두고 중단한다. 사유는 "Polar 승인 거절 — 결제 업체 재선정 필요".
- 기록이 없으면 계속 진행한다.

### 1. 서버 (TDD)
- `src/lib/domain/pricing.ts` (랜딩도 이 파일을 쓴다): `PRO_MONTHLY_KRW = 6900`, `PRO_BASE_PRICE_LABEL = "$4.99"`, `PLAN_FEATURES: { label; free: string; pro: string }[]`
  - 업로드·자동 분류 / 월별 대시보드: 둘 다 "포함" · 여러 달 추이·전월 비교 / 정기결제 목록 / Q&A 채팅: Free는 "—" · AI 인사이트 리포트: Free는 "첫 1회 무료"
- `src/server/request.ts`: `clientIp(headers: Headers): string | null` — `x-forwarded-for`의 첫 값, 없으면 `x-real-ip`. `node:net`의 `isIP`로 검증하고 아니면 `null`.
- `src/server/auth.ts`에 `getOptionalPlan(): Promise<"anonymous" | Plan>`를 추가한다. `getOptionalUser`가 null이면 `"anonymous"`, 아니면 3-pro `getPlan` 결과의 `plan`. (3-pro의 `server/queries/plan.ts`에 있는 `getViewerPlan`은 로그인 필수라 공개 페이지인 `/pricing`에서 쓸 수 없다. 이름을 겹치게 만들지 마라.)
- `src/server/actions/billing.ts`에 추가한다.
  ```ts
  export async function startCheckout(user: SessionUser, i: { returnTo?: string; ipAddress: string | null }): Promise<{ url: string }>
  export async function openPortal(userId: string): Promise<{ url: string }>
  ```
  - `startCheckout`
    1. 먼저 `syncEntitlement(user.id)`를 한다. Pro면 `AppError('ALREADY_SUBSCRIBED')`(409). 유실된 웹훅도 이 호출로 복구된다.
    2. 아니면 successUrl을 **문자열로** 만든다: `${appUrl}/billing/success?checkout_id={CHECKOUT_ID}&next=${encodeURIComponent(safeRedirect(returnTo, "/dashboard"))}`.
    3. returnUrl은 `${appUrl}/pricing?checkout=failed`.
    4. `createCheckout({ userId: user.id, email: user.email, ipAddress, successUrl, returnUrl })`를 부른다.
  - `openPortal`: ``createPortalSession(userId, `${appUrl}/settings`)``. 고객이 없으면 `NOT_FOUND`를 그대로 올린다.
- `src/server/queries/settings.ts`에 `getSubscriptionSummary()`를 추가한다. 첫 줄은 `requireUser()`이고, `{ plan, status, periodEnd: string | null, active: boolean }`(`active` = `isProActive`)를 돌려준다.
- `src/lib/domain/month.ts`에 `formatKstDate(date: Date): string`을 추가한다. 형식은 `"2026년 10월 26일"`(KST)이고 테스트를 포함한다.

### 2. 라우트 (각 폴더에 `route.test.ts`, `maxDuration = 30`)
- `src/app/api/billing/checkout/route.ts`: `POST = handler({ auth: "user", consent: true, body: z.object({ returnTo: z.string().max(200).optional() }) }, …)` → `startCheckout(user, { returnTo, ipAddress: clientIp(req.headers) })` → `{ url }`
- `src/app/api/billing/portal/route.ts`: `POST = handler({ auth: "user" }, …)` → `openPortal(user.id)` → `{ url }`. 해지는 동의 없이도 할 수 있어야 하므로 `consent`는 걸지 않는다.
- 이미 구독 중이면 checkout은 409 `ALREADY_SUBSCRIBED`를 돌려준다. 클라이언트가 이어서 portal을 부른다(에러 형식은 그대로 `{error:{code,message}}`).

### 3. 컴포넌트 `src/components/billing/` (props만, 쓰기는 `apiFetch`, 각각 `.test.tsx`)
- `pricing-table.tsx` — props `{ viewer: "anonymous" | Plan; checkoutFailed: boolean }`
  - Free/Pro 비교 표(`PLAN_FEATURES`)를 보여 준다.
  - 가격은 `formatKRW`로 `₩6,900/월`로 쓰고, 아래에 "(기본 통화 $4.99, Polar가 접속 위치에 따라 원화로 표시해요)"를 둔다.
  - 버튼 위에 고지를 둔다: "해외결제가 가능한 카드(VISA·Mastercard)가 필요해요. 국내전용 카드는 결제되지 않아요."
  - "언제든 해지할 수 있고, 해지해도 결제한 기간 끝까지 Pro를 쓸 수 있어요. [환불 정책](/refund)"
  - viewer별 버튼: anonymous → `/login?next=%2Fpricing` 링크 "로그인하고 Pro 시작하기" · free → `CheckoutButton` · pro → "이미 Pro를 쓰고 있어요" + `PortalButton`
  - `checkoutFailed`면 `role="alert"` 배너: "결제가 완료되지 않았어요. 국내전용 카드는 결제가 안 돼요. 해외결제 가능한 카드로 다시 시도해 주세요."
- `checkout-button.tsx` (client) — props `{ returnTo?: string }`
  - 누르면 `track("checkout_start")`(`@vercel/analytics`, 속성 없음) 후 `POST /api/billing/checkout` → `window.location.assign(url)`. 요청 중에는 비활성화한다(checkout 중복 생성 방지).
  - `ALREADY_SUBSCRIBED` → portal을 불러 이동한다. `redirectPathForError`가 경로를 주면 그리로 이동한다.
  - `BILLING_UNAVAILABLE` → "결제 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." + [다시 시도]
- `portal-button.tsx` (client) — props `{ label?: string }`. portal로 이동한다. `NOT_FOUND`면 "구독 기록이 없어요" + `/pricing` 링크.
- `checkout-status.tsx` (client) — props `{ checkoutId: string | null; next: string }`
  - 마운트되면 `POST /api/billing/confirm`을 **한 번** 부른다. StrictMode 이중 실행은 ref로 막는다.
  - `plan !== "pro"`이고 checkout이 `succeeded`·`confirmed`면 2·4·6·8·10초 뒤 최대 5회 다시 부른다(약 30초). 언마운트 시 타이머를 정리한다.
  - 상태별 화면
    - 확인 중: "결제를 확인하고 있어요"
    - Pro: "Pro가 열렸어요" + [계속하기 → next] + `track("checkout_pro_active")`
    - `open`·`expired`·`failed`: "결제가 완료되지 않았어요" + `/pricing?checkout=failed` 링크
    - 재시도를 다 쓴 경우: "결제는 완료됐어요. Pro 적용까지 몇 분 걸릴 수 있어요." + [대시보드로]
    - checkoutId 없음·`FORBIDDEN`·`NOT_FOUND`: "결제 정보를 확인할 수 없어요"
- `subscription-panel.tsx` — props `{ plan; status; periodEnd: string | null; active: boolean }`
  - Free → "Free 플랜을 쓰고 있어요" + `/pricing` 링크 "Pro 시작하기"
  - Pro → "Pro · 현재 결제 기간 {formatKstDate}까지" + `PortalButton label="구독 관리"`
  - `past_due` → `text-warning`으로 "결제에 실패했어요. 기간이 끝나고 7일 안에 결제 수단을 바꿔 주세요."
- 테스트는 `fetch`·`window.location`·`@vercel/analytics`를 mock하고 `vi.useFakeTimers`로 재시도 간격과 횟수를 검증한다.

### 4. 페이지 (로직 없이 조합만)
- `src/app/(marketing)/pricing/page.tsx`: `searchParams`(Next 16은 Promise)의 `checkout === "failed"`와 `getOptionalPlan()` 결과를 `PricingTable`에 넘긴다. `metadata.title = "요금"`.
- `src/app/(app)/billing/success/page.tsx`: `checkout_id`, `next`를 읽고 `next`는 `safeRedirect(next, "/dashboard")`를 거쳐 `CheckoutStatus`에 넘긴다.
- `src/app/(app)/settings/page.tsx`: 구독 관리 자리 표시를 `getSubscriptionSummary()` + `SubscriptionPanel`로 바꾼다.
- `src/components/pro/*`의 페이월·티저 CTA가 전부 `/pricing`으로 가는지 확인하고, 아니면 고친다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 컴포넌트가 props와 `apiFetch`만 쓰는가(`@/server`·`@/services` import 없음)?
   - checkout 생성이 POST + `handler()`로만 일어나고, `returnTo`가 `safeRedirect`를 거치는가?
   - 성공 페이지 도착만으로 Pro가 열리지 않고 confirm이 Polar 상태를 확인하는가?
3. 결과에 따라 `phases/4-billing/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (라우트·컴포넌트·`pricing.ts` 이름을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 브라우저에서 Polar URL을 조립하거나 Polar API를 부르지 마라. 이유: checkout은 서버만 만든다(공개 결제 링크는 꺼 둔다). 사용자 ID를 서버가 고정해야 한다.
- checkout을 GET이나 `<Link>`로 만들지 마라. 이유: GET 부작용 금지, 프리페치로 checkout이 생길 수 있다.
- confirm을 5회보다 많이 또는 무한히 폴링하지 마라. 이유: Polar 레이트 리밋과 비용.
- 가격·기능 문구를 컴포넌트마다 적지 마라. 이유: 랜딩·가격 페이지 표기가 어긋난다. `pricing.ts`만 쓴다.
- 결제 실패 원인(Polar 에러 문구)을 화면에 그대로 보여 주지 마라. 이유: 내부 정보 노출. 정해진 한국어 안내만 쓴다.
- Analytics 이벤트에 금액·이메일·checkout ID를 넣지 마라. 이유: PRD 측정 원칙(식별 정보 없음).
- 기존 테스트를 깨뜨리지 마라.
