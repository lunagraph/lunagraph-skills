#!/usr/bin/env node
/**
 * scan.mjs: the programmatic half of the design system audit.
 *
 * Reads every source file in a repo and reports, as JSON:
 *   - every component in the shared UI directories, with every prop, every
 *     variant value, its default, and every call site with the props passed
 *   - every local component that wraps a raw element (a competing "version")
 *   - every hand-rolled element (raw <button>, <input>, role="dialog", ...),
 *     clustered by how it looks
 *   - what the audit page already renders, so coverage can be checked
 *
 * It parses syntax only (no type checker), so it is fast and needs no build.
 * It needs a TypeScript package with the classic parser API (any 3.x to 6.x)
 * and looks for one in the repo; see loadTypeScript for the fallback.
 *
 *   node scan.mjs --root <repo> [--ui <dir>]... [--out <file>] [--quiet]
 *
 * Nothing in the repo is modified. With --out, the JSON goes to that file and a
 * summary goes to stderr; without it, the JSON goes to stdout.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const SOURCE_FILE = /\.(tsx|jsx|ts|js|mjs|mts)$/;
const SKIP_DIR =
  /(^|\/)(node_modules|dist|build|out|\.next|\.turbo|\.cache|\.vercel|coverage|storybook-static|\.git|vendor|__tests__|__mocks__|__snapshots__|e2e|test-results|playwright-report)(\/|$)/;
const SKIP_FILE =
  /(\.d\.[cm]?ts|\.test\.[cm]?[jt]sx?|\.spec\.[cm]?[jt]sx?|\.stories\.[jt]sx?|\.gen\.[jt]sx?|\.generated\.[jt]sx?|\.config\.[cm]?[jt]s|\.min\.js)$/;
const SHARED_DIR = /(^|\/)(components\/ui|ui\/src\/components|ui\/components|design-system\/(src|components))\//;
const ICON_FILE = /(^|\/)icons?(\/|\.[jt]sx?$)|Icons?\.[jt]sx?$/;
const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".mts"];
const MAX_FILE_BYTES = 1_500_000;

/** Group suggestions for shared components, by name. First match wins; anything else is "other". */
const KIND_BY_NAME = [
  ["modals", /dialog|modal|sheet|drawer|lightbox/i],
  ["tables", /table|datagrid/i],
  ["dropdowns", /dropdown|select|combobox|menu|listbox/i],
  ["overlays", /tooltip|popover|hovercard/i],
  ["controls", /checkbox|switch|radio|toggle|slider/i],
  ["buttons", /button|btn/i],
  ["inputs", /input|textarea|textfield|field|searchbox/i],
  ["tabs", /tab/i],
  ["cards", /card|panel/i],
  ["badges", /badge|tag|chip|pill/i],
  ["feedback", /toast|sonner|alert|banner|snackbar/i],
  ["loading", /skeleton|spinner|loader|loading|progress/i],
  ["avatars", /avatar/i],
  ["navigation", /sidebar|nav|breadcrumb|pagination/i],
  ["typography", /^(text|heading|title|label|kbd|code|typography)/i],
  ["layout", /separator|divider|scroll|stack|grid|container|spacer|accordion|collapsible/i],
];

/** Raw elements that mean "someone built this by hand". */
const INTRINSIC_KIND = { button: "buttons", textarea: "inputs", select: "dropdowns", table: "tables", dialog: "modals" };
const ROLE_KIND = {
  dialog: "modals",
  alertdialog: "modals",
  button: "buttons",
  tablist: "tabs",
  menu: "dropdowns",
  listbox: "dropdowns",
  combobox: "dropdowns",
  switch: "controls",
  checkbox: "controls",
  radio: "controls",
  slider: "controls",
};
const INPUT_TYPE_KIND = { checkbox: "controls", radio: "controls", range: "controls" };
const INPUT_TYPE_SKIP = new Set(["hidden", "file", "color", "image", "submit", "reset", "button"]);

/** Boolean props that change how a component looks, as opposed to how it behaves. */
const VISUAL_BOOLEAN =
  /^(is|has)?(active|selected|disabled|loading|checked|invalid|error|pressed|destructive|inline|compact|dense|ghost|outlined?|rounded|fullwidth|block|inset|highlighted|current|readonly|required|indeterminate|busy|pending|muted|subtle|primary|secondary|danger|success|warning|small|large|bordered|elevated|flat|vertical|horizontal|bold|italic|truncate|focused|hovered|dragging|empty)$/i;

/** Class tokens that position or behave rather than style. Left out of look signatures. */
const LAYOUT_TOKEN =
  /^-?(flex|inline-flex|inline-block|inline|block|grid|contents|hidden|relative|absolute|fixed|sticky|static|items-|justify-|content-|self-|place-|shrink|grow|basis-|order-|col-|row-|cursor-|transition|duration-|ease-|delay-|animate-|select-|whitespace-|overflow-|truncate|z-|top-|left-|right-|bottom-|inset-|m[xytblrse]?-|space-[xy]-|w-full|w-auto|h-full|h-auto|min-w-|max-w-|min-h-|max-h-|sr-only|pointer-events-|group|peer|outline-none|appearance-|text-left|text-center|text-right|align-|origin-|will-change|touch-|snap-|isolate|object-|aspect-|line-clamp|break-|list-|table-|float-|clear-|visible|invisible|container|flex-)/;

// ── Overrides ────────────────────────────────────────────────────────────────
// A call site that passes `className` to a design-system component is either placing it
// (margin, width, flex and grid placement, position) or restyling it. Placement is the
// parent's business. Anything else changes how the component looks, and is flagged.

const PLACEMENT_TOKEN =
  /^-?(m[xytblrse]?-|self-|justify-self-|place-self-|order-|col-|row-|basis-|grow|shrink|flex-1$|flex-auto$|flex-initial$|flex-none$|w-|min-w-|max-w-|relative$|absolute$|fixed$|sticky$|top-|left-|right-|bottom-|start-|end-|inset-|z-|hidden$|sr-only$|not-sr-only$)/;

/** Split `hover:[&_svg]:bg-red-500` into its modifiers and its utility, ignoring colons inside brackets. */
export function splitClass(token) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of token) {
    if (char === "[" || char === "(") depth += 1;
    else if (char === "]" || char === ")") depth = Math.max(0, depth - 1);
    if (char === ":" && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  const utility = current.replace(/^!/, "").replace(/!$/, "");
  return { modifiers: parts, utility };
}

/** The CSS property a Tailwind utility sets, coarsely: two utilities in the same group fight. */
export function utilityGroup(utility, theme = {}) {
  const u = utility.replace(/^-/, "");
  // Font sizes the project defines in its theme (`--text-label`) look like colours otherwise.
  if (theme.textSizes?.has(u.replace(/^text-/, "")) && u.startsWith("text-")) return "font-size";
  const rules = [
    [/^rounded(-|$)/, "radius"],
    [/^bg-(clip|origin|fixed|local|scroll|repeat|no-repeat|cover|contain|center|top|bottom|left|right|blend)/, "background-other"],
    [/^bg-(gradient|linear|radial|conic|none)/, "background-image"],
    [/^bg-/, "background"],
    [/^text-(left|center|right|justify|start|end)$/, "text-align"],
    [/^text-(xs|sm|base|lg|\d?xl|\d?xs|\[[\d.]+(px|rem|em)\])$/, "font-size"],
    [/^text-(ellipsis|clip|wrap|nowrap|balance|pretty)$/, "text-wrap"],
    [/^text-/, "text-color"],
    [/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\d+|\[\d+\])$/, "font-weight"],
    [/^font-/, "font-family"],
    [/^shadow(-|$)/, "shadow"],
    [/^ring-offset/, "ring-offset"],
    [/^ring(-\d+|-\[[\d.]+px\]|$)/, "ring-width"],
    [/^ring-/, "ring-color"],
    [/^border-(solid|dashed|dotted|double|none|hidden)$/, "border-style"],
    [/^border(-[trblxyse])?(-\d+|-\[[\d.]+px\])?$/, "border-width"],
    [/^border-/, "border-color"],
    [/^outline/, "outline"],
    [/^p[xlrse]-/, "padding-x"],
    [/^p[ytb]-/, "padding-y"],
    [/^p-/, "padding"],
    [/^m[trblxyse]?-/, "margin"],
    [/^gap-/, "gap"],
    [/^size-/, "size"],
    [/^h-/, "height"],
    [/^w-/, "width"],
    [/^min-h-/, "min-height"],
    [/^min-w-/, "min-width"],
    [/^max-h-/, "max-height"],
    [/^max-w-/, "max-width"],
    [/^opacity-/, "opacity"],
    [/^leading-/, "line-height"],
    [/^tracking-/, "letter-spacing"],
    [/^(fill|stroke)-/, "svg-paint"],
    [/^(inline-flex|flex|grid|inline-grid|block|inline-block|inline|hidden|contents)$/, "display"],
    [/^flex-(row|col)/, "flex-direction"],
    [/^flex-(wrap|nowrap)/, "flex-wrap"],
    [/^flex-/, "flex"],
    [/^(transition|duration-|ease-|delay-|animate-)/, "motion"],
  ];
  for (const [pattern, group] of rules) if (pattern.test(u)) return group;
  return u.split("-")[0];
}

/** A modifier that styles the component's children rather than the component: `[&_svg]:`, `*:`, `**:`. */
const reachesInside = (modifiers) => modifiers.some((modifier) => /^\*{1,2}$/.test(modifier) || /^\[&.*[_ >~+]/.test(modifier) || /^has-/.test(modifier));

/**
 * Classify a call site's classes against the classes the component sets itself.
 * replaces:  same property and same modifiers as one of the component's own classes.
 * inside:    styles the component's children.
 * adds:      changes the look with something the component does not set.
 * placement: margin, width, position, flex and grid placement. Not an override.
 * repeats:   classes the component already has. Redundant, not an override.
 */
export function classifyOverride(tokens, ownTokens, theme = {}) {
  const own = new Map();
  const ownSet = new Set(ownTokens);
  // Properties that overlap: size sets width and height, p sets both paddings.
  const OVERLAP = { size: ["width", "height", "size"], width: ["width", "size"], height: ["height", "size"], padding: ["padding", "padding-x", "padding-y"], "padding-x": ["padding-x", "padding"], "padding-y": ["padding-y", "padding"] };
  for (const token of ownTokens) {
    if (/[${}]/.test(token)) continue;
    const { modifiers, utility } = splitClass(token);
    const group = utilityGroup(utility, theme);
    const keys = OVERLAP[group] ?? [group];
    for (const key of keys) {
      const id = `${modifiers.join(":")}|${key}`;
      if (!own.has(id)) own.set(id, []);
      if (!own.get(id).includes(token)) own.get(id).push(token);
    }
  }
  const result = { replaces: [], inside: [], adds: [], placement: [], repeats: [] };
  for (const token of tokens) {
    if (/[${}]/.test(token)) continue;
    // The component already has this exact class: redundant, not an override.
    if (ownSet.has(token)) {
      result.repeats.push(token);
      continue;
    }
    const { modifiers, utility } = splitClass(token);
    const group = utilityGroup(utility, theme);
    const replaced = own.get(`${modifiers.join(":")}|${group}`);
    if (replaced) result.replaces.push({ token, replaces: replaced.filter((candidate) => candidate !== token).slice(0, 3) });
    else if (reachesInside(modifiers)) result.inside.push(token);
    else if (!modifiers.length && PLACEMENT_TOKEN.test(utility)) result.placement.push(token);
    else result.adds.push(token);
  }
  return result;
}

// ── Arguments ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { root: process.cwd(), ui: [], out: null, typescript: null, quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") args.root = argv[(i += 1)];
    else if (arg === "--ui") args.ui.push(argv[(i += 1)]);
    else if (arg === "--out") args.out = argv[(i += 1)];
    else if (arg === "--typescript") args.typescript = argv[(i += 1)];
    else if (arg === "--quiet") args.quiet = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  args.root = path.resolve(args.root);
  return args;
}

// ── TypeScript loader ────────────────────────────────────────────────────────

/** Where a parser can be installed without touching the repo. */
export function parserCacheDir() {
  return path.join(os.tmpdir(), "lunagraph-audit");
}

/**
 * Find a TypeScript package that still exposes `createSourceFile`.
 * TypeScript 7 (the native port) does not, so a repo's own copy is not always usable.
 */
export function loadTypeScript(root, packageDirs = [], explicit = null) {
  const tried = [];
  const attempt = (resolver, label) => {
    try {
      const ts = resolver();
      if (ts && typeof ts.createSourceFile === "function") return ts;
      tried.push(`${label}: version ${ts?.version ?? "?"} has no parser API`);
    } catch (error) {
      tried.push(`${label}: ${error.code ?? error.message.split("\n")[0]}`);
    }
    return null;
  };
  const requireFrom = (dir) => createRequire(path.join(dir, "package.json"));

  if (explicit) {
    const found = attempt(() => requireFrom(process.cwd())(path.resolve(explicit)), explicit);
    if (found) return found;
  }
  for (const dir of [root, ...packageDirs]) {
    const found = attempt(() => requireFrom(dir)("typescript"), path.relative(root, dir) || ".");
    if (found) return found;
  }
  // pnpm keeps every installed version in the store, even ones no package resolves by name.
  const store = path.join(root, "node_modules", ".pnpm");
  if (fs.existsSync(store)) {
    for (const entry of fs.readdirSync(store).sort().reverse()) {
      const candidate = /^typescript@[1-6]\./.test(entry)
        ? path.join(store, entry, "node_modules", "typescript")
        : /^@typescript\+typescript\d@/.test(entry)
          ? path.join(store, entry, "node_modules", "@typescript", entry.match(/^@typescript\+(typescript\d)@/)[1])
          : null;
      if (!candidate) continue;
      const found = attempt(() => requireFrom(root)(candidate), entry);
      if (found) return found;
    }
  }
  const cache = parserCacheDir();
  const cached = attempt(() => requireFrom(cache)("typescript"), cache);
  if (cached) return cached;

  const error = new Error(
    [
      "No usable TypeScript parser found.",
      ...tried.map((line) => `  - ${line}`),
      "",
      "Install one outside the repo, then run this again (it is picked up automatically):",
      `  npm install --prefix "${cache}" typescript@5`,
    ].join("\n"),
  );
  error.code = "NO_PARSER";
  throw error;
}

// ── Files ────────────────────────────────────────────────────────────────────

function listFiles(root) {
  let files = null;
  try {
    const out = execFileSync("git", ["-C", root, "ls-files", "-co", "--exclude-standard", "-z"], {
      encoding: "utf8",
      maxBuffer: 1 << 28,
      stdio: ["ignore", "pipe", "ignore"],
    });
    files = out.split("\0").filter(Boolean);
    // Inside an ignored folder git lists nothing. Read the folder directly then.
    if (!files.some((file) => SOURCE_FILE.test(file))) throw new Error("no source files listed");
  } catch {
    files = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = dir ? `${dir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          if (!SKIP_DIR.test(`${rel}/`) && !entry.name.startsWith(".")) walk(rel);
        } else files.push(rel);
      }
    };
    walk("");
  }
  return files.map((file) => file.split(path.sep).join("/")).filter((file) => !SKIP_DIR.test(file));
}

function readJsonc(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    let out = "";
    let inString = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (inString) {
        out += char;
        if (char === "\\") out += text[(i += 1)] ?? "";
        else if (char === '"') inString = false;
      } else if (char === '"') {
        inString = true;
        out += char;
      } else if (char === "/" && text[i + 1] === "/") {
        while (i < text.length && text[i] !== "\n") i += 1;
        out += "\n";
      } else if (char === "/" && text[i + 1] === "*") {
        i = text.indexOf("*/", i + 2);
        if (i < 0) break;
        i += 1;
      } else out += char;
    }
    return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
  } catch {
    return null;
  }
}

// ── The scan ─────────────────────────────────────────────────────────────────

export function scanRepo({ root, ui = [], typescript = null, audit = null }) {
  const allFiles = listFiles(root);
  // Files in the audit folder may be gitignored, which hides them from the file list.
  // Read every audit folder we know of straight from disk.
  const AUDIT_FILE = /(^|\/)(AuditCanvas|AuditPage)\.(tsx|jsx)$|(^|\/)audit\.(data|scan)\.json$/;
  const auditRoots = new Set(allFiles.filter((file) => AUDIT_FILE.test(file)).map((file) => path.posix.dirname(file)));
  if (audit) auditRoots.add(path.relative(root, path.resolve(root, audit)).split(path.sep).join("/"));
  const known = new Set(allFiles);
  const readFolder = (rel) => {
    if (!fs.existsSync(path.join(root, rel))) return;
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) readFolder(child);
      else if (!known.has(child)) {
        known.add(child);
        allFiles.push(child);
      }
    }
  };
  for (const dir of auditRoots) readFolder(dir);
  const packageFiles = allFiles.filter((file) => path.posix.basename(file) === "package.json");
  const packages = [];
  for (const file of packageFiles) {
    const json = readJsonc(path.join(root, file));
    if (json?.name) packages.push({ name: json.name, dir: path.posix.dirname(file), json });
  }
  packages.sort((a, b) => b.name.length - a.name.length);

  const ts = loadTypeScript(
    root,
    packageFiles.map((file) => path.join(root, path.posix.dirname(file))),
    typescript,
  );
  const SK = ts.SyntaxKind;

  // Theme names that change how a class reads: `text-label` is a size here, not a colour.
  const theme = { textSizes: new Set() };
  for (const file of allFiles) {
    if (!/\.css$/.test(file) || /(^|\/)node_modules\//.test(file)) continue;
    let css = "";
    try {
      css = fs.readFileSync(path.join(root, file), "utf8");
    } catch {
      continue;
    }
    for (const match of css.matchAll(/--text-([\w-]+?)\s*:/g)) if (!match[1].includes("--")) theme.textSizes.add(match[1]);
  }

  // Generated files are skipped everywhere except the audit folder, whose generated specimens are part of the audit.
  const inAuditRoot = (file) => [...auditRoots].some((dir) => file.startsWith(`${dir}/`));
  const sourceFiles = allFiles.filter((file) => SOURCE_FILE.test(file) && (!SKIP_FILE.test(file) || (inAuditRoot(file) && !/\.d\.[cm]?ts$/.test(file))));
  const fileSet = new Set(sourceFiles);

  // An audit page already in the repo is not part of the codebase being audited,
  // but what it renders is how coverage is measured.
  const auditDirs = [...new Set([...auditRoots].map((dir) => `${dir}/`))];
  const inAudit = (file) => auditDirs.some((dir) => file.startsWith(dir));

  const uiDirs = ui.map((dir) => `${path.relative(root, path.resolve(root, dir)).split(path.sep).join("/")}/`);
  const shadcn = readJsonc(path.join(root, "components.json"));
  const isShared = (file) => (uiDirs.length ? uiDirs.some((dir) => file.startsWith(dir)) : SHARED_DIR.test(file));

  // Path aliases from every tsconfig / jsconfig, nearest config first.
  const aliasConfigs = [];
  for (const file of allFiles) {
    if (!/(^|\/)(tsconfig(\.[\w-]+)?|jsconfig)\.json$/.test(file)) continue;
    const options = readJsonc(path.join(root, file))?.compilerOptions;
    if (!options?.paths && !options?.baseUrl) continue;
    const dir = path.posix.dirname(file);
    aliasConfigs.push({
      dir: dir === "." ? "" : `${dir}/`,
      base: path.posix.normalize(path.posix.join(dir, options.baseUrl ?? ".")),
      paths: options.paths ?? {},
      hasBaseUrl: options.baseUrl !== undefined,
    });
  }
  aliasConfigs.sort((a, b) => b.dir.length - a.dir.length);

  const tryFile = (candidate) => {
    const clean = path.posix.normalize(candidate);
    if (fileSet.has(clean)) return clean;
    const stripped = clean.replace(/\.(js|jsx|mjs)$/, "");
    for (const base of stripped === clean ? [clean] : [clean, stripped]) {
      for (const ext of EXTENSIONS) if (fileSet.has(base + ext)) return base + ext;
      for (const ext of EXTENSIONS) if (fileSet.has(`${base}/index${ext}`)) return `${base}/index${ext}`;
    }
    return null;
  };

  const pickExport = (entry) => {
    if (!entry) return null;
    if (typeof entry === "string") return entry;
    for (const key of ["source", "import", "default", "require", "types"]) {
      const found = pickExport(entry[key]);
      if (found) return found;
    }
    return null;
  };

  const moduleCache = new Map();
  /** Resolve an import specifier to a source file in the repo, or null when it is external. */
  const resolveModule = (fromFile, spec) => {
    const key = `${path.posix.dirname(fromFile)}\0${spec}`;
    if (moduleCache.has(key)) return moduleCache.get(key);
    let result = null;
    if (spec.startsWith(".")) {
      result = tryFile(path.posix.join(path.posix.dirname(fromFile), spec));
    } else {
      for (const config of aliasConfigs) {
        if (result || !fromFile.startsWith(config.dir)) continue;
        for (const [pattern, targets] of Object.entries(config.paths)) {
          const star = pattern.indexOf("*");
          const prefix = star < 0 ? pattern : pattern.slice(0, star);
          const suffix = star < 0 ? "" : pattern.slice(star + 1);
          const matches = star < 0 ? spec === pattern : spec.startsWith(prefix) && spec.endsWith(suffix);
          if (!matches) continue;
          const middle = star < 0 ? "" : spec.slice(prefix.length, spec.length - suffix.length);
          for (const target of targets) {
            result = tryFile(path.posix.join(config.base, target.replace("*", middle)));
            if (result) break;
          }
          if (result) break;
        }
        if (!result && config.hasBaseUrl) result = tryFile(path.posix.join(config.base, spec));
      }
      if (!result) {
        const pkg = packages.find((candidate) => spec === candidate.name || spec.startsWith(`${candidate.name}/`));
        if (pkg) {
          const sub = spec.slice(pkg.name.length + 1);
          const target = pickExport(pkg.json.exports?.[sub ? `./${sub}` : "."]) ?? (sub ? null : pkg.json.source ?? pkg.json.module ?? pkg.json.main);
          const candidates = [];
          if (target) {
            candidates.push(path.posix.join(pkg.dir, target));
            candidates.push(path.posix.join(pkg.dir, target.replace(/(^|\/)(dist|build|lib)\//, "$1src/")));
          }
          candidates.push(path.posix.join(pkg.dir, "src", sub || "index"), path.posix.join(pkg.dir, sub || "index"));
          for (const candidate of candidates) {
            result = tryFile(candidate);
            if (result) break;
          }
        }
      }
    }
    moduleCache.set(key, result);
    return result;
  };

  // ── Parse every file ───────────────────────────────────────────────────────

  const files = new Map();
  const errors = [];

  const isPascal = (name) => /^[A-Z][A-Za-z0-9_$]*$/.test(name);
  const unwrap = (node) => {
    let current = node;
    while (
      current &&
      (current.kind === SK.ParenthesizedExpression ||
        current.kind === SK.AsExpression ||
        current.kind === SK.SatisfiesExpression ||
        current.kind === SK.NonNullExpression ||
        current.kind === SK.TypeAssertionExpression)
    )
      current = current.expression;
    return current;
  };
  const isFunction = (node) => node && (node.kind === SK.ArrowFunction || node.kind === SK.FunctionExpression || node.kind === SK.FunctionDeclaration);
  const isJsx = (node) => node.kind === SK.JsxElement || node.kind === SK.JsxSelfClosingElement || node.kind === SK.JsxFragment;
  const containsJsx = (node) => {
    let found = false;
    const visit = (child) => {
      if (found) return;
      if (isJsx(child)) found = true;
      // A component can build its element without JSX: `createElement(tag, props)`.
      else if (child.kind === SK.CallExpression && /(^|\.)(createElement|cloneElement|createPortal|jsxs?)$/.test(child.expression.getText())) found = true;
      else ts.forEachChild(child, visit);
    };
    visit(node);
    return found;
  };
  const hasModifier = (node, kind) => !!node.modifiers?.some((modifier) => modifier.kind === kind);
  const literalValue = (node) => {
    const value = unwrap(node);
    if (!value) return undefined;
    if (value.kind === SK.StringLiteral || value.kind === SK.NoSubstitutionTemplateLiteral) return value.text;
    if (value.kind === SK.NumericLiteral) return Number(value.text);
    if (value.kind === SK.TrueKeyword) return true;
    if (value.kind === SK.FalseKeyword) return false;
    if (value.kind === SK.PrefixUnaryExpression && value.operand.kind === SK.NumericLiteral) return Number(value.getText());
    return undefined;
  };
  const propertyName = (node) =>
    !node ? null : node.kind === SK.Identifier || node.kind === SK.StringLiteral || node.kind === SK.NumericLiteral ? node.text : null;
  const objectKeys = (node) => {
    const keys = [];
    for (const property of node.properties) {
      const name = propertyName(property.name);
      if (name !== null) keys.push(name);
    }
    return keys;
  };

  /** Find the function behind `forwardRef(...)`, `memo(...)`, and friends. */
  const componentFunction = (initializer) => {
    let node = unwrap(initializer);
    let genericProps = null;
    for (let depth = 0; node && depth < 5; depth += 1) {
      if (isFunction(node)) return { fn: node, genericProps };
      if (node.kind !== SK.CallExpression) return null;
      if (/forwardRef$/.test(node.expression.getText()) && node.typeArguments?.[1]) genericProps = node.typeArguments[1];
      else if (!genericProps && node.typeArguments?.length === 1 && /(memo|observer)$/.test(node.expression.getText()))
        genericProps = node.typeArguments[0];
      node = unwrap(node.arguments[0]);
    }
    return null;
  };

  /** The JSX elements a component returns, looking through fragments, ternaries, and `&&`. */
  const rootElements = (fn) => {
    const roots = [];
    const fromExpression = (expression) => {
      const node = unwrap(expression);
      if (!node) return;
      if (node.kind === SK.ConditionalExpression) {
        fromExpression(node.whenTrue);
        fromExpression(node.whenFalse);
      } else if (node.kind === SK.BinaryExpression) {
        fromExpression(node.right);
      } else if (node.kind === SK.JsxFragment) {
        const children = node.children.filter((child) => child.kind === SK.JsxElement || child.kind === SK.JsxSelfClosingElement);
        if (children.length === 1) fromExpression(children[0]);
      } else if (node.kind === SK.JsxElement) roots.push(node.openingElement);
      else if (node.kind === SK.JsxSelfClosingElement) roots.push(node);
    };
    if (!fn.body) return roots;
    if (fn.body.kind !== SK.Block) fromExpression(fn.body);
    else {
      const visit = (node) => {
        if (node !== fn && isFunction(node)) return;
        if (node.kind === SK.ReturnStatement) fromExpression(node.expression);
        else ts.forEachChild(node, visit);
      };
      visit(fn.body);
    }
    return roots;
  };

  /** Read `cva(base, { variants, defaultVariants })` or `tv({ variants, defaultVariants })`. */
  const readVariantCall = (node) => {
    if (node.kind !== SK.CallExpression || !/^(cva|tv)$/.test(node.expression.getText())) return null;
    const config = node.arguments.map(unwrap).find((arg) => arg?.kind === SK.ObjectLiteralExpression && objectKeys(arg).includes("variants"));
    if (!config) return { variants: {}, defaults: {} };
    const result = { variants: {}, defaults: {} };
    for (const property of config.properties) {
      const name = propertyName(property.name);
      const value = unwrap(property.initializer);
      if (!value || value.kind !== SK.ObjectLiteralExpression) continue;
      if (name === "variants") {
        for (const axis of value.properties) {
          const axisName = propertyName(axis.name);
          const axisValue = unwrap(axis.initializer);
          if (axisName && axisValue?.kind === SK.ObjectLiteralExpression) result.variants[axisName] = objectKeys(axisValue);
        }
      } else if (name === "defaultVariants") {
        for (const entry of value.properties) {
          const entryName = propertyName(entry.name);
          const entryValue = literalValue(entry.initializer);
          if (entryName && entryValue !== undefined) result.defaults[entryName] = entryValue;
        }
      }
    }
    return result;
  };

  const classTokens = (attribute) => {
    const tokens = [];
    const add = (text) => tokens.push(...text.split(/\s+/).filter(Boolean));
    const initializer = attribute.initializer;
    if (!initializer) return tokens;
    if (initializer.kind === SK.StringLiteral) add(initializer.text);
    else {
      const visit = (node) => {
        if (node.kind === SK.StringLiteral || node.kind === SK.NoSubstitutionTemplateLiteral) add(node.text);
        else if (node.kind === SK.TemplateHead || node.kind === SK.TemplateMiddle || node.kind === SK.TemplateTail) add(node.text);
        ts.forEachChild(node, visit);
      };
      visit(initializer);
    }
    return tokens;
  };

  /** Class tokens applied only under a condition: `cond && "a"`, `cond ? "a" : "b"`. */
  const conditionalClassTokens = (attribute) => {
    const tokens = [];
    const expression = attribute.initializer?.kind === SK.JsxExpression ? attribute.initializer.expression : null;
    if (!expression) return tokens;
    const visit = (node, conditional) => {
      if (conditional && (node.kind === SK.StringLiteral || node.kind === SK.NoSubstitutionTemplateLiteral)) tokens.push(...node.text.split(/\s+/).filter(Boolean));
      if (node.kind === SK.ConditionalExpression) {
        visit(node.condition, conditional);
        visit(node.whenTrue, true);
        visit(node.whenFalse, true);
        return;
      }
      if (node.kind === SK.BinaryExpression && /^(&&|\|\||\?\?)$/.test(node.operatorToken.getText())) {
        visit(node.left, conditional);
        visit(node.right, true);
        return;
      }
      ts.forEachChild(node, (child) => visit(child, conditional));
    };
    visit(expression, false);
    return tokens;
  };

  const readAttributes = (element) => {
    const props = {};
    const info = { props, spread: false, classes: null, conditionalClasses: [], classExpression: null, styled: false };
    for (const attribute of element.attributes.properties) {
      if (attribute.kind === SK.JsxSpreadAttribute) {
        info.spread = true;
        continue;
      }
      const name = attribute.name.getText();
      if (name === "className" || name === "class") {
        info.classes = classTokens(attribute);
        info.conditionalClasses = conditionalClassTokens(attribute);
        if (attribute.initializer?.kind === SK.JsxExpression) info.classExpression = attribute.initializer.expression?.getText().replace(/\s+/g, " ").slice(0, 80) ?? null;
        continue;
      }
      if (name === "style") {
        info.styled = true;
        continue;
      }
      if (name === "key" || name === "ref") continue;
      if (!attribute.initializer) {
        props[name] = true;
        continue;
      }
      const expression = attribute.initializer.kind === SK.JsxExpression ? attribute.initializer.expression : attribute.initializer;
      const literal = expression ? literalValue(expression) : undefined;
      if (literal !== undefined) {
        props[name] = typeof literal === "string" && literal.length > 80 ? `${literal.slice(0, 77)}...` : literal;
        continue;
      }
      // Not a literal. Still worth knowing which literal values it can take: `cond ? "a" : "b"`,
      // and whether it can be left out: `cond ? "page" : undefined`, `cond && "page"`.
      const values = [];
      let optional = false;
      const collect = (node) => {
        const inner = unwrap(node);
        if (!inner) return;
        if (inner.kind === SK.ConditionalExpression) {
          collect(inner.whenTrue);
          collect(inner.whenFalse);
        } else if (inner.kind === SK.BinaryExpression) {
          if (inner.operatorToken.kind === SK.AmpersandAmpersandToken) optional = true;
          collect(inner.left);
          collect(inner.right);
        } else if (inner.kind === SK.NullKeyword || (inner.kind === SK.Identifier && inner.text === "undefined") || inner.kind === SK.FalseKeyword) {
          optional = true;
        } else {
          const value = literalValue(inner);
          if (typeof value === "string" || typeof value === "number") values.push(value);
        }
      };
      if (expression) collect(expression);
      props[name] = values.length ? { dynamic: true, values: [...new Set(values)], ...(optional ? { optional: true } : {}) } : { dynamic: true };
    }
    return info;
  };

  const snippetOf = (sf, node, limit = 700) => {
    const whole = node.kind === SK.JsxOpeningElement ? node.parent : node;
    const text = whole.getText(sf);
    return text.length > limit ? `${text.slice(0, limit)}\n/* ...${text.length - limit} more characters */` : text;
  };

  const parseFile = (rel) => {
    const absolute = path.join(root, rel);
    let text;
    try {
      if (fs.statSync(absolute).size > MAX_FILE_BYTES) return null;
      text = fs.readFileSync(absolute, "utf8");
    } catch {
      return null;
    }
    const scriptKind = rel.endsWith(".tsx") ? ts.ScriptKind.TSX : /\.(jsx|js|mjs)$/.test(rel) ? ts.ScriptKind.JSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, scriptKind);
    const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const info = {
      path: rel,
      sf,
      imports: new Map(),
      exports: new Map(),
      starExports: [],
      declared: new Set(),
      objects: new Map(),
      arrays: new Map(),
      variantCalls: new Map(),
      typeAliases: new Map(),
      interfaces: new Map(),
      components: new Map(),
      usages: [],
      intrinsics: [],
    };

    const addComponent = (name, node, fn, genericProps, exported) => {
      if (!isPascal(name) || !fn || !containsJsx(fn)) return;
      info.components.set(name, { name, line: lineOf(node), fn, genericProps, exported });
    };

    for (const statement of sf.statements) {
      const exported = hasModifier(statement, SK.ExportKeyword);
      const isDefault = hasModifier(statement, SK.DefaultKeyword);
      if (statement.kind === SK.ImportDeclaration && statement.moduleSpecifier.kind === SK.StringLiteral) {
        const source = statement.moduleSpecifier.text;
        const clause = statement.importClause;
        if (!clause) continue;
        if (clause.name) info.imports.set(clause.name.text, { source, imported: "default" });
        const bindings = clause.namedBindings;
        if (bindings?.kind === SK.NamespaceImport) info.imports.set(bindings.name.text, { source, imported: "*" });
        else if (bindings?.kind === SK.NamedImports)
          for (const element of bindings.elements)
            info.imports.set(element.name.text, { source, imported: (element.propertyName ?? element.name).text });
      } else if (statement.kind === SK.ExportDeclaration) {
        const source = statement.moduleSpecifier?.kind === SK.StringLiteral ? statement.moduleSpecifier.text : null;
        if (!statement.exportClause) {
          if (source) info.starExports.push(source);
        } else if (statement.exportClause.kind === SK.NamedExports) {
          for (const element of statement.exportClause.elements) {
            const local = (element.propertyName ?? element.name).text;
            info.exports.set(element.name.text, source ? { source, imported: local } : { local });
          }
        }
      } else if (statement.kind === SK.ExportAssignment) {
        const expression = unwrap(statement.expression);
        if (expression.kind === SK.Identifier) info.exports.set("default", { local: expression.text });
        else {
          const found = componentFunction(expression);
          const name = path.posix.basename(rel).replace(/\.[^.]+$/, "").replace(/(^|[-_.])(\w)/g, (_, __, char) => char.toUpperCase());
          if (found && isPascal(name)) {
            info.declared.add(name);
            addComponent(name, statement, found.fn, found.genericProps, true);
            info.exports.set("default", { local: name });
          }
        }
      } else if (statement.kind === SK.FunctionDeclaration && statement.name) {
        const name = statement.name.text;
        info.declared.add(name);
        if (exported) info.exports.set(isDefault ? "default" : name, { local: name });
        addComponent(name, statement, statement, null, exported);
      } else if (statement.kind === SK.ClassDeclaration && statement.name) {
        const name = statement.name.text;
        info.declared.add(name);
        if (exported) info.exports.set(isDefault ? "default" : name, { local: name });
        const isReact = statement.heritageClauses?.some((clause) => /Component$/.test(clause.types[0]?.expression.getText() ?? ""));
        if (isReact) addComponent(name, statement, statement, statement.heritageClauses[0].types[0].typeArguments?.[0] ?? null, exported);
      } else if (statement.kind === SK.VariableStatement) {
        for (const declaration of statement.declarationList.declarations) {
          if (declaration.name.kind !== SK.Identifier) continue;
          const name = declaration.name.text;
          info.declared.add(name);
          if (exported) info.exports.set(name, { local: name });
          const initializer = unwrap(declaration.initializer);
          if (!initializer) continue;
          if (initializer.kind === SK.ObjectLiteralExpression) info.objects.set(name, objectKeys(initializer));
          else if (initializer.kind === SK.ArrayLiteralExpression) {
            const values = initializer.elements.map(literalValue);
            if (values.length && values.every((value) => value !== undefined)) info.arrays.set(name, values);
          } else if (initializer.kind === SK.CallExpression) {
            const variants = readVariantCall(initializer);
            if (variants) info.variantCalls.set(name, variants);
          }
          const found = componentFunction(initializer);
          if (found) addComponent(name, declaration, found.fn, found.genericProps, exported);
          else if (isPascal(name) && (initializer.kind === SK.PropertyAccessExpression || initializer.kind === SK.Identifier) && /(^|\.)[A-Z]\w*$/.test(initializer.getText()))
            // `const Select = SelectPrimitive.Root`: a component in name, with nothing of its own.
            info.components.set(name, { name, line: lineOf(declaration), fn: null, alias: initializer.getText(), genericProps: null, exported });
        }
      } else if (statement.kind === SK.TypeAliasDeclaration) {
        info.declared.add(statement.name.text);
        info.typeAliases.set(statement.name.text, statement.type);
        if (exported) info.exports.set(statement.name.text, { local: statement.name.text });
      } else if (statement.kind === SK.InterfaceDeclaration) {
        info.declared.add(statement.name.text);
        info.interfaces.set(statement.name.text, statement);
        if (exported) info.exports.set(statement.name.text, { local: statement.name.text });
      } else if (statement.kind === SK.EnumDeclaration) {
        info.declared.add(statement.name.text);
        if (exported) info.exports.set(statement.name.text, { local: statement.name.text });
      }
    }
    for (const [exportedName, entry] of info.exports) {
      const component = entry.local && info.components.get(entry.local);
      if (component) {
        component.exported = true;
        if (exportedName === "default") component.defaultExport = true;
      }
    }

    // Which top-level declaration is this node inside?
    const owners = [];
    for (const statement of sf.statements) {
      let name = null;
      if ((statement.kind === SK.FunctionDeclaration || statement.kind === SK.ClassDeclaration) && statement.name) name = statement.name.text;
      else if (statement.kind === SK.VariableStatement) name = statement.declarationList.declarations[0]?.name.getText() ?? null;
      owners.push({ pos: statement.pos, end: statement.end, name });
    }
    const ownerOf = (node) => owners.find((owner) => node.pos >= owner.pos && node.end <= owner.end)?.name ?? null;

    const visit = (node) => {
      if (node.kind === SK.JsxOpeningElement || node.kind === SK.JsxSelfClosingElement) {
        const tag = node.tagName.getText(sf);
        const attributes = readAttributes(node);
        if (/^[a-z]/.test(tag) && !tag.includes(".")) {
          const role = typeof attributes.props.role === "string" ? attributes.props.role : null;
          const inputType = tag === "input" ? (typeof attributes.props.type === "string" ? attributes.props.type : "text") : null;
          let kind = (role && ROLE_KIND[role]) ?? INTRINSIC_KIND[tag] ?? null;
          if (tag === "input" && !INPUT_TYPE_SKIP.has(inputType)) kind = INPUT_TYPE_KIND[inputType] ?? "inputs";
          if (attributes.props["aria-modal"] !== undefined) kind = "modals";
          if (kind || tag === "svg" || attributes.classes) {
            info.intrinsics.push({
              node,
              tag,
              role,
              inputType,
              kind,
              line: lineOf(node),
              classes: attributes.classes ?? [],
              classExpression: attributes.classExpression,
              unstyled: attributes.classes === null,
              styled: attributes.styled,
              spread: attributes.spread,
              hasChildren: node.kind === SK.JsxOpeningElement && node.parent.children.some((child) => child.kind !== SK.JsxText || child.text.trim() !== ""),
              hasElementChildren: node.kind === SK.JsxOpeningElement && node.parent.children.some(isJsx),
              owner: ownerOf(node),
            });
          }
        } else {
          info.usages.push({
            node,
            tag,
            line: lineOf(node),
            props: attributes.props,
            spread: attributes.spread,
            className: attributes.classes !== null,
            classes: attributes.classes ?? [],
            conditionalClasses: attributes.conditionalClasses,
            owner: ownerOf(node),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    return info;
  };

  for (const file of sourceFiles) {
    try {
      const info = parseFile(file);
      if (info) files.set(file, info);
    } catch (error) {
      errors.push({ file, message: String(error.message ?? error).split("\n")[0] });
    }
  }

  // ── Following names across files ───────────────────────────────────────────

  /** Where a name used in `file` is really declared. Follows imports and re-exports. */
  const resolveLocal = (file, name, depth = 0) => {
    const info = files.get(file);
    if (!info || depth > 12) return null;
    if (info.declared.has(name)) return { file, name };
    const imported = info.imports.get(name);
    if (!imported) return null;
    const target = resolveModule(file, imported.source);
    if (!target) return { external: imported.source, name: imported.imported };
    if (imported.imported === "*") return { namespace: target };
    return resolveExport(target, imported.imported, depth + 1);
  };
  const resolveExport = (file, exportedName, depth = 0) => {
    const info = files.get(file);
    if (!info || depth > 12) return null;
    const entry = info.exports.get(exportedName);
    if (entry) {
      if (entry.source) {
        const target = resolveModule(file, entry.source);
        return target ? resolveExport(target, entry.imported, depth + 1) : { external: entry.source, name: entry.imported };
      }
      return resolveLocal(file, entry.local, depth + 1);
    }
    for (const source of info.starExports) {
      const target = resolveModule(file, source);
      const found = target ? resolveExport(target, exportedName, depth + 1) : null;
      if (found && !found.external) return found;
    }
    return null;
  };

  const componentId = (file, name) => `${file}#${name}`;
  const componentAt = (resolved) => (resolved?.file ? files.get(resolved.file)?.components.get(resolved.name) : null);

  // ── Props ──────────────────────────────────────────────────────────────────

  const literalKeys = (typeNode) => {
    if (!typeNode) return [];
    if (typeNode.kind === SK.LiteralType && typeNode.literal.kind === SK.StringLiteral) return [typeNode.literal.text];
    if (typeNode.kind === SK.UnionType) return typeNode.types.flatMap(literalKeys);
    return [];
  };

  /**
   * The literal values a type can take.
   * Returns { values, boolean, open }: `open` means it also accepts things that cannot be listed.
   */
  const valuesOf = (typeNode, file, depth = 0) => {
    const none = { values: [], boolean: false, open: true };
    if (!typeNode || depth > 10) return none;
    const info = files.get(file);
    switch (typeNode.kind) {
      case SK.ParenthesizedType:
        return valuesOf(typeNode.type, file, depth + 1);
      case SK.LiteralType: {
        const literal = typeNode.literal;
        if (literal.kind === SK.StringLiteral || literal.kind === SK.NoSubstitutionTemplateLiteral) return { values: [literal.text], boolean: false, open: false };
        if (literal.kind === SK.NumericLiteral) return { values: [Number(literal.text)], boolean: false, open: false };
        if (literal.kind === SK.TrueKeyword || literal.kind === SK.FalseKeyword) return { values: [], boolean: true, open: false };
        return { values: [], boolean: false, open: false };
      }
      case SK.BooleanKeyword:
        return { values: [], boolean: true, open: false };
      case SK.UndefinedKeyword:
      case SK.NullKeyword:
      case SK.NeverKeyword:
        return { values: [], boolean: false, open: false };
      case SK.UnionType: {
        const merged = { values: [], boolean: false, open: false };
        for (const part of typeNode.types) {
          const result = valuesOf(part, file, depth + 1);
          merged.values.push(...result.values);
          merged.boolean ||= result.boolean;
          merged.open ||= result.open;
        }
        merged.values = [...new Set(merged.values)];
        return merged;
      }
      case SK.TypeOperator: {
        if (typeNode.operator !== SK.KeyOfKeyword) return none;
        const operand = typeNode.type;
        if (operand.kind === SK.TypeQuery) {
          const resolved = resolveLocal(file, operand.exprName.getText().split(".")[0]);
          const keys = resolved?.file ? files.get(resolved.file).objects.get(resolved.name) : null;
          if (keys) return { values: keys, boolean: false, open: false };
        }
        return none;
      }
      case SK.IndexedAccessType: {
        const object = typeNode.objectType.kind === SK.ParenthesizedType ? typeNode.objectType.type : typeNode.objectType;
        if (object.kind === SK.TypeQuery && typeNode.indexType.kind === SK.NumberKeyword) {
          const resolved = resolveLocal(file, object.exprName.getText().split(".")[0]);
          const values = resolved?.file ? files.get(resolved.file).arrays.get(resolved.name) : null;
          if (values) return { values, boolean: false, open: false };
        }
        const key = literalKeys(typeNode.indexType)[0];
        if (key) {
          const members = new Map();
          collectMembers(object, file, members, new Set(), depth + 1, new Set());
          const member = members.get(key);
          if (member) return member.resolved ?? valuesOf(member.typeNode, member.file, depth + 1);
        }
        return none;
      }
      case SK.TypeReference: {
        const name = typeNode.typeName.getText();
        const args = typeNode.typeArguments ?? [];
        if (name === "NonNullable" || name === "Required") return valuesOf(args[0], file, depth + 1);
        if (name === "Exclude" || name === "Extract") {
          const base = valuesOf(args[0], file, depth + 1);
          const other = new Set(valuesOf(args[1], file, depth + 1).values);
          return { ...base, values: base.values.filter((value) => other.has(value) === (name === "Extract")) };
        }
        const resolved = resolveLocal(file, name.split(".")[0]);
        const target = resolved?.file ? files.get(resolved.file) : null;
        const alias = target?.typeAliases.get(resolved.name);
        if (alias) return valuesOf(alias, resolved.file, depth + 1);
        return none;
      }
      default:
        if (info && typeNode.kind === SK.TypeQuery) return none;
        return none;
    }
  };

  const NATIVE_FROM_ATTRIBUTES = [
    [/ButtonHTMLAttributes/, "button"],
    [/InputHTMLAttributes/, "input"],
    [/TextareaHTMLAttributes/, "textarea"],
    [/SelectHTMLAttributes/, "select"],
    [/AnchorHTMLAttributes/, "a"],
    [/TableHTMLAttributes/, "table"],
    [/HTMLAttributes|HTMLProps/, "element"],
  ];

  /** The component whose props are being collected, so props borrowed from another component can be told apart. */
  let currentComponentId = null;

  /** Collect a props type's members into `members`, and what it extends that cannot be listed into `extended`. */
  function collectMembers(typeNode, file, members, extended, depth, seen) {
    if (!typeNode || depth > 10) return;
    const info = files.get(file);
    const addMember = (member) => {
      const name = propertyName(member.name);
      if (name === null) return;
      members.set(name, { optional: !!member.questionToken, typeNode: member.type ?? null, file });
    };
    const fromReference = (name, args) => {
      const base = name.split(".").pop();
      if (base === "Omit" || base === "Pick") {
        const inner = new Map();
        collectMembers(args[0], file, inner, extended, depth + 1, seen);
        const keys = new Set(literalKeys(args[1]));
        for (const [key, value] of inner) if (keys.has(key) === (base === "Pick")) members.set(key, value);
        return;
      }
      if (/^(Partial|Required|Readonly|NonNullable|PropsWithChildren|PropsWithoutRef|PropsWithRef)$/.test(base)) {
        collectMembers(args[0], file, members, extended, depth + 1, seen);
        return;
      }
      if (base === "VariantProps") {
        const query = args[0];
        const resolved = query?.kind === SK.TypeQuery ? resolveLocal(file, query.exprName.getText().split(".")[0]) : null;
        const variants = resolved?.file ? files.get(resolved.file).variantCalls.get(resolved.name) : null;
        if (variants)
          for (const [axis, values] of Object.entries(variants.variants))
            members.set(axis, {
              optional: true,
              typeNode: null,
              file,
              resolved: { values: values.filter((value) => value !== "true" && value !== "false"), boolean: values.includes("true") || values.includes("false"), open: false },
              source: "variants",
              default: variants.defaults[axis],
            });
        else extended.add(`VariantProps<${query?.getText() ?? "?"}>`);
        return;
      }
      if (/^ComponentProps(WithRef|WithoutRef)?$/.test(base) || base === "ComponentPropsWithoutRef") {
        const query = args[0];
        if (query?.kind === SK.TypeQuery && query.exprName.kind === SK.Identifier) {
          const resolved = resolveLocal(file, query.exprName.text);
          const component = componentAt(resolved);
          if (component) {
            const id = componentId(resolved.file, resolved.name);
            if (!seen.has(id)) {
              seen.add(id);
              const inherited = propsOf(resolved.file, component, seen);
              for (const [key, value] of inherited.members) members.set(key, { ...value, inheritedFrom: value.inheritedFrom ?? resolved.name });
              for (const entry of inherited.extended) extended.add(entry);
            }
            return;
          }
        }
        const literal = literalKeys(query)[0];
        extended.add(literal ? `<${literal}>` : (query?.getText().replace(/^typeof\s+/, "") ?? name));
        return;
      }
      for (const [pattern, tag] of NATIVE_FROM_ATTRIBUTES)
        if (pattern.test(base)) {
          extended.add(tag === "element" ? "HTML attributes" : `<${tag}>`);
          return;
        }
      const resolved = resolveLocal(file, name.split(".")[0]);
      const target = resolved?.file ? files.get(resolved.file) : null;
      const declaration = target?.typeAliases.get(resolved.name) ?? target?.interfaces.get(resolved.name);
      if (!declaration) {
        extended.add(name);
        return;
      }
      // `ButtonProps` reused by another component: those props are Button's to show, not this one's.
      const owner = resolved.name.replace(/Props$/, "");
      const borrowed = owner !== resolved.name && target.components.has(owner) && componentId(resolved.file, owner) !== currentComponentId ? owner : null;
      const inner = new Map();
      collectMembers(declaration, resolved.file, inner, extended, depth + 1, seen);
      for (const [key, value] of inner) members.set(key, borrowed && !value.inheritedFrom ? { ...value, inheritedFrom: borrowed } : value);
    };

    switch (typeNode.kind) {
      case SK.TypeLiteral:
        for (const member of typeNode.members) addMember(member);
        break;
      case SK.IntersectionType:
      case SK.UnionType:
        for (const part of typeNode.types) collectMembers(part, file, members, extended, depth + 1, seen);
        break;
      case SK.ParenthesizedType:
        collectMembers(typeNode.type, file, members, extended, depth + 1, seen);
        break;
      case SK.TypeReference:
        fromReference(typeNode.typeName.getText(), typeNode.typeArguments ?? []);
        break;
      case SK.InterfaceDeclaration:
        for (const clause of typeNode.heritageClauses ?? []) for (const type of clause.types) fromReference(type.expression.getText(), type.typeArguments ?? []);
        for (const member of typeNode.members) addMember(member);
        break;
      default:
        if (info) break;
    }
  }

  const propsCache = new Map();
  function propsOf(file, component, seen = new Set()) {
    const id = componentId(file, component.name);
    if (propsCache.has(id)) return propsCache.get(id);
    const members = new Map();
    const extended = new Set();
    const result = { members, extended, defaults: {}, destructured: [] };
    propsCache.set(id, result);
    seen.add(id);
    const fn = component.fn;
    if (!fn) {
      extended.add(component.alias);
      return result;
    }
    const parameter = fn.kind === SK.ClassDeclaration ? null : fn.parameters?.[0];
    const typeNode = parameter?.type ?? component.genericProps;
    const outer = currentComponentId;
    currentComponentId = id;
    if (typeNode) collectMembers(typeNode, file, members, extended, 0, seen);
    currentComponentId = outer;
    if (parameter?.name.kind === SK.ObjectBindingPattern) {
      for (const element of parameter.name.elements) {
        if (element.dotDotDotToken) continue;
        const name = propertyName(element.propertyName ?? element.name);
        if (name === null) continue;
        result.destructured.push(name);
        const value = element.initializer ? literalValue(element.initializer) : undefined;
        if (value !== undefined) result.defaults[name] = value;
      }
    }
    return result;
  }

  // ── Components ─────────────────────────────────────────────────────────────

  const kindByName = (name) => KIND_BY_NAME.find(([, pattern]) => pattern.test(name))?.[0] ?? "other";
  const typeText = (member) => {
    if (!member.typeNode) return member.source === "variants" ? "variant" : "unknown";
    const text = member.typeNode.getText().replace(/\s+/g, " ");
    return text.length > 90 ? `${text.slice(0, 87)}...` : text;
  };
  const pascalOf = (file) =>
    path.posix
      .basename(file)
      .replace(/\.[^.]+$/, "")
      .replace(/(^|[-_.])(\w)/g, (_, __, char) => char.toUpperCase());

  const resolveTag = (file, tag) => {
    const [head, ...rest] = tag.split(".");
    const resolved = resolveLocal(file, head);
    if (!resolved) return null;
    if (resolved.external) return { external: resolved.external };
    if (resolved.namespace) return rest.length === 1 ? resolveExport(resolved.namespace, rest[0]) : null;
    return rest.length ? null : resolved;
  };

  const components = new Map();
  const icons = { count: 0, files: {} };

  for (const [file, info] of files) {
    if (inAudit(file)) continue;
    const tagOf = (opening) => opening.tagName.getText(info.sf);
    /** The raw element a component really renders, looking through wrappers such as <Tooltip>. */
    const descend = (opening, depth = 0) => {
      if (/^[a-z]/.test(tagOf(opening))) return opening;
      if (depth >= 4 || opening.kind !== SK.JsxOpeningElement) return null;
      const children = opening.parent.children.filter((child) => child.kind === SK.JsxElement || child.kind === SK.JsxSelfClosingElement);
      if (children.length !== 1) return null;
      return descend(children[0].kind === SK.JsxElement ? children[0].openingElement : children[0], depth + 1);
    };

    // Class strings in `cva(...)` / `tv(...)` definitions, by variable name, so a component's own classes include its variants.
    const variantClassStrings = new Map();
    for (const statement of info.sf.statements) {
      if (statement.kind !== SK.VariableStatement) continue;
      for (const declaration of statement.declarationList.declarations) {
        const init = unwrap(declaration.initializer);
        if (!init || init.kind !== SK.CallExpression || !/^(cva|tv)$/.test(init.expression.getText()) || declaration.name.kind !== SK.Identifier) continue;
        const tokens = [];
        const visit = (node) => {
          if (node.kind === SK.StringLiteral || node.kind === SK.NoSubstitutionTemplateLiteral) tokens.push(...node.text.split(/\s+/).filter(Boolean));
          ts.forEachChild(node, visit);
        };
        visit(init);
        variantClassStrings.set(declaration.name.text, tokens);
      }
    }
    /** Every class the component sets itself: strings in its body, and the variant definitions it calls. */
    const ownClassTokens = (fn) => {
      if (!fn) return [];
      const tokens = new Set();
      const visit = (node) => {
        if (node.kind === SK.StringLiteral || node.kind === SK.NoSubstitutionTemplateLiteral) for (const token of node.text.split(/\s+/)) if (token) tokens.add(token);
        if (node.kind === SK.Identifier && variantClassStrings.has(node.text)) for (const token of variantClassStrings.get(node.text)) tokens.add(token);
        ts.forEachChild(node, visit);
      };
      visit(fn);
      return [...tokens];
    };

    for (const component of info.components.values()) {
      const roots = component.fn ? rootElements(component.fn) : [];
      const rootTags = [...new Set(roots.map(tagOf))];
      if (ICON_FILE.test(file) || (rootTags.length && rootTags.every((tag) => tag === "svg"))) {
        icons.count += 1;
        icons.files[file] = (icons.files[file] ?? 0) + 1;
        continue;
      }
      const props = propsOf(file, component);
      const list = [];
      const propNames = new Set([...props.members.keys(), ...props.destructured]);
      for (const name of propNames) {
        const member = props.members.get(name);
        const resolved = member ? (member.resolved ?? valuesOf(member.typeNode, member.file)) : { values: [], boolean: false, open: true };
        const entry = { name, type: member ? typeText(member) : "unknown", optional: member ? member.optional : true };
        if (resolved.values.length) entry.values = resolved.values;
        if (resolved.boolean) entry.boolean = true;
        if (resolved.open && resolved.values.length) entry.open = true;
        const fallback = props.defaults[name] ?? member?.default;
        if (fallback !== undefined) entry.default = fallback;
        if (member?.inheritedFrom) entry.inheritedFrom = member.inheritedFrom;
        list.push(entry);
      }
      const axes = [];
      for (const prop of list) {
        if (prop.name === "children" || prop.name === "className") continue;
        // Variants a wrapper inherits from the component it wraps are that component's to show.
        const own = !prop.inheritedFrom;
        const extra = { ...(prop.default !== undefined ? { default: prop.default } : {}), ...(own ? {} : { inheritedFrom: prop.inheritedFrom }) };
        if (prop.values?.length >= 2) axes.push({ name: prop.name, kind: "enum", values: prop.values, ...extra, required: own });
        else if (prop.boolean) axes.push({ name: prop.name, kind: "boolean", values: [true], ...extra, required: own && VISUAL_BOOLEAN.test(prop.name) });
      }

      const componentRoot = roots.find((root) => /^[A-Z]/.test(tagOf(root))) ?? null;
      const intrinsicRoots = roots.map((root) => descend(root)).filter(Boolean);
      const rootIntrinsic = intrinsicRoots.map((root) => info.intrinsics.find((entry) => entry.node === root)).find((entry) => entry?.kind) ?? null;
      const spreads = (opening) => opening.attributes.properties.some((attribute) => attribute.kind === SK.JsxSpreadAttribute);
      const shared = isShared(file);

      // The root's `data-slot` (shadcn and similar), which tells this component's element apart on a page.
      const slotAttribute = roots
        .flatMap((root) => root.attributes.properties)
        .find((attribute) => attribute.kind === SK.JsxAttribute && attribute.name.getText() === "data-slot" && attribute.initializer?.kind === SK.StringLiteral);
      components.set(componentId(file, component.name), {
        id: componentId(file, component.name),
        name: component.name,
        file,
        line: component.line,
        exported: !!component.exported,
        shared,
        version: false,
        kind: shared ? kindByName(component.name) : null,
        wraps: null,
        wrapsComponent: null,
        native: [...props.extended].map((entry) => entry.match(/^<(\w+)>$/)?.[1]).find(Boolean) ?? rootIntrinsic?.tag ?? null,
        extends: [...props.extended],
        props: list,
        axes,
        primary: null,
        part: false,
        parts: [],
        uses: 0,
        files: 0,
        internalUses: 0,
        classNameOverrides: 0,
        spreadUses: 0,
        propUsage: {},
        combos: [],
        neverPassed: [],
        generated: null,
        callSites: [],
        examples: [],
        // Working fields, removed before output.
        _rootIntrinsic: rootIntrinsic,
        _own: ownClassTokens(component.fn),
        ...(slotAttribute ? { slot: slotAttribute.initializer.text } : {}),
        _generic: intrinsicRoots.some(spreads) || propNames.has("children"),
        _rootComponent: componentRoot ? { tag: tagOf(componentRoot), spread: spreads(componentRoot) } : null,
      });
    }

    // Compound components: DialogContent and DialogHeader are parts of Dialog.
    const here = [...info.components.keys()].map((name) => components.get(componentId(file, name))).filter((component) => component?.exported);
    const base = pascalOf(file);
    const primaries = [];
    const named = here.find((component) => component.name === base);
    if (named) primaries.push(named);
    for (const component of [...here].sort((a, b) => a.name.length - b.name.length)) {
      if (primaries.some((primary) => component.name.startsWith(primary.name))) continue;
      if (here.some((other) => other !== component && other.name.startsWith(component.name))) primaries.push(component);
    }
    for (const component of here) {
      const owner = primaries.filter((primary) => primary !== component && component.name.startsWith(primary.name)).sort((a, b) => b.name.length - a.name.length)[0];
      if (!owner) continue;
      component.part = true;
      component.primary = owner.id;
      component.kind = owner.kind;
      owner.parts.push(component.id);
    }
  }

  /**
   * Can this call site be lifted out of its file as it is? It can when everything in it is
   * written out: literal props, text, and components that are imported. Handlers become
   * no-ops. Anything that reads local state or data cannot, and is left for the agent.
   * Returns the usage's code with `{...props}` spread on the root, and the imports it needs.
   */
  const portableSpecimen = (file, usageNode) => {
    const info = files.get(file);
    const sf = info.sf;
    const element = usageNode.kind === SK.JsxOpeningElement ? usageNode.parent : usageNode;
    /** The classes call sites use to restyle the component this tag renders. */
    const overrideTokensOf = (opening) => {
      const resolved = resolveTag(file, opening.tagName.getText(sf));
      const target = resolved?.file ? components.get(componentId(resolved.file, resolved.name)) : null;
      return new Set((target?.overrides?.patterns ?? []).flatMap((pattern) => pattern.classes));
    };
    const edits = [];
    const imports = new Map();
    let ok = true;
    let hasText = false;

    const needTag = (tagNode) => {
      const text = tagNode.getText(sf);
      if (/^[a-z]/.test(text) && !text.includes(".")) return;
      const head = text.split(".")[0];
      const imported = info.imports.get(head);
      if (!imported) ok = false;
      else imports.set(head, imported);
    };
    const expressionOk = (expression) => {
      const inner = unwrap(expression);
      if (!inner) return true;
      const literal = literalValue(inner);
      if (literal !== undefined) {
        if (typeof literal === "string" && /\p{L}/u.test(literal)) hasText = true;
        return true;
      }
      if (isJsx(inner)) {
        visit(inner);
        return ok;
      }
      return false;
    };
    const visitOpening = (opening) => {
      needTag(opening.tagName);
      for (const attribute of opening.attributes.properties) {
        if (attribute.kind === SK.JsxSpreadAttribute) {
          ok = false;
          return;
        }
        const name = attribute.name.getText(sf);
        if (name === "key" || name === "ref") {
          edits.push({ start: attribute.getFullStart(), end: attribute.end, text: "" });
          continue;
        }
        // The specimen shows the component as written: the call site's restyling is shown
        // separately, under overrides. Placement classes may stay.
        const overrideTokens = name === "className" ? overrideTokensOf(opening) : null;
        if (overrideTokens?.size) {
          const literal = attribute.initializer?.kind === SK.StringLiteral ? attribute.initializer.text : null;
          const kept = literal === null ? [] : literal.split(/\s+/).filter((token) => token && !overrideTokens.has(token));
          if (literal === null || kept.length < literal.split(/\s+/).filter(Boolean).length)
            edits.push({ start: attribute.getFullStart(), end: attribute.end, text: kept.length ? ` className="${kept.join(" ")}"` : "" });
          continue;
        }
        if (!attribute.initializer || attribute.initializer.kind === SK.StringLiteral) continue;
        if (/^on[A-Z]/.test(name)) {
          edits.push({ start: attribute.initializer.getStart(sf), end: attribute.initializer.end, text: "{() => {}}" });
          continue;
        }
        if (!expressionOk(attribute.initializer.expression)) {
          ok = false;
          return;
        }
      }
    };
    const visitChild = (child) => {
      if (child.kind === SK.JsxText) {
        if (/\p{L}/u.test(child.text)) hasText = true;
      } else if (child.kind === SK.JsxExpression) {
        if (child.expression && !expressionOk(child.expression)) ok = false;
      } else visit(child);
    };
    function visit(node) {
      if (!ok) return;
      if (node.kind === SK.JsxElement) {
        visitOpening(node.openingElement);
        for (const child of node.children) visitChild(child);
      } else if (node.kind === SK.JsxSelfClosingElement) visitOpening(node);
      else if (node.kind === SK.JsxFragment) for (const child of node.children) visitChild(child);
    }
    visit(element);
    if (!ok) return null;

    const root = element.kind === SK.JsxElement ? element.openingElement : element;
    edits.push({ start: root.attributes.end, end: root.attributes.end, text: " {...props}" });
    const base = element.getStart(sf);
    let code = sf.text.slice(base, element.end);
    for (const edit of edits.sort((a, b) => b.start - a.start)) code = code.slice(0, edit.start - base) + edit.text + code.slice(edit.end - base);
    // Drop the indentation the usage had in its file.
    const lines = code.split("\n");
    const indent = Math.min(...lines.slice(1).filter((line) => line.trim()).map((line) => line.match(/^\s*/)[0].length), Infinity);
    if (Number.isFinite(indent)) code = [lines[0], ...lines.slice(1).map((line) => line.slice(indent))].join("\n");

    return {
      code,
      hasText,
      imports: [...imports].map(([local, imported]) => {
        const resolved = resolveModule(file, imported.source);
        const isPackage = !imported.source.startsWith(".") && packages.some((pkg) => imported.source === pkg.name || imported.source.startsWith(`${pkg.name}/`));
        return {
          local,
          imported: imported.imported,
          source: imported.source,
          // A relative or aliased import only means something from the file it was written in.
          file: imported.source.startsWith(".") || (resolved && !isPackage) ? resolved : null,
        };
      }),
    };
  };

  // ── Call sites ─────────────────────────────────────────────────────────────

  const external = {};
  const auditUsages = [];

  for (const [file, info] of files) {
    for (const usage of info.usages) {
      const resolved = resolveTag(file, usage.tag);
      if (resolved?.external) {
        external[resolved.external] = (external[resolved.external] ?? 0) + 1;
        continue;
      }
      const component = resolved?.file ? components.get(componentId(resolved.file, resolved.name)) : null;
      if (!component) continue;
      const site = {
        file,
        line: usage.line,
        props: usage.props,
        ...(usage.spread ? { spread: true } : {}),
        ...(usage.className ? { className: true, classes: usage.classes, ...(usage.conditionalClasses.length ? { conditionalClasses: usage.conditionalClasses } : {}) } : {}),
      };
      if (inAudit(file)) {
        auditUsages.push({ component: component.id, ...site });
        continue;
      }
      // Inside a shared library, one component using another is composition, not a call site.
      if (file === component.file && component.shared) {
        component.internalUses += 1;
        continue;
      }
      component.callSites.push(site);
      component.examples.push({ file, line: usage.line, length: usage.node.end - usage.node.pos, node: usage.node, sf: info.sf });
    }
  }

  for (const component of components.values()) {
    component.uses = component.callSites.length;
    component.files = new Set(component.callSites.map((site) => site.file)).size;
  }

  // Which components are part of the design system: every exported shared one, plus
  // local components that are reusable wrappers of a raw element or of a shared component.
  for (const component of components.values()) if (component.shared && component.exported) component.version = true;
  for (let round = 0, changed = true; changed && round < 4; round += 1) {
    changed = false;
    for (const component of components.values()) {
      if (component.version || component.shared) continue;
      const intrinsic = component._rootIntrinsic;
      if (intrinsic && (component._generic || component.uses >= 2)) {
        component.version = true;
        component.kind = intrinsic.kind;
        component.wraps = `<${intrinsic.tag}>`;
        changed = true;
        continue;
      }
      const rootComponent = component._rootComponent;
      if (!rootComponent?.spread) continue;
      const resolved = resolveTag(component.file, rootComponent.tag);
      const target = resolved?.file ? components.get(componentId(resolved.file, resolved.name)) : null;
      if (target?.version && target !== component) {
        component.version = true;
        component.kind = target.kind;
        component.wrapsComponent = target.id;
        changed = true;
      }
    }
  }

  for (const component of components.values()) {
    if (!component.version) continue;
    const axisNames = component.axes.map((axis) => axis.name);
    const combos = new Map();
    for (const site of component.callSites) {
      if (site.className) component.classNameOverrides += 1;
      if (site.spread) component.spreadUses += 1;
      for (const [name, value] of Object.entries(site.props)) {
        const usage = (component.propUsage[name] ??= { count: 0, values: {}, dynamic: 0 });
        usage.count += 1;
        if (value && typeof value === "object") {
          usage.dynamic += 1;
          for (const possible of value.values ?? []) usage.values[`${possible} (conditional)`] = (usage.values[`${possible} (conditional)`] ?? 0) + 1;
        } else if (Object.keys(usage.values).length < 40 || usage.values[String(value)]) usage.values[String(value)] = (usage.values[String(value)] ?? 0) + 1;
      }
      if (axisNames.length) {
        const combo = {};
        for (const name of axisNames) {
          const value = site.props[name];
          if (value === undefined) continue;
          combo[name] = value && typeof value === "object" ? "(dynamic)" : value;
        }
        const key = JSON.stringify(combo);
        const entry = combos.get(key) ?? { props: combo, count: 0, example: `${site.file}:${site.line}` };
        entry.count += 1;
        combos.set(key, entry);
      }
    }
    component.combos = [...combos.values()].sort((a, b) => b.count - a.count);

    // Call sites that restyle the component, grouped by the classes they add.
    const patterns = new Map();
    let placementOnly = 0;
    for (const site of component.callSites) {
      if (!site.className) continue;
      const conditional = new Set(site.conditionalClasses ?? []);
      const sorted = classifyOverride(site.classes ?? [], component._own, theme);
      const flagged = [...sorted.replaces.map((entry) => entry.token), ...sorted.inside, ...sorted.adds];
      if (!flagged.length) {
        if ((site.classes ?? []).length) placementOnly += 1;
        continue;
      }
      site.override = true;
      const key = [...flagged].sort().join(" ");
      let pattern = patterns.get(key);
      if (!pattern) {
        // Only the variant props: anything else (value, open, href) can change what the specimen shows.
        const literalProps = Object.fromEntries(Object.entries(site.props).filter(([name, value]) => axisNames.includes(name) && (value === null || typeof value !== "object")));
        pattern = {
          classes: flagged,
          replaces: sorted.replaces,
          inside: sorted.inside,
          adds: sorted.adds,
          conditional: flagged.filter((token) => conditional.has(token)),
          placement: sorted.placement,
          props: literalProps,
          count: 0,
          sites: [],
        };
        patterns.set(key, pattern);
      }
      pattern.count += 1;
      pattern.sites.push(`${site.file}:${site.line}`);
    }
    const overrideList = [...patterns.values()].sort((a, b) => b.count - a.count || b.replaces.length - a.replaces.length);
    // The component's own visual classes, to recognise its element on a page: generic layout classes
    // (flex, items-center) would match anything, so only radius, colour, type, border, padding and size.
    if (overrideList.length)
      component.ownClasses = component._own
        .filter((token) => !/[${}]/.test(token) && !token.includes(":") && /^(rounded|bg-|text-|border|p[xytblrse]?-|h-|size-|shadow|font-|ring|tracking|leading|opacity)/.test(token))
        .slice(0, 80);
    component.overrides = {
      sites: overrideList.reduce((sum, pattern) => sum + pattern.count, 0),
      replacing: overrideList.filter((pattern) => pattern.replaces.length).reduce((sum, pattern) => sum + pattern.count, 0),
      placementOnly,
      patterns: overrideList,
    };
    for (const axis of component.axes) {
      const used = component.propUsage[axis.name]?.values ?? {};
      const passed = new Set(Object.keys(used).map((key) => key.replace(/ \(conditional\)$/, "")));
      axis.used = Object.fromEntries(Object.entries(used).filter(([key]) => !key.endsWith("(conditional)")));
      if (axis.kind === "enum") axis.neverUsed = axis.values.filter((value) => !passed.has(String(value)) && value !== axis.default);
    }
    component.neverPassed =
      component.uses > 0 && component.spreadUses === 0
        ? component.props.map((prop) => prop.name).filter((name) => name !== "children" && name !== "className" && !component.propUsage[name])
        : [];
  }

  // Second pass, once every component's overrides are known: specimens leave them out.
  for (const component of components.values()) {
    if (!component.version) continue;
    // A specimen the script can write by itself: the simplest call site that stands on its own.
    const axisNameSet = new Set(component.axes.map((axis) => axis.name));
    let best = null;
    component.examples.forEach((example, index) => {
      const site = component.callSites[index];
      const candidate = portableSpecimen(example.file, example.node);
      if (!candidate) return;
      const score = [Object.keys(site.props).filter((name) => axisNameSet.has(name)).length, candidate.hasText ? 0 : 1, candidate.code.length];
      if (!best || score.some((value, position) => value !== best.score[position] && score.slice(0, position).every((earlier, at) => earlier === best.score[at]) && value < best.score[position]))
        best = { score, from: `${site.file}:${site.line}`, code: candidate.code, imports: candidate.imports };
    });
    component.generated = best ? { from: best.from, code: best.code, imports: best.imports } : null;

    // Three real call sites to copy content from, shortest first.
    component.examples = component.examples
      .sort((a, b) => a.length - b.length)
      .filter((example) => example.length > component.name.length + 6)
      .slice(0, 3)
      .map((example) => ({ at: `${example.file}:${example.line}`, code: snippetOf(example.sf, example.node) }));
  }

  // ── Hand-rolled elements ───────────────────────────────────────────────────

  const visualTokens = (classes) => [...new Set(classes.filter((token) => !token.includes(":") && !LAYOUT_TOKEN.test(token) && !/[${}]/.test(token)))].sort();
  const signatureOf = (intrinsic) => {
    if (intrinsic.unstyled) return intrinsic.styled ? "(inline style only)" : "(unstyled)";
    const tokens = visualTokens(intrinsic.classes);
    if (tokens.length) return tokens.join(" ");
    return intrinsic.classExpression ? `(dynamic) ${intrinsic.classExpression}` : "(layout classes only)";
  };
  /** A coarser grouping than the signature: colour, border, radius, shadow. Sizes and spacing are ignored. */
  const lookFamilyOf = (intrinsic) => {
    const tokens = visualTokens(intrinsic.classes).filter(
      (token) => /^(bg-|border|rounded|shadow|ring|underline|outline)/.test(token) || (/^text-/.test(token) && !/^text-(\d?xs|sm|base|lg|\d?xl|\[\d)/.test(token)),
    );
    return tokens.join(" ") || "(no colour, border, or radius)";
  };

  const clusters = new Map();
  for (const [file, info] of files) {
    if (inAudit(file) || isShared(file) || ICON_FILE.test(file)) continue;
    for (const intrinsic of info.intrinsics) {
      let kind = intrinsic.kind;
      let confidence = "high";
      const has = (pattern) => intrinsic.classes.some((token) => pattern.test(token));
      if (!kind) {
        // Look-alikes: only worth reporting when the same look repeats.
        if (/^(div|section|article|li)$/.test(intrinsic.tag) && has(/^border(-|$)/) && has(/^rounded/) && has(/^p[xy]?-/) && intrinsic.hasElementChildren) kind = "cards";
        else if (/^(span|div)$/.test(intrinsic.tag) && has(/^rounded/) && has(/^px-/) && has(/^text-(xs|2xs|\[1[0-2]px\])/) && has(/^bg-/) && !intrinsic.hasElementChildren) kind = "badges";
        else if (intrinsic.tag === "div" && has(/^fixed$/) && has(/^inset-0$/)) kind = "modals";
        else continue;
        confidence = "low";
      }
      // The root of a reusable wrapper is that component, not a hand-rolled copy.
      const owner = intrinsic.owner ? components.get(componentId(file, intrinsic.owner)) : null;
      if (owner?.version && owner._rootIntrinsic === intrinsic) continue;
      const signature = signatureOf(intrinsic);
      const key = `${kind}|${intrinsic.tag}|${intrinsic.inputType ?? ""}|${intrinsic.role ?? ""}|${signature}`;
      const cluster = clusters.get(key) ?? {
        id: `${kind}-${crypto.createHash("sha1").update(key).digest("hex").slice(0, 8)}`,
        kind,
        tag: intrinsic.tag,
        ...(intrinsic.role ? { role: intrinsic.role } : {}),
        ...(intrinsic.inputType ? { inputType: intrinsic.inputType } : {}),
        confidence,
        signature,
        lookFamily: lookFamilyOf(intrinsic),
        count: 0,
        files: 0,
        inlineStyle: false,
        locations: [],
        example: null,
        _example: { node: intrinsic.node, sf: info.sf, file, line: intrinsic.line },
      };
      cluster.count += 1;
      cluster.inlineStyle ||= intrinsic.styled;
      cluster.locations.push({ file, line: intrinsic.line, in: intrinsic.owner });
      clusters.set(key, cluster);
    }
  }
  const handRolled = [...clusters.values()]
    .filter((cluster) => cluster.confidence === "high" || cluster.count >= 2)
    .map(({ _example, ...cluster }) => ({
      ...cluster,
      files: new Set(cluster.locations.map((location) => location.file)).size,
      example: { at: `${_example.file}:${_example.line}`, code: snippetOf(_example.sf, _example.node, 1200) },
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.lookFamily.localeCompare(b.lookFamily) || b.count - a.count);

  // What the audit page itself renders by hand, so hand-rolled looks can be matched against it,
  // and what each specimen claims to be a copy of.
  const normalize = (text) => text.replace(/\s+/g, " ").trim();
  const isContent = (text) => text.length > 1 && /\p{L}/u.test(text);
  const CONTENT_ATTRIBUTE = /^(label|title|placeholder|alt|aria-label|description|tooltip|heading|subtitle|caption)$/;

  /** Every piece of written text in a source file, and the file's code with whitespace collapsed. */
  const sourceCache = new Map();
  const sourceOf = (rel) => {
    if (sourceCache.has(rel)) return sourceCache.get(rel);
    let info = files.get(rel) ?? null;
    if (!info && fs.existsSync(path.join(root, rel))) {
      try {
        info = parseFile(rel);
      } catch {
        info = null;
      }
    }
    let result = null;
    if (info) {
      const texts = new Set();
      const visit = (node) => {
        if (node.kind === SK.StringLiteral || node.kind === SK.NoSubstitutionTemplateLiteral || node.kind === SK.JsxText || node.kind === SK.TemplateHead || node.kind === SK.TemplateMiddle || node.kind === SK.TemplateTail) {
          const text = normalize(node.text);
          if (text) texts.add(text);
        }
        ts.forEachChild(node, visit);
      };
      visit(info.sf);
      result = { texts: [...texts], code: normalize(info.sf.text) };
    }
    sourceCache.set(rel, result);
    return result;
  };

  /** The text a specimen would show: JSX text, string children, and labelling attributes. Not class names or prop values. */
  const visibleTexts = (node) => {
    const out = [];
    const fromExpression = (expression) => {
      const inner = unwrap(expression);
      if (!inner) return;
      if (inner.kind === SK.StringLiteral || inner.kind === SK.NoSubstitutionTemplateLiteral) out.push(inner.text);
      else if (inner.kind === SK.TemplateExpression) {
        out.push(inner.head.text);
        for (const span of inner.templateSpans) out.push(span.literal.text);
      } else if (inner.kind === SK.ConditionalExpression) {
        fromExpression(inner.whenTrue);
        fromExpression(inner.whenFalse);
      } else if (inner.kind === SK.BinaryExpression) {
        fromExpression(inner.right);
        if (inner.operatorToken.kind === SK.BarBarToken || inner.operatorToken.kind === SK.QuestionQuestionToken) fromExpression(inner.left);
      } else if (isJsx(inner)) visit(inner);
      else {
        const findJsx = (child) => {
          if (isJsx(child)) visit(child);
          else ts.forEachChild(child, findJsx);
        };
        ts.forEachChild(inner, findJsx);
      }
    };
    const visit = (child) => {
      if (child.kind === SK.JsxText) out.push(child.text);
      else if (child.kind === SK.JsxExpression && (child.parent.kind === SK.JsxElement || child.parent.kind === SK.JsxFragment)) {
        fromExpression(child.expression);
        return;
      } else if (child.kind === SK.JsxAttribute && child.initializer) {
        if (CONTENT_ATTRIBUTE.test(child.name.getText())) {
          if (child.initializer.kind === SK.StringLiteral) out.push(child.initializer.text);
          else fromExpression(child.initializer.expression);
          return;
        }
        if (child.initializer.kind === SK.JsxExpression) {
          // A prop that holds JSX, such as icon={<PlusIcon />}: look inside it for text.
          const findJsx = (inner) => {
            if (isJsx(inner)) visit(inner);
            else ts.forEachChild(inner, findJsx);
          };
          if (child.initializer.expression) findJsx(child.initializer.expression);
        }
        return;
      }
      ts.forEachChild(child, visit);
    };
    visit(node);
    return [...new Set(out.map(normalize).filter(isContent))];
  };

  const isKey = (text) => /\.[cm]?[jt]sx?#[A-Za-z_$][\w$]*$/.test(text) || /^[a-z]+-[0-9a-f]{8}$/.test(text);
  const looksById = new Map(handRolled.map((look) => [look.id, look]));
  const auditElements = [];
  const auditKeys = new Set();
  const auditSpecimens = [];
  for (const [file, info] of files) {
    if (!inAudit(file)) continue;
    const collect = (node) => {
      if ((node.kind === SK.StringLiteral || node.kind === SK.NoSubstitutionTemplateLiteral) && isKey(node.text)) auditKeys.add(node.text);
      // One specimen: `"<id>": { from: "file:line", mocks: {...}, render: (props) => ... }`
      if (node.kind === SK.PropertyAssignment && node.name.kind === SK.StringLiteral && isKey(node.name.text) && unwrap(node.initializer)?.kind === SK.ObjectLiteralExpression) {
        const entry = unwrap(node.initializer);
        const property = (name) => entry.properties.find((candidate) => propertyName(candidate.name) === name);
        const from = property("from") ? literalValue(property("from").initializer) : undefined;
        const mocks = {};
        const mocksNode = property("mocks") ? unwrap(property("mocks").initializer) : null;
        if (mocksNode?.kind === SK.ObjectLiteralExpression)
          for (const mock of mocksNode.properties) {
            const name = propertyName(mock.name);
            const value = mock.initializer ? literalValue(mock.initializer) : undefined;
            if (name !== null && value !== undefined) mocks[name] = String(value);
          }
        const key = node.name.text;
        // Is it boxed, or does it pass `open` to hold a menu or dialog open?
        let forcesOpen = false;
        const findOpen = (child) => {
          if (child.kind === SK.JsxAttribute && /^(open|defaultOpen)$/.test(child.name.getText()) && (!child.initializer || (child.initializer.kind === SK.JsxExpression && child.initializer.expression?.kind === SK.TrueKeyword))) forcesOpen = true;
          ts.forEachChild(child, findOpen);
        };
        if (property("render")) findOpen(property("render"));
        const specimen = {
          key,
          file,
          line: info.sf.getLineAndCharacterOfPosition(node.getStart(info.sf)).line + 1,
          from: typeof from === "string" ? from : null,
          fromOk: false,
          mocks,
          unsourced: [],
          badMocks: [],
          boxed: !!(property("width") || property("height")),
          forcesOpen,
        };
        const match = specimen.from?.match(/^(.*):(\d+)$/);
        if (match) {
          const [, fromFile, fromLine] = match;
          const component = components.get(key);
          const look = looksById.get(key);
          // The cited place must be a real usage of this very thing: a call site, a story, or a location of the look.
          if (component) specimen.fromOk = component.callSites.some((site) => site.file === fromFile && site.line === Number(fromLine)) || (/\.stories\./.test(fromFile) && (sourceOf(fromFile)?.code.includes(`<${component.name}`) ?? false));
          else if (look) specimen.fromOk = look.locations.some((location) => location.file === fromFile && location.line === Number(fromLine));
          const source = specimen.fromOk ? sourceOf(fromFile) : null;
          if (source) {
            const mockValues = Object.values(mocks).filter(Boolean).sort((a, b) => b.length - a.length);
            specimen.badMocks = Object.keys(mocks).filter((expression) => !source.code.includes(normalize(expression)));
            const render = property("render");
            for (const text of render ? visibleTexts(render) : []) {
              // Take out the declared stand-ins, then every remaining piece must be written somewhere in the cited file.
              let rest = text;
              for (const value of mockValues) rest = rest.split(value).join("\u0000");
              const pieces = rest.split("\u0000").map(normalize).filter(isContent);
              if (!pieces.every((piece) => source.texts.some((candidate) => candidate.includes(piece)))) specimen.unsourced.push(text);
            }
          }
        }
        auditSpecimens.push(specimen);
      }
      ts.forEachChild(node, collect);
    };
    collect(info.sf);
    for (const intrinsic of info.intrinsics)
      auditElements.push({ file, line: intrinsic.line, tag: intrinsic.tag, ...(intrinsic.role ? { role: intrinsic.role } : {}), signature: signatureOf(intrinsic) });
  }

  // ── Pages ──────────────────────────────────────────────────────────────────
  // Which app routes render each file, so a call site can be opened on a page that shows it.
  // File routes (Next.js, Gatsby, React Router / Remix, TanStack), routes written in code
  // (React Router), and failing those, the app's entry at "/".

  const dependsOn = new Map();
  for (const [file, info] of files) {
    const deps = new Set();
    for (const statement of info.sf.statements) {
      const spec = (statement.kind === SK.ImportDeclaration || statement.kind === SK.ExportDeclaration) && statement.moduleSpecifier?.kind === SK.StringLiteral ? statement.moduleSpecifier.text : null;
      if (!spec) continue;
      const target = resolveModule(file, spec);
      if (target && files.has(target)) deps.add(target);
    }
    dependsOn.set(file, deps);
  }
  const reachable = (start) => {
    const seen = new Set();
    const stack = [start];
    while (stack.length) {
      const file = stack.pop();
      if (seen.has(file)) continue;
      seen.add(file);
      for (const next of dependsOn.get(file) ?? []) stack.push(next);
    }
    return seen;
  };
  const pages = [];
  const addPage = (route, file, roots) => {
    const clean = `/${route.replace(/^\/+/, "")}`.replace(/\/+$/, "") || "/";
    const covered = new Set(roots.filter(Boolean).flatMap((entry) => [...reachable(entry)]));
    pages.push({ route: clean, file, dynamic: /[[:$*]/.test(clean), files: covered });
  };
  const hasDependency = (name) => packages.some((pkg) => pkg.json?.dependencies?.[name] || pkg.json?.devDependencies?.[name]);
  const fileFrameworks = hasDependency("next") || hasDependency("gatsby");

  // 1. Next.js (app and pages routers) and Gatsby: the route is the file's path.
  const PAGE_FILE = /^(.*\/)?app\/(.*?)\/?page\.[jt]sx?$/;
  const PAGES_FILE = /^(.*\/)?pages\/(.*)\.[jt]sx?$/;
  for (const file of fileFrameworks ? files.keys() : []) {
    if (inAudit(file)) continue;
    const app = file.match(PAGE_FILE);
    const legacy = !app && file.match(PAGES_FILE);
    if (app) {
      const segments = app[2] ? app[2].split("/") : [];
      const layouts = [];
      // The layouts from the app root down to this page render around it.
      const base = `${app[1] ?? ""}app`;
      for (let depth = 0; depth <= segments.length; depth += 1) {
        const dir = [base, ...segments.slice(0, depth)].join("/");
        for (const ext of ["tsx", "jsx", "ts", "js"]) if (files.has(`${dir}/layout.${ext}`)) layouts.push(`${dir}/layout.${ext}`);
      }
      addPage(segments.filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith("@")).join("/"), file, [file, ...layouts]);
    } else if (legacy && !/(^|\/)(_app|_document|_error|api\/)/.test(legacy[2]) && !/\.test\.|\.stories\./.test(file)) {
      const app = [...files.keys()].find((candidate) => new RegExp(`^${(legacy[1] ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}pages/_app\\.[jt]sx?$`).test(candidate));
      addPage(legacy[2].replace(/(^|\/)index$/, ""), file, [file, app]);
    }
  }

  // 2. File routes by convention: React Router / Remix (`app/routes/concerts.$city.tsx`) and TanStack (`createFileRoute("/path")`).
  const remixRoot = [...files.keys()].find((file) => /^(.*\/)?app\/root\.[jt]sx?$/.test(file));
  for (const [file, info] of files) {
    if (inAudit(file)) continue;
    const remix = file.match(/^(.*\/)?app\/routes\/(.+?)(\/route)?\.[jt]sx?$/);
    if (remix && remixRoot && !remix[2].includes("/")) {
      const segments = remix[2].split(".").filter((segment) => segment !== "_index" && segment !== "index" && !segment.startsWith("_") && segment !== "route");
      addPage(segments.map((segment) => segment.replace(/_$/, "").replace(/^\$(.*)$/, ":$1")).join("/"), file, [file, remixRoot]);
      continue;
    }
    let fileRoute = null;
    const find = (node) => {
      if (fileRoute !== null) return;
      if (node.kind === SK.CallExpression && /^createFileRoute$/.test(node.expression.getText()) && node.arguments[0] && literalValue(node.arguments[0]) !== undefined) fileRoute = String(literalValue(node.arguments[0]));
      else ts.forEachChild(node, find);
    };
    find(info.sf);
    if (fileRoute !== null) {
      const root = [...files.keys()].find((candidate) => /(^|\/)routes\/__root\.[jt]sx?$/.test(candidate));
      addPage(fileRoute.replace(/\$([\w-]+)/g, ":$1"), file, [file, root]);
    }
  }

  // 3. Routes written in code: React Router's <Route path element> and { path, element | Component | lazy, children }.
  /** Files a route's element, Component or lazy import renders. */
  const elementFiles = (file, node) => {
    const found = new Set();
    const visit = (child) => {
      if (!child) return;
      if (child.kind === SK.JsxOpeningElement || child.kind === SK.JsxSelfClosingElement) {
        const resolved = resolveTag(file, child.tagName.getText());
        if (resolved?.file) found.add(resolved.file);
      } else if (child.kind === SK.Identifier && /^[A-Z]/.test(child.text)) {
        const resolved = resolveTag(file, child.text);
        if (resolved?.file) found.add(resolved.file);
      } else if (child.kind === SK.CallExpression && child.expression.kind === SK.ImportKeyword && child.arguments[0]?.kind === SK.StringLiteral) {
        const target = resolveModule(file, child.arguments[0].text);
        if (target) found.add(target);
      }
      ts.forEachChild(child, visit);
    };
    visit(node);
    return [...found];
  };
  const joinPath = (parent, path) => (path.startsWith("/") ? path : `${parent.replace(/\/$/, "")}/${path}`);
  for (const [file, info] of files) {
    if (inAudit(file)) continue;
    const objectRoute = (node, parent, layouts) => {
      const property = (name) => node.properties.find((entry) => propertyName(entry.name) === name);
      const pathValue = property("path") ? literalValue(property("path").initializer) : undefined;
      const index = !!property("index");
      const path = typeof pathValue === "string" ? joinPath(parent, pathValue) : parent;
      const rendered = ["element", "Component", "component", "lazy"].flatMap((name) => (property(name) ? elementFiles(file, property(name).initializer) : []));
      const children = property("children") ? unwrap(property("children").initializer) : null;
      if (typeof pathValue === "string" || index) addPage(path, file, [...rendered, ...layouts]);
      if (children?.kind === SK.ArrayLiteralExpression)
        for (const child of children.elements) if (unwrap(child)?.kind === SK.ObjectLiteralExpression) objectRoute(unwrap(child), path, [...layouts, ...rendered]);
    };
    const jsxRoute = (element, parent, layouts) => {
      const opening = element.kind === SK.JsxElement ? element.openingElement : element;
      const attribute = (name) => opening.attributes.properties.find((entry) => entry.kind === SK.JsxAttribute && entry.name.getText() === name);
      const pathValue = attribute("path")?.initializer ? (attribute("path").initializer.kind === SK.StringLiteral ? attribute("path").initializer.text : literalValue(attribute("path").initializer.expression)) : undefined;
      const path = typeof pathValue === "string" ? joinPath(parent, pathValue) : parent;
      const rendered = ["element", "Component", "component", "lazy"].flatMap((name) => (attribute(name)?.initializer ? elementFiles(file, attribute(name).initializer) : []));
      if (typeof pathValue === "string" || attribute("index")) addPage(path, file, [...rendered, ...layouts]);
      if (element.kind === SK.JsxElement)
        for (const child of element.children)
          if ((child.kind === SK.JsxElement || child.kind === SK.JsxSelfClosingElement) && /(^|\.)Route$/.test((child.kind === SK.JsxElement ? child.openingElement : child).tagName.getText()))
            jsxRoute(child, path, [...layouts, ...rendered]);
    };
    const isRouteObject = (node) => {
      if (node.kind !== SK.ObjectLiteralExpression) return false;
      const names = node.properties.map((entry) => propertyName(entry.name));
      return (names.includes("path") || names.includes("index")) && names.some((name) => ["element", "Component", "lazy", "children"].includes(name));
    };
    const visit = (node, insideRoute) => {
      if (!insideRoute && isRouteObject(node)) {
        objectRoute(node, "/", []);
        return;
      }
      if (!insideRoute && (node.kind === SK.JsxElement || node.kind === SK.JsxSelfClosingElement) && /(^|\.)Route$/.test((node.kind === SK.JsxElement ? node.openingElement : node).tagName.getText())) {
        jsxRoute(node, "/", []);
        return;
      }
      ts.forEachChild(node, (child) => visit(child, insideRoute));
    };
    visit(info.sf, false);
  }

  // 4. No router found: the app's entry renders everything it imports at "/".
  if (!pages.length) {
    const entry = ["src/main.tsx", "src/main.jsx", "src/index.tsx", "src/index.jsx", "src/main.ts", "src/index.ts", "index.tsx", "index.jsx", "src/App.tsx", "src/App.jsx"].find((candidate) => files.has(candidate));
    if (entry) addPage("/", entry, [entry]);
  }

  // One page per route: merge what several definitions of the same route render.
  const merged = new Map();
  for (const page of pages) {
    const existing = merged.get(page.route);
    if (existing) for (const file of page.files) existing.files.add(file);
    else merged.set(page.route, page);
  }
  pages.splice(0, pages.length, ...merged.values());
  pages.sort((a, b) => Number(a.dynamic) - Number(b.dynamic) || a.route.length - b.route.length);
  /** Routes that render a file: static ones first, the shortest first. */
  const routesOf = (file) => pages.filter((page) => page.files.has(file)).map((page) => page.route);
  for (const component of components.values()) for (const site of component.callSites) site.routes = routesOf(site.file);

  // ── Result ─────────────────────────────────────────────────────────────────

  const publish = ({ _rootIntrinsic, _generic, _rootComponent, _own, ...component }) => component;
  const all = [...components.values()];
  const system = all.filter((component) => component.version);
  const others = all.filter((component) => !component.version);
  const sharedDirs = [...new Set(system.filter((component) => component.shared).map((component) => path.posix.dirname(component.file)))].sort();
  const certain = handRolled.filter((cluster) => cluster.confidence === "high");

  return {
    version: 1,
    root,
    generatedAt: new Date().toISOString(),
    parser: `typescript ${ts.version}`,
    scannedFiles: files.size,
    sharedDirs,
    sharedDirsSource: uiDirs.length ? "--ui" : "guessed from directory names",
    uiArgs: uiDirs.map((dir) => dir.replace(/\/$/, "")),
    ...(shadcn?.aliases?.ui ? { shadcnUiAlias: shadcn.aliases.ui } : {}),
    auditDirs,
    totals: {
      sharedComponents: system.filter((component) => component.shared && !component.part).length,
      sharedParts: system.filter((component) => component.shared && component.part).length,
      localVersions: system.filter((component) => !component.shared).length,
      handRolledLooks: certain.length,
      handRolledElements: certain.reduce((sum, cluster) => sum + cluster.count, 0),
      lookAlikes: handRolled.length - certain.length,
      otherComponents: others.length,
      iconComponents: icons.count,
    },
    components: system.sort((a, b) => Number(b.shared) - Number(a.shared) || a.file.localeCompare(b.file) || a.line - b.line).map(publish),
    handRolled,
    // Every other component in the repo: feature and page components. Listed so nothing is invisible.
    otherComponents: others
      .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name))
      .map((component) => ({ name: component.name, file: component.file, line: component.line, exported: component.exported, uses: component.uses, files: component.files })),
    icons,
    external: Object.fromEntries(Object.entries(external).sort((a, b) => b[1] - a[1])),
    // Every route the app has, and the file that defines it.
    pages: pages.map(({ route, file, dynamic }) => ({ route, file, ...(dynamic ? { dynamic: true } : {}) })),
    audit: { usages: auditUsages, elements: auditElements, keys: [...auditKeys], specimens: auditSpecimens },
    errors,
  };
}

// ── Summary ──────────────────────────────────────────────────────────────────

export function summarize(scan) {
  const lines = [];
  const totals = scan.totals;
  const byId = new Map(scan.components.map((component) => [component.id, component]));
  lines.push(`Scanned ${scan.scannedFiles} files with ${scan.parser}.`);
  lines.push(`Shared UI directories (${scan.sharedDirsSource}): ${scan.sharedDirs.join(", ") || "none found. Pass --ui <dir>."}`);
  lines.push(
    `${totals.sharedComponents} shared components (+${totals.sharedParts} parts), ${totals.localVersions} local versions, ` +
      `${totals.handRolledElements} hand-rolled elements in ${totals.handRolledLooks} looks, ${totals.lookAlikes} repeated look-alikes, ` +
      `${totals.otherComponents} other components, ${totals.iconComponents} icons.`,
  );
  lines.push("");
  const axisText = (component, prefix = "") =>
    component.axes
      .filter((axis) => axis.required)
      .map((axis) => `${prefix}${axis.name}${axis.kind === "enum" ? `: ${axis.values.length}` : ""}`);
  const kinds = new Map();
  for (const component of scan.components) {
    if (component.part) continue;
    const kind = component.kind ?? "other";
    if (!kinds.has(kind)) kinds.set(kind, []);
    kinds.get(kind).push(component);
  }
  for (const cluster of scan.handRolled) if (cluster.confidence === "high" && !kinds.has(cluster.kind)) kinds.set(cluster.kind, []);
  for (const [kind, list] of [...kinds].sort()) {
    lines.push(kind);
    for (const component of list) {
      const parts = component.parts.map((id) => byId.get(id)).filter(Boolean);
      const axes = [...axisText(component), ...parts.flatMap((part) => axisText(part, `${part.name}.`))];
      const uses = component.uses + parts.reduce((sum, part) => sum + part.uses, 0);
      const note = component.wrapsComponent ? ` wraps ${byId.get(component.wrapsComponent)?.name}` : component.wraps ? ` wraps ${component.wraps}` : "";
      lines.push(
        `  ${component.shared ? " " : "~"} ${(component.name + (parts.length ? ` +${parts.length} parts` : "")).padEnd(30)} ${String(component.uses).padStart(4)} uses` +
          `${parts.length ? ` (${uses} with parts)` : ""}  ${axes.length ? `[${axes.join(", ")}]` : ""}${note}  ${component.file}:${component.line}`,
      );
    }
    const rolled = scan.handRolled.filter((cluster) => cluster.kind === kind && cluster.confidence === "high");
    if (rolled.length) lines.push(`    hand-rolled: ${rolled.reduce((sum, cluster) => sum + cluster.count, 0)} elements in ${rolled.length} looks${list.length ? "" : " (no shared component)"}`);
  }
  if (scan.errors.length) lines.push("", `${scan.errors.length} files could not be parsed: ${scan.errors.slice(0, 5).map((error) => error.file).join(", ")}`);
  lines.push("", "(~ marks a local component that wraps a raw element or a shared component: a competing version)");
  return lines.join("\n");
}

// ── Command line ─────────────────────────────────────────────────────────────

const isMain = process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log("node scan.mjs --root <repo> [--ui <dir>]... [--out <file>] [--typescript <path>] [--quiet]");
      process.exit(0);
    }
    const scan = scanRepo(args);
    const json = JSON.stringify(scan, null, 1);
    if (args.out) {
      fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
      fs.writeFileSync(args.out, json);
      if (!args.quiet) console.error(`${summarize(scan)}\n\nWrote ${args.out}`);
    } else {
      process.stdout.write(json);
      if (!args.quiet) console.error(summarize(scan));
    }
  } catch (error) {
    console.error(error.code === "NO_PARSER" ? error.message : error.stack);
    process.exit(error.code === "NO_PARSER" ? 3 : 1);
  }
}
