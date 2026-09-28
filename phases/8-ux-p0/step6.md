# Step 6: upload-guide

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (컴포넌트는 표시 데이터를 props로만 받는다. 쓰기·AI 호출은 `apiFetch`로 우리 `/api/*`만)
- `/docs/UX_GUIDE.md` **§4 "S3 파일 확보"**(이탈 원인과 대응 표, 화면 구성), §10 B3, §8 `guide_open`·`link_copy`
- `/src/lib/domain/guides.ts`와 테스트 (`ISSUER_GUIDES`, `IssuerId`, `issuerGuide`)
- `/src/components/upload/upload-flow.tsx`와 테스트 (`hasUploads`로 첫 방문을 안다)
- `/src/app/(app)/upload/page.tsx`
- `/src/components/marketing/issuer-guide-list.tsx`와 테스트 (`/guide` 페이지가 쓴다)
- `/src/components/marketing/copy-link-button.tsx`와 테스트
- `/src/components/ui/onboarding-steps.tsx`(step 5), `/src/components/ui/track.ts`(step 1)

## 배경

가장 큰 이탈 지점은 파일 확보(S3)다. 사용자는 FinSight를 떠나 카드사 홈페이지에서 파일을 받아 와야 하고, 휴대폰에서는 엑셀 저장이 어렵다. 그래서 받는 법을 업로드 화면 **안에서** 바로 펼쳐 보여 주고, 휴대폰이면 PC로 이어 가는 방법을 먼저 알려 준다. 받는 법에는 "최근 3개월"을 넣어 첫 업로드부터 전월 비교·정기결제가 채워지게 한다(B3).

## 작업

TDD로 진행한다.

### 1. `src/lib/domain/guides.ts`
`issuerGuide`의 4단계 문구를 바꾼다:
1. `{name} 홈페이지에 로그인해요.`
2. `'이용내역 조회' 메뉴로 가요. '청구서(명세서)'가 아니라 '이용내역'이에요.`
3. `기간은 최근 3개월로 골라 조회해요.`
4. `'엑셀 저장' 또는 '파일 다운로드'를 눌러요. 암호를 걸었다면 풀고 저장해요.`
`verifiedAt`은 그대로 `null`이다(사람이 카드사별로 확인한 뒤 넣는다).

### 2. `src/components/upload/issuer-picker.tsx` (새 클라이언트 컴포넌트)
```tsx
export function IssuerPicker({ guides }: { guides: readonly IssuerGuide[] }): JSX.Element
```
- 카드사 이름 칩(버튼, `aria-pressed`)을 한 줄로 나열한다. 하나를 고르면 그 카드사의 4단계를 번호 목록으로 바로 아래에 펼친다. 다시 누르면 접힌다. 처음에는 아무것도 고르지 않은 상태다.
- 펼칠 때 `trackEvent("guide_open", { issuer, where: "upload" })`.
- 맨 아래 Text 링크 `카드사별 자세히 보기` → `/guide`.

### 3. `src/components/upload/upload-flow.tsx` — 첫 방문(`hasUploads === false`)
지금의 안내 블록("카드사 홈페이지에서 받은 이용내역 파일을 올려 주세요 / 파일은 어디서 받나요?")을 다음으로 바꾼다:
- `<OnboardingSteps current={2} />`
- 구역 **② 파일 받기**(`h2`): 한 줄 `카드사 홈페이지에서 '이용내역'을 최근 3개월로 받아요.` → 좁은 화면 전용 블록(`md:hidden`): `휴대폰에서는 엑셀 저장이 어려워요. PC에서 이어서 해 주세요.` + `CopyLinkButton path="/upload" label="PC에서 열 링크 복사"` + `카카오톡 '나와의 채팅'에 붙여 두면 PC에서 바로 열 수 있어요.` → `IssuerPicker`
- 구역 **③ 올리기**(`h2`): 기존 카드 이름 필드 + 파일 선택 + 처리 목록(동작은 그대로).
- 두 번째 방문부터(`hasUploads === true`): 진행 표시와 ② 구역 없이 지금처럼 카드 이름·파일 선택을 보이고, 그 위에 Text 링크 `파일은 어디서 받나요?` → `/guide` 한 줄만 둔다.
- `ISSUER_GUIDES`는 `upload/page.tsx`에서 props(`guides`)로 넘긴다(페이지에는 import와 prop 전달만 추가한다).

### 4. 이벤트
- `CopyLinkButton`: 클립보드 복사가 성공하면 `trackEvent("link_copy", {})`. 실패(대체 입력칸 표시)면 보내지 않는다.
- `IssuerGuideList`(`/guide`): 카드사 `details`가 **열릴 때** `trackEvent("guide_open", { issuer: guide.id, where: "guide" })`. 이를 위해 클라이언트 컴포넌트로 바꾼다(`onToggle`에서 `open`일 때만).

### 5. 테스트
- `guides.test.ts`: 모든 카드사 3단계에 `최근 3개월`, 2단계에 `이용내역`이 있다.
- `IssuerPicker`: 처음에 단계 목록 없음 → 칩을 누르면 그 카드사 4단계 표시와 `guide_open { where: "upload" }` → 다시 누르면 접힘.
- `UploadFlow`: 첫 방문엔 진행 표시(2단계 현재)·②·③ 제목·PC 링크 복사 버튼이 있다. 두 번째 방문엔 없고 `/guide` 링크 한 줄만 있다. 파일 업로드 동작 테스트는 그대로 통과한다.
- `CopyLinkButton`: 성공 시 `link_copy` 한 번.
- `IssuerGuideList`: 열 때만 `guide_open { where: "guide" }`.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 업로드 파이프라인(해시·PUT·analyze·confirm) 코드를 바꾸지 않았는가?
   - 이벤트 props가 `issuer`·`where`뿐인가?
   - 한 화면의 accent 채움 버튼이 1개 이하인가(파일 선택 버튼)? `IssuerPicker` 칩과 PC 링크 복사는 Secondary 모양이어야 한다.
3. 결과에 따라 `phases/8-ux-p0/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 업로드 처리 로직(`upload-pipeline.ts`, API 호출 순서, 매핑 확인)을 바꾸지 마라. 이유: 이 step은 안내 화면만 다룬다. 드롭 영역·파일별 단계 표시(B12)는 P1이다.
- 카드사 메뉴 경로를 지어내지 마라(예: "마이페이지 > 이용내역"). 이유: 실제 경로는 사람이 확인해 `verifiedAt`과 함께 넣는다. 지금은 공통 4단계만 쓴다.
- 사용자 기기를 서버에서 판별(User-Agent)하지 마라. 이유: 좁은 화면 안내는 CSS(`md:hidden`)로 충분하다.
- 기존 테스트를 깨뜨리지 마라. 바뀐 안내 문구에 맞춰 테스트를 고치는 것은 허용한다.
