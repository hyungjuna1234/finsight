# Step 1: file-decode

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (`sniffFile`·`decodeFile` 시그니처, 파일 제한, 인코딩, 외부 SDK 메모의 SheetJS·iconv-lite)
- `/docs/ADR.md` (ADR-003)
- `/src/lib/domain/result.ts`, `/src/lib/domain/errors.ts` (0-foundation)
- `/src/test/fixtures/statements.ts` (Step 0 — `allFixtures`, `getFixture`, `FixtureExpect`)
- `node_modules/xlsx/types/index.d.ts` (`ParsingOptions`의 `sheetRows`·`dense`·`raw`, `utils.sheet_to_json`), `node_modules/xlsx/dist/cpexcel.d.ts`, `node_modules/iconv-lite/README.md`

## 작업

TDD로 진행한다: 각 파일마다 같은 폴더에 `X.test.ts`를 먼저 쓰고, 실패를 확인한 뒤 구현한다.

### 1. `src/lib/domain/upload.ts` — 클라이언트·서버 공용 제한값
```ts
export const UPLOAD_LIMITS = { maxBytes: 10 * 1024 * 1024, maxRows: 10_000, maxSheets: 20, maxColumns: 100, maxCellChars: 500 } as const;
export const ACCEPTED_EXTENSIONS = ["csv", "xls", "xlsx"] as const;
export type AcceptedExtension = (typeof ACCEPTED_EXTENSIONS)[number];
export const ACCEPT_ATTR: string;   // <input accept>: ".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
export function fileExtension(filename: string): AcceptedExtension | null;           // 대소문자 무시, 마지막 점 기준
export function checkUploadFile(f: { name: string; size: number }): "FILE_TOO_LARGE" | "UNSUPPORTED_FORMAT" | "EMPTY_FILE" | null;
```

### 2. `src/lib/ingest/sniff.ts`
```ts
export type SniffKind = "xlsx" | "xls" | "html" | "xml" | "text";
export type TextEncoding = "utf-8" | "utf-16le" | "utf-16be";
export interface Sniff { kind: SniffKind; extension: AcceptedExtension; encoding: TextEncoding | null }  // null = decode에서 UTF-8 → CP949 판단
export function sniffFile(bytes: Uint8Array, filename: string): Result<Sniff, "UNSUPPORTED_FORMAT" | "ENCRYPTED_FILE" | "EMPTY_FILE">;
```
판정 순서(내용이 확장자보다 우선이다 — xls 확장자의 HTML·XML·텍스트는 정상 입력):
1. 0바이트이거나 BOM·공백뿐이면 `EMPTY_FILE`. 확장자가 csv·xls·xlsx가 아니면 `UNSUPPORTED_FORMAT`.
2. `%PDF`, PNG `89 50 4E 47`, JPEG `FF D8 FF`, GIF `GIF8`, 4번째 바이트부터 `ftyp`(HEIC) → `UNSUPPORTED_FORMAT`.
3. CFB 매직 `D0 CF 11 E0 A1 B1 1A E1`: 바이트 안에 UTF-16LE `EncryptionInfo` 또는 `EncryptedPackage`가 있으면 `ENCRYPTED_FILE`, 아니면 `xls`.
4. `PK 03 04` → `xlsx`.
5. 텍스트: BOM(UTF-8/UTF-16LE/BE)으로 `encoding`을 정한다. BOM 없이 앞 512바이트의 홀수(짝수) 위치가 30% 이상 `0x00`이면 UTF-16LE(BE). 앞부분(공백 무시, 대소문자 무시)이 `<?xml`이고 `urn:schemas-microsoft-com:office:spreadsheet` 또는 `<Workbook`을 포함하면 `xml`, `<html`·`<!doctype html`·`<table`·`<meta`로 시작하면 `html`. 그 외 UTF-16이 아닌데 앞 8KB에 `0x00`이 있으면 `UNSUPPORTED_FORMAT`, 아니면 `text`.

### 3. `src/lib/ingest/decode.ts`
```ts
export interface Sheet { name: string; rows: string[][] }
export function normalizeCell(v: unknown): string;          // String → NFC → U+00A0를 공백으로 → trim → 500자에서 자름
export function decodeText(bytes: Uint8Array, encoding: TextEncoding | null, declaredCharset?: string | null): Result<string, "ENCODING_ERROR">;
export function sniffDelimiter(text: string): "," | "\t" | ";";
export function parseDelimited(text: string, delimiter: string): string[][];
export function decodeFile(bytes: Uint8Array, sniff: Sniff):
  Result<Sheet[], "ENCODING_ERROR" | "CORRUPT_FILE" | "TOO_MANY_ROWS" | "FILE_TOO_COMPLEX" | "ENCRYPTED_FILE">;
```
- **시그니처 메모**: ARCHITECTURE.md의 `decodeFile` 에러 목록에 `ENCRYPTED_FILE`을 더한다. sniff가 못 잡는 구형 xls 암호(BIFF FILEPASS)는 SheetJS가 `/password-protected/` 에러로 알려 주기 때문이다.
- `decodeText`: BOM이 있으면 떼고 그 인코딩으로. `encoding`이 주어지면 그것으로. 없으면 `declaredCharset`(`euc-kr`·`ks_c_5601-1987`·`cp949`·`x-windows-949` → cp949, `utf-8`) → 없으면 `new TextDecoder("utf-8", { fatal: true })` → 실패하면 `iconv.decode(Buffer.from(bytes), "cp949")`. cp949 결과에 U+FFFD가 10개 이상이거나 전체 글자의 1%를 넘으면 `ENCODING_ERROR`.
- `text`: `decodeText` → `sniffDelimiter`(따옴표 밖의 `,`·`\t`·`;` 개수가 앞 20개 비어 있지 않은 줄에서 가장 일정하게 1 이상인 것, 기본 `,`) → `parseDelimited`(RFC 4180: 따옴표, `""` 이스케이프, 따옴표 안 줄바꿈, CRLF·LF·CR, 마지막 줄바꿈 뒤 빈 행 없음). 시트 1개 `{ name: "Sheet1" }`.
- `html`·`xml`: `decodeText(bytes, sniff.encoding, <meta charset>·<meta content="…charset=…">·<?xml encoding="…">에서 찾은 값)` → `XLSX.read(text, { type: "string", raw: true, dense: true, sheetRows: 10001 })`. `raw: true`로 값 자동 변환을 막는다(승인번호 앞자리 0 보존).
- `xlsx`·`xls`: `XLSX.read(bytes, { type: "array", dense: true, sheetRows: 10001 })`.
- SheetJS 초기화(모듈 최상단 1회): `import * as XLSX from "xlsx"; import * as cpexcel from "xlsx/dist/cpexcel.full.mjs"; XLSX.set_cptable(cpexcel);`
- SheetJS 예외: 메시지가 `/password-protected/i`면 `ENCRYPTED_FILE`, 나머지는 전부 `CORRUPT_FILE`. 시트가 0개여도 `CORRUPT_FILE`.
- 제한: 시트 수 > 20 → `FILE_TOO_COMPLEX`(시트 변환 전에 검사). 시트별로 `ws["!fullref"]`가 있고 `!ref`와 다르거나(= `sheetRows`로 잘림) 행 수(끝의 빈 행 제외) > 10,000 → `TOO_MANY_ROWS`, 열 > 100 → `FILE_TOO_COMPLEX`. 텍스트도 행 > 10,000이면 `TOO_MANY_ROWS`.
- 셀: `XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "", blankrows: true })` → 모든 셀 `normalizeCell`. 중간의 빈 행은 `[]`가 아니라 빈 문자열 배열로 **남겨 행 인덱스를 보존**하고, 끝의 빈 행만 뗀다. 서식 없는 엑셀 날짜 일련번호는 숫자 문자열(`"46234"`)로 남는다(해석은 Step 2·4).

### 4. 테스트 (fixture 사용)
- `sniff.test.ts`: `allFixtures()`에서 `expect.sniff`가 있으면 kind가 같고, `expect.error.stage === "sniff"`면 그 코드가 나온다. 확장자 `.pdf`·`.txt` → `UNSUPPORTED_FORMAT`, BOM만 있는 파일 → `EMPTY_FILE`.
- `decode.test.ts`: `stage === "decode"` fixture는 그 코드(heavy 포함). 성공 fixture는 `sheetCount`, `sheetName` 시트의 `headerRowIndex` 행이 `expect.headers`와 같다(NFD fixture 포함). `똠양꿍하우스` 복원, `00123456` 보존, 따옴표 안 쉼표·줄바꿈, 탭 구분 판별, 500자 자름. 암호 fixture 바이트를 `{ kind: "xls", … }`로 직접 `decodeFile`에 넣으면 `ENCRYPTED_FILE`.
- `upload.test.ts`: 확장자·크기(10MB 경계, 0바이트) 표.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/lib/**`가 next·react·supabase·server·services를 import하지 않는가? (`xlsx`·`iconv-lite`는 순수 파싱 라이브러리라 허용)
   - SheetJS 호출에 항상 `sheetRows: 10001`과 `dense: true`가 있는가?
   - 에러 결과·예외 메시지에 셀 내용이 들어가지 않는가?
3. 결과에 따라 `phases/1-ingest/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (만든 모듈과 주요 export 이름을 적는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `TextDecoder("euc-kr")`를 쓰지 마라. 이유: CP949 확장 한글(`똠` 등)이 깨진다. `iconv-lite`의 `cp949`만 쓴다.
- `sheetRows` 없이 `XLSX.read`를 부르지 마라. 이유: 거대 파일·압축 폭탄이 서버 메모리를 다 쓴다.
- CSV·TSV를 SheetJS 기본 옵션으로 읽지 마라. 이유: 값 자동 변환으로 승인번호 앞자리 0과 날짜 형식이 바뀐다. 텍스트는 자체 파서로 읽는다.
- 파일 확장자만 보고 형식을 정하지 마라. 이유: 카드사 xls의 상당수는 HTML·XML·텍스트다.
- 새 npm 의존성(CSV 파서, chardet 등)을 추가하지 마라. 이유: CLAUDE.md 규칙. 필요한 것은 전부 설치되어 있다.
- 기존 테스트를 깨뜨리지 마라.
