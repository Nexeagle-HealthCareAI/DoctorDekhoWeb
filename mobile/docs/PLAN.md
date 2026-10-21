# Doctor Dekho mobile app — plan

*Started 2026-10-21. Android and iOS from one Expo (React Native) codebase. Code: `DoctorDekhoWeb/mobile/` (its own npm project inside the website repo).*

## Goal

Everything the Doctor Dekho website does, in a native app that a patient can use in seconds:

1. Open the app → sign in once with a WhatsApp code (no password, ever).
2. Fill a three-field "About you" profile once (first name, age, sex).
3. From then on, booking a doctor is **search → doctor → one tap to confirm**: the patient's details, the person they usually book for and their preferred time window are already filled in.

## Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Framework | Expo SDK 58, React Native 0.88, TypeScript, Expo Router | One codebase for Android and iOS; EAS builds without local Xcode/Android Studio |
| Backend | EasyHMS public API (`/public/*`) called directly with the patient JWT as `Authorization: Bearer` | The web's BFF exists only to hide the token from browser JS; a native app keeps it in the Keychain/Keystore |
| Session | JWT from `POST /public/patient-auth/otp/verify` stored in `expo-secure-store` | Same token the website uses (30-day lifetime, server-side session epoch for logout) |
| Short profile | Stays in **`dbo.PatientAccountProfiles`** via `GET/PUT /public/patients/me` | One profile shared by web and app; nothing to sync |
| New tables | **`dbo.PatientAppProfiles`** (quick-booking preferences: language, home city, default "book for" person, preferred time window, last doctor, reminder consent, onboarding done) and **`dbo.PatientAppDevices`** (install id, platform, version, Expo push token) | App-only data; enables reminders later |
| New endpoints | `GET/PUT /public/patients/me/app-profile`, `POST /public/patients/me/devices`, `DELETE /public/patients/me/devices/{installationId}` | Same manual patient-token check as the other `patients/me` routes |
| Symptom search | Calls Doctor Dekho's `POST /api/search/parse` (router + Groq live server-side) | No AI keys in the app binary |
| Data cache | TanStack Query persisted to AsyncStorage | Doctor lists and appointments open instantly and survive poor networks |
| Languages | English, Hindi, Bengali, Hinglish (same four as the web) | Hinglish is stored as `hg` in the app-profile table, matching the WhatsApp bot |

## Screens (phase 1 — this commit)

| Area | Screen | Web equivalent | API |
|---|---|---|---|
| Onboarding | Language → Phone → WhatsApp code → About you | `/login` + Personal info | `patient-auth/otp/send|verify`, `PUT patients/me`, `PUT patients/me/app-profile` |
| Home tab | Search (text), specialty chips, city, "Book again", next appointment, doctor list | `/` | `GET /public/doctors`, `POST {DD}/api/search/parse` |
| Doctor | Profile, reviews summary, Directions, Call, **Quick book** sheet | `/doctors/[slug]` + BookingPanel | `GET /public/doctors/{id}`, `GET …/availability`, `POST /public/appointments` |
| Appointments tab | Upcoming / past, status, documents, **cancel and reschedule** (new vs web) | `/appointments` | `GET appointments/mine`, `PATCH …/cancel|reschedule`, `GET …/documents` |
| Records tab | Health locker list, upload photo/PDF, delete | `/profile/health-locker` | `GET/POST/DELETE patients/me/documents` |
| Profile tab | About me, Family, Language, Reminders, Sign out | `/profile/*` | `patients/me`, `patients/me/family`, `app-profile`, `devices` |

## Phase 2

Hospitals map and labs directory; Health Wiki reader; reviews (rate after visit); voice search; push reminders sent by EasyHMS (T-24 h) using `PatientAppDevices`; WhatsApp-template reminders for patients without the app; deep links from QR posters (`doctordekho://doctor/{id}` and universal links on doctordekho.nexeagle.com).

## Phase 3

Payments at booking; check-in with geofence and live token (endpoints exist: `/public/checkin/resolve`, `/public/tokens`); ABHA link; offline-first appointment cache with background refresh.

## Speed rules the UI follows

- Never ask for something already known: profile, family, home city and preferred window pre-fill every booking.
- One primary action per screen, in the thumb zone; big tap targets (≥ 48 dp).
- OTP: six boxes, auto-advance, auto-submit at 6 digits, paste detection, resend after 30 s.
- Booking: date chips (next 7 days, unavailable days disabled), time-window chips (preferred pre-selected), "For" chips (Me + family), one **Confirm** button.
- Cached data shows first, network refresh second; every list has pull-to-refresh.

## Risks and open items

- **Per-IP rate limits** in EasyHMS (`PatientAuthPolicy` 8/min, `PublicBookingPolicy` 20/min) were sized for one web server forwarding real IPs. Mobile users behind carrier NAT share IPs; watch for 429s after launch and raise limits or key them per device.
- **API build not verified here**: NuGet is blocked in this environment. Run `dotnet build` and `dotnet test` in `1HMSAPI` before merging (new tests: `PatientAppTests`).
- **Database**: run `db/schema/migrations/patient_app_2026_10.sql` before deploying the API.
- **Push notifications** need an EAS project id, FCM v1 credentials (Android) and an APNs key (iOS) before tokens can be issued; the app skips registration until `extra.eas.projectId` is set.
- **Store listing**: bundle id `com.nexeagle.doctordekho` (change before first EAS build if a different one is wanted); privacy policy URL and health-data declarations needed for Play and App Store.
