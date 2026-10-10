# injection: A05 인젝션 · A08 소프트웨어·데이터 무결성 실패

## A05:2025 Injection (인젝션)
믿을 수 없는 입력이 해석기(DB, 브라우저, 셸, LLM)에 명령으로 들어가는 문제. OWASP는 LLM 프롬프트 주입(LLM01:2025)을 같은 계열로 본다.
주요 CWE: 89 SQL · 79 XSS · 78·77 명령 주입 · 94 코드 주입 · 20 입력 검증 · 74 특수 요소 무력화 실패 · 917 표현식 주입

### 체크리스트
- **A05-1 PostgREST 필터 주입**: supabase-js 빌더는 값을 매개변수로 넘기지만, 문자열로 조립하는 필터는 주입된다. `.or(`·`.filter(`·`.textSearch(`·`.match(`·`.not(`에 템플릿 문자열·연결이 들어가는지 Grep하고, 그 입력이 어디서 오는지 따라간다(채팅 도구 `search_transactions`의 `query`는 Claude 출력이고 Claude 입력은 사용자다). `,`·`(`·`)`·`.`이 들어간 값이 필터 구조를 바꾸면 주입이다. `.ilike(`·`.like(`에 사용자 값을 넣을 때 `%`·`_` 이스케이프가 없으면 의미만 바뀐다(🟡). 사용자 client면 RLS가 본인 행으로 묶으므로 🟡~🟠, admin client면 🔴.
- **A05-2 SQL 함수**: 마이그레이션의 plpgsql에서 `execute`에 문자열 연결을 쓰지 않는다(`format('%I', …)`·`%L` 또는 `using`). 연결이면 🔴.
- **A05-3 XSS(CWE-79)**: `dangerouslySetInnerHTML`은 없거나 정적 상수에만 쓴다. AI·사용자 텍스트는 `src/components/ui/safe-markdown.tsx`(react-markdown, `skipHtml`, `img`·`a` 금지)나 일반 텍스트로만 렌더링한다. `href={…}`·`src={…}`·`window.location`·`location.href`에 사용자·AI 값이 들어가면 `javascript:` URL을 막는지 본다. 가맹점명·파일명은 React 텍스트로 이스케이프된다. FinSight에는 다른 사용자가 보는 콘텐츠가 없으므로 저장형 XSS는 본인에게만 터진다(🟠, 세션 탈취는 httpOnly 쿠키라 불가).
- **A05-4 명령·코드 주입(CWE-78·94)**: `src`에 `child_process`·`exec(`·`eval(`·`new Function`·`vm.`이 없다. 있고 입력이 닿으면 🔴. `scripts/*.py`의 `subprocess`에 `shell=True`와 외부 입력(PR 제목·브랜치명 등)이 같이 있으면 🟠. GitHub Actions `run:` 주입은 config(A03-4).
- **A05-5 입력 검증(CWE-20)**: 모든 라우트 body가 zod로 검증되고 문자열 최대 길이·배열 최대 개수·enum이 있다(예: 채팅 `history` 턴 수와 길이, `message` 500자, PDF `password` 128자). `params.id`는 uuid 확인 뒤 DB·Storage에 쓴다. 쿼리 파라미터(`month`, `from`, `to`)도 검증한다. 상한이 없어 큰 입력으로 비용·메모리를 키울 수 있으면 🟠, 그 밖은 🟡.
- **A05-6 파일 파서**: 업로드 파일은 공격자 입력이다. SheetJS(`XLSX.read`)와 HTML xls, CP949 디코딩, unpdf(pdf.js)를 쓰는 `src/lib/ingest/*`에서 행·시트·쪽·셀 길이 상한을 무거운 작업 **전에** 거는지, 압축 해제 폭탄(xlsx는 zip)을 막는지 본다. 셀 텍스트에 도는 정규식에 중첩 수량자(`(a+)+`, `(.*)*`)가 있으면 ReDoS(🟡~🟠). CSV 수식 주입(CWE-1236)은 앱이 CSV·엑셀을 내보낼 때만 본다(없으면 해당 없음).
- **A05-7 프롬프트 주입(LLM01)**: 가맹점명·파일 헤더·샘플 셀·채팅 메시지와 `history`는 모두 사용자 통제 텍스트다. 확인: 분류 출력은 가맹점 키별 enum으로 검증, 매핑 출력은 zod 뒤 코드가 다시 검증(`validateMapping`), 인사이트는 zod·숫자 금지, 채팅 도구는 읽기 전용이고 `userId`는 서버 클로저로 고정, 결과 30행 이하, 날짜 범위 검증, 도구 호출 5회 이하. 클라이언트가 보낸 `history`에 assistant 턴이나 도구 결과를 위조할 수 있으면 본인 답변만 오염된다(🟡). 모델이 `userId`를 고르거나 쓰기 도구가 있으면 🔴. 시스템 프롬프트에 비밀이 없다.

## A08:2025 Software or Data Integrity Failures (소프트웨어·데이터 무결성 실패)
코드·업데이트·데이터의 출처와 무결성을 확인하지 않고 믿는 문제. A03이 공급망 전체라면 A08은 개별 산출물·데이터의 신뢰 경계다.
주요 CWE: 345 데이터 진위 확인 부족 · 502 신뢰할 수 없는 역직렬화 · 915 대량 할당 · 829·830 신뢰 밖 기능 포함 · 494 무결성 확인 없는 코드 다운로드 · 565 쿠키 무결성 미확인

### 체크리스트
- **A08-1 웹훅 무결성(CWE-345)**: `src/app/api/webhooks/polar/route.ts` → `src/server/actions/billing.ts`의 `handlePolarWebhook`. raw body로 `validateWebhook`을 **먼저** 하고 실패면 403. 검증 뒤에도 payload의 상태를 믿지 않고 Polar Customer State를 다시 읽는다(`syncEntitlement`). 사용자는 `external_id`로만 찾는다(이메일로 찾지 않음). 모르는 사용자는 로그 후 200. `upsertIfNewer`로 순서 역전을 막는다. 서명 검증이 없거나 뒤에 있으면 🔴.
- **A08-2 결제 확인**: `billing/confirm`이 checkout이 본인 것인지(`external_customer_id`) 확인한 뒤 동기화한다. success URL의 `checkout_id`를 그대로 믿지 않는다.
- **A08-3 대량 할당(CWE-915)**: 요청 body나 Claude 출력을 펼쳐서 DB에 쓰지 않는다(`.insert(body)`, `.update({ ...body })`, `...parsed`). 필드를 명시해서 `user_id`·`status`·`category_source`·`plan`을 사용자가 정하지 못하게 한다. zod `.passthrough()`·`z.looseObject`도 본다.
- **A08-4 신뢰 경계를 넘는 데이터**: 사용자가 쓸 수 있는 곳에서 다시 읽은 값을 믿는지 본다. `uploads.mapping`(jsonb)은 쓰기 전에 zod로 검증하는가. `header_mappings` 캐시는 사용자별인가(ADR-004, 사용자 사이 공유면 🔴). confirm에서 `sha256`을 실제 파일로 다시 확인하는가. `storage_path`는 서버가 만든 경로와 비교하는가(`upload_path_check` 마이그레이션).
- **A08-5 외부 코드 포함(CWE-829·494)**: 런타임에 URL에서 코드를 받거나 `import()`하지 않는다. 빌드 시 CDN tarball(xlsx)은 AR-06(조건 확인은 config A03-2).
- **A08-6 역직렬화(CWE-502)**: 믿을 수 없는 입력의 `JSON.parse` 결과를 스키마 없이 판단에 쓰지 않는다. `try` 없이 파싱해 예외로 흐름이 바뀌는 곳은 design(A10).
- **A08-7 AI 출력 무결성**: AI 출력은 저장·사용 전에 zod·enum으로 검증한다(분류 ∈ `CATEGORIES`, 매핑 열 번호가 헤더 수 안, 인사이트 스키마). `parsed_output`이 null이면 처리한다. 저장된 인사이트는 safe-markdown으로만 렌더링한다(A05-3).

## 심각도 힌트
- 🔴 웹훅 서명 미검증, admin client에서 필터·SQL 주입, 모델이 userId를 고름, 사용자 사이 캐시 공유
- 🟠 사용자 client 필터 주입으로 상태·과금 우회, 본인 저장형 XSS, 상한 없는 입력, 대량 할당
- 🟡 LIKE 와일드카드 미이스케이프, 위조 history로 본인 답변 오염
