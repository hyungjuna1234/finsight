# Step 2: upload-path-check

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (CRITICAL: 모든 테이블에 RLS, `supabase` CLI 사용 금지)
- `/docs/ARCHITECTURE.md` ("데이터베이스" 절: `uploads` 컬럼, Storage 경로 `{uid}/{uploadId}/original`)
- `/supabase/migrations/20260926000000_init.sql` (`uploads` 테이블과 권한·정책)
- `/supabase/tests/db.ts` (PGlite 테스트 DB 생성), `/supabase/tests/rls.test.ts`, `/supabase/tests/pglite-rls.test.ts`, `/supabase/tests/stubs.sql`
- `/src/server/admin.ts` (`storagePathFor(userId, uploadId)` = `${userId}/${uploadId}/original`)
- `/src/server/actions/uploads.ts` (`createUpload`가 `id`와 `storage_path`를 insert함)

## 배경

`authenticated` 역할은 `uploads`에 INSERT·UPDATE 권한이 있고, RLS는 `user_id`만 확인한다. 공개 anon key와 자기 세션 토큰이 있으면 사용자는 PostgREST로 자기 행의 `storage_path`를 아무 값으로나 바꿀 수 있다. 정리 cron은 이 값을 그대로 믿는다. 그래서 잘못된 값 하나가 모든 사용자의 90일 원본 삭제를 멈출 수 있다.

cron 쪽 수정은 다음 step에서 한다. 이 step은 DB가 형식을 강제하게 만든다.

## 작업

TDD로 진행한다. 먼저 테스트를 추가해 실패를 확인한 뒤 migration을 만든다.

### 1. 새 migration — `supabase/migrations/20260928000000_upload_path_check.sql`

```sql
alter table public.uploads
  add constraint uploads_storage_path_matches_owner
  check (storage_path = user_id::text || '/' || id::text || '/original');
```
- 기존 `20260926000000_init.sql`은 수정하지 마라(아래 금지사항 참고).
- 운영 DB에는 아직 행이 없다. 그러므로 `not valid`를 쓰지 않고 바로 검증되는 제약으로 둔다.

### 2. `supabase/tests/db.ts` — 모든 migration을 순서대로 적용

- 지금은 `20260926000000_init.sql` 하나만 읽는다. `../migrations/` 안의 `*.sql`을 **파일명 오름차순**으로 모두 읽어 차례로 `exec`하도록 바꾼다.
- `createTestDb()` 시그니처는 유지한다.

### 3. 테스트 — `supabase/tests/rls.test.ts`

- 기존 테스트는 uploads를 `storage_path = 'a/original'`로 insert한다(39행, 93행 부근). 새 제약을 만족하도록 고친다: `id`를 명시적으로 넣고 경로를 `user_id/id/original`로 맞춘다. 예: `insert into uploads (id, user_id, ..., storage_path, ...) values ($3, $1, ..., $1 || '/' || $3 || '/original', ...)`. 테스트의 **검증 의도는 바꾸지 않는다.**
- 새 테스트(사용자 A 세션, `asUser`):
  - 올바른 경로로 insert하면 성공한다.
  - `storage_path = 'x'`로 insert하면 실패한다(check violation, SQLSTATE `23514`).
  - 자기 행의 `storage_path`를 다른 값으로 update하면 실패한다(`23514`).
  - 자기 행의 `storage_path`를 사용자 B의 경로 형식(`B/…/original`)으로 update하면 실패한다(`23514`).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 새 파일이 `supabase/migrations/`에 있고, 기존 migration 파일은 바뀌지 않았는가(`git diff --stat -- ./supabase/migrations/20260926000000_init.sql`에 출력이 없어야 한다)?
   - PGlite 테스트가 두 migration을 모두 적용하는가?
3. 결과에 따라 `phases/6-hardening/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (migration 파일명과 제약 이름을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `20260926000000_init.sql`을 수정하지 마라. 이유: 적용된 migration을 고치면 운영 DB와 이력이 어긋난다. 변경은 새 migration으로만 한다.
- `supabase`·`psql` CLI를 실행하지 마라. 이유: 이 작업 복사본에서는 금지다(`ops/README.md`). 검증은 PGlite 테스트로 한다.
- `uploads`의 권한(GRANT)이나 RLS 정책을 바꾸지 마라. 이유: 앱이 사용자 권한 client로 여러 컬럼을 update하므로, 컬럼 단위 권한은 이 step 범위 밖이고 회귀 위험이 크다. 이번에는 check 제약만 추가한다.
- `src/**` 코드를 바꾸지 마라. 이유: cron 수정은 다음 step 범위다.
- 기존 테스트를 깨뜨리지 마라(위에서 말한 insert 경로 수정은 허용).
