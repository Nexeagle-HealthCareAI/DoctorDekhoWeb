# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* vars are inlined into the client bundle at BUILD time, not read at container
# runtime, so they must arrive as build-args here, not `docker run -e`.
#
# SITE_URL is this deployment's own public origin (canonical URLs, sitemap, share links, JSON-LD)
# and BUSINESS_URL is the separate NexEagle corporate site this app links out to. `next build`
# always loads .env.production (Next.js runs every build in production mode) which hardcodes the
# PROD origins -- so without these, the dev image would silently bake in prod's URLs. A real
# process env var set here takes precedence over .env.production. See src/lib/site.ts.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BUSINESS_URL
ENV NEXT_PUBLIC_BUSINESS_URL=$NEXT_PUBLIC_BUSINESS_URL

# EASYHMS_API_BASE_URL is a runtime-only var everywhere else (read server-side per request via
# `docker run -e`, see deploy.yml) — EXCEPT for statically-generated pages (the
# /specialties/[specialty]/[city]/[area] tree, prerendered with getStaticProps), which fetch
# doctor data once at THIS build step, not at request time. Same .env.production precedence issue
# as above: without this, every environment's static pages silently bake in prod's doctor data.
ARG EASYHMS_API_BASE_URL
ENV EASYHMS_API_BASE_URL=$EASYHMS_API_BASE_URL

# Mapbox public token -- powers the static location-preview map on each doctor's detail page
# (DoctorLocationMap.tsx). Same build-time-inlining reasoning as above.
# Unset means the map is simply omitted; the "Get Directions" link still works either way.
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ENV NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN

# Health Wiki contributor pages. Both are build-time: the first is inlined into the client bundle, the second
# is read by next.config.mjs for the Content-Security-Policy (the bucket the article images are served from).
ARG NEXT_PUBLIC_CONTRIBUTOR_ENABLED
ENV NEXT_PUBLIC_CONTRIBUTOR_ENABLED=$NEXT_PUBLIC_CONTRIBUTOR_ENABLED
ARG HEALTH_WIKI_IMAGE_ORIGINS
ENV HEALTH_WIKI_IMAGE_ORIGINS=$HEALTH_WIKI_IMAGE_ORIGINS

RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built artifacts and necessary files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
# The Health Wiki's interim article file (src/lib/wikiStore.ts) is read from disk at request time,
# not only at build time. Without this the running container has no such file.
COPY --from=builder /app/src/data ./src/data

# Bind container port to 80 (deploy.yml maps a host port -> container 80)
EXPOSE 80
ENV PORT=80

CMD ["npm", "run", "start"]
