# Step 0: polar-service

> **4-billing 실행 조건 (phase 공통)**
> - 이 phase는 Polar의 **사전 서면 승인**을 받은 뒤에만 실행한다(`plan.md` 11장, ADR-008). 실행 여부는 **사람이 결정**한다.
> - 모든 step은 Polar SDK를 `vi.mock`으로 대체한다. 실제 키, sandbox, `.env*` 없이 완료할 수 있다.
> - Polar가 거절하면 결제 업체를 바꾼다. 그때 고칠 범위는 `src/services/billing/*`와 entitlement-sync(`src/server/actions/billing.ts`의 동기화, `src/app/api/webhooks/polar/`)뿐이다. 이 경계를 지켜라.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (Pro 권한, 외부 서비스 래퍼, 에러 코드 표, 외부 SDK 메모의 Polar 항목)
- `/docs/ADR.md` (ADR-008)
- `/plan.md` 3-4장(권한 동기화), 11장(리스크) · `/ops/polar-approval-request.md`
- `/src/server/env.ts` (`getServerEnv`: `polarAccessToken`, `polarWebhookSecret`, `polarServer`, `polarProProductId`), `/src/server/logger.ts`, `/src/lib/domain/errors.ts`
- `/src/services/claude/client.ts` (1-ingest: env를 지연해서 읽고 SDK 에러를 `AppError`로 바꾸는 패턴)
- `/src/lib/analytics/plan.ts` (3-pro: `isProActive`)
- `node_modules/@polar-sh/sdk/README.md`, `node_modules/@polar-sh/sdk/.agents/skills/polar-typescript-sdk/SKILL.md`, 같은 폴더의 `references/webhooks.md`
- `node_modules/@polar-sh/sdk/dist/2026-04/index.d.mts`와 이 파일이 import하는 `dist/index-*.d.mts`, `dist/models-*.d.mts`, `dist/base-*.d.mts`

## 작업

### 0. 사전 확인 (구현 전에)
- `/ops/polar-approval-request.md`와 `/plan.md` 11장을 읽는다.
- Polar가 **거절**했다는 기록이 있으면 코드를 쓰지 않는다. `"status": "blocked"`, `"blocked_reason": "Polar 사전 승인 거절 기록 있음 — 결제 업체 재선정 필요(교체 범위: services/billing/*, entitlement-sync)"`로 두고 즉시 중단한다.
- 답변 기록이 없어도 계속 진행한다. 이 phase를 실행한 것 자체가 사람의 결정이다.

### 1. 확인된 SDK API (`@polar-sh/sdk` 1.0.0-alpha.22, `@polar-sh/sdk/2026-04`)
아래 표는 설치된 타입에서 확인한 이름이다. **구현 전에 타입 파일에서 다시 확인하라.** 요청·응답 필드는 snake_case다.
| 용도 | 호출 | 메모 |
|---|---|---|
| 클라이언트 | `createPolar({ accessToken, environment, timeout })` | `environment: 'sandbox' \| 'production'`, timeout 단위는 **초** |
| checkout 생성 | `checkouts.create({ products, external_customer_id, customer_email?, customer_ip_address?, success_url, return_url? })` → `Checkout` | 응답 `id`, `url`, `status`, `external_customer_id` |
| checkout 조회 | `checkouts.get(id)` | `status: 'open'\|'expired'\|'confirmed'\|'succeeded'\|'failed'` |
| 포털 | `customerSessions.create({ external_customer_id, return_url })` | 응답 `customer_portal_url` |
| 고객 상태 | `customers.getStateExternal(externalId)` → `CustomerState` | `active_subscriptions[]`: `id, status, product_id, current_period_end, cancel_at_period_end`. 고객이 없으면 404 |
| past_due 구독 | `subscriptions.list({ external_customer_id, status: 'past_due' })` → `{ items: Subscription[] }` | `CustomerStateSubscription.status` 타입이 `'active' \| 'trialing'`뿐이라 past_due 구독은 고객 상태에 나오지 않는다 |
| 즉시 해지 | `subscriptions.revoke(id)` | 이미 해지된 구독이면 `errors.AlreadyCanceledSubscription`(403) |
| 웹훅 | `webhooks.validateEvent(body, { "webhook-id", "webhook-timestamp", "webhook-signature" }, secret)` → `{ type, data }` | `webhooks.PolarWebhookVerificationError`, `webhooks.PolarWebhookUnknownTypeError`(`eventType`), 부모 `webhooks.PolarWebhookError` |
| 에러 | `import { PolarClientError, PolarNetworkError, PolarServerError, PolarRateLimitError } from "@polar-sh/sdk"` | `PolarClientError.statusCode`, 버전별 에러는 `import { errors } from "@polar-sh/sdk/2026-04"` |

### 2. 공유 타입 — `src/lib/analytics/plan.ts`에 추가 (순수, derivePlan은 Step 1)
```ts
export interface BillingSubscription { id: string; status: string; productId: string; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean }
export interface CustomerState { subscriptions: BillingSubscription[] }
```

### 3. `src/services/billing/polar.ts`
```ts
import "server-only";
export type CheckoutState = "open" | "expired" | "confirmed" | "succeeded" | "failed";
export interface BillingWebhookEvent { type: string; externalCustomerId: string | null }
export class WebhookVerificationError extends Error {}
export async function createCheckout(i: { userId: string; email?: string | null; ipAddress?: string | null; successUrl: string; returnUrl?: string }): Promise<{ id: string; url: string }>
export async function getCheckout(checkoutId: string): Promise<{ status: CheckoutState; externalCustomerId: string | null }>
export async function createPortalSession(userId: string, returnUrl: string): Promise<{ url: string }>
export async function getCustomerState(userId: string): Promise<CustomerState | null>
export async function revokeSubscriptions(userId: string): Promise<number>          // 해지한 구독 수
export async function validateWebhook(rawBody: string, headers: Headers): Promise<BillingWebhookEvent>
```
- 클라이언트는 `getClient()` 안에서 처음 쓸 때 만든다(모듈 캐시 가능). 모듈 최상단에서 env를 읽지 않는다. `environment`는 `polarServer`, `timeout`은 15초.
- `createCheckout`: `products: [polarProProductId]`, `external_customer_id: userId`. `successUrl`에 문자 그대로 `{CHECKOUT_ID}`가 없으면 `AppError('INTERNAL')`. 이메일·IP는 값이 있을 때만 넣는다.
- `getCheckout`: 404 → `AppError('NOT_FOUND')`. `createPortalSession`: 고객 없음(404·422) → `AppError('NOT_FOUND')`.
- `getCustomerState`: `getStateExternal` 404 → `null`. `active_subscriptions`와 past_due 목록을 합치고 `id`로 중복을 없앤다. 날짜는 `Date`로 바꾸고, 잘못된 값은 `null`로 둔다.
- `revokeSubscriptions`: 상태가 `null`이면 0. active·trialing·past_due 구독을 모두 `revoke`한다. `AlreadyCanceledSubscription`과 404는 이미 끝난 것으로 본다(멱등).
- `validateWebhook`: 세 헤더만 골라 `polarWebhookSecret`으로 검증한다.
  - 서명 오류와 그 밖의 `PolarWebhookError` → `WebhookVerificationError`를 던진다.
  - `PolarWebhookUnknownTypeError` → `{ type: eventType ?? "unknown", externalCustomerId: null }`을 돌려준다.
  - `externalCustomerId`는 타입 접두사로 찾는다: `customer.*` → `data.external_id` · `subscription.*`/`order.*`/`benefit_grant.*` → `data.customer?.external_id` · `checkout.*` → `data.external_customer_id` · 그 외나 빈 문자열 → `null`.
- 에러 변환: 위에서 다루지 않은 SDK 에러(`PolarNetworkError`, `PolarServerError`, `PolarRateLimitError`, 나머지 `PolarClientError`)는 `logger.error("billing.polar.<작업>", e, { status })` 후 `AppError('BILLING_UNAVAILABLE')`.

### 4. 테스트 `src/services/billing/polar.test.ts` (먼저 작성)
- `vi.mock("@polar-sh/sdk/2026-04")`: `createPolar`가 `vi.fn` 메서드 객체를 돌려주게 한다. `webhooks.validateEvent`와 에러 클래스 3개, `errors.ResourceNotFound`·`errors.AlreadyCanceledSubscription`을 가짜 클래스로 만든다. `vi.mock("@polar-sh/sdk")`로 기본 에러 클래스를 만들고 `vi.mock("@/server/env")`로 더미 값을 넣는다.
- 검증할 것:
  - checkout 요청 body(`products`, `external_customer_id`, `{CHECKOUT_ID}` 보존)
  - `{CHECKOUT_ID}`가 없는 successUrl 거부
  - 404 → `null`/`NOT_FOUND`
  - active + past_due 병합과 중복 제거
  - revoke 멱등(이미 해지된 구독 포함)
  - 웹훅 타입별 external id 추출, 서명 실패 → `WebhookVerificationError`, 알 수 없는 타입 → `null`
  - 네트워크·5xx·429 → `BILLING_UNAVAILABLE`
  - `console` spy로 이메일·IP·payload가 로그에 없는지

## Acceptance Criteria

```bash
npm run lint
npm run build   # env 없이 빌드 성공
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `@polar-sh/sdk` import가 `src/services/billing/`에만 있는가?
   - `external_customer_id`가 함수 인자(세션의 userId)에서만 오는가?
   - 로그에 payload·이메일·IP·에러 원문이 없는가?
3. 결과에 따라 `phases/4-billing/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (export 함수 이름과 확인한 SDK 메서드를 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `@polar-sh/nextjs` 어댑터, 구 SDK(`new Polar()`), `@polar-sh/sdk/webhooks`를 쓰지 마라. 이유: 버전을 고정한 새 SDK와 필드 규칙(snake_case)·에러 클래스가 다르다(ADR-008).
- `@polar-sh/sdk`를 `src/services/billing/` 밖에서 import하지 마라. 이유: 업체를 바꿀 때 고칠 범위를 이 폴더로 가둔다.
- 요청 body에서 받은 값을 `external_customer_id`로 쓰지 마라. 이유: 남의 계정에 결제와 권한이 붙는다.
- success URL의 `{CHECKOUT_ID}`를 `URL`·`encodeURIComponent`로 인코딩하지 마라. 이유: `%7B…%7D`가 되면 Polar가 checkout ID로 바꾸지 않는다.
- 웹훅 payload, 이메일, IP, SDK 에러 메시지를 로그나 응답에 넣지 마라. 이유: CLAUDE.md CRITICAL(로그 비노출).
- 테스트에서 실제 네트워크를 쓰거나 `.env*` 파일을 만들지 마라. 이유: 이 복사본에는 키가 없고, 테스트는 mock으로만 돈다.
- 기존 테스트를 깨뜨리지 마라.
