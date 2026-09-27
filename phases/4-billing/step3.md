# Step 3: account-deletion

> **4-billing 실행 조건**: Polar의 사전 서면 승인 후에만 실행한다(plan.md 11장). 실행 여부는 사람이 결정한다. Polar는 `vi.mock`으로 대체하므로 키가 필요 없다. 업체를 바꾸면 이 step에서 달라지는 것은 `revokeSubscriptions` 구현(`src/services/billing/*`)뿐이다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/USER_FLOWS.md` (④ 탈퇴, 결제 예외) · `/docs/UI_GUIDE.md`
- `/docs/ARCHITECTURE.md` (`server/admin.ts` 함수 목록, API 표의 `/api/account/delete`, DB의 cascade 규칙)
- `/plan.md` 7-3장(결제 예외), 1-1장(동의 철회 = 탈퇴)
- `/src/services/billing/polar.ts` (Step 0: `revokeSubscriptions`)
- `/src/server/admin.ts`와 테스트 (1-ingest `adminStorage.removePrefix`, Step 1 `adminEntitlements`)
- `/src/server/actions/account.ts`와 테스트, `/src/app/api/account/delete-data/route.ts` (2-dashboard `deleteAllData` 패턴)
- `/src/services/supabase/server.ts`, `/src/app/auth/signout/route.ts` (0-foundation 로그아웃)
- `/src/app/(app)/settings/page.tsx`(탈퇴 자리 표시), `/src/components/ui/typed-confirm.tsx`와 테스트, `/src/lib/domain/account.ts` (2-dashboard: `TypedConfirm`, `DELETE_ACCOUNT_PHRASE`), `/src/components/ui/api-fetch.ts`
- `node_modules/@supabase/auth-js`의 타입: `auth.admin.deleteUser(id, shouldSoftDelete?)`, `auth.signOut({ scope })`

## 작업

### 0. 사전 확인
- `/ops/polar-approval-request.md`와 `/plan.md` 11장에 Polar **거절** 기록이 있으면 `blocked`로 두고 중단한다. 사유는 "Polar 승인 거절 — 결제 업체 재선정 필요".
- 기록이 없으면 계속 진행한다.

### 1. `adminAuth` — `src/server/admin.ts`에 추가 (TDD)
```ts
export const adminAuth: { deleteUser(userId: string): Promise<void> };
```
- `admin.auth.admin.deleteUser(userId)`로 **하드 삭제**한다. soft delete 인자는 넘기지 않는다.
- 사용자가 이미 없으면(404, "User not found") 성공으로 본다(멱등). 그 밖의 에러는 code만 로그에 남기고 `AppError('INTERNAL')`을 던진다.
- `admin.test.ts`에 가짜 client로 성공, 404 멱등, 기타 에러를 추가한다.

### 2. `deleteAccount` — `src/server/actions/account.ts`에 추가
```ts
export async function deleteAccount(userId: string): Promise<{ revoked: number }>
```
**순서를 반드시 지킨다.**
1. `revokeSubscriptions(userId)` — 구독이 없는 사용자는 0이다. 실패하면(어떤 에러든) `AppError('BILLING_UNAVAILABLE')`을 던지고 **여기서 멈춘다.** 파일·계정 삭제로 넘어가지 않는다.
2. ``adminStorage.removePrefix(`${userId}/`)`` — 끝에 슬래시가 **반드시** 있어야 한다.
3. `adminAuth.deleteUser(userId)` — 모든 테이블의 `user_id`가 `auth.users` on delete cascade라서 DB 행이 함께 지워진다.
4. 로그아웃 — `createServerSupabase()`의 `auth.signOut({ scope: "local" })`로 세션 쿠키만 지운다. 사용자가 이미 없으므로 여기서 나는 에러는 무시한다.
- 시작할 때 `userId`가 UUID 형식인지 확인한다(경로 prefix 방어).
- 각 단계는 멱등이다: 해지할 구독 없음 → 0, 없는 파일 삭제 → 무시, 없는 사용자 → 성공. 그래서 중간에 실패해도 다시 호출하면 끝까지 간다.
- `logger.info("account.deleted", { revoked })`만 남긴다(이메일·경로 금지).
- 테스트 (`@/services/billing/polar`, `@/server/admin`, `@/services/supabase/server` mock):
  - 호출 순서 배열이 revoke → removePrefix → deleteUser → signOut인지
  - revoke 실패 → `BILLING_UNAVAILABLE`, 나머지 호출 0회
  - Storage 실패 → deleteUser 호출 0회, 에러 전파, 재호출하면 끝까지 완료
  - prefix가 `${userId}/`인지, signOut 에러를 무시하는지

### 3. 라우트 `src/app/api/account/delete/route.ts` (같은 폴더에 `route.test.ts`)
- `export const maxDuration = 60;`
- `POST = handler({ auth: "user", body: z.object({ confirm: z.literal(DELETE_ACCOUNT_PHRASE) }) }, async ({ user }) => { await deleteAccount(user.id); })` → 204
- `consent`를 걸지 않는다. 필수 동의 철회를 탈퇴로 대신하므로 동의가 없어도 탈퇴할 수 있어야 한다.
- 테스트: confirm 불일치 → 400, 다른 Origin → 403, 성공 → 204, `BILLING_UNAVAILABLE` → 503.

### 4. 설정 화면 — 탈퇴 영역
- 새 확인 폼을 만들지 않는다. 2-dashboard의 `src/components/ui/typed-confirm.tsx`(`TypedConfirm`)를 재사용한다.
  - `TypedConfirm`에 선택 prop `errorMessages?: Partial<Record<ErrorCode, string>>`와 `tone?: "default" | "danger"`를 추가한다(기존 테스트 유지 + 케이스 추가). `danger`면 포인트 색이 아닌 Secondary 버튼에 `text-spend-up`.
  - 설정 페이지에서 `phrase={DELETE_ACCOUNT_PHRASE}`(`src/lib/domain/account.ts`), `endpoint="/api/account/delete"`, `redirectTo="/"`, `tone="danger"`로 쓴다.
- 안내 목록(`description` 또는 위쪽 목록으로)
  - "Pro 구독이 있으면 바로 해지돼요. 환불은 [환불 정책](/refund)을 따라요."
  - "올린 원본 파일과 거래·분류·리포트가 모두 지워지고 되돌릴 수 없어요."
  - "결제 기록은 판매 대행자(Merchant of Record)인 Polar가 관련 법령에 따라 보관해요."
- 버튼 라벨은 [탈퇴하기]. `errorMessages={{ BILLING_UNAVAILABLE: "구독 해지에 실패해서 탈퇴를 멈췄어요. 잠시 후 다시 시도해 주세요." }}`. 요청 중에는 버튼을 비활성화한다(`TypedConfirm`에 없으면 추가).
- `src/app/(app)/settings/page.tsx`의 탈퇴 자리 표시를 이것으로 바꾼다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - Auth admin 호출이 `server/admin.ts`의 `adminAuth`로만 일어나는가?
   - 구독 해지 실패 시 파일·계정이 그대로 남는가(테스트로 증명)?
   - 탈퇴가 POST + `handler()` + "탈퇴" 확인으로만 가능한가?
3. 결과에 따라 `phases/4-billing/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 삭제 순서를 바꾸지 마라(계정 먼저 삭제 등). 이유: 세션이 사라져 사용자가 재시도할 수 없는데 구독은 계속 결제된다.
- 구독 해지 실패를 로그만 남기고 넘어가지 마라. 이유: 탈퇴한 사용자에게 결제가 계속 청구된다(plan 7-3장).
- soft delete(`shouldSoftDelete: true`)를 쓰지 마라. 이유: `auth.users` 행이 남아 cascade가 돌지 않고 거래 데이터가 남는다.
- `removePrefix(userId)`처럼 끝 슬래시 없이 부르지 마라. 이유: 같은 문자로 시작하는 다른 사용자의 폴더까지 지워질 수 있다.
- Polar 고객·주문 기록을 지우는 API를 부르지 마라. 이유: MoR인 Polar가 세무 기록으로 보관해야 하고, 실패 지점만 늘어난다.
- 탈퇴를 GET·링크·Server Action으로 만들지 마라. 이유: GET 부작용 금지, 쓰기는 Route Handler만(ADR-001).
- 기존 테스트를 깨뜨리지 마라.
