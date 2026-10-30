import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetLocationStore, cityFromText, detectAgain, getLocation, registerRedetect, setDetectStatus, setLocation } from "./store";

const PURNEA = { id: "purnea-bihar", name: "Purnea", state: "Bihar" };
const KOLKATA = { id: "kolkata-west-bengal", name: "Kolkata", state: "West Bengal" };

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  __resetLocationStore();
});
afterEach(() => vi.unstubAllGlobals());

describe("shared location store", () => {
  it("a detected city never replaces one the patient picked", () => {
    setLocation({ city: PURNEA }, "picked");
    setLocation({ city: KOLKATA, coords: { lat: 22.5, lng: 88.3 } }, "detected");
    expect(getLocation()).toMatchObject({ city: PURNEA, source: "picked", coords: null });
  });

  it("the default city never replaces a real location, but detection replaces the default", () => {
    setLocation({ city: KOLKATA }, "detected");
    setLocation({ city: PURNEA }, "default");
    expect(getLocation().city).toEqual(KOLKATA);
    __resetLocationStore();
    window.localStorage.clear();
    setLocation({ city: PURNEA }, "default");
    setLocation({ city: KOLKATA }, "detected");
    expect(getLocation()).toMatchObject({ city: KOLKATA, source: "detected" });
  });

  it("the city is remembered on this device; the point only for this session", () => {
    setLocation({ city: KOLKATA, coords: { lat: 22.5, lng: 88.3 } }, "detected");
    expect(JSON.parse(window.localStorage.getItem("dd_location_city")!)).toEqual({ city: KOLKATA, source: "detected" });
    expect(window.localStorage.getItem("dd_location_coords")).toBeNull();
    expect(JSON.parse(window.sessionStorage.getItem("dd_location_coords")!)).toEqual({ lat: 22.5, lng: 88.3 });
    __resetLocationStore();
    expect(getLocation()).toMatchObject({ city: KOLKATA, coords: { lat: 22.5, lng: 88.3 } });
  });

  it("detectAgain lets the next detected location replace a picked one", async () => {
    setLocation({ city: PURNEA }, "picked");
    registerRedetect(() => {
      setLocation({ city: KOLKATA, coords: { lat: 22.5, lng: 88.3 } }, "detected");
      setDetectStatus("found");
    });
    await expect(detectAgain()).resolves.toEqual({ lat: 22.5, lng: 88.3 });
    expect(getLocation()).toMatchObject({ city: KOLKATA, source: "detected" });
  });

  it("detectAgain resolves null when the browser says no", async () => {
    registerRedetect(() => setDetectStatus("denied"));
    await expect(detectAgain()).resolves.toBeNull();
  });

  it("a typed city matches a known one by name, else is kept as typed", () => {
    expect(cityFromText(" purnea ", [PURNEA])).toEqual(PURNEA);
    expect(cityFromText("Salt Lake", [PURNEA])).toMatchObject({ name: "Salt Lake" });
  });
});
