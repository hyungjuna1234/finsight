import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
const { apiMock, startMock, confirmMock, trackEvent } = vi.hoisted(() => ({ apiMock: vi.fn(), startMock: vi.fn(), confirmMock: vi.fn(), trackEvent: vi.fn() }));
vi.mock("@/components/ui/api-fetch", async (load) => ({ ...(await load<typeof import("@/components/ui/api-fetch")>()), apiFetch: apiMock }));
vi.mock("@/components/ui/track", () => ({ trackEvent }));
vi.mock("./upload-pipeline", async (load) => ({ ...(await load<typeof import("./upload-pipeline")>()), startFile: startMock, confirmFile: confirmMock, sha256Hex: vi.fn(), putFile: vi.fn() }));
import { UploadFlow } from "./upload-flow";
import { ISSUER_GUIDES } from "@/lib/domain/guides";

const analysis = { preview: { sheetName: "s", headerRowIndex: 0, rows: [["날짜", "가맹점", "금액"], ["2026-09-01", "상점", "1000"]] }, mapping: { headerRowIndex: 0, columns: { date: 0, merchant: 1, amount: 2 } }, autoConfirm: true };

beforeEach(() => { vi.clearAllMocks(); confirmMock.mockResolvedValue({ inserted: 1, duplicates: 0, pending: 0, period: null }); });

it("첫 방문에서 파일 받기와 올리기 단계를 보여 준다", () => {
  render(<UploadFlow cards={[]} hasUploads={false} guides={ISSUER_GUIDES} />);
  expect(screen.getByRole("list", { name: "시작 단계" })).toBeInTheDocument();
  expect(screen.getByText("파일 받기").closest("li")).toHaveAttribute("aria-current", "step");
  expect(screen.getByRole("heading", { name: "② 파일 받기" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "③ 올리기" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "PC에서 열 링크 복사" })).toBeInTheDocument();
});

it("두 번째 방문에는 접힌 가이드 링크만 보여 준다", () => {
  render(<UploadFlow cards={[]} hasUploads guides={ISSUER_GUIDES} />);
  expect(screen.queryByRole("list", { name: "시작 단계" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "② 파일 받기" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "파일은 어디서 받나요?" })).toHaveAttribute("href", "/guide");
});

it("두 파일을 첫 확정 뒤 두 번째 생성 순서로 처리한다", async () => {
  const user = userEvent.setup(); let n = 0;
  startMock.mockImplementation(async () => ({ uploadId: `u${++n}`, analysis }));
  render(<UploadFlow cards={[]} hasUploads guides={ISSUER_GUIDES} />);
  await user.type(screen.getByLabelText("새 카드 이름"), "신한");
  await user.upload(screen.getByLabelText("카드 이용내역 파일 선택"), [new File(["a"], "a.csv"), new File(["b"], "b.csv")]);
  await screen.findAllByText(/1건 추가/);
  expect(startMock).toHaveBeenCalledTimes(2);
  expect(confirmMock.mock.invocationCallOrder[0]).toBeLessThan(startMock.mock.invocationCallOrder[1]!);
  expect(screen.queryByText("열 이름이 맞는지 확인해 주세요.")).not.toBeInTheDocument();
  expect(trackEvent).toHaveBeenNthCalledWith(1, "upload_done", { auto: true, first: false });
  expect(trackEvent).toHaveBeenNthCalledWith(2, "upload_done", { auto: true, first: false });
});

it("첫 방문의 첫 수동 완료만 first로 기록한다", async () => {
  const user = userEvent.setup();
  startMock.mockResolvedValue({ uploadId: "u1", analysis: { ...analysis, autoConfirm: false } });
  render(<UploadFlow cards={[]} hasUploads={false} guides={ISSUER_GUIDES} />);
  await user.type(screen.getByLabelText("새 카드 이름"), "신한");
  await user.upload(screen.getByLabelText("카드 이용내역 파일 선택"), new File(["a"], "a.csv"));
  await user.click(await screen.findByRole("button", { name: "저장하고 분석" }));
  await screen.findByText(/1건 추가/);
  expect(trackEvent).toHaveBeenCalledOnce();
  expect(trackEvent).toHaveBeenCalledWith("upload_done", { auto: false, first: true });
});

it("수동 리뷰에서 멈춘 뒤 제출하면 다음 파일을 처리한다", async () => {
  const user = userEvent.setup(); let n = 0;
  startMock.mockImplementation(async () => ({ uploadId: `u${++n}`, analysis: { ...analysis, autoConfirm: n > 1 } }));
  render(<UploadFlow cards={[]} hasUploads guides={ISSUER_GUIDES} />);
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
  render(<UploadFlow cards={[]} hasUploads guides={ISSUER_GUIDES} />);
  await user.type(screen.getByLabelText("새 카드 이름"), "신한");
  await user.upload(screen.getByLabelText("카드 이용내역 파일 선택"), [new File(["a"], "a.csv"), new File(["b"], "b.csv")]);
  expect(await screen.findByText(/암호가 걸린 파일/)).toBeInTheDocument();
  expect(await screen.findByText(/1건 추가/)).toBeInTheDocument();
  expect(trackEvent).toHaveBeenCalledWith("upload_error", { code: "ENCRYPTED_FILE" });
  expect(trackEvent).toHaveBeenCalledWith("upload_done", { auto: true, first: false });
});

it("확정 실패는 에러만 기록한다", async () => {
  const user = userEvent.setup();
  const { ApiError } = await import("@/components/ui/api-fetch");
  startMock.mockResolvedValue({ uploadId: "u1", analysis });
  confirmMock.mockRejectedValue(new ApiError("NETWORK", 0, "unsafe"));
  render(<UploadFlow cards={[]} hasUploads guides={ISSUER_GUIDES} />);
  await user.type(screen.getByLabelText("새 카드 이름"), "신한");
  await user.upload(screen.getByLabelText("카드 이용내역 파일 선택"), new File(["a"], "a.csv"));
  expect(await screen.findByText(/네트워크/)).toBeInTheDocument();
  expect(trackEvent).toHaveBeenCalledOnce();
  expect(trackEvent).toHaveBeenCalledWith("upload_error", { code: "NETWORK" });
});

it("암호 PDF는 비밀번호를 받아 같은 파일을 이어서 처리하고 확정에도 보낸다", async () => {
  const user = userEvent.setup();
  startMock.mockImplementation(async (_file: File, _deps: unknown, onStage: (stage: string) => void, askPassword: (wrong: boolean) => Promise<string>) => {
    onStage("password"); await askPassword(false);
    onStage("password"); const password = await askPassword(true);
    return { uploadId: "u1", analysis, password };
  });
  render(<UploadFlow cards={[]} hasUploads guides={ISSUER_GUIDES} />);
  await user.type(screen.getByLabelText("새 카드 이름"), "신한");
  await user.upload(screen.getByLabelText("카드 이용내역 파일 선택"), [new File(["%PDF"], "명세서.pdf", { type: "application/pdf" })]);
  expect(await screen.findByText("비밀번호 필요")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("PDF 비밀번호"), "111111");
  await user.click(screen.getByRole("button", { name: "열기" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("비밀번호가 맞지 않아요");
  await user.type(screen.getByLabelText("PDF 비밀번호"), "900101");
  await user.click(screen.getByRole("button", { name: "열기" }));
  await screen.findByText(/1건 추가/);
  expect(confirmMock).toHaveBeenCalledWith("u1", analysis.mapping, { name: "신한" }, expect.anything(), "900101");
});
