const esbuild = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const outdir = "build";

function buildHTML(javacript) {
  const base64JavascriptContent = Buffer.from(javacript).toString("base64");

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body>
    <div id="root"></div>
    <script type="text/javascript" src="data:text/javascript;base64,${ base64JavascriptContent }"></script>
</body>
</html>
  `;
}

function buildMarkdown(html) {
  return `
|||
|-|-|
|name|example plugin|

\`\`\`
{
  appOption(app) {
    app.openSidebarEmbed();
  },
  renderEmbed(app) {
    return \`${ html }\`;
  },
}
\`\`\`
  `;
}

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

        const htmlContent = buildHTML(file.text)
        const markdownContent = buildMarkdown(htmlContent);

        const markdownPath = path.join(path.dirname(file.path), "note.md");
        fs.writeFileSync(markdownPath, markdownContent);
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
