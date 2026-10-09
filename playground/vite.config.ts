import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The canvas lives in the skill folder, outside this app, so it has no
// node_modules of its own. Resolve React from here and allow serving it.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    // The fixture app imports its own code as "@/...".
    alias: { "@": fileURLToPath(new URL("./fixture/src", import.meta.url)) },
  },
  server: { fs: { allow: [".."] } },
});
