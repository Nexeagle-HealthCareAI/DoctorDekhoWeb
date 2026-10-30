# Doctor Dekho — mobile app (Android + iOS)

Expo SDK 58 / React Native 0.88 / Expo Router. Same features as the Doctor Dekho website, built for speed:
WhatsApp-OTP sign-in, a three-field short profile, and one-screen booking pre-filled from that profile.

Lives in `DoctorDekhoWeb/mobile/` as its own npm project (own `package.json`, `node_modules` and lockfile) — run every
command below from this folder. The website's `tsconfig.json`, `.eslintrc.json` and `.dockerignore` exclude `mobile/`,
so it never affects `next build`, lint or the Docker image.

See `docs/PLAN.md` for the full plan, screen map and API map.

## Run it

```bash
npm install
npx expo start            # scan the QR with Expo Go for quick UI work
```

Push notifications and the final look need a development build:

```bash
npm i -g eas-cli
eas init                  # creates the EAS project and writes extra.eas.projectId into app.json
eas build --profile development --platform android   # or ios
```

`npm run typecheck` runs TypeScript. Builds: `npm run build:preview` (internal APK / ad-hoc iOS), `npm run build:production`.

## Configuration

Set per EAS profile in `eas.json` (or a local `.env`):

| Variable | Default (dev) |
| --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | `https://1hms-dev-api.nexeagle.com` |
| `EXPO_PUBLIC_SEARCH_PARSE_URL` | `https://doctordekho-dev.nexeagle.com/api/search/parse` |
| `EXPO_PUBLIC_SITE_URL` | `https://doctordekho.nexeagle.com` |
| `EXPO_PUBLIC_WHATSAPP_NUMBER` | `919060112765` |

## Backend this app needs

Everything is the existing EasyHMS public API (`/public/...`) with the patient JWT as a Bearer token, plus four new
endpoints backed by two new tables (shipped alongside this app in 1HMSAPI / 1HMSDatabase):

- `GET/PUT /public/patients/me/app-profile` → `dbo.PatientAppProfiles` (language, home city, usual time window,
  usual family member, last doctor, reminders consent, onboarding done)
- `POST /public/patients/me/devices`, `DELETE /public/patients/me/devices/{installationId}` → `dbo.PatientAppDevices`
  (push token per installation)

The short profile itself stays in `dbo.PatientAccountProfiles`, shared with the website. Deploy the DB migration
before the API. If the new endpoints aren't deployed yet the app still works; it just doesn't remember app settings
across phones.

## Layout

```
src/app/            screens (Expo Router)
  login/            phone → WhatsApp OTP
  onboarding.tsx    short profile, once
  (tabs)/           Home · Bookings · Records · Profile
  doctors.tsx       search results (instant + AI symptom fallback)
  doctor/[id].tsx   doctor profile
  book/[id].tsx     one-screen booking
  reschedule/[id]   change date
  profile/          about me · family · member · language
src/components/     UI kit, doctor card, OTP input, profile form, city picker
src/lib/            api client, session, i18n (en/hi/bn/hinglish), queries, booking rules, search
```
