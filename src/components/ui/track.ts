import { track } from "@vercel/analytics";
import type { ErrorCode } from "@/lib/domain/errors";
import type { IssuerId } from "@/lib/domain/guides";
import type { JourneyPrimary } from "@/lib/domain/journey";

export type ProTeaserFrom =
  | "recurring"
  | "comparison"
  | "trend"
  | "chat"
  | "insight";

export interface AnalyticsEvents {
  demo_cta: Record<string, never>;
  consent_done: Record<string, never>;
  guide_open: { issuer: IssuerId; where: "upload" | "guide" };
  link_copy: Record<string, never>;
  upload_done: { auto: boolean; first: boolean };
  upload_error: { code: ErrorCode | "NETWORK" };
  mapping_changed: Record<string, never>;
  category_edit: { scope: "one" | "merchant" };
  next_step_click: { step: JourneyPrimary };
  insight_generate: { free: boolean };
  pro_teaser_click: { from: ProTeaserFrom };
}

export function trackEvent<E extends keyof AnalyticsEvents>(
  name: E,
  props: AnalyticsEvents[E],
): void {
  try {
    if (Object.keys(props).length === 0) {
      track(name);
      return;
    }
    track(name, props);
  } catch {
    // Analytics must never interrupt the user flow.
  }
}
