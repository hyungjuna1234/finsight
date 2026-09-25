# Step 6: upload-api

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`, `/AGENTS.md`
- `/docs/ARCHITECTURE.md` ("업로드 처리", `server/admin.ts` 목록, API 표의 `/api/uploads*`, DB의 `uploads`·`transactions`·`header_mappings`·`ai_usage`, 일일 상한)
- `/docs/ADR.md` (ADR-001, ADR-003, ADR-004, ADR-006, ADR-009)
- `/src/server/handler.ts`(`handler`, `consent` 옵션), `/src/server/auth.ts`, `/src/server/logger.ts`, `/src/server/env.ts` (0-foundation)
- `/src/services/supabase/server.ts`, `/src/services/supabase/admin.ts`, `/src/types/database.ts`, `/supabase/migrations/*.sql` (0-foundation)
- `/src/lib/domain/upload.ts`, `/src/lib/ingest/sniff.ts`, `/src/lib/ingest/decode.ts` (Step 1)
- `/src/lib/ingest/table.ts`, `/src/lib/ingest/mask.ts`, `/src/lib/ingest/mapping.ts` (Step 2)
- `/src/services/claude/mapper.ts`, `/src/services/claude/models.ts` (Step 3)
- `/src/lib/ingest/parse.ts`, `/src/lib/ingest/identity.ts` (Step 4)
- `/src/server/actions/categorize.ts`, `/src/test/supabase-fake.ts`(있으면) (Step 5)
- `/src/test/fixtures/statements.ts` (Step 0)
- `node_modules/next/dist/docs/`의 Route Handler·`maxDuration` 문서, `node_modules/@supabase/storage-js`의 `createSignedUploadUrl`·`download`·`list`·`remove` 타입

## 작업

TDD로 진행한다. `@/services/*`와 `@/server/admin`은 `vi.mock`으로 대체하고 네트워크를 쓰지 않는다. **모든 userId·경로는 세션(`ctx.user.id`)에서 온 값만 쓴다** — body의 값을 쓰지 않는다.

### 1. `src/server/limits.ts`
```ts
import "server-only";
export const DAILY_LIMITS = { uploads: 30, mapping: 30, insight: 10, chat: 30 } as const;
export type LimitKind = keyof typeof DAILY_LIMITS;
export function kstDayStart(now?: Date): string;                  // `${kstToday(now)}T00:00:00+09:00`
export async function assertDailyLimit(userId: string, kind: LimitKind, now?: Date): Promise<void>;
export async function recordAiUsage(userId: string, feature: AiFeature, usage: ClaudeUsage): Promise<void>;
```
- 오늘(KST 0시 이후) 행 수를 `createServerSupabase()`로 센다(`select("id", { count: "exact", head: true })`): `uploads`는 uploads 테이블, 나머지는 `ai_usage`의 같은 feature. 개수 ≥ 상한이면 `AppError("RATE_LIMITED")`. 조회 실패는 `AppError("INTERNAL")`(상한 검사를 건너뛰지 않는다).
- `recordAiUsage`는 `ai_usage`에 insert. 실패하면 `logger.warn`(코드만)하고 요청은 계속한다.

### 2. `src/server/admin.ts` — admin client를 쓰는 **유일한** 파일 (이 phase에서는 `adminStorage`만)
```ts
import "server-only";
export function storagePathFor(userId: string, uploadId: string): string;   // `${userId}/${uploadId}/original`
export const adminStorage: {
  createUploadUrl(path: string): Promise<string>;          // createSignedUploadUrl(path) — upsert 옵션을 주지 않는다(덮어쓰기 금지) → signedUrl
  read(path: string): Promise<Uint8Array | null>;          // download, 객체가 없으면 null
  remove(paths: string[]): Promise<void>;
  removePrefix(prefix: string): Promise<number>;           // list를 100개씩 반복해 끝까지, 폴더 항목은 재귀, 삭제한 파일 수. prefix는 반드시 `/`로 끝난다
};
```
- 버킷은 `statements`. 모든 경로 인자는 `^<uuid>/`로 시작하고 `..`·앞 `/`가 없어야 한다(아니면 `Error` — 프로그래밍 오류). `removePrefix`의 prefix가 `/`로 끝나지 않으면 `Error`(다른 폴더까지 지우는 사고 방지). `listExpiredOriginals`는 만들지 않는다(5-launch cleanup-cron이 만든다). SDK 에러는 `AppError("INTERNAL")`로 바꾸고 원문을 남기지 않는다.
- 테스트: `vi.mock("@/services/supabase/admin")`. upsert 옵션 미전달, 페이지네이션(250개 → 3번 list), 폴더 재귀, 잘못된 경로·끝 `/` 없는 prefix 거부.

### 3. `src/lib/domain/upload.ts`에 API 타입 추가 (값 import 없이 `import type`만 — 이 파일은 클라이언트 컴포넌트도 import한다)
```ts
export type { ColumnMapping } from "@/lib/ingest/mapping";          // 컴포넌트는 이 경로로만 받는다
export type CardChoice = { id: string } | { name: string };
export interface UploadPreview { sheetName: string; headerRowIndex: number; rows: string[][] }   // 시트 0행 ~ headerRowIndex+5행
export interface CreateUploadResponse { uploadId: string; uploadUrl: string }
export interface AnalyzeResponse { preview: UploadPreview; mapping: ColumnMapping | null; autoConfirm: boolean }
export interface ConfirmResponse { inserted: number; duplicates: number; pending: number; period: { from: IsoDate; to: IsoDate } | null }
export interface RecategorizeResponse { updated: number; pending: number }
```

### 4. `src/server/actions/uploads.ts`
```ts
import "server-only";
export const createUploadBody;    // z.object({ filename: 1~255자, size: 양의 정수, sha256: /^[0-9a-f]{64}$/ }).strict()
export const confirmUploadBody;   // z.object({ mapping: columnMappingSchema, card: {id: z.uuid()} | {name: trim 1~30자} }).strict()
export async function createUpload(userId: string, input: z.infer<typeof createUploadBody>): Promise<CreateUploadResponse>;
export async function analyzeUpload(userId: string, uploadId: string): Promise<AnalyzeResponse>;
export async function confirmUpload(userId: string, uploadId: string, input: z.infer<typeof confirmUploadBody>): Promise<ConfirmResponse>;
export async function recategorizeUpload(userId: string, uploadId: string): Promise<RecategorizeResponse>;
export async function deleteUpload(userId: string, uploadId: string): Promise<void>;
```
DB는 `createServerSupabase()`(RLS)로 읽고 쓰며 모든 쿼리에 `.eq("user_id", userId)`를 붙인다. uploadId가 uuid가 아니거나 행이 없으면 `NOT_FOUND`.
- **create**: `checkUploadFile` → 같은 sha256의 `failed` 아닌 업로드가 `done`이면 `DUPLICATE_FILE`, `uploaded`·`awaiting_confirm`이면(중단된 재시도) `removePrefix("{uid}/{oldId}/")` 후 행 삭제 → `assertDailyLimit("uploads")` → `crypto.randomUUID()`로 id, `storagePathFor`로 경로, `status: "uploaded"` insert(유니크 위반 `23505` → `DUPLICATE_FILE`) → `createUploadUrl`.
- **파일 적재(공통)**: `adminStorage.read(upload.storage_path)`(null → `INVALID_STATE`; 경로가 `${userId}/`로 시작하는지 확인) → 10MB 초과 `FILE_TOO_LARGE` → `node:crypto` sha256이 `uploads.sha256`과 다르면 `CORRUPT_FILE` → `sniffFile` → `decodeFile` → `detectTable`. 파일 에러는 `status: "failed", error_code` 저장 후 `AppError(code)`.
- **analyze** (`done` → `INVALID_STATE`, `failed` → 저장된 `error_code`로 다시 던짐): 파일 적재 → `signature = headerSignature(table.headers)`:
  1. `header_mappings`(사용자별) 적중 → `{ ...cached, headerRowIndex: table.headerRowIndex }`, 출처 `cache`.
  2. 아니면 `awaiting_confirm`이고 `uploads.mapping`이 있으면 재사용(재호출 시 Claude를 다시 부르지 않는다).
  3. 아니면 일일 상한 `mapping` 확인(초과면 Claude 없이 `mapping = null`) → 요약행 뺀 첫 5개 데이터 행을 `maskSamples` → `proposeMapping` → 성공하면 `recordAiUsage(userId, "mapping", usage)`, 실패(모든 예외)면 `mapping = null` + `logger.warn("upload.mapping_unavailable", { code })`.
  - `validateMapping` 실패 매핑은 버린다(캐시 매핑이 실패하면 3번 경로로 간다). `status: "awaiting_confirm"`, `mapping`, `header_signature` 저장.
  - 반환 `{ preview: { sheetName, headerRowIndex, rows: sheetRows.slice(0, headerRowIndex + 6) }, mapping, autoConfirm: 출처가 cache이고 검증 통과 }`.
- **confirm**: `done`이면 저장된 counts·period를 돌려준다(`pending`만 현재 개수로 다시 센다) — **멱등**. `awaiting_confirm`이 아니면 `INVALID_STATE`. 파일 적재(sha256 재확인 포함) → `validateMapping`(실패 `MAPPING_INVALID`, 상태 유지) → `parseRows(table, mapping, kstToday())`(0행 → `NO_DATA`) → 카드: `{id}`는 본인 카드인지 확인(`VALIDATION_FAILED`), `{name}`은 `cards` upsert(onConflict `user_id,name`) → 각 행 `identityKey`.
  - 기존 행 조회: `identity_key in (…)`(100개씩)으로 `identity_key, upload_id, category, category_source`.
  - `transactions` upsert(onConflict `user_id,identity_key`, 500행씩, **전체 컬럼**): 새 행은 `upload_id = 이 업로드`, `category = "기타"`, `category_source = "pending"`. 기존 행은 금액·status·해외 필드·할부·가맹점을 새 값으로 두되 **`category`·`category_source`·`upload_id`는 조회한 기존 값 그대로** 넣는다(사용자 지정 분류 보존). 부분 컬럼 upsert는 NOT NULL 제약에 걸리므로 쓰지 않는다.
  - 분류: 이 업로드의 `category_source = 'pending'` 행의 고유 `merchant_key` → `categorizeTransactions` → (category, source)별로 묶어 `update … where upload_id = 이 업로드 and category_source = 'pending' and merchant_key in (…)`. `usage`마다 `recordAiUsage(userId, "classify", u)`.
  - `header_mappings` upsert(`headerSignature`는 `mapping.headerRowIndex` 기준 헤더로). `inserted` = upsert 후 `upload_id`가 이 업로드인 행 수, `duplicates` = 나머지, `pending` = 남은 pending 수. `status: "done"`, `card_id`, `mapping`, `period_from/to`, `counts: { inserted, duplicates, pending, skipped }` 저장.
- **recategorize**: `done`이 아니면 `INVALID_STATE`. pending 행만 위 분류 절차로 다시 → `{ updated, pending }`, `counts.pending` 갱신. Claude가 필요했는데 실패했으면 반영할 것은 반영한 뒤 `AppError("AI_UNAVAILABLE")`.
- **delete**: 행 확인 → `removePrefix("{uid}/{uploadId}/")` → uploads 행 삭제(거래는 `upload_id` cascade). 저장소를 먼저 지워 고아 파일을 남기지 않는다.
- 테스트(`uploads.test.ts`): `@/server/admin`(read가 fixture 바이트를 돌려줌), `@/services/supabase/server`(인메모리 가짜 — `src/test/supabase-fake.ts`를 필요한 만큼 확장), `@/services/claude/mapper`, `@/services/claude/classifier`를 mock하고 lib는 **실제 구현**을 쓴다. 필수 시나리오: 중복 sha256, 중단된 업로드 재시도, 일일 상한, 암호 fixture → failed + `ENCRYPTED_FILE`, 은행 fixture → `BANK_STATEMENT`, 캐시 적중 → Claude 미호출 + autoConfirm, Claude 실패 → mapping null, 상한 초과 → Claude 미호출, `maskSamples` 결과만 전달(원문 가맹점 없음), 신한 confirm → `inserted = expect.parsed.rows`, confirm 재호출 동일 결과, `hyundaiForeignPair` 순서 업로드 → 두 번째는 duplicates 3 · 해외 금액 17,812 · status posted, `category_source = "user"` 행 보존, 분류 실패 → pending + recategorize.

### 5. Route Handler (각 폴더에 `route.test.ts` — actions를 부분 mock해 배선만 검증)
| 파일 | export | 옵션 |
|---|---|---|
| `src/app/api/uploads/route.ts` | `POST` → `createUpload` | `handler({ auth: "user", consent: true, body: createUploadBody })` |
| `src/app/api/uploads/[id]/analyze/route.ts` | `POST` → `analyzeUpload`, `maxDuration = 60` | `{ auth: "user", consent: true }` |
| `src/app/api/uploads/[id]/confirm/route.ts` | `POST` → `confirmUpload`, `maxDuration = 120` | `{ auth: "user", consent: true, body: confirmUploadBody }` |
| `src/app/api/uploads/[id]/recategorize/route.ts` | `POST` → `recategorizeUpload`, `maxDuration = 120` | `{ auth: "user", consent: true }` |
| `src/app/api/uploads/[id]/route.ts` | `DELETE` → `deleteUpload` (204) | `{ auth: "user" }` — ARCHITECTURE 표대로 동의 없이도 자기 데이터 삭제 가능 |
- 테스트: 세션 user.id와 `params.id`로 action이 불리는지, body에 `userId`를 넣으면 400(`.strict()`), 잘못된 sha256 400, `maxDuration` 값.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `@/services/supabase/admin` import가 `src/server/admin.ts`에만 있는가? (ESLint 통과로 확인)
   - Claude 호출 전에 동의(`consent: true`)와 일일 상한을 확인하고 호출 후 `ai_usage`에 기록하는가?
   - 로그에 파일 내용·가맹점·금액·DB 에러 상세가 없는가? 모든 경로·userId가 세션에서 오는가?
3. 결과에 따라 `phases/1-ingest/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (만든 모듈·route·주요 export 이름을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단 (Storage·Claude는 mock이므로 키 없이 완료할 수 있다)

## 금지사항

- 요청 body의 userId·경로·storage_path를 admin 함수에 넘기지 마라. 이유: admin은 RLS를 우회하므로 남의 파일을 읽거나 지울 수 있다.
- signed URL을 `upsert: true`로 만들지 마라. 이유: 기존 원본을 덮어써 sha256 검증과 중복 방지가 무력화된다.
- upsert에서 기존 행의 `category`·`category_source`를 새 값으로 덮어쓰지 마라. 이유: 사용자가 고친 분류가 재업로드 때 사라진다.
- 업로드 처리를 `after()`·백그라운드 큐·cron으로 넘기지 마라. 이유: ADR-003 — 한 요청 안에서 동기로 끝낸다.
- DB·SDK 에러 원문, 파일 내용, 프롬프트를 로그·응답에 넣지 마라. 이유: CLAUDE.md CRITICAL(SafeLogger는 코드·ID·개수만).
- Server Action을 만들지 마라. 이유: 쓰기는 Route Handler + `handler()`만(ADR-001).
- 기존 테스트를 깨뜨리지 마라.
