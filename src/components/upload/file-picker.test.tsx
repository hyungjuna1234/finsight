import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ACCEPT_ATTR } from "@/lib/domain/upload";
import { FilePicker } from "./file-picker";

it("모바일용 accept를 제공하고 잘못된 파일은 제외해 안내한다", async () => {
  const onFiles = vi.fn();
  render(<FilePicker onFiles={onFiles} disabled={false} />);
  const input = screen.getByLabelText("카드 이용내역 파일 선택");
  expect(input).toHaveAttribute("accept", ACCEPT_ATTR);
  const good = new File(["ok"], "ok.csv", { type: "text/csv" });
  const large = new File([new Uint8Array(11 * 1024 * 1024)], "large.xlsx");
  const pdf = new File(["%PDF"], "statement.pdf", { type: "application/pdf" });
  const image = new File(["png"], "bad.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [good, large, pdf, image] } });
  expect(onFiles).toHaveBeenCalledWith([good, pdf]);
  expect(screen.getByText(/large\.xlsx.*10MB/)).toBeInTheDocument();
  expect(screen.getByText(/bad\.png.*지원하지/)).toBeInTheDocument();
});
