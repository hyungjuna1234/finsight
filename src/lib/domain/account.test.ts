import { expect, it } from "vitest";
import { DELETE_ACCOUNT_PHRASE, DELETE_DATA_PHRASE } from "./account";

it("위험 작업의 확인 문구를 고정한다", () => {
  expect(DELETE_DATA_PHRASE).toBe("전체 삭제");
  expect(DELETE_ACCOUNT_PHRASE).toBe("탈퇴");
});
