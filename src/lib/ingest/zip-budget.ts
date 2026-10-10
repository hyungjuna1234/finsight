import { err, ok, type Result } from "@/lib/domain/result";
import { inflateRawSync } from "node:zlib";

// xlsx는 zip이다. SheetJS는 항목을 출력 상한 없이 한꺼번에 풀기 때문에, 10MB 안에서 수 GB로 풀리는
// 압축 폭탄을 올리면 함수가 메모리를 다 쓴다. SheetJS에 넘기기 전에 항목을 실제로 풀어 보며 합계를 잰다.
//
// 상한 검사는 SheetJS(xlsx.mjs의 cfb parse_zip·parse_local_file)가 푸는 바이트와 같은 바이트를 재야 한다.
// 다르게 읽으면 그 틈으로 폭탄이 통과한다. 그래서 SheetJS처럼
// - EOCD는 파일 끝 4바이트 앞부터 거꾸로 찾고, 항목 수는 +8(이 디스크의 항목 수)을 쓴다(+10과 다르면 거부),
// - 압축 방식은 로컬 헤더에서 읽고, deflate는 압축 크기와 상관없이 스트림이 끝날 때까지 푼다.
// 선언된 크기는 공격자가 속일 수 있으므로 믿지 않는다.

export const ZIP_LIMITS = { maxInflatedBytes: 64 * 1024 * 1024, maxEntries: 2_000 } as const;

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const ENCRYPTED_FLAGS = 0x2041;

function findEndOfDirectory(view: DataView): number {
  for (let offset = view.byteLength - 4; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD) return offset;
  }
  return -1;
}

function overBudget(error: unknown): boolean {
  return error instanceof RangeError && (error as { code?: unknown }).code === "ERR_BUFFER_TOO_LARGE";
}

export function checkZipBudget(bytes: Uint8Array, budget: number = ZIP_LIMITS.maxInflatedBytes): Result<number, "FILE_TOO_COMPLEX" | "CORRUPT_FILE"> {
  if (bytes.byteLength < 22) return err("CORRUPT_FILE");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndOfDirectory(view);
  if (end < 0 || end + 20 > bytes.byteLength) return err("CORRUPT_FILE");

  const entries = view.getUint16(end + 8, true);
  if (entries !== view.getUint16(end + 10, true)) return err("CORRUPT_FILE");
  const directoryOffset = view.getUint32(end + 16, true);
  // ZIP64(0xFFFF·0xFFFFFFFF 표식)는 카드 이용내역에 쓰이지 않는다.
  if (entries === 0xffff || directoryOffset === 0xffffffff) return err("FILE_TOO_COMPLEX");
  if (entries > ZIP_LIMITS.maxEntries) return err("FILE_TOO_COMPLEX");

  let total = 0;
  let cursor = directoryOffset;
  try {
    for (let index = 0; index < entries; index += 1) {
      if (view.getUint32(cursor, true) !== CENTRAL) return err("CORRUPT_FILE");
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const localOffset = view.getUint32(cursor + 42, true);
      cursor += 46 + nameLength + extraLength + commentLength;

      if (view.getUint32(localOffset, true) !== LOCAL) return err("CORRUPT_FILE");
      const flags = view.getUint16(localOffset + 6, true);
      const method = view.getUint16(localOffset + 8, true);
      const storedSize = view.getUint32(localOffset + 18, true);
      const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
      if (flags & ENCRYPTED_FLAGS || dataStart > bytes.byteLength) return err("CORRUPT_FILE");

      if (method === 0) {
        total += Math.min(storedSize, bytes.byteLength - dataStart);
      } else if (method === 8) {
        // 남은 예산 + 1바이트까지만 풀게 한다. 넘으면 zlib이 ERR_BUFFER_TOO_LARGE를 던진다.
        total += inflateRawSync(bytes.subarray(dataStart), { maxOutputLength: Math.max(1, budget - total + 1) }).byteLength;
      } else {
        return err("CORRUPT_FILE");
      }
      if (total > budget) return err("FILE_TOO_COMPLEX");
    }
  } catch (error) {
    return err(overBudget(error) ? "FILE_TOO_COMPLEX" : "CORRUPT_FILE");
  }
  return ok(total);
}
