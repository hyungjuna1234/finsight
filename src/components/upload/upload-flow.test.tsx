import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
const { apiMock, startMock, confirmMock } = vi.hoisted(() => ({ apiMock: vi.fn(), startMock: vi.fn(), confirmMock: vi.fn() }));
vi.mock("@/components/ui/api-fetch", async (load) => ({ ...(await load<typeof import("@/components/ui/api-fetch")>()), apiFetch: apiMock }));
vi.mock("./upload-pipeline", async (load) => ({ ...(await load<typeof import("./upload-pipeline")>()), startFile: startMock, confirmFile: confirmMock, sha256Hex: vi.fn(), putFile: vi.fn() }));
import { UploadFlow } from "./upload-flow";

const analysis = { preview: { sheetName: "s", headerRowIndex: 0, rows: [["날짜", "가맹점", "금액"], ["2026-09-01", "상점", "1000"]] }, mapping: { headerRowIndex: 0, columns: { date: 0, merchant: 1, amount: 2 } }, autoConfirm: true };

beforeEach(() => { vi.clearAllMocks(); confirmMock.mockResolvedValue({ inserted: 1, duplicates: 0, pending: 0, period: null }); });

it("빈 상태에서 가이드 링크를 보여 준다", () => {
  render(<UploadFlow cards={[]} hasUploads={false} />);
  expect(screen.getByText("카드사 홈페이지에서 받은 이용내역 파일을 올려 주세요")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "파일은 어디서 받나요?" })).toHaveAttribute("href", "/guide");
});

it("두 파일을 첫 확정 뒤 두 번째 생성 순서로 처리한다", async () => {
  const user = userEvent.setup(); let n = 0;
  startMock.mockImplementation(async () => ({ uploadId: `u${++n}`, analysis }));
  render(<UploadFlow cards={[]} hasUploads />);
  await user.type(screen.getByLabelText("새 카드 이름"), "신한");
  await user.upload(screen.getByLabelText("카드 이용내역 파일 선택"), [new File(["a"], "a.csv"), new File(["b"], "b.csv")]);
  await screen.findAllByText(/1건 추가/);
  expect(startMock).toHaveBeenCalledTimes(2);
  expect(confirmMock.mock.invocationCallOrder[0]).toBeLessThan(startMock.mock.invocationCallOrder[1]!);
  expect(screen.queryByText("열 이름이 맞는지 확인해 주세요.")).not.toBeInTheDocument();
});

it("수동 리뷰에서 멈춘 뒤 제출하면 다음 파일을 처리한다", async () => {
  const user = userEvent.setup(); let n = 0;
  startMock.mockImplementation(async () => ({ uploadId: `u${++n}`, analysis: { ...analysis, autoConfirm: n > 1 } }));
  render(<UploadFlow cards={[]} hasUploads />);
  await user.type(screen.getByLabelText("새 카드 이름"), "신한");
  await user.upload(screen.getByLabelText("카드 이용내역 파일 선택"), [new File(["a"], "a.csv"), new File(["b"], "b.csv")]);
  expect(await screen.findByRole("button", { name: "저장하고 분석" })).toBeInTheDocument();
  expect(startMock).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "저장하고 분석" }));
  await screen.findAllByText(/1건 추가/);
  expect(startMock).toHaveBeenCalledTimes(2);
});

it("첫 파일 오류 뒤에도 다음 파일을 처리한다", async () => {
  const user = userEvent.setup();
  const { ApiError } = await import("@/components/ui/api-fetch");
  startMock.mockRejectedValueOnce(new ApiError("ENCRYPTED_FILE", 422, "unsafe")).mockResolvedValueOnce({ uploadId: "u2", analysis });
  render(<UploadFlow cards={[]} hasUploads />);
  await user.type(screen.getByLabelText("새 카드 이름"), "신한");
  await user.upload(screen.getByLabelText("카드 이용내역 파일 선택"), [new File(["a"], "a.csv"), new File(["b"], "b.csv")]);
  expect(await screen.findByText(/암호가 걸린 파일/)).toBeInTheDocument();
  expect(await screen.findByText(/1건 추가/)).toBeInTheDocument();
});
