#!/usr/bin/env node
/**
 * check.mjs: does the audit show everything the scan found?
 *
 * Rescans the repo, reads the audit folder's own files, and compares.
 *
 * Always, for every specimen that exists:
 *   - it names the real usage it was copied from (`from: "file:line"`), and that place is a
 *     call site of that component or a location of that hand-rolled look
 *   - every piece of text it shows is written in that file, or is a declared stand-in
 *     (`mocks`) for an expression that appears in that file
 *   - it shows the component as written: it does not copy a call site's override classes
 *     (the page draws those itself, from the scan, under "Overridden")
 *
 * Always required (the inventory):
 *   - every shared component has a specimen, and the specimen renders it
 *   - every variant value is rendered (the page sweeps them, given a specimen that spreads its props)
 *   - every part of a compound component that is used somewhere is rendered
 *   - the bundled page and canvas were copied in unchanged
 *
 * Required only for groups listed in `audited` in audit.data.json (the deep audit of a group):
 *   - every local version in the group has a specimen
 *   - every hand-rolled look in the group has a specimen with the same look
 *
 * Anything left out on purpose must be written down with a reason in
 * audit.data.json: `omitted` for a whole component or look, `skipped` for one
 * variant value.
 *
 *   node check.mjs --root <repo> [--audit <dir>] [--ui <dir>]... [--plan] [--no-write]
 *
 * Exits 0 when nothing is missing and 1 when something is. `--plan` prints the
 * same list as a to-do and always exits 0: run it before drawing anything.
 * Unless --no-write is given, audit.scan.json is refreshed and the result is
 * saved under `coverage` in audit.data.json.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanRepo } from "./scan.mjs";

const BUNDLED = ["AuditCanvas", "AuditPage"];

function parseArgs(argv) {
  const args = { root: process.cwd(), ui: [], audit: null, plan: false, write: true, typescript: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") args.root = argv[(i += 1)];
    else if (arg === "--audit") args.audit = argv[(i += 1)];
    else if (arg === "--ui") args.ui.push(argv[(i += 1)]);
    else if (arg === "--typescript") args.typescript = argv[(i += 1)];
    else if (arg === "--plan") args.plan = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--json") args.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  args.root = path.resolve(args.root);
  return args;
}

const show = (value) => (typeof value === "string" ? `"${value}"` : `{${value}}`);

export function checkCoverage(scan, data = {}) {
  const byId = new Map(scan.components.map((component) => [component.id, component]));
  const looks = scan.handRolled.filter((cluster) => cluster.confidence === "high");
  const allLooks = new Set(scan.handRolled.map((cluster) => cluster.id));

  const omitted = new Map((data.omitted ?? []).map((entry) => [entry.id, entry.reason]));
  // Groups the user asked to audit in depth. Everything else gets the inventory only.
  const audited = new Set(data.audited ?? []);
  const groupOf = (item) => data.move?.[item.id] ?? item.kind ?? "other";
  const inDepth = (item) => audited.has(groupOf(item));
  const skipped = new Map((data.skipped ?? []).map((entry) => [`${entry.component}|${entry.axis}|${String(entry.value)}`, entry.reason]));
  const keys = new Set(scan.audit.keys);
  const usagesBy = new Map();
  for (const usage of scan.audit.usages) {
    if (!usagesBy.has(usage.component)) usagesBy.set(usage.component, []);
    usagesBy.get(usage.component).push(usage);
  }
  const renderedLooks = new Set(scan.audit.elements.map((element) => `${element.tag}|${element.role ?? ""}|${element.signature}`));

  const missing = { components: [], variants: [], parts: [], handRolled: [], invented: [], forced: [], overridden: [], stale: [], reasons: [] };
  const totals = {
    components: { required: 0, shown: 0, omitted: 0 },
    variants: { required: 0, shown: 0, skipped: 0 },
    parts: { used: 0, shown: 0, unused: 0 },
    handRolled: { required: 0, shown: 0, omitted: 0 },
    // Listed on the page with their counts, drawn only when their group is audited.
    listedOnly: { localVersions: 0, handRolledLooks: 0, handRolledElements: 0 },
    // Call sites that restyle a design-system component with className. Drawn by the page under each component.
    overrides: { sites: 0, uses: 0, components: 0, patterns: 0 },
  };
  const needReason = (kind, id, reason) => {
    if (!reason || !String(reason).trim()) missing.reasons.push(`${kind} "${id}" has no reason`);
  };

  for (const component of scan.components) {
    const usages = usagesBy.get(component.id) ?? [];
    const where = `${component.file}:${component.line}`;
    const hasKey = keys.has(component.id);

    if (omitted.has(component.id)) {
      needReason("omitted", component.id, omitted.get(component.id));
      if (!component.part) totals.components.omitted += 1;
      continue;
    }
    // A local version is part of a group's deep audit, not of the inventory.
    if (!component.shared && !inDepth(component)) {
      totals.listedOnly.localVersions += 1;
      continue;
    }

    if (component.part) {
      // Parts are shown inside their family's specimen. An unused part is a finding, not a gap.
      if (component.uses === 0) totals.parts.unused += 1;
      else {
        totals.parts.used += 1;
        if (usages.length) totals.parts.shown += 1;
        else missing.parts.push({ id: component.id, text: `${component.name}: part of ${byId.get(component.primary)?.name}, used ${component.uses} times, in no specimen  (${where})` });
      }
    } else {
      totals.components.required += 1;
      if (hasKey && usages.length) totals.components.shown += 1;
      else if (!hasKey) missing.components.push({ id: component.id, text: `${component.name}: no specimen. Add specimens.components["${component.id}"]  (${component.kind ?? "other"}, ${component.uses} uses)` });
      else missing.components.push({ id: component.id, text: `${component.name}: its specimen never renders <${component.name}>  (${where})` });
    }

    const required = component.axes.filter((axis) => axis.required);
    if (!required.length) continue;
    // The page renders one specimen per value by calling render({ axis: value }).
    // That only works when the specimen spreads its props onto the component.
    const sweeps = hasKey && usages.some((usage) => usage.spread);
    for (const axis of required) {
      for (const value of axis.values) {
        const key = `${component.id}|${axis.name}|${String(value)}`;
        if (skipped.has(key)) {
          needReason("skipped", key, skipped.get(key));
          totals.variants.skipped += 1;
          continue;
        }
        totals.variants.required += 1;
        if (sweeps) totals.variants.shown += 1;
        else
          missing.variants.push({
            id: component.id,
            axis: axis.name,
            value,
            text: hasKey
              ? `${component.name}: ${axis.name}=${show(value)} is not rendered. Its specimen must spread props: <${component.name} {...props}>`
              : `${component.name}: ${axis.name}=${show(value)} needs specimens.components["${component.id}"]`,
          });
      }
    }
  }

  // Overrides are findings, drawn by the page. A specimen that copies one hides the component as written.
  for (const component of scan.components) {
    const overrides = component.overrides;
    if (overrides?.sites) {
      totals.overrides.sites += overrides.sites;
      totals.overrides.patterns += overrides.patterns.length;
      if (!component.part) totals.overrides.components += 1;
    }
    totals.overrides.uses += component.uses;
    const flagged = new Set((overrides?.patterns ?? []).flatMap((pattern) => pattern.classes));
    if (!flagged.size) continue;
    for (const usage of usagesBy.get(component.id) ?? []) {
      const copied = [...new Set((usage.classes ?? []).filter((token) => flagged.has(token)))];
      if (copied.length)
        missing.overridden.push(
          `${component.name}: the specimen gives it ${copied.map((token) => `"${token}"`).join(", ")}, which call sites add to restyle it. Show the component as written; the page draws the overrides itself  (${usage.file}:${usage.line})`,
        );
    }
  }

  for (const look of looks) {
    const first = `${look.locations[0].file}:${look.locations[0].line}`;
    const what = `${look.count} × <${look.tag}${look.role ? ` role="${look.role}"` : ""}> ${look.signature.slice(0, 100)}`;
    if (omitted.has(look.id)) {
      needReason("omitted", look.id, omitted.get(look.id));
      totals.handRolled.omitted += 1;
      continue;
    }
    if (!inDepth(look)) {
      totals.listedOnly.handRolledLooks += 1;
      totals.listedOnly.handRolledElements += look.count;
      continue;
    }
    totals.handRolled.required += 1;
    const hasKey = keys.has(look.id);
    // A look with no static classes cannot be matched by class list; having a specimen is the check.
    const matchable = !look.signature.startsWith("(");
    const sameLook = !matchable || renderedLooks.has(`${look.tag}|${look.role ?? ""}|${look.signature}`);
    if (hasKey && sameLook) totals.handRolled.shown += 1;
    else if (!hasKey) missing.handRolled.push({ id: look.id, text: `${look.id}: no specimen. ${what}  (copy from ${first})` });
    else missing.handRolled.push({ id: look.id, text: `${look.id}: its specimen does not have this look. Keep the classes as written. ${what}  (copy from ${first})` });
  }

  // No invented content: every specimen is a copy of a real usage, and says which.
  let traced = 0;
  for (const specimen of scan.audit.specimens ?? []) {
    const name = byId.get(specimen.key)?.name ?? specimen.key;
    const at = `${specimen.file}:${specimen.line}`;
    const problems = [];
    if (!specimen.from) problems.push(`${name}: no \`from\`. Say which real usage this is a copy of, as "file:line"  (${at})`);
    else if (!specimen.fromOk) problems.push(`${name}: \`from\` is "${specimen.from}", which is not a usage of it in the scan. Pick one of its call sites  (${at})`);
    for (const text of specimen.unsourced) problems.push(`${name}: "${text}" is not written anywhere in ${specimen.from.replace(/:\d+$/, "")}. Copy the content from the usage; do not write your own  (${at})`);
    for (const expression of specimen.badMocks) problems.push(`${name}: a stand-in is declared for \`${expression}\`, but that expression is not in ${specimen.from.replace(/:\d+$/, "")}  (${at})`);
    if (problems.length) missing.invented.push(...problems);
    else traced += 1;
    // A component is shown the way the app has it: closed and live, opened by clicking it.
    // (A part's variants can only be seen with its parent open, so parts are exempt.)
    const subject = byId.get(specimen.key);
    if (subject && !subject.part && specimen.forcesOpen)
      missing.forced.push(`${name}: its specimen passes \`open\` to hold it open. Render it closed, as the usage has it; it opens when clicked. For one with no trigger, use \`toggle: "open"\`  (${at})`);
  }
  totals.sources = { specimens: (scan.audit.specimens ?? []).length, traced };

  for (const key of keys) if (!byId.has(key) && !allLooks.has(key)) missing.stale.push(`a specimen is keyed "${key}", which the scan does not find. Remove it or fix the id.`);
  for (const id of omitted.keys()) if (!byId.has(id) && !allLooks.has(id)) missing.stale.push(`omitted "${id}" is not in the scan`);
  const groups = new Set([...scan.components.filter((component) => !component.part).map(groupOf), ...scan.handRolled.map(groupOf)]);
  for (const id of audited) if (!groups.has(id)) missing.stale.push(`audited group "${id}" does not exist. Groups: ${[...groups].sort().join(", ")}`);

  const count = (list) => list.length;
  const gaps = count(missing.components) + count(missing.variants) + count(missing.parts) + count(missing.handRolled) + count(missing.invented) + count(missing.forced) + count(missing.overridden) + count(missing.stale) + count(missing.reasons);
  return {
    ok: gaps === 0,
    coverage: {
      checkedAt: new Date().toISOString(),
      entries: { shown: totals.components.shown + totals.handRolled.shown, of: totals.components.required + totals.handRolled.required },
      ...totals,
      gaps,
    },
    missing,
  };
}

export function report(result, { plan = false } = {}) {
  const { coverage, missing } = result;
  const extra = (count, text) => (count ? ` (${count} ${text})` : "");
  const lines = [
    `Components:        ${coverage.components.shown} of ${coverage.components.required} shown${extra(coverage.components.omitted, "omitted with a reason")}`,
    `Variant values:    ${coverage.variants.shown} of ${coverage.variants.required} shown${extra(coverage.variants.skipped, "skipped with a reason")}`,
    `Parts in use:      ${coverage.parts.shown} of ${coverage.parts.used} shown${extra(coverage.parts.unused, "more are never used anywhere")}`,
    `Hand-rolled looks: ${coverage.handRolled.shown} of ${coverage.handRolled.required} shown${extra(coverage.handRolled.omitted, "omitted with a reason")}`,
    `Traced to source:  ${coverage.sources.traced} of ${coverage.sources.specimens} specimens copy a real usage, with no invented text`,
    `Overrides:         ${coverage.overrides.sites} of ${coverage.overrides.uses} call sites restyle a component with className (${coverage.overrides.patterns} distinct, across ${coverage.overrides.components} components), drawn under each one`,
    `Listed, not drawn: ${coverage.listedOnly.localVersions} local versions, ${coverage.listedOnly.handRolledElements} hand-rolled elements in ${coverage.listedOnly.handRolledLooks} looks (drawn when their group is audited)`,
  ];
  const section = (title, items) => {
    if (!items.length) return;
    lines.push("", `${title} (${items.length})`);
    for (const item of items) lines.push(`  - ${typeof item === "string" ? item : item.text}`);
  };
  section(plan ? "Components that need a specimen" : "Components missing", missing.components);
  section(plan ? "Variant values to render" : "Variant values missing", missing.variants);
  section(plan ? "Parts to include in a specimen" : "Parts missing", missing.parts);
  section(plan ? "Hand-rolled looks that need a specimen" : "Hand-rolled looks missing", missing.handRolled);
  section("Content that is not from the codebase", missing.invented);
  section("Components forced open", missing.forced);
  section("Specimens that copy an override", missing.overridden);
  section("Stale", missing.stale);
  section("Missing reasons", missing.reasons);
  section("Bundled files", missing.bundled ?? []);
  lines.push(
    "",
    result.ok
      ? "Everything required is shown."
      : plan
        ? `${missing.components.length + missing.handRolled.length} specimens to write. One specimen that spreads its props covers all of that component's variant values, and a family's specimen covers its parts.`
        : `${coverage.gaps} gaps. Draw them, or record each in "omitted" / "skipped" in audit.data.json with a reason, then run this again.`,
  );
  return lines.join("\n");
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    let scan = scanRepo({ root: args.root, ui: args.ui, typescript: args.typescript, audit: args.audit });
    const auditDir = args.audit ? path.resolve(args.root, args.audit) : scan.auditDirs.length === 1 ? path.join(args.root, scan.auditDirs[0]) : null;
    if (!auditDir && scan.auditDirs.length > 1) throw new Error(`More than one audit folder found: ${scan.auditDirs.join(", ")}. Pass --audit <dir>.`);

    // Use the same shared directories the audit was scanned with.
    const scanFile = auditDir ? path.join(auditDir, "audit.scan.json") : null;
    if (!args.ui.length && scanFile && fs.existsSync(scanFile)) {
      const saved = JSON.parse(fs.readFileSync(scanFile, "utf8"));
      if (saved.uiArgs?.length) scan = scanRepo({ root: args.root, ui: saved.uiArgs, typescript: args.typescript, audit: args.audit });
    }

    const dataFile = auditDir ? path.join(auditDir, "audit.data.json") : null;
    const hasData = !!dataFile && fs.existsSync(dataFile);
    if (!auditDir && !args.plan) {
      console.error("No audit folder found. Pass --audit <dir>, or use --plan for the list of what the audit must show.");
      process.exit(2);
    }
    const data = hasData ? JSON.parse(fs.readFileSync(dataFile, "utf8")) : {};
    const result = checkCoverage(scan, data);

    if (auditDir && !args.plan) {
      // The page and canvas are meant to be exact copies.
      const bundledDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "canvas");
      result.missing.bundled = [];
      for (const name of BUNDLED) {
        // TypeScript projects copy the .tsx pair, JavaScript projects the .jsx pair.
        const file = [`${name}.tsx`, `${name}.jsx`].find((candidate) => fs.existsSync(path.join(auditDir, candidate)));
        if (!file) {
          result.missing.bundled.push(`${name}.tsx is not in the audit folder. Copy it from the skill's canvas folder.`);
          continue;
        }
        const original = path.join(bundledDir, file);
        if (fs.existsSync(original) && fs.readFileSync(path.join(auditDir, file), "utf8") !== fs.readFileSync(original, "utf8"))
          result.missing.bundled.push(`${file} differs from the bundled file. Copy it again, unchanged.`);
      }
      result.coverage.gaps += result.missing.bundled.length;
      result.ok = result.coverage.gaps === 0;
    }

    if (auditDir && args.write && !args.plan) {
      fs.writeFileSync(scanFile, JSON.stringify(scan, null, 1));
      fs.writeFileSync(dataFile, `${JSON.stringify({ ...data, coverage: result.coverage }, null, 2)}\n`);
    }
    if (args.json) process.stdout.write(JSON.stringify(result, null, 1));
    else console.log(report(result, { plan: args.plan }));
    process.exit(args.plan || result.ok ? 0 : 1);
  } catch (error) {
    console.error(error.code === "NO_PARSER" ? error.message : error.stack);
    process.exit(error.code === "NO_PARSER" ? 3 : 1);
  }
}
