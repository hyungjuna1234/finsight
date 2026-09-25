# Step 1: db-schema

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (데이터베이스 표, 일일 상한, Storage)
- `/docs/ADR.md` (ADR-002, ADR-006, ADR-010)
- `/src/lib/domain/categories.ts`, `/src/lib/domain/types.ts` (Step 0 산출물)
- `/vitest.config.mts` (`supabase/**/*.test.ts`는 node 환경에서 돈다)
- `node_modules/@electric-sql/pglite/README.md` (PGlite API)

## 작업

### 1. 먼저 PGlite에서 RLS가 실제로 적용되는지 증명한다
`supabase/tests/pglite-rls.test.ts`를 **가장 먼저** 작성한다.
- `new PGlite()`로 메모리 DB를 만들고, 역할 `anon`, `authenticated`(NOLOGIN), 스키마 `auth`, 함수 `auth.uid()`(아래 stub), RLS를 켠 임시 테이블과 `(select auth.uid()) = user_id` 정책을 만든다.
- `SET ROLE authenticated` + `select set_config('request.jwt.claim.sub', '<uuid>', false)` 상태에서 **본인 행만 보이고 남의 행은 0건**인지 검증한다.
- 이 테스트가 통과하지 않으면(기본 superuser가 RLS를 우회하는 것 외의 이유로) 이 step을 `blocked`로 두고 `blocked_reason`에 "PGlite에서 RLS가 적용되지 않음 — 사람이 supabase start로 통합 테스트 필요"라고 적고 중단한다.

### 2. 테스트용 stub: `supabase/tests/stubs.sql`
Supabase에만 있는 객체를 흉내 낸다. 실제 마이그레이션에는 넣지 않는다.
- 역할 `anon`, `authenticated`, `service_role`(service_role은 `BYPASSRLS`)
- `auth.users(id uuid primary key, email text)`
- `create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`
- `storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint)`

### 3. 마이그레이션: `supabase/migrations/20260926000000_init.sql`
ARCHITECTURE.md의 9개 테이블을 그대로 만든다: `consents`, `entitlements`, `cards`, `uploads`, `transactions`, `header_mappings`, `category_overrides`, `insights`, `ai_usage`.
- 모든 `user_id`는 `uuid not null references auth.users(id) on delete cascade`.
- CHECK 제약: `consents.kind`, `entitlements.plan`, `uploads.status`, `transactions.kind`, `transactions.status`, `transactions.category_source`, `transactions.category`(`CATEGORIES` 15개와 **같은 목록**), `ai_usage.feature`, `transactions.amount_krw >= 0`.
- 유니크·인덱스: `cards(user_id, name)`, `uploads` 부분 유니크 `(user_id, sha256) where status <> 'failed'`, `transactions(user_id, identity_key)` 유니크, `transactions(user_id, occurred_on)`, `insights(user_id, month)` 유니크, `ai_usage(user_id, feature, created_at)`.
- `transactions.upload_id references uploads(id) on delete cascade`, `transactions.card_id references cards(id) on delete set null`.
- **모든 테이블 `enable row level security`.** 정책은 `to authenticated` + `(select auth.uid()) = user_id`.
- 권한:
  - `revoke all on all tables in schema public from anon, authenticated;` 그리고 `alter default privileges in schema public revoke all on tables from anon;`
  - `authenticated`에 필요한 것만 grant: `consents`(select, insert), `entitlements`(select), `cards`·`uploads`·`transactions`·`header_mappings`·`category_overrides`·`insights`(select, insert, update, delete), `ai_usage`(select, insert).
  - 정책도 같은 범위로만 만든다(예: `entitlements`는 select 정책만).
- Storage 버킷: `insert into storage.buckets (id, name, public, file_size_limit) values ('statements', 'statements', false, 10485760) on conflict (id) do nothing;` — **storage.objects 정책은 만들지 않는다**(사용자 정책 없음, 서버가 admin으로만 접근).

### 4. 타입: `src/types/database.ts`
Supabase `Database` 타입 형태(`public.Tables.<name>.Row/Insert/Update`)로 9개 테이블을 손으로 작성한다. 나중에 사람이 `supabase gen types`로 교체한다. 컬럼 이름은 snake_case 그대로.

### 5. 테스트: `supabase/tests/rls.test.ts`
공용 헬퍼(`supabase/tests/db.ts` — 새 PGlite에 `stubs.sql` → 마이그레이션 순서로 적용, `asUser(db, uid)`, `asAnon(db)`, `asService(db)` 제공)를 만들고 다음을 검증한다:
- 정적: `public` 스키마의 모든 테이블이 `relrowsecurity = true`.
- 사용자 A가 넣은 `cards`/`uploads`/`transactions`/`insights`를 사용자 B가 select하면 0건, update/delete하면 0행.
- B가 `user_id = A`로 insert하면 실패.
- authenticated가 `entitlements`에 insert/update하면 실패(권한 오류). select는 본인 행만.
- authenticated가 `ai_usage`를 delete/update하면 실패. insert·select는 본인만.
- `consents`는 update/delete 불가.
- anon은 모든 테이블 select가 실패하거나 0건.
- `transactions.category` CHECK가 `CATEGORIES` 밖의 값을 거부.
- `supabase/tests/categories-sync.test.ts`: 마이그레이션 파일의 category CHECK 목록을 파싱해 `CATEGORIES`와 정확히 같은지 검증(목록 불일치 방지).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test    # supabase/tests/* 포함 전부 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 9개 테이블 모두 RLS가 켜져 있고, `anon` 권한이 없는가?
   - `entitlements`에 사용자 쓰기 권한·정책이 없는가?
   - storage.objects에 사용자 정책이 없는가?
3. 결과에 따라 `phases/0-foundation/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (마이그레이션 파일명, 테스트 헬퍼 경로 포함)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(PGlite RLS 미지원 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `supabase` CLI를 실행하지 마라(`supabase start`, `db push` 등). 이유: 이 복사본은 운영 자격증명이 없고 hook이 차단한다. 마이그레이션 적용은 사람이 ops 복사본에서 한다.
- stub 객체(`auth.users`, `auth.uid()`, 역할)를 마이그레이션 파일에 넣지 마라. 이유: 실제 Supabase에는 이미 있어서 마이그레이션이 실패한다.
- RLS 우회 함수(`security definer`)를 만들지 마라. 이유: MVP는 RLS + admin 분리로 충분하고, 잘못 만들면 격리가 깨진다.
- 테스트를 superuser(기본 `postgres`) 역할로 돌려 RLS를 검증했다고 하지 마라. 이유: superuser는 RLS를 우회하므로 검증이 무의미하다.
- 기존 테스트를 깨뜨리지 마라.
