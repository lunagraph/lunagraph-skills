// Smoke test for the audit canvas: drives the playground in your installed Chrome.
// Run with `npm run check`.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`);
};
const near = (a, b, tolerance = 2) => Math.abs(a - b) <= tolerance;

const server = await createServer({
  server: { port: 5199, strictPort: false, forwardConsole: false },
  logLevel: "error",
});
await server.listen();
const url = server.resolvedUrls.local[0];

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: false });
const page = await context.newPage();

const errors = [];
// The demo has one specimen that throws on purpose, to exercise the error boundary.
// React reports that error even though it is caught (React 18 also rethrows it in dev).
const expected = (text) => /LegacyPopup|<Broken>|SpecimenBoundary/.test(text);
page.on("pageerror", (error) => {
  if (!expected(error.message)) errors.push(error.message);
});
page.on("console", (message) => {
  if (message.type() === "error" && !expected(message.text())) errors.push(message.text());
});

const view = () =>
  page.evaluate(() => {
    const world = document.querySelector(".lgac-world");
    const matrix = new DOMMatrix(getComputedStyle(world).transform);
    return { x: matrix.e, y: matrix.f, z: matrix.a };
  });
const box = (selector) => page.locator(selector).first().boundingBox();
// Longer than an animated move (220ms) plus the settle delay (150ms).
const settle = () => page.waitForTimeout(450);

// The canvas on its own, with a mock layout.
await page.goto(`${url}?canvas`);
await page.waitForSelector(".lgac-world");
await settle();
mkdirSync(".check", { recursive: true });

// Opening view
const start = await view();
const worldBox = await box(".lgac-world");
check("opens fitted, at or below 100%", start.z <= 1 && start.z >= 0.5, `zoom ${start.z.toFixed(2)}`);
check("content starts below the top bars", near(worldBox.y, 96), `y ${worldBox.y}`);
check("content is inside the window", worldBox.x >= 0 && worldBox.x + worldBox.width <= 1440);
await page.screenshot({ path: ".check/1-open.png" });

// Scroll pans
await page.mouse.move(900, 600);
await page.mouse.wheel(40, 120);
let v = await view();
check("scroll pans", near(v.x, start.x - 40) && near(v.y, start.y - 120) && v.z === start.z);

// Ctrl + scroll zooms around the cursor
const before = await view();
const anchor = { x: (900 - before.x) / before.z, y: (600 - before.y) / before.z };
await page.keyboard.down("Control");
await page.mouse.wheel(0, -100);
await page.mouse.wheel(0, -100);
await page.keyboard.up("Control");
v = await view();
check("ctrl + scroll zooms in", v.z > before.z, `${before.z.toFixed(2)} to ${v.z.toFixed(2)}`);
check(
  "zoom keeps the point under the cursor still",
  near(anchor.x * v.z + v.x, 900) && near(anchor.y * v.z + v.y, 600),
);

// Keyboard
await page.keyboard.press("0");
await settle();
v = await view();
check("0 resets to 100%", near(v.z, 1, 0.001));
check("zoom label follows", (await page.locator(".lgac-zoom").innerText()) === "100%");
await page.keyboard.press("=");
await settle();
check("+ zooms in", near((await view()).z, 1.1, 0.001));
await page.keyboard.press("-");
await page.keyboard.press("-");
await settle();
check("- zooms out", near((await view()).z, 1 / 1.1, 0.001));
await page.keyboard.press("1");
await settle();
v = await view();
const fitted = await box(".lgac-world");
check("1 fits everything", fitted.y + fitted.height <= 900 - 104 + 2 && fitted.x >= 0, `zoom ${v.z.toFixed(2)}`);

// Select tool: content is clickable, dragging does not pan
await page.keyboard.press("0");
await settle();
await page.getByTestId("row-tables").click();
await settle();
const counter = page.getByTestId("counter");
await counter.click();
check("select tool: content is clickable", (await counter.innerText()) === "Clicked 1");
let p = await view();
await page.mouse.move(700, 700);
await page.mouse.down();
await page.mouse.move(800, 760, { steps: 4 });
await page.mouse.up();
v = await view();
check("select tool: dragging does not pan", v.x === p.x && v.y === p.y);
check("select tool: dragging does not select text", (await page.evaluate(() => String(window.getSelection()))) === "");

// Hand tool: drag pans, content does not get clicks
await page.keyboard.press("h");
check("H picks the hand tool", (await page.getByLabel("Hand (H, or hold Space)").getAttribute("aria-pressed")) === "true");
p = await view();
const counterBox = await counter.boundingBox();
const cx = counterBox.x + counterBox.width / 2;
const cy = counterBox.y + counterBox.height / 2;
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx + 120, cy + 60, { steps: 6 });
await page.mouse.up();
v = await view();
check("hand tool: drag pans", near(v.x, p.x + 120) && near(v.y, p.y + 60));
check("hand tool: content does not get the click", (await counter.innerText()) === "Clicked 1");
await page.mouse.move(cx + 120, cy + 60);
check("hand tool: nothing is outlined", !(await page.locator('[data-outline="hover"]').isVisible()));
await page.keyboard.press("v");

// Space + drag pans with the select tool
p = await view();
await page.mouse.move(700, 700);
await page.keyboard.down("Space");
await page.mouse.down();
await page.mouse.move(640, 650, { steps: 4 });
await page.mouse.up();
await page.keyboard.up("Space");
v = await view();
check("space + drag pans", near(v.x, p.x - 60) && near(v.y, p.y - 50));

// Middle-drag pans
p = await view();
await page.mouse.move(700, 700);
await page.mouse.down({ button: "middle" });
await page.mouse.move(730, 720, { steps: 3 });
await page.mouse.up({ button: "middle" });
v = await view();
check("middle-drag pans", near(v.x, p.x + 30) && near(v.y, p.y + 20));

// Dock buttons
await page.getByLabel("Zoom in (+)").click();
await settle();
check("zoom-in button", (await view()).z > v.z);
await page.getByLabel("Fit to screen (1)").click();
await settle();

// focus()
await page.getByTestId("row-cards").click();
await settle();
const cards = await box('[data-canvas-id="cards"]');
check(
  "focus() brings a group into view",
  cards.x >= 40 - 2 && cards.x + cards.width <= 1440 - 40 + 2 && near(cards.y, 96),
  `x ${Math.round(cards.x)}, y ${Math.round(cards.y)}`,
);
await page.screenshot({ path: ".check/2-focus-cards.png" });

// Specimens
await page.getByLabel("Fit to screen (1)").click();
await settle();
v = await view();
const backdrop = await box('[data-testid="fixed-backdrop"]');
check(
  "a position: fixed backdrop stays inside its specimen",
  near(backdrop.width, 420 * 0.4 * v.z, 1) && near(backdrop.height, 280 * 0.4 * v.z, 1),
  `${Math.round(backdrop.width)} x ${Math.round(backdrop.height)}`,
);
// Specimens are live: you can try them, as you would in the app
await page.getByTestId("live-button").click();
check("specimens are live: a button inside one works", (await page.getByTestId("live-button").innerText()) === "Tried 1");
await page.getByTestId("live-link").click();
check("a link inside a specimen does not leave the page", page.url().includes("?canvas"));
await page.getByTestId("menu-trigger").click();
const onTop = (testId) =>
  page.evaluate((id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    const box = element.getBoundingClientRect();
    return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) === element;
  }, testId);
check("a menu the component portals to <body> appears above the canvas", (await onTop("menu-direct")) && (await onTop("menu-wrapped")));
await page.getByTestId("menu-trigger").click();
check("a specimen that throws shows its error", await page.getByText("LegacyPopup could not render").isVisible());
const fonts = await page.evaluate(() => ({
  specimen: getComputedStyle(document.querySelector(".lgac-specimen .demo-button")).fontFamily,
  chrome: getComputedStyle(document.querySelector(".lgac-zoom")).fontFamily,
}));
check("specimens keep the app's font, chrome does not", fonts.specimen.includes("Georgia") && !fonts.chrome.includes("Georgia"));

// Hover outlines and selection
const sameBox = (a, b) => near(a.x, b.x, 1) && near(a.y, b.y, 1) && near(a.width, b.width, 1) && near(a.height, b.height, 1);
const hoverBox = page.locator('[data-outline="hover"]');
const selectBox = page.locator('[data-outline="selected"]');
const specimen = page.locator('[data-canvas-id="buttons"] .lgac-specimen').nth(2);
let target = await specimen.boundingBox();
await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
check("hover outlines the specimen under the pointer", sameBox(await hoverBox.boundingBox(), target));
check("the outline names it", (await hoverBox.innerText()) === "Button 3");
await page.screenshot({ path: ".check/3-hover.png" });

await page.mouse.wheel(30, 60);
check("the outline follows while panning", sameBox(await hoverBox.boundingBox(), await specimen.boundingBox()));
await page.keyboard.down("Control");
await page.mouse.wheel(0, -40);
await page.keyboard.up("Control");
check("the outline follows while zooming", sameBox(await hoverBox.boundingBox(), await specimen.boundingBox()));
check(
  "the outline stroke stays 2px at any zoom",
  (await hoverBox.evaluate((box) => getComputedStyle(box).outlineWidth)) === "2px" && (await view()).z > 1,
);
await settle();

const groupHeader = page.locator('[data-canvas-id="buttons"] header strong');
await groupHeader.hover();
check("hovering a group outlines the group", (await hoverBox.innerText()) === "Buttons");

target = await specimen.boundingBox();
await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
await page.mouse.move(40, 500);
check("click selects, and the selection stays", sameBox(await selectBox.boundingBox(), await specimen.boundingBox()));
check("nothing else is outlined once the pointer leaves", !(await hoverBox.isVisible()));
await page.mouse.wheel(0, 80);
await page.keyboard.down("Control");
await page.mouse.wheel(0, 30);
await page.keyboard.up("Control");
await settle();
check("the selection follows the camera", sameBox(await selectBox.boundingBox(), await specimen.boundingBox()));
await page.keyboard.down("Space");
await page.mouse.move(700, 700);
await page.mouse.down();
await page.mouse.move(720, 720, { steps: 3 });
await page.mouse.up();
await page.keyboard.up("Space");
check("a pan does not count as a click away", await selectBox.isVisible());
await page.keyboard.press("Escape");
check("Escape clears the selection", !(await selectBox.isVisible()));

// React stays out of the way while the canvas moves
await page.mouse.move(900, 600);
await settle();
const rendersBefore = await page.evaluate(() => window.__canvasConsumerRenders);
await page.keyboard.down("Control");
for (let tick = 0; tick < 20; tick += 1) await page.mouse.wheel(0, tick < 10 ? -8 : 8);
await page.keyboard.up("Control");
for (let tick = 0; tick < 20; tick += 1) await page.mouse.wheel(6, 6);
const rendersDuring = await page.evaluate(() => window.__canvasConsumerRenders);
await settle();
const rendersAfter = await page.evaluate(() => window.__canvasConsumerRenders);
check(
  "40 pan and zoom ticks cause no React renders until movement settles",
  rendersDuring === rendersBefore && rendersAfter - rendersBefore <= 2,
  `${rendersDuring - rendersBefore} during, ${rendersAfter - rendersBefore} after`,
);

// Position survives a reload
await page.getByLabel("Fit to screen (1)").click();
await settle();
await page.mouse.move(900, 600);
await page.mouse.wheel(0, 200);
await settle();
p = await view();
await page.reload();
await page.waitForSelector(".lgac-world");
await settle();
v = await view();
check("position survives a reload", v.x === p.x && v.y === p.y && near(v.z, p.z, 0.001));

// Touch: one finger pans, two fingers pinch
const touchContext = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
const touchPage = await touchContext.newPage();
await touchPage.goto(`${url}?canvas`);
await touchPage.waitForSelector(".lgac-world");
await touchPage.waitForTimeout(320);
const touchView = () =>
  touchPage.evaluate(() => {
    const matrix = new DOMMatrix(getComputedStyle(document.querySelector(".lgac-world")).transform);
    return { x: matrix.e, y: matrix.f, z: matrix.a };
  });
const cdp = await touchContext.newCDPSession(touchPage);
const touch = (type, points) =>
  cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
p = await touchView();
await touch("touchStart", [[500, 600]]);
await touch("touchMove", [[520, 620]]);
await touch("touchMove", [[560, 660]]);
await touch("touchEnd", []);
v = await touchView();
check("touch: one finger pans", near(v.x, p.x + 60, 6) && near(v.y, p.y + 60, 6), `moved ${v.x - p.x}, ${v.y - p.y}`);
p = await touchView();
await touch("touchStart", [[450, 500], [550, 500]]);
await touch("touchMove", [[425, 500], [575, 500]]);
await touch("touchMove", [[400, 500], [600, 500]]);
await touch("touchEnd", []);
v = await touchView();
check("touch: pinch zooms", v.z > p.z * 1.5, `${p.z.toFixed(2)} to ${v.z.toFixed(2)}`);

// A big audit: main-thread cost per frame while panning and zooming over hundreds of live specimens.
// Measured from Chrome's own counters, so it does not depend on the display's refresh rate.
const stressPage = await context.newPage();
await stressPage.goto(`${url}?stress=600`);
await stressPage.waitForSelector(".lgac-world");
await stressPage.waitForTimeout(600);
await stressPage.mouse.move(700, 450);
const stressCdp = await context.newCDPSession(stressPage);
await stressCdp.send("Performance.enable");
const taskSeconds = async () =>
  (await stressCdp.send("Performance.getMetrics")).metrics.find((metric) => metric.name === "TaskDuration").value;
const FRAMES = 120;
const drive = (zooming) =>
  stressPage.evaluate(
    ({ zooming, frames }) =>
      new Promise((resolve) => {
        const target = document.querySelector(".lgac-viewport");
        let frame = 0;
        const tick = () => {
          frame += 1;
          if (frame > frames) return resolve();
          const forward = frame % 60 < 30;
          target.dispatchEvent(
            new WheelEvent("wheel", {
              bubbles: true,
              cancelable: true,
              clientX: 700,
              clientY: 450,
              deltaX: zooming ? 0 : forward ? 12 : -12,
              deltaY: zooming ? (forward ? -4 : 4) : forward ? 12 : -12,
              ctrlKey: zooming,
            }),
          );
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { zooming, frames: FRAMES },
  );
for (const [label, zooming] of [["panning", false], ["zooming", true]]) {
  const before = await taskSeconds();
  await drive(zooming);
  const perFrame = ((await taskSeconds()) - before) * 1000 / FRAMES;
  check(`${label} 600 specimens costs well under a frame`, perFrame < 8, `${perFrame.toFixed(1)}ms of main thread per frame`);
  await stressPage.waitForTimeout(300);
}
await stressPage.close();

// The audit page for the fixture app: the scan drives what is on it.
const { readFileSync } = await import("node:fs");
const fixtureScan = JSON.parse(readFileSync("fixture/src/audit/audit.scan.json", "utf8"));
const auditPage = await context.newPage();
const auditErrors = [];
auditPage.on("pageerror", (error) => auditErrors.push(error.message));
auditPage.on("console", (message) => {
  if (message.type() === "error") auditErrors.push(message.text());
});
await auditPage.goto(url);
await auditPage.waitForSelector(".lgac-world");
await auditPage.waitForTimeout(500);
// The fixture's data asks for a deep audit of the buttons only.
const families = fixtureScan.components.filter((component) => !component.part);
const looks = fixtureScan.handRolled.filter((look) => look.confidence === "high");
const buttonLooks = looks.filter((look) => look.kind === "buttons");
const requiredValues = fixtureScan.components.flatMap((component) => component.axes.filter((axis) => axis.required).flatMap((axis) => axis.values));
check("audit page: lists every component in the scan", (await auditPage.locator("[data-audit-listed]").count()) === families.length, `${families.length} components`);
check("audit page: reports full coverage", (await auditPage.getByTestId("coverage").innerText()) === `${families.length + buttonLooks.length} of ${families.length + buttonLooks.length} shown`);
check("audit page: every shared component has a card", (await auditPage.locator("[data-audit-component]").count()) === families.length);
check(
  "audit page: every variant value is rendered",
  (await auditPage.locator("[data-audit-variant]").count()) === requiredValues.length && (await auditPage.locator("[data-audit-variant] .lgac-specimen").count()) === requiredValues.length,
  `${requiredValues.length} values`,
);
check("audit page: hand-rolled looks are drawn for the audited group only", (await auditPage.locator("[data-audit-look] .lgac-specimen").count()) === buttonLooks.length);
check(
  "audit page: other groups list their hand-rolled elements without drawing them",
  (await auditPage.locator("[data-audit-listed-looks]").count()) === 2 && (await auditPage.locator('[data-audit-listed-looks="modals"]').innerText()).includes("not drawn"),
);
check("audit page: nothing is missing a specimen", (await auditPage.locator(".lgap-missing").count()) === 0);
// Issues: a pin on the canvas, a row in the sidebar, a filter, and resolve
const destructivePin = auditPage.locator('[data-marker-target$="#Button|variant|destructive|pin"]');
check("audit page: a never-used variant gets a grey pin on its tile", (await destructivePin.count()) === 1 && (await destructivePin.locator(".lgac-marker-pin").evaluate((pin) => getComputedStyle(pin).backgroundColor)) === "rgb(161, 161, 170)");
await destructivePin.locator(".lgac-marker-pin").hover();
check("audit page: hovering a pin explains it and offers a prompt", (await destructivePin.locator(".lgac-marker-card").isVisible()) && (await destructivePin.getByText("Copy prompt").isVisible()));
// Overrides: the component as written first, then every way call sites restyle it.
const overridesCard = auditPage.locator('[data-audit-overrides$="#Button"]');
const radius = (locator) => locator.evaluate((element) => getComputedStyle(element).borderRadius);
const asWritten = auditPage.locator('[data-audit-component$="#Button"] .lgap-hero button').first();
const overriddenButton = overridesCard.locator('[data-audit-override] [data-ovr-side="overridden"] button').first();
const originalButton = overridesCard.locator('[data-audit-override] [data-ovr-side="original"] button').first();
check("audit page: a component shows as written, not with a call site's restyle", (await radius(asWritten)) === "8px", await radius(asWritten));
check(
  "audit page: an Overridden card draws each override on the real component",
  (await overridesCard.locator("[data-audit-override]").count()) === 1 && (await radius(overriddenButton)) === "999px" && (await overriddenButton.innerText()).includes("Send invite"),
);
check("audit page: each override shows the original beside it", (await radius(originalButton)) === "8px");
await overridesCard.locator("[data-audit-override]").first().locator(".lgap-ovr-meta").dispatchEvent("click");
await auditPage.waitForSelector("[data-audit-css='element']", { timeout: 5000 }).catch(() => {});
const inspectorText = await auditPage.locator("[data-audit-inspector]").innerText().catch(() => "");
check("audit page: clicking an override opens the inspector with the CSS it changes", inspectorText.includes("border-radius") && inspectorText.includes("rounded-full"));
check("audit page: the inspector lists the override's call sites", (await auditPage.locator("[data-audit-inspector] [data-audit-site]").count()) === 1);
check("audit page: the inspected override is kept in the URL", new URL(auditPage.url()).searchParams.get("inspect")?.endsWith("|rounded-full shadow-lg") === true);
await overridesCard.locator("[data-audit-overrides-all]").dispatchEvent("click");
await auditPage.waitForTimeout(200);
check("audit page: clicking the Overridden summary inspects every override of the component", (await auditPage.locator('[data-audit-inspector][data-audit-scope="component"]').count()) === 1 && (await auditPage.locator("[data-audit-inspector] [data-audit-site]").count()) === 1);
await auditPage.locator('[data-audit-scope-option="all"]').click();
check("audit page: the inspector can widen to every override in the codebase", (await auditPage.locator('[data-audit-inspector][data-audit-scope="all"]').count()) === 1 && new URL(auditPage.url()).searchParams.get("inspect") === "all");
await auditPage.locator(".lgap-insp-close").click();
check("audit page: the card says how many call sites restyle it, and leaves placement out", (await overridesCard.innerText()).includes("1 of 8 call sites") && (await overridesCard.innerText()).includes("1 more call site only passes"));
check("audit page: an override gets an orange pin on the card", (await auditPage.locator('[data-marker-target$="#Button|overrides"]').count()) === 1);
const legendStatuses = await auditPage.locator("[data-audit-legend]").count();
check("audit page: a legend of the four statuses sits above the components", legendStatuses === 4);
await auditPage.locator('[data-audit-caret$="#Button"]').click();
const buttonIssues = auditPage.locator('[data-audit-issues$="#Button"] [data-audit-issue]');
const destructiveIssue = auditPage.locator('[data-audit-issues$="#Button"] [data-audit-issue$="#Button|variant|destructive"]');
check("audit page: a component's caret opens its list of issues", (await buttonIssues.count()) >= 2 && (await destructiveIssue.innerText()).includes('variant="destructive" is never used'));
const overrideIssue = auditPage.locator('[data-audit-issues$="#Button"] [data-audit-issue^="overridden:"]');
check("audit page: each distinct override is an issue of its own", (await overrideIssue.count()) === 1 && (await overrideIssue.innerText()).includes("rounded-full"));
const cameraBefore = await auditPage.evaluate(() => getComputedStyle(document.querySelector(".lgac-world")).transform);
await destructiveIssue.locator(".lgap-issue-title").click();
await auditPage.waitForTimeout(450);
check("audit page: clicking an issue takes you to it", (await auditPage.evaluate(() => getComputedStyle(document.querySelector(".lgac-world")).transform)) !== cameraBefore);
await destructiveIssue.hover();
await auditPage.locator('[data-audit-resolve$="#Button|variant|destructive"]').click();
check(
  "audit page: resolving an issue strikes it through and removes its pin",
  (await destructiveIssue.getAttribute("class")).includes("lgap-resolved") && (await destructivePin.count()) === 0,
);
await auditPage.reload();
await auditPage.waitForSelector(".lgac-world");
await auditPage.waitForTimeout(400);
check("audit page: resolved issues stay resolved after a reload", (await auditPage.locator('[data-marker-target$="#Button|variant|destructive|pin"]').count()) === 0);
const allPins = () => auditPage.locator("[data-marker-id]").count();
const pinsShown = await allPins();
await auditPage.locator('[data-audit-filter="none"]').click();
const pinsNone = await allPins();
await auditPage.locator('[data-audit-filter="unused"]').click();
const pinsUnused = await auditPage.locator("[data-marker-id]").evaluateAll((pins) => pins.map((pin) => getComputedStyle(pin.querySelector(".lgac-marker-pin")).backgroundColor));
await auditPage.locator('[data-audit-filter="all"]').click();
check(
  "audit page: the filter bar shows none, one status, or all of them",
  pinsShown > 0 && pinsNone === 0 && pinsUnused.length > 0 && pinsUnused.every((colour) => colour === "rgb(161, 161, 170)") && (await allPins()) === pinsShown,
);
await auditPage.evaluate(() => window.localStorage.clear());
const outline = auditPage.locator('[data-audit-variant="Button.variant=outline"] button');
check("audit page: a variant specimen is the real component with that variant", ((await outline.getAttribute("class")) ?? "").includes("btn-outline"));
check(
  "audit page: specimens use the app's font, not the audit's",
  (await outline.evaluate((element) => getComputedStyle(element).fontFamily)).includes("Georgia"),
);
// Hover and selection work as on the Lunagraph canvas: a page outlines in the selection colour,
// a component on it in the component colour.
const buttonPage = auditPage.locator('[data-audit-component$="#Button"]');
const pageOutline = auditPage.locator('[data-outline="hover"]');
const tone = () => pageOutline.evaluate((box) => getComputedStyle(box).outlineColor);
await auditPage.locator('[data-audit-listed$="#Button"]').click(); // bring the Button page into view
await auditPage.waitForTimeout(450);
await buttonPage.locator(".lgap-title").hover();
const pageBox = await buttonPage.boundingBox();
let outlineBox = await pageOutline.boundingBox();
const pageTone = await tone();
check(
  "audit page: hovering a page outlines the whole page, named after the component",
  Math.abs(pageBox.x - outlineBox.x) <= 1 && Math.abs(pageBox.width - outlineBox.width) <= 1 && Math.abs(pageBox.height - outlineBox.height) <= 1 && (await pageOutline.innerText()) === "Button",
);
const outlineSpecimen = auditPage.locator('[data-audit-variant="Button.variant=outline"] .lgac-specimen');
await outlineSpecimen.hover();
const specimenBox = await outlineSpecimen.boundingBox();
outlineBox = await pageOutline.boundingBox();
check(
  "audit page: hovering a component outlines that component, in the component colour",
  Math.abs(specimenBox.x - outlineBox.x) <= 1 && Math.abs(specimenBox.width - outlineBox.width) <= 1 && (await pageOutline.innerText()) === "Button variant=outline" && (await tone()) !== pageTone,
);
check(
  "audit page: pages are white on a grey canvas",
  (await buttonPage.evaluate((element) => getComputedStyle(element).backgroundColor)) === "rgb(255, 255, 255)" &&
    (await auditPage.locator(".lgac-root").evaluate((element) => getComputedStyle(element).backgroundColor)) === "rgb(241, 241, 241)",
);
await auditPage.goto(`${url}#buttons`);
await auditPage.waitForTimeout(500);
const button = fixtureScan.components.find((component) => component.name === "Button");
check("audit page: a group view lists every call site", (await auditPage.locator(".lgap-sites").first().locator("> div").count()) === button.callSites.length, `${button.callSites.length} call sites`);
check("audit page: a group view lists every prop", (await auditPage.locator(".lgap-table").first().locator("tr").count()) === button.props.length);
await auditPage.goto(url);
await auditPage.waitForTimeout(500);
const dialogSheet = auditPage.locator('[data-audit-component$="#Dialog"]');
await auditPage.locator('[data-audit-listed$="#Dialog"]').click(); // bring the Dialog sheet into view
await auditPage.waitForTimeout(500);
check("audit page: an overlay is closed until you open it", (await dialogSheet.locator(".lgap-frame").first().locator(".dialog-backdrop").count()) === 0);
const toggle = auditPage.locator("[data-audit-toggle]");
await toggle.click();
check(
  "audit page: the Open control opens a state-driven dialog",
  (await toggle.innerText()) === "Close" && (await dialogSheet.locator(".lgap-frame").first().locator(".dialog-backdrop").count()) === 1,
);
await toggle.click();
check("audit page: no console or page errors", auditErrors.length === 0, auditErrors.slice(0, 2).join(" | "));
await auditPage.screenshot({ path: ".check/4-audit-group.png" });
await auditPage.goto(url);
await auditPage.waitForTimeout(500);
await auditPage.screenshot({ path: ".check/5-audit-inventory.png" });
await auditPage.close();

// Server rendering (Next.js and Remix render the page on the server first)
const { createElement } = await import("react");
const { renderToString } = await import("react-dom/server");
const canvas = await server.ssrLoadModule("/../skills/audit/canvas/AuditCanvas.tsx");
let html = "";
try {
  html = renderToString(
    createElement(
      canvas.AuditCanvas,
      { topLeft: createElement(canvas.CanvasPanel, null, "Audit") },
      createElement(canvas.CanvasSpecimen, { name: "Button", scale: 0.5 }, createElement("button", null, "Send")),
    ),
  );
} catch (error) {
  errors.push(`server render: ${error.message}`);
}
check("renders on the server", html.includes("lgac-world") && html.includes("Send"));

check("no console or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
await server.close();

const failed = results.filter((result) => !result.pass);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
