import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const isCloudflare = process.env.CF_PAGES === "1" || process.argv.includes("build");

export default defineConfig({
  plugins: [
    ...(isCloudflare
      ? [cloudflare({ viteEnvironment: { name: "ssr" } })]
      : []),
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      router: {
        routeFileIgnorePattern: "^_(?:components|hooks|utils)$",
      },
    }),
    viteReact(),
  ],
  server: {
    port: 4030,
  },
});
