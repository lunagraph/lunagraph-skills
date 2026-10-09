// Writes plain-JavaScript copies of the bundled page and canvas, for projects that do not use TypeScript.
import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

export function buildJsx() {
  for (const name of ["AuditCanvas", "AuditPage"]) {
    const source = readFileSync(new URL(`../skills/audit/canvas/${name}.tsx`, import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      fileName: `${name}.tsx`,
      compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: false },
    });
    writeFileSync(new URL(`../skills/audit/canvas/${name}.jsx`, import.meta.url), `// Generated from ${name}.tsx. Do not edit.\n${outputText.replace(/[ \t]+$/gm, "")}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) buildJsx();
