---
name: animate
description: Storyboard, animate and verify a product animation or motion graphic on the Lunagraph canvas, for a website or an exported video. Use for launch videos, feature stories, transitions, pacing, loops, playback controls and motion polish. Storyboards before motion, always. The design skill uses this one for animations inside a page or product design; for critique use critique.
---

# Animate

Tell a story about the product, in motion, and prove each beat lands before
you animate it.

## Where to draw

Same as the `design` skill. With Lunagraph's canvas tools in the session
(always in a Lunagraph chat; in a terminal agent with the `lunagraph` plugin
whenever the desktop app is open, after `project_list` and `project_pick`), load Lunagraph's
`lunagraph-use` skill and the design skill it names when they are listed,
otherwise follow the server's instructions and tool descriptions, and draw. If the tools
are listed but fail to connect, ask the user to open Lunagraph. Without them,
hand over to Lunagraph and stop. Never fake motion with a generated video, a
GIF of something else, or by driving the app's UI.

## 1. Story, before anything moves

Read the request, the approved static work, the product and the references.
Decide whether this is a website animation or an exported video, and which
formats are required. Then write, in the chat:

- **Job and benefit.** Who watches this, what they are trying to do, and what
  becomes easier.
- **Message.** The one or two things the viewer must understand, and the
  punchline that proves it. State it as a hypothesis with assumptions. A list
  of features or API calls is not a message.
- **Cast.** For a story with several clients or agents, who starts it, who
  does the work, what artifact they share and how feedback comes back. Honour
  the actors the user named.

## 2. Storyboard, on the canvas, labelled

Draw a **planning storyboard**: a frame per beat, each captioned with what the
user does, what visibly changes, and what the viewer learns. Show the ending
payoff and the transition into each beat. Name the frame so it can be found
later; it is not the same thing as a grid of paused frames captured after
animating, and it must exist before any motion.

If there is no approved storyboard yet, draw two or three meaningfully
different ones and compare them against the message and the criteria. If one
is already approved, reuse it; replace it only when asked, or raise a specific
conflict for the user to decide.

Screenshot the chosen storyboard and check it: does each beat communicate the
benefit without narration? Fix the story here. It is much cheaper than fixing
motion.

When a coordinator asked for planning only, stop here and return the
hypothesis, the storyboard's location and a capture.

## 3. Transitions, then motion

Plan how each beat becomes the next before animating. Prefer one object that
persists across scenes, a pan into nearby space, a zoom that reveals the next
context. Cuts and crossfades between unrelated screens do not explain the
relationship. Keep the product's real controls, geometry and brand throughout.

Keep the graphics editable while you iterate. Expose the useful knobs as
props: scene points, transition durations, delays. Give the review build play,
pause, scrub and playback speed. Preview speed is not the baked timing; say
which is which.

## 4. Verify the frames

Inspect rendered start, middle and end frames of every beat, and the loop
seam, with [references/checklist.md](references/checklist.md). Look for
overlap, clipping, unreadable type at real size, hierarchy that collapses
mid-transition, pacing that rushes the payoff. Both themes where relevant.
Autoplay is optional unless asked for.

Test the delivery: fidelity, file size, loading, playback, and the formats
that are actually supported. Offer downloads only for those. Say which
requested formats are not available.

Go through the criteria in [references/criteria.md](references/criteria.md)
and mark each passed, open or not tested, with evidence. Deliver the reviewed animation, the storyboard it came from and its
location, representative frames or a recording, the timing and export details,
tested conditions, and open issues. A reusable review and export controller is
a proposal for the user, not something to build on the side.
