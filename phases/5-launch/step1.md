# Step 1: guide-page

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/UI_GUIDE.md` (문구, 레이아웃, AI 슬롭 안티패턴) · `/docs/USER_FLOWS.md` (② 업로드, 파일 예외)
- `/docs/PRD.md` (페르소나 지민: "모바일에서 파일을 못 받음") · `/plan.md` 1-1장(가이드는 한 페이지), 10장(사람이 가이드 문구 확인)
- `/src/lib/domain/errors.ts` (`ERROR_CODES`, `ERROR_MESSAGES`)
- `/src/components/upload/*` (1-ingest: 에러 안내와 [가이드] 링크가 `/guide`를 어떻게 가리키는지)
- `/src/app/(marketing)/layout.tsx`, `/src/components/marketing/*` (Step 0)

## 작업

카드사에서 **이용내역** 파일을 받는 법을 한 페이지로 안내한다. 실제 카드사 메뉴는 이 step에서 확인할 수 없다. 그래서 일반적인 경로만 쓰고, 확인은 사람이 나중에 한다(plan.md 10장). TDD로 진행한다.

### 1. 데이터 `src/lib/domain/guides.ts` (순수, `guides.test.ts` 먼저)
```ts
export type IssuerId = "shinhan" | "samsung" | "hyundai" | "kb" | "lotte" | "hana";
export interface IssuerGuide { id: IssuerId; name: string; steps: string[]; note?: string; verifiedAt: string | null } // 'YYYY-MM-DD' 또는 null
export const ISSUER_GUIDES: readonly IssuerGuide[];   // 신한·삼성·현대·KB국민·롯데·하나 순서
export interface TroubleItem { code: ErrorCode; title: string; fix: string }
export const TROUBLESHOOTING: readonly TroubleItem[];
export function troubleAnchor(code: ErrorCode): string;          // 'ENCRYPTED_FILE' → 'trouble-encrypted-file'
export function guideHrefForError(code: string): string | null;  // TROUBLESHOOTING에 있으면 '/guide#trouble-…', 없으면 null
```
- 카드사마다 PC 웹 기준 3~4단계를 일반적인 표현으로 쓴다.
  - 예: "{카드사} 홈페이지에 로그인해요" → "'이용내역 조회' 메뉴로 가요" → "기간을 고르고 조회해요" → "'엑셀 저장'(또는 '파일 다운로드')을 눌러요"
  - 확인하지 않은 세부 메뉴 이름·URL을 지어내지 않는다.
- **모든 `verifiedAt`은 `null`로 둔다.** 사람이 실제 메뉴 경로를 확인한 뒤 날짜를 넣는다(plan.md 10장 "가이드 문구 직접 확인"). 파일 맨 위 주석에 이 사실을 적는다.
- `TROUBLESHOOTING` 항목
  - `ENCRYPTED_FILE`(암호): 엑셀에서 열어 '다른 이름으로 저장'으로 암호 없이 저장한 뒤 올려요
  - `BILLING_STATEMENT`(청구서): 청구서는 결제일 기준으로 묶여 있어요. '이용내역'을 받아 주세요
  - `BANK_STATEMENT`(은행): 아직 카드 이용내역만 받아요
  - `FILE_TOO_LARGE`(10MB 초과)와 `TOO_MANY_ROWS`(1만 행 초과): 기간을 3개월 정도로 나눠 받아요
  - `UNSUPPORTED_FORMAT`(PDF·이미지): CSV·xls·xlsx로 받아 주세요
- 테스트
  - 6개 카드사가 순서대로 있고 id가 유일하며 단계가 3개 이상인지
  - `verifiedAt`이 null이거나 `YYYY-MM-DD` 형식인지
  - 모든 `code`가 `ERROR_CODES` 안에 있는지
  - 앵커 형식과 `guideHrefForError`의 null 처리

### 2. 컴포넌트 `src/components/marketing/` (각각 `.test.tsx` 먼저)
- `issuer-guide-list.tsx` — props `{ guides: readonly IssuerGuide[] }`
  - 카드사별 `<details>`(요약 = 카드사 이름) 안에 `<ol>` 단계를 둔다.
  - 목록 위에 한 줄: "메뉴 위치는 카드사 사정에 따라 바뀔 수 있어요." `verifiedAt`이 있으면 "마지막 확인 {날짜}"를 보여 준다.
- `copy-link-button.tsx` (client) — props `{ path: string; label: string }`
  - 누르면 `new URL(path, window.location.origin)`을 `navigator.clipboard.writeText`로 복사하고 "링크를 복사했어요"를 보여 준다.
  - clipboard를 쓸 수 없으면 읽기 전용 입력칸에 주소를 보여 주고 선택해 둔다.
- `troubleshooting-list.tsx` — props `{ items: readonly TroubleItem[] }`. 항목마다 `id={troubleAnchor(code)}`인 제목과 해결 문장.

### 3. 페이지 `src/app/(marketing)/guide/page.tsx` (정적, 로직 없음)
제목(h1)은 "카드 이용내역 받는 법"이다. 그 아래 네 섹션을 위에서부터 차례로 두고, 각 섹션에 `id`를 붙인다.
1. `#why` **왜 '이용내역'인가요?**
   - 청구서(명세서)는 결제일 기준 묶음이라 할부·취소가 나뉘어 보여요.
   - 이용내역은 쓴 날짜·가맹점·금액이 한 줄씩 있어서 정리가 정확해요.
2. `#issuers` **카드사별 받는 법 (PC 웹)** — `IssuerGuideList`
3. `#mobile` **휴대폰만 있다면**
   - "카드사 앱에서는 엑셀로 저장하기 어려워요. PC에서 이어서 해 주세요."
   - `CopyLinkButton path="/upload" label="PC에서 열 링크 복사"`
   - "카카오톡 '나와의 채팅'에 붙여 두면 PC에서 바로 열 수 있어요."
4. `#trouble` **올리다가 막히면** — `TroubleshootingList`
- 마지막에 [무료로 시작](`/login?next=%2Fupload`) 링크를 둔다. `metadata.title = "카드 이용내역 받는 법"`.

### 4. 업로드 화면과 연결
1-ingest 업로드 UI의 [가이드] 링크가 에러 코드와 상관없이 `/guide`만 가리키면 `guideHrefForError(code) ?? "/guide"`로 바꾼다. 해당 컴포넌트의 기존 테스트가 그대로 통과해야 한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `guides.ts`가 순수 모듈이고(`lib` 규칙) 모든 `verifiedAt`이 null인가?
   - 페이지가 정적이고(세션·DB 조회 없음) 컴포넌트가 props만 받는가?
   - AI 슬롭 안티패턴(이모지 아이콘, 그라데이션, 중앙 정렬 등)이 없는가?
3. 결과에 따라 `phases/5-launch/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` ("카드사 메뉴 경로는 사람 확인 필요(verifiedAt=null)"를 포함한다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 카드사별 페이지를 따로 만들지 마라. 이유: plan 1-1장 — 가이드는 한 페이지다.
- 확인하지 않은 메뉴 경로를 사실처럼 쓰거나 `verifiedAt`에 날짜를 넣지 마라. 이유: 틀린 안내는 이탈의 1순위 원인(H2)이고, 확인은 사람이 한다.
- 카드사 홈페이지 URL 링크를 넣지 마라. 이유: 확인되지 않은 주소이고, 비슷한 피싱 도메인으로 보낼 위험이 있다.
- 카드사 로고·상표 이미지를 넣지 마라. 이유: 상표 사용 허락이 없고 외부 이미지는 CSP 밖이다.
- 기존 테스트를 깨뜨리지 마라.
