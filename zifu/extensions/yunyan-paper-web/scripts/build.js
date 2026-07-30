const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'webview/dist/.vite/manifest.json');
const manifest = fs.readFileSync(manifestPath, 'utf-8');

esbuild
  .build({
    entryPoints: [path.join(root, 'src/extension.ts')],
    outfile: path.join(root, 'out/extension.js'),
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2020',
    sourcemap: false,
    logLevel: 'info',
    external: ['vscode'],
    define: {
      __PAPER_MANIFEST__: JSON.stringify(manifest),
    },
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
