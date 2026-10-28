# Criteria

Pick every section that applies before you start. When you finish, mark each
criterion **passed**, **open** or **not tested**, with the observation and the
evidence; **not applicable** only with a reason. These are your own checks, not
a grade: passed means you saw it work in the tested scope, open names what is
left and the next action. Never mark something passed to finish; an open
critical check stays open whatever else passed.

## Shared gate

Start from the product's purpose, the user's job and the one thing this must
communicate. Reuse the design system's patterns, tokens and components. Reuse
real product UI for product graphics. Carry the user's chosen references
forward. Do not overwrite a shared component to fit a design; make the impact
visible and let the human decide. Hand off only with checks passed or issues
listed.

## Website layout

**Check:** message and hierarchy; copy; design-system fidelity; responsive
continuity; accessibility and navigation.

A visitor skims the page and knows the value and the next action. Copy is
direct. Sweep the width continuously, capture representative widths and every
failure, check wrapping, stacking, navigation, graphic scale and touch targets
in both themes.

## Static graphic

**Check:** message clarity; actual-UI fidelity; brand consistency; composition
and geometry; responsiveness.

The graphic communicates the feature and benefit on its own. Every shell, panel
and control traces to a real UI reference. Enough context to recognise the
product, nothing more. Adjacent graphics share framing. No unintended clipping.

## Product UI and UX

**Check:** job completion; discoverability; interaction cost; pattern
consistency; state handling and accessibility.

Users know where to start and what happened. Actions are not hidden behind
popovers. Controls say what they do, not only with icons. Familiar patterns, no
redundant steps. Keyboard, touch, focus, cancel, recovery, and the permission,
setup, empty, loading, error and success states.

## Responsive

**Check:** continuity across widths; readable content; geometry; usable
controls; theme and state consistency.

Narrow to wide and back on every affected page. Dense samples and a disclosed
limit if you cannot resize continuously. Long copy, real data, enlarged text,
image bounds, popovers, every target.

## Design system and components

**Check:** reuse; token and geometry consistency; API and state coverage;
accessibility; change impact.

Read the repo's guidance, tokens and existing components before proposing a
new one. Distinguish a real gap from an overlooked component. For a shared
change, show the affected consumers.

## Prototype

**Check:** testable hypothesis; realistic interaction; representative states;
learnability; iteration value.

State what it tests. The key task is executable, with representative data and
the failure paths that matter. A fresh agent gets the goal and the context, not
the click path; watch where it hesitates. That supplements human testing, it
does not replace it.
