import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetch, refresh, trackEvent } = vi.hoisted(() => ({ apiFetch: vi.fn(), refresh: vi.fn(), trackEvent: vi.fn() }));
vi.mock("@/components/ui/api-fetch", () => ({ apiFetch, ApiError: class extends Error {}, redirectPathForError: () => null }));
vi.mock("@/components/ui/track", () => ({ trackEvent }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
import { GenerateInsightButton } from "./generate-insight-button";

beforeEach(() => { vi.clearAllMocks(); apiFetch.mockResolvedValue({}); });

describe("GenerateInsightButton", () => {
  it("generates, tracks the plan, then refreshes", async () => {
    render(<GenerateInsightButton month={"2026-09" as never} label="만들기" free />);
    await userEvent.click(screen.getByRole("button", { name: "만들기" }));
    expect(apiFetch).toHaveBeenCalledWith("/api/insights", { method: "POST", body: { month: "2026-09" } });
    expect(trackEvent).toHaveBeenCalledWith("insight_generate", { free: true });
    expect(refresh).toHaveBeenCalled();
  });

  it("does not track a failed generation", async () => {
    apiFetch.mockRejectedValueOnce(new Error("fail"));
    render(<GenerateInsightButton month={"2026-09" as never} label="만들기" free={false} />);
    await userEvent.click(screen.getByRole("button", { name: "만들기" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
