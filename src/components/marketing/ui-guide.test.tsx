import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { getLandingShowcase } from "@/lib/demo/landing";
import { FAQ } from "./faq";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { PricingSummary } from "./pricing-summary";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { DataFlow } from "./landing/data-flow";
import { FinalCta } from "./landing/final-cta";
import { ReportShowcase } from "./landing/report-showcase";
import { SpendTiles } from "./landing/spend-tiles";

it("follows the marketing anti-slop rules", () => {
  const showcase = getLandingShowcase();
  const { container } = render(<><SiteHeader /><Hero showcase={showcase} /><SpendTiles showcase={showcase} /><ReportShowcase showcase={showcase} /><HowItWorks /><DataFlow /><PricingSummary /><FAQ /><FinalCta /><SiteFooter /></>);
  const html = container.innerHTML;
  for (const forbidden of ["backdrop-blur", "bg-gradient", "bg-clip-text", "blur-3xl", "rounded-2xl", "purple", "indigo", "violet"]) {
    expect(html).not.toContain(forbidden);
  }
  const animationClasses = html.match(/[^\s"']*animate-[^\s"']*/g) ?? [];
  for (const className of animationClasses) expect(className).toMatch(/^motion-safe:(?:animate-landing-|group-data-\[in=true\]:animate-landing-)/);
  expect(html).not.toContain("Powered by AI");
  expect(html).not.toContain("✨");
  expect(container.querySelectorAll("section.bg-accent")).toHaveLength(1);
  expect(container.querySelector("section.bg-accent")).toHaveAttribute("id", "final");
});
