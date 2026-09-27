import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { summarizeMonth } from "@/lib/analytics/month";
import type { YearMonth } from "@/lib/domain/types";
import { makeTx } from "@/test/tx-factory";
import { TopMerchants } from "./top-merchants";

it("순위·가맹점·건수·금액을 표시한다", () => {
  const summary = summarizeMonth([makeTx({ merchantRaw: "동네마트", merchantKey: "동네마트", amountKrw: 45_000 })], "2026-09" as YearMonth);
  render(<TopMerchants items={summary.topMerchants} />);
  expect(screen.getByText("1")).toBeInTheDocument();
  expect(screen.getByText("동네마트")).toBeInTheDocument();
  expect(screen.getByText("1건")).toBeInTheDocument();
  expect(screen.getByText("₩45,000")).toBeInTheDocument();
});
