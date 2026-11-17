import { describe, expect, it } from "vitest";
import { robotsWhenEmpty } from "./indexing";

describe("robotsWhenEmpty", () => {
  it("keeps a page with no doctor out of the index but lets its links be followed", () => {
    expect(robotsWhenEmpty(0)).toEqual({ robots: { index: false, follow: true } });
  });
  it("leaves a page that has doctors alone", () => {
    expect(robotsWhenEmpty(1)).toEqual({});
    expect(robotsWhenEmpty(7)).toEqual({});
  });
});
