/**
 * 框架级 layout 模块统一导出 — components/layout/
 *
 * 本目录按 slot 概念分组, 只维护布局与框架能力:
 *   - layout.tsx          框架级 LayoutComponent (IDE 布局壳 + SandboxLoading)
 *   - topbar/             top slot 容器 (chrome 容器, 装载 menu-bar 等)
 *   - rightbar/           right slot 容器 (装载业务拓展: AI 助手 / chat / output 等)
 *   - bottombar/          bottom slot 容器 (装载问题/终端/output, 默认 'tc-problems')
 *   - fs/                 fs 槽位框架能力 (runtime 拉取 + sandbox provider + SandboxLoading overlay)
 *
 * 注意: 槽位 id 必须用 OpenSumi 标准 id (left / right / bottom),
 * leftBar / rightBar / bottomBar 是框架 @deprecated 别名, 无面板渲染器.
 *
 * slot 装载的 module 各自是独立 BrowserModule 拓展, 按 VS Code 兼容拓展标准或
 * OpenSumi 兼容拓展标准开发, 与 client 框架解耦维护.
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

// fs slot — 登录后自动激活 sandbox scheme 文件系统, 对接 gateway runtime
export { FsModule, FsContribution } from './fs';
export { SandboxLoading } from './fs/SandboxLoading';
