/** Any eagle on the site can open the Vita chat: it fires this event and the chat widget (ChatWidget.tsx) opens. */
export const VITA_OPEN_EVENT = "vita:open";

export function openVita(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VITA_OPEN_EVENT));
}
