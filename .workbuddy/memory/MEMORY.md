# CleanNotes 项目记忆

## 项目基本信息
- 技术栈：Vue 3 + TypeScript + Pinia + TailwindCSS v4 + Tiptap + Supabase
- 主项目路径：`D:\CleanNotepad\v1.3.0\`
- 部署：dist 挂 IIS，`robocopy dist prod /E /XD .git`（**禁止 /MIR**，prod 有独立 .git）
- 构建：`npx vite build`，`base: './'`，`__APP_VERSION__` + `__BUILD_TIME__` 注入
- Git：`https://github.com/shzalen/cleannotes.git`（prod: `cleannotes-prod`）

## 认证与存储架构
- Supabase Auth 邮箱+密码（JWT），RLS 用 `auth.uid()::text`
- 纯在线架构：`getStorage()` → `supabaseAdapter`，无 localStorage 数据层
- growthStorage：内存缓存 + 2s 防抖上传，flag 用 localStorage
- App.vue 初始化：6 个 store 并行 `load()`；Tiptap 扩展同步读取 `useMemoStore().memos`
- 时间戳统一 UTC ISO（带 Z），`normalizeTimestamp()` 防护旧格式
- 旧用户迁移：RPC `migrate_user_data(p_phone)` + `clearOldLocalStorage()`

## 暗黑模式
- CSS 变量：`:root` + `[data-theme="dark"]` + `[data-theme="zuru"]`
- 四模式：light/dark/auto/zuru（ZURU 品牌红 #E53935）
- hex 禁止出现在 .vue style 中，用 CSS 变量；半透明用 `color-mix()`
- html2canvas-pro 无法解析 var()，导出时 onclone 预收集计算值内联

## 周报模块
- 格式重构为测试报告风格（2026-07-13）：card 容器 + h2 标题 + summary-box 居中统计 + report-table
- `generateReportContent()` 生成 HTML → v-html + DOMPurify 渲染
- ReportPoster.vue 独立海报组件（html2canvas-pro 导出 PNG），不受内容格式重构影响
- `sectionHeader(title)` 输出 `<h2 class="section-title">`，`summaryBox(value, label, color)` 输出居中卡片

## 富文本编辑器
- Tiptap + 自定义扩展（SlashCommand/Mermaid/Mindmap/DoubleBracketLinker）
- 图片上传：Canvas 压缩（1920px + JPEG 80%）→ Supabase Storage → 公开 URL
- Mermaid/Mindmap 动态 import 代码分割，500ms 防抖

## 性能优化要点
- vendor-vue 分离 + 异步化组件 → 登录页 ~140KB gzip
- DOMPurify 动态 import，入口 chunk ~318KB（gzip 90KB）
- 渐进式渲染：IntersectionObserver + 批量递增 50
- 写入节流：300ms 防抖 + Map 队列合并 + visibilitychange/登出 flush
- 跨标签页同步：BroadcastChannel + 各 store `load(force)`

## 安全审计总览
- 五轮安全审计累计修复 55+ 项，最终全部通过
- 暂缓项（4 项低）：select=、setTimeout、N+1、hybrid.ts 死代码（保留备查）
- 测试报告：`public/test-reports/` 下各轮 HTML

## 文件附件系统
- Bucket: `cleannote_attachments`（Public），路径 `memo/{userId}/{randomUUID}-{safeName}`
- RLS: 公开读取 + `auth.uid()` 隔离写入/删除
- MIME 白名单：19 种安全类型

## 生产环境排查（2026-07-13）
- GitHub Pages 部署报错 `toLocalDate is not defined`：根因为 `TaskHeatmap.vue` 使用 `toLocalDate` 未导入，Vite 打包后运行时变量未定义。已修复。
- AI 配置保存报错 `Unexpected end of JSON input`：根因为 `supabase.ts` 的 `request()` 直接 `res.json()`，当返回空 body 时解析失败。已改为 `res.text()` + `JSON.parse()`，空 body 返回 `null`。
- `ai.ts` 错误提示已区分：Web Crypto 不可用 / 存储网络错误 / 加密失败。
- 新增教训：Vite 打包不会自动提示未导入的函数，需定期用静态检查或 IDE 标红；`return=minimal` 不保证一定是 204。主仓库 commit 57bc7f8。

- 静态测试报告：`v1.3.0-functional-test-report-2026-07-13.html`（29 项缺陷，全部修复）
- 交互测试报告：`v1.3.0-interactive-test-report.html`（47 用例，44 通过/1 P0 已修复/2 需真机验证）
- **交互测试 P0 Bug（已修复）**：H5Settings.vue `const { h5Confirm } = useH5Dialog()` 解构错误 → h5Confirm undefined → onLogout 静默失败。改为 `import { h5Confirm } from useH5Dialog`（与 H5TaskEdit/H5TodoList 一致）
- prod 仓库 commits：2850ea0（静态修复）+ 9677961（交互测试+h5Confirm 修复）
- **需真机验证**：H5 ConfirmDialog 触摸事件传播、H5 登出功能
