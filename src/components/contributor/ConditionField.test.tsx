import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConditionField from "./ConditionField";
import { slugifyCondition } from "@/lib/contributor/conditions";

const OPTIONS = ["diabetes", "thyroid"];

describe("slugifyCondition", () => {
  it("turns what a person types into the stored name", () => {
    expect(slugifyCondition("Knee pain")).toBe("knee-pain");
    expect(slugifyCondition("  PCOD / PCOS!  ")).toBe("pcod-pcos");
    expect(slugifyCondition("Café au lait")).toBe("cafe-au-lait");
  });
  it("is empty when nothing usable is typed", () => {
    expect(slugifyCondition("")).toBe("");
    expect(slugifyCondition("मधुमेह")).toBe("");
  });
  it("keeps it to a sensible length without a hanging hyphen", () => {
    const s = slugifyCondition("a".repeat(58) + " bbbbb");
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("ConditionField", () => {
  it("lists the conditions, None and Other", () => {
    render(<ConditionField value={null} options={OPTIONS} onChange={vi.fn()} />);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["None", "diabetes", "thyroid", "Other"]);
  });

  it("picks a listed condition", async () => {
    const onChange = vi.fn();
    render(<ConditionField value={null} options={OPTIONS} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText(/Related condition/), "thyroid");
    expect(onChange).toHaveBeenLastCalledWith("thyroid");
    expect(screen.queryByLabelText("Which condition?")).toBeNull();
  });

  it("asks which condition when Other is chosen, and saves what is typed", async () => {
    const onChange = vi.fn();
    render(<ConditionField value={null} options={OPTIONS} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText(/Related condition/), "Other");
    await userEvent.type(screen.getByLabelText("Which condition?"), "Knee pain");
    expect(onChange).toHaveBeenLastCalledWith("knee-pain");
    expect(screen.getByText(/Saved as “knee-pain”/)).toBeInTheDocument();
  });

  it("links none while Other is empty, and says what to do", async () => {
    const onChange = vi.fn();
    render(<ConditionField value={null} options={OPTIONS} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText(/Related condition/), "Other");
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText(/Type the condition/)).toBeInTheDocument();
  });

  it("warns when what was typed cannot be used", async () => {
    render(<ConditionField value={null} options={OPTIONS} onChange={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText(/Related condition/), "Other");
    await userEvent.type(screen.getByLabelText("Which condition?"), "मधुमेह");
    expect(screen.getByRole("alert")).toHaveTextContent("Use English letters or numbers.");
  });

  it("opens an article whose condition is outside the list as Other, with it filled in", () => {
    render(<ConditionField value="knee-pain" options={OPTIONS} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Related condition/)).toHaveValue("__other__");
    expect(screen.getByLabelText("Which condition?")).toHaveValue("knee pain");
  });

  it("goes back to a listed condition or None", async () => {
    const onChange = vi.fn();
    render(<ConditionField value="knee-pain" options={OPTIONS} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText(/Related condition/), "");
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByLabelText("Which condition?")).toBeNull();
  });
});
