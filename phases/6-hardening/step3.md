# Step 3: cleanup-paths

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (admin client는 `src/server/admin.ts`에서만, SafeLogger 규칙)
- `/docs/ARCHITECTURE.md` ("업로드 처리"의 `GET /api/cron/cleanup`, "`server/admin.ts`가 export하는 함수")
- `/src/server/admin.ts`와 `/src/server/admin.test.ts` (`safePath`, `storagePathFor`, `cleanupRows`, `adminStorage.listExpiredOriginals`, `adminUploads.listStale`)
- `/src/server/actions/cleanup.ts`와 `/src/server/actions/cleanup.test.ts`
- `/src/server/logger.ts` (SafeLogger: 코드·ID·개수만)
- `/supabase/migrations/20260928000000_upload_path_check.sql` (Step 2: DB가 `storage_path = user_id/id/original`을 강제함)

## 배경

정리 cron(`runCleanup`)은 `uploads.storage_path` 값을 읽어 그대로 Storage 삭제에 넘긴다. 사용자가 이 값을 바꿀 수 있었기 때문에 두 가지 문제가 있었다.

1. 잘못된 경로 하나에서 `safePath`가 예외를 던지면 배치 전체가 실패한다. 그러면 모든 사용자의 원본 삭제가 멈춘다.
2. 다른 사용자의 경로를 넣으면 그 사람의 파일이 지워질 수 있다.

Step 2에서 DB 제약을 추가했다. 이 step에서는 서버도 DB 값을 믿지 않게 만든다(다층 방어).

## 작업

TDD로 진행한다.

### 1. `src/server/admin.ts`

- `adminStorage.listExpiredOriginals(before, limit)`와 `adminUploads.listStale(before, limit)`를 바꾼다.
  - `select("id,storage_path")` 대신 `select("id,user_id")`로 읽는다.
  - 경로는 **`storagePathFor(user_id, id)`로 다시 만든다.** 반환 타입 `{ id: string; storagePath: string }[]`는 유지한다.
- `storagePathFor`가 예외를 던지는 행(UUID가 아닌 id나 user_id)은 결과에서 **빼고** `logger.warn("cleanup.invalid_row", { id })`만 남긴다. 배치 전체를 실패시키지 않는다.
- `cleanupRows` 도우미는 새 입력 형태(`{ id, user_id }`)에 맞게 고치거나 대체한다.
- 테스트(`admin.test.ts`, `@/services/supabase/admin` mock):
  - 두 함수가 `user_id`·`id`로 경로를 만든다. DB에 `storage_path`가 있어도 무시된다.
  - UUID가 아닌 `user_id`가 섞이면 그 행만 빠지고 나머지는 반환된다.
  - `select`에 `storage_path`를 요청하지 않는다.

### 2. `src/server/actions/cleanup.ts`

- 로직은 그대로다(admin 함수가 이미 안전한 행만 돌려준다).
- `cleanup.test.ts`의 fake가 새 반환 형태와 맞는지 확인하고, 필요하면 맞춘다.
- 테스트를 하나 추가한다: `listExpiredOriginals`가 빈 배열이 아닌 일부 행만 돌려줘도 `markOriginalDeleted`는 그 행들의 id로만 호출된다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - admin client를 `src/server/admin.ts` 밖에서 쓰지 않는가(ESLint 통과)?
   - 로그에 경로·파일명·DB 에러 원문을 남기지 않고 `id`만 남기는가?
   - 서버 코드 어디에서도 `uploads.storage_path` 값을 Storage 삭제 경로로 직접 쓰지 않는가? (`grep -rn "storage_path" src/server`로 확인)
3. 결과에 따라 `phases/6-hardening/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `runCleanup`의 배치 크기(200)와 반복 상한(5)을 바꾸지 마라. 이유: Vercel `maxDuration` 60초 안에서 끝나도록 정한 값이다.
- `uploads.storage_path` 컬럼을 지우거나 insert 로직을 바꾸지 마라. 이유: 이 step 범위 밖이고, DB 제약(Step 2)이 형식을 보장한다.
- `runCleanup`의 삭제 순서(파일 삭제 후 상태 갱신)를 바꾸지 마라. 이유: 순서 개선은 별도 LOW 항목으로 남겨 두었다.
- 기존 테스트를 깨뜨리지 마라.
