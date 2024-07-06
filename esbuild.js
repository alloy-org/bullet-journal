import esbuild from "esbuild"

const result = await esbuild.build({
  entryPoints: [`lib/plugin.js`],
  bundle: true,
  format: "iife",
  outfile: "build/compiled.js",
  packages: "external",
  platform: "node",
  write: true,
});
console.log("Result was", result)
