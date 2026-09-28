import { render } from "@testing-library/react";
import { useRef } from "react";
import { expect, it } from "vitest";
import { useReveal } from "./use-reveal";

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const revealed = useReveal(ref);
  return <div ref={ref} data-revealed={revealed} />;
}

it("starts unrevealed so server and initial client output stay complete", () => {
  const { container } = render(<Probe />);
  expect(container.firstElementChild).toHaveAttribute("data-revealed", "false");
});
