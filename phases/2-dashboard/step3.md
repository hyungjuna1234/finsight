# Step 3: settings-data

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md` (API 표의 `/api/account/delete-data`·`DELETE /api/uploads/:id`, DB 표, `server/admin.ts` 함수 목록)
- `/docs/ADR.md` (ADR-006 트레이드오프: 겹치는 업로드 삭제 시 공유 거래도 빠짐)
- `/docs/USER_FLOWS.md` (④ 구독·데이터·탈퇴), `/docs/UI_GUIDE.md` (문구, 버튼)
- `/src/server/admin.ts` (1-ingest: `adminStorage.removePrefix` 등), `/src/server/actions/uploads.ts`, `/src/app/api/uploads/[id]/route.ts` (기존 `DELETE`)
- `/src/server/handler.ts`, `/src/server/auth.ts`, `/src/services/supabase/server.ts`, `/src/types/database.ts`
- `/src/components/ui/api-fetch.ts`, `/src/components/ui/app-bar.tsx`, `/src/components/upload/*` (Step 1, 1-ingest)
- `/supabase/migrations/20260926000000_init.sql` (`uploads.counts`·`original_deleted_at`, FK cascade)

## 작업

설정 화면에 업로드 목록·삭제와 전체 데이터 삭제를 만든다. 구독 관리·탈퇴는 **자리만** 둔다(4-billing에서 구현). TDD로 진행한다.

### 1. `src/lib/domain/account.ts`
- `export const DELETE_DATA_PHRASE = '전체 삭제' as const;` `export const DELETE_ACCOUNT_PHRASE = '탈퇴' as const;` (4-billing이 재사용). 간단한 테스트 포함.

### 2. `src/server/queries/settings.ts`
```ts
import "server-only";
export interface UploadListItem {
  id: string; filename: string; status: 'uploaded' | 'awaiting_confirm' | 'done' | 'failed'; createdAt: string;
  periodFrom: IsoDate | null; periodTo: IsoDate | null; inserted: number | null; cardName: string | null; originalDeleted: boolean;
}
export interface CardListItem { id: string; name: string }
export async function getSettings(): Promise<{ uploads: UploadListItem[]; cards: CardListItem[] }>
```
- 첫 줄 `requireUser()`. 동의 확인은 하지 않는다(데이터 삭제는 동의 버전이 바뀐 뒤에도 가능해야 한다).
- RLS client로 `uploads`(최신순, 필요한 컬럼만: `storage_path`·`sha256`·`mapping`은 제외)와 `cards`를 읽는다. `inserted`는 `counts` jsonb에서 안전하게 꺼낸다(형태는 1-ingest confirm 결과를 확인, 없거나 형식이 다르면 `null`). `originalDeleted = original_deleted_at !== null`.
- 테스트: supabase mock으로 매핑·정렬·잘못된 `counts` 처리.

### 3. `src/server/actions/account.ts`
```ts
import "server-only";
export const USER_DATA_TABLES = ['transactions', 'uploads', 'header_mappings', 'category_overrides', 'insights', 'cards'] as const;
export async function deleteAllData(userId: string): Promise<void>
```
- `userId`가 UUID 형식이 아니면 `AppError('INTERNAL')`로 즉시 중단(빈 문자열이면 prefix가 버킷 전체가 된다).
- 순서: ① `adminStorage.removePrefix(`${userId}/`)` — 실패하면 `AppError('INTERNAL')`로 중단(DB는 그대로라 다시 시도 가능). ② RLS client로 `USER_DATA_TABLES` 순서대로 `.delete().eq('user_id', userId)`.
- **남기는 것**: `consents`, `entitlements`, `ai_usage`(권한·결제·일일 상한 기록. 계정 삭제는 4-billing의 탈퇴).
- 두 번 호출해도 결과가 같다(멱등).
- 테스트: `@/server/admin`과 `@/services/supabase/server`를 mock. 호출 순서, 모든 delete에 `user_id` 조건, 남기는 테이블은 건드리지 않음, Storage 실패 시 DB 미변경, 잘못된 userId 거부.

### 4. `src/app/api/account/delete-data/route.ts` (+ `route.test.ts`)
- `POST` = `handler({ auth: 'user', body: z.object({ confirm: z.literal(DELETE_DATA_PHRASE) }) }, …)` → `deleteAllData(user.id)` → 204.
- `confirm`이 다르거나 없으면 400 `VALIDATION_FAILED`(zod가 처리). `consent` 옵션은 켜지 않는다(위 2와 같은 이유).

### 5. 컴포넌트 (각 `.test.tsx`)
- `src/components/ui/typed-confirm.tsx` (client, 재사용): props `{ phrase: string; title: string; description: string; submitLabel: string; endpoint: `/api/${string}`; redirectTo: string }`. 입력값이 `phrase`와 정확히 같을 때만 버튼 활성화 → `apiFetch(endpoint, { method: 'POST', body: { confirm: phrase } })` → 성공 시 `window.location.assign(redirectTo)`. 4-billing의 탈퇴도 이 컴포넌트를 쓴다.
- `src/components/upload/upload-history.tsx` (client): props `{ uploads: UploadListItem[] }`. 행: 파일명, 카드, 기간("2026.07.01 ~ 09.30"), 추가된 건수, 상태, "원본 삭제됨"/"원본 보관 중(90일 후 자동 삭제)". [삭제] → 확인 단계에서 한 줄 안내: **"이 파일로 들어온 거래가 지워져요. 기간이 겹치는 다른 파일에도 있던 거래도 함께 빠질 수 있어요. 그 파일을 다시 올리면 복구돼요."** → `apiFetch(`/api/uploads/${id}`, { method: 'DELETE' })` → 토스트 "삭제했어요" → `router.refresh()`. 빈 목록이면 "올린 파일이 없어요 [업로드]".

### 6. `src/app/(app)/settings/page.tsx`
- `getSettings()` 결과로 섹션을 순서대로 렌더(로직 없음, `space-y-8`):
  1. 구독 관리 — 자리만: "결제 기능이 열리면 여기서 구독을 관리할 수 있어요." (4-billing에서 교체)
  2. 카드 — 이름 목록(읽기 전용)
  3. 업로드 목록 — `UploadHistory`
  4. 데이터 삭제 — 설명 "올린 파일과 거래·분류·리포트를 모두 지워요. 계정과 구독은 그대로예요." + `TypedConfirm`(`phrase=DELETE_DATA_PHRASE`, `endpoint='/api/account/delete-data'`, `redirectTo='/upload'`)
  5. 탈퇴 — 자리만: "탈퇴 기능은 곧 열려요." (4-billing에서 교체)

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - Storage 삭제가 `server/admin.ts`의 함수로만 이뤄지는가(admin client를 다른 곳에서 만들지 않았는가)?
   - `deleteAllData`가 `consents`·`entitlements`·`ai_usage`를 건드리지 않는가?
   - 삭제 API가 `handler()`(Origin 검사 포함)를 거치고 `{confirm:'전체 삭제'}` 외에는 400인가?
3. 결과에 따라 `phases/2-dashboard/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (`TypedConfirm` 재사용 가능 여부, 자리만 둔 섹션 명시)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 새 업로드 삭제 API를 만들지 마라. 이유: 1-ingest의 `DELETE /api/uploads/[id]`가 이미 거래(cascade)와 원본을 지운다. 그대로 호출만 한다.
- 업로드-거래 N:M 링크나 "공유 거래 보존" 로직을 추가하지 마라. 이유: MVP에서 수용한 한계다(ADR-006). 화면 안내 한 줄로 대신한다.
- `auth.users` 삭제·구독 해지·`entitlements` 변경을 하지 마라. 이유: 탈퇴는 4-billing의 account-deletion 범위다.
- 삭제 확인을 `window.confirm` 한 번으로 끝내지 마라. 이유: 되돌릴 수 없는 작업이라 문구 입력 확인이 요구사항이다.
- 로그에 파일명·카드 이름을 남기지 마라(업로드 ID·삭제 건수만). 이유: 파일명·카드 이름에 개인정보가 들어갈 수 있다(SafeLogger는 코드·ID·개수만).
- 기존 테스트를 깨뜨리지 마라.
