# Decision: promoter arrivals

Date: 2026-10-11

Spec: promoter-arrivals, Requirement 11. Related: `rules/product.md`
"North star", `docs/decisions/map-membership.md`.

## Context

Four choices were still open: who may be promoted, what GlyphCity charges,
whether a promoter holds a room or a night, and whether regulars and
nightlife arrivals count. They are recorded here. Kiro implements them and
does not reopen them.

## Decisions

### 1. Paid-tier venues only

Yes. A promoter link works only for a venue that is already allowed on the
map: the owning business is on `starter`, `payg`, `growth`, or `pro`, and
the node is active. That is the existing map-membership rule. There is no
second definition of paid.

A free-tier venue is not on the map. A link to it would send a guest to a
room the map does not show, and it would let that venue buy arrivals
without joining the map. Applications and claims are rejected for a venue
that fails the membership check. A venue that drops off the map stops
accruing at that moment. Arrivals already recorded still lock.

### 2. Flat fee: R10 per recorded arrival

`AREA_CODE_ARRIVAL_FEE_CENTS` is `1000`. One charge, every payable arrival,
every tier. The venue still sets what it pays the promoter. The R10 is
GlyphCity's charge for the count.

R10 is the whole charge. The invoice shows that amount and no tax line.
Code does not add VAT. If the company later registers for VAT, that is a
new decision, and it says whether R10 is inclusive or exclusive. Until
then the product does not invent a tax line.

Thirty recorded arrivals in a month are R300, about one Growth membership
(R299). The fee is owed only in a month when arrivals were recorded.
Missing the env var refuses the checkout and writes no invoice. The code
does not substitute 1000 on its own. Prod and dev Terraform set `1000`.

### 3. Promoters claim nights

Yes. A promoter does not hold a room permanently. They claim a night, up
to 14 days ahead, and the claim closes at 16:00 SAST. The venue sets how
many promoters may hold one night. The default is 1.

A permanent hold would count a room the promoter is not talking about that
night, and it would leave the venue paying for a link that outlived the
reason to go. The rate and the caps are copied onto the claim when it is
made.

### 4. Regulars and the 18+ tick

Yes to both.

A guest with any check-in at that venue in the previous 30 days does not
count as a payable arrival. The venue already has that guest. The current
check-in is not part of the 30 days.

Nightlife arrivals count only when the guest's account already has the 18+
self-tick. The tick is a checkbox with a timestamp. It is not an age check,
and the product does not say GlyphCity verified age. The venue keeps its
licence duty. A missing tick does not count. The check-in itself still
succeeds. Prod Terraform sets `AREA_CODE_FLAG_NIGHTLIFE_TICK` to `true`.
Dev sets it to `false`. A missing value in prod refuses to start, so the
gate cannot silently turn off.

## Consequences

- Requirement 11 is decided. Checkout and nightlife withholding are part
  of the spec, not a later argument.
- The membership fee stays the charge for being on the map. R10 is a
  separate line.
- The promoter is paid by the venue, from the statement. GlyphCity does
  not hold that money.
