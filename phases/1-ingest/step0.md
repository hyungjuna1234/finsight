# Step 0: fixture-corpus

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/AGENTS.md`
- `/docs/ARCHITECTURE.md` (핵심 순수 함수, 파일 제한, 인코딩, `identityKey`)
- `/docs/USER_FLOWS.md` (예외·오류 처리의 "파일"·"거래 해석")
- `/docs/ADR.md` (ADR-003, ADR-004, ADR-006)
- `/src/lib/domain/errors.ts`, `/src/lib/domain/month.ts` (0-foundation 산출물)
- `/vitest.config.mts`, `/scripts/hooks/tdd-guard.sh` (`src/test/**`는 TDD guard 예외)
- `node_modules/xlsx/types/index.d.ts` (`utils.aoa_to_sheet`, `write`의 `bookType`: `xlsx`·`xlml`·`biff8`, `CFB`), `node_modules/iconv-lite/README.md` (`encode`)

이 phase(1-ingest)의 모든 step은 이 fixture로 검증한다. 실제 명세서는 레포에 넣지 않는다 — **테스트 실행 중에 코드로 합성한다.**

## 작업

### 1. `src/test/fixtures/statements.ts`
```ts
export const FIXTURE_TODAY = "2026-09-30" as IsoDate;   // 이후 step에서 parseRows(…, today)에 넘긴다 (IsoDate는 @/lib/domain/types)
export type FixtureStage = "sniff" | "decode" | "table";
export type ExpectedSkip = "summary" | "blank" | "bad_date" | "bad_amount" | "zero_amount";
export interface ExpectedMapping { date: number; merchant: number; amount: number; approvalNo?: number; installment?: number;
  cancelFlag?: number; foreignAmount?: number; foreignCurrency?: number; cardNumber?: number }   // 열 인덱스(0부터)
export interface FixtureExpect {
  sniff?: "xlsx" | "xls" | "html" | "xml" | "text";          // sniffFile 결과 kind
  error?: { stage: FixtureStage; code: string };              // 실패가 기대되면 단계와 에러 코드
  sheetCount?: number; sheetName?: string;                    // 표가 있는 시트
  headerRowIndex?: number; headers?: string[];                // 시트 행 기준 인덱스, NFC 정규화된 헤더
  mapping?: ExpectedMapping;                                  // 정답 열 매핑
  periodHint?: { from: string; to: string } | null;
  parsed?: { rows: number; spend: number; refund: number; cancelled: number; pending: number; netSpendKrw: number;
             skipped: Partial<Record<ExpectedSkip, number>>; period: { from: string; to: string } };
}
export interface StatementFixture { name: string; issuer: string | null; filename: string; bytes: Uint8Array; expect: FixtureExpect }
export function allFixtures(opts?: { heavy?: boolean }): StatementFixture[]   // heavy=true면 1만 행 fixture 포함
export function getFixture(name: string): StatementFixture
export function hyundaiForeignPair(): [pending: StatementFixture, confirmed: StatementFixture]
```
- `parsed` 정의: `rows` = 파싱된 행 전체(= spend + refund + cancelled). `spend`·`refund`는 cancelled가 아닌 행 수, `pending`은 status가 pending인 행 수. `netSpendKrw` = (cancelled 아닌 spend 금액 합) − (cancelled 아닌 refund 금액 합). `period`는 파싱된 행(cancelled 포함)의 최소·최대 날짜.
- **완전히 빈 행**은 표 탐지(Step 2)에서 빠지므로 `skipped`에 세지 않는다. `blank`는 날짜·가맹점·금액 셀은 비었지만 다른 셀에 값이 있는 행이다.
- 각 fixture는 **행 명세 배열**로 만든다. 행마다 기대 결과 주석(`{ kind, status, amountKrw }` 또는 `{ skip: ExpectedSkip }`)을 붙이고, `expect.parsed`는 이 주석만 더해서 만든다(파서 로직을 흉내 내지 않는다). builder 위 JSDoc에 기대 결과를 한 줄로 적는다(예: "12행 파싱 · 취소 1 · 환불 1 · 순지출 ₩187,400 · 건너뜀: 합계1·0원1·날짜2").
- 빌드 결과는 모듈 안에서 memoize한다(1만 행 fixture를 여러 테스트가 공유).
- 카드사명·헤더 이름은 그럴듯하게 **지어낸 것**이다. 실제 형식과 같을 필요는 없지만 아래 변형을 반드시 포함한다.

| name | 파일 | 형식·인코딩 | 내용 | 기대 |
|---|---|---|---|---|
| `shinhanCsvBom` | 신한.csv | UTF-8 **BOM**, 쉼표 | `이용일자,이용카드,가맹점명,이용금액,할부개월,승인번호,취소여부`, 날짜 `2026.08.03`, 이용카드 `본인 1234-****-****-5678`, 할부 `3`개월 1건, 취소여부 `Y` 1건, **같은 날·같은 가맹점·같은 금액 2건**(승인번호 다름), `0`원 1건, 날짜 이상 2건(`1999.12.31`, `2027.01.15`), `(12,000)` 환불 1건, 가맹점 `스마트스토어 010-1234-5678` 1건, 끝에 `합계` 행 | 파싱 성공 |
| `samsungCp949` | 삼성.csv | **CP949**(`iconv.encode`) | 제목행 `삼성카드 이용내역`, `조회기간 : 2025.12.01 ~ 2026.01.31`, 빈 행 → 헤더 `이용일,가맹점,이용금액,할부,승인번호`, 날짜는 **연도 없는** `12/28`·`01/03`(12월→1월 경계), `-15,000` 환불, CP949 확장 한글 가맹점(`똠양꿍하우스`), 끝 `합계` | periodHint 2025-12-01~2026-01-31 |
| `hyundaiXlsx` | 현대.xlsx | SheetJS `xlsx`, **시트 3개** | `안내`(문장 2행), `국내이용내역`(가장 많은 행: `이용일,이용가맹점,이용금액,결제방법,승인번호`, 이용일은 **서식 없는 엑셀 일련번호 숫자** 셀), `해외이용내역`(3행) | sheetName `국내이용내역` |
| `kbHtmlXls` | 국민.xls | **HTML 표**, CP949 + `<meta charset="euc-kr">` | 손으로 쓴 `<table>`: `이용일시,이용하신곳,국내이용금액(원),해외이용금액,결제방법,승인번호,상태`, 이용일시 `2026.08.03 12:34`, 상태 `정상`·`취소`·`부분취소`(음수 금액), 승인번호 `00123456`(앞자리 0) | 앞자리 0 보존 |
| `lotteUtf16Tsv` | 롯데.xls | **UTF-16LE BOM**, 탭 구분 | `거래일자\t가맹점명\t이용금액\t할부기간`(승인번호 없음), **완전히 같은 행 2건**, 중간에 완전히 빈 행 1개와 할부기간 칸만 채운 행 1개(`blank`) | 두 건 모두 보존 |
| `hanaSpreadsheetMl` | 하나.xls | SpreadsheetML(`bookType: "xlml"`) UTF-8 | 헤더·가맹점명을 **NFD**로 저장. `이용일자,가맹점명,이용금액,해외이용금액,통화코드,승인번호`, 해외 확정 1건(USD) | 헤더 NFC로 인식 |
| `hanaBiff8Xls` | 하나_구형.xls | SheetJS `bookType: "biff8"`(진짜 CFB xls) | 5행 소형 이용내역 | sniff `xls` |
| `billingStatement` | 청구서.xlsx | xlsx | `이용일자,가맹점명,이용금액,회차,청구금액,잔여금액` | table `BILLING_STATEMENT` |
| `bankStatement` | 은행.csv | UTF-8 | `거래일시,적요,출금액,입금액,잔액,거래점` | table `BANK_STATEMENT` |
| `noHeader` | 메모.csv | UTF-8 | 문장 몇 줄 | table `HEADER_NOT_FOUND` |
| `tooManyRows` (heavy) | 대량.csv | UTF-8 | 헤더 + 데이터 **10,001행** | decode `TOO_MANY_ROWS` |
| `nearLimitRows` (heavy) | 경계.csv | UTF-8 | 헤더 + 데이터 9,999행(시트 10,000행) | 파싱 9,999행 |
| `tooManySheets` | 시트많음.xlsx | xlsx | 시트 21개 | decode `FILE_TOO_COMPLEX` |
| `encryptedXlsx` | 암호.xlsx | CFB | 아래 설명 | sniff `ENCRYPTED_FILE` |
| `corruptXlsx` | 깨짐.xlsx | `PK\x03\x04` + 무작위 바이트(시드 고정) | — | decode `CORRUPT_FILE` |
| `badEncoding` | 깨짐.csv | ASCII 헤더 + `0xFF`·`0x80` 바이트 다수(NUL 없음) | — | decode `ENCODING_ERROR` |
| `pdfAsXls` · `pngAsXlsx` | card.xls · card.xlsx | `%PDF-1.7…` · PNG 시그니처 | — | sniff `UNSUPPORTED_FORMAT` |
| `emptyCsv` | empty.csv | 0바이트 | — | sniff `EMPTY_FILE` |

- `hyundaiForeignPair()`: 같은 형식의 xlsx 2개(`이용일,이용가맹점,이용금액,해외이용금액,통화,승인번호,매입상태`). 해외 1건이 **같은 승인번호·같은 이용일**로 양쪽에 있고, 먼저 받은 파일은 `매입상태: 미매입`·이용금액 `17,650`(추정), 나중 파일은 `매입`·`17,812`(확정). 국내 2건은 양쪽에 똑같이 있다. 기대: 앞 파일 pending 1건, 뒤 파일 pending 0건, 해외 건의 식별 키가 같다(Step 4에서 검증).
- **암호 파일**: SheetJS community판은 암호 걸린 파일을 **쓸 수 없다**(write에 password 옵션 없음). 대신 암호화된 OOXML의 컨테이너 구조를 흉내 낸다 — `XLSX.CFB.utils.cfb_new()` → `cfb_add(cfb, "/EncryptionInfo", 더미 바이트)`·`cfb_add(cfb, "/EncryptedPackage", 더미 바이트)` → `XLSX.CFB.write(cfb, { type: "array" })`. 결과는 매직 `D0 CF 11 E0 A1 B1 1A E1`로 시작하고 UTF-16LE `EncryptedPackage` 문자열을 포함하며, `XLSX.read`하면 `/password-protected/` 에러가 난다. 이 이유를 주석으로 남긴다.

### 2. `src/test/fixtures/statements.test.ts`
- 이름이 유일하고, 파일명 확장자는 `csv`·`xls`·`xlsx` 중 하나다.
- 바이트 검증: BOM `EF BB BF`, UTF-16LE BOM `FF FE`, CP949 fixture는 `new TextDecoder("utf-8", { fatal: true })`가 실패하고 `iconv.decode(…, "cp949")`로 원문과 같다, NFD fixture는 `s !== s.normalize("NFC")`인 문자열을 포함, xlsx는 `PK`로 시작, 암호 fixture는 CFB 매직 + UTF-16LE `EncryptedPackage` 포함 + `XLSX.read`가 `/password-protected/`로 실패, PDF는 `%PDF`로 시작.
- `XLSX.read`로 xlsx·xlml·biff8 fixture를 다시 읽으면 시트 수와 헤더가 `expect`와 같다.
- `expect.parsed`가 행 주석 합계와 같다. `shinhanCsvBom`의 `parsed.rows` 등 핵심 수치 몇 개는 리터럴로도 고정한다.
- heavy fixture의 행 수(헤더 포함 10,002 / 10,000)를 확인한다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 바이너리 파일이 레포에 추가되지 않았는가? (`git status`에 `.xlsx`·`.xls`·`.csv`가 없어야 한다)
   - fixture 모듈이 `src/lib/ingest/*`를 import하지 않는가?
   - 실명·실제 카드번호처럼 보이는 값이 없는가?
3. 결과에 따라 `phases/1-ingest/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (fixture 이름 목록과 `FixtureExpect` 필드를 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 실제 명세서, 실명, 실제 카드번호·승인번호를 쓰지 마라. 이유: 개인정보이며 레포는 harness가 자동 커밋한다. 카드번호는 `1234-****-****-5678`처럼 지어낸 값만 쓴다.
- `.xlsx`·`.xls`·`.csv` 파일을 디스크에 쓰거나 커밋하지 마라. 이유: 리뷰할 수 없고 실데이터가 섞일 위험이 있다. 바이트는 메모리에서만 만든다.
- 기대값을 파서처럼 계산하는 코드를 만들지 마라(행 주석 합산만 허용). 이유: 파서와 같은 버그를 공유하면 이후 테스트가 아무것도 검증하지 못한다.
- `src/lib/ingest/*` 구현을 이 step에서 만들지 마라. 이유: Step 1 이후의 범위다.
- 무작위 바이트를 `Math.random()`으로 만들지 마라. 이유: 테스트가 매번 달라진다. 시드 고정 의사난수를 쓴다.
- 기존 테스트를 깨뜨리지 마라.
