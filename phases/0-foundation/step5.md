# Step 5: consent-gate

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/USER_FLOWS.md` (① 동의 단계, 인증 예외)
- `/docs/ARCHITECTURE.md` (`consents` 테이블, API 표의 `/api/consents`)
- `/docs/UI_GUIDE.md`
- `/src/server/handler.ts`, `/src/server/auth.ts`, `/src/components/ui/api-fetch.ts` (Step 2, 3)
- `/src/app/(app)/layout.tsx`, `/src/components/auth/login-panel.tsx` (Step 4)
- `/supabase/migrations/20260926000000_init.sql` (`consents` 정의)

## 작업

필수 동의 4개를 개별로 받고, 동의가 없으면 앱 기능과 AI 호출을 막는다. TDD로 진행한다.

### 1. `src/lib/domain/consent.ts`
```ts
export const CONSENT_VERSION = "2026-09";
export const CONSENT_ITEMS: readonly { kind: ConsentKind; label: string; summary: string; href?: string }[];
// kind: 'privacy' | 'overseas_transfer' | 'terms' | 'age14'
export function missingConsents(agreed: { kind: string; version: string }[]): ConsentKind[]
```
- 라벨·요약(한국어):
  - `privacy` 개인정보 수집·이용 — "로그인 정보와 올린 카드 이용내역을 지출 정리에만 써요." (`/privacy`)
  - `overseas_transfer` 개인정보 국외 이전 — "분류·요약을 위해 가맹점명과 집계값을 Anthropic(미국)에, 결제 정보를 Polar(미국)에 보내요. 카드번호는 보내지 않아요." (`/privacy#overseas`)
  - `terms` 이용약관 (`/terms`)
  - `age14` 만 14세 이상이에요
- `missingConsents`는 **현재 `CONSENT_VERSION`과 같은 버전**만 인정한다(버전이 바뀌면 다시 동의).

### 2. `src/server/actions/consents.ts`
- `recordConsents(userId, kinds: ConsentKind[])`: 4개가 모두 있어야 한다. `age14`가 빠지면 `AppError('UNDERAGE')`, 그 외 누락은 `VALIDATION_FAILED`. 사용자 권한 client(`createServerSupabase`)로 4행 insert(버전 = `CONSENT_VERSION`).
- `getConsentStatus(userId)`: 누락 목록 반환.

### 3. `src/server/auth.ts`에 추가
- `requireConsent(userId: string): Promise<void>` — 누락이 있으면 `AppError('CONSENT_REQUIRED')`.

### 4. `src/server/handler.ts` 확장
- `HandlerOptions`에 `consent?: boolean` 추가. `auth: "user"`이고 `consent: true`면 인증 다음에 `requireConsent`를 부른다. 테스트 추가.

### 5. `src/app/api/consents/route.ts` — `POST`
- `handler({ auth: "user", body: z.object({ kinds: z.array(z.enum([...])) }) }, …)` → `recordConsents` → 204.

### 6. 동의 화면
- `src/app/(auth)/onboarding/consent/page.tsx`: 로그인 필수(`getOptionalUser` 없으면 로그인으로). 이미 모두 동의했으면 `/dashboard`로. 아니면 `ConsentForm`에 `CONSENT_ITEMS`를 props로 넘긴다.
- `src/components/auth/consent-form.tsx`(client): 4개 체크박스 **개별** + [모두 동의] 편의 체크박스. 모두 체크해야 [시작하기] 활성화. 제출 → `apiFetch('/api/consents')` → 성공 시 `/upload`로 이동(거래가 있으면 대시보드 판단은 Step 이후 페이지가 한다). [동의하지 않고 나가기] → `POST /auth/signout`.
  - 체크하지 않은 항목이 있으면 버튼 아래 한 줄: "필수 항목에 모두 동의해야 이용할 수 있어요."
- `consent-form.test.tsx`로 개별 체크·모두 동의·버튼 활성화·제출 호출을 검증.

### 7. `src/app/(app)/layout.tsx` 수정
- 로그인 확인 뒤 `getConsentStatus`로 누락이 있으면 `redirect('/onboarding/consent')`. (UX용. 실제 강제는 API의 `consent: true`와 이후 queries가 한다.)

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 동의 4개가 하나의 "전체 동의"로만 저장되지 않고 **개별 행**으로 저장되는가?
   - `consents`에 update/delete 경로가 없는가?
   - `handler`의 `consent: true`가 인증 뒤에 실행되는가?
3. 결과에 따라 `phases/0-foundation/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 체크박스를 미리 체크된 상태로 두지 마라. 이유: 개인정보보호법상 동의는 사용자가 직접 표시해야 한다.
- 국외 이전 동의를 다른 항목과 합치지 마라. 이유: 법적으로 별도 동의가 필요하다.
- 동의 철회·수정 API를 만들지 마라. 이유: MVP에서 필수 동의 철회는 탈퇴로 처리한다(4-billing의 account-deletion).
- 마케팅 수신 동의 같은 선택 항목을 추가하지 마라. 이유: MVP 범위 밖(리마인더 없음).
- 기존 테스트를 깨뜨리지 마라.
