# Step 5: free-insight-claim

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (CRITICAL: Pro 기능은 서버의 `requirePro()`로만, `entitlements`는 admin만 쓴다)
- `/docs/ARCHITECTURE.md` (API 표의 `POST /api/insights`, "`server/admin.ts`가 export하는 함수"의 `adminEntitlements`)
- `/src/server/admin.ts`와 `/src/server/admin.test.ts` (`adminEntitlements.markFreeInsightUsed`: 없으면 행을 만들고, `free_insight_used_at IS NULL`일 때만 update하며, 이번 호출이 표시했으면 `true`)
- `/src/server/actions/insights.ts`와 `/src/server/actions/insights.test.ts` (`generateInsight`)
- `/src/server/auth.ts` (`getPlan`: `freeInsightAvailable`)

## 배경

무료 사용자의 "첫 AI 리포트 1회 무료" 크레딧은 지금 이 순서로 처리된다: 확인(`getPlan`) → Claude 호출 → 저장 → 차감(`markFreeInsightUsed`). 게다가 차감 함수가 돌려주는 `boolean`을 무시한다. 무료 사용자가 여러 달에 대해 동시에 요청하면 모든 요청이 확인을 통과해서, Sonnet 리포트를 여러 개 받는다.

## 작업

TDD로 진행한다.

### 1. `src/server/admin.ts` — `adminEntitlements`에 추가

```ts
releaseFreeInsight(userId: string): Promise<void>   // free_insight_used_at을 null로 되돌린다
```
- `.update({ free_insight_used_at: null }).eq("user_id", userId)`. 에러가 나면 기존 패턴대로 `internal()`을 부른다.
- 테스트: 호출 인자를 확인한다.

### 2. `src/server/actions/insights.ts` — `generateInsight` 순서 변경

1. `requireConsent`
2. `getPlan`. Pro도 아니고 크레딧도 없으면 `PRO_REQUIRED`
3. `assertDailyLimit("insight")`
4. 데이터 조회. 비었으면 `NO_DATA`
5. 지표 계산
6. **무료 사용자면 여기서 크레딧을 선점한다.** `const claimed = await adminEntitlements.markFreeInsightUsed(userId)`. `false`면 `AppError("PRO_REQUIRED")`를 던지고 Claude를 부르지 않는다.
7. `writeInsight` → `insights` upsert. **이 구간에서 예외가 나고 6에서 선점했다면** `releaseFreeInsight(userId)`로 되돌린 뒤 원래 에러를 다시 던진다. 되돌리기 자체가 실패하면 `logger.warn("insight.credit_release_failed", { code })`만 남기고 원래 에러를 던진다.
8. `recordAiUsage(userId, "insight", usage)`

- Pro 사용자는 6·7의 크레딧 처리를 하지 않는다.
- 테스트(`insights.test.ts`, 기존 mock 구조 유지):
  - **"runs … in order" 테스트의 기대 순서를 바꾼다.** 무료 사용자 기준으로 크레딧 선점이 `writeInsight`보다 먼저다.
  - **"does not save or consume credit after AI failure" 테스트의 기대를 바꾼다.** AI 실패 시 크레딧을 선점한 뒤 되돌리고, 저장하지 않는다. `markFreeInsightUsed`와 `releaseFreeInsight`는 각각 1번씩 불리고, `upsert`는 불리지 않는다.
  - 새 케이스: `markFreeInsightUsed`가 `false`를 돌려주면(동시 요청이 먼저 가져감) `PRO_REQUIRED`이고 `writeInsight`는 불리지 않는다.
  - 새 케이스: 저장(upsert)이 실패해도 크레딧을 되돌린다.
  - 기존 케이스 유지: Pro는 크레딧 함수를 부르지 않는다. 한도 초과와 `NO_DATA`면 Claude를 부르지 않는다.

### 3. `docs/ARCHITECTURE.md`

- "`server/admin.ts`가 export하는 함수"의 `adminEntitlements` 줄에 `releaseFreeInsight(userId)`를 추가한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `entitlements`를 admin client(`src/server/admin.ts`) 밖에서 쓰지 않는가?
   - 무료 사용자의 Claude 호출이 크레딧 선점 성공 뒤에만 일어나는가?
3. 결과에 따라 `phases/6-hardening/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `getPlan`·`requirePro`·`isProActive`의 판정 로직을 바꾸지 마라. 이유: 이 step은 인사이트 크레딧의 순서만 고친다.
- 크레딧 선점에 새 테이블, RPC, 잠금을 만들지 마라. 이유: 기존 조건부 update(`free_insight_used_at IS NULL`)가 이미 원자적이다.
- 인사이트·채팅의 일일 상한 경쟁(동시 요청으로 상한을 조금 넘는 것)은 고치지 마라. 이유: ADR-009가 허용한 트레이드오프다.
- 기존 테스트를 깨뜨리지 마라. 위에서 명시한 두 테스트의 기대값 변경만 허용한다.
