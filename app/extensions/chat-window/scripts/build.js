const esbuild = require('esbuild');
const path = require('path');

const root = path.resolve(__dirname, '..');

const shared = {
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
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
    // CodeBlitz view 协议直接把 component 渲染到主 React tree，
    // host 端 (app/index.tsx) 已把 React + ReactDOM 挂到 window 全局。
    external: ['React', 'ReactDOM', 'react', 'react-dom', 'vscode'],
  });
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
