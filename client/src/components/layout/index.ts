/**
 * 框架级 layout 模块统一导出
 *
 * 本目录按 slot 概念分组:
 *   - layout.tsx          框架级 LayoutComponent (IDE 布局壳)
 *   - topbar/             topBar slot 容器 (chrome 容器, 装载 menu-bar 等)
 *   - rightbar/           rightBar slot 容器 (装载业务拓展: AI 助手 / chat / output 等)
 *   - bottombar/          bottomBar slot 容器 (装载问题/终端/output, 默认 'tc-problems')
 *
 * slot 装载的 module 各自是独立 BrowserModule 拓展, 按 VS Code 兼容拓展标准或
 * OpenSumi 兼容拓展标准开发, 与 client 框架解耦维护.
 */
export { LayoutComponent } from './layout';

// topBar slot
export { TopBar } from './topbar/TopBar';
export { TopBarModule, TopBarContribution } from './topbar';

// rightBar slot
export { RightBar } from './rightbar/RightBar';
export { RightBarModule, RightBarContribution } from './rightbar/RightBarModule';

// bottomBar slot
export { BottomModule, BottomContribution } from './bottombar/BottomModule';
export { BottomPlaceholder } from './bottombar/BottomPlaceholder';
export { ProblemsView } from './bottombar/ProblemsView';
