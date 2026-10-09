import { err, ok, type Result } from "@/lib/domain/result";
import { inflateRawSync } from "node:zlib";

// xlsx는 zip이다. SheetJS는 항목을 출력 상한 없이 한꺼번에 풀기 때문에, 10MB 안에서 수 GB로 풀리는
// 압축 폭탄을 올리면 함수가 메모리를 다 쓴다. SheetJS에 넘기기 전에 항목을 실제로 풀어 보며 합계를 잰다.
// 중앙 디렉터리의 선언 크기는 공격자가 속일 수 있으므로 믿지 않는다.

export const ZIP_LIMITS = { maxInflatedBytes: 64 * 1024 * 1024, maxEntries: 2_000 } as const;

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

function findEndOfDirectory(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let offset = view.byteLength - 22; offset >= lowest; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD) return offset;
  }
  return -1;
}

export function checkZipBudget(bytes: Uint8Array, budget: number = ZIP_LIMITS.maxInflatedBytes): Result<number, "FILE_TOO_COMPLEX" | "CORRUPT_FILE"> {
  if (bytes.byteLength < 22) return err("CORRUPT_FILE");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndOfDirectory(view);
  if (end < 0) return err("CORRUPT_FILE");

  const entries = view.getUint16(end + 10, true);
  const directoryOffset = view.getUint32(end + 16, true);
  // ZIP64(0xFFFF·0xFFFFFFFF 표식)는 카드 이용내역에 쓰이지 않는다.
  if (entries === 0xffff || directoryOffset === 0xffffffff) return err("FILE_TOO_COMPLEX");
  if (entries > ZIP_LIMITS.maxEntries) return err("FILE_TOO_COMPLEX");

  let total = 0;
  let cursor = directoryOffset;
  try {
    for (let index = 0; index < entries; index += 1) {
      if (view.getUint32(cursor, true) !== CENTRAL) return err("CORRUPT_FILE");
      const method = view.getUint16(cursor + 10, true);
      const compressedSize = view.getUint32(cursor + 20, true);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const localOffset = view.getUint32(cursor + 42, true);
      cursor += 46 + nameLength + extraLength + commentLength;

      if (view.getUint32(localOffset, true) !== LOCAL) return err("CORRUPT_FILE");
      const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
      if (dataStart + compressedSize > bytes.byteLength) return err("CORRUPT_FILE");
      const remaining = budget - total;

      if (method === 0) {
        total += compressedSize;
      } else if (method === 8) {
        // 남은 예산 + 1바이트까지만 풀게 한다. 넘으면 zlib이 RangeError를 던진다.
        const data = bytes.subarray(dataStart, dataStart + compressedSize);
        total += inflateRawSync(data, { maxOutputLength: Math.max(1, remaining + 1) }).byteLength;
      } else {
        return err("CORRUPT_FILE");
      }
      if (total > budget) return err("FILE_TOO_COMPLEX");
    }
  } catch (error) {
    return err(error instanceof RangeError ? "FILE_TOO_COMPLEX" : "CORRUPT_FILE");
  }
  return ok(total);
}
