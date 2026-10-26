# Lunagraph skills

Free design skills for coding agents, from [Lunagraph](https://lunagraph.com),
the design canvas for real HTML, CSS, and React code.

Four jobs, four skills. Each one has fixed steps and a check at the end, so the
agent cannot quietly skip the part where it looks at what it made.

## Skills

| Skill | What it does |
| --- | --- |
| [`design`](skills/design/SKILL.md) | Designs a website, product UI, graphic, design system or prototype on the canvas. Writes a six-line brief first, draws two or three meaningfully different directions, picks one, and reviews it against a checklist before calling it done. |
| [`animate`](skills/animate/SKILL.md) | Storyboards a product story on the canvas, with a caption per beat, before anything moves. Then plans transitions, animates, inspects the in-between frames and the loop seam, and verifies the exports that are actually supported. |
| [`critique`](skills/critique/SKILL.md) | Reviews an existing design, animation, prototype or running UI from rendered evidence and scores it criterion by criterion. Never edits anything. |
| [`implement`](skills/implement/SKILL.md) | Builds a reviewed canvas design in your codebase with your components and tokens, then verifies the running app: routes, states, themes, a width sweep, and real before-and-after captures for a PR. |

They are separate on purpose. Ask for the one you want. A critique does not
turn into a redesign, and a design does not turn into a PR, unless you ask.

## Install

### Claude Code

```
/plugin marketplace add lunagraph/lunagraph-skills
/plugin install lunagraph@lunagraph-skills
```

### Codex, Cursor and other agents

```sh
npx skills add lunagraph/lunagraph-skills
```

Or one skill:

```sh
npx skills add lunagraph/lunagraph-skills --skill critique
```

### By hand

```sh
git clone https://github.com/lunagraph/lunagraph-skills
cp -R lunagraph-skills/skills/* ~/.claude/skills/
```

## Use

```
/lunagraph:design a pricing page for this app, two directions
/lunagraph:animate the launch story for agents
/lunagraph:critique the checkout flow at localhost:3000
/lunagraph:implement the pricing page from the canvas
```

Outside Claude Code, ask in plain words: "design a pricing page, two
directions", "critique the checkout flow".

`design`, `animate` and `implement` need a canvas. In a Lunagraph chat they
draw directly. In a terminal agent they hand over: start a chat in Lunagraph
with your repo's folder attached, or click "Connect external MCP agent" in
Lunagraph and run the command it gives you. `critique` works anywhere, from
screenshots or a running app.

## Contributing

Each skill is a folder under `skills/` with a `SKILL.md`: YAML frontmatter
(`name`, `description`) followed by the instructions. The folder name must match
`name`. Under `references/` each skill carries the visual checklist and the
rating criteria it uses, so it can be installed on its own.
