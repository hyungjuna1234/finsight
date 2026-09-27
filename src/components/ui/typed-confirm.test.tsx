import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/components/ui/api-fetch", () => ({ apiFetch: mocks.api }));
import { TypedConfirm } from "./typed-confirm";

beforeEach(() => vi.clearAllMocks());

it("확인 문구가 정확할 때만 요청하고 이동한다", async () => {
  const user = userEvent.setup(); mocks.api.mockResolvedValue(undefined);
  render(<TypedConfirm phrase="전체 삭제" title="데이터 삭제" description="설명" submitLabel="전체 삭제" endpoint="/api/account/delete-data" redirectTo="/upload" />);
  const button = screen.getByRole("button", { name: "전체 삭제" }); expect(button).toBeDisabled();
  await user.type(screen.getByRole("textbox"), "전체 삭제"); expect(button).toBeEnabled(); await user.click(button);
  expect(mocks.api).toHaveBeenCalledWith("/api/account/delete-data", { method: "POST", body: { confirm: "전체 삭제" } });
});

it("오류 코드별 문구와 danger 버튼을 사용하고 요청 중 비활성화한다", async () => {
  const user = userEvent.setup();
  let rejectRequest!: (reason: unknown) => void;
  mocks.api.mockReturnValue(new Promise((_, reject) => { rejectRequest = reject; }));
  render(<TypedConfirm phrase="탈퇴" title="탈퇴" description="설명" submitLabel="탈퇴하기" endpoint="/api/account/delete" redirectTo="/" tone="danger" errorMessages={{ BILLING_UNAVAILABLE: "구독 해지 실패" }} />);
  const button = screen.getByRole("button", { name: "탈퇴하기" });
  expect(button).toHaveClass("text-spend-up");
  await user.type(screen.getByRole("textbox"), "탈퇴");
  await user.click(button);
  expect(screen.getByRole("button", { name: "삭제 중" })).toBeDisabled();
  rejectRequest({ code: "BILLING_UNAVAILABLE" });
  expect(await screen.findByRole("alert")).toHaveTextContent("구독 해지 실패");
});
