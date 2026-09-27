# Step 0: entitlement-guard

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (CRITICAL: Pro 기능은 서버의 `requirePro()`로만)
- `/docs/ARCHITECTURE.md` (Pro 권한 절, `server/admin.ts` 함수 목록, `entitlements` 테이블, 에러 코드 402)
- `/docs/ADR.md` (ADR-008 `period_end + 7일`, ADR-009 요금제)
- `/docs/USER_FLOWS.md` (④ 구독 상태 전이, 결제 예외의 "웹훅 유실 → 기간 확인")
- `/src/lib/domain/types.ts` (`Plan`), `/src/lib/domain/errors.ts` (`AppError`, `ERROR_STATUS`)
- `/src/server/admin.ts` (1-ingest의 `adminStorage` — 같은 파일에 추가한다), `/src/services/supabase/admin.ts`
- `/src/server/auth.ts` (`requireUser`, `getOptionalUser`, `requireConsent`), `/src/server/handler.ts` (+ 테스트)
- `/supabase/migrations/20260926000000_init.sql` (`entitlements` 컬럼·기본값·NOT NULL), `/src/types/database.ts`

## 작업

Pro 여부와 "첫 AI 리포트 1회 무료" 크레딧을 서버에서 판단하는 관문을 만든다. 결제 연동(`derivePlan`, `upsertIfNewer`, 웹훅)은 4-billing 범위다. TDD로 진행한다.

### 1. `src/lib/analytics/plan.ts`
```ts
export const PRO_GRACE_DAYS = 7;
export interface EntitlementLike { plan: Plan; periodEnd: Date | null }
export function isProActive(ent: EntitlementLike | null, now: Date): boolean
```
- `plan === 'pro'` **그리고** (`periodEnd === null` 또는 `periodEnd + 7일 > now`). 비교는 밀리초(`getTime()`), 경계는 엄격한 `>`.
- 표 테스트: `null` → false, free → false, pro + null → true, pro + 미래 → true, `periodEnd + 7일 − 1ms` 시점 → true, 정확히 `+ 7일` → false, 한참 지남 → false.

### 2. `src/server/admin.ts`에 추가
```ts
export interface EntitlementRecord { plan: Plan; status: string | null; periodEnd: Date | null; freeInsightUsedAt: Date | null }
export const adminEntitlements: {
  get(userId: string): Promise<EntitlementRecord | null>;
  markFreeInsightUsed(userId: string): Promise<boolean>;   // 이번 호출로 처음 표시했으면 true
};
```
- `get`: 행이 없으면 `null`(= Free). timestamptz 문자열을 `Date`로 바꾼다.
- `markFreeInsightUsed`: ① 행이 없으면 만든다(`upsert({ user_id, plan: 'free', … }, { onConflict: 'user_id', ignoreDuplicates: true })` — 마이그레이션의 NOT NULL 컬럼을 확인해 채운다, 기존 행은 건드리지 않음). ② **조건부 update**: `.update({ free_insight_used_at: now }).eq('user_id', userId).is('free_insight_used_at', null).select('user_id')` → 1행이면 true, 0행이면 false.
- `upsertIfNewer`는 만들지 마라(4-billing). `free_insight_used_at`은 이 함수만 쓴다.
- 테스트: `@/services/supabase/admin`을 mock한 체인 fake로 호출 인자(특히 `.is('free_insight_used_at', null)`), 행 없음/있음, 날짜 변환 검증.

### 3. `src/server/auth.ts`에 추가
```ts
export interface ViewerPlan { plan: Plan; isPro: boolean; freeInsightAvailable: boolean }
export async function getPlan(userId: string, now?: Date): Promise<ViewerPlan>
export async function requirePro(userId: string, now?: Date): Promise<void>   // 아니면 AppError('PRO_REQUIRED')
```
- `getPlan`: `adminEntitlements.get` → `isProActive`. `plan`은 **실효 플랜**(기간이 지난 pro 행은 `'free'`). `freeInsightAvailable = !isPro && freeInsightUsedAt === null`(행이 없으면 true).
- 인자 `userId`는 반드시 세션(`requireUser()`/`ctx.user.id`)에서 온 값만 넘긴다.
- 테스트(`@/server/admin` mock): 행 없음 = free + 무료 1회 가능, pro 유효, pro 만료(7일 경계), 무료 사용 완료, `requirePro`가 `AppError`(code `PRO_REQUIRED`, status 402)를 던짐.

### 4. `src/server/queries/plan.ts`
```ts
import "server-only";
export async function getViewerPlan(): Promise<ViewerPlan>   // 첫 줄 requireUser() → getPlan(user.id)
```
- 이후 step의 페이지(`/trends`, `/recurring`, `/insights`, `/chat`)가 Free/Pro 화면 분기에 쓴다.

### 5. `handler()`는 바꾸지 않는다 — 결정 사항
- `HandlerOptions`에 `plan` 옵션을 추가하지 않는다. Pro 확인은 **각 action 안에서** `requirePro(userId)`(또는 인사이트의 "Pro 또는 무료 1회")로 한다. 이유: 인사이트처럼 "Pro 또는 크레딧" 조건은 커널 플래그로 표현할 수 없고, 관문을 action 한 곳에 두어야 route 외 호출에서도 빠지지 않는다.
- `src/server/handler.test.ts`에 402 경로 테스트를 추가한다: `fn`이 `requirePro` 실패(`AppError('PRO_REQUIRED')`)를 던지면 응답이 402 + `{ error: { code: 'PRO_REQUIRED', message } }`.
- `src/components/ui/api-fetch.ts`의 `redirectPathForError('PRO_REQUIRED')`가 `/pricing`인지 테스트로 확인한다(없으면 추가).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - admin client를 `src/server/admin.ts` 밖에서 쓰지 않았는가(ESLint 통과)?
   - `entitlements`를 사용자 권한 client로 쓰는 코드가 없는가?
   - 만료 판단이 `period_end + 7일`을 `isProActive` 한 곳에서만 계산하는가?
3. 결과에 따라 `phases/3-pro/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (`getPlan`/`requirePro`/`getViewerPlan`/`adminEntitlements` 이름과 "handler 변경 없음, action에서 requirePro" 결정 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 클라이언트·쿠키·쿼리스트링 값으로 Pro 여부를 판단하지 마라. 이유: 위조 가능하다. 서버의 `getPlan`/`requirePro`만 믿는다(AGENTS.md CRITICAL).
- `markFreeInsightUsed`를 무조건 update로 만들지 마라. 이유: 조건(`free_insight_used_at IS NULL`)이 없으면 동시 요청이 크레딧을 여러 번 쓸 수 있다.
- Polar SDK나 `services/billing`을 import하지 마라. 이유: 결제 연동은 Polar 승인 후 4-billing에서 한다.
- `proxy.ts`나 `(app)/layout.tsx`에서 Pro를 확인하지 마라. 이유: Free도 앱을 쓴다. Pro 판단은 해당 query·action에서만 한다.
- 기존 테스트를 깨뜨리지 마라.
