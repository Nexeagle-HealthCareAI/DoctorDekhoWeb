import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReferencesList } from "./ArticleNotices";

describe("ReferencesList links", () => {
  it("keeps a plain source as text", () => {
    render(<ReferencesList items={["ICMR guideline, 2023"]} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("ICMR guideline, 2023")).toBeTruthy();
  });

  it("links [words](address) and shows the words", () => {
    render(<ReferencesList items={["See [WHO factsheet](https://www.who.int/x) for more"]} />);
    const a = screen.getByRole("link", { name: "WHO factsheet" });
    expect(a.getAttribute("href")).toBe("https://www.who.int/x");
    expect(a.getAttribute("rel")).toContain("noopener");
    expect(a.getAttribute("target")).toBe("_blank");
  });

  it("links a bare address without the closing full stop", () => {
    render(<ReferencesList items={["Source: https://example.org/a/b."]} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://example.org/a/b");
  });

  it("never links javascript: or other schemes", () => {
    render(<ReferencesList items={["[x](javascript:alert(1)) and ftp://a.b"]} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
