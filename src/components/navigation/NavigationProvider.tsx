"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { NAVIGATION_AVAILABLE, googleMapsUrl, type NavDestination } from "@/lib/navigation";

// mapbox-gl is ~200KB+ and only needed once someone actually asks for directions, so the modal
// is split into its own chunk and never rendered (or downloaded) until then.
const NavigationModal = dynamic(() => import("./NavigationModal"), { ssr: false });

interface NavigationContextValue {
  /** Opens the in-page route + turn-by-turn overlay for a destination. */
  openNavigation: (destination: NavDestination) => void;
}

const openGoogleMaps = (destination: NavDestination) =>
  window.open(googleMapsUrl(destination), "_blank", "noopener,noreferrer");

// Default value = the old behaviour (hand off to Google Maps), so a component rendered outside
// the provider -- or on a deployment with no Mapbox token -- still gets working directions.
const NavigationContext = createContext<NavigationContextValue>({ openNavigation: openGoogleMaps });

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [destination, setDestination] = useState<NavDestination | null>(null);

  const openNavigation = useCallback((next: NavDestination) => {
    if (!NAVIGATION_AVAILABLE) {
      openGoogleMaps(next);
      return;
    }
    setDestination(next);
  }, []);

  const close = useCallback(() => setDestination(null), []);

  // A booking's journey: "on the way" with the time and distance left, at most every 2 minutes, and "arrived" once. Best effort.
  const sent = useRef<{ id?: string; at: number; arrived: boolean }>({ at: 0, arrived: false });
  const appointmentId = destination?.appointmentId;
  const onProgress = useCallback((p: { seconds: number; meters: number; arrived: boolean }) => {
    if (!appointmentId) return;
    const s = sent.current.id === appointmentId ? sent.current : (sent.current = { id: appointmentId, at: 0, arrived: false });
    if (s.arrived) return;
    const now = Date.now();
    if (!p.arrived && now - s.at < 120_000) return;
    s.at = now;
    s.arrived = p.arrived;
    const body = p.arrived
      ? { status: "arrived" }
      : { status: "on_the_way", etaMinutes: Math.max(1, Math.round(p.seconds / 60)), distanceKm: Math.round(p.meters / 100) / 10 };
    void fetch(`/api/public/appointments/${appointmentId}/journey`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  }, [appointmentId]);
  const value = useMemo(() => ({ openNavigation }), [openNavigation]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
      {destination && <NavigationModal destination={destination} onClose={close} onProgress={appointmentId ? onProgress : undefined} />}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  return useContext(NavigationContext);
}
