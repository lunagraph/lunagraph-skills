// Puts the bundled canvas and page into the fixture app, the way the skill tells an agent to:
// copy the two files, scan, and let the script write the specimens it can. Run before the dev
// server and the checks.
import { execFileSync } from "node:child_process";
import { copyFileSync } from "node:fs";
import { buildJsx } from "./build-jsx.mjs";

buildJsx();
for (const file of ["AuditCanvas.tsx", "AuditPage.tsx"]) copyFileSync(`../skills/audit/canvas/${file}`, `fixture/src/audit/${file}`);
const run = (script, ...args) => execFileSync("node", [`../skills/audit/scripts/${script}`, "--root", "fixture", ...args], { stdio: ["ignore", "ignore", "inherit"] });
run("scan.mjs", "--out", "fixture/src/audit/audit.scan.json", "--quiet");
run("specimens.mjs", "--audit", "src/audit", "--all");
run("scan.mjs", "--out", "fixture/src/audit/audit.scan.json", "--quiet");
