# Step 7: upload-ui

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`, `/AGENTS.md`
- `/docs/USER_FLOWS.md` (① 빈 상태, ② 업로드 전체, 예외·오류의 "파일"·"기기·네트워크")
- `/docs/UI_GUIDE.md` (버튼·입력·카드·문구·애니메이션 규칙, AI 슬롭 금지 목록)
- `/docs/ARCHITECTURE.md` (레이어 규칙: 컴포넌트는 props만, 쓰기는 `apiFetch`로 `/api/*`만; API 표의 `/api/uploads*`)
- `/src/components/ui/api-fetch.ts`(`apiFetch`, `ApiError`, `redirectPathForError`), `/src/lib/domain/errors.ts`(`ERROR_MESSAGES`), `/src/lib/domain/month.ts`, `/src/server/auth.ts`(`requireUser`) (0-foundation)
- `/src/app/(app)/layout.tsx`, `/src/components/auth/consent-form.tsx`(+테스트 — 클라이언트 컴포넌트·테스트 작성 방식 참고) (0-foundation)
- `/src/lib/domain/upload.ts`(`UPLOAD_LIMITS`, `ACCEPT_ATTR`, `checkUploadFile`, `AnalyzeResponse`, `ConfirmResponse`, `CardChoice`, `UploadPreview`) (Step 1, 6)
- `/src/app/api/uploads/**/route.ts`, `/src/server/actions/uploads.ts` (Step 6 — 요청·응답 형태와 에러 코드)
- `node_modules/next/dist/docs/`의 `page.tsx` params(Promise)·`notFound`·`redirect` 문서

## 작업

TDD로 진행한다(컴포넌트는 같은 폴더 `X.test.tsx`, 순수 모듈은 `X.test.ts`). `apiFetch`는 `vi.mock("@/components/ui/api-fetch")`, `fetch`·`crypto.subtle`은 `vi.stubGlobal`로 대체한다.

### 1. `src/server/queries/uploads.ts` (첫 줄 `import "server-only"`, 각 함수 첫 줄 `requireUser()`)
```ts
export async function getUploadPageData(): Promise<{ cards: { id: string; name: string }[]; hasUploads: boolean }>;   // done 업로드가 있는지
export async function getUploadReview(uploadId: string): Promise<{ upload: { id: string; filename: string; status: string }; cards: { id: string; name: string }[] } | null>;
```
- `createServerSupabase()`(RLS) + `.eq("user_id", user.id)`. uuid가 아니거나 없으면 null. 테스트는 `@/server/auth`·`@/services/supabase/server`를 mock.

### 2. 순수 모듈 `src/components/upload/upload-pipeline.ts`
```ts
export type FileStage = "waiting" | "hashing" | "uploading" | "analyzing" | "review" | "confirming" | "done" | "error";
export interface PipelineDeps { api: typeof apiFetch; put: (url: string, file: File) => Promise<boolean>; sha256Hex: (file: File) => Promise<string> }
export async function startFile(file: File, deps: PipelineDeps, onStage: (s: FileStage) => void):
  Promise<{ uploadId: string; analysis: AnalyzeResponse }>;          // 해시 → POST /api/uploads → PUT → POST analyze
export async function confirmFile(uploadId: string, mapping: ColumnMapping, card: CardChoice, deps: PipelineDeps): Promise<ConfirmResponse>;
export function sha256Hex(file: File): Promise<string>;              // crypto.subtle.digest("SHA-256", await file.arrayBuffer()) → 소문자 hex
export function putFile(url: string, file: File): Promise<boolean>;  // fetch(url, { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "false" } })
```
- signed URL로의 `PUT`만 `apiFetch`가 아닌 `fetch`를 쓴다(Supabase Storage 주소라서). 그 외 호출은 전부 `apiFetch`로 우리 `/api/*`만. PUT 실패는 `ApiError`(`code: "NETWORK"`)로 던진다.
- `upload-pipeline.test.ts`(node): 호출 순서·인자(`sha256`은 hex, body에 userId 없음), PUT 실패, analyze 에러 전파.

### 3. 컴포넌트 `src/components/upload/` (모두 `"use client"`, 표시 데이터는 props로만)
- `file-picker.tsx` — `<input type="file" multiple accept={ACCEPT_ATTR}>`(모바일 MIME 선택). 고른 파일마다 `checkUploadFile`로 확장자·10MB·0바이트를 먼저 검사해 실패 파일은 서버로 보내지 않고 안내한다. props: `onFiles(files: File[])`, `disabled`.
- `card-field.tsx` — 기존 카드 select + "새 카드" 이름 입력(1~30자) → `CardChoice`. 카드가 없으면 이름 입력만(기본값 비움, placeholder "예: 신한 체크").
- `mapping-review.tsx` — props `{ preview: UploadPreview; mapping: ColumnMapping | null; cards; defaultCard?: CardChoice; submitting: boolean; onSubmit(mapping: ColumnMapping, card: CardChoice): void }`.
  - 헤더 행 select(`preview.rows`의 각 행 번호 + 앞 셀 몇 개), 선택한 헤더 행의 셀로 날짜·가맹점·금액 select(필수), 승인번호·할부·취소/상태·해외금액·통화·카드번호 select("없음" 포함, "더 보기"로 접기), 헤더 아래 **최대 5행** 미리보기 표(선택한 열 강조), 카드 필드.
  - 제안 매핑이 있으면 미리 채운다. 날짜·가맹점·금액이 서로 다르게 모두 골라져야 [저장하고 분석] 활성화. 한 줄 안내: "열 이름이 맞는지 확인해 주세요. 한 번 저장하면 같은 형식은 다음부터 바로 올라가요."
- `upload-result.tsx` — props `{ result: ConfirmResponse; onRecategorize?(): void; recategorizing?: boolean }`. 한 줄 요약 "7~9월 · 132건 추가 · 이미 있던 12건 · 분류 실패 5건 [다시 분류]"(0건인 항목은 생략, 추가 0건이면 "새로 추가된 거래가 없어요"), [대시보드 보기] → `/dashboard?month=<period.to의 YYYY-MM>`.
  - 기간 문구는 `src/lib/domain/month.ts`에 `formatPeriodLabel(from: IsoDate, to: IsoDate): string`을 추가해 만든다(`month.test.ts`에 표 추가): 같은 달 "9월", 같은 해 "7~9월", 해가 다르면 "2025년 12월~2026년 1월". 2-dashboard의 업로드 목록도 이 함수를 쓴다.
- `upload-error.tsx` — props `{ error: ApiError; onRetry?(): void }`. `ERROR_MESSAGES[code]`를 보여 주고: 파일 에러 코드(`FILE_TOO_LARGE`~`MAPPING_INVALID`, `NO_DATA`)는 [가이드] → `/guide`, `DUPLICATE_FILE`은 "이미 올린 파일이에요" + [보기] → `/dashboard`, `RATE_LIMITED`는 "내일 다시 시도해 주세요", `AI_UNAVAILABLE`·`NETWORK`·`INTERNAL`은 [다시 시도]. `redirectPathForError`가 경로를 주면(401·동의·페이월) 그 경로로 이동한다.
- `upload-flow.tsx` — `/upload` 본체. props `{ cards; hasUploads: boolean }`.
  - `hasUploads`가 false면 빈 상태: "카드사 홈페이지에서 받은 이용내역 파일을 올려 주세요" + [파일은 어디서 받나요?] → `/guide`.
  - 위에 카드 필드(이번에 올릴 파일들의 카드), 아래 파일 선택. 여러 파일은 **한 번에 하나씩** 차례로 처리하고 파일마다 상태 카드(이름, 단계 표시, 결과·에러)를 보여 준다.
  - `analysis.autoConfirm`이면 확인 화면 없이 곧바로 `confirmFile(…, analysis.mapping, 선택한 카드)`. 아니면 그 파일 카드 안에 `MappingReview`를 펼치고 **큐를 멈춘다** → 제출 → confirm → 다음 파일.
  - 한 파일이 실패해도 다음 파일로 넘어간다. 결과 카드의 [다시 분류]는 `POST /api/uploads/:id/recategorize`.
  - 진행 중에는 파일 선택을 비활성화한다. 애니메이션은 스피너·단계 표시만(`prefers-reduced-motion` 존중).
- `upload-review.tsx` — `/upload/[id]`용. props `{ uploadId; filename; cards }`. 마운트 시 `POST /api/uploads/:id/analyze`(서버가 저장된 제안을 재사용하므로 다시 불러도 안전) → `MappingReview` → confirm → `UploadResult`.

### 4. 페이지 (로직 없음 — 조회 결과를 props로 넘기기만)
- `src/app/(app)/upload/page.tsx`: `getUploadPageData()` → `<UploadFlow cards hasUploads />`. 제목 "내역 올리기", 신뢰 문구 한 줄: "원본은 90일 뒤 자동 삭제돼요. AI에는 가려진 샘플과 가맹점명만 보내요."
- `src/app/(app)/upload/[id]/page.tsx`: `params`(Promise)에서 id → `getUploadReview(id)` → null이면 `notFound()`, `status === "done"`이면 `redirect("/dashboard")`, 아니면 `<UploadReview …/>`.

### 5. 테스트 (`*.test.tsx`)
- `file-picker`: accept 속성, 11MB·`.pdf` 파일은 `onFiles`에서 빠지고 안내가 보임.
- `mapping-review`: 제안 매핑 프리필, 필수 열 중복 시 버튼 비활성, 헤더 행을 바꾸면 열 선택지가 바뀜, 미리보기 최대 5행, 새 카드 이름 제출 시 `{ name }`.
- `upload-result`: 요약 문구(기간 7~9월, 0건 생략, 연도가 다르면 "2025년 12월~2026년 1월"), [다시 분류] 호출.
- `upload-error`: 코드별 문구·[가이드]·[보기]·[다시 시도].
- `upload-flow`: 파일 2개 → 순서대로 처리(두 번째 create는 첫 번째 confirm 뒤), autoConfirm이면 확인 화면 없음, 아니면 리뷰에서 멈췄다가 제출 후 진행, 첫 파일 `ENCRYPTED_FILE` 에러여도 두 번째 진행, 빈 상태 가이드 링크.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/components/**`가 server·services·supabase·`@/lib/ingest`(값 import)를 import하지 않는가? 데이터는 props로만 받는가?
   - `page.tsx`에 판단 로직이 없고 queries 함수 첫 줄이 `requireUser()`인가?
   - `docs/UI_GUIDE.md`의 금지 목록(blur, gradient 텍스트, 보라색, 이모지 아이콘 등)을 쓰지 않았는가? 모든 문구가 해요체인가?
3. 결과에 따라 `phases/1-ingest/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (만든 페이지·컴포넌트·queries 이름을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단 (실제 Storage PUT 확인은 사람이 ops 복사본에서 한다 — 이 step은 mock으로 완료할 수 있다)

## 금지사항

- 브라우저에서 Supabase SDK를 import하거나 Storage에 직접 목록·삭제 요청을 하지 마라. 이유: 브라우저 client 없음 원칙(ADR-002). 브라우저는 서버가 준 signed URL로 PUT만 한다.
- 여러 파일을 `Promise.all`로 동시에 처리하지 마라. 이유: 동기 처리 설계상 한 번에 하나씩 보내야 상한·중복 판단이 꼬이지 않는다(ADR-003).
- 파일 내용·가맹점·금액을 `console`·Vercel Analytics 이벤트에 남기지 마라. 이유: CLAUDE.md CRITICAL(로그 비노출).
- 서버 에러 문구를 그대로 보여 주지 마라. 이유: 내부 정보 노출. `ERROR_MESSAGES`의 정해진 한국어 문구만 쓴다.
- `page.tsx`에서 fetch·가공·분기 로직을 늘리지 마라. 이유: async RSC는 Vitest로 테스트할 수 없다. 로직은 컴포넌트·queries에 두고 테스트한다.
- 기존 테스트를 깨뜨리지 마라.
