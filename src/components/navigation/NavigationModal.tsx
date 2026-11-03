"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  AlertTriangle, ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight, Bike, Car, CornerUpLeft,
  CornerUpRight, ExternalLink, Flag, Footprints, Loader2, LocateFixed, Navigation, RotateCw, Undo2,
  Volume2, VolumeX, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n/I18nContext";
import type { TranslationKey } from "@/lib/i18n/dictionaries/en";
import { cn } from "@/lib/utils";
import {
  currentStepIndex, fetchRoute, formatArrivalTime, formatDistance, formatDuration, geocodeAddress,
  googleMapsUrl, locateOnRoute, metersBetween,
  type LonLat, type NavDestination, type NavRoute, type TravelProfile,
} from "@/lib/navigation";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const INDIA_CENTER: LonLat = [78.9629, 20.5937];
/** Within this of the destination (and near the end of the route) counts as arrived. */
const ARRIVAL_RADIUS_M = 40;
/** Further than this from the route line means the traveller has left it. */
const OFF_ROUTE_M = 60;
const REROUTE_COOLDOWN_MS = 8000;

type Phase = "locating" | "geocoding" | "routing" | "ready" | "error";

const PROFILES: { id: TravelProfile; icon: LucideIcon; labelKey: TranslationKey }[] = [
  { id: "driving", icon: Car, labelKey: "nav.driving" },
  { id: "walking", icon: Footprints, labelKey: "nav.walking" },
  { id: "cycling", icon: Bike, labelKey: "nav.cycling" },
];

function ManeuverIcon({ type, modifier, className }: { type: string; modifier?: string; className?: string }) {
  if (type === "arrive") return <Flag className={className} />;
  if (type === "depart") return <Navigation className={className} />;
  if (type === "roundabout" || type === "rotary" || type === "roundabout turn") return <RotateCw className={className} />;
  switch (modifier) {
    case "left": return <CornerUpLeft className={className} />;
    case "right": return <CornerUpRight className={className} />;
    case "sharp left": return <ArrowLeft className={className} />;
    case "sharp right": return <ArrowRight className={className} />;
    case "slight left": return <ArrowUpLeft className={className} />;
    case "slight right": return <ArrowUpRight className={className} />;
    case "uturn": return <Undo2 className={className} />;
    default: return <ArrowUp className={className} />;
  }
}

interface NavigationModalProps {
  destination: NavDestination;
  onClose: () => void;
  /** While navigating: time and distance left, and whether they have arrived (called on every GPS update; throttle it). */
  onProgress?: (p: { seconds: number; meters: number; arrived: boolean }) => void;
}

// In-page turn-by-turn navigation: an interactive Mapbox map with the route drawn on it, distance
// and ETA, the full list of steps, and a live mode that follows the visitor's GPS position,
// advances through the steps, speaks them (opt-in) and re-routes if they leave the route.
// Loaded on demand (see NavigationProvider) so mapbox-gl only ships to people who actually ask
// for directions, not to every doctor page visit.
export default function NavigationModal({ destination, onClose, onProgress }: NavigationModalProps) {
  const { t } = useTranslation();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [mapReady, setMapReady] = useState(false);

  const hasPin = destination.latitude != null && destination.longitude != null;
  const [phase, setPhase] = useState<Phase>("locating");
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [profile, setProfile] = useState<TravelProfile>(destination.profile ?? "driving");
  // `origin` is where the *current route* starts (initial fix, or the spot a re-route began);
  // `livePos` is the latest known position and only drives the marker + guidance.
  const [origin, setOrigin] = useState<LonLat | null>(null);
  const [livePos, setLivePos] = useState<LonLat | null>(null);
  const [destCoords, setDestCoords] = useState<LonLat | null>(
    hasPin ? [destination.longitude as number, destination.latitude as number] : null
  );
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [following, setFollowing] = useState(true);
  const [progress, setProgress] = useState({ alongM: 0, offRouteM: 0 });
  const [voiceOn, setVoiceOn] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Latest values for callbacks that outlive a single render (GPS watch handler).
  const latest = useRef({ route, voiceOn, livePos, origin });
  latest.current = { route, voiceOn, livePos, origin };
  const navigatingRef = useRef(false);
  navigatingRef.current = navigating;
  const followRef = useRef(true);
  const progressRef = useRef({ alongM: 0, offRouteM: 0 });
  const announcedRef = useRef<Set<string>>(new Set());
  const lastRerouteRef = useRef(0);
  const offRouteCountRef = useRef(0);

  const fail = (key: TranslationKey) => {
    setErrorKey(key);
    setPhase("error");
  };

  // ── 1. Where is the visitor? ───────────────────────────────────────────────
  useEffect(() => {
    setPhase("locating");
    setErrorKey(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      fail("nav.errorLocation");
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const here: LonLat = [pos.coords.longitude, pos.coords.latitude];
        setLivePos(here);
        setOrigin(here);
      },
      () => {
        if (!cancelled) fail("nav.errorLocation");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // ── 2. Places without a GPS pin: find them from their address ─────────────
  useEffect(() => {
    if (!origin || destCoords) return;
    const query = destination.address?.trim() || destination.name;
    if (!query) {
      fail("nav.errorNoDestination");
      return;
    }
    setPhase("geocoding");
    const controller = new AbortController();
    geocodeAddress(query, origin, controller.signal)
      .then((coords) => {
        if (controller.signal.aborted) return;
        if (coords) setDestCoords(coords);
        else fail("nav.errorAddress");
      })
      .catch(() => {
        if (!controller.signal.aborted) fail("nav.errorAddress");
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destCoords, destination.address, destination.name, attempt]);

  // ── 3. Route from origin to destination (re-runs on re-route / mode change) ─
  useEffect(() => {
    if (!origin || !destCoords) return;
    const controller = new AbortController();
    if (latest.current.route) setRerouting(true);
    else setPhase("routing");

    fetchRoute(origin, destCoords, profile, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setRoute(next);
        setPhase("ready");
        setRerouting(false);
        progressRef.current = { alongM: 0, offRouteM: 0 };
        setProgress(progressRef.current);
        announcedRef.current.clear();
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setRerouting(false);
        // A failed re-route keeps the old route on screen rather than wiping guidance mid-trip.
        if (!latest.current.route) fail("nav.errorRoute");
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destCoords, profile, attempt]);

  // ── Map ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: destCoords ?? INDIA_CENTER,
      zoom: destCoords ? 13 : 4,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }), "top-right");
    map.on("load", () => setMapReady(true));
    // A manual pan while navigating means "let me look around" -- stop snapping back to the
    // visitor until they hit Re-center.
    map.on("dragstart", () => {
      if (navigatingRef.current) {
        followRef.current = false;
        setFollowing(false);
      }
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      destMarkerRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route line + destination pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (destCoords) {
      if (!destMarkerRef.current) {
        const el = document.createElement("div");
        el.innerHTML = `<svg width="34" height="34" viewBox="0 0 24 24" fill="#0d9488" stroke="white" stroke-width="1.5"><path d="M12 21s-7-6.5-7-11.5A7 7 0 0 1 19 9.5C19 14.5 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5" fill="white"/></svg>`;
        destMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat(destCoords).addTo(map);
      } else {
        destMarkerRef.current.setLngLat(destCoords);
      }
      if (!route) map.jumpTo({ center: destCoords, zoom: 13 });
    }

    if (!route) return;
    const data: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: route.geometry },
    };
    const source = map.getSource("route") as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
    } else {
      map.addSource("route", { type: "geojson", data });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 11 },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#2563eb", "line-width": 6 },
      });
    }

    if (!navigatingRef.current) {
      const bounds = new mapboxgl.LngLatBounds();
      route.geometry.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 600 });
    }
  }, [mapReady, route, destCoords]);

  // "You are here" dot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !livePos) return;
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,0.25)";
      userMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat(livePos).addTo(map);
    } else {
      userMarkerRef.current.setLngLat(livePos);
    }
  }, [mapReady, livePos]);

  // ── Live navigation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigating) return;
    const map = mapRef.current;

    const speak = (text: string) => {
      if (!latest.current.voiceOn || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-IN";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };

    const onPosition = (pos: GeolocationPosition) => {
      const here: LonLat = [pos.coords.longitude, pos.coords.latitude];
      setLivePos(here);
      const current = latest.current.route;
      if (!current) return;

      const located = locateOnRoute(current, here, progressRef.current.alongM);
      progressRef.current = located;
      setProgress(located);

      const end = current.geometry[current.geometry.length - 1];
      const routeLen = current.cumulativeM[current.cumulativeM.length - 1];
      if (metersBetween(here, end) <= ARRIVAL_RADIUS_M && routeLen - located.alongM < 80) {
        setArrived(true);
        setNavigating(false);
        speak(t("nav.arrived"));
        return;
      }

      // Two consecutive off-route fixes (one stray GPS jump isn't a wrong turn) -> re-route.
      if (located.offRouteM > OFF_ROUTE_M) {
        offRouteCountRef.current += 1;
        if (offRouteCountRef.current >= 2 && Date.now() - lastRerouteRef.current > REROUTE_COOLDOWN_MS) {
          lastRerouteRef.current = Date.now();
          offRouteCountRef.current = 0;
          setOrigin(here);
          return;
        }
      } else {
        offRouteCountRef.current = 0;
      }

      const idx = currentStepIndex(current.stepOffsetsM, located.alongM);
      const upcoming = current.steps[idx + 1];
      if (upcoming) {
        const distToManeuver = Math.max(0, current.stepOffsetsM[idx + 1] - located.alongM);
        if (distToManeuver <= 60 && !announcedRef.current.has(`${idx}:near`)) {
          announcedRef.current.add(`${idx}:near`);
          speak(upcoming.instruction);
        } else if (distToManeuver <= 300 && !announcedRef.current.has(`${idx}:far`)) {
          announcedRef.current.add(`${idx}:far`);
          speak(`In ${formatDistance(distToManeuver)}, ${upcoming.instruction}`);
        }
      }

      if (map && followRef.current) {
        const moving = (pos.coords.speed ?? 0) > 1 && pos.coords.heading != null && !Number.isNaN(pos.coords.heading);
        map.easeTo({
          center: here,
          zoom: 17,
          pitch: 50,
          bearing: moving ? (pos.coords.heading as number) : map.getBearing(),
          duration: 800,
        });
      }
    };

    const watchId = navigator.geolocation.watchPosition(onPosition, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 20000,
    });

    // Keep the screen on while guiding -- a phone that sleeps mid-drive is a dead map.
    let wakeLock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request("screen").then((lock) => (wakeLock = lock)).catch(() => {});

    return () => {
      navigator.geolocation.clearWatch(watchId);
      wakeLock?.release().catch(() => {});
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigating]);

  // ── Chrome: Esc to close, lock page scroll behind the overlay, focus on open ─
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  // ── Derived guidance state ─────────────────────────────────────────────────
  const stepIdx = route ? currentStepIndex(route.stepOffsetsM, progress.alongM) : 0;
  const upcoming = route?.steps[stepIdx + 1];
  const distToUpcoming = route && upcoming ? Math.max(0, route.stepOffsetsM[stepIdx + 1] - progress.alongM) : 0;

  const remaining = useMemo(() => {
    if (!route) return null;
    const geometryLen = route.cumulativeM[route.cumulativeM.length - 1] || 1;
    const fraction = Math.max(0, 1 - progress.alongM / geometryLen);
    return { meters: route.distanceM * fraction, seconds: route.durationS * fraction };
  }, [route, progress.alongM]);

  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  useEffect(() => {
    if (navigating && remaining) onProgressRef.current?.({ seconds: remaining.seconds, meters: remaining.meters, arrived });
  }, [navigating, remaining, arrived]);

  useEffect(() => {
    if (navigating) stepRefs.current[stepIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [stepIdx, navigating]);

  const startNavigation = () => {
    setArrived(false);
    followRef.current = true;
    setFollowing(true);
    announcedRef.current.clear();
    offRouteCountRef.current = 0;
    setNavigating(true);
    const map = mapRef.current;
    const here = latest.current.livePos;
    if (map && here) map.easeTo({ center: here, zoom: 17, pitch: 50, duration: 800 });
  };

  const stopNavigation = () => {
    setNavigating(false);
    const map = mapRef.current;
    if (map && route) {
      const bounds = new mapboxgl.LngLatBounds();
      route.geometry.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: 60, maxZoom: 16, pitch: 0, bearing: 0, duration: 600 });
    }
  };

  const recenter = () => {
    followRef.current = true;
    setFollowing(true);
    const here = latest.current.livePos;
    if (mapRef.current && here) mapRef.current.easeTo({ center: here, zoom: 17, pitch: 50, duration: 600 });
  };

  const changeProfile = (next: TravelProfile) => {
    if (next === profile) return;
    setNavigating(false);
    // Re-route from wherever the visitor is now, not from where they first opened this.
    if (latest.current.livePos) setOrigin(latest.current.livePos);
    setProfile(next);
  };

  const retry = () => {
    setRoute(null);
    setOrigin(null);
    setAttempt((n) => n + 1);
  };

  const busy = phase === "locating" || phase === "geocoding" || phase === "routing";
  const busyKey: TranslationKey = phase === "geocoding" ? "nav.geocoding" : phase === "routing" ? "nav.routing" : "nav.locating";
  const googleLink = (
    <a
      href={googleMapsUrl(destination)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-teal transition"
    >
      <ExternalLink className="w-3.5 h-3.5" />
      {t("nav.openGoogle")}
    </a>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("nav.title", { name: destination.name })}
      className="fixed inset-0 z-[100] flex flex-col bg-slate-50"
    >
      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-3 sm:px-5 py-3 bg-white border-b border-slate-200 shadow-sm">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label={t("nav.close")}
          className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
            {t("nav.title", { name: destination.name })}
          </h2>
          {destination.address && <p className="text-[11px] text-slate-500 truncate">{destination.address}</p>}
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          {PROFILES.map(({ id, icon: Icon, labelKey }) => (
            <button
              key={id}
              type="button"
              onClick={() => changeProfile(id)}
              aria-pressed={profile === id}
              title={t(labelKey)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-bold transition",
                profile === id ? "bg-white text-brand-teal shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t(labelKey)}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* ── Map ── */}
        <div className="relative order-1 lg:order-2 flex-1 min-h-[38vh]">
          {/* mapbox-gl.css forces `position: relative` on its container, which would cancel an
              `absolute inset-0` here and collapse it to 0px tall (Mapbox then falls back to a
              300px canvas) -- so the container fills a sized absolute wrapper instead. */}
          <div className="absolute inset-0">
            <div ref={mapContainerRef} className="w-full h-full" />
          </div>

          {navigating && upcoming && (
            <div className="absolute top-3 left-3 right-14 sm:right-auto sm:max-w-md flex items-center gap-3 rounded-2xl bg-brand-teal text-white px-4 py-3 shadow-xl">
              <ManeuverIcon type={upcoming.type} modifier={upcoming.modifier} className="w-8 h-8 shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-extrabold leading-tight">{formatDistance(distToUpcoming)}</p>
                <p className="text-xs font-semibold opacity-95 leading-snug">{upcoming.instruction}</p>
              </div>
            </div>
          )}

          {rerouting && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-slate-900/85 text-white text-xs font-bold px-3.5 py-2 shadow-lg">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t("nav.rerouting")}
            </div>
          )}

          {navigating && !following && (
            <button
              type="button"
              onClick={recenter}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white text-brand-teal text-xs font-bold px-3.5 py-2 shadow-lg border border-slate-200"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              {t("nav.recenter")}
            </button>
          )}
        </div>

        {/* ── Summary + steps ── */}
        <aside className="order-2 lg:order-1 lg:w-[400px] shrink-0 bg-white border-t lg:border-t-0 lg:border-r border-slate-200 overflow-y-auto max-h-[46vh] lg:max-h-none">
          {busy && (
            <div className="flex items-center gap-3 p-5 text-sm font-semibold text-slate-600">
              <Loader2 className="w-5 h-5 animate-spin text-brand-teal" />
              {t(busyKey)}
            </div>
          )}

          {phase === "error" && (
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 p-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-900 leading-relaxed">{errorKey ? t(errorKey) : t("nav.errorRoute")}</p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={retry}
                  className="h-11 rounded-xl bg-brand-teal text-white text-sm font-bold shadow-sm hover:bg-brand-teal/90 transition"
                >
                  {t("nav.retry")}
                </button>
                {googleLink}
              </div>
            </div>
          )}

          {phase === "ready" && route && remaining && (
            <div className="p-4 sm:p-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl font-extrabold text-brand-teal">{formatDuration(remaining.seconds)}</span>
                  <span className="text-sm font-bold text-slate-600">
                    {navigating ? t("nav.remaining", { distance: formatDistance(remaining.meters) }) : formatDistance(remaining.meters)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{t("nav.arriveBy", { time: formatArrivalTime(remaining.seconds) })}</p>
              </div>

              {arrived && (
                <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm font-bold text-emerald-800">
                  <Flag className="w-4 h-4" />
                  {t("nav.arrived")}
                </div>
              )}

              <div className="flex gap-2">
                {navigating ? (
                  <button
                    type="button"
                    onClick={stopNavigation}
                    className="flex-1 h-12 rounded-2xl bg-slate-900 text-white text-sm font-bold shadow-md hover:bg-slate-800 transition"
                  >
                    {t("nav.stop")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startNavigation}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-2xl bg-brand-teal text-white text-sm font-bold shadow-md hover:bg-brand-teal/90 active:scale-[0.99] transition"
                  >
                    <Navigation className="w-4 h-4" />
                    {t("nav.start")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setVoiceOn((v) => !v)}
                  aria-pressed={voiceOn}
                  title={voiceOn ? t("nav.voiceOn") : t("nav.voiceOff")}
                  aria-label={voiceOn ? t("nav.voiceOn") : t("nav.voiceOff")}
                  className={cn(
                    "h-12 w-12 shrink-0 inline-flex items-center justify-center rounded-2xl border transition",
                    voiceOn ? "bg-teal-50 border-brand-teal/40 text-brand-teal" : "bg-white border-slate-200 text-slate-400 hover:text-slate-600"
                  )}
                >
                  {voiceOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
              </div>

              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">{t("nav.steps")}</h3>
                <ol className="space-y-1.5">
                  {route.steps.map((step, i) => (
                    <li
                      key={i}
                      ref={(el) => {
                        stepRefs.current[i] = el;
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (navigating) {
                            followRef.current = false;
                            setFollowing(false);
                          }
                          mapRef.current?.flyTo({ center: step.location, zoom: 16, duration: 700 });
                        }}
                        className={cn(
                          "w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition",
                          navigating && i === stepIdx + 1
                            ? "bg-teal-50 border border-brand-teal/40"
                            : "border border-transparent hover:bg-slate-50"
                        )}
                      >
                        <span className="mt-0.5 h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          <ManeuverIcon type={step.type} modifier={step.modifier} className="w-4 h-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-slate-800 leading-snug">{step.instruction}</span>
                          {step.distanceM > 0 && (
                            <span className="block text-[11px] text-slate-400 mt-0.5">{formatDistance(step.distanceM)}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="pt-1 flex justify-center">{googleLink}</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
