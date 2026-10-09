#!/usr/bin/env node
/**
 * specimens.mjs: writes the specimens that need no judgement.
 *
 * For every component that has a call site standing on its own (literal props,
 * written-out text, imported components), this copies that call site into
 * `specimens.generated.tsx` in the audit folder, with its source location.
 * Nothing is composed or invented: each entry is one real usage, as written,
 * with handlers turned into no-ops and `{...props}` added so variants can be shown.
 *
 * Components it cannot do (every usage reads state or data) are listed at the
 * end. Those are the ones for an agent to write by hand.
 *
 *   node specimens.mjs --root <repo> --audit <dir> [--ui <dir>]... [--all]
 *
 * By default it writes shared components only, which is what the inventory
 * draws. `--all` includes local versions too, for a group's deep audit.
 * The file is overwritten on every run. Do not edit it; override an entry by
 * defining the same key in your own specimens file.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanRepo } from "./scan.mjs";

function parseArgs(argv) {
  const args = { root: process.cwd(), ui: [], audit: null, all: false, typescript: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") args.root = argv[(i += 1)];
    else if (arg === "--audit") args.audit = argv[(i += 1)];
    else if (arg === "--ui") args.ui.push(argv[(i += 1)]);
    else if (arg === "--typescript") args.typescript = argv[(i += 1)];
    else if (arg === "--all") args.all = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  args.root = path.resolve(args.root);
  return args;
}

/** Build the file's text from a scan. `auditDir` is relative to the repo root. */
export function generateSpecimens(scan, auditDir, { all = false, typescript = true } = {}) {
  const wanted = scan.components.filter((component) => !component.part && (all || component.shared));
  const imports = new Map(); // local name -> { source, imported }
  const entries = [];
  const left = [];

  for (const component of wanted) {
    const generated = component.generated;
    if (!generated) {
      left.push({ component, reason: component.uses ? "every usage reads state or data" : "never used" });
      continue;
    }
    // Work out each import from where the audit folder sits, and make sure names do not clash.
    const needed = [];
    let clash = false;
    for (const item of generated.imports) {
      let source = item.source;
      if (item.file) {
        source = path.posix.relative(auditDir, item.file).replace(/\.[cm]?[jt]sx?$/, "").replace(/\/index$/, "");
        if (!source.startsWith(".")) source = `./${source}`;
      } else if (item.source.startsWith(".")) {
        clash = true; // a relative import that resolves to nothing we know, such as an asset
        break;
      }
      const existing = imports.get(item.local);
      if (existing && (existing.source !== source || existing.imported !== item.imported)) {
        clash = true;
        break;
      }
      needed.push([item.local, { source, imported: item.imported }]);
    }
    if (clash) {
      left.push({ component, reason: "its imports clash with another specimen's" });
      continue;
    }
    for (const [local, value] of needed) imports.set(local, value);
    const body = generated.code.includes("\n") ? `(\n${generated.code.replace(/^/gm, "        ")}\n      )` : generated.code;
    entries.push(`  ${JSON.stringify(component.id)}: {\n    from: ${JSON.stringify(generated.from)},\n    render: (props) => ${body},\n  },`);
  }

  const bySource = new Map();
  for (const [local, { source, imported }] of imports) {
    if (!bySource.has(source)) bySource.set(source, { named: [], default: null, namespace: null });
    const group = bySource.get(source);
    if (imported === "default") group.default = local;
    else if (imported === "*") group.namespace = local;
    else group.named.push(imported === local ? local : `${imported} as ${local}`);
  }
  const importLines = [];
  for (const [source, group] of [...bySource].sort(([a], [b]) => a.localeCompare(b))) {
    if (group.namespace) importLines.push(`import * as ${group.namespace} from ${JSON.stringify(source)};`);
    const parts = [group.default, group.named.length ? `{ ${group.named.sort().join(", ")} }` : null].filter(Boolean);
    if (parts.length) importLines.push(`import ${parts.join(", ")} from ${JSON.stringify(source)};`);
  }

  const text = [
    "// Written by the audit skill's scripts/specimens.mjs. Each entry is one real call site, copied as written.",
    "// Do not edit: run the script again. To change one, define the same key in your own specimens file.",
    ...importLines,
    ...(typescript ? ['import type { AuditSpecimens } from "./AuditPage";'] : []),
    "",
    `export const generated${typescript ? ': AuditSpecimens["components"]' : ""} = {`,
    ...entries,
    "};",
    "",
  ].join("\n");
  return { text, written: entries.length, left };
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    let scan = scanRepo({ root: args.root, ui: args.ui, typescript: args.typescript, audit: args.audit });
    const auditDir = args.audit ? path.relative(args.root, path.resolve(args.root, args.audit)).split(path.sep).join("/") : scan.auditDirs.length === 1 ? scan.auditDirs[0].replace(/\/$/, "") : null;
    if (!auditDir) throw new Error("No audit folder found. Pass --audit <dir>.");

    // Use the same shared directories the audit was scanned with.
    const scanFile = path.join(args.root, auditDir, "audit.scan.json");
    if (!args.ui.length && fs.existsSync(scanFile)) {
      const saved = JSON.parse(fs.readFileSync(scanFile, "utf8"));
      if (saved.uiArgs?.length) scan = scanRepo({ root: args.root, ui: saved.uiArgs, typescript: args.typescript, audit: args.audit });
    }

    const javascript = fs.existsSync(path.join(args.root, auditDir, "AuditPage.jsx")) && !fs.existsSync(path.join(args.root, auditDir, "AuditPage.tsx"));
    const { text, written, left } = generateSpecimens(scan, auditDir, { all: args.all, typescript: !javascript });
    const file = path.join(args.root, auditDir, `specimens.generated.${javascript ? "jsx" : "tsx"}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);

    console.log(`Wrote ${written} specimens to ${path.relative(args.root, file)}, each copied from a real call site.`);
    if (left.length) {
      console.log(`\n${left.length} left to write by hand:`);
      for (const { component, reason } of left) console.log(`  - ${component.name}  (${reason}; ${component.uses} uses)  ${component.id}`);
    }
  } catch (error) {
    console.error(error.code === "NO_PARSER" ? error.message : error.stack);
    process.exit(error.code === "NO_PARSER" ? 3 : 1);
  }
}
