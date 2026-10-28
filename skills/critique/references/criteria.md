# Criteria

Pick every section that applies. Score each criterion separately out of 10.
Record score, observation, evidence, tested conditions, remaining issue, next
action. **Not tested** when there is no evidence, **not applicable** only with
a reason. This is a rubric, not a claim that anything has passed.

- **1–3** the objective fails. **4–6** the idea works, big gaps remain.
- **7–8** usable, specific defects left. **9** one refinement or check left.
- **10** every agreed check passed in the tested scope. Nothing more.

## Shared gate

Purpose, the user's job and the one thing to communicate are stated. Design
system reused. Real product UI used for product graphics; nothing invented.
Chosen references followed. Shared components not overwritten to fit.

## Website layout

**Rate:** message and hierarchy; copy; design-system fidelity; responsive
continuity; accessibility and navigation.

## Static graphic

**Rate:** message clarity; actual-UI fidelity; brand consistency; composition
and geometry; responsiveness.

## Animated graphic

**Rate:** story and punchline; product fidelity; continuity and pacing;
legibility; controls and delivery performance.

A labelled planning storyboard existed before motion. Continuous transitions,
not cuts between unrelated screens. Intermediate frames and loop seams clean.
Supported exports only. Preview speed distinct from baked timing.

## Product UI and UX

**Rate:** job completion; discoverability; interaction cost; pattern
consistency; state handling and accessibility.

## Responsive

**Rate:** continuity across widths; readable content; geometry; usable
controls; theme and state consistency.

## Design system and components

**Rate:** reuse; token and geometry consistency; API and state coverage;
accessibility; change impact.

## Prototype

**Rate:** testable hypothesis; realistic interaction; representative states;
learnability; iteration value.

## Code to canvas

**Rate:** source fidelity; editability; component identity; state fidelity;
safe round trip.

## Implementation

**Rate:** design parity; responsive and theme correctness; end-to-end
behaviour; regression safety; evidence quality.

Tested with realistic data on the affected routes, including setup,
permission, loading, empty, error and recovery paths. Controls reachable at
every relevant size. For a UI PR, genuine before and after captures at
matched conditions, labelled with environment.

## Usability

**Rate:** objective completion; understanding; effort and errors; recovery;
coverage of users and scenarios.

A fresh tester, a realistic objective, no coaching. First-time and returning
use, realistic data, edge cases. The designer's own walkthrough is not
independent evidence.

## Handoff

The final scorecard names the reviewed version, references, variants
considered, tested routes and environments, captures, usability findings and
remaining decisions.
