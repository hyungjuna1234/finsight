import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/components/ui/api-fetch", () => ({ apiFetch: mocks.api }));
import { TypedConfirm } from "./typed-confirm";

it("확인 문구가 정확할 때만 요청하고 이동한다", async () => {
  const user = userEvent.setup(); mocks.api.mockResolvedValue(undefined);
  render(<TypedConfirm phrase="전체 삭제" title="데이터 삭제" description="설명" submitLabel="전체 삭제" endpoint="/api/account/delete-data" redirectTo="/upload" />);
  const button = screen.getByRole("button", { name: "전체 삭제" }); expect(button).toBeDisabled();
  await user.type(screen.getByRole("textbox"), "전체 삭제"); expect(button).toBeEnabled(); await user.click(button);
  expect(mocks.api).toHaveBeenCalledWith("/api/account/delete-data", { method: "POST", body: { confirm: "전체 삭제" } });
});
