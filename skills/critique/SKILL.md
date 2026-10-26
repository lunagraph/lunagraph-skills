---
name: critique
description: Review and score an existing design, website, product UI, graphic, animation, prototype or running implementation from rendered evidence, without changing it. Use for critique, audit, usability check, visual parity, or "is this good?". A critique never edits the canvas or the code; if fixes are wanted afterwards, that is design, animate or implement.
---

# Critique

Look at the real thing, say what is wrong and where, score it, stop.

## Rules

- **Do not change anything.** No variants, no canvas edits, no code, no new
  design session. A rubric that talks about creating is not permission to
  create. If the user also wants fixes, finish the critique first, then hand
  the findings to `design`, `animate` or `implement`.
- **Rendered evidence only.** Screenshots the user supplied, the canvas
  through Lunagraph's tools, or a running preview. Source code alone is not
  evidence of how something looks. Open Lunagraph only to reach the canvas you
  were asked about.
- **Do not take the designer's word.** A "done" reply, a self-score, or a
  plausible list of tool calls proves nothing. Neither does your own
  walkthrough prove that a human can use it.

## 1. Agree what is being judged

Confirm the version, the goal, the user's job, the audience, the states,
themes and viewport range in scope, and the acceptance criteria. Read the
latest feedback and the references the designer was meant to follow. Record
what evidence is missing rather than guessing at it.

Check the designer's stated benefit against the request and the product. If
the benefit, or for motion the planning storyboard, is missing, that is the
first finding, before any polish.

## 2. Inspect

Go through [references/checklist.md](references/checklist.md) on the rendered
work. In addition:

- **Websites.** Sweep narrow to wide and back, both sides of each breakpoint.
  Record range, representative widths, failures. Dense samples plus a
  disclosed limit if you cannot resize continuously.
- **Themes and states.** Light and dark, long and real content, enlarged text,
  touch and keyboard targets, focus, overlays, cancel, recovery, loading,
  empty, error, success.
- **Motion.** Find the planning storyboard and keep it separate from the
  finished frames. Endpoints, intermediate frames, overlap, loop seams,
  pacing, controls, supported exports, measured load and playback.
- **Prototypes.** Give a fresh sub-agent a realistic goal and the context,
  not the click path. Record hesitation, wrong turns, recovery, completion.
- **Running implementations.** Cover the affected routes and real
  interactions. For a UI PR, compare genuine production-before and
  localhost-after captures at matched route, viewport, theme, state and
  comparable data, labelled with environment and time. If production is out
  of reach, say so and leave that comparison incomplete.
- **Copy.** Direct, specific, skimmable. No AI jargon, filler eyebrows, em
  dashes, forced slang.

Rate whether the audience gets the benefit separately from whether the shell
is drawn correctly. Both can fail independently.

## 3. Report

Score each applicable criterion in
[references/criteria.md](references/criteria.md) out of 10 with the
observation, the evidence, the tested conditions, the remaining issue and the
next action. **Not tested** for missing evidence, **not applicable** only with
a reason. Never average away a failed critical path. Correctness and
readability before polish.

Each finding: location, what is observed, what is expected, the reference, the
evidence. The user must not rediscover a defect you saw.

For a substantial review keep one document and update it on rechecks. For a
small change, a short result and its evidence is enough. "Ready for review"
means your checks passed in the stated scope, not that a human approved it.
