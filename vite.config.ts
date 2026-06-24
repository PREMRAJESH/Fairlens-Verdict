import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      tsr: { appDirectory: "src" },
      // @ts-expect-error - preset is a valid Nitro option not in TanStack's types
      server: { entry: "server", preset: process.env.VERCEL ? "vercel" : "node-server" },
    }),
    react(),
    tsconfigPaths(),
    tailwindcss(),
  ],
});
