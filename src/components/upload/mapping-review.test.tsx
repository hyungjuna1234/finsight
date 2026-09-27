import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ColumnMapping } from "@/lib/ingest/mapping";
import { MappingReview } from "./mapping-review";

const mapping: ColumnMapping = { headerRowIndex: 0, columns: { date: 0, merchant: 1, amount: 2 } };
const preview = { sheetName: "내역", headerRowIndex: 0, rows: [["날짜", "가맹점", "금액"], ["다른", "헤더", "행"], ...Array.from({ length: 7 }, (_, i) => [`2026-09-${i + 1}`, `상점${i}`, `${i + 1}000`])] };

describe("MappingReview", () => {
  it("제안을 채우고 미리보기는 5행만 표시한다", () => {
    render(<MappingReview preview={preview} mapping={mapping} cards={[]} submitting={false} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("날짜 열")).toHaveValue("0");
    expect(screen.getByLabelText("가맹점 열")).toHaveValue("1");
    expect(screen.getByLabelText("금액 열")).toHaveValue("2");
    expect(screen.getAllByTestId("preview-row")).toHaveLength(5);
  });

  it("필수 열이 겹치면 비활성화하고 헤더 행 변경 시 선택지를 바꾼다", async () => {
    const user = userEvent.setup();
    render(<MappingReview preview={preview} mapping={mapping} cards={[]} submitting={false} onSubmit={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText("가맹점 열"), "0");
    expect(screen.getByRole("button", { name: "저장하고 분석" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("헤더 행"), "1");
    expect(screen.getByLabelText("날짜 열")).toHaveDisplayValue("다른");
  });

  it("새 카드 이름으로 제출한다", async () => {
    const user = userEvent.setup(); const onSubmit = vi.fn();
    render(<MappingReview preview={preview} mapping={mapping} cards={[]} submitting={false} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("새 카드 이름"), "신한 체크");
    await user.click(screen.getByRole("button", { name: "저장하고 분석" }));
    expect(onSubmit).toHaveBeenCalledWith(mapping, { name: "신한 체크" });
  });
});
