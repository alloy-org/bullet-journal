const esbuild = require("esbuild");

esbuild.build({
  bundle: true,
  define: { "process.env.NODE_ENV": '"production"' },
  entryPoints: [ "src/index.jsx" ],
  minify: true,
  outdir: "build",
  sourcemap: true,
  sourceRoot: "src",
  target: [ "chrome58" , "firefox57", "safari11", "edge16" ],
});
