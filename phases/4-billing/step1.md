# Step 1: entitlement-sync

> **4-billing 실행 조건**: Polar의 사전 서면 승인 후에만 실행한다(plan.md 11장). 실행 여부는 사람이 결정한다. Polar는 `vi.mock`으로 대체하므로 키가 필요 없다. 업체를 바꾸면 이 step의 동기화 코드와 `src/services/billing/*`만 교체 대상이다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md` (Pro 권한, `server/admin.ts` 함수 목록, API 표, 에러 코드 표)
- `/docs/ADR.md` (ADR-008) · `/plan.md` 3-4장 · `/ops/polar-approval-request.md`
- `/src/services/billing/polar.ts`와 테스트 (Step 0)
- `/src/lib/analytics/plan.ts` (3-pro `isProActive`, Step 0의 `CustomerState` 타입)
- `/src/server/admin.ts`와 테스트 (1-ingest `adminStorage`, 3-pro `adminEntitlements.get`·`markFreeInsightUsed`)
- `/src/server/auth.ts` (`requirePro`, `getPlan`), `/src/server/handler.ts`, `/src/server/logger.ts`, `/src/server/env.ts`
- `/supabase/migrations/*_init.sql` (`entitlements` 정의, `auth.users` FK) · `/src/types/database.ts`
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`

## 작업

### 0. 사전 확인
- `/ops/polar-approval-request.md`와 `/plan.md` 11장에 Polar **거절** 기록이 있으면 `blocked`로 두고 중단한다. 사유는 "Polar 승인 거절 — 결제 업체 재선정 필요".
- 기록이 없으면 계속 진행한다. 이 phase의 실행은 사람이 결정했다.

### 1. `derivePlan` — `src/lib/analytics/plan.ts`
```ts
export function derivePlan(state: CustomerState | null, now: Date, proProductId: string): { plan: Plan; status: string; periodEnd: Date | null }
```
- lib은 env를 읽을 수 없으므로 ARCHITECTURE의 `derivePlan(state, now)`에 `proProductId`를 더한다. `docs/ARCHITECTURE.md`에는 이미 이 시그니처로 적혀 있다.
- `productId === proProductId`인 구독이 status `active`·`trialing`·`past_due`이거나, `canceled`이면서 `cancelAtPeriodEnd`이고 `now < currentPeriodEnd`이면 Pro를 준다.
- 여럿이면 `currentPeriodEnd`가 가장 늦은 구독 → `{ plan: 'pro', status: 그 구독의 status, periodEnd: 그 currentPeriodEnd }`.
- 없으면 `{ plan: 'free', status: 가장 최근 Pro 상품 구독의 status 또는 'none', periodEnd: null }`. `state === null`이면 `'none'`.
- past_due 유예 7일은 여기서 계산하지 않는다. `isProActive`가 `period_end + 7일`로 처리한다.
- 표 테스트: active, trialing, 해지 예약(기간 내·기간 후), 다른 상품, null, 그리고 past_due + `isProActive` 조합(기간 끝 3일 후 → Pro, 8일 후 → Free).

### 2. `adminEntitlements.upsertIfNewer` — `src/server/admin.ts`에 추가
```ts
upsertIfNewer(userId: string, value: { plan: Plan; status: string; periodEnd: Date | null }, startedAt: Date): Promise<"updated" | "stale" | "unknown_user">
```
PostgREST upsert에는 조건부 WHERE가 없고 RPC는 쓰지 않는다. 그래서 다음 순서로 한다.
1. 조건부 update를 한다. `iso = startedAt.toISOString()`이고, 값에 `.`·`:`가 있으므로 큰따옴표로 감싼다.
   ```ts
   update({ plan, status, period_end, synced_at: iso }).eq("user_id", userId)
     .or(`synced_at.is.null,synced_at.lt."${iso}"`).select("user_id")
   ```
   1행 이상이면 `"updated"`다.
2. 0행이면 `insert({ user_id, plan, status, period_end, synced_at })`를 한다.
   - 성공하면 `"updated"`
   - `23505`(행이 이미 있거나 동시 insert)이면 1을 한 번 더 한다. 1행 이상이면 `"updated"`, 0행이면 `"stale"`
   - `23503`(`auth.users`에 없는 사용자)이면 `"unknown_user"`
   - 그 외는 `logger.error`(code만) 후 `AppError('INTERNAL')`
- `free_insight_used_at`은 절대 건드리지 않는다.
- `admin.test.ts`(가짜 admin client)로 검증한다: `.or()` 필터 문자열, 0행 → insert, 23505 → 재시도, 23503 → `unknown_user`, update payload에 `free_insight_used_at` 없음.
- 선택: `supabase/tests/`에 PGlite로 같은 조건의 SQL `UPDATE … WHERE synced_at IS NULL OR synced_at < $2`가 순서 역전을 막는지 증명하는 테스트를 추가한다.

### 3. `src/server/actions/billing.ts`
```ts
import "server-only";
export async function syncEntitlement(userId: string): Promise<{ outcome: "updated" | "stale" | "unknown_user"; plan: Plan }>
export async function confirmCheckout(userId: string, checkoutId: string): Promise<{ plan: Plan; checkout: CheckoutState }>
export async function handlePolarWebhook(rawBody: string, headers: Headers): Promise<{ status: 200 | 403 | 500 }>
```
- `syncEntitlement`: **Polar 호출 전에** `startedAt = new Date()` → `getCustomerState` → `derivePlan(state, new Date(), polarProProductId)` → `adminEntitlements.upsertIfNewer(userId, r, startedAt)`. Polar 에러는 그대로 올린다(`BILLING_UNAVAILABLE`).
- `confirmCheckout`
  - `getCheckout` 결과의 `externalCustomerId !== userId`(null 포함) → `AppError('FORBIDDEN')`. 이때 sync하지 않는다.
  - status가 `succeeded`·`confirmed` → `syncEntitlement` 결과의 plan
  - 그 외 → 현재 권한(`adminEntitlements.get` + `isProActive`)을 돌려준다. sync하지 않는다.
- `handlePolarWebhook`
  1. `validateWebhook`이 `WebhookVerificationError`를 던지면 403
  2. externalCustomerId가 없거나 UUID 형식이 아니면 `logger.warn("billing.webhook.ignored", { type, reason })` 후 200
  3. `syncEntitlement` 결과가 `unknown_user`면 같은 방식으로 warn 후 200. 성공하면 `logger.info("billing.webhook.synced", { type, outcome })` 후 200
  4. 그 밖의 예외는 `logger.error` 후 500. Polar가 재시도한다.
  - 이벤트 종류와 관계없이 항상 상태를 다시 읽는다. 그래서 같은 이벤트가 두 번 와도 결과가 같다(멱등).

### 4. 라우트 (각각 같은 폴더에 `route.test.ts`)
- `src/app/api/webhooks/polar/route.ts` (`export const maxDuration = 30;`)
  - `POST(req)`에서 **가장 먼저** `await req.text()`로 원문을 읽고 `handlePolarWebhook`에 넘긴다. `handler()`는 쓰지 않는다(Origin 검사·JSON 파싱이 서명 검증과 맞지 않는다).
  - 응답: 200 → `{ received: true }`, 403 → `{ error: { code: "FORBIDDEN", message } }`, 500 → `{ error: { code: "INTERNAL", message } }`
- `src/app/api/billing/confirm/route.ts` (`export const maxDuration = 30;`)
  - `POST = handler({ auth: "user", body: z.object({ checkoutId: z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/) }) }, …)` → `confirmCheckout(user.id, checkoutId)` → `{ plan, checkout }`

### 5. 필수 테스트 (`billing.test.ts`, route 테스트)
- `@/services/billing/polar`, `@/server/env`를 mock한다. `@/server/admin`은 `upsertIfNewer`와 같은 규칙으로 동작하는 **메모리 가짜**로 바꾼다.
- 서명 실패 → 403. 이때 sync와 DB 쓰기가 없어야 한다.
- external id 없음 · 모르는 사용자 → 200.
- 같은 웹훅 두 번 → 두 번 다 200이고, 저장된 행이 같다.
- **순서 역전**: 먼저 시작한 sync A의 `getCustomerState`가 나중에 끝나도 B(나중 시작)의 결과가 남는다. deferred promise와 `vi.setSystemTime`으로 재현한다.
- past_due이고 기간 끝 후 7일 안 → Pro. 기간 만료 → Free.
- sync 실패 → 500.
- confirm: 남의 checkout → 403, open → sync 호출 없음, succeeded → Pro.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `entitlements` 쓰기가 `server/admin.ts`의 `upsertIfNewer`로만 일어나는가?
   - 웹훅 라우트가 서명 검증 전에 아무 처리도 하지 않는가?
   - 웹훅 payload 내용이 DB·로그로 가지 않고, 항상 Polar 상태를 다시 읽는가?
3. 결과에 따라 `phases/4-billing/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (export 함수·라우트·`derivePlan` 시그니처 변경을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 웹훅 payload의 구독 상태를 그대로 DB에 쓰지 마라. 이유: 이벤트가 순서 없이 도착하면 옛 상태가 새 상태를 덮는다. 항상 `getCustomerState`로 다시 읽는다.
- `synced_at` 조건 없이 `upsert`하지 마라. 이유: 늦게 끝난 옛 조회가 새 결과를 덮어쓴다.
- 웹훅에서 `req.json()`이나 `handler()`를 쓰지 마라. 이유: 서명은 원문 바이트로 검증한다.
- 모르는 사용자·external id 없는 웹훅에 4xx·5xx를 돌려주지 마라. 이유: Polar가 계속 재시도한다.
- `webhook_events` 테이블, reconcile cron, SQL 함수(RPC)를 만들지 마라. 이유: plan 1-1장 — 재조회와 조건부 UPDATE로 충분하다.
- 서명 검증 실패 이유나 SDK 에러 문구를 응답에 넣지 마라. 이유: 공격자에게 검증 정보를 준다.
- 기존 테스트를 깨뜨리지 마라.
