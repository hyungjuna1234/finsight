import { describe, expect, it } from "vitest";
import { makeTx } from "@/test/tx-factory";
import type { IsoDate, YearMonth } from "@/lib/domain/types";
import { buildDashboardModel, resolveMonth, uploadBannerMonth } from "./dashboard";

const ym = (value: string) => value as YearMonth;
const iso = (value: string) => value as IsoDate;

describe("dashboard model", () => {
  const months = [ym("2026-09"), ym("2026-08"), ym("2026-07")];

  it("목록에 있는 유효한 달만 선택하고 나머지는 최신 달로 정한다", () => {
    expect(resolveMonth("2026-08", months)).toBe("2026-08");
    expect(resolveMonth("2026-13", months)).toBe("2026-09");
    expect(resolveMonth("abc", months)).toBe("2026-09");
  });

  it("지난달보다 최신 데이터가 오래됐을 때 지난달 업로드를 알린다", () => {
    expect(uploadBannerMonth(ym("2026-08"), iso("2026-10-03"))).toBe("2026-09");
    expect(uploadBannerMonth(ym("2026-09"), iso("2026-10-03"))).toBeNull();
  });

  it("월 요약과 내림차순 월 목록으로 모델을 만든다", () => {
    const model = buildDashboardModel({
      txs: [makeTx({ occurredOn: "2026-08-03", amountKrw: 12_000 })],
      month: ym("2026-08"), availableMonths: [ym("2026-07"), ym("2026-09"), ym("2026-08")], today: iso("2026-10-03"),
    });
    expect(model.availableMonths).toEqual(["2026-09", "2026-08", "2026-07"]);
    expect(model.summary.spend).toBe(12_000);
    expect(model.uploadBannerMonth).toBeNull();
  });
});
