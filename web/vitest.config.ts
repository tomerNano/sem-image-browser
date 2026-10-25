import { defineConfig } from "vitest/config";

// Tests run in plain Node (no DOM). Solid is bundled by Vite with the "browser" condition so
// its client build loads: signals, memos and resources react in store tests (the server build
// that Node picks by default does not react).
export default defineConfig({
  resolve: { conditions: ["browser", "development"] },
  ssr: { resolve: { conditions: ["browser", "development"] } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    server: { deps: { inline: [/solid-js/] } },
  },
});
