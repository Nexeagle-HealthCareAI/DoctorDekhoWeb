import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// jsdom has no ResizeObserver (the one-time-code input uses it) and no layout.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
}
// (a test that runs in the node environment, such as a route handler test, has no document)
if (typeof document !== "undefined" && typeof document.elementFromPoint !== "function") {
  document.elementFromPoint = () => null;
}
