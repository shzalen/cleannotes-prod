# CleanNotes 项目记忆

## 项目基本信息
- 技术栈：Vue 3 + TypeScript + Pinia + TailwindCSS v4 + Tiptap + Supabase
- 主项目路径：`D:\CleanNotepad\v1.3.0\`
- 部署：dist 内容挂 IIS，robocopy **dist 内容**直接到 `D:\CleanNotepad-Prod\v1.3.0\` 根目录（不是复制 dist 文件夹）
  - 正确命令：`robocopy "D:\CleanNotepad\v1.3.0\dist" "D:\CleanNotepad-Prod\v1.3.0" /E /XD .git`
  - **禁止 /MIR**（prod 有独立 .git）；**禁止**目标是 `...\dist`（会多套一层目录）
- 构建：每次 `vite build` 完成后，**自动将 dist 内容同步到 `D:\CleanNotepad-Prod\v1.3.0\`**（robocopy），无需用户提醒
- 构建：`npx vite build`，`base: './'`，`__APP_VERSION__` + `__BUILD_TIME__` 注入
- Git：`https://github.com/shzalen/cleannotes.git`（prod: `cleannotes-prod`）
- **提交公约**：每次 `vite build` + robocopy 完成后，**自动 `git add -A && git commit`** 到本地（spa 分支），用户手动推送。commit message 格式：简洁概括本轮改动内容（中文）。已变更的文件用 `git diff --cached --stat` 确认范围。
- **报告公约**：所有生成的报告（HTML 测试报告、审查报告等）统一使用**深色模式**（深色背景 + 浅色文字）
- **会话约定（2026-07-15）**：当前会话默认目标是 H5 移动端优化，若无特别说明，所有请求都针对 `src/mobile/` 下的 H5 页面和组件

## 移动端 PWA 架构（2026-07-14）
- **多入口构建**：`vite.config.ts` 中 `rollupOptions.input` = `{ main: index.html, mobile: mobile.html }`
- **移动端独立入口**：`mobile.html` → `src/mobile.ts` → `MobileApp.vue`，与 PC 端完全分离
- **路由**：`src/mobile/router/index.ts`，Hash 模式；3 Tab（首页/应用/我的）+ 子应用（`/app/:name`）
- **共享层**：Pinia Store + Service + types + Supabase — 两端完全共享
- **PWA**：手动 `public/manifest.json` + `public/sw-mobile.js`（vite-plugin-pwa 依赖冲突未用）
- **访问**：`/mobile.html`（PC 端仍为 `/index.html`）
- **TodoItem 注意**：无 `completed` 字段，待办池是"未转任务的idea"概念，`activeTodos` 过滤已转任务

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

## 已知 Bug 修复速查（2026-07-13 第二轮）
- **BUG-04 刷新回首页**：路由守卫需在评估受保护路由前 `await auth.init()` 恢复会话（auth store 加 `initialized` 幂等标志）。否则刷新瞬间 `isAuthenticated=false` 误判未登录→重定向 login→home。已修复（commit 71232ed）。
- **BUG-05 周报 AI 总结卡「生成中」**：`generateAiSummary` 不能用 `aiSummaryStatus==='generating'` 做重入守卫（Phase 1 的占位状态会被误判为进行中）。改用 module-level `generatingInFlight` Set；`callAiForSummary` 配置缺失须返回 `{summary:null, error}` 而非裸 null；整体 try/finally 保底置 failed。已修复（commit 71232ed）。
- 教训：两阶段（占位 generating → 异步 Phase 2）模式下，占位状态与生产状态必须区分，重入保护用独立 in-flight 标志，不要用业务状态位兼任。

## 已知 Bug 修复速查（2026-07-13 第三轮）
- **BUG-06 Mermaid 图表空白**：第四轮安全审计(commit 9bb86f8)将 DOMPurify `ADD_ATTR` 从 `['*']` 改为显式约 50 个属性白名单，mermaid 11 SVG 的 CSS class 引用、aria-*、data-* 等关键属性被剥离导致不可见。修复：恢复 `ADD_ATTR: ['*']`，保留 `FORBID_TAGS: ['script'], FORBID_ATTR: ['on*']`。mermaid 已有 `securityLevel: 'sandbox'`，DOMPurify 是纵深防御不应过度限制（commit 711df96）。
- 教训：安全优化收紧白名单时必须验证第三方渲染库输出的兼容性；这些库生成的 SVG/HTML 属性集合不可预测，显式白名单极易遗漏关键属性。
