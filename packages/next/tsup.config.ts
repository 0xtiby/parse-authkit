import { defineConfig, Options } from "tsup";

export default defineConfig((options: Options) => ({
  entry: {
    index: "src/index.ts",
    core: "src/core/index.ts",
    client: "src/client/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  minify: true,
  sourcemap: true,
  splitting: false,
  ...options,
}));
