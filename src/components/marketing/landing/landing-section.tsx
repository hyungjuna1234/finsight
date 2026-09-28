import type { ReactNode } from "react";
import type { LandingSectionId } from "./landing-cta";

const TONE_CLASSES = { plain: "", alt: "border-y border-line bg-surface", accent: "bg-accent text-white" } as const;

export function LandingSection({ id, tone = "plain", labelledBy, children }: { id: LandingSectionId; tone?: keyof typeof TONE_CLASSES; labelledBy?: string; children: ReactNode }) {
  return <section id={id} data-landing-section={id} aria-labelledby={labelledBy} className={`py-14 md:py-20 ${TONE_CLASSES[tone]}`.trim()}><div className="mx-auto w-full max-w-5xl px-4">{children}</div></section>;
}
