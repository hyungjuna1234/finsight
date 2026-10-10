import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/components/ui/api-fetch";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/components/ui/api-fetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/api-fetch")>();
  return { ...actual, apiFetch };
});
import { ChatPanel } from "./chat-panel";
import { chatStorageKey } from "./chat-storage";

describe("ChatPanel", () => {
  beforeEach(() => { sessionStorage.clear(); apiFetch.mockReset(); });

  it("sends an example immediately, displays loading, and normalizes request history", async () => {
    let resolve!: (value: { text: string }) => void;
    apiFetch.mockImplementation(() => new Promise((done) => { resolve = done; }));
    render(<ChatPanel ownerId="owner-a" examples={["예시 질문"]} />);
    await userEvent.click(screen.getByRole("button", { name: "예시 질문" }));
    expect(screen.getByText("예시 질문")).toBeInTheDocument();
    expect(screen.getByText("답을 찾고 있어요…")).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith("/api/chat", { method: "POST", body: { history: [], message: "예시 질문" } });
    await act(async () => resolve({ text: "첫 답변" }));
    await userEvent.type(screen.getByRole("textbox"), "다음 질문");
    await userEvent.click(screen.getByRole("button", { name: "보내기" }));
    expect(apiFetch).toHaveBeenLastCalledWith("/api/chat", { method: "POST", body: { history: [{ role: "user", content: "예시 질문" }, { role: "assistant", content: "첫 답변" }], message: "다음 질문" } });
  });

  it("shows rate-limit copy", async () => {
    apiFetch.mockRejectedValue(new ApiError("RATE_LIMITED", 429, "server copy"));
    render(<ChatPanel ownerId="owner-a" examples={["질문"]} />);
    await userEvent.click(screen.getByRole("button", { name: "질문" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("오늘 질문 한도를 다 썼어요. 내일 다시 시도해 주세요.");
  });

  it("retries a transient failure without displaying the user message twice", async () => {
    apiFetch.mockRejectedValueOnce(new ApiError("AI_UNAVAILABLE", 503, "failed")).mockResolvedValueOnce({ text: "완료" });
    render(<ChatPanel ownerId="owner-a" examples={["질문"]} />);
    await userEvent.click(screen.getByRole("button", { name: "질문" }));
    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("완료")).toBeInTheDocument();
    expect(screen.getAllByText("질문")).toHaveLength(1);
  });

  it("restores and clears this tab's conversation", async () => {
    apiFetch.mockResolvedValue({ text: "저장된 답변" });
    const first = render(<ChatPanel ownerId="owner-a" examples={["저장 질문"]} />);
    await userEvent.click(screen.getByRole("button", { name: "저장 질문" }));
    expect(await screen.findByText("저장된 답변")).toBeInTheDocument();
    first.unmount();
    render(<ChatPanel ownerId="owner-a" examples={["저장 질문"]} />);
    expect(screen.getByText("저장된 답변")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "대화 지우기" }));
    expect(screen.queryByText("저장된 답변")).not.toBeInTheDocument();
    expect(sessionStorage.getItem(chatStorageKey("owner-a"))).toBeNull();
  });

  it("does not turn assistant links or images into elements", async () => {
    apiFetch.mockResolvedValue({ text: "[링크](https://evil.example) ![x](https://evil.example/x)" });
    const { container } = render(<ChatPanel ownerId="owner-a" examples={["질문"]} />);
    await userEvent.click(screen.getByRole("button", { name: "질문" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    await waitFor(() => expect(container.innerHTML).not.toContain("evil.example"));
    expect(container.querySelectorAll("a,img")).toHaveLength(0);
  });

  it("redirects Pro errors to pricing", async () => {
    apiFetch.mockRejectedValue(new ApiError("PRO_REQUIRED", 402, "Pro required"));
    const original = window.location;
    const assign = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
    render(<ChatPanel ownerId="owner-a" examples={["질문"]} />);
    await userEvent.click(screen.getByRole("button", { name: "질문" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/pricing"));
    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("같은 탭에 남은 다른 사용자의 대화는 복원하지 않고 지운다", () => {
    sessionStorage.setItem(chatStorageKey("owner-a"), JSON.stringify([{ role: "user", content: "A의 질문" }, { role: "assistant", content: "A의 답변" }]));
    sessionStorage.setItem("finsight.chat.v1", JSON.stringify([{ role: "user", content: "예전 키의 질문" }]));
    render(<ChatPanel ownerId="owner-b" examples={["질문"]} />);
    expect(screen.queryByText("A의 답변")).not.toBeInTheDocument();
    expect(screen.queryByText("예전 키의 질문")).not.toBeInTheDocument();
    expect(sessionStorage.getItem(chatStorageKey("owner-a"))).toBeNull();
    expect(sessionStorage.getItem("finsight.chat.v1")).toBeNull();
  });
});
