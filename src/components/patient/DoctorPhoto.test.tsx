import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DoctorPhoto from "./DoctorPhoto";

const props = { name: "Dr. Avinash Kumar", initials: "AK", gradient: "from-a to-b", size: 80, imageClassName: "img", fallbackClassName: "badge" };

describe("DoctorPhoto", () => {
  it("shows initials when there is no photo", () => {
    render(<DoctorPhoto {...props} photo={undefined} />);
    expect(screen.getByRole("img", { name: "Dr. Avinash Kumar" })).toHaveTextContent("AK");
  });

  it("shows the photo when there is one", () => {
    render(<DoctorPhoto {...props} photo="https://example.com/a.jpg" />);
    expect(screen.getByRole("img", { name: "Dr. Avinash Kumar" }).tagName).toBe("IMG");
  });

  it("falls back to initials when the photo fails to load, instead of a broken image", () => {
    render(<DoctorPhoto {...props} photo="https://example.com/missing.jpg" />);
    fireEvent.error(screen.getByRole("img", { name: "Dr. Avinash Kumar" }));
    const after = screen.getByRole("img", { name: "Dr. Avinash Kumar" });
    expect(after.tagName).toBe("DIV");
    expect(after).toHaveTextContent("AK");
  });

  it("tries a new photo address again after a failure", () => {
    const { rerender } = render(<DoctorPhoto {...props} photo="https://example.com/missing.jpg" />);
    fireEvent.error(screen.getByRole("img", { name: "Dr. Avinash Kumar" }));
    rerender(<DoctorPhoto {...props} photo="https://example.com/new.jpg" />);
    expect(screen.getByRole("img", { name: "Dr. Avinash Kumar" }).tagName).toBe("IMG");
  });
});
