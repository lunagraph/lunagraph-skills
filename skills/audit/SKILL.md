---
name: audit
description: Audit this codebase's design system. A script scans the repo and lists every component with its uses, props, and variants, plus counts of local wrappers and hand-rolled copies. The audit then shows the shared primitives as the real components, with every variant, on the Lunagraph canvas when the session is connected to Lunagraph (components are imported and placed as real components), otherwise as a read-only canvas inside the app at /audit. Pass a group name ("buttons") to go deep on that group only: every local version, every hand-rolled copy, every call site, and a recommendation. Use when the user asks to audit, inventory, map, or "see everything" in their design system or component library, or asks how many versions of a component they have.
argument-hint: "[group]"
---

# Design system audit

Two different jobs. Do the first by default and the second only when asked.

- **No argument: the inventory.** List every component in the codebase, and
  show the shared primitives: each one as the real component, with every
  variant. Local versions and hand-rolled copies are **counted and listed, not
  drawn**. This is quick, and it is the whole default run.
- **A group name (`buttons`, `modals`, ...): the deep audit of that one group.**
  Draw every local version and every hand-rolled look in the group, show every
  call site, annotate the differences, recommend which to keep. Only for the
  group the user named. Never for every group, and never unprompted.

If the user asks for a group and there is no inventory yet, run the inventory
first, then that group.

The scan is the same everywhere. Where the result is drawn is not:

- **On the Lunagraph canvas**, when this session can reach Lunagraph. The
  primitives are imported into the Lunagraph project and placed as the real
  components, so the user can select, edit, and reuse them.
- **As a read-only canvas in the app** at `/audit`, everywhere else. Nothing to
  install, no account. It renders the app's real components and is for looking:
  pan, zoom, hover, select.

In both places a component on the canvas is the real component. Never rebuild a
component as HTML that looks like it.

## First: where to draw

Settle this before scanning anything. Take the first case that applies.

1. **This session has Lunagraph's canvas tools** (an MCP server named
   `lunagraph`, with tools such as `canvas_add` and `canvas_read`). Draw on the
   Lunagraph canvas. Do not ask. Follow
   [reference/lunagraph-canvas.md](reference/lunagraph-canvas.md) instead of the
   page references, then continue from Phase 1.
2. **This repo already has an audit page** (an audit folder containing
   `audit.data.ts`). Continue it as the read-only page. Do not ask again.
3. **The user already said where they want it**, or you cannot ask (a
   non-interactive run). Do what they said; with nothing to go on, build the
   read-only page.
4. **Otherwise, ask once.** Use your question tool if you have one, or ask in
   plain text and wait. Keep to these three choices:

   > Where should I draw the audit?
   >
   > 1. **In Lunagraph.** On the Lunagraph canvas. Your components are imported
   >    into your Lunagraph project and placed as the real components, so you
   >    can select, edit, and reuse them. I have the app.
   > 2. **Get Lunagraph first.** Same as above, but I need to download it.
   > 3. **Read-only canvas here.** A page in this app at `/audit`. Nothing to
   >    install. Good for seeing the problem; you cannot edit from it.

What to do with the answer:

- **In Lunagraph.** You cannot draw there from this session, so hand over
  clearly and stop:
  1. Offer to open the app, and only open it once they say yes: `open -a
     Lunagraph` on macOS, or open the `com.lunagraph.desktop://` link on Windows
     and Linux. If that fails, the app is not installed: give the download
     link below.
  2. The simplest route: in Lunagraph, start a chat with this repo's folder
     attached and run the audit there.
  3. To keep using this agent instead: in Lunagraph, click "Connect external MCP
     agent", copy the command for this agent, run it in a terminal, start a
     new session in this repo, and run the audit again. Never guess the
     connection address yourself. It comes from that dialog.
- **Get Lunagraph first.** Give the download link,
  `https://lunagraph.com/docs/download-alpha`, then the same steps as above.
- **Read-only canvas here.** Carry on below.

After either Lunagraph answer, add one line: they can have the read-only canvas
in the meantime if they say so. Build it only if they do. Do not push Lunagraph
again after this; the page has its own "Edit in Lunagraph" button.

## The rules that matter most

1. **The scan decides what exists. You do not.** `scripts/scan.mjs` reads every
   file and lists every component, every prop, every variant value, every call
   site, and every hand-rolled element. You never build that list by searching
   and reading yourself, and you never trim it. Your job is the part a script
   cannot do: rendering each thing, grouping, explaining, recommending.
2. **List everything, draw the primitives, go deep only when asked.** Every
   component the scan lists is on the page by name with its counts. Every
   shared component is drawn, with every variant value. Local versions and
   hand-rolled copies are listed with counts and drawn only for a group the
   user asked to audit. Do not draw every button in the repo because buttons
   exist. Within what is in scope, nothing is sampled: the only way to leave
   something out is `omitted` or `skipped` with a reason, and it then shows on
   the page as left out.
3. **The check decides when you are done.** `scripts/check.mjs` compares what
   the audit renders against the scan, for the scope above, and lists every
   gap. You are finished when it prints "Everything required is shown", not
   before.
4. **Audit, do not refactor.** Never edit existing components, styles, tokens,
   or config. For the read-only page, the only files you write are in the audit
   folder; if the router needs the route registered by hand, that one line is
   the only exception, and you say so in your report.
5. **Render the real thing.** A specimen is the app's actual component: imported
   from its real module on the `/audit` page, imported into the project and
   placed as a component on the Lunagraph canvas. Never a `div` with the
   component's classes copied onto it. If a component cannot be rendered for
   real, say so in its place and in the report; do not fake it. A hand-rolled
   specimen is different, because the source itself is raw markup: copy the JSX
   from the location the scan gives, with its classes exactly as written.
6. **Never invent content.** What is inside a specimen is copied from one real
   usage in this codebase, and the specimen says which. The dropdown on the
   page is a dropdown that exists in the app, with its real items; the button
   says what a real button says. The user must be able to look at any specimen
   and recognise it. Text you made up reads to them as a lie, however
   plausible it is. See "Where content comes from" below. The check enforces
   this.
7. **Show the component as written, and flag every override.** A specimen is
   the component the way its file defines it. A call site that passes
   `className` to restyle it (`rounded-full` over the component's own
   `rounded-lg`, a new background, `[&_svg]:` reaching inside) is an
   **override**: a finding, not the component. Never copy one onto a specimen,
   or every variant on the page inherits a look that one call site added. The
   scan finds every override and the page draws each one, on the real
   component, in an "Overridden" section under it. Placement classes (margin,
   width, position, flex and grid placement) are the parent's business and are
   not overrides. The check enforces this.
8. **Read-only page: use the bundled files.** `canvas/AuditPage.tsx` and
   `canvas/AuditCanvas.tsx` are the whole page. Copy them in unchanged. You do
   not write page layout, pan and zoom, or styles.
9. **Read-only page: dev only.** The page must not ship. Guard it so it returns
   not-found in production builds. Do not commit anything unless the user asks.

## Phase 0: Scan

The scripts are in this skill's folder, under `scripts/`. They need Node 18 or
later and change nothing in the repo.

1. Find the framework and router, the dev command and port, and where the
   audit folder goes (see [reference/audit-page.md](reference/audit-page.md)).
   This skill is written for React apps.
2. Run the scan, writing into the audit folder:

   ```sh
   node <skill>/scripts/scan.mjs --root . --out <audit folder>/audit.scan.json
   ```

   It prints a summary. Read it before going on:
   - **Shared UI directories.** It guesses these from directory names
     (`components/ui`, `packages/ui/src/components`, ...). If the guess is
     wrong or empty, run again with `--ui <dir>` for each real one. Everything
     else depends on this being right.
   - **No parser.** It needs a TypeScript package with the classic parser API
     and looks in the repo. If it cannot find one it prints one `npm install`
     command that installs a parser outside the repo. Run that, then scan
     again.
3. For the read-only page, copy `AuditPage.tsx` and `AuditCanvas.tsx` in, write
   the route, a `specimens` file, and `audit.data.json` with the project name.
4. Let the script write every specimen it can:

   ```sh
   node <skill>/scripts/specimens.mjs --root . --audit <audit folder>
   ```

   It writes `specimens.generated.tsx`: for each shared component with a call
   site that stands on its own (literal props, written-out text, imported
   parts), that call site copied as written, with its location. It prints the
   components it could not do. Spread `generated` into your `specimens` file.
   The page is now up with those components drawn and the rest as empty "No
   example yet" frames. Tell the user the URL now.

On the Lunagraph canvas, write the scan to a temporary file outside the repo
instead and follow [reference/lunagraph-canvas.md](reference/lunagraph-canvas.md).

### What the scan gives you

- `components`: every exported component in the shared directories, and every
  local component that is a reusable wrapper around a raw element or around a
  shared component (a competing version). For each: `id`, `kind` (the suggested
  group), `props` with types and defaults, `axes` (each variant prop with all
  its values, which are used, and which never are), `parts` for compound
  components, `uses` and `files`, `callSites` with the props passed at each,
  `combos` (which prop combinations are in use, with counts), `examples`
  (real call sites to copy content from), and `overrides`: the call sites that
  restyle it with `className`, grouped into distinct overrides. Each override
  lists the classes that **replace** one of the component's own (with the ones
  they replace), that reach **inside** it to style its children, and that
  **add** a look it does not set, plus its call sites. `placementOnly` counts
  call sites that pass only margin, width or position; those are fine. Each
  call site also lists the `routes` that render it.
- `pages`: every route the app has and the file that defines it, so the page
  can open a call site where it renders. File routes (Next.js, Gatsby, React
  Router / Remix, TanStack), routes in code (React Router), and failing those,
  the app's entry at `/`.
- `handRolled`: every raw `<button>`, `<input>`, `<select>`, `<table>`,
  `role="dialog"` and so on outside the shared directories, clustered into
  **looks** by their classes. Each look has an `id`, a `count`, every
  location, and `example.code` to copy from. `confidence: "low"` marks repeated
  look-alikes (card-like and badge-like markup); they are shown separately and
  not counted.
- `otherComponents`: every other component in the repo, with use counts. These
  are feature and page components, not design-system pieces, and are not drawn.
  Say how many there are in your report.

The `kind` is a guess from the name. Regroup with `move` in `audit.data.json`
when it is wrong, and give `other` a real label if it has a theme. Never drop a
component because it does not fit a group.

## Phase 1: Inventory

This is the default run. Keep it to this.

The script has already written the easy ones. What is left is the list it
printed: components whose every usage reads state or data. Never edit
`specimens.generated.tsx`; if one of its entries is wrong, define the same key
in your own file, which wins.

**Do the rest in parallel if you can.** If you can start sub-agents, split the
remaining components by group and give each group to one sub-agent. Each writes
its own file, `specimens/<group>.tsx`, exporting a map of entries, so no two
ever edit the same file. Give each sub-agent: the rules in this file, the
"Where content comes from" section, its components' entries from the scan
(`callSites` and `examples`), and the path to write. You merge the maps in your
`specimens` file and run the check. If you cannot start sub-agents, do them
yourself in batches of 6 to 12, saving between batches so the page fills in.

For each remaining component:

1. Pick one real usage of it (see "Where content comes from"). Add one entry to
   `specimens.components`, keyed by the scan `id`, with `from` set to that
   usage's `file:line` and a `render(props)` function that renders the real
   component the way that usage does, and **spreads `props` onto it**:

   ```tsx
   "src/components/ui/button.tsx#Button": {
     from: "app/contacts/InviteDialog.tsx:25",
     render: (props) => <Button {...props}>Send invite</Button>,
   },
   ```

   The page calls `render` once with no props, then once per variant value
   (`{ variant: "outline" }`, `{ size: "sm" }`, `{ loading: true }`). That is how
   every variant gets shown without you writing each one. If a value needs
   different content to make sense (an icon-only size needs an icon), branch on
   `props` inside `render`.
2. Compound components: the family's specimen composes its parts the way the
   usage does (`<DropdownMenu><DropdownMenuTrigger>...<DropdownMenuContent>...`).
   Every part that is used anywhere must appear in some specimen. A part with its own variants (`TabsList` with
   `variant` and `size`) gets its own entry, keyed by the part's `id`, that
   spreads `props` onto the part.

### Where content comes from

Every specimen copies one real usage. Not a typical one you imagine: one that
is in the code.

1. **Choose the usage.** The scan gives each component its `callSites` (all of
   them, with the props passed) and `examples` (the code of a few short ones).
   Prefer a usage whose content is written out in the source: literal text,
   literal props, icons. For a compound component, take one real instance
   whole: that dropdown's trigger and that dropdown's items, not items
   collected from several places. Read the file if the example is truncated.
2. **Copy it.** Same parts, same order, same text, same icons, same literal
   props. Drop event handlers. Do not tidy, shorten, rename, or improve.
   **Leave out the `className` the usage passes to restyle the component**, on
   the component and on any of its parts: those are overrides, and the page
   draws them separately (rule 7). If the component needs room to render, give
   it a plain wrapper marked as only that: `<div data-audit-room
   className="w-72">`.
3. **Stand in only for runtime data, and say so.** Where the source has a value
   that only exists when the app runs (`{project.name}`, a list mapped from
   data), use a stand-in that is the kind of thing that value is: a project
   name where a project name goes, three plausible rows where rows go. Declare
   each one in `mocks`, keyed by the expression as it appears in the source:

   ```tsx
   from: "app/projects/ProjectCard.tsx:41",
   mocks: { "project.name": "Acme rebrand" },
   render: (props) => <Card {...props}>Acme rebrand</Card>,
   ```

   A stand-in fills a hole the source has. It never adds an item, a label, or
   a state the source does not have.
4. **If no usage works, do not fill the gap.** A component that is never used,
   or whose every usage is nothing but runtime data, is omitted with that as
   the reason. Its name and counts still show.

`from` must be a call site of that component in the scan (or, for a hand-rolled
look, one of its locations). The page prints it under the specimen, so the user
can open the file and see the same thing. The check reads every specimen and
fails on any visible text that is not written in the cited file and is not a
declared stand-in for an expression in that file.

Variant rows reuse the same content with one prop changed, so they stay
recognisable. A variant no call site uses is labelled "never used" by the page.

That is all you draw. The page already lists, from the scan, every local
version by name with its uses, and how many hand-rolled elements each group has
and where. Do not write specimens for those now.

Work in batches of 6 to 12 and save, so the page fills in visibly. Then:

- Fix the grouping where the guessed `kind` is wrong (`move`, `labels`,
  `order`).
- Add up to three **next steps**, ranked by how much they would clean up: the
  group with the most versions, the most hand-rolled copies, the biggest group
  still unaudited. Each has a title, one line of reason with real numbers from
  the scan, and a prompt to copy that asks for that group's audit.

You do not write counts anywhere. The page reads them from the scan.

Run the check, report, and stop. Offer the group audits; do not start one.

## Phase 2: Group audit

Run only when the user names a group. One group per request.

1. Add the group's id to `audited` in `audit.data.json`. The page now shows
   empty tiles for that group's local versions and hand-rolled looks, and the
   check requires them.
2. **Local versions** (marked `~` in the scan summary): add a
   `specimens.components` entry for each, the same way as a shared component.
3. **Hand-rolled looks**: for each look in the group, add an entry to
   `specimens.handRolled`, keyed by the look `id`, with `from` set to the
   location you copied, that renders `example.code`: the same element with the
   same `className` and the same text, exactly as written. Drop handlers; stand
   in for runtime values as above, declared in `mocks`; keep every class. If the classes
   are built with conditions, keep the expression and make the conditions
   constants. The check compares the classes.

The group view (`/audit#<group>`) already shows, from the scan, every prop,
every combination in use, every call site, and every location of every
hand-rolled look. You add the judgement, in `details.<group id>`:

4. **Compare the versions.** Look at them side by side in the group view. For
   every version and look that differs from the one you will recommend, add
   numbered `notes` on the exact spots where it differs, with one line each
   ("Header is centred", "CTA is blue-500, not the primary token"). Numbers run
   continuously across the group.
5. **Check tokens.** For every specimen, list values that bypass the design
   system: hardcoded colours, raw palette classes where a semantic token exists
   (`bg-blue-500` beside `bg-primary`), arbitrary values (`rounded-[7px]`),
   one-off shadows. Count them.
6. **Use what the scan found.** Variant values that are never used, props that
   are never passed, parts that are never used, and every override (which call
   sites restyle the component, with which classes, replacing which of its
   own) are all in the scan. They are findings; cite them. An override that
   repeats is a variant the component is missing: name it, with its call
   sites.
7. **Write the recommendation.** `keep` is the version to keep: the one with the
   most uses that is built on tokens and behaves correctly (focus, close,
   cancel, keyboard). `headline` says which in one sentence, `reason` says why
   in one more. `stats` gives the numbers: uses to move, files touched, values
   off token, and one count for the most common behavioural gap in this group
   (for modals, "no cancel or close").
8. **Tick the steps.** `steps` lists what you did, each with a real number:
   "Found 23 uses in 19 files", "3 versions, 4 hand-rolled looks", "Rendered
   every variant", "Checked tokens, 5 off system", "Wrote recommendation".

Finish with `nextSteps` for the group: make the recommended version the source
of truth, write the handoff. Run the check again.

The next three sections, Specimens, Verify, and Continuing, are for the
read-only page. On the Lunagraph canvas, the Lunagraph reference replaces them.

## Specimens

- Import the real component from the module the app imports it from.
- **As written.** The specimen renders the component without the call site's
  restyling. The page renders each override itself by calling
  `render({ ...variantProps, className })`, so spreading `props` is what makes
  the overrides drawable too.
- **Specimens are live. Leave them as the app has them.** The user clicks a
  dropdown's trigger and it opens, types in an input, switches a tab, the way
  they would in the app. Links do not navigate and forms do not submit.
- **Do not force anything open, and do not wrap it in a box.** A dropdown,
  select, popover, or tooltip is rendered closed, with its trigger, exactly as
  the usage has it. No `open`, no `defaultOpen`, no fixed `width` and `height`,
  no portal workarounds. Its menu opens above the canvas when clicked.
- A component the usage opens from somewhere else (a dialog with `open={open}`
  and no trigger of its own) has nothing to click. Set `toggle: "open"` on its
  entry and spread `props` onto it: the page adds an Open control under it and
  passes `open` and `onOpenChange`.
- `width`, `height`, and `scale` put a specimen in a fixed box. Use them only
  for things that fill the screen and would otherwise have no size: a
  full-page loader, a full-height sidebar, a hand-rolled modal with a
  `fixed inset-0` backdrop. Never to make room for an open menu.
- A specimen that needs providers, data, or a store gets the smallest wrapper
  that makes it render. If it throws, the page shows the error in its place;
  fix it, or leave it and list it in your report. Do not remove the entry.
- The app's global styles must load on the audit route, or specimens render
  unstyled.

## Verify

Run the check until it passes:

```sh
node <skill>/scripts/check.mjs --root .
```

It rescans, so it also catches code that changed since the scan. It always
fails on: a specimen with no `from`, a `from` that is not a real usage of that
component, visible text that is not in the cited file and not a declared
stand-in, a component forced open with `open`, a shared component with no specimen, a specimen that does not render
its component, a specimen that does not spread `props` (so its variants are not
rendered), a used part that is in no specimen, a stale id, an omission without a
reason, and a bundled file that was edited. For groups in `audited` it also
fails on a local version or hand-rolled look with no specimen, and a
hand-rolled specimen whose classes differ from the source.

To leave something out on purpose, add it to `omitted` (`{ "id": ..., "reason":
... }`) or `skipped` (`{ "component", "axis", "value", "reason" }`) in
`audit.data.json`. Reasons must be real: "needs a live session to render", not
"too many". Never use these to get the check to pass faster.

Then:

- run the project's typecheck on the audit folder
- if a dev server is already running, load `/audit` and confirm it renders with
  no errors and that "N of N shown" matches the check; if none is running,
  start one only if the user would expect it, otherwise give them the command
- confirm the production guard works

## Continuing

When run again, run the scan again first: the codebase may have changed. Then
run the check and carry on from its list. Keep groups already audited. Never
create a second audit folder.

## Report

Keep it short:

- where the audit is: the URL, or the Lunagraph page
- the coverage lines from the check, in full, including "traced to source" and
  what is listed but not drawn
- every stand-in you used, with the expression it stands for
- uses, groups, versions, and hand-rolled counts, from the scan
- overrides: the "Overrides" line from the check, and for the most overridden
  components, how many of their call sites restyle them and the most common
  override (`rounded-lg → rounded-full`, 9 call sites)
- which groups look most worth a deep audit, and how to ask for one
- the three biggest findings, each with a file path
- everything in `omitted` and `skipped`, and anything that renders as an error,
  each with its reason
- how many other components the scan found that are not design-system pieces
- for the read-only page, how to remove it: delete the audit folder (and the
  one route line, if you added one)

Do not give generic design-system advice. Every finding cites a file.
