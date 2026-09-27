import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/components/ui/api-fetch";
import { UploadError } from "./upload-error";

describe("UploadError", () => {
  it.each([["ENCRYPTED_FILE", "가이드", "/guide#trouble-encrypted-file"], ["DUPLICATE_FILE", "보기", "/dashboard"]] as const)("%s 오류 링크를 표시한다", (code, label, href) => {
    render(<UploadError error={new ApiError(code, 422, "unsafe server detail")} />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    expect(screen.queryByText("unsafe server detail")).not.toBeInTheDocument();
  });

  it("재시도 가능한 오류에서 콜백을 호출한다", async () => {
    const user = userEvent.setup(); const retry = vi.fn();
    render(<UploadError error={new ApiError("NETWORK", 0, "unsafe")} onRetry={retry} />);
    await user.click(screen.getByRole("button", { name: "다시 시도" })); expect(retry).toHaveBeenCalled();
  });

  it("상한 문구와 인증 이동 경로를 표시한다", () => {
    const { rerender } = render(<UploadError error={new ApiError("RATE_LIMITED", 429, "unsafe")} />);
    expect(screen.getByText("내일 다시 시도해 주세요.")).toBeInTheDocument();
    rerender(<UploadError error={new ApiError("UNAUTHENTICATED", 401, "unsafe")} />);
    expect(screen.getByRole("link", { name: "로그인하기" })).toHaveAttribute("href", "/login?next=%2Fupload");
  });
});
