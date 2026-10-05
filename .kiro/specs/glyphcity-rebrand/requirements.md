# Requirements Document

## Introduction

This app becomes **GlyphCity**, at `glyphcity.com`. Area Code stays as the
umbrella company: an Africa-first PR and marketing house whose brands are
GlyphCity (this app, marketing and PR for businesses), Volta Seek (artists and
DJs, a separate company owned by a partner) and a social platform (parked).
`areacode.co.za` becomes Area Code's own site, built in a separate repo.

Founder decisions (October 2026) shape this spec:

1. **The cone nodes are not redesigned.** Beam geometry, sizes, opacity,
   heartbeat tempo, the glyph outline pass and the six category colours stay
   as built in `apps/web/src/lib/markerBeam.ts`, `apps/web/src/hooks/useMapMarkers.ts`
   and `apps/web/src/components/ArchetypeGlyph.tsx`.
2. **The app names glyphs and never explains them.** Meaning is taught by
   creators on social media. Research: `reports/Glyph language learned off app.md`.
3. **The live-state scale is plain.** "Popping" and its siblings are retired
   from display. Research: `reports/Gen Z nightlife lingo South Africa.md`.
4. **A camera view lets a group on a street point at venues** and see each
   one's beam, glyph and live count. This spec ships the web version on GPS and
   compass. Building-accurate localization (ARCore Geospatial) needs the native
   app and is a follow-up spec.
5. **The app moves to `glyphcity.com`**; `areacode.co.za` is kept for the
   umbrella site. Accounts stay separate per brand. Area Code appears only in
   legal text, as the operating company.

There are no live consumer or venue accounts, so nothing is migrated: name,
domain and copy change as one hard switch, per `no-fallbacks-no-legacy.md`.

Phases:

- Phase 0: decisions, cone lock, brand constants.
- Phase 1: name and words.
- Phase 2: outdoor look and brand marks.
- Phase 3: domain cutover to `glyphcity.com`.
- Phase 4: Point_Mode camera view and entrance pins.
- Phase 5: creator layer and measurement.
- Phase 6: rules, verification and rehearsal.

Relationship to sibling specs: honours `constellation-mode`, `map-carousel`,
`vibe-ranked-browse`, `proof-of-demand` and `honest-presence-*`. It edits their
copy and styling, never their mechanics.

Out of scope: redesigning cone nodes or glyph icons; changing `vibeRank`; the
native ARCore camera; the Area Code umbrella site; the social platform; shared
accounts or single sign-on across Area Code brands; any data sharing with
Volta Seek; renaming internal identifiers (Requirement 1.7); any SMS or phone
path; any gets browse surface; any in-app legend, tutorial or glyph
description.

## Glossary

- **Brand_Name**: "GlyphCity". Used in store listings, legal text, emails and
  the wordmark.
- **Spoken_Name**: "Glyph". The home-screen label and casual copy. Never used
  alone in the interface to mean the app, because "glyph" there means the
  symbol.
- **Brand_Line**: "Check the beams."
- **Company_Name**: "Area Code", the operating company. Shown only in legal
  text.
- **Brand_Constants**: `packages/shared/constants/brand.ts`, the one home for
  `APP_NAME`, `SPOKEN_NAME`, `APP_DOMAIN`, `COMPANY_NAME` and `BRAND_LINE`.
- **Logo_Mark**: a cone node drawn flat: a solid circle on a beam fading
  upward, in ink. No archetype icon.
- **Glyph**: the archetype icon riding a cone node, and a user's own archetype.
  The interface calls it a glyph and shows its name. No description is shown
  in the consumer app.
- **Glyph_Name**: the archetype `name` from `packages/shared/constants/archetype-catalog.ts`.
- **Cone_Node**: the map marker built by `ensureBeamLayers` and
  `buildMarkerElement`: inverted cone, tip at the venue, glyph on the mouth.
- **Cone_Invariants**: `BEAM_HEIGHT`, `CONE_TOP`, `CONE_CLIP`, `BEAM_OPACITY`,
  `GLYPH_SIZE`, `STATE_CONFIG`, `PULSE_TEMPO`, `NODE_CATEGORY_HEX`, the beam
  gradient stops and the glyph outline rule (`round(size * 0.12)`).
- **State_Label**: the displayed word for a `NodeState`. The ids (`dormant`,
  `quiet`, `active`, `buzzing`, `popping`) do not change.
- **Plain_Scale**: dormant shows no State_Label and the invite "Be the first
  in"; quiet "Quiet"; active "A little busy"; buzzing "Busy"; popping "Very
  busy".
- **Outdoor_Palette**: day ground Lichen `#EDF0E8`, night ground Veld night
  `#090E0C`, Bush ink `#13211B`, Bone `#E7EDE6`, Fynbos `#7E8B80`, Dawn and
  Dusk sky gradients, Spruit (water) and Koppie (parks).
- **Point_Mode**: the web camera view. Camera feed plus venue beams placed by
  GPS position and compass heading.
- **Entrance_Pin**: an optional per-venue coordinate for the front door, set
  by the owner, used by Point_Mode in place of the node coordinate.
- **Acquisition_Source**: how a consumer first arrived: `creator`, `share`,
  `qr`, `organic`. Stored once on the user record. Not a Venue_Open source.
- **Glyph_Codex**: the creator brief. Fixed canon (names, icons, colour means
  category, beam means live presence) and an open layer creators interpret.

## Requirements

### Requirement 1: One name everywhere a person can see it

**User Story:** As a consumer or owner, I want every screen, email, link and
store listing to say GlyphCity, so that the brand I hear about is the app I
open.

#### Acceptance Criteria

1. Brand_Constants SHALL export `APP_NAME = 'GlyphCity'`,
   `SPOKEN_NAME = 'Glyph'`, `APP_DOMAIN = 'glyphcity.com'`,
   `COMPANY_NAME = 'Area Code'` and `BRAND_LINE = 'Check the beams.'`.
2. EVERY user-facing surface in the four apps (titles, headers, auth screens,
   empty states, share text, notifications, legal screens, PWA manifest,
   `index.html` title and meta, Open Graph tags, share preview) and every
   email SHALL show Brand_Name by reading or interpolating Brand_Constants,
   never a literal.
3. THE legal content (`packages/shared/constants/legal-content.ts`) SHALL name
   Company_Name (the registered entity recorded in Phase 0) as the operator of
   GlyphCity through `COMPANY_NAME`. It SHALL be edited in place; no
   re-consent flow is built, because no accounts exist.
4. THE app SHALL show no Area Code endorsement ("by Area Code", co-branded
   marks) outside legal text.
5. THE PWA manifest SHALL set `name` to Brand_Name and `short_name` to
   Spoken_Name.
6. A guard test SHALL fail the build if "Area Code", `areacode.co.za`, or any
   Brand_Constants value appears as a literal in user-facing files (i18n,
   `apps/*/index.html`, manifests, email templates, legal content, share
   builders) outside Brand_Constants. Docs, specs and git history are
   excluded.
7. Internal identifiers SHALL NOT be renamed by this spec: the `@area-code/*`
   package scope, `AREA_CODE_*` env vars, DynamoDB table names, Lambda names,
   Secrets Manager paths and Cognito pool names. The founder records in
   Phase 0 whether a rename gets its own spec.
8. THE consumer interface SHALL NOT use Spoken_Name alone to mean the app
   inside a sentence that also refers to a user's or venue's glyph.

### Requirement 2: The live-state scale is plain and has one home

**User Story:** As a 24-year-old in Braamfontein, I want the app to tell me how
busy a place is in words that do not sound like an ad, so that I trust it.

#### Acceptance Criteria

1. THE State_Label for each `NodeState` SHALL come from one module in
   `packages/shared/constants/` used by the web app, the share snapshot
   (`backend/src/features/nodes/share-snapshot.ts`), the beam whisper
   (`apps/web/src/lib/whisperText.ts`) and the auth landing
   (`apps/web/src/screens/AuthLanding.tsx`). Hardcoded labels SHALL be removed.
2. THE labels SHALL be the Plain_Scale, delivered through i18n keys so wording
   can change without code changes.
3. A dormant venue SHALL show no State_Label; surfaces that need text SHALL use
   "Be the first in".
4. THE words "Popping", "Buzzing", "Active" and "Dormant" SHALL NOT appear as
   displayed State_Labels in any app, email or share preview.
5. "Filling up", "Winding down", "Quiet right now", "N here", "marked going",
   "Expected tonight", "Check in" and "Tonight" SHALL be kept unchanged.
6. THE honest-copy property tests SHALL be extended so that, for any presence
   input, the displayed label never ranks above the band the pulse score
   supports and a venue with zero presence never reads as busy.
7. No State_Label SHALL claim capacity ("Packed", "Full", "Rammed") while
   bands are absolute pulse scores (`backend/src/workers/pulse-decay.ts`).

### Requirement 3: Glyphs are named, never explained

**User Story:** As a consumer who heard about my glyph from a creator, I want
the app to show me its name so I can find more about it, without the app
lecturing me.

#### Acceptance Criteria

1. THE consumer app SHALL show the Glyph_Name beside a venue's glyph in venue
   detail and on the selected venue card, with no description.
2. THE profile SHALL show the user's own glyph with the label "Your glyph", the
   Glyph_Name and a "Share my glyph" control. Archetype descriptions and taste
   dimension bars SHALL NOT be shown in the consumer app.
3. THE consumer app SHALL NOT include a glyph legend, tutorial, onboarding
   explanation or tooltip that defines what a glyph means.
4. THE archetype `description` field SHALL remain in the catalog for the
   Glyph_Codex and internal tools, and SHALL NOT be rendered by any consumer
   component (enforced by test).
5. THE venue card and venue detail SHALL show the category word (for example
   "Nightlife") so category is never carried by colour alone (WCAG 2.2
   SC 1.4.1).
6. EVERY Cone_Node and glyph SHALL expose an accessible name composed of venue
   name, category word, Glyph_Name and State_Label or "Be the first in"
   (WCAG 2.2 SC 1.1.1). The accessible name SHALL NOT include a glyph
   description.
7. THE 15 glyph icons and Glyph_Names SHALL be frozen for this spec; any
   change needs a founder decision, because a learned code is costly to redraw.

### Requirement 4: Cone nodes do not change

**User Story:** As the founder, I want the rebrand to frame the beams, not
redraw them, so the signal people learn stays the same.

#### Acceptance Criteria

1. THE Cone_Invariants SHALL be unchanged by this spec.
2. A test SHALL pin the Cone_Invariants to their current values, so any change
   fails CI and needs an explicit spec.
3. THE six category colours SHALL keep their current light and dark values.
4. Beam brightness, height and tempo SHALL remain driven by pulse state only,
   per `constellation-mode.md`. No new token SHALL feed a Cone_Node.
5. THE Phosphor fill icons mapped in `ARCHETYPE_ICONS` SHALL stay the glyph
   source.

### Requirement 5: Outdoor look and brand marks

**User Story:** As someone who loves open-air events, I want the app to feel
like being outside at dusk, so that it feels alive rather than corporate.

#### Acceptance Criteria

1. THE shared tokens (`packages/shared/tokens.css`) SHALL be replaced in place
   with the Outdoor_Palette for light and dark themes. The glacier and slate
   accent, `--accent-gradient` and `--cta-gradient` SHALL be removed. Primary
   actions SHALL use ink on ground (inverted in dark).
2. Interface chrome SHALL carry no saturated colour. Saturated colour SHALL
   appear only on Cone_Nodes, glyphs, the small state cone beside a venue name
   and semantic states (success, warning, danger).
3. Text and control colours SHALL meet WCAG 2.2 AA contrast in both themes,
   verified by an automated check over the token pairs.
4. THE existing noise overlay in `apps/web/src/app.css` SHALL be retuned to the
   new grain, not duplicated. Grain SHALL be decorative and SHALL NOT reduce
   text contrast below 4.5:1.
5. THE venue detail header and the auth landing SHALL render a Dawn (light)
   or Dusk (dark) sky with a ridge line, behind the venue's own Cone_Node.
6. Type SHALL be Funnel Display (wordmark, headings, live counts), Funnel Sans
   (interface) and Geist Mono (labels, codes) across all four apps, replacing
   DM Sans, with system fallback stacks.
7. THE wordmark SHALL be "glyphcity" in Funnel Display (lowercase), in ink.
8. THE Logo_Mark SHALL be used for the favicon, app icons, splash, PWA icons,
   the Map tab icon and the default OG image, generated from one SVG source in
   `packages/shared`.
9. THE Brand_Line SHALL appear on the auth landing, share cards and the
   default OG image, and nowhere in functional UI (buttons, labels, states).
10. Styling rules in `rules/code-style.md` SHALL hold: CSS variables only, flex
    only in shared components, 44px targets, `dvh` on the map, safe areas.

### Requirement 6: The map looks like terrain

**User Story:** As a consumer at city zoom, I want the map to feel like real
ground (water, parks, hills), so the beams rise out of a place, not a grid.

#### Acceptance Criteria

1. THE map SHALL keep the Mapbox base styles and apply Outdoor_Palette paint
   overrides for background, water (Spruit) and park and landuse (Koppie)
   layers on style load, for both themes.
2. THE map SHALL add a contour line layer from the Mapbox terrain vector
   tileset below roads and labels, at low opacity, hidden below Embers zoom.
3. THE `ATMOSPHERE` config in `apps/web/src/hooks/useMapInit.ts` SHALL be
   retuned: dark uses a dusk horizon (ember glow under a near-black sky with
   stars), light uses a dawn horizon (peach under pale blue). Buildings move
   toward the Outdoor_Palette.
4. Cone_Nodes SHALL render above every new layer, and their colours SHALL be
   unaffected by fog or lighting changes.
5. THE map SHALL keep its current performance budget; the contour layer SHALL
   be disabled when `prefers-reduced-data` or a low-end device check is set,
   and the founder SHALL confirm the Mapbox billing impact in Phase 0.

### Requirement 7: Domain cutover to glyphcity.com

**User Story:** As a consumer, I want every link, QR code and sign-in to work on
glyphcity.com from day one.

#### Acceptance Criteria

1. THE apps SHALL be served at `glyphcity.com` (consumer, with `www`),
   `business.glyphcity.com`, `staff.glyphcity.com` and `admin.glyphcity.com`
   through the existing `infra/modules/amplify-domain` module.
2. THE API custom domain, media CDN domain, CORS origins
   (`backend/src/shared/security/origins.ts` and Terraform), WAF, RUM,
   Cognito callback and logout URLs (Hosted UI and Google), Spotify redirect
   URI, VAPID subject, SES sending identity (with DKIM and SPF), alert email
   and `AREA_CODE_WEB_URL` / `AREA_CODE_BUSINESS_URL` / `BUSINESS_APP_URL`
   values SHALL move to `glyphcity.com` through Terraform and the existing
   scripts, never by hand.
3. Masking defaults touched by the cutover (for example
   `process.env['AREA_CODE_FROM_EMAIL'] ?? 'noreply@areacode.co.za'` in
   `ses.ts`) SHALL be removed and the variables validated at startup, per
   `no-fallbacks-no-legacy.md`.
4. THE share route, sitemap, robots, canonical URLs and share text SHALL use
   `glyphcity.com`.
5. THE cutover SHALL be a hard switch for the app. Every app use of
   `areacode.co.za` (Amplify domain associations, API and CDN aliases, app
   certificates, Cognito URLs, CORS origins, the app's SES sender, scripts)
   SHALL be removed in the same change, with no redirect, no dual-domain
   period and no compatibility path. Every QR code SHALL be generated on
   `glyphcity.com`; the QR parser keeps accepting path-only payloads as it
   does today.
6. THE `areacode.co.za` Route53 zone and any records not used by the app (for
   example mail) SHALL be kept for Area Code's own site. The founder records
   in Phase 0 which records stay.
7. THE cutover SHALL follow `terraform plan` then `deploy-serverless.ps1`, and
   `go-live-check.ps1` SHALL pass against the new domains.

### Requirement 8: Point_Mode camera view (web)

**User Story:** As one of four friends on Fox Street who cannot decide, I want
to hold up my phone and see which door has the beam and how many people are
inside, so that we pick in seconds.

#### Acceptance Criteria

1. THE map SHALL offer a camera control that opens Point_Mode. Point_Mode SHALL
   show the rear camera feed with Cone_Nodes for venues in the field of view,
   placed by the device's GPS position and compass heading.
2. Each venue in view SHALL show its Cone_Node (same Cone_Invariants and
   pulse tempo, scaled by distance) and a label with venue name and "N here"
   or "Be the first in". Order and visibility SHALL follow `vibeRank` and map
   membership; distance SHALL only scale size.
3. Point_Mode SHALL show venues within `POINT_MODE_RADIUS_METRES` (default 250,
   founder decision) and SHALL render at most `RECOMMENDED_LIMIT` beams.
4. Tapping a beam or label SHALL set the Active_Venue in `selectionStore`, dim
   other beams to 40% as in Constellation, and open a card with glyph,
   State_Label, count, category word, Glyph_Name, Tonight line, "Check in"
   and "Share". Check-in SHALL use the existing proximity flow unchanged.
5. WHEN two or more venues are closer together in bearing than the current
   heading accuracy allows to separate, THE app SHALL show them as one stacked
   label listing each venue, never guessing one door.
6. WHEN GPS accuracy is worse than `POINT_MODE_MAX_GPS_ACCURACY_METRES`
   (default 35) or compass accuracy is unavailable or worse than 25 degrees,
   THE app SHALL show "Point mode needs a clearer signal" with a control back
   to the map, and SHALL NOT place beams.
7. Camera frames SHALL never leave the device and SHALL never be stored.
   Position and heading SHALL be used for placement only and never persisted
   or sent, per `honest-presence.md` rule 6. The card SHALL say "Camera stays
   on your phone".
8. Permission requests (camera, location, motion on iOS) SHALL be triggered by
   the user's tap, each with a specific denial state and a route back to the
   map. No permission SHALL be requested on map load.
9. Point_Mode SHALL respect `prefers-reduced-motion` (static beams), keep 44px
   targets, and expose the in-view venues as a text list for screen readers.
10. Point_Mode SHALL be behind a feature flag (`VITE_FLAG_POINT_MODE`), off by
    default, added to the closure checks and `rules/tech.md`.

### Requirement 9: Entrance pins

**User Story:** As an owner, I want to put my pin on my front door, so that a
group on the street sees my beam on my entrance, not the building next door.

#### Acceptance Criteria

1. THE business node editor SHALL let an owner set an optional Entrance_Pin by
   dragging a marker on a map, within 75 m of the node coordinate.
2. THE node record SHALL store `entrance: { lat, lng }` validated by Zod; the
   service SHALL reject a pin further than 75 m from the node.
3. Point_Mode SHALL use the Entrance_Pin when set, else the node coordinate.
4. THE map, ranking, membership and check-in radius SHALL NOT read the
   Entrance_Pin.

### Requirement 10: Creator layer support

**User Story:** As a creator explaining glyphs on TikTok, I want my audience to
land in the app with something to share back, so the language spreads.

#### Acceptance Criteria

1. THE profile SHALL produce a "my glyph" share card image (1080 by 1350 and a
   WhatsApp-friendly 1200 by 630 preview) with the Glyph_Name, the glyph in
   ink, the Brand_Line and `APP_DOMAIN`. No description, no personal data
   beyond the user's chosen display name.
2. THE venue share card SHALL use the Outdoor_Palette, Plain_Scale and
   Brand_Line, through the existing `apps/web/src/lib/shareCard.ts` and the
   share route.
3. A first-visit `ref` query parameter SHALL map to an Acquisition_Source and
   be stored once on the user record at sign-up. It SHALL NOT be written to
   Venue_Open or change Found_Via.
4. `docs/brand/glyph-codex.md` SHALL record, per glyph: Glyph_Name, icon, one
   line essence, music cues, three "this is them" and three "this is not them"
   signs, and the fixed canon (names, colour means category, beam means real
   live presence). Archetypes SHALL NOT be paired with race.
5. "The Township Royal" SHALL be introduced by township-rooted creators and
   tested with that audience before paid scaling (Phase 0 decision).

### Requirement 11: Measure whether silence works

**User Story:** As the founder, I want to know if people who never saw a
creator video can still use the map, so I add a cue only when evidence says so.

#### Acceptance Criteria

1. THE usage events for map-to-detail, glyph tap to detail to check-in, and
   detail "probing" (opened and closed within 2 s) SHALL carry the user's
   Acquisition_Source.
2. THE admin app SHALL show these funnels split by Acquisition_Source.
3. THE decision rule SHALL be recorded: IF non-creator users trail creator
   users by more than an agreed margin on map-to-detail or Day 1 retention for
   two consecutive weeks, THEN the next cue (glyph name on the browse card)
   is proposed to the founder.
4. A sort test of the Plain_Scale (20 to 40 people per age band, per city)
   SHALL be run before launch; IF people do not order the words almost
   unanimously, THEN wording SHALL be revisited before ship.

### Requirement 12: Rules, docs and verification

**User Story:** As the team, I want the rules and tests to carry the new name
and the new language rules, so the next change does not undo them.

#### Acceptance Criteria

1. `rules/product.md` SHALL describe GlyphCity at `glyphcity.com` as an Area
   Code brand. A new rule `rules/glyph-language.md` SHALL state: name glyphs,
   never explain them; colour lives on the map; plain State_Labels;
   Cone_Invariants are frozen. `pnpm sync:rules` SHALL regenerate `CLAUDE.md`
   and mirrors.
2. `docs/DEPLOY.md` and `docs/RUNBOOK.md` SHALL reference the new domains,
   including the manual Google OAuth console checklist.
3. `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format:check`,
   `pnpm guard:serverless` and the web build SHALL pass.
4. Playwright SHALL cover: Brand_Name on all four portals and sign-in on each
   new domain, Plain_Scale on the card and detail, no glyph description in the
   consumer app, profile glyph share, Point_Mode fallback states (with mocked
   sensors), and axe criticals on new screens in both themes.
5. No new AWS resource types SHALL be added. Point_Mode runs on the device;
   domain work re-points existing Route53, ACM, CloudFront, SES and Cognito
   resources.
