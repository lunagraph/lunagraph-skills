# Lunagraph skills

Free agent skills from [Lunagraph](https://lunagraph.com), the design canvas for
real HTML, CSS, and React code.

They run in your own repo with your own coding agent. You do not need Lunagraph
installed: without it, the audit is a read-only canvas inside your app. With
it, the same audit is drawn on the Lunagraph canvas, where everything in it can
be edited. The skill asks which you want the first time.

## Skills

| Skill | What it does |
| --- | --- |
| [`audit`](skills/audit/SKILL.md) | Scans the whole codebase, lists every component with its uses, and shows your shared primitives as the real components with every variant. Ask for one group ("audit the buttons") to go deep: every local wrapper, every hand-rolled copy, every call site, and a recommendation. A script does the counting, so nothing is estimated. |

## Install

### Claude Code

```
/plugin marketplace add lunagraph/lunagraph-skills
/plugin install lunagraph@lunagraph-skills
```

### Codex and other agents

```sh
npx skills add lunagraph/lunagraph-skills
```

### By hand

```sh
git clone https://github.com/lunagraph/lunagraph-skills
cp -R lunagraph-skills/skills/audit ~/.claude/skills/
```

## Use

Open your agent in the repo you want to audit.

```
/lunagraph:audit
```

It scans the codebase and adds a dev-only page to your app. Open
`localhost:3000/audit` (your port may differ) to see the inventory.

Then go deep on one group:

```
/lunagraph:audit modals
```

That draws every local version and hand-rolled copy of your modals side by
side, lists every call site, marks where they differ, and recommends which one
to keep. The first run does not do this for every group; you choose which ones
are worth it.

Outside Claude Code, ask in plain words: "audit the design system in this
repo", then "audit the modals".

The audit only adds its own folder. It does not change your components. To
remove it, delete that folder.

## Contributing

Each skill is a folder under `skills/` with a `SKILL.md`: YAML frontmatter
(`name`, `description`) followed by the instructions. The folder name must match
`name`.

What ships inside the audit skill:

- `scripts/scan.mjs` reads every source file and writes what exists as JSON.
- `scripts/specimens.mjs` writes a specimen for every component that has a
  self-contained call site, copied as written.
- `scripts/check.mjs` compares what the audit renders against the scan, and
  rejects content that is not from the codebase.
- `canvas/AuditPage.tsx` is the whole audit page, driven by the scan.
- `canvas/AuditCanvas.tsx` is the pan-and-zoom canvas the page sits on.

To work on them:

```sh
cd playground
npm install
npm run dev     # the audit page for a small fake app in playground/fixture
npm run check   # scanner and checker tests, then the page and canvas in your installed Chrome
```

`/?canvas` in the playground shows the canvas on its own. The `.jsx` copies in
`canvas/` are generated from the `.tsx` files by `npm run sync`.
