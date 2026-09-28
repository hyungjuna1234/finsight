import { describe, expect, it } from "vitest";

import { AppError, ERROR_CODES, ERROR_MESSAGES, ERROR_STATUS, isAppError } from "./errors";

describe("domain errors", () => {
  it("모든 에러 코드에 상태와 사용자 메시지가 있다", () => {
    expect(ERROR_CODES).toHaveLength(30);
    for (const code of ERROR_CODES) {
      expect(ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
      expect(ERROR_MESSAGES[code]).toMatch(/요\.|다\.|요$/);
    }
  });

  it("파일 에러의 상태를 구분한다", () => {
    expect(ERROR_STATUS.FILE_TOO_LARGE).toBe(413);
    expect(ERROR_STATUS.UNSUPPORTED_FORMAT).toBe(415);
    expect(ERROR_STATUS.ENCRYPTED_FILE).toBe(422);
    expect(ERROR_STATUS.PDF_PASSWORD_REQUIRED).toBe(422);
    expect(ERROR_STATUS.PDF_PASSWORD_WRONG).toBe(422);
    expect(ERROR_STATUS.PDF_NO_TRANSACTIONS).toBe(422);
  });

  it("PDF 비밀번호 안내는 비밀번호 입력을 요청한다", () => {
    expect(ERROR_MESSAGES.PDF_PASSWORD_REQUIRED).toContain("비밀번호");
    expect(ERROR_MESSAGES.PDF_PASSWORD_WRONG).toContain("비밀번호");
    expect(ERROR_MESSAGES.UNSUPPORTED_FORMAT).toContain("PDF");
  });

  it("AppError는 공개 메시지와 내부 detail을 분리한다", () => {
    const error = new AppError("ENCRYPTED_FILE", "secret-value");
    expect(error.message).toBe("암호가 걸린 파일이에요. 엑셀에서 열어 다른 이름으로 저장한 뒤 올려 주세요.");
    expect(error.message).not.toContain("secret-value");
    expect(error.detail).toBe("secret-value");
    expect(error.status).toBe(422);
    expect(isAppError(error)).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
  });
});
