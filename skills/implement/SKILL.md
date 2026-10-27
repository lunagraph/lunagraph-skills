---
name: implement
description: Implement a reviewed canvas design in the user's codebase with their components and tokens, then verify the running UI: routes, states, themes, widths, interactions and performance. Use for design-to-code, authorised design fixes in code, or a requested code-to-canvas round trip. Do not implement from a critique alone, and do not redesign in code; open visual questions go back to the canvas.
---

# Implement

Turn a design that has already been reviewed into code in the right repo, and
prove the running result matches it.

## Rules

- **Only when asked.** A critique, a storyboard or a canvas that exists is not
  a request for code.
- **The canvas decides how it looks.** Build what was reviewed. When something
  is missing or does not work in code, take that gap back to the canvas and
  get it designed there, then build the revised version. Do not invent the
  visual answer in code. With Lunagraph's canvas tools in the session (a
  Lunagraph chat, or a terminal agent with the `lunagraph` plugin and the
  desktop app open, after `project_pick`), load `lunagraph-use` and
  Lunagraph's `lunagraph-implement` skill when they are listed; they teach
  reading the canvas and the codebase's conventions. Otherwise read the
  design with `canvas_read` and `take_screenshot` and follow the repo's own
  conventions.
- **Shared components stay shared.** When the design needs a change to one,
  show every consumer it affects and let the user choose: update the component
  or make an exception. Never overwrite it to fit.
- **Draft PR only when asked.** No merge, no deploy, unless that was
  requested too. Canvas, code, tests, PR, preview and production are separate
  milestones.

## 1. Confirm the baseline

Which repo, which branch or worktree, which canvas page and version, which
references and assets, and the latest requirements. Read the repo's own
guidance and conventions. Read the current state of every file before editing
it, and make targeted changes; another person or agent may be editing nearby.

## 2. Build

Reuse the existing components, tokens, geometry and patterns. No duplicate
components, no brittle hacks, no workarounds. Preserve unrelated work and the
user's edits.

For a requested **code-to-canvas** step: name the source version, components,
assets and states; import; then verify the canvas renders the same, stays
editable, and keeps component identity. Compare it back against the source.
Do not flatten structure, overwrite newer canvas or code edits, or claim a
safe round trip without checking. This step does not authorise a redesign or
writing back to code.

## 3. Verify the running result

Run the repo's checks. A passing build is not evidence of parity or
performance. Then run the app and look, with
[references/checklist.md](references/checklist.md):

- Runtime and build errors, loading cost, rendering, animation behaviour.
  Measure before and after where performance matters.
- Realistic data on every affected route. Setup, permission, loading, empty,
  error, recovery and success paths.
- Every control reachable and clickable. Touch, keyboard, focus, cancel, long
  content.
- Light and dark. Sweep the width narrow to wide and back, both sides of each
  breakpoint. Record range and failures; dense samples and a disclosed limit if
  you cannot resize continuously.
- Animations: intermediate frames and loop seams, playback, exposed props,
  review controls, supported exports.
- Prototypes: a fresh sub-agent attempts the task with the goal and no click
  path. Fix and retest.
- For a UI PR, capture genuine production-before and localhost-after
  screenshots at the same route, viewport, theme, state and comparable data,
  labelled with environment and time. Never substitute. If production is out
  of reach, label the baseline you have and leave that comparison incomplete.

Score the criteria in [references/criteria.md](references/criteria.md) with
evidence. Recheck every fix and every shared-component consumer. Untested is
not passed.

## 4. Deliver

What changed, the canvas version it implements, references, evidence, tested
routes, widths, themes and states, check results and measurements, the
scorecard, PR or preview links that you actually opened, and the decisions
still open. An unreachable preview is not verified. Stop when the scope is
verified or a named blocker (access, capability, authority, a human decision)
prevents it.
