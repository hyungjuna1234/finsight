import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IssuerGuide } from "@/lib/domain/guides";
import { IssuerGuideList } from "./issuer-guide-list";

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock("@/components/ui/track", () => ({ trackEvent }));

beforeEach(() => vi.clearAllMocks());

const guides: readonly IssuerGuide[] = [
  {
    id: "shinhan",
    name: "신한카드",
    steps: ["로그인해요", "이용내역을 찾아요", "파일로 받아요"],
    verifiedAt: null,
  },
  {
    id: "samsung",
    name: "삼성카드",
    steps: ["로그인해요", "기간을 골라요", "파일로 받아요"],
    verifiedAt: "2026-09-27",
  },
];

describe("IssuerGuideList", () => {
  it("안내 문구와 카드사별 순서 있는 단계를 표시한다", () => {
    render(<IssuerGuideList guides={guides} />);
    expect(
      screen.getByText("메뉴 위치는 카드사 사정에 따라 바뀔 수 있어요."),
    ).toBeInTheDocument();
    const details = screen.getByText("신한카드").closest("details");
    expect(details).not.toBeNull();
    expect(within(details!).getByRole("list").tagName).toBe("OL");
    expect(within(details!).getAllByRole("listitem")).toHaveLength(3);
  });

  it("확인일이 있는 카드사에만 마지막 확인 날짜를 표시한다", () => {
    render(<IssuerGuideList guides={guides} />);
    expect(screen.getByText("마지막 확인 2026-09-27")).toBeInTheDocument();
    expect(screen.getAllByText(/마지막 확인/)).toHaveLength(1);
  });

  it("카드사 안내를 열 때만 guide_open 이벤트를 보낸다", async () => {
    const user = userEvent.setup();
    render(<IssuerGuideList guides={guides} />);

    await user.click(screen.getByText("신한카드"));
    expect(trackEvent).toHaveBeenCalledWith("guide_open", {
      issuer: "shinhan",
      where: "guide",
    });

    await user.click(screen.getByText("신한카드"));
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });
});
