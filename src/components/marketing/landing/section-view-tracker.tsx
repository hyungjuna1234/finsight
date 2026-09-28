"use client";

import { track } from "@vercel/analytics";
import { useEffect } from "react";
import type { LandingSectionId } from "./landing-cta";

const LANDING_SECTION_IDS = new Set<LandingSectionId>([
  "hero", "tiles", "report", "steps", "trust", "pricing", "faq", "final",
]);

function isLandingSectionId(value: string | undefined): value is LandingSectionId {
  return value !== undefined && LANDING_SECTION_IDS.has(value as LandingSectionId);
}

export function SectionViewTracker(): null {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;

    const seen = new Set<LandingSectionId>();
    const sections = document.querySelectorAll<HTMLElement>("[data-landing-section]");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const section = (entry.target as HTMLElement).dataset.landingSection;
        if (!entry.isIntersecting || !isLandingSectionId(section) || seen.has(section)) continue;
        seen.add(section);
        observer.unobserve(entry.target);
        track("landing_section_view", { section });
      }
      if (seen.size === LANDING_SECTION_IDS.size) observer.disconnect();
    }, { threshold: 0.4 });

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return null;
}
