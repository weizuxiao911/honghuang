/**
 * Loading 拓展 — extensions/loading/
 *
 * OpenSumi 拓展 (一个子目录一个拓展):
 *   - module.ts    OpenSumi 扩展注册 (LoadingModule + LoadingContribution)
 *   - LoadingView.tsx 沙箱加载 overlay (登录后 → opencode 探活通过前)
 *
 * 挂载: slots.ts 的 layoutConfig['loading'].modules = ['loading-default']
 *       layout.tsx 的 <SlotRenderer slot="loading" />
 */
export { LoadingModule, LoadingContribution } from './module';
