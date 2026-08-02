/**
 * 框架级 layout 模块统一导出 — components/layout/
 *
 * 本目录按 slot 概念分组, 只维护布局与框架能力:
 *   - layout.tsx          框架级 LayoutComponent (IDE 布局壳 + SandboxLoading)
 *   - topbar/             top slot 容器 (chrome 容器, 装载 menu-bar 等)
 *   - rightbar/           right slot 容器 (装载业务拓展: AI 助手 / chat / output 等)
 *   - bottombar/          bottom slot 容器 (装载问题/终端/output, 默认 'tc-problems')
 *   - fs/SandboxLoading   沙箱启动 loading overlay (纯 UI 状态展示)
 *
 * 注意: 槽位 id 必须用 OpenSumi 标准 id (left / right / bottom),
 * leftBar / rightBar / bottomBar 是框架 @deprecated 别名, 无面板渲染器.
 *
 * 沙箱 runtime 拉取 + OpenCode SDK 封装 + fs commands 在 commands/ 目录 (commands/opencode, commands/fs),
 * 与 framework 框架能力 (本目录) 职责分开.
 *
 * login / user webview 已在 components/ (webview) 与 commands/ (commands) 目录单独维护.
 */
export { LayoutComponent } from './layout';

// topBar slot
export { TopBar } from './topbar/TopBar';
export { TopBarModule, TopBarContribution } from './topbar';

// rightBar slot
export { RightBar } from './rightbar/RightBar';
export { RightBarModule, RightBarContribution, RightBarRendererContribution } from './rightbar/RightBarModule';
export { RightTopTabbarView } from './rightbar/RightTopTabbarView';
export { RightPanelRenderer } from './rightbar/RightPanelRenderer';

// bottomBar slot
export { BottomModule, BottomContribution } from './bottombar/BottomModule';
export { BottomPlaceholder } from './bottombar/BottomPlaceholder';
export { ProblemsView } from './bottombar/ProblemsView';

// fs 槽位 — 沙箱启动 loading overlay (纯 UI 状态, 业务在 commands/opencode + commands/fs)
export { SandboxLoading } from './fs/SandboxLoading';