import { defineConfig } from "tsup";

export default defineConfig({
  entry: { server: "src/server.ts" },
  outDir: "dist",
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  sourcemap: true,
  // @worlds/shared ships as TypeScript source; bundle it into the artifact.
  // Runtime dependencies (fastify, zod) stay external and resolve from node_modules.
  noExternal: ["@worlds/shared"]
});
