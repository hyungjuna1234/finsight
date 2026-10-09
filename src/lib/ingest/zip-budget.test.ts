import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { checkZipBudget, ZIP_LIMITS } from "./zip-budget";

interface Entry { name: string; data: Uint8Array; method?: 0 | 8; declaredSize?: number }

// 테스트용 최소 zip: 로컬 헤더 + 중앙 디렉터리 + EOCD. CRC는 검사하지 않으므로 0으로 둔다.
function zip(entries: Entry[]): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const method = entry.method ?? 8;
    const payload = method === 8 ? deflateRawSync(entry.data) : Buffer.from(entry.data);
    const name = Buffer.from(entry.name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.declaredSize ?? entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(entry.declaredSize ?? entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, payload);
    centrals.push(central, name);
    offset += local.length + name.length + payload.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}

describe("checkZipBudget", () => {
  it("실제 xlsx는 풀린 크기 합계를 돌려준다", () => {
    const sheet = XLSX.utils.aoa_to_sheet([["이용일", "가맹점", "금액"], ["2026-09-01", "가게", 1000]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
    const bytes = new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
    const result = checkZipBudget(bytes);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBeGreaterThan(0);
  });

  it("상한보다 크게 풀리는 항목은 FILE_TOO_COMPLEX", () => {
    expect(checkZipBudget(zip([{ name: "xl/a.xml", data: new Uint8Array(2_000) }]), 1_000)).toEqual({ ok: false, error: "FILE_TOO_COMPLEX" });
  });

  it("선언 크기를 작게 속여도 실제로 풀어서 잰다", () => {
    expect(checkZipBudget(zip([{ name: "xl/a.xml", data: new Uint8Array(2_000), declaredSize: 10 }]), 1_000)).toEqual({ ok: false, error: "FILE_TOO_COMPLEX" });
  });

  it("여러 항목의 합계로 판단한다", () => {
    const entries = [1, 2, 3].map((n) => ({ name: `xl/${n}.xml`, data: new Uint8Array(400) }));
    expect(checkZipBudget(zip(entries), 1_000)).toEqual({ ok: false, error: "FILE_TOO_COMPLEX" });
    expect(checkZipBudget(zip(entries.slice(0, 2)), 1_000)).toEqual({ ok: true, value: 800 });
  });

  it("저장(stored) 항목은 그 크기로 센다", () => {
    expect(checkZipBudget(zip([{ name: "a.bin", data: new Uint8Array(300), method: 0 }]), 1_000)).toEqual({ ok: true, value: 300 });
  });

  it("항목 수가 상한을 넘으면 FILE_TOO_COMPLEX", () => {
    const entries = Array.from({ length: ZIP_LIMITS.maxEntries + 1 }, (_, n) => ({ name: `f${n}`, data: new Uint8Array(1), method: 0 as const }));
    expect(checkZipBudget(zip(entries))).toEqual({ ok: false, error: "FILE_TOO_COMPLEX" });
  });

  it("zip이 아니면 CORRUPT_FILE", () => {
    expect(checkZipBudget(new TextEncoder().encode("not a zip at all"))).toEqual({ ok: false, error: "CORRUPT_FILE" });
  });
});
