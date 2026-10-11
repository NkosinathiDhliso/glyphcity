# Decision: north star alignment (order toggle, boosts, win-back campaigns)

Date: 2026-10-11

Spec: north-star-alignment, Requirement 8. Related: `rules/product.md`
"North star", `rules/discovery-dna-vibe-over-convenience.md`,
`rules/map-carousel.md`, `.kiro/specs/promoter-arrivals/requirements.md`.

## Context

`rules/product.md` names one north star: GlyphCity is the live map of which
rooms are actually busy. A feature stays if it makes the map more truthful
about who is in the room, or lets a venue pay for arrivals it can verify. The
north-star-alignment spec left three shipped features as founder gates because
each changes ranking or revenue. All three are recorded here.

## Decisions

### 1. Order toggle: Busy or My crowd

The founder's call: both orders are valid, and the guest chooses.

- One control on the browse strip header, two modes, no third:
  - **Busiest** (`busy`): aliveness first, taste second. Default. The
    label avoids "Busy", which is a live-state word.
  - **My crowd** (`crowd`): taste first, aliveness second. Today's
    `vibeRank` order.
- Below those two levels the order is unchanged: paid lever, live gets,
  distance, id. Distance stays last.
- The toggle changes order only. It never hides a room, never changes beam
  brightness, never changes map membership, never touches the Receipt.
- Stored locally for every visitor and on the user record once signed in.
  Unset reads as Busiest.
- Default is Busiest because that is the north star sentence. An introvert
  is served by the honest "Quiet" label and the My crowd order, not by
  hiding busy rooms.
- The Constellation top-20 cap picks by `vibeRank`, so which quiet venues
  survive the cap follows the mode. Brightness never does.

Follow-up spec: `vibe-order-toggle`. It adds the mode parameter to `vibeRank`,
the control, the preference, and updates
`discovery-dna-vibe-over-convenience.md` and `map-carousel.md` in the same
change so the rules and the code cannot disagree. Until it lands, `vibeRank`
is unchanged.

Property to carry: for every mode, every input set, and every pair of venues,
proximity never decides between venues that differ on either of the two top
levels.

### 2. Boosts: retire

A boost sells position for 2, 6 or 24 hours. It fails both tests: it does not
make the map more truthful, and it is not an arrival the venue can verify. It
also makes "paid or earned" ambiguous to the guest, and it collides with
promoter-claimed nights.

- The sale path is removed, not stubbed. The only caller is the business
  app, which changes in the same release, so a 410 would guard nothing
  (`no-fallbacks-no-legacy.md`). Route, `purchaseBoost`, floor check, admin
  floor editor, `BoostPanel`, scoreboard route and module all go.
- Boosts already bought run to their end (24 hours at most). Nothing is
  refunded by code.
- `BoosterPurchase` rows, their read routes and the admin
  `BoostPurchaseReport` stay readable.
- The webhook keeps accepting a boost-typed payment event for seven days
  after the sale stops, so a checkout paid just before still gets its audit
  row. Then that branch, `boostUntil`, `isBoostActive`,
  `setNodeBoostWindow` and `vibeRank` level 3a are removed, and the rules
  text drops "node boost".
- Revenue line that changes: per-boost one-time purchases. The sentence a
  venue hears instead: "Be on the map. Pay for arrivals."

### 3. Win-back campaigns: retire

A win-back campaign is a venue emailing guests who stopped coming. It fails
both tests and makes GlyphCity a mailing tool.

- There is no scheduled state in the code, so the cancel route guards
  nothing. Create, estimate, send and cancel routes, the send pipeline
  (`quota`, `dispatcher`, `sender`, `segment-resolver`, `eligibility`,
  `tier-gating`, `anonymize`), both workers, and the business
  `CampaignsPanel` are removed.
- List and get stay so a business can read its own past campaigns.
  `GET /v1/campaigns/unsubscribe` stays so a link already in an inbox
  still works. The in-app "Win-back offers" toggle and its
  `campaign-optout` routes go: they controlled mail that can no longer be
  sent. `COPTOUT#` rows and campaign rows stay.
- The dispatcher and sender Lambdas, their SQS queue and DLQ, leave
  Terraform in the same change. `AREA_CODE_CAMPAIGN_SEND_QUEUE_URL` and
  `AREA_CODE_CAMPAIGN_DISPATCHER_FUNCTION` leave `rules/tech.md` and the
  closure checks. `AREA_CODE_CAMPAIGN_UNSUB_SECRET` stays, because the
  unsubscribe link still verifies with it.
- Revenue line that changes: none directly; campaigns were a tier perk. The
  sentence a venue hears instead: "Tonight and a promoter are how you reach
  people. The map does the rest."

## Consequences

- Decision 1 is a follow-up spec (`vibe-order-toggle`), not a silent flip.
- Decisions 2 and 3 delete code; nothing is guarded or stubbed. Purchase
  rows, campaign rows and opt-out rows stay readable for audit and for a
  guest's recorded choice.
- `promoter-arrivals` Phase 2 waits on decision 2's first release, so a
  promoter's night is never sold twice.
