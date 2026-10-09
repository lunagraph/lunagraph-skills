# The audit page

One dev-only route in the user's app. The page itself ships with this skill:
you copy two files in unchanged and supply three inputs.

| Input | What it is | Who writes it |
| --- | --- | --- |
| `audit.scan.json` | Everything that exists: components, props, variants, call sites, hand-rolled looks | `scripts/scan.mjs`. Never edited by hand. |
| `specimens.tsx` | One render function per component and per hand-rolled look | You |
| `audit.data.json` | Judgement: grouping, captions, recommendations, omissions | You |

The page lists every component in the scan by name. It draws the shared
components, and, for groups named in `audited`, the local versions and
hand-rolled looks too. Anything it should draw that has no specimen yet is an
amber "No specimen" tile and lowers the "N of N shown" count in the top bar, so
nothing in scope can be silently absent.

## Where the files go

Keep everything in one folder so removing the audit is one delete.

| Stack | Folder | Route |
| --- | --- | --- |
| Next.js app router | `app/audit/` (or `src/app/audit/`) | `page.tsx` in that folder |
| Next.js pages router | `src/audit/` (outside `pages/`) | `pages/audit.tsx` that re-exports the page |
| Vite or CRA with a router | `src/audit/` | one route added to the router for `/audit` |
| TanStack Router, Remix, React Router framework mode | `src/audit/` or `app/audit/` | a route file that re-exports the page |

Files in the folder:

- `AuditPage.tsx`, `AuditCanvas.tsx`: copied from this skill's `canvas/`
  folder, unchanged. In a JavaScript project copy the `.jsx` pair instead.
- `audit.scan.json`: written by the scan.
- `specimens.generated.tsx`: written by `scripts/specimens.mjs`. Not edited.
- `specimens.tsx`: yours. Spreads `generated` and adds the ones the script
  could not write. With sub-agents, also `specimens/<group>.tsx`, one each.
- `audit.data.json`: yours.
- the route component: yours, a few lines.

Do not add the audit folder to `.gitignore`; the scan needs to see it. Do not
commit it either unless the user asks.

## The route

```tsx
import { notFound } from "next/navigation";
import { AuditPage, type AuditData, type AuditScan } from "./AuditPage";
import data from "./audit.data.json";
import scan from "./audit.scan.json";
import { specimens } from "./specimens";

export default function Audit() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AuditPage scan={scan as unknown as AuditScan} specimens={specimens} data={data as AuditData} />;
}
```

- **Production guard.** In production the route returns not-found (`notFound()`
  in Next.js, a 404 or redirect elsewhere). Check `NODE_ENV` or the framework's
  own dev flag.
- **Next.js app router.** `specimens.tsx` holds functions, which cannot cross
  from a server component. Put the three imports and `<AuditPage>` in a client
  component (`"use client"`) and keep `page.tsx` as the server component that
  does the guard and renders it.
- **JSON imports.** If the typecheck rejects them, the project lacks
  `resolveJsonModule`. Do not change the tsconfig. Add `audit.json.d.ts` in the
  audit folder: `declare module "*.json" { const value: unknown; export default value; }`.
- **Global styles.** The app's global stylesheet must load on this route, or
  specimens render unstyled. In Next.js the root layout does it. Elsewhere,
  make sure the route sits under the root that imports the global CSS.
- **Views.** The page uses the URL hash: `/audit` is the inventory,
  `/audit#modals` is one group. There is nothing to wire up.

## `specimens.tsx`

```tsx
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { AuditSpecimens } from "./AuditPage";
import { generated } from "./specimens.generated";

export const specimens: AuditSpecimens = {
  components: {
    ...generated,
    // Same key as a generated entry: this one wins.
    "src/components/ui/button.tsx#Button": {
      from: "app/contacts/InviteDialog.tsx:25",
      render: (props) => <Button {...props}>{props.size === "icon" ? <PlusIcon /> : "Send invite"}</Button>,
    },
    // Opened by state the usage keeps elsewhere, so the page adds an Open control.
    "src/components/ui/dialog.tsx#Dialog": {
      from: "app/contacts/InviteDialog.tsx:18",
      toggle: "open",
      render: (props) => (
        <Dialog {...props}>
          <DialogContent>
            <DialogTitle>Invite teammates</DialogTitle>
          </DialogContent>
        </Dialog>
      ),
    },
  },
  handRolled: {
    "buttons-af2e0cef": {
      from: "app/contacts/page.tsx:212",
      render: () => <button className="rounded bg-red-600 px-3 py-1 text-white">Delete</button>,
    },
  },
};
```

- **Keys are scan ids**, copied exactly: `"<file>#<Name>"` for components,
  `"<kind>-<hash>"` for hand-rolled looks.
- **`from` is required**: the `file:line` of the real usage this specimen copies.
  It must be one of that component's call sites in the scan, or one of that
  look's locations. The page prints it under the specimen.
- **`mocks`** declares every stand-in for a value that only exists at runtime,
  keyed by the expression as written in the source:
  `mocks: { "project.name": "Acme rebrand" }`. All other visible text must be
  written in the cited file. The check enforces both.
- **`render(props)` must spread `props` onto the component.** The page calls it
  with `{}`, then with one variant value at a time, then once per override with
  `{ ...variantProps, className }`. Without the spread, the variants and the
  overrides are not rendered and the check fails.
- **As written.** Leave out the `className` the cited usage passes to restyle
  the component or its parts. The check fails a specimen that copies one. If a
  component needs room, wrap it in `<div data-audit-room className="w-72">`:
  the marker tells the page the wrapper is not the component.
- **Specimens are live.** A dropdown is rendered closed with its trigger and
  opens when the user clicks it. Do not pass `open` to make something show.
- **`toggle`** is for a component with nothing to click: the usage opens it from
  state kept elsewhere. Name that prop (`toggle: "open"`); the page adds an Open
  control and passes `open` and `onOpenChange` through `props`.
- **`width`, `height`, `scale`** put a specimen in a fixed box. Only for things
  that fill the screen and would otherwise have no size: a full-page loader, a
  full-height sidebar, a hand-rolled modal with a `fixed inset-0` backdrop.
  Never to make room for an open menu.
- **One file is fine** until it is long; then split by group and merge the
  objects. The check reads every file in the audit folder.

## `audit.data.json`

Everything is optional. An empty object gives a complete inventory, grouped by
the scan's suggested kinds.

```ts
type AuditData = {
  project?: string;                      // shown in the top bar
  status?: string;                       // "Scanned", "Auditing modals", "Audit finished"
  audited?: string[];                    // group ids the user asked to audit in depth
  labels?: Record<string, string>;       // group id to label, when the default is not right
  move?: Record<string, string>;         // component or look id to group id, to regroup
  order?: string[];                      // group ids in display order
  omitted?: { id: string; reason: string }[];
  skipped?: { component: string; axis: string; value: string | number | boolean; reason: string }[];
  captions?: Record<string, string>;     // one line under a component or look, by id
  details?: Record<string, GroupDetail>; // the deep audit of a group, by group id
  nextSteps?: NextStep[];                // inventory "What next" card, at most 3
  coverage?: unknown;                    // written by check.mjs. Do not edit.
};

type GroupDetail = {
  steps?: { label: string; done: boolean }[];  // "Found 23 uses in 19 files", ...
  keep?: string;                               // component id of the version to keep
  headline?: string;                           // "Keep Dialog. Retire the other 6."
  reason?: string;                             // one sentence
  stats?: { label: string; value: number | string }[];
  notes?: Record<string, { n: number; text: string; x: number; y: number }[]>; // by component or look id; x, y as % of the specimen
  nextSteps?: NextStep[];
};

type NextStep = { title: string; reason: string; prompt: string };
```

There are no counts in this file. The page takes every number from the scan.

## What the page shows

You do not build any of this; it is here so you know what your inputs produce.

**Sidebar** (fixed, on the left)

- Project and URL, the number of components, and how many issues are open.
- Every group, with every component under it and its use count. Coloured dots
  next to a name show which kinds of issue it has. A caret opens its list of
  issues; clicking one takes the canvas there. Each can be copied as a prompt
  or marked resolved. Resolved issues are kept in the browser and their pins
  disappear.
- A "Raw elements" row per group that has any, with one issue per look.
- Coverage ("N of N shown") and the file count at the bottom.

**Issues.** Four kinds, each with one colour, all found by the scan:

| Status | Colour | Means |
| --- | --- | --- |
| Raw | rose | Plain HTML styled in place, with no component |
| Custom | amber | A component outside the design system that does the job of one in it |
| Overridden | orange | A design system component restyled with className where it is used. One issue per distinct override. Margin, width and position do not count |
| Unused | grey | A component, part, or variant value that nothing uses |

**Canvas** (grey, with a white page per component)

- A legend of the four statuses at the top.
- One block per group, one page per shared component: name, uses and files,
  `path:line`, then two numbered sections.
  - **1 Component**: the component as written, large, with its source
    location; then one frame per variant prop with a specimen for every value
    and how many call sites pass it.
  - **2 Overridden** (only when call sites restyle it): "11 of 13 call sites
    restyle Button" with a meter, then one tile per distinct override, most
    used first. Each tile has two columns with a divider: **Original**, the
    component as written with the call site's variant props, and
    **Overridden**, the same component with the call site's classes. Under them: the count and one line per class (`rounded-lg →
    rounded-full` replaces, `+ bg-card` adds, `↳ [&_svg]:…` reaches inside, `if`
    when conditional). Four show; "Show all" opens the rest. Parts' overrides
    are in the same section, labelled with the part.
  - **The inspector** opens on the right, styled like Lunagraph's Inspect tab,
    at one of three scopes. Click a tile for **one override**; click the
    Overridden summary for **every override of that component** (and its
    parts); click Overridden in the legend for **every override in the
    codebase**. Pills at the top widen or narrow the scope. For one override
    it shows the **CSS** that differs between the two columns, measured in the
    browser (`border-radius: 10px → 9999px`), and its **Classes**. At every
    scope it lists the **Pages** that render the scope's call sites, with how
    many each, and every **Call site**, numbered and grouped by override.
    One override is one exact set of classes, so with one override open, the
    component's other overrides that share a class with it (the same
    `rounded-full`, plus a shadow) are listed and marked too, lighter, as
    **related**: nothing that looks the same goes unmarked.
  - **A page** opens live in a panel over the canvas and the sidebar (× Close
    or Esc closes it), at a real viewport width
    (Desktop 1440, Laptop 1280, Tablet 768, Mobile 390), scaled to fit. Every
    call site of the scope that renders on it is marked: a dashed outline and
    a pin with its number from the inspector. A call site inside a `.map()`
    marks every element it renders. Clicking a pin opens a short note saying
    what is overridden there; one note at a time, closed by a click anywhere
    else or Esc. A container (a tab panel, a section) gets a faint outline and
    its pin inside its corner, so it does not drown the controls inside it. Clicking a call site opens its page scrolled to it, drawn
    solid. Call sites that are not on the page as it loads (a closed menu, an
    empty state) are listed by number.
    Marking starts as soon as the page's HTML is in, without waiting for its
    images, and keeps looking for a few seconds while the page settles.
  - Elements are found by the override's classes, the call site's literal
    attributes (`aria-label`, `title`, …), and the component's identity: its
    root `data-slot`, or three of its own visual classes.
  - **Open in a tab** opens `/audit?view=page&inspect=…&route=…`: the same page
    filling the window, at its real size, with the same marks. It lives in the
    audit folder, so the app itself is never touched.
  - Routes come from `pages` in the scan: file routes (Next.js app and pages
    routers, Gatsby, React Router / Remix `app/routes`, TanStack
    `createFileRoute`), routes written in code (React Router `<Route>` and
    `createBrowserRouter`), and failing those, the app's entry at `/`.
  - The state is in the URL: `?inspect=<override id | component:<id> | all>`,
    `&route=…` for the open page, `&site=<file:line>` for the call site in
    focus. A link reopens exactly that view.
  - Then its parts with use counts.
- Issues are pins on the exact page, variant label, or Overridden section they
  are about. Pins stay
  the same size at any zoom. Hovering one explains it, with Copy prompt and
  Resolve.
- Custom versions and raw elements are listed on a "Listed" page per group, not
  drawn, until that group is audited.
- The bottom bar has the select and hand tools, and next to it a filter: Raw,
  Custom, Overridden, Unused, All, None.

**Group view** (`/audit#modals`)

The same group at full size, plus for every component: every prop with its
type, default, and how often it is passed; every prop combination in use;
every call site with the props passed. With `audited`, its custom versions and
raw looks are drawn. With `details`: numbered markers and captions on the
specimens, the checklist, and the recommendation card with its stats.

## Prompts

A next-step prompt must work when pasted into a fresh agent session, so it
carries its own facts.

- To audit a group: when this skill is installed as a Claude Code plugin, the
  prompt is the command, for example `/lunagraph:audit modals`. Anywhere else,
  a plain sentence: "Audit the modals in this repo with the Lunagraph audit
  skill."
- To act on a recommendation, write the instruction out in full with the
  component to keep, the components to replace, and the files:
  "Replace CampaignModal (3 uses), Popup (2 uses), and the 4 hand-rolled modals
  with Dialog from components/ui/dialog.tsx. Files: ..."
- "Write the handoff": a prompt asking for a short markdown note with the
  recommendation, the list of uses to move, and the off-token values.
