import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { YearMonth } from "@/lib/domain/types";
import { UploadBanner } from "./upload-banner";

it("업로드할 월과 링크를 안내한다", () => {
  render(<UploadBanner month={"2026-09" as YearMonth} />);
  expect(screen.getByText("9월 내역을 올릴 차례예요")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "업로드" })).toHaveAttribute("href", "/upload");
});
