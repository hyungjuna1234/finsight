"use client";

import { useEffect, useRef, useState } from "react";
import { formatKRW, toKRW } from "@/lib/domain/money";
import { useReveal } from "./use-reveal";

type CountFormat = "krw" | "percent" | "signed-percent";

function formatValue(value: number, format: CountFormat): string {
  const rounded = Math.round(value);
  if (format === "krw") return formatKRW(toKRW(Math.max(0, rounded)));
  if (format === "percent") return `${rounded}%`;
  return rounded < 0 ? `−${Math.abs(rounded)}%` : `+${rounded}%`;
}

export function CountUp({ value, format }: { value: number; format: CountFormat }) {
  const ref = useRef<HTMLSpanElement>(null);
  const revealed = useReveal(ref);
  const [displayed, setDisplayed] = useState(value);
  const finalValue = formatValue(value, format);

  useEffect(() => {
    if (!revealed) return;
    let frame = 0;
    let startedAt: number | undefined;
    const tick = (now: number) => {
      startedAt ??= now;
      const progress = Math.min((now - startedAt) / 750, 1);
      setDisplayed(value * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [revealed, value]);

  return <span ref={ref}><span aria-hidden="true">{formatValue(displayed, format)}</span><span className="sr-only">{finalValue}</span></span>;
}
