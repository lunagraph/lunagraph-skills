# Criteria

Score each criterion separately out of 10 when you finish. Record score,
observation, evidence, tested conditions, remaining issue, next action.
**Not tested** when there is no evidence, **not applicable** only with a
reason.

- **1–3** the objective fails. **4–6** the idea works, big gaps remain.
- **7–8** usable, specific defects left. **9** one refinement or check left.
- **10** every agreed check passed in the tested scope. Nothing more.

## Implementing to code

**Rate:** design fidelity; idiomatic structure; component reuse; functional
coverage; performance.

Right repo, its rules followed. Existing components reused, no duplication, no
hacks. Runtime and build errors, loading cost, rendering and animation
inspected; performance measured, not assumed from a green build. Design gaps
found during implementation went back to the canvas.

## Implementation review

**Rate:** design parity; responsive and theme correctness; end-to-end
behaviour; regression safety; evidence quality.

Running app tested with realistic data on every affected route, including
setup, permission, loading, empty, error and recovery. Controls reachable at
every relevant size. UI PRs compared with genuine production-before and
localhost-after captures at matched conditions, labelled. Missing production
access stated, not papered over.

## Responsive

**Rate:** continuity across widths; readable content; geometry; usable
controls; theme and state consistency.

## Code to canvas

**Rate:** source fidelity; editability; component identity; state fidelity;
safe round trip.

## Product UI and UX

**Rate:** job completion; discoverability; interaction cost; pattern
consistency; state handling and accessibility.

## Animated graphic

When the implementation includes motion: continuity and pacing, legibility in
intermediate frames, loop seams, exposed props, review controls, supported
exports, measured load and playback.
