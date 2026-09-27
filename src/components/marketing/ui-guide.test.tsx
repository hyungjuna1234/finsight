import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { FAQ } from "./faq";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { PricingSummary } from "./pricing-summary";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { TrustPoints } from "./trust-points";

it("follows the marketing anti-slop rules", () => {
  const { container } = render(<><SiteHeader /><Hero /><TrustPoints /><HowItWorks /><PricingSummary /><FAQ /><SiteFooter /></>);
  const html = container.innerHTML;
  for (const forbidden of ["backdrop-blur", "bg-gradient", "bg-clip-text", "blur-3xl", "rounded-2xl", "purple", "indigo", "violet", "animate-"]) {
    expect(html).not.toContain(forbidden);
  }
  expect(html).not.toContain("Powered by AI");
  expect(html).not.toContain("✨");
});
