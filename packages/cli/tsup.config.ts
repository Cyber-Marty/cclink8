import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  splitting: false,
  sourcemap: false,
  // Bundle the Node core entry so the packed CLI is standalone; the registry
  // is pending, so a tarball must not depend on @cclink8/core being published.
  noExternal: ["@cclink8/core"],
});
