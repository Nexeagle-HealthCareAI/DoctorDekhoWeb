import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { distanceKm, type Doctor } from "./api/doctors";
import { useI18n } from "./i18n";
import { doctorCityNear } from "./doctorCity";
import { placeNames } from "./map";
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
  /** The real town or city there ("Ghaziabad"), from the map. Shown in place of `city` when the nearest doctors are elsewhere. */
  town?: string | null;
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
  const { locale } = useI18n();
  const [place, setPlace] = useState<HomePlace | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v) setPlace(JSON.parse(v) as HomePlace);
      })
      .catch(() => {});
  }, []);

  // An area with no town (saved by an older version, or when the map couldn't name the spot) may carry a city taken
  // from a mislabelled doctor ("Sector 11, Kishanganj" in Ghaziabad). Name it again once per app start, and re-pick
  // the city with today's rules. Once only, so a lookup that keeps failing can't loop.
  const renamed = useRef(false);
  useEffect(() => {
    if (renamed.current || !place || place.lat == null || place.lng == null || place.town || !doctors.data) return;
    renamed.current = true;
    let live = true;
    const here = { lat: place.lat, lng: place.lng };
    placeNames(here, locale)
      .then((names) => {
        if (!live) return;
        const near = doctorCityNear(here, names?.match, doctors.data ?? []);
        void save({ ...place, city: near?.city ?? null, state: near?.state ?? null, area: names?.area ?? place.area ?? null, town: names?.town ?? null });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, doctors.data, locale]);

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
      // The map names the town; a directory city is used only when it is that town (see doctorCity.ts).
      const names = await placeNames(here, locale);
      const near = doctorCityNear(here, names?.match, doctors.data ?? []);
      await save({ city: near?.city ?? null, state: near?.state ?? null, ...here, area: names?.area ?? null, town: names?.town ?? null });
      return true;
    } catch {
      return false;
    } finally {
      setLocating(false);
    }
  }, [doctors.data, save, locale]);

  const cities = useMemo(() => citiesFrom(doctors.data), [doctors.data]);
  return { place, setPlace: save, locate, locating, cities };
}
