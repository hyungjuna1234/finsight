# Step 7: ai-disclosure

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md` (CRITICAL: Claude에는 최소 데이터만 — 매핑 = 마스킹한 헤더+샘플 5행, 분류 = 가맹점명, 인사이트 = 집계값, 채팅 도구 = 30행 이하)
- `/src/lib/domain/consent.ts`와 `consent.test.ts` (`CONSENT_ITEMS`, `CONSENT_VERSION`)
- `/src/components/auth/consent-form.tsx`와 테스트
- `/src/components/marketing/legal/privacy-policy.tsx`와 테스트 (`#overseas` 표의 Anthropic 행)
- `/src/server/actions/chat.ts`, `/src/lib/analytics/group.ts`의 `toSearchRows` (채팅이 보내는 거래 필드)
- `/src/components/marketing/landing/data-flow.tsx` — step 5 (랜딩의 정확한 문구)
- `/e2e/public-pages.spec.ts` (개인정보 처리방침 표를 검사하는 부분)

## 배경

동의 화면의 "개인정보 국외 이전" 요약은 "가맹점명과 집계값을 Anthropic(미국)에" 보낸다고 적고 있다. 개인정보 처리방침의 Anthropic 행은 "가맹점명, 월별 집계값, 마스킹된 표 샘플(헤더+5행), 채팅 질문"만 적는다. 실제로는 Pro 채팅이 답을 만들려고 거래를 최대 30건(이용일·가맹점·금액·유형·카테고리·추정 여부) 보낸다. 랜딩의 새 데이터 흐름도(step 5)와 같은 사실을 동의 화면과 처리방침에도 정확히 적는다.

## 작업

TDD로 진행한다(먼저 기대 문구로 테스트를 고치고 구현한다).

### 1. `src/lib/domain/consent.ts`
`overseas_transfer`의 `summary`를 다음으로 바꾼다:
`분류·요약·답변을 위해 가맹점명, 집계값, 가린 샘플 5행, 채팅 질문과 답에 필요한 거래(최대 30건)를 Anthropic(미국)에, 결제 정보를 Polar(미국)에 보내요. 카드번호는 보내지 않아요.`

### 2. `src/components/marketing/legal/privacy-policy.tsx`
`#overseas` 표의 Anthropic PBC 행의 "이전 항목" 칸을 다음으로 바꾼다:
`가맹점명, 월별 집계값, 마스킹된 표 샘플(헤더+5행), 채팅 질문, 채팅 답변에 필요한 거래 내역(최대 30건: 이용일·가맹점·금액·유형·카테고리)`
나머지 칸과 다른 행은 그대로 둔다.

### 3. 테스트
- `consent.test.ts` 또는 `consent-form.test.tsx`: 국외 이전 요약에 `최대 30건`과 `카드번호는 보내지 않아요`가 있다.
- `privacy-policy.test.tsx`: Anthropic 행에 `최대 30건`이 있다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 동의 요약·처리방침·랜딩 데이터 흐름도가 같은 사실(기능별 전송 데이터)을 말하는가?
   - `chat.ts`의 실제 전송 필드와 어긋나지 않는가?
3. 결과에 따라 `phases/7-landing/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `CONSENT_VERSION`을 바꾸지 마라. 이유: 출시 전이라 기존 동의 기록이 없고, 문구 변경에 따른 재동의 정책은 법무 검토 때 사람이 정한다.
- 채팅이 AI에 보내는 데이터(`chat.ts`, `toSearchRows`)를 바꾸지 마라. 이유: 이 step은 안내 문구를 사실에 맞추는 일이다. 동작 변경은 범위 밖이다.
- 처리방침의 `[TODO: …]` 표시와 "초안 — 법률 검토 전" 표시를 지우지 마라. 이유: 법무 검토 전이라는 사실을 유지해야 한다.
- 기존 테스트를 깨뜨리지 마라.
