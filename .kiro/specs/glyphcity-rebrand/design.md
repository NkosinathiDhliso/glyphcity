# Design Document

## Overview

### Goals

- Ship one name (GlyphCity, spoken "Glyph") on one domain (`glyphcity.com`)
  across four portals, emails, links and legal text, with Area Code named only
  as the operating company.
- Replace the glacier and slate identity with the Outdoor_Palette: lichen and
  veld grounds, dawn and dusk skies, grain, contour terrain, Funnel type, and
  the Logo_Mark.
- Retire hype words from the live-state scale and give State_Labels one home.
- Name glyphs, never explain them, while meeting WCAG 1.1.1 and 1.4.1.
- Add Point_Mode, a web camera view placed by GPS and compass, with honest
  fallbacks and no data leaving the device.
- Give creators an artefact (the glyph share card) and the founder a way to
  measure whether silence works.

### Non-Goals

- Any change to Cone_Invariants, glyph icons, category colours or `vibeRank`.
- Renaming internal identifiers (`@area-code/*`, `AREA_CODE_*`, tables,
  Lambdas, secrets, Cognito pools).
- The Area Code umbrella site (separate repo), the social platform (parked),
  shared accounts across brands, and data sharing with Volta Seek.
- Building-accurate camera localization (ARCore Geospatial). Follow-up spec on
  `apps/mobile`, which must show Google's required notice ("To power this
  session, Google will process sensor data") and so cannot reuse the "Camera
  stays on your phone" line.
- Redirects or a dual-domain period. There are no accounts or printed codes to
  protect.
- An in-app glyph legend, tutorial or description.

### Architectural constraints (binding)

- Serverless only. No new AWS resource types. Domain work reuses
  `infra/modules/amplify-domain` and the existing Route53, ACM, CloudFront,
  SES and Cognito resources, re-pointed to the new zone.
- One home per concept: name and domain in Brand_Constants; State_Labels in one
  shared module; tokens in `packages/shared/tokens.css`; the noise overlay
  stays in `apps/web/src/app.css`, retuned in place.
- No fallbacks: env defaults touched by the cutover are removed; required URLs
  are validated at startup.
- Honest presence: Point_Mode reads the same pulse and presence data as the
  map; it adds no new signal and never persists position.

## Architecture

### Component map

```
packages/shared
  tokens.css                    Outdoor_Palette (light, dark), grain, sky, type tokens
  constants/brand.ts            APP_NAME, SPOKEN_NAME, APP_DOMAIN, COMPANY_NAME, BRAND_LINE
  constants/state-labels.ts     STATE_LABEL_KEY, PLAIN_SCALE_EN
  constants/archetype-catalog   unchanged (description kept for Codex only)
  assets/logo-mark.svg          Logo_Mark source
  lib/accessibleNodeName.ts     venue, category word, glyph name, state or invite
  lib/pointMode/                geometry.ts, cluster.ts, accuracy.ts

apps/web
  app.css                       grain retune, Funnel fonts, body ground
  hooks/useMapInit.ts           ATMOSPHERE retune, paint overrides, contour layer
  components/ArchetypeGlyph     unchanged visuals
  components/VenueCard, NodeDetailContent   glyph name, category word, plain labels
  components/SkyHeader.tsx      dawn or dusk sky + ridge + the venue's own node
  screens/ProfileScreen         "Your glyph", name, Share my glyph
  screens/PointModeScreen.tsx   camera feed, beams, labels, card, fallbacks
  hooks/usePointModeSensors.ts  camera, geolocation watch, heading (permission on tap)
  lib/glyphShareCard.ts         canvas card, reuses shareCard.ts primitives
  lib/whisperText.ts            labels from state-labels module

apps/business
  NodeEditorPanel               Entrance_Pin drag marker (75 m bound)

backend
  features/nodes/share-snapshot.ts   labels from state-labels module
  features/nodes/schemas + service   entrance { lat, lng } validated, 75 m rule
  features/users                     acquisitionSource set once at sign-up
  shared/email/ses.ts                brand from Brand_Constants, no env defaults
  shared/security/origins.ts         glyphcity.com origins

infra
  environments/prod, dev            glyphcity.com zone, ACM, Amplify domains,
                                    Cognito URLs, SES identity, CORS, CDN, API domain
```

### Phase 0: brand constants

`packages/shared/constants/brand.ts` exports `APP_NAME = 'GlyphCity'`,
`SPOKEN_NAME = 'Glyph'`, `APP_DOMAIN = 'glyphcity.com'`,
`COMPANY_NAME = 'Area Code'` and `BRAND_LINE = 'Check the beams.'`.
`COMPANY_NAME` is read only by legal content. i18n strings interpolate the
constants (`{{appName}}`), emails and share builders import them, and the HTML
title and manifest are generated from them at build time (Vite
`transformIndexHtml` and a manifest template).

`scripts/check-brand-strings.mjs`, run in `pnpm test`, scans the user-facing
file set (i18n, `apps/*/index.html`, manifests, email templates, legal
content, share builders) and fails on `/Area Code|areacode\.co\.za/` or on any
Brand_Constants value written as a literal outside `brand.ts`.

### Phase 1: words

#### State labels

```ts
// packages/shared/constants/state-labels.ts
export const STATE_LABEL_KEY: Record<NodeState, string | null> = {
  dormant: null, // render the invite instead
  quiet: 'state.quiet',
  active: 'state.aLittleBusy',
  buzzing: 'state.busy',
  popping: 'state.veryBusy',
}
export const PLAIN_SCALE_EN = {
  'state.quiet': 'Quiet',
  'state.aLittleBusy': 'A little busy',
  'state.busy': 'Busy',
  'state.veryBusy': 'Very busy',
  'state.firstIn': 'Be the first in',
}
```

The backend has no i18next, so `share-snapshot.ts` imports `PLAIN_SCALE_EN`
directly; the web app loads the same strings into `en.json`. A unit test
asserts the two stay equal. `whisperText.ts` and `AuthLanding.tsx` drop their
literals. The AuthLanding flame and zap icons for states are removed; the
landing shows the Cone_Node at each state instead (same component as the
venue header).

#### Glyph naming

`NodeDetailContent` and the selected `VenueCard` render the Glyph_Name under
the glyph and the category word in the meta line. `ProfileScreen` renders
"Your glyph", the glyph at 60px in ink with the standard outline pass, the
Glyph_Name and "Share my glyph". The `description` field is read only by the
Glyph_Codex and admin. A test renders every consumer screen with a catalog
whose descriptions are sentinel strings and asserts none appear.

`accessibleNodeName(node, archetype, state, t)` returns, for example,
"Fox Street Yard, Nightlife, The Township Royal, Very busy, 41 here" or
"Marula Lounge, Food, The Eclectic, Be the first in". `ArchetypeGlyph` keeps
`aria-hidden`; the glyph hit pad in `useMapMarkers.ts` gets `role="button"`
and `aria-label` from this function. The marker DOM structure is otherwise
untouched.

### Phase 2: outdoor look and brand marks

#### Tokens

`tokens.css` is edited in place. The token names components use stay stable
where the role is the same (`--bg-base`, `--bg-surface`, `--text-primary`,
`--text-secondary`, `--text-muted`, `--border`), so most components restyle
without edits. Removed: `--accent-gradient`, `--cta-gradient*`,
`--glow-accent`, glacier values. `--accent` becomes ink (the CTA fill), and
`--on-accent` becomes ground.

| Token role                         | Light                                    | Dark                            |
| ---------------------------------- | ---------------------------------------- | ------------------------------- |
| Ground (`--bg-base`)               | Lichen `#EDF0E8`                         | Veld night `#090E0C`            |
| Surface                            | `#FAFBF7`                                | `#111915`                       |
| Surface 2                          | `#E1E7DA`                                | `#18221D`                       |
| Ink (`--text-primary`, `--accent`) | Bush ink `#13211B`                       | Bone `#E7EDE6`                  |
| Secondary text                     | `#4A5A50`                                | `#A0AEA3`                       |
| Muted                              | Fynbos `#79867B` (labels only, not body) | `#69776D` (labels only)         |
| Border                             | `rgba(19,33,27,.10)`                     | `rgba(231,237,230,.08)`         |
| Sky top, mid, horizon              | `#C9DCE3`, `#E3EBE2`, `#F2D8BC`          | `#05080C`, `#0B1413`, `#3B2A20` |
| Ridge                              | `#C3CFB8`                                | `#0C1410`                       |
| Water (Spruit)                     | `#C8DCDB`                                | `#0B1A1F`                       |
| Parks (Koppie)                     | `#D2DEC6`                                | `#0E1912`                       |
| Contour                            | `rgba(19,33,27,.08)`                     | `rgba(231,237,230,.05)`         |

Node category tokens (`--node-*`) and their glows are untouched.

Muted tones fail 4.5:1 for body text; the contrast check enforces that muted
is used only for labels of 11px uppercase mono or larger with a 3:1 floor, and
everything else meets 4.5:1.

#### Grain and sky

The existing `body::after` feTurbulence overlay keeps its mechanism; base
frequency and alpha change to the mock's values, and the gradient drift
animation on `body` is removed (the ground is flat lichen or veld). `SkyHeader`
renders a CSS gradient from the sky tokens, a ridge SVG path filled with
`--ridge`, stars only in dark (`--star` alpha 0 in light), and the venue's
Cone_Node built by the same `buildMarkerElement` path at a fixed scale, so the
header can never drift from the map node.

#### Type

Google Fonts link in each `apps/*/index.html` swaps DM Sans for
`Funnel+Display:wght@500;700;800`, `Funnel+Sans:wght@400;500;600;700` and
`Geist+Mono:wght@400;500`. Tokens `--font-display`, `--font-body`,
`--font-mono` carry fallback stacks. Tailwind config maps `font-display`,
`font-sans`, `font-mono` to them.

#### Brand marks

`packages/shared/assets/logo-mark.svg`: circle radius 6.5 at y 7 on a 24 by
34 box, beam from y 15.5 to the tip at y 34, linear gradient from ink to 18%
ink upward. A build script renders favicon, PWA icons (192, 512, maskable),
apple-touch icon, splash and the default OG image (wordmark plus Brand_Line).
The Map tab icon in `BottomNav` uses the Logo_Mark at 13px in `currentColor`.
The wordmark "glyphcity" is Funnel Display 800, lowercase, tracking -0.05em.

#### Map paint and terrain

On `style.load`, `applyOutdoorPaint(map, theme)` in `useMapInit.ts` sets
`background-color`, the `water` fill, and `landuse` and `park` fills from the
token values (read once from computed style). `addContours(map)` adds source
`mapbox://mapbox.mapbox-terrain-v2` and a `line` layer on source-layer
`contour`, inserted below the first road layer, `minzoom` at
`MIN_MARKER_ZOOM`, colour `--contour`, width 0.6 to 1.0 by zoom, every fifth
index line slightly stronger. `ATMOSPHERE` values change:

| Field               | Dark (dusk)                     | Light (dawn)                     |
| ------------------- | ------------------------------- | -------------------------------- |
| fog.color           | `#120f0c`                       | `#efe6da`                        |
| fog.high-color      | `#0b1413`                       | `#c9dce3`                        |
| fog.space-color     | `#03050a`                       | `#c9dce3`                        |
| fog.star-intensity  | 0.8                             | 0                                |
| horizon glow        | sky halo `rgba(120,80,50,0.55)` | sky halo `rgba(242,216,188,0.9)` |
| buildingColor / top | `#16201b` / `#24302a`           | `#dfe4d6` / `#eef0e6`            |
| floodLightColor     | `#3b2a20`                       | `#fff1d6`                        |

Marker DOM sits above the WebGL canvas, so fog and lights never tint
Cone_Nodes (Requirement 6.4 holds structurally; a test asserts markers are
DOM markers, not symbol layers).

### Phase 3: domain cutover

Order matters because Cognito, SES and ACM each need DNS before use:

1. Route53 hosted zone for `glyphcity.com` in Terraform; registrar NS set by
   the founder (Phase 0).
2. ACM certificates (us-east-1 for CloudFront, regional for API Gateway).
3. SES domain identity with DKIM and a custom MAIL FROM; wait for verified.
4. Amplify domain associations for the four apps through `amplify-domain`.
5. API custom domain `api.glyphcity.com`, CDN alias `cdn.glyphcity.com`.
6. Cognito callback and logout URLs, Hosted UI domains, Google OAuth client
   authorized origins and redirect URIs (Google console is manual; record the
   checklist in `docs/DEPLOY.md`).
7. Env values (`AREA_CODE_WEB_URL`, `AREA_CODE_BUSINESS_URL`,
   `BUSINESS_APP_URL`, `AREA_CODE_FROM_EMAIL`, `AREA_CODE_MEDIA_CDN_URL`,
   `SPOTIFY_REDIRECT_URI`, VAPID subject) in Terraform; `VITE_*` URLs through
   `update-all-amplify-apps.ps1`; closure checks pass.
8. `origins.ts` and Terraform CORS lists switch together.
9. Remove every app use of `areacode.co.za` in the same change (Amplify
   domain associations, API and CDN aliases, app certificates, Cognito URLs,
   CORS origins, the app's SES sender, scripts). No redirect and no
   dual-domain period. Keep the `areacode.co.za` zone and the records Phase 0
   lists for Area Code's own site.

`ses.ts` loses `?? 'noreply@areacode.co.za'` and `?? 'https://business...'`;
both become `requireEnv` reads validated in `shared/config/env.ts`.

### Phase 4: Point_Mode

#### Sensors

`usePointModeSensors` starts only from the camera control's click handler:

- Camera: `getUserMedia({ video: { facingMode: 'environment' } })`, stream to a
  `<video playsInline muted>`; tracks stopped on unmount and on
  `visibilitychange` to hidden.
- Position: `watchPosition({ enableHighAccuracy: true, maximumAge: 2000 })`;
  `coords.accuracy` feeds the accuracy gate.
- Heading: iOS `DeviceOrientationEvent.requestPermission()` in the same click,
  then `webkitCompassHeading` and `webkitCompassAccuracy`; Android
  `deviceorientationabsolute` `alpha` converted to compass heading, accuracy
  unknown treated as 20 degrees when `absolute` is true, else unavailable.
- Smoothing: circular moving average over 300 ms for heading.

Nothing from these sensors is sent to the API or stored. The only network
reads are the existing city payload and pulse socket.

#### Geometry (pure, in `packages/shared/lib/pointMode/geometry.ts`)

```
bearingTo(from, to)              initial great-circle bearing, degrees
distanceTo(from, to)             haversine metres
relativeAngle(bearing, heading)  normalised to (-180, 180]
project(rel, fovDeg, width)      x = width/2 + (rel / (fovDeg/2)) * width/2, null if |rel| > fovDeg/2
depthScale(d)                    clamp(0.3 + 0.9 * 1 / (1 + d / 60), 0.35, 1)
groundY(d, height)               horizon + (height - horizon) * f(d), f monotone decreasing
```

`fovDeg` defaults to 60 (typical phone main camera, portrait horizontal FOV).
The target is the Entrance_Pin when set, else the node coordinate.

#### Clustering (`cluster.ts`)

Sort in-view venues by relative angle. Merge neighbours whose angular gap is
less than `max(headingAccuracy, 6)` degrees into one stack. A stack renders
one label listing venues in `vibeRank` order and one beam per venue fanned
side by side at the stack's x. This is how Requirement 8.5 avoids guessing a
door.

#### Rendering

`PointModeScreen` stacks: `<video>` (object-fit cover), a pins layer of
absolutely positioned DOM markers built with the same marker builder used by
the map at `depthScale(d)`, labels as glass pills, and the selection card
reusing `VenueCard` content in a non-modal sheet. Selection writes
`selectionStore`; non-active beams use the existing dim path at 0.4. Closing
returns to the map with the selection kept.

#### Fallback states (designed, not hidden)

| Condition                                                  | Copy                                                             | Action             |
| ---------------------------------------------------------- | ---------------------------------------------------------------- | ------------------ |
| Camera denied                                              | "Camera is off for {{appName}}"                                  | Back to map        |
| Location denied                                            | "Location is off, so beams cannot be placed"                     | Back to map        |
| Motion denied (iOS)                                        | "Motion access is off, so we cannot tell where you are pointing" | Retry, back to map |
| GPS accuracy over 35 m or heading accuracy over 25 degrees | "Point mode needs a clearer signal"                              | Back to map        |
| No venues within radius                                    | "Nothing live on this street"                                    | Back to map        |

### Phase 4: Entrance_Pin

`NodeEditorPanel` adds a small map with a draggable marker seeded at the node
coordinate and a 75 m circle. Save sends `entrance`. The node service checks
`distanceTo(node, entrance) <= 75` and returns a typed `AppError` with a
specific message otherwise. The city payload includes `entrance` only for
nodes that set it.

### Phase 5: creator layer

`glyphShareCard.ts` renders on canvas with the same primitives as
`shareCard.ts`: ground, grain, the glyph in ink with the outline pass, the
Glyph_Name in Funnel Display, the Brand_Line and `APP_DOMAIN`. It shares
through the Web Share API with the image file, falling back to download only
where the platform allows it. Acquisition_Source: the landing reads `ref`,
stashes it in `safeStorage` with the same pattern as share links, and sign-up
writes it once to the user record (`acquisitionSource`, enum). Usage events
add it as a dimension.

## Correctness properties

Tagged `Feature: GlyphCity rebrand, Property N: <desc>`, fast-check, min 100
runs, block-statement predicates.

1. **Cone invariance.** For every `NodeState` and category, the computed
   beam height, top width, opacity, glyph size, gradient stops and outline
   width equal the pinned values.
2. **Label honesty.** For any pulse score and presence count, the displayed
   label's rank is less than or equal to the band rank from
   `pulse-decay.ts`, and presence zero yields "Be the first in" or "Quiet".
3. **Label parity.** Backend `PLAIN_SCALE_EN` and web `en.json` state keys are
   equal.
4. **No description leak.** For any catalog with random description strings,
   no consumer screen renders a description substring.
5. **Accessible name completeness.** For any node, archetype and state,
   `accessibleNodeName` contains venue name, category word, Glyph_Name and a
   state word or the invite, and never a description.
6. **Projection.** For any heading and target, `project` returns null exactly
   when the relative angle exceeds half the FOV, and x is monotone in the
   relative angle.
7. **Cluster safety.** No two separate labels are closer in angle than the
   current heading accuracy floor.
8. **Ranking parity.** Point_Mode visible venues are an order-preserving
   subset of `vibeRank` output for the same inputs; distance never reorders.
9. **No persistence.** Point_Mode code paths make no API write and no
   storage write (spy test over a simulated session).
10. **Entrance bound.** The service accepts an entrance iff its distance to
    the node is at most 75 m.

## Testing

- Unit and property tests as above (Vitest, node default, jsdom per file for
  components). Sensors mocked; no camera, no WebGL.
- Contrast check script over token pairs in both themes.
- Brand literal guard script.
- Env validation tests (missing `AREA_CODE_FROM_EMAIL` crashes startup).
- Playwright: Brand_Name on four portals and sign-in on each new domain; card
  and detail show the Plain_Scale; profile shows "Your glyph" and no
  description; share link on `glyphcity.com/node/{slug}` opens the venue;
  Point_Mode with mocked `getUserMedia`, geolocation and orientation renders
  beams, a stack, and each fallback; axe criticals in light and dark.
- `go-live-check.ps1` against the new domains.
- Manual: two phones on a real street with three or more venues within 150 m,
  logging position and heading error, before the Point_Mode flag is turned on.
