/**
 * Toast 拓展 — extensions/toast/
 *
 * OpenSumi 拓展 (一个子目录一个拓展):
 *   - module.ts    OpenSumi 扩展注册 (ToastModule + ToastContribution)
 *   - ToastView.tsx 全局轻提示 (监听 taichu:gate-hint, 底部 2s)
 *
 * 挂载: slots.ts 的 layoutConfig['toast'].modules = ['toast-default']
 *       layout.tsx 的 <SlotRenderer slot="toast" />
 */
export { ToastModule, ToastContribution } from './module';
