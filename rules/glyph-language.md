# Glyph language: name it, never explain it

Read this before touching glyphs, archetype names, the live-state labels, venue
colours, cone nodes, or any copy that describes a venue's crowd or busyness.

## The principle

**The app names glyphs and never explains them.** People learn what a glyph
means from culture: creators on social media, friends, the room itself. The
app gives the name, so there is something to search for, and stays quiet about
the meaning. Research: `reports/Glyph language learned off app.md`. Creator
brief: `docs/brand/glyph-codex.md`.

## Hard rules

1. **Name, never describe.** Show the Glyph_Name ("The Firecracker") where a
   glyph needs a label. Never render an archetype `description`, a legend, a
   tutorial, an onboarding explainer or a tooltip that says what a glyph means.
   Descriptions stay in the catalog for the Codex and internal tools only.
2. **The interface says "glyph".** "Your glyph" on the profile. "Glyph" alone is
   never the app's name in a sentence that also refers to a glyph.
3. **Colour lives on the map.** Saturated colour appears only on cone nodes,
   glyphs, the small state cone beside a venue name, and semantic states.
   Interface chrome is ink on the Outdoor_Palette grounds.
4. **Category is never colour alone.** Show the category word next to the
   venue (WCAG 2.2 SC 1.4.1). Every cone node and glyph has an accessible name:
   venue, category word, Glyph_Name, state word or "Be the first in", and never
   a description (SC 1.1.1).
5. **Plain state words, one home.** Display labels come from
   `packages/shared/constants/state-labels.ts`: Be the first in, Quiet, A little
   busy, Busy, Very busy. No hype words ("Popping", "Lit") and no capacity words
   ("Packed", "Full") while the bands are absolute pulse scores. Slang and
   local words belong to creators, not the UI.
6. **Cone nodes are frozen.** Beam geometry, sizes, opacity, heartbeat tempo,
   the glyph outline pass, the Phosphor icons and the six category colours are
   pinned by `apps/web/src/lib/__tests__/cone-invariants.test.ts`. Changing any
   of them needs its own spec and a founder decision.
7. **The fifteen names are fixed.** A learned code is costly to redraw; renaming
   or replacing a glyph needs a founder decision.

## When to add a cue

Silence is a bet, measured by Acquisition_Source funnels (creator vs other).
Add the next cue (the glyph name on the browse card) only when the decision
rule in `docs/decisions/glyphcity-rebrand.md` says non-creator users are
trailing. Never add a description to close the gap.
