# FinSight MVP 계획 (v5: MVP 간소화)

## Context
FinSight는 한국 개인 사용자가 **카드 이용내역 파일(CSV/엑셀)**을 올리면 Claude API가 분석해 대시보드로 보여주는 핀테크 SaaS다.
MVP 범위는 랜딩 → 로그인 → 대시보드, 로그인, 결제, 배포다.

지금까지의 버전:
- v1: 구조
- v2: 사용자 여정
- v3: 아키텍처 검증
- v4: 보안·엣지 리뷰(28건)

v4는 단단했지만 **프로토타입에 과한 장치**가 많았다. v5에서는 사용자 결정 3개를 반영해 범위를 줄였다.
- 카드만 받는다.
- 채팅은 가볍게 만든다.
- 리마인더는 다음 버전으로 미룬다.

그 결과 테이블은 20개에서 9개로, step은 49개에서 34개로 줄었다. 금융 데이터라서 **비용이 싸고 효과가 큰 보안 기본기는 남겼다.**

현재 레포에는 harness(`scripts/execute.py`), TDD guard, 빈 docs 템플릿만 있다. 구현은 harness로 자동 실행한다.

---

## 1. MVP 간소화 검수 결과

### 1-1. 뺀 것 (MVP 이후로)
| 항목 | 빼는 이유 / 대체 |
|---|---|
| 은행 거래내역 | 카드 이용내역만 받는다. 은행과 관련된 **이체·카드대금 감지, 적요 개인정보 처리, 출처 병합**이 통째로 빠진다 |
| 이메일 리마인더 | Resend, cron, 수신 거부, 더블 옵트인이 전부 빠진다. 대신 대시보드에 "9월 내역을 올릴 차례예요" 배너를 띄운다 |
| 전역 캐시 + HMAC + 3명 투표 승격 | **캐시는 사용자별로만 둔다.** 캐시 오염 이슈(SEC-1)가 원천적으로 사라진다. 대신 신규 사용자는 Haiku 호출이 조금 더 많은데, 한 명당 수 원 수준이다 |
| job 큐, lease, sweeper, `after()` | **업로드를 한 요청 안에서 동기로 처리**한다. 월 명세서는 수백 행이라 파싱·저장·분류가 수십 초 안에 끝난다. 실패하면 사용자가 [다시 시도]를 누른다 |
| SECURITY DEFINER RPC 10여 개 | 사용자 데이터는 RLS로 본인 것만 쓴다. 권한·크레딧처럼 사용자가 바꾸면 안 되는 값만 별도 테이블에 두고 admin이 쓴다 |
| 한도 예약, AI 예산 서킷 브레이커 | 오늘 행 수를 세는 **단순 일일 상한**만 둔다. 전체 비용 상한은 **Anthropic 콘솔 지출 한도**(코드 없음)로 건다 |
| `webhook_events`, 결제 reconcile cron, 고아 결제 자동 환불 | 웹훅은 매번 Polar의 실제 상태를 다시 읽어 덮어쓰므로 중복이 와도 결과가 같다. 웹훅이 유실되면 `requirePro`가 기간을 직접 확인한다. 고아 결제는 **Polar 공개 결제 링크를 꺼서 예방**하고, 생기면 수동으로 처리한다 |
| 운영 이벤트 테이블, 일일 운영 메일, 자체 analytics 테이블 | **Vercel Analytics**(커스텀 이벤트)와 Vercel 에러 알림, 무료 업타임 모니터를 쓴다 |
| 인증 수준 4단계, JWT 15분, 재인증 창 | 서버에서는 **어디서나 `getUser()` 하나**로 확인한다. 탈퇴는 "탈퇴" 입력으로 확인한다 |
| 동의 철회 플로우, `consent_events` | 필수 동의를 철회하는 것은 곧 탈퇴이므로 **탈퇴 기능으로 대신**한다. 동의 기록은 insert만 한다 |
| 업로드-거래 N:M 링크 | 업로드를 삭제하면 그 업로드로 들어온 거래를 지운다. 기간이 겹치는 다른 파일에도 있던 거래는 **그 파일을 다시 올리면 복구**된다(수용하는 한계) |
| 채팅 저장, 스레드 잠금, 도구 4개, SSE 스트리밍 | 채팅은 **브라우저 세션에만 보관**하고, 도구는 2개, 응답은 비스트리밍 JSON으로 받는다(4-3장) |
| 인사이트 숫자 템플릿 | 숫자는 **서버 집계 카드**로 보여주고, AI는 숫자 없이 문장만 쓴다. 숫자가 섞이면 한 번 다시 생성한다 |
| 압축폭탄 사전 검사, 의존성 가드 hook, PII 스캔, `ignore-scripts`, devcontainer, canary 빌드 | 10MB·1만 행·20시트 제한과 `sheetRows`, gitleaks, ops clone 분리로 충분하다 |
| 카드사별 가이드 페이지, 데이터 SQL 함수 | 가이드는 **한 페이지**로 만든다. 집계는 TypeScript 순수 함수로만 한다 |

### 1-2. 남긴 것 (싸고 효과가 큼)
| 항목 | 이유 |
|---|---|
| RLS + 격리 테스트, `anon` 권한 회수 | 금융 데이터의 핵심 경계다. 테스트 파일 하나면 된다 |
| 브라우저용 Supabase client 없음, HttpOnly 쿠키 | 오히려 코드가 줄어든다. XSS가 나도 토큰을 탈취당하지 않는다 |
| 서버만 비밀키 보유, SafeLogger(거래·DB 에러 상세를 로그에 남기지 않음) | 몇 줄이면 된다 |
| Origin 검사, `safeRedirect()`, GET 부작용 금지 | 몇 줄이면 된다 |
| 파일 제한(10MB·1만 행·20시트), 암호 파일 감지 | 서버 안정성을 지킨다 |
| LLM 샘플 마스킹(구분자가 섞인 숫자, 텍스트) | 정규식 하나다. 가족카드 이용자 이름과 카드번호를 보호한다 |
| Storage 사용자 정책 없음, 고정 경로, 덮어쓰기 금지 | 설정만 하면 된다 |
| AI 마크다운 요소 허용 목록(img·a 금지), 기본 CSP | 설정 한 줄로 데이터 유출 경로를 막는다 |
| `identity_key`(승인번호 기반) upsert | 핵심 기능의 정확성이다. 재업로드해도 중복되지 않고, 추정 금액이 확정 금액으로 바뀐다 |
| 웹훅 서명 검증, 조건부 UPDATE, `requirePro`의 기간 확인 | 결제의 최소 안전장치다 |
| harness를 운영 자격증명과 분리(ops clone), `.env` 차단 hook, gitleaks | 사고가 나면 되돌릴 수 없다. 설정만 하면 된다 |
| Supabase dev와 prod 분리 | 무료 플랜 2개로 가능하다 |

### 1-3. v4 이슈 28건 처리 현황
| 처리 | 이슈 |
|---|---|
| **범위를 줄여 해소** | SEC-1(전역 캐시), SEC-4의 은행 부분, SEC-5의 철회 후 백그라운드 작업, SEC-10의 자동 환불(→ 예방 설정), SEC-11의 예약·서킷 브레이커(→ 단순 상한 + 콘솔 한도), REL-1(lease), REL-4의 이체 경합, REL-5(RPC 원자성 → 한 요청 안에서 upsert), REL-7(삭제 job), REL-9(크레딧 예약), 이체 관련 REL-12 |
| **간단한 형태로 유지** | SEC-2(ops clone, `.env` hook, gitleaks), SEC-3(RLS + 권한 테이블 분리), SEC-4(마스킹 정규식), SEC-6(요소 허용 목록, CSP), SEC-7(제한값), SEC-8(Storage 설정), SEC-9(HttpOnly, Origin, `safeRedirect`, `getUser`), SEC-13(SafeLogger), SEC-14(anon 회수, dev/prod 분리), REL-2(조건부 UPDATE, 기간 확인), REL-3(`identity_key`), REL-8(sha256 부분 unique), REL-10(자동 확정 조건), REL-11(에러 코드 → UI), REL-12(카드 관련 엣지) |
| **MVP 이후로 보류** | SEC-12(수동 계정 연결: 0단계에서 사람이 확인만 한다), SEC-15(공급망 자동화), REL-6(자체 모니터링 → Vercel 기본 기능), REL-13(리마인더 cron) |

---

## 2. 확정된 결정
| 영역 | 결정 |
|---|---|
| 타깃 | 한국 개인 사용자, 한국어 UI, KRW |
| 입력 | **카드 이용내역**(CSV, .xls, .xlsx). 여러 파일을 고르면 **하나씩 차례로** 처리한다. 청구서나 은행 파일은 감지해서 안내한다 |
| 파싱 | 헤더 캐시(사용자별)를 먼저 보고, 없으면 Haiku가 마스킹된 샘플로 열을 매핑한다. 실제 파싱은 코드가 결정적으로 한다 |
| 보관 | 원본은 비공개 Storage에 두고 90일 뒤 자동 삭제한다. 거래는 사용자가 삭제할 때까지 보관한다 |
| 인증 | Supabase Auth(서울 리전), 카카오·구글 로그인. "Allow users without an email"을 켠다 |
| AI | 매핑·분류는 `claude-haiku-4-5`, 인사이트·채팅은 `claude-sonnet-5` |
| 결제 | Polar. **사전 서면 승인**을 받는다. `services/billing` 뒤로 격리한다. 가격은 ₩6,900/월(기본 $4.99) |
| Free | 업로드, 분류, 원하는 월 하나씩 보는 대시보드 |
| Pro | AI 인사이트, **가벼운 Q&A 채팅**, 여러 달 추이·전월 비교, 정기결제 목록 |
| 전환 장치 | 분석 결과 티저, 첫 AI 리포트 1회 무료, `/demo` |
| 남용 방지 | 하루 업로드 30개, AI 매핑 30회, 인사이트 10회, 채팅 30회까지. 전체 비용은 Anthropic 콘솔 월 지출 한도로 막는다 |
| UI · 배포 | 라이트 + 포인트 1색 · Vercel `icn1`. 상업적 이용이므로 런칭 시 Pro 플랜 |

---

## 3. 아키텍처

### 3-1. 구성도
```
 Browser (Supabase client 없음 · HttpOnly 쿠키)
   │ 페이지(RSC)            │ fetch JSON (쓰기·AI)           │ PUT 파일 (signed URL)
   ▼                        ▼                                ▼
 ┌─────────────── Vercel icn1 · Next.js 16 ───────────────┐   ┌───────────────────────┐
 │ proxy.ts  세션 갱신 · 비로그인 → /login                  │   │ Supabase (Seoul)       │
 │ page.tsx ─▶ server/queries (requireUser)  ─────────────┼──▶│ Auth · Postgres(RLS)  │
 │ api/**/route.ts ─▶ handler() ─▶ server/actions ────────┼──▶│ Storage(정책 없음)      │
 │ lib/** 순수 함수 (파싱·집계·판정)                          │   └───────────────────────┘
 │ services/** SDK 래퍼 (claude · polar · storage) ────────┼──▶ Claude · Polar (US)
 └──────────────────────────────▲─────────────────────────┘
        Polar webhook ──────────┤ POST /api/webhooks/polar
        Vercel Cron(매일, UTC) ──┘ GET /api/cron/cleanup
```
- **레이어 규칙**(ESLint로 강제)
  - `lib/**`는 next나 supabase를 import하지 않는다.
  - `components/**`는 props만 받는다. 그래서 `/demo`에서 같은 컴포넌트를 재사용할 수 있다.
  - `server/**`와 `services/**`는 `server-only`다.
  - admin client는 `server/admin.ts` 한 파일에서만 쓴다.
- **테스트**
  - `lib`는 순수 함수 단위 테스트로 검증한다.
  - `server`는 `vi.mock('@/services/...')`로 외부 서비스를 가짜로 바꿔 테스트한다.
  - 페이지는 e2e로 검증한다(async RSC는 Vitest로 테스트할 수 없다).

### 3-2. 디렉토리
```
src/
├─ app/  (marketing)/{page,demo,pricing,guide,privacy,terms,refund} · (auth)/{login,onboarding/consent} · auth/{login,callback}/route.ts
│        (app)/{dashboard,transactions,upload/[id],trends,recurring,insights,chat,settings,billing/success}
│        api/{uploads,transactions,insights,chat,billing,webhooks/polar,cron/cleanup,account}/
├─ components/  ui · dashboard · upload · pro · chat · marketing
├─ lib/         domain(categories·money·month·errors·redirect) · ingest(sniff·decode·table·mask·parse·identity·merchant·rules)
│               analytics(month·compare·recurring·plan) · demo(fixtures)
├─ server/      handler.ts · auth.ts(requireUser·requireConsent·requirePro) · logger.ts · env.ts · limits.ts · admin.ts
│               actions/{uploads,transactions,insights,chat,billing,account}.ts · queries/{dashboard,transactions,trends,recurring,settings}.ts
└─ services/    supabase(server·admin) · claude(client·models·mapper·classifier·insight·chat) · billing/polar.ts · storage.ts
supabase/ migrations/ · tests/rls.test.ts
```

### 3-3. 업로드 흐름 (동기 처리)
```
POST /api/uploads {filename,size,sha256}
  → 같은 sha256의 완료된 업로드가 있으면 DUPLICATE_FILE
  → uploads(status=uploaded) 행 생성, admin이 signed URL 발급 (경로 {uid}/{id}/original, upsert:false)
브라우저: fetch PUT 파일
POST /api/uploads/:id/analyze
  → 파일 읽기 → sniff(형식, 암호) → decode(UTF-8/UTF-16/CP949, sheetRows 제한) → 표·헤더 탐지(청구서·은행이면 안내)
  → 헤더 캐시(사용자별) 적중? 적중하면 그 매핑, 아니면 Haiku(마스킹된 샘플 5행). Haiku 장애 시 매핑 없이 반환
  → 샘플 검증(날짜·금액 파싱률 95% 이상) → status=awaiting_confirm, {preview, mapping, autoConfirm} 반환
     autoConfirm = 캐시 적중 + 검증 통과 → 클라이언트가 확인 화면 없이 곧바로 confirm 호출
POST /api/uploads/:id/confirm {mapping, card: {id} | {name}}
  → sha256을 다시 계산해 확인 → 파싱 → transactions upsert(identity_key) → 헤더 캐시 저장
  → 분류: 사용자 지정 → 같은 가맹점의 이전 거래 → 키워드 규칙 → Haiku(카드 가맹점명, 100개씩)
    Haiku 실패 → category='기타', category_source='pending'으로 두고 결과에 [다시 분류] 버튼 표시
  → status=done, {inserted, duplicates, pending, period} 반환    (재호출해도 결과 같음)
POST /api/uploads/:id/recategorize   → pending 상태인 것만 다시 분류
DELETE /api/uploads/:id              → 이 업로드의 거래와 원본 삭제
cron cleanup(매일)                     → 90일 지난 원본 삭제 · 24시간 넘게 uploaded 상태인 업로드와 파일 삭제
```
- `maxDuration`은 analyze 60초, confirm 120초로 둔다.
- 파일 10개는 클라이언트가 순서대로 처리한다. 그래서 동시 실행 문제가 생기지 않는다.

### 3-4. 권한(Pro) 동기화
```
checkout: 서버가 external_customer_id=userId, successUrl=/billing/success?checkout_id={CHECKOUT_ID}, customer_ip_address를 설정
/billing/success → POST /api/billing/confirm {checkoutId}  (본인 checkout인지 확인) → syncEntitlement
webhook → 서명 검증(실패 시 403) → external_id가 없거나 모르는 사용자면 로그만 남기고 200 → syncEntitlement → 200 (실패하면 500, Polar가 재시도)
syncEntitlement(userId): started=now → Polar Customer State 조회 → derivePlan →
   UPSERT entitlements … WHERE synced_at IS NULL OR synced_at < started      (늦게 끝난 옛 조회가 새 결과를 덮어쓰지 못하게)
requirePro: plan='pro' AND (period_end IS NULL OR period_end + 7일 > now())   (웹훅이 유실돼도 기간이 지나면 자동으로 Free)
```
- Polar 조직 설정: 공개 checkout 링크 끄기, 고객당 구독 1개, 결제 실패 유예 7일.

---

## 4. 인터페이스

### 4-1. 도메인 타입
```ts
export const CATEGORIES = ['식비','카페·간식','마트·편의점','교통','자동차','쇼핑','주거·통신','의료·건강','교육',
  '문화·여가','여행·숙박','구독·디지털','보험·금융','경조사·선물','기타'] as const;
export type Category = (typeof CATEGORIES)[number];
export type TxKind = 'spend' | 'refund';
export type TxStatus = 'posted' | 'pending' | 'cancelled';     // pending: 해외 매입 전 추정 금액
export type CategorySource = 'user' | 'history' | 'rule' | 'ai' | 'pending';
export type KRW = number & { __brand: 'KRW' };                 // 정수. 항상 양수
export type Plan = 'free' | 'pro';
```

### 4-2. 핵심 순수 함수 (`lib`, TDD 1순위)
```ts
sniffFile(bytes, name): Result<Sniff, 'UNSUPPORTED_FORMAT'|'ENCRYPTED_FILE'|'EMPTY_FILE'>
decodeFile(bytes, sniff): Result<Sheets, 'ENCODING_ERROR'|'CORRUPT_FILE'|'TOO_MANY_ROWS'|'FILE_TOO_COMPLEX'>
  // BOM → UTF-8(fatal) → iconv cp949 · 구분자 자동 판별 · SheetJS {sheetRows:10001, dense:true} · 시트 20개 이하
  // 셀은 NFC로 정규화하고 500자에서 자름
detectTable(sheets): Result<TableGuess, 'HEADER_NOT_FOUND'|'BILLING_STATEMENT'|'BANK_STATEMENT'>
  // 행이 가장 많은 표를 고름 · 회차/청구금액 열이 있으면 청구서, 잔액/입금/출금 열이 있으면 은행으로 보고 안내
maskSamples(headers, rows): { headers; samples }     // 구분자가 섞인 숫자는 숫자만 세서 7자리 이상이면 '#' · 텍스트는 '가***(4자)'
validateMapping(mapping, table): Result<Mapping, 'MAPPING_INVALID'>   // 필수 열(날짜·가맹점·금액)이 있고, 샘플 파싱률 95% 이상
parseRows(rows, mapping): { rows: ParsedRow[]; skipped: { index; reason }[]; period }
  // 건너뛸 행: 합계·빈 행·날짜 이상(2000년 이전 또는 오늘+31일 이후)·금액 이상·0원
  // 금액 표기 '1,234원' '(1,234)' '-1,234' 처리 · 취소 표시가 있으면 cancelled · 외화는 원화 환산(반올림)
  // 카드번호 열은 끝 4자리만 남기고, 저장하는 텍스트도 같은 숫자 마스킹을 적용
identityKey({ userId, cardId, approvalNo?, occurredOn, kind, merchantKey, amountKrw, occurrence }): string
  // 승인번호가 있으면 금액이 빠진 키 → 추정 금액이 확정 금액으로 갱신된다 · 없으면 금액과 같은 날 순번(occurrence)을 넣어 만든다
normalizeMerchant(raw) · categorizeByRule(key) · summarizeMonth(txs, month) · compareMonths(a, b)
detectRecurring(txs, asOf)     // 같은 가맹점 3회 이상, 간격 25~35일, 금액 차이 ±10% 또는 ±1,000원
derivePlan(state, now)         // active / trialing / past_due / 해지 예약 후 기간 내 → pro, 나머지 → free
safeRedirect(target, fallback) // 같은 오리진의 '/'로 시작하는 경로만 허용. '//' '\' 스킴은 거부
```

### 4-3. 외부 서비스 래퍼 (`services`, 테스트는 vi.mock)
```ts
claude.proposeMapping({ headers, samples }) → { mapping, confidence }        // messages.parse + zodOutputFormat, 20초
claude.classify(merchantKeys: string[]) → Map<string, Category>              // 100개 이하, enum 검증, 30초
claude.writeInsight(metrics) → { headline, points[], tips[] }                // 숫자 없이 문장만(숫자가 섞이면 1회 다시 생성), 60초
claude.chat({ history, message, tools }) → { text }                          // toolRunner(비스트리밍), 도구 호출 5회 이하, refusal 확인
polar.createCheckout / getCheckout / createPortalSession / getCustomerState / revokeSubscriptions / verifyWebhook
storage.createUploadUrl(path) / read(path) / removePrefix(prefix)            // 목록은 페이지 단위로 끝까지 읽는다
```
- **채팅 도구 2개**: `summarize_spending({from, to, groupBy})`, `search_transactions({from, to, query?, category?, limit ≤ 30})`
  - `userId`는 서버 클로저로 고정한다.
  - 읽기 전용이다.
  - 대화 기록은 클라이언트가 최근 10턴까지 보낸다.
- Claude 공통 규칙
  - 모델 ID는 `models.ts`에만 둔다.
  - `maxRetries`는 2로 둔다.
  - 에러는 종류별로 잡는다.
  - `stop_reason`을 확인한다.
  - 호출 전에 `requireConsent`와 일일 상한을 확인한다.
  - 호출 후에는 `ai_usage`에 기록한다.

### 4-4. API
| 메서드·경로 | 조건 | 요청 → 응답 | 주요 에러 |
|---|---|---|---|
| `GET /auth/login?provider&next` · `/auth/callback` | public | → 302 (서버 PKCE, `safeRedirect`) | `/login?error` |
| `POST /api/consents` | user | `{items[]}` → 204 | `VALIDATION_FAILED`, `UNDERAGE` |
| `POST /api/uploads` | user, 동의, 하루 30개 | `{filename,size,sha256}` → `{uploadId, uploadUrl}` | `DUPLICATE_FILE`, `FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`, `RATE_LIMITED` |
| `POST /api/uploads/:id/analyze` | user, 동의 | → `{preview, mapping, autoConfirm}` | `ENCRYPTED_FILE`, `EMPTY_FILE`, `ENCODING_ERROR`, `CORRUPT_FILE`, `TOO_MANY_ROWS`, `FILE_TOO_COMPLEX`, `HEADER_NOT_FOUND`, `BILLING_STATEMENT`, `BANK_STATEMENT` |
| `POST /api/uploads/:id/confirm` · `/recategorize` | user, 동의 | `{mapping, card}` → `{inserted, duplicates, pending, period}` | `MAPPING_INVALID`, `INVALID_STATE` |
| `DELETE /api/uploads/:id` | user | → 204 | — |
| `PATCH /api/transactions/:id` | user | `{category, scope: 'one'|'merchant'}` → `{updated}` | — |
| `POST /api/insights` | user, 동의, Pro 또는 무료 1회, 하루 10회 | `{month}` → `Insight` | `PRO_REQUIRED`, `NO_DATA`, `AI_UNAVAILABLE`, `RATE_LIMITED` |
| `POST /api/chat` | user, 동의, Pro, 하루 30회 | `{history, message ≤ 500}` → `{text}` | `PRO_REQUIRED`, `RATE_LIMITED`, `AI_UNAVAILABLE` |
| `POST /api/billing/checkout` · `/portal` · `/confirm` | user | → `{url}` / `{plan}` | `ALREADY_SUBSCRIBED`, `BILLING_UNAVAILABLE` |
| `POST /api/webhooks/polar` | 서명 | raw → 200/403/500 | — |
| `POST /api/account/delete-data` · `/delete` | user | `{confirm}` → 204 | `BILLING_UNAVAILABLE` |
| `GET /api/cron/cleanup` | `Bearer CRON_SECRET` | → `{removed}` | 401 |

- **`handler()` 커널**이 공통으로 처리한다.
  - `requireUser()`(getUser)
  - 변경 메서드의 **Origin 검사**
  - zod로 body 검증
  - 에러를 `{error:{code,message}}` 형태로 변환
  - SafeLogger 기록
- 읽기는 Server Component가 `server/queries`로 한다. queries의 **첫 줄은 `requireUser()`**다.
- **클라이언트 `apiFetch`**는 에러 코드별로 다음처럼 처리한다.
  - 401: 로그인 화면으로
  - 402: 페이월
  - `CONSENT_REQUIRED`: 동의 화면으로
  - 429: "내일 다시"
  - 503: 재시도 버튼
  - 파일 에러: 코드별 안내와 [가이드] 링크

### 4-5. 데이터베이스 (9개 테이블, 모두 RLS, `anon` 권한 회수)
| 테이블 | 핵심 컬럼 | 권한 |
|---|---|---|
| `consents` | user_id, kind, version, agreed_at | 본인 SELECT·INSERT (UPDATE·DELETE 없음) |
| `entitlements` | user_id PK, plan, status, period_end, synced_at, free_insight_used_at | 본인 SELECT만 · **쓰기는 admin만**(웹훅, confirm, 무료 크레딧) |
| `cards` | user_id, name, institution | 본인 |
| `uploads` | user_id, card_id, storage_path, filename, sha256, status(uploaded/awaiting_confirm/done/failed), error_code, mapping, header_signature, period_from/to, counts, original_deleted_at · 부분 unique(user_id, sha256) WHERE status<>'failed' | 본인 |
| `transactions` | user_id, card_id, upload_id(cascade), occurred_on, merchant_raw, merchant_key, amount_krw(CHECK>0), kind, status, installment_months, foreign_amount/currency, category(CHECK), category_source, identity_key · UNIQUE(user_id, identity_key) · INDEX(user_id, occurred_on) | 본인 |
| `header_mappings` | PK(user_id, signature), mapping | 본인 |
| `category_overrides` | PK(user_id, merchant_key), category | 본인 |
| `insights` | user_id, month, content, created_at · UNIQUE(user_id, month) | 본인 |
| `ai_usage` | user_id, feature, model, input/output tokens, created_at | 본인 SELECT·INSERT (UPDATE·DELETE 없음 → 일일 상한을 사용자가 초기화할 수 없음) |

- **Storage**: 비공개 버킷에 10MB 제한을 두고, 사용자 정책은 두지 않는다. 서버만 admin으로 signed URL을 만들고 파일을 읽는다.
- **사용자 권한으로 써도 되는 이유**: 사용자는 자기 데이터만 바꿀 수 있고, 권한·크레딧은 `entitlements`에 분리되어 있다.
- **PGlite 테스트**: 먼저 RLS가 실제로 적용되는지 증명하고, 이어서 다음을 확인한다.
  - A가 B의 행을 읽거나 쓸 수 없다.
  - `entitlements`를 직접 수정할 수 없다.
  - `ai_usage`를 삭제할 수 없다.
  - anon은 아무것도 할 수 없다.

---

## 5. 기술 스택
| 영역 | 패키지 |
|---|---|
| 앱 | `next@16.3.x`(16.3.7 이상), `react@19`, TypeScript strict, `tailwindcss@4`, Pretendard |
| 데이터 | `@supabase/supabase-js`, `@supabase/ssr`(httpOnly 쿠키), `supabase` CLI(ops clone에서만) |
| AI | `@anthropic-ai/sdk`(`messages.parse` + `zodOutputFormat`, `beta.messages.toolRunner` + `betaZodTool`), `zod` |
| 파싱 | `xlsx@0.20.3`(CDN tarball, ESM은 `set_cptable`), `iconv-lite` |
| UI | `recharts@3`, `react-markdown`(요소 허용 목록) |
| 결제 | `@polar-sh/sdk@next`(`createPolar`), 정확한 버전으로 고정 |
| 분석 | `@vercel/analytics`(커스텀 이벤트, 금액·가맹점은 넣지 않음) |
| 테스트 | `vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `jsdom`, `@testing-library/*`, `@electric-sql/pglite`, `@playwright/test` |
| 스크립트 | `"lint": "eslint"`, `"test": "vitest run"`, `"e2e": "playwright test"` |

## 6. CLAUDE.md CRITICAL 규칙 (7개)
1. **레이어 규칙을 지킨다.** `lib`는 순수 함수로, 컴포넌트는 props만 받는다. 브라우저용 Supabase client는 금지하고, admin은 `server/admin.ts`에서만 쓴다.
2. **비밀키는 `server-only`에서만 다룬다.** env가 없어도 build가 통과해야 한다. `.env*` 파일은 읽지도 출력하지도 않는다.
3. **모든 테이블에 RLS를 건다.** 권한과 무료 크레딧(`entitlements`)은 admin만 쓴다.
4. **쓰기는 `handler()` 커널을 거친 Route Handler에서만** 한다. GET에는 부작용이 없다. queries 함수의 첫 줄은 `requireUser()`다. 리다이렉트는 `safeRedirect()`를 거친다.
5. **Pro 기능은 서버의 `requirePro()`로만 허용한다.** AI 호출 전에는 동의와 일일 상한을 확인한다.
6. **Claude에 보내는 데이터를 최소로 한다.**
   - 매핑: 마스킹된 샘플
   - 분류: 가맹점명
   - 인사이트: 집계값
   - 채팅 도구: 30행 이하

   **AI 출력은 검증하고 렌더링을 제한한다.**
   - zod와 enum으로 검증한다.
   - 마크다운에서 img와 a를 금지한다.
   - 투자·세무 조언은 거절한다.
7. **로그에 거래, 가맹점, 금액, 파일 내용, 프롬프트, DB 에러 상세를 남기지 않는다.**
   - 금액은 정수 KRW와 `formatKRW()`로 다룬다.
   - 월 경계는 KST 기준이다.
   - 외부 호출은 `services`로만 한다.
   - 테스트는 같은 폴더에 두고 네트워크를 쓰지 않는다.

---

## 7. 사용자 여정

### 7-1. 페르소나 (카드 기준)
| | P1 지민 (26, 사회초년생) | P2 현우 (34, 카드 4장) | P3 수아 (29, 구독 과다) | P4 태호 (38, 가계부 앱 이탈) |
|---|---|---|---|---|
| 목표 | 월급이 어디로 새는지 | 카드 여러 장을 한 화면에서 | 구독 총액과 해지 후보 | 연동 없이 분석만 |
| 결제하는 이유 | 절약 포인트 리포트 | 추이, 채팅 | 정기결제 목록 | 파일 방식, 확실한 삭제 |
| 이탈하는 이유 | 모바일에서 파일을 못 받음 | 카드마다 업로드가 번거로움 | 탐지 누락 | 분류 오류 |

- 포지셔닝 문구: "연동 없이 카드 내역 파일만. 원본은 90일 후 자동 삭제, 언제든 전부 삭제."
- Aha moment: 업로드 후 1분 안에 총지출, 1위 카테고리, TOP5를 보는 순간.

### 7-2. User Flow
**① 첫 방문 → 첫 대시보드**
```
랜딩 / ─"예시 보기"─▶ /demo (샘플 데이터, Free+Pro 화면) ─"내 데이터로 시작"─┐
   └─"무료로 시작"──────────────────────────────────────────────────────┤
                                                                      ▼
                         /login [카카오][구글] → 서버 OAuth · 인앱 브라우저 → "기본 브라우저로 열기"
                                                                      ▼
                         ◇ 동의 완료? ◇─아니오─▶ /onboarding/consent (필수 4개 개별 체크: 수집·이용, 국외이전, 약관, 만14세)
                               │ 예                        │ 거부 → 로그아웃 + 안내
                               ▼ ◀─────────────────────────┘
                         ◇ 거래 있음? ◇─아니오─▶ /upload (빈 상태: [파일은 어디서 받나요?] → /guide)
                               │ 예                        ▼
                         /dashboard?month=최신월 ◀────── 업로드 흐름 ②
```

**② 업로드 (카드 이용내역)**
```
/upload 파일 선택(여러 개면 차례로) ─ 검증(csv·xls·xlsx, 10MB) 실패 → 안내
  ▼ POST /api/uploads → PUT → POST analyze
  ├ 같은 파일 → "이미 올린 파일이에요 [보기]"
  ├ 암호 / 1만 행 초과 / 깨진 파일 → 원인별 안내
  ├ 청구서 · 은행 파일 → "카드사 '이용내역'을 받아 주세요 [가이드]"
  ▼
autoConfirm? ─아니오─▶ 매핑 확인 화면 (헤더 행 · 날짜/가맹점/금액 열 선택 · 미리보기 · 카드 이름 선택)
  │ 예                        │ 확인
  ▼ ◀─────────────────────────┘
POST confirm (파싱 · 중복 제외 · 분류, 진행 스피너)
  ▼
결과 "7~9월 · 132건 추가 · 이미 있던 12건 · 분류 실패 5건 [다시 분류]" → /dashboard
```

**③ 대시보드 → Pro → 결제**
```
/dashboard?month (Free도 월 선택 가능) · 요약 · 카테고리 차트 · TOP5 · 거래 목록 → 카테고리 수정 [이번 건만][같은 가맹점 모두]
 ├ "9월 내역을 올릴 차례예요" 배너 (최신 데이터가 지난달보다 오래됐을 때)
 └ Pro 티저: 정기결제 합계 · 전월 비교 잠금 · 흐리게 처리한 추이 · 첫 리포트 1회 무료 · 채팅 예시 질문
       ▼
/pricing "₩6,900/월 · 해외결제 가능한 카드 필요" → checkout(서버에서 생성) → Polar(KRW)
   성공 → /billing/success → confirm → Pro 열림   │   거절 → "국내전용 카드는 결제가 안 돼요" 안내
```

**④ 구독 · 데이터 · 탈퇴**
```
구독: active ─해지 예약─▶ 기간 끝까지 Pro ─▶ Free · past_due(7일 유예) ─▶ Free   (Free가 돼도 데이터는 그대로, Pro 화면만 잠김)
/settings: 구독 관리(Polar portal) · 업로드 목록 [삭제] · [전체 데이터 삭제] · [탈퇴] ("탈퇴" 입력 → 구독 해지 → 원본 삭제 → 계정 삭제)
```

### 7-3. 예외·오류 (MVP 범위)
**인증**
- 카카오 이메일이 없어도 가입된다.
- 인앱 브라우저에서 구글 로그인을 누르면 외부 브라우저로 안내한다.
- 세션이 만료되면 로그인 후 원래 가던 곳으로 돌아간다.
- 필수 동의를 거부하면 이용할 수 없다.

**파일**
- 거부: PDF·이미지, 암호 파일, 청구서·은행 파일, 1만 행 초과, 10MB 초과
- 정규화해서 처리
  - HTML·XML 형식의 xls
  - 인코딩: CP949, UTF-16, NFD 한글
  - 표 구조: 제목행·합계행, 시트 여러 개(행이 가장 많은 표를 고름)
  - 날짜: 연도가 없으면 기간으로 추정
  - 0원·날짜 이상 행은 건너뜀
- 중복: 같은 파일은 막고, 기간이 겹치면 identity 키로 중복을 막는다. 같은 날 같은 금액이 2건이면 승인번호나 순번으로 둘 다 보존한다.

**거래**
- 취소는 `cancelled`로 두고 지출에서 뺀다. 부분 취소는 환불로 처리한다.
- 할부는 이용일에 총액으로 잡는다.
- 외화는 원화 환산액으로 저장하고, 매입 전이면 "추정" 표시를 한다. 확정되면 같은 키로 갱신한다.
- 포인트 차감 행은 건너뛴다(MVP).

**AI**
- 매핑이 실패하면 수동 매핑으로 넘어간다.
- 분류가 실패하면 `pending` 상태로 두고 [다시 분류] 버튼을 보여준다.
- 인사이트에 숫자가 섞이면 한 번 다시 생성하고, 그래도 실패하면 안내한다.
- 채팅
  - 도구 호출은 5회까지만 허용한다.
  - 범위 밖 질문과 투자 조언 요청은 거절한다.
  - 하루 상한을 넘으면 429를 돌려준다.
- 가맹점명 injection은 출력 enum 검증과 렌더링 제한으로 막는다.

**결제**
- 국내전용 카드는 결제 전에 안내한다.
- 웹훅이 늦으면 confirm으로 동기화한다.
- 웹훅이 유실돼도 기간 확인으로 만료가 반영된다.
- 이미 구독 중이면 portal로 보낸다.
- 탈퇴할 때는 구독을 먼저 해지한다. 실패하면 탈퇴를 중단하고 재시도를 안내한다.

**기기**
- 모바일에서는 `accept` MIME으로 파일을 고른다.
- 네트워크가 끊기면 재시도한다. 재시도해도 결과가 같다(멱등).

### 7-4. 가설 (Vercel Analytics 이벤트와 DB 집계로 측정)
| ID | 가설 | 성공 기준 |
|---|---|---|
| H1 활성화 | 가입자가 첫 업로드까지 간다 | 동의 85% 이상, 7일 안에 첫 업로드 50% 이상 |
| H2 파일 확보 | 가이드가 업로드로 이어진다 | 가이드를 본 사람 중 48시간 안에 업로드 40% 이상 |
| H3 매핑 | 자동 매핑이 대부분 맞는다 | 자동 확정 또는 무수정 확정 90% 이상 |
| H4 분류 | 분류가 대부분 맞는다 | 사용자 수정 8% 이하 |
| H5 전환 | Free에서 Pro로 결제한다 | 30일 안에 유료 전환 3% 이상 |
| H6 재방문 | 리마인더 없이도 다시 올린다 | 다음 달 재업로드 Free 30% 이상, Pro 60% 이상. **낮으면 다음 버전에 리마인더를 넣는다** |
| H8 결제 | 결제가 잘 완료된다 | checkout 성공 60% 이상 |
| H9 AI 가치 | AI 리포트가 쓸모 있다 | 리포트 좋아요 60% 이상 |

### 7-5. 화면
| 영역 | 경로 |
|---|---|
| 공개 | `/` · `/demo` · `/pricing` · `/guide` · `/privacy` · `/terms` · `/refund` |
| 인증 | `/login` · `/onboarding/consent` |
| 앱 | `/dashboard` · `/transactions` · `/upload[/id]` · `/trends` · `/recurring` · `/insights` · `/chat` · `/settings` · `/billing/success` |
| 공통 | `not-found` · `error` |

---

## 8. Harness 실행 전에 이 세션에서 할 작업
0. **레포 루트에 `plan.md`를 만든다**(사용자 요청). 이 계획(v5) 전체를 그대로 옮기고 첫 커밋(`docs: add MVP plan`)으로 남긴다.
   - 루트에 두는 이유: harness가 매 step에 주입하는 파일은 `docs/*.md`뿐이다. 루트에 두면 프롬프트 크기가 늘지 않는다.
   - `docs/` 문서들은 이 `plan.md`에서 필요한 부분만 뽑아 만든다(7번).
1. **다이어그램 페이지(Artifact)를 게시**한다. 승인 후 `plan.md` 다음으로 한다.
2. **Polar 사전 승인 문의 초안**을 작성한다. 보내는 것은 사용자가 한다.
3. **작업 복사본을 분리**한다.
   - 이 레포는 harness 전용이다. link, 실제 env, 실데이터를 두지 않는다.
   - `supabase link`, `db push`, 배포, 실파일 확인은 `finsight-ops/` clone에서 사람이 한다.
   - 실제 명세서는 `~/finsight-private/`에 둔다.
4. **`.gitignore`**에 `.env*`, `!.env.example`, `.vercel`, `supabase/.temp`, `coverage/`, `test-results/`, `playwright-report/`를 추가한다.
5. **Hook을 정리**한다.
   - `env-guard.sh`: Read·Edit·Write·Bash에서 `.env*` 접근을 막는다(exit 2).
   - `bash-guard.sh`: stdin JSON을 읽어 검사하고 exit 2로 막는다. 대상은 기존 패턴과 `supabase`, `vercel`, `psql`이다.
   - `stop-verify.sh`: `package.json`이 없거나 `stop_hook_active`면 통과하고, 실패하면 exit 2를 낸다.
   - TDD guard: Next 특수 파일을 예외로 두고, 테스트를 같은 폴더에 두도록 강제한다.
   - pre-commit에 gitleaks를 건다.
6. **스캐폴딩**: scratchpad에서 create-next-app 16.3을 실행하고 필요한 것만 복사한다. 이어서 의존성, `vitest.config.mts`(ResizeObserver stub), ESLint 레이어 규칙, httpOnly 쿠키 설정, smoke test를 넣는다.
7. **문서는 짧게 유지한다.** 매 step 프롬프트에 주입되기 때문이다.
   - `docs/PRD.md`: 2장, 7-1장, 1-1장(제외 사항)
   - `docs/USER_FLOWS.md`: 7장
   - `docs/ARCHITECTURE.md`: 3·4장
   - `docs/ADR.md`: 주요 결정과 1-1장의 "왜 뺐나"
   - `docs/UI_GUIDE.md`
   - `CLAUDE.md`: 6장
8. **`phases/`를 생성**한다(9장). 사용자가 확인한 뒤 `0-foundation`부터 실행한다.
9. 3~7은 conventional commits로 나눠서 커밋한다.

## 9. Phase / Step (34개)
모든 step의 AC는 `npm run lint && npm run build && npm run test`다. 외부 서비스는 `vi.mock`으로 대신하므로 실제 키가 필요 없다. 다음 phase를 실행하기 전에 main에 머지한다.

| Phase | Steps |
|---|---|
| **0-foundation** (6) | `env-domain`(env, 타입, 카테고리, `formatKRW`, KST, 에러 코드, `safeRedirect`) · `db-schema`(**첫 AC는 PGlite로 RLS 적용 증명**, 9개 테이블, anon 회수, 격리 테스트) · `supabase-server`(server/admin client, httpOnly, `proxy.ts`, `requireUser`) · `api-handler`(`handler()`, Origin 검사, zod, 에러 변환, SafeLogger) · `auth-flow`(서버 OAuth, callback, 로그아웃, 인앱 브라우저 안내) · `consent-gate` |
| **1-ingest** (8) | `fixture-corpus`(카드사별 합성 파일, CP949/UTF-16/NFD, HTML xls, 암호, 청구서·은행, 1만 행 초과, 취소, 외화 추정→확정) · `file-decode`(sniff, decode, 제한값) · `table-detect`(헤더, 청구서·은행 감지, 마스킹) · `column-mapper`(헤더 캐시 + Haiku + 검증) · `row-parser`(identity, 상태, 엣지 규칙) · `categorizer`(사용자 지정 → 이전 거래 → 규칙 → Haiku) · `upload-api`(create/analyze/confirm/recategorize/delete, 일일 상한) · `upload-ui`(선택, 차례 처리, 매핑 확인, 결과) |
| **2-dashboard** (5) | `analytics-core`(summarize, compare, recurring) · `dashboard`(queries + UI + 월 선택 + 업로드 배너) · `transactions`(목록 + 카테고리 수정·override) · `settings-data`(업로드 목록·삭제, 전체 삭제) · `demo` |
| **3-pro** (5) | `entitlement-guard`(`requirePro`, 무료 1회) · `pro-views`(티저, 추이, 정기결제 목록) · `insights`(서비스 + UI + 마크다운 허용 목록) · `chat-api`(도구 2개, toolRunner, 상한, 거절) · `chat-ui` |
| **4-billing** (4, Polar 승인 후 실행) | `polar-service`(checkout, portal, state, verify) · `entitlement-sync`(`derivePlan`, sync, 웹훅, confirm) · `billing-ui`(pricing, success, 설정의 구독) · `account-deletion` |
| **5-launch** (6) | `landing` · `guide-page` · `legal-pages`(국외이전 표: Anthropic·Polar·Vercel, 보존 기간, "조언 아님" 고지) · `cleanup-cron` · `deploy-config`(`vercel.json`: `icn1`, cron, `maxDuration`, 보안 헤더·CSP) · `e2e-smoke` |

## 10. 사람이 직접 할 준비
- **지금**
  - Polar 사전 승인 문의를 보낸다.
  - ops clone과 private 폴더를 만든다.
- **0 이후**(ops clone에서)
  - Supabase 서울 리전에 dev·prod 프로젝트 2개를 만들고, `link`, `db push`, `gen types`를 실행한다.
  - 카카오 로그인을 설정한다("Allow users without an email"). 이때 카카오 이메일로 계정이 자동 연결되는지 확인한다.
  - 구글 OAuth를 설정한다.
  - 운영자 계정에 MFA를 켠다.
- **1 이후**
  - Anthropic 키를 발급하고 **월 지출 한도**를 건다.
  - ops clone에서 실제 파일로 대조 검증을 한다.
- **4 이후**: Polar sandbox를 설정한다.
  - 상품: ₩6,900 / $4.99
  - 조직 설정: 공개 checkout 링크 끄기, 고객당 구독 1개, 결제 실패 유예 7일
  - 웹훅 secret 발급
- **5 이후**
  - 가이드 문구(카드사별 다운로드 경로)를 직접 확인한다.
  - 무료 업타임 모니터를 붙인다.
- **런칭 전**
  - Polar production KYC
  - Vercel Pro, preview와 production의 env 분리, 도메인
  - 사업자등록·통신판매업 필요 여부, 개인정보보호책임자 지정, 법률 검토

## 11. 리스크
- **Polar 이용약관과 한국 정산 가능 여부(최대 리스크)**: 승인 전에는 4-billing을 실행하지 않는다. 결제 로직은 `services/billing`에 격리했으므로 업체를 바꿔도 된다.
- **Polar SDK가 preview 버전**: 버전을 고정하고, 문제가 생기면 REST API를 직접 호출한다.
- **수익성**: 수수료가 약 16.5%라 건당 순수익은 약 ₩5,700이다. AI 비용은 일일 상한과 콘솔 한도로 관리한다.
- **국내전용 카드는 결제할 수 없다**(H8로 측정).
- **법률 검토 필요**: 개인정보 국외이전, 신용정보법 적용 여부.
- **감수하기로 한 한계(MVP)**
  - 기간이 겹치는 업로드 중 하나를 지우면 다른 업로드와 공유하던 거래도 빠진다. 그 파일을 다시 올리면 복구된다.
  - 일일 상한은 동시 요청을 받으면 살짝 초과될 수 있다.
  - 동기 처리라서 매우 큰 파일은 느릴 수 있다. 1만 행 상한을 둔다.
- **PGlite로 RLS 테스트가 안 될 경우**: 사람이 `supabase start`로 통합 테스트를 돌려 대신한다.

## 12. 검증
1. **매 step**: lint(레이어 규칙 포함), build(env 없이), test(mock, PGlite)를 통과해야 한다.
2. **보안 핵심 테스트**
   - RLS 격리: A와 B는 서로의 데이터에 접근할 수 없다. `entitlements`는 수정할 수 없고, `ai_usage`는 삭제할 수 없으며, anon은 아무것도 할 수 없다.
   - 요청 위조와 리다이렉트: 다른 Origin에서 온 POST는 거부한다. `safeRedirect`는 입력 표로 검증한다.
   - AI로 보내는 데이터와 출력:
     - 마스킹 표를 검증한다(카드번호·전화번호·계좌 형식).
     - 마크다운에서 img와 a가 제거되는지 확인한다.
   - Storage와 로그:
     - 사용자 토큰으로 Storage에 접근하면 거부된다.
     - DB 에러 내용이 로그에 남지 않는다.
   - 권한과 결제:
     - Free 계정이 Pro API를 부르면 402를 받는다.
     - 웹훅 서명이 틀리면 403을 받는다.
3. **정확성 테스트**
   - fixture 전체를 파싱한다.
   - 같은 파일을 다시 올리거나 기간이 겹쳐도 중복이 생기지 않는다.
   - 추정 금액이 확정되면 같은 거래가 갱신된다.
   - confirm을 다시 호출해도 결과가 같다.
   - `derivePlan`을 상태별로 검증하고, 조건부 UPDATE가 순서 역전을 막는지 확인한다.
   - 기간이 지나면 Free로 바뀐다.
4. **여정 e2e**(7-2장의 ①~④): Playwright와 Polar sandbox로 돌린다.
5. **파서 대조**(ops clone에서 실제 파일로): 카드 6사 파일로 파싱한 순지출 합계가 명세서 합계와 같아야 한다.
6. **배포**: Preview(sandbox)에서 위 항목을 다시 확인하고, 보안 헤더를 점검한 뒤 production에서 smoke test를 한다.
