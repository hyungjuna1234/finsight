import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/components/ui/api-fetch";
import type { AnalyzeResponse, ConfirmResponse } from "@/lib/domain/upload";
import type { ColumnMapping } from "@/lib/ingest/mapping";
import { analyzeFile, confirmFile, putFile, sha256Hex, startFile } from "./upload-pipeline";

const mapping: ColumnMapping = { headerRowIndex: 0, columns: { date: 0, merchant: 1, amount: 2 } };
const analysis: AnalyzeResponse = { preview: { sheetName: "내역", headerRowIndex: 0, rows: [] }, mapping, autoConfirm: true };

describe("upload pipeline", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("해시, 생성, PUT, 분석을 순서대로 수행하고 userId를 보내지 않는다", async () => {
    const events: string[] = [];
    const api = vi.fn(async (path: string, init: { body?: unknown }) => {
      events.push(path);
      if (path === "/api/uploads") {
        expect(init.body).toEqual({ filename: "내역.csv", size: 3, sha256: "abc" });
        expect(init.body).not.toHaveProperty("userId");
        return { uploadId: "u1", uploadUrl: "https://storage/upload" };
      }
      return analysis;
    });
    const file = new File(["abc"], "내역.csv", { type: "text/csv" });
    const result = await startFile(file, {
      api: api as never,
      sha256Hex: async () => { events.push("hash"); return "abc"; },
      put: async () => { events.push("put"); return true; },
    }, (stage) => events.push(stage));
    expect(result).toEqual({ uploadId: "u1", analysis });
    expect(events).toEqual(["hashing", "hash", "uploading", "/api/uploads", "put", "analyzing", "/api/uploads/u1/analyze"]);
    expect(api).toHaveBeenLastCalledWith("/api/uploads/u1/analyze", { method: "POST", body: {} });
  });

  it("암호 PDF면 비밀번호를 물어 다시 분석하고, 틀리면 다시 묻는다", async () => {
    const api = vi.fn()
      .mockResolvedValueOnce({ uploadId: "u1", uploadUrl: "url" })
      .mockRejectedValueOnce(new ApiError("PDF_PASSWORD_REQUIRED", 422, "safe"))
      .mockRejectedValueOnce(new ApiError("PDF_PASSWORD_WRONG", 422, "safe"))
      .mockResolvedValueOnce(analysis);
    const askPassword = vi.fn().mockResolvedValueOnce("111111").mockResolvedValueOnce("900101");
    const stages: string[] = [];
    const result = await startFile(new File(["%PDF"], "명세서.pdf"), { api, sha256Hex: async () => "abc", put: async () => true }, (stage) => stages.push(stage), askPassword);
    expect(askPassword.mock.calls).toEqual([[false], [true]]);
    expect(api.mock.calls.slice(1).map((call) => call[1])).toEqual([
      { method: "POST", body: {} },
      { method: "POST", body: { password: "111111" } },
      { method: "POST", body: { password: "900101" } },
    ]);
    expect(stages).toEqual(["hashing", "uploading", "analyzing", "password", "analyzing", "password", "analyzing"]);
    expect(result).toEqual({ uploadId: "u1", analysis, password: "900101" });
  });

  it("비밀번호를 물을 수 없으면 암호 오류를 그대로 전파한다", async () => {
    const error = new ApiError("PDF_PASSWORD_REQUIRED", 422, "safe");
    const api = vi.fn().mockResolvedValueOnce({ uploadId: "u1", uploadUrl: "url" }).mockRejectedValueOnce(error);
    await expect(startFile(new File(["x"], "a.pdf"), { api, sha256Hex: async () => "abc", put: async () => true }, vi.fn())).rejects.toBe(error);
  });

  it("PUT 실패를 NETWORK 오류로 바꾸고 분석하지 않는다", async () => {
    const api = vi.fn().mockResolvedValue({ uploadId: "u1", uploadUrl: "https://storage/upload" });
    await expect(startFile(new File(["x"], "a.csv"), {
      api, sha256Hex: async () => "abc", put: async () => false,
    }, vi.fn())).rejects.toMatchObject({ code: "NETWORK" });
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("분석 오류를 그대로 전파한다", async () => {
    const error = new ApiError("ENCRYPTED_FILE", 422, "safe");
    const api = vi.fn().mockResolvedValueOnce({ uploadId: "u1", uploadUrl: "url" }).mockRejectedValueOnce(error);
    await expect(startFile(new File(["x"], "a.csv"), { api, sha256Hex: async () => "abc", put: async () => true }, vi.fn())).rejects.toBe(error);
  });

  it("파일을 SHA-256 소문자 hex로 계산하고 signed URL에만 PUT한다", async () => {
    const digest = vi.fn().mockResolvedValue(Uint8Array.from([0, 15, 160, 255]).buffer);
    vi.stubGlobal("crypto", { subtle: { digest } });
    expect(await sha256Hex(new File(["abc"], "a.csv"))).toBe("000fa0ff");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["abc"], "a.csv", { type: "text/csv" });
    expect(await putFile("https://storage/upload", file)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://storage/upload", { method: "PUT", body: file, headers: { "content-type": "text/csv", "x-upsert": "false" } });
  });

  it("확정 body 계약을 지킨다", async () => {
    const response: ConfirmResponse = { inserted: 1, duplicates: 0, pending: 0, period: null };
    const api = vi.fn().mockResolvedValue(response);
    await expect(confirmFile("u1", mapping, { name: "신한" }, { api, put: putFile, sha256Hex })).resolves.toEqual(response);
    expect(api).toHaveBeenCalledWith("/api/uploads/u1/confirm", { method: "POST", body: { mapping, card: { name: "신한" } } });
    await confirmFile("u1", mapping, { name: "신한" }, { api, put: putFile, sha256Hex }, "900101");
    expect(api).toHaveBeenLastCalledWith("/api/uploads/u1/confirm", { method: "POST", body: { mapping, card: { name: "신한" }, password: "900101" } });
  });

  it("분석 요청에 비밀번호가 있을 때만 담는다", async () => {
    const api = vi.fn().mockResolvedValue(analysis);
    await analyzeFile("u1", undefined, { api, put: putFile, sha256Hex });
    await analyzeFile("u1", "0", { api, put: putFile, sha256Hex });
    expect(api.mock.calls).toEqual([["/api/uploads/u1/analyze", { method: "POST", body: {} }], ["/api/uploads/u1/analyze", { method: "POST", body: { password: "0" } }]]);
  });
});
