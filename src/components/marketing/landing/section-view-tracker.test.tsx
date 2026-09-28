import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SectionViewTracker } from "./section-view-tracker";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("@vercel/analytics", () => ({ track }));

let observerCallback: IntersectionObserverCallback;
const observe = vi.fn();
const unobserve = vi.fn();
const disconnect = vi.fn();

class IntersectionObserverMock {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    observerCallback = callback;
    expect(options).toEqual({ threshold: 0.4 });
  }

  observe = observe;
  unobserve = unobserve;
  disconnect = disconnect;
}

beforeEach(() => {
  track.mockClear();
  observe.mockClear();
  unobserve.mockClear();
  disconnect.mockClear();
  vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

it("tracks each known landing section only once and ignores unknown values", () => {
  document.body.innerHTML = `
    <section data-landing-section="hero"></section>
    <section data-landing-section="tiles"></section>
    <section data-landing-section="unknown"></section>
  `;
  const sections = [...document.querySelectorAll<HTMLElement>("[data-landing-section]")];
  const { unmount } = render(<SectionViewTracker />);

  expect(observe).toHaveBeenCalledTimes(3);
  act(() => observerCallback([
    { target: sections[0]!, isIntersecting: true, intersectionRatio: 0.4 },
    { target: sections[2]!, isIntersecting: true, intersectionRatio: 1 },
  ] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver));
  act(() => observerCallback([
    { target: sections[0]!, isIntersecting: true, intersectionRatio: 1 },
    { target: sections[1]!, isIntersecting: true, intersectionRatio: 0.5 },
  ] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver));

  expect(track).toHaveBeenCalledTimes(2);
  expect(track).toHaveBeenNthCalledWith(1, "landing_section_view", { section: "hero" });
  expect(track).toHaveBeenNthCalledWith(2, "landing_section_view", { section: "tiles" });

  unmount();
  expect(disconnect).toHaveBeenCalled();
});

it("does nothing when IntersectionObserver is unavailable", () => {
  vi.unstubAllGlobals();
  render(<SectionViewTracker />);
  expect(track).not.toHaveBeenCalled();
});
