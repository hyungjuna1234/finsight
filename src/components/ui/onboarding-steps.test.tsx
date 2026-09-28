import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OnboardingSteps } from "./onboarding-steps";

describe("OnboardingSteps", () => {
  it.each([1, 2, 3] as const)("%i단계만 현재 단계이고 지난 단계는 체크로 표시한다", (current) => {
    render(<OnboardingSteps current={current} />);

    const steps = within(screen.getByRole("list", { name: "시작 단계" })).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.textContent)).toEqual([
      expect.stringContaining("가입"),
      expect.stringContaining("파일 받기"),
      expect.stringContaining("올리기"),
    ]);
    expect(steps.filter((step) => step.getAttribute("aria-current") === "step")).toEqual([steps[current - 1]]);
    expect(screen.queryAllByTestId("completed-step")).toHaveLength(current - 1);
  });
});
