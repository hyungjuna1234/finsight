# Step 2: legal-pages

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/PRD.md`, `/docs/ARCHITECTURE.md` (저장하는 데이터, Storage, 외부 서비스), `/docs/ADR.md` (ADR-002·007·008)
- `/plan.md` 2장(보관), 4-5장(DB), 11장(법률 검토 필요)
- `/src/lib/domain/consent.ts` (0-foundation: 동의 항목 링크 `/privacy`, `/privacy#overseas`, `/terms`)
- `/src/lib/domain/pricing.ts` (4-billing 가격), `/src/components/marketing/site-footer.tsx` (Step 0)
- `/src/app/(marketing)/layout.tsx`

## 작업

개인정보 처리방침·이용약관·환불 정책의 **초안**을 정적 페이지로 만든다. 사람이 법률 검토 후 확정한다(plan.md 10·11장). 모르는 사실은 지어내지 말고 `[TODO: …]`로 남긴다. TDD로 진행한다.

### 1. `src/lib/domain/legal.ts` (순수, `legal.test.ts` 먼저)
```ts
export const LEGAL_DRAFT_NOTICE = "초안 — 법률 검토 전";
export const EFFECTIVE_DATE = "[TODO: 시행일]";
export const BUSINESS_INFO: { name; owner; registrationNo; mailOrderNo; address; email; privacyOfficer } // 전부 string
```
- 값은 전부 `[TODO: 상호]`, `[TODO: 대표자]`, `[TODO: 사업자등록번호]`, `[TODO: 통신판매업 신고번호]`, `[TODO: 주소]`, `[TODO: 문의 이메일]`, `[TODO: 사람 입력]`(보호책임자)처럼 둔다.
- 테스트는 빈 값이 없는지만 본다. 사람이 값을 채워도 깨지지 않게 한다.

### 2. 컴포넌트 `src/components/marketing/legal/` (각각 `.test.tsx` 먼저)
- `legal-document.tsx` — props `{ title: string; children }`
  - 제목 아래에 눈에 띄는 고지 박스(`role="note"`, `border-line`, 텍스트 `text-warning`)를 둔다. 내용은 `LEGAL_DRAFT_NOTICE`와 "시행일 {EFFECTIVE_DATE}".
  - 본문 `h2`에는 id를 붙인다.
- `privacy-policy.tsx` — 개인정보 처리방침
  1. `#items` 수집 항목
     - 로그인: 카카오·구글 계정 식별자, 이메일(있을 때)
     - 업로드: 카드 이용내역 파일과 거기서 뽑은 이용일·가맹점명·금액·할부·승인번호·카드번호 끝 4자리. 카드번호는 끝 4자리만 저장한다.
     - 결제: 구독 상태·기간. 카드 정보는 Polar가 직접 받는다.
     - 자동 수집: 접속 기록, 쿠키 없는 방문 통계(Vercel Web Analytics)
  2. `#purpose` 이용 목적: 지출 분류·요약, Pro 기능 제공, 결제·구독 관리, 남용 방지
  3. `#retention` 보유 기간
     - 원본 파일은 올린 뒤 **90일**에 자동 삭제
     - 거래·분류 결과는 사용자가 삭제할 때까지
     - **탈퇴하면 즉시 삭제**
     - 결제 기록은 Polar가 관련 법령에 따라 보관
  4. `id="overseas"` **국외 이전** 표. 열: 이전받는 자 · 국가 · 항목 · 목적 · 시기와 방법 · 보유 기간
     - Anthropic PBC · 미국 · 가맹점명, 월별 집계값, 마스킹된 표 샘플(헤더+5행), 채팅 질문 · AI 분류·요약·답변 · 기능을 쓸 때 API로 전송 · "Anthropic API 데이터 보존 정책에 따름 [TODO: 정책 링크·기간 확인]"
     - Polar (법인명 `[TODO: 확인]`) · 미국 · 이메일, 결제 정보 · 결제·구독 관리(판매 대행) · 결제할 때 · 관련 법령에 따른 기간
     - Vercel Inc. · 미국 · 접속 기록과 요청 처리 데이터 · 호스팅 · 서비스를 쓸 때 · `[TODO: 확인]`
     - 표 아래: "데이터베이스·파일은 Supabase 서울 리전(대한민국)에 저장해요." "국외 이전에 동의하지 않으면 서비스를 이용할 수 없어요. 동의를 철회하려면 탈퇴해 주세요."
  5. `#processors` 처리 위탁: Supabase(인증·DB·파일 저장, 서울 리전), Vercel(호스팅), Anthropic(AI 처리), Polar(결제)
  6. `#rights` 권리 행사
     - 설정에서 열람·업로드 삭제·전체 삭제·탈퇴
     - 그 밖의 요청은 `BUSINESS_INFO.email`로
  7. `#destruction` 파기 절차
  8. `#security` 안전성 확보 조치: 전송 암호화, 본인 데이터만 접근(RLS), 비공개 저장소, 로그에 거래 내용을 남기지 않음, 세션 쿠키는 httpOnly
  9. `#officer` 개인정보 보호책임자: `BUSINESS_INFO.privacyOfficer`
- `terms-of-service.tsx` — 이용약관
  - `#scope` 서비스 범위: 사용자가 올린 카드 이용내역을 분류·요약·표시
  - `#not-advice` "재무·투자·세무 조언이 아님". AI 요약에 오류가 있을 수 있으니 원본 명세서를 기준으로 삼는다.
  - `#account` 계정과 탈퇴
  - `#paid` 유료 서비스(월 구독, `/refund` 링크)
  - `#prohibited` 금지 행위: 타인의 명세서 업로드, 자동화된 대량 요청, 역설계·보안 우회, 서비스 방해
  - `#liability` 책임 제한
  - `#changes` 변경·중단
  - `#law` 준거법·분쟁 `[TODO]`
  - `#business` 사업자 정보(`BUSINESS_INFO`)
- `refund-policy.tsx` — 환불 정책
  - 월 구독 `formatKRW(PRO_MONTHLY_KRW)`(Polar가 표시 통화로 청구)
  - 언제든 해지할 수 있고, 해지하면 결제 기간 끝까지 Pro, 그 뒤 Free
  - **결제 후 7일 이내 Pro 기능(AI 리포트·채팅)을 쓰지 않았으면 전액 환불**
  - 환불은 판매 대행자(Merchant of Record)인 **Polar를 통해** 처리하고, 요청은 `BUSINESS_INFO.email`로
  - 결제 실패 시 7일 유예 후 Free
- 테스트: 각 문서가 핵심 섹션 제목과 초안 고지를 렌더링하는지 본다. privacy는 `#overseas` 표에 Anthropic·Polar·Vercel 행이 있는지와 "90일"·"탈퇴" 문구를, terms는 "조언이 아님" 문구를, refund는 "7일"과 "Polar" 문구를 확인한다.

### 3. 페이지 (정적, 조합만)
- `src/app/(marketing)/privacy/page.tsx`, `terms/page.tsx`, `refund/page.tsx`: 각각 `LegalDocument` + 본문 컴포넌트를 렌더링하고 `metadata.title`을 넣는다.
- `src/components/marketing/site-footer.tsx`: 사업자 정보 한 줄(`BUSINESS_INFO`의 상호·대표자·사업자등록번호·통신판매업 신고번호·이메일)을 추가하고 테스트를 고친다.
- `src/lib/domain/consent.ts`의 링크(`/privacy`, `/privacy#overseas`, `/terms`)가 실제 id와 맞는지 확인한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 세 페이지 모두 "초안 — 법률 검토 전" 고지가 보이는가?
   - 사업자 정보·보호책임자·시행일이 `[TODO]`로 남아 있고 지어낸 값이 없는가?
   - 국외 이전 표의 항목이 실제 전송 데이터(ARCHITECTURE의 "Claude에는 최소 데이터만")와 일치하는가?
3. 결과에 따라 `phases/5-launch/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` ("법률 검토·TODO 입력은 사람 몫"을 포함한다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 사업자 정보, 법인명, 보존 기간, 연락처를 지어내지 마라. 이유: 법적 고지에 허위 사실이 들어간다. 모르면 `[TODO]`.
- 실제 전송하지 않는 데이터를 적거나, 전송하는 데이터(가맹점명·집계값·마스킹 샘플·채팅 질문)를 빼지 마라. 이유: 국외 이전 고지는 사실과 정확히 같아야 한다.
- "완전히 안전", "절대 유출되지 않음" 같은 보장 문구를 쓰지 마라. 이유: 책임 문제가 생기고 신뢰를 잃는다.
- 초안 고지를 작게 숨기거나 빼지 마라. 이유: 법률 검토 전 문서임을 사용자와 운영자 모두 알아야 한다.
- 기존 테스트를 깨뜨리지 마라.
