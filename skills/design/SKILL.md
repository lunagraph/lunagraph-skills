---
name: design
description: Design or revise a website, product UI, static graphic, design system or clickable prototype on the Lunagraph canvas, from a brief, a reference or an existing design. Use when the user wants something designed, explored as variants, or polished, and before changing how UI looks in code ("make this look good"): mock it on the canvas first. For motion use animate, for critique without edits use critique, for code use implement.
---

# Design

Make the thing on the canvas, in a few directions, and check it before you
say it is done. Not code. Not a critique of someone else's work.

## Where to draw

Settle this first. Take the first case that applies.

1. **This session has Lunagraph's canvas tools** (an MCP server named
   `lunagraph`, with `canvas_add`, `canvas_read`, `take_screenshot`). In a
   Lunagraph chat they are always there. In a terminal agent with the
   `lunagraph` plugin installed they are there whenever the Lunagraph desktop
   app is open: call `project_list`, then `project_pick` to bind the file you
   are designing in. If Lunagraph's own `lunagraph-use` skill is listed,
   load it, then the design skill it names; they teach the canvas. Over a
   plugin connection it is not, so follow the server's instructions and the
   tool descriptions instead: screenshot before and after every change, and
   prefer `canvas_edit` and `canvas_insert` over redrawing. This skill adds
   the brief, the variants and the review gate on top. Draw.
2. **The tools are listed but fail to connect.** The desktop app is not
   running. Ask the user to open Lunagraph, then retry.
3. **No canvas tools at all.** You cannot draw here. Hand over and stop: in
   Lunagraph, start a chat with this repo's folder attached and ask for the
   design there, or click "Connect external MCP agent" in Lunagraph and run
   the command it gives. Do not substitute a static HTML page, a screenshot, a
   generated image, or drive the app's UI with a mouse.

## 1. Brief, before the first canvas write

Six lines, in the chat, from the request, the product and the codebase:

- **Goal.** What the user asked for, in their words.
- **Who and job.** Who looks at this and what they are trying to do.
- **Takeaway.** What they should understand or do, and the visible thing that
  proves it. State this as a hypothesis with its assumptions. Keep it separate
  from the feature list.
- **References.** The real UI, tokens and components this must match. Treat
  code and the running app as the truth about what exists. Never invent
  controls, behaviour or claims.
- **Preserve.** Approved work, the user's own edits, handwritten todos.
- **Graphic or text.** Which areas get a graphic and what each one says. A
  missing "text only" label is not permission to invent a graphic. A product
  UI that exists in no real capture is named in text, never drawn.
- **Claims.** Every factual claim the page will make, each traced to where it
  is true in the product: a file, a screen, a capture. Claims handed to you in
  the brief, and copy already live on the site, are checked the same way; a
  brief can be wrong and live copy can be stale. A claim with no source is cut
  or marked "to confirm" in the delivery. Keep this table; you deliver it.
  The table is not the check. The check is each final sentence, read the way
  a visitor reads it: a list followed by a place ("tokens, icons and
  components, ready in the panel") claims the place for the whole list. If
  one item is not true there, the sentence is rewritten, not footnoted.
  Start the table from the brief itself: every sentence in its "what the
  product does" list is a claim, traced one by one before any copy is
  written. "Unverified" is an allowed result; a claim you did not trace is
  not.

Ask one question only when an open choice changes the value or the scope.
Otherwise state the assumption and go.

## 2. Variants

Put two or three **meaningfully different** directions side by side on the
canvas, each named. Different composition, hierarchy or story, not the same
layout in three colours. Compare them against the brief and the criteria below,
say which wins and why, and refine that one. Leave the others on the canvas.

A design that touches a shared component does not change the component. Show
the impact on its other uses and ask the user: update the component, or make
this an exception.

## 3. Review your own work

A "done" message is not evidence. Screenshot the result and go through
[references/checklist.md](references/checklist.md). The short version:

- Open the reference beside the work and compare section by section: hero,
  demo, steps, call to action, cards, footer, for the desktop frame and
  again for the phone frame. Whole-page impressions miss a demo that lost
  its title or a card row that drifted. Nav and footer links are the live
  site's, not a concept component's.
- The phone demo is the desktop demo scaled to the column, never a crop that
  loses the header or a section. If it cannot be read at that size, change
  what the demo shows on both frames.
- A product graphic is a capture of the product. A stage made for another
  medium (an email or video story with its own eyebrow, title band or player)
  is cropped to the product it contains; the stage chrome never ships.
- Re-read every sentence against the claim table. Text says what the brief
  says only where the brief is true. Labels work without the icons. Logos are
  the real ones.
- Each step graphic shows its own settled moment: no two steps share a
  frame, none repeats the demo, no frame is caught mid-transition, and each
  frame shows the thing its caption names, or the caption changes. Saying
  that a frame is reused does not make the reuse acceptable; crop a
  different part, pick another moment, or change the step.
- Every graphic on a page shows the same project: one palette, one set of
  names, one app. A real capture beside a story frame of a different palette
  is a defect, even if each is real on its own.
- The smallest label in every graphic is readable at the size it is shown.
  Shrinking a whole board until its labels are 6px is not a crop; crop to the
  part that carries the step instead. A graphic that fills a column fills it,
  the same width as its neighbours.
- Typography, spacing, radii and controls match the references. No pattern
  transplanted from elsewhere because it exists.
- Nothing clipped by accident. Intentional overflow still intentional.
- Both themes, muted and disabled states, long content.
- Websites: sweep the width from very narrow to very wide and back, both
  sides of every breakpoint. Record the range and every failure. If you can
  only sample, say so.
- Prototypes: state what it tests, make the key task clickable, and have a
  fresh sub-agent attempt the task with the goal but no click path.

Fix what you find, recheck the fix and its neighbours. Score each criterion
that applies in [references/criteria.md](references/criteria.md), with evidence
and the open issue. Do not average a failed critical path away.

## 4. Deliver

- The page and frame names, and the element ids of what changed.
- The chosen direction and why, and the references it follows.
- The claim table: each claim, its source, or "to confirm".
- The frames used: which real capture or story moment each graphic is.
- What was tested: widths, themes, states.
- The scorecard and every unresolved decision.

The canvas is the deliverable. Do not imply it is implemented, approved or
deployed. If the user wants code, that is the `implement` skill. If they want
motion, `animate`. Neither redoes approved static work.
