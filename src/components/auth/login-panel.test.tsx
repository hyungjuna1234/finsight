import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginPanel } from "./login-panel";

describe("LoginPanel", () => {
  it("가입 단계를 현재로 표시하는 시작 단계를 보여 준다", () => {
    render(<LoginPanel next={null} error={null} inAppBrowser={null} />);

    const steps = screen.getByRole("list", { name: "시작 단계" });
    expect(steps).toBeInTheDocument();
    const [signup] = within(steps).getAllByRole("listitem");
    expect(signup).toHaveTextContent("가입");
    expect(signup).toHaveAttribute("aria-current", "step");
  });

  it("카카오와 구글 서버 OAuth 링크에 안전한 next를 전달한다", () => {
    render(<LoginPanel next="/upload?source=demo" error={null} inAppBrowser={null} />);
    expect(screen.getByRole("link", { name: "카카오로 시작하기" })).toHaveAttribute(
      "href", "/auth/login?provider=kakao&next=%2Fupload%3Fsource%3Ddemo",
    );
    expect(screen.getByRole("link", { name: "구글로 시작하기" })).toHaveAttribute(
      "href", "/auth/login?provider=google&next=%2Fupload%3Fsource%3Ddemo",
    );
    expect(screen.getByText("연동 없이 카드 내역 파일만 받아요. 원본은 90일 후 자동 삭제돼요.")).toBeInTheDocument();
  });

  it("인앱 브라우저에서는 구글 로그인 안내를 표시한다", () => {
    render(<LoginPanel next="//evil.example" error={null} inAppBrowser="kakaotalk" />);
    expect(screen.getByText(/카카오톡 안에서는 구글 로그인이 막혀 있어요/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "구글로 시작하기" })).toHaveAttribute(
      "href", "/auth/login?provider=google&next=%2Fdashboard",
    );
  });

  it.each([
    ["cancelled", "로그인을 취소했어요. 다시 시도해 주세요."],
    ["provider", "지원하지 않는 로그인 방식이에요."],
    ["oauth", "로그인을 시작하지 못했어요. 다시 시도해 주세요."],
    ["callback", "로그인을 완료하지 못했어요. 다시 시도해 주세요."],
  ])("%s 오류에 정해진 안내를 표시한다", (error, message) => {
    render(<LoginPanel next={null} error={error} inAppBrowser={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });
});
