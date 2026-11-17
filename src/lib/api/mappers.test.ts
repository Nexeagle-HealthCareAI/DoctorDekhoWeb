import { describe, expect, it } from "vitest";
import { doctorSlug } from "@/data/patient";
import { filterDoctorsByLocation } from "@/lib/filters/doctorLocation";
import { mapDoctor, tidyPlace } from "./mappers";

type Dto = Parameters<typeof mapDoctor>[0];
const dto = (over: Partial<Dto>): Dto => ({ doctorId: "d1", fullName: "Dr A", departmentName: "Orthopedics", specializations: [], city: "Kishanganj", state: "Bihar", ...over }) as Dto;

describe("tidyPlace", () => {
  it("drops stray spaces and capitalises a name typed in lower case", () => {
    expect(tidyPlace("kishanganj")).toBe("Kishanganj");
    expect(tidyPlace("Kishanganj ")).toBe("Kishanganj");
    expect(tidyPlace("  dalkhola   road ")).toBe("Dalkhola Road");
  });
  it("leaves a name that already has capitals as written", () => {
    expect(tidyPlace("WB")).toBe("WB");
    expect(tidyPlace("Delhi NCR")).toBe("Delhi NCR");
    expect(tidyPlace("Purnea")).toBe("Purnea");
  });
  it("copes with nothing", () => {
    expect(tidyPlace(undefined)).toBe("");
    expect(tidyPlace(null)).toBe("");
  });
});

describe("mapDoctor city", () => {
  it("puts a doctor typed as 'kishanganj' or 'Kishanganj ' on the Kishanganj page", () => {
    const doctors = [mapDoctor(dto({ doctorId: "1", city: "kishanganj" })), mapDoctor(dto({ doctorId: "2", city: "Kishanganj " })), mapDoctor(dto({ doctorId: "3", city: "Purnea" }))];
    const listed = filterDoctorsByLocation(doctors, { specialtyId: "orthopedics", city: "Kishanganj", state: "Bihar" });
    expect(listed.map((d) => d.id)).toEqual(["1", "2"]);
  });
  it("does not change the doctor's page address", () => {
    const tidy = mapDoctor(dto({ city: "kishanganj " }));
    expect(doctorSlug(tidy, tidy.city)).toBe(doctorSlug({ id: "d1", name: "Dr A", specialty: tidy.specialty }, "kishanganj "));
  });
});
