# Step 7: funnel-events

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (이벤트·로그에 거래·가맹점·금액·파일 내용 금지)
- `/docs/UX_GUIDE.md` **§8 "측정"** (이벤트 표와 지표 H1~H9)
- `/src/components/ui/track.ts` — step 1 (`trackEvent`, `AnalyticsEvents`)
- `/src/components/marketing/demo-banner.tsx`와 테스트
- `/src/components/upload/upload-flow.tsx`, `mapping-review.tsx`와 각 테스트 (step 6에서 바뀐 upload-flow 포함)
- `/src/components/dashboard/category-sheet.tsx`와 테스트
- `/src/components/pro/generate-insight-button.tsx`와 테스트, `/src/app/(app)/insights/page.tsx`
- `/src/components/ui/api-fetch.ts` (`ApiError.code`)

## 배경

UX_GUIDE §8의 퍼널 이벤트 중 남은 것을 붙인다(B6). 이미 붙은 것: `landing_cta`, `landing_section_view`, `checkout_start`, `checkout_pro_active`, `insight_feedback`, `consent_done`(step 5), `guide_open`·`link_copy`(step 6), `next_step_click`·`pro_teaser_click`(step 3·4). 모든 이벤트는 `trackEvent`로 보내고, props는 enum 문자열과 불리언뿐이다.

## 작업

TDD로 진행한다. 각 컴포넌트에 이벤트만 추가하고 동작은 바꾸지 않는다.

1. **`demo_cta`** — `DemoBanner`의 `내 데이터로 시작` 링크를 `TrackedLink`로 바꿔 클릭 때 보낸다.
2. **`upload_done { auto, first }`** — `UploadFlow`에서 파일 하나가 확정(`stage: "done"`)될 때마다 보낸다. `auto`는 그 파일이 매핑 확인 없이 자동 확정됐는지(`analysis.autoConfirm`), `first`는 이 사용자의 첫 완료인지(`hasUploads === false`이고 이 화면에서 아직 완료된 파일이 없을 때 `true`).
3. **`upload_error { code }`** — `UploadFlow`에서 파일이 `error` 단계로 갈 때 `ApiError.code`(네트워크는 `"NETWORK"`)로 보낸다. `FilePicker`의 클라이언트 검증 거부는 보내지 않는다(서버에 닿지 않은 선택 실수).
4. **`mapping_changed`** — `MappingReview`에서 저장할 때, 헤더 행이나 날짜·가맹점·금액·선택 열 중 하나라도 처음 받은 AI 추정(`mapping`)과 다르면 한 번 보낸다. AI 추정이 없었으면(`mapping === null`) 보내지 않는다.
5. **`category_edit { scope }`** — `CategorySheet`에서 저장이 성공했을 때 `"one"` 또는 `"merchant"`로 보낸다. 실패하면 보내지 않는다.
6. **`insight_generate { free }`** — `GenerateInsightButton`에 `free?: boolean` prop을 추가하고, 생성이 성공했을 때 보낸다. `/insights` 페이지는 `free={!data.plan.isPro}`만 넘긴다.

테스트(`vi.mock("@vercel/analytics")` 또는 `@/components/ui/track` mock): 각 이벤트가 성공 조건에서 정확한 props로 한 번 나가고, 실패·해당 없음 조건에서는 나가지 않는다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 어떤 이벤트에도 파일명·가맹점·카테고리 이름·금액·에러 메시지 원문이 들어가지 않는가?
   - 이벤트 전송 실패가 업로드·저장 동작을 막지 않는가(`trackEvent`는 예외를 삼킨다)?
   - UX_GUIDE §8 표의 이벤트가 모두 어딘가에서 보내지는가(`rg "trackEvent\\(|track\\(" src`로 확인)?
3. 결과에 따라 `phases/8-ux-p0/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (§8 이벤트 중 빠진 것이 있으면 이름을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 이벤트 props에 숫자(건수·금액)나 자유 문자열을 넣지 마라. 이유: AGENTS.md와 UX_GUIDE §8 규칙(enum·불리언만).
- 서버 쪽 이벤트나 DB 로깅을 추가하지 마라. 이유: 이 phase는 클라이언트 `track()`과 기존 DB 집계만 쓴다.
- 업로드·매핑·분류·리포트의 동작이나 문구를 바꾸지 마라. 이유: 이 step은 계측만 추가한다.
- 기존 테스트를 깨뜨리지 마라.
