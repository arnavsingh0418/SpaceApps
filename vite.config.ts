import { defineConfig } from "vite";
export default defineConfig({
  root: "client",
  base: "./",
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    fs: { allow: [".."] },
    proxy: { "/crew": { target: "ws://localhost:2567", ws: true } },
  },
});
