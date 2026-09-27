# Step 3: cleanup-cron

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md` (업로드 처리의 cron 줄, `server/admin.ts` 함수 목록, API 표의 `/api/cron/cleanup`, `uploads` 테이블)
- `/plan.md` 2장(원본 90일 보관), 3-3장(업로드 흐름)
- `/src/server/admin.ts`와 테스트 (1-ingest `adminStorage.remove`·`removePrefix`, 경로 검증 규칙)
- `/src/server/handler.ts`와 테스트 (`auth: "cron"` — `Authorization: Bearer <CRON_SECRET>` timing-safe 비교)
- `/src/server/logger.ts`, `/src/server/env.ts` (`cronSecret`)
- `/supabase/migrations/*_init.sql` (`uploads.status`, `original_deleted_at`, `created_at`, `storage_path`)
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (GET 핸들러 캐시·정적 처리)

## 작업

매일 한 번 도는 정리 작업을 만든다. 원본 파일은 90일 뒤에 지우고, 업로드만 하고 버려진 행(24시간 넘게 `uploaded`)은 파일과 함께 지운다. TDD로 진행한다.

### 1. `src/server/admin.ts` 확장 (좁은 함수만, `admin.test.ts`에 테스트 추가)
```ts
// adminStorage (1-ingest)에 추가
listExpiredOriginals(before: Date, limit: number): Promise<{ id: string; storagePath: string }[]>;  // created_at < before AND original_deleted_at IS NULL
// 새 export
export const adminUploads: {
  markOriginalDeleted(ids: string[], at: Date): Promise<number>;   // original_deleted_at IS NULL인 행만 갱신
  listStale(before: Date, limit: number): Promise<{ id: string; storagePath: string }[]>;  // status='uploaded' AND created_at < before
  deleteStale(ids: string[], before: Date): Promise<number>;       // id IN ids AND status='uploaded' AND created_at < before 인 행만 삭제
};
```
- `docs/ARCHITECTURE.md`의 `server/admin.ts` 함수 목록에 이미 반영돼 있다. 구현이 달라지면 문서도 맞춘다.
- `deleteStale`은 **삭제 순간에도** `status='uploaded'`와 `created_at < before` 조건을 다시 건다. 목록을 읽은 뒤 사용자가 analyze를 시작한 행은 지우지 않는다.
- 에러는 code만 로그에 남기고 `AppError('INTERNAL')`을 던진다.

### 2. `src/server/actions/cleanup.ts`
```ts
import "server-only";
export interface CleanupResult { originals: number; staleUploads: number }
export async function runCleanup(now: Date): Promise<CleanupResult>
```
- `expireBefore = now − 90일`(90 × 24시간), `staleBefore = now − 24시간`. 시각은 인자 `now`로만 받는다(테스트에서 가짜 시계).
- ① 원본 만료
  1. `listExpiredOriginals(expireBefore, 200)`으로 목록을 읽는다.
  2. `adminStorage.remove(paths)`로 파일을 지운다.
  3. `markOriginalDeleted(ids, now)`를 한다.
  - 배치가 비거나 5회를 돌 때까지 반복한다(한 번에 최대 1,000개, 남은 것은 다음 날).
  - **파일을 먼저 지우고 나중에 표시한다.** 중간에 실패해도 다음 실행이 다시 지우고(없는 파일은 무시) 표시한다.
- ② 버려진 업로드
  1. `listStale(staleBefore, 200)`으로 목록을 읽는다.
  2. `adminStorage.remove(paths)`로 파일을 지운다.
  3. `deleteStale(ids, staleBefore)`를 한다.
  - 같은 반복 규칙을 쓴다.
- `awaiting_confirm`·`done`·`failed` 행은 ②에서 건드리지 않는다. 거래 데이터는 이 작업에서 지우지 않는다(원본 파일만).
- 멱등: 같은 `now`로 두 번 돌리면 두 번째 결과는 `{ originals: 0, staleUploads: 0 }`이다.
- `logger.info("cleanup.done", { originals, staleUploads })`. 경로·사용자 ID 목록은 로그에 남기지 않는다.

### 3. 라우트 `src/app/api/cron/cleanup/route.ts` (같은 폴더에 `route.test.ts`)
- `export const maxDuration = 60;`
- ``export const GET = handler({ auth: "cron" }, async () => ({ removed: await runCleanup(new Date()) }));``
- **GET 부작용 금지 원칙의 유일한 예외**다. Vercel Cron이 GET만 보내기 때문이다. `CRON_SECRET` Bearer 검사로 보호한다. 파일 위에 이 이유를 주석으로 남긴다.
- 빌드할 때 이 GET이 정적으로 실행·캐시되지 않는지 Next 16 문서로 확인한다. 필요하면 문서가 권하는 방식으로 동적 처리를 명시한다.
- Vercel은 `CRON_SECRET` env가 있으면 `Authorization: Bearer <값>`을 자동으로 붙인다. 스케줄(`vercel.json`)은 deploy-config step에서 넣는다.

### 4. 테스트 (가짜 시계, 네트워크 없음)
- `cleanup.test.ts`: `@/server/admin`을 메모리 가짜(업로드 행 배열 + 파일 집합)로 mock한다.
  - 89일 전 원본은 유지, 91일 전 원본은 삭제 + `original_deleted_at` 기록
  - 23시간 전 `uploaded`는 유지, 25시간 전 `uploaded`는 행·파일 삭제, 25시간 전 `awaiting_confirm`은 유지
  - 두 번째 실행 결과가 0
  - 파일 삭제가 실패하면 표시·행 삭제를 하지 않음
  - 배치 반복 상한
- `route.test.ts`
  - Authorization 없음·틀린 비밀 → 401, `runCleanup` 호출 0회
  - 맞는 비밀 → 200 `{ removed: { originals, staleUploads } }`
  - `vi.mock("@/server/actions/cleanup")`, `vi.stubEnv`로 비밀값 설정

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - admin client 사용이 `server/admin.ts`의 좁은 함수로만 일어나는가?
   - cron GET이 Bearer 비밀 없이는 아무것도 하지 않는가(401)?
   - 거래 데이터를 지우는 코드가 없는가(원본 파일과 버려진 업로드 행만)?
3. 결과에 따라 `phases/5-launch/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 표시(`original_deleted_at`)를 먼저 하고 파일을 나중에 지우지 마라. 이유: 파일 삭제가 실패하면 표시만 남아 원본이 영원히 남는다.
- `deleteStale`에서 상태·시각 조건을 빼고 id만으로 지우지 마라. 이유: 목록을 읽은 뒤 사용자가 진행한 업로드를 지울 수 있다.
- `admin.ts`에 범용 함수(임의 테이블·조건 삭제)를 만들지 마라. 이유: admin 권한 범위를 좁게 유지한다(ARCHITECTURE).
- 정리 작업을 다른 GET 라우트나 페이지 렌더링에서 실행하지 마라. 이유: GET 부작용 금지, cron만 예외다.
- 테스트에서 실제 `Date.now()`에 기대지 마라. 이유: 경계값(90일·24시간) 테스트가 흔들린다.
- 기존 테스트를 깨뜨리지 마라.
