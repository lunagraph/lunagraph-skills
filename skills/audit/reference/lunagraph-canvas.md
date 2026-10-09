# Drawing the audit on the Lunagraph canvas

Use this when the session has Lunagraph's canvas tools. It replaces
`audit-page.md`, `canvas.md`, and the Specimens, Verify, and Continuing sections
of the skill. The rules, the scan, the scope (inventory by default, one group
in depth only when asked), and the report are unchanged.

Nothing is written to the user's repo in this mode. Components are imported
into the user's Lunagraph project, and the audit is drawn with them.

## The one thing that must not happen

**A component on the canvas is the real component.** `<Button variant="outline">`,
placed from the project's component catalog. Never a `<div role="button">` with
the component's classes copied onto it, and never "drawn from source". A fake
looks right today, cannot be edited as a component, and silently stops matching
the code. If a component cannot be imported, its card says "Not imported" with
the reason. That is a correct result. A look-alike is not.

## Layout and look

The audit must be neat and calm. Lay it out as reference sheets:

- Groups run top to bottom. Each has a large heading with its counts.
- Inside a group, one sheet per component, side by side, separated by generous
  space and a hairline. A sheet has a small eyebrow ("Buttons · 01.1"), the
  component name, one line of facts (uses, files, `path:line`), then framed
  stages.
- A stage is a light bordered frame with the component centred in it and a
  small caption strip underneath: the source location on the left, what the
  frame shows on the right ("as written", "variant", "size").
- A sheet has two numbered sections. **1 Component**: one large stage with the
  component as written (content from a real usage, but none of its `className`
  restyling), then one stage per variant prop holding **all** of that prop's
  values in a row, each with a small label under it. All of Button's variants
  are in one frame, not one card each. **2 Overridden**, only when the scan
  lists overrides: an orange summary ("11 of 13 call sites restyle Button"), then
  one tile per distinct override with the real component carrying those
  classes, its count, the classes it replaces (`rounded-lg → rounded-full`) or
  adds, and its call sites. Show the four most used and list the rest by count.
- White background, one type family, small monospace captions, plenty of space.
  The components are the only colour. No heavy borders, no boxes inside boxes
  beyond the frame, no decorative icons.

## Ground rules

- **Lunagraph's own instructions come first.** Follow what its MCP server tells
  you: load its design skill before the first canvas write, and work read, claim,
  mutate, screenshot, release. Where this file and those instructions disagree,
  theirs win.
- **Do not fix anything in the source.** Importing copies components into the
  Lunagraph project; it never edits the user's repo.
- **Scan the folder the user attached**, never the session's own working
  directory. If more than one folder is attached, use the one the user named.
  Write the scan outside the repo:

  ```sh
  node <skill>/scripts/scan.mjs --root <attached folder> --out "$TMPDIR/lunagraph-audit/audit.scan.json"
  node <skill>/scripts/check.mjs --root <attached folder> --plan
  ```

  If the session cannot run commands, say so and stop: do not fall back to
  listing components by reading files yourself.
- **Write early, write often.** Put the list on the canvas within your first
  four tool calls after the scan. After that, never make more than three read
  or search calls in a row without a canvas write. One section or one batch per
  write, roughly 6 to 12 items and under about 6 KB of JSX.

## Steps

### 1. List everything (text only, straight from the scan)

Add one root and claim it. In it, draw the whole list before any component:

- **Header**: "Design system audit", the project name, files scanned, totals.
- **One section per group**, each listing every component by name with its
  `path:line`, uses, and files; local versions marked "local, wraps Button";
  and one line for hand-rolled: "96 hand-rolled elements in 69 looks".
- Each shared component gets a card with a `Pending` placeholder where the
  component will go. Never an empty box.

This is text and takes one or two writes. The user now has the full list.

### 2. Import the primitives

The shared components have to be in the Lunagraph project before they can be
placed. Lunagraph ships a skill for this, `lunagraph-import-from-project`. Load
it and follow it, with these inputs so it does not ask again or redraw:

- **Source**: the attached folder.
- **Scope**: the styles and tokens the components depend on, and the shared
  components in the scan (the files under `sharedDirs`). Not feature
  components, not pages.
- **Canvas**: you are drawing the audit yourself. Do not let it build a second
  reference page; use its import steps and skip its canvas steps.

Tell the user in one line that you are importing their components into the
Lunagraph project so the audit can use the real ones. Do not ask; it is what
they chose when they picked Lunagraph.

Import foundations first, then components in batches. After each batch, look
them up in the project's component catalog to confirm they registered.

### 3. Show the primitives, as components

As each component registers, replace its `Pending` placeholder:

- the component as written, with the content of one real usage: same parts,
  same text, same icons, copied from a call site in the scan, with that
  `file:line` written under it, but without the `className` that call site
  passes to restyle it
  Never content you made up. Where the source has a runtime value, use a
  stand-in of the same kind and name the expression it stands for beside the
  location ("stand-in for project.name")
- one row per variant prop, with the real component once per value
  (`<Button variant="outline">`, `<Button size="sm">`), each labelled with the
  value and how many call sites pass it, or "never used"
- its parts with use counts, composed the way call sites compose them
- in its resting state: a dropdown is placed closed, with its trigger, as the
  usage has it. Do not force menus, popovers, or dialogs open to show what is
  inside, and do not wrap them in a sized box
- its overrides, from `overrides` in the scan: one tile per distinct override,
  the real component with that override's classes passed as `className`, its
  count, its classes (what each replaces), and its call sites

A component that did not import keeps its card: name, counts, and "Not
imported: <reason>". Nothing is drawn in its place.

### 4. Stop

Local versions and hand-rolled elements stay as counts in the list. Report and
offer the group audits. Do not start one.

## A group audit, when asked

For the one group the user named:

- **Local versions**: import each (same import skill, scoped to those files)
  and place it as a component, with its variants.
- **Hand-rolled looks**: these are raw markup in the source, not components, so
  here drawing the element is the faithful thing. Draw each look once from
  `example.code`, same element, same classes, with its count and every
  location. Mark the section clearly as hand-rolled, in amber.
- Then the comparison, token check, findings, and recommendation from the
  skill's Phase 2, drawn beside the group: numbered markers on the spots that
  differ, the checklist, the headline, reason, and stats.

## Marking the canvas

So progress can be found and counted again:

- `data-audit="list"`, `data-audit="group-<id>"`, `data-audit="detail-<id>"`,
  `data-audit="next"` on sections
- `data-audit-component="<scan id>"` on every component card
- `data-audit-variant="<Name>.<axis>=<value>"` on every variant
- `data-audit-overrides="<scan id>"` on every Overridden section, and
  `data-audit-override` on each override tile
- `data-audit-look="<look id>"` on every hand-rolled look

Use the project's own theme and components for the audit's chrome, the way any
Lunagraph design would. Amber marks hand-rolled and local.

## Continuing

When run again, or when the user says "continue":

1. Run the scan again.
2. Search the canvas for `Pending` and `Not imported` inside the existing root,
   and compare the `data-audit-component` ids on the canvas with the scan.
3. Resume at the first thing still pending or absent. Never redraw a finished
   section and never add a second root.

## Verify

The check script cannot read the canvas, so count on the canvas instead:

- every component in the scan appears in the list
- the number of `data-audit-component` cards equals the scan's shared
  components that are not parts (plus the group's local versions, in a group
  audit)
- every card holds the real component or says "Not imported"; search the root
  for `role="button"` and other stand-ins inside component cards and confirm
  there are none
- the number of `data-audit-variant` items equals the variant values in the
  plan for those components
- nothing still says `Pending`

Report those as your coverage lines, and list every "Not imported" with its
reason. Then screenshot the root before releasing your claim and look at it: no
overflow, no clipped text, no empty tiles. Claims expire; re-claim the root when
you need to keep writing. Between writes, one short line of progress for the
user: "Imported 12 of 31 components", "Buttons: 8 of 8 variants".
