# Step 1: decode-fixes

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` ("핵심 순수 함수" 아래 "인코딩" 항목과 "외부 SDK 메모"의 SheetJS)
- `/src/lib/ingest/decode.ts`와 `/src/lib/ingest/decode.test.ts`
- `/src/lib/ingest/sniff.ts` (`TextEncoding`, sniff가 넘기는 `encoding`)
- `/src/lib/ingest/parse.ts` (`parseDateCell`)
- `/src/test/fixtures/statements.ts` (fixture 합성 방식)

## 배경

리뷰에서 두 가지 결함이 재현됐다.

1. **인코딩 판별 순서가 스펙과 다르다.** 스펙은 BOM → UTF-8(fatal) → `iconv-lite` cp949 순서다. 그런데 `decodeText`는 HTML/XML 안의 `<meta charset>`이나 `<?xml encoding>` 선언(`findDeclaredCharset` → `declaredEncoding`)을 UTF-8 시도보다 먼저 쓴다. 선언이 실제 인코딩과 다르면 다른 인코딩을 시도하지 않고 실패한다. 예를 들어 `euc-kr`로 선언했지만 실제로는 UTF-8인 HTML-xls는 `ENCODING_ERROR`로 끝난다.
2. **xlsx 날짜 셀이 틀린 날짜가 된다.** 한국어 Excel은 짧은 날짜를 형식 14로 저장한다. `XLSX.read(bytes, { type: "array", ... })`에 `dateNF`가 없으면 `sheet_to_json(..., { raw: false })`가 이 셀을 `10/9/24`로 돌려준다. `parseDateCell`은 이것을 YY/MM/DD로 읽어 2010-09-24로 만든다. 일(日)이 12보다 크면 `null`이 되고, 결국 `MAPPING_INVALID`가 난다. `dateNF: "yyyy-mm-dd"`를 넘기면 `2024-10-09`가 나오는 것을 확인했다.

## 작업

TDD로 진행한다. 먼저 `decode.test.ts`에 아래 테스트를 추가해 실패를 확인한 뒤 고친다.

### 1. 인코딩 순서 — `src/lib/ingest/decode.ts`

- `decodeText(bytes, encoding, declaredCharset?)`에서 **선언된 charset은 판별에 쓰지 않는다.** 순서를 다음으로 고정한다.
  1. BOM
  2. sniff가 넘긴 `encoding`(BOM이나 UTF-16 추론 결과)
  3. UTF-8 `fatal: true`
  4. cp949(`iconv.decode`) + 기존 `validCp949` 검사
- 쓰이지 않게 되는 `declaredEncoding`·`findDeclaredCharset`와 세 번째 인자는 지운다. 호출부도 함께 정리한다.
- 테스트:
  - `<meta charset="euc-kr">`로 선언했지만 본문이 UTF-8 한글인 HTML 표를 `decodeFile(bytes, { kind: "html", ... })`로 읽으면 한글이 깨지지 않고 성공한다.
  - `<meta charset="utf-8">`로 선언했지만 본문이 CP949 한글인 HTML 표도 성공한다. CP949 바이트는 `iconv.encode(text, "cp949")`로 합성한다.
  - 기존 fixture(`kbHtmlXls` 등) 테스트는 계속 통과해야 한다.

### 2. xlsx 날짜 — 같은 파일

- 바이너리 통합문서를 읽는 `XLSX.read(bytes, { type: "array", dense: true, sheetRows: 10001 })`에 `dateNF: "yyyy-mm-dd"`를 추가한다. HTML/XML 문자열을 읽는 경로(`type: "string", raw: true`)는 바꾸지 않는다.
- 테스트: `XLSX.utils.book_new()`로 통합문서를 만든다.
  - 셀 1: `{ t: "n", v: 45574, z: XLSX.SSF.get_table()[14] }`
  - 셀 2: `{ t: "n", v: 45580, z: "m/d/yy" }`
  - `XLSX.write(wb, { type: "array", bookType: "xlsx" })`로 쓴 바이트를 `decodeFile(bytes, { kind: "xlsx", ... })`로 읽으면 셀 값이 `2024-10-09`와 `2024-10-15`여야 한다.
  - 같은 형식의 xlsx를 `parseRows`까지 통과시키는 기존 테스트나 fixture가 있으면 그것도 계속 통과해야 한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `TextDecoder('euc-kr')`를 쓰지 않았는가? (CP949 확장 한글이 깨진다)
   - 변경이 `src/lib/ingest/decode.ts`와 테스트 안에 머무르는가?
3. 결과에 따라 `phases/6-hardening/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `parseDateCell`의 `YY/MM/DD` 해석을 `M/D/YY`로 바꾸지 마라. 이유: 한국 카드사 CSV는 `24.10.09`처럼 연도가 먼저 오는 두 자리 연도를 쓴다. 날짜 문제는 SheetJS 출력 형식에서 고친다.
- `cellDates: true`로 바꾸거나 날짜를 `Date` 객체로 다루지 마라. 이유: 셀은 문자열 파이프라인(`normalizeCell` → `parseDateCell`)을 거치고, `Date`는 시간대 오류를 만든다.
- 파일 제한(10MB, `sheetRows: 10001`, 시트 20, 셀 500자, NFC)을 바꾸지 마라.
- 기존 테스트를 깨뜨리지 마라.
