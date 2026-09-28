"use client";

import { useEffect, useState, type RefObject } from "react";

export function useReveal<T extends Element>(ref: RefObject<T | null>): boolean {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || element.getBoundingClientRect().top < window.innerHeight) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setRevealed(true);
      observer.disconnect();
    }, { threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return revealed;
}
