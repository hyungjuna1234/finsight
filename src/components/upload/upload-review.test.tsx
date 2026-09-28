import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock("@/components/ui/api-fetch", async (load) => ({ ...(await load<typeof import("@/components/ui/api-fetch")>()), apiFetch: apiMock }));
import { ApiError } from "@/components/ui/api-fetch";
import { UploadReview } from "./upload-review";

const analysis = { preview: { sheetName: "s", headerRowIndex: 0, rows: [["날짜", "가맹점", "금액"], ["2026-09-01", "상점", "1000"]] }, mapping: { headerRowIndex: 0, columns: { date: 0, merchant: 1, amount: 2 } }, autoConfirm: false };

it("마운트 시 저장된 업로드를 다시 분석한다", async () => {
  apiMock.mockReset().mockResolvedValue(analysis);
  render(<UploadReview uploadId="u1" filename="내역.csv" cards={[]} />);
  expect(await screen.findByText("내역.csv")).toBeInTheDocument();
  expect(apiMock).toHaveBeenCalledWith("/api/uploads/u1/analyze", { method: "POST", body: {} });
});

it("암호 PDF면 비밀번호를 받아 다시 분석하고 확정에도 보낸다", async () => {
  const user = userEvent.setup();
  apiMock.mockReset()
    .mockRejectedValueOnce(new ApiError("PDF_PASSWORD_REQUIRED", 422, "safe"))
    .mockResolvedValueOnce(analysis)
    .mockResolvedValueOnce({ inserted: 1, duplicates: 0, pending: 0, period: null });
  render(<UploadReview uploadId="u1" filename="명세서.pdf" cards={[]} />);
  await user.type(await screen.findByLabelText("PDF 비밀번호"), "900101");
  await user.click(screen.getByRole("button", { name: "열기" }));
  expect(apiMock).toHaveBeenLastCalledWith("/api/uploads/u1/analyze", { method: "POST", body: { password: "900101" } });
  await user.type(await screen.findByLabelText("새 카드 이름"), "농협");
  await user.click(screen.getByRole("button", { name: "저장하고 분석" }));
  expect(apiMock).toHaveBeenLastCalledWith("/api/uploads/u1/confirm", { method: "POST", body: { mapping: analysis.mapping, card: { name: "농협" }, password: "900101" } });
});
