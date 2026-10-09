// Tests for the scanner and the coverage checker, run against the fixture app.
// Run with `npm run check` (which syncs the fixture first), or `node scan.test.mjs`.
import assert from "node:assert/strict";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { checkCoverage } from "../skills/audit/scripts/check.mjs";
import { classifyOverride, scanRepo } from "../skills/audit/scripts/scan.mjs";
import { generateSpecimens } from "../skills/audit/scripts/specimens.mjs";

let passed = 0;
const test = (name, run) => {
  try {
    run();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    console.log(`FAIL ${name}\n     ${String(error.message).split("\n").join("\n     ")}`);
    process.exitCode = 1;
  }
};

const scan = scanRepo({ root: new URL("./fixture", import.meta.url).pathname });
const component = (name) => scan.components.find((candidate) => candidate.name === name);
const axis = (name, axisName) => component(name).axes.find((candidate) => candidate.name === axisName);

test("finds the shared UI directory", () => {
  assert.deepEqual(scan.sharedDirs, ["src/components/ui"]);
});

test("finds every shared component, including one built without JSX", () => {
  const shared = scan.components.filter((candidate) => candidate.shared && !candidate.part).map((candidate) => candidate.name);
  assert.deepEqual(shared.sort(), ["Badge", "Button", "Dialog", "Text"]);
});

test("groups compound components into a family", () => {
  const dialog = component("Dialog");
  assert.deepEqual(dialog.parts.map((id) => id.split("#")[1]).sort(), ["DialogContent", "DialogFooter", "DialogTitle"]);
  assert.equal(component("DialogContent").part, true);
  assert.equal(component("DialogContent").kind, "modals");
});

test("reads variants from a cva call, with defaults", () => {
  assert.deepEqual(axis("Button", "variant").values, ["default", "outline", "ghost", "destructive"]);
  assert.equal(axis("Button", "variant").default, "default");
  assert.deepEqual(axis("Button", "size").values, ["default", "sm", "icon"]);
});

test("reads variants from a string union, `keyof typeof`, and booleans", () => {
  assert.deepEqual(axis("Badge", "tone").values, ["neutral", "success", "warning"]);
  assert.equal(axis("Badge", "tone").default, "neutral");
  assert.deepEqual(axis("Text", "size").values, ["sm", "md", "lg"]);
  assert.deepEqual(axis("Text", "as").values, ["p", "span"]);
  assert.equal(axis("Text", "muted").kind, "boolean");
  assert.equal(axis("Button", "loading").required, true);
});

test("counts call sites through a path alias and a barrel file, not counting tests or the library itself", () => {
  assert.equal(component("Button").uses, 8);
  assert.equal(component("Button").files, 3);
  assert.equal(component("Badge").uses, 2);
  assert.equal(component("DialogFooter").uses, 0);
});

test("records which values are passed, and which never are", () => {
  assert.equal(axis("Button", "variant").used.outline, 3);
  // "ghost" only appears inside a ternary, which still counts as used.
  assert.deepEqual(axis("Button", "variant").neverUsed, ["destructive"]);
  assert.equal(component("Button").propUsage.loading.dynamic, 1);
  assert.ok(component("Button").combos.some((combo) => combo.props.variant === "outline" && combo.props.size === "sm" && combo.count === 2));
});

test("sees a local wrapper as a competing version, without re-demanding inherited variants", () => {
  const wrapper = component("IconButton");
  assert.equal(wrapper.shared, false);
  assert.equal(wrapper.kind, "buttons");
  assert.equal(wrapper.wrapsComponent, component("Button").id);
  assert.equal(axis("IconButton", "active").required, true);
  assert.equal(axis("IconButton", "variant").required, false);
  assert.equal(axis("IconButton", "size"), undefined); // removed with Omit
});

test("clusters hand-rolled elements by look, ignoring class order and the library's own markup", () => {
  const looks = scan.handRolled.filter((look) => look.confidence === "high");
  assert.equal(looks.length, 4);
  const danger = looks.find((look) => look.signature === "px-3 py-1 raw-danger rounded");
  assert.equal(danger.count, 3);
  assert.equal(danger.files, 2);
  assert.equal(looks.find((look) => look.kind === "inputs").example.code, '<input className="raw-input" placeholder="Search contacts" />');
  assert.equal(looks.filter((look) => look.kind === "modals").length, 1);
});

test("keeps the audit folder out of the counts, but reads what it renders", () => {
  assert.deepEqual(scan.auditDirs, ["src/audit/"]);
  assert.ok(scan.audit.usages.some((usage) => usage.component === component("Button").id && usage.spread));
  assert.ok(scan.audit.keys.includes(component("Button").id));
  assert.ok(!scan.components.some((candidate) => candidate.callSites.some((site) => site.file.startsWith("src/audit/"))));
});

const everyGroup = { audited: ["buttons", "modals", "inputs", "badges", "typography"] };

test("by default the checker requires the shared primitives only", () => {
  const bare = { ...scan, audit: { ...scan.audit, keys: scan.audit.keys.filter((key) => key.startsWith("src/components/ui/")) } };
  const result = checkCoverage(bare, {});
  assert.equal(result.ok, true, JSON.stringify(result.missing));
  assert.deepEqual(result.coverage.entries, { shown: 4, of: 4 });
  assert.equal(result.coverage.variants.required, 19);
  assert.deepEqual(result.coverage.listedOnly, { localVersions: 1, handRolledLooks: 4, handRolledElements: 6 });
});

test("auditing a group makes its local versions and hand-rolled looks required", () => {
  const bare = { ...scan, audit: { ...scan.audit, keys: scan.audit.keys.filter((key) => key.startsWith("src/components/ui/")) } };
  const result = checkCoverage(bare, { audited: ["buttons"] });
  assert.equal(result.ok, false);
  assert.equal(result.missing.components.length, 1); // IconButton
  assert.equal(result.missing.handRolled.length, 2); // the two raw button looks, not the input or the modal
});

test("checker passes when every group is audited and everything has a specimen", () => {
  const result = checkCoverage(scan, everyGroup);
  assert.equal(result.ok, true, JSON.stringify(result.missing));
  assert.deepEqual(result.coverage.entries, { shown: 9, of: 9 });
  assert.equal(result.coverage.variants.required, 20);
});

test("checker flags an audited group that does not exist", () => {
  assert.equal(checkCoverage(scan, { audited: ["butons"] }).missing.stale.length, 1);
});

test("checker reports a component with no specimen, and its variants", () => {
  const id = component("Badge").id;
  const result = checkCoverage({ ...scan, audit: { ...scan.audit, keys: scan.audit.keys.filter((key) => key !== id) } }, {});
  assert.equal(result.ok, false);
  assert.equal(result.missing.components.length, 1);
  assert.equal(result.missing.variants.length, 3);
});

test("checker reports a specimen that does not spread its props", () => {
  const id = component("Button").id;
  const usages = scan.audit.usages.map((usage) => (usage.component === id ? { ...usage, spread: false } : usage));
  const result = checkCoverage({ ...scan, audit: { ...scan.audit, usages } }, {});
  assert.equal(result.missing.variants.length, 8); // 4 variants + 3 sizes + loading
});

test("checker reports a hand-rolled specimen whose classes were changed", () => {
  const elements = scan.audit.elements.filter((element) => element.signature !== "raw-link");
  const result = checkCoverage({ ...scan, audit: { ...scan.audit, elements } }, everyGroup);
  assert.equal(result.missing.handRolled.length, 1);
  assert.match(result.missing.handRolled[0].text, /does not have this look/);
});

test("checker accepts an omission only with a reason", () => {
  const id = component("Badge").id;
  const without = { ...scan, audit: { ...scan.audit, keys: scan.audit.keys.filter((key) => key !== id) } };
  assert.equal(checkCoverage(without, { omitted: [{ id, reason: "Being deleted next sprint" }] }).ok, true);
  assert.equal(checkCoverage(without, { omitted: [{ id, reason: "" }] }).ok, false);
});

test("checker flags a specimen keyed by an id that no longer exists", () => {
  const result = checkCoverage({ ...scan, audit: { ...scan.audit, keys: [...scan.audit.keys, "src/components/ui/gone.tsx#Gone"] } }, {});
  assert.equal(result.missing.stale.length, 1);
});

test("traces every specimen's text to the usage it cites", () => {
  assert.equal(scan.audit.specimens.length, 11); // 4 written by the script, 7 by hand
  for (const specimen of scan.audit.specimens) {
    assert.equal(specimen.fromOk, true, `${specimen.key} cites ${specimen.from}`);
    assert.deepEqual(specimen.unsourced, [], specimen.key);
    assert.deepEqual(specimen.badMocks, [], specimen.key);
  }
  const result = checkCoverage(scan, everyGroup);
  assert.deepEqual(result.coverage.sources, { specimens: 11, traced: 11 });
});

// A copy of the fixture whose specimens have been tampered with, to prove the scanner notices.
const tampered = (edit) => {
  const copy = new URL(`./.check/tampered-${Math.random().toString(36).slice(2)}`, import.meta.url).pathname;
  cpSync(new URL("./fixture", import.meta.url).pathname, copy, { recursive: true });
  const file = `${copy}/src/audit/specimens.tsx`;
  writeFileSync(file, edit(readFileSync(file, "utf8")));
  const result = scanRepo({ root: copy });
  rmSync(copy, { recursive: true, force: true });
  return result;
};

test("catches invented content: text that is not in the cited file", () => {
  const scanned = tampered((source) => source.replace("<DialogTitle>Invite teammates</DialogTitle>\n            <Button>Send invite</Button>\n          </DialogContent>\n        </Dialog>\n      ),\n    },\n    \"src/components/ui/dialog.tsx#DialogContent\"", "<DialogTitle>Rename file</DialogTitle>\n            <Button>Send invite</Button>\n          </DialogContent>\n        </Dialog>\n      ),\n    },\n    \"src/components/ui/dialog.tsx#DialogContent\""));
  const dialog = scanned.audit.specimens.find((specimen) => specimen.key.endsWith("#Dialog"));
  assert.deepEqual(dialog.unsourced, ["Rename file"]);
  const result = checkCoverage(scanned, {});
  assert.equal(result.ok, false);
  assert.match(result.missing.invented[0], /"Rename file" is not written anywhere in src\/features\/Contacts.tsx/);
});

test("catches a specimen that cites a place that is not a usage of that component", () => {
  const scanned = tampered((source) => source.replace('from: "src/features/Contacts.tsx:22"', 'from: "src/features/Contacts.tsx:1"'));
  assert.equal(scanned.audit.specimens.find((specimen) => specimen.key.endsWith("#Dialog")).fromOk, false);
  assert.match(checkCoverage(scanned, {}).missing.invented[0], /not a usage of it/);
});

test("catches a specimen with no source at all", () => {
  const scanned = tampered((source) => source.replace('      from: "src/features/Contacts.tsx:22",\n', ""));
  assert.match(checkCoverage(scanned, {}).missing.invented[0], /no `from`/);
});

test("accepts a stand-in only for an expression that is really in the source", () => {
  const withMock = scan.audit.specimens.find((specimen) => specimen.key.endsWith("#Text") && specimen.file.endsWith("specimens.tsx"));
  assert.deepEqual(withMock.mocks, { title: "Campaigns" });
  // Without the declared stand-in, "Campaigns" is invented: the source says {title}.
  const undeclared = tampered((source) => source.replace('      mocks: { title: "Campaigns" },\n', ""));
  assert.deepEqual(undeclared.audit.specimens.find((specimen) => specimen.key.endsWith("#Text") && specimen.file.endsWith("specimens.tsx")).unsourced, ["Campaigns"]);
  // A stand-in for something the source never mentions is rejected.
  const wrong = tampered((source) => source.replace('mocks: { title: "Campaigns" }', 'mocks: { "project.name": "Campaigns" }'));
  assert.deepEqual(wrong.audit.specimens.find((specimen) => specimen.key.endsWith("#Text") && specimen.file.endsWith("specimens.tsx")).badMocks, ["project.name"]);
});

test("does not ask a wrapper to show variants it only inherits through another component's props type", () => {
  assert.equal(axis("IconButton", "loading").required, false);
  assert.equal(axis("IconButton", "loading").inheritedFrom, "Button");
});

test("the script writes a specimen for every component with a call site that stands on its own", () => {
  const { text, written, left } = generateSpecimens(scan, "src/audit", { all: true });
  assert.equal(written, 4);
  assert.deepEqual(left.map((entry) => entry.component.name), ["Dialog"]); // its only usage is `open={open}`
  assert.equal(component("Button").generated.from, "src/features/Contacts.tsx:25");
  assert.equal(component("Button").generated.code, "<Button {...props}>Send invite</Button>");
  assert.match(text, /import \{ Badge, Button, Text \} from "\.\.\/components\/ui";/);
  // By default it writes shared components only: what the inventory draws.
  assert.equal(generateSpecimens(scan, "src/audit").written, 3);
});

test("does not sweep `open`: that is a state you reach by clicking, not a variant", () => {
  assert.equal(axis("Dialog", "open").required, false);
});

test("rejects a component that is forced open, but lets a part be shown inside its open parent", () => {
  assert.equal(checkCoverage(scan, everyGroup).missing.forced.length, 0);
  const forced = tampered((source) => source.replace('      toggle: "open",\n      render: (props) => (\n        <Dialog {...props}>', "      width: 420,\n      height: 260,\n      render: (props) => (\n        <Dialog open {...props}>"));
  const problems = checkCoverage(forced, everyGroup).missing.forced;
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Dialog: its specimen passes `open`/);
});

test("sorts a call site's classes into overrides and placement", () => {
  const own = ["inline-flex", "rounded-lg", "bg-primary", "px-2.5", "h-8", "hover:bg-primary/80", "shadow-xs", "font-medium"];
  const sorted = classifyOverride(["rounded-full", "px-4", "py-3", "ml-2", "w-full", "flex-1", "hover:bg-red-500", "[&_svg]:fill-current", "shadow-xs", "tracking-wide", "size-10"], own);
  assert.deepEqual(sorted.replaces.map((entry) => `${entry.token}<${entry.replaces[0]}`), ["rounded-full<rounded-lg", "px-4<px-2.5", "hover:bg-red-500<hover:bg-primary/80", "size-10<h-8"]);
  assert.deepEqual(sorted.placement, ["ml-2", "w-full", "flex-1"]);
  assert.deepEqual(sorted.inside, ["[&_svg]:fill-current"]);
  assert.deepEqual(sorted.adds, ["py-3", "tracking-wide"]);
  assert.deepEqual(sorted.repeats, ["shadow-xs"]);
  // A size the theme defines is a size, not a colour.
  assert.equal(classifyOverride(["text-label"], ["text-sm"], { textSizes: new Set(["label"]) }).replaces.length, 1);
  assert.equal(classifyOverride(["text-label"], ["text-sm"]).replaces.length, 0);
});

test("groups the call sites that restyle a component, and leaves placement-only ones out", () => {
  const overrides = component("Button").overrides;
  assert.equal(overrides.sites, 1);
  assert.equal(overrides.placementOnly, 1);
  assert.equal(overrides.patterns.length, 1);
  const [pattern] = overrides.patterns;
  assert.deepEqual(pattern.classes, ["rounded-full", "shadow-lg"]);
  assert.deepEqual(pattern.props, { variant: "outline" });
  assert.deepEqual(pattern.sites, ["src/features/Toolbar.tsx:16"]);
  assert.equal(component("Badge").overrides.sites, 0);
});

test("a generated specimen shows the component as written, without a call site's override", () => {
  for (const candidate of scan.components) {
    const flagged = (candidate.overrides?.patterns ?? []).flatMap((pattern) => pattern.classes);
    for (const token of flagged) assert.ok(!candidate.generated?.code.includes(token), `${candidate.name} specimen copies ${token}`);
  }
});

test("rejects a specimen that copies an override onto the component", () => {
  assert.equal(checkCoverage(scan, everyGroup).missing.overridden.length, 0);
  const copied = tampered((source) => source.replace("<Button>Send invite</Button>", '<Button className="rounded-full">Send invite</Button>'));
  const problems = checkCoverage(copied, everyGroup).missing.overridden;
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Button: the specimen gives it "rounded-full"/);
});

// A small app written on the fly, to test how routes are found for each kind of router.
const app = (files) => {
  const root = new URL(`./.check/app-${Math.random().toString(36).slice(2)}`, import.meta.url).pathname;
  const all = {
    "package.json": '{ "name": "app", "dependencies": { "react": "19.0.0" } }',
    "src/components/ui/button.tsx": 'export function Button(props: { className?: string; children?: React.ReactNode }) { return <button className="rounded-lg" {...props} />; }',
    ...files,
  };
  for (const [file, text] of Object.entries(all)) {
    mkdirSync(`${root}/${file.split("/").slice(0, -1).join("/")}`, { recursive: true });
    writeFileSync(`${root}/${file}`, text);
  }
  const result = scanRepo({ root });
  rmSync(root, { recursive: true, force: true });
  return result;
};
const routesOfButton = (result) => Object.fromEntries(result.components.find((candidate) => candidate.name === "Button").callSites.map((site) => [site.file, site.routes]));

test("finds the page a call site renders on, for routes written in code (React Router)", () => {
  const result = app({
    "src/main.tsx": `import { createBrowserRouter } from "react-router";
import { Shell } from "./Shell";
import { Home } from "./pages/Home";
import { Settings } from "./pages/Settings";
export const router = createBrowserRouter([{ path: "/", element: <Shell />, children: [{ index: true, element: <Home /> }, { path: "settings", element: <Settings /> }] }]);`,
    "src/Shell.tsx": 'import { Button } from "./components/ui/button";\nexport function Shell() { return <Button>Menu</Button>; }',
    "src/pages/Home.tsx": "export function Home() { return <p>Home</p>; }",
    "src/pages/Settings.tsx": 'import { Button } from "../components/ui/button";\nexport function Settings() { return <Button className="rounded-full">Save</Button>; }',
  });
  assert.deepEqual(result.pages.map((page) => page.route).sort(), ["/", "/settings"]);
  const routes = routesOfButton(result);
  assert.deepEqual(routes["src/pages/Settings.tsx"], ["/settings"]);
  // The layout renders on every page under it.
  assert.deepEqual(routes["src/Shell.tsx"].sort(), ["/", "/settings"]);
});

test("finds pages for JSX routes, file routes (TanStack), and an app with no router", () => {
  const jsx = app({
    "src/App.tsx": 'import { Routes, Route } from "react-router";\nimport { Settings } from "./Settings";\nexport function App() { return <Routes><Route path="/account"><Route path="settings" element={<Settings />} /></Route></Routes>; }',
    "src/Settings.tsx": 'import { Button } from "./components/ui/button";\nexport function Settings() { return <Button>Save</Button>; }',
  });
  assert.deepEqual(routesOfButton(jsx)["src/Settings.tsx"], ["/account/settings"]);
  const tanstack = app({
    "src/routes/about.tsx": 'import { createFileRoute } from "@tanstack/react-router";\nimport { Button } from "../components/ui/button";\nexport const Route = createFileRoute("/about")({ component: () => <Button>Hi</Button> });',
  });
  assert.deepEqual(routesOfButton(tanstack)["src/routes/about.tsx"], ["/about"]);
  const plain = app({
    "src/main.tsx": 'import { App } from "./App";\nexport default App;',
    "src/App.tsx": 'import { Button } from "./components/ui/button";\nexport function App() { return <Button>Go</Button>; }',
  });
  assert.deepEqual(routesOfButton(plain)["src/App.tsx"], ["/"]);
});

console.log(`\n${passed} scanner and checker tests passed${process.exitCode ? ", some failed" : ""}`);
