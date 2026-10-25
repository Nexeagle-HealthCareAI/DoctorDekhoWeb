import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ArticleByline from "./ArticleByline";
import { mapArticle } from "@/lib/health-wiki/mappers";
import type { HealthArticleDto } from "@/lib/health-wiki/dto";

const reviewer = { id: "d1", fullName: "Dr. Meera Nair", type: "HOSPITAL_DOCTOR", qualification: "MBBS, MD", speciality: "Endocrinologist", registrationNumber: "48213", registrationCouncil: "Delhi Medical Council", isRegistrationVerified: true };
const make = (over: Partial<HealthArticleDto>) => mapArticle({ id: "a", title: "T", content: "c", updatedAt: "2026-10-02T08:00:00Z", ...over })!;

describe("ArticleByline", () => {
  it("shows the reviewer badge with qualification and registration for a verified reviewer", () => {
    render(<ArticleByline article={make({ reviewer, author: { fullName: "NexEagle content team", type: "STAFF" } })} />);
    expect(screen.getByText(/Medically reviewed by/i)).toBeInTheDocument();
    expect(screen.getByText("Dr. Meera Nair")).toBeInTheDocument();
    expect(screen.getByText("MBBS, MD • Endocrinologist")).toBeInTheDocument();
    expect(screen.getByText("Reg. 48213 · Delhi Medical Council")).toBeInTheDocument();
    expect(screen.getByText(/Evidence based/)).toBeInTheDocument();
    expect(screen.getByText("Written by")).toBeInTheDocument();
  });

  it("names the NexEagle team when the article has no author and no reviewer, so the box is never empty", () => {
    render(<ArticleByline article={make({})} />);
    expect(screen.getByText("Written by")).toBeInTheDocument();
    expect(screen.getByText("The NexEagle Health Wiki team")).toBeInTheDocument();
    expect(screen.queryByText(/Medically reviewed by/i)).toBeNull();
  });

  it("does not repeat the person when author and reviewer are the same", () => {
    render(<ArticleByline article={make({ reviewer, author: reviewer })} />);
    expect(screen.getAllByText("Dr. Meera Nair")).toHaveLength(1);
    expect(screen.queryByText("Written by")).toBeNull();
  });

  it("shows no reviewer badge and no Evidence based line when the reviewer is not verified", () => {
    render(<ArticleByline article={make({ reviewer: { ...reviewer, isRegistrationVerified: false }, author: { fullName: "Content team", type: "STAFF" } })} />);
    expect(screen.queryByText(/Medically reviewed by/i)).toBeNull();
    expect(screen.queryByText(/Evidence based/)).toBeNull();
    expect(screen.getByText("Written by")).toBeInTheDocument();
  });

  it("shows only a Written by line for a sector update, never the badge", () => {
    render(<ArticleByline article={make({ type: "SECTOR_UPDATE", reviewer, author: { fullName: "Rohan Mehta", type: "WRITER", roleTitle: "Product manager", organisation: "HealthTech India" } })} />);
    expect(screen.queryByText(/Medically reviewed by/i)).toBeNull();
    expect(screen.getByText("Rohan Mehta")).toBeInTheDocument();
    expect(screen.getByText("Product manager, HealthTech India")).toBeInTheDocument();
  });

  it("prints the update date in a fixed format", () => {
    render(<ArticleByline article={make({ reviewer })} />);
    expect(screen.getByText("2 Oct 2026")).toHaveAttribute("datetime", "2026-10-02T08:00:00Z");
  });
});
