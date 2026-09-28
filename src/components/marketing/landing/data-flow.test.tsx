import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { DataFlow } from "./data-flow";

it("describes the exact minimum data sent for each AI feature", () => {
  const { container } = render(<DataFlow />);
  const rows = within(screen.getByRole("table")).getAllByRole("row");

  expect(rows.map((row) => [within(row).getByRole("rowheader").textContent, within(row).getByRole("cell").textContent])).toEqual([
    ["열 맞추기", "가린 샘플 5행"],
    ["카테고리 분류", "가맹점명"],
    ["AI 리포트", "합계·비율 같은 집계값"],
    ["채팅 Pro", "질문과, 답에 필요한 거래 30건 이하(날짜·가맹점·금액)"],
  ]);
  expect(within(rows[3]!).getByText("Pro")).toBeInTheDocument();
  expect(within(rows[3]!).getByText(/30건/)).toBeInTheDocument();
  expect(container).not.toHaveTextContent("가맹점명과 집계값만");
});

it("states what never leaves the server and when originals are deleted", () => {
  render(<DataFlow />);

  const never = screen.getByText("AI에 보내지 않아요").parentElement;
  expect(never).not.toBeNull();
  expect(within(never!).getByText("카드번호")).toBeInTheDocument();
  expect(within(never!).getByText("이름·이메일")).toBeInTheDocument();
  expect(within(never!).getByText("원본 파일")).toBeInTheDocument();
  expect(screen.getByText("올린 날")).toBeInTheDocument();
  expect(screen.getByText("90일 · 원본 자동 삭제")).toBeInTheDocument();
  expect(screen.getByText("그 전에도 언제든 업로드별 삭제, 전체 삭제, 탈퇴를 할 수 있어요.")).toBeInTheDocument();
});
