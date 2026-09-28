"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";
import type { ReactNode } from "react";

export type LandingSectionId = "hero" | "tiles" | "report" | "steps" | "trust" | "pricing" | "faq" | "final";

const VARIANT_CLASSES = {
  primary: "bg-accent text-white hover:bg-accent-hover focus-visible:outline-accent",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-bg focus-visible:outline-accent",
  invert: "bg-surface text-accent hover:bg-accent-soft focus-visible:outline-white",
  ghost: "border border-white/70 text-white hover:bg-accent-hover focus-visible:outline-white",
} as const;

export function LandingCta({ href, cta, section, variant, children }: { href: string; cta: "start" | "demo"; section: LandingSectionId; variant: keyof typeof VARIANT_CLASSES; children: ReactNode }) {
  return <Link href={href} onClick={() => track("landing_cta", { cta, section })} className={`inline-flex min-h-11 items-center justify-center rounded-md px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${VARIANT_CLASSES[variant]}`}>{children}</Link>;
}
