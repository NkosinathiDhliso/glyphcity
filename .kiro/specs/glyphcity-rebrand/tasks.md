# Implementation Plan: GlyphCity Rebrand

## Overview

Seven phases. Phase 0 records decisions, locks the cone nodes and creates the
brand constants. Phases 1 and 2 can run in parallel after Phase 0. Phase 3
(domain) needs the registrar and DNS answers from 0.1. Phase 4 (Point_Mode)
ships behind a flag that stays off until the street rehearsal in Phase 6
passes. No new AWS resource types at any step.

Every task references its requirement. Property tests use fast-check, min 100
runs, block-statement predicates, tagged
`Feature: GlyphCity rebrand, Property N: <desc>`.

## Tasks

### Phase 0: decisions, cone lock, brand constants

- [x] 0. Founder decisions and guards (R1, R4, R6.5, R7, R8.3, R10.5, R11)
  - [x] 0.1 Record decisions in `docs/decisions/glyphcity-rebrand.md`
    - Registrar and DNS owner for `glyphcity.com`; registered Area Code
      entity name for legal text; trademark search result for GlyphCity;
      which `areacode.co.za` records stay for the umbrella site; internal
      identifiers stay or get their own rename spec; Mapbox billing impact of
      the contour layer; `POINT_MODE_RADIUS_METRES`; Township Royal community
      test plan; Plain_Scale sort test plan and pass bar; silence
      decision-rule margin
    - Repo housekeeping (founder, on GitHub): this repo renamed to
      `glyphcity`, local remote updated, Amplify builds confirmed after the
      rename
    - _Requirements: 1.3, 1.7, 6.5, 7.1, 7.6, 8.3, 10.5, 11.3, 11.4_
  - [x] 0.2 Pin the Cone_Invariants
    - `apps/web/src/lib/__tests__/cone-invariants.test.ts`: assert current
      `BEAM_HEIGHT`, `CONE_TOP`, `CONE_CLIP`, `BEAM_OPACITY`, `GLYPH_SIZE`,
      `STATE_CONFIG`, `PULSE_TEMPO`, `NODE_CATEGORY_HEX`, gradient stops and
      outline rule; export the constants needed without changing values
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 0.3 Write property test for cone invariance
    - Property 1: computed beam and glyph metrics equal pinned values for every
      state and category
    - _Requirements: 4.1, 4.2_
  - [x] 0.4 `packages/shared/constants/brand.ts` with `APP_NAME`,
        `SPOKEN_NAME`, `APP_DOMAIN`, `COMPANY_NAME`, `BRAND_LINE`
    - _Requirements: 1.1_
  - [x] 0.5 `scripts/check-brand-strings.mjs` guard wired into `pnpm test`
    - _Requirements: 1.6_

### Phase 1: name and words

- [x] 1. Name (R1)
  - [x] 1.1 Inventory every user-facing "Area Code" and `areacode.co.za`
        string (about 740 hits in 206 files); list user-facing vs internal in
        the decisions doc
    - _Requirements: 1.2, 1.7_
  - [x] 1.2 Replace user-facing strings in all four apps via Brand_Constants:
        titles, headers, auth, empty states, notifications, generated
        `index.html` title and meta, OG tags, manifests (`name` GlyphCity,
        `short_name` Glyph)
    - _Requirements: 1.2, 1.5, 1.8_
  - [x] 1.3 Emails and digest copy (`shared/email/ses.ts`, `features/reports/`)
        read Brand_Constants; existing honest-copy tests stay green
    - _Requirements: 1.2_
  - [x] 1.4 Legal content edited in place: GlyphCity operated by
        `COMPANY_NAME`; no endorsement elsewhere; no re-consent flow
    - _Requirements: 1.3, 1.4_
- [x] 2. Plain_Scale (R2)
  - [x] 2.1 `packages/shared/constants/state-labels.ts` with
        `STATE_LABEL_KEY` and `PLAIN_SCALE_EN`; add keys to `en.json`
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.2 Move `share-snapshot.ts`, `whisperText.ts` and `AuthLanding.tsx`
        onto the module; remove the literals and the AuthLanding state icons
    - _Requirements: 2.1, 2.4_
  - [x] 2.3 Card, detail, feed and any other state readout use the module;
        dormant renders "Be the first in"
    - _Requirements: 2.3, 2.5_
  - [x] 2.4 Write property test for label honesty
    - Property 2: label rank never above the pulse band; zero presence never
      busy
    - _Requirements: 2.6, 2.7_
  - [x] 2.5 Write property test for label parity
    - Property 3: backend `PLAIN_SCALE_EN` equals web `en.json` state keys
    - _Requirements: 2.1_
  - [x] 2.6 Update existing tests that assert old labels
        (`whisperText.test.ts`, share snapshot and route tests)
    - _Requirements: 2.4_
- [x] 3. Glyphs named, never explained (R3)
  - [x] 3.1 Glyph_Name under the glyph on the selected `VenueCard` and in
        `NodeDetailContent`; category word on both
    - _Requirements: 3.1, 3.5_
  - [x] 3.2 `ProfileScreen` (web) and mobile profile tab: "Your glyph",
        glyph in ink, Glyph_Name, "Share my glyph"; remove description and
        taste bars from consumer surfaces
    - _Requirements: 3.2, 3.3_
  - [x] 3.3 `packages/shared/lib/accessibleNodeName.ts`; glyph hit pad in
        `useMapMarkers.ts` gets `role="button"` and the label; marker visuals
        unchanged
    - _Requirements: 3.6, 4.1_
  - [x] 3.4 Write property test for no description leak
    - Property 4: random catalog descriptions never render in consumer screens
    - _Requirements: 3.3, 3.4_
  - [x] 3.5 Write property test for accessible name completeness
    - Property 5: name has venue, category word, Glyph_Name, state or invite,
      never a description
    - _Requirements: 3.6_

### Phase 2: outdoor look and brand marks

- [ ] 4. Tokens, grain, type (R5)
  - [x] 4.1 Edit `packages/shared/tokens.css` in place to the Outdoor_Palette
        (table in design); remove glacier accent, accent and CTA gradients;
        `--accent` becomes ink; node tokens untouched
    - _Requirements: 5.1, 5.2, 4.3_
  - [x] 4.2 Retune the `body::after` noise in `apps/web/src/app.css`; remove
        `gradientDrift`; apply the same in business, staff, admin `app.css`
    - _Requirements: 5.4_
  - [x] 4.3 Swap DM Sans for Funnel Display, Funnel Sans and Geist Mono in all
        four `index.html` files, font tokens and Tailwind config
    - _Requirements: 5.6_
  - [x] 4.4 Sweep components that referenced removed tokens; primary buttons
        become ink on ground with `active:scale-95`
    - _Requirements: 5.1, 5.10_
  - [-] 4.5 `SkyHeader.tsx`: dawn or dusk gradient, ridge, stars in dark, the
    venue's own Cone_Node via the shared marker builder; used in venue
    detail and the auth landing
    - _Requirements: 5.5, 4.1_
- [ ] 5. Brand marks (R5.7 to R5.9)
  - [~] 5.1 `packages/shared/assets/logo-mark.svg` and the render script for
    favicon, PWA icons, apple-touch, splash and default OG image
    - _Requirements: 5.8_
  - [~] 5.2 Wordmark on the auth landing and headers; Map tab icon
    - _Requirements: 5.7, 5.8_
  - [~] 5.3 Brand_Line on auth landing, share cards and OG image only
    - _Requirements: 5.9_
- [x] 6. Map terrain (R6)
  - [x] 6.1 `applyOutdoorPaint(map, theme)` on `style.load` for background,
        water, landuse and park layers
    - _Requirements: 6.1_
  - [x] 6.2 `addContours(map)` from `mapbox-terrain-v2`, below roads, hidden
        below `MIN_MARKER_ZOOM`, disabled on reduced data or low-end check
    - _Requirements: 6.2, 6.5_
  - [x] 6.3 Retune `ATMOSPHERE` (dusk and dawn values in design); update
        `useMapInit` tests
    - _Requirements: 6.3_
  - [x] 6.4 Test that venue markers remain DOM markers above the canvas and
        carry no fog or light styling
    - _Requirements: 6.4, 4.4_
- [ ] 7. Contrast checks (R5.3)
  - [~] 7.1 Contrast script over token pairs, light and dark, run in CI
    - _Requirements: 5.3_
  - [~] 7.2 Muted tone restricted to labels at 11px uppercase mono or larger
    (lint rule or test over component classes)
    - _Requirements: 5.3_

### Phase 3: domain cutover

- [-] 8. glyphcity.com (R7)
  - [x] 8.1 Terraform: Route53 zone, ACM certs (us-east-1 and regional), SES
        identity with DKIM and MAIL FROM
    - _Requirements: 7.2_
  - [x] 8.2 Amplify domain associations for four apps via `amplify-domain`;
        API custom domain and CDN alias on the new zone
    - _Requirements: 7.1, 7.2_
  - [x] 8.3 Cognito callback and logout URLs, Hosted UI domains; Google OAuth
        console checklist in `docs/DEPLOY.md`; Spotify redirect URI
    - _Requirements: 7.2_
  - [x] 8.4 CORS lists in Terraform and `backend/src/shared/security/origins.ts`
        switched together; WAF and RUM domains
    - _Requirements: 7.2_
  - [x] 8.5 Env values in Terraform and `update-all-amplify-apps.ps1`;
        remove masking defaults in `ses.ts` and validate in `shared/config/env.ts`;
        update `rules/tech.md` and closure checks
    - _Requirements: 7.2, 7.3_
  - [x] 8.6 Share route, sitemap, robots, canonical URLs, share text and QR
        generation (`FirstGetIssuer`, business QR) on `glyphcity.com`
    - _Requirements: 7.4_
  - [x] 8.7 Remove every app use of `areacode.co.za` (Amplify domains, API and
        CDN aliases, app certs, Cognito URLs, the app's SES sender, origins,
        scripts) in the same change; no redirect; keep the zone and the
        records listed in 0.1; QR parser keeps path-only acceptance
    - _Requirements: 7.5, 7.6_
  - [~] 8.8 `terraform plan`, `deploy-serverless.ps1 -Environment prod`,
    `update-all-amplify-apps.ps1`; `go-live-check.ps1` green on new domains
    - _Requirements: 7.7_

### Phase 4: Point_Mode and entrance pins

- [x] 9. Geometry core (R8)
  - [x] 9.1 `packages/shared/lib/pointMode/geometry.ts`: `bearingTo`,
        `distanceTo`, `relativeAngle`, `project`, `depthScale`, `groundY`
    - _Requirements: 8.1, 8.2_
  - [x] 9.2 Write property test for projection
    - Property 6: null exactly outside half FOV; x monotone in relative angle
    - _Requirements: 8.1_
  - [x] 9.3 `cluster.ts` stacking by heading accuracy
    - _Requirements: 8.5_
  - [x] 9.4 Write property test for cluster safety
    - Property 7: no two labels closer in angle than the accuracy floor
    - _Requirements: 8.5_
  - [x] 9.5 `accuracy.ts` gate for GPS and heading thresholds
    - _Requirements: 8.6_
- [-] 10. Sensors and screen (R8)
  - [x] 10.1 `usePointModeSensors`: camera, position watch, heading with iOS
        permission in the tap; cleanup on unmount and hidden tab
    - _Requirements: 8.7, 8.8_
  - [x] 10.2 `PointModeScreen`: video, DOM markers via the shared builder at
        `depthScale`, glass labels, selection card, close to map
    - _Requirements: 8.1, 8.2, 8.4_
  - [x] 10.3 Selection writes `selectionStore`; others dim to 0.4; check-in
        via existing proximity flow
    - _Requirements: 8.4_
  - [x] 10.4 Fallback states table from design, each with a route back
    - _Requirements: 8.6, 8.8_
  - [x] 10.5 Reduced motion, 44px targets, screen-reader list of in-view
        venues
    - _Requirements: 8.9_
  - [x] 10.6 Camera control on the map top bar; `VITE_FLAG_POINT_MODE` off by
        default; closure allowlist and `rules/tech.md`
    - _Requirements: 8.1, 8.10_
  - [~] 10.7 Write property test for ranking parity
    - Property 8: visible venues are an order-preserving subset of `vibeRank`
    - _Requirements: 8.2_
  - [~] 10.8 Write property test for no persistence
    - Property 9: simulated session makes no API or storage write
    - _Requirements: 8.7_
- [x] 11. Entrance pins (R9)
  - [x] 11.1 Node schema and service: `entrance { lat, lng }`, 75 m rule,
        typed `AppError` message
    - _Requirements: 9.1, 9.2_
  - [x] 11.2 Write property test for entrance bound
    - Property 10: accepted iff distance at most 75 m
    - _Requirements: 9.2_
  - [x] 11.3 `NodeEditorPanel` drag marker with 75 m circle
    - _Requirements: 9.1_
  - [x] 11.4 City payload carries `entrance` when set; Point_Mode prefers it;
        map, ranking, membership and check-in ignore it (test)
    - _Requirements: 9.3, 9.4_

### Phase 5: creator layer and measurement

- [ ] 12. Share cards (R10)
  - [~] 12.1 `glyphShareCard.ts` on `shareCard.ts` primitives; 1080 by 1350
    and 1200 by 630; Brand_Line and `APP_DOMAIN`; Web Share with file
    - _Requirements: 10.1_
  - [~] 12.2 Venue share card restyled with Outdoor_Palette, Plain_Scale and
    Brand_Line
    - _Requirements: 10.2_
- [x] 13. Acquisition_Source (R10.3, R11)
  - [x] 13.1 Landing reads `ref`, stashes via `safeStorage`; sign-up writes
        `acquisitionSource` once; not written to Venue_Open or Found_Via
    - _Requirements: 10.3_
  - [x] 13.2 Usage events for map-to-detail, glyph funnel and probing carry
        the source
    - _Requirements: 11.1_
  - [x] 13.3 Admin funnel view split by source; decision rule recorded
    - Property 11: the silence verdict reads only complete weeks, never
      `unknown`, and proposes only when every read week trails
    - _Requirements: 11.2, 11.3_
- [x] 14. Glyph_Codex (R10.4)
  - [x] 14.1 `docs/brand/glyph-codex.md`: per glyph name, icon, essence, music
        cues, is and is-not signs; fixed canon; no pairing with race
    - _Requirements: 10.4_

### Phase 6: rules, verification and rehearsal

- [ ] 15. Rules and docs (R12.1, R12.2)
  - [x] 15.1 `rules/product.md` to GlyphCity as an Area Code brand; new
        `rules/glyph-language.md`; `pnpm sync:rules`
    - _Requirements: 12.1_
  - [~] 15.2 `docs/DEPLOY.md`, `docs/RUNBOOK.md` domain references
    - _Requirements: 12.2_
- [ ] 16. Verification (R11.4, R12)
  - [~] 16.1 Plain_Scale sort test run and recorded against the 0.1 pass bar
    - _Requirements: 11.4_
  - [~] 16.2 Playwright: brand on four portals and sign-in on new domains,
    Plain_Scale, profile glyph, no description, Point_Mode with mocked
    sensors and fallbacks, axe in both themes
    - _Requirements: 12.4_
  - [~] 16.3 Street rehearsal: two phones, three or more venues within 150 m,
    log position and heading error; flag stays off if beams land on the
    wrong door more than the agreed rate
    - _Requirements: 8.5, 8.6_
  - [~] 16.4 Full gate: `pnpm typecheck`, `pnpm test`, `pnpm lint`,
    `pnpm format:check`, `pnpm guard:serverless`, web build
    - _Requirements: 12.3, 12.5_
