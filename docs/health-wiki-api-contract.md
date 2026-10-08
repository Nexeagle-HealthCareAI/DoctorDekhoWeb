# Health Wiki: what Doctor Dekho expects from the EasyHMS public API

Doctor Dekho reads published articles through its server (`src/lib/health-wiki/server.ts`) and never
from the browser. This file is the contract the backend has to meet. The wire types are in
`src/lib/health-wiki/dto.ts`; the rules applied on our side are in `mappers.ts`.

## GET /public/health-articles?pageSize=500

No login. Returns only `PUBLISHED` articles.

```json
{
  "articles": [
    {
      "id": "high-blood-pressure",
      "type": "MEDICAL",
      "title": "Living with High Blood Pressure",
      "description": "What the numbers mean, and daily habits that help.",
      "content": "## Know your numbers\n...",
      "coverImageUrl": "https://<object-store>/health-wiki/bp.jpg",
      "coverImageAlt": "A blood pressure monitor on a table",
      "relatedConditionSlug": "hypertension",
      "disclosure": null,
      "references": "WHO. Hypertension fact sheet.\nICMR. Hypertension guidelines.",
      "author":   { "id": "…", "fullName": "NexEagle content team", "type": "STAFF" },
      "reviewer": {
        "id": "…", "fullName": "Dr. Meera Nair", "type": "HOSPITAL_DOCTOR",
        "qualification": "MBBS, MD, DM (Endocrinology)", "speciality": "Endocrinologist",
        "photoUrl": null, "registrationNumber": "48213", "registrationCouncil": "Delhi Medical Council",
        "isRegistrationVerified": true
      },
      "publishedAt": "2026-09-29T10:00:00Z",
      "updatedAt": "2026-10-02T08:30:00Z"
    }
  ]
}
```

| Field | Rule |
|---|---|
| `id` | The slug: lowercase letters, digits, single hyphens. Used in `/health/conditions/{id}`. |
| `type` | `MEDICAL` or `SECTOR_UPDATE`. A missing value is read as `MEDICAL`. |
| `content` | Markdown. Sanitised on our side; scripts, inline handlers and non-https links or images are dropped. |
| `coverImageUrl`, photos | `https` only (or a path on this site). The host must be allowed by the site's CSP, see below. |
| `references` | One source per line. |
| `reviewer` | Send it only for `MEDICAL`. It is shown only when `type` is a doctor type **and** `isRegistrationVerified` is `true`; otherwise the page shows no reviewer badge. A `SECTOR_UPDATE` never shows a reviewer, whatever is sent. |
| Contributor fields | Never send mobile number or email. |

Both `author` and `reviewer` are optional. Every field except `id`, `title` and `content` is optional.

## GET /public/health-articles/{id}

Same object as one entry above. Not used yet (the list is cached and filtered on our side). Return 404
for an unknown or unpublished id.

## When the endpoint is missing

A `404` from the list is treated as "not deployed yet": the articles written in the interim admin tool
(`src/data/wiki-articles.json`, see `src/lib/health-wiki/interim.ts`) keep being served. Once the content
team has recreated them in the CMS with the same slugs, the live version replaces the interim one, and
the interim files can be deleted.
Any other failure (5xx, network) is an error: the last cached list keeps being served, and a cold build
fails loudly, the same as for doctors.

## Images and the Content Security Policy

`next.config.mjs` only lets the browser load images from this site, `data:`, Mapbox and the dev
object-store bucket. For production, set the build variable `HEALTH_WIKI_IMAGE_ORIGINS` to the public
origin(s) of the production bucket (space separated, `https://host` only), for example
`HEALTH_WIKI_IMAGE_ORIGINS="https://cdn.example.com"`.

## Contributor pages (`/contribute/*`)

The contributor area is a set of pages inside this site: join, invitation link, WhatsApp OTP, register,
My articles, review, write, topic requests. The browser calls this site's own paths under
`/api/contributor/*` (`app/api/contributor/[...path]/route.ts`), and that route is the only place that
talks to the backend. The session is an HttpOnly cookie (`hw_contributor`); no token reaches page scripts.

| Switch | Where | Effect |
|---|---|---|
| `NEXT_PUBLIC_CONTRIBUTOR_ENABLED=true` | build argument | Shows the pages and the "Join as a contributor" box on `/health`. Off by default: `/contribute/*` then says "Coming soon". |
| `CONTRIBUTOR_MOCK=true` | runtime env | Answers `/api/contributor/*` from an in-memory example backend (`src/lib/contributor/mockStore.ts`). Off by default: every call answers 503. |

The backend has to provide these, which the route will proxy to once they exist (paths are proposals, see the
developer note):

| Call from the pages | Backend |
|---|---|
| `GET invite/{token}` | Validate a link; return inviter, role, article title and cover, masked mobile. 404 unknown, 410 used or expired. |
| `POST enrol`, `POST otp/send` | Send a WhatsApp OTP. With `inviteToken`, only to the number the link was sent to (403 otherwise). |
| `POST otp/verify` | Check the code, start a session, say whether registration is needed. |
| `POST register`, `GET me` | Save and read the profile. Never return the full mobile number. |
| `GET articles` | `{ pending, published, drafts }` for the contributor, with views and likes on published. |
| `POST articles`, `PATCH articles/{slug}`, `POST articles/{slug}/submit` | Draft, edit and submit. Submit needs a VERIFIED profile; a cover image needs alt text. |
| `POST articles/{slug}/review` | `{ decision: APPROVE }` or `{ decision: REQUEST_CHANGES, comment }`. Only the assigned, signed-in doctor; a comment of 10 or more characters is required to ask for changes. |
| `POST images` | Multipart upload, JPG/PNG/WebP, 2 MB; returns `{ url }`. |
| `GET/POST topics`, `PATCH topics/{id}` | Topic requests; at most 5 open; PATCH adds detail to a NEEDS_DETAIL request. |

`robots.txt` disallows `/contribute`, and the pages send `noindex`.

## Not built yet (needs backend work first)

- **Helpful button and view counts.** `POST /public/health-articles/{id}/like` and `/view` do not exist, and
  `track-event` only accepts the fixed event list in the backend. Page views are already counted by the
  existing page-view beacon (per path).

## Local review without a backend

`HEALTH_WIKI_SAMPLE=true npm run dev` serves four example articles (see `sample.ts`).
