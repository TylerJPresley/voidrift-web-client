import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts", "./src/test-hermetic.ts"],
    globalSetup: ["./src/test-hermetic.global.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/test-hermetic.global.ts",
        "src/test-hermetic.ts",
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/index.ts",
        "src/test-setup.ts",
        "src/app/entry-server.tsx",
        "src/app/entry-client.tsx",
        "src/events/wire.ts",
      ],
      thresholds: { statements: 80, branches: 70, functions: 80, lines: 80 },
    },
  },
});
