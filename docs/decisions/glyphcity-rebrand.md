# Decision: GlyphCity rebrand (domain, entity, thresholds, test plans)

Date: 2026-10-04

Spec: glyphcity-rebrand, task 0.1. Requirements 1.3, 1.7, 6.5, 7.1, 7.6, 8.3,
10.5, 11.3, 11.4. Related: `.kiro/steering/no-fallbacks-no-legacy.md`,
`.kiro/steering/serverless-only.md`, `.kiro/steering/honest-presence.md`,
`.kiro/steering/no-sms-no-phone-auth.md`.

## Context

The app becomes GlyphCity at `glyphcity.com`. Area Code stays as the umbrella
company and is named only in legal text. The spec left eleven items as founder
decisions because each one changes what ships, who owns it, or what a test has
to prove. They are recorded here before any code lands so that later tasks have
one source and no task has to guess.

Items marked PENDING are not decided yet. Each names the owner and the point it
must be closed by. A PENDING item is a gate, not a default.

## Decisions

### 1. `glyphcity.com` registrar and DNS owner

- Registrar: Namecheap. The founder registered the domain and owns the
  registrar account.
- Authoritative DNS: a Terraform-managed Route53 hosted zone for
  `glyphcity.com`.
- Delegation: the founder sets the Route53 NS records at Namecheap. This is
  Phase 3, step 1, and blocks every later domain step (ACM, SES, Cognito,
  Amplify).

### 2. Legal entity for legal text

Area Code is a CIPC-registered company with two directors, the founder and a
partner, holding 50/50. The `areacode.co.za` domain is registered at GoDaddy in
the founder's name.

- Registered company name: PENDING.
- Registration number: PENDING.

The founder supplies both from the CIPC certificate before legal text ships
(task 1.4). Until then `COMPANY_NAME = 'Area Code'` in
`packages/shared/constants/brand.ts`.

### 3. Trademark search for GlyphCity

Clear, founder-reported. The founder reports the search came back clear and the
mark is the founder's.

### 4. `areacode.co.za` records

The founder delegated this choice. The zone stays for Area Code's own site. App
records go.

Keep:

- The hosted zone itself.
- Mail and verification records: MX, SPF TXT, DMARC, DKIM CNAMEs, and any
  domain-verification TXT (for example Google).
- Apex and `www`, reserved for the umbrella site.

Remove:

- Amplify app subdomains (consumer, business, staff, admin).
- The `api` and `cdn` aliases.
- ACM validation CNAMEs for app certificates.
- The app's SES identity and MAIL FROM records.
- Cognito custom domain records.

Rationale: mail and ownership proofs belong to the company and outlive any one
app, while every app record moves to `glyphcity.com` in the hard switch (R7.5).

Note for task 8.7: list the actual records from Terraform state and the Route53
zone before deleting anything. The lists above are categories, not an
inventory. Any record that fits neither list is flagged to the founder, not
deleted.

### 5. Internal identifiers

Stay as they are: the `@area-code/*` package scope, `AREA_CODE_*` env vars,
DynamoDB table names, Lambda names, Secrets Manager paths and Cognito pool
names. No rename spec is planned.

### 6. Mapbox billing impact of the contour layer

PENDING confirmation before prod. Not checked yet; the founder expects to
accept it.

- Task 6.2 builds the contour layer, gated off by `prefers-reduced-data` and
  the low-end device check.
- The founder checks the Mapbox usage dashboard after one week on prod and
  records the result here.

### 7. Point_Mode thresholds

| Constant                             | Value      |
| ------------------------------------ | ---------- |
| `POINT_MODE_RADIUS_METRES`           | 250        |
| `POINT_MODE_MAX_GPS_ACCURACY_METRES` | 35         |
| Heading accuracy limit               | 25 degrees |

250 is the spec default. Beyond these accuracy limits Point_Mode shows "Point
mode needs a clearer signal" and places no beams (R8.6).

### 8. The Township Royal community test plan

The founder delegated this choice.

- Introduction: only by township-rooted creators (Soweto, Tembisa, Umlazi,
  Khayelitsha), before any paid scaling.
- Audience test: at least 15 people from that audience per city.
- Pass: no one reads the glyph as mocking or racial, and most read it as
  aspirational.
- Fail: the founder decides on the name. The glyph stays frozen until then
  (R3.7).

Rationale: the people the name describes judge it first, and one reading as
mockery is enough to stop paid reach.

### 9. Plain_Scale sort test plan and pass bar

- Sample: 20 to 40 people per age band (18-24, 25-34, 35+) per city
  (Johannesburg, Cape Town, Durban).
- Task: each person orders five cards: "Be the first in", "Quiet", "A little
  busy", "Busy", "Very busy".
- Pass bar: at least 90% exact-order agreement in every band and every city.
- Fail: the wording is revisited before ship (R11.4). Results go in task 16.1.

### 10. Silence decision-rule margin

IF non-creator users trail creator users by more than 15 percentage points on
map-to-detail rate or Day 1 retention, for two consecutive weeks, THEN the next
cue (glyph name on the browse card) is proposed to the founder (R11.3).

How it is read (task 13.3):

- Map-to-detail is detail opens per venue tap (`venue_open` over
  `venue_selected`). Day 1 is a check-in within a day of signing up, the
  retention dashboard's definition.
- Non-creator means share, qr and organic pooled. Accounts from before the
  source was recorded (`unknown`) sit on neither side.
- Weeks run Monday to Sunday, UTC, and count only once closed plus one day, so
  Sunday signups have their Day 1. Both weeks must trail on the same measure.
- The gap is rounded to one decimal before the comparison, so the verdict
  matches the number on screen. Exactly 15.0 points does not trail.
- No minimum sample size. Small weeks can trip the rule, which only proposes
  a cue; the founder reads the counts beside it before deciding.
- Code: `packages/shared/lib/silenceRule.ts`. Admin view: "By source".

## Repo housekeeping (founder, on GitHub)

PENDING founder action.

- [ ] Rename this repo to `glyphcity` on GitHub.
- [ ] Update the local remote (`git remote set-url origin <new url>`).
- [ ] Confirm Amplify builds run for all four apps after the rename.

## Consequences

- Task 0.4 writes `COMPANY_NAME = 'Area Code'` now. Task 1.4 cannot ship legal
  text until decision 2 is closed.
- Phase 3 cannot start until the NS delegation in decision 1 is set.
- Task 6.2 ships the contour layer behind its gates. Prod rollout stays open
  until decision 6 is confirmed.
- Task 8.7 deletes only records it has listed and matched against decision 4.
- Phase 4 code reads the values in decision 7 from one shared constants home.
- No internal identifier is renamed by any task in this spec.

## Brand string inventory (task 1.1)

Taken 2026-10-04 with `git grep --untracked -i -o -E 'area ?code'` (matches
"Area Code", "AreaCode", "area code", `areacode` and `areacode.co.za`).
Excluded: `node_modules`, `dist`, `.kiro/specs`, `.claude`, lockfiles and git
history. Hyphen and underscore forms (`@area-code/*`, `AREA_CODE_*`, table,
Lambda and secret names) are internal identifiers that stay (decision 5) and
are not counted. This section's own mentions are not counted either.

Each file sits in one group. A file with both copy and domain hits sits in the
group of its main change, with the split noted.

| Group                     | Files   | Hits    | Target tasks    |
| ------------------------- | ------- | ------- | --------------- |
| A. User-facing UI copy    | 71      | 275     | 1.2 to 1.4, 5.1 |
| B. Domain and infra       | 58      | 183     | 8.1 to 8.8      |
| C. Internal, stays (R1.7) | 43      | 71      | none            |
| D. Docs and rules         | 29      | 221     | 15.1, 15.2      |
| **Total**                 | **201** | **750** |                 |

### A. User-facing UI copy

| File                                                                                                                                                                                                                                                                                                          | Hits | Task      | Note                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------- | ----------------------- |
| `apps/web/index.html`                                                                                                                                                                                                                                                                                         | 31   | 1.2, 8.6  | 18 name, 13 domain      |
| `apps/web/public/manifest.webmanifest`                                                                                                                                                                                                                                                                        | 4    | 1.2       |                         |
| `apps/web/public/sw.js`                                                                                                                                                                                                                                                                                       | 2    | 1.2       | push title fallback     |
| `apps/web/src/i18n/locales/en.json`                                                                                                                                                                                                                                                                           | 7    | 1.2       |                         |
| `apps/web/src/screens/AuthLanding.tsx`                                                                                                                                                                                                                                                                        | 9    | 1.2, 8.6  | 3 name, 6 domain        |
| `apps/web/src/screens/PrivacyPolicyScreen.tsx`                                                                                                                                                                                                                                                                | 14   | 1.4       |                         |
| `apps/web/src/screens/TermsScreen.tsx`                                                                                                                                                                                                                                                                        | 18   | 1.4       |                         |
| `apps/web/src/screens/LeaderboardScreen.tsx`                                                                                                                                                                                                                                                                  | 2    | 1.2       | share text              |
| `apps/web/src/components/NodeDetailContent.tsx`                                                                                                                                                                                                                                                               | 4    | 1.2, 8.6  | 1 copy, 3 share/QR URL  |
| `apps/web/src/components/` GoingControl, NotificationPrimingSheet, ReconsentGate, StreamingSection                                                                                                                                                                                                            | 5    | 1.2       | 2, 1, 1, 1              |
| `apps/web/src/hooks/useCheckInFlow.ts`                                                                                                                                                                                                                                                                        | 3    | 1.2       | invalid QR toast        |
| `apps/web/src/main.tsx`                                                                                                                                                                                                                                                                                       | 1    | 1.2       | boot error screen       |
| `apps/web/src/lib/shareCard.ts`                                                                                                                                                                                                                                                                               | 4    | 1.2, 12.2 | wordmark, share URL     |
| `apps/business/index.html`, `src/i18n/locales/en.json`                                                                                                                                                                                                                                                        | 6    | 1.2       | 1, 5                    |
| `apps/business/src/screens/BusinessDashboard.tsx`                                                                                                                                                                                                                                                             | 2    | 1.2       | header                  |
| `apps/business/src/components/BoostScoreboardCard.tsx`                                                                                                                                                                                                                                                        | 2    | 1.2       | receipt fallback copy   |
| `apps/business/src/screens/panels/` DigestCard, SettingsPanel, StaffLeaderboardPanel                                                                                                                                                                                                                          | 3    | 1.2       | 1 each                  |
| `apps/business/src/lib/tonightSlot.ts`                                                                                                                                                                                                                                                                        | 1    | 1.2       | network error           |
| `apps/admin/index.html`, `src/screens/AdminDashboard.tsx`                                                                                                                                                                                                                                                     | 3    | 1.2       | 1, 2                    |
| `apps/staff/index.html`, `StaffHome.tsx`, `LapsedBusinessBanner.tsx`                                                                                                                                                                                                                                          | 3    | 1.2       | 1 each                  |
| `apps/staff/src/components/FirstGetIssuer.tsx`                                                                                                                                                                                                                                                                | 3    | 1.2, 8.6  | 2 copy, 1 domain        |
| `apps/mobile/app.config.ts`                                                                                                                                                                                                                                                                                   | 9    | 1.2, 8.7  | 2 name, 7 scheme/domain |
| `apps/mobile/src/i18n/locales/en.json`, `app/(tabs)/profile.tsx`                                                                                                                                                                                                                                              | 5    | 1.2       | 4, 1                    |
| `backend/src/shared/email/ses.ts`                                                                                                                                                                                                                                                                             | 14   | 1.3, 8.5  | 12 copy, 2 defaults     |
| `backend/src/features/reports/digest.ts`, `receipt-copy.ts`                                                                                                                                                                                                                                                   | 13   | 1.3       | 9, 4                    |
| `backend/src/features/notifications/service.ts`                                                                                                                                                                                                                                                               | 2    | 1.2, 8.5  | title, VAPID default    |
| `backend/src/features/nodes/share-preview.ts`                                                                                                                                                                                                                                                                 | 3    | 1.2, 8.6  | 2 copy, 1 OG image URL  |
| `backend/src/features/auth/service.ts`, `shared/cognito/client.ts`                                                                                                                                                                                                                                            | 2    | 1.2       | admin MFA labels        |
| `packages/shared/constants/legal-content.ts`, `legal.ts`                                                                                                                                                                                                                                                      | 24   | 1.4       | 23, 1                   |
| `packages/shared/components/RedemptionCodeCard.tsx`                                                                                                                                                                                                                                                           | 2    | 1.2       | 1 copy, 1 comment       |
| `scripts/generate-og-image.mjs`, `generate-pwa-assets.mjs`, `gen-web-icons.ps1`, `brand/areacode-logo.png`                                                                                                                                                                                                    | 8    | 5.1       | 2, 3, 2, 1              |
| Tests asserting copy, updated with the source: `apps/business/**/__tests__` (7 files) 22, `apps/web/**/__tests__` (3) 4, `backend/src/features/business/__tests__` (5) 19, `backend/src/features/reports/__tests__` (6) 15, `ses.test.ts` 1, `RedemptionCodeCard.test.tsx` 4, e2e `lapsed-business.spec.ts` 1 | 66   | 1.2, 1.3  | 24 files                |

### B. Domain and infra

| File                                                                                                                                                                                                                                                                                                                                          | Hits | Task       | Note                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------- | ------------------------------------------------ |
| `infra/environments/prod/main.tf`                                                                                                                                                                                                                                                                                                             | 52   | 8.1 to 8.5 | zones, certs, CORS, env                          |
| `infra/environments/dev/main.tf`                                                                                                                                                                                                                                                                                                              | 2    | 8.5        | alert email; SMS sender id                       |
| `infra/modules/` amplify-domain 1, cdn 2, cloudwatch-rum 3, waf 1                                                                                                                                                                                                                                                                             | 7    | 8.2, 8.4   | mostly examples in comments                      |
| `backend/src/shared/security/origins.ts`                                                                                                                                                                                                                                                                                                      | 5    | 8.4        |                                                  |
| `backend/src/shared/config/env.ts`                                                                                                                                                                                                                                                                                                            | 1    | 8.5        | masking default                                  |
| `backend/src/features/campaigns/unsubscribe.ts`                                                                                                                                                                                                                                                                                               | 2    | 8.5        | masking default                                  |
| `backend/src/features/business/service.ts`                                                                                                                                                                                                                                                                                                    | 6    | 8.6        | 4 QR URLs, dev email, 1 metric namespace (stays) |
| `backend/src/features/business/handler.ts`                                                                                                                                                                                                                                                                                                    | 1    | 8.7        | placeholder email                                |
| `backend/src/features/music/service.ts`, `streaming-oauth.ts`                                                                                                                                                                                                                                                                                 | 2    | 8.3        | Spotify redirect                                 |
| `apps/*/public/robots.txt` (4), `apps/web/public/sitemap.xml`                                                                                                                                                                                                                                                                                 | 9    | 8.6        | 5, 4                                             |
| `apps/business/src/screens/panels/CheckoutReturnBanner.tsx`                                                                                                                                                                                                                                                                                   | 1    | 8.7        | support email shown to user                      |
| `packages/shared/lib/imageCompression.ts`                                                                                                                                                                                                                                                                                                     | 1    | 8.7        | error copy names the domain                      |
| `packages/shared/lib/apiError.ts`, `mocks/mockRouter.ts`                                                                                                                                                                                                                                                                                      | 2    | 8.7        | comment, dev mock                                |
| `apps/web/src/` App, QrScannerSheet, SignInSheet, QrCheckIn, `lib/qrParser.ts` (2); `apps/mobile/app/qr/[nodeId]/[token].tsx`                                                                                                                                                                                                                 | 7    | 8.7        | comments only                                    |
| `scripts/go-live-check.ps1`                                                                                                                                                                                                                                                                                                                   | 15   | 8.8        |                                                  |
| `scripts/update-all-amplify-apps.ps1`                                                                                                                                                                                                                                                                                                         | 8    | 8.5        |                                                  |
| `scripts/qr/generate-qr-with-logo.py`                                                                                                                                                                                                                                                                                                         | 6    | 8.6        | URL and logo path                                |
| `scripts/apply-amplify-spa-rewrites.ps1`                                                                                                                                                                                                                                                                                                      | 4    | 8.7        |                                                  |
| `scripts/region-latency-probe.mjs`                                                                                                                                                                                                                                                                                                            | 2    | 8.7        |                                                  |
| `scripts/check-amplify-env-closure.mjs` and test                                                                                                                                                                                                                                                                                              | 2    | 8.5        |                                                  |
| `.env.example`                                                                                                                                                                                                                                                                                                                                | 5    | 8.5        |                                                  |
| `.github/workflows/ci.yml` 2, `release-health-gate.yml` 1                                                                                                                                                                                                                                                                                     | 3    | 8.7        | health URL, bot email                            |
| `tests/e2e/.env.example` 5, `playwright.config.ts` 4                                                                                                                                                                                                                                                                                          | 9    | 8.7, 16.2  | staging URLs                                     |
| Tests with domain fixtures, updated with the source: `backend/src/features/nodes/__tests__` (6 files) 14, `apps/web` tests (5) 6, `apps/business` checkout tests (2) 3, `backend/src/__tests__/e2e.test.ts` 3, `business-profile.test.ts` 2, `pii-scanner.property.test.ts` 1, `apiError.test.ts` 1, `packages/features/staff` preservation 1 | 31   | 8.6, 8.7   | 18 files                                         |

### C. Internal, stays

| File or set                                                                                                                                                        | Hits | Kind                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ----------------------------------- |
| `packages/shared/constants/brand.ts` and `brand.test.ts`                                                                                                           | 3    | `COMPANY_NAME`, the one home        |
| `scripts/check-brand-strings.mjs` and test                                                                                                                         | 10   | guard patterns and fixtures         |
| `apps/web/public/.well-known/` apple-app-site-association, assetlinks.json                                                                                         | 2    | bundle id `co.za.areacode.app`      |
| `checkinOutboxStore.ts`, `useCheckoutReturn.ts`, e2e `checkin-outbox.spec.ts`                                                                                      | 3    | storage keys                        |
| `MapboxAddressInput.tsx`, `nodes/service.ts`, `events/service.ts` and `events.test.ts`                                                                             | 4    | log prefix, User-Agent, metric name |
| `backend/src/scripts/seed-proof-of-demand-plan.ts`; e2e `support/env.ts`, `realtime.spec.ts`, `staff-management.spec.ts`                                           | 13   | `.invalid` and `.test` emails       |
| `scripts/` claim-demo-venues 7, seed-demo-venues 3, deploy-serverless .ps1 and .sh 2, sync-amplify-buildspecs 1, setup-github-oidc 1; `sonar-project.properties` 1 | 15   | ops banners, repo and project name  |
| `infra/modules/cognito-triggers/main.tf`, `infra/modules/sms/main.tf`                                                                                              | 2    | dead SMS paths, protected           |
| Code comments only (17 files: `features/check-in`, `reports/receipt.ts`, business panels, `attribution.ts`, `useTheme.ts`, `tokens.css`, and others)               | 19   | not shipped; edit with nearby work  |

### D. Docs and rules

| File or set                                                                                                                        | Hits | Task        |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------- |
| `rules/product.md` 5, `rules/discovery-dna-vibe-over-convenience.md` 1                                                             | 6    | 15.1        |
| Generated mirrors: `CLAUDE.md` 3, `.github/copilot-instructions.md` 9, `.cursor/rules` 10, `.windsurf/rules` 9, `.kiro/steering` 6 | 37   | 15.1 (sync) |
| `scripts/sync-ai-rules.mjs`                                                                                                        | 4    | 15.1        |
| `README.md`                                                                                                                        | 10   | 15.1        |
| `docs/DEPLOY.md` 11, `docs/RUNBOOK.md` 13                                                                                          | 24   | 15.2        |
| `docs/COGNITO_CUSTOM_DOMAIN_RUNBOOK.md` 21, `docs/GOOGLE_OAUTH_BRANDING.md` 21                                                     | 42   | 8.3         |
| `docs/UAT_CHECKLIST.md` 20, `UAT_PROOF_OF_DEMAND.md` 22, `PILOT_LAUNCH_CHECKLIST.md` 10, `PILOT_BRIEFING.md` 6, `PRIVACY.md` 4     | 62   | 15.2        |
| Point-in-time records: `GO_LIVE_CHECK_RESULT.md` 12, `GO_LIVE_AUDIT.md` 5, `decisions/*` 14, three other files 3                   | 34   | leave       |
| `tests/e2e/README.md`                                                                                                              | 2    | 16.2        |

### Flags

Guard coverage gaps for task 1.2. These user-facing files have brand literals
that `SCANNED_FILE_PATTERNS` in `scripts/check-brand-strings.mjs` does not
match, so the guard cannot see them (live count in brackets):

- Web: `AuthLanding.tsx` (7), `NodeDetailContent.tsx` (2),
  `LeaderboardScreen.tsx` (2), `GoingControl.tsx`, `NotificationPrimingSheet.tsx`,
  `ReconsentGate.tsx`, `StreamingSection.tsx`, `useCheckInFlow.ts`, `main.tsx`
  (1 each).
- Business: `BusinessDashboard.tsx` (2), `BoostScoreboardCard.tsx` (2),
  `DigestCard.tsx`, `SettingsPanel.tsx`, `StaffLeaderboardPanel.tsx`,
  `CheckoutReturnBanner.tsx`, `lib/tonightSlot.ts` (1 each).
- Admin: `AdminDashboard.tsx` (2). Staff: `FirstGetIssuer.tsx` (3),
  `StaffHome.tsx`, `LapsedBusinessBanner.tsx` (1 each). Mobile:
  `app/(tabs)/profile.tsx` (1).
- Shared and backend: `RedemptionCodeCard.tsx`, `imageCompression.ts`,
  `auth/service.ts` (TOTP issuer), `cognito/client.ts` (MFA device name)
  (1 each).
- Public files: `apps/*/public/robots.txt` and `apps/web/public/sitemap.xml`
  (8.6).

Covering all `.tsx` under `apps/*/src` and `packages/shared/components` is
simpler than a growing list; comment stripping already ignores the comment-only
files.

Other items for the founder or later tasks:

- `apps/mobile/app.config.ts` and `.well-known/*` carry the scheme `areacode`
  and bundle id `co.za.areacode.app`. No store app is published, so changing
  them now is free; later it means a new store listing. Founder call before
  8.7.
- `infra/modules/cognito-triggers` ("Your Area Code code is") and
  `infra/modules/sms` (`AREACODE` sender id) are dead phone-OTP paths
  protected by `no-sms-no-phone-auth.md`. Left untouched.
- CloudWatch namespaces `AreaCode/Business` and `AreaCode/Usage` are internal
  metric names; renaming breaks dashboards and alarms. Treated as identifiers
  that stay.
- `VITE_APP_SHARE_URL` defaults to `https://areacode.co.za` in `shareCard.ts`;
  the default moves to `APP_DOMAIN` in 8.6.
