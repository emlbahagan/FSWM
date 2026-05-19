import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    server: {
      deps: {
        inline: ["server-only"],
      },
    },
  },
  resolve: {
    conditions: ["react-server"],
  },
});
