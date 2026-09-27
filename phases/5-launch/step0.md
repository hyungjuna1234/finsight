# Step 0: landing

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/UI_GUIDE.md` (**AI 슬롭 안티패턴**, 레이아웃, 타이포그래피, 문구) — 이 step의 최우선 기준
- `/docs/PRD.md` (포지셔닝 문구, 핵심 기능) · `/docs/USER_FLOWS.md` (① 첫 방문)
- `/src/app/layout.tsx`, `/src/app/page.tsx` (임시 홈 — 이 step에서 없앤다), `/src/app/globals.css` (색 토큰)
- `/src/app/(marketing)/` 아래 기존 파일 (2-dashboard `demo/`, 4-billing `pricing/`, 있으면 `layout.tsx`)
- `/src/lib/domain/pricing.ts` (4-billing: `PRO_MONTHLY_KRW`, `PLAN_FEATURES`), `/src/lib/domain/money.ts`
- `/src/lib/demo/fixtures.ts`, `/src/components/dashboard/*` (2-dashboard, 선택적으로 재사용)
- `node_modules/@vercel/analytics/package.json`(exports의 `./next`)와 `node_modules/@vercel/analytics/dist/next/index.d.mts`

## 작업

### 0. 사전 확인
`src/lib/domain/pricing.ts`와 `src/app/(marketing)/pricing/page.tsx`가 없으면(4-billing 미실행) `"status": "blocked"`, `"blocked_reason": "4-billing 미완료 — 가격 표기 원본(pricing.ts)과 /pricing이 없음"`으로 두고 중단한다.

### 1. 마케팅 컴포넌트 `src/components/marketing/` (각각 `.test.tsx` 먼저, props·정적 문구만)
- `site-header.tsx`: 로고 "FinSight"(→ `/`) · [요금 `/pricing`] [가이드 `/guide`] [로그인 `/login`]
- `site-footer.tsx`
  - 링크: 개인정보 처리방침 `/privacy` · 이용약관 `/terms` · 환불 정책 `/refund` · 가이드 `/guide`
  - 한 줄: "지출 정리를 돕는 서비스예요. 재무·투자·세무 조언을 하지 않아요."
- `hero.tsx` (**좌측 정렬**, 제목만 `text-4xl`)
  - h1 "카드 이용내역 파일만 올리면, 한 달 지출이 정리돼요"
  - 보조 문구 "연동 없이 카드사 홈페이지에서 받은 파일만 올려요."
  - 버튼 두 개: [무료로 시작](Primary, `/login?next=%2Fupload`) [예시 보기](Secondary, `/demo`)
  - 선택: 오른쪽(모바일은 아래)에 `/demo`의 요약 타일을 `src/lib/demo/fixtures.ts` 데이터로 재사용해 실제 화면을 보여 준다. 장식 일러스트는 쓰지 않는다.
- `trust-points.tsx`: 보안 3줄. 문구를 바꾸지 않는다.
  1. "연동 없음 · 카드사에서 받은 파일만 올려요"
  2. "원본은 90일 후 자동 삭제 · 언제든 전부 삭제할 수 있어요"
  3. "AI에는 가맹점명과 집계값만 보내요 · 카드번호는 보내지 않아요"
- `how-it-works.tsx`: 번호 매긴 3단계(`<ol>`)
  1. 카드사 홈페이지에서 '이용내역'을 엑셀로 받아요 — [받는 법](`/guide`)
  2. 파일을 올리면 열을 맞추고 카테고리를 자동으로 나눠요
  3. 한 달 총지출, 카테고리, 많이 쓴 곳 TOP5를 바로 봐요
- `pricing-summary.tsx`
  - Free "₩0 · 업로드·분류·월별 대시보드", Pro `formatKRW(PRO_MONTHLY_KRW)`/월 "AI 리포트·Q&A 채팅·추이·정기결제"
  - [요금 자세히](`/pricing`), 해외결제 카드 필요 한 줄
- `faq.tsx`: `<details>/<summary>`(JS 없음) 5개
  - 지원 카드사: 신한·삼성·현대·KB국민·롯데·하나 홈페이지의 이용내역 CSV·엑셀. 형식이 비슷하면 다른 카드사도 대부분 돼요.
  - 파일 받는 법: [가이드](`/guide`)
  - 결제 카드: 해외결제 가능한 VISA·Mastercard가 필요해요. 국내전용 카드는 결제되지 않아요.
  - 데이터 삭제: 설정에서 업로드별 삭제·전체 삭제·탈퇴를 할 수 있어요. 원본은 90일 후 자동 삭제돼요.
  - 투자 조언: 아니요. 지출 정리를 돕는 요약이고 재무·투자·세무 조언을 하지 않아요.
- `ui-guide.test.tsx`: 위 컴포넌트를 모두 렌더링하고 `container.innerHTML`에 금지 클래스가 없는지 검사한다.
  - 금지 클래스: `backdrop-blur`, `bg-gradient`, `bg-clip-text`, `blur-3xl`, `rounded-2xl`, `purple`, `indigo`, `violet`, `animate-`
  - 금지 문구: "Powered by AI", 반짝이 이모지(U+2728)

### 2. 페이지·레이아웃
- `src/app/page.tsx`를 **삭제**하고 `src/app/(marketing)/page.tsx`를 만든다. 같은 `/` 경로가 두 개면 빌드가 실패한다.
- 페이지 구성: Hero → TrustPoints → HowItWorks → PricingSummary → FAQ. 섹션 사이는 `space-y-8`, 폭은 `max-w-5xl px-4`. `metadata`의 title·description을 넣는다.
- `src/app/(marketing)/layout.tsx`: 없으면 만들고, 있으면 수정한다. `SiteHeader` + `children` + `SiteFooter`. `/demo`·`/pricing`에도 같은 머리말·꼬리말이 붙는지 확인한다. 2-dashboard가 `/demo` 페이지 안에 둔 간단한 헤더(로고·[내 데이터로 시작])는 지운다(머리말이 두 번 나오지 않게. [내 데이터로 시작]은 `DemoBanner`에 이미 있다).
- 랜딩은 정적 페이지다. 로그인 여부를 읽지 않는다(`cookies()`·`getOptionalUser` 금지).

### 3. Vercel Analytics
- `src/app/layout.tsx`의 `<body>` 끝에 `<Analytics />`를 넣는다. import는 `import { Analytics } from "@vercel/analytics/next";`.
- 설치된 패키지(2.0.1)의 exports에 `./next`가 있고 `Analytics`는 `"use client"` 컴포넌트다. 쓰기 전에 다시 확인하라.
- 스크립트는 운영에서 같은 오리진 `/_vercel/insights/script.js`, 개발에서 `https://va.vercel-scripts.com`을 쓴다. CSP는 5-launch deploy-config에서 이에 맞춘다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - UI_GUIDE의 AI 슬롭 안티패턴을 하나도 쓰지 않았는가(`ui-guide.test.tsx` 통과)? 히어로가 좌측 정렬인가?
   - 포인트 색(`bg-accent`)이 주 행동([무료로 시작]) 하나에만 쓰였는가?
   - 가격이 `pricing.ts`에서 오는가? `src/app/page.tsx`가 없어졌는가?
3. 결과에 따라 `phases/5-launch/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 그라데이션, blur, 글로우, 보라·인디고, 이모지 아이콘, 중앙 정렬 히어로, "Powered by AI" 배지를 쓰지 마라. 이유: UI_GUIDE의 AI 슬롭 안티패턴. 도구처럼 보여야 신뢰를 얻는다.
- "연동", "안전" 같은 말을 과장하거나 근거 없는 수치(사용자 수, 정확도 %)를 쓰지 마라. 이유: 신뢰가 먼저이고 허위 광고가 될 수 있다.
- 랜딩에서 Supabase 세션을 읽지 마라. 이유: 정적 페이지로 두어야 빠르고, env 없이 빌드된다.
- 외부 이미지·폰트·스크립트(CDN)를 추가하지 마라. 이유: CSP가 `'self'` 기준이고 새 의존성 금지.
- Analytics 커스텀 이벤트에 금액·가맹점·이메일을 넣지 마라. 이유: PRD 측정 원칙.
- 기존 테스트를 깨뜨리지 마라.
