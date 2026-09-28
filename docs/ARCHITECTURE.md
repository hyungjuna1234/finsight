# 아키텍처

## 구성
```
 Browser (Supabase client 없음 · httpOnly 세션 쿠키)
   │ 페이지(RSC)            │ fetch JSON (쓰기·AI)           │ PUT 파일 (signed URL)
   ▼                        ▼                                ▼
 ┌─────────────── Vercel icn1 · Next.js 16 ───────────────┐   ┌───────────────────────┐
 │ src/proxy.ts  세션 갱신 · 비로그인 → /login              │   │ Supabase (Seoul)       │
 │ page.tsx ─▶ server/queries (requireUser) ──────────────┼──▶│ Auth · Postgres(RLS)  │
 │ api/**/route.ts ─▶ handler() ─▶ server/actions ────────┼──▶│ Storage(사용자 정책 없음)│
 │ lib/** 순수 함수 (파싱·집계·판정)                          │   └───────────────────────┘
 │ services/** SDK 래퍼 (supabase · claude · billing) ─────┼──▶ Claude · Polar (US)
 └──────────────────────────────▲─────────────────────────┘
        Polar webhook ──────────┤ POST /api/webhooks/polar
        Vercel Cron(매일, UTC) ──┘ GET /api/cron/cleanup
```

## 레이어와 의존 방향 (ESLint `no-restricted-imports`로 강제)
```
app/** ──▶ server/** ──▶ lib/**
   │          └───────▶ services/**      server/admin.ts ──▶ services/supabase/admin.ts (유일한 importer)
   └──▶ components/** ──▶ lib/domain/** (타입·포맷터만)
```
- `lib/**`: 순수 함수. next·react·supabase·server·services·components import 금지. 단위 테스트 1순위.
- `components/**`: 표시할 데이터는 props로만 받는다(조회 금지). 그래서 `/demo`가 같은 컴포넌트를 정적 데이터로 재사용한다. 클라이언트 컴포넌트가 쓰기·폴링·AI 호출을 할 때는 `components/ui/api-fetch.ts`의 `apiFetch`로 우리 `/api/*`만 부른다.
- `server/**`, `services/**`: 첫 줄 `import "server-only";`.
- `server/admin.ts`: admin(service role) client를 쓰는 **유일한 파일**. 좁은 함수만 export한다(아래 목록).
- 브라우저용 Supabase client는 만들지 않는다. 로그인은 서버 라우트에서 시작하고, 업로드는 `fetch(PUT)`로 signed URL에 보낸다.

## 디렉토리
```
src/
├─ proxy.ts                       세션 갱신 + 비로그인 리다이렉트 (Next 16: middleware.ts 아님)
├─ app/
│  ├─ (marketing)/ page.tsx(랜딩) · demo/ · pricing/ · guide/ · privacy/ · terms/ · refund/
│  ├─ (auth)/ login/ · onboarding/consent/
│  ├─ auth/login/route.ts · auth/callback/route.ts · auth/signout/route.ts
│  ├─ (app)/ layout.tsx · dashboard/ · transactions/ · upload/ · upload/[id]/ · trends/ · recurring/ · insights/ · chat/ · settings/ · billing/success/
│  └─ api/ consents/ · uploads/ · uploads/[id]/{analyze,confirm,recategorize}/ · transactions/[id]/ · insights/ · chat/
│          billing/{checkout,portal,confirm}/ · webhooks/polar/ · cron/cleanup/ · account/{delete-data,delete}/
├─ components/ ui/(api-fetch.ts 포함) · dashboard/ · upload/ · pro/ · chat/ · marketing/
├─ lib/
│  ├─ domain/    categories.ts · money.ts · month.ts · errors.ts · result.ts · redirect.ts · types.ts
│  ├─ ingest/    sniff.ts · decode.ts · table.ts · mask.ts · mapping.ts · parse.ts · identity.ts · merchant.ts · rules.ts
│  ├─ analytics/ month.ts · compare.ts · recurring.ts · plan.ts
│  └─ demo/      fixtures.ts
├─ server/
│  ├─ env.ts · logger.ts · handler.ts · auth.ts · limits.ts · admin.ts
│  ├─ actions/   consents.ts · uploads.ts · transactions.ts · insights.ts · chat.ts · billing.ts · account.ts · cleanup.ts
│  └─ queries/   dashboard.ts · transactions.ts · trends.ts · recurring.ts · settings.ts · uploads.ts
├─ services/
│  ├─ supabase/  server.ts(createServerSupabase) · admin.ts(createAdminSupabase)
│  ├─ claude/    client.ts · models.ts · mapper.ts · classifier.ts · insight.ts · chat.ts
│  └─ billing/   polar.ts
├─ types/        database.ts (손으로 작성 → 나중에 `supabase gen types`로 교체)
└─ test/         empty.ts(server-only 대체) · 공용 테스트 헬퍼
supabase/ migrations/*.sql · tests/*.test.ts (PGlite)
```
- 위 목록은 주요 파일만 적었다. `phases/*/step*.md`가 지정한 새 파일(예: `lib/domain/upload.ts`, `server/tx-rows.ts`, `components/billing/`)은 레이어 규칙 안에서 만들어도 된다.

## 도메인 타입 (`src/lib/domain`)
```ts
export const CATEGORIES = ['식비','카페·간식','마트·편의점','교통','자동차','쇼핑','주거·통신','의료·건강','교육',
  '문화·여가','여행·숙박','구독·디지털','보험·금융','경조사·선물','기타'] as const;
export type Category = (typeof CATEGORIES)[number];
export type TxKind = 'spend' | 'refund';
export type TxStatus = 'posted' | 'pending' | 'cancelled';           // pending: 해외 매입 전 추정 금액
export type CategorySource = 'user' | 'history' | 'rule' | 'ai' | 'pending';
export type KRW = number & { readonly __brand: 'KRW' };               // 정수, 항상 0 이상. 방향은 kind로 표현
export type YearMonth = string & { readonly __brand: 'YearMonth' };   // 'YYYY-MM' (KST)
export type IsoDate = string & { readonly __brand: 'IsoDate' };       // 'YYYY-MM-DD' (KST)
export type Plan = 'free' | 'pro';
export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };
```

## 핵심 순수 함수 (시그니처 — 구현은 각 step)
```ts
// ingest
sniffFile(bytes: Uint8Array, filename: string): Result<Sniff, 'UNSUPPORTED_FORMAT'|'ENCRYPTED_FILE'|'EMPTY_FILE'>
decodeFile(bytes: Uint8Array, sniff: Sniff): Result<Sheet[], 'ENCODING_ERROR'|'CORRUPT_FILE'|'TOO_MANY_ROWS'|'FILE_TOO_COMPLEX'|'ENCRYPTED_FILE'>
detectTable(sheets: Sheet[]): Result<TableGuess, 'HEADER_NOT_FOUND'|'BILLING_STATEMENT'|'BANK_STATEMENT'>
maskSamples(headers: string[], rows: string[][]): { headers: string[]; samples: string[][] }
headerSignature(headers: string[]): string
validateMapping(mapping: ColumnMapping, table: TableGuess): Result<ColumnMapping, 'MAPPING_INVALID'>
parseRows(table: TableGuess, mapping: ColumnMapping, today: IsoDate): ParseResult
identityKey(i: { userId; cardId; approvalNo?; occurredOn; kind; merchantKey; amountKrw; occurrence }): string
normalizeMerchant(raw: string): string
categorizeByRule(merchantKey: string): Category | null
// analytics
summarizeMonth(txs: TxView[], month: YearMonth): MonthSummary
compareMonths(current: MonthSummary, previous: MonthSummary): MonthDelta
monthlyTrend(txs: TxView[], months: YearMonth[]): TrendPoint[]
detectRecurring(txs: TxView[], asOf: IsoDate): RecurringItem[]
derivePlan(state: CustomerState | null, now: Date, proProductId: string): { plan: Plan; status: string; periodEnd: Date | null }  // lib은 env를 못 읽으므로 상품 ID를 인자로
isProActive(ent: { plan: Plan; periodEnd: Date | null } | null, now: Date): boolean   // period_end + 7일
// domain
formatKRW(amount: KRW): string · toYearMonth(date: Date | IsoDate): YearMonth · safeRedirect(target: string | null, fallback?: string): string
```
- 파일 제한: 10MB, 행 10,000(SheetJS `sheetRows: 10001`), 시트 20, 셀 500자에서 자름. 셀은 NFC 정규화.
- 인코딩: BOM(UTF-8/UTF-16LE/BE) → UTF-8(fatal) → `iconv-lite` cp949. `TextDecoder('euc-kr')`는 CP949 확장 한글을 깨뜨리므로 쓰지 않는다.
- 마스킹: 구분자(`-`·공백·`*`·`.`)가 섞여도 숫자가 7개 이상인 연속 토큰은 `#`으로, 텍스트 셀은 `첫 글자***(N자)`로. 저장하는 가맹점명에도 숫자 마스킹을 적용한다. 카드번호 열은 끝 4자리만 남긴다.
- `identityKey`: 승인번호가 있으면 `hash(userId, cardId, approvalNo, occurredOn, kind)`(금액 제외 → 추정 금액이 확정 금액으로 갱신됨). 없으면 `hash(userId, cardId, occurredOn, merchantKey, amountKrw, kind, occurrence)` — occurrence는 같은 파일 안 같은 키의 순번.

## 업로드 처리 (동기)
```
POST /api/uploads {filename,size,sha256}
  → 같은 사용자·sha256의 done 업로드가 있으면 DUPLICATE_FILE
  → uploads(status=uploaded) 생성, adminStorage.createUploadUrl('{uid}/{uploadId}/original') (upsert 금지)
브라우저: fetch PUT
POST /api/uploads/:id/analyze   (maxDuration 60)
  → adminStorage.read → sniff → decode → detectTable
  → header_mappings(사용자별) 적중? 아니면 claude.proposeMapping(마스킹 샘플). Claude 장애면 mapping=null
  → validateMapping(샘플 파싱률 95% 이상) → status=awaiting_confirm → {preview, mapping, autoConfirm}
POST /api/uploads/:id/confirm {mapping, card}   (maxDuration 120)
  → sha256 재확인 → parseRows → transactions upsert(onConflict user_id,identity_key)
  → header_mappings 저장 → 분류: override → 같은 가맹점 이전 거래 → categorizeByRule → claude.classify(100개씩)
  → Claude 실패분과 분류 상한을 넘은 가맹점은 category='기타', category_source='pending' → status=done → {inserted, duplicates, pending, period}
POST /api/uploads/:id/recategorize → pending만 다시 분류
DELETE /api/uploads/:id → 이 업로드의 거래(upload_id cascade)와 원본 삭제
GET /api/cron/cleanup (매일) → 90일 지난 원본 삭제(original_deleted_at 기록), 24시간 넘은 uploaded 상태 업로드·파일 삭제
```
재호출해도 결과가 같다(upsert). 여러 파일은 클라이언트가 하나씩 차례로 보낸다.

## Pro 권한
```
checkout: 서버가 external_customer_id=userId, successUrl=/billing/success?checkout_id={CHECKOUT_ID}, customer_ip_address 설정
POST /api/billing/confirm {checkoutId} → 본인 checkout 확인 → syncEntitlement(userId)
POST /api/webhooks/polar → 서명 검증(실패 403) → external_id 없음/모르는 사용자: 로그 후 200 → syncEntitlement → 200 (실패 500 → Polar 재시도)
syncEntitlement: started=now → Polar Customer State → derivePlan → adminEntitlements.upsertIfNewer(userId, r, started)
                 (synced_at IS NULL OR synced_at < started 일 때만 갱신)
requirePro: isProActive(entitlement, now) — plan='pro' AND (period_end IS NULL OR period_end + 7일 > now)
```

## `server/admin.ts`가 export하는 함수 (admin 권한은 여기서만)
- `adminStorage` (1-ingest): `createUploadUrl(path)`, `read(path)`, `remove(paths)`, `removePrefix(prefix)`(prefix는 `/`로 끝남, 목록을 페이지 단위로 끝까지) · 5-launch: `listExpiredOriginals(before, limit)`
- `adminEntitlements` (3-pro): `get(userId)`, `markFreeInsightUsed(userId)`(조건부 update) · 4-billing: `upsertIfNewer(userId, value, startedAt)`
- `adminAuth` (4-billing): `deleteUser(userId)`
- `adminUploads` (5-launch cron): `markOriginalDeleted(ids, at)`, `listStale(before, limit)`, `deleteStale(ids, before)`
모든 함수는 `userId`나 경로를 인자로 받고, 요청 body가 아니라 세션에서 온 값만 넘긴다.

## 외부 서비스 래퍼 (`services/*`, 테스트는 `vi.mock`)
```ts
claude.proposeMapping({ headers, samples }) → { mapping: MappingColumns; confidence; usage }   // haiku, 20s (headerRowIndex는 호출자가 채움)
claude.classify(merchantKeys: string[]) → { categories: Map<string, Category>; usage }           // haiku, ≤100개, 30s
claude.writeInsight(metrics: InsightMetrics) → { content: { headline; points[]; tips[] }; usage } // sonnet, 60s, 숫자 금지
claude.chat({ history, message, tools, today }) → { text: string; usage }                        // sonnet, toolRunner, 도구 ≤5회
// usage: ClaudeUsage(models.ts의 toUsage) — 호출자(server/)가 recordAiUsage로 ai_usage에 기록
polar: createCheckout · getCheckout · createPortalSession · getCustomerState · revokeSubscriptions · validateWebhook
```
- 채팅 도구 2개: `summarize_spending({from,to,groupBy})`, `search_transactions({from,to,query?,category?,limit≤30})`. `userId`는 서버 클로저로 고정, 읽기 전용. 대화 기록은 DB에 저장하지 않고 클라이언트가 최근 10턴까지 보낸다.
- Claude 공통: 모델 ID는 `models.ts`만, `maxRetries: 2`, 요청별 timeout, 에러 클래스별 처리, `stop_reason`(`refusal`, `max_tokens`) 확인, 호출 후 `ai_usage` 기록.

## API
| 메서드·경로 | 조건 | 요청 → 응답 | 주요 에러 |
|---|---|---|---|
| `GET /auth/login?provider&next` · `GET /auth/callback` | public | → 302 (PKCE, `safeRedirect`) | `/login?error=` |
| `POST /auth/signout` | user | → 302 `/` | — |
| `POST /api/consents` | user | `{items:[{kind,version}]}` → 204 | `VALIDATION_FAILED`, `UNDERAGE` |
| `POST /api/uploads` | user·동의·하루 30개 | `{filename,size,sha256}` → `{uploadId,uploadUrl}` | `DUPLICATE_FILE`, `FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`, `RATE_LIMITED` |
| `POST /api/uploads/:id/analyze` | user·동의 | → `{preview,mapping,autoConfirm}` | 파일 에러 코드 전부, `NOT_FOUND` |
| `POST /api/uploads/:id/confirm` | user·동의 | `{mapping, card:{id}\|{name}}` → `{inserted,duplicates,pending,period}` | `MAPPING_INVALID`, `INVALID_STATE` |
| `POST /api/uploads/:id/recategorize` | user·동의 | → `{updated,pending}` | `AI_UNAVAILABLE` |
| `DELETE /api/uploads/:id` | user | → 204 | `NOT_FOUND` |
| `PATCH /api/transactions/:id` | user | `{category, scope:'one'\|'merchant'}` → `{updated}` | `VALIDATION_FAILED` |
| `POST /api/insights` | user·동의·Pro 또는 무료 1회·하루 10회 | `{month}` → `Insight` | `PRO_REQUIRED`, `NO_DATA`, `AI_UNAVAILABLE`, `RATE_LIMITED` |
| `POST /api/chat` | user·동의·Pro·하루 30회 | `{history, message≤500}` → `{text}` | `PRO_REQUIRED`, `RATE_LIMITED`, `AI_UNAVAILABLE` |
| `POST /api/billing/checkout` · `/portal` · `/confirm` | user | → `{url}` / `{plan}` | `ALREADY_SUBSCRIBED`, `BILLING_UNAVAILABLE` |
| `POST /api/webhooks/polar` | 서명 | raw → 200/403/500 | — |
| `POST /api/account/delete-data` · `/delete` | user | `{confirm:'전체 삭제'\|'탈퇴'}` → 204 | `VALIDATION_FAILED`, `BILLING_UNAVAILABLE` |
| `GET /api/cron/cleanup` | `Authorization: Bearer CRON_SECRET` | → `{removed}` | 401 |

- 응답 에러 형식: `{ "error": { "code": ErrorCode, "message": "한국어 메시지" } }`. DB·SDK 에러 문구를 그대로 내보내지 않는다.
- `handler(opts, fn)`: `requireUser()`(getUser), 변경 메서드 Origin 검사(APP_URL과 다르면 403), zod body 검증, `AppError` → 응답 변환, 예상 못 한 에러 → `INTERNAL` + SafeLogger.
- 읽기는 Server Component → `server/queries/*`. queries 함수의 첫 줄은 `requireUser()`.

## 에러 코드 (`src/lib/domain/errors.ts`)
| HTTP | 코드 | 클라이언트(`apiFetch`) 처리 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | 폼 에러 |
| 401 | `UNAUTHENTICATED` | `/login?next=현재경로` |
| 402 | `PRO_REQUIRED` | 페이월 |
| 403 | `CONSENT_REQUIRED` · `UNDERAGE` · `FORBIDDEN` | 동의 화면 · 안내 |
| 404 | `NOT_FOUND` | 목록으로 |
| 409 | `DUPLICATE_FILE` · `INVALID_STATE` · `ALREADY_SUBSCRIBED` | 기존 업로드로 · 새로고침 · 포털 |
| 413·415·422 | `FILE_TOO_LARGE` · `UNSUPPORTED_FORMAT` · `ENCRYPTED_FILE` · `EMPTY_FILE` · `ENCODING_ERROR` · `CORRUPT_FILE` · `TOO_MANY_ROWS` · `FILE_TOO_COMPLEX` · `HEADER_NOT_FOUND` · `BILLING_STATEMENT` · `BANK_STATEMENT` · `MAPPING_INVALID` · `NO_DATA` | 코드별 안내 + [가이드] |
| 429 | `RATE_LIMITED` | "내일 다시 시도해 주세요" |
| 503 | `AI_UNAVAILABLE` · `BILLING_UNAVAILABLE` | 재시도 버튼 |
| 500 | `INTERNAL` | 일반 에러 화면 |

## 데이터베이스 (`supabase/migrations/`, 9개 테이블, 전부 RLS, `anon` 권한 회수)
| 테이블 | 컬럼 (요약) | 사용자 권한 |
|---|---|---|
| `consents` | id, user_id→auth.users cascade, kind(`privacy`,`overseas_transfer`,`terms`,`age14`), version, agreed_at default now() | SELECT·INSERT 본인 |
| `entitlements` | user_id PK, plan(`free`,`pro`), status, period_end, synced_at, free_insight_used_at | SELECT 본인만 (쓰기는 admin) |
| `cards` | id, user_id, name, institution, created_at · UNIQUE(user_id, name) | 본인 전체 |
| `uploads` | id, user_id, card_id null, storage_path, filename, sha256, byte_size, status(`uploaded`,`awaiting_confirm`,`done`,`failed`), error_code, mapping jsonb, header_signature, period_from, period_to, counts jsonb, original_deleted_at, created_at · 부분 UNIQUE(user_id, sha256) WHERE status <> 'failed' | 본인 전체 |
| `transactions` | id, user_id, card_id, upload_id→uploads cascade, occurred_on date, merchant_raw, merchant_key, amount_krw bigint CHECK≥0, kind, status, installment_months, foreign_amount numeric, foreign_currency, approval_no, category CHECK(CATEGORIES), category_source, identity_key, created_at · UNIQUE(user_id, identity_key) · INDEX(user_id, occurred_on) | 본인 전체 |
| `header_mappings` | PK(user_id, signature), mapping jsonb, updated_at | 본인 전체 |
| `category_overrides` | PK(user_id, merchant_key), category | 본인 전체 |
| `insights` | id, user_id, month, content jsonb, created_at · UNIQUE(user_id, month) | 본인 전체 |
| `ai_usage` | id, user_id, feature(`mapping`,`classify`,`insight`,`chat`), model, input_tokens, output_tokens, created_at · INDEX(user_id, feature, created_at) | SELECT·INSERT 본인 (UPDATE·DELETE 없음) |
- 정책은 `(select auth.uid()) = user_id` 형태. 모든 user_id FK는 `auth.users` on delete cascade(탈퇴 시 일괄 삭제).
- Storage: 비공개 버킷 `statements`, 10MB 제한, **사용자 정책 없음**(서버가 admin으로만 접근). 경로 `{uid}/{uploadId}/original`.
- 일일 상한(`server/limits.ts`): 오늘(KST) 행 수를 센다 — 업로드 30(uploads), 매핑 30·분류 100(배치)·인사이트 10·채팅 30(ai_usage).
- 테스트: `supabase/tests`에서 PGlite로 마이그레이션을 적용하고 `auth.uid()`를 stub한 뒤 `SET ROLE authenticated`로 격리를 검증한다.

## 외부 SDK 메모 (설치된 버전 기준 — 쓰기 전에 node_modules의 README/타입을 확인)
- **Next 16**: `node_modules/next/dist/docs/`. `proxy.ts`는 Node 런타임 전용. Route Handler `maxDuration`은 `export const maxDuration = 60`.
- **Supabase SSR** (`@supabase/ssr`): `createServerClient(url, anonKey, { cookies: { getAll, setAll } })`. `setAll`에서 쿠키 옵션에 `httpOnly: true, secure: true(프로덕션), sameSite: 'lax'`를 덮어쓴다. proxy에서는 `getClaims()`로 세션만 갱신, 서버 코드의 사용자 확인은 `getUser()`.
- **Anthropic** (`@anthropic-ai/sdk` 0.128): 구조화 출력 `client.messages.parse({ model, max_tokens, messages, output_config: { format: zodOutputFormat(Schema) } })` — `import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"`, 결과는 `response.parsed_output`(null 가능). 채팅은 `import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod"` + `await client.beta.messages.toolRunner({...})`. assistant prefill 금지. Haiku 4.5에는 thinking 파라미터를 보내지 않는다. Sonnet 5는 `output_config: { effort: "low" }`(채팅) / `"medium"`(인사이트). 에러: `Anthropic.RateLimitError`, `Anthropic.APIConnectionError`, `Anthropic.APIError`.
- **Polar** (`@polar-sh/sdk` 1.0.0-alpha.22, 버전 고정): `import { createPolar } from "@polar-sh/sdk/2026-04"`. 구 SDK(`new Polar(...)`)와 `@polar-sh/nextjs` 어댑터는 쓰지 않는다. 웹훅 검증·Customer State 사용법은 `node_modules/@polar-sh/sdk/README.md`를 따른다.
- **SheetJS** (`xlsx` 0.20.3): `import * as XLSX from "xlsx"; import * as cpexcel from "xlsx/dist/cpexcel.full.mjs"; XLSX.set_cptable(cpexcel);` 암호 파일은 `/password-protected/` 에러를 던진다. HTML로 된 xls는 바이트를 직접 디코딩한 문자열로 넘긴다.
- **iconv-lite**: `iconv.decode(Buffer.from(bytes), "cp949")`.
