# Visual checklist

Run this on screenshots of the canvas or a running preview, not on the source.
For each defect note where it is, what is wrong, what it should be, and the
capture that shows it.

This file is the same in every skill. Edit it in `skills/design/references/`
and run `scripts/sync-references.sh`.

## Meaning

- The main graphic shows the takeaway without its caption. Judge this
  separately from how well the UI is drawn: a beautifully drawn panel can
  still fail to say anything.
- Labels make sense without their icons.
- Every claim is true in the product, read sentence by sentence as a visitor
  reads it. Claims that came with the brief or were already live count too.
- Product UI is built from its real source: same structure, copy and tokens.
  Simplified to clarify, never to invent.
- Every graphic the design calls for exists, made for its place rather than
  borrowed from somewhere else.
- Requested removals are gone.
- Variants differ in what they say, not only in how they look.

## Identity

- Type, spacing, dividers, cards, controls, radii and tokens match the
  references, compared part by part with the reference open beside the work.
- Nav, footer and other shared parts match the live product or site, not an
  older copy.
- No pattern borrowed from elsewhere in the product just because it exists.
- Logos are the real ones and legible in each theme.
- Popovers sit by their triggers; arrows point at the right thing.
- Copy is short, specific and plain. No jargon, filler labels or forced slang.

## Bounds

- Every graphic's size, alignment, aspect ratio and placement are deliberate.
- Nothing is cut off or overflows by accident; nothing a graphic names is
  missing from its frame. Intentional overflow stays. Clipping is not fixed by
  turning off containment everywhere.
- Graphics that sit side by side share size and framing.
- No two graphics on the page show the same frame.
- One project throughout: same app, data, names and palette.
- The smallest label in each graphic is readable at the size it is shown.
  Shrinking a whole board until it is unreadable is not a crop.
- At narrow widths, padding shrinks before content does.

## Themes and states

- Text, buttons, borders and overlays in light and dark, including muted and
  disabled states. No stray white rectangles in dark mode.
- Contrast and type size at real display size. Enlarged text where relevant.
- Hover, focus, expanded, selected, disabled, loading, empty, error and
  success where the design has them. Keyboard and touch. Cancel and recover.
  Nothing important hidden behind a panel.

## Widths

- Something at a URL (localhost, a preview, the live site): resize it from
  narrow to wide and back, both sides of each breakpoint. Three screenshots
  are not a sweep.
- A canvas mock: built to reflow and resized, or each designed frame checked.
- Long copy, wrapping, stacking, navigation, image bounds, popovers, touch
  targets.
- Write down which widths you actually saw.

## Evidence

- Review what was made, not the summary of it.
- Label captures with version, viewport, theme and state.
- Keep what you observed apart from what you assume, and your own review
  apart from the user's approval.
