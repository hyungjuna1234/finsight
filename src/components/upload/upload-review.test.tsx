import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock("@/components/ui/api-fetch", async (load) => ({ ...(await load<typeof import("@/components/ui/api-fetch")>()), apiFetch: apiMock }));
import { UploadReview } from "./upload-review";

it("마운트 시 저장된 업로드를 다시 분석한다", async () => {
  apiMock.mockResolvedValue({ preview: { sheetName: "s", headerRowIndex: 0, rows: [["날짜", "가맹점", "금액"]] }, mapping: { headerRowIndex: 0, columns: { date: 0, merchant: 1, amount: 2 } }, autoConfirm: false });
  render(<UploadReview uploadId="u1" filename="내역.csv" cards={[]} />);
  expect(await screen.findByText("내역.csv")).toBeInTheDocument();
  expect(apiMock).toHaveBeenCalledWith("/api/uploads/u1/analyze", { method: "POST" });
});
