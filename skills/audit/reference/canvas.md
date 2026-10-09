# The canvas

The audit page is a pan-and-zoom canvas. It ships with this skill as
[`canvas/AuditCanvas.tsx`](../canvas/AuditCanvas.tsx), and the bundled
`AuditPage.tsx` is built on it.

**You do not write against this file.** You copy it into the audit folder
unchanged, next to `AuditPage.tsx`, and the page uses it. This reference is here
so you know what the user can do on the canvas and how a specimen is contained,
which matters when one does not render the way you expect. It needs React 18 or
19 and nothing else. In a JavaScript project, copy the `.jsx` pair instead.

## What it gives you

```tsx
import { AuditCanvas, CanvasPanel, CanvasSpecimen, useAuditCanvas } from "./AuditCanvas";

export default function AuditPage() {
  return (
    <AuditCanvas
      id="inventory"
      topLeft={<CanvasPanel>Design system audit</CanvasPanel>}
      topRight={<CanvasPanel>Scanned 412 files</CanvasPanel>}
      bottomRight={<CanvasPanel>What next</CanvasPanel>}
    >
      {/* Everything here pans and zooms. */}
      <section data-canvas-id="buttons" data-canvas-select="Buttons">
        <CanvasSpecimen name="Button">
          <Button>Send invite</Button>
        </CanvasSpecimen>
      </section>
    </AuditCanvas>
  );
}
```

### `<AuditCanvas>`

Takes over the whole window. Its children are the canvas content; the slots are
fixed overlays that stay put while the content moves.

| Prop | What it is |
| --- | --- |
| `id` | Names the view. The position is remembered per id for the browser session, and changing the id refits. Use one id per view: `"inventory"`, `"modals"`. |
| `children` | Content that pans and zooms. |
| `topLeft`, `topRight`, `bottomRight` | Fixed overlays. |
| `dock` | Extra content in the bottom-centre dock, after the tool buttons. |
| `inset` | Space kept clear around content when fitting. Default `{ top: 96, right: 40, bottom: 104, left: 40 }`. Raise `right` if a tall side panel sits in an overlay. |
| `onSelect` | Called with `{ label, id, element }` when something is selected, and `null` when the selection clears. |

Built in, nothing for you to add: the select and hand tools, the zoom control
(bottom left), hover outlines, selection, and all input handling.

| Input | Does |
| --- | --- |
| Scroll, two-finger swipe | Pan |
| Pinch, or Ctrl / Cmd + scroll | Zoom around the cursor |
| Hand tool (`H`), hold `Space`, or middle-drag | Drag to pan |
| `V` | Back to the select tool |
| `+` `-` | Zoom in and out, toward the pointer |
| `0` | 100% |
| `1` | Fit everything |
| Hover | Outlines what is under the pointer, with its name |
| Click | Selects it. Click empty canvas or press `Escape` to clear |
| Touch | One finger pans, two fingers pinch, tap selects |

With the select tool, everything on the canvas is live: specimens can be
clicked and tried. With the hand tool, content ignores the pointer and nothing
is outlined.

### Hover and selection

Anything with a `data-canvas-select` attribute gets a blue outline and a name
tag on hover, and can be selected with a click. The attribute's value is the
name shown.

- Every `<CanvasSpecimen>` is selectable already, named by its `name`.
- Add `data-canvas-select="Modals"` to each group block, so hovering a group's
  header or tile outlines the whole group. A specimen inside it still wins when
  the pointer is over the specimen.
- Do not draw your own hover or selected borders on these. The canvas draws
  them, at the same stroke width at every zoom level.

Text on the canvas cannot be selected by dragging, so a drag never paints a
selection across the page. Put `data-canvas-text` on text worth copying, such
as a file path.

The canvas opens fitted to the content's width and keeps refitting while
content is still arriving, until the user moves it. So you can write the page
group by group and it stays framed.

### Laying out content

Content is ordinary HTML in normal flow, measured at 100% zoom. There is no
coordinate system and nothing to position by hand.

- The content area has no width limit, so nothing wraps on its own. Give your
  top-level layout an explicit width (around 1400 to 1800px) if rows should
  wrap.
- Put `data-canvas-id="<group id>"` on each group block so it can be brought
  into view.
- The canvas root sets no font or text colour, on purpose: specimens must keep
  inheriting the app's own. Set the font and colour of your audit chrome
  yourself, in the page stylesheet.

### `<CanvasPanel>`

A floating white card for overlay content: the title bar, the status, the "What
next" card, the side panels in the group view. Takes `className` and `style`.

### `<CanvasSpecimen>`

The page wraps every render in one. It:

- keeps the component live: it can be clicked, typed in, and opened, as in the
  app. Links inside it do not navigate and forms do not submit, so trying one
  never leaves the page
- outlines it on hover and lets it be selected, in the component colour
- catches render errors and shows the component name and the message in place
  of the specimen, so one broken component does not take the page down

Menus, popovers, and dialogs that the app renders into `document.body` open
above the canvas with no extra work. Do not redirect portals, and do not force
anything open.

| Prop | What it is |
| --- | --- |
| `name` | The component name. Shown on hover, and if the specimen fails to render. |
| `id` | Sets `data-canvas-id`, so `focus(id)` and `select(id)` can find the specimen. |
| `width`, `height` | Puts the specimen in a fixed box that contains `position: fixed` content. Only for raw markup that positions itself against the screen, such as a hand-rolled modal with a full-screen backdrop. Not for components. |
| `scale` | Shrinks a boxed specimen. |
| `interactive` | Set `false` to make one specimen look-only. |
| `selectable` | Set `false` to leave a specimen out of hover and selection. |

With the hand tool, or while Space is held, specimens do not take clicks: the
drag pans.

### `useAuditCanvas()`

For anything rendered inside `<AuditCanvas>`, content or overlay:

```tsx
const { focus, select, selection, fit, zoom, zoomIn, zoomOut, zoomTo, tool, setTool } = useAuditCanvas();

<button onClick={() => focus("modals")}>Modals</button>
```

`focus(id)` pans and zooms to the element with that `data-canvas-id`. Use it for
the inventory rows. `select(id)` selects it, and `selection` is what is
selected now.

`zoom` updates once movement settles, not on every frame. That is deliberate:
nothing in React re-renders while the canvas is moving. Do not work around it
by tracking the camera yourself.

### Styling the chrome

The canvas defines CSS variables on its root. Build the audit page's own chrome
with them so everything matches:

`--lgac-bg`, `--lgac-surface`, `--lgac-border`, `--lgac-text`, `--lgac-muted`,
`--lgac-hover`, `--lgac-accent`, `--lgac-amber`, `--lgac-amber-bg`,
`--lgac-radius`, `--lgac-shadow`, `--lgac-font`, `--lgac-mono`.

The tile behind a specimen should use the app's own page background, not
`--lgac-surface`, when the app is dark or tinted, so the specimen is seen on the
surface it was designed for.

## Framework notes

- **Next.js app router**: `AuditCanvas.tsx` already starts with `"use client"`.
  Keep `page.tsx` a server component that does the production guard, and render
  a client component that uses the canvas.
- **The app's layout wraps the page** (nav, sidebar): fine. The canvas is fixed
  to the window and sits above it.
- **Global styles**: the app's global stylesheet must load on the audit route,
  or specimens render unstyled. In Next.js the root layout does this. In a Vite
  app, the route must be inside the same root that imports the global CSS.
