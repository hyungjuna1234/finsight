import { describe, expect, it } from "vitest";

import { detectInAppBrowser } from "./user-agent";

describe("detectInAppBrowser", () => {
  const cases = [
    ["Mozilla/5.0 (Linux; Android 14) KAKAOTALK 11.1.0", "kakaotalk"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Instagram 334.0.0.22.101", "instagram"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) [FBAN/FBIOS;FBAV/430.0]", "facebook"],
    ["Mozilla/5.0 (Linux; Android 13) NAVER(inapp; search; 2000; 12.7.1)", "naver"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Line/13.15.0", "line"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Mobile/15E148 Safari/604.1", null],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36", null],
    ["", null],
  ] satisfies Array<[string, ReturnType<typeof detectInAppBrowser>]>;

  it.each(cases)("%s", (ua, expected) => {
    expect(detectInAppBrowser(ua)).toBe(expected);
  });
});
