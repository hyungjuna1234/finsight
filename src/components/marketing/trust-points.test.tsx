import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TrustPoints } from "./trust-points";

it("states the three data handling promises verbatim", () => {
  render(<TrustPoints />);
  expect(screen.getByText("연동 없음 · 카드사에서 받은 파일만 올려요")).toBeInTheDocument();
  expect(screen.getByText("원본은 90일 후 자동 삭제 · 언제든 전부 삭제할 수 있어요")).toBeInTheDocument();
  expect(screen.getByText("AI에는 가맹점명과 집계값만 보내요 · 카드번호는 보내지 않아요")).toBeInTheDocument();
});
