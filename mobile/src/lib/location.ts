import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import { distanceKm, type Doctor } from "./api/doctors";
import { saveAppProfile } from "./api/patient";
import { keys, useAppProfile, useDoctors } from "./queries";

const STORAGE_KEY = "dd_home_place";

export interface HomePlace {
  city: string | null; // null = All India
  state: string | null;
  lat?: number;
  lng?: number;
  /** Neighbourhood picked on the map ("Line Bazar"), shown before the city. Kept on the phone only. */
  area?: string | null;
}

export interface CityOption {
  city: string;
  state: string;
  count: number;
}

/** Cities that actually have doctors, busiest first — built from the live directory, never a hard-coded list. */
export function citiesFrom(doctors: Doctor[] | undefined): CityOption[] {
  const map = new Map<string, CityOption>();
  for (const d of doctors ?? []) {
    if (!d.city || !d.state) continue;
    const k = `${d.city.toLowerCase()}|${d.state.toLowerCase()}`;
    const e = map.get(k) ?? { city: d.city, state: d.state, count: 0 };
    e.count++;
    map.set(k, e);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/**
 * The patient's home place: restored from the phone, then from their app profile, and saved to both when changed.
 * `locate()` uses GPS once (asking permission only then) and snaps to the nearest city that has doctors.
 */
export function useHomePlace() {
  const qc = useQueryClient();
  const app = useAppProfile();
  const doctors = useDoctors();
  const [place, setPlace] = useState<HomePlace | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v) setPlace(JSON.parse(v) as HomePlace);
      })
      .catch(() => {});
  }, []);

  // A fresh install on a known account picks the city up from the server.
  useEffect(() => {
    if (place || !app.data?.homeCity) return;
    setPlace({
      city: app.data.homeCity,
      state: app.data.homeState ?? null,
      lat: app.data.homeLatitude ?? undefined,
      lng: app.data.homeLongitude ?? undefined,
    });
  }, [app.data, place]);

  const save = useCallback(
    async (p: HomePlace) => {
      setPlace(p);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p)).catch(() => {});
      if (p.city) {
        const saved = await saveAppProfile({
          homeCity: p.city,
          homeState: p.state ?? undefined,
          ...(p.lat != null && p.lng != null ? { homeLatitude: Number(p.lat.toFixed(6)), homeLongitude: Number(p.lng.toFixed(6)) } : {}),
        }).catch(() => null);
        if (saved) qc.setQueryData(keys.appProfile, saved);
      }
    },
    [qc],
  );

  const locate = useCallback(async (): Promise<boolean> => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") return false;
      const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      // Nearest doctor with a pin decides the city.
      let best: Doctor | undefined;
      let bestKm = Infinity;
      for (const d of doctors.data ?? []) {
        if (d.latitude == null || d.longitude == null) continue;
        const km = distanceKm(here, { lat: d.latitude, lng: d.longitude });
        if (km < bestKm) {
          bestKm = km;
          best = d;
        }
      }
      await save({ city: best?.city ?? null, state: best?.state ?? null, ...here });
      return true;
    } catch {
      return false;
    } finally {
      setLocating(false);
    }
  }, [doctors.data, save]);

  const cities = useMemo(() => citiesFrom(doctors.data), [doctors.data]);
  return { place, setPlace: save, locate, locating, cities };
}
