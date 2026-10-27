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
  missing "text only" label is not permission to invent a graphic.

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

- Text says what the brief says. Labels work without the icons. Logos are the
  real ones.
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
- What was tested: widths, themes, states.
- The scorecard and every unresolved decision.

The canvas is the deliverable. Do not imply it is implemented, approved or
deployed. If the user wants code, that is the `implement` skill. If they want
motion, `animate`. Neither redoes approved static work.
