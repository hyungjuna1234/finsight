# Step 5: onboarding-steps

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/UX_GUIDE.md` §3-2 "점진적 공개"(온보딩 3단계 진행 표시), §4 "S2 가입", §10 B4, §8 `consent_done`
- `/docs/UI_GUIDE.md` (색·타이포, 중앙 정렬 금지)
- `/src/components/auth/login-panel.tsx`와 테스트
- `/src/app/(auth)/onboarding/consent/page.tsx`, `/src/components/auth/consent-form.tsx`와 테스트
- `/src/components/ui/track.ts` — step 1

## 배경

가입부터 첫 업로드까지는 로그인 → 동의 → 파일 받기 → 올리기로 이어진다. 끝이 보이면 덜 이탈한다(Figma "점진적 공개": 남은 단계를 알려 준다). 세 단계 진행 표시 `① 가입 → ② 파일 받기 → ③ 올리기`를 만들어 로그인·동의 화면에 붙인다. 업로드 화면에는 step 6에서 붙인다.

## 작업

TDD로 진행한다.

### 1. `src/components/ui/onboarding-steps.tsx` (새 서버 컴포넌트)
```tsx
export function OnboardingSteps({ current }: { current: 1 | 2 | 3 }): JSX.Element
```
- `<ol aria-label="시작 단계">` 안에 `가입`, `파일 받기`, `올리기`. 가로 한 줄(좁은 화면에서도 한 줄, `text-sm`), 단계 사이 짧은 선.
- 지난 단계: 체크 아이콘(인라인 SVG) + `text-muted`. 현재 단계: 번호 원 `bg-accent text-white` + 굵은 글 + `aria-current="step"`. 다음 단계: 번호 원 테두리 + `text-muted`.
- 왼쪽 정렬.

### 2. 붙이기
- `LoginPanel` 제목 위에 `<OnboardingSteps current={1} />`.
- 동의 페이지(`onboarding/consent/page.tsx`) 제목 위에 `<OnboardingSteps current={1} />`(페이지에는 이 한 줄만 추가한다).

### 3. `ConsentForm`
- 동의 저장이 성공하면 `/upload`로 가기 전에 `trackEvent("consent_done", {})`를 보낸다. 실패하면 보내지 않는다.

### 4. 테스트
- `OnboardingSteps`: 세 단계 이름, `current`에만 `aria-current="step"`, 지난 단계 수만큼 체크 아이콘.
- `LoginPanel`: 진행 표시가 있고 1단계가 현재다.
- `ConsentForm`: 성공 시 `consent_done` 한 번, 실패 시 없음(`vi.mock("@vercel/analytics")`).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 진행 표시가 색만으로 상태를 전하지 않는가(체크 아이콘·`aria-current`)?
   - 동의 페이지에 로직을 추가하지 않았는가?
3. 결과에 따라 `phases/8-ux-p0/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 로그인 버튼(카카오·구글)의 모양·순서·링크를 바꾸지 마라. 이유: OAuth 흐름과 테스트가 기대고 있고, 카카오 브랜드 가이드 문제는 별도 과제다.
- 동의 항목·문구·버튼 이름("시작하기")을 바꾸지 마라. 이유: 버튼 문구는 P1 백로그(B8)이고, 동의 문구는 법무 검토 대상이다.
- 업로드 화면을 바꾸지 마라. 이유: step 6의 범위다.
- 기존 테스트를 깨뜨리지 마라.
