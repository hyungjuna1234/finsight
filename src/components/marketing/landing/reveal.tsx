"use client";

import { useRef, type ReactNode } from "react";
import { useReveal } from "./use-reveal";

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const revealed = useReveal(ref);
  return <div ref={ref} className={className ? `group ${className}` : "group"} data-in={revealed ? "true" : undefined}>{children}</div>;
}
