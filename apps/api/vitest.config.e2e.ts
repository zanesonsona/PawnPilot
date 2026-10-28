import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    root: "./",
    include: ["test/**/*.e2e-spec.ts"],
    environment: "node",
    setupFiles: ["test/setup-env.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
