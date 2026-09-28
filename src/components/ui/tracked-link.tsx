"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackEvent, type AnalyticsEvents } from "./track";

export function TrackedLink<E extends keyof AnalyticsEvents>({
  href,
  event,
  eventProps,
  className,
  children,
}: {
  href: string;
  event: E;
  eventProps: AnalyticsEvents[E];
  className?: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent(event, eventProps)}
    >
      {children}
    </Link>
  );
}
