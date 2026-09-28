# Step 4: classify-cap

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (CRITICAL: Claude 호출 전에는 `requireConsent()`와 일일 상한을 확인하고, 호출 후 `ai_usage`에 기록한다)
- `/docs/ARCHITECTURE.md` ("업로드 처리"의 confirm·recategorize, "데이터베이스" 절의 일일 상한 줄, 에러 코드 429)
- `/docs/ADR.md` (ADR-005 분류 순서, ADR-009 일일 상한)
- `/src/server/limits.ts`와 `/src/server/limits.test.ts` (`DAILY_LIMITS`, `assertDailyLimit`, `recordAiUsage`)
- `/src/server/actions/categorize.ts`와 테스트 (`categorizeTransactions`, AI 배치 루프)
- `/src/server/actions/uploads.ts`와 테스트 (`categorizePending`, `confirmUpload`, `recategorizeUpload`)
- `/src/services/claude/models.ts` (`AiFeature`에 `classify`가 이미 있다)

## 배경

분류(Haiku) 호출에는 일일 상한이 없다. 지금은 업로드 상한(하루 30개)이 간접적으로 막고 있다. 그런데 이 상한은 `uploads` 행 수로 세고, 사용자는 자기 업로드를 삭제할 수 있다. 가맹점 1만 개짜리 파일을 올리고 지우고 다시 올리면 Haiku 호출이 무제한으로 나간다.

`ai_usage`는 사용자가 INSERT만 할 수 있고 지울 수 없다. 그래서 분류 상한을 `ai_usage`로 세면 우회할 수 없다. 분류는 배치(최대 100개)마다 `ai_usage` 1행이 기록된다(`recordAiUsage(userId, "classify", usage)`).

## 작업

TDD로 진행한다.

### 1. `src/server/limits.ts`

```ts
export const DAILY_LIMITS = { uploads: 30, mapping: 30, classify: 100, insight: 10, chat: 30 } as const;
export async function remainingDailyQuota(userId: string, kind: LimitKind, now?: Date): Promise<number>  // max(0, 상한 − 오늘(KST) 사용 수)
export async function assertDailyLimit(userId: string, kind: LimitKind, now?: Date): Promise<void>       // 기존 동작 유지, remainingDailyQuota를 재사용
```
- `classify`는 `ai_usage`에서 `feature = 'classify'`인 오늘 행 수를 센다. `uploads`만 `uploads` 테이블로 세는 기존 분기는 유지한다.
- `classify: 100`은 배치 100개(가맹점 약 1만 개)다. 최대 크기 파일 1개를 하루에 분류할 수 있는 양이다.
- 테스트: 남은 수 계산(0 아래로 내려가지 않음), `classify`가 `ai_usage`의 `feature = 'classify'`로 센다는 것.

### 2. `src/server/actions/categorize.ts`

```ts
export interface CategorizeResult { byKey: Map<...>; usage: ClaudeUsage[]; aiFailed: boolean; rateLimited: boolean }
```
- AI로 보낼 키가 있을 때만 배치 루프 전에 `remainingDailyQuota(userId, "classify")`를 **한 번** 조회한다. 처리할 배치 수는 그 값으로 제한한다. 사용량은 호출자가 함수가 끝난 뒤 기록하므로, 루프 안에서 다시 세면 안 된다.
- 남은 배치의 키는 `{ category: DEFAULT_CATEGORY, source: "pending" }`으로 두고 `rateLimited: true`를 돌려준다. 로그는 `logger.info("categorize.rate_limited", { keys: n })`로 개수만 남긴다.
- AI 실패(`aiFailed`) 처리는 그대로 둔다.
- 테스트(`@/server/limits`와 `@/services/claude/classifier` mock):
  - 남은 수가 0이면 `classify`를 부르지 않고 모두 pending이며 `rateLimited: true`다.
  - 남은 수가 1이고 배치가 3개면 `classify`를 1번만 부르고 나머지는 pending이다.
  - AI로 보낼 키가 없으면 상한을 조회하지 않는다.

### 3. `src/server/actions/uploads.ts`

- `categorizePending`이 `rateLimited`를 함께 돌려준다.
- `confirmUpload`: 상한에 걸려도 **실패시키지 않는다.** 거래는 저장하고 남은 것은 pending으로 둔다. 응답의 `pending` 수로 드러난다.
- `recategorizeUpload`: 기존 `aiFailed → AI_UNAVAILABLE` 처리와 같은 자리에서 `rateLimited`이면 `AppError("RATE_LIMITED")`를 던진다. `counts` 갱신은 기존처럼 먼저 한다.
- 테스트: 상한에 걸린 confirm은 성공하고 pending이 남는다. 상한에 걸린 recategorize는 `RATE_LIMITED`(429)다.

### 4. `docs/ARCHITECTURE.md`

- "데이터베이스" 절의 일일 상한 줄을 다음으로 바꾼다: `업로드 30(uploads), 매핑 30·분류 100(배치)·인사이트 10·채팅 30(ai_usage)`.
- "업로드 처리" 절의 confirm 설명에 "분류 상한을 넘은 가맹점은 `pending`"을 덧붙인다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `classify` 호출 경로(confirm, recategorize)가 모두 상한 확인을 거치는가?
   - 로그에 가맹점명·키 원문 없이 개수만 남기는가?
3. 결과에 따라 `phases/6-hardening/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (`DAILY_LIMITS.classify`, `remainingDailyQuota`, `rateLimited` 이름을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 업로드 상한(`uploads`)의 계산 방식을 바꾸지 마라. 이유: AI 비용은 분류 상한으로 막는다. 업로드 상한 우회는 이제 AI 비용이 들지 않으므로 이 step 범위 밖이다.
- 예약 행, RPC, 원자적 카운터를 만들지 마라. 이유: ADR-009는 동시 요청으로 상한을 조금 넘는 것을 허용한다. MVP는 오늘 행 수를 세는 단순한 방식을 쓴다.
- `recordAiUsage` 호출 위치를 `categorize.ts` 안으로 옮기지 마라. 이유: 사용량 기록은 호출자(`uploads.ts`)의 책임으로 정해져 있다.
- 기존 테스트를 깨뜨리지 마라. `CategorizeResult`에 필드를 추가하면서 필요한 fake·기대값 보강은 허용한다.
