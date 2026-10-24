import { Linking } from "react-native";
import { config } from "./config";

/**
 * Reach a person at Doctor Dekho. Research with first-time and low-literacy users found a human on the line
 * cut booking errors about tenfold, so "Help" and "Call to book" are on the main screens.
 */
export function contactSupport(channel: "whatsapp" | "call", message?: string) {
  if (channel === "call") {
    void Linking.openURL(`tel:${config.supportPhone}`);
    return;
  }
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  void Linking.openURL(`https://wa.me/${config.whatsappNumber}${text}`);
}

/**
 * Google Maps to a place: coordinates when known, else the name and city as a search.
 * With a travel mode it opens turn-by-turn directions (auto-rickshaw uses two-wheeler routing, the closest Google has).
 */
export function openDirections(target: { lat?: number | null; lng?: number | null; query?: string }, mode?: "car" | "auto" | "walk") {
  const q = target.lat != null && target.lng != null ? `${target.lat},${target.lng}` : encodeURIComponent(target.query ?? "");
  if (mode) {
    const travel = mode === "walk" ? "walking" : mode === "auto" ? "two-wheeler" : "driving";
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=${travel}`);
    return;
  }
  void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
}

/** A shareable Google Maps link to a place, for "Share trip". */
export function mapsLink(target: { lat?: number | null; lng?: number | null; query?: string }): string {
  const q = target.lat != null && target.lng != null ? `${target.lat},${target.lng}` : encodeURIComponent(target.query ?? "");
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function callNumber(phone: string) {
  void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`);
}
