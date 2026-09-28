import { WHATSAPP_BUSINESS_NUMBER } from "@/lib/site";

export interface ChatGreeting {
  text: string;
  ctaLabel: string;
  whatsappUrl: string;
}

function buildWhatsappUrl(text: string) {
  return `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(text)}`;
}

const GREETING_TEXT = `Hello! I'm the Doctor Dekho assistant.
On WhatsApp, I can help you with the following:

1. Find a doctor – describe your symptoms, name a specialty (such as cardiologist or dentist), or search by doctor's name
2. Book an appointment – choose a doctor, date and time slot, and confirm your booking instantly
3. Manage your booking – check status, cancel, or reschedule your appointment
4. Consultation fees – check fees for any doctor or specialty
5. OPD check-in – scan the hospital QR code to get your queue token, and receive an alert on WhatsApp before your turn

You can chat in English, Hindi, Hinglish or Bengali.`;

/** No real bot backend exists yet — the widget's only job today is to greet the visitor and hand
 * them off to WhatsApp with a sensible prefilled message. Swap the URL/copy here once a real bot
 * API exists; ChatWidget never builds the wa.me link itself. */
export function getChatGreeting(_isLoggedIn: boolean): ChatGreeting {
  return {
    text: GREETING_TEXT,
    ctaLabel: "Chat with WhatsApp Bot",
    whatsappUrl: buildWhatsappUrl("Hi, I need help finding a doctor."),
  };
}
