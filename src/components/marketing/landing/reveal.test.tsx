import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Reveal } from "./reveal";

type ObserverCallback = IntersectionObserverCallback;

const observer = vi.hoisted(() => ({ callback: undefined as ObserverCallback | undefined, disconnect: vi.fn(), observe: vi.fn() }));

class IntersectionObserverMock {
  constructor(callback: ObserverCallback) { observer.callback = callback; }
  observe = observer.observe;
  disconnect = observer.disconnect;
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = "0px";
  thresholds = [0];
}

function setTop(top: number) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    top, bottom: top + 20, left: 0, right: 20, width: 20, height: 20, x: 0, y: top, toJSON: () => ({}),
  });
}

describe("Reveal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observer.callback = undefined;
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("does not reveal an element already in the initial viewport", () => {
    setTop(10);
    const { container } = render(<Reveal className="extra">내용</Reveal>);
    expect(container.firstElementChild).toHaveClass("group", "extra");
    expect(container.firstElementChild).not.toHaveAttribute("data-in");
    expect(observer.observe).not.toHaveBeenCalled();
  });

  it("reveals once when an initially offscreen element intersects", () => {
    setTop(window.innerHeight + 100);
    const { container } = render(<Reveal>내용</Reveal>);
    const element = container.firstElementChild as Element;
    expect(observer.observe).toHaveBeenCalledWith(element);
    act(() => observer.callback?.([{ isIntersecting: true, target: element } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(element).toHaveAttribute("data-in", "true");
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it("does not observe when reduced motion is requested", () => {
    setTop(window.innerHeight + 100);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const { container } = render(<Reveal>내용</Reveal>);
    expect(container.firstElementChild).not.toHaveAttribute("data-in");
    expect(observer.observe).not.toHaveBeenCalled();
  });
});
