# Criteria

Pick every section that applies before you start. When you finish, mark each
criterion **passed**, **open** or **not tested**, with the observation and the
evidence; **not applicable** only with a reason. These are your own checks, not
a grade: passed means you saw it work in the tested scope, open names what is
left and the next action. Never mark something passed to finish; an open
critical check stays open whatever else passed.

## Implementing to code

**Check:** design fidelity; idiomatic structure; component reuse; functional
coverage; performance.

Right repo, its rules followed. Existing components reused, no duplication, no
hacks. Runtime and build errors, loading cost, rendering and animation
inspected; performance measured, not assumed from a green build. Design gaps
found during implementation went back to the canvas.

## Implementation review

**Check:** design parity; responsive and theme correctness; end-to-end
behaviour; regression safety; evidence quality.

Running app tested with realistic data on every affected route, including
setup, permission, loading, empty, error and recovery. Controls reachable at
every relevant size. UI PRs compared with genuine before and after captures
at matched conditions, labelled with environment. A missing baseline is
stated, not papered over.

## Responsive

**Check:** continuity across widths; readable content; geometry; usable
controls; theme and state consistency.

## Code to canvas

**Check:** source fidelity; editability; component identity; state fidelity;
safe round trip.

## Product UI and UX

**Check:** job completion; discoverability; interaction cost; pattern
consistency; state handling and accessibility.

## Animated graphic

When the implementation includes motion: continuity and pacing, legibility in
intermediate frames, loop seams, exposed props, review controls, supported
exports, measured load and playback.
