import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const pureEntry = fileURLToPath(new URL("../core/src/pure.ts", import.meta.url));

export default defineConfig({
  entry: ["src/register.ts"],
  format: ["esm"],
  outDir: "hooks",
  clean: false,
  splitting: false,
  sourcemap: false,
  noExternal: ["@cclink8/core", "@cclink8/core/pure"],
  esbuildOptions(options) {
    options.alias = {
      ...(options.alias ?? {}),
      "@cclink8/core/pure": pureEntry,
    };
  },
  dts: false,
});
