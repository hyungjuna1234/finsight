import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeTx } from "@/test/tx-factory";
import { TransactionList } from "./transaction-list";

vi.mock("./category-sheet", () => ({ CategorySheet: ({ tx }: { tx: { merchantRaw: string } }) => <div role="dialog">{tx.merchantRaw}</div> }));
describe("TransactionList", () => {
  it("renders groups and transaction badges and opens the category sheet", async () => {
    const tx = makeTx({ id: "t1", occurredOn: "2026-09-26", merchantRaw: "테스트상점", status: "pending", installmentMonths: 3 });
    render(<TransactionList groups={[{ date: tx.occurredOn, items: [tx], net: 10000 }]} month={"2026-09" as never} nextCursorHref="/transactions?cursor=100" />);
    expect(screen.getByText(/9월 26일/)).toBeInTheDocument(); expect(screen.getByText("추정")).toBeInTheDocument(); expect(screen.getByText("3개월 할부")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "기타" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("테스트상점");
  });
});
