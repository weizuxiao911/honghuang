const esbuild = require('esbuild');
const path = require('path');

const root = path.resolve(__dirname, '..');

const shared = {
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2019',
  sourcemap: false,
  logLevel: 'info',
};

async function build() {
  await esbuild.build({
    ...shared,
    entryPoints: [path.join(root, 'src/extension.ts')],
    outfile: path.join(root, 'out/extension.js'),
    external: ['vscode'],
  });

  await esbuild.build({
    ...shared,
    entryPoints: [path.join(root, 'src/views.tsx')],
    outfile: path.join(root, 'out/views.js'),
    external: ['React', 'ReactDOM', 'react', 'react-dom', 'vscode'],
  });
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
