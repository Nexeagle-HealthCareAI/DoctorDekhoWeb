import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ArticleBody from "./ArticleBody";

describe("ArticleBody", () => {
  it("renders headings, lists, bold text and a table", () => {
    render(<ArticleBody markdown={"## Symptoms\n\n- thirst\n- **hunger**\n\n| a | b |\n|---|---|\n| 1 | 2 |"} />);
    expect(screen.getByRole("heading", { level: 2, name: "Symptoms" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("hunger").tagName).toBe("STRONG");
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("never lets a script, an inline handler or a javascript: link through", () => {
    const { container } = render(
      <ArticleBody markdown={'<script>alert(1)</script>\n\n<img src="https://cdn.example.com/a.png" onerror="alert(2)">\n\n[click](javascript:alert(3))\n\n<iframe src="https://evil.example.com"></iframe>'} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.innerHTML).not.toMatch(/onerror/i);
    const link = screen.queryByText("click");
    expect(link?.closest("a")?.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
  });

  it("turns a level 1 heading into level 2, because the page title is the only h1", () => {
    render(<ArticleBody markdown={"# Big heading"} />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Big heading" })).toBeInTheDocument();
  });

  it("opens outside links safely in a new tab", () => {
    render(<ArticleBody markdown={"[WHO](https://www.who.int)"} />);
    const a = screen.getByRole("link", { name: "WHO" });
    expect(a).toHaveAttribute("target", "_blank");
    expect(a.getAttribute("rel")).toMatch(/noopener/);
    expect(a.getAttribute("rel")).toMatch(/nofollow/);
  });

  it("shows https and local images with their alt text and drops http images", () => {
    render(<ArticleBody markdown={"![A heart](https://cdn.example.com/heart.png)\n\n![Local](/health-wiki-sample/bp-cover.svg)\n\n![Plain](http://cdn.example.com/x.png)"} />);
    expect(screen.getByAltText("A heart")).toHaveAttribute("loading", "lazy");
    expect(screen.getByAltText("Local")).toBeInTheDocument();
    expect(screen.queryByAltText("Plain")).toBeNull();
  });
});
