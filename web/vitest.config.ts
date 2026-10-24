import { defineConfig } from "vitest/config";

// Tests cover only the pure helpers in src/lib (no DOM), so they run in plain Node.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
