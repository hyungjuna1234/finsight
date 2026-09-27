import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "./errors";
import {
  guideHrefForError,
  ISSUER_GUIDES,
  troubleAnchor,
  TROUBLESHOOTING,
} from "./guides";

describe("ISSUER_GUIDES", () => {
  it("지원 카드사를 정해진 순서로 중복 없이 제공한다", () => {
    expect(ISSUER_GUIDES.map(({ id }) => id)).toEqual([
      "shinhan",
      "samsung",
      "hyundai",
      "kb",
      "lotte",
      "hana",
    ]);
    expect(new Set(ISSUER_GUIDES.map(({ id }) => id)).size).toBe(6);
    expect(ISSUER_GUIDES.every(({ steps }) => steps.length >= 3)).toBe(true);
  });

  it("확인일은 비어 있거나 YYYY-MM-DD 형식이다", () => {
    expect(
      ISSUER_GUIDES.every(
        ({ verifiedAt }) =>
          verifiedAt === null || /^\d{4}-\d{2}-\d{2}$/.test(verifiedAt),
      ),
    ).toBe(true);
  });
});

describe("TROUBLESHOOTING", () => {
  it("모든 문제 해결 코드가 도메인 오류 코드에 속한다", () => {
    expect(
      TROUBLESHOOTING.every(({ code }) => ERROR_CODES.includes(code)),
    ).toBe(true);
  });

  it("오류 코드별 앵커와 가이드 링크를 만든다", () => {
    expect(troubleAnchor("ENCRYPTED_FILE")).toBe("trouble-encrypted-file");
    expect(guideHrefForError("ENCRYPTED_FILE")).toBe(
      "/guide#trouble-encrypted-file",
    );
    expect(guideHrefForError("EMPTY_FILE")).toBeNull();
    expect(guideHrefForError("NOT_AN_ERROR_CODE")).toBeNull();
  });
});
