const esbuild = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const outdir = "build";

const packageNotePlugin = {
  name: "package-note-plugin",
  setup(build) {
    const options = build.initialOptions;
    options.write = false;

    build.onEnd(({ errors, outputFiles }) => {
      if (errors.length > 0) {
        console.error(errors);
      } else {
        const [ file ] = outputFiles;

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body>
    <div id="root"></div>
    <script type="text/javascript">${ file.text }</script>
</body>
</html>
        `;

        const htmlPath = path.join(path.dirname(file.path), "index.html");
        fs.writeFileSync(htmlPath, htmlContent);
      }
    });
  }
};

esbuild.build({
  bundle: true,
  define: { "process.env.NODE_ENV": '"production"' },
  entryPoints: [ "src/index.jsx" ],
  minify: true,
  outdir,
  sourceRoot: "src",
  plugins: [ packageNotePlugin ],
  target: [ "chrome58" , "firefox57", "safari11", "edge16" ],
});
