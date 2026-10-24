"use client";

import { useEffect } from "react";
import { CITIES } from "@/data/patient";
import { useGeolocatedCity } from "@/lib/geo";
import { registerRedetect, setDetectStatus, setLocation } from "@/lib/location/store";

// Takes the visitor's location by default, once per page load, for the whole site: the home page's
// city picker and the Vita chat both read the result from the shared location store. When the browser
// gives no location, the business's home city (Purnea) is used until the patient picks another.
// Renders nothing.

const DEFAULT_CITY = CITIES.find((c) => c.name === "Purnea") ?? null;

export default function LocationDetector() {
  const geo = useGeolocatedCity(CITIES);
  const { retry } = geo;

  useEffect(() => {
    if (geo.status === "found") {
      const coords = geo.coords ? { lat: geo.coords.lat, lng: geo.coords.lon } : null;
      setLocation(geo.city ? { city: geo.city, coords } : { coords }, "detected");
    } else if ((geo.status === "denied" || geo.status === "unsupported") && DEFAULT_CITY) {
      setLocation({ city: DEFAULT_CITY }, "default");
    }
    setDetectStatus(geo.status);
  }, [geo.status, geo.city, geo.coords]);

  useEffect(() => {
    registerRedetect(retry);
    return () => registerRedetect(null);
  }, [retry]);

  return null;
}
