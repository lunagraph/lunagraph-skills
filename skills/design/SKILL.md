---
name: design
description: Design or revise a website page, product UI, static graphic, design system or clickable prototype on the Lunagraph canvas, including the graphics and animations the design needs. Use when the user wants something designed, a feature or landing page made, variants explored or a design polished, and before changing how UI looks in code ("make this look good"): mock it on the canvas first. For an animation on its own use animate, for critique without edits use critique, for code use implement.
---

# Design

Make the thing on the canvas, in a few directions, and look at it before you
say it is done. The canvas is the deliverable, not code.

## Where to draw

1. **Lunagraph's canvas tools are in this session** (an MCP server named
   `lunagraph`: `canvas_add`, `canvas_read`, `take_screenshot`). In a Lunagraph
   chat they always are. In a terminal agent with the `lunagraph` plugin they
   are while the desktop app is open: call `project_list`, then `project_pick`.
   If Lunagraph's own `lunagraph-use` skill is listed, load it first; it teaches
   the canvas. Otherwise follow the server's instructions and tool
   descriptions.
2. **The tools are listed but fail to connect.** The desktop app is closed. Ask
   the user to open it, then retry.
3. **No canvas tools.** Hand over and stop: start a chat in Lunagraph with this
   repo's folder attached, or use "Connect external MCP agent" in Lunagraph.
   A static HTML file, a generated image or clicking through the app's UI is
   not a substitute; the user reviews on the canvas.

## 1. Understand the job

Write a short brief in the chat before the first canvas write. It keeps you
designing for a person and a purpose instead of for the brief's wording.

- **Goal.** What the user asked for, in their words.
- **Who and job.** Who will look at this and what they are trying to get done.
- **Takeaway.** The one thing they should understand or do, and the visible
  moment on the page that proves it. That moment is what the main graphic
  shows.
- **References.** The real UI, tokens and components this must match, and an
  existing example of the same kind of page if there is one. The code and the
  running product are the truth about what exists.
- **Graphics.** Which areas get a graphic and what each one shows. Every
  graphic the design calls for is yours to make, demo animations included.
  An existing frame that shows something else is not a stand-in, however
  convenient.
- **Claims.** If the design states facts about the product (most marketing,
  docs and onboarding do), list each one and trace it to where it is true in
  the product: a file, a screen, a capture.

Claims get their own check because they are where designs go wrong without
anyone noticing. Briefs are written from memory and live copy goes stale, so a
statement handed to you is a claim to trace like any other. Trace the brief's
own description of the product too, sentence by sentence, before writing copy.
A claim you cannot trace is cut or marked "to confirm" in the delivery.

Ask one question only when an open choice changes the value or the scope.
Otherwise state your assumption and go.

## 2. Make it

For a new design, or whenever the user asks to explore, put two or three
**meaningfully different** directions side by side, each named: different
story, hierarchy or composition, not one layout in three colours. Compare them
against the takeaway, say which wins and why, then develop that one. Leave the
others on the canvas so the user can see what was considered. A revision of a
direction that is already chosen, or a small polish, goes straight to the
change.

**Make the graphics, from real source.** A product graphic is only persuasive
if it is the product. Build editor panels, dialogs and controls from their
source: the component code, its copy and its tokens. Never draw them from
memory or a description; an invented control is a promise the product does not
keep. When a graphic moves, follow the `animate` skill for it, storyboard
first, and put the result in the design. Write any component files you need in
a new folder in the Lunagraph project (for example `components/<feature>/`),
and never edit shared components to fit the design: show the user the impact
and let them decide.

**One project throughout.** Every graphic on a page shows the same app, data
and palette, so the page tells one story.

If the kind of page you are making has its own reference in `references/`,
read it now. Feature pages: [references/feature-pages.md](references/feature-pages.md).

## 3. Look at it

A "done" message is not evidence. Screenshot what you made and review it as
the person in the brief would see it. The full list is in
[references/checklist.md](references/checklist.md); the ones that matter most:

- **Against the reference, part by part.** Put the reference beside the work
  and compare each section in turn, at each width you designed. A whole-page
  glance misses the section that drifted.
- **Every sentence, read the way a visitor reads it.** "Tokens, icons and
  components, ready in the panel" claims the panel for all three. If one item
  is not true, rewrite the sentence.
- **Every graphic earns its place.** Each shows what its caption says, at a
  size where its smallest label can be read, without repeating another
  graphic on the page.
- **Bounds.** Nothing cut off or overflowing by accident, and nothing a
  graphic names left out of its frame.
- **Widths.** If the design exists at a URL (localhost, a preview, the live
  site), put it in a browser frame on the canvas and check it at several
  widths, both sides of each breakpoint. If it is a canvas mock, either build
  it to reflow and resize the frame, or check each frame you drew. Say which
  widths you saw.
- **Themes and states** the design will meet: light and dark, empty, loading,
  long content, hover and focus where they apply.
- **Prototypes:** state what it tests, make the key task clickable, and have a
  fresh sub-agent try it with the goal but no click path.

Fix what you find, then recheck the fix and what sits next to it. Go through
the criteria in [references/criteria.md](references/criteria.md) that apply
and mark each passed, open or not tested, with evidence. An open critical
check stays open; it is not outweighed by everything else passing.

## 4. Deliver

- The page, the frame names and element ids, and any files you wrote.
- The chosen direction and why, and the references it follows.
- If the design makes claims, the claim table: each claim and its source, or
  "to confirm".
- What you checked: widths, themes, states, and how.
- The criteria results and every open decision.

Do not imply the design is implemented, approved or deployed. Code is the
`implement` skill's job.
