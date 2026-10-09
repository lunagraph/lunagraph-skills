import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// /            the audit page for the fixture app, built the way the skill builds it
// /?canvas     a mock layout for exercising the canvas on its own
// /?stress=600 the same, with hundreds of extra specimens
const params = new URLSearchParams(window.location.search);
const canvasOnly = params.has("canvas") || params.has("stress");

const { default: View } = canvasOnly
  ? await import("./Demo").then((module) => ({ default: module.Demo }))
  : await import("../fixture/src/audit/page");
if (canvasOnly) await import("./demo.css");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <View />
  </StrictMode>,
);
