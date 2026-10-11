# Decision: promoter program (paid arrivals through a promoter's link)

Date: 2026-10-11

Status: decided, not built. A spec follows this record; no code lands before it.
Related: `docs/decisions/proof-of-demand.md`, `docs/decisions/map-membership.md`,
`rules/honest-presence.md`, `rules/no-fallbacks-no-legacy.md`,
`rules/dry-reuse-no-duplication.md`, `rules/serverless-only.md`.

## Context

Promoters already fill rooms in Johannesburg, Cape Town and Durban. They post a
link, guests show up, and the venue pays them by a count nobody can check. The
program puts that count on GlyphCity's existing measurement: a sourced
Venue_Open, the Away_Gate, the rotating venue QR and one Receipt. The venue pays
the promoter directly, the way it already does. GlyphCity counts and bills a
small fee. GlyphCity never holds money owed to someone else.

Each rule below was stress-tested for two things: can it be gamed so money goes
to the wrong person, and does it push a guest, a venue or a promoter to leave.
Where a fraud fix caused churn, the fix was reshaped rather than dropped.

## Decisions

### 1. Who can take part

- **Promoters** use a normal consumer account with a promoter page. No fifth
  Cognito pool. They confirm they are 18 or older when they open the page.
- **Venues** take part only on a paid tier, the same gate as map membership. A
  promoter link must land on a venue the map shows, and a free-tier venue must
  not buy reach through promoters while skipping the subscription. If a venue
  lapses, its promoter links stop counting and each promoter is told the room
  is off GlyphCity.
- The venue accepts a promoter and sets the rate per arrival. Before accepting,
  the venue sees the other rooms that promoter holds.

### 2. Rooms are claimed per night

A promoter claims nights, not venues. One main room per night, plus at most one
other room that night in a different category (a pre-drinks bar before a club).
There is no per-city cap.

"One main room per type of place in a city" was rejected. The data has six
categories (`NodeCategory`), and every club, lounge and bar is `nightlife`, so
the rule would stop a promoter running Thursdays at one club and Saturdays at
another, which is how most of them work. "A different part of the night" is not
in the data. One room per night is what a promoter can physically host, and it
is enforceable.

### 3. The link

- Only promoter links carry a sender. Ordinary consumer shares stay anonymous,
  so GlyphCity never builds a record of who shares with whom.
- The link carries an opaque code for one promoter and venue pair, never a user
  id. The code dies when the venue drops the promoter.
- Promoter link opens are a new Open_Source, `promoter`, phrased "from a
  promoter's link" in `OPEN_SOURCE_PHRASE`. Reusing `share` would let the
  Receipt present an arrival the venue paid a promoter for as demand GlyphCity
  found.
- The card is the existing glyph share card plus the venue's approved Tonight
  headline (decision 8). It says "Open in your browser", because Google sign-in
  is blocked inside Instagram's in-app browser.
- The landing shows "Shared by {promoter}", so the guest knows before they
  check in.

### 4. What counts as a paid arrival

An arrival pays only when all of these hold:

1. The guest's first look at the venue inside the Attribution_Window (6h) came
   from this promoter's link. If they looked on the map first, or opened another
   promoter's link first, nobody is paid. This is the existing first-touch rule;
   it is told to the promoter in those words before they post.
2. That open was at least `AWAY_GATE_MIN_MINUTES` (20) before the check-in.
3. The guest was not known to be within `AWAY_DISTANCE_METRES` (500 m) when they
   opened it. Position unknown falls back to the 20-minute rule alone. Without
   this, a promoter working a queue longer than 20 minutes is paid for
   walk-ins.
4. The check-in was a QR scan of the venue's rotating code, with a coarse
   location reading within 2 km of the venue. A QR scan alone never checks
   location, and a code stays valid up to 30 minutes, so a photo forwarded to
   friends at home would otherwise pay. The 2 km bound is deliberately loose:
   indoor GPS in a club is poor, and the exact radius would fail real guests.
   No location means a normal check-in that does not pay. The check-in is never
   refused.
5. The guest is not the promoter, by account or by device fingerprint.
6. The guest has not checked in at this venue in the last 30 days by any route.
   Rolling 30 days, not a calendar month. This covers "same guest pays once a
   month" and also stops the venue paying for its own regulars.
7. At a `nightlife` venue, the guest has confirmed they are 18 or older. Asked
   once per account, on the promoter link landing, never at the door. Skipping
   it never blocks a check-in; the arrival just does not pay.
8. The promoter's nightly cap and weekly ceiling are not reached.

Every branch that cannot be verified does not pay. The check-in itself is
always recorded as presence, because it is true.

### 5. Going carries the promoter forward

Promoters post days ahead and the window is 6 hours. The window stays at 6
hours (it is the honesty constant behind Found_You). Instead, a Going mark made
from a promoter link stores the promoter code on the Going row, and the
Tonight_Reminder push for that row opens the venue as `promoter` with that code
instead of `push`. Without this, the reminder at slot start becomes the first
touch and takes the credit from the promoter who brought the guest.

This widens the Going row from `userId` only to `userId` plus an opaque
promoter code. The code is not personal information, the row still expires on
its own, and the erasure worker still deletes it. `rules/product.md` is updated
when the spec lands.

### 6. Caps

- Set per promoter by the venue: a nightly cap and a weekly ceiling. The venue
  sees its total possible spend across all its promoters.
- A night is the shared night (`NIGHT_ROLLOVER_HOUR_SAST`, 04:00). The week is
  assigned by night, so 01:00 Monday belongs to Sunday's night and Sunday's
  week.
- The counter is an atomic conditional increment, so two scans at the cap
  cannot both pay.
- The promoter sees "Cap reached at 23:10" live. Guests after the cap check in
  normally.

### 7. Boost steps aside per claimed night

A venue cannot buy a boost for a night a promoter has claimed. Settled before
the night starts; a boost bought earlier runs out first; reaching the cap does
not bring boost back. On every other night boost works as today.

The reason is attribution, not tidiness: with no boost on a promoter night, no
arrival can appear on both the Boost_Scoreboard and a promoter statement, so the
venue never pays twice for one guest.

### 8. One approved line

The promoter drafts one line; the venue approves it; it becomes the venue's
Tonight headline (the existing Dated_Slot, 60 characters). No second store. The
card shows only approved text, so an offer the venue never agreed to ("free
entry") cannot appear. Until approval the card shows the venue name and glyph.

### 9. Summary and statement

- The nightly summary stays the Receipt. Promoter arrivals sit in their own
  "from a promoter's link" bucket under `SUPPRESSION_FLOOR` like every other
  source.
- The exact count lives on the Monday statement, visible only to the owner and
  that promoter. Both read the same check-in rows, so they cannot disagree.
- The statement shows counted arrivals, the rate, the amount owed, and
  GlyphCity's fee on its own line. It also shows what was not counted and why,
  as weekly totals: recent visit, cap reached, no location, not 18+ confirmed.
  A promoter who sees why a number is lower stays; one who sees only a low
  number assumes they were cheated.
- Statements lock on Monday. A later account deletion does not change money
  already owed.
- Owner check-in rows show "from a promoter's link" without naming the
  promoter, so the venue cannot match guests to promoters.
- The promoter sees nightly totals with no times and no names.
- Copy uses measurement verbs: "arrivals recorded through your link". The
  honest-copy test (`BANNED_CAUSAL_VERBS`) covers promoter surfaces too.

### 10. Payment between venue and promoter

- The venue pays the promoter outside GlyphCity.
- The venue marks a statement paid. The promoter can mark it not paid. After 14
  days marked not paid, new counting pauses for that promoter at that venue
  only, not for the venue's other promoters, and both sides are told. Either
  side can clear it. Pausing every promoter on one claim would let a single
  promoter shut a venue's program down.

### 11. GlyphCity's fee

- A flat amount per counted arrival, not a percentage of the rate, so GlyphCity
  has no stake in pushing rates up.
- There is no card on file today: Yoco is used through a hosted checkout per
  payment. The fee accrues and is charged in one monthly checkout, combined with
  the subscription renewal when both fall in the same month. Unpaid past the
  existing grace window, counting pauses for that venue's promoters, who see
  "counting paused" and not the reason.

### 12. Privacy

A privacy policy update and an `AREA_CODE_CONSENT_VERSION` bump: a check-in made
through a promoter's link is counted on a statement that decides what a venue
owes that promoter; the promoter sees counts, never identities. The 30-day
dedupe rows (`venueId` plus `userId`, TTL 30 days) are deleted by the erasure
worker.

## Churn check

| Rule                    | Who it could lose | Shape that keeps them                                     |
| ----------------------- | ----------------- | --------------------------------------------------------- |
| QR plus location        | Promoters, guests | Coarse 2 km bound; never refuses a check-in               |
| Known near at open      | Promoters         | Unknown position still counts on time                     |
| 30-day recent visit     | Promoters         | Shown as a "not counted" total on the statement           |
| 18+ confirmation        | Guests            | Once, at the link landing, never blocks a check-in        |
| 6h window               | Promoters         | Going carries the code; reminder credits the promoter     |
| One room per night      | Top promoters     | No per-city cap; one extra room in another category       |
| Not-paid pause          | Venues            | Pauses one promoter, not the venue's whole program        |
| Monthly fee checkout    | Venues            | Combined with the renewal checkout when they coincide     |
| Boost hidden on a night | GlyphCity revenue | Per claimed night only; per-arrival fee covers that night |

Rules rejected because the churn cost was higher than the fraud they stop: an
exact 500 m location check on QR scans, an 18+ gate inside the check-in flow, a
city-wide room cap, and pausing all of a venue's promoters on one unpaid claim.

## Open items for the founder

1. The flat fee amount per counted arrival.
2. Legal review of paying promoters for arrivals at liquor-licensed venues
   (Liquor Act, provincial liquor rules) and of the 18+ self-confirmation.

## Prerequisites before any money depends on the count

- Fix the Venue_Open merge so a look older than the Attribution_Window cannot
  erase a newer one (`backend/src/features/check-in/venue-open.ts`
  `mergeVenueOpen`). Today a morning map look plus an evening promoter link
  stamps the check-in `walk_in`.
- Consolidate the duplicate `validateQrToken` in `check-in/service.ts` and
  `business/service.ts`, since paid arrivals depend on it.
