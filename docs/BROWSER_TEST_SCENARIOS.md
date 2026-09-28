# 브라우저 테스트 시나리오

실제 브라우저로 사용자 흐름을 따라가며 확인할 때 이 문서를 기준으로 한다. 흐름의 근거는 `docs/USER_FLOWS.md`, 화면 문구와 상태 규칙은 `docs/UX_GUIDE.md`다.
자동 e2e(`npm run e2e`, `e2e/*.spec.ts`)는 이 중 일부만 다룬다. 이 문서는 사람이 보거나 Claude가 브라우저 도구로 돌리는 수동 점검용이다.

- 시나리오는 두 묶음이다. **PUB**은 키 없이 돌릴 수 있고, **APP**은 실제 Supabase·OAuth·Anthropic·Polar sandbox가 필요하다.
- 기대 문구는 코드 기준이다(`src/lib/domain/errors.ts`, 각 컴포넌트). 화면 문구가 바뀌면 이 문서도 같이 고친다(맨 아래 "유지").
- 실제 카드 명세서는 쓰지 않는다. 합성 fixture만 쓰고, 스크린샷은 레포 밖에 둔다.

## 0. 준비

### 0-1. PUB용 서버 (키 없음)
e2e 설정(`playwright.config.ts`)과 같은 더미 공개 env로 프로덕션 빌드를 띄운다.
```bash
export NEXT_PUBLIC_APP_URL=http://localhost:3100 \
       NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
       NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-dummy-anon-key
npm run build && npm run start -- -p 3100
```
- env 없이 `npm run dev`로 띄우면 `/pricing`이 500("서비스 설정을 확인해 주세요.")이다. 페이지가 로그인 여부를 보려고 Supabase 클라이언트를 만들기 때문이다. 운영과는 무관하니 PUB은 위 방식으로 돌린다.
- 더미 Supabase 주소는 응답하지 않으므로 로그인 버튼을 누르면 `127.0.0.1:54321`로 가서 멈춘다. 정상이다.

### 0-2. APP용 환경 (사람이 준비)
`ops/README.md` 기준으로 `finsight-ops/`에서 준비한다. 이 레포에서는 `supabase`·`vercel`·`psql` CLI와 `.env*`를 쓰지 않는다.
- Supabase dev 프로젝트: 마이그레이션 적용, 카카오·구글 OAuth(테스트 계정), Storage 버킷
- `.env.local`: `.env.example`의 모든 키. `ANTHROPIC_API_KEY`(월 한도 설정), Polar **sandbox** 토큰·상품·웹훅 secret
- 테스트 계정 두 개: 새 가입용 1개, 결제·탈퇴까지 쓸 1개
- 카카오·구글 로그인은 자동화하기 어렵다. 평소 쓰는 Chrome에서 사람이 로그인해 두고, Claude는 그 세션에 붙어(claude-in-chrome 또는 `dev-browser --connect`) 이어서 진행한다.

### 0-3. 테스트 파일 만들기
`src/test/fixtures/statements.ts`의 합성 명세서를 파일로 뽑는다. `jiti`는 tailwind를 통해 들어온 간접 의존성이다.
```bash
OUT=/tmp/finsight-fixtures node --input-type=module -e '
import { createJiti } from "jiti";
import { mkdirSync, writeFileSync } from "node:fs";
const jiti = createJiti(process.cwd() + "/", { alias: { "@": process.cwd() + "/src" } });
const { allFixtures, hyundaiForeignPair } = await jiti.import("./src/test/fixtures/statements.ts");
const out = process.env.OUT; mkdirSync(out, { recursive: true });
for (const f of [...allFixtures({ heavy: true }), ...hyundaiForeignPair()]) writeFileSync(out + "/" + f.filename, f.bytes);
'
# 합성 PDF: 암호(비밀번호 0000) 명세서와 글자 없는 PDF
node --input-type=module -e '
import { createJiti } from "jiti";
import { writeFileSync } from "node:fs";
const jiti = createJiti(process.cwd() + "/", { alias: { "@": process.cwd() + "/src" } });
const { syntheticPdf } = await jiti.import("./src/test/fixtures/pdf.ts");
const rows = [["08/20 STARBUCKS", "12,900"], ["08/21 GS25", "30,000"]].flatMap(([text, amount], i) => [{ text, x: 36, y: 770 - i * 13 }, { text: amount, x: 250, y: 770 - i * 13 }]);
writeFileSync("/tmp/finsight-fixtures/명세서_암호.pdf", syntheticPdf([[{ text: "2026.08.10 ~ 2026.09.09", x: 200, y: 815 }, ...rows]], { password: "0000" }));
writeFileSync("/tmp/finsight-fixtures/스캔.pdf", syntheticPdf([[]]));
'
# 10MB 초과 파일(클라이언트 검증용)
mkfile -n 11m /tmp/finsight-fixtures/큰파일.csv
```

| 파일 | 기대 결과 |
|---|---|
| `신한.csv` (UTF-8 BOM) | 2026-08-03~08-09 · 7건(지출 5·환불 1·취소 1) · 순지출 ₩187,400 · 건너뜀: 합계 1·0원 1·날짜 이상 2 |
| `삼성.csv` (CP949) | 2025-12-28~2026-01-05 · 4건(지출 3·환불 1) · ₩40,500 · 합계행 1 건너뜀 |
| `현대.xlsx` | 2026-08-01~08-05 · 5건 · ₩126,000 |
| `국민.xls` (HTML 형식) | 2026-08-03~08-05 · 3건(지출 1·환불 1·취소 1) · ₩28,000 |
| `롯데.xls` (UTF-16 TSV) | 2026-08-11 · 2건 · ₩25,000 · 빈 행 1 건너뜀 |
| `하나.xls` (SpreadsheetML) | 2026-08-14~08-15 · 2건 · ₩31,800 |
| `하나_구형.xls` (BIFF8) | 2026-08-20~08-24 · 5건 · ₩75,000 |
| `현대_해외_미매입.xlsx` → `현대_해외_확정.xlsx` | 먼저 올리면 "추정" 표시, 확정 파일을 올리면 같은 거래가 갱신된다 |
| `청구서.xlsx` | BILLING_STATEMENT |
| `은행.csv` | BANK_STATEMENT |
| `메모.csv` | HEADER_NOT_FOUND |
| `시트많음.xlsx` | FILE_TOO_COMPLEX |
| `암호.xlsx` | ENCRYPTED_FILE |
| `깨짐.xlsx` | CORRUPT_FILE |
| `깨짐.csv` | ENCODING_ERROR |
| `card.xls`(PDF 내용) · `card.xlsx`(PNG 내용) | UNSUPPORTED_FORMAT |
| `empty.csv` | EMPTY_FILE |
| `대량.csv` (heavy) | TOO_MANY_ROWS |
| `경계.csv` (heavy) | 9,999건, 2026-08-01~08-28. 한도 바로 아래라 통과해야 한다(처리 시간도 본다) |
| `큰파일.csv` | 클라이언트에서 10MB 초과 안내 |

fixture의 "오늘"은 2026-09-30이다. 날짜 이상(오늘+31일 이후) 판정이 실행일에 따라 달라질 수 있으니, 숫자가 어긋나면 실행일부터 확인한다.

### 0-4. 공통 점검
- **콘솔**: `pageerror`와 `console.error`가 없어야 한다. 로컬에서 나오는 `/_vercel/insights/script.js` 404는 Vercel 밖이라 정상이다.
- **차트**: Recharts 애니메이션이 끝나기 전에 찍으면 막대가 0처럼 보인다. 스크린샷 전에 2초 기다린다.
- **가로 넘침**: 390px에서 아래 값이 `false`여야 한다.
  ```js
  document.documentElement.scrollWidth > document.documentElement.clientWidth
  ```
- **개인정보**: 스크린샷·메모·로그에 실제 금액·가맹점을 남기지 않는다(합성 fixture만 쓰는 이유).
- **도구**: 키 없는 PUB은 `dev-browser --headless`로 충분하다. 로그인이 필요한 APP은 사람이 로그인한 Chrome에 붙는다.

## 1. 시나리오 목록

| ID | 이름 | 환경 | 대략 시간 |
|---|---|---|---|
| PUB-1 | 첫 방문 → 데모 → 로그인 화면 | 0-1 | 5분 |
| PUB-2 | 결제 전에 조건 알아보기(요금·가이드·정책) | 0-1 | 5분 |
| PUB-3 | 로그인 없이 앱 경로 접근(리다이렉트·보안) | 0-1 | 5분 |
| PUB-4 | 휴대폰 화면(390px) | 0-1 | 5분 |
| APP-1 | 가입 → 동의 → 첫 업로드 → 첫 대시보드 | 0-2 | 10분 |
| APP-2 | 잘못된 파일 올리기 | 0-2 | 10분 |
| APP-3 | 분류 고치기 | 0-2 | 5분 |
| APP-4 | Free 사용자가 Pro 기능에 부딪히기 | 0-2 | 5분 |
| APP-5 | Pro 결제 → 채팅 | 0-2 + Polar sandbox | 10분 |
| APP-6 | 데이터 삭제 → 탈퇴 | 0-2 | 5분 |

화면을 바꾼 PR 뒤에는 PUB 전체를 돌린다. 업로드·결제·설정을 바꿨으면 해당 APP 시나리오도 돌린다.

## 2. PUB 시나리오 (키 없음)

### PUB-1 첫 방문 → 데모 → 로그인 화면
처음 온 사람이 서비스를 둘러보고 가입하러 간다. 화면은 1280×900.

| # | 동작 | 기대 결과 |
|---|---|---|
| 1 | `/` 열기 | 제목 "카드 이용내역 파일만 올리면, 한 달 지출이 정리돼요". [무료로 시작] → `/login?next=%2Fupload`, [예시 보기] → `/demo`. 푸터에 정책 링크 4개와 비조언 문구 |
| 2 | FAQ "투자 조언도 해 주나요?" 펼치기 | "아니요. 지출 정리를 돕는 요약이고 재무·투자·세무 조언을 하지 않아요." |
| 3 | [예시 보기] | `/demo`. 배너 "샘플 데이터예요 · 실제 화면과 같아요", 제목 "2026년 9월", "다음 달 ›"는 링크가 아니다(최신 달) |
| 4 | 요약 확인 | 이번 달 지출 ₩1,436,400 · "추정 금액 1건 포함", 환불 ₩0, 65건. 카테고리 9개(식비 34% ₩488,800가 1위), TOP5 1위 "우리마트 연남점" |
| 5 | Pro 미리보기 확인 | 데모에서는 잠금 없이 열려 있다. 정기결제 "5건 · 월 ₩119,100", 월별 추이 7~9월, "8월 대비 +₩81,800 · +6%", 지출 인사이트 끝에 "투자·세무 조언이 아니에요" |
| 6 | [‹ 이전 달] | `/demo?month=2026-08`, 지출 ₩1,354,600, 환불 ₩28,000 |
| 7 | [전체 달 보기] | 2026년 9월·8월·7월 |
| 8 | `?month=2020-01`, `2026-13`, `abc`, `2027-01` | 모두 200, 최신 달(9월)로 표시. 에러 화면 없음 |
| 9 | [내 데이터로 시작] | `/login?next=%2Fupload`. 카카오·구글 버튼 href에 `next=%2Fupload` |

데모 숫자는 `src/lib/demo/fixtures`에서 온다. 그 파일이 바뀌면 4~6번 값도 고친다.

### PUB-2 결제 전에 조건 알아보기
| # | 동작 | 기대 결과 |
|---|---|---|
| 1 | `/pricing` | 비교표 6행(업로드·자동 분류 / 월별 대시보드 / 여러 달 추이·전월 비교 / 정기결제 목록 / AI 인사이트 리포트 "첫 1회 무료" / Q&A 채팅). "₩6,900/월", "(기본 통화 $4.99, …)", 해외결제 카드 안내. 비로그인은 [로그인하고 Pro 시작하기] → `/login?next=%2Fpricing` |
| 2 | `/pricing?checkout=failed` | 위에 "결제가 완료되지 않았어요. 국내전용 카드는 결제가 안 돼요. 해외결제 가능한 카드로 다시 시도해 주세요." |
| 3 | `/guide` | 카드사 6곳(신한·삼성·현대·KB국민·롯데·하나). "신한카드"를 펼치면 4단계. "올리다가 막히면" 6항목 |
| 4 | [PC에서 열 링크 복사] | "링크를 복사했어요" |
| 5 | `/refund` | "초안 — 법률 검토 전", 7일 이내·Pro 기능 미사용 시 전액 환불, 결제 실패 시 7일 유예 |
| 6 | `/privacy` | 국외 이전 표(Anthropic·Polar·Vercel, 미국), "Supabase 서울 리전(대한민국)" |
| 7 | `/terms` | "조언이 아님" 절 |
| 8 | 푸터 링크 4개 | 모두 200 |

출시 전에는 `[TODO: …]` 사업자 정보가 남아 있는 게 정상이다. 출시 뒤에는 `[TODO`가 한 군데도 없어야 한다.

### PUB-3 로그인 없이 앱 경로 접근
| # | 동작 | 기대 결과 |
|---|---|---|
| 1 | `/dashboard`, `/dashboard?month=2026-08`, `/transactions`, `/upload`, `/upload/abc`, `/trends`, `/recurring`, `/insights`, `/chat`, `/settings`, `/billing/success?checkout_id=x`, `/onboarding/consent` | 모두 `/login?next=<원래 경로와 쿼리를 인코딩한 값>` |
| 2 | `/login?next=` + `https://evil.com`, `//evil.com`, `/\evil.com`, `javascript:alert(1)` | 카카오 버튼 href가 `next=%2Fdashboard`로 바뀐다(외부 주소 버림) |
| 3 | `/login?error=cancelled` / `provider` / `oauth` / `callback` | "로그인을 취소했어요. 다시 시도해 주세요." / "지원하지 않는 로그인 방식이에요." / "로그인을 시작하지 못했어요. 다시 시도해 주세요." / "로그인을 완료하지 못했어요. 다시 시도해 주세요." |
| 4 | `/login?error=weird<script>` | 알림 없음, 입력값이 화면에 나오지 않음 |
| 5 | User-Agent에 `KAKAOTALK` 또는 `Instagram`을 넣고 `/login` | 카카오 버튼 아래 "카카오톡(인스타그램) 안에서는 구글 로그인이 막혀 있어요. 오른쪽 위 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요." Safari UA에서는 안내 없음 |
| 6 | `curl -sI /auth/login?provider=naver` | 302 → `/login?error=provider` |
| 7 | `/auth/login?provider=kakao&next=https://evil.com` | 302 → Supabase authorize. `redirect_to`에 `next=%2Fdashboard`와 `code_challenge_method=s256`(PKCE) |
| 8 | `/auth/callback`(code 없음), `?code=bogus` / `?error=access_denied` | `/login?error=callback` / `/login?error=cancelled` |
| 9 | `POST /api/uploads`에 `Origin: https://evil.com` | 403 `FORBIDDEN` |
| 10 | 같은 출처 Origin으로 `POST /api/uploads`, `POST /api/account/delete` | 401 `UNAUTHENTICATED` |
| 11 | `GET /auth/signout` | 405. 로그아웃은 POST만 된다 |
| 12 | `/api/cron/cleanup`, `POST /api/webhooks/polar`(서명 없음) | 200이 아니어야 한다. 더미 env에서는 비밀 env가 없어 500 `INTERNAL`(닫힌 실패) |
| 13 | `curl -sI /` | `Content-Security-Policy`(`frame-ancestors 'none'`), `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`가 있고 `X-Powered-By`는 없다 |
| 14 | `/nope` | 404 |

### PUB-4 휴대폰 화면
화면 390×844(iPhone 크기)로 `/`, `/demo`, `/demo?month=2026-07`, `/pricing`, `/guide`, `/privacy`, `/terms`, `/refund`, `/login`을 연다.
- 모든 페이지에서 가로 넘침이 없다(0-4).
- 데모: 요약 타일이 세로로 쌓이고, 차트 축 숫자가 잘리지 않고, 정기결제 행이 줄바꿈되어 읽힌다.
- 로그인: 버튼이 화면 폭을 채우고, 인앱 브라우저 안내(PUB-3 #5)가 버튼 사이에서 읽힌다.
- 표(요금 비교, 개인정보 국외 이전)는 읽을 수 있어야 한다. 가로 스크롤이 생기면 그 표 안에서만 생긴다.

## 3. APP 시나리오 (실제 환경 필요)

### APP-1 가입 → 동의 → 첫 업로드 → 첫 대시보드
새 테스트 계정을 쓴다.

| # | 동작 | 기대 결과 |
|---|---|---|
| 1 | `/`에서 [무료로 시작] → [카카오로 시작하기] → 카카오 로그인 | `/onboarding/consent` |
| 2 | 동의 항목 확인 | 필수 4개가 따로 있다: 개인정보 수집·이용, 개인정보 국외 이전, 이용약관, 만 14세 이상이에요. 하나라도 빼면 시작할 수 없다("필수 항목에 모두 동의해야 이용할 수 있어요.") |
| 3 | (다른 계정으로) [동의하지 않고 나가기] | 로그아웃되고 앱 경로에 들어갈 수 없다 |
| 4 | 4개 모두 체크 → [시작하기] | 거래가 없으므로 `/upload` 빈 상태 "카드사 홈페이지에서 받은 이용내역 파일을 올려 주세요"와 가이드 링크 |
| 5 | `신한.csv` 선택 | 단계 표시가 "파일 확인 중 → 업로드 중 → 열 분석 중 → 거래 분석 중 → 완료"로 진행된다. 자동 확정이 안 되면 "열 확인 필요" → `/upload/[id]` |
| 6 | (매핑 화면이면) 헤더 행, 날짜·가맹점·금액 열, 미리보기 5행, 카드 이름 확인 후 저장 | 미리보기의 카드번호·계좌번호 같은 숫자는 마스킹되어 있다 |
| 7 | 결과 확인 → [대시보드 보기] | "2026년 8월 · 7건 추가"류의 결과. `/dashboard?month=2026-08`. 순지출 ₩187,400, 취소 1건은 지출에서 빠지고 환불 1건은 환불 타일에 |
| 8 | `삼성.csv`(CP949) 올리기 | 한글 가맹점이 깨지지 않는다. 기간 2025-12~2026-01 |
| 9 | 새로고침, 새 탭에서 `/dashboard` | 로그인 유지. 쿠키는 httpOnly(개발자도구 Application 탭) |

### APP-2 잘못된 파일 올리기
APP-1을 마친 계정으로 `/upload`에서 하나씩 올린다. 문구는 `src/lib/domain/errors.ts`의 `ERROR_MESSAGES`다.

| 파일 | 기대 문구 |
|---|---|
| `큰파일.csv` | 업로드 전에 10MB 초과 안내(서버 코드 FILE_TOO_LARGE: "파일이 10MB보다 커요. 더 작은 파일을 올려 주세요.") |
| 실제 `.png` | 파일 선택 단계에서 거절(CSV·xls·xlsx·pdf만) |
| `card.xls`(PDF 내용) | "지원하지 않는 파일 형식이에요. CSV, XLS, XLSX, PDF 파일을 올려 주세요." |
| `명세서_암호.pdf` | 단계가 "비밀번호 필요"로 멈추고 PDF 비밀번호 칸이 보인다. `1234` → "비밀번호가 맞지 않아요. 다시 입력해 주세요." → `0000` → 매핑 확인(날짜·가맹점·금액=열 3 제안) → 2건 추가. 새로고침 후 `/upload/[id]`로 돌아오면 비밀번호를 다시 묻는다 |
| `스캔.pdf`(글자 없음) | "PDF에서 이용내역을 찾지 못했어요. …" + 가이드 링크 |
| `신한.csv` 다시 | "이미 올린 파일이에요." + [보기] |
| `암호.xlsx` | "암호가 걸린 파일이에요. 엑셀에서 열어 다른 이름으로 저장한 뒤 올려 주세요." |
| `empty.csv` | "파일에 내용이 없어요. 카드 이용내역이 있는 파일을 올려 주세요." |
| `깨짐.xlsx` | "파일이 손상되어 읽을 수 없어요. 원본을 다시 받아 올려 주세요." |
| `깨짐.csv` | "파일의 글자를 읽을 수 없어요. 엑셀에서 열어 CSV 또는 XLSX로 다시 저장해 주세요." |
| `청구서.xlsx` | "카드 청구서는 아직 지원하지 않아요. 카드사 홈페이지에서 '이용내역'을 받아 올려 주세요." + 가이드 링크 |
| `은행.csv` | "은행 거래내역은 아직 지원하지 않아요. 카드사 홈페이지에서 '이용내역'을 받아 올려 주세요." |
| `메모.csv` | "이용내역의 열 제목을 찾지 못했어요. 카드사에서 받은 원본 파일을 확인해 주세요." |
| `시트많음.xlsx` | "파일 구조가 너무 복잡해요. 필요한 이용내역만 남겨 다시 저장해 주세요." |
| `대량.csv` | "이용내역이 1만 건을 넘어요. 기간을 나눠 받아 올려 주세요." |
| `경계.csv` | 통과. 9,999건이 들어오고 화면이 멈추지 않는다 |
| `현대_해외_미매입.xlsx` → `현대_해외_확정.xlsx` | 처음엔 "추정" 표시, 확정 파일 뒤에는 같은 거래가 확정 금액으로 바뀌고 건수는 늘지 않는다 |

실패한 파일이 업로드 목록과 대시보드 숫자에 흔적을 남기지 않는지도 본다.

### APP-3 분류 고치기
| # | 동작 | 기대 결과 |
|---|---|---|
| 1 | 대시보드 거래 목록에서 "{가맹점} 분류 변경" → "분류 바꾸기" 시트 | 카테고리 목록과 [이번 건만]·[같은 가맹점 모두] |
| 2 | 다른 카테고리 → [이번 건만] | "분류를 바꿨어요". 차트·TOP5·목록에 바로 반영 |
| 3 | 같은 가맹점이 여러 건인 거래 → [같은 가맹점 모두] | "같은 가맹점 N건을 바꿨어요" |
| 4 | 새로고침 | 바꾼 분류가 유지된다 |
| 5 | `/transactions` 필터로 그 카테고리만 보기 | 바꾼 거래가 보인다. 결과 0건이면 빈 상태 문구 |
| 6 | 분류 실패 건이 있으면 [다시 분류] | 실패 건만 다시 분류된다 |

### APP-4 Free 사용자가 Pro 기능에 부딪히기
| # | 동작 | 기대 결과 |
|---|---|---|
| 1 | 대시보드 Pro 티저 | 정기결제는 건수·합계만 보이고 목록은 잠김("Pro에서 전체 목록을 볼 수 있어요"), 전월 비교 잠금, 흐린 추이, 채팅 예시 질문 |
| 2 | `/trends`, `/recurring`, `/chat` | 각각 잠금 화면("Pro에서 월별 추이를 볼 수 있어요", "Pro에서 전체 목록을 볼 수 있어요", "Pro에서 지출 Q&A를 이용할 수 있어요") |
| 3 | "첫 AI 리포트는 무료예요" → `/insights?month=` → 만들기 | "리포트를 만들고 있어요(최대 1분)" 뒤 리포트. 끝에 비조언 문구, [도움이 됐어요] 피드백 |
| 4 | 다른 달로 리포트 한 번 더 | 잠김(무료 1회 소진) |
| 5 | 같은 시각에 두 탭에서 첫 리포트 만들기 | 한 번만 성공한다(6-hardening의 free-insight-claim) |
| 6 | `/settings` | "Free 플랜을 쓰고 있어요" |

### APP-5 Pro 결제 → 채팅 (Polar sandbox)
| # | 동작 | 기대 결과 |
|---|---|---|
| 1 | `/pricing` → Pro 시작 | "결제 페이지를 열고 있어요" → Polar sandbox 결제 화면(KRW) |
| 2 | 결제 취소하고 돌아오기 | `/pricing?checkout=failed` 안내(PUB-2 #2) |
| 3 | sandbox 테스트 카드로 결제 | `/billing/success?checkout_id=…` → "결제를 확인하고 있어요" → "Pro가 열렸어요" [계속하기]. 웹훅이 늦으면 "결제는 완료됐어요. Pro 적용까지 몇 분 걸릴 수 있어요." |
| 4 | 다른 계정으로 같은 `checkout_id` URL 열기 | Pro가 열리지 않는다("결제 정보를 확인할 수 없어요") |
| 5 | `/trends`, `/recurring`, 대시보드 | 잠금이 풀린다. 정기결제는 석 달 이상 데이터가 있어야 나온다 |
| 6 | `/chat` 예시 질문 → 답변 | 답변이 온다. "대화는 이 탭에만 잠시 보관되고 서버에 저장되지 않아요." 마크다운에 링크·이미지가 없다 |
| 7 | "주식 뭐 살까?", "세금 줄이는 법?" | 조언을 거절한다 |
| 8 | 다시 `/pricing` | 구독 중이면 결제 대신 구독 관리(Polar 포털) |
| 9 | `/settings` | "Pro 플랜을 쓰고 있어요", 구독 관리 버튼 → Polar 포털 |

### APP-6 데이터 삭제 → 탈퇴
| # | 동작 | 기대 결과 |
|---|---|---|
| 1 | `/settings` 업로드 목록에서 파일 하나 [삭제] | 경고 "이 파일로 들어온 거래가 지워져요. …" → "삭제했어요". 대시보드에서 그 거래가 빠진다 |
| 2 | 같은 파일 다시 올리기 | 중복 거절 없이 다시 들어온다(복구) |
| 3 | [전체 삭제] | "전체 삭제"를 입력해야 실행된다. 거래·분류·리포트가 지워지고 계정·구독은 남는다. 대시보드는 `/upload` 빈 상태로 |
| 4 | [탈퇴하기] | "탈퇴"를 입력해야 실행된다. 구독 해지 → 원본 삭제 → 계정 삭제 → `/` |
| 5 | 같은 소셜 계정으로 다시 로그인 | 새 가입처럼 동의 화면부터 시작하고 데이터가 없다 |
| 6 | (가능하면) Polar 해지 실패 상황 | "구독 해지에 실패해서 탈퇴를 멈췄어요. 잠시 후 다시 시도해 주세요."가 나오고 계정은 남는다 |

## 4. 실행 기록

| 날짜 | 기준 | 범위 | 결과 |
|---|---|---|---|
| 2026-09-28 | `main` ce46fd4, 더미 env 프로덕션 빌드(:3100), dev-browser headless | PUB-1~4 | 4개 모두 통과, 아래 발견 사항 있음 |
| 2026-09-28 | — | APP-1~6 | 미실행. Supabase·OAuth·Anthropic·Polar sandbox 환경이 아직 없다(0-2) |

### 발견 사항 (2026-09-28)
| 등급 | 내용 | 위치 | 비고 |
|---|---|---|---|
| 중 | 404와 서버 에러가 Next 기본 영어 화면이다("This page could not be found.", "This page couldn't load") | `src/app/not-found.tsx`·`error.tsx` 없음 | UX 백로그 B13 |
| 중 | 카카오 버튼이 서비스 초록색(accent)이다. 카카오 로그인 디자인 가이드(노란 배경·심볼)와 달라 비즈 앱 검수에서 걸릴 수 있다. 구글 버튼도 브랜드 가이드 확인 필요 | `src/components/auth/login-panel.tsx:41` | 새 발견 |
| 하 | 차트 툴팁에 데이터 키가 그대로 나온다(`amount : ₩359,100`, 추이 차트는 `net`) | `dashboard/category-chart.tsx:26`, `pro/trend-chart.tsx:12` | 새 발견 |
| 하 | 카테고리 차트 세로축 라벨이 하나 건너 하나만 보인다(9개, 높이 부족). 아래 표에 전부 있어 정보 손실은 없다 | `dashboard/category-chart.tsx` | 새 발견 |
| 하 | 390px에서 개인정보 국외 이전 표의 "국가" 칸이 한 글자씩 줄바꿈되고 "항목"은 옆으로 스크롤해야 한다 | `marketing/legal/privacy-policy.tsx` | 새 발견 |
| 하 | 로그인 화면에 홈으로 돌아가는 길이 없다(헤더·링크 없음) | `auth/login-panel.tsx` | UX 백로그 B4와 같이 보면 좋다 |
| 참고 | 데모에서 8월을 봐도 라벨이 "이번 달 지출"이다 | `dashboard/summary-tiles.tsx` | UX 백로그 B5("N월 지출") |
| 참고 | env 없는 `npm run dev`에서 `/pricing` 500 | `(marketing)/pricing/page.tsx` → `getOptionalPlan()` | 테스트 환경 문제. 0-1 방식으로 돌린다 |

## 5. 유지
- UX 백로그가 반영되면 기대 문구를 같이 고친다. 특히 B5(요약 라벨), B8(문구 사전), B11(결제 뒤 복귀), B12(업로드 단계), B13(404·에러 화면), B14(Pro 메뉴 숨김)다.
- 에러 문구는 `ERROR_MESSAGES`를 바꾸면 APP-2 표도 고친다.
- 한 번 돌릴 때마다 "실행 기록"에 한 줄을 추가하고, 발견 사항은 고치면 지우거나 "해결"로 표시한다.
- 자주 깨지는 PUB 항목은 `e2e/*.spec.ts`로 옮겨 자동화한다.
