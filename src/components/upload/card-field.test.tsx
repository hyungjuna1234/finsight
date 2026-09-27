import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CardField } from "./card-field";

it("카드가 없으면 비어 있는 새 카드 이름을 입력한다", async () => {
  const user = userEvent.setup(); const onChange = vi.fn();
  render(<CardField cards={[]} value={{ name: "" }} onChange={onChange} />);
  const input = screen.getByPlaceholderText("예: 신한 체크");
  expect(input).toHaveValue("");
  await user.type(input, "신");
  expect(onChange).toHaveBeenCalledWith({ name: "신" });
});
